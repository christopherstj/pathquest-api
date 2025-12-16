import getCloudSqlConnection from "../getCloudSqlConnection";

export interface SummitWithPeak {
    id: string;
    timestamp: string;
    timezone?: string;
    notes?: string;
    difficulty?: "easy" | "moderate" | "hard" | "expert";
    experience_rating?: "amazing" | "good" | "tough" | "epic";
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
    };
}

interface DbRow {
    id: string;
    timestamp: string;
    timezone?: string;
    notes?: string;
    difficulty?: string;
    experience_rating?: string;
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
                p.country as peak_country
            FROM activities a
            LEFT JOIN (
                SELECT id, timestamp, activity_id, peak_id, notes, is_public, difficulty, experience_rating,
                       temperature, weather_code, precipitation, cloud_cover, wind_speed, wind_direction, humidity
                FROM activities_peaks
                WHERE activity_id = $1
                UNION ALL
                SELECT id, timestamp, activity_id, peak_id, notes, is_public, difficulty, experience_rating,
                       temperature, weather_code, precipitation, cloud_cover, wind_speed, wind_direction, humidity
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
        },
    }));
};

export default getSummitsByActivity;
