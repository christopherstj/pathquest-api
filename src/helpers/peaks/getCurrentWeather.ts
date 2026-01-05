export type CurrentWeatherData = {
    temperature: number | null; // Celsius
    weatherCode: number | null;
    cloudCover: number | null;
    windSpeed: number | null; // km/h
    windDirection: number | null; // degrees
    humidity: number | null; // percent
    precipitation: number | null; // mm
    precipitationProbability: number | null; // percent
    feelsLike: number | null; // Celsius
    isDay: boolean | null;
};

/**
 * Fetches current weather conditions for a given location using Open-Meteo API.
 * This is a free API that doesn't require an API key.
 * 
 * @param coords - Object with lat and lon coordinates
 * @param elevation - Elevation in meters (for more accurate temperature)
 * @returns Current weather data
 */
const getCurrentWeather = async (
    coords: { lat: number; lon: number },
    elevation?: number
): Promise<CurrentWeatherData> => {
    try {
        const elevationParam = elevation ? `&elevation=${elevation}` : "";
        
        const url =
            `https://api.open-meteo.com/v1/forecast?` +
            `latitude=${coords.lat}&longitude=${coords.lon}&` +
            `current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m` +
            `&hourly=precipitation_probability` +
            elevationParam +
            `&timezone=auto`;

        const response = await fetch(url);
        
        if (!response.ok) {
            console.error(`Weather API error: ${response.status}`);
            return createEmptyWeatherData();
        }

        const data = await response.json();

        if (!data.current) {
            console.error("No current weather data in response");
            return createEmptyWeatherData();
        }

        // Derive precipitation probability for "now" from the hourly array (Open-Meteo doesn't always expose it in `current`)
        // Note: `current.time` may include minutes, while hourly times are usually on the hour.
        const currentTime: string | null = data.current?.time ?? null;
        let precipitationProbability: number | null = null;
        try {
            const hourlyTimes: string[] | undefined = data.hourly?.time;
            const hourlyProb: number[] | undefined = data.hourly?.precipitation_probability;
            if (currentTime && Array.isArray(hourlyTimes) && Array.isArray(hourlyProb)) {
                // 1) Exact match
                let idx = hourlyTimes.indexOf(currentTime);

                // 2) Hour match (YYYY-MM-DDTHH)
                if (idx < 0) {
                    const hourPrefix = currentTime.slice(0, 13);
                    idx = hourlyTimes.findIndex((t) => typeof t === "string" && t.slice(0, 13) === hourPrefix);
                }

                // 3) Closest time fallback
                if (idx < 0) {
                    const targetMs = Date.parse(currentTime);
                    if (!Number.isNaN(targetMs)) {
                        let bestIdx = -1;
                        let bestDelta = Number.POSITIVE_INFINITY;
                        for (let i = 0; i < hourlyTimes.length; i++) {
                            const ms = Date.parse(hourlyTimes[i] as any);
                            if (Number.isNaN(ms)) continue;
                            const delta = Math.abs(ms - targetMs);
                            if (delta < bestDelta) {
                                bestDelta = delta;
                                bestIdx = i;
                            }
                        }
                        idx = bestIdx;
                    }
                }

                if (idx >= 0) precipitationProbability = hourlyProb[idx] ?? null;
            }
        } catch {
            // best-effort
        }

        return {
            temperature: data.current.temperature_2m ?? null,
            weatherCode: data.current.weather_code ?? null,
            cloudCover: data.current.cloud_cover ?? null,
            windSpeed: data.current.wind_speed_10m ?? null,
            windDirection: data.current.wind_direction_10m ?? null,
            humidity: data.current.relative_humidity_2m ?? null,
            precipitation: data.current.precipitation ?? null,
            precipitationProbability,
            feelsLike: data.current.apparent_temperature ?? null,
            isDay: data.current.is_day === 1,
        };
    } catch (error) {
        console.error("Error fetching current weather:", error);
        return createEmptyWeatherData();
    }
};

const createEmptyWeatherData = (): CurrentWeatherData => ({
    temperature: null,
    weatherCode: null,
    cloudCover: null,
    windSpeed: null,
    windDirection: null,
    humidity: null,
    precipitation: null,
    precipitationProbability: null,
    feelsLike: null,
    isDay: null,
});

export default getCurrentWeather;

