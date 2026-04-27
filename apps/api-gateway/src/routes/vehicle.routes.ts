import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireVerifiedUser } from '../middleware/verified.middleware';
import { createVehicleServiceClient } from '../clients/vehicle.client';
import { internalGrpcMetadata } from '../clients/internalMetadata';

function getAuthUserId(req: any): string {
  const u = req.user;
  if (u && typeof u === 'object' && 'sub' in u) return String((u as any).sub);
  throw new Error('UNAUTHORIZED');
}

const AddVehicleSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.coerce.number().int().min(1900).max(3000),
  color: z.string().min(1),
  licensePlate: z.string().min(1),
  seatCapacity: z.coerce.number().int().positive(),
});

const UpdateVehicleSchema = AddVehicleSchema;

export const vehicleRouter: ExpressRouter = Router();

vehicleRouter.use(authMiddleware);

vehicleRouter.post('/', requireVerifiedUser, async (req, res, next) => {
  try {
    const body = AddVehicleSchema.parse(req.body);
    const ownerId = getAuthUserId(req);
    const client = createVehicleServiceClient();
    client.addVehicle({ ownerId, ...body }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

vehicleRouter.get('/', async (req, res, next) => {
  try {
    const ownerId = getAuthUserId(req);
    const client = createVehicleServiceClient();
    client.listUserVehicles({ ownerId }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

vehicleRouter.get('/:vehicleId/verify-ownership', async (req, res, next) => {
  try {
    const Params = z.object({ vehicleId: z.string().min(1) });
    const { vehicleId } = Params.parse(req.params);
    const ownerId = getAuthUserId(req);
    const client = createVehicleServiceClient();
    client.verifyVehicleOwnership({ vehicleId, ownerId }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

vehicleRouter.get('/:vehicleId', async (req, res, next) => {
  try {
    const Params = z.object({ vehicleId: z.string().min(1) });
    const { vehicleId } = Params.parse(req.params);
    const client = createVehicleServiceClient();
    client.getVehicle({ vehicleId }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

vehicleRouter.put('/:vehicleId', requireVerifiedUser, async (req, res, next) => {
  try {
    const Params = z.object({ vehicleId: z.string().min(1) });
    const { vehicleId } = Params.parse(req.params);
    const body = UpdateVehicleSchema.parse(req.body);
    const ownerId = getAuthUserId(req);
    const client = createVehicleServiceClient();
    client.updateVehicle({ vehicleId, ownerId, ...body }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});

vehicleRouter.delete('/:vehicleId', requireVerifiedUser, async (req, res, next) => {
  try {
    const Params = z.object({ vehicleId: z.string().min(1) });
    const { vehicleId } = Params.parse(req.params);
    const ownerId = getAuthUserId(req);
    const client = createVehicleServiceClient();
    client.deleteVehicle({ vehicleId, ownerId }, internalGrpcMetadata(req), (err, response) => {
      if (err) return next(err);
      return res.json({ success: true, data: response, error: null });
    });
  } catch (err) {
    next(err as Error);
  }
});
