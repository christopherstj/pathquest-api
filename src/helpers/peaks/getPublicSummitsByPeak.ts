import Summit from "../../typeDefs/Summit";
import getCloudSqlConnection from "../getCloudSqlConnection";
import convertPgNumbers from "../convertPgNumbers";

// Extended summit type with user_name for public display
interface PublicSummit extends Summit {
    user_name?: string;
}

const getPublicSummitsByPeak = async (peakId: string): Promise<PublicSummit[]> => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query(
            `
            SELECT 
                ap.id, 
                ap.timestamp, 
                ap.activity_id, 
                ap.notes, 
                ap.is_public, 
                ap.temperature, 
                ap.precipitation, 
                ap.weather_code, 
                ap.cloud_cover, 
                ap.wind_speed, 
                ap.wind_direction, 
                ap.humidity,
                ap.difficulty,
                ap.experience_rating,
                ap.timezone,
                u.name as user_name
            FROM (
                SELECT a.user_id, ap.id, ap.timestamp, ap.activity_id, ap.peak_id, ap.notes, ap.is_public, ap.temperature, ap.precipitation, ap.weather_code, ap.cloud_cover, ap.wind_speed, ap.wind_direction, ap.humidity, ap.difficulty, ap.experience_rating, a.timezone FROM activities_peaks ap
                LEFT JOIN activities a ON a.id = ap.activity_id
                UNION
                SELECT user_id, id, timestamp, activity_id, peak_id, notes, is_public, temperature, precipitation, weather_code, cloud_cover, wind_speed, wind_direction, humidity, difficulty, experience_rating, timezone FROM user_peak_manual
            ) ap
            LEFT JOIN users u ON u.id = ap.user_id
            WHERE peak_id = $1
            AND ap.is_public = TRUE
            ORDER BY ap.timestamp DESC
        `,
            [peakId]
        )
    ).rows as PublicSummit[];

    return convertPgNumbers(rows);
};

export default getPublicSummitsByPeak;
