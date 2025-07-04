// import getCloudSqlConnection from "../getCloudSqlConnection";

// const getSubscribedChallenges = async (userId: string,
//     type: "completed" | "in-progress" | "not-started",
//     bounds?: {
//         northWest: {
//             lat: number;
//             lng: number;
//         };
//         southEast: {
//             lat: number;
//             lng: number;
//         };
//     },
//     search?: string) => {
//     const pool = await getCloudSqlConnection();

//     const connection = await pool.getConnection();

//     const query = `
//         SELECT c.id, c.\`name\`, c.centerLat, c.centerLong, c.region, COUNT(p.Id) total, COUNT(ap2.summitted) completed
//         FROM Challenge c
//         LEFT JOIN UserChallengeFavorite ucf ON c.id = ucf.challengeId
//         LEFT JOIN PeakChallenge pc ON pc.challengeId = c.id
//         LEFT JOIN Peak p ON pc.peakId = p.Id
//         LEFT JOIN
//             (
//                 SELECT ap.peakId, COUNT(ap.peakId) > 0 summitted FROM (
//                     SELECT a.userId, ap.id, ap.timestamp, ap.activityId, ap.peakId, ap.notes, ap.isPublic FROM ActivityPeak ap
//                     LEFT JOIN Activity a ON a.id = ap.activityId
//                     UNION
//                     SELECT userId, id, timestamp, activityId, peakId, notes, isPublic FROM UserPeakManual
//                 ) ap
//                 WHERE ap.userId = ?
//                 GROUP BY ap.peakId
//             ) ap2 ON p.Id = ap2.peakId
//         WHERE ucf.userId = ?
//         GROUP BY c.id, c.\`name\`, c.centerLat, c.centerLong;
//     `
// }

// export default getSubscribedChallenges;
