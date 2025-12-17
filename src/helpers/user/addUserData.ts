import User from "../../typeDefs/User";
import getCloudSqlConnection from "../getCloudSqlConnection";
import { Client } from "@googlemaps/google-maps-services-js";
import getUserHistoricalData from "../historical-data/getUserHistoricalData";

const client = new Client({});

const addUserData = async ({
    id,
    name,
    email,
    token,
}: {
    id: string;
    name: string;
    email: string | null;
    token: string;
}): Promise<User | null> => {
    const db = await getCloudSqlConnection();
    
    // Fetch user profile from Strava API with error handling
    let userData: {
        city?: string;
        state?: string;
        country?: string;
        profile_medium?: string;
        measurement_preference?: string;
    } = {};
    
    try {
        const stravaRes = await fetch("https://www.strava.com/api/v3/athlete", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (!stravaRes.ok) {
            console.error(`Strava API error: ${stravaRes.status} ${stravaRes.statusText}`);
            // Continue with empty userData - user will be created without profile enrichment
        } else {
            userData = await stravaRes.json();
            console.log(userData);
        }
    } catch (error) {
        console.error("Failed to fetch Strava user data:", error);
        // Continue with empty userData - user will be created without profile enrichment
    }

    const { city, state, country, profile_medium, measurement_preference } =
        userData;

    const units = measurement_preference === "feet" ? "imperial" : "metric";

    if (city && state && country) {
        // Geocode the user's location with error handling
        let lat: number | null = null;
        let lng: number | null = null;
        
        try {
            const geocodeRes = await client.geocode({
                params: {
                    address: `${city}, ${state}, ${country}`,
                    key: process.env.GOOGLE_MAPS_API_KEY ?? "",
                },
            });

            if (geocodeRes.data.results && geocodeRes.data.results.length > 0) {
                lat = geocodeRes.data.results[0].geometry.location.lat;
                lng = geocodeRes.data.results[0].geometry.location.lng;
            } else {
                console.warn(`No geocoding results for: ${city}, ${state}, ${country}`);
            }
        } catch (error) {
            console.error("Geocoding failed:", error);
            // Continue without coordinates
        }

        await db.query(
            `UPDATE users SET
            name = $1,
            email = $2,
            pic = $3,
            city = $4,
            state = $5,
            country = $6,
            location_coords = ${lng && lat ? `ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography` : 'NULL'},
            units = $9
            WHERE id = $10;
            `,
            [
                name,
                email,
                profile_medium ?? null,
                city ?? null,
                state ?? null,
                country ?? null,
                lng ?? null,
                lat ?? null,
                units,
                id,
            ]
        );

        console.log("Processing historical data for", id);

        getUserHistoricalData(id);

        const newUser: User = {
            id,
            name,
            email: email ?? undefined,
            pic: profile_medium ?? null,
            city,
            state,
            country,
            location_coords: lng && lat ? [lng, lat] : null,
            units,
            update_description: true,
            is_subscribed: false,
            is_lifetime_free: false,
            historical_data_processed: false,
        };

        return newUser;
    } else {
        await db.query(
            `UPDATE users SET
            name = $1,
            email = $2,
            pic = $3,
            units = $4
            WHERE id = $5;
            `,
            [name, email, profile_medium ?? null, units, id]
        );

        console.log("Processing historical data for", id);

        getUserHistoricalData(id);

        const newUser: User = {
            id,
            name,
            email: email ?? undefined,
            pic: profile_medium ?? null,
            update_description: true,
            units,
            is_subscribed: false,
            is_lifetime_free: false,
            historical_data_processed: false,
        };

        return newUser;
    }
};

export default addUserData;
