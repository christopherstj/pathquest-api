export default interface ListActivity {
    resource_state: number;
    athlete: {
        id: number;
        resource_state: number;
    };
    name: string;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    total_elevation_gain: number;
    type: string;
    sport_type: string;
    workout_type: string | null;
    id: number;
    external_id: string;
    upload_id: number;
    start_date: string;
    start_date_local: string;
    timezone: string;
    utc_offset: number;
    start_latlng: number | null;
    end_latlng: number | null;
    location_city: null;
    location_state: null;
    location_country: string;
    achievement_count: number;
    kudos_count: number;
    comment_count: number;
    athlete_count: number;
    photo_count: number;
    map: {
        id: string;
        summary_polyline: string | null;
        resource_state: number;
    };
    trainer: boolean;
    commute: boolean;
    manual: boolean;
    private: boolean;
    flagged: boolean;
    gear_id: string;
    from_accepted_tag: boolean;
    average_speed: number;
    max_speed: number;
    average_cadence: number;
    average_watts: number;
    weighted_average_watts: number;
    kilojoules: number;
    device_watts: boolean;
    has_heartrate: boolean;
    average_heartrate: number;
    max_heartrate: number;
    max_watts: number;
    pr_count: number;
    total_photo_count: number;
    has_kudoed: boolean;
    suffer_score: number;
}

// {
//     "resource_state" : 2,
//     "athlete" : {
//       "id" : 134815,
//       "resource_state" : 1
//     },
//     "name" : "Happy Friday",
//     "distance" : 24931.4,
//     "moving_time" : 4500,
//     "elapsed_time" : 4500,
//     "total_elevation_gain" : 0,
//     "type" : "Ride",
//     "sport_type" : "MountainBikeRide",
//     "workout_type" : null,
//     "id" : 154504250376823,
//     "external_id" : "garmin_push_12345678987654321",
//     "upload_id" : 987654321234567891234,
//     "start_date" : "2018-05-02T12:15:09Z",
//     "start_date_local" : "2018-05-02T05:15:09Z",
//     "timezone" : "(GMT-08:00) America/Los_Angeles",
//     "utc_offset" : -25200,
//     "start_latlng" : null,
//     "end_latlng" : null,
//     "location_city" : null,
//     "location_state" : null,
//     "location_country" : "United States",
//     "achievement_count" : 0,
//     "kudos_count" : 3,
//     "comment_count" : 1,
//     "athlete_count" : 1,
//     "photo_count" : 0,
//     "map" : {
//       "id" : "a12345678987654321",
//       "summary_polyline" : null,
//       "resource_state" : 2
//     },
//     "trainer" : true,
//     "commute" : false,
//     "manual" : false,
//     "private" : false,
//     "flagged" : false,
//     "gear_id" : "b12345678987654321",
//     "from_accepted_tag" : false,
//     "average_speed" : 5.54,
//     "max_speed" : 11,
//     "average_cadence" : 67.1,
//     "average_watts" : 175.3,
//     "weighted_average_watts" : 210,
//     "kilojoules" : 788.7,
//     "device_watts" : true,
//     "has_heartrate" : true,
//     "average_heartrate" : 140.3,
//     "max_heartrate" : 178,
//     "max_watts" : 406,
//     "pr_count" : 0,
//     "total_photo_count" : 1,
//     "has_kudoed" : false,
//     "suffer_score" : 82
//   }
