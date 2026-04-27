"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import type { Feature, FeatureCollection, LineString } from "geojson";

import Map, { Layer, Marker, Source, type MapRef } from "react-map-gl/mapbox";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { env } from "@/config/env";
import { createRide } from "@/features/rides/api/ridesApi";
import { listVehicles } from "@/features/vehicles/api/vehiclesApi";
import { toDatetimeLocalValue } from "@/lib/format/date";
import { getRouteAlternatives, type MapboxRoute } from "@/lib/mapbox/directions";
import {
  geocodePlaces,
  reverseGeocodeCity,
  type PlaceSuggestion,
} from "@/lib/mapbox/geocoding";
import { queryKeys } from "@/lib/query/keys";

const DEFAULT_DEPARTURE_TIME_LOCAL = toDatetimeLocalValue(Date.now() + 2 * 60 * 60 * 1000);

const PublishSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle is required"),
  sourceCity: z.string().min(1, "Source city is required"),
  destinationCity: z.string().min(1, "Destination city is required"),
  sourceLat: z.coerce.number(),
  sourceLng: z.coerce.number(),
  destLat: z.coerce.number(),
  destLng: z.coerce.number(),
  departureTimeLocal: z.string().min(1, "Departure time is required"),
  pricePerSeat: z.coerce.number().nonnegative(),
  approvalMode: z.enum(["AUTO", "MANUAL"]).default("AUTO"),
}).superRefine((v, ctx) => {
  const srcOk = Number.isFinite(v.sourceLat) && Number.isFinite(v.sourceLng) && (v.sourceLat !== 0 || v.sourceLng !== 0);
  const dstOk = Number.isFinite(v.destLat) && Number.isFinite(v.destLng) && (v.destLat !== 0 || v.destLng !== 0);
  if (!srcOk) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["sourceCity"], message: "Select a source city from suggestions" });
  }
  if (!dstOk) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["destinationCity"], message: "Select a destination city from suggestions" });
  }
});

type PublishFormInput = z.input<typeof PublishSchema>;
type PublishValues = z.output<typeof PublishSchema>;

type StopDraft = {
  stopOrder: number;
  cityName: string;
  latitude: number;
  longitude: number;
  included: boolean;
  cityResolved: boolean;
};

type PayloadStop = {
  stopOrder: number;
  cityName: string;
  latitude: number;
  longitude: number;
};

function computeSelectedStops(stops: StopDraft[]): PayloadStop[] {
  const ordered = stops.slice().sort((a, b) => a.stopOrder - b.stopOrder);
  if (ordered.length < 2) return [];

  const firstOrder = ordered[0]!.stopOrder;
  const lastOrder = ordered[ordered.length - 1]!.stopOrder;

  const selected = ordered.filter(
    (s) => s.included || s.stopOrder === firstOrder || s.stopOrder === lastOrder
  );

  return selected.map((s, idx) => ({
    stopOrder: idx,
    cityName: s.cityName,
    latitude: s.latitude,
    longitude: s.longitude,
  }));
}

function metersToKm(meters: number) {
  return `${(meters / 1000).toFixed(1)} km`;
}

function secondsToMinutes(seconds: number) {
  return `${Math.round(seconds / 60)} min`;
}

function sampleRouteStops(options: {
  route: MapboxRoute;
  sourceCity: string;
  destinationCity: string;
  maxStops?: number;
}) {
  const coords = options.route.geometry.coordinates;
  const maxStops = options.maxStops ?? 12;

  if (!coords.length) return [] as StopDraft[];

  const sampleCount = Math.max(2, Math.min(maxStops, coords.length));
  const indices = new Set<number>();

  for (let i = 0; i < sampleCount; i++) {
    const idx = Math.floor((i * (coords.length - 1)) / (sampleCount - 1));
    indices.add(idx);
  }

  const sortedIdx = Array.from(indices).sort((a, b) => a - b);
  const sampled = sortedIdx.map((i) => coords[i]!).map(([lng, lat]) => ({ lng, lat }));

  return sampled.map((p, i) => {
    const isFirst = i === 0;
    const isLast = i === sampled.length - 1;
    const cityName = isFirst
      ? options.sourceCity
      : isLast
        ? options.destinationCity
        : "";

    return {
      stopOrder: i,
      cityName,
      latitude: p.lat,
      longitude: p.lng,
      included: isFirst || isLast,
      cityResolved: isFirst || isLast,
    };
  });
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

  return {
    minLng,
    minLat,
    maxLng,
    maxLat,
  };
}

function useThemeMapColors() {
  const [colors, setColors] = React.useState<{ primary: string; muted: string } | null>(null);

  React.useEffect(() => {
    const s = getComputedStyle(document.documentElement);
    const primary = s.getPropertyValue("--primary").trim() || "hsl(222.2 47.4% 11.2%)";
    const muted =
      s.getPropertyValue("--muted-foreground").trim() || "hsl(215.4 16.3% 46.9%)";
    setColors({ primary, muted });
  }, []);

  return colors;
}

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

export function PublishRideScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mapRef = React.useRef<MapRef | null>(null);

  const themeColors = useThemeMapColors();

  const vehiclesQuery = useQuery({
    queryKey: queryKeys.vehicles,
    queryFn: listVehicles,
  });

  const [routes, setRoutes] = React.useState<MapboxRoute[] | null>(null);
  const [selectedRouteIdx, setSelectedRouteIdx] = React.useState<number>(0);
  const [stops, setStops] = React.useState<StopDraft[]>([]);
  const [sourceOpen, setSourceOpen] = React.useState(false);
  const [destinationOpen, setDestinationOpen] = React.useState(false);

  const stopsGenerationRef = React.useRef(0);

  const canUseMapbox = Boolean(env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN);

  const form = useForm<PublishFormInput>({
    resolver: zodResolver(PublishSchema),
    defaultValues: {
      vehicleId: "",
      sourceCity: "",
      destinationCity: "",
      sourceLat: 0,
      sourceLng: 0,
      destLat: 0,
      destLng: 0,
      departureTimeLocal: DEFAULT_DEPARTURE_TIME_LOCAL,
      pricePerSeat: 10,
      approvalMode: "AUTO",
    },
  });

  const watchedVehicleId = useWatch({ control: form.control, name: "vehicleId" });
  const watchedApprovalMode = useWatch({ control: form.control, name: "approvalMode" });

  const directionsMutation = useMutation({
    mutationFn: async (values: PublishValues) => {
      const alternatives = await getRouteAlternatives({
        source: { lat: values.sourceLat, lng: values.sourceLng },
        destination: { lat: values.destLat, lng: values.destLng },
      });

      return alternatives;
    },
    onSuccess: (alts, values) => {
      setRoutes(alts);
      setSelectedRouteIdx(0);
      const nextStops = alts[0]
        ? sampleRouteStops({
          route: alts[0],
          sourceCity: values.sourceCity,
          destinationCity: values.destinationCity,
        })
        : [];

      stopsGenerationRef.current += 1;
      setStops(nextStops);
      toast.success(`${alts.length} route option${alts.length === 1 ? "" : "s"} found`);
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (values: PublishValues) => {
      const ms = new Date(values.departureTimeLocal).getTime();

      const selectedStops = computeSelectedStops(stops);

      if (selectedStops.length < 2) {
        throw new Error("Generate stops by selecting a route first");
      }

      if (selectedStops.some((s) => !s.cityName.trim())) {
        throw new Error("Each stop must have a city name");
      }

      return createRide({
        vehicleId: values.vehicleId,
        sourceCity: values.sourceCity,
        destinationCity: values.destinationCity,
        departureTime: ms,
        pricePerSeat: values.pricePerSeat,
        approvalMode: values.approvalMode,
        stops: selectedStops,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.rides });
      toast.success("Ride published");
      router.push("/driver/rides");
    },
  });

  // Resolve intermediate stop city names from coordinates.
  React.useEffect(() => {
    if (!canUseMapbox) return;
    if (stops.length < 3) return;

    const generation = stopsGenerationRef.current;
    const ordered = stops.slice().sort((a, b) => a.stopOrder - b.stopOrder);
    const firstOrder = ordered[0]!.stopOrder;
    const lastOrder = ordered[ordered.length - 1]!.stopOrder;

    const pending = ordered.filter(
      (s) =>
        !s.cityResolved &&
        s.stopOrder !== firstOrder &&
        s.stopOrder !== lastOrder
    );

    if (pending.length === 0) return;

    let cancelled = false;
    (async () => {
      const updates = new globalThis.Map<
        number,
        { cityName?: string; cityResolved: boolean }
      >();

      for (const s of pending) {
        if (cancelled) return;
        try {
          const res = await reverseGeocodeCity(s.latitude, s.longitude);
          updates.set(s.stopOrder, {
            cityName: res.cityName,
            cityResolved: true,
          });
        } catch {
          updates.set(s.stopOrder, { cityResolved: true });
        }
      }

      if (cancelled) return;
      if (stopsGenerationRef.current !== generation) return;

      setStops((prev) =>
        prev.map((s) => {
          const u = updates.get(s.stopOrder);
          if (!u) return s;
          return {
            ...s,
            cityName:
              s.cityName.trim().length > 0 ? s.cityName : (u.cityName ?? s.cityName),
            cityResolved: u.cityResolved,
          };
        })
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [canUseMapbox, stops]);

  React.useEffect(() => {
    if (!routes || !routes[selectedRouteIdx]) return;
    const coords = routes[selectedRouteIdx]!.geometry.coordinates;
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
  }, [routes, selectedRouteIdx]);

  const vehicles = vehiclesQuery.data?.vehicles ?? [];

  const selectedRoute = routes?.[selectedRouteIdx] ?? null;

  const selectedLine: Feature<LineString> | null = selectedRoute
    ? {
      type: "Feature",
      properties: { selected: true },
      geometry: selectedRoute.geometry,
    }
    : null;

  const altLines: Array<Feature<LineString>> = routes
    ? routes.flatMap((r, idx): Array<Feature<LineString>> =>
      idx === selectedRouteIdx
        ? []
        : [
          {
            type: "Feature",
            properties: { idx },
            geometry: r.geometry,
          },
        ]
    )
    : [];

  const altFeatureCollection: FeatureCollection<LineString> = {
    type: "FeatureCollection",
    features: altLines,
  };

  const primary = themeColors?.primary ?? "hsl(222.2 47.4% 11.2%)";
  const muted = themeColors?.muted ?? "hsl(215.4 16.3% 46.9%)";

  const watchedSourceCity = useWatch({ control: form.control, name: "sourceCity" });
  const watchedDestinationCity = useWatch({ control: form.control, name: "destinationCity" });

  const sourceSuggestions = useCitySuggestions(watchedSourceCity ?? "", canUseMapbox && sourceOpen);
  const destinationSuggestions = useCitySuggestions(
    watchedDestinationCity ?? "",
    canUseMapbox && destinationOpen
  );

  const onFindRoutes = form.handleSubmit(async (values) => {
    if (!canUseMapbox) {
      toast.error("Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to use directions");
      return;
    }

    try {
      const parsed = PublishSchema.safeParse(values);
      if (!parsed.success) {
        toast.error("Fix ride inputs first");
        return;
      }

      await directionsMutation.mutateAsync(parsed.data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load routes";
      toast.error(message);
    }
  });

  const onSelectRoute = (idx: number) => {
    const values = form.getValues();
    const route = routes?.[idx];
    if (!route) return;

    setSelectedRouteIdx(idx);
    const nextStops = sampleRouteStops({
      route,
      sourceCity: values.sourceCity,
      destinationCity: values.destinationCity,
    });
    stopsGenerationRef.current += 1;
    setStops(nextStops);
  };

  const onPublish = form.handleSubmit(async (values) => {
    try {
      const parsed = PublishSchema.safeParse(values);
      if (!parsed.success) {
        toast.error("Fix ride inputs first");
        return;
      }

      await publishMutation.mutateAsync(parsed.data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to publish ride";
      toast.error(message);
    }
  });

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Publish ride"
        description="Choose a route, review stops, then publish."
        right={
          <Button variant="outline" asChild>
            <Link href="/driver/rides">Back</Link>
          </Button>
        }
      />

      {!canUseMapbox ? (
        <Card>
          <CardHeader>
            <CardTitle>Mapbox token required</CardTitle>
            <CardDescription>
              Set <span className="font-mono">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</span> in
              <span className="font-mono"> apps/web/.env.local</span>.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {vehicles.length === 0 && !vehiclesQuery.isPending ? (
        <Card>
          <CardHeader>
            <CardTitle>No vehicles</CardTitle>
            <CardDescription>Add a vehicle before publishing rides.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link href="/driver/vehicles">Add vehicle</Link>
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Ride info</CardTitle>
          <CardDescription>Used for pricing and publishing.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Vehicle</Label>
                <Select
                  value={watchedVehicleId ?? ""}
                  onValueChange={(v) =>
                    form.setValue("vehicleId", v ?? "", { shouldValidate: true })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.vehicleId} value={v.vehicleId}>
                        {v.make} {v.model} • {v.licensePlate}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.vehicleId ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.vehicleId.message}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="pricePerSeat">Price / seat</Label>
                <Input id="pricePerSeat" type="number" min={0} {...form.register("pricePerSeat")} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="sourceCity">Source city</Label>
                <div className="relative">
                  <Input
                    id="sourceCity"
                    placeholder={canUseMapbox ? "Pune" : "Set Mapbox token to search"}
                    {...form.register("sourceCity")}
                    onFocus={() => setSourceOpen(true)}
                    onBlur={() => window.setTimeout(() => setSourceOpen(false), 150)}
                    onChange={(e) => {
                      const v = e.target.value;
                      form.setValue("sourceCity", v, { shouldValidate: true });
                      form.setValue("sourceLat", 0, { shouldValidate: false });
                      form.setValue("sourceLng", 0, { shouldValidate: false });
                    }}
                    disabled={!canUseMapbox}
                  />

                  {sourceOpen && sourceSuggestions.items.length ? (
                    <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-card">
                      {sourceSuggestions.items.map((s) => (
                        <button
                          key={`${s.lng},${s.lat},${s.placeName}`}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                          onMouseDown={(ev) => ev.preventDefault()}
                          onClick={() => {
                            form.setValue("sourceCity", s.cityName, { shouldValidate: true });
                            form.setValue("sourceLat", s.lat, { shouldValidate: true });
                            form.setValue("sourceLng", s.lng, { shouldValidate: true });
                            setSourceOpen(false);
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
                <Label htmlFor="destinationCity">Destination city</Label>
                <div className="relative">
                  <Input
                    id="destinationCity"
                    placeholder={canUseMapbox ? "Nashik" : "Set Mapbox token to search"}
                    {...form.register("destinationCity")}
                    onFocus={() => setDestinationOpen(true)}
                    onBlur={() => window.setTimeout(() => setDestinationOpen(false), 150)}
                    onChange={(e) => {
                      const v = e.target.value;
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
                          onMouseDown={(ev) => ev.preventDefault()}
                          onClick={() => {
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

              <div className="grid gap-2">
                <Label htmlFor="departureTimeLocal">Departure time</Label>
                <Input
                  id="departureTimeLocal"
                  type="datetime-local"
                  {...form.register("departureTimeLocal")}
                />
              </div>

              <div className="grid gap-2">
                <Label>Approval mode</Label>
                <Select
                  value={watchedApprovalMode ?? "AUTO"}
                  onValueChange={(v) => {
                    if (v == null) return;
                    form.setValue("approvalMode", v, { shouldValidate: true });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUTO">AUTO</SelectItem>
                    <SelectItem value="MANUAL">MANUAL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={onFindRoutes}
                disabled={directionsMutation.isPending || !canUseMapbox}
              >
                {directionsMutation.isPending ? "Loading routes…" : "Find routes"}
              </Button>
              <Button
                type="button"
                onClick={onPublish}
                disabled={
                  publishMutation.isPending ||
                  vehicles.length === 0 ||
                  computeSelectedStops(stops).length < 2
                }
              >
                {publishMutation.isPending ? "Publishing…" : "Publish"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {routes ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Route options</CardTitle>
              <CardDescription>Select the route you will take.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {routes.map((r, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="w-full text-left"
                  onClick={() => onSelectRoute(idx)}
                >
                  <div className="rounded-lg border bg-card p-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="grid gap-1">
                        <div className="text-sm font-medium">Option {idx + 1}</div>
                        <div className="text-xs text-muted-foreground">
                          {metersToKm(r.distance)} • {secondsToMinutes(r.duration)}
                        </div>
                      </div>
                      <Badge variant={idx === selectedRouteIdx ? "secondary" : "outline"}>
                        {idx === selectedRouteIdx ? "Selected" : "Select"}
                      </Badge>
                    </div>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Map</CardTitle>
              <CardDescription>Routes preview (selected highlighted).</CardDescription>
            </CardHeader>
            <CardContent className="h-[420px] overflow-hidden rounded-lg border p-0">
              <Map
                ref={mapRef}
                mapboxAccessToken={env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!}
                mapStyle="mapbox://styles/mapbox/streets-v12"
                initialViewState={{
                  longitude: Number(form.getValues("sourceLng")),
                  latitude: Number(form.getValues("sourceLat")),
                  zoom: 7,
                }}
              >
                <Marker
                  longitude={Number(form.getValues("sourceLng"))}
                  latitude={Number(form.getValues("sourceLat"))}
                  anchor="bottom"
                >
                  <div className="h-3 w-3 rounded-full bg-primary ring-4 ring-primary/20" />
                </Marker>
                <Marker
                  longitude={Number(form.getValues("destLng"))}
                  latitude={Number(form.getValues("destLat"))}
                  anchor="bottom"
                >
                  <div className="h-3 w-3 rounded-full bg-primary ring-4 ring-primary/20" />
                </Marker>

                {altLines.length ? (
                  <Source
                    id="alt-routes"
                    type="geojson"
                    data={altFeatureCollection}
                  >
                    <Layer
                      id="alt-routes-layer"
                      type="line"
                      paint={{
                        "line-color": muted,
                        "line-width": 3,
                        "line-opacity": 0.5,
                      }}
                    />
                  </Source>
                ) : null}

                {selectedLine ? (
                  <Source id="selected-route" type="geojson" data={selectedLine}>
                    <Layer
                      id="selected-route-layer"
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
        </div>
      ) : null}

      {stops.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Stops</CardTitle>
            <CardDescription>
              Select the cities where you want to stop (source and destination are required).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {stops.map((s, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === stops.length - 1;
              const isRequired = isFirst || isLast;

              return (
                <div
                  key={s.stopOrder}
                  className="grid items-center gap-2 rounded-lg border p-3 sm:grid-cols-12"
                >
                  <div className="sm:col-span-1">
                    <Badge variant="outline">{idx}</Badge>
                  </div>
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={isRequired ? true : s.included}
                      disabled={isRequired}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setStops((prev) =>
                          prev.map((p) =>
                            p.stopOrder === s.stopOrder
                              ? { ...p, included: next }
                              : p
                          )
                        );
                      }}
                    />
                    <span className="text-xs text-muted-foreground">Stop</span>
                  </div>
                  <div className="grid gap-1 sm:col-span-9">
                    <Label className="text-xs">City</Label>
                    <Input
                      value={s.cityName}
                      placeholder={
                        s.cityName.trim().length > 0
                          ? ""
                          : s.cityResolved
                            ? "City"
                            : "Resolving city…"
                      }
                      readOnly={isRequired || !s.included}
                      onChange={(e) => {
                        const v = e.target.value;
                        setStops((prev) =>
                          prev.map((p) =>
                            p.stopOrder === s.stopOrder ? { ...p, cityName: v } : p
                          )
                        );
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            Only selected stops are published.
          </CardFooter>
        </Card>
      ) : null}
    </div>
  );
}
