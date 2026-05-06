import { env } from "@/config/env";

export type MapboxRoute = {
  geometry: {
    type: "LineString";
    coordinates: Array<[number, number]>; // [lng, lat]
  };
  distance: number; // meters
  duration: number; // seconds
};

type MapboxDirectionsResponse = {
  code?: string;
  message?: string;
  routes?: MapboxRoute[];
};

function sampleKeyFromCoords(coords: Array<[number, number]>, sampleCount: number) {
  if (!coords.length) return "";
  const n = coords.length;
  const count = Math.max(2, Math.min(sampleCount, n));
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor((i * (n - 1)) / (count - 1));
    const [lng, lat] = coords[idx]!;
    parts.push(`${lng.toFixed(4)},${lat.toFixed(4)}`);
  }
  return parts.join("|");
}

function routeKey(route: MapboxRoute) {
  const coords = route.geometry.coordinates;
  return `${coords.length}:${sampleKeyFromCoords(coords, 10)}`;
}

async function fetchDirectionsRoutes(options: {
  profile: "driving" | "driving-traffic" | "walking" | "cycling";
  source: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  alternatives: boolean;
  exclude?: string;
}) {
  const token = env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) {
    throw new Error("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN is not set");
  }

  const url = new URL(
    `https://api.mapbox.com/directions/v5/mapbox/${options.profile}/${options.source.lng},${options.source.lat};${options.destination.lng},${options.destination.lat}`
  );
  url.searchParams.set("alternatives", options.alternatives ? "true" : "false");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("overview", "full");
  if (options.exclude) url.searchParams.set("exclude", options.exclude);
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString());
  const json = (await res.json().catch(() => null)) as MapboxDirectionsResponse | null;

  if (!res.ok) {
    const message = json?.message || `Directions request failed (${res.status})`;
    throw new Error(message);
  }

  if (json?.code && json.code !== "Ok") {
    throw new Error(json.message || `Directions request failed (${json.code})`);
  }

  const routes = json?.routes;
  if (!routes || !Array.isArray(routes) || routes.length === 0) {
    throw new Error("No route alternatives returned");
  }

  return routes;
}

export async function getRouteAlternatives(params: {
  source: { lat: number; lng: number };
  destination: { lat: number; lng: number };
}) {
  const baseRoutes = await fetchDirectionsRoutes({
    profile: "driving",
    source: params.source,
    destination: params.destination,
    alternatives: true,
  });

  // Mapbox may return only 1 route for many pairs. If that happens, try a couple
  // of safe variants to produce 2–3 usable options for the UI.
  const routes: MapboxRoute[] = [];
  const keys = new Set<string>();
  for (const r of baseRoutes) {
    const key = routeKey(r);
    if (keys.has(key)) continue;
    keys.add(key);
    routes.push(r);
    if (routes.length >= 3) break;
  }

  if (routes.length < 2) {
    const variants = ["toll", "motorway"];
    const results = await Promise.allSettled(
      variants.map((exclude) =>
        fetchDirectionsRoutes({
          profile: "driving",
          source: params.source,
          destination: params.destination,
          alternatives: false,
          exclude,
        })
      )
    );

    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      const [first] = r.value;
      if (!first) continue;
      const key = routeKey(first);
      if (keys.has(key)) continue;
      keys.add(key);
      routes.push(first);
      if (routes.length >= 3) break;
    }
  }

  return routes;
}

export async function getRouteThroughStops(params: {
  stops: Array<{ lat: number; lng: number }>;
}) {
  const token = env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) {
    throw new Error("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN is not set");
  }

  const stops = params.stops.filter(
    (s) => Number.isFinite(s.lat) && Number.isFinite(s.lng)
  );

  if (stops.length < 2) {
    throw new Error("At least 2 stops are required");
  }

  // Mapbox Directions supports up to 25 coordinates per request (including endpoints).
  if (stops.length > 25) {
    throw new Error("Too many stops for directions (max 25)");
  }

  const coords = stops.map((s) => `${s.lng},${s.lat}`).join(";");
  const url = new URL(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}`
  );
  url.searchParams.set("alternatives", "false");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("overview", "full");
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString());
  const json = (await res.json().catch(() => null)) as MapboxDirectionsResponse | null;

  if (!res.ok) {
    const message = json?.message || `Directions request failed (${res.status})`;
    throw new Error(message);
  }

  const route = json?.routes?.[0];
  if (!route) {
    throw new Error("No route returned");
  }

  return route;
}
