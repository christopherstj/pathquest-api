interface ConditionsInput {
    weatherForecast?: any;
    recentWeather?: any;
    snotelData?: any;
    avalancheForecast?: any;
    streamFlow?: any;
    airQuality?: any;
}

interface GearItem {
    name: string;
    category: string;
    reason: string;
    priority: "required" | "recommended" | "optional";
}

interface GearRecommendations {
    items: GearItem[];
    summary: string | null;
    conditionsSummary: string | null;
    updatedAt: string | null;
}

export function resolveGearRecommendations(
    input: ConditionsInput
): GearRecommendations {
    const items: GearItem[] = [];

    // Rule 1: Snow depth > 12" → Snowshoes
    if (input.snotelData?.stations) {
        const nearest =
            input.snotelData.stations.find(
                (s: any) => s.stationId === input.snotelData.nearestStation
            ) ?? input.snotelData.stations[0];

        if (nearest?.current?.snowDepthIn != null && nearest.current.snowDepthIn > 12) {
            items.push({
                name: "Snowshoes",
                category: "snow_travel",
                reason: `${Math.round(nearest.current.snowDepthIn)}" of snow at nearby station`,
                priority: "recommended",
            });
        }
    }

    // Rule 2: Freeze-thaw cycle → Microspikes
    if (input.weatherForecast?.daily?.length > 0 && input.recentWeather?.totalPrecipMm != null) {
        const today = input.weatherForecast.daily[0];
        const overnightLow = today?.tempLow;
        const recentPrecip = input.recentWeather.totalPrecipMm;

        if (overnightLow != null && overnightLow < -3.9 && recentPrecip > 5) {
            items.push({
                name: "Microspikes",
                category: "traction",
                reason: "Freeze-thaw cycle likely creating icy conditions",
                priority: "recommended",
            });
        }
    }

    // Rule 3: Avalanche danger >= 3 → Beacon + Probe + Shovel (REQUIRED)
    if (input.avalancheForecast?.danger?.length > 0) {
        const todayDanger = input.avalancheForecast.danger[0];
        const maxDanger = Math.max(
            todayDanger.upper ?? 0,
            todayDanger.middle ?? 0,
            todayDanger.lower ?? 0
        );

        if (maxDanger >= 3) {
            const dangerLabel =
                maxDanger === 5 ? "Extreme" : maxDanger === 4 ? "High" : "Considerable";

            items.push(
                {
                    name: "Avalanche Beacon",
                    category: "avalanche_safety",
                    reason: `${dangerLabel} avalanche danger`,
                    priority: "required",
                },
                {
                    name: "Avalanche Probe",
                    category: "avalanche_safety",
                    reason: `${dangerLabel} avalanche danger`,
                    priority: "required",
                },
                {
                    name: "Avalanche Shovel",
                    category: "avalanche_safety",
                    reason: `${dangerLabel} avalanche danger`,
                    priority: "required",
                }
            );
        }
    }

    // Rule 4: Wind > 64 km/h → Helmet + Goggles
    if (input.weatherForecast?.current?.windSpeed != null) {
        if (input.weatherForecast.current.windSpeed > 64) {
            items.push(
                {
                    name: "Helmet",
                    category: "weather_protection",
                    reason: `High winds (${Math.round(input.weatherForecast.current.windSpeed)} km/h)`,
                    priority: "recommended",
                },
                {
                    name: "Goggles",
                    category: "weather_protection",
                    reason: `High winds (${Math.round(input.weatherForecast.current.windSpeed)} km/h)`,
                    priority: "recommended",
                }
            );
        }
    }

    // Rule 5: Precip probability > 50% → Rain jacket
    if (input.weatherForecast?.current?.precipitationProbability != null) {
        if (input.weatherForecast.current.precipitationProbability > 50) {
            items.push({
                name: "Rain Jacket",
                category: "weather_protection",
                reason: `${input.weatherForecast.current.precipitationProbability}% chance of precipitation`,
                priority: "recommended",
            });
        }
    }

    // Rule 6: UV index >= 8 → Sunscreen + Sun hat
    if (input.weatherForecast?.daily?.length > 0) {
        const todayUv = input.weatherForecast.daily[0]?.uvIndexMax;
        if (todayUv != null && todayUv >= 8) {
            items.push(
                {
                    name: "Sunscreen SPF 50+",
                    category: "sun_protection",
                    reason: `UV index ${todayUv} (very high)`,
                    priority: "recommended",
                },
                {
                    name: "Sun Hat",
                    category: "sun_protection",
                    reason: `UV index ${todayUv} (very high)`,
                    priority: "recommended",
                }
            );
        }
    }

    // Rule 7: Stream flow crossing alert → Trekking poles
    if (input.streamFlow?.crossingAlert === true) {
        items.push({
            name: "Trekking Poles",
            category: "water_crossing",
            reason: "High water at nearby stream crossings",
            priority: "recommended",
        });
    }

    // Rule 8: AQI > 150 → N95 mask
    if (input.airQuality?.current?.aqi != null && input.airQuality.current.aqi > 150) {
        items.push({
            name: "N95 Mask",
            category: "general",
            reason: `AQI ${input.airQuality.current.aqi} (unhealthy)`,
            priority: "recommended",
        });
    }

    // Generate summary
    let summary: string | null = null;
    if (items.length > 0) {
        const requiredCount = items.filter((i) => i.priority === "required").length;
        const recommendedCount = items.filter((i) => i.priority === "recommended").length;

        const parts: string[] = [];
        if (requiredCount > 0) {
            parts.push(`${requiredCount} required item${requiredCount !== 1 ? "s" : ""}`);
        }
        if (recommendedCount > 0) {
            parts.push(`${recommendedCount} recommended item${recommendedCount !== 1 ? "s" : ""}`);
        }
        summary = parts.join(", ");
    }

    return {
        items,
        summary,
        conditionsSummary: null,
        updatedAt: new Date().toISOString(),
    };
}
