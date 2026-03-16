/* @name IBookings */
SELECT 
    id,
    ride_id,
    passenger_id,
    seat_count,
    booking_status,
    created_at
FROM bookings
LIMIT 1;

/* @name IBookingPassengers */
SELECT
    id,
    booking_id,
    passenger_name,
    passenger_contact
FROM booking_passengers
LIMIT 1;