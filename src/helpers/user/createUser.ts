import { StravaCreds } from "../../typeDefs/StravaCreds";
import getCloudSqlConnection from "../getCloudSqlConnection";
import getStravaAccessToken from "../getStravaAccessToken";
import { Client } from "@googlemaps/google-maps-services-js";

const client = new Client({});

const createUser = async ({
    id,
    name,
    email,
}: {
    id: string;
    name: string;
    email: string | null;
}) => {
    const token = await getStravaAccessToken(id);

    const connection = await getCloudSqlConnection();

    const stravaRes = await fetch("https://www.strava.com/api/v3/athlete", {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    const userData = await stravaRes.json();

    const { city, state, country, profile_medium } = userData;

    const geocodeRes = await client.geocode({
        params: {
            address: `${city}, ${state}, ${country}`,
            key: process.env.GOOGLE_MAPS_API_KEY ?? "",
        },
    });

    const lat = geocodeRes.data.results[0].geometry.location.lat;
    const lng = geocodeRes.data.results[0].geometry.location.lng;

    await connection.execute(
        `INSERT INTO User (id, name, email, pic, city, state, country, lat, \`long\`)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        name = ?,
        email = ?,
        pic = ?,
        city = ?,
        state = ?,
        country = ?,
        lat = ?,
        \`long\` = ?
        `,
        [
            id,
            name,
            email,
            profile_medium ?? null,
            city ?? null,
            state ?? null,
            country ?? null,
            lat ?? null,
            lng ?? null,
            name,
            email,
            profile_medium ?? null,
            city ?? null,
            state ?? null,
            country ?? null,
            lat ?? null,
            lng ?? null,
        ]
    );

    await connection.release();
};

export default createUser;
