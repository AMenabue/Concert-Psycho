const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
/** Policy Nominatim: User-Agent identificabile. */
const NOMINATIM_UA = "ConcertArchive/1.0 (https://github.com/)";

export type NominatimHit = { lat: string; lon: string };

/**
 * Primo risultato Nominatim per la query (città + paese consigliato).
 */
export async function nominatimSearchFirst(
  query: string,
): Promise<{ lat: number; lng: number } | null> {
  const q = query.trim();
  if (!q) return null;
  const url = `${NOMINATIM_URL}?${new URLSearchParams({
    q,
    format: "json",
    limit: "1",
  }).toString()}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": NOMINATIM_UA,
      Accept: "application/json",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as NominatimHit[];
  if (!Array.isArray(json) || json.length < 1) return null;
  const hit = json[0];
  const lat = Number.parseFloat(hit.lat);
  const lng = Number.parseFloat(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}
