import getCloudSqlConnection from "../getCloudSqlConnection";

/**
 * Flag a peak for coordinate review by setting needs_review = true
 */
const flagPeakForReview = async (peakId: string): Promise<boolean> => {
    const db = await getCloudSqlConnection();
    
    const result = await db.query(
        `UPDATE peaks SET needs_review = true WHERE id = $1`,
        [peakId]
    );
    
    return (result.rowCount ?? 0) > 0;
};

export default flagPeakForReview;

