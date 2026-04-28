import { db } from '@repo/database';
import { v4 as uuidv4 } from 'uuid';

type DbTripRow = {
  id: string;
  ride_id: string;
  driver_id: string;
  trip_status: string;
};

type DbBookingRow = {
  id: string;
  passenger_id: string;
};

export const tripRepository = {
  async startTrip(input: { rideId: string; driverId: string }): Promise<{ tripId: string; status: string }> {
    const client = await db.connect();
    const tripId = uuidv4();
    try {
      await client.query('BEGIN');

      const rideRes = await client.query<{ driver_id: string }>(
        `SELECT driver_id FROM rides WHERE id = $1 LIMIT 1`,
        [input.rideId],
      );
      const ride = rideRes.rows[0];
      if (!ride) throw new Error('RIDE_NOT_FOUND');
      if (ride.driver_id !== input.driverId) throw new Error('UNAUTHORIZED');

      await client.query(
        `
        INSERT INTO trips (id, ride_id, driver_id, trip_status, start_time)
        VALUES ($1,$2,$3,$4,NOW())
        `,
        [tripId, input.rideId, input.driverId, 'STARTED'],
      );

      const bookingsRes = await client.query<DbBookingRow>(
        `
        SELECT id, passenger_id
        FROM bookings
        WHERE ride_id = $1 AND booking_status = 'CONFIRMED'
        `,
        [input.rideId],
      );

      for (const b of bookingsRes.rows) {
        await client.query(
          `
          INSERT INTO trip_passengers (id, trip_id, booking_id, passenger_id, pickup_status)
          VALUES ($1,$2,$3,$4,$5)
          `,
          [uuidv4(), tripId, b.id, b.passenger_id, 'NOT_PICKED'],
        );
      }

      await client.query('COMMIT');
      return { tripId, status: 'STARTED' };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async markPassengerPickedUp(input: { tripId: string; passengerId: string }): Promise<boolean> {
    const res = await db.query(
      `
      UPDATE trip_passengers
      SET pickup_status = 'PICKED_UP'
      WHERE trip_id = $1 AND passenger_id = $2
      `,
      [input.tripId, input.passengerId],
    );
    return res.rowCount === 1;
  },

  async completeTrip(input: { tripId: string; driverId: string }): Promise<boolean> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const res = await client.query(
        `
        UPDATE trips
        SET trip_status = 'COMPLETED', end_time = NOW()
        WHERE id = $1 AND driver_id = $2
          AND trip_status IN ('STARTED','IN_PROGRESS')
        `,
        [input.tripId, input.driverId],
      );
      if (res.rowCount !== 1) {
        await client.query('ROLLBACK');
        return false;
      }

      await client.query(
        `
        UPDATE bookings b
        SET booking_status = 'COMPLETED'
        FROM trip_passengers tp
        WHERE tp.trip_id = $1 AND tp.booking_id = b.id
          AND b.booking_status = 'CONFIRMED'
        `,
        [input.tripId],
      );

      // Mark associated ride as COMPLETED so driver lists can filter it out
      await client.query(
        `
        UPDATE rides r
        SET ride_status = 'COMPLETED'
        FROM trips t
        WHERE t.id = $1 AND t.ride_id = r.id
        `,
        [input.tripId],
      );

      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async insertRating(input: { tripId: string; passengerId: string; driverId: string; rating: number }): Promise<void> {
    const id = uuidv4();
    await db.query(
      `
      INSERT INTO trip_ratings (id, trip_id, passenger_id, driver_id, rating)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (trip_id, passenger_id) DO NOTHING
      `,
      [id, input.tripId, input.passengerId, input.driverId, input.rating],
    );
  },

  async hasRating(tripId: string, passengerId: string): Promise<boolean> {
    const res = await db.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM trip_ratings WHERE trip_id = $1 AND passenger_id = $2 LIMIT 1`,
      [tripId, passengerId],
    );
    return Number(res.rows[0]?.c ?? '0') > 0;
  },

  async getPassengerTripForRide(rideId: string, passengerId: string): Promise<{ tripId: string; status: string } | null> {
    const res = await db.query<{ trip_id: string; trip_status: string }>(
      `
      SELECT t.id AS trip_id, t.trip_status
      FROM trips t
      JOIN trip_passengers tp ON tp.trip_id = t.id
      WHERE t.ride_id = $1
        AND tp.passenger_id = $2
        AND t.trip_status = 'COMPLETED'
      ORDER BY t.created_at DESC
      LIMIT 1
      `,
      [rideId, passengerId],
    );
    if (!res.rows[0]) return null;
    return { tripId: res.rows[0]!.trip_id, status: res.rows[0]!.trip_status };
  },

  async getTrip(tripId: string): Promise<DbTripRow> {
    const res = await db.query<DbTripRow>(
      `
      SELECT id, ride_id, driver_id, trip_status
      FROM trips
      WHERE id = $1
      LIMIT 1
      `,
      [tripId],
    );
    const row = res.rows[0];
    if (!row) throw new Error('TRIP_NOT_FOUND');
    return row;
  },

  async listDriverTrips(driverId: string): Promise<DbTripRow[]> {
    const res = await db.query<DbTripRow>(
      `
      SELECT id, ride_id, driver_id, trip_status
      FROM trips
      WHERE driver_id = $1
      ORDER BY created_at DESC
      `,
      [driverId],
    );
    return res.rows;
  },

  async listTripPassengerIds(tripId: string): Promise<string[]> {
    const res = await db.query<{ passenger_id: string }>(
      `
      SELECT passenger_id
      FROM trip_passengers
      WHERE trip_id = $1
      ORDER BY id ASC
      `,
      [tripId],
    );
    return res.rows.map((r) => r.passenger_id);
  },

  async getTripParticipantIds(tripId: string): Promise<{ rideId: string; driverId: string; passengerIds: string[] }> {
    const t = await this.getTrip(tripId);
    const passengerIds = await this.listTripPassengerIds(tripId);
    return { rideId: t.ride_id, driverId: t.driver_id, passengerIds };
  },
};
