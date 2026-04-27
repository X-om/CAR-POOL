import * as grpc from '@grpc/grpc-js';
import { booking } from '@repo/grpc';
import { BOOKING_SERVICE_GRPC_ADDR } from '../env';

export function createBookingServiceClient(): booking.BookingServiceClient {
  return new booking.BookingServiceClient(BOOKING_SERVICE_GRPC_ADDR, grpc.credentials.createInsecure());
}
