"use client";

import * as React from "react";
import Link from "next/link";
import type { Feature, FeatureCollection, LineString } from "geojson";
import Map, { Layer, Marker, Source, type MapRef } from "react-map-gl/mapbox";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import { env } from "@/config/env";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchRides, type SearchRidesParams } from "@/features/search/api/searchApi";
import { formatDateTime } from "@/lib/format/date";
import { geocodePlaces, type PlaceSuggestion } from "@/lib/mapbox/geocoding";
import { queryKeys } from "@/lib/query/keys";

const SearchSchema = z.object({
  sourceCity: z.string().min(1, "Origin is required"),
  destinationCity: z.string().min(1, "Destination is required"),
  sourceLat: z.coerce.number(),
  sourceLng: z.coerce.number(),
  destLat: z.coerce.number(),
  destLng: z.coerce.number(),
  requiredSeats: z.coerce.number().int().min(1).max(10),
}).superRefine((v, ctx) => {
  const srcOk = Number.isFinite(v.sourceLat) && Number.isFinite(v.sourceLng) && (v.sourceLat !== 0 || v.sourceLng !== 0);
  const dstOk = Number.isFinite(v.destLat) && Number.isFinite(v.destLng) && (v.destLat !== 0 || v.destLng !== 0);

  if (!srcOk) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["sourceCity"], message: "Select an origin from suggestions" });
  }
  if (!dstOk) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["destinationCity"], message: "Select a destination from suggestions" });
  }
});

type SearchFormInput = z.input<typeof SearchSchema>;
type SearchValues = z.output<typeof SearchSchema>;

function useCitySuggestions(query: string, enabled: boolean) {
  const [items, setItems] = React.useState<PlaceSuggestion[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!enabled) {
      setItems([]);
      return;
    }

    const q = query.trim();
    if (q.length < 2) {
      setItems([]);
      return;
    }

    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        setIsLoading(true);
        const res = await geocodePlaces(q, { limit: 5 });
        if (cancelled) return;
        setItems(res);
      } catch {
        if (cancelled) return;
        setItems([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query, enabled]);

  return { items, isLoading };
}

function stopName(stops: Array<{ stopOrder: number; cityName: string }>, order: number) {
  const found = stops.find((s) => s.stopOrder === order);
  return found?.cityName || `Stop ${order}`;
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
  const [colors, setColors] = React.useState<{ primary: string; muted: string } | null>(
    null
  );

  React.useEffect(() => {
    const s = getComputedStyle(document.documentElement);

    const normalize = (raw: string, fallback: string) => {
      const value = raw.trim();
      if (!value) return fallback;
      if (
        value.startsWith("hsl(") ||
        value.startsWith("hsla(") ||
        value.startsWith("rgb(") ||
        value.startsWith("rgba(") ||
        value.startsWith("#")
      ) {
        return value;
      }
      return `hsl(${value})`;
    };

    const primary = normalize(
      s.getPropertyValue("--primary"),
      "hsl(222.2 47.4% 11.2%)"
    );
    const muted = normalize(
      s.getPropertyValue("--muted-foreground"),
      "hsl(215.4 16.3% 46.9%)"
    );

    setColors({ primary, muted });
  }, []);

  return colors;
}

export function PassengerSearchScreen() {
  const [params, setParams] = React.useState<SearchRidesParams | null>(null);
  const mapRef = React.useRef<MapRef | null>(null);
  const themeColors = useThemeMapColors();

  const [originQuery, setOriginQuery] = React.useState("");
  const [destinationQuery, setDestinationQuery] = React.useState("");
  const [originOpen, setOriginOpen] = React.useState(false);
  const [destinationOpen, setDestinationOpen] = React.useState(false);

  const form = useForm<SearchFormInput>({
    resolver: zodResolver(SearchSchema),
    defaultValues: {
      sourceCity: "",
      destinationCity: "",
      sourceLat: 0,
      sourceLng: 0,
      destLat: 0,
      destLng: 0,
      requiredSeats: 1,
    },
  });

  const ridesQuery = useQuery({
    queryKey: params ? queryKeys.searchRides(params) : ["searchRides", "idle"],
    queryFn: async () => {
      if (!params) return { rides: [] };
      return searchRides(params);
    },
    enabled: Boolean(params),
  });

  const onSubmit = form.handleSubmit((values) => {
    const parsed = SearchSchema.safeParse(values);
    if (!parsed.success) return;

    const v: SearchValues = parsed.data;
    setParams({
      sourceLat: v.sourceLat,
      sourceLng: v.sourceLng,
      destLat: v.destLat,
      destLng: v.destLng,
      requiredSeats: v.requiredSeats,
    });
  });

  const rides = React.useMemo(() => ridesQuery.data?.rides ?? [], [ridesQuery.data?.rides]);

  const canUseMapbox = Boolean(env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN);
  const primary = themeColors?.primary ?? "hsl(222.2 47.4% 11.2%)";
  const muted = themeColors?.muted ?? "hsl(215.4 16.3% 46.9%)";

  const originSuggestions = useCitySuggestions(originQuery, canUseMapbox && originOpen);
  const destinationSuggestions = useCitySuggestions(
    destinationQuery,
    canUseMapbox && destinationOpen
  );

  const fullRouteFeatures: Array<Feature<LineString>> = rides.flatMap((ride) => {
    const coords = ride.routeStops
      .slice()
      .sort((a, b) => a.stopOrder - b.stopOrder)
      .map((s) => [s.longitude, s.latitude] as [number, number]);
    if (coords.length < 2) return [];
    return [
      {
        type: "Feature",
        properties: { rideId: ride.rideId },
        geometry: { type: "LineString", coordinates: coords },
      },
    ];
  });

  const legFeatures: Array<Feature<LineString>> = rides.flatMap((ride) => {
    const sorted = ride.routeStops.slice().sort((a, b) => a.stopOrder - b.stopOrder);
    const from = Math.min(ride.pickupStopOrder, ride.dropoffStopOrder);
    const to = Math.max(ride.pickupStopOrder, ride.dropoffStopOrder);
    const coords = sorted
      .filter((s) => s.stopOrder >= from && s.stopOrder <= to)
      .map((s) => [s.longitude, s.latitude] as [number, number]);
    if (coords.length < 2) return [];
    return [
      {
        type: "Feature",
        properties: { rideId: ride.rideId, kind: "leg" },
        geometry: { type: "LineString", coordinates: coords },
      },
    ];
  });

  const fullRoutes: FeatureCollection<LineString> = {
    type: "FeatureCollection",
    features: fullRouteFeatures,
  };
  const legs: FeatureCollection<LineString> = {
    type: "FeatureCollection",
    features: legFeatures,
  };

  React.useEffect(() => {
    if (!canUseMapbox) return;
    if (!rides.length) return;

    const coords = rides.flatMap((r) =>
      r.routeStops.map((s) => [s.longitude, s.latitude] as [number, number])
    );
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
  }, [canUseMapbox, rides]);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Search rides"
        description="Search by origin/destination city and seat count."
      />

      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
          <CardDescription>
            Pick cities from suggestions (powered by Mapbox geocoding).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="origin">Origin</Label>
                <div className="relative">
                  <Input
                    id="origin"
                    placeholder={canUseMapbox ? "Pune" : "Set Mapbox token to search"}
                    value={originQuery}
                    onFocus={() => setOriginOpen(true)}
                    onBlur={() => window.setTimeout(() => setOriginOpen(false), 150)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setOriginQuery(v);
                      form.setValue("sourceCity", v, { shouldValidate: true });
                      // Force re-selection from dropdown.
                      form.setValue("sourceLat", 0, { shouldValidate: false });
                      form.setValue("sourceLng", 0, { shouldValidate: false });
                    }}
                    disabled={!canUseMapbox}
                  />

                  {originOpen && originSuggestions.items.length ? (
                    <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-card">
                      {originSuggestions.items.map((s) => (
                        <button
                          key={`${s.lng},${s.lat},${s.placeName}`}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setOriginQuery(s.cityName);
                            form.setValue("sourceCity", s.cityName, { shouldValidate: true });
                            form.setValue("sourceLat", s.lat, { shouldValidate: true });
                            form.setValue("sourceLng", s.lng, { shouldValidate: true });
                            setOriginOpen(false);
                          }}
                        >
                          <div className="font-medium">{s.cityName}</div>
                          <div className="text-xs text-muted-foreground">{s.placeName}</div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {form.formState.errors.sourceCity ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.sourceCity.message}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="destination">Destination</Label>
                <div className="relative">
                  <Input
                    id="destination"
                    placeholder={canUseMapbox ? "Nashik" : "Set Mapbox token to search"}
                    value={destinationQuery}
                    onFocus={() => setDestinationOpen(true)}
                    onBlur={() => window.setTimeout(() => setDestinationOpen(false), 150)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDestinationQuery(v);
                      form.setValue("destinationCity", v, { shouldValidate: true });
                      form.setValue("destLat", 0, { shouldValidate: false });
                      form.setValue("destLng", 0, { shouldValidate: false });
                    }}
                    disabled={!canUseMapbox}
                  />

                  {destinationOpen && destinationSuggestions.items.length ? (
                    <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-card">
                      {destinationSuggestions.items.map((s) => (
                        <button
                          key={`${s.lng},${s.lat},${s.placeName}`}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setDestinationQuery(s.cityName);
                            form.setValue("destinationCity", s.cityName, { shouldValidate: true });
                            form.setValue("destLat", s.lat, { shouldValidate: true });
                            form.setValue("destLng", s.lng, { shouldValidate: true });
                            setDestinationOpen(false);
                          }}
                        >
                          <div className="font-medium">{s.cityName}</div>
                          <div className="text-xs text-muted-foreground">{s.placeName}</div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {form.formState.errors.destinationCity ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.destinationCity.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="requiredSeats">Passengers</Label>
                <Input
                  id="requiredSeats"
                  type="number"
                  min={1}
                  max={10}
                  {...form.register("requiredSeats")}
                />
              </div>

              <div className="grid gap-2">
                <Label className="text-transparent">Search</Label>
                <Button type="submit" disabled={ridesQuery.isFetching}>
                  {ridesQuery.isFetching ? "Searching…" : "Search"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {rides.length ? (
        canUseMapbox ? (
          <Card>
            <CardHeader>
              <CardTitle>Map</CardTitle>
              <CardDescription>Routes preview (matched legs highlighted).</CardDescription>
            </CardHeader>
            <CardContent className="h-[420px] overflow-hidden rounded-lg border p-0">
              <Map
                ref={mapRef}
                mapboxAccessToken={env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!}
                mapStyle="mapbox://styles/mapbox/streets-v12"
                initialViewState={{
                  longitude: params?.sourceLng ?? 73.8567,
                  latitude: params?.sourceLat ?? 18.5204,
                  zoom: 7,
                }}
              >
                {params ? (
                  <>
                    <Marker
                      longitude={params.sourceLng}
                      latitude={params.sourceLat}
                      anchor="bottom"
                    >
                      <div className="h-3 w-3 rounded-full bg-primary ring-4 ring-primary/20" />
                    </Marker>
                    <Marker
                      longitude={params.destLng}
                      latitude={params.destLat}
                      anchor="bottom"
                    >
                      <div className="h-3 w-3 rounded-full bg-primary ring-4 ring-primary/20" />
                    </Marker>
                  </>
                ) : null}

                {fullRouteFeatures.length ? (
                  <Source id="search-routes" type="geojson" data={fullRoutes}>
                    <Layer
                      id="search-routes-layer"
                      type="line"
                      paint={{
                        "line-color": muted,
                        "line-width": 3,
                        "line-opacity": 0.35,
                      }}
                    />
                  </Source>
                ) : null}

                {legFeatures.length ? (
                  <Source id="search-legs" type="geojson" data={legs}>
                    <Layer
                      id="search-legs-layer"
                      type="line"
                      paint={{
                        "line-color": primary,
                        "line-width": 5,
                        "line-opacity": 0.85,
                      }}
                    />
                  </Source>
                ) : null}
              </Map>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Mapbox token required</CardTitle>
              <CardDescription>
                Set <span className="font-mono">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</span> to
                render route polylines.
              </CardDescription>
            </CardHeader>
          </Card>
        )
      ) : null}

      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Results</h2>
        </div>

        {ridesQuery.isError ? (
          <Card>
            <CardHeader>
              <CardTitle>Search failed</CardTitle>
              <CardDescription>
                {ridesQuery.error instanceof Error
                  ? ridesQuery.error.message
                  : "Unknown error"}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {rides.length === 0 && params && !ridesQuery.isFetching && !ridesQuery.isError ? (
          <Card>
            <CardHeader>
              <CardTitle>No rides found</CardTitle>
              <CardDescription>
                Try a different time or change origin/destination.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {rides.map((ride) => {
          const pickup = stopName(ride.routeStops, ride.pickupStopOrder);
          const dropoff = stopName(ride.routeStops, ride.dropoffStopOrder);

          const url = (() => {
            const qs = new URLSearchParams({
              pickupStopOrder: String(ride.pickupStopOrder),
              dropoffStopOrder: String(ride.dropoffStopOrder),
              seatCount: String(params?.requiredSeats ?? 1),
            });
            return `/passenger/rides/${ride.rideId}?${qs.toString()}`;
          })();

          return (
            <Card key={ride.rideId}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="grid gap-1">
                    <CardTitle className="text-base">
                      {ride.sourceCity} → {ride.destinationCity}
                    </CardTitle>
                    <CardDescription>
                      Departs {formatDateTime(ride.departureTime)}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={ride.availableSeats > 0 ? "secondary" : "outline"}>
                      {ride.availableSeats} seats
                    </Badge>
                    <span className="text-sm font-medium">
                      ${ride.estimatedPricePerSeat} / seat
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Matched leg: {pickup} → {dropoff} • Rating {ride.driverRating}
              </CardContent>
              <CardFooter className="justify-end">
                <Button asChild>
                  <Link href={url}>View ride</Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
