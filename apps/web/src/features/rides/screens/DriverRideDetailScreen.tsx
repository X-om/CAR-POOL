"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listRideBookings } from "@/features/bookings/api/bookingsApi";
import { getUserProfile } from "@/features/profile/api/profileApi";
import { getDriverRide } from "@/features/rides/api/ridesApi";
import { getUser } from "@/features/users/api/usersApi";
import { formatDateTime } from "@/lib/format/date";
import { queryKeys } from "@/lib/query/keys";

function approvalModeLabel(mode: number | undefined) {
  // ride.BookingApprovalMode: 0=AUTO, 1=MANUAL
  if (mode === 1) return "MANUAL";
  return "AUTO";
}

export function DriverRideDetailScreen({ rideId }: { rideId: string }) {
  const rideQuery = useQuery({
    queryKey: queryKeys.ride(rideId),
    queryFn: () => getDriverRide(rideId),
  });

  const rideBookingsQuery = useQuery({
    queryKey: queryKeys.rideBookings(rideId),
    queryFn: () => listRideBookings(rideId),
    enabled: Boolean(rideQuery.data),
  });

  const ride = rideQuery.data;
  const bookings = rideBookingsQuery.data?.bookings ?? [];

  const bookedSeats = React.useMemo(
    () => bookings.reduce((sum, b) => sum + (Number(b.seatCount) || 0), 0),
    [bookings]
  );

  const stopNameByOrder = React.useMemo(() => {
    const m = new Map<number, string>();
    if (!ride) return m;
    for (const s of ride.stops) m.set(s.stopOrder, s.cityName);
    return m;
  }, [ride]);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Ride details"
        description={ride ? `${ride.sourceCity} → ${ride.destinationCity}` : rideId}
        right={
          <Button variant="outline" asChild>
            <Link href="/driver/rides">Back</Link>
          </Button>
        }
      />

      {rideQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Failed to load ride</CardTitle>
            <CardDescription>
              {rideQuery.error instanceof Error
                ? rideQuery.error.message
                : "Unknown error"}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {ride ? (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="grid gap-1">
                <CardTitle className="text-base">
                  {ride.sourceCity} → {ride.destinationCity}
                </CardTitle>
                <CardDescription>Departs {formatDateTime(ride.departureTime)}</CardDescription>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant="secondary">${ride.pricePerSeat} / seat</Badge>
                <Badge variant={ride.approvalMode === 1 ? "secondary" : "outline"}>
                  {approvalModeLabel(ride.approvalMode)} approval
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="grid gap-6">
            <div className="grid gap-1 text-sm text-muted-foreground">
              <div>Ride ID: {ride.rideId}</div>
              <div>
                Booked seats: <span className="font-medium text-foreground">{bookedSeats}</span>
              </div>
            </div>

            <div className="grid gap-2">
              <h3 className="text-sm font-medium">Passengers</h3>
              {rideBookingsQuery.isPending ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No confirmed passengers yet.</p>
              ) : (
                <div className="grid gap-2">
                  {bookings.map((b) => {
                    const dropCity =
                      b.dropoffStopOrder != null
                        ? stopNameByOrder.get(b.dropoffStopOrder) ?? `Stop ${b.dropoffStopOrder}`
                        : ride.destinationCity;

                    return (
                      <RidePassengerRow
                        key={b.bookingId}
                        passengerId={b.passengerId}
                        seatCount={b.seatCount}
                        dropCity={dropCity}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Loading…</CardTitle>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

function RidePassengerRow(props: { passengerId: string; seatCount: number; dropCity: string }) {
  const profileQuery = useQuery({
    queryKey: queryKeys.userProfile(props.passengerId),
    queryFn: () => getUserProfile(props.passengerId),
  });

  const userQuery = useQuery({
    queryKey: queryKeys.user(props.passengerId),
    queryFn: () => getUser(props.passengerId),
  });

  const name = profileQuery.data?.name?.trim() || props.passengerId;
  const phone = userQuery.data?.phoneNumber?.trim();

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">
          {phone ? phone : "Phone unavailable"} • Drop: {props.dropCity}
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {props.seatCount} seat{props.seatCount === 1 ? "" : "s"}
      </div>
    </div>
  );
}
