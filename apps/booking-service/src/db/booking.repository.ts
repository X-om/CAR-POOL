import { db } from '@repo/database';
import { v4 as uuidv4 } from 'uuid';

type DbBookingRow = {
  id: string;
  ride_id: string;
  passenger_id: string;
  seat_count: number;
  booking_status: string;
  pickup_stop_order: number | null;
  dropoff_stop_order: number | null;
};

type DbRideForBookingRow = {
  id: string;
  driver_id: string;
  approval_mode: string | null;
  source_city: string | null;
  destination_city: string | null;
  departure_time: Date | null;
  ride_status: string | null;
  has_completed_trip: boolean;
};

type DbBookingWithRideRow = DbBookingRow & {
  driver_id: string;
  source_city: string | null;
  destination_city: string | null;
  departure_time: Date | null;
};

type DbRideStopOrderRow = {
  stop_order: number;
};

export const bookingRepository = {
  async getRideForBooking(rideId: string): Promise<DbRideForBookingRow> {
    const res = await db.query<DbRideForBookingRow>(
      `
      SELECT
        r.id,
        r.driver_id,
        r.approval_mode,
        r.source_city,
        r.destination_city,
        r.departure_time,
        r.ride_status,
        EXISTS (
          SELECT 1
          FROM trips t
          WHERE t.ride_id = r.id
            AND t.trip_status = 'COMPLETED'
        ) AS has_completed_trip
      FROM rides r
      WHERE r.id = $1
      LIMIT 1
      `,
      [rideId],
    );
    const row = res.rows[0];
    if (!row) throw new Error('RIDE_NOT_FOUND');
    return row;
  },

  async listRideStopOrders(rideId: string): Promise<number[]> {
    const res = await db.query<DbRideStopOrderRow>(
      `
      SELECT stop_order
      FROM ride_stops
      WHERE ride_id = $1
      ORDER BY stop_order ASC
      `,
      [rideId],
    );
    return res.rows.map((r) => r.stop_order);
  },

  async createBooking(input: {
    rideId: string;
    passengerId: string;
    seatCount: number;
    status: 'PENDING' | 'CONFIRMED';
    pickupStopOrder?: number;
    dropoffStopOrder?: number;
  }): Promise<string> {
    const id = uuidv4();
    await db.query(
      `
      INSERT INTO bookings (id, ride_id, passenger_id, seat_count, booking_status, pickup_stop_order, dropoff_stop_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      `,
      [
        id,
        input.rideId,
        input.passengerId,
        input.seatCount,
        input.status,
        input.pickupStopOrder ?? null,
        input.dropoffStopOrder ?? null,
      ],
    );
    return id;
  },

  async getBooking(bookingId: string): Promise<DbBookingRow> {
    const res = await db.query<DbBookingRow>(
      `
      SELECT id, ride_id, passenger_id, seat_count, booking_status, pickup_stop_order, dropoff_stop_order
      FROM bookings
      WHERE id = $1
      LIMIT 1
      `,
      [bookingId],
    );
    const row = res.rows[0];
    if (!row) throw new Error('BOOKING_NOT_FOUND');
    return row;
  },

  async getBookingWithRide(bookingId: string): Promise<DbBookingWithRideRow> {
    const res = await db.query<DbBookingWithRideRow>(
      `
      SELECT
        b.id, b.ride_id, b.passenger_id, b.seat_count, b.booking_status,
        b.pickup_stop_order, b.dropoff_stop_order,
        r.driver_id,
        r.source_city,
        r.destination_city,
        r.departure_time
      FROM bookings b
      JOIN rides r ON r.id = b.ride_id
      WHERE b.id = $1
      LIMIT 1
      `,
      [bookingId],
    );
    const row = res.rows[0];
    if (!row) throw new Error('BOOKING_NOT_FOUND');
    return row;
  },

  async updateBookingStatus(input: { bookingId: string; nextStatus: 'CONFIRMED' | 'CANCELLED' }): Promise<boolean> {
    // Only allow transitions from PENDING/CONFIRMED
    const res = await db.query(
      `
      UPDATE bookings
      SET booking_status = $2
      WHERE id = $1
        AND booking_status IN ('PENDING', 'CONFIRMED')
      `,
      [input.bookingId, input.nextStatus],
    );
    return res.rowCount === 1;
  },

  async listUserBookings(passengerId: string): Promise<DbBookingRow[]> {
    const res = await db.query<DbBookingRow>(
      `
      SELECT id, ride_id, passenger_id, seat_count, booking_status, pickup_stop_order, dropoff_stop_order
      FROM bookings
      WHERE passenger_id = $1
      ORDER BY created_at DESC
      `,
      [passengerId],
    );
    return res.rows;
  },

  async listDriverBookings(driverId: string): Promise<DbBookingRow[]> {
    const res = await db.query<DbBookingRow>(
      `
      SELECT b.id, b.ride_id, b.passenger_id, b.seat_count, b.booking_status, b.pickup_stop_order, b.dropoff_stop_order
      FROM bookings b
      JOIN rides r ON r.id = b.ride_id
      WHERE r.driver_id = $1
      ORDER BY b.created_at DESC
      `,
      [driverId],
    );
    return res.rows;
  },

  async listRideBookings(rideId: string): Promise<DbBookingRow[]> {
    const res = await db.query<DbBookingRow>(
      `
      SELECT id, ride_id, passenger_id, seat_count, booking_status, pickup_stop_order, dropoff_stop_order
      FROM bookings
      WHERE ride_id = $1
        AND booking_status = 'CONFIRMED'
      ORDER BY created_at DESC
      `,
      [rideId],
    );
    return res.rows;
  },
};
