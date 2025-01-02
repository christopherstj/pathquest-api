import { RowDataPacket } from "mysql2";
import ManualPeakSummit from "../../typeDefs/ManualPeakSummit";
import getCloudSqlConnection from "../getCloudSqlConnection";

const addManualPeakSummit = async (newEntry: ManualPeakSummit) => {
    const connection = await getCloudSqlConnection();

    console.log(newEntry);

    await connection.execute<RowDataPacket[]>(
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

    await connection.end();

    return newEntry;
};

export default addManualPeakSummit;
