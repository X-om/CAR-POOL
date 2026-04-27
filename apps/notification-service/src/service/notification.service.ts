import { notification } from '@repo/grpc';
import { notificationRepository } from '../db/notification.repository';

export const notificationService = {
  async getUserNotifications(
    req: notification.GetUserNotificationsRequest,
  ): Promise<notification.GetUserNotificationsResponse> {
    const rows = await notificationRepository.listUserNotifications(req.userId);
    return {
      notifications: rows.map((n) => {
        const meta = n.metadata && typeof n.metadata === 'object' ? (n.metadata as any) : null;

        const payloadJson = (() => {
          if (!meta || !("payload" in meta)) return '';
          try {
            return JSON.stringify((meta as any).payload ?? null);
          } catch {
            return '';
          }
        })();

        return {
          notificationId: n.id,
          userId: n.user_id,
          message: n.message,
          timestamp: n.created_at.getTime(),
          isRead: n.is_read,

          type: n.notification_type ?? '',
          title: n.title ?? '',
          topic: typeof meta?.topic === 'string' ? meta.topic : '',
          eventType: typeof meta?.eventType === 'string' ? meta.eventType : '',
          aggregateId: typeof meta?.aggregateId === 'string' ? meta.aggregateId : '',
          occurredAt: typeof meta?.occurredAt === 'string' ? meta.occurredAt : '',
          payloadJson,
        };
      }),
    };
  },

  async markNotificationRead(
    req: notification.MarkNotificationReadRequest,
  ): Promise<notification.MarkNotificationReadResponse> {
    const success = await notificationRepository.markRead({
      notificationId: req.notificationId,
      userId: req.userId,
    });
    return { success };
  },
};
