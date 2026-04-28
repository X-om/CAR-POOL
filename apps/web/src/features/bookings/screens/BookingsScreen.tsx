"use client";

import * as React from "react";
import Link from "next/link";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cancelBooking, listBookings } from "@/features/bookings/api/bookingsApi";
import { getSearchRide } from "@/features/search/api/searchApi";
import { submitUserRating } from "@/features/users/api/ratingsApi";
import { formatDateTime } from "@/lib/format/date";
import { queryKeys } from "@/lib/query/keys";

function bookingStatusLabel(status: number) {
  switch (status) {
    case 0:
      return "PENDING";
    case 1:
      return "CONFIRMED";
    case 2:
      return "CANCELLED";
    case 3:
      return "COMPLETED";
    default:
      return `STATUS_${status}`;
  }
}

function stopName(
  stops: Array<{ stopOrder: number; cityName: string }> | undefined,
  stopOrder: number
) {
  const found = stops?.find((s) => s.stopOrder === stopOrder);
  return found?.cityName || `Stop ${stopOrder}`;
}

export function BookingsScreen() {
  const queryClient = useQueryClient();

  const bookingsQuery = useQuery({
    queryKey: queryKeys.bookings,
    queryFn: listBookings,
  });

  const cancelMutation = useMutation({
    mutationFn: cancelBooking,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
      toast.success("Booking cancelled");
    },
  });

  const bookings = bookingsQuery.data?.bookings ?? [];

  return (
    <div className="grid gap-6">
      <PageHeader
        title="My bookings"
        description="Track status and cancel if needed."
      />

      {bookingsQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Failed to load bookings</CardTitle>
            <CardDescription>
              {bookingsQuery.error instanceof Error
                ? bookingsQuery.error.message
                : "Unknown error"}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {bookingsQuery.isPending ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading…</CardTitle>
          </CardHeader>
        </Card>
      ) : null}

      {bookings.length === 0 && !bookingsQuery.isPending && !bookingsQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>No bookings yet</CardTitle>
            <CardDescription>
              Book a ride from the search page to see it here.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link href="/passenger/search">Search rides</Link>
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {bookings.map((b) => (
          <BookingCard
            key={b.bookingId}
            booking={b}
            onCancel={() => cancelMutation.mutate(b.bookingId)}
            cancelPending={cancelMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}

function BookingCard(props: {
  booking: {
    bookingId: string;
    rideId: string;
    seatCount: number;
    status: number;
    pickupStopOrder?: number;
    dropoffStopOrder?: number;
  };
  onCancel: () => void;
  cancelPending: boolean;
}) {
  const { booking } = props;
  const queryClient = useQueryClient();

  const rideQuery = useQuery({
    queryKey: queryKeys.searchRide(booking.rideId),
    queryFn: () => getSearchRide(booking.rideId),
  });

  const ride = rideQuery.data;
  const status = bookingStatusLabel(booking.status);

  const [rating, setRating] = React.useState<string>("5");
  const [hasRated, setHasRated] = React.useState(false);

  const ratingMutation = useMutation({
    mutationFn: async (newRating: number) => {
      if (!ride) throw new Error("Ride info not loaded yet");
      return submitUserRating(ride.driverId, newRating);
    },
    onSuccess: async () => {
      setHasRated(true);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.searchRide(booking.rideId),
      });
      await queryClient.invalidateQueries({ queryKey: ["searchRides"] });
      toast.success("Thanks for rating your driver");
    },
    onError: (e) => {
      const message = e instanceof Error ? e.message : "Failed to submit rating";
      toast.error(message);
    },
  });

  const canCancel = booking.status === 0 || booking.status === 1;
  const canViewRide = booking.status !== 3;

  const legText = (() => {
    if (!ride) return null;

    if (
      booking.pickupStopOrder !== undefined &&
      booking.dropoffStopOrder !== undefined
    ) {
      const from = stopName(ride.routeStops, booking.pickupStopOrder);
      const to = stopName(ride.routeStops, booking.dropoffStopOrder);
      return `${from} → ${to}`;
    }

    return `${ride.sourceCity} → ${ride.destinationCity}`;
  })();

  const detailsUrl = (() => {
    const qs = new URLSearchParams({
      seatCount: String(booking.seatCount),
    });

    if (booking.pickupStopOrder !== undefined) {
      qs.set("pickupStopOrder", String(booking.pickupStopOrder));
    }
    if (booking.dropoffStopOrder !== undefined) {
      qs.set("dropoffStopOrder", String(booking.dropoffStopOrder));
    }

    return `/passenger/rides/${booking.rideId}?${qs.toString()}`;
  })();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <CardTitle className="text-base">
              {ride ? `${ride.sourceCity} → ${ride.destinationCity}` : "Ride"}
            </CardTitle>
            <CardDescription>
              {ride ? `Departs ${formatDateTime(ride.departureTime)}` : booking.rideId}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={booking.status === 2 ? "outline" : "secondary"}>{status}</Badge>
            <span className="text-sm text-muted-foreground">
              {booking.seatCount} seat{booking.seatCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {legText ? <p>Leg: {legText}</p> : <p>Loading ride info…</p>}

        {booking.status === 3 && ride ? (
          <div className="mt-4 grid gap-2 rounded-lg border p-3">
            <p className="text-sm font-medium text-foreground">Rate driver</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="grid gap-1">
                <Label className="text-xs">Rating (1–5)</Label>
                <Select
                  value={rating}
                  onValueChange={(v) => setRating(v ?? "5")}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((v) => (
                      <SelectItem key={v} value={String(v)}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={() => ratingMutation.mutate(Number(rating))}
                disabled={hasRated || ratingMutation.isPending}
              >
                {hasRated
                  ? "Rated"
                  : ratingMutation.isPending
                    ? "Submitting…"
                    : "Submit"}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="justify-end gap-2">
        {canViewRide ? (
          <Button variant="outline" asChild>
            <Link href={detailsUrl}>View ride</Link>
          </Button>
        ) : null}
        {canCancel ? (
          <Button
            variant="destructive"
            onClick={props.onCancel}
            disabled={props.cancelPending}
          >
            Cancel
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
