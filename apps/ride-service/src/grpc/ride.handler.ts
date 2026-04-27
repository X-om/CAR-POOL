import type { handleUnaryCall } from '@grpc/grpc-js';
import { requireInternalAuth, ride } from '@repo/grpc';
import { INTERNAL_JWT_SECRET } from '../env';
import { rideService } from '../service/ride.service';

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

export const rideHandler: ride.RideServiceServer = {
  createRide: unary(rideService.createRide),
  updateRide: unary(rideService.updateRide),
  cancelRide: unary(rideService.cancelRide),
  getRide: unary(rideService.getRide),
  listDriverRides: unary(rideService.listDriverRides),
  checkSeatAvailability: unary(rideService.checkSeatAvailability),
  reserveSeats: unary(rideService.reserveSeats),
  releaseSeats: unary(rideService.releaseSeats),
};
