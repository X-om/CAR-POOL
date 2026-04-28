import { db } from '@repo/database';
import { ride } from '@repo/grpc';
import { v4 as uuidv4 } from 'uuid';
import { unixToDate } from '../utils/time';
import { haversineKm } from '../utils/geo';

type DbRideRow = {
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
  total_seats: number;
  available_seats: number;
  approval_mode: string | null;
  ride_status: string | null;
  created_at: Date;
};

type DbRideStopRow = {
  id: string;
  ride_id: string;
  stop_order: number;
  city_name: string;
  latitude: number;
  longitude: number;
};

type DbRideSegmentRow = {
  ride_id: string;
  from_stop_order: number;
  to_stop_order: number;
  distance_km: number;
  used_seats: number;
};

type DbRideBookingLegRow = {
  seat_count: number;
  booking_status: string;
  pickup_stop_order: number | null;
  dropoff_stop_order: number | null;
};

function approvalModeToDb(mode: ride.BookingApprovalMode | undefined): 'AUTO' | 'MANUAL' {
  return mode === ride.BookingApprovalMode.BOOKING_APPROVAL_MODE_MANUAL ? 'MANUAL' : 'AUTO';
}

function normalizeStops(stops: ride.Stop[]): ride.Stop[] {
  const s = [...(stops ?? [])].sort((a, b) => a.stopOrder - b.stopOrder);
  if (s.length < 2) throw new Error('RIDE_ROUTE_TOO_SHORT');

  for (let i = 1; i < s.length; i++) {
    if (s[i]!.stopOrder === s[i - 1]!.stopOrder) throw new Error('DUPLICATE_STOP_ORDER');
    if (s[i]!.stopOrder < s[i - 1]!.stopOrder) throw new Error('INVALID_STOP_ORDER');
  }
  return s;
}

function rideLegRangeFromStops(stops: DbRideStopRow[]): { pickup: number; dropoff: number } {
  if (!stops.length) throw new Error('RIDE_ROUTE_TOO_SHORT');
  const ordered = [...stops].sort((a, b) => a.stop_order - b.stop_order);
  return { pickup: ordered[0]!.stop_order, dropoff: ordered[ordered.length - 1]!.stop_order };
}

async function recomputeAndPersistMinAvailableSeats(rideId: string, client?: { query: Function }): Promise<void> {
  const q = client?.query ? client.query.bind(client) : db.query.bind(db);
  await q(
    `
    UPDATE rides r
    SET available_seats = COALESCE(
      (
        SELECT MIN(r.total_seats - s.used_seats)
        FROM ride_segments s
        WHERE s.ride_id = r.id
      ),
      r.total_seats
    )
    WHERE r.id = $1
    `,
    [rideId],
  );
}

export const rideRepository = {
  async createRide(input: {
    driverId: string;
    vehicleId: string;
    sourceCity: string;
    destinationCity: string;
    departureTime: number | bigint;
    pricePerSeat: number;
    stops: ride.Stop[];
    approvalMode: ride.BookingApprovalMode | undefined;
  }): Promise<string> {
    const id = uuidv4();
    const departure = unixToDate(input.departureTime);

    const stops = normalizeStops(input.stops);
    const sourceStop = stops.at(0);

    const destinationStop = stops.at(-1);

    if (!sourceStop || !destinationStop) throw new Error('INVALID_RIDE_STOPS');
    const sourceLat = sourceStop.latitude ?? null;
    const sourceLng = sourceStop.longitude ?? null;
    const destinationLat = destinationStop.latitude ?? null;
    const destinationLng = destinationStop.longitude ?? null;

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // seat_capacity is authoritative in VehicleService; until we integrate, default to provided stop data + seatCapacity from vehicles table.
      const vehicleRes = await client.query<{ seat_capacity: number | null }>(
        `SELECT seat_capacity FROM vehicles WHERE id = $1 LIMIT 1`,
        [input.vehicleId],
      );
      const seatCapacity = vehicleRes.rows[0]?.seat_capacity ?? 0;
      if (seatCapacity <= 0) throw new Error('INVALID_VEHICLE_SEAT_CAPACITY');

      await client.query(
        `
        INSERT INTO rides (
          id, driver_id, vehicle_id,
          source_city, destination_city,
          source_lat, source_lng, destination_lat, destination_lng,
          departure_time,
          price_per_seat,
          total_seats, available_seats,
          approval_mode,
          ride_status
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        `,
        [
          id,
          input.driverId,
          input.vehicleId,
          input.sourceCity,
          input.destinationCity,
          sourceLat,
          sourceLng,
          destinationLat,
          destinationLng,
          departure,
          Math.round(input.pricePerSeat),
          seatCapacity,
          seatCapacity,
          approvalModeToDb(input.approvalMode),
          'ACTIVE',
        ],
      );

      for (const s of stops) {
        await client.query(
          `
          INSERT INTO ride_stops (id, ride_id, stop_order, city_name, latitude, longitude)
          VALUES ($1,$2,$3,$4,$5,$6)
          `,
          [uuidv4(), id, s.stopOrder, s.cityName, s.latitude, s.longitude],
        );
      }

      // Create ride segments for seat allocation + along-route pricing
      for (let i = 0; i < stops.length - 1; i++) {
        const a = stops[i]!;
        const b = stops[i + 1]!;
        const distanceKm = haversineKm({ lat: a.latitude, lng: a.longitude }, { lat: b.latitude, lng: b.longitude });
        await client.query(
          `
          INSERT INTO ride_segments (ride_id, from_stop_order, to_stop_order, distance_km, used_seats)
          VALUES ($1,$2,$3,$4,$5)
          `,
          [id, a.stopOrder, b.stopOrder, distanceKm, 0],
        );
      }

      await recomputeAndPersistMinAvailableSeats(id, client);

      await client.query('COMMIT');
      return id;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async updateRide(input: {
    rideId: string;
    driverId: string;
    vehicleId: string;
    sourceCity: string;
    destinationCity: string;
    departureTime: number | bigint;
    pricePerSeat: number;
    stops: ride.Stop[];
    approvalMode: ride.BookingApprovalMode | undefined;
  }): Promise<boolean> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const rideRes = await client.query<{ vehicle_id: string }>(
        `
        SELECT vehicle_id
        FROM rides
        WHERE id = $1 AND driver_id = $2 AND (ride_status = 'ACTIVE' OR ride_status IS NULL)
        LIMIT 1
        `,
        [input.rideId, input.driverId],
      );
      const current = rideRes.rows[0];
      if (!current) {
        await client.query('ROLLBACK');
        return false;
      }

      const bookingCountRes = await client.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM bookings WHERE ride_id = $1 AND booking_status IN ('PENDING','CONFIRMED')`,
        [input.rideId],
      );
      const bookingCount = Number(bookingCountRes.rows[0]?.c ?? '0');
      if (bookingCount > 0 && current.vehicle_id !== input.vehicleId) {
        throw new Error('RIDE_HAS_BOOKINGS_CANNOT_CHANGE_VEHICLE');
      }

      const departure = unixToDate(input.departureTime);
      const stops = normalizeStops(input.stops);

      if (bookingCount > 0) {
        const existingStopsRes = await client.query<DbRideStopRow>(
          `
          SELECT id, ride_id, stop_order, city_name, latitude, longitude
          FROM ride_stops
          WHERE ride_id = $1
          ORDER BY stop_order ASC
          `,
          [input.rideId],
        );
        const existingStops = existingStopsRes.rows.map((s) => ({
          stopOrder: s.stop_order,
          cityName: s.city_name,
          latitude: s.latitude,
          longitude: s.longitude,
        }));
        const nextStops = stops.map((s) => ({
          stopOrder: s.stopOrder,
          cityName: s.cityName,
          latitude: s.latitude,
          longitude: s.longitude,
        }));
        const sameStops = JSON.stringify(existingStops) === JSON.stringify(nextStops);
        if (!sameStops) throw new Error('RIDE_HAS_BOOKINGS_CANNOT_CHANGE_ROUTE');
      }

      const sourceStop = stops.at(0);


      const destinationStop = stops.at(-1);


      if (!sourceStop || !destinationStop) throw new Error('INVALID_RIDE_STOPS');
      const sourceLat = sourceStop.latitude ?? null;
      const sourceLng = sourceStop.longitude ?? null;
      const destinationLat = destinationStop.latitude ?? null;
      const destinationLng = destinationStop.longitude ?? null;

      const res = await client.query(
        `
        UPDATE rides
        SET
          vehicle_id = $3,
          source_city = $4,
          destination_city = $5,
          source_lat = $6,
          source_lng = $7,
          destination_lat = $8,
          destination_lng = $9,
          departure_time = $10,
          price_per_seat = $11,
          approval_mode = $12
        WHERE id = $1 AND driver_id = $2 AND (ride_status = 'ACTIVE' OR ride_status IS NULL)
        `,
        [
          input.rideId,
          input.driverId,
          input.vehicleId,
          input.sourceCity,
          input.destinationCity,
          sourceLat,
          sourceLng,
          destinationLat,
          destinationLng,
          departure,
          Math.round(input.pricePerSeat),
          approvalModeToDb(input.approvalMode),
        ],
      );
      if (res.rowCount !== 1) {
        await client.query('ROLLBACK');
        return false;
      }

      // If there are active bookings, route is immutable; do not touch ride_stops/ride_segments.
      if (bookingCount === 0) {
        await client.query(`DELETE FROM ride_stops WHERE ride_id = $1`, [input.rideId]);
        for (const s of stops) {
          await client.query(
            `
            INSERT INTO ride_stops (id, ride_id, stop_order, city_name, latitude, longitude)
            VALUES ($1,$2,$3,$4,$5,$6)
            `,
            [uuidv4(), input.rideId, s.stopOrder, s.cityName, s.latitude, s.longitude],
          );
        }

        await client.query(`DELETE FROM ride_segments WHERE ride_id = $1`, [input.rideId]);
        for (let i = 0; i < stops.length - 1; i++) {
          const a = stops[i]!;
          const b = stops[i + 1]!;
          const distanceKm = haversineKm(
            { lat: a.latitude, lng: a.longitude },
            { lat: b.latitude, lng: b.longitude },
          );
          await client.query(
            `
            INSERT INTO ride_segments (ride_id, from_stop_order, to_stop_order, distance_km, used_seats)
            VALUES ($1,$2,$3,$4,$5)
            `,
            [input.rideId, a.stopOrder, b.stopOrder, distanceKm, 0],
          );
        }

        await recomputeAndPersistMinAvailableSeats(input.rideId, client);
      }

      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async cancelRide(input: { rideId: string; driverId: string }): Promise<boolean> {
    const res = await db.query(
      `
      UPDATE rides
      SET ride_status = 'CANCELLED'
      WHERE id = $1 AND driver_id = $2 AND (ride_status = 'ACTIVE' OR ride_status IS NULL)
      `,
      [input.rideId, input.driverId],
    );
    return res.rowCount === 1;
  },

  async listRideBookingPassengerIds(rideId: string): Promise<string[]> {
    const res = await db.query<{ passenger_id: string }>(
      `
      SELECT DISTINCT passenger_id
      FROM bookings
      WHERE ride_id = $1
        AND booking_status IN ('PENDING','CONFIRMED')
      ORDER BY passenger_id ASC
      `,
      [rideId],
    );
    return res.rows.map((r) => r.passenger_id);
  },

  async getRide(rideId: string): Promise<DbRideRow> {
    const res = await db.query<DbRideRow>(
      `
      SELECT
        id, driver_id, vehicle_id,
        source_city, destination_city,
        source_lat, source_lng, destination_lat, destination_lng,
        departure_time,
        price_per_seat,
        total_seats, available_seats,
        approval_mode,
        ride_status,
        created_at
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

  async listDriverRides(driverId: string): Promise<DbRideRow[]> {
    const res = await db.query<DbRideRow>(
      `
      SELECT
        id, driver_id, vehicle_id,
        source_city, destination_city,
        source_lat, source_lng, destination_lat, destination_lng,
        departure_time,
        price_per_seat,
        total_seats, available_seats,
        approval_mode,
        ride_status,
        created_at
      FROM rides
      WHERE driver_id = $1
        AND (ride_status = 'ACTIVE' OR ride_status IS NULL)
      ORDER BY created_at DESC
      `,
      [driverId],
    );
    return res.rows;
  },

  async listStops(rideId: string): Promise<DbRideStopRow[]> {
    const res = await db.query<DbRideStopRow>(
      `
      SELECT id, ride_id, stop_order, city_name, latitude, longitude
      FROM ride_stops
      WHERE ride_id = $1
      ORDER BY stop_order ASC
      `,
      [rideId],
    );
    return res.rows;
  },

  async getLegAvailableSeats(input: {
    rideId: string;
    requestedSeats: number;
    pickupStopOrder: number;
    dropoffStopOrder: number;
  }): Promise<{ availableSeats: number; isAvailable: boolean }> {
    const res = await db.query<{ total_seats: number }>(
      `SELECT total_seats FROM rides WHERE id = $1 LIMIT 1`,
      [input.rideId],
    );
    const rideRow = res.rows[0];
    if (!rideRow) throw new Error('RIDE_NOT_FOUND');

    const legsRes = await db.query<{ min_avail: number | null }>(
      `
      SELECT MIN($2 - used_seats) AS min_avail
      FROM ride_segments
      WHERE ride_id = $1
        AND from_stop_order >= $3
        AND to_stop_order <= $4
      `,
      [input.rideId, rideRow.total_seats, input.pickupStopOrder, input.dropoffStopOrder],
    );
    const minAvail = legsRes.rows[0]?.min_avail;
    const availableSeats = Number.isFinite(minAvail as any) ? Number(minAvail) : rideRow.total_seats;
    return { availableSeats, isAvailable: availableSeats >= input.requestedSeats };
  },

  async getAvailableSeats(rideId: string): Promise<number> {
    const res = await db.query<{ available_seats: number }>(
      `
      SELECT available_seats
      FROM rides
      WHERE id = $1
      LIMIT 1
      `,
      [rideId],
    );
    const row = res.rows[0];
    if (!row) throw new Error('RIDE_NOT_FOUND');
    return row.available_seats;
  },

  async reserveSeats(input: {
    rideId: string;
    seatCount: number;
    pickupStopOrder?: number;
    dropoffStopOrder?: number;
  }): Promise<boolean> {
    // If no leg is specified, reserve for the full route.
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const rideRes = await client.query<{ total_seats: number; ride_status: string | null }>(
        `SELECT total_seats, ride_status FROM rides WHERE id = $1 LIMIT 1 FOR UPDATE`,
        [input.rideId],
      );
      const rideRow = rideRes.rows[0];
      if (!rideRow) throw new Error('RIDE_NOT_FOUND');
      if (rideRow.ride_status != null && rideRow.ride_status !== 'ACTIVE') {
        await client.query('ROLLBACK');
        return false;
      }

      let pickup = input.pickupStopOrder;
      let dropoff = input.dropoffStopOrder;
      if (pickup == null || dropoff == null) {
        const stopsRes = await client.query<DbRideStopRow>(
          `SELECT id, ride_id, stop_order, city_name, latitude, longitude FROM ride_stops WHERE ride_id = $1 ORDER BY stop_order ASC`,
          [input.rideId],
        );
        const range = rideLegRangeFromStops(stopsRes.rows);
        pickup = range.pickup;
        dropoff = range.dropoff;
      }
      if (!(pickup < dropoff)) throw new Error('INVALID_ROUTE_LEG');

      const segRes = await client.query<DbRideSegmentRow>(
        `
        SELECT ride_id, from_stop_order, to_stop_order, distance_km, used_seats
        FROM ride_segments
        WHERE ride_id = $1
          AND from_stop_order >= $2
          AND to_stop_order <= $3
        ORDER BY from_stop_order ASC
        FOR UPDATE
        `,
        [input.rideId, pickup, dropoff],
      );
      const segments = segRes.rows;
      if (!segments.length) {
        // Fallback for rides missing segments (should be rare)
        const legacy = await client.query(
          `
          UPDATE rides
          SET available_seats = available_seats - $2
          WHERE id = $1 AND (ride_status = 'ACTIVE' OR ride_status IS NULL) AND available_seats >= $2
          `,
          [input.rideId, input.seatCount],
        );
        await client.query('COMMIT');
        return legacy.rowCount === 1;
      }

      const canReserve = segments.every((s) => s.used_seats + input.seatCount <= rideRow.total_seats);
      if (!canReserve) {
        await client.query('ROLLBACK');
        return false;
      }

      await client.query(
        `
        UPDATE ride_segments
        SET used_seats = used_seats + $4
        WHERE ride_id = $1
          AND from_stop_order >= $2
          AND to_stop_order <= $3
        `,
        [input.rideId, pickup, dropoff, input.seatCount],
      );

      await recomputeAndPersistMinAvailableSeats(input.rideId, client);
      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async releaseSeats(input: {
    rideId: string;
    seatCount: number;
    pickupStopOrder?: number;
    dropoffStopOrder?: number;
  }): Promise<boolean> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      await client.query(`SELECT id FROM rides WHERE id = $1 LIMIT 1 FOR UPDATE`, [input.rideId]);

      let pickup = input.pickupStopOrder;
      let dropoff = input.dropoffStopOrder;
      if (pickup == null || dropoff == null) {
        const stopsRes = await client.query<DbRideStopRow>(
          `SELECT id, ride_id, stop_order, city_name, latitude, longitude FROM ride_stops WHERE ride_id = $1 ORDER BY stop_order ASC`,
          [input.rideId],
        );
        const range = rideLegRangeFromStops(stopsRes.rows);
        pickup = range.pickup;
        dropoff = range.dropoff;
      }
      if (!(pickup < dropoff)) throw new Error('INVALID_ROUTE_LEG');

      const segRes = await client.query<DbRideSegmentRow>(
        `
        SELECT ride_id, from_stop_order, to_stop_order, distance_km, used_seats
        FROM ride_segments
        WHERE ride_id = $1
          AND from_stop_order >= $2
          AND to_stop_order <= $3
        ORDER BY from_stop_order ASC
        FOR UPDATE
        `,
        [input.rideId, pickup, dropoff],
      );
      const segments = segRes.rows;
      if (!segments.length) {
        const legacy = await client.query(
          `
          UPDATE rides
          SET available_seats = LEAST(total_seats, available_seats + $2)
          WHERE id = $1
          `,
          [input.rideId, input.seatCount],
        );
        await client.query('COMMIT');
        return legacy.rowCount === 1;
      }

      await client.query(
        `
        UPDATE ride_segments
        SET used_seats = GREATEST(0, used_seats - $4)
        WHERE ride_id = $1
          AND from_stop_order >= $2
          AND to_stop_order <= $3
        `,
        [input.rideId, pickup, dropoff, input.seatCount],
      );

      await recomputeAndPersistMinAvailableSeats(input.rideId, client);
      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};
