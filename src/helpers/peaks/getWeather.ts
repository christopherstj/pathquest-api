import dayjs from "dayjs";
import WeatherResponse from "../../typeDefs/WeatherResponse";
import getPeak from "./getPeak";
import { XMLParser } from "fast-xml-parser";

const parseValue = (value: any) => {
    if (value === null || value === undefined) {
        return null;
    } else if (typeof value === "number" || typeof value === "string") {
        return value;
    }
    return null;
};

const getWeather = async (peakId: string) => {
    const peak = await getPeak(peakId);

    if (!peak) {
        return null;
    }

    const { Lat, Long } = peak;

    const forecastRes = await fetch(
        `https://forecast.weather.gov/MapClick.php?lat=${Lat}&lon=${Long}&unit=0&lg=english&FcstType=dwml`
    );

    const hourlyRes = await fetch(
        `https://forecast.weather.gov/MapClick.php?lat=${Lat}&lon=${Long}&FcstType=digitalDWML`
    );

    const forecastText = await forecastRes.text();
    const hourlyText = await hourlyRes.text();

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
    });

    const forecastJson = parser.parse(forecastText);
    const hourlyJson = parser.parse(hourlyText);

    const forecastData = forecastJson.dwml.data[0];

    const location = forecastData.location;
    const highs = forecastData.parameters.temperature[0].value;
    const lows = forecastData.parameters.temperature[1].value;
    const precip =
        forecastData.parameters["probability-of-precipitation"].value;
    const text = forecastData.parameters.wordedForecast.text;

    const forecastTimes12h = forecastData["time-layout"]
        .find((t: any) => t["layout-key"].startsWith("k-p12h-"))
        ["start-valid-time"].map((t: any) => t["#text"]);

    const forecast = forecastTimes12h.map((t: any, i: number) => {
        const temp = i % 2 === 0 ? highs[i / 2] : lows[(i - 1) / 2];
        const precipProb = typeof precip[i] === "number" ? precip[i] : 0;
        const forecastText = text[i];

        return {
            time: t,
            temp,
            precipProb,
            forecastText,
        };
    });

    const hourlyData = hourlyJson.dwml.data;
    const hourlyTemps = hourlyData.parameters.temperature.find(
        (temp: any) => temp.type === "hourly"
    ).value;
    const dewPoint = hourlyData.parameters.temperature.find(
        (temp: any) => temp.type === "dew point"
    ).value;
    const windChill = hourlyData.parameters.temperature.find(
        (temp: any) => temp.type === "wind chill"
    ).value;
    const hourlyPrecip =
        hourlyData.parameters["probability-of-precipitation"].value;
    const windSpeed = hourlyData.parameters["wind-speed"].find(
        (w: any) => w.type === "sustained"
    ).value;
    const windGust = hourlyData.parameters["wind-speed"]
        .find((w: any) => w.type === "gust")
        .value.map((g: any) => (typeof g === "number" ? g : null));
    const windDirection = hourlyData.parameters["direction"].value;
    const cloudCover = hourlyData.parameters["cloud-amount"].value;
    const humidity = hourlyData.parameters["humidity"].value;
    const weather = hourlyData.parameters.weather["weather-conditions"];

    const hourly = hourlyTemps.map((t: any, i: number) => {
        const temp = t;
        return {
            time: hourlyData["time-layout"]["start-valid-time"][i],
            temp: t,
            dewPoint: parseValue(dewPoint[i]),
            windChill: parseValue(windChill[i]),
            precipProb: parseValue(hourlyPrecip[i]),
            windSpeed: parseValue(windSpeed[i]),
            windGust: parseValue(windGust[i]),
            windDirection: parseValue(windDirection[i]),
            cloudCover: parseValue(cloudCover[i]),
            humidity: parseValue(humidity[i]),
            weather: parseValue(weather[i]),
        };
    });

    return {
        location,
        forecast,
        hourly,
    };
};

export default getWeather;
