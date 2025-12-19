import getCloudSqlConnection from "../getCloudSqlConnection";

interface DenyResult {
    success: boolean;
    message: string;
}

const denySummit = async (
    summitId: string,
    userId: string
): Promise<DenyResult> => {
    const db = await getCloudSqlConnection();

    // First verify the summit belongs to the user
    const verifyQuery = `
        SELECT ap.id 
        FROM activities_peaks ap
        LEFT JOIN activities a ON ap.activity_id = a.id
        WHERE ap.id = $1 AND a.user_id = $2
    `;

    const verifyResult = await db.query(verifyQuery, [summitId, userId]);

    if (verifyResult.rows.length === 0) {
        return {
            success: false,
            message: "Summit not found or not owned by user",
        };
    }

    // Update the confirmation status to denied
    const updateQuery = `
        UPDATE activities_peaks 
        SET confirmation_status = 'denied',
            needs_confirmation = false
        WHERE id = $1
    `;

    await db.query(updateQuery, [summitId]);

    return {
        success: true,
        message: "Summit denied",
    };
};

export default denySummit;

