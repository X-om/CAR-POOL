/** Types generated for queries found in "src/schema/vehicle.sql" */
import { PreparedQuery } from '@pgtyped/runtime';

/** 'IVehicle' parameters type */
export type IIVehicleParams = void;

/** 'IVehicle' return type */
export interface IIVehicleResult {
  color: string | null;
  created_at: Date | null;
  id: string;
  license_plate: string | null;
  make: string | null;
  model: string | null;
  owner_id: string | null;
  seat_capacity: number | null;
  year: number | null;
}

/** 'IVehicle' query type */
export interface IIVehicleQuery {
  params: IIVehicleParams;
  result: IIVehicleResult;
}

const iVehicleIR: any = {"usedParamSet":{},"params":[],"statement":"SELECT\n  id,\n  owner_id,\n  make,\n  model,\n  year,\n  color,\n  license_plate,\n  seat_capacity,\n  created_at\nFROM vehicles\nLIMIT 1"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   owner_id,
 *   make,
 *   model,
 *   year,
 *   color,
 *   license_plate,
 *   seat_capacity,
 *   created_at
 * FROM vehicles
 * LIMIT 1
 * ```
 */
export const iVehicle = new PreparedQuery<IIVehicleParams,IIVehicleResult>(iVehicleIR);


/** 'IVehicleDocument' parameters type */
export type IIVehicleDocumentParams = void;

/** 'IVehicleDocument' return type */
export interface IIVehicleDocumentResult {
  document_type: string | null;
  document_url: string | null;
  id: string;
  uploaded_at: Date | null;
  vehicle_id: string | null;
  verification_status: string | null;
}

/** 'IVehicleDocument' query type */
export interface IIVehicleDocumentQuery {
  params: IIVehicleDocumentParams;
  result: IIVehicleDocumentResult;
}

const iVehicleDocumentIR: any = {"usedParamSet":{},"params":[],"statement":"SELECT\n  id,\n  vehicle_id,\n  document_type,\n  document_url,\n  verification_status,\n  uploaded_at \nFROM vehicle_documents\nLIMIT 1"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   vehicle_id,
 *   document_type,
 *   document_url,
 *   verification_status,
 *   uploaded_at 
 * FROM vehicle_documents
 * LIMIT 1
 * ```
 */
export const iVehicleDocument = new PreparedQuery<IIVehicleDocumentParams,IIVehicleDocumentResult>(iVehicleDocumentIR);


