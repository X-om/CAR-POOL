import type { handleUnaryCall } from '@grpc/grpc-js';
import { booking, requireInternalAuth } from '@repo/grpc';
import { INTERNAL_JWT_SECRET } from '../env';
import { bookingService } from '../service/booking.service';

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

export const bookingHandler: booking.BookingServiceServer = {
  createBooking: unary(bookingService.createBooking),
  approveBooking: unary(bookingService.approveBooking),
  rejectBooking: unary(bookingService.rejectBooking),
  cancelBooking: unary(bookingService.cancelBooking),
  getBooking: unary(bookingService.getBooking),
  listUserBookings: unary(bookingService.listUserBookings),
  listDriverBookings: unary(bookingService.listDriverBookings),
};
