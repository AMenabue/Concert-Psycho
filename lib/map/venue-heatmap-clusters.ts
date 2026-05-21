import type { VenueHeatmapSpot } from "@/lib/map/venue-heatmap-types";
import type { LatLngExpression, Map as LeafletMap } from "leaflet";
import L from "leaflet";

/** Sotto questa soglia i click raggruppano per città (blob unico in heat). */
export const CITY_HEAT_ZOOM_MAX = 11;

export type VenueHeatmapCityVenue = {
  name: string;
  concertCount: number;
};

export type VenueHeatmapCityCluster = {
  key: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  venueCount: number;
  concertCount: number;
  venues: VenueHeatmapCityVenue[];
  artistNames: string[];
};

export type HeatmapClickSelection =
  | { kind: "city"; cluster: VenueHeatmapCityCluster }
  | { kind: "venue"; spot: VenueHeatmapSpot };

function cityKey(spot: VenueHeatmapSpot): string {
  const city = spot.city.trim() || "—";
  const country = spot.country.trim();
  return `${city}|${country}`;
}

export function buildCityClusters(
  points: VenueHeatmapSpot[],
): VenueHeatmapCityCluster[] {
  const byKey = new Map<string, VenueHeatmapSpot[]>();
  for (const p of points) {
    const key = cityKey(p);
    const list = byKey.get(key) ?? [];
    list.push(p);
    byKey.set(key, list);
  }

  const clusters: VenueHeatmapCityCluster[] = [];
  for (const [key, venues] of byKey) {
    if (venues.length === 0) continue;
    let wSum = 0;
    let lat = 0;
    let lng = 0;
    let concerts = 0;
    const artists = new Set<string>();
    for (const v of venues) {
      const w = Math.max(1, v.concertCount);
      lat += v.lat * w;
      lng += v.lng * w;
      wSum += w;
      concerts += v.concertCount;
      for (const name of v.artistNames) artists.add(name);
    }
    const first = venues[0]!;
    const venueRows: VenueHeatmapCityVenue[] = venues
      .map((v) => ({ name: v.venueName, concertCount: v.concertCount }))
      .sort((a, b) => {
        if (b.concertCount !== a.concertCount) return b.concertCount - a.concertCount;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
    clusters.push({
      key,
      city: first.city.trim() || "—",
      country: first.country.trim(),
      lat: lat / wSum,
      lng: lng / wSum,
      venueCount: venues.length,
      concertCount: concerts,
      venues: venueRows,
      artistNames: Array.from(artists).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" }),
      ),
    });
  }
  return clusters;
}

type PixelTarget = { lat: number; lng: number };

function nearestByPixels<T extends PixelTarget>(
  map: LeafletMap,
  latlng: L.LatLng,
  items: T[],
  maxPx: number,
): T | null {
  if (items.length === 0) return null;
  const clickPt = map.latLngToContainerPoint(latlng);
  let best: T | null = null;
  let bestDist = maxPx;
  for (const item of items) {
    const pt = map.latLngToContainerPoint([item.lat, item.lng] as LatLngExpression);
    const d = clickPt.distanceTo(pt);
    if (d < bestDist) {
      bestDist = d;
      best = item;
    }
  }
  return best;
}

/** Click sulla heat: città aggregata se zoom basso, venue se zoom alto. */
export function pickHeatmapClickTarget(
  map: LeafletMap,
  latlng: L.LatLng,
  points: VenueHeatmapSpot[],
  clusters: VenueHeatmapCityCluster[],
  zoom: number,
): HeatmapClickSelection | null {
  const cityMode = zoom < CITY_HEAT_ZOOM_MAX;
  const cityHitPx = 56 + Math.max(0, CITY_HEAT_ZOOM_MAX - zoom) * 8;
  const venueHitPx = 28 + Math.max(0, 14 - zoom) * 2;

  if (cityMode) {
    const multi = clusters.filter((c) => c.venueCount > 1);
    const city = nearestByPixels(map, latlng, multi, cityHitPx);
    if (city) return { kind: "city", cluster: city };
  }

  const venue = nearestByPixels(map, latlng, points, venueHitPx);
  if (venue) return { kind: "venue", spot: venue };
  return null;
}
