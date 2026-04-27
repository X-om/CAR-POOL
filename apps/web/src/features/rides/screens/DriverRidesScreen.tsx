"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { listDriverBookings } from "@/features/bookings/api/bookingsApi";
import { cancelRide, listDriverRides } from "@/features/rides/api/ridesApi";
import { listDriverTrips, startTrip } from "@/features/trips/api/tripsApi";
import { formatDateTime } from "@/lib/format/date";
import { queryKeys } from "@/lib/query/keys";

export function DriverRidesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const ridesQuery = useQuery({
    queryKey: queryKeys.rides,
    queryFn: listDriverRides,
  });

  const tripsQuery = useQuery({
    queryKey: queryKeys.trips,
    queryFn: listDriverTrips,
  });

  const driverBookingsQuery = useQuery({
    queryKey: ["driverBookings"],
    queryFn: listDriverBookings,
  });

  const cancelMutation = useMutation({
    mutationFn: cancelRide,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.rides });
      toast.success("Ride cancelled");
    },
  });

  const startTripMutation = useMutation({
    mutationFn: (rideId: string) => startTrip({ rideId }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.trips });
      toast.success("Trip started");
      router.push(`/driver/trips/${data.tripId}`);
    },
    onError: (e) => {
      const message = e instanceof Error ? e.message : "Failed to start trip";
      toast.error(message);
    },
  });

  const rides = (ridesQuery.data?.rides ?? []).filter((r) => r.rideStatus !== "CANCELLED");

  const trips = tripsQuery.data?.trips ?? [];
  const activeTripByRideId = React.useMemo(() => {
    const m = new Map<string, { tripId: string; status: number }>();
    for (const t of trips) {
      // Consider any non-terminal trip as active.
      if (t.status === 3 || t.status === 4) continue;
      m.set(t.rideId, { tripId: t.tripId, status: t.status });
    }
    return m;
  }, [trips]);

  const confirmedPassengersByRideId = React.useMemo(() => {
    const bookings = driverBookingsQuery.data?.bookings ?? [];
    const m = new Map<string, number>();
    for (const b of bookings) {
      // BookingStatus.CONFIRMED = 1
      if (b.status !== 1) continue;
      m.set(b.rideId, (m.get(b.rideId) ?? 0) + 1);
    }
    return m;
  }, [driverBookingsQuery.data?.bookings]);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Driver rides"
        description="Publish, review, and cancel your rides."
        right={
          <Button asChild>
            <Link href="/driver/rides/new">Publish ride</Link>
          </Button>
        }
      />

      {ridesQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Failed to load rides</CardTitle>
            <CardDescription>
              {ridesQuery.error instanceof Error
                ? ridesQuery.error.message
                : "Unknown error"}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {rides.length === 0 && !ridesQuery.isPending && !ridesQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>No rides yet</CardTitle>
            <CardDescription>Publish a ride to start accepting bookings.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link href="/driver/rides/new">Publish ride</Link>
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {rides.map((r) => (
          (() => {
            const activeTrip = activeTripByRideId.get(r.rideId);
            const confirmedCount = confirmedPassengersByRideId.get(r.rideId) ?? 0;
            const isTripActive = Boolean(activeTrip);
            const passengersKnown = driverBookingsQuery.status === "success";

            const onStartTrip = () => {
              if (tripsQuery.isPending) return;

              if (isTripActive) {
                toast.message("Trip already started");
                if (activeTrip) router.push(`/driver/trips/${activeTrip.tripId}`);
                return;
              }

              if (passengersKnown && confirmedCount === 0) {
                const ok = window.confirm(
                  "This ride has no confirmed passengers. Start the trip anyway?"
                );
                if (!ok) return;
              }

              startTripMutation.mutate(r.rideId);
            };

            return (
              <Card key={r.rideId}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid gap-1">
                      <CardTitle className="text-base">
                        {r.sourceCity} → {r.destinationCity}
                      </CardTitle>
                      <CardDescription>
                        Departs {formatDateTime(r.departureTime)}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="secondary">${r.pricePerSeat} / seat</Badge>
                      {isTripActive ? (
                        <Badge variant="secondary">Trip started</Badge>
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {r.stops.length} stop{r.stops.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Ride ID: {r.rideId}
                </CardContent>
                <CardFooter className="justify-end gap-2">
                  <Button variant="outline" asChild>
                    <Link href={`/driver/rides/${r.rideId}/edit`}>Edit</Link>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={onStartTrip}
                    disabled={startTripMutation.isPending || tripsQuery.isPending || isTripActive}
                  >
                    {tripsQuery.isPending
                      ? "Loading…"
                      : isTripActive
                        ? "Trip started"
                        : "Start trip"}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => cancelMutation.mutate(r.rideId)}
                    disabled={cancelMutation.isPending}
                  >
                    Cancel ride
                  </Button>
                </CardFooter>
              </Card>
            );
          })()
        ))}
      </div>
    </div>
  );
}
