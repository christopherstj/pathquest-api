import { RowDataPacket } from "mysql2";
import PeakSummit from "../../typeDefs/PeakSummit";
import db from "../getCloudSqlConnection";
import Peak from "../../typeDefs/Peak";
import getUserPrivacy from "../user/getUserPrivacy";

const getPeakSummitsByUser = async (
    userId: string,
    includePrivate: boolean = false
): Promise<PeakSummit[]> => {
    const [rows] = await db.query<(Peak & RowDataPacket)[]>(
        `
        SELECT p.*
        FROM (
            SELECT a.userId, ap.id, ap.timestamp, ap.activityId, ap.peakId, ap.notes, ap.isPublic FROM ActivityPeak ap
            LEFT JOIN Activity a ON a.id = ap.activityId
            UNION
            SELECT userId, id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
        ) ap 
        LEFT JOIN Peak p ON ap.peakId = p.Id 
        WHERE ap.userId = ? AND (ap.isPublic = 1 OR ?)
        GROUP BY p.\`Name\`, p.Id, p.Lat, p.\`Long\`;
    `,
        [userId, includePrivate]
    );

    const promises = rows.map(async (row): Promise<PeakSummit> => {
        const [ascents] = await db.query<
            ({
                id: string;
                timestamp: string;
                activityId: string;
            } & RowDataPacket)[]
        >(
            `
            SELECT ap.id, \`timestamp\`, activityId
            FROM (
                SELECT a.userId, ap.id, ap.timestamp, ap.activityId, ap.peakId, ap.notes, ap.isPublic FROM ActivityPeak ap
                LEFT JOIN Activity a ON a.id = ap.activityId
                UNION
                SELECT userId, id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
            ) ap
            WHERE peakId = ? 
            AND (ap.isPublic = 1 OR ?)
            AND ap.userId = ?
        `,
            [row.Id, includePrivate, userId]
        );

        return {
            ...row,
            ascents,
        };
    });

    const peakSummits = await Promise.all(promises);

    return peakSummits;
};

export default getPeakSummitsByUser;
