/**
 * Post-process summit window scores by applying hazard-based modifiers
 * from source conditions (avalanche, AQI, fire proximity).
 *
 * The base scores from the ingester only account for weather. This function
 * caps or penalizes scores when non-weather hazards are present.
 */

interface HazardFlag {
    type: "avalanche" | "air_quality" | "fire";
    severity: "caution" | "warning" | "danger";
    message: string;
}

interface SummitWindowDay {
    date: string;
    score: number;
    label: string;
    factors: Record<string, number>;
    summary: string;
    hazards?: HazardFlag[];
}

interface SummitWindow {
    days: SummitWindowDay[];
    bestDay: string;
    bestScore: number;
}

interface SourceConditions {
    avalanche?: any;
    airQuality?: any;
    fireProximity?: any;
}

function scoreToLabel(score: number): string {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Marginal";
    if (score >= 20) return "Poor";
    return "Dangerous";
}

export function applyHazardModifiers(
    summitWindow: SummitWindow | null,
    sourceConditions: SourceConditions
): SummitWindow | null {
    if (!summitWindow?.days?.length) return summitWindow;

    // Determine hazard caps and penalties
    let scoreCap = 100;
    const penalties: { amount: number; reason: string }[] = [];

    // Avalanche danger — applies per-day based on danger array
    // We handle this per-day below since danger can vary by date
    const avyDangerByDay = buildAvyDangerMap(sourceConditions.avalanche);

    // AQI penalty (applies uniformly — AQI forecast is current/near-term)
    const aqi = sourceConditions.airQuality?.current?.aqi;
    if (aqi != null) {
        if (aqi > 200) {
            scoreCap = Math.min(scoreCap, 39); // cap at Poor
            penalties.push({ amount: 20, reason: "very unhealthy air" });
        } else if (aqi > 150) {
            penalties.push({ amount: 15, reason: "unhealthy air" });
        } else if (aqi > 100) {
            penalties.push({ amount: 5, reason: "moderate air quality" });
        }
    }

    // Fire proximity (applies uniformly)
    const closestFireKm = sourceConditions.fireProximity?.closestFireKm;
    if (closestFireKm != null) {
        if (closestFireKm < 10) {
            scoreCap = Math.min(scoreCap, 39); // cap at Poor
            penalties.push({ amount: 25, reason: "active fire nearby" });
        } else if (closestFireKm < 25) {
            scoreCap = Math.min(scoreCap, 59); // cap at Marginal
            penalties.push({ amount: 10, reason: "fire in area" });
        }
    }

    // Apply modifiers to each day
    const modifiedDays = summitWindow.days.map((day) => {
        let score = day.score;

        // Per-day avalanche cap
        const avyDanger = avyDangerByDay.get(day.date);
        let dayAvyCap = 100;
        if (avyDanger != null) {
            if (avyDanger >= 5) {
                dayAvyCap = 19; // Dangerous
            } else if (avyDanger >= 4) {
                dayAvyCap = 39; // Poor
            } else if (avyDanger >= 3) {
                dayAvyCap = 69; // cap within Good range
            }
        }

        const effectiveCap = Math.min(scoreCap, dayAvyCap);

        // Apply penalties
        for (const p of penalties) {
            score -= p.amount;
        }

        // Apply avalanche penalty on top of cap
        if (avyDanger != null && avyDanger >= 3) {
            score -= (avyDanger - 2) * 8; // -8 for considerable, -16 for high, -24 for extreme
        }

        // Enforce cap and floor
        score = Math.max(0, Math.min(effectiveCap, score));

        // Rebuild label and summary
        const label = scoreToLabel(score);
        let summary = day.summary;

        // Build hazard flags for frontend display
        const hazards: HazardFlag[] = [];
        if (avyDanger != null && avyDanger >= 2) {
            const severity = avyDanger >= 4 ? "danger" : avyDanger >= 3 ? "warning" : "caution";
            const dangerLabel = avyDanger >= 5 ? "Extreme" : avyDanger >= 4 ? "High" : avyDanger >= 3 ? "Considerable" : "Moderate";
            hazards.push({
                type: "avalanche",
                severity,
                message: `${dangerLabel} avalanche danger`,
            });
        }
        if (aqi != null && aqi > 100) {
            const severity = aqi > 200 ? "danger" : aqi > 150 ? "warning" : "caution";
            const aqiLabel = aqi > 200 ? "Very unhealthy" : aqi > 150 ? "Unhealthy" : "Moderate";
            hazards.push({
                type: "air_quality",
                severity,
                message: `${aqiLabel} air quality (AQI ${aqi})`,
            });
        }
        if (closestFireKm != null && closestFireKm < 50) {
            const severity = closestFireKm < 10 ? "danger" : closestFireKm < 25 ? "warning" : "caution";
            hazards.push({
                type: "fire",
                severity,
                message: `Active fire ${Math.round(closestFireKm)} km away`,
            });
        }

        // Append hazard notes to summary
        const hazardNotes = hazards.filter(h => h.severity !== "caution").map(h => h.message.toLowerCase());
        if (hazardNotes.length > 0) {
            summary = summary + ", " + hazardNotes.join(", ");
        }

        return { ...day, score, label, summary, hazards: hazards.length > 0 ? hazards : undefined };
    });

    // Recalculate best day
    const best = modifiedDays.reduce((a, b) => (b.score > a.score ? b : a), modifiedDays[0]);

    return {
        days: modifiedDays,
        bestDay: best.date,
        bestScore: best.score,
    };
}

/**
 * Build a map of date string → max avalanche danger level for that day.
 * Avalanche danger dates are ISO timestamps; we extract the date portion
 * and use the max of upper/middle/lower.
 */
function buildAvyDangerMap(avalanche: any): Map<string, number> {
    const map = new Map<string, number>();
    if (!avalanche?.danger?.length) return map;

    for (const d of avalanche.danger) {
        // danger date is like "2026-02-12T23:30:00Z" — extract just the date
        const dateStr = typeof d.date === "string" ? d.date.substring(0, 10) : null;
        if (!dateStr) continue;

        const maxDanger = Math.max(d.upper ?? 0, d.middle ?? 0, d.lower ?? 0);
        if (maxDanger > 0) {
            // Keep the highest danger if multiple entries for same date
            const existing = map.get(dateStr) ?? 0;
            map.set(dateStr, Math.max(existing, maxDanger));
        }
    }

    return map;
}
