import { apiGet, apiPost, apiPut } from "@/lib/api/apiClient";
import type { Ride } from "@/types/api";

export async function listDriverRides() {
  return apiGet<{ rides: Ride[] }>("/rides", { auth: true });
}

export async function getDriverRide(rideId: string) {
  return apiGet<Ride>(`/rides/${rideId}`, { auth: true });
}

export async function createRide(payload: {
  vehicleId: string;
  sourceCity: string;
  destinationCity: string;
  departureTime: number;
  pricePerSeat: number;
  stops: Array<{ stopOrder: number; cityName: string; latitude: number; longitude: number }>;
  approvalMode?: "AUTO" | "MANUAL";
}) {
  return apiPost<{ rideId: string }>("/rides", payload, { auth: true });
}

export async function cancelRide(rideId: string) {
  return apiPost<{ success: true }>(`/rides/${rideId}/cancel`, undefined, { auth: true });
}

export async function updateRide(
  rideId: string,
  payload: {
    vehicleId: string;
    sourceCity: string;
    destinationCity: string;
    departureTime: number;
    pricePerSeat: number;
    stops: Array<{ stopOrder: number; cityName: string; latitude: number; longitude: number }>;
    approvalMode?: "AUTO" | "MANUAL";
  }
) {
  return apiPut<{ success: boolean }>(`/rides/${rideId}`, payload, { auth: true });
}

export async function checkSeatAvailability(
  rideId: string,
  params: {
    requestedSeats: number;
    pickupStopOrder?: number;
    dropoffStopOrder?: number;
  }
) {
  const qs = new URLSearchParams({
    requestedSeats: String(params.requestedSeats),
  });

  if (params.pickupStopOrder !== undefined) {
    qs.set("pickupStopOrder", String(params.pickupStopOrder));
  }
  if (params.dropoffStopOrder !== undefined) {
    qs.set("dropoffStopOrder", String(params.dropoffStopOrder));
  }

  return apiGet<{ availableSeats: number; isAvailable: boolean }>(
    `/rides/${rideId}/seats/availability?${qs.toString()}`,
    { auth: true }
  );
}
