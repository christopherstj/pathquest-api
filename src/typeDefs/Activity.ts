export default interface Activity {
    title?: string;
    id: string;
    user_id: string;
    start_coords: [number, number];
    distance: number;
    coords: [number, number][];
    vert_profile?: number[];
    distance_stream?: number[];
    time_stream?: number[];
    start_time: string;
    sport?: string;
    timezone?: string;
    gain?: number;
    reprocessing: boolean;
    peak_summits?: number;
    // Trip report fields
    trip_report?: string;
    trip_report_is_public?: boolean;
    display_title?: string;
    condition_tags?: string[];
    is_reviewed?: boolean;
}
