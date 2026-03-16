CREATE TABLE trips (
    id UUID PRIMARY KEY,
    ride_id UUID REFERENCES rides(id),
    driver_id UUID REFERENCES users(id),

    trip_status TEXT,

    start_time TIMESTAMP,
    end_time TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE trip_passengers (
    id UUID PRIMARY KEY,
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id),

    passenger_id UUID REFERENCES users(id),

    pickup_status TEXT
);

CREATE TABLE trip_events (
    id UUID PRIMARY KEY,
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    event_type TEXT,
    event_timestamp TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX idx_trips_driver ON trips(driver_id);