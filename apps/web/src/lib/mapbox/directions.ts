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

export async function getRouteAlternatives(params: {
  source: { lat: number; lng: number };
  destination: { lat: number; lng: number };
}) {
  const token = env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) {
    throw new Error("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN is not set");
  }

  const url = new URL(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${params.source.lng},${params.source.lat};${params.destination.lng},${params.destination.lat}`
  );
  url.searchParams.set("alternatives", "true");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("overview", "full");
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString());
  const json = (await res.json().catch(() => null)) as MapboxDirectionsResponse | null;

  if (!res.ok) {
    const message = json?.message || `Directions request failed (${res.status})`;
    throw new Error(message);
  }

  const routes = json?.routes;
  if (!routes || !Array.isArray(routes) || routes.length === 0) {
    throw new Error("No route alternatives returned");
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
