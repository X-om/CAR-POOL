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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDriverRide } from "@/features/rides/api/ridesApi";
import { listDriverTrips } from "@/features/trips/api/tripsApi";
import { formatDateTime } from "@/lib/format/date";
import { queryKeys } from "@/lib/query/keys";
import type { Trip } from "@/types/api";

function tripStatusLabel(status: number) {
  switch (status) {
    case 0:
      return "SCHEDULED";
    case 1:
      return "STARTED";
    case 2:
      return "IN_PROGRESS";
    case 3:
      return "COMPLETED";
    case 4:
      return "CANCELLED";
    default:
      return `STATUS_${status}`;
  }
}

export function DriverTripsScreen() {
  const tripsQuery = useQuery({
    queryKey: queryKeys.trips,
    queryFn: listDriverTrips,
  });

  const trips = tripsQuery.data?.trips ?? [];

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Driver trips"
        description="Start, pickup passengers, and complete trips."
        right={
          <Button variant="outline" asChild>
            <Link href="/driver/rides">Driver rides</Link>
          </Button>
        }
      />

      {tripsQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Failed to load trips</CardTitle>
            <CardDescription>
              {tripsQuery.error instanceof Error
                ? tripsQuery.error.message
                : "Unknown error"}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {tripsQuery.isPending ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading…</CardTitle>
          </CardHeader>
        </Card>
      ) : null}

      {trips.length === 0 && !tripsQuery.isPending && !tripsQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>No trips yet</CardTitle>
            <CardDescription>
              Start a trip from your driver rides page.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link href="/driver/rides">Go to driver rides</Link>
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {trips.map((t) => (
          <TripCard key={t.tripId} trip={t} />
        ))}
      </div>
    </div>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  const rideQuery = useQuery({
    queryKey: queryKeys.ride(trip.rideId),
    queryFn: () => getDriverRide(trip.rideId),
  });

  const ride = rideQuery.data;
  const status = tripStatusLabel(trip.status);
  const isDone = trip.status === 3 || trip.status === 4;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <CardTitle className="text-base">
              {ride ? `${ride.sourceCity} → ${ride.destinationCity}` : "Trip"}
            </CardTitle>
            <CardDescription>
              {ride ? `Departs ${formatDateTime(ride.departureTime)}` : trip.rideId}
            </CardDescription>
          </div>
          <Badge variant={isDone ? "outline" : "secondary"}>{status}</Badge>
        </div>
      </CardHeader>

      <CardContent className="text-sm text-muted-foreground">
        Passengers: {trip.passengerIds.length}
      </CardContent>

      <CardFooter className="justify-end">
        <Button asChild>
          <Link href={`/driver/trips/${trip.tripId}`}>View trip</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
