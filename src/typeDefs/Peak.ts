export default interface Peak {
    id: string;
    name: string;
    location_coords?: [number, number];
    elevation?: number;
    county?: string;
    state?: string;
    country?: string;
    is_favorited?: boolean;
    distance?: number;
    summits?: number;
    public_summits?: number;
    num_challenges?: number;
    ascents?: {
        id: string;
        timestamp: string;
        activity_id: string;
        notes?: string;
        timezone?: string;
    }[];
}
