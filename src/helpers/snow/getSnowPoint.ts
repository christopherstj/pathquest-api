const NOHRSC_BASE =
    "https://mapservices.weather.noaa.gov/raster/rest/services/snow/NOHRSC_Snow_Analysis/MapServer/identify";

export type SnowPointResult = {
    snowDepthM: number | null;
    sweM: number | null;
    source: "NOHRSC";
    updatedAt: string;
};

/**
 * Query the NOAA NOHRSC Snow Analysis MapServer for snow depth and SWE
 * at a given lat/lng point.
 *
 * Layer 3 = Snow Depth (pixel value in meters)
 * Layer 7 = SWE (pixel value in mm, converted to meters for consistency)
 */
const getSnowPoint = async (
    lat: number,
    lng: number
): Promise<SnowPointResult> => {
    const mapExtent = `${lng - 0.1},${lat - 0.1},${lng + 0.1},${lat + 0.1}`;

    const params = new URLSearchParams({
        geometry: `${lng},${lat}`,
        geometryType: "esriGeometryPoint",
        sr: "4326",
        layers: "all:3,7",
        tolerance: "1",
        mapExtent,
        imageDisplay: "400,400,96",
        returnGeometry: "false",
        f: "json",
    });

    const url = `${NOHRSC_BASE}?${params.toString()}`;
    const res = await fetch(url);

    if (!res.ok) {
        throw new Error(`NOHRSC API returned ${res.status}`);
    }

    const data = await res.json();
    const results: any[] = data.results ?? [];

    let snowDepthM: number | null = null;
    let sweM: number | null = null;

    for (const r of results) {
        const pixelValue = parseFloat(r.attributes?.["Service Pixel Value"]);
        if (isNaN(pixelValue) || pixelValue < 0) continue;

        if (r.layerId === 3) {
            snowDepthM = pixelValue;
        } else if (r.layerId === 7) {
            // SWE pixel value is in mm; convert to meters
            sweM = pixelValue / 1000;
        }
    }

    return {
        snowDepthM,
        sweM,
        source: "NOHRSC",
        updatedAt: new Date().toISOString(),
    };
};

export default getSnowPoint;
