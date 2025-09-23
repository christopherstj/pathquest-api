import { RowDataPacket } from "mysql2";
import ManualPeakSummit from "../../typeDefs/ManualPeakSummit";
import db from "../getCloudSqlConnection";

const addManualPeakSummit = async (newEntry: ManualPeakSummit) => {
    await db.execute<RowDataPacket[]>(
        `
        INSERT INTO UserPeakManual
        (\`id\`,
        \`userId\`,
        \`peakId\`,
        \`notes\`,
        \`activityId\`,
        \`isPublic\`,
        \`timestamp\`,
        \`timezone\`)
        VALUES
        (?,?,?,?,?,?,?,?);
    `,
        [
            newEntry.id,
            newEntry.userId,
            newEntry.peakId,
            newEntry.notes ?? null,
            newEntry.activityId ?? null,
            newEntry.isPublic,
            newEntry.timestamp,
            newEntry.timezone,
        ]
    );
    return newEntry;
};

export default addManualPeakSummit;
