import { apiGet, apiPost } from "@/lib/api/apiClient";
import type { Booking } from "@/types/api";

export async function listBookings() {
  return apiGet<{ bookings: Booking[] }>("/bookings", { auth: true });
}

export async function listDriverBookings() {
  return apiGet<{ bookings: Booking[] }>("/bookings/driver", { auth: true });
}

export async function listRideBookings(rideId: string) {
  return apiGet<{ bookings: Booking[] }>(`/bookings/ride/${rideId}`, { auth: true });
}

export async function createBooking(payload: {
  rideId: string;
  seatCount: number;
  pickupStopOrder?: number;
  dropoffStopOrder?: number;
}) {
  return apiPost<{ bookingId: string; status: number }>("/bookings", payload, {
    auth: true,
  });
}

export async function cancelBooking(bookingId: string) {
  return apiPost<{ success: true }>(`/bookings/${bookingId}/cancel`, undefined, {
    auth: true,
  });
}

export async function approveBooking(bookingId: string) {
  return apiPost<{ status: number }>(`/bookings/${bookingId}/approve`, undefined, {
    auth: true,
  });
}

export async function rejectBooking(bookingId: string) {
  return apiPost<{ status: number }>(`/bookings/${bookingId}/reject`, undefined, {
    auth: true,
  });
}
