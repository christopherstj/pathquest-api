export default interface Challenge {
    id: number;
    name: string;
    region?: string;
    location_coords?: [number, number];
    description: string;
    num_peaks: number;
}
