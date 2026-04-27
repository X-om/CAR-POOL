import * as grpc from '@grpc/grpc-js';
import { notification } from '@repo/grpc';
import { NOTIFICATION_SERVICE_GRPC_ADDR } from '../env';

export function createNotificationServiceClient(): notification.NotificationServiceClient {
  return new notification.NotificationServiceClient(NOTIFICATION_SERVICE_GRPC_ADDR, grpc.credentials.createInsecure());
}
