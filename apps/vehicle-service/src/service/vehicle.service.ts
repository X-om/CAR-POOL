import { vehicle } from '@repo/grpc';
import { vehicleRepository } from '../db/vehicle.repository';

export const vehicleService = {
  async addVehicle(req: vehicle.AddVehicleRequest): Promise<vehicle.AddVehicleResponse> {
    const vehicleId = await vehicleRepository.createVehicle({
      ownerId: req.ownerId,
      make: req.make,
      model: req.model,
      year: req.year,
      color: req.color,
      licensePlate: req.licensePlate,
      seatCapacity: req.seatCapacity,
    });
    return { vehicleId };
  },

  async updateVehicle(req: vehicle.UpdateVehicleRequest): Promise<vehicle.UpdateVehicleResponse> {
    const success = await vehicleRepository.updateVehicle({
      vehicleId: req.vehicleId,
      ownerId: req.ownerId,
      make: req.make,
      model: req.model,
      year: req.year,
      color: req.color,
      licensePlate: req.licensePlate,
      seatCapacity: req.seatCapacity,
    });
    return { success };
  },

  async deleteVehicle(req: vehicle.DeleteVehicleRequest): Promise<vehicle.DeleteVehicleResponse> {
    const success = await vehicleRepository.deleteVehicle({ vehicleId: req.vehicleId, ownerId: req.ownerId });
    return { success };
  },

  async getVehicle(req: vehicle.GetVehicleRequest): Promise<vehicle.GetVehicleResponse> {
    const v = await vehicleRepository.getVehicle(req.vehicleId);
    return {
      vehicleId: v.id,
      ownerId: v.owner_id,
      make: v.make ?? '',
      model: v.model ?? '',
      year: v.year ?? 0,
      color: v.color ?? '',
      licensePlate: v.license_plate ?? '',
      seatCapacity: v.seat_capacity ?? 0,
    };
  },

  async listUserVehicles(req: vehicle.ListUserVehiclesRequest): Promise<vehicle.ListUserVehiclesResponse> {
    const rows = await vehicleRepository.listVehiclesByOwner(req.ownerId);
    return {
      vehicles: rows.map((v) => ({
        vehicleId: v.id,
        ownerId: v.owner_id,
        make: v.make ?? '',
        model: v.model ?? '',
        year: v.year ?? 0,
        color: v.color ?? '',
        licensePlate: v.license_plate ?? '',
        seatCapacity: v.seat_capacity ?? 0,
      })),
    };
  },

  async verifyVehicleOwnership(
    req: vehicle.VerifyVehicleOwnershipRequest,
  ): Promise<vehicle.VerifyVehicleOwnershipResponse> {
    const v = await vehicleRepository.getVehicleOptional(req.vehicleId);
    if (!v) return { isOwner: false, seatCapacity: 0 };
    return { isOwner: v.owner_id === req.ownerId, seatCapacity: v.seat_capacity ?? 0 };
  },
};
