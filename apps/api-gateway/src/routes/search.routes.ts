import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { createSearchServiceClient } from '../clients/search.client';
import { internalGrpcMetadata } from '../clients/internalMetadata';

export const searchRouter: ExpressRouter = Router();

searchRouter.get('/rides', async (req, res, next) => {
  try {
    const Query = z.object({
      sourceLat: z.coerce.number(),
      sourceLng: z.coerce.number(),
      destLat: z.coerce.number(),
      destLng: z.coerce.number(),
      // Optional: when omitted (or 0), backend will search across all departure times.
      departureTime: z.coerce.number().int().nonnegative().optional(),
      requiredSeats: z.coerce.number().int().positive(),
    });
    const q = Query.parse(req.query);
    const client = createSearchServiceClient();
    const md = internalGrpcMetadata(req);
    client.searchRides(
      {
        sourceLatitude: q.sourceLat,
        sourceLongitude: q.sourceLng,
        destinationLatitude: q.destLat,
        destinationLongitude: q.destLng,
        departureTime: q.departureTime ?? 0,
        requiredSeats: q.requiredSeats,
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

searchRouter.get('/rides/:rideId', async (req, res, next) => {
  try {
    const Params = z.object({ rideId: z.string().min(1) });
    const { rideId } = Params.parse(req.params);
    const client = createSearchServiceClient();
    client.getRideSearchData({ rideId }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});
