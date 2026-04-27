import * as grpc from '@grpc/grpc-js';
import { ride } from '@repo/grpc';
import { RIDE_SERVICE_GRPC_PORT } from './env';
import { rideHandler } from './grpc/ride.handler';

const server = new grpc.Server();
server.addService(ride.RideServiceService, rideHandler);

server.bindAsync(
  `0.0.0.0:${RIDE_SERVICE_GRPC_PORT}`,
  grpc.ServerCredentials.createInsecure(),
  (err, port) => {
    if (err) return console.error('Server binding error:', err);
    // eslint-disable-next-line no-console
    console.log(`ride-service gRPC listening on :${port}`);
    server.start();
  },
);
