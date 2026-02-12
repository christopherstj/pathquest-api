import getCloudSqlConnection from "../getCloudSqlConnection";

function parseHistoryRange(history?: string): string | null {
    const valid: Record<string, string> = { "30d": "30 days", "90d": "90 days", "1y": "1 year" };
    return history ? valid[history] ?? null : null;
}

const getAqiSiteDetail = async (siteId: string, history?: string) => {
    const db = await getCloudSqlConnection();

    const siteResult = await db.query(
        `SELECT site_id, site_name, aqi, pm25_aqi, ozone_aqi,
                dominant_pollutant, category, category_number,
                reporting_area, smoke_impact, observed_at, fetched_at,
                ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat
         FROM aqi_observations
         WHERE site_id = $1`,
        [siteId]
    );

    if (siteResult.rows.length === 0) return null;
    const row = siteResult.rows[0];

    let historyData: any[] = [];
    const interval = parseHistoryRange(history);
    if (interval) {
        const histResult = await db.query(
            `SELECT date, aqi, pm25_aqi, ozone_aqi, dominant_pollutant, category, category_number
             FROM aqi_history
             WHERE site_id = $1 AND date >= CURRENT_DATE - $2::interval
             ORDER BY date`,
            [siteId, interval]
        );
        historyData = histResult.rows.map((h: any) => ({
            date: h.date,
            aqi: h.aqi,
            pm25Aqi: h.pm25_aqi,
            ozoneAqi: h.ozone_aqi,
            dominantPollutant: h.dominant_pollutant,
            category: h.category,
            categoryNumber: h.category_number,
        }));
    }

    return {
        siteId: row.site_id,
        siteName: row.site_name,
        location: [row.lng, row.lat],
        current: {
            aqi: row.aqi,
            category: row.category,
            categoryNumber: row.category_number,
            pm25: row.pm25_aqi,
            ozone: row.ozone_aqi,
            dominantPollutant: row.dominant_pollutant,
        },
        smokeImpact: row.smoke_impact,
        history: historyData,
        fetchedAt: row.fetched_at,
    };
};

export default getAqiSiteDetail;
