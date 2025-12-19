export type CurrentWeatherData = {
    temperature: number | null; // Celsius
    weatherCode: number | null;
    cloudCover: number | null;
    windSpeed: number | null; // km/h
    windDirection: number | null; // degrees
    humidity: number | null; // percent
    precipitation: number | null; // mm
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

        return {
            temperature: data.current.temperature_2m ?? null,
            weatherCode: data.current.weather_code ?? null,
            cloudCover: data.current.cloud_cover ?? null,
            windSpeed: data.current.wind_speed_10m ?? null,
            windDirection: data.current.wind_direction_10m ?? null,
            humidity: data.current.relative_humidity_2m ?? null,
            precipitation: data.current.precipitation ?? null,
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
    feelsLike: null,
    isDay: null,
});

export default getCurrentWeather;

