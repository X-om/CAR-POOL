"use client";

import * as React from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { getAccessToken } from "@/lib/auth/tokenStore";
import { approveBooking, rejectBooking } from "@/features/bookings/api/bookingsApi";
import { queryKeys } from "@/lib/query/keys";
import { parseWsEvent } from "@/lib/ws/events";
import { connectWs } from "@/lib/ws/wsClient";

export function WsNotificationsBridge() {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const client = connectWs({
      token,
      onMessage: (raw) => {
        const event = parseWsEvent(raw);
        if (!event) return;

        const title = event.title || "Update";
        const message = event.message || "";

        // Always refresh notification inbox.
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications });

        const eventType = event.eventType || "";
        if (eventType.startsWith("booking.")) {
          queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
        }
        if (eventType.startsWith("ride.")) {
          const rideId = typeof event.aggregateId === "string" ? event.aggregateId : "";
          queryClient.invalidateQueries({ queryKey: queryKeys.rides });
          if (rideId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.ride(rideId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.searchRide(rideId) });
          }
          queryClient.invalidateQueries({
            predicate: (q) => q.queryKey[0] === "searchRides" || q.queryKey[0] === "searchRide",
          });
        }
        if (eventType.startsWith("trip.")) {
          const tripId = typeof event.aggregateId === "string" ? event.aggregateId : "";
          queryClient.invalidateQueries({ queryKey: queryKeys.trips });
          if (tripId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.trip(tripId) });
          }
          queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
        }

        if (eventType === "booking.requested") {
          const bookingIdRaw =
            (event.payload?.bookingId as unknown) ?? (event.aggregateId as unknown);
          const bookingId = typeof bookingIdRaw === "string" ? bookingIdRaw : "";

          if (bookingId) {
            toast(message ? `${title}: ${message}` : title, {
              action: {
                label: "Approve",
                onClick: async () => {
                  try {
                    await approveBooking(bookingId);
                    toast.success("Booking approved");
                    queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
                    queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
                  } catch (e) {
                    const errMsg =
                      e instanceof Error ? e.message : "Failed to approve booking";
                    toast.error(errMsg);
                  }
                },
              },
              cancel: {
                label: "Reject",
                onClick: async () => {
                  try {
                    await rejectBooking(bookingId);
                    toast.success("Booking rejected");
                    queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
                    queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
                  } catch (e) {
                    const errMsg =
                      e instanceof Error ? e.message : "Failed to reject booking";
                    toast.error(errMsg);
                  }
                },
              },
            });
            return;
          }
        }

        toast(message ? `${title}: ${message}` : title);
      },
    });

    return () => client.close();
  }, [queryClient]);

  return null;
}
