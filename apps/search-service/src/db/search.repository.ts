import { db } from '@repo/database';

type DbRideSearchRow = {
  id: string;
  driver_id: string;
  vehicle_id: string;
  source_city: string;
  destination_city: string;
  source_lat: number | null;
  source_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  departure_time: Date;
  price_per_seat: number;
  available_seats: number;
  ride_status: string | null;
};

type DbRideStopRow = {
  stop_order: number;
  city_name: string;
  latitude: number;
  longitude: number;
};

type DbRideLegStatsRow = {
  total_km: number | null;
  leg_km: number | null;
  leg_min_avail: number | null;
};

export const searchRepository = {
  async getRide(rideId: string): Promise<DbRideSearchRow> {
    const res = await db.query<DbRideSearchRow>(
      `
      SELECT
        id, driver_id, vehicle_id,
        source_city, destination_city,
        source_lat, source_lng,
        destination_lat, destination_lng,
        departure_time,
        price_per_seat,
        available_seats,
        ride_status
      FROM rides
      WHERE id = $1
      LIMIT 1
      `,
      [rideId],
    );
    const row = res.rows[0];
    if (!row) throw new Error('RIDE_NOT_FOUND');
    return row;
  },

  async listRideStops(rideId: string): Promise<DbRideStopRow[]> {
    const res = await db.query<DbRideStopRow>(
      `
      SELECT stop_order, city_name, latitude, longitude
      FROM ride_stops
      WHERE ride_id = $1
      ORDER BY stop_order ASC
      `,
      [rideId],
    );
    return res.rows;
  },

  async getRideLegStats(input: {
    rideId: string;
    pickupStopOrder: number;
    dropoffStopOrder: number;
  }): Promise<{ totalKm: number; legKm: number; legMinAvailableSeats: number }> {
    const res = await db.query<DbRideLegStatsRow>(
      `
      SELECT
        COALESCE(SUM(s.distance_km), 0) AS total_km,
        COALESCE(SUM(s.distance_km) FILTER (
          WHERE s.from_stop_order >= $2 AND s.to_stop_order <= $3
        ), 0) AS leg_km,
        COALESCE(
          MIN(r.total_seats - s.used_seats) FILTER (
            WHERE s.from_stop_order >= $2 AND s.to_stop_order <= $3
          ),
          r.available_seats
        ) AS leg_min_avail
      FROM rides r
      LEFT JOIN ride_segments s ON s.ride_id = r.id
      WHERE r.id = $1
      GROUP BY r.id, r.available_seats
      `,
      [input.rideId, input.pickupStopOrder, input.dropoffStopOrder],
    );
    const row = res.rows[0];
    if (!row) throw new Error('RIDE_NOT_FOUND');
    return {
      totalKm: Number(row.total_km ?? 0),
      legKm: Number(row.leg_km ?? 0),
      legMinAvailableSeats: Number(row.leg_min_avail ?? 0),
    };
  },

  async searchRideIdsByStopsBBox(input: {
    sourceLatMin: number;
    sourceLatMax: number;
    sourceLngMin: number;
    sourceLngMax: number;
    destinationLatMin: number;
    destinationLatMax: number;
    destinationLngMin: number;
    destinationLngMax: number;
    departureMin: Date;
    departureMax: Date;
  }): Promise<string[]> {
    const res = await db.query<{ id: string }>(
      `
      SELECT r.id
      FROM rides r
      JOIN ride_stops s1 ON s1.ride_id = r.id
      JOIN ride_stops s2 ON s2.ride_id = r.id AND s2.stop_order > s1.stop_order
      WHERE r.ride_status = 'ACTIVE'
        AND r.departure_time BETWEEN $1 AND $2
        AND s1.latitude BETWEEN $3 AND $4
        AND s1.longitude BETWEEN $5 AND $6
        AND s2.latitude BETWEEN $7 AND $8
        AND s2.longitude BETWEEN $9 AND $10
      GROUP BY r.id, r.departure_time
      ORDER BY r.departure_time ASC
      LIMIT 200
      `,
      [
        input.departureMin,
        input.departureMax,
        input.sourceLatMin,
        input.sourceLatMax,
        input.sourceLngMin,
        input.sourceLngMax,
        input.destinationLatMin,
        input.destinationLatMax,
        input.destinationLngMin,
        input.destinationLngMax,
      ],
    );
    return res.rows.map((r) => r.id);
  },

  async searchRides(input: {
    sourceLatMin: number;
    sourceLatMax: number;
    sourceLngMin: number;
    sourceLngMax: number;
    destinationLatMin: number;
    destinationLatMax: number;
    destinationLngMin: number;
    destinationLngMax: number;
    departureMin: Date;
    departureMax: Date;
    requiredSeats: number;
  }): Promise<DbRideSearchRow[]> {
    const res = await db.query<DbRideSearchRow>(
      `
      SELECT
        id, driver_id, vehicle_id,
        source_city, destination_city,
        source_lat, source_lng,
        destination_lat, destination_lng,
        departure_time,
        price_per_seat,
        available_seats,
        ride_status
      FROM rides
      WHERE ride_status = 'ACTIVE'
        AND available_seats >= $1
        AND departure_time BETWEEN $2 AND $3
        AND source_lat IS NOT NULL AND source_lng IS NOT NULL
        AND destination_lat IS NOT NULL AND destination_lng IS NOT NULL
        AND source_lat BETWEEN $4 AND $5
        AND source_lng BETWEEN $6 AND $7
        AND destination_lat BETWEEN $8 AND $9
        AND destination_lng BETWEEN $10 AND $11
      ORDER BY departure_time ASC
      LIMIT 200
      `,
      [
        input.requiredSeats,
        input.departureMin,
        input.departureMax,
        input.sourceLatMin,
        input.sourceLatMax,
        input.sourceLngMin,
        input.sourceLngMax,
        input.destinationLatMin,
        input.destinationLatMax,
        input.destinationLngMin,
        input.destinationLngMax,
      ],
    );
    return res.rows;
  },
};
