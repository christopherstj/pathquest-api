import ManualPeakSummit from "../../typeDefs/ManualPeakSummit";
import getCloudSqlConnection from "../getCloudSqlConnection";

const addManualPeakSummit = async (newEntry: ManualPeakSummit) => {
    const db = await getCloudSqlConnection();
    await db.query(
        `
        INSERT INTO user_peak_manual
        (id,
        user_id,
        peak_id,
        notes,
        activity_id,
        is_public,
        timestamp,
        timezone)
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8);
    `,
        [
            newEntry.id,
            newEntry.user_id,
            newEntry.peak_id,
            newEntry.notes ?? null,
            newEntry.activity_id ?? null,
            newEntry.is_public,
            newEntry.timestamp,
            newEntry.timezone,
        ]
    );
    return newEntry;
};

export default addManualPeakSummit;
