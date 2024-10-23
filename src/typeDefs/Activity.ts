export default interface Activity {
    name?: string;
    id: string;
    userId: string;
    startLat: number;
    startLong: number;
    distance: number;
    coords: string;
    startTime: number;
    sport?: string;
    timezone?: string;
}
