import { apiGet } from "@/lib/api/apiClient";
import type { RideSearchDetail, RideSearchResult } from "@/types/api";

export type SearchRidesParams = {
  sourceLat: number;
  sourceLng: number;
  destLat: number;
  destLng: number;
  departureTime?: number;
  requiredSeats: number;
};

export async function searchRides(params: SearchRidesParams) {
  const qs = new URLSearchParams({
    sourceLat: String(params.sourceLat),
    sourceLng: String(params.sourceLng),
    destLat: String(params.destLat),
    destLng: String(params.destLng),
    requiredSeats: String(params.requiredSeats),
  });

  if (params.departureTime != null && Number.isFinite(params.departureTime) && params.departureTime > 0) {
    qs.set("departureTime", String(params.departureTime));
  }

  return apiGet<{ rides: RideSearchResult[] }>(`/search/rides?${qs.toString()}`);
}

export async function getSearchRide(rideId: string) {
  return apiGet<RideSearchDetail>(`/search/rides/${rideId}`);
}
