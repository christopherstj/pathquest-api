export default interface Activity {
    name?: string;
    id: string;
    userId: string;
    startLat: number;
    startLong: number;
    distance: number;
    coords: [number, number][];
    vertProfile?: number[];
    distanceStream?: number[];
    timeStream?: number[];
    startTime: number;
    sport?: string;
    timezone?: string;
    gain?: number;
}
