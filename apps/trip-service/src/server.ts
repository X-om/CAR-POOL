import * as grpc from '@grpc/grpc-js';
import { trip } from '@repo/grpc';
import { TRIP_SERVICE_GRPC_PORT } from './env';
import { tripHandler } from './grpc/trip.handler';

const server = new grpc.Server();
server.addService(trip.TripServiceService, tripHandler);

server.bindAsync(
  `0.0.0.0:${TRIP_SERVICE_GRPC_PORT}`,
  grpc.ServerCredentials.createInsecure(),
  (err, port) => {
    if (err) return console.error('Server binding error:', err);
    // eslint-disable-next-line no-console
    console.log(`trip-service gRPC listening on :${port}`);
    server.start();
  },
);
