import ManualPeakSummit from "../../typeDefs/ManualPeakSummit";
import getCloudSqlConnection from "../getCloudSqlConnection";
import getPeakById from "./getPeakById";
import getHistoricalWeather from "./getHistoricalWeather";

const addManualPeakSummit = async (newEntry: ManualPeakSummit) => {
    const db = await getCloudSqlConnection();

    // Get peak data for weather lookup
    const peak = await getPeakById(newEntry.peak_id);
    
    let weather = {
        temperature: null as number | null,
        precipitation: null as number | null,
        weatherCode: null as number | null,
        cloudCover: null as number | null,
        windSpeed: null as number | null,
        windDirection: null as number | null,
        humidity: null as number | null,
    };

    // Fetch historical weather if we have peak coordinates
    if (peak?.location_coords && peak?.elevation) {
        const summitDate = new Date(newEntry.timestamp);
        weather = await getHistoricalWeather(
            summitDate,
            { lat: peak.location_coords[1], lon: peak.location_coords[0] },
            peak.elevation
        );
    }

    await db.query(
        `
        INSERT INTO user_peak_manual
        (id,
        user_id,
        peak_id,
        notes,
        activity_id,
        is_public,
        timestamp,
        timezone,
        difficulty,
        experience_rating,
        temperature,
        precipitation,
        weather_code,
        cloud_cover,
        wind_speed,
        wind_direction,
        humidity)
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17);
    `,
        [
            newEntry.id,
            newEntry.user_id,
            newEntry.peak_id,
            newEntry.notes ?? null,
            newEntry.activity_id ?? null,
            newEntry.is_public,
            newEntry.timestamp,
            newEntry.timezone,
            newEntry.difficulty ?? null,
            newEntry.experience_rating ?? null,
            weather.temperature,
            weather.precipitation,
            weather.weatherCode,
            weather.cloudCover,
            weather.windSpeed,
            weather.windDirection,
            weather.humidity,
        ]
    );
    return newEntry;
};

export default addManualPeakSummit;
