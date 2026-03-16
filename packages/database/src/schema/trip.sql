/* @name ITrip */
SELECT
  id,
  ride_id,
  driver_id,
  trip_status,
  start_time,
  end_time,
  created_at
FROM trips
LIMIT 1;

/* @name ITripPassenger */
SELECT
  id,
  trip_id,
  booking_id,
  passenger_id,
  pickup_status
FROM trip_passengers
LIMIT 1;

/* @name ITripEvent */
SELECT
  id,
  trip_id,
  event_type,
  event_timestamp,
  metadata
FROM trip_events
LIMIT 1;