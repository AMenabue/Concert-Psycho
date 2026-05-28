import {
  isCombinedBillingArtistName,
  parseBillingHeadlinerNames,
  resolveBillingNamesForGig,
  resolveGigBillingRoles,
  type LineupRowInput,
} from "@/lib/gigs/billing-headliners";
import type { createClient } from "@/lib/supabase/server";

type Supabase = ReturnType<typeof createClient>;

async function findOrCreateArtistByName(
  supabase: Supabase,
  name: string,
  cache: Map<string, string | null>,
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const key = trimmed.toLowerCase();
  if (cache.has(key)) return cache.get(key) ?? null;

  const { data: candidates } = await supabase
    .from("artists")
    .select("id,name")
    .ilike("name", trimmed)
    .limit(12);

  const hit = (candidates ?? []).find(
    (r) => String(r.name ?? "").trim().toLowerCase() === key,
  );
  if (hit?.id) {
    cache.set(key, hit.id as string);
    return hit.id as string;
  }

  const { data: inserted, error } = await supabase
    .from("artists")
    .insert({ name: trimmed })
    .select("id")
    .single();
  if (error || !inserted?.id) {
    cache.set(key, null);
    return null;
  }
  cache.set(key, inserted.id as string);
  return inserted.id as string;
}

/** Infer joint headliners for repair (Setlist.fm split bill + manual "A & B" artist rows). */
function inferBillingNamesForRepair(
  headlinerName: string,
  lineupNames: string[],
  gigSource: string | null,
  ampersandArtists: { name: string }[],
): string[] {
  if (isCombinedBillingArtistName(headlinerName)) {
    const fromHead = parseBillingHeadlinerNames(headlinerName);
    if (fromHead.length > 1) return fromHead;
  }

  const fromGig = resolveBillingNamesForGig(
    headlinerName,
    lineupNames,
    gigSource,
    ampersandArtists,
  );
  if (fromGig.length > 1) return fromGig;

  for (const ln of lineupNames) {
    if (!isCombinedBillingArtistName(ln)) continue;
    const fromLineup = parseBillingHeadlinerNames(ln);
    if (fromLineup.length > 1) return fromLineup;
  }

  void ampersandArtists;

  return fromGig;
}

/** Fix gigs with Setlist.fm joint billing stored as one artist or wrong line-up roles. */
export async function repairCombinedBillingGigsForUser(
  supabase: Supabase,
  userId: string,
): Promise<void> {
  const { data: attRows } = await supabase
    .from("gig_attendances")
    .select(
      "gig_id, gigs ( id, artist_id, source, artists ( name ) )",
    )
    .eq("user_id", userId);

  if (!attRows?.length) return;

  const { data: ampersandRows } = await supabase
    .from("artists")
    .select("id, name")
    .or("name.ilike.% & %,name.ilike.% / %")
    .limit(80);
  const ampersandArtists = (ampersandRows ?? []).map((r) => ({
    id: r.id as string,
    name: String(r.name ?? "").trim(),
  }));

  const cache = new Map<string, string | null>();
  const artistNameById = new Map<string, string>();

  for (const row of attRows) {
    const g = Array.isArray(row.gigs) ? row.gigs[0] : row.gigs;
    if (!g?.id) continue;
    const ar = g.artists as { name?: string } | { name?: string }[] | null;
    const one = Array.isArray(ar) ? ar[0] : ar;
    const n = String(one?.name ?? "").trim();
    if (n) artistNameById.set(g.artist_id as string, n);
  }

  for (const row of attRows) {
    const g = Array.isArray(row.gigs) ? row.gigs[0] : row.gigs;
    if (!g?.id) continue;
    const gigId = g.id as string;
    const headlinerId = g.artist_id as string;
    const gigSource = (g.source as string | null) ?? null;
    const headlinerName = artistNameById.get(headlinerId) ?? "";

    const { data: lineupRows, error: lineupErr } = await supabase
      .from("gig_lineup_artists")
      .select("artist_id, is_co_headliner, artists ( name )")
      .eq("gig_id", gigId);

    if (lineupErr) continue;

    const lineup: LineupRowInput[] = [];
    for (const lr of lineupRows ?? []) {
      const aid = lr.artist_id as string;
      const a = lr.artists as { name?: string } | { name?: string }[] | null;
      const ao = Array.isArray(a) ? a[0] : a;
      const n = String(ao?.name ?? "").trim();
      if (n) artistNameById.set(aid, n);
      lineup.push({
        artist_id: aid,
        is_co_headliner: Boolean(lr.is_co_headliner),
      });
    }

    const lineupNames = lineup
      .map((r) => artistNameById.get(r.artist_id) ?? "")
      .filter(Boolean);

    const billingNames = inferBillingNamesForRepair(
      headlinerName,
      lineupNames,
      gigSource,
      ampersandArtists,
    );
    if (billingNames.length <= 1) continue;

    for (const name of billingNames) {
      const id = await findOrCreateArtistByName(supabase, name, cache);
      if (id) artistNameById.set(id, name);
    }

    const roles = resolveGigBillingRoles(
      headlinerId,
      headlinerName,
      lineup,
      artistNameById,
      gigSource,
    );

    const billingIds: string[] = [];
    for (const name of billingNames) {
      const id = await findOrCreateArtistByName(supabase, name, cache);
      if (id) billingIds.push(id);
    }
    if (billingIds.length <= 1) continue;

    const primaryName =
      billingNames.find(
        (n) => n.trim().toLowerCase() === headlinerName.trim().toLowerCase(),
      ) ?? billingNames[0]!;
    const primaryId =
      (await findOrCreateArtistByName(supabase, primaryName, cache)) ??
      roles.primaryArtistId;

    if (primaryId !== headlinerId) {
      await supabase.from("gigs").update({ artist_id: primaryId }).eq("id", gigId);
      artistNameById.set(primaryId, billingNames[0]!);
    }

    const coIds = billingIds.filter((id) => id !== primaryId);
    const billingIdSet = new Set(billingIds);

    await supabase.from("gig_lineup_artists").delete().eq("gig_id", gigId);

    const toInsert: {
      gig_id: string;
      artist_id: string;
      sort_order: number;
      is_co_headliner: boolean;
    }[] = [];

    let order = 0;
    for (const aid of coIds) {
      toInsert.push({
        gig_id: gigId,
        artist_id: aid,
        sort_order: order++,
        is_co_headliner: true,
      });
    }

    for (const sid of roles.supportLineupArtistIds) {
      if (billingIdSet.has(sid)) continue;
      toInsert.push({
        gig_id: gigId,
        artist_id: sid,
        sort_order: order++,
        is_co_headliner: false,
      });
    }

    if (toInsert.length > 0) {
      await supabase.from("gig_lineup_artists").insert(toInsert);
    }
  }
}
