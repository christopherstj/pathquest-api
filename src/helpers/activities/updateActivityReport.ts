import Activity from "../../typeDefs/Activity";
import getCloudSqlConnection from "../getCloudSqlConnection";

interface UpdateActivityReportInput {
    tripReport?: string;
    tripReportIsPublic?: boolean;
    displayTitle?: string;
    conditionTags?: string[];
}

const updateActivityReport = async (
    activityId: string,
    input: UpdateActivityReportInput
): Promise<Activity | null> => {
    const db = await getCloudSqlConnection();

    // Build dynamic SET clause based on provided fields
    const setClauses: string[] = ["is_reviewed = TRUE"];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.tripReport !== undefined) {
        setClauses.push(`trip_report = $${paramIndex++}`);
        values.push(input.tripReport);
    }

    if (input.tripReportIsPublic !== undefined) {
        setClauses.push(`trip_report_is_public = $${paramIndex++}`);
        values.push(input.tripReportIsPublic);
    }

    if (input.displayTitle !== undefined) {
        setClauses.push(`display_title = $${paramIndex++}`);
        values.push(input.displayTitle);
    }

    if (input.conditionTags !== undefined) {
        setClauses.push(`condition_tags = $${paramIndex++}`);
        values.push(input.conditionTags);
    }

    // Add activityId as the last parameter
    values.push(activityId);

    const rows = (
        await db.query<Activity>(
            `
            UPDATE activities
            SET ${setClauses.join(", ")}
            WHERE id = $${paramIndex}
            RETURNING 
                id, title, user_id,
                ARRAY[ST_X(start_coords::geometry), ST_Y(start_coords::geometry)] as start_coords,
                distance,
                (SELECT json_agg(json_build_array(ST_X(geom), ST_Y(geom)) ORDER BY path)
                 FROM (SELECT (dp).geom, (dp).path FROM ST_DumpPoints(coords::geometry) dp) pts) as coords,
                vert_profile, distance_stream, time_stream,
                start_time, sport, timezone, gain,
                pending_reprocess = true AS reprocessing,
                trip_report, trip_report_is_public, display_title, condition_tags, is_reviewed
            `,
            values
        )
    ).rows;

    if (rows.length === 0) {
        return null;
    }

    return rows[0];
};

export default updateActivityReport;
