import getCloudSqlConnection from "../getCloudSqlConnection";

interface UpdateUserData {
    name?: string;
    email?: string;
    pic?: string;
    city?: string;
    state?: string;
    country?: string;
    location_coords?: [number, number] | null; // [lng, lat]
    update_description?: boolean;
    is_public?: boolean;
    units?: "imperial" | "metric";
}

const updateUser = async (
    userId: string,
    userData: UpdateUserData
) => {
    const db = await getCloudSqlConnection();

    const fields: string[] = [];
    const values: (string | boolean | number | null)[] = [];
    let index = 1;

    for (const [key, value] of Object.entries(userData)) {
        if (value === undefined) continue;

        // Handle location_coords specially - needs PostGIS conversion
        if (key === "location_coords") {
            if (value === null) {
                fields.push(`location_coords = NULL`);
            } else {
                const [lng, lat] = value as [number, number];
                fields.push(`location_coords = ST_SetSRID(ST_MakePoint($${index}, $${index + 1}), 4326)::geography`);
                values.push(lng, lat);
                index += 2;
            }
            continue;
        }

        fields.push(`${key} = $${index}`);
        values.push(value);
        index++;
    }

    if (fields.length === 0) {
        return;
    }

    values.push(userId);

    const query = `
        UPDATE users
        SET ${fields.join(", ")}
        WHERE id = $${index};
    `;

    await db.query(query, values);
};

export default updateUser;
