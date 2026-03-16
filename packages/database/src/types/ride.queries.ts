/** Types generated for queries found in "src/schema/ride.sql" */
import { PreparedQuery } from '@pgtyped/runtime';

/** 'IRide' parameters type */
export type IIRideParams = void;

/** 'IRide' return type */
export interface IIRideResult {
  available_seats: number | null;
  created_at: Date | null;
  departure_time: Date | null;
  destination_city: string | null;
  destination_lat: number | null;
  destination_lng: number | null;
  driver_id: string | null;
  estimated_arrival_time: Date | null;
  id: string;
  price_per_seat: number | null;
  ride_status: string | null;
  source_city: string | null;
  source_lat: number | null;
  source_lng: number | null;
  total_seats: number | null;
  vehicle_id: string | null;
}

/** 'IRide' query type */
export interface IIRideQuery {
  params: IIRideParams;
  result: IIRideResult;
}

const iRideIR: any = {"usedParamSet":{},"params":[],"statement":"SELECT \n    id,\n    driver_id,\n    vehicle_id,\n\n    source_city,\n    destination_city,\n\n    source_lat,\n    source_lng,\n\n    destination_lat,\n    destination_lng,\n\n    departure_time,\n    estimated_arrival_time,\n\n    price_per_seat,\n\n    total_seats,\n    available_seats,\n\n    ride_status,\n    created_at\nFROM rides\nLIMIT 1"};

/**
 * Query generated from SQL:
 * ```
 * SELECT 
 *     id,
 *     driver_id,
 *     vehicle_id,
 * 
 *     source_city,
 *     destination_city,
 * 
 *     source_lat,
 *     source_lng,
 * 
 *     destination_lat,
 *     destination_lng,
 * 
 *     departure_time,
 *     estimated_arrival_time,
 * 
 *     price_per_seat,
 * 
 *     total_seats,
 *     available_seats,
 * 
 *     ride_status,
 *     created_at
 * FROM rides
 * LIMIT 1
 * ```
 */
export const iRide = new PreparedQuery<IIRideParams,IIRideResult>(iRideIR);


/** 'IRideStop' parameters type */
export type IIRideStopParams = void;

/** 'IRideStop' return type */
export interface IIRideStopResult {
  city_name: string | null;
  id: string;
  latitude: number | null;
  longitude: number | null;
  ride_id: string | null;
  stop_order: number | null;
}

/** 'IRideStop' query type */
export interface IIRideStopQuery {
  params: IIRideStopParams;
  result: IIRideStopResult;
}

const iRideStopIR: any = {"usedParamSet":{},"params":[],"statement":"SELECT\n    id,\n    ride_id,\n    stop_order,\n    city_name,\n    latitude,\n    longitude\nFROM ride_stops\nLIMIT 1"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *     id,
 *     ride_id,
 *     stop_order,
 *     city_name,
 *     latitude,
 *     longitude
 * FROM ride_stops
 * LIMIT 1
 * ```
 */
export const iRideStop = new PreparedQuery<IIRideStopParams,IIRideStopResult>(iRideStopIR);


