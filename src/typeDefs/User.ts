export default interface User {
    id: string;
    name: string;
    email?: string;
    pic: string;
    updateDescription: boolean;
    city?: string;
    state?: string;
    country?: string;
    lat?: number;
    long?: number;
    units: "imperial" | "metric";
}
