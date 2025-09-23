import { RowDataPacket } from "mysql2";
import User from "../../typeDefs/User";
import db from "../getCloudSqlConnection";
import getStravaAccessToken from "../getStravaAccessToken";
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
    const stravaRes = await fetch("https://www.strava.com/api/v3/athlete", {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    const userData = await stravaRes.json();

    console.log(userData);

    const { city, state, country, profile_medium, measurement_preference } =
        userData;

    const units = measurement_preference === "feet" ? "imperial" : "metric";

    if (city && state && country) {
        const geocodeRes = await client.geocode({
            params: {
                address: `${city}, ${state}, ${country}`,
                key: process.env.GOOGLE_MAPS_API_KEY ?? "",
            },
        });

        const lat = geocodeRes.data.results[0].geometry.location.lat;
        const lng = geocodeRes.data.results[0].geometry.location.lng;

        await db.execute(
            `UPDATE User SET
            name = ?,
            email = ?,
            pic = ?,
            city = ?,
            state = ?,
            country = ?,
            lat = ?,
            \`long\` = ?,
            units = ?
            WHERE id = ?;
            `,
            [
                name,
                email,
                profile_medium ?? null,
                city ?? null,
                state ?? null,
                country ?? null,
                lat ?? null,
                lng ?? null,
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
            lat,
            long: lng,
            units,
            updateDescription: true,
            isSubscribed: false,
            isLifetimeFree: false,
            historicalDataProcessed: false,
        };

        return newUser;
    } else {
        await db.execute(
            `UPDATE User SET
            name = ?,
            email = ?,
            pic = ?,
            units = ?
            WHERE id = ?;
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
            updateDescription: true,
            units,
            isSubscribed: false,
            isLifetimeFree: false,
            historicalDataProcessed: false,
        };

        return newUser;
    }
};

export default addUserData;
