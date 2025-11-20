import getCloudSqlConnection from "../getCloudSqlConnection";
import Challenge from "../../typeDefs/Challenge";

const getChallengesByPeak = async (peakId: string, userId?: string) => {
    const db = await getCloudSqlConnection();

    const query = userId
        ? `   
        SELECT c.*, COUNT(pc2.peak_id) AS num_peaks, COUNT(ap2.peak_id) AS num_completed, ucf.user_id IS NOT NULL AS is_favorited, ucf.is_public
        FROM peaks_challenges pc
        LEFT JOIN challenges c ON pc.challenge_id = c.id
        LEFT JOIN peaks_challenges pc2 ON c.id = pc2.challenge_id
        LEFT JOIN 
        (
            SELECT ap.peak_id FROM (
                SELECT a.user_id, ap.peak_id FROM activities_peaks ap
                LEFT JOIN activities a ON a.id = ap.activity_id
                UNION
                SELECT user_id, peak_id FROM user_peak_manual
            ) ap
            WHERE ap.user_id = $1
            GROUP BY ap.peak_id
        ) ap2 ON pc2.peak_id = ap2.peak_id
        LEFT JOIN user_challenge_favorite ucf ON c.id = ucf.challenge_id AND ucf.user_id = $1
        WHERE pc.peak_id = $2
        GROUP BY c.id, ucf.user_id, ucf.is_public
        ORDER BY c.name ASC
        `
        : `SELECT c.*, COUNT(pc2.peak_id) AS num_peaks 
             FROM peaks_challenges pc
             LEFT JOIN challenges c ON pc.challenge_id = c.id
             LEFT JOIN peaks_challenges pc2 ON c.id = pc2.challenge_id
             WHERE pc.peak_id = $1
             GROUP BY c.id
             ORDER BY c.name ASC`;

    const params = userId ? [userId, peakId] : [peakId];

    const rows = (await db.query(query, params)).rows as Challenge[];

    return rows;
};

export default getChallengesByPeak;
