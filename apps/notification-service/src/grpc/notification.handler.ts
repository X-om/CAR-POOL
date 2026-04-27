import type { handleUnaryCall } from '@grpc/grpc-js';
import { notification, requireInternalAuth } from '@repo/grpc';
import { INTERNAL_JWT_SECRET } from '../env';
import { notificationService } from '../service/notification.service';

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

export const notificationHandler: notification.NotificationServiceServer = {
  getUserNotifications: unary(notificationService.getUserNotifications),
  markNotificationRead: unary(notificationService.markNotificationRead),
};
