/** Types generated for queries found in "src/schema/booking.sql" */
import { PreparedQuery } from '@pgtyped/runtime';

/** 'IBookings' parameters type */
export type IIBookingsParams = void;

/** 'IBookings' return type */
export interface IIBookingsResult {
  booking_status: string | null;
  created_at: Date | null;
  id: string;
  passenger_id: string | null;
  ride_id: string | null;
  seat_count: number | null;
}

/** 'IBookings' query type */
export interface IIBookingsQuery {
  params: IIBookingsParams;
  result: IIBookingsResult;
}

const iBookingsIR: any = {"usedParamSet":{},"params":[],"statement":"SELECT \n    id,\n    ride_id,\n    passenger_id,\n    seat_count,\n    booking_status,\n    created_at\nFROM bookings\nLIMIT 1"};

/**
 * Query generated from SQL:
 * ```
 * SELECT 
 *     id,
 *     ride_id,
 *     passenger_id,
 *     seat_count,
 *     booking_status,
 *     created_at
 * FROM bookings
 * LIMIT 1
 * ```
 */
export const iBookings = new PreparedQuery<IIBookingsParams,IIBookingsResult>(iBookingsIR);


/** 'IBookingPassengers' parameters type */
export type IIBookingPassengersParams = void;

/** 'IBookingPassengers' return type */
export interface IIBookingPassengersResult {
  booking_id: string | null;
  id: string;
  passenger_contact: string | null;
  passenger_name: string | null;
}

/** 'IBookingPassengers' query type */
export interface IIBookingPassengersQuery {
  params: IIBookingPassengersParams;
  result: IIBookingPassengersResult;
}

const iBookingPassengersIR: any = {"usedParamSet":{},"params":[],"statement":"SELECT\n    id,\n    booking_id,\n    passenger_name,\n    passenger_contact\nFROM booking_passengers\nLIMIT 1"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *     id,
 *     booking_id,
 *     passenger_name,
 *     passenger_contact
 * FROM booking_passengers
 * LIMIT 1
 * ```
 */
export const iBookingPassengers = new PreparedQuery<IIBookingPassengersParams,IIBookingPassengersResult>(iBookingPassengersIR);


