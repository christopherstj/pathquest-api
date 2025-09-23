import { RowDataPacket } from "mysql2/promise";
import db from "../getCloudSqlConnection";
import Peak from "../../typeDefs/Peak";

const getPeaks = async (page: number, perPage: number, search?: string) => {
    const skip = (page - 1) * perPage;

    if (search) {
        const [rows] = await db.query<(Peak & RowDataPacket)[]>(
            `SELECT * FROM Peak WHERE LOWER(\`Name\`) LIKE CONCAT('%', ?, '%') ORDER BY Altitude DESC LIMIT ? OFFSET ?`,
            [search.toLocaleLowerCase(), perPage, skip]
        );
        return rows;
    } else {
        const [rows] = await db.query<(Peak & RowDataPacket)[]>(
            `SELECT * FROM Peak ORDER BY Altitude DESC LIMIT ? OFFSET ?`,
            [perPage, skip]
        );
        return rows;
    }
};

export default getPeaks;
