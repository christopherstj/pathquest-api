import getCloudSqlConnection from "../getCloudSqlConnection";

interface NearbyPeak {
    id: string;
    name: string;
    distanceM: number;
}

async function getNearbyPeaks(siteId: string): Promise<NearbyPeak[]> {
    const db = await getCloudSqlConnection();
    const result = await db.query(
        `SELECT p.id, p.name, pds.distance_m
         FROM peak_data_sources pds
         JOIN peaks p ON p.id = pds.peak_id
         WHERE pds.source_type = 'usgs_gauge' AND pds.source_id = $1
         ORDER BY pds.distance_m LIMIT 10`,
        [siteId]
    );
    return result.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        distanceM: r.distance_m,
    }));
}

function parseHistoryRange(history?: string): string | null {
    const valid: Record<string, string> = { "30d": "30 days", "90d": "90 days", "1y": "1 year" };
    return history ? valid[history] ?? null : null;
}

const getStreamGaugeDetail = async (siteId: string, history?: string) => {
    const db = await getCloudSqlConnection();

    const gaugeResult = await db.query(
        `SELECT ug.site_id, ug.name,
                ST_X(ug.location::geometry) AS lng, ST_Y(ug.location::geometry) AS lat,
                so.discharge_cfs, so.gage_height_ft, so.observed_at, so.status, so.fetched_at
         FROM usgs_gauges ug
         LEFT JOIN streamflow_observations so ON so.site_id = ug.site_id
         WHERE ug.site_id = $1`,
        [siteId]
    );

    if (gaugeResult.rows.length === 0) return null;
    const row = gaugeResult.rows[0];

    const nearbyPeaks = await getNearbyPeaks(siteId);

    let historyData: any[] = [];
    const interval = parseHistoryRange(history);
    if (interval) {
        const histResult = await db.query(
            `SELECT date, discharge_cfs, gage_height_ft
             FROM streamflow_history
             WHERE site_id = $1 AND date >= CURRENT_DATE - $2::interval
             ORDER BY date`,
            [siteId, interval]
        );
        historyData = histResult.rows.map((h: any) => ({
            date: h.date,
            dischargeCfs: h.discharge_cfs,
            gageHeightFt: h.gage_height_ft,
        }));
    }

    return {
        siteId: row.site_id,
        name: row.name,
        location: [row.lng, row.lat],
        current: {
            dischargeCfs: row.discharge_cfs,
            gageHeightFt: row.gage_height_ft,
            observedAt: row.observed_at,
        },
        status: row.status ?? "unknown",
        history: historyData,
        fetchedAt: row.fetched_at,
        nearbyPeaks,
    };
};

export default getStreamGaugeDetail;
