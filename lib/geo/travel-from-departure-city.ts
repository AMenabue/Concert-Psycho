import { haversineKm } from "@/lib/geo/haversine";
import { nominatimSearchFirst } from "@/lib/geocoding/nominatim";

/** Distanza in km (linea d’aria) da città+paese partenza (geocoding) alla venue. */
export async function travelKmFromDepartureCityToVenue(
  departureCity: string,
  departureCountry: string,
  venueLat: number,
  venueLng: number,
): Promise<number | null> {
  const city = departureCity.trim();
  const country = departureCountry.trim();
  if (!city || !country) return null;
  if (!Number.isFinite(venueLat) || !Number.isFinite(venueLng)) return null;
  const geo = await nominatimSearchFirst(`${city}, ${country}`);
  if (!geo) return null;
  return Math.round(haversineKm(geo.lat, geo.lng, venueLat, venueLng));
}
