import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api/apiClient";
import type { Vehicle } from "@/types/api";

export async function listVehicles() {
  return apiGet<{ vehicles: Vehicle[] }>("/vehicles", { auth: true });
}

export async function createVehicle(payload: {
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  seatCapacity: number;
}) {
  return apiPost<{ vehicleId: string }>("/vehicles", payload, { auth: true });
}

export async function deleteVehicle(vehicleId: string) {
  return apiDelete<{ success: true }>(`/vehicles/${vehicleId}`, { auth: true });
}

export async function updateVehicle(
  vehicleId: string,
  payload: {
    make: string;
    model: string;
    year: number;
    color: string;
    licensePlate: string;
    seatCapacity: number;
  }
) {
  return apiPut<{ success: boolean }>(`/vehicles/${vehicleId}`, payload, { auth: true });
}
