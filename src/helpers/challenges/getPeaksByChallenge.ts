import Peak from "../../typeDefs/Peak";
import getCloudSqlConnection from "../getCloudSqlConnection";

const getPeaksByChallenge = async (
    challengeId: number,
    userId: string
): Promise<Peak[] | undefined> => {
    const db = await getCloudSqlConnection();
    const rows = (
        await db.query(
            `
            SELECT p.id, p.name, p.elevation, p.county, p.state, p.country,
            ARRAY[ST_X(p.location_coords::geometry), ST_Y(p.location_coords::geometry)] as location_coords,
            upf.user_id IS NOT NULL AS is_favorited, COUNT(ap2.id) AS summits
            FROM peaks_challenges pc
            LEFT JOIN peaks p ON pc.peak_id = p.id
            LEFT JOIN (
                SELECT ap.id, ap.peak_id FROM (
                    SELECT a.user_id, ap.id, ap.timestamp, ap.activity_id, ap.peak_id, ap.notes, ap.is_public FROM activities_peaks ap
                    LEFT JOIN activities a ON a.id = ap.activity_id
                    UNION
                    SELECT user_id, id, timestamp, activity_id, peak_id, notes, is_public FROM user_peak_manual
                ) ap
                WHERE ap.user_id = $1
            ) ap2 ON p.id = ap2.peak_id
            LEFT JOIN user_peak_favorite upf
            ON p.id = upf.peak_id
            WHERE pc.challenge_id = $2
            GROUP BY p.name, p.id, p.location_coords, upf.user_id, p.elevation, p.county, p.state, p.country
        `,
            [userId, challengeId]
        )
    ).rows as Peak[];

    return rows;
};

export default getPeaksByChallenge;
