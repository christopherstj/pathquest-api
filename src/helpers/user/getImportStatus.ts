import getCloudSqlConnection from "../getCloudSqlConnection";

// How often queue handler runs (per hour) - must match queue-handler setting
const RUNS_PER_HOUR = 12;

// Requests per activity (activity detail + streams)
const REQUESTS_PER_ACTIVITY = 2;

// Reserve percentage for webhooks - must match queue-handler setting
const WEBHOOK_RESERVE_PERCENT = 0.1;

interface ImportStatus {
    // Counts
    totalActivities: number;
    processedActivities: number;
    pendingActivities: number;
    skippedActivities: number;

    // Progress
    summitsFound: number;
    percentComplete: number;

    // Estimates
    estimatedHoursRemaining: number | null;

    // Status
    status: "not_started" | "processing" | "complete";
    message: string;
}

interface RateLimitRow {
    daily_limit: number;
    daily_usage: number;
}

interface CountRow {
    count: string;
}

/**
 * Get import progress status for a user.
 * Shows how many activities have been processed, summits found,
 * and estimated time to completion.
 */
const getImportStatus = async (userId: string): Promise<ImportStatus> => {
    const pool = await getCloudSqlConnection();

    // Get counts in parallel
    const [
        pendingResult,
        completedResult,
        summitsResult,
        rateLimitResult,
        historicalFlagResult,
    ] = await Promise.all([
        // Pending activities for this user
        pool.query<CountRow>(
            `SELECT COUNT(*) as count FROM event_queue 
             WHERE user_id = $1 
               AND completed IS NULL 
               AND attempts < 5`,
            [userId]
        ),

        // Completed activities for this user (processed successfully)
        pool.query<CountRow>(
            `SELECT COUNT(*) as count FROM event_queue 
             WHERE user_id = $1 
               AND completed IS NOT NULL`,
            [userId]
        ),

        // Summits found for this user (from activities_peaks)
        pool.query<CountRow>(
            `SELECT COUNT(*) as count FROM activities_peaks ap
             JOIN activities a ON ap.activity_id = a.id
             WHERE a.user_id = $1
               AND COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'`,
            [userId]
        ),

        // Rate limit info for ETA calculation
        pool.query<RateLimitRow>(`SELECT daily_limit, daily_usage FROM strava_rate_limits`),

        // Check if historical data processing has been flagged as complete
        pool.query<{ historical_data_processed: boolean }>(
            `SELECT historical_data_processed FROM users WHERE id = $1`,
            [userId]
        ),
    ]);

    const pendingActivities = parseInt(pendingResult.rows[0]?.count || "0", 10);
    const completedActivities = parseInt(completedResult.rows[0]?.count || "0", 10);
    const summitsFound = parseInt(summitsResult.rows[0]?.count || "0", 10);
    const totalActivities = pendingActivities + completedActivities;
    const historicalDataProcessed = historicalFlagResult.rows[0]?.historical_data_processed ?? false;

    // Calculate percent complete
    const percentComplete =
        totalActivities > 0
            ? Math.round((completedActivities / totalActivities) * 100)
            : 0;

    // Determine status
    let status: ImportStatus["status"];
    if (pendingActivities === 0 && historicalDataProcessed) {
        status = "complete";
    } else if (completedActivities === 0 && pendingActivities === 0) {
        status = "not_started";
    } else {
        status = "processing";
    }

    // Calculate estimated hours remaining
    let estimatedHoursRemaining: number | null = null;

    if (pendingActivities > 0 && rateLimitResult.rows.length > 0) {
        const { daily_limit, daily_usage } = rateLimitResult.rows[0];
        const dailyRemaining = daily_limit - daily_usage;

        // Calculate hours until midnight UTC
        const now = new Date();
        const hoursUntilReset = 24 - now.getUTCHours() - now.getUTCMinutes() / 60;

        // Sustainable rate calculation (matching queue-handler logic)
        const availableForHistorical = dailyRemaining * (1 - WEBHOOK_RESERVE_PERCENT);
        const activitiesPerHour = availableForHistorical / REQUESTS_PER_ACTIVITY;

        if (activitiesPerHour > 0) {
            // How many hours to process pending at current sustainable rate?
            const hoursAtCurrentRate = pendingActivities / activitiesPerHour;

            // If it'll take longer than until reset, account for new daily budget
            if (hoursAtCurrentRate <= hoursUntilReset) {
                estimatedHoursRemaining = hoursAtCurrentRate;
            } else {
                // Activities we can process before reset
                const activitiesBeforeReset = activitiesPerHour * hoursUntilReset;
                const remainingAfterReset = pendingActivities - activitiesBeforeReset;

                // After reset, we get full daily budget
                const fullDayCapacity = (daily_limit * (1 - WEBHOOK_RESERVE_PERCENT)) / REQUESTS_PER_ACTIVITY;
                const additionalDays = remainingAfterReset / fullDayCapacity;

                estimatedHoursRemaining = hoursUntilReset + additionalDays * 24;
            }

            // Round to 1 decimal place
            estimatedHoursRemaining = Math.round(estimatedHoursRemaining * 10) / 10;
        }
    }

    // Generate user-friendly message
    let message: string;
    if (status === "complete") {
        message = `All activities processed! Found ${summitsFound} summit${summitsFound !== 1 ? "s" : ""}.`;
    } else if (status === "not_started") {
        message = "Waiting to start processing your activities.";
    } else if (estimatedHoursRemaining !== null) {
        if (estimatedHoursRemaining < 1) {
            message = `Almost done! ${pendingActivities} activities remaining.`;
        } else if (estimatedHoursRemaining < 24) {
            const hours = Math.ceil(estimatedHoursRemaining);
            message = `About ${hours} hour${hours !== 1 ? "s" : ""} remaining. Your biggest adventures are being processed first!`;
        } else {
            const days = Math.ceil(estimatedHoursRemaining / 24);
            message = `About ${days} day${days !== 1 ? "s" : ""} remaining. We pace imports to keep your new activities instant.`;
        }
    } else {
        message = `Processing ${pendingActivities} activities...`;
    }

    return {
        totalActivities,
        processedActivities: completedActivities,
        pendingActivities,
        skippedActivities: 0, // We don't track this currently, but could add later
        summitsFound,
        percentComplete,
        estimatedHoursRemaining,
        status,
        message,
    };
};

export default getImportStatus;

