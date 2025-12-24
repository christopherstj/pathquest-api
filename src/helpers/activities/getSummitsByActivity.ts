import getCloudSqlConnection from "../getCloudSqlConnection";

export interface SummitWithPeak {
    id: string;
    timestamp: string;
    timezone?: string;
    notes?: string;
    difficulty?: "easy" | "moderate" | "hard" | "expert";
    experience_rating?: "amazing" | "good" | "tough" | "epic";
    condition_tags?: string[];
    custom_condition_tags?: string[];
    temperature?: number;
    weather_code?: number;
    precipitation?: number;
    cloud_cover?: number;
    wind_speed?: number;
    wind_direction?: number;
    humidity?: number;
    peak: {
        id: string;
        name: string;
        elevation?: number;
        location_coords?: [number, number];
        county?: string;
        state?: string;
        country?: string;
        public_summits?: number;
    };
}

interface DbRow {
    id: string;
    timestamp: string;
    timezone?: string;
    notes?: string;
    difficulty?: string;
    experience_rating?: string;
    condition_tags?: string[];
    custom_condition_tags?: string[];
    temperature?: number;
    weather_code?: number;
    precipitation?: number;
    cloud_cover?: number;
    wind_speed?: number;
    wind_direction?: number;
    humidity?: number;
    peak_id: string;
    peak_name: string;
    peak_elevation?: number;
    peak_location_coords?: [number, number];
    peak_county?: string;
    peak_state?: string;
    peak_country?: string;
    peak_public_summits?: number;
}

const getSummitsByActivity = async (
    activityId: string
): Promise<SummitWithPeak[]> => {
    const db = await getCloudSqlConnection();

    const rows = (
        await db.query<DbRow>(
            `SELECT 
                ap.id,
                ap.timestamp,
                a.timezone,
                ap.notes,
                ap.difficulty,
                ap.experience_rating,
                ap.condition_tags,
                ap.custom_condition_tags,
                ap.temperature,
                ap.weather_code,
                ap.precipitation,
                ap.cloud_cover,
                ap.wind_speed,
                ap.wind_direction,
                ap.humidity,
                p.id as peak_id,
                p.name as peak_name,
                p.elevation as peak_elevation,
                ARRAY[ST_X(p.location_coords::geometry), ST_Y(p.location_coords::geometry)] as peak_location_coords,
                p.county as peak_county,
                p.state as peak_state,
                p.country as peak_country,
                (
                    SELECT COUNT(DISTINCT pub.id)
                    FROM (
                        SELECT ap4.id, ap4.peak_id 
                        FROM activities_peaks ap4
                        LEFT JOIN activities a4 ON a4.id = ap4.activity_id
                        LEFT JOIN users u4 ON u4.id = a4.user_id
                        WHERE ap4.is_public = true 
                        AND u4.is_public = true
                        AND COALESCE(ap4.confirmation_status, 'auto_confirmed') != 'denied'
                        UNION
                        SELECT upm.id, upm.peak_id 
                        FROM user_peak_manual upm
                        LEFT JOIN users u5 ON u5.id = upm.user_id
                        WHERE upm.is_public = true AND u5.is_public = true
                    ) pub
                    WHERE pub.peak_id = p.id
                ) AS peak_public_summits
            FROM activities a
            LEFT JOIN (
                SELECT id, timestamp, activity_id, peak_id, notes, is_public, difficulty, experience_rating,
                       temperature, weather_code, precipitation, cloud_cover, wind_speed, wind_direction, humidity,
                       condition_tags, custom_condition_tags
                FROM activities_peaks
                WHERE activity_id = $1
                  AND COALESCE(confirmation_status, 'auto_confirmed') != 'denied'
                UNION ALL
                SELECT id, timestamp, activity_id, peak_id, notes, is_public, difficulty, experience_rating,
                       temperature, weather_code, precipitation, cloud_cover, wind_speed, wind_direction, humidity,
                       condition_tags, custom_condition_tags
                FROM user_peak_manual
                WHERE activity_id = $1
            ) ap ON a.id = ap.activity_id
            LEFT JOIN peaks p ON ap.peak_id = p.id
            WHERE a.id = $1 AND p.id IS NOT NULL
            ORDER BY ap.timestamp`,
            [activityId]
        )
    ).rows;

    return rows.map((row) => ({
        id: row.id,
        timestamp: row.timestamp,
        timezone: row.timezone,
        notes: row.notes,
        difficulty: row.difficulty as SummitWithPeak["difficulty"],
        experience_rating: row.experience_rating as SummitWithPeak["experience_rating"],
        condition_tags: row.condition_tags,
        custom_condition_tags: row.custom_condition_tags,
        temperature: row.temperature,
        weather_code: row.weather_code,
        precipitation: row.precipitation,
        cloud_cover: row.cloud_cover,
        wind_speed: row.wind_speed,
        wind_direction: row.wind_direction,
        humidity: row.humidity,
        peak: {
            id: row.peak_id,
            name: row.peak_name,
            elevation: row.peak_elevation,
            location_coords: row.peak_location_coords,
            county: row.peak_county,
            state: row.peak_state,
            country: row.peak_country,
            public_summits: row.peak_public_summits != null ? parseInt(String(row.peak_public_summits)) : undefined,
        },
    }));
};

export default getSummitsByActivity;
