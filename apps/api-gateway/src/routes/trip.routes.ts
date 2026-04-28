import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireVerifiedUser } from '../middleware/verified.middleware';
import { createTripServiceClient } from '../clients/trip.client';
import { internalGrpcMetadata } from '../clients/internalMetadata';

function getAuthUserId(req: any): string {
  const u = req.user;
  if (u && typeof u === 'object' && 'sub' in u) return String((u as any).sub);
  throw new Error('UNAUTHORIZED');
}

export const tripRouter: ExpressRouter = Router();
tripRouter.use(authMiddleware);

tripRouter.post('/start', requireVerifiedUser, async (req, res, next) => {
  try {
    const Body = z.object({ rideId: z.string().min(1) });
    const body = Body.parse(req.body);
    const driverId = getAuthUserId(req);
    const client = createTripServiceClient();
    client.startTrip({ rideId: body.rideId, driverId }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

tripRouter.post('/:tripId/pickup', requireVerifiedUser, async (req, res, next) => {
  try {
    const Params = z.object({ tripId: z.string().min(1) });
    const { tripId } = Params.parse(req.params);
    const Body = z.object({ passengerId: z.string().min(1) });
    const body = Body.parse(req.body);
    const client = createTripServiceClient();
    client.pickupPassenger({ tripId, passengerId: body.passengerId }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

tripRouter.post('/:tripId/complete', requireVerifiedUser, async (req, res, next) => {
  try {
    const Params = z.object({ tripId: z.string().min(1) });
    const { tripId } = Params.parse(req.params);
    const driverId = getAuthUserId(req);
    const client = createTripServiceClient();
    client.completeTrip({ tripId, driverId }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

tripRouter.post('/:tripId/rate', requireVerifiedUser, async (req, res, next) => {
  try {
    const Params = z.object({ tripId: z.string().min(1) });
    const { tripId } = Params.parse(req.params);
    const Body = z.object({ rating: z.coerce.number().int().min(1).max(5) });
    const body = Body.parse(req.body);
    const client = createTripServiceClient();
    // determine passengerId from auth
    const u = (req.user as any) || {};
    const passengerId = String(u.sub ?? '');
    (client as any).submitRating({ tripId, passengerId, rating: body.rating }, internalGrpcMetadata(req), (err: any, response: any) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

tripRouter.get('/ride/:rideId/passenger/:passengerId', requireVerifiedUser, async (req, res, next) => {
  try {
    const Params = z.object({ rideId: z.string().min(1), passengerId: z.string().min(1) });
    const { rideId, passengerId } = Params.parse(req.params);
    const client = createTripServiceClient();
    (client as any).getPassengerTrip({ rideId, passengerId }, internalGrpcMetadata(req), (err: any, response: any) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

tripRouter.get('/:tripId', async (req, res, next) => {
  try {
    const Params = z.object({ tripId: z.string().min(1) });
    const { tripId } = Params.parse(req.params);
    const client = createTripServiceClient();
    client.getTrip({ tripId }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

tripRouter.get('/', async (req, res, next) => {
  try {
    const driverId = getAuthUserId(req);
    const client = createTripServiceClient();
    client.listDriverTrips({ driverId }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});
