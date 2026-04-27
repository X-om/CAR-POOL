import type { handleUnaryCall } from '@grpc/grpc-js';
import { requireInternalAuth, vehicle } from '@repo/grpc';
import { INTERNAL_JWT_SECRET } from '../env';
import { vehicleService } from '../service/vehicle.service';

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

export const vehicleHandler: vehicle.VehicleServiceServer = {
  addVehicle: unary(vehicleService.addVehicle),
  updateVehicle: unary(vehicleService.updateVehicle),
  deleteVehicle: unary(vehicleService.deleteVehicle),
  getVehicle: unary(vehicleService.getVehicle),
  listUserVehicles: unary(vehicleService.listUserVehicles),
  verifyVehicleOwnership: unary(vehicleService.verifyVehicleOwnership),
};
