import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireVerifiedUser } from '../middleware/verified.middleware';
import { createBookingServiceClient } from '../clients/booking.client';
import { internalGrpcMetadata } from '../clients/internalMetadata';

function getAuthUserId(req: any): string {
  const u = req.user;
  if (u && typeof u === 'object' && 'sub' in u) return String((u as any).sub);
  throw new Error('UNAUTHORIZED');
}

export const bookingRouter: ExpressRouter = Router();
bookingRouter.use(authMiddleware);

bookingRouter.post('/', requireVerifiedUser, async (req, res, next) => {
  try {
    const Body = z.object({
      rideId: z.string().min(1),
      seatCount: z.coerce.number().int().positive(),
      pickupStopOrder: z.coerce.number().int().optional(),
      dropoffStopOrder: z.coerce.number().int().optional(),
    });
    const body = Body.parse(req.body);
    const passengerId = getAuthUserId(req);
    const client = createBookingServiceClient();
    client.createBooking(
      {
        rideId: body.rideId,
        passengerId,
        seatCount: body.seatCount,
        pickupStopOrder: body.pickupStopOrder,
        dropoffStopOrder: body.dropoffStopOrder,
      },
      internalGrpcMetadata(req),
      (err, response) => {
        if (err) return next(err);
        return res.json({ success: true, data: response, error: null });
      },
    );
  } catch (err) {
    next(err as Error);
  }
});

bookingRouter.post('/:bookingId/cancel', async (req, res, next) => {
  try {
    const Params = z.object({ bookingId: z.string().min(1) });
    const { bookingId } = Params.parse(req.params);
    const passengerId = getAuthUserId(req);
    const client = createBookingServiceClient();
    client.cancelBooking({ bookingId, passengerId }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

bookingRouter.post('/:bookingId/approve', requireVerifiedUser, async (req, res, next) => {
  try {
    const Params = z.object({ bookingId: z.string().min(1) });
    const { bookingId } = Params.parse(req.params);
    const driverId = getAuthUserId(req);
    const client = createBookingServiceClient();
    client.approveBooking({ bookingId, driverId }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

bookingRouter.post('/:bookingId/reject', requireVerifiedUser, async (req, res, next) => {
  try {
    const Params = z.object({ bookingId: z.string().min(1) });
    const { bookingId } = Params.parse(req.params);
    const driverId = getAuthUserId(req);
    const client = createBookingServiceClient();
    client.rejectBooking({ bookingId, driverId }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

bookingRouter.get('/driver', async (req, res, next) => {
  try {
    const driverId = getAuthUserId(req);
    const client = createBookingServiceClient();
    client.listDriverBookings({ driverId }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

bookingRouter.get('/:bookingId', async (req, res, next) => {
  try {
    const Params = z.object({ bookingId: z.string().min(1) });
    const { bookingId } = Params.parse(req.params);
    const client = createBookingServiceClient();
    client.getBooking({ bookingId }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

bookingRouter.get('/', async (req, res, next) => {
  try {
    const passengerId = getAuthUserId(req);
    const client = createBookingServiceClient();
    client.listUserBookings({ passengerId }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});
