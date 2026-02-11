import getCloudSqlConnection from "../getCloudSqlConnection";

interface ForecastResponse {
    timezone?: string;
    current?: {
        time: string;
        temperature_2m: number;
        apparent_temperature: number;
        weather_code: number;
        wind_speed_10m: number;
        wind_direction_10m: number;
        relative_humidity_2m: number;
        cloud_cover: number;
        precipitation: number;
        is_day: number;
    };
    hourly?: {
        time: string[];
        temperature_2m: number[];
        precipitation_probability: number[];
        precipitation: number[];
        weather_code: number[];
        wind_speed_10m: number[];
        wind_gusts_10m: number[];
        wind_direction_10m: number[];
        cloud_cover: number[];
    };
    daily?: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_max: number[];
        precipitation_sum: number[];
        snowfall_sum: number[];
        wind_speed_10m_max: number[];
        wind_gusts_10m_max: number[];
        wind_direction_10m_dominant: number[];
        cloud_cover_mean: number[];
        sunrise: string[];
        sunset: string[];
        daylight_duration: number[];
        uv_index_max: number[];
    };
}

interface HistoricalResponse {
    daily?: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_sum: number[];
        snowfall_sum: number[];
        wind_speed_10m_max: number[];
    };
}

// ── Resolver: forecast → structured JSONB ────────────────────────────────────

const resolveWeatherForecast = (raw: ForecastResponse) => {
    let precipitationProbability: number | null = null;
    if (raw.current && raw.hourly?.time && raw.hourly?.precipitation_probability) {
        const hourPrefix = raw.current.time?.slice(0, 13);
        const idx = raw.hourly.time.findIndex((t) => t.slice(0, 13) === hourPrefix);
        if (idx >= 0) precipitationProbability = raw.hourly.precipitation_probability[idx] ?? null;
    }

    const current = {
        temperature: raw.current?.temperature_2m ?? null,
        feelsLike: raw.current?.apparent_temperature ?? null,
        weatherCode: raw.current?.weather_code ?? null,
        windSpeed: raw.current?.wind_speed_10m ?? null,
        windDirection: raw.current?.wind_direction_10m ?? null,
        humidity: raw.current?.relative_humidity_2m ?? null,
        cloudCover: raw.current?.cloud_cover ?? null,
        precipitation: raw.current?.precipitation ?? null,
        precipitationProbability,
        isDay: raw.current?.is_day === 1,
    };

    const daily = (raw.daily?.time ?? []).map((date, i) => ({
        date,
        weatherCode: raw.daily!.weather_code?.[i] ?? null,
        tempHigh: raw.daily!.temperature_2m_max?.[i] ?? null,
        tempLow: raw.daily!.temperature_2m_min?.[i] ?? null,
        precipProbability: raw.daily!.precipitation_probability_max?.[i] ?? null,
        precipSum: raw.daily!.precipitation_sum?.[i] ?? null,
        snowfallSum: raw.daily!.snowfall_sum?.[i] ?? null,
        windSpeed: raw.daily!.wind_speed_10m_max?.[i] ?? null,
        windGusts: raw.daily!.wind_gusts_10m_max?.[i] ?? null,
        windDirection: raw.daily!.wind_direction_10m_dominant?.[i] ?? null,
        cloudCover: raw.daily!.cloud_cover_mean?.[i] ?? null,
        sunrise: raw.daily!.sunrise?.[i] ?? null,
        sunset: raw.daily!.sunset?.[i] ?? null,
        daylightSeconds: raw.daily!.daylight_duration?.[i] ?? null,
        uvIndexMax: raw.daily!.uv_index_max?.[i] ?? null,
    }));

    return { current, daily, timezone: raw.timezone ?? null };
};

const resolveRecentWeather = (raw: HistoricalResponse) => {
    let totalPrecipMm = 0;
    let totalSnowfallCm = 0;
    const days = (raw.daily?.time ?? []).map((date, i) => {
        const precip = raw.daily!.precipitation_sum?.[i] ?? null;
        const snowfall = raw.daily!.snowfall_sum?.[i] ?? null;
        if (precip !== null) totalPrecipMm += precip;
        if (snowfall !== null) totalSnowfallCm += snowfall;
        return {
            date,
            tempHigh: raw.daily!.temperature_2m_max?.[i] ?? null,
            tempLow: raw.daily!.temperature_2m_min?.[i] ?? null,
            precipSum: precip,
            snowfallSum: snowfall,
            weatherCode: raw.daily!.weather_code?.[i] ?? null,
            windSpeedMax: raw.daily!.wind_speed_10m_max?.[i] ?? null,
        };
    });

    return {
        days,
        totalPrecipMm: days.length > 0 ? totalPrecipMm : null,
        totalSnowfallCm: days.length > 0 ? totalSnowfallCm : null,
    };
};

// ── Summit window scoring ────────────────────────────────────────────────────

type SummitLabel = "Excellent" | "Good" | "Marginal" | "Poor" | "Dangerous";

const scoreWind = (ws: number | null, wg: number | null) => {
    const eff = Math.max(ws ?? 0, (wg ?? 0) * 0.7);
    if (eff <= 30) return 100;
    if (eff >= 80) return 0;
    return Math.round(100 * (1 - (eff - 30) / 50));
};

const scorePrecip = (prob: number | null, sum: number | null) => {
    const ps = prob !== null ? Math.max(0, 100 - prob) : 100;
    const vol = sum !== null && sum > 5 ? Math.min(30, (sum - 5) * 3) : 0;
    return Math.max(0, Math.round(ps - vol));
};

const scoreTemp = (hi: number | null, lo: number | null) => {
    if (hi === null || lo === null) return 70;
    const avg = (hi + lo) / 2;
    const boundary = 93.75; // value at 0°C and 25°C from comfort zone formula
    if (avg >= 0 && avg <= 25) return Math.round(100 - Math.abs(avg - 12.5) * 0.5);
    if (avg < 0) return Math.max(0, Math.round(boundary + avg * (boundary / 20)));
    return Math.max(0, Math.round(boundary - (avg - 25) * (boundary / 20)));
};

const scoreStorm = (hourlyProb: number[] | undefined, offset: number) => {
    if (!hourlyProb || offset < 0) return 80;
    const start = offset + 12;
    const end = Math.min(offset + 18, hourlyProb.length);
    if (start >= hourlyProb.length) return 80;
    let max = 0;
    for (let h = start; h < end; h++) if ((hourlyProb[h] ?? 0) > max) max = hourlyProb[h];
    if (max >= 70) return 10;
    if (max >= 50) return 40;
    if (max >= 30) return 70;
    return 100;
};

const scoreDaylight = (sec: number | null) => {
    if (sec === null) return 70;
    const h = sec / 3600;
    if (h >= 10) return 100;
    if (h >= 8) return Math.round(50 + (h - 8) * 25);
    if (h >= 6) return Math.round((h - 6) * 25);
    return 0;
};

const scoreCloud = (cc: number | null) => {
    if (cc === null) return 80;
    if (cc <= 30) return 100;
    if (cc <= 70) return Math.round(100 - (cc - 30) * 0.5);
    return Math.round(80 - (cc - 70));
};

const getLabel = (s: number): SummitLabel =>
    s >= 80 ? "Excellent" : s >= 60 ? "Good" : s >= 40 ? "Marginal" : s >= 20 ? "Poor" : "Dangerous";

const resolveSummitWindow = (raw: ForecastResponse) => {
    if (!raw.daily) return { days: [], bestDay: null, bestScore: null };
    const dates = raw.daily.time ?? [];
    const hp = raw.hourly?.precipitation_probability;
    let bestDay: string | null = null;
    let bestScore: number | null = null;

    const days = dates.map((date, i) => {
        const f = {
            wind: scoreWind(raw.daily!.wind_speed_10m_max?.[i] ?? null, raw.daily!.wind_gusts_10m_max?.[i] ?? null),
            precipitation: scorePrecip(raw.daily!.precipitation_probability_max?.[i] ?? null, raw.daily!.precipitation_sum?.[i] ?? null),
            temperature: scoreTemp(raw.daily!.temperature_2m_max?.[i] ?? null, raw.daily!.temperature_2m_min?.[i] ?? null),
            stormTiming: scoreStorm(hp, i * 24),
            daylight: scoreDaylight(raw.daily!.daylight_duration?.[i] ?? null),
            cloudCover: scoreCloud(raw.daily!.cloud_cover_mean?.[i] ?? null),
        };
        const score = Math.round(
            f.wind * 0.3 + f.precipitation * 0.25 + f.temperature * 0.15 +
            f.stormTiming * 0.15 + f.daylight * 0.1 + f.cloudCover * 0.05
        );
        const label = getLabel(score);

        const parts: string[] = [];
        parts.push(f.wind >= 80 ? "calm winds" : f.wind >= 50 ? "moderate winds" : "strong winds");
        parts.push(f.precipitation >= 80 ? "dry" : f.precipitation >= 50 ? "chance of precip" : "likely precipitation");
        if (f.temperature < 40) parts.push("extreme temps");
        else if (f.temperature < 60) parts.push("cold");
        if (f.stormTiming < 40) parts.push("afternoon storms likely");
        const summary = parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + (parts.length > 1 ? ", " + parts.slice(1).join(", ") : "");

        if (bestScore === null || score > bestScore) { bestScore = score; bestDay = date; }
        return { date, score, label, factors: f, summary };
    });

    return { days, bestDay, bestScore };
};

// ── Main function ────────────────────────────────────────────────────────────

/**
 * Fetch weather directly from Open-Meteo, resolve, and upsert into peak_conditions.
 * Runs entirely within the API — no external service call needed.
 */
const triggerOnDemandWeatherFetch = async (peakId: string): Promise<void> => {
    try {
        const db = await getCloudSqlConnection();

        // Get peak coordinates
        const peakResult = await db.query(
            `SELECT ST_Y(location_coords::geometry) AS lat,
                    ST_X(location_coords::geometry) AS lon,
                    elevation
             FROM peaks WHERE id = $1 AND location_coords IS NOT NULL`,
            [peakId]
        );
        if (peakResult.rows.length === 0) return;

        const { lat, lon, elevation } = peakResult.rows[0];
        const elevParam = elevation ? `&elevation=${Math.round(elevation)}` : "";

        // Fetch forecast + historical from Open-Meteo in parallel
        const today = new Date();
        const sevenAgo = new Date(today); sevenAgo.setDate(today.getDate() - 7);
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

        const [forecastRes, histRes] = await Promise.all([
            fetch(
                `https://api.open-meteo.com/v1/forecast?` +
                `latitude=${lat}&longitude=${lon}` +
                `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,cloud_cover,precipitation,is_day` +
                `&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover` +
                `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,snowfall_sum,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,cloud_cover_mean,sunrise,sunset,daylight_duration,uv_index_max` +
                elevParam + `&timezone=auto&forecast_days=7&forecast_hours=48`
            ),
            fetch(
                `https://archive-api.open-meteo.com/v1/archive?` +
                `latitude=${lat}&longitude=${lon}` +
                `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,wind_speed_10m_max` +
                elevParam + `&timezone=auto` +
                `&start_date=${sevenAgo.toISOString().split("T")[0]}&end_date=${yesterday.toISOString().split("T")[0]}`
            ),
        ]);

        if (!forecastRes.ok) {
            console.error(`On-demand forecast API error: ${forecastRes.status}`);
            return;
        }

        const forecast: ForecastResponse = await forecastRes.json();
        const historical: HistoricalResponse = histRes.ok ? await histRes.json() : { daily: undefined };

        // Resolve
        const weatherForecast = resolveWeatherForecast(forecast);
        const recentWeather = resolveRecentWeather(historical);
        const summitWindow = resolveSummitWindow(forecast);

        // Store raw data — delete previous then insert to keep only latest
        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
        await db.query(
            `DELETE FROM conditions_data WHERE peak_id = $1 AND source = 'open_meteo_forecast'`,
            [peakId]
        );
        await db.query(
            `INSERT INTO conditions_data (peak_id, source, data, expires_at) VALUES ($1, 'open_meteo_forecast', $2, $3)`,
            [peakId, JSON.stringify(forecast), expiresAt]
        );

        // Upsert resolved conditions
        await db.query(
            `INSERT INTO peak_conditions (peak_id, weather_forecast, recent_weather, summit_window, weather_updated_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             ON CONFLICT (peak_id) DO UPDATE SET
                 weather_forecast = EXCLUDED.weather_forecast,
                 recent_weather = EXCLUDED.recent_weather,
                 summit_window = EXCLUDED.summit_window,
                 weather_updated_at = NOW(),
                 updated_at = NOW()`,
            [peakId, JSON.stringify(weatherForecast), JSON.stringify(recentWeather), JSON.stringify(summitWindow)]
        );
    } catch (error) {
        console.error(`On-demand weather fetch failed for peak ${peakId}:`, error);
    }
};

export default triggerOnDemandWeatherFetch;
