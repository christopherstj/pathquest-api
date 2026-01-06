export type DailyForecast = {
    date: string;
    weatherCode: number | null;
    tempHigh: number | null; // Celsius
    tempLow: number | null; // Celsius
    precipProbability: number | null; // percent
    windSpeed: number | null; // km/h
    windDirection: number | null; // degrees (meteorological; coming FROM)
    cloudCover: number | null; // percent
    sunrise: string | null; // ISO time
    sunset: string | null; // ISO time
};

export type PeakForecastData = {
    daily: DailyForecast[];
    sunrise: string | null; // ISO time for today
    sunset: string | null; // ISO time for today
    daylightSeconds: number | null;
};

/**
 * Fetches 7-day weather forecast + sunrise/sunset for a given location using Open-Meteo API.
 * This is a free API that doesn't require an API key.
 *
 * @param coords - Object with lat and lon coordinates
 * @param elevation - Elevation in meters (for more accurate temperature)
 * @returns Forecast data including daily forecasts and daylight info
 */
const getPeakForecast = async (
    coords: { lat: number; lon: number },
    elevation?: number
): Promise<PeakForecastData> => {
    try {
        const elevationParam = elevation ? `&elevation=${elevation}` : "";

        const url =
            `https://api.open-meteo.com/v1/forecast?` +
            `latitude=${coords.lat}&longitude=${coords.lon}&` +
            `daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant,cloud_cover_mean,sunrise,sunset,daylight_duration` +
            elevationParam +
            `&timezone=auto` +
            `&forecast_days=7`;

        const response = await fetch(url);

        if (!response.ok) {
            console.error(`Forecast API error: ${response.status}`);
            return createEmptyForecastData();
        }

        const data = await response.json();

        if (!data.daily) {
            console.error("No daily forecast data in response");
            return createEmptyForecastData();
        }

        const daily: DailyForecast[] = [];
        const dates = data.daily.time ?? [];

        for (let i = 0; i < dates.length; i++) {
            daily.push({
                date: dates[i],
                weatherCode: data.daily.weather_code?.[i] ?? null,
                tempHigh: data.daily.temperature_2m_max?.[i] ?? null,
                tempLow: data.daily.temperature_2m_min?.[i] ?? null,
                precipProbability: data.daily.precipitation_probability_max?.[i] ?? null,
                windSpeed: data.daily.wind_speed_10m_max?.[i] ?? null,
                windDirection: data.daily.wind_direction_10m_dominant?.[i] ?? null,
                cloudCover: data.daily.cloud_cover_mean?.[i] ?? null,
                sunrise: data.daily.sunrise?.[i] ?? null,
                sunset: data.daily.sunset?.[i] ?? null,
            });
        }

        // Get today's sunrise/sunset/daylight
        const sunrise = data.daily.sunrise?.[0] ?? null;
        const sunset = data.daily.sunset?.[0] ?? null;
        const daylightSeconds = data.daily.daylight_duration?.[0] ?? null;

        return {
            daily,
            sunrise,
            sunset,
            daylightSeconds,
        };
    } catch (error) {
        console.error("Error fetching forecast:", error);
        return createEmptyForecastData();
    }
};

const createEmptyForecastData = (): PeakForecastData => ({
    daily: [],
    sunrise: null,
    sunset: null,
    daylightSeconds: null,
});

export default getPeakForecast;

