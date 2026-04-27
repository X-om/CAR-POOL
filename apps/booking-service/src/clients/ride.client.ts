import * as grpc from '@grpc/grpc-js';
import { createInternalAuthMetadata, ride } from '@repo/grpc';
import { randomUUID } from 'node:crypto';
import { INTERNAL_JWT_SECRET, RIDE_SERVICE_GRPC_ADDR } from '../env';

export function createRideServiceClient(): ride.RideServiceClient {
  return new ride.RideServiceClient(RIDE_SERVICE_GRPC_ADDR, grpc.credentials.createInsecure());
}

export async function reserveSeats(input: {
  rideId: string;
  seatCount: number;
  pickupStopOrder?: number;
  dropoffStopOrder?: number;
}): Promise<boolean> {
  const client = createRideServiceClient();
  return await new Promise<boolean>((resolve, reject) => {
    const md = createInternalAuthMetadata({
      internalJwtSecret: INTERNAL_JWT_SECRET,
      callerService: 'booking-service',
      requestId: randomUUID(),
    });
    client.reserveSeats(
      {
        rideId: input.rideId,
        seatCount: input.seatCount,
        pickupStopOrder: input.pickupStopOrder,
        dropoffStopOrder: input.dropoffStopOrder,
      },
      md,
      (err, res) => {
        if (err) return reject(err);
        resolve(Boolean(res?.success));
      },
    );
  });
}

export async function releaseSeats(input: {
  rideId: string;
  seatCount: number;
  pickupStopOrder?: number;
  dropoffStopOrder?: number;
}): Promise<boolean> {
  const client = createRideServiceClient();
  return await new Promise<boolean>((resolve, reject) => {
    const md = createInternalAuthMetadata({
      internalJwtSecret: INTERNAL_JWT_SECRET,
      callerService: 'booking-service',
      requestId: randomUUID(),
    });
    client.releaseSeats(
      {
        rideId: input.rideId,
        seatCount: input.seatCount,
        pickupStopOrder: input.pickupStopOrder,
        dropoffStopOrder: input.dropoffStopOrder,
      },
      md,
      (err, res) => {
        if (err) return reject(err);
        resolve(Boolean(res?.success));
      },
    );
  });
}
