import * as grpc from '@grpc/grpc-js';
import { vehicle } from '@repo/grpc';
import { VEHICLE_SERVICE_GRPC_ADDR } from '../env';

export function createVehicleServiceClient(): vehicle.VehicleServiceClient {
  return new vehicle.VehicleServiceClient(VEHICLE_SERVICE_GRPC_ADDR, grpc.credentials.createInsecure());
}
