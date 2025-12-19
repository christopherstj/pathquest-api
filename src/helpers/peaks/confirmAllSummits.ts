import getCloudSqlConnection from "../getCloudSqlConnection";

interface ConfirmAllResult {
    success: boolean;
    message: string;
    count: number;
}

const confirmAllSummits = async (userId: string): Promise<ConfirmAllResult> => {
    const db = await getCloudSqlConnection();

    // Update all unconfirmed summits for the user
    const updateQuery = `
        UPDATE activities_peaks ap
        SET confirmation_status = 'user_confirmed',
            needs_confirmation = false
        FROM activities a
        WHERE ap.activity_id = a.id 
          AND a.user_id = $1
          AND ap.confirmation_status = 'unconfirmed'
    `;

    const result = await db.query(updateQuery, [userId]);

    return {
        success: true,
        message: `Confirmed ${result.rowCount} summits`,
        count: result.rowCount || 0,
    };
};

export default confirmAllSummits;

