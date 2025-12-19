import getConnection from "../getCloudSqlConnection";

interface PeakActivity {
    summitsThisWeek: number;
    summitsThisMonth: number;
    lastSummitDate: string | null;
}

export default async function getPeakActivity(peakId: string): Promise<PeakActivity> {
    const connection = await getConnection();
    
    const query = `
        WITH all_summits AS (
            -- Strava activity summits (public only, not denied)
            SELECT ap.timestamp
            FROM activities_peaks ap
            JOIN activities a ON a.id = ap.activity_id
            JOIN users u ON u.id = a.user_id
            WHERE ap.peak_id = $1
              AND COALESCE(a.is_public, true) = true
              AND COALESCE(u.is_public, true) = true
              AND (ap.confirmation_status IS NULL OR ap.confirmation_status != 'denied')
            
            UNION ALL
            
            -- Manual summits (public only)
            SELECT upm.timestamp
            FROM user_peak_manual upm
            JOIN users u ON u.id = upm.user_id
            WHERE upm.peak_id = $1
              AND COALESCE(upm.is_public, true) = true
              AND COALESCE(u.is_public, true) = true
        )
        SELECT 
            COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '7 days')::int AS summits_this_week,
            COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '30 days')::int AS summits_this_month,
            MAX(timestamp) AS last_summit_date
        FROM all_summits;
    `;
    
    const result = await connection.query(query, [peakId]);
    const row = result.rows[0];
    
    return {
        summitsThisWeek: row?.summits_this_week ?? 0,
        summitsThisMonth: row?.summits_this_month ?? 0,
        lastSummitDate: row?.last_summit_date ? row.last_summit_date.toISOString() : null,
    };
}

