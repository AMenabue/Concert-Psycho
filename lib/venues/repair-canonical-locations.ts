import {
  canonicalCityName,
  canonicalVenueFromSetlist,
} from "@/lib/geo/canonical-location";
import type { createClient } from "@/lib/supabase/server";

type Supabase = ReturnType<typeof createClient>;

/** Align stored venue city/name with metro + known venue templates (existing rows). */
export async function repairCanonicalVenueLocationsForUser(
  supabase: Supabase,
  userId: string,
): Promise<{ venuesScanned: number; venuesUpdated: number }> {
  const { data: attRows } = await supabase
    .from("gig_attendances")
    .select("gig_id")
    .eq("user_id", userId);

  const gigIds = Array.from(
    new Set((attRows ?? []).map((r) => r.gig_id as string).filter(Boolean)),
  );
  if (gigIds.length === 0) {
    return { venuesScanned: 0, venuesUpdated: 0 };
  }

  const { data: gigs } = await supabase
    .from("gigs")
    .select("venue_id")
    .in("id", gigIds);

  const venueIds = Array.from(
    new Set((gigs ?? []).map((g) => g.venue_id as string).filter(Boolean)),
  );
  if (venueIds.length === 0) {
    return { venuesScanned: 0, venuesUpdated: 0 };
  }

  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, city, country")
    .in("id", venueIds);

  let venuesUpdated = 0;
  for (const v of venues ?? []) {
    const id = v.id as string;
    const name = String(v.name ?? "").trim();
    const city = String(v.city ?? "").trim();
    const country = String(v.country ?? "").trim();
    const canon = canonicalVenueFromSetlist({ name, city, country });
    const canonCity = canonicalCityName(city, country);
    const nextCity = canon.city || canonCity;
    const nextName = canon.name || name;
    if (nextName === name && nextCity === city) continue;
    const { error } = await supabase
      .from("venues")
      .update({ name: nextName, city: nextCity })
      .eq("id", id);
    if (!error) venuesUpdated += 1;
  }

  return { venuesScanned: venues?.length ?? 0, venuesUpdated };
}
