"use server";

import { getDeparturePresetsForUser } from "@/lib/dashboard/departure-presets";
import {
  formatGigHeadlinerDisplay,
  resolveGigBillingRoles,
  type LineupRowInput,
} from "@/lib/gigs/billing-headliners";
import { countUniqueGuestsForGig } from "@/lib/guests/gig-guests";
import { parseFeaturingNamesList, parseSetlistSongInfo } from "@/lib/setlistfm/parse";
import { travelKmFromDepartureCityToVenue } from "@/lib/geo/travel-from-departure-city";
import { createClient } from "@/lib/supabase/server";
import { daysInAdvanceFromPurchase } from "@/lib/ticket-purchase-date";
import { revalidatePath } from "next/cache";

export type DeparturePreset = {
  id: string;
  label: string;
  city: string;
  country: string;
  isDefault: boolean;
};

export type AttendanceDetail = {
  id: string;
  gig_id: string;
  sector: string | null;
  is_standing: boolean;
  ticket_price_cents: number | null;
  ticket_currency: string | null;
  days_bought_in_advance: number | null;
  departure_city: string | null;
  departure_country: string | null;
  travel_km: number | null;
  gig_date: string;
  tour_name: string | null;
  artist_name: string;
  venue_label: string;
  venue_lat: number | null;
  venue_lng: number | null;
};

export type ConcertSongRow = {
  id: string;
  position: number;
  title: string;
  is_encore: boolean;
  is_cover: boolean;
  set_name: string | null;
  guest_artist_id: string | null;
  guest_name: string | null;
  featuring_names: string | null;
  /** All guests for display: "Artist1, Artist2" */
  featuring_display: string | null;
  cover_original_artist: string | null;
  tag_labels: string[];
};

export type ConcertDetailPage = {
  attendance: AttendanceDetail;
  gig_id: string;
  headlinerArtistId: string;
  uniqueGuestCount: number;
  concert_duration_minutes: number | null;
  setlistfmUrl: string | null;
  setlistfmSetlistId: string | null;
  departurePresets: DeparturePreset[];
  support: { name: string }[];
  songs: ConcertSongRow[];
};

export async function getAttendanceDetail(
  attendanceId: string,
): Promise<AttendanceDetail | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: att, error: aErr } = await supabase
    .from("gig_attendances")
    .select(
      `
      id,
      gig_id,
      sector,
      is_standing,
      ticket_price_cents,
      ticket_currency,
      days_bought_in_advance,
      departure_city,
      departure_country,
      travel_km,
      gigs (
        gig_date,
        tour_name,
        artist_id,
        venue_id
      )
    `,
    )
    .eq("id", attendanceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (aErr || !att) return null;

  const gigs = att.gigs as
    | {
        gig_date: string;
        tour_name: string | null;
        artist_id: string;
        venue_id: string;
      }
    | {
        gig_date: string;
        tour_name: string | null;
        artist_id: string;
        venue_id: string;
      }[]
    | null;
  const g = Array.isArray(gigs) ? gigs[0] : gigs;
  if (!g) return null;

  const [{ data: ar }, { data: vn }] = await Promise.all([
    supabase.from("artists").select("name").eq("id", g.artist_id).maybeSingle(),
    supabase
      .from("venues")
      .select("name,city,lat,lng")
      .eq("id", g.venue_id)
      .maybeSingle(),
  ]);

  const artistName =
    String((ar as { name?: string } | null)?.name ?? "").trim() || "Artist";
  const v = vn as {
    name?: string;
    city?: string;
    lat?: unknown;
    lng?: unknown;
  } | null;
  const venueLabel = v
    ? [String(v.name ?? "").trim(), String(v.city ?? "").trim()]
        .filter(Boolean)
        .join(", ")
    : "";
  const vla = v?.lat != null ? Number(v.lat) : NaN;
  const vlo = v?.lng != null ? Number(v.lng) : NaN;
  const venue_lat = Number.isFinite(vla) ? vla : null;
  const venue_lng = Number.isFinite(vlo) ? vlo : null;

  return {
    id: att.id as string,
    gig_id: att.gig_id as string,
    sector: (att.sector as string | null) ?? null,
    is_standing: Boolean(att.is_standing),
    ticket_price_cents: att.ticket_price_cents as number | null,
    ticket_currency: (att.ticket_currency as string | null) ?? "EUR",
    days_bought_in_advance: att.days_bought_in_advance as number | null,
    departure_city: (att.departure_city as string | null) ?? null,
    departure_country: (att.departure_country as string | null) ?? null,
    travel_km: att.travel_km as number | null,
    gig_date: g.gig_date,
    tour_name: g.tour_name,
    artist_name: artistName,
    venue_label: venueLabel,
    venue_lat,
    venue_lng,
  };
}

async function loadTagsBySongId(
  supabase: ReturnType<typeof createClient>,
  allSongIds: string[],
): Promise<Map<string, string[]>> {
  const tagsBySongId = new Map<string, string[]>();
  if (allSongIds.length === 0) return tagsBySongId;
  const { data: tagRows, error: tagErr } = await supabase
    .from("gig_song_tags")
    .select("gig_song_id, song_tags ( label )")
    .in("gig_song_id", allSongIds);
  if (tagErr || !tagRows) return tagsBySongId;
  for (const tr of tagRows) {
    const sid = tr.gig_song_id as string;
    const st = tr.song_tags as { label: string } | { label: string }[] | null;
    const one = Array.isArray(st) ? st[0] : st;
    const lab = one?.label?.trim();
    if (!lab) continue;
    const arr = tagsBySongId.get(sid) ?? [];
    arr.push(lab);
    tagsBySongId.set(sid, arr);
  }
  return tagsBySongId;
}

function mergeSongTagLabels(
  dbTags: string[],
  songInfo: string | null | undefined,
  isCover: boolean,
): string[] {
  const fromInfo = songInfo?.trim()
    ? parseSetlistSongInfo(songInfo).tags
    : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...dbTags, ...fromInfo]) {
    const k = t.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t.trim());
  }
  if (isCover && !seen.has("cover")) out.push("Cover");
  return out;
}

export async function getConcertDetailPage(
  attendanceId: string,
): Promise<ConcertDetailPage | null> {
  const base = await getAttendanceDetail(attendanceId);
  if (!base) return null;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [departurePresets, { data: gigRow }, { data: ampersandRows }] =
    await Promise.all([
      getDeparturePresetsForUser(),
      supabase
        .from("gigs")
        .select(
          "artist_id, source, concert_duration_minutes, setlistfm_url, setlistfm_setlist_id",
        )
        .eq("id", base.gig_id)
        .maybeSingle(),
      supabase
        .from("artists")
        .select("id, name")
        .or("name.ilike.% & %,name.ilike.% / %")
        .limit(80),
    ]);
  const gMeta = gigRow as {
    artist_id?: string;
    source?: string | null;
    concert_duration_minutes?: number | null;
    setlistfm_url?: string | null;
    setlistfm_setlist_id?: string | null;
  } | null;
  const ampersandArtists = (ampersandRows ?? []).map((row) => ({
    name: String((row as { name?: string }).name ?? "").trim(),
  }));
  const gigSource = (gMeta?.source as string | null) ?? null;
  const headlinerArtistId = String(gMeta?.artist_id ?? "").trim();
  const concert_duration_minutes = gMeta?.concert_duration_minutes ?? null;
  const setlistfmUrl = String(gMeta?.setlistfm_url ?? "").trim() || null;
  const setlistfmSetlistId =
    String(gMeta?.setlistfm_setlist_id ?? "").trim() || null;

  const lineupRes = await supabase
    .from("gig_lineup_artists")
    .select("sort_order, artist_id, is_co_headliner, artists ( name )")
    .eq("gig_id", base.gig_id)
    .order("sort_order", { ascending: true });

  type LineupDbRow = {
    sort_order: number;
    artist_id: string;
    is_co_headliner?: boolean;
    artists?: { name?: string } | { name?: string }[] | null;
  };
  let lineupRows: LineupDbRow[] = (lineupRes.data ?? []) as LineupDbRow[];
  if (lineupRes.error && /is_co_headliner/i.test(lineupRes.error.message ?? "")) {
    const fallback = await supabase
      .from("gig_lineup_artists")
      .select("sort_order, artist_id, artists ( name )")
      .eq("gig_id", base.gig_id)
      .order("sort_order", { ascending: true });
    lineupRows = (fallback.data ?? []) as LineupDbRow[];
  }

  const artistNameById = new Map<string, string>();
  artistNameById.set(headlinerArtistId, base.artist_name);
  const lineupInput: LineupRowInput[] = [];
  const lineupArtistIds: string[] = [];

  for (const row of lineupRows ?? []) {
    const aid = String((row as { artist_id?: string }).artist_id ?? "").trim();
    if (!aid) continue;
    lineupArtistIds.push(aid);
    const ar = row as {
      artists?: { name?: string } | { name?: string }[] | null;
    };
    const one = Array.isArray(ar.artists) ? ar.artists[0] : ar.artists;
    const n = String(one?.name ?? "").trim();
    if (n) artistNameById.set(aid, n);
    lineupInput.push({
      artist_id: aid,
      is_co_headliner: Boolean(row.is_co_headliner),
    });
  }

  const missingLineupIds = lineupArtistIds.filter(
    (id) => !artistNameById.has(id) || !artistNameById.get(id)?.trim(),
  );
  if (missingLineupIds.length > 0) {
    const { data: lineupArtists } = await supabase
      .from("artists")
      .select("id,name")
      .in("id", missingLineupIds);
    for (const a of lineupArtists ?? []) {
      artistNameById.set(
        a.id as string,
        String((a as { name?: string }).name ?? "").trim() || "Artist",
      );
    }
  }

  const support: { name: string }[] = [];
  for (const row of lineupInput) {
    const aid = row.artist_id;
    const n = artistNameById.get(aid)?.trim() ?? "";
    if (!n) continue;
    if (row.is_co_headliner) continue;
    if (aid !== headlinerArtistId) support.push({ name: n });
  }

  const billingRoles = resolveGigBillingRoles(
    headlinerArtistId,
    base.artist_name,
    lineupInput,
    artistNameById,
    gigSource,
    ampersandArtists,
  );
  const headlinerDisplay = formatGigHeadlinerDisplay(
    billingRoles,
    artistNameById,
    headlinerArtistId,
  );

  type RawSong = {
    id: string;
    position: number;
    title: string;
    is_encore: boolean;
    is_cover: boolean;
    is_tape?: boolean;
    set_name: string | null;
    guest_artist_id: string | null;
    featuring_names?: string | null;
    song_info?: string | null;
    cover_original_artist?: string | null;
  };

  const selWithTape =
    "id, position, title, is_encore, is_cover, is_tape, set_name, guest_artist_id, featuring_names, song_info, cover_original_artist";
  const selNoTape =
    "id, position, title, is_encore, is_cover, set_name, guest_artist_id, featuring_names, song_info, cover_original_artist";

  let rawSongs: RawSong[] = [];
  const r1 = await supabase
    .from("gig_songs")
    .select(selWithTape)
    .eq("gig_id", base.gig_id)
    .order("position", { ascending: true });
  if (r1.error && /is_tape/i.test(r1.error.message ?? "")) {
    const r2 = await supabase
      .from("gig_songs")
      .select(selNoTape)
      .eq("gig_id", base.gig_id)
      .order("position", { ascending: true });
    rawSongs = (r2.data ?? []) as RawSong[];
  } else {
    rawSongs = (r1.data ?? []) as RawSong[];
  }

  const allSongIds = rawSongs.map((s) => s.id);
  const [{ data: featLinkRows }, tagsBySongId] = await Promise.all([
    allSongIds.length > 0
      ? supabase
          .from("gig_song_featuring_artists")
          .select("gig_song_id, artist_id, sort_order, artists ( name )")
          .in("gig_song_id", allSongIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({
          data: [] as {
            gig_song_id: string;
            artist_id: string;
            sort_order?: number;
            artists?: { name?: string } | { name?: string }[] | null;
          }[],
        }),
    loadTagsBySongId(supabase, allSongIds),
  ]);

  const featuringNamesBySongId = new Map<string, string[]>();
  const featuringArtistIds: string[] = [];
  for (const fl of featLinkRows ?? []) {
    const sid = String(fl.gig_song_id ?? "").trim();
    const aid = String(fl.artist_id ?? "").trim();
    if (!sid || !aid) continue;
    featuringArtistIds.push(aid);
    const ar = fl.artists as { name?: string } | { name?: string }[] | null;
    const one = Array.isArray(ar) ? ar[0] : ar;
    const name = String(one?.name ?? "").trim();
    if (!featuringNamesBySongId.has(sid)) featuringNamesBySongId.set(sid, []);
    if (name) featuringNamesBySongId.get(sid)!.push(name);
  }

  const guestIds = Array.from(
    new Set([
      ...rawSongs
        .map((s) => s.guest_artist_id)
        .filter((id): id is string => Boolean(id)),
      ...featuringArtistIds,
    ]),
  );
  const guestNameById = new Map<string, string>();
  if (guestIds.length > 0) {
    const { data: guests } = await supabase
      .from("artists")
      .select("id,name")
      .in("id", guestIds);
    for (const g of guests ?? []) {
      guestNameById.set(
        g.id as string,
        String((g as { name?: string }).name ?? "").trim(),
      );
    }
  }

  const featuringDisplayFor = (s: RawSong): string | null => {
    const fromLinks = featuringNamesBySongId.get(s.id);
    if (fromLinks && fromLinks.length > 0) return fromLinks.join(", ");
    const parsed = parseFeaturingNamesList(s.featuring_names);
    if (parsed.length > 0) return parsed.join(", ");
    if (s.guest_artist_id) {
      return guestNameById.get(s.guest_artist_id) ?? null;
    }
    return null;
  };

  const songs: ConcertSongRow[] = rawSongs
    .filter((s) => s.is_tape !== true)
    .map((s) => ({
      id: s.id,
      position: s.position,
      title: s.title,
      is_encore: Boolean(s.is_encore),
      is_cover: Boolean(s.is_cover),
      set_name: s.set_name,
      guest_artist_id: s.guest_artist_id,
      guest_name: s.guest_artist_id
        ? guestNameById.get(s.guest_artist_id) ?? null
        : null,
      featuring_names: s.featuring_names ?? null,
      featuring_display: featuringDisplayFor(s),
      cover_original_artist: s.cover_original_artist ?? null,
      tag_labels: mergeSongTagLabels(
        tagsBySongId.get(s.id) ?? [],
        s.song_info,
        Boolean(s.is_cover),
      ),
    }));

  const liveSongs = rawSongs.filter((s) => s.is_tape !== true);
  const uniqueGuestCount = countUniqueGuestsForGig(
    headlinerArtistId,
    liveSongs.map((s) => ({
      guestArtistId: s.guest_artist_id,
      featuringNames: s.featuring_names ?? null,
    })),
    featuringArtistIds,
    guestNameById,
  );

  return {
    attendance: { ...base, artist_name: headlinerDisplay },
    gig_id: base.gig_id,
    headlinerArtistId,
    uniqueGuestCount,
    concert_duration_minutes:
      concert_duration_minutes != null && Number.isFinite(concert_duration_minutes)
        ? Number(concert_duration_minutes)
        : null,
    setlistfmUrl,
    setlistfmSetlistId,
    departurePresets,
    support,
    songs,
  };
}

export async function previewTravelKmForMyAttendance(
  attendanceId: string,
  departureCity: string,
  departureCountry: string,
): Promise<number | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: att } = await supabase
    .from("gig_attendances")
    .select("gig_id")
    .eq("id", attendanceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!att?.gig_id) return null;

  const { data: g } = await supabase
    .from("gigs")
    .select("venue_id")
    .eq("id", att.gig_id as string)
    .maybeSingle();
  if (!g?.venue_id) return null;

  const { data: vr } = await supabase
    .from("venues")
    .select("lat,lng")
    .eq("id", g.venue_id as string)
    .maybeSingle();
  if (!vr) return null;
  const la = Number((vr as { lat?: unknown }).lat);
  const lo = Number((vr as { lng?: unknown }).lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;

  return travelKmFromDepartureCityToVenue(
    departureCity,
    departureCountry,
    la,
    lo,
  );
}

function normLoc(s: string): string {
  return s.trim().toLowerCase();
}

async function ensureHomeLocationSaved(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  city: string,
  country: string,
): Promise<void> {
  const c = city.trim();
  const co = country.trim();
  if (!c || !co) return;
  const { data: rows } = await supabase
    .from("home_locations")
    .select("city,country")
    .eq("user_id", userId);
  for (const r of rows ?? []) {
    const rc = String((r as { city?: string | null }).city ?? "");
    const rco = String((r as { country?: string | null }).country ?? "");
    if (normLoc(rc) === normLoc(c) && normLoc(rco) === normLoc(co)) return;
  }
  await supabase.from("home_locations").insert({
    user_id: userId,
    label: `${c}, ${co}`,
    city: c,
    country: co,
  });
}

export async function updateConcertDetailPage(
  attendanceId: string,
  payload: {
    isStanding: boolean;
    ticketPriceEur: string;
    ticketCurrency: string;
    ticketPurchasedOn: string;
    departureCity: string;
    departureCountry: string;
  },
): Promise<{ error: string } | { ok: true }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: att, error: aErr } = await supabase
    .from("gig_attendances")
    .select(
      `
      id,
      gig_id,
      gigs ( gig_date, venue_id )
    `,
    )
    .eq("id", attendanceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (aErr || !att) return { error: "Attendance not found." };

  const gigEmbed = att.gigs as
    | { gig_date: string; venue_id: string }
    | { gig_date: string; venue_id: string }[]
    | null;
  const gig = Array.isArray(gigEmbed) ? gigEmbed[0] : gigEmbed;
  if (!gig?.gig_date || !gig.venue_id) return { error: "Gig not found." };

  const { data: vr } = await supabase
    .from("venues")
    .select("lat,lng")
    .eq("id", gig.venue_id)
    .maybeSingle();

  let venueLat: number | null = null;
  let venueLng: number | null = null;
  if (vr) {
    const la = Number((vr as { lat?: unknown }).lat);
    const lo = Number((vr as { lng?: unknown }).lng);
    if (Number.isFinite(la) && Number.isFinite(lo)) {
      venueLat = la;
      venueLng = lo;
    }
  }

  const depCity = payload.departureCity.trim();
  const depCountry = payload.departureCountry.trim();
  let travelKm: number | null = null;
  if (depCity && depCountry && venueLat !== null && venueLng !== null) {
    travelKm = await travelKmFromDepartureCityToVenue(
      depCity,
      depCountry,
      venueLat,
      venueLng,
    );
  }

  const euros = Number.parseFloat(
    payload.ticketPriceEur.replace(",", ".").trim(),
  );
  if (Number.isNaN(euros) || euros < 0) {
    return { error: "Invalid ticket price." };
  }
  const ticketPriceCents = Math.round(euros * 100);

  const gigDate = String(gig.gig_date).trim();
  const purchaseStr = payload.ticketPurchasedOn.trim();
  let daysBought: number | null = null;
  if (purchaseStr !== "") {
    const days = daysInAdvanceFromPurchase(purchaseStr, gigDate);
    if (days == null) {
      return {
        error:
          "Invalid purchase date. Use DD/MM/YYYY and make sure it is on or before the concert date.",
      };
    }
    daysBought = days;
  }

  const { error: uErr } = await supabase
    .from("gig_attendances")
    .update({
      is_standing: payload.isStanding,
      ticket_price_cents: ticketPriceCents,
      ticket_currency: (payload.ticketCurrency.trim() || "EUR").toUpperCase(),
      days_bought_in_advance: daysBought,
      departure_city: depCity || null,
      departure_country: depCountry || null,
      travel_km: travelKm,
    })
    .eq("id", attendanceId)
    .eq("user_id", user.id);

  if (uErr) return { error: uErr.message };

  if (depCity && depCountry) {
    await ensureHomeLocationSaved(supabase, user.id, depCity, depCountry);
  }

  revalidatePath("/concerts");
  revalidatePath(`/concerts/${attendanceId}`);
  revalidatePath("/");
  return { ok: true };
}
