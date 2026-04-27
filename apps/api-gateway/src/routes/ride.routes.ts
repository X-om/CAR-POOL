import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireVerifiedUser } from '../middleware/verified.middleware';
import { createRideServiceClient } from '../clients/ride.client';
import { ride } from '@repo/grpc';
import { internalGrpcMetadata } from '../clients/internalMetadata';

function getAuthUserId(req: any): string {
  const u = req.user;
  if (u && typeof u === 'object' && 'sub' in u) return String((u as any).sub);
  throw new Error('UNAUTHORIZED');
}

const StopSchema = z.object({
  stopOrder: z.coerce.number().int(),
  cityName: z.string().min(1),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
});

function validateStopsAreAPath(stops: Array<z.infer<typeof StopSchema>>): void {
  if (stops.length < 2) throw new Error('RIDE_ROUTE_TOO_SHORT');
  const sorted = [...stops].sort((a, b) => a.stopOrder - b.stopOrder);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.stopOrder === sorted[i - 1]!.stopOrder) throw new Error('DUPLICATE_STOP_ORDER');
  }
}

const CreateRideSchema = z.object({
  vehicleId: z.string().min(1),
  sourceCity: z.string().min(1),
  destinationCity: z.string().min(1),
  departureTime: z.coerce.number().int().positive(),
  pricePerSeat: z.coerce.number().nonnegative(),
  stops: z.array(StopSchema).min(2),
  approvalMode: z
    .enum(['AUTO', 'MANUAL'])
    .optional(),
});

export const rideRouter: ExpressRouter = Router();
rideRouter.use(authMiddleware);

rideRouter.post('/', requireVerifiedUser, async (req, res, next) => {
  try {
    const body = CreateRideSchema.parse(req.body);
    validateStopsAreAPath(body.stops);
    const driverId = getAuthUserId(req);
    const client = createRideServiceClient();
    const md = internalGrpcMetadata(req);
    const approvalMode =
      body.approvalMode === 'MANUAL'
        ? ride.BookingApprovalMode.BOOKING_APPROVAL_MODE_MANUAL
        : ride.BookingApprovalMode.BOOKING_APPROVAL_MODE_AUTO;
    client.createRide(
      {
        driverId,
        vehicleId: body.vehicleId,
        sourceCity: body.sourceCity,
        destinationCity: body.destinationCity,
        departureTime: body.departureTime,
        pricePerSeat: body.pricePerSeat,
        stops: body.stops,
        approvalMode,
      },
      md,
      (err, response) => {
        if (err) return next(err);
        return res.json({ success: true, data: response, error: null });
      },
    );
  } catch (err) {
    next(err as Error);
  }
});

rideRouter.get('/:rideId/seats/availability', async (req, res, next) => {
  try {
    const Params = z.object({ rideId: z.string().min(1) });
    const { rideId } = Params.parse(req.params);
    const Query = z.object({
      requestedSeats: z.coerce.number().int().positive(),
      pickupStopOrder: z.coerce.number().int().optional(),
      dropoffStopOrder: z.coerce.number().int().optional(),
    });
    const q = Query.parse(req.query);
    const client = createRideServiceClient();
    client.checkSeatAvailability(
      {
        rideId,
        requestedSeats: q.requestedSeats,
        pickupStopOrder: q.pickupStopOrder,
        dropoffStopOrder: q.dropoffStopOrder,
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

rideRouter.post('/:rideId/seats/reserve', requireVerifiedUser, async (req, res, next) => {
  try {
    const Params = z.object({ rideId: z.string().min(1) });
    const { rideId } = Params.parse(req.params);
    const Body = z.object({
      seatCount: z.coerce.number().int().positive(),
      pickupStopOrder: z.coerce.number().int().optional(),
      dropoffStopOrder: z.coerce.number().int().optional(),
    });
    const body = Body.parse(req.body);
    const client = createRideServiceClient();
    client.reserveSeats(
      {
        rideId,
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

rideRouter.post('/:rideId/seats/release', requireVerifiedUser, async (req, res, next) => {
  try {
    const Params = z.object({ rideId: z.string().min(1) });
    const { rideId } = Params.parse(req.params);
    const Body = z.object({
      seatCount: z.coerce.number().int().positive(),
      pickupStopOrder: z.coerce.number().int().optional(),
      dropoffStopOrder: z.coerce.number().int().optional(),
    });
    const body = Body.parse(req.body);
    const client = createRideServiceClient();
    client.releaseSeats(
      {
        rideId,
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

rideRouter.put('/:rideId', requireVerifiedUser, async (req, res, next) => {
  try {
    const Params = z.object({ rideId: z.string().min(1) });
    const { rideId } = Params.parse(req.params);
    const body = CreateRideSchema.parse(req.body);
    validateStopsAreAPath(body.stops);
    const driverId = getAuthUserId(req);
    const client = createRideServiceClient();
    const md = internalGrpcMetadata(req);
    const approvalMode =
      body.approvalMode === 'MANUAL'
        ? ride.BookingApprovalMode.BOOKING_APPROVAL_MODE_MANUAL
        : ride.BookingApprovalMode.BOOKING_APPROVAL_MODE_AUTO;
    client.updateRide(
      {
        rideId,
        driverId,
        vehicleId: body.vehicleId,
        sourceCity: body.sourceCity,
        destinationCity: body.destinationCity,
        departureTime: body.departureTime,
        pricePerSeat: body.pricePerSeat,
        stops: body.stops,
        approvalMode,
      },
      md,
      (err, response) => {
        if (err) return next(err);
        return res.json({ success: true, data: response, error: null });
      },
    );
  } catch (err) {
    next(err as Error);
  }
});

rideRouter.post('/:rideId/cancel', async (req, res, next) => {
  try {
    const Params = z.object({ rideId: z.string().min(1) });
    const { rideId } = Params.parse(req.params);
    const driverId = getAuthUserId(req);
    const client = createRideServiceClient();
    client.cancelRide({ rideId, driverId }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

rideRouter.get('/:rideId', async (req, res, next) => {
  try {
    const Params = z.object({ rideId: z.string().min(1) });
    const { rideId } = Params.parse(req.params);
    const client = createRideServiceClient();
    client.getRide({ rideId }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

rideRouter.get('/', async (req, res, next) => {
  try {
    const driverId = getAuthUserId(req);
    const client = createRideServiceClient();
    client.listDriverRides({ driverId }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});
