export default interface WeatherResponse {
    xml: string;
    dwml: {
        head: {
            product: {
                "creation-date": string;
                category: string;
            };
            source: {
                "production-center": string;
                credit: string;
                "more-information": string;
            };
        };
        data: {
            location: {
                "location-key": string;
                point: string;
                "area-description": string;
                height: number;
            };
            moreWeatherInformation: string;
            "time-layout": {
                "layout-key": string;
                "start-valid-time": string[];
            }[];
            parameters: {
                temperature: {
                    name: string;
                    value: number[];
                }[];
                "probability-of-precipitation": {
                    name: string;
                    value: number[];
                };
                weather: {
                    name: string;
                    "weather-conditions": (string | number)[];
                };
                "conditions-icon": {
                    name: string;
                    "icon-link": string[];
                };
                hazards: {
                    name: string;
                    "hazard-conditions": {
                        hazard: {
                            hazardTextURL: string;
                        };
                    };
                };
                wordedForecast: {
                    name: string;
                    text: string[];
                };
            };
        }[];
    };
}

// {
//     "?xml": "",
//     "dwml": {
//         "head": {
//             "product": {
//                 "creation-date": "2025-02-11T08:40:36-07:00",
//                 "category": "current observations and forecast"
//             },
//             "source": {
//                 "production-center": "Pueblo, CO",
//                 "credit": "https://www.weather.gov/pub/",
//                 "more-information": "https://www.nws.noaa.gov/forecasts/xml/"
//             }
//         },
//         "data": [
//             {
//                 "location": {
//                     "location-key": "point1",
//                     "point": "",
//                     "area-description": "2 Miles ENE Twin Lakes CO",
//                     "height": 13264
//                 },
//                 "moreWeatherInformation": "https://forecast.weather.gov/MapClick.php?lat=39.11&lon=-106.45",
//                 "time-layout": [
//                     {
//                         "layout-key": "k-p12h-n13-1",
//                         "start-valid-time": [
//                             "2025-02-11T09:00:00-07:00",
//                             "2025-02-11T18:00:00-07:00",
//                             "2025-02-12T06:00:00-07:00",
//                             "2025-02-12T18:00:00-07:00",
//                             "2025-02-13T06:00:00-07:00",
//                             "2025-02-13T18:00:00-07:00",
//                             "2025-02-14T06:00:00-07:00",
//                             "2025-02-14T18:00:00-07:00",
//                             "2025-02-15T06:00:00-07:00",
//                             "2025-02-15T18:00:00-07:00",
//                             "2025-02-16T06:00:00-07:00",
//                             "2025-02-16T18:00:00-07:00",
//                             "2025-02-17T06:00:00-07:00"
//                         ]
//                     },
//                     {
//                         "layout-key": "k-p24h-n7-1",
//                         "start-valid-time": [
//                             "2025-02-11T09:00:00-07:00",
//                             "2025-02-12T06:00:00-07:00",
//                             "2025-02-13T06:00:00-07:00",
//                             "2025-02-14T06:00:00-07:00",
//                             "2025-02-15T06:00:00-07:00",
//                             "2025-02-16T06:00:00-07:00",
//                             "2025-02-17T06:00:00-07:00"
//                         ]
//                     },
//                     {
//                         "layout-key": "k-p24h-n6-2",
//                         "start-valid-time": [
//                             "2025-02-11T18:00:00-07:00",
//                             "2025-02-12T18:00:00-07:00",
//                             "2025-02-13T18:00:00-07:00",
//                             "2025-02-14T18:00:00-07:00",
//                             "2025-02-15T18:00:00-07:00",
//                             "2025-02-16T18:00:00-07:00"
//                         ]
//                     }
//                 ],
//                 "parameters": {
//                     "temperature": [
//                         {
//                             "name": "Daily Maximum Temperature",
//                             "value": [
//                                 13,
//                                 1,
//                                 16,
//                                 20,
//                                 13,
//                                 18,
//                                 20
//                             ]
//                         },
//                         {
//                             "name": "Daily Minimum Temperature",
//                             "value": [
//                                 -5,
//                                 -13,
//                                 10,
//                                 6,
//                                 1,
//                                 8
//                             ]
//                         }
//                     ],
//                     "probability-of-precipitation": {
//                         "name": "12 Hourly Probability of Precipitation",
//                         "value": [
//                             70,
//                             90,
//                             60,
//                             30,
//                             "",
//                             80,
//                             100,
//                             90,
//                             90,
//                             60,
//                             "",
//                             "",
//                             ""
//                         ]
//                     },
//                     "weather": {
//                         "name": "Weather Type, Coverage, Intensity",
//                         "weather-conditions": [
//                             "",
//                             "",
//                             "",
//                             "",
//                             "",
//                             "",
//                             "",
//                             "",
//                             "",
//                             "",
//                             "",
//                             "",
//                             ""
//                         ]
//                     },
//                     "conditions-icon": {
//                         "name": "Conditions Icon",
//                         "icon-link": [
//                             "https://forecast.weather.gov/DualImage.php?i=sn&j=sn&ip=20&jp=70",
//                             "https://forecast.weather.gov/newimages/medium/nsn90.png",
//                             "https://forecast.weather.gov/newimages/medium/sn60.png",
//                             "https://forecast.weather.gov/newimages/medium/nsn30.png",
//                             "https://forecast.weather.gov/newimages/medium/wind_sct.png",
//                             "https://forecast.weather.gov/newimages/medium/nsn80.png",
//                             "https://forecast.weather.gov/newimages/medium/sn100.png",
//                             "https://forecast.weather.gov/newimages/medium/nsn90.png",
//                             "https://forecast.weather.gov/newimages/medium/sn90.png",
//                             "https://forecast.weather.gov/DualImage.php?i=nsn&j=nsn&ip=60&jp=20",
//                             "https://forecast.weather.gov/DualImage.php?i=blizzard&j=wind_bkn&ip=0",
//                             "https://forecast.weather.gov/newimages/medium/nsn.png",
//                             "https://forecast.weather.gov/newimages/medium/sn.png"
//                         ]
//                     },
//                     "hazards": {
//                         "name": "Watches, Warnings, and Advisories",
//                         "hazard-conditions": {
//                             "hazard": {
//                                 "hazardTextURL": "https://forecast.weather.gov/showsigwx.php?warnzone=COZ060&warncounty=COC065&firewxzone=COZ220&local_place1=2+Miles+ENE+Twin+Lakes+CO&product1=Hazardous+Weather+Outlook"
//                             }
//                         }
//                     },
//                     "wordedForecast": {
//                         "name": "Text Forecast",
//                         "text": [
//                             "Snow likely, mainly after 2pm.  Widespread blowing snow, mainly after 2pm. Mostly cloudy, with a high near 13. Wind chill values between -10 and -15. Windy, with a west southwest wind 20 to 25 mph increasing to 30 to 35 mph in the afternoon. Winds could gust as high as 45 mph.  Chance of precipitation is 70%. Total daytime snow accumulation of less than a half inch possible.",
//                             "Snow.  Areas of blowing snow. Low around -5. Wind chill values between -15 and -25. Breezy, with a west southwest wind around 20 mph, with gusts as high as 35 mph.  Chance of precipitation is 90%. New snow accumulation of 1 to 2 inches possible.",
//                             "Snow likely, mainly before 11am.  Widespread blowing snow, mainly after 2pm. Mostly cloudy and cold, with a high near 1. Wind chill values between -25 and -30. Windy, with a west wind 15 to 20 mph increasing to 25 to 30 mph in the afternoon. Winds could gust as high as 45 mph.  Chance of precipitation is 60%. New snow accumulation of less than a half inch possible.",
//                             "A 30 percent chance of snow showers before 11pm.  Widespread blowing snow, mainly before 10pm. Mostly cloudy, then gradually becoming mostly clear, with a low around -13. Wind chill values between -30 and -40. Windy, with a west wind 25 to 30 mph, with gusts as high as 45 mph.",
//                             "Mostly sunny, with a high near 16. Breezy, with a west wind 15 to 20 mph.",
//                             "Snow showers, mainly after 11pm.  Widespread blowing snow after 11pm. Low around 10. Windy, with a west southwest wind 25 to 30 mph.  Chance of precipitation is 80%. New snow accumulation of 1 to 3 inches possible.",
//                             "Snow showers.  Widespread blowing snow, mainly before 11am. High near 20. Windy, with a west southwest wind 25 to 30 mph, with gusts as high as 45 mph.  Chance of precipitation is 100%.",
//                             "Snow showers.  Areas of blowing snow. Low around 6. Breezy, with a west wind 20 to 25 mph.  Chance of precipitation is 90%.",
//                             "Snow showers.  Patchy blowing snow. High near 13. Breezy, with a west wind 20 to 25 mph, with gusts as high as 40 mph.  Chance of precipitation is 90%.",
//                             "Snow showers likely, mainly before 11pm.  Widespread blowing snow. Mostly cloudy, with a low around 1. Windy, with a west wind around 30 mph, with gusts as high as 45 mph.  Chance of precipitation is 60%.",
//                             "Areas of blowing snow. Partly sunny, with a high near 18. Windy, with a west wind 25 to 30 mph.",
//                             "A chance of snow showers.  Mostly cloudy, with a low around 8. Breezy, with a west wind around 25 mph.",
//                             "Snow showers likely.  Mostly cloudy, with a high near 20. Breezy, with a west wind around 25 mph, with gusts as high as 45 mph."
//                         ]
//                     }
//                 }
//             },
//             {
//                 "location": {
//                     "location-key": "point1",
//                     "point": "",
//                     "area-description": "Leadville, Lake County Airport, CO",
//                     "height": 9928
//                 },
//                 "moreWeatherInformation": "https://www.nws.noaa.gov/data/obhistory/KLXV.html",
//                 "time-layout": {
//                     "layout-key": "k-p1h-n1-1",
//                     "start-valid-time": "2025-02-11T08:53:00-07:00"
//                 },
//                 "parameters": {
//                     "temperature": [
//                         {
//                             "value": 23
//                         },
//                         {
//                             "value": 3
//                         }
//                     ],
//                     "humidity": {
//                         "value": 42
//                     },
//                     "weather": {
//                         "name": "Weather Type, Coverage, Intensity",
//                         "weather-conditions": [
//                             "",
//                             {
//                                 "value": {
//                                     "visibility": 10
//                                 }
//                             }
//                         ]
//                     },
//                     "conditions-icon": {
//                         "name": "Conditions Icon",
//                         "icon-link": "https://forecast.weather.gov/newimages/medium/sct.png"
//                     },
//                     "direction": {
//                         "value": 999
//                     },
//                     "wind-speed": [
//                         {
//                             "value": "NA"
//                         },
//                         {
//                             "value": 3
//                         }
//                     ],
//                     "pressure": {
//                         "value": 29.66
//                     }
//                 }
//             }
//         ]
//     }
// }
