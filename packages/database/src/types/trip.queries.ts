/** Types generated for queries found in "src/schema/trip.sql" */
import { PreparedQuery } from '@pgtyped/runtime';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** 'ITrip' parameters type */
export type IITripParams = void;

/** 'ITrip' return type */
export interface IITripResult {
  created_at: Date | null;
  driver_id: string | null;
  end_time: Date | null;
  id: string;
  ride_id: string | null;
  start_time: Date | null;
  trip_status: string | null;
}

/** 'ITrip' query type */
export interface IITripQuery {
  params: IITripParams;
  result: IITripResult;
}

const iTripIR: any = {"usedParamSet":{},"params":[],"statement":"SELECT\n  id,\n  ride_id,\n  driver_id,\n  trip_status,\n  start_time,\n  end_time,\n  created_at\nFROM trips\nLIMIT 1"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   ride_id,
 *   driver_id,
 *   trip_status,
 *   start_time,
 *   end_time,
 *   created_at
 * FROM trips
 * LIMIT 1
 * ```
 */
export const iTrip = new PreparedQuery<IITripParams,IITripResult>(iTripIR);


/** 'ITripPassenger' parameters type */
export type IITripPassengerParams = void;

/** 'ITripPassenger' return type */
export interface IITripPassengerResult {
  booking_id: string | null;
  id: string;
  passenger_id: string | null;
  pickup_status: string | null;
  trip_id: string | null;
}

/** 'ITripPassenger' query type */
export interface IITripPassengerQuery {
  params: IITripPassengerParams;
  result: IITripPassengerResult;
}

const iTripPassengerIR: any = {"usedParamSet":{},"params":[],"statement":"SELECT\n  id,\n  trip_id,\n  booking_id,\n  passenger_id,\n  pickup_status\nFROM trip_passengers\nLIMIT 1"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   trip_id,
 *   booking_id,
 *   passenger_id,
 *   pickup_status
 * FROM trip_passengers
 * LIMIT 1
 * ```
 */
export const iTripPassenger = new PreparedQuery<IITripPassengerParams,IITripPassengerResult>(iTripPassengerIR);


/** 'ITripEvent' parameters type */
export type IITripEventParams = void;

/** 'ITripEvent' return type */
export interface IITripEventResult {
  event_timestamp: Date | null;
  event_type: string | null;
  id: string;
  metadata: Json | null;
  trip_id: string | null;
}

/** 'ITripEvent' query type */
export interface IITripEventQuery {
  params: IITripEventParams;
  result: IITripEventResult;
}

const iTripEventIR: any = {"usedParamSet":{},"params":[],"statement":"SELECT\n  id,\n  trip_id,\n  event_type,\n  event_timestamp,\n  metadata\nFROM trip_events\nLIMIT 1"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   trip_id,
 *   event_type,
 *   event_timestamp,
 *   metadata
 * FROM trip_events
 * LIMIT 1
 * ```
 */
export const iTripEvent = new PreparedQuery<IITripEventParams,IITripEventResult>(iTripEventIR);


