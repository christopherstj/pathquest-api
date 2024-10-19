export default interface PeakSummit {
    Id: string;
    Name: string;
    Lat: number;
    Long: number;
    Altitude?: number;
    ascents: {
        timestamp: number;
        activityId: string;
    }[];
}
