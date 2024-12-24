import { RowDataPacket } from "mysql2";
import { StravaCreds } from "../../typeDefs/StravaCreds";
import User from "../../typeDefs/User";
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

    const [user] = await connection.query<(User & RowDataPacket)[]>(
        `SELECT * FROM User WHERE id = ?`,
        [id]
    );

    if (user.length > 0) {
        await connection.end();
        return;
    }

    const stravaRes = await fetch("https://www.strava.com/api/v3/athlete", {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    const userData = await stravaRes.json();

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

        await connection.execute(
            `INSERT INTO User (id, name, email, pic, city, state, country, lat, \`long\`, units)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            name = ?,
            email = ?,
            pic = ?,
            city = ?,
            state = ?,
            country = ?,
            lat = ?,
            \`long\` = ?,
            units = ?
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
                units,
                name,
                email,
                profile_medium ?? null,
                city ?? null,
                state ?? null,
                country ?? null,
                lat ?? null,
                lng ?? null,
                units,
            ]
        );
    } else {
        await connection.execute(
            `INSERT INTO User (id, name, email, pic, units)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            name = ?,
            email = ?,
            pic = ?
            `,
            [
                id,
                name,
                email,
                profile_medium ?? null,
                units,
                name,
                email,
                profile_medium ?? null,
                units,
            ]
        );
    }

    await connection.end();
};

export default createUser;
