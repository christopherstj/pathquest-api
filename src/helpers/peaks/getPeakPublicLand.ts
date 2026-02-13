import getCloudSqlConnection from "../getCloudSqlConnection";

/**
 * Public land designation priority hierarchy.
 * Lower number = higher priority (more prestigious/specific designation).
 */
const DESIGNATION_PRIORITY: Record<string, number> = {
    'NP': 1,    // National Park (highest)
    'NM': 2,    // National Monument
    'WILD': 3,  // Wilderness Area
    'WSA': 4,   // Wilderness Study Area
    'NRA': 5,   // National Recreation Area
    'NCA': 6,   // National Conservation Area
    'NWR': 7,   // National Wildlife Refuge
    'NF': 8,    // National Forest
    'NG': 9,    // National Grassland
    'SP': 10,   // State Park
    'SW': 11,   // State Wilderness
    'SRA': 12,  // State Recreation Area
    'SF': 13,   // State Forest
};

/**
 * Friendly names for designation types
 */
const DESIGNATION_NAMES: Record<string, string> = {
    'NP': 'National Park',
    'NM': 'National Monument',
    'WILD': 'Wilderness Area',
    'WSA': 'Wilderness Study Area',
    'NRA': 'National Recreation Area',
    'NCA': 'National Conservation Area',
    'NWR': 'National Wildlife Refuge',
    'NF': 'National Forest',
    'NG': 'National Grassland',
    'SP': 'State Park',
    'SW': 'State Wilderness',
    'SRA': 'State Recreation Area',
    'SF': 'State Forest',
};

export interface PublicLand {
    objectId: string;
    name: string;
    type: string;
    typeName: string;
    manager: string;
}

/**
 * Gets the primary public land for a peak, selecting the most important
 * designation based on the priority hierarchy.
 * 
 * Returns null if the peak is not within any known public land.
 */
const getPeakPublicLand = async (peakId: string): Promise<PublicLand | null> => {
    const db = await getCloudSqlConnection();
    
    const query = `
        SELECT pl.objectid, pl.unit_nm, pl.des_tp, pl.mang_name
        FROM peaks_public_lands ppl
        JOIN public_lands pl ON ppl.public_land_id = pl.objectid
        WHERE ppl.peak_id = $1
    `;
    
    const result = await db.query(query, [peakId]);
    
    if (result.rows.length === 0) {
        return null;
    }
    
    // Sort by priority and return the most important one
    const sorted = result.rows.sort((a, b) => {
        const priorityA = DESIGNATION_PRIORITY[a.des_tp] ?? 999;
        const priorityB = DESIGNATION_PRIORITY[b.des_tp] ?? 999;
        return priorityA - priorityB;
    });
    
    const primary = sorted[0];
    
    return {
        objectId: String(primary.objectid),
        name: primary.unit_nm || 'Unknown',
        type: primary.des_tp || 'Unknown',
        typeName: DESIGNATION_NAMES[primary.des_tp] || primary.des_tp || 'Public Land',
        manager: primary.mang_name || 'Unknown',
    };
};

export default getPeakPublicLand;

