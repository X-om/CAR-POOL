import type { handleUnaryCall } from '@grpc/grpc-js';
import { requireInternalAuth, trip } from '@repo/grpc';
import { INTERNAL_JWT_SECRET } from '../env';
import { tripService } from '../service/trip.service';

const unary = <Req, Res>(fn: (req: Req) => Promise<Res>): handleUnaryCall<Req, Res> => {
  return async (call, callback) => {
    try {
      requireInternalAuth(call.metadata, INTERNAL_JWT_SECRET);
      const res = await fn(call.request);
      callback(null, res);
    } catch (err) {
      callback(err as Error, null as unknown as Res);
    }
  };
};

export const tripHandler: trip.TripServiceServer = {
  startTrip: unary(tripService.startTrip),
  pickupPassenger: unary(tripService.pickupPassenger),
  completeTrip: unary(tripService.completeTrip),
  getTrip: unary(tripService.getTrip),
  listDriverTrips: unary(tripService.listDriverTrips),
  submitRating: unary(tripService.submitRating),
  getPassengerTrip: unary(tripService.getPassengerTrip),
};
