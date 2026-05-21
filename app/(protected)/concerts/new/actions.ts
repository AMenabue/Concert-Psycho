"use server";

import { formatDepartureChoiceLabel } from "@/lib/dashboard/format-departure-choice-label";
import { travelKmFromDepartureCityToVenue } from "@/lib/geo/travel-from-departure-city";
import { daysInAdvanceFromPurchase } from "@/lib/ticket-purchase-date";
import { nominatimSearchFirst } from "@/lib/geocoding/nominatim";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  isCombinedBillingArtistName,
  planBillingHeadliners,
} from "@/lib/gigs/billing-headliners";
import {
  extractSetlistPersistMeta,
  parseFeaturingNamesList,
  slugForSongTag,
  type SlSetlistFull,
} from "@/lib/setlistfm/parse";
import { repairMisclassifiedGuestsAsTagsForUser } from "@/lib/setlistfm/repair-song-guest-tags";
import {
  buildAutoImportPayloadFromSetlist,
  submitSongRowsFromParsedSetlist,
} from "./setlist-import-payload";
import type { SubmitNewConcertPayload, SubmitSongRow } from "./submit-concert-types";

function toIsoOrNullFromSetlistLastUpdated(
  raw: string | null | undefined,
): string | null {
  const t = raw?.trim();
  if (!t) return null;
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

function escapeIlike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function featuringGuestsForSubmitRow(s: SubmitSongRow): {
  name: string;
  mbid: string | null;
}[] {
  if (s.featuringGuests && s.featuringGuests.length > 0) {
    return s.featuringGuests;
  }
  const names = parseFeaturingNamesList(s.featuringNames);
  return names.map((name) => ({
    name,
    mbid:
      s.firstFeaturingName &&
      name.trim().toLowerCase() === s.firstFeaturingName.trim().toLowerCase()
        ? (s.firstFeaturingMbid ?? null)
        : null,
  }));
}

export type ArtistRow = { id: string; name: string; genre_primary: string | null };
export type VenueRow = {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number | null;
  lng: number | null;
  setlistfm_venue_id?: string | null;
};

export type HomeLocationRow = {
  id: string;
  label: string;
  city: string;
  country: string;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
};

export async function searchArtists(query: string): Promise<ArtistRow[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const q = escapeIlike(query.trim());
  if (q.length < 1) return [];
  const { data, error } = await supabase
    .from("artists")
    .select("id,name,genre_primary")
    .ilike("name", `%${q}%`)
    .limit(20);
  if (error) return [];
  return data ?? [];
}

export async function searchVenues(query: string): Promise<VenueRow[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const q = escapeIlike(query.trim());
  if (q.length < 1) return [];
  const pattern = `%${q}%`;
  const { data: byName, error: e1 } = await supabase
    .from("venues")
    .select("id,name,city,country,lat,lng,setlistfm_venue_id")
    .ilike("name", pattern)
    .limit(15);
  const { data: byCity, error: e2 } = await supabase
    .from("venues")
    .select("id,name,city,country,lat,lng,setlistfm_venue_id")
    .ilike("city", pattern)
    .limit(15);
  if (e1 || e2) return [];
  const map = new Map<string, VenueRow>();
  for (const row of [...(byName ?? []), ...(byCity ?? [])]) {
    map.set(row.id, row as VenueRow);
  }
  return Array.from(map.values()).slice(0, 20);
}

export async function findVenueBySetlistfmVenueId(
  setlistfmVenueId: string,
): Promise<VenueRow | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const id = setlistfmVenueId.trim();
  if (!id) return null;
  const { data, error } = await supabase
    .from("venues")
    .select("id,name,city,country,lat,lng,setlistfm_venue_id")
    .eq("setlistfm_venue_id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as VenueRow;
}

const USER_CONCERT_SUGGEST_FIELDS = ["tour_name", "sector"] as const;

export type UserConcertSuggestField =
  (typeof USER_CONCERT_SUGGEST_FIELDS)[number];

/** Valori distinti già usati dall'utente (campi su `gig_attendances` / `gigs`). */
export async function searchUserConcertTextHistory(
  field: UserConcertSuggestField,
  query: string,
): Promise<string[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  if (!USER_CONCERT_SUGGEST_FIELDS.includes(field)) return [];
  const q = escapeIlike(query.trim());
  if (q.length < 1) return [];
  const pattern = `%${q}%`;

  if (field === "sector") {
    const { data, error } = await supabase
      .from("gig_attendances")
      .select("sector")
      .eq("user_id", user.id)
      .not("sector", "is", null)
      .ilike("sector", pattern)
      .limit(120);
    if (error) return [];
    return dedupeStrings(
      (data ?? []).map((r) => (r as { sector?: string }).sector),
    );
  }

  const { data, error } = await supabase
    .from("gigs")
    .select("tour_name, gig_attendances!inner(user_id)")
    .eq("gig_attendances.user_id", user.id)
    .not("tour_name", "is", null)
    .ilike("tour_name", pattern)
    .limit(120);

  if (error) return [];
  return dedupeStrings(
    (data ?? []).map((r) => (r as { tour_name?: string }).tour_name),
  );
}

/** Anteprima km in form: geocoding da città e paese di partenza. */
export async function previewTravelKmDepartureToVenue(
  departureCity: string,
  departureCountry: string,
  venueLat: number,
  venueLng: number,
): Promise<number | null> {
  return travelKmFromDepartureCityToVenue(
    departureCity,
    departureCountry,
    venueLat,
    venueLng,
  );
}

function dedupeStrings(vals: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const val of vals) {
    if (typeof val !== "string" || !val.trim()) continue;
    if (seen.has(val)) continue;
    seen.add(val);
    out.push(val);
    if (out.length >= 20) break;
  }
  return out;
}

export async function listHomeLocations(): Promise<HomeLocationRow[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("home_locations")
    .select("id,label,city,country,lat,lng,is_default")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("label", { ascending: true });
  if (error) return [];
  return (data ?? []) as HomeLocationRow[];
}

/** Case salvate + città/paese già usati come partenza su altri concerti (senza duplicare le case). */
export async function listHomeLocationsWithPastDepartures(): Promise<
  HomeLocationRow[]
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const normKey = (city: string, country: string) =>
    JSON.stringify([
      city.trim().toLowerCase(),
      country.trim().toLowerCase(),
    ]);

  const [homesRes, depsRes] = await Promise.all([
    supabase
      .from("home_locations")
      .select("id,label,city,country,lat,lng,is_default")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("label", { ascending: true }),
    supabase
      .from("gig_attendances")
      .select("departure_city, departure_country")
      .eq("user_id", user.id),
  ]);

  const homes = (homesRes.data ?? []) as HomeLocationRow[];

  const homeKeys = new Set(
    homes.map((h) => normKey(h.city, h.country)),
  );

  const seenRecent = new Set<string>();
  const extras: HomeLocationRow[] = [];
  if (!depsRes.error) {
    for (const row of depsRes.data ?? []) {
      const c = String(
        (row as { departure_city?: string | null }).departure_city ?? "",
      ).trim();
      const cy = String(
        (row as { departure_country?: string | null }).departure_country ?? "",
      ).trim();
      if (!c || !cy) continue;
      const key = normKey(c, cy);
      if (homeKeys.has(key)) continue;
      if (seenRecent.has(key)) continue;
      seenRecent.add(key);
      extras.push({
        id: `__recent__:${encodeURIComponent(c)}:${encodeURIComponent(cy)}`,
        label: `${c}, ${cy}`,
        city: c,
        country: cy,
        lat: null,
        lng: null,
        is_default: false,
      });
    }
  }

  return [...homes, ...extras].sort((a, b) =>
    formatDepartureChoiceLabel(a).localeCompare(
      formatDepartureChoiceLabel(b),
      "it",
    ),
  );
}

export async function createHomeLocation(payload: {
  label: string;
  city: string;
  country: string;
}): Promise<{ error: string } | { location: HomeLocationRow }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const label = payload.label.trim();
  const city = payload.city.trim();
  const country = payload.country.trim();
  if (!label || !city || !country) {
    return { error: "Etichetta, città e paese sono obbligatori." };
  }

  const geo = await nominatimSearchFirst(`${city}, ${country}`);
  if (!geo) {
    return {
      error:
        "Impossibile trovare le coordinate per questa città. Controlla città e paese.",
    };
  }

  const { count } = await supabase
    .from("home_locations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const isFirst = (count ?? 0) === 0;

  const { data, error } = await supabase
    .from("home_locations")
    .insert({
      user_id: user.id,
      label,
      city,
      country,
      lat: geo.lat,
      lng: geo.lng,
      is_default: isFirst,
    })
    .select("id,label,city,country,lat,lng,is_default")
    .single();

  if (error) return { error: error.message };
  return { location: data as HomeLocationRow };
}

export async function updateHomeLocation(payload: {
  id: string;
  label: string;
  city: string;
  country: string;
}): Promise<{ error: string } | { location: HomeLocationRow }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const label = payload.label.trim();
  const city = payload.city.trim();
  const country = payload.country.trim();
  if (!label || !city || !country) {
    return { error: "Label, city, and country are required." };
  }

  const geo = await nominatimSearchFirst(`${city}, ${country}`);
  if (!geo) {
    return { error: "Could not find coordinates for this city. Check city and country." };
  }

  const { data, error } = await supabase
    .from("home_locations")
    .update({ label, city, country, lat: geo.lat, lng: geo.lng })
    .eq("id", payload.id)
    .eq("user_id", user.id)
    .select("id,label,city,country,lat,lng,is_default")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Departure home not found." };
  return { location: data as HomeLocationRow };
}

export async function setDefaultHomeLocation(
  id: string,
): Promise<{ error: string } | { ok: true }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: row } = await supabase
    .from("home_locations")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) return { error: "Departure home not found." };

  await supabase
    .from("home_locations")
    .update({ is_default: false })
    .eq("user_id", user.id);

  const { error } = await supabase
    .from("home_locations")
    .update({ is_default: true })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/concerts/new");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteHomeLocation(id: string): Promise<{ error: string } | { ok: true }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase
    .from("home_locations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return { ok: true };
}

export type { SubmitNewConcertPayload, SubmitSongRow } from "./submit-concert-types";

async function findOrCreateGuestArtist(
  supabase: ReturnType<typeof createClient>,
  name: string,
  mbid: string | null,
  cache: Map<string, string | null>,
): Promise<string | null> {
  const key = `${mbid ?? ""}::${name.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  const trimmed = name.trim();
  if (!trimmed) {
    cache.set(key, null);
    return null;
  }

  if (mbid?.trim()) {
    const { data: byMbid } = await supabase
      .from("artists")
      .select("id")
      .eq("setlistfm_mbid", mbid.trim())
      .maybeSingle();
    if (byMbid?.id) {
      cache.set(key, byMbid.id);
      return byMbid.id;
    }
  }

  const pattern = `%${escapeIlike(trimmed)}%`;
  const { data: candidates } = await supabase
    .from("artists")
    .select("id,name")
    .ilike("name", pattern)
    .limit(12);

  const exact = candidates?.find(
    (r) => r.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (exact?.id) {
    cache.set(key, exact.id);
    return exact.id;
  }

  const { data: inserted, error } = await supabase
    .from("artists")
    .insert({
      name: trimmed,
      genre_primary: null,
      setlistfm_mbid: mbid?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    cache.set(key, null);
    return null;
  }
  cache.set(key, inserted.id);
  return inserted.id;
}

async function getOrCreateSongTagId(
  supabase: ReturnType<typeof createClient>,
  label: string,
  cache: Map<string, string>,
): Promise<string | null> {
  const trimmed = label.trim();
  if (!trimmed) return null;
  const slug = slugForSongTag(trimmed);
  if (cache.has(slug)) return cache.get(slug)!;

  const { data: existing } = await supabase
    .from("song_tags")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing?.id) {
    cache.set(slug, existing.id);
    return existing.id;
  }

  const { data: inserted, error } = await supabase
    .from("song_tags")
    .insert({ label: trimmed, slug })
    .select("id")
    .single();

  if (!error && inserted?.id) {
    cache.set(slug, inserted.id);
    return inserted.id;
  }

  const { data: retry } = await supabase
    .from("song_tags")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (retry?.id) {
    cache.set(slug, retry.id);
    return retry.id;
  }
  return null;
}

async function insertLineupArtistsForGig(
  supabase: ReturnType<typeof createClient>,
  gigId: string,
  names: string[],
  isCoHeadliner: boolean,
  excludeArtistId: string | null,
): Promise<{ error?: string }> {
  const list = names.map((n) => n.trim()).filter(Boolean);
  if (list.length === 0) return {};

  const seen = new Set<string>();
  const lineupRows: {
    gig_id: string;
    artist_id: string;
    sort_order: number;
    is_co_headliner: boolean;
  }[] = [];
  const cache = new Map<string, string | null>();
  let order = 0;
  for (const name of list) {
    const aid = await findOrCreateGuestArtist(supabase, name, null, cache);
    if (!aid || seen.has(aid)) continue;
    if (excludeArtistId && aid === excludeArtistId) continue;
    seen.add(aid);
    lineupRows.push({
      gig_id: gigId,
      artist_id: aid,
      sort_order: order++,
      is_co_headliner: isCoHeadliner,
    });
  }
  if (lineupRows.length === 0) return {};
  const { error: luErr } = await supabase.from("gig_lineup_artists").insert(lineupRows);
  if (luErr) return { error: luErr.message };
  return {};
}

async function insertLineupAndSongsForGig(
  supabase: ReturnType<typeof createClient>,
  gigId: string,
  lineupArtistNames: string[],
  songs: SubmitSongRow[] | undefined,
  coHeadlinerArtistNames: string[] = [],
  headlinerArtistId: string | null = null,
): Promise<{ error?: string }> {
  const coErr = await insertLineupArtistsForGig(
    supabase,
    gigId,
    coHeadlinerArtistNames,
    true,
    headlinerArtistId,
  );
  if (coErr.error) return coErr;

  const supportErr = await insertLineupArtistsForGig(
    supabase,
    gigId,
    lineupArtistNames,
    false,
    headlinerArtistId,
  );
  if (supportErr.error) return supportErr;

  const songList = songs ?? [];
  if (songList.length > 0) {
    const guestCache = new Map<string, string | null>();
    const rows: {
      gig_id: string;
      title: string;
      position: number;
      is_encore: boolean;
      is_cover: boolean;
      is_tape: boolean;
      guest_artist_id: string | null;
      featuring_names: string | null;
      song_info: string | null;
      set_name: string | null;
      cover_original_artist: string | null;
      cover_original_artist_mbid: string | null;
    }[] = [];
    const guestArtistIdsByPosition = new Map<number, string[]>();

    for (const s of songList) {
      const guests = featuringGuestsForSubmitRow(s);
      const resolved: string[] = [];
      for (const g of guests) {
        const id = await findOrCreateGuestArtist(
          supabase,
          g.name,
          g.mbid,
          guestCache,
        );
        if (id) resolved.push(id);
      }
      const uniq = Array.from(new Set(resolved));
      guestArtistIdsByPosition.set(s.position, uniq);
      rows.push({
        gig_id: gigId,
        title: s.title,
        position: s.position,
        is_encore: s.isEncore,
        is_cover: s.isCover,
        is_tape: s.isTape === true,
        guest_artist_id: uniq[0] ?? null,
        featuring_names: s.featuringNames?.trim() || null,
        song_info: s.songInfo?.trim() || null,
        set_name: s.setName?.trim() || null,
        cover_original_artist: s.coverOriginalArtist?.trim() || null,
        cover_original_artist_mbid:
          s.coverOriginalArtistMbid?.trim() || null,
      });
    }

    const { data: insertedSongs, error: songErr } = await supabase
      .from("gig_songs")
      .insert(rows)
      .select("id, position");
    if (songErr) return { error: songErr.message };

    const ordered = [...(insertedSongs ?? [])].sort(
      (a, b) => (a.position as number) - (b.position as number),
    );
    const songByPosition = new Map(songList.map((s) => [s.position, s]));
    const tagCache = new Map<string, string>();
    const linkRows: { gig_song_id: string; song_tag_id: string }[] = [];
    const seenLinks = new Set<string>();

    for (const row of ordered) {
      const pos = row.position as number;
      const payloadSong = songByPosition.get(pos);
      const sid = row.id as string;
      const labels = payloadSong?.tagLabels ?? [];
      for (const lab of labels) {
        const tid = await getOrCreateSongTagId(supabase, lab, tagCache);
        if (!tid) continue;
        const k = `${sid}::${tid}`;
        if (seenLinks.has(k)) continue;
        seenLinks.add(k);
        linkRows.push({ gig_song_id: sid, song_tag_id: tid });
      }
    }

    if (linkRows.length > 0) {
      const { error: tagLinkErr } = await supabase
        .from("gig_song_tags")
        .insert(linkRows);
      if (tagLinkErr) return { error: tagLinkErr.message };
    }

    const featuringLinkRows: {
      gig_song_id: string;
      artist_id: string;
      sort_order: number;
    }[] = [];
    for (const row of ordered) {
      const pos = row.position as number;
      const ids = guestArtistIdsByPosition.get(pos) ?? [];
      const sid = row.id as string;
      for (let o = 0; o < ids.length; o++) {
        featuringLinkRows.push({
          gig_song_id: sid,
          artist_id: ids[o]!,
          sort_order: o,
        });
      }
    }
    if (featuringLinkRows.length > 0) {
      const { error: featErr } = await supabase
        .from("gig_song_featuring_artists")
        .insert(featuringLinkRows);
      if (featErr) return { error: featErr.message };
    }
  }

  return {};
}

export async function persistNewConcert(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  payload: SubmitNewConcertPayload,
): Promise<{ attendanceId: string } | { error: string }> {
  const source = payload.source === "setlistfm_import" ? "setlistfm_import" : "manual";

  let artistId: string | undefined;
  const hasBillingCoHeadliners =
    (payload.coHeadlinerArtistNames?.length ?? 0) > 0;
  const mbid = hasBillingCoHeadliners
    ? null
    : payload.setlistfmArtistMbid?.trim();
  if (mbid) {
    const { data: byMbid } = await supabase
      .from("artists")
      .select("id")
      .eq("setlistfm_mbid", mbid)
      .maybeSingle();
    if (byMbid?.id) artistId = byMbid.id;
  }

  if (!artistId) {
    if (payload.artistMode === "existing") {
      if (!payload.artistId?.trim()) {
        return { error: "Seleziona un artista dall’elenco oppure creane uno nuovo." };
      }
      artistId = payload.artistId.trim();
    } else {
      const name = payload.newArtistName?.trim() ?? "";
      if (!name) return { error: "Nome artista obbligatorio per la creazione." };
      const { data, error } = await supabase
        .from("artists")
        .insert({
          name,
          genre_primary: payload.newArtistGenre?.trim() || null,
          setlistfm_mbid: mbid || null,
        })
        .select("id")
        .single();
      if (error) return { error: error.message };
      artistId = data.id;
    }
  }

  let coHeadlinerNames = [...(payload.coHeadlinerArtistNames ?? [])];
  if (artistId) {
    const { data: headRow } = await supabase
      .from("artists")
      .select("name")
      .eq("id", artistId)
      .maybeSingle();
    const headName = String(headRow?.name ?? "").trim();
    if (isCombinedBillingArtistName(headName)) {
      const billing = planBillingHeadliners(headName);
      if (billing?.isSplit) {
        const cache = new Map<string, string | null>();
        const primaryId = await findOrCreateGuestArtist(
          supabase,
          billing.primaryName,
          null,
          cache,
        );
        if (primaryId) artistId = primaryId;
        coHeadlinerNames = billing.coHeadlinerNames;
      }
    }
  }

  let venueId: string;
  let createVenueLat: number | null = null;
  let createVenueLng: number | null = null;
  if (payload.venueMode === "existing") {
    if (!payload.venueId?.trim()) {
      return { error: "Seleziona una venue dall’elenco oppure creane una nuova." };
    }
    venueId = payload.venueId.trim();
  } else {
    const vName = payload.newVenueName?.trim() ?? "";
    const city = payload.newVenueCity?.trim() ?? "";
    const country = payload.newVenueCountry?.trim() ?? "";
    let lat = Number.parseFloat(
      (payload.newVenueLat ?? "").replace(",", "."),
    );
    let lng = Number.parseFloat(
      (payload.newVenueLng ?? "").replace(",", "."),
    );
    if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && city && country) {
      const geo = await nominatimSearchFirst(`${city}, ${country}`);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
      }
    }
    if (!vName || !city || !country) {
      return { error: "Nome, città e paese della venue sono obbligatori." };
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { error: "Latitudine e longitudine devono essere numeri validi." };
    }
    createVenueLat = lat;
    createVenueLng = lng;
    const slVid = payload.newVenueSetlistfmVenueId?.trim();
    let reusedVenueId: string | null = null;
    if (slVid) {
      const { data: exVenue, error: exErr } = await supabase
        .from("venues")
        .select("id,lat,lng")
        .eq("setlistfm_venue_id", slVid)
        .maybeSingle();
      if (!exErr && exVenue?.id) {
        reusedVenueId = exVenue.id as string;
        const la = Number(exVenue.lat);
        const lo = Number(exVenue.lng);
        if (Number.isFinite(la) && Number.isFinite(lo)) {
          createVenueLat = la;
          createVenueLng = lo;
        }
      }
    }
    if (reusedVenueId) {
      venueId = reusedVenueId;
    } else {
      const venueInsert: Record<string, unknown> = {
        name: vName,
        city,
        country,
        lat,
        lng,
      };
      if (slVid) venueInsert.setlistfm_venue_id = slVid;
      const slVurl = payload.newVenueSetlistfmUrl?.trim();
      if (slVurl) venueInsert.setlistfm_url = slVurl;
      const geoId = payload.newVenueCityGeoId?.trim();
      if (geoId) venueInsert.city_geo_id = geoId;
      const st = payload.newVenueState?.trim();
      if (st) venueInsert.state = st;
      const stc = payload.newVenueStateCode?.trim();
      if (stc) venueInsert.state_code = stc;
      const cc = payload.newVenueCountryCode?.trim()?.toUpperCase();
      if (cc) venueInsert.country_code = cc;

      const { data, error } = await supabase
        .from("venues")
        .insert(venueInsert)
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505" && slVid) {
          const { data: raceVenue, error: raceErr } = await supabase
            .from("venues")
            .select("id,lat,lng")
            .eq("setlistfm_venue_id", slVid)
            .maybeSingle();
          if (!raceErr && raceVenue?.id) {
            venueId = raceVenue.id as string;
            const la = Number(raceVenue.lat);
            const lo = Number(raceVenue.lng);
            if (Number.isFinite(la) && Number.isFinite(lo)) {
              createVenueLat = la;
              createVenueLng = lo;
            }
          } else {
            return { error: error.message };
          }
        } else {
          return { error: error.message };
        }
      } else {
        venueId = data.id;
      }
    }
  }

  if (
    payload.venueMode === "existing" &&
    payload.fillVenueSetlistfmFromImport &&
    payload.importVenueSetlistfmId?.trim()
  ) {
    const { data: vcur } = await supabase
      .from("venues")
      .select("setlistfm_venue_id")
      .eq("id", venueId)
      .maybeSingle();
    if (vcur && !vcur.setlistfm_venue_id) {
      await supabase
        .from("venues")
        .update({
          setlistfm_venue_id: payload.importVenueSetlistfmId.trim(),
          setlistfm_url: payload.importVenueSetlistfmUrl?.trim() || null,
          city_geo_id: payload.importVenueCityGeoId?.trim() || null,
          state: payload.importVenueState?.trim() || null,
          state_code: payload.importVenueStateCode?.trim() || null,
          country_code:
            payload.importVenueCountryCode?.trim()?.toUpperCase() || null,
        })
        .eq("id", venueId);
    }
  }

  let venueLat: number | null = null;
  let venueLng: number | null = null;
  if (payload.venueMode === "existing") {
    const { data: vr } = await supabase
      .from("venues")
      .select("lat,lng")
      .eq("id", venueId)
      .maybeSingle();
    if (vr) {
      const la = Number(vr.lat);
      const lo = Number(vr.lng);
      if (Number.isFinite(la) && Number.isFinite(lo)) {
        venueLat = la;
        venueLng = lo;
      }
    }
  } else {
    venueLat = createVenueLat;
    venueLng = createVenueLng;
  }

  let travelKm: number | null = null;
  const depCity = payload.departureCity.trim();
  const depCountry = payload.departureCountry.trim();
  if (
    depCity &&
    depCountry &&
    venueLat !== null &&
    venueLng !== null
  ) {
    travelKm = await travelKmFromDepartureCityToVenue(
      depCity,
      depCountry,
      venueLat,
      venueLng,
    );
  }

  const ticketTrim = payload.ticketPriceEur.replace(",", ".").trim();
  let ticketPriceCents: number | null = null;
  if (ticketTrim !== "") {
    const euros = Number.parseFloat(ticketTrim);
    if (Number.isNaN(euros) || euros < 0) {
      return { error: "Prezzo biglietto non valido." };
    }
    ticketPriceCents = Math.round(euros * 100);
  }

  if (!payload.concertDate?.trim()) {
    return { error: "Data concerto obbligatoria." };
  }

  const durationMin =
    payload.concertDurationMinutes != null &&
    Number.isFinite(payload.concertDurationMinutes)
      ? Math.round(Number(payload.concertDurationMinutes))
      : null;

  const slSid = payload.setlistfmSetlistId?.trim() || null;

  const gigShared = {
    artist_id: artistId,
    venue_id: venueId,
    gig_date: payload.concertDate.trim(),
    tour_name: payload.tourName.trim() || null,
    is_festival: payload.isFestival,
    was_cancelled: false,
    source,
    setlistfm_setlist_id: slSid,
    setlistfm_version_id: payload.setlistfmVersionId?.trim() || null,
    setlistfm_last_updated: toIsoOrNullFromSetlistLastUpdated(
      payload.setlistfmLastUpdated,
    ),
    setlistfm_url: payload.setlistfmUrl?.trim() || null,
    setlistfm_artist_url: payload.setlistfmArtistUrl?.trim() || null,
    setlistfm_venue_url: payload.setlistfmVenueUrl?.trim() || null,
    setlistfm_clock_json: payload.setlistfmClockJson ?? null,
    setlistfm_info: payload.setlistfmInfo?.trim() || null,
    concert_duration_minutes: durationMin,
  };

  let gigId: string;
  let createdGigThisCall = false;
  let skipSongBlock = false;

  if (slSid) {
    const { data: exGig } = await supabase
      .from("gigs")
      .select("id")
      .eq("setlistfm_setlist_id", slSid)
      .maybeSingle();
    if (exGig?.id) {
      gigId = exGig.id as string;
      const { count, error: cErr } = await supabase
        .from("gig_songs")
        .select("id", { count: "exact", head: true })
        .eq("gig_id", gigId);
      if (cErr) return { error: cErr.message };
      skipSongBlock = (count ?? 0) > 0;
    } else {
      const { data: gRow, error: gErr } = await supabase
        .from("gigs")
        .insert(gigShared)
        .select("id")
        .single();
      if (gErr) {
        if (gErr.code === "23505" && slSid) {
          const { data: raceGig } = await supabase
            .from("gigs")
            .select("id")
            .eq("setlistfm_setlist_id", slSid)
            .maybeSingle();
          if (raceGig?.id) {
            gigId = raceGig.id as string;
            createdGigThisCall = false;
            const { count } = await supabase
              .from("gig_songs")
              .select("id", { count: "exact", head: true })
              .eq("gig_id", gigId);
            skipSongBlock = (count ?? 0) > 0;
          } else {
            return { error: gErr.message };
          }
        } else {
          return { error: gErr.message };
        }
      } else {
        gigId = gRow!.id as string;
        createdGigThisCall = true;
        skipSongBlock = false;
      }
    }
  } else {
    const { data: gRow, error: gErr } = await supabase
      .from("gigs")
      .insert(gigShared)
      .select("id")
      .single();
    if (gErr) return { error: gErr.message };
    gigId = gRow.id as string;
    createdGigThisCall = true;
    skipSongBlock = false;
  }

  const daysBought =
    payload.ticketPurchasedOn?.trim() && payload.concertDate?.trim()
      ? daysInAdvanceFromPurchase(payload.ticketPurchasedOn.trim(), payload.concertDate.trim())
      : null;

  const { data: attRow, error: aErr } = await supabase
    .from("gig_attendances")
    .insert({
      user_id: userId,
      gig_id: gigId,
      sector: payload.sector.trim() || null,
      is_standing: payload.isStanding,
      ticket_price_cents: ticketPriceCents,
      ticket_currency: (payload.ticketCurrency.trim() || "EUR").toUpperCase(),
      days_bought_in_advance: daysBought,
      departure_city: payload.departureCity.trim() || null,
      departure_country: payload.departureCountry.trim() || null,
      travel_km: travelKm,
    })
    .select("id")
    .single();

  if (aErr) {
    if (createdGigThisCall) {
      await supabase.from("gigs").delete().eq("id", gigId);
    }
    return { error: aErr.message };
  }

  const attendanceId = attRow.id as string;

  if (!skipSongBlock) {
    const sub = await insertLineupAndSongsForGig(
      supabase,
      gigId,
      payload.lineupArtistNames ?? [],
      payload.songs,
      coHeadlinerNames,
      artistId ?? null,
    );
    if (sub.error) {
      await supabase.from("gig_attendances").delete().eq("id", attendanceId);
      if (createdGigThisCall) {
        await supabase.from("gigs").delete().eq("id", gigId);
      }
      return { error: sub.error };
    }
  }

  return { attendanceId };
}

export async function submitNewConcert(
  payload: SubmitNewConcertPayload,
): Promise<{ error: string } | void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };
  const r = await persistNewConcert(supabase, user.id, payload);
  if ("error" in r) return { error: r.error };
  redirect("/");
}

/** Same as submitNewConcert but returns the new attendance id for app routes. */
export async function submitNewConcertApp(
  payload: SubmitNewConcertPayload,
): Promise<{ error: string } | { attendanceId: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const r = await persistNewConcert(supabase, user.id, payload);
  if ("error" in r) return { error: r.error };
  return { attendanceId: r.attendanceId };
}

const SETLIST_FM_API_BASE = "https://api.setlist.fm/rest/1.0";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Setlist.fm applica rate limit severi: ritenta su 429 con backoff. */
async function fetchSetlistJson<T>(
  url: string,
  apiKey: string,
): Promise<{ ok: T } | { error: string }> {
  const headers: HeadersInit = {
    Accept: "application/json",
    "x-api-key": apiKey,
  };
  let lastStatus = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (res.ok) {
      return { ok: (await res.json()) as T };
    }
    lastStatus = res.status;
    if (res.status === 429 && attempt < 4) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    return { error: `HTTP ${res.status}` };
  }
  return { error: `HTTP ${lastStatus}` };
}

export async function getMySetlistfmUserId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("setlistfm_user_id")
    .eq("id", user.id)
    .maybeSingle();
  return (data?.setlistfm_user_id as string | null | undefined) ?? null;
}

export async function updateProfileSetlistfmUserId(
  setlistfmUserId: string | null,
): Promise<{ error: string } | void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };
  const trimmed = setlistfmUserId?.trim() || null;
  const { error } = await supabase
    .from("profiles")
    .update({ setlistfm_user_id: trimmed })
    .eq("id", user.id);
  if (error) return { error: error.message };
}

export async function importSetlistfmAttendedConcerts(): Promise<{
  imported: number;
  skippedExisting: number;
  errors: string[];
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { imported: 0, skippedExisting: 0, errors: ["Non autenticato"] };
  }
  const apiKey = process.env.SETLISTFM_API_KEY;
  if (!apiKey) {
    return {
      imported: 0,
      skippedExisting: 0,
      errors: ["SETLISTFM_API_KEY non configurata sul server"],
    };
  }

  const { data: profile, error: pe } = await supabase
    .from("profiles")
    .select("setlistfm_user_id")
    .eq("id", user.id)
    .maybeSingle();
  if (pe) {
    return { imported: 0, skippedExisting: 0, errors: [pe.message] };
  }
  const slUser = profile?.setlistfm_user_id as string | null | undefined;
  if (!slUser?.trim()) {
    return {
      imported: 0,
      skippedExisting: 0,
      errors: [
        "Imposta il tuo user id Setlist.fm in Settings prima di importare.",
      ],
    };
  }

  const headers: HeadersInit = {
    Accept: "application/json",
    "x-api-key": apiKey,
  };

  let imported = 0;
  let skippedExisting = 0;
  const errors: string[] = [];
  const maxPages = 20;

  for (let page = 1; page <= maxPages; page++) {
    const url = `${SETLIST_FM_API_BASE}/user/${encodeURIComponent(slUser.trim())}/attended?p=${page}`;
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) {
      errors.push(`attended p=${page}: HTTP ${res.status}`);
      break;
    }
    const body = (await res.json()) as {
      setlist?: SlSetlistFull[];
    };
    const list = body.setlist ?? [];
    if (list.length === 0) break;

    for (const hit of list) {
      const sid = hit.id?.trim();
      if (!sid) continue;

      const { data: g0 } = await supabase
        .from("gigs")
        .select("id")
        .eq("setlistfm_setlist_id", sid)
        .maybeSingle();
      if (g0?.id) {
        const { data: a0 } = await supabase
          .from("gig_attendances")
          .select("id")
          .eq("gig_id", g0.id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (a0?.id) {
          skippedExisting += 1;
          continue;
        }
      }

      const fullRes = await fetchSetlistJson<SlSetlistFull>(
        `${SETLIST_FM_API_BASE}/setlist/${encodeURIComponent(sid)}`,
        apiKey,
      );
      if ("error" in fullRes) {
        errors.push(`setlist ${sid}: ${fullRes.error}`);
        continue;
      }
      const full = fullRes.ok;
      const payload = buildAutoImportPayloadFromSetlist(full);
      const ins = await persistNewConcert(supabase, user.id, payload);
      if ("error" in ins) {
        errors.push(`${sid}: ${ins.error}`);
      } else {
        imported += 1;
      }
      await sleep(1100);
    }

    if (list.length < 20) break;
    await sleep(800);
  }

  return { imported, skippedExisting, errors };
}

export async function resyncGigFromSetlistfm(
  gigId: string,
  options?: { force?: boolean },
): Promise<{ ok: string } | { error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  const { data: att, error: eAtt } = await supabase
    .from("gig_attendances")
    .select("id")
    .eq("gig_id", gigId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (eAtt || !att?.id) {
    return { error: "Concerto non trovato o accesso negato" };
  }

  const { data: row, error: e0 } = await supabase
    .from("gigs")
    .select(
      "id, artist_id, setlistfm_setlist_id, setlistfm_version_id, setlistfm_last_updated",
    )
    .eq("id", gigId)
    .maybeSingle();
  if (e0 || !row?.setlistfm_setlist_id) {
    return { error: "Gig non trovato o senza id Setlist.fm" };
  }

  const apiKey = process.env.SETLISTFM_API_KEY;
  if (!apiKey) return { error: "SETLISTFM_API_KEY non configurata sul server" };

  const fullRes = await fetchSetlistJson<SlSetlistFull>(
    `${SETLIST_FM_API_BASE}/setlist/${encodeURIComponent(row.setlistfm_setlist_id as string)}`,
    apiKey,
  );
  if ("error" in fullRes) {
    return { error: `Setlist.fm: ${fullRes.error}` };
  }
  const sl = fullRes.ok;
  const meta = extractSetlistPersistMeta(sl);
  const isoNew = toIsoOrNullFromSetlistLastUpdated(meta.lastUpdatedRaw);

  if (
    !options?.force &&
    meta.versionId &&
    meta.lastUpdatedRaw &&
    meta.versionId === ((row.setlistfm_version_id as string | null) ?? "") &&
    isoNew === ((row.setlistfm_last_updated as string | null) ?? "")
  ) {
    return { ok: "unchanged" };
  }

  await supabase.from("gig_lineup_artists").delete().eq("gig_id", gigId);
  await supabase.from("gig_songs").delete().eq("gig_id", gigId);

  const billing = planBillingHeadliners(sl.artist?.name);
  const songsPayload = submitSongRowsFromParsedSetlist(sl);
  let headlinerId = (row.artist_id as string) ?? null;
  if (billing?.isSplit) {
    const cache = new Map<string, string | null>();
    const primaryId = await findOrCreateGuestArtist(
      supabase,
      billing.primaryName,
      null,
      cache,
    );
    if (primaryId) {
      headlinerId = primaryId;
      if (primaryId !== row.artist_id) {
        await supabase.from("gigs").update({ artist_id: primaryId }).eq("id", gigId);
      }
    }
  }
  const sub = await insertLineupAndSongsForGig(
    supabase,
    gigId,
    [],
    songsPayload,
    billing?.coHeadlinerNames ?? [],
    headlinerId,
  );
  if (sub.error) return { error: sub.error };

  const updateRow: Record<string, unknown> = {
    setlistfm_version_id: meta.versionId,
    setlistfm_last_updated: isoNew,
    setlistfm_url: meta.setlistUrl,
    setlistfm_artist_url: meta.artistUrl,
    setlistfm_venue_url: meta.venueUrl,
    setlistfm_clock_json: meta.clockJson ?? null,
    setlistfm_info: meta.setlistInfo,
    tour_name: sl.tour?.name?.trim() || null,
  };
  if (meta.durationMinutesInferred != null) {
    updateRow.concert_duration_minutes = Math.round(
      meta.durationMinutesInferred,
    );
  }

  const { error: upErr } = await supabase
    .from("gigs")
    .update(updateRow)
    .eq("id", gigId);
  if (upErr) return { error: upErr.message };

  return { ok: "updated" };
}

/** @deprecated Usa `resyncGigFromSetlistfm`; mantenuto come alias per compatibilità. */
export async function resyncConcertFromSetlistfm(
  gigId: string,
): Promise<{ ok: string } | { error: string }> {
  return resyncGigFromSetlistfm(gigId);
}

/** Fix tags stored as guests (Acappella, Acoustic, …) on songs already in the DB. */
export async function repairMySetlistSongGuestTags(
  gigId?: string,
): Promise<
  | { songsScanned: number; songsFixed: number; tagsLinked: number }
  | { error: string }
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  if (gigId) {
    const { data: att } = await supabase
      .from("gig_attendances")
      .select("id")
      .eq("gig_id", gigId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!att?.id) return { error: "Concerto non trovato" };
  }

  const result = await repairMisclassifiedGuestsAsTagsForUser(
    supabase,
    user.id,
    gigId ? [gigId] : undefined,
  );

  revalidatePath("/");
  revalidatePath("/concerts");
  revalidatePath("/statistics");
  if (gigId) {
    const { data: att } = await supabase
      .from("gig_attendances")
      .select("id")
      .eq("gig_id", gigId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (att?.id) revalidatePath(`/concerts/${att.id}`);
  }

  return result;
}

export async function resyncAllMySetlistfmConcerts(options?: {
  force?: boolean;
}): Promise<{
  updated: number;
  unchanged: number;
  errors: string[];
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { updated: 0, unchanged: 0, errors: ["Non autenticato"] };
  }
  const { data: attRows, error } = await supabase
    .from("gig_attendances")
    .select("gig_id")
    .eq("user_id", user.id);
  if (error) return { updated: 0, unchanged: 0, errors: [error.message] };

  const candidateIds = Array.from(
    new Set(
      (attRows ?? [])
        .map((r) => r.gig_id as string)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  if (candidateIds.length === 0) {
    return { updated: 0, unchanged: 0, errors: [] };
  }

  const { data: gigRows, error: gErr } = await supabase
    .from("gigs")
    .select("id")
    .in("id", candidateIds)
    .not("setlistfm_setlist_id", "is", null);
  if (gErr) return { updated: 0, unchanged: 0, errors: [gErr.message] };

  const gigIds = (gigRows ?? []).map((r) => r.id as string);

  let updated = 0;
  let unchanged = 0;
  const errors: string[] = [];
  for (const gid of gigIds) {
    const out = await resyncGigFromSetlistfm(gid, options);
    if ("error" in out) errors.push(`${gid}: ${out.error}`);
    else if (out.ok === "updated") updated += 1;
    else unchanged += 1;
    await new Promise((sleep) => setTimeout(sleep, 400));
  }
  return { updated, unchanged, errors };
}
