import { RowDataPacket } from "mysql2";
import db from "../getCloudSqlConnection";

const getActivitiesProcessing = async (userId: string) => {
    const query = `
        SELECT COUNT(*) numActivities FROM EventQueue WHERE userId = ? AND completed IS NULL AND attempts < 5;
    `;

    const [rows] = await db.query<
        ({ numActivities: number } & RowDataPacket)[]
    >(query, [userId]);
    return rows[0]?.numActivities ?? 0;
};

export default getActivitiesProcessing;
