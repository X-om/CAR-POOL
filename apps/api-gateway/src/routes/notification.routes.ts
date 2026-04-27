import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { createNotificationServiceClient } from '../clients/notification.client';
import { internalGrpcMetadata } from '../clients/internalMetadata';

function getAuthUserId(req: any): string {
  const u = req.user;
  if (u && typeof u === 'object' && 'sub' in u) return String((u as any).sub);
  throw new Error('UNAUTHORIZED');
}

export const notificationRouter: ExpressRouter = Router();
notificationRouter.use(authMiddleware);

notificationRouter.get('/', async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const client = createNotificationServiceClient();
    client.getUserNotifications({ userId }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

notificationRouter.post('/:notificationId/read', async (req, res, next) => {
  try {
    const Params = z.object({ notificationId: z.string().min(1) });
    const { notificationId } = Params.parse(req.params);
    const userId = getAuthUserId(req);
    const client = createNotificationServiceClient();
    client.markNotificationRead({ notificationId, userId }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});
