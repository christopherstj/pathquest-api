import getCloudSqlConnection from "../getCloudSqlConnection";

interface TopPeak {
    id: string;
    public_summits: number;
}

const getTopPeaksBySummitCount = async (limit: number = 1000): Promise<TopPeak[]> => {
    const db = await getCloudSqlConnection();

    // Combine summits from activities_peaks and user_peak_manual tables
    const rows = (
        await db.query(
            `SELECT 
                p.id,
                COUNT(ps.id) as public_summits
             FROM peaks p
             LEFT JOIN (
                SELECT ap.id, ap.peak_id, ap.is_public 
                FROM activities_peaks ap
                UNION ALL
                SELECT upm.id, upm.peak_id, upm.is_public 
                FROM user_peak_manual upm
             ) ps ON p.id = ps.peak_id AND ps.is_public = true
             GROUP BY p.id
             HAVING COUNT(ps.id) > 0
             ORDER BY public_summits DESC
             LIMIT $1`,
            [limit]
        )
    ).rows as TopPeak[];

    return rows;
};

export default getTopPeaksBySummitCount;

