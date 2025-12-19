import getCloudSqlConnection from "../getCloudSqlConnection";

export interface ClimbingStreak {
    currentStreak: number; // Number of consecutive months with at least 1 summit
    isActive: boolean; // True if current month has a summit (streak is ongoing)
    lastSummitMonth: string | null; // ISO date string of the last month with a summit
}

export interface ProfileStats {
    totalPeaks: number;
    totalSummits: number;
    highestPeak: {
        id: string;
        name: string;
        elevation: number;
    } | null;
    challengesCompleted: number;
    totalElevationGained: number; // Sum of distinct peak elevations in meters
    statesClimbed: string[];
    countriesClimbed: string[];
    thisYearSummits: number;
    lastYearSummits: number;
    peakTypeBreakdown: {
        fourteeners: number; // 14000+ ft (4267m+)
        thirteeners: number; // 13000-13999 ft (3962-4266m)
        twelvers: number; // 12000-12999 ft (3658-3961m)
        elevenThousanders: number; // 11000-11999 ft (3353-3657m)
        tenThousanders: number; // 10000-10999 ft (3048-3352m)
        other: number; // Below 10000 ft
    };
    climbingStreak: ClimbingStreak;
}

const getUserProfileStats = async (
    userId: string,
    includePrivate: boolean = false
): Promise<ProfileStats> => {
    const db = await getCloudSqlConnection();

    // Get current year and last year
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;

    // Main query for aggregated stats - gets distinct peaks summited by user
    const statsQuery = `
        WITH user_summits AS (
            SELECT ap.peak_id, ap.timestamp, ap.is_public
            FROM (
                SELECT a.user_id, ap.id, ap.timestamp, ap.activity_id, ap.peak_id, ap.notes, ap.is_public 
                FROM activities_peaks ap
                LEFT JOIN activities a ON a.id = ap.activity_id
                WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                UNION
                SELECT user_id, id, timestamp, activity_id, peak_id, notes, is_public 
                FROM user_peak_manual
            ) ap
            WHERE ap.user_id = $1 AND (ap.is_public = true OR $2)
        ),
        distinct_peaks AS (
            SELECT DISTINCT us.peak_id, p.elevation, p.state, p.country, p.name, p.id
            FROM user_summits us
            LEFT JOIN peaks p ON us.peak_id = p.id
        )
        SELECT 
            COUNT(DISTINCT dp.peak_id) AS total_peaks,
            (SELECT COUNT(*) FROM user_summits) AS total_summits,
            COALESCE(SUM(dp.elevation), 0) AS total_elevation,
            ARRAY_AGG(DISTINCT dp.state) FILTER (WHERE dp.state IS NOT NULL) AS states,
            ARRAY_AGG(DISTINCT dp.country) FILTER (WHERE dp.country IS NOT NULL) AS countries,
            (SELECT COUNT(*) FROM user_summits WHERE EXTRACT(YEAR FROM timestamp) = $3) AS this_year_summits,
            (SELECT COUNT(*) FROM user_summits WHERE EXTRACT(YEAR FROM timestamp) = $4) AS last_year_summits,
            COUNT(DISTINCT dp.peak_id) FILTER (WHERE dp.elevation >= 4267) AS fourteeners,
            COUNT(DISTINCT dp.peak_id) FILTER (WHERE dp.elevation >= 3962 AND dp.elevation < 4267) AS thirteeners,
            COUNT(DISTINCT dp.peak_id) FILTER (WHERE dp.elevation >= 3658 AND dp.elevation < 3962) AS twelvers,
            COUNT(DISTINCT dp.peak_id) FILTER (WHERE dp.elevation >= 3353 AND dp.elevation < 3658) AS eleven_thousanders,
            COUNT(DISTINCT dp.peak_id) FILTER (WHERE dp.elevation >= 3048 AND dp.elevation < 3353) AS ten_thousanders,
            COUNT(DISTINCT dp.peak_id) FILTER (WHERE dp.elevation < 3048 OR dp.elevation IS NULL) AS other_peaks
        FROM distinct_peaks dp
    `;

    const statsResult = await db.query(statsQuery, [userId, includePrivate, currentYear, lastYear]);
    const stats = statsResult.rows[0];

    // Get highest peak
    const highestPeakQuery = `
        SELECT p.id, p.name, p.elevation
        FROM (
            SELECT a.user_id, ap.peak_id, ap.is_public 
            FROM activities_peaks ap
            LEFT JOIN activities a ON a.id = ap.activity_id
            WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
            UNION
            SELECT user_id, peak_id, is_public 
            FROM user_peak_manual
        ) ap
        LEFT JOIN peaks p ON ap.peak_id = p.id
        WHERE ap.user_id = $1 AND (ap.is_public = true OR $2) AND p.elevation IS NOT NULL
        ORDER BY p.elevation DESC
        LIMIT 1
    `;
    const highestPeakResult = await db.query(highestPeakQuery, [userId, includePrivate]);
    const highestPeak = highestPeakResult.rows[0] || null;

    // Get completed challenges count
    const completedChallengesQuery = `
        SELECT COUNT(*) AS completed_count
        FROM (
            SELECT c.id
            FROM challenges c
            LEFT JOIN peaks_challenges pc ON c.id = pc.challenge_id
            LEFT JOIN (
                SELECT DISTINCT ap.peak_id 
                FROM (
                    SELECT a.user_id, ap.peak_id, ap.is_public 
                    FROM activities_peaks ap
                    LEFT JOIN activities a ON a.id = ap.activity_id
                    WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                    UNION
                    SELECT user_id, peak_id, is_public 
                    FROM user_peak_manual
                ) ap
                WHERE ap.user_id = $1 AND (ap.is_public = true OR $2)
            ) user_peaks ON pc.peak_id = user_peaks.peak_id
            GROUP BY c.id
            HAVING COUNT(pc.peak_id) > 0 AND COUNT(user_peaks.peak_id) = COUNT(pc.peak_id)
        ) completed
    `;
    const completedResult = await db.query(completedChallengesQuery, [userId, includePrivate]);

    // Calculate climbing streak (consecutive months with at least 1 summit)
    const streakQuery = `
        WITH user_summits AS (
            SELECT ap.timestamp
            FROM (
                SELECT a.user_id, ap.timestamp, ap.is_public
                FROM activities_peaks ap
                LEFT JOIN activities a ON a.id = ap.activity_id
                WHERE COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
                UNION
                SELECT user_id, timestamp, is_public
                FROM user_peak_manual
            ) ap
            WHERE ap.user_id = $1 AND (ap.is_public = true OR $2)
        ),
        monthly_summits AS (
            SELECT DISTINCT
                DATE_TRUNC('month', timestamp) AS month
            FROM user_summits
            ORDER BY month DESC
        )
        SELECT 
            ARRAY_AGG(month ORDER BY month DESC) AS months
        FROM monthly_summits
    `;
    const streakResult = await db.query(streakQuery, [userId, includePrivate]);
    const summitMonths: Date[] = streakResult.rows[0]?.months || [];
    
    // Calculate consecutive month streak
    let currentStreak = 0;
    let isActive = false;
    let lastSummitMonth: string | null = null;
    
    if (summitMonths.length > 0) {
        const now = new Date();
        const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        
        // Check if the most recent summit is from current or last month
        const mostRecentSummit = new Date(summitMonths[0]);
        const mostRecentMonth = new Date(mostRecentSummit.getFullYear(), mostRecentSummit.getMonth(), 1);
        
        // Streak is active if most recent summit is in current month
        isActive = mostRecentMonth.getTime() === currentMonth.getTime();
        lastSummitMonth = mostRecentMonth.toISOString();
        
        // Calculate streak - must be consecutive months starting from current or last month
        if (mostRecentMonth.getTime() >= lastMonth.getTime()) {
            let expectedMonth = mostRecentMonth;
            
            for (const summitMonthDate of summitMonths) {
                const summitMonth = new Date(summitMonthDate);
                const summitMonthStart = new Date(summitMonth.getFullYear(), summitMonth.getMonth(), 1);
                
                if (summitMonthStart.getTime() === expectedMonth.getTime()) {
                    currentStreak++;
                    // Move to previous month
                    expectedMonth = new Date(expectedMonth.getFullYear(), expectedMonth.getMonth() - 1, 1);
                } else if (summitMonthStart.getTime() < expectedMonth.getTime()) {
                    // Gap found, streak broken
                    break;
                }
            }
        }
    }

    return {
        totalPeaks: parseInt(stats.total_peaks) || 0,
        totalSummits: parseInt(stats.total_summits) || 0,
        highestPeak: highestPeak ? {
            id: highestPeak.id,
            name: highestPeak.name,
            elevation: parseFloat(highestPeak.elevation),
        } : null,
        challengesCompleted: parseInt(completedResult.rows[0].completed_count) || 0,
        totalElevationGained: parseFloat(stats.total_elevation) || 0,
        statesClimbed: stats.states || [],
        countriesClimbed: stats.countries || [],
        thisYearSummits: parseInt(stats.this_year_summits) || 0,
        lastYearSummits: parseInt(stats.last_year_summits) || 0,
        peakTypeBreakdown: {
            fourteeners: parseInt(stats.fourteeners) || 0,
            thirteeners: parseInt(stats.thirteeners) || 0,
            twelvers: parseInt(stats.twelvers) || 0,
            elevenThousanders: parseInt(stats.eleven_thousanders) || 0,
            tenThousanders: parseInt(stats.ten_thousanders) || 0,
            other: parseInt(stats.other_peaks) || 0,
        },
        climbingStreak: {
            currentStreak,
            isActive,
            lastSummitMonth,
        },
    };
};

export default getUserProfileStats;

