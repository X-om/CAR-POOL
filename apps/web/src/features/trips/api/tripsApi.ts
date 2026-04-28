import { apiGet, apiPost } from "@/lib/api/apiClient";
import type { Trip } from "@/types/api";

export async function listDriverTrips() {
  return apiGet<{ trips: Trip[] }>("/trips", { auth: true });
}

export async function getTrip(tripId: string) {
  return apiGet<Trip>(`/trips/${tripId}`, { auth: true });
}

export async function startTrip(payload: { rideId: string }) {
  return apiPost<{ tripId: string; status: number }>("/trips/start", payload, {
    auth: true,
  });
}

export async function pickupPassenger(payload: { tripId: string; passengerId: string }) {
  return apiPost<{ success: boolean }>(
    `/trips/${payload.tripId}/pickup`,
    { passengerId: payload.passengerId },
    { auth: true }
  );
}

export async function completeTrip(tripId: string) {
  return apiPost<{ success: boolean }>(`/trips/${tripId}/complete`, undefined, {
    auth: true,
  });
}

export async function submitTripRating(tripId: string, rating: number) {
  return apiPost<{ success: boolean }>(`/trips/${tripId}/rate`, { rating }, { auth: true });
}

export async function getPassengerTripForRide(rideId: string, passengerId: string) {
  return apiGet<{ tripId: string; status: number; hasRated: boolean }>(`/trips/ride/${rideId}/passenger/${passengerId}`, { auth: true });
}
