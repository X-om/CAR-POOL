import * as grpc from '@grpc/grpc-js';
import { trip } from '@repo/grpc';
import { TRIP_SERVICE_GRPC_ADDR } from '../env';

export function createTripServiceClient(): trip.TripServiceClient {
  return new trip.TripServiceClient(TRIP_SERVICE_GRPC_ADDR, grpc.credentials.createInsecure());
}
