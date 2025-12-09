import Peak from "../../typeDefs/Peak";
import convertPgNumbers from "../convertPgNumbers";
import getCloudSqlConnection from "../getCloudSqlConnection";

const searchPeaks = async (
    bounds?: [[number, number], [number, number]],
    userId?: string,
    search?: string,
    showSummittedPeaks?: boolean,
    page?: number,
    pageSize?: number,
    state?: string
): Promise<Peak[]> => {
    const db = await getCloudSqlConnection();

    let paramIndex = userId ? 2 : 1; // Start at 2 if userId is present (it's $1), otherwise start at 1

    const getWhereClause = () => {
        const clauses = [];
        if (bounds) {
            clauses.push(
                `p.location_coords && ST_MakeEnvelope($${paramIndex}, $${
                    paramIndex + 1
                }, $${paramIndex + 2}, $${paramIndex + 3}, 4326)::geography`
            );
            paramIndex += 4;
        }
        if (search) {
            clauses.push(`p.name ILIKE $${paramIndex}`);
            paramIndex += 1;
        }
        if (state) {
            clauses.push(`p.state = $${paramIndex}`);
            paramIndex += 1;
        }
        if (!showSummittedPeaks && userId) {
            clauses.push("ap2.id IS NULL");
        }
        return clauses.length > 0 ? "WHERE " + clauses.join(" AND ") : "";
    };

    const query = `
        SELECT p.id, p.name, p.elevation, p.county, p.state, p.country,
        ARRAY[ST_X(p.location_coords::geometry), ST_Y(p.location_coords::geometry)] as location_coords${
            userId ? ", upf.user_id IS NOT NULL AS is_favorited" : ""
        }
        ${
            userId && showSummittedPeaks
                ? ", COUNT(DISTINCT ap2.id) AS summits"
                : ""
        }
        , COUNT(DISTINCT ap3.id) AS public_summits
        , COUNT(DISTINCT pc.challenge_id) AS num_challenges
        FROM peaks p 
        ${
            userId
                ? `LEFT JOIN (
                        SELECT ap.id, ap.peak_id FROM (
                            SELECT a.user_id, ap.id, ap.timestamp, ap.activity_id, ap.peak_id, ap.notes, ap.is_public FROM activities_peaks ap
                            LEFT JOIN activities a ON a.id = ap.activity_id
                            UNION
                            SELECT user_id, id, timestamp, activity_id, peak_id, notes, is_public FROM user_peak_manual
                        ) ap
                        WHERE ap.user_id = $1
                    ) ap2 ON p.id = ap2.peak_id
                    LEFT JOIN user_peak_favorite upf
                    ON p.id = upf.peak_id`
                : ""
        }
        LEFT JOIN (
            SELECT ap4.id, ap4.peak_id FROM activities_peaks ap4 WHERE ap4.is_public = true
            UNION
            SELECT upm.id, upm.peak_id FROM user_peak_manual upm WHERE upm.is_public = true
        )
        ap3 ON ap3.peak_id = p.id
        LEFT JOIN peaks_challenges pc ON pc.peak_id = p.id
        ${getWhereClause()}
        GROUP BY p.name, p.id, p.location_coords, p.elevation, p.county, p.state, p.country${
            userId ? ", upf.user_id" : ""
        }
        ORDER BY p.elevation DESC NULLS LAST
        ${
            page && pageSize
                ? `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
                : ""
        }
    `;

    const params = [
        ...(userId ? [userId] : []),
        ...(bounds
            ? [
                  Math.min(bounds[0][1], bounds[1][1]),
                  Math.min(bounds[0][0], bounds[1][0]),
                  Math.max(bounds[0][1], bounds[1][1]),
                  Math.max(bounds[0][0], bounds[1][0]),
              ]
            : []),
        ...(search ? [`%${search}%`] : []),
        ...(state ? [state] : []),
        ...(page && pageSize ? [pageSize, (page - 1) * pageSize] : []),
    ];

    // Log formatted query for debugging
    // let formattedQuery = query;
    // params.forEach((param, index) => {
    //     const placeholder = `$${index + 1}`;
    //     const value = typeof param === "string" ? `'${param}'` : param;
    //     formattedQuery = formattedQuery.replace(placeholder, String(value));
    // });
    // console.log("Formatted Query:", formattedQuery);

    const peaks = (await db.query(query, params)).rows as Peak[];

    return convertPgNumbers(peaks);
};

export default searchPeaks;
