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
import { getUserProfile } from "@/features/profile/api/profileApi";
import { getDriverRide } from "@/features/rides/api/ridesApi";
import { completeTrip, getTrip, pickupPassenger } from "@/features/trips/api/tripsApi";
import { formatDateTime } from "@/lib/format/date";
import { queryKeys } from "@/lib/query/keys";

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

export function TripDetailScreen({ tripId }: { tripId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const tripQuery = useQuery({
    queryKey: queryKeys.trip(tripId),
    queryFn: () => getTrip(tripId),
  });

  const rideQuery = useQuery({
    queryKey: tripQuery.data ? queryKeys.ride(tripQuery.data.rideId) : ["ride", "idle"],
    queryFn: async () => {
      if (!tripQuery.data) throw new Error("Missing trip");
      return getDriverRide(tripQuery.data.rideId);
    },
    enabled: Boolean(tripQuery.data?.rideId),
  });

  const pickupMutation = useMutation({
    mutationFn: pickupPassenger,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.trip(tripId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.trips });
      toast.success("Passenger picked up");
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => completeTrip(tripId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.trip(tripId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.trips });
      toast.success("Trip completed");
      router.push("/driver/trips");
    },
  });

  const trip = tripQuery.data;
  const ride = rideQuery.data;

  const status = trip ? tripStatusLabel(trip.status) : null;
  const canAct = Boolean(trip && trip.status !== 3 && trip.status !== 4);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Trip"
        description={ride ? `${ride.sourceCity} → ${ride.destinationCity}` : tripId}
        right={
          <Button variant="outline" asChild>
            <Link href="/driver/trips">Back</Link>
          </Button>
        }
      />

      {tripQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Failed to load trip</CardTitle>
            <CardDescription>
              {tripQuery.error instanceof Error
                ? tripQuery.error.message
                : "Unknown error"}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {trip ? (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="grid gap-1">
                <CardTitle className="text-base">{ride ? "Ride" : "Trip"}</CardTitle>
                <CardDescription>
                  {ride ? `Departs ${formatDateTime(ride.departureTime)}` : trip.rideId}
                </CardDescription>
              </div>
              {status ? <Badge variant="secondary">{status}</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1 text-sm text-muted-foreground">
              <div>Trip ID: {trip.tripId}</div>
              <div>Ride ID: {trip.rideId}</div>
            </div>

            <div className="grid gap-2">
              <h3 className="text-sm font-medium">Passengers</h3>
              {trip.passengerIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">No passengers.</p>
              ) : (
                <div className="grid gap-2">
                  {trip.passengerIds.map((pid) => (
                    <PassengerRow
                      key={pid}
                      passengerId={pid}
                      canPickup={canAct}
                      pickupPending={pickupMutation.isPending}
                      onPickup={() =>
                        pickupMutation.mutate({ tripId: trip.tripId, passengerId: pid })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            {canAct ? (
              <Button
                variant="destructive"
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
              >
                {completeMutation.isPending ? "Completing…" : "Complete trip"}
              </Button>
            ) : null}
          </CardFooter>
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

function PassengerRow(props: {
  passengerId: string;
  canPickup: boolean;
  pickupPending: boolean;
  onPickup: () => void;
}) {
  const profileQuery = useQuery({
    queryKey: queryKeys.userProfile(props.passengerId),
    queryFn: () => getUserProfile(props.passengerId),
  });

  const label = profileQuery.data?.name?.trim() || props.passengerId;
  const city = profileQuery.data?.city?.trim();

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{label}</div>
        {city ? <div className="text-xs text-muted-foreground">{city}</div> : null}
      </div>

      {props.canPickup ? (
        <Button
          variant="outline"
          onClick={props.onPickup}
          disabled={props.pickupPending}
        >
          Pickup
        </Button>
      ) : null}
    </div>
  );
}
