import Anthropic from "@anthropic-ai/sdk";
import { resolveGearRecommendations } from "./resolveGearRecommendations";

interface ConditionsInput {
    weatherForecast?: any;
    recentWeather?: any;
    snotelData?: any;
    avalancheForecast?: any;
    streamFlow?: any;
    airQuality?: any;
    fireProximity?: any;
    trailConditions?: any;
}

const SYSTEM_PROMPT = `You are a mountain safety gear advisor for PathQuest, a peak-bagging app. Given current conditions near a mountain peak, recommend gear items a hiker/climber should bring.

Return a JSON object matching this exact schema:
{
  "items": [
    {
      "name": "Gear Item Name",
      "category": "category_tag",
      "reason": "Brief reason (1 sentence, reference specific data)",
      "priority": "required" | "recommended" | "optional"
    }
  ],
  "summary": "1-2 sentence natural language summary of key gear considerations"
}

Priority guidelines:
- "required": Safety-critical gear where not having it could be life-threatening (avalanche safety gear in considerable+ danger, etc.)
- "recommended": Important for comfort/safety given current conditions
- "optional": Nice to have, helpful but not critical

Categories: avalanche_safety, snow_travel, traction, weather_protection, sun_protection, water_crossing, respiratory, navigation, general

Keep recommendations practical and specific to the conditions provided. Reference actual numbers (snow depth, wind speed, AQI, etc.) in reasons. Typically 3-8 items. Only recommend what conditions warrant — don't pad the list.

Return ONLY the JSON object, no markdown fences or explanation.`;

function buildConditionsPayload(input: ConditionsInput): Record<string, any> {
    const payload: Record<string, any> = {};

    if (input.weatherForecast) {
        const wf = input.weatherForecast;
        const current = wf.current;
        const today = wf.daily?.[0];

        payload.weather = {
            current: current
                ? {
                      tempC: current.temperature,
                      feelsLikeC: current.feelsLike,
                      windSpeedKmh: current.windSpeed,
                      windGustKmh: current.windGusts,
                      precipMm: current.precipitation,
                      precipProbability: current.precipitationProbability,
                      weatherCode: current.weatherCode,
                  }
                : null,
            today: today
                ? {
                      tempHighC: today.tempHigh,
                      tempLowC: today.tempLow,
                      precipSumMm: today.precipSum,
                      snowfallSumCm: today.snowfallSum,
                      windGustsKmh: today.windGusts,
                      uvIndexMax: today.uvIndexMax,
                  }
                : null,
        };
    }

    if (input.recentWeather) {
        payload.recentWeather = {
            totalPrecipMm: input.recentWeather.totalPrecipMm,
            totalSnowfallCm: input.recentWeather.totalSnowfallCm,
            avgTempC: input.recentWeather.avgTemp,
            minTempC: input.recentWeather.minTemp,
        };
    }

    if (input.snotelData?.stations?.length > 0) {
        const nearest =
            input.snotelData.stations.find(
                (s: any) => s.stationId === input.snotelData.nearestStation
            ) ?? input.snotelData.stations[0];

        if (nearest?.current) {
            payload.snowpack = {
                snowDepthIn: nearest.current.snowDepthIn,
                sweIn: nearest.current.sweIn,
                stationName: nearest.name,
                stationElevationM: nearest.elevationM,
            };
        }
    }

    if (input.avalancheForecast) {
        const af = input.avalancheForecast;
        const todayDanger = af.danger?.[0];
        payload.avalanche = {
            dangerUpper: todayDanger?.upper,
            dangerMiddle: todayDanger?.middle,
            dangerLower: todayDanger?.lower,
            zoneName: af.zoneName,
            problems: af.problems?.map((p: any) => p.type)?.slice(0, 3),
        };
    }

    if (input.streamFlow) {
        payload.streamFlow = {
            crossingAlert: input.streamFlow.crossingAlert,
            nearestGaugeCfs: input.streamFlow.gauges?.[0]?.current?.dischargeCfs,
        };
    }

    if (input.airQuality?.current) {
        payload.airQuality = {
            aqi: input.airQuality.current.aqi,
            category: input.airQuality.current.category,
        };
    }

    if (input.fireProximity?.nearbyFires?.length > 0) {
        payload.fires = input.fireProximity.nearbyFires
            .slice(0, 3)
            .map((f: any) => ({
                name: f.name,
                distanceKm: f.distanceKm,
                acres: f.acres,
                containment: f.percentContained,
            }));
    }

    if (input.trailConditions) {
        const tc = input.trailConditions;
        if (tc.alerts?.length > 0) {
            payload.trailAlerts = tc.alerts.slice(0, 3).map((a: any) => ({
                title: a.title,
                category: a.category,
            }));
        }
    }

    return payload;
}

export async function generateGearWithLLM(
    input: ConditionsInput
): Promise<{ items: any[]; summary: string | null; updatedAt: string | null }> {
    const apiKey = process.env.ANTHROPIC_API_KEY ?? "";

    if (!apiKey) {
        console.log("No ANTHROPIC_API_KEY set, using rules-based gear");
        return resolveGearRecommendations(input);
    }

    try {
        const client = new Anthropic({ apiKey });

        const conditionsPayload = buildConditionsPayload(input);

        // If no meaningful conditions data, skip the LLM call
        if (Object.keys(conditionsPayload).length === 0) {
            return resolveGearRecommendations(input);
        }

        const message = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: [
                {
                    role: "user",
                    content: `Current conditions near this mountain peak:\n${JSON.stringify(conditionsPayload, null, 2)}`,
                },
            ],
        });

        let text =
            message.content[0].type === "text" ? message.content[0].text : "";
        // Strip markdown fences if the model wraps in ```json ... ```
        text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
        const parsed = JSON.parse(text);

        if (!Array.isArray(parsed.items)) {
            throw new Error("Invalid LLM response: missing items array");
        }

        return {
            items: parsed.items.map((item: any) => ({
                name: String(item.name ?? ""),
                category: String(item.category ?? "general"),
                reason: String(item.reason ?? ""),
                priority: ["required", "recommended", "optional"].includes(
                    item.priority
                )
                    ? item.priority
                    : "recommended",
            })),
            summary: parsed.summary ?? null,
            updatedAt: new Date().toISOString(),
        };
    } catch (error) {
        console.error(
            `Haiku gear generation failed, falling back to rules: ${error}`
        );
        return resolveGearRecommendations(input);
    }
}
