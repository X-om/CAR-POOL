import * as grpc from '@grpc/grpc-js';
import { ride } from '@repo/grpc';
import { RIDE_SERVICE_GRPC_ADDR } from '../env';

export function createRideServiceClient(): ride.RideServiceClient {
  return new ride.RideServiceClient(RIDE_SERVICE_GRPC_ADDR, grpc.credentials.createInsecure());
}
