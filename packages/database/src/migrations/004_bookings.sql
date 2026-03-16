CREATE TABLE bookings (
    id UUID PRIMARY KEY,
    ride_id UUID REFERENCES rides(id),
    passenger_id UUID REFERENCES users(id),

    seat_count INT,
    booking_status TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE booking_passengers (
    id UUID PRIMARY KEY,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    passenger_name TEXT,
    passenger_contact TEXT
);

CREATE INDEX idx_bookings_passenger ON bookings(passenger_id);
CREATE INDEX idx_bookings_ride ON bookings(ride_id);