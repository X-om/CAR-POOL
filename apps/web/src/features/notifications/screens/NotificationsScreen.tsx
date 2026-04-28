"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  listNotifications,
  markNotificationRead,
} from "@/features/notifications/api/notificationsApi";
import { approveBooking, rejectBooking } from "@/features/bookings/api/bookingsApi";
import { listDriverRides } from "@/features/rides/api/ridesApi";
import { formatDateTime } from "@/lib/format/date";
import { queryKeys } from "@/lib/query/keys";

type BookingRequestedPayload = {
  bookingId: string;
  rideId: string;
  passengerId: string;
  driverId: string;
  seatCount: number;
};

function parseJson<T>(value: string | undefined | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function NotificationsScreen() {
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: listNotifications,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      toast.success("Marked as read");
    },
  });

  const approveMutation = useMutation({
    mutationFn: (bookingId: string) => approveBooking(bookingId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["driverBookings"] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      toast.success("Booking approved");
    },
    onError: (e) => {
      const message = e instanceof Error ? e.message : "Failed to approve booking";
      toast.error(message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (bookingId: string) => rejectBooking(bookingId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["driverBookings"] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      toast.success("Booking rejected");
    },
    onError: (e) => {
      const message = e instanceof Error ? e.message : "Failed to reject booking";
      toast.error(message);
    },
  });

  const items = notificationsQuery.data?.notifications ?? [];

  const bookingRequestedByNotificationId = React.useMemo(() => {
    const m = new Map<string, BookingRequestedPayload>();
    for (const n of items) {
      if (n.eventType !== "booking.requested") continue;
      const payload = parseJson<BookingRequestedPayload>(n.payloadJson);
      if (!payload?.bookingId || !payload?.rideId) continue;
      m.set(n.notificationId, payload);
    }
    return m;
  }, [items]);

  const bookingRequestedRideIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const p of bookingRequestedByNotificationId.values()) {
      ids.add(p.rideId);
    }
    return Array.from(ids);
  }, [bookingRequestedByNotificationId]);

  const driverRidesQuery = useQuery({
    queryKey: queryKeys.rides,
    queryFn: listDriverRides,
    enabled: bookingRequestedRideIds.length > 0,
  });

  const rideApprovalModeById = React.useMemo(() => {
    const m = new Map<string, number>();
    const rides = driverRidesQuery.data?.rides ?? [];
    for (const r of rides) {
      if (!r.rideId) continue;
      if (typeof r.approvalMode === "number") m.set(r.rideId, r.approvalMode);
    }
    return m;
  }, [driverRidesQuery.data?.rides]);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Notifications"
        description="Realtime updates arrive here and as toasts."
      />

      {notificationsQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Failed to load notifications</CardTitle>
            <CardDescription>
              {notificationsQuery.error instanceof Error
                ? notificationsQuery.error.message
                : "Unknown error"}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {items.length === 0 && !notificationsQuery.isPending && !notificationsQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>No notifications</CardTitle>
            <CardDescription>
              You’ll see booking / trip updates here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {items.map((n) => (
          <Card key={n.notificationId}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="grid gap-1">
                  <CardTitle className="text-base">
                    {n.title || n.type || "Notification"}
                  </CardTitle>
                  <CardDescription>
                    {formatDateTime(n.timestamp)}
                    {n.eventType ? ` • ${n.eventType}` : null}
                  </CardDescription>
                </div>
                <Badge variant={n.isRead ? "outline" : "secondary"}>
                  {n.isRead ? "Read" : "Unread"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="text-sm">{n.message}</CardContent>
            <CardFooter className="justify-end gap-2">
              {(() => {
                const payload = bookingRequestedByNotificationId.get(n.notificationId);
                const isManual =
                  payload?.rideId != null
                    ? rideApprovalModeById.get(payload.rideId) === 1
                    : false;

                if (!payload || !isManual) return null;

                return (
                  <>
                    <Button
                      onClick={() => approveMutation.mutate(payload.bookingId)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => rejectMutation.mutate(payload.bookingId)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                    >
                      Reject
                    </Button>
                  </>
                );
              })()}

              {!n.isRead ? (
                <Button
                  variant="outline"
                  onClick={() => markReadMutation.mutate(n.notificationId)}
                  disabled={markReadMutation.isPending}
                >
                  Mark read
                </Button>
              ) : null}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
