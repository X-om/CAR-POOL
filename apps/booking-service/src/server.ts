import * as grpc from '@grpc/grpc-js';
import { booking } from '@repo/grpc';
import { BOOKING_SERVICE_GRPC_PORT } from './env';
import { bookingHandler } from './grpc/booking.handler';

const server = new grpc.Server();
server.addService(booking.BookingServiceService, bookingHandler);

server.bindAsync(
  `0.0.0.0:${BOOKING_SERVICE_GRPC_PORT}`,
  grpc.ServerCredentials.createInsecure(),
  (err, port) => {
    if (err) return console.error('Server binding error:', err);
    // eslint-disable-next-line no-console
    console.log(`booking-service gRPC listening on :${port}`);
    server.start();
  },
);
