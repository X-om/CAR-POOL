-- Segment-based seat allocation + distances for along-route pricing
-- Also store booking pickup/dropoff stop orders (leg booking)

-- 1) Booking leg columns (nullable for backwards compatibility)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS pickup_stop_order INT,
  ADD COLUMN IF NOT EXISTS dropoff_stop_order INT;

CREATE INDEX IF NOT EXISTS idx_bookings_ride_leg
  ON bookings (ride_id, pickup_stop_order, dropoff_stop_order);

-- 2) Ride segments table (one row per consecutive stop pair)
--    from_stop_order -> to_stop_order, ordered along the ride route.
CREATE TABLE IF NOT EXISTS ride_segments (
  ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
  from_stop_order INT NOT NULL,
  to_stop_order INT NOT NULL,

  distance_km DOUBLE PRECISION NOT NULL DEFAULT 0,
  used_seats INT NOT NULL DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),

  PRIMARY KEY (ride_id, from_stop_order, to_stop_order)
);

CREATE INDEX IF NOT EXISTS idx_ride_segments_ride
  ON ride_segments (ride_id);

-- 3) Backfill segments for existing rides that already have >= 2 stops.
--    Uses a Haversine distance implementation in pure SQL.
WITH ordered AS (
  SELECT
    rs.ride_id,
    rs.stop_order AS from_stop_order,
    LEAD(rs.stop_order) OVER (PARTITION BY rs.ride_id ORDER BY rs.stop_order) AS to_stop_order,
    rs.latitude AS from_lat,
    rs.longitude AS from_lng,
    LEAD(rs.latitude) OVER (PARTITION BY rs.ride_id ORDER BY rs.stop_order) AS to_lat,
    LEAD(rs.longitude) OVER (PARTITION BY rs.ride_id ORDER BY rs.stop_order) AS to_lng
  FROM ride_stops rs
), pairs AS (
  SELECT
    ride_id,
    from_stop_order,
    to_stop_order,
    6371.0 * 2.0 * asin(
      sqrt(
        power(sin(radians((to_lat - from_lat) / 2.0)), 2) +
        cos(radians(from_lat)) * cos(radians(to_lat)) *
        power(sin(radians((to_lng - from_lng) / 2.0)), 2)
      )
    ) AS distance_km
  FROM ordered
  WHERE to_stop_order IS NOT NULL
)
INSERT INTO ride_segments (ride_id, from_stop_order, to_stop_order, distance_km, used_seats)
SELECT p.ride_id, p.from_stop_order, p.to_stop_order, COALESCE(p.distance_km, 0), 0
FROM pairs p
ON CONFLICT DO NOTHING;
