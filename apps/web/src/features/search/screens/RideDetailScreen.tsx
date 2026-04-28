"use client";

import * as React from "react";
import Link from "next/link";
import type { Feature, FeatureCollection, LineString } from "geojson";
import Map, { Layer, Marker, Source, type MapRef } from "react-map-gl/mapbox";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { env } from "@/config/env";
import { createBooking, listRideBookings } from "@/features/bookings/api/bookingsApi";
import { getUserProfile } from "@/features/profile/api/profileApi";
import { getPassengerTripForRide, submitTripRating } from "@/features/trips/api/tripsApi";
import { getUserId } from "@/lib/auth/tokenStore";
import { checkSeatAvailability, getDriverRide } from "@/features/rides/api/ridesApi";
import { getSearchRide } from "@/features/search/api/searchApi";
import { formatDateTime } from "@/lib/format/date";
import { getRouteThroughStops, type MapboxRoute } from "@/lib/mapbox/directions";
import { queryKeys } from "@/lib/query/keys";

const BookingSchema = z
  .object({
    seatCount: z.coerce.number().int().min(1).max(10),
    pickupStopOrder: z.coerce.number().int(),
    dropoffStopOrder: z.coerce.number().int(),
  })
  .refine((v) => v.pickupStopOrder < v.dropoffStopOrder, {
    message: "Dropoff must be after pickup",
    path: ["dropoffStopOrder"],
  });

type BookingFormInput = z.input<typeof BookingSchema>;
type BookingValues = z.output<typeof BookingSchema>;

function stopLabel(stop: { stopOrder: number; cityName: string }) {
  return `${stop.stopOrder}. ${stop.cityName}`;
}

function bbox(coords: Array<[number, number]>) {
  let minLng = coords[0]?.[0] ?? 0;
  let maxLng = coords[0]?.[0] ?? 0;
  let minLat = coords[0]?.[1] ?? 0;
  let maxLat = coords[0]?.[1] ?? 0;

  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  return { minLng, minLat, maxLng, maxLat };
}

function useThemeMapColors() {
  const [colors, setColors] = React.useState<
    { primary: string; muted: string; route: string } | null
  >(null);

  React.useEffect(() => {
    const s = getComputedStyle(document.documentElement);
    const rawPrimary = s.getPropertyValue("--primary").trim() || "hsl(222.2 47.4% 11.2%)";
    const rawMuted = s.getPropertyValue("--muted-foreground").trim() || "hsl(215.4 16.3% 46.9%)";

    const probe = document.createElement("span");
    probe.className = "text-blue-600";
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.pointerEvents = "none";
    document.body.appendChild(probe);
    const rawRoute = getComputedStyle(probe).color || "rgb(37, 99, 235)";
    document.body.removeChild(probe);

    function normalizeCssColor(raw: string, fallback: string) {
      const v = (raw || "").trim();
      if (!v) return fallback;
      try {
        const el = document.createElement("div");
        el.style.position = "absolute";
        el.style.visibility = "hidden";
        el.style.pointerEvents = "none";
        el.style.color = v;
        document.body.appendChild(el);
        const resolved = getComputedStyle(el).color || fallback;
        document.body.removeChild(el);
        if (/^\s*lab\(/i.test(resolved) || /^\s*lch\(/i.test(resolved)) return fallback;
        return resolved;
      } catch {
        return fallback;
      }
    }

    const primary = normalizeCssColor(rawPrimary, "hsl(222.2 47.4% 11.2%)");
    const muted = normalizeCssColor(rawMuted, "hsl(215.4 16.3% 46.9%)");
    const route = normalizeCssColor(rawRoute, "rgb(37, 99, 235)");

    setColors({ primary, muted, route });
  }, []);

  return colors;
}

export function RideDetailScreen({ rideId }: { rideId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const mapRef = React.useRef<MapRef | null>(null);
  const themeColors = useThemeMapColors();

  const initialSeatCount = Number(searchParams.get("seatCount") ?? "1");
  const initialPickup = Number(searchParams.get("pickupStopOrder") ?? "0");
  const initialDropoff = Number(searchParams.get("dropoffStopOrder") ?? "1");

  const rideQuery = useQuery({
    queryKey: queryKeys.searchRide(rideId),
    queryFn: () => getSearchRide(rideId),
  });

  const rideBookingsQuery = useQuery({
    queryKey: queryKeys.rideBookings(rideId),
    queryFn: () => listRideBookings(rideId),
    enabled: Boolean(rideQuery.data),
  });

  const userId = getUserId();

  const rideStatusQuery = useQuery({
    queryKey: queryKeys.ride(rideId),
    queryFn: () => getDriverRide(rideId),
    enabled: Boolean(userId),
  });

  const passengerTripQuery = useQuery({
    queryKey: ['passengerTrip', rideId, userId],
    queryFn: () => (userId ? getPassengerTripForRide(rideId, userId) : Promise.resolve(null)),
    enabled: Boolean(userId && rideQuery.data),
  });

  const form = useForm<BookingFormInput>({
    resolver: zodResolver(BookingSchema),
    defaultValues: {
      seatCount: Number.isFinite(initialSeatCount) ? initialSeatCount : 1,
      pickupStopOrder: Number.isFinite(initialPickup) ? initialPickup : 0,
      dropoffStopOrder: Number.isFinite(initialDropoff) ? initialDropoff : 1,
    },
  });

  const watchedPickupStopOrder = useWatch({
    control: form.control,
    name: "pickupStopOrder",
  });
  const watchedDropoffStopOrder = useWatch({
    control: form.control,
    name: "dropoffStopOrder",
  });

  React.useEffect(() => {
    const ride = rideQuery.data;
    if (!ride) return;

    const orders = ride.routeStops.map((s) => s.stopOrder);
    const minOrder = Math.min(...orders);
    const maxOrder = Math.max(...orders);

    let pickup = Number(form.getValues("pickupStopOrder"));
    let dropoff = Number(form.getValues("dropoffStopOrder"));

    if (!orders.includes(pickup)) pickup = minOrder;
    if (!orders.includes(dropoff)) dropoff = maxOrder;

    if (pickup >= dropoff) {
      pickup = minOrder;
      dropoff = maxOrder;
    }

    form.setValue("pickupStopOrder", pickup);
    form.setValue("dropoffStopOrder", dropoff);
  }, [rideQuery.data, form]);

  const availabilityMutation = useMutation({
    mutationFn: async (values: BookingValues) =>
      checkSeatAvailability(rideId, {
        requestedSeats: values.seatCount,
        pickupStopOrder: values.pickupStopOrder,
        dropoffStopOrder: values.dropoffStopOrder,
      }),
  });

  const bookingMutation = useMutation({
    mutationFn: async (values: BookingValues) =>
      createBooking({
        rideId,
        seatCount: values.seatCount,
        pickupStopOrder: values.pickupStopOrder,
        dropoffStopOrder: values.dropoffStopOrder,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
      toast.success("Booking created");
      router.push("/passenger/bookings");
    },
  });

  const onCheckAvailability = async () => {
    const values = form.getValues();
    const parsed = BookingSchema.safeParse(values);
    if (!parsed.success) {
      toast.error("Fix booking inputs first");
      return;
    }
    try {
      await availabilityMutation.mutateAsync(parsed.data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to check availability";
      toast.error(message);
    }
  };

  const onBook = form.handleSubmit(async (values) => {
    const parsed = BookingSchema.safeParse(values);
    if (!parsed.success) {
      toast.error("Fix booking inputs first");
      return;
    }
    try {
      await bookingMutation.mutateAsync(parsed.data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Booking failed";
      toast.error(message);
    }
  });

  const ride = rideQuery.data;
  const confirmedBookings = rideBookingsQuery.data?.bookings ?? [];

  const rideStatus = rideStatusQuery.data?.rideStatus;
  const isRideActive = rideStatus == null || rideStatus === "ACTIVE";
  const isTripCompletedForPassenger = passengerTripQuery.data?.status === 3;
  const isBookingClosed = !isRideActive || isTripCompletedForPassenger;

  const canUseMapbox = Boolean(env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN);
  const routeBlue = themeColors?.route ?? "rgb(37, 99, 235)";

  const sortedStops = React.useMemo(
    () => (ride ? ride.routeStops.slice().sort((a, b) => a.stopOrder - b.stopOrder) : []),
    [ride]
  );

  const fullStopCoords = React.useMemo(
    () => sortedStops.map((s) => [s.longitude, s.latitude] as [number, number]),
    [sortedStops]
  );

  const [fullRouted, setFullRouted] = React.useState<MapboxRoute | null>(null);
  const [segmentRouted, setSegmentRouted] = React.useState<MapboxRoute | null>(null);
  const fullRouteGenRef = React.useRef(0);
  const segmentRouteGenRef = React.useRef(0);

  const minStopOrder = sortedStops[0]?.stopOrder ?? 0;
  const maxStopOrder = sortedStops[sortedStops.length - 1]?.stopOrder ?? 1;

  const pickupOrder = Number.isFinite(watchedPickupStopOrder)
    ? Number(watchedPickupStopOrder)
    : minStopOrder;
  const dropoffOrder = Number.isFinite(watchedDropoffStopOrder)
    ? Number(watchedDropoffStopOrder)
    : maxStopOrder;

  const segmentFrom = Math.min(pickupOrder, dropoffOrder);
  const segmentTo = Math.max(pickupOrder, dropoffOrder);

  const segmentCoords = sortedStops
    .filter((s) => s.stopOrder >= segmentFrom && s.stopOrder <= segmentTo)
    .map((s) => [s.longitude, s.latitude] as [number, number]);

  // Fetch routed polyline through all stops (prevents straight-line segments).
  React.useEffect(() => {
    if (!canUseMapbox) return;
    if (!ride) return;
    if (sortedStops.length < 2) return;

    fullRouteGenRef.current += 1;
    const generation = fullRouteGenRef.current;

    void (async () => {
      try {
        const route = await getRouteThroughStops({
          stops: sortedStops.map((s) => ({ lat: s.latitude, lng: s.longitude })),
        });
        if (fullRouteGenRef.current !== generation) return;
        setFullRouted(route);
      } catch {
        if (fullRouteGenRef.current !== generation) return;
        setFullRouted(null);
      }
    })();
  }, [canUseMapbox, ride, sortedStops]);

  // Fetch routed polyline for the selected pickup->dropoff segment.
  React.useEffect(() => {
    if (!canUseMapbox) return;
    if (!ride) return;

    const segmentStops = sortedStops.filter(
      (s) => s.stopOrder >= segmentFrom && s.stopOrder <= segmentTo
    );

    if (segmentStops.length < 2) {
      setSegmentRouted(null);
      return;
    }

    segmentRouteGenRef.current += 1;
    const generation = segmentRouteGenRef.current;

    void (async () => {
      try {
        const route = await getRouteThroughStops({
          stops: segmentStops.map((s) => ({ lat: s.latitude, lng: s.longitude })),
        });
        if (segmentRouteGenRef.current !== generation) return;
        setSegmentRouted(route);
      } catch {
        if (segmentRouteGenRef.current !== generation) return;
        setSegmentRouted(null);
      }
    })();
  }, [canUseMapbox, ride, sortedStops, segmentFrom, segmentTo]);

  const fullRouteFeature: Feature<LineString> | null = fullRouted
    ? {
      type: "Feature",
      properties: { kind: "full" },
      geometry: fullRouted.geometry,
    }
    : fullStopCoords.length >= 2
      ? {
        type: "Feature",
        properties: { kind: "full-fallback" },
        geometry: { type: "LineString", coordinates: fullStopCoords },
      }
      : null;

  const segmentFeature: Feature<LineString> | null = segmentRouted
    ? {
      type: "Feature",
      properties: { kind: "segment" },
      geometry: segmentRouted.geometry,
    }
    : segmentCoords.length >= 2
      ? {
        type: "Feature",
        properties: { kind: "segment-fallback" },
        geometry: { type: "LineString", coordinates: segmentCoords },
      }
      : null;

  const fullCollection: FeatureCollection<LineString> = {
    type: "FeatureCollection",
    features: fullRouteFeature ? [fullRouteFeature] : [],
  };

  const segmentCollection: FeatureCollection<LineString> = {
    type: "FeatureCollection",
    features: segmentFeature ? [segmentFeature] : [],
  };

  const stopMarkers = sortedStops;

  React.useEffect(() => {
    if (!canUseMapbox) return;
    if (!ride) return;

    const coords =
      fullRouted?.geometry.coordinates ??
      fullStopCoords;

    if (coords.length < 2) return;

    const map = mapRef.current?.getMap();
    if (!map) return;

    const b = bbox(coords);
    try {
      map.fitBounds(
        [
          [b.minLng, b.minLat],
          [b.maxLng, b.maxLat],
        ],
        { padding: 48, duration: 0 }
      );
    } catch {
      // ignore
    }
  }, [ride, canUseMapbox, fullRouted, fullStopCoords]);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Ride details"
        description={ride ? `${ride.sourceCity} → ${ride.destinationCity}` : undefined}
        right={
          <Button variant="outline" asChild>
            <Link href="/passenger/search">Back to search</Link>
          </Button>
        }
      />

      {rideQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Failed to load ride</CardTitle>
            <CardDescription>
              {rideQuery.error instanceof Error ? rideQuery.error.message : "Unknown error"}
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
                <CardDescription>
                  Departs {formatDateTime(ride.departureTime)} • Rating {ride.driverRating}
                </CardDescription>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant="secondary">{ride.availableSeats} seats total</Badge>
                <span className="text-sm font-medium">${ride.driverPricePerSeat} / seat</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="grid gap-6">
            {canUseMapbox ? (
              <div className="grid gap-2">
                <h3 className="text-sm font-medium">Map</h3>
                <div className="h-[420px] overflow-hidden rounded-lg border">
                  <Map
                    ref={mapRef}
                    mapboxAccessToken={env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!}
                    mapStyle="mapbox://styles/mapbox/streets-v12"
                    initialViewState={{
                      longitude: sortedStops[0]?.longitude ?? 73.8567,
                      latitude: sortedStops[0]?.latitude ?? 18.5204,
                      zoom: 7,
                    }}
                  >
                    {stopMarkers.map((s) => {
                      const isPickup = s.stopOrder === pickupOrder;
                      const isDropoff = s.stopOrder === dropoffOrder;
                      const isSelected = isPickup || isDropoff;
                      return (
                        <Marker
                          key={s.stopOrder}
                          longitude={s.longitude}
                          latitude={s.latitude}
                          anchor="bottom"
                        >
                          <div
                            className={
                              isSelected
                                ? "h-3 w-3 rounded-full bg-primary ring-4 ring-primary/20"
                                : "h-2 w-2 rounded-full bg-primary ring-2 ring-primary/20"
                            }
                          />
                        </Marker>
                      );
                    })}

                    {fullRouteFeature ? (
                      <Source id="ride-full-route" type="geojson" data={fullCollection}>
                        <Layer
                          id="ride-full-route-layer"
                          type="line"
                          paint={{
                            "line-color": routeBlue,
                            "line-width": 3,
                            "line-opacity": 0.35,
                          }}
                        />
                      </Source>
                    ) : null}

                    {segmentFeature ? (
                      <Source id="ride-segment" type="geojson" data={segmentCollection}>
                        <Layer
                          id="ride-segment-layer"
                          type="line"
                          paint={{
                            "line-color": routeBlue,
                            "line-width": 5,
                            "line-opacity": 0.85,
                          }}
                        />
                      </Source>
                    ) : null}
                  </Map>
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                <h3 className="text-sm font-medium">Map</h3>
                <p className="text-sm text-muted-foreground">
                  Set <span className="font-mono">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</span> to
                  render route polylines.
                </p>
              </div>
            )}

            <div className="grid gap-2">
              <h3 className="text-sm font-medium">Route stops</h3>
              <ol className="grid gap-1 text-sm text-muted-foreground">
                {ride.routeStops
                  .slice()
                  .sort((a, b) => a.stopOrder - b.stopOrder)
                  .map((s) => (
                    <li key={s.stopOrder}>
                      {s.stopOrder}. {s.cityName}
                    </li>
                  ))}
              </ol>
            </div>

            <div className="grid gap-2">
              <h3 className="text-sm font-medium">Passengers</h3>
              {rideBookingsQuery.isPending ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : confirmedBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No passengers yet.</p>
              ) : (
                <div className="grid gap-2">
                  {confirmedBookings.map((b) => (
                    <BookedPassengerRow
                      key={b.bookingId}
                      passengerId={b.passengerId}
                      seatCount={b.seatCount}
                    />
                  ))}
                </div>
              )}
            </div>

            {passengerTripQuery.data && passengerTripQuery.data.status === 3 && passengerTripQuery.data.hasRated === false ? (
              <div className="mt-4 grid gap-2 rounded-lg border p-3">
                <p className="text-sm font-medium text-foreground">Rate driver for this trip</p>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="grid gap-1">
                    <Label className="text-xs">Rating (1–5)</Label>
                    <Select value={String(5)} onValueChange={() => { }}>
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
                    onClick={() => {
                      const tripId = passengerTripQuery.data?.tripId;
                      if (!tripId) return;
                      void submitTripRating(tripId, 5).then(() => {
                        void queryClient.invalidateQueries({ queryKey: ['passengerTrip', rideId, userId] });
                      }).catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to submit rating'));
                    }}
                  >
                    Submit
                  </Button>
                </div>
              </div>
            ) : null}

            {isBookingClosed ? (
              <div className="grid gap-2">
                <h3 className="text-sm font-medium">Booking</h3>
                <p className="text-sm text-muted-foreground">
                  {isTripCompletedForPassenger
                    ? "Trip completed — booking is closed."
                    : "This ride is not available for booking."}
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                <h3 className="text-sm font-medium">Book seats</h3>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="grid gap-2">
                    <Label>Pickup stop</Label>
                    <Select
                      value={String(watchedPickupStopOrder ?? 0)}
                      onValueChange={(v) => {
                        if (v == null) return;
                        form.setValue("pickupStopOrder", Number(v));
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select pickup" />
                      </SelectTrigger>
                      <SelectContent>
                        {ride.routeStops
                          .slice()
                          .sort((a, b) => a.stopOrder - b.stopOrder)
                          .map((s) => (
                            <SelectItem key={s.stopOrder} value={String(s.stopOrder)}>
                              {stopLabel(s)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Dropoff stop</Label>
                    <Select
                      value={String(watchedDropoffStopOrder ?? 1)}
                      onValueChange={(v) => {
                        if (v == null) return;
                        form.setValue("dropoffStopOrder", Number(v));
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select dropoff" />
                      </SelectTrigger>
                      <SelectContent>
                        {ride.routeStops
                          .slice()
                          .sort((a, b) => a.stopOrder - b.stopOrder)
                          .map((s) => (
                            <SelectItem key={s.stopOrder} value={String(s.stopOrder)}>
                              {stopLabel(s)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.dropoffStopOrder ? (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.dropoffStopOrder.message}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="seatCount">Seats</Label>
                    <Input
                      id="seatCount"
                      type="number"
                      min={1}
                      max={10}
                      {...form.register("seatCount")}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onCheckAvailability}
                    disabled={availabilityMutation.isPending}
                  >
                    {availabilityMutation.isPending ? "Checking…" : "Check availability"}
                  </Button>
                  <Button type="button" onClick={onBook} disabled={bookingMutation.isPending}>
                    {bookingMutation.isPending ? "Booking…" : "Book"}
                  </Button>
                </div>

                {availabilityMutation.data ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Availability</CardTitle>
                      <CardDescription>
                        {availabilityMutation.data.isAvailable
                          ? `Available (${availabilityMutation.data.availableSeats} seats)`
                          : `Not available (${availabilityMutation.data.availableSeats} seats left)`}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ) : null}
              </div>
            )}
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

function BookedPassengerRow(props: { passengerId: string; seatCount: number }) {
  const profileQuery = useQuery({
    queryKey: queryKeys.userProfile(props.passengerId),
    queryFn: () => getUserProfile(props.passengerId),
  });

  const label = profileQuery.data?.name?.trim() || props.passengerId;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2">
      <div className="min-w-0 truncate text-sm font-medium">{label}</div>
      <div className="text-xs text-muted-foreground">
        {props.seatCount} seat{props.seatCount === 1 ? "" : "s"}
      </div>
    </div>
  );
}
