CREATE TABLE rides (
    id UUID PRIMARY KEY,
    driver_id UUID REFERENCES users(id),
    vehicle_id UUID REFERENCES vehicles(id),

    source_city TEXT,
    destination_city TEXT,

    source_lat DOUBLE PRECISION,
    source_lng DOUBLE PRECISION,

    destination_lat DOUBLE PRECISION,
    destination_lng DOUBLE PRECISION,

    departure_time TIMESTAMP,
    estimated_arrival_time TIMESTAMP,

    price_per_seat INT,

    total_seats INT,
    available_seats INT,

    ride_status TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ride_stops (
    id UUID PRIMARY KEY,
    ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
    stop_order INT,
    city_name TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION
);

CREATE INDEX idx_rides_source_city ON rides(source_city);
CREATE INDEX idx_rides_destination_city ON rides(destination_city);