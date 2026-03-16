/* @name IRide */
SELECT 
    id,
    driver_id,
    vehicle_id,

    source_city,
    destination_city,

    source_lat,
    source_lng,

    destination_lat,
    destination_lng,

    departure_time,
    estimated_arrival_time,

    price_per_seat,

    total_seats,
    available_seats,

    ride_status,
    created_at
FROM rides
LIMIT 1;

/* @name IRideStop */
SELECT
    id,
    ride_id,
    stop_order,
    city_name,
    latitude,
    longitude
FROM ride_stops
LIMIT 1;