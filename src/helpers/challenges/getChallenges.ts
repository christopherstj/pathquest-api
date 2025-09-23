import { RowDataPacket } from "mysql2/promise";
import db from "../getCloudSqlConnection";
import Challenge from "../../typeDefs/Challenge";

const getChallenges = async (
    page: number,
    perPage: number,
    search?: string
) => {
    const skip = (page - 1) * perPage;

    if (search) {
        const [rows] = await db.query<(Challenge & RowDataPacket)[]>(
            `SELECT c.*, COUNT(pc.peakId) numPeaks FROM Challenge c LEFT JOIN PeakChallenge pc ON c.id = pc.challengeId
            WHERE LOWER(\`name\`) LIKE CONCAT('%', ?, '%') 
            GROUP BY c.id
            ORDER BY \`name\` ASC LIMIT ? OFFSET ?`,
            [search.toLocaleLowerCase(), perPage, skip]
        );

        return rows;
    } else {
        const [rows] = await db.query<(Challenge & RowDataPacket)[]>(
            `SELECT c.*, COUNT(pc.peakId) numPeaks FROM Challenge c LEFT JOIN PeakChallenge pc ON c.id = pc.challengeId
            GROUP BY c.id
            ORDER BY \`name\` ASC LIMIT ? OFFSET ?`,
            [perPage, skip]
        );

        return rows;
    }
};

export default getChallenges;
