import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { createUserServiceClient } from '../clients/user.client';
import { internalGrpcMetadata } from '../clients/internalMetadata';

export const userRouter: ExpressRouter = Router();
userRouter.use(authMiddleware);

userRouter.get('/:userId', async (req, res, next) => {
  try {
    const Params = z.object({ userId: z.string().min(1) });
    const { userId } = Params.parse(req.params);
    const client = createUserServiceClient();
    client.getUser({ userId }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

userRouter.get('/:userId/profile', async (req, res, next) => {
  try {
    const Params = z.object({ userId: z.string().min(1) });
    const { userId } = Params.parse(req.params);
    const client = createUserServiceClient();
    client.getUserProfile({ userId }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

userRouter.put('/:userId/profile', async (req, res, next) => {
  try {
    const Params = z.object({ userId: z.string().min(1) });
    const { userId } = Params.parse(req.params);

    const Body = z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      profilePictureUrl: z.string().optional().default(''),
      bio: z.string().optional().default(''),
      city: z.string().optional().default(''),
    });
    const body = Body.parse(req.body);

    const client = createUserServiceClient();
    client.updateUserProfile({ userId, ...body }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

userRouter.get('/:userId/rating', async (req, res, next) => {
  try {
    const Params = z.object({ userId: z.string().min(1) });
    const { userId } = Params.parse(req.params);
    const client = createUserServiceClient();
    client.getUserRating({ userId }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

userRouter.post('/:userId/ride-count/increment', async (req, res, next) => {
  try {
    const Params = z.object({ userId: z.string().min(1) });
    const { userId } = Params.parse(req.params);
    const client = createUserServiceClient();
    client.incrementUserRideCount({ userId }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

userRouter.post('/:userId/rating', async (req, res, next) => {
  try {
    const Params = z.object({ userId: z.string().min(1) });
    const { userId } = Params.parse(req.params);

    const Body = z.object({
      newRating: z.coerce.number(),
    });
    const body = Body.parse(req.body);

    const client = createUserServiceClient();
    client.updateUserRating({ userId, newRating: body.newRating }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});
