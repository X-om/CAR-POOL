import { env } from "@/config/env";

type MapboxGeocodingFeature = {
  place_name?: string;
  text?: string;
  center?: [number, number]; // [lng, lat]
};

type MapboxGeocodingResponse = {
  message?: string;
  features?: MapboxGeocodingFeature[];
};

export type PlaceSuggestion = {
  placeName: string;
  cityName: string;
  lat: number;
  lng: number;
};

function toSuggestion(feature: MapboxGeocodingFeature, fallbackLabel: string): PlaceSuggestion | null {
  const center = feature.center;
  if (!center || center.length < 2 || typeof center[0] !== "number" || typeof center[1] !== "number") {
    return null;
  }

  const placeName = feature.place_name?.trim() || fallbackLabel;
  const cityName = (feature.text?.trim() || placeName.split(",")[0]?.trim() || placeName).trim();

  return {
    placeName,
    cityName,
    lng: center[0],
    lat: center[1],
  };
}

export async function geocodePlaces(
  query: string,
  options?: { limit?: number }
): Promise<PlaceSuggestion[]> {
  const token = env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) {
    throw new Error("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN is not set");
  }

  const q = query.trim();
  if (!q) throw new Error("Query is required");

  const limit = Math.max(1, Math.min(10, options?.limit ?? 5));

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("types", "place,locality");

  const res = await fetch(url.toString());
  const json = (await res.json().catch(() => null)) as MapboxGeocodingResponse | null;

  if (!res.ok) {
    const message = json?.message || `Geocoding request failed (${res.status})`;
    throw new Error(message);
  }

  const features = json?.features ?? [];
  const suggestions = features
    .map((f) => toSuggestion(f, q))
    .filter((s): s is PlaceSuggestion => Boolean(s));

  if (suggestions.length === 0) {
    throw new Error("No geocoding result returned");
  }

  return suggestions;
}

export async function geocodeFirst(query: string): Promise<{ placeName: string; lat: number; lng: number }> {
  const [first] = await geocodePlaces(query, { limit: 1 });
  if (!first) throw new Error("No geocoding result returned");
  return { placeName: first.placeName, lat: first.lat, lng: first.lng };
}

export async function reverseGeocodeCity(lat: number, lng: number): Promise<PlaceSuggestion> {
  const token = env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) {
    throw new Error("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN is not set");
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Valid coordinates are required");
  }

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(`${lng},${lat}`)}.json`
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("limit", "1");
  url.searchParams.set("types", "place");

  const res = await fetch(url.toString());
  const json = (await res.json().catch(() => null)) as MapboxGeocodingResponse | null;

  if (!res.ok) {
    const message = json?.message || `Reverse geocoding request failed (${res.status})`;
    throw new Error(message);
  }

  const feature = json?.features?.[0];
  if (!feature) {
    throw new Error("No reverse geocoding result returned");
  }

  const suggestion = toSuggestion(feature, `${lat},${lng}`);
  if (!suggestion) {
    throw new Error("No reverse geocoding result returned");
  }
  return suggestion;
}
