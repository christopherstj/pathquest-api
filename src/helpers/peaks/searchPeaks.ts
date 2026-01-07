import Peak from "../../typeDefs/Peak";
import convertPgNumbers from "../convertPgNumbers";
import getCloudSqlConnection from "../getCloudSqlConnection";
import { getPrimaryExpansion, stripFillerWords } from "../search/expandSearchTerm";

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

    // Expand search term (e.g., "mt" -> "mount")
    const expandedSearch = search ? getPrimaryExpansion(search) : undefined;
    // Strip filler words for similarity matching (e.g., "mount whitney" -> "whitney")
    const strippedSearch = expandedSearch ? stripFillerWords(expandedSearch) : undefined;
    
    // Track parameter indices
    let paramIndex = userId ? 2 : 1;
    
    // Store search param indices for later use in ORDER BY
    let searchParamIndex: number | undefined;
    let searchPatternParamIndex: number | undefined;
    let prefixPatternParamIndex: number | undefined;
    let strippedSearchParamIndex: number | undefined;

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
            // Store indices for search parameters
            searchParamIndex = paramIndex;
            searchPatternParamIndex = paramIndex + 1;
            prefixPatternParamIndex = paramIndex + 2;
            
            // Only allocate index for stripped search if it's different from expanded search
            const useStrippedSimilarity = strippedSearch && strippedSearch !== expandedSearch && strippedSearch.length > 0;
            if (useStrippedSimilarity) {
                strippedSearchParamIndex = paramIndex + 3;
                paramIndex += 4;
            } else {
                paramIndex += 3;
            }
            
            // Use trigram similarity OR ILIKE for broader matching
            // The % operator uses the default similarity threshold (0.3)
            clauses.push(`(
                p.name % $${searchParamIndex} 
                OR p.name ILIKE $${searchPatternParamIndex}
                OR p.name ILIKE $${prefixPatternParamIndex}
            )`);
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

    // Build the ORDER BY clause
    const getOrderByClause = () => {
        if (search && searchParamIndex !== undefined) {
            // Relevancy-based ordering when searching
            // Prioritize exact matches and full phrase matches to ensure "Mount Washington" (NH) 
            // ranks above "Washington Peak" (WA) even if WA peaks are more popular
            // Use stripped search (without filler words) for similarity to reduce weight of "mount", "peak", etc.
            // Score = (exact_match * 0.5) + (full_phrase_match * 0.3) + (stripped_similarity * 0.15) + (prefix_match * 0.05)
            // For similarity, compare against stripped search term to focus on meaningful words like "whitney" not "mount"
            const useStrippedSimilarity = strippedSearch && strippedSearch !== expandedSearch && strippedSearch.length > 0 && strippedSearchParamIndex !== undefined;
            
            return `ORDER BY (
                CASE WHEN LOWER(p.name) = LOWER($${searchParamIndex}) THEN 0.5 ELSE 0 END +
                CASE WHEN p.name ILIKE $${searchPatternParamIndex} THEN 0.3 ELSE 0 END +
                ${useStrippedSimilarity 
                    ? `similarity(p.name, $${strippedSearchParamIndex}) * 0.15`
                    : `similarity(p.name, $${searchParamIndex}) * 0.1`
                } +
                CASE WHEN p.name ILIKE $${prefixPatternParamIndex} THEN 0.05 ELSE 0 END +
                LEAST(COALESCE(psa.public_summits, 0)::float / 1000.0, 0.0)
            ) DESC, p.elevation DESC NULLS LAST`;
        }
        // Default ordering by elevation when not searching
        return "ORDER BY p.elevation DESC NULLS LAST";
    };

    // Optimized query using CTEs to pre-aggregate counts
    // This avoids the expensive row-by-row counting for public_summits
    const query = `
        WITH public_summits_agg AS (
            SELECT 
                peak_id,
                COUNT(DISTINCT id) AS public_summits
            FROM (
                SELECT ap4.id, ap4.peak_id 
                FROM activities_peaks ap4
                LEFT JOIN activities a4 ON a4.id = ap4.activity_id
                LEFT JOIN users u4 ON u4.id = a4.user_id
                WHERE ap4.is_public = true 
                AND u4.is_public = true
                AND COALESCE(ap4.confirmation_status, 'auto_confirmed') != 'denied'
                UNION
                SELECT upm.id, upm.peak_id 
                FROM user_peak_manual upm
                LEFT JOIN users u5 ON u5.id = upm.user_id
                WHERE upm.is_public = true AND u5.is_public = true
            ) pub
            GROUP BY peak_id
        ),
        challenge_counts AS (
            SELECT peak_id, COUNT(DISTINCT challenge_id) AS num_challenges
            FROM peaks_challenges
            GROUP BY peak_id
        )
        SELECT p.id, p.name, p.elevation, p.county, p.state, p.country,
        ARRAY[ST_X(p.location_coords::geometry), ST_Y(p.location_coords::geometry)] as location_coords${
            userId ? ", upf.user_id IS NOT NULL AS is_favorited" : ""
        }
        ${
            userId && showSummittedPeaks
                ? ", COUNT(DISTINCT ap2.id) AS summits"
                : ""
        }
        , COALESCE(psa.public_summits, 0) AS public_summits
        , COALESCE(cc.num_challenges, 0) AS num_challenges
        FROM peaks p 
        ${
            userId
                ? `LEFT JOIN (
                        SELECT ap.id, ap.peak_id FROM (
                            SELECT a.user_id, ap.id, ap.timestamp, ap.activity_id, ap.peak_id, ap.notes, ap.is_public 
                            FROM activities_peaks ap
                            LEFT JOIN activities a ON a.id = ap.activity_id
                            WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                            UNION
                            SELECT user_id, id, timestamp, activity_id, peak_id, notes, is_public 
                            FROM user_peak_manual
                        ) ap
                        WHERE ap.user_id = $1
                    ) ap2 ON p.id = ap2.peak_id
                    LEFT JOIN user_peak_favorite upf
                    ON p.id = upf.peak_id`
                : ""
        }
        LEFT JOIN public_summits_agg psa ON p.id = psa.peak_id
        LEFT JOIN challenge_counts cc ON p.id = cc.peak_id
        ${getWhereClause()}
        GROUP BY p.name, p.id, p.location_coords, p.elevation, p.county, p.state, p.country, psa.public_summits, cc.num_challenges${
            userId ? ", upf.user_id" : ""
        }
        ${getOrderByClause()}
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
        ...(search && expandedSearch
            ? (() => {
                const useStrippedSimilarity = strippedSearch && strippedSearch !== expandedSearch && strippedSearch.length > 0;
                const params = [
                    expandedSearch,           // For trigram similarity (full term)
                    `%${expandedSearch}%`,    // For ILIKE contains
                    `${expandedSearch}%`,     // For ILIKE prefix match
                ];
                // Only add stripped search parameter if it's different and will be used
                if (useStrippedSimilarity) {
                    params.push(strippedSearch);
                }
                return params;
            })()
            : []),
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
