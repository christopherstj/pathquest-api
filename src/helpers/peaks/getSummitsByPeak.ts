import Summit from "../../typeDefs/Summit";
import getCloudSqlConnection from "../getCloudSqlConnection";
import convertPgNumbers from "../convertPgNumbers";

const getSummitsByPeak = async (peakId: string, userId: string) => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query(
            `
            SELECT ap.id, ap.timestamp, ap.activity_id, ap.notes, ap.is_public, ap.temperature, ap.precipitation, ap.weather_code, ap.cloud_cover, ap.wind_speed, ap.wind_direction, ap.humidity, ap.difficulty, ap.experience_rating, ap.condition_tags, ap.timezone
            FROM (
                SELECT a.user_id, ap.id, ap.timestamp, ap.activity_id, ap.peak_id, ap.notes, ap.is_public, ap.temperature, ap.precipitation, ap.weather_code, ap.cloud_cover, ap.wind_speed, ap.wind_direction, ap.humidity, ap.difficulty, ap.experience_rating, ap.condition_tags, a.timezone 
                FROM activities_peaks ap
                LEFT JOIN activities a ON a.id = ap.activity_id
                WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                UNION
                SELECT user_id, id, timestamp, activity_id, peak_id, notes, is_public, temperature, precipitation, weather_code, cloud_cover, wind_speed, wind_direction, humidity, difficulty, experience_rating, condition_tags, timezone 
                FROM user_peak_manual
            ) ap
            WHERE peak_id = $1
            AND ap.user_id = $2
        `,
            [peakId, userId]
        )
    ).rows as Summit[];

    return convertPgNumbers(rows);
};

export default getSummitsByPeak;
