import getCloudSqlConnection from "../getCloudSqlConnection";

export interface UnconfirmedSummit {
    id: string;
    peakId: string;
    peakName: string;
    peakElevation: number;
    activityId: string;
    timestamp: string;
    distanceFromPeak: number; // meters
    confidenceScore: number;
}

const getUnconfirmedSummits = async (
    userId: string,
    limit?: number
): Promise<UnconfirmedSummit[]> => {
    const db = await getCloudSqlConnection();

    const query = `
        SELECT 
            ap.id,
            ap.peak_id,
            p.name as peak_name,
            p.elevation::float as peak_elevation,
            ap.activity_id,
            ap.timestamp::text as timestamp,
            ap.confidence_score::float as confidence_score,
            ST_X(p.location_coords::geometry)::float as peak_lng,
            ST_Y(p.location_coords::geometry)::float as peak_lat
        FROM activities_peaks ap
        LEFT JOIN activities a ON ap.activity_id = a.id
        LEFT JOIN peaks p ON ap.peak_id = p.id
        WHERE a.user_id = $1 
          AND ap.needs_confirmation = true
          AND COALESCE(ap.confirmation_status, 'auto_confirmed') NOT IN ('user_confirmed', 'denied')
        ORDER BY ap.timestamp DESC
        ${limit ? `LIMIT ${limit}` : ''}
    `;

    const result = await db.query(query, [userId]);

    return result.rows.map((row: any) => ({
        id: row.id,
        peakId: row.peak_id,
        peakName: row.peak_name,
        peakElevation: row.peak_elevation,
        activityId: row.activity_id,
        timestamp: row.timestamp,
        distanceFromPeak: 0, // Distance calculation would require activity coords - keeping simple for now
        confidenceScore: row.confidence_score || 0,
    }));
};

export default getUnconfirmedSummits;

