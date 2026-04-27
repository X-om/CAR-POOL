import * as grpc from '@grpc/grpc-js';
import { vehicle } from '@repo/grpc';
import { VEHICLE_SERVICE_GRPC_PORT } from './env';
import { vehicleHandler } from './grpc/vehicle.handler';

const server = new grpc.Server();
server.addService(vehicle.VehicleServiceService, vehicleHandler);

server.bindAsync(
  `0.0.0.0:${VEHICLE_SERVICE_GRPC_PORT}`,
  grpc.ServerCredentials.createInsecure(),
  (err, port) => {
    if (err) return console.error('Server binding error:', err);
    // eslint-disable-next-line no-console
    console.log(`vehicle-service gRPC listening on :${port}`);
    server.start();
  },
);
