type WeatherData = {
    temperature: number | null;
    precipitation: number | null;
    weatherCode: number | null;
    cloudCover: number | null;
    windSpeed: number | null;
    windDirection: number | null;
    humidity: number | null;
};

const getHistoricalWeather = async (
    timestamp: Date,
    coords: { lat: number; lon: number },
    elevation: number
): Promise<WeatherData> => {
    try {
        const dateStr = timestamp.toISOString().split("T")[0];
        const hour = timestamp.getUTCHours();

        const url =
            `https://archive-api.open-meteo.com/v1/archive?` +
            `latitude=${coords.lat}&longitude=${coords.lon}&` +
            `start_date=${dateStr}&end_date=${dateStr}&` +
            `hourly=temperature_2m,precipitation,weathercode,cloudcover,windspeed_10m,winddirection_10m,relativehumidity_2m&` +
            `elevation=${elevation}&` +
            `timezone=UTC`;

        const response = await fetch(url);
        
        if (!response.ok) {
            console.error(`Weather API error: ${response.status}`);
            return {
                temperature: null,
                precipitation: null,
                weatherCode: null,
                cloudCover: null,
                windSpeed: null,
                windDirection: null,
                humidity: null,
            };
        }

        const data = await response.json();

        // Get the closest hour's data
        return {
            temperature: data.hourly?.temperature_2m?.[hour] ?? null,
            precipitation: data.hourly?.precipitation?.[hour] ?? null,
            weatherCode: data.hourly?.weathercode?.[hour] ?? null,
            cloudCover: data.hourly?.cloudcover?.[hour] ?? null,
            windSpeed: data.hourly?.windspeed_10m?.[hour] ?? null,
            windDirection: data.hourly?.winddirection_10m?.[hour] ?? null,
            humidity: data.hourly?.relativehumidity_2m?.[hour] ?? null,
        };
    } catch (error) {
        console.error("Error fetching historical weather:", error);
        return {
            temperature: null,
            precipitation: null,
            weatherCode: null,
            cloudCover: null,
            windSpeed: null,
            windDirection: null,
            humidity: null,
        };
    }
};

export default getHistoricalWeather;









