import * as grpc from '@grpc/grpc-js';
import { user } from '@repo/grpc';
import { userHandler } from './grpc/user.handler';
import { USER_SERVICE_GRPC_PORT } from './env';

const server = new grpc.Server();
server.addService(user.UserServiceService, userHandler);

server.bindAsync(`0.0.0.0:${USER_SERVICE_GRPC_PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err)
    return console.error('Server binding error:', err);

  else {
    console.log(`Server is running on port ${port}`);
    server.start();
  }
});