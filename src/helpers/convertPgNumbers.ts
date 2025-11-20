/**
 * Converts string representations of numbers from PostgreSQL query results back to numbers.
 * PostgreSQL returns bigint/numeric types as strings to preserve precision.
 * This helper automatically converts fields that should be numbers based on the type definition.
 *
 * @param data - Single object or array of objects from PostgreSQL query
 * @returns Data with numeric string fields converted to numbers
 */
export function convertPgNumbers<T>(data: T): T;
export function convertPgNumbers<T>(data: T[]): T[];
export function convertPgNumbers<T>(data: T | T[]): T | T[] {
    if (Array.isArray(data)) {
        return data.map((item) => convertSingleItem(item)) as T[];
    }
    return convertSingleItem(data) as T;
}

function convertSingleItem<T>(item: T): T {
    if (item === null || item === undefined || typeof item !== "object") {
        return item;
    }

    const converted: any = { ...item };

    for (const key in converted) {
        const value = converted[key];

        // Convert string numbers to actual numbers
        if (
            typeof value === "string" &&
            !isNaN(Number(value)) &&
            value.trim() !== ""
        ) {
            // Check if it looks like a number (handles integers and decimals)
            const num = Number(value);
            if (isFinite(num)) {
                converted[key] = num;
            }
        }
    }

    return converted as T;
}

export default convertPgNumbers;
