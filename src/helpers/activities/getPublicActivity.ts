import getCloudSqlConnection from "../getCloudSqlConnection";

interface PublicActivityUser {
    id: string;
    name: string;
    avatar?: string;
}

interface PublicActivitySummit {
    id: string;
    timestamp: string;
    peak: {
        id: string;
        name: string;
        elevation?: number;
        state?: string;
        country?: string;
    };
    notes?: string;
    difficulty?: string;
}

interface PublicActivity {
    id: string;
    display_title?: string;
    trip_report?: string;
    condition_tags?: string[];
    start_time: string;
    timezone?: string;
    user?: PublicActivityUser;
    summits: PublicActivitySummit[];
}

const getPublicActivity = async (
    activityId: string
): Promise<PublicActivity | null> => {
    const db = await getCloudSqlConnection();

    // Get activity with user info
    const activityResult = await db.query<{
        id: string;
        display_title: string | null;
        trip_report: string | null;
        trip_report_is_public: boolean | null;
        condition_tags: string[] | null;
        start_time: string;
        timezone: string | null;
        user_id: string;
        user_name: string | null;
        user_avatar: string | null;
        user_is_public: boolean;
    }>(
        `
        SELECT 
            a.id,
            a.display_title,
            a.trip_report,
            a.trip_report_is_public,
            a.condition_tags,
            a.start_time,
            a.timezone,
            a.user_id,
            u.name as user_name,
            u.avatar as user_avatar,
            u.is_public as user_is_public
        FROM activities a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.id = $1
        `,
        [activityId]
    );

    if (activityResult.rows.length === 0) {
        return null;
    }

    const activity = activityResult.rows[0];

    // Get public summits with peak info
    const summitsResult = await db.query<{
        id: string;
        timestamp: string;
        notes: string | null;
        difficulty: string | null;
        is_public: boolean | null;
        peak_id: string;
        peak_name: string;
        peak_elevation: number | null;
        peak_state: string | null;
        peak_country: string | null;
    }>(
        `
        SELECT 
            ap.id,
            ap.timestamp,
            ap.notes,
            ap.difficulty,
            ap.is_public,
            p.id as peak_id,
            p.name as peak_name,
            p.elevation as peak_elevation,
            p.state as peak_state,
            p.country as peak_country
        FROM activities_peaks ap
        JOIN peaks p ON ap.peak_id = p.id
        WHERE ap.activity_id = $1
          AND COALESCE(ap.confirmation_status, 'auto_confirmed') != 'denied'
        ORDER BY ap.timestamp
        `,
        [activityId]
    );

    // Check if there's any public data to show
    const hasTripReport = activity.trip_report_is_public && activity.trip_report;
    const hasPublicSummits = summitsResult.rows.some(s => s.is_public !== false);
    const hasDisplayTitle = !!activity.display_title;

    if (!hasTripReport && !hasPublicSummits && !hasDisplayTitle) {
        return null;
    }

    // Build response
    const response: PublicActivity = {
        id: activity.id,
        start_time: activity.start_time,
        timezone: activity.timezone ?? undefined,
        summits: [],
    };

    // Include display_title if set
    if (activity.display_title) {
        response.display_title = activity.display_title;
    }

    // Include trip report and condition tags if public
    if (activity.trip_report_is_public) {
        if (activity.trip_report) {
            response.trip_report = activity.trip_report;
        }
        if (activity.condition_tags && activity.condition_tags.length > 0) {
            response.condition_tags = activity.condition_tags;
        }
    }

    // Include user info if user is public
    if (activity.user_is_public && activity.user_name) {
        response.user = {
            id: activity.user_id,
            name: activity.user_name,
            avatar: activity.user_avatar ?? undefined,
        };
    }

    // Build summits array
    response.summits = summitsResult.rows.map(summit => {
        const summitResponse: PublicActivitySummit = {
            id: summit.id,
            timestamp: summit.timestamp,
            peak: {
                id: summit.peak_id,
                name: summit.peak_name,
                elevation: summit.peak_elevation ?? undefined,
                state: summit.peak_state ?? undefined,
                country: summit.peak_country ?? undefined,
            },
        };

        // Only include notes and difficulty if summit is public
        if (summit.is_public !== false) {
            if (summit.notes) {
                summitResponse.notes = summit.notes;
            }
            if (summit.difficulty) {
                summitResponse.difficulty = summit.difficulty;
            }
        }

        return summitResponse;
    });

    return response;
};

export default getPublicActivity;
