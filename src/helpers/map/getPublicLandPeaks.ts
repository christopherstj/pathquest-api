import getCloudSqlConnection from "../getCloudSqlConnection";

const getPublicLandPeaks = async (objectId: string, page: number = 1, limit: number = 20, userId?: string) => {
    const db = await getCloudSqlConnection();
    const offset = (page - 1) * limit;

    const countResult = await db.query(
        `SELECT COUNT(*) AS total FROM peaks_public_lands WHERE public_land_id = $1`,
        [objectId]
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const params: any[] = [objectId, limit, offset];
    const userIdParam = userId ? `$${params.push(userId)}` : null;

    const result = await db.query(
        `SELECT p.id, p.name, p.elevation, p.state,
                ST_X(p.location_coords::geometry) AS lng,
                ST_Y(p.location_coords::geometry) AS lat,
                COALESCE((
                    SELECT COUNT(DISTINCT sub.id) FROM (
                        SELECT ap.id FROM activities_peaks ap
                        INNER JOIN activities a ON a.id = ap.activity_id
                        INNER JOIN users u ON u.id = a.user_id
                        WHERE ap.peak_id = p.id AND ap.is_public = true AND u.is_public = true
                        AND COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                        UNION
                        SELECT upm.id FROM user_peak_manual upm
                        INNER JOIN users u ON u.id = upm.user_id
                        WHERE upm.peak_id = p.id AND upm.is_public = true AND u.is_public = true
                    ) sub
                ), 0)::int AS public_summits
                ${userIdParam ? `,
                COALESCE((
                    SELECT COUNT(*) FROM (
                        SELECT ap.id FROM activities_peaks ap
                        INNER JOIN activities a ON a.id = ap.activity_id
                        WHERE ap.peak_id = p.id AND a.user_id = ${userIdParam}
                        AND COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                        UNION ALL
                        SELECT upm.id FROM user_peak_manual upm
                        WHERE upm.peak_id = p.id AND upm.user_id = ${userIdParam}
                    ) s
                ), 0)::int AS summits` : ""}
         FROM peaks_public_lands ppl
         JOIN peaks p ON p.id = ppl.peak_id
         WHERE ppl.public_land_id = $1
         ORDER BY p.elevation DESC NULLS LAST
         LIMIT $2 OFFSET $3`,
        params
    );

    return {
        peaks: result.rows.map((r: any) => ({
            id: r.id,
            name: r.name,
            elevation: r.elevation,
            state: r.state,
            location_coords: r.lng != null && r.lat != null ? [parseFloat(r.lng), parseFloat(r.lat)] : null,
            public_summits: r.public_summits ?? 0,
            summits: r.summits ?? 0,
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
};

export default getPublicLandPeaks;
