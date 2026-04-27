import * as grpc from '@grpc/grpc-js';
import { notification } from '@repo/grpc';
import { NOTIFICATION_SERVICE_GRPC_PORT } from './env';
import { notificationHandler } from './grpc/notification.handler';

const server = new grpc.Server();
server.addService(notification.NotificationServiceService, notificationHandler);

server.bindAsync(
  `0.0.0.0:${NOTIFICATION_SERVICE_GRPC_PORT}`,
  grpc.ServerCredentials.createInsecure(),
  (err, port) => {
    if (err) return console.error('Server binding error:', err);
    // eslint-disable-next-line no-console
    console.log(`notification-service gRPC listening on :${port}`);
    server.start();
  },
);
