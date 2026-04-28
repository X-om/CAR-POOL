-- 012_trip_ratings.sql
-- Store per-trip passenger ratings for drivers

CREATE TABLE IF NOT EXISTS trip_ratings (
  id UUID PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  passenger_id UUID REFERENCES users(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (trip_id, passenger_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_ratings_driver_id ON trip_ratings(driver_id);
