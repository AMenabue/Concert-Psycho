"use server";

import {
  buildGuestArtistIdsByGig,
  collectUniqueGuestNameKeysForGig,
  guestCountForGig,
  type GigSongGuestInput,
} from "@/lib/guests/gig-guests";
import {
  formatGigHeadlinerDisplay,
  isCombinedBillingArtistName,
  resolveGigBillingRoles,
  type LineupRowInput,
} from "@/lib/gigs/billing-headliners";
import { repairCombinedBillingGigsForUser } from "@/lib/gigs/repair-billing-gigs";
import { createClient } from "@/lib/supabase/server";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type NamedValue<V = number> = {
  name: string;
  value: V;
  detail?: string | null;
};

export type ConcertRef = {
  attendanceId: string;
  gigId: string;
  date: string;
  artistName: string;
  venueName: string;
  city: string;
  country: string;
};

export type AdvanceHighlight = {
  days: number;
  ref: ConcertRef;
};

export type GuestsAtShowHighlight = {
  count: number;
  ref: ConcertRef;
};

export type ConcertsStats = {
  total: number;
  perYear: { year: number; count: number }[];
  perMonth: { month: number; count: number }[]; // 0..11
  perDayOfWeek: { dow: number; count: number }[]; // 0=Sun
  mostActiveYear: { year: number; count: number } | null;
  mostActiveMonth: { month: number; count: number } | null;
  longestMonthStreak: number;
  longestGapDays: number;
  avgDaysBetween: number | null;
  avgDaysBoughtInAdvance: number | null;
  mostDaysBoughtInAdvance: AdvanceHighlight | null;
  fewestDaysBoughtInAdvance: AdvanceHighlight | null;
  festivals: number;
  singleConcerts: number;
  standing: number;
  seated: number;
  firstEver: ConcertRef | null;
  latest: ConcertRef | null;
  totalUniqueGuests: number;
  avgGuestsPerShow: number | null;
  mostGuestsAtShow: GuestsAtShowHighlight | null;
  /** One entry per show with ≥1 guest (for home-card rotation). */
  guestHighlightsByShow: GuestsAtShowHighlight[];
  totalMusicMinutes: number;
  avgDurationMin: number | null;
  longestShow: { minutes: number; ref: ConcertRef } | null;
};

export type ArtistLoyaltyRow = {
  name: string;
  asHeadliner: number;
  asLineup: number;
  asGuest: number;
};

export type ArtistsStats = {
  totalUnique: number;
  topByHeadliner: NamedValue[];
  topByPresence: NamedValue[]; // headliner + lineup + guest
  loyaltyRows: ArtistLoyaltyRow[];
  topByCities: NamedValue[];
  topByCountries: NamedValue[];
  topByVenues: NamedValue[];
  longestFollowed: { name: string; years: number; firstYear: number; lastYear: number } | null;
  artistsSeenOnce: NamedValue[];
  artistsNeverAgain: NamedValue[];
  topByTravelKm: NamedValue[];
  topByMusicMinutes: NamedValue[];
  topBySpend: NamedValue[]; // in EUR
  totalUniqueGuests: number;
  avgGuestsPerShow: number | null;
  mostGuestsAtShow: GuestsAtShowHighlight | null;
};

export type SongsStats = {
  totalUniqueTitles: number;
  totalSongRows: number;
  topByPlays: NamedValue[];
  songsHeardOnce: number;
  topByDistinctVenues: NamedValue[];
  topByDistinctCities: NamedValue[];
  mostCommonOpener: NamedValue[];
  mostCommonCloser: NamedValue[];
  mostCommonEncore: NamedValue[];
  coverCount: number;
  guestCount: number;
  setNameBreakdown: NamedValue[];
};

import type { VenueHeatmapSpot } from "@/lib/map/venue-heatmap-types";

export type { VenueHeatmapSpot };

export type VenuesStats = {
  totalUnique: number;
  topByVisits: NamedValue[];
  topByDistinctArtists: NamedValue[];
  totalCities: number;
  totalCountries: number;
  topCities: NamedValue[];
  topCountries: NamedValue[];
  visitedOnce: number;
  heatmapSpots: VenueHeatmapSpot[];
};

export type TravelStats = {
  totalKm: number;
  avgKm: number | null;
  longestTrip: { km: number; ref: ConcertRef } | null;
  shortestTrip: { km: number; ref: ConcertRef } | null;
  topByArtistKm: NamedValue[];
  byDepartureCity: NamedValue[];
  kmByDepartureCity: NamedValue[];
  countriesReached: number;
  furthestFromHome: { km: number; ref: ConcertRef; departure: string } | null;
};

export type FinanceStats = {
  totalSpentEur: number;
  avgTicketEur: number | null;
  mostExpensive: { eur: number; ref: ConcertRef } | null;
  cheapest: { eur: number; ref: ConcertRef } | null;
  topSpendByArtist: NamedValue[];
  avgPricePerYear: { year: number; eur: number }[];
  cheapestPerMin: { eurPerMin: number; ref: ConcertRef } | null;
  mostExpensivePerMin: { eurPerMin: number; ref: ConcertRef } | null;
  avgEurPerMin: number | null;
};

export type FullStatistics = {
  hasData: boolean;
  generatedAtIso: string;
  concerts: ConcertsStats;
  artists: ArtistsStats;
  songs: SongsStats;
  venues: VenuesStats;
  travel: TravelStats;
  finance: FinanceStats;
};

/* ------------------------------------------------------------------ */
/* Internal row shapes                                                 */
/* ------------------------------------------------------------------ */

type RawAttendance = {
  id: string;
  gig_id: string;
  is_standing: boolean;
  ticket_price_cents: number | null;
  ticket_currency: string | null;
  days_bought_in_advance: number | null;
  travel_km: number | null;
  departure_city: string | null;
  departure_country: string | null;
  gigs:
    | RawGig
    | RawGig[]
    | null;
};

type RawGig = {
  id: string;
  gig_date: string;
  tour_name: string | null;
  is_festival: boolean;
  was_cancelled: boolean;
  concert_duration_minutes: number | null;
  artist_id: string;
  venue_id: string;
  source: string | null;
};

type Flat = {
  attendanceId: string;
  gigId: string;
  isStanding: boolean;
  ticketCents: number | null;
  ticketCurrency: string;
  daysBoughtInAdvance: number | null;
  travelKm: number | null;
  departureCity: string | null;
  departureCountry: string | null;
  date: string;
  tourName: string | null;
  isFestival: boolean;
  wasCancelled: boolean;
  durationMin: number | null;
  artistId: string;
  venueId: string;
  gigSource: string | null;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** EUR ticket with a price actually logged (excludes null and placeholder 0). */
function hasLoggedEurTicketPrice(r: Pick<Flat, "ticketCents" | "ticketCurrency">): boolean {
  return (
    r.ticketCents != null &&
    Number.isFinite(r.ticketCents) &&
    r.ticketCents > 0 &&
    r.ticketCurrency === "EUR"
  );
}

function emptyStats(): FullStatistics {
  return {
    hasData: false,
    generatedAtIso: new Date().toISOString(),
    concerts: {
      total: 0,
      perYear: [],
      perMonth: [],
      perDayOfWeek: [],
      mostActiveYear: null,
      mostActiveMonth: null,
      longestMonthStreak: 0,
      longestGapDays: 0,
      avgDaysBetween: null,
      avgDaysBoughtInAdvance: null,
      mostDaysBoughtInAdvance: null,
      fewestDaysBoughtInAdvance: null,
      festivals: 0,
      singleConcerts: 0,
      standing: 0,
      seated: 0,
      firstEver: null,
      latest: null,
      totalUniqueGuests: 0,
      avgGuestsPerShow: null,
      mostGuestsAtShow: null,
      guestHighlightsByShow: [],
      totalMusicMinutes: 0,
      avgDurationMin: null,
      longestShow: null,
    },
    artists: {
      totalUnique: 0,
      topByHeadliner: [],
      topByPresence: [],
      loyaltyRows: [],
      topByCities: [],
      topByCountries: [],
      topByVenues: [],
      longestFollowed: null,
      artistsSeenOnce: [],
      artistsNeverAgain: [],
      topByTravelKm: [],
      topByMusicMinutes: [],
      topBySpend: [],
      totalUniqueGuests: 0,
      avgGuestsPerShow: null,
      mostGuestsAtShow: null,
    },
    songs: {
      totalUniqueTitles: 0,
      totalSongRows: 0,
      topByPlays: [],
      songsHeardOnce: 0,
      topByDistinctVenues: [],
      topByDistinctCities: [],
      mostCommonOpener: [],
      mostCommonCloser: [],
      mostCommonEncore: [],
      coverCount: 0,
      guestCount: 0,
      setNameBreakdown: [],
    },
    venues: {
      totalUnique: 0,
      topByVisits: [],
      topByDistinctArtists: [],
      totalCities: 0,
      totalCountries: 0,
      topCities: [],
      topCountries: [],
      visitedOnce: 0,
      heatmapSpots: [],
    },
    travel: {
      totalKm: 0,
      avgKm: null,
      longestTrip: null,
      shortestTrip: null,
      topByArtistKm: [],
      byDepartureCity: [],
      kmByDepartureCity: [],
      countriesReached: 0,
      furthestFromHome: null,
    },
    finance: {
      totalSpentEur: 0,
      avgTicketEur: null,
      mostExpensive: null,
      cheapest: null,
      topSpendByArtist: [],
      avgPricePerYear: [],
      cheapestPerMin: null,
      mostExpensivePerMin: null,
      avgEurPerMin: null,
    },
  };
}

function yearOf(iso: string): number | null {
  const t = iso?.trim();
  if (!t) return null;
  const y = Number.parseInt(t.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

function monthOf(iso: string): number | null {
  const t = iso?.trim();
  if (!t || t.length < 7) return null;
  const m = Number.parseInt(t.slice(5, 7), 10);
  return Number.isFinite(m) && m >= 1 && m <= 12 ? m - 1 : null;
}

function dowOf(iso: string): number | null {
  const t = iso?.trim();
  if (!t) return null;
  const d = new Date(`${t}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d.getUTCDay();
}

function topN<T extends { value: number }>(arr: T[], n = 10): T[] {
  return [...arr].sort((a, b) => b.value - a.value).slice(0, n);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T12:00:00Z`).getTime();
  const db = new Date(`${b}T12:00:00Z`).getTime();
  return Math.round(Math.abs(db - da) / (1000 * 60 * 60 * 24));
}

/* ------------------------------------------------------------------ */
/* Main loader                                                         */
/* ------------------------------------------------------------------ */

export async function getFullStatistics(): Promise<FullStatistics> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return emptyStats();

  await repairCombinedBillingGigsForUser(supabase, user.id);

  const { data: attRows, error: attErr } = await supabase
    .from("gig_attendances")
    .select(
      `
      id,
      gig_id,
      is_standing,
      ticket_price_cents,
      ticket_currency,
      days_bought_in_advance,
      travel_km,
      departure_city,
      departure_country,
      gigs (
        id,
        gig_date,
        tour_name,
        is_festival,
        was_cancelled,
        concert_duration_minutes,
        artist_id,
        venue_id,
        source
      )
    `,
    )
    .eq("user_id", user.id);

  if (attErr || !attRows?.length) return emptyStats();

  const flat: Flat[] = [];
  for (const r of attRows as RawAttendance[]) {
    const g = Array.isArray(r.gigs) ? r.gigs[0] : r.gigs;
    if (!g?.id || !g.gig_date) continue;
    flat.push({
      attendanceId: r.id,
      gigId: g.id,
      isStanding: Boolean(r.is_standing),
      ticketCents: r.ticket_price_cents,
      ticketCurrency: (r.ticket_currency ?? "EUR").toUpperCase(),
      daysBoughtInAdvance:
        r.days_bought_in_advance != null && Number.isFinite(r.days_bought_in_advance)
          ? Math.round(Number(r.days_bought_in_advance))
          : null,
      travelKm: r.travel_km != null ? Number(r.travel_km) : null,
      departureCity: r.departure_city,
      departureCountry: r.departure_country,
      date: g.gig_date,
      tourName: g.tour_name,
      isFestival: Boolean(g.is_festival),
      wasCancelled: Boolean(g.was_cancelled),
      durationMin: g.concert_duration_minutes,
      artistId: g.artist_id,
      venueId: g.venue_id,
      gigSource: g.source ?? null,
    });
  }

  if (flat.length === 0) return emptyStats();

  // Drop cancelled gigs from counts (matches existing behaviour elsewhere)
  const liveFlat = flat.filter((r) => !r.wasCancelled);

  const gigIds = Array.from(new Set(liveFlat.map((r) => r.gigId)));
  const artistIds = Array.from(new Set(liveFlat.map((r) => r.artistId)));
  const venueIds = Array.from(new Set(liveFlat.map((r) => r.venueId)));

  const [{ data: artists }, { data: venues }, { data: songs }, { data: lineup }] =
    await Promise.all([
      artistIds.length
        ? supabase.from("artists").select("id,name").in("id", artistIds)
        : Promise.resolve({ data: [] }),
      venueIds.length
        ? supabase
            .from("venues")
            .select("id,name,city,country_code,lat,lng")
            .in("id", venueIds)
        : Promise.resolve({ data: [] }),
      gigIds.length
        ? supabase
            .from("gig_songs")
            .select(
              "id, gig_id, title, position, is_encore, is_cover, is_tape, guest_artist_id, set_name, featuring_names",
            )
            .in("gig_id", gigIds)
        : Promise.resolve({ data: [] }),
      gigIds.length
        ? supabase
            .from("gig_lineup_artists")
            .select("gig_id, artist_id, is_co_headliner")
            .in("gig_id", gigIds)
        : Promise.resolve({ data: [] }),
    ]);

  /* ---------- Lookup maps ---------- */
  const artistName = new Map<string, string>();
  for (const a of (artists ?? []) as { id: string; name?: string }[]) {
    artistName.set(a.id, String(a.name ?? "").trim() || "Artist");
  }
  // Ensure any guest artist not in the base set gets a fallback (we'll fetch later if needed)
  const venueRow = new Map<
    string,
    { name: string; city: string; country: string; lat: number | null; lng: number | null }
  >();
  for (const v of (venues ?? []) as {
    id: string;
    name?: string;
    city?: string;
    country_code?: string;
    lat?: number | string | null;
    lng?: number | string | null;
  }[]) {
    const latRaw = v.lat;
    const lngRaw = v.lng;
    const lat =
      latRaw != null && Number.isFinite(Number(latRaw)) ? Number(latRaw) : null;
    const lng =
      lngRaw != null && Number.isFinite(Number(lngRaw)) ? Number(lngRaw) : null;
    venueRow.set(v.id, {
      name: String(v.name ?? "").trim() || "Venue",
      city: String(v.city ?? "").trim(),
      country: String(v.country_code ?? "").trim(),
      lat,
      lng,
    });
  }

  /* Fetch any extra artist names (guest in songs, lineup) not yet known */
  const extraArtistIds = new Set<string>();
  for (const s of (songs ?? []) as { guest_artist_id?: string | null }[]) {
    if (s.guest_artist_id && !artistName.has(s.guest_artist_id)) {
      extraArtistIds.add(s.guest_artist_id);
    }
  }
  for (const l of (lineup ?? []) as { artist_id?: string }[]) {
    if (l.artist_id && !artistName.has(l.artist_id)) extraArtistIds.add(l.artist_id);
  }

  type LineupRow = { gig_id: string; artist_id: string; is_co_headliner?: boolean };
  const lineupRows = (lineup ?? []) as LineupRow[];
  if (extraArtistIds.size > 0) {
    const { data: extra } = await supabase
      .from("artists")
      .select("id,name")
      .in("id", Array.from(extraArtistIds));
    for (const a of (extra ?? []) as { id: string; name?: string }[]) {
      artistName.set(a.id, String(a.name ?? "").trim() || "Artist");
    }
  }

  /* Index songs and lineup by gig */
  const songsByGig = new Map<
    string,
    {
      id: string;
      title: string;
      position: number;
      isEncore: boolean;
      isCover: boolean;
      isTape: boolean;
      guestArtistId: string | null;
      setName: string | null;
    }[]
  >();
  for (const s of (songs ?? []) as {
    id: string;
    gig_id: string;
    title: string;
    position: number;
    is_encore: boolean | null;
    is_cover: boolean | null;
    is_tape: boolean | null;
    guest_artist_id: string | null;
    set_name: string | null;
  }[]) {
    if (!songsByGig.has(s.gig_id)) songsByGig.set(s.gig_id, []);
    songsByGig.get(s.gig_id)!.push({
      id: s.id,
      title: String(s.title ?? "").trim(),
      position: Number(s.position) || 0,
      isEncore: Boolean(s.is_encore),
      isCover: Boolean(s.is_cover),
      isTape: Boolean(s.is_tape),
      guestArtistId: s.guest_artist_id,
      setName: s.set_name,
    });
  }

  const lineupByGigId = new Map<string, LineupRowInput[]>();
  for (const l of lineupRows) {
    if (!lineupByGigId.has(l.gig_id)) lineupByGigId.set(l.gig_id, []);
    lineupByGigId.get(l.gig_id)!.push({
      artist_id: l.artist_id,
      is_co_headliner: l.is_co_headliner,
    });
  }

  const gigSourceByGig = new Map<string, string | null>();
  for (const r of liveFlat) gigSourceByGig.set(r.gigId, r.gigSource);

  const billingRolesByGig = new Map<string, ReturnType<typeof resolveGigBillingRoles>>();
  for (const r of liveFlat) {
    if (billingRolesByGig.has(r.gigId)) continue;
    billingRolesByGig.set(
      r.gigId,
      resolveGigBillingRoles(
        r.artistId,
        artistName.get(r.artistId) ?? "",
        lineupByGigId.get(r.gigId) ?? [],
        artistName,
        gigSourceByGig.get(r.gigId) ?? null,
      ),
    );
  }

  const rawSongs = (songs ?? []) as {
    id: string;
    gig_id: string;
    guest_artist_id: string | null;
    featuring_names: string | null;
  }[];

  const allSongIds = rawSongs.map((s) => s.id);
  const { data: featLinks } =
    allSongIds.length > 0
      ? await supabase
          .from("gig_song_featuring_artists")
          .select("gig_song_id, artist_id")
          .in("gig_song_id", allSongIds)
      : { data: [] as { gig_song_id: string; artist_id: string }[] };

  const guestByGig = buildGuestArtistIdsByGig(
    rawSongs.map((s) => ({
      id: s.id,
      gig_id: s.gig_id,
      guest_artist_id: s.guest_artist_id,
    })),
    (featLinks ?? []) as { gig_song_id: string; artist_id: string }[],
  );

  const songsGuestInputByGig = new Map<string, GigSongGuestInput[]>();
  for (const s of rawSongs) {
    if (!songsGuestInputByGig.has(s.gig_id)) songsGuestInputByGig.set(s.gig_id, []);
    songsGuestInputByGig.get(s.gig_id)!.push({
      guestArtistId: s.guest_artist_id,
      featuringNames: s.featuring_names,
    });
  }

  const computeLifetimeUniqueGuests = (): number => {
    const lifetime = new Set<string>();
    for (const r of liveFlat) {
      const roles = billingRolesByGig.get(r.gigId)!;
      const headIds = new Set([
        roles.primaryArtistId,
        ...roles.coHeadlinerArtistIds,
      ]);
      const head = roles.primaryArtistId;
      const ids = Array.from(guestByGig.get(r.gigId) ?? []).filter((id) => !headIds.has(id));
      const songs = songsGuestInputByGig.get(r.gigId) ?? [];
      const keys = collectUniqueGuestNameKeysForGig(head, songs, ids, artistName);
      keys.forEach((k) => lifetime.add(k));
    }
    return lifetime.size;
  };

  const toRef = (r: Flat): ConcertRef => {
    const v = venueRow.get(r.venueId);
    const roles = billingRolesByGig.get(r.gigId);
    const displayArtist =
      roles != null
        ? formatGigHeadlinerDisplay(roles, artistName, r.artistId)
        : (artistName.get(r.artistId) ?? "Artist");
    return {
      attendanceId: r.attendanceId,
      gigId: r.gigId,
      date: r.date,
      artistName: displayArtist,
      venueName: v?.name ?? "Venue",
      city: v?.city ?? "",
      country: v?.country ?? "",
    };
  };

  /* ============================================================== */
  /* CONCERTS                                                        */
  /* ============================================================== */
  const concerts: ConcertsStats = (() => {
    const sortedAsc = [...liveFlat].sort((a, b) => a.date.localeCompare(b.date));
    const total = sortedAsc.length;

    // Per year / month / dow
    const yearMap = new Map<number, number>();
    const monthMap = new Map<number, number>();
    const dowMap = new Map<number, number>();
    let festivals = 0;
    let standing = 0;
    for (const r of sortedAsc) {
      const y = yearOf(r.date);
      if (y != null) yearMap.set(y, (yearMap.get(y) ?? 0) + 1);
      const m = monthOf(r.date);
      if (m != null) monthMap.set(m, (monthMap.get(m) ?? 0) + 1);
      const dw = dowOf(r.date);
      if (dw != null) dowMap.set(dw, (dowMap.get(dw) ?? 0) + 1);
      if (r.isFestival) festivals += 1;
      if (r.isStanding) standing += 1;
    }

    const perYear = Array.from(yearMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, count]) => ({ year, count }));
    const perMonth = Array.from({ length: 12 }, (_, m) => ({
      month: m,
      count: monthMap.get(m) ?? 0,
    }));
    const perDayOfWeek = Array.from({ length: 7 }, (_, dw) => ({
      dow: dw,
      count: dowMap.get(dw) ?? 0,
    }));

    let mostActiveYear: { year: number; count: number } | null = null;
    for (const y of perYear) {
      if (!mostActiveYear || y.count > mostActiveYear.count) mostActiveYear = y;
    }
    let mostActiveMonth: { month: number; count: number } | null = null;
    for (const m of perMonth) {
      if (m.count > 0 && (!mostActiveMonth || m.count > mostActiveMonth.count)) {
        mostActiveMonth = m;
      }
    }

    // Longest streak of consecutive calendar months with ≥1 concert
    const monthKeys = new Set<string>();
    for (const r of sortedAsc) {
      monthKeys.add(r.date.slice(0, 7));
    }
    const sortedMonths = Array.from(monthKeys).sort();
    let longestMonthStreak = 0;
    let curStreak = 0;
    let prev: string | null = null;
    for (const mk of sortedMonths) {
      if (prev == null) {
        curStreak = 1;
      } else {
        const [py, pm] = prev.split("-").map(Number);
        const [cy, cm] = mk.split("-").map(Number);
        const diff = (cy - py) * 12 + (cm - pm);
        curStreak = diff === 1 ? curStreak + 1 : 1;
      }
      if (curStreak > longestMonthStreak) longestMonthStreak = curStreak;
      prev = mk;
    }

    // Longest gap and avg days between
    let longestGapDays = 0;
    if (sortedAsc.length >= 2) {
      for (let i = 1; i < sortedAsc.length; i++) {
        const d = daysBetween(sortedAsc[i - 1].date, sortedAsc[i].date);
        if (d > longestGapDays) longestGapDays = d;
      }
    }
    const avgDaysBetween =
      sortedAsc.length >= 2
        ? daysBetween(sortedAsc[0].date, sortedAsc[sortedAsc.length - 1].date) /
          (sortedAsc.length - 1)
        : null;

    const advanceSamples: { days: number; ref: ConcertRef }[] = [];
    for (const r of liveFlat) {
      if (r.daysBoughtInAdvance == null || r.daysBoughtInAdvance < 0) continue;
      advanceSamples.push({ days: r.daysBoughtInAdvance, ref: toRef(r) });
    }
    let avgDaysBoughtInAdvance: number | null = null;
    let mostDaysBoughtInAdvance: AdvanceHighlight | null = null;
    let fewestDaysBoughtInAdvance: AdvanceHighlight | null = null;
    if (advanceSamples.length > 0) {
      const sum = advanceSamples.reduce((acc, s) => acc + s.days, 0);
      avgDaysBoughtInAdvance = sum / advanceSamples.length;
      for (const s of advanceSamples) {
        if (!mostDaysBoughtInAdvance || s.days > mostDaysBoughtInAdvance.days) {
          mostDaysBoughtInAdvance = { days: s.days, ref: s.ref };
        }
        if (!fewestDaysBoughtInAdvance || s.days < fewestDaysBoughtInAdvance.days) {
          fewestDaysBoughtInAdvance = { days: s.days, ref: s.ref };
        }
      }
    }

    const guestHighlightsByShow: GuestsAtShowHighlight[] = [];
    let guestSum = 0;
    let mostGuestsAtShow: GuestsAtShowHighlight | null = null;
    for (const r of liveFlat) {
      const count = guestCountForGig(
        r.gigId,
        r.artistId,
        guestByGig,
        songsGuestInputByGig,
        artistName,
      );
      guestSum += count;
      if (count > 0) {
        const highlight = { count, ref: toRef(r) };
        guestHighlightsByShow.push(highlight);
        if (!mostGuestsAtShow || count > mostGuestsAtShow.count) {
          mostGuestsAtShow = highlight;
        }
      }
    }
    guestHighlightsByShow.sort((a, b) => b.count - a.count);
    const totalUniqueGuests = computeLifetimeUniqueGuests();
    const avgGuestsPerShow = total > 0 ? guestSum / total : null;

    const withDur = liveFlat.filter((r) => r.durationMin != null && r.durationMin > 0);
    const totalMusicMinutes = withDur.reduce((acc, r) => acc + (r.durationMin ?? 0), 0);
    const avgDurationMin =
      withDur.length > 0 ? totalMusicMinutes / withDur.length : null;
    let longestShow: ConcertsStats["longestShow"] = null;
    for (const r of withDur) {
      const m = r.durationMin!;
      if (!longestShow || m > longestShow.minutes) {
        longestShow = { minutes: m, ref: toRef(r) };
      }
    }

    return {
      total,
      perYear,
      perMonth,
      perDayOfWeek,
      mostActiveYear,
      mostActiveMonth,
      longestMonthStreak,
      longestGapDays,
      avgDaysBetween,
      avgDaysBoughtInAdvance,
      mostDaysBoughtInAdvance,
      fewestDaysBoughtInAdvance,
      festivals,
      singleConcerts: total - festivals,
      standing,
      seated: total - standing,
      firstEver: sortedAsc[0] ? toRef(sortedAsc[0]) : null,
      latest: sortedAsc[sortedAsc.length - 1] ? toRef(sortedAsc[sortedAsc.length - 1]) : null,
      totalUniqueGuests,
      avgGuestsPerShow,
      mostGuestsAtShow,
      guestHighlightsByShow,
      totalMusicMinutes,
      avgDurationMin,
      longestShow,
    };
  })();

  /* ============================================================== */
  /* ARTISTS                                                          */
  /* ============================================================== */
  const artistsStats = (() => {
    // Headliner counts per artist
    const headCount = new Map<string, number>();
    const artistCityMap = new Map<string, Set<string>>();
    const artistCountryMap = new Map<string, Set<string>>();
    const artistVenueMap = new Map<string, Set<string>>();
    const artistKm = new Map<string, number>();
    const artistMinutes = new Map<string, number>();
    const artistSpendCents = new Map<string, number>();
    const artistDates = new Map<string, string[]>();

    for (const r of liveFlat) {
      const roles = billingRolesByGig.get(r.gigId)!;
      const headIds = new Set([
        roles.primaryArtistId,
        ...roles.coHeadlinerArtistIds,
      ]);
      // Always credit the gig's stored headliner when it is a single real artist
      // (e.g. Setlist.fm import "Mostro" on a Lowlow & Mostro co-bill).
      const gigHeadName = artistName.get(r.artistId) ?? "";
      if (r.artistId && !isCombinedBillingArtistName(gigHeadName)) {
        headIds.add(r.artistId);
      }
      for (const aid of Array.from(headIds)) {
        headCount.set(aid, (headCount.get(aid) ?? 0) + 1);
      }
      const v = venueRow.get(r.venueId);
      for (const aid of Array.from(headIds)) {
        if (v?.city) {
          if (!artistCityMap.has(aid)) artistCityMap.set(aid, new Set());
          artistCityMap.get(aid)!.add(v.city.toLowerCase());
        }
        if (v?.country) {
          if (!artistCountryMap.has(aid)) artistCountryMap.set(aid, new Set());
          artistCountryMap.get(aid)!.add(v.country.toLowerCase());
        }
        if (!artistVenueMap.has(aid)) artistVenueMap.set(aid, new Set());
        artistVenueMap.get(aid)!.add(r.venueId);
        if (r.travelKm != null && Number.isFinite(r.travelKm)) {
          artistKm.set(aid, (artistKm.get(aid) ?? 0) + r.travelKm);
        }
        if (r.durationMin != null && r.durationMin > 0) {
          artistMinutes.set(aid, (artistMinutes.get(aid) ?? 0) + r.durationMin);
        }
        if (hasLoggedEurTicketPrice(r)) {
          artistSpendCents.set(aid, (artistSpendCents.get(aid) ?? 0) + (r.ticketCents ?? 0));
        }
        if (!artistDates.has(aid)) artistDates.set(aid, []);
        artistDates.get(aid)!.push(r.date);
      }
    }

    const guestAppearances = new Map<string, number>();
    for (const r of liveFlat) {
      const roles = billingRolesByGig.get(r.gigId)!;
      const headIds = new Set([
        roles.primaryArtistId,
        ...roles.coHeadlinerArtistIds,
      ]);
      const ids = guestByGig.get(r.gigId) ?? new Set<string>();
      Array.from(ids).forEach((aid) => {
        if (headIds.has(aid)) return;
        guestAppearances.set(aid, (guestAppearances.get(aid) ?? 0) + 1);
      });
    }

    const lineupAppearances = new Map<string, number>();
    for (const r of liveFlat) {
      const roles = billingRolesByGig.get(r.gigId)!;
      for (const sid of roles.supportLineupArtistIds) {
        lineupAppearances.set(sid, (lineupAppearances.get(sid) ?? 0) + 1);
      }
    }

    // Presence (headliner + lineup + guest on songs)
    const presence = new Map<string, number>();
    headCount.forEach((c, aid) => presence.set(aid, (presence.get(aid) ?? 0) + c));
    lineupAppearances.forEach((c, aid) => presence.set(aid, (presence.get(aid) ?? 0) + c));
    guestAppearances.forEach((c, aid) => presence.set(aid, (presence.get(aid) ?? 0) + c));

    const totalUnique = new Set(Array.from(presence.keys())).size;

    const isRankableArtist = (aid: string) =>
      !isCombinedBillingArtistName(artistName.get(aid) ?? "");

    const mkArtistList = (
      src: Iterable<[string, number]>,
      n = 10,
      formatDetail?: (count: number) => string,
    ): NamedValue[] =>
      topN(
        Array.from(src)
          .filter(([aid]) => isRankableArtist(aid))
          .map(([aid, count]) => ({
            name: artistName.get(aid) ?? "Artist",
            value: count,
            detail: formatDetail ? formatDetail(count) : null,
          })),
        n,
      );

    const topByHeadliner = mkArtistList(headCount, 10, (c) =>
      `${c} ${c === 1 ? "show" : "shows"}`,
    );
    const topByPresence = mkArtistList(presence, 10, (c) =>
      `${c} appearance${c === 1 ? "" : "s"}`,
    );
    const topByCities = mkArtistList(
      Array.from(artistCityMap.entries()).map(([aid, s]) => [aid, s.size] as const),
      8,
      (c) => `${c} ${c === 1 ? "city" : "cities"}`,
    );
    const topByCountries = mkArtistList(
      Array.from(artistCountryMap.entries()).map(([aid, s]) => [aid, s.size] as const),
      8,
      (c) => `${c} ${c === 1 ? "country" : "countries"}`,
    );
    const topByVenues = mkArtistList(
      Array.from(artistVenueMap.entries()).map(([aid, s]) => [aid, s.size] as const),
      8,
      (c) => `${c} ${c === 1 ? "venue" : "venues"}`,
    );
    const topByTravelKm = mkArtistList(
      Array.from(artistKm.entries()).map(([aid, km]) => [aid, Math.round(km)] as const),
      8,
      (km) => `${km.toLocaleString("en-US")} km`,
    );
    const topByMusicMinutes = mkArtistList(
      Array.from(artistMinutes.entries()).map(([aid, m]) => [aid, m] as const),
      8,
      (m) => `${Math.floor(m / 60)}h ${m % 60}m`,
    );
    const topBySpend = mkArtistList(
      Array.from(artistSpendCents.entries()).map(
        ([aid, cents]) => [aid, Math.round(cents / 100)] as const,
      ),
      8,
      (eur) => `€${eur.toLocaleString("en-US")}`,
    );

    // Longest followed
    let longestFollowed: ArtistsStats["longestFollowed"] = null;
    Array.from(artistDates.entries()).forEach(([aid, dates]) => {
      if (dates.length < 2) return;
      const sorted = [...dates].sort();
      const firstY = yearOf(sorted[0])!;
      const lastY = yearOf(sorted[sorted.length - 1])!;
      const years = lastY - firstY;
      if (years <= 0) return;
      if (!longestFollowed || years > longestFollowed.years) {
        longestFollowed = {
          name: artistName.get(aid) ?? "Artist",
          years,
          firstYear: firstY,
          lastYear: lastY,
        };
      }
    });

    // Seen once
    const artistsSeenOnce: NamedValue[] = [];
    const artistsNeverAgain: NamedValue[] = [];
    Array.from(headCount.entries()).forEach(([aid, c]) => {
      if (c !== 1 || !isRankableArtist(aid)) return;
      const dates = artistDates.get(aid) ?? [];
      const y = dates[0] ? yearOf(dates[0]) : null;
      artistsSeenOnce.push({
        name: artistName.get(aid) ?? "Artist",
        value: 1,
        detail: y != null ? String(y) : null,
      });
      artistsNeverAgain.push({
        name: artistName.get(aid) ?? "Artist",
        value: 1,
        detail: y != null ? `since ${y}` : null,
      });
    });
    artistsSeenOnce.sort((a, b) => a.name.localeCompare(b.name));
    artistsNeverAgain.sort((a, b) => a.name.localeCompare(b.name));

    const loyaltyArtistIds = Array.from(
      new Set<string>([
        ...Array.from(headCount.keys()),
        ...Array.from(lineupAppearances.keys()),
        ...Array.from(guestAppearances.keys()),
      ]),
    );
    const loyaltyRows: ArtistLoyaltyRow[] = [];
    loyaltyArtistIds.forEach((aid) => {
      if (!isRankableArtist(aid)) return;
      const asHeadliner = headCount.get(aid) ?? 0;
      const asLineup = lineupAppearances.get(aid) ?? 0;
      const asGuest = guestAppearances.get(aid) ?? 0;
      if (asHeadliner + asLineup + asGuest === 0) return;
      loyaltyRows.push({
        name: artistName.get(aid) ?? "Artist",
        asHeadliner,
        asLineup,
        asGuest,
      });
    });
    loyaltyRows.sort((a, b) => {
      const ta = a.asHeadliner + a.asLineup + a.asGuest;
      const tb = b.asHeadliner + b.asLineup + b.asGuest;
      return tb - ta || a.name.localeCompare(b.name);
    });

    return {
      totalUnique,
      topByHeadliner,
      topByPresence,
      loyaltyRows,
      topByCities,
      topByCountries,
      topByVenues,
      longestFollowed,
      artistsSeenOnce: artistsSeenOnce.slice(0, 20),
      artistsNeverAgain: artistsNeverAgain.slice(0, 20),
      topByTravelKm,
      topByMusicMinutes,
      topBySpend,
    };
  })();

  /* ============================================================== */
  /* SONGS                                                            */
  /* ============================================================== */
  const songsStats: SongsStats = (() => {
    type Bag = {
      display: string;
      plays: number;
      venues: Set<string>;
      cities: Set<string>;
      isEncoreCount: number;
      coverCount: number;
      guestCount: number;
    };
    const bag = new Map<string, Bag>();
    const openerByGig = new Map<string, string>();
    const closerByGig = new Map<string, string>();
    const setNameMap = new Map<string, number>();
    let totalSongRows = 0;
    let coverCount = 0;
    let guestCount = 0;

    for (const r of liveFlat) {
      const arr = songsByGig.get(r.gigId) ?? [];
      // Find opener (lowest position, not tape) and closer (highest position, not tape, non-encore preferred)
      const live = arr.filter((s) => !s.isTape && s.title);
      if (live.length > 0) {
        const sortedByPos = [...live].sort((a, b) => a.position - b.position);
        openerByGig.set(r.gigId, sortedByPos[0].title);
        const lastNonEnc = [...sortedByPos].reverse().find((s) => !s.isEncore);
        const lastAny = sortedByPos[sortedByPos.length - 1];
        closerByGig.set(r.gigId, (lastNonEnc ?? lastAny).title);
      }

      const v = venueRow.get(r.venueId);
      for (const s of arr) {
        if (s.isTape || !s.title) continue;
        totalSongRows += 1;
        const key = s.title.toLowerCase();
        if (!bag.has(key)) {
          bag.set(key, {
            display: s.title,
            plays: 0,
            venues: new Set(),
            cities: new Set(),
            isEncoreCount: 0,
            coverCount: 0,
            guestCount: 0,
          });
        }
        const b = bag.get(key)!;
        b.plays += 1;
        b.venues.add(r.venueId);
        if (v?.city) b.cities.add(v.city.toLowerCase());
        if (s.isEncore) b.isEncoreCount += 1;
        if (s.isCover) {
          b.coverCount += 1;
          coverCount += 1;
        }
        if (s.guestArtistId) {
          b.guestCount += 1;
          guestCount += 1;
        }
        const sn = s.setName?.trim();
        if (sn) setNameMap.set(sn, (setNameMap.get(sn) ?? 0) + 1);
      }
    }

    const allBags = Array.from(bag.values());

    const topByPlays = topN(
      allBags.map((b) => ({ name: b.display, value: b.plays })),
      10,
    );
    const topByDistinctVenues = topN(
      allBags
        .filter((b) => b.venues.size >= 2)
        .map((b) => ({
          name: b.display,
          value: b.venues.size,
          detail: `${b.plays} play${b.plays === 1 ? "" : "s"}`,
        })),
      8,
    );
    const topByDistinctCities = topN(
      allBags
        .filter((b) => b.cities.size >= 2)
        .map((b) => ({
          name: b.display,
          value: b.cities.size,
          detail: `${b.plays} play${b.plays === 1 ? "" : "s"}`,
        })),
      8,
    );

    const openerMap = new Map<string, number>();
    openerByGig.forEach((t) => openerMap.set(t, (openerMap.get(t) ?? 0) + 1));
    const closerMap = new Map<string, number>();
    closerByGig.forEach((t) => closerMap.set(t, (closerMap.get(t) ?? 0) + 1));
    const encoreMap = new Map<string, number>();
    for (const b of allBags) {
      if (b.isEncoreCount > 0) encoreMap.set(b.display, b.isEncoreCount);
    }

    const mkFromMap = (m: Map<string, number>): NamedValue[] =>
      topN(
        Array.from(m.entries()).map(([name, value]) => ({ name, value })),
        6,
      );

    const songsHeardOnce = allBags.filter((b) => b.plays === 1).length;

    return {
      totalUniqueTitles: allBags.length,
      totalSongRows,
      topByPlays,
      songsHeardOnce,
      topByDistinctVenues,
      topByDistinctCities,
      mostCommonOpener: mkFromMap(openerMap),
      mostCommonCloser: mkFromMap(closerMap),
      mostCommonEncore: mkFromMap(encoreMap),
      coverCount,
      guestCount,
      setNameBreakdown: topN(
        Array.from(setNameMap.entries()).map(([name, value]) => ({ name, value })),
        8,
      ),
    };
  })();

  /* ============================================================== */
  /* VENUES                                                           */
  /* ============================================================== */
  const venuesStats: VenuesStats = (() => {
    const visits = new Map<string, number>();
    const venueArtistSet = new Map<string, Set<string>>();
    const citySet = new Set<string>();
    const countrySet = new Set<string>();
    const cityCount = new Map<string, number>();
    const countryCount = new Map<string, number>();

    for (const r of liveFlat) {
      visits.set(r.venueId, (visits.get(r.venueId) ?? 0) + 1);
      if (!venueArtistSet.has(r.venueId)) venueArtistSet.set(r.venueId, new Set());
      venueArtistSet.get(r.venueId)!.add(r.artistId);
      const v = venueRow.get(r.venueId);
      if (v?.city) {
        citySet.add(v.city.toLowerCase());
        cityCount.set(v.city, (cityCount.get(v.city) ?? 0) + 1);
      }
      if (v?.country) {
        countrySet.add(v.country.toLowerCase());
        countryCount.set(v.country, (countryCount.get(v.country) ?? 0) + 1);
      }
    }

    const labelFor = (vid: string) => {
      const v = venueRow.get(vid);
      return v ? [v.name, v.city].filter(Boolean).join(", ") : "Venue";
    };

    const topByVisits = topN(
      Array.from(visits.entries()).map(([vid, value]) => ({
        name: labelFor(vid),
        value,
        detail: `${value} visit${value === 1 ? "" : "s"}`,
      })),
      8,
    );

    const topByDistinctArtists = topN(
      Array.from(venueArtistSet.entries()).map(([vid, set]) => ({
        name: labelFor(vid),
        value: set.size,
        detail: `${set.size} artist${set.size === 1 ? "" : "s"}`,
      })),
      8,
    );

    const topCities = topN(
      Array.from(cityCount.entries()).map(([name, value]) => ({
        name,
        value,
        detail: `${value} show${value === 1 ? "" : "s"}`,
      })),
      8,
    );
    const topCountries = topN(
      Array.from(countryCount.entries()).map(([name, value]) => ({
        name,
        value,
        detail: `${value} show${value === 1 ? "" : "s"}`,
      })),
      8,
    );

    const visitedOnce = Array.from(visits.values()).filter((c) => c === 1).length;

    const artistNamesByVenue = new Map<string, Set<string>>();
    for (const r of liveFlat) {
      const roles = billingRolesByGig.get(r.gigId);
      const display =
        roles != null
          ? formatGigHeadlinerDisplay(roles, artistName, r.artistId)
          : (artistName.get(r.artistId) ?? "Artist");
      if (!artistNamesByVenue.has(r.venueId)) {
        artistNamesByVenue.set(r.venueId, new Set());
      }
      artistNamesByVenue.get(r.venueId)!.add(display);
    }

    const heatmapSpots: VenueHeatmapSpot[] = [];
    for (const [vid, concertCount] of Array.from(visits.entries())) {
      const v = venueRow.get(vid);
      if (!v || v.lat == null || v.lng == null) continue;
      const names = Array.from(artistNamesByVenue.get(vid) ?? []).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" }),
      );
      heatmapSpots.push({
        lat: v.lat,
        lng: v.lng,
        weight: concertCount,
        venueName: v.name,
        city: v.city,
        country: v.country,
        concertCount,
        artistNames: names,
      });
    }

    return {
      totalUnique: visits.size,
      topByVisits,
      topByDistinctArtists,
      totalCities: citySet.size,
      totalCountries: countrySet.size,
      topCities,
      topCountries,
      visitedOnce,
      heatmapSpots,
    };
  })();

  /* ============================================================== */
  /* TRAVEL                                                           */
  /* ============================================================== */
  const travelStats: TravelStats = (() => {
    const withKm = liveFlat.filter((r) => r.travelKm != null && Number.isFinite(r.travelKm));
    const totalKm = withKm.reduce((acc, r) => acc + (r.travelKm ?? 0), 0);
    const avgKm = withKm.length > 0 ? totalKm / withKm.length : null;

    let longestTrip: TravelStats["longestTrip"] = null;
    let shortestTrip: TravelStats["shortestTrip"] = null;
    let furthestFromHome: TravelStats["furthestFromHome"] = null;
    for (const r of withKm) {
      const km = r.travelKm!;
      if (!longestTrip || km > longestTrip.km) longestTrip = { km, ref: toRef(r) };
      if (km > 0 && (!shortestTrip || km < shortestTrip.km)) {
        shortestTrip = { km, ref: toRef(r) };
      }
      if (
        r.departureCity &&
        (!furthestFromHome || km > furthestFromHome.km)
      ) {
        furthestFromHome = {
          km,
          ref: toRef(r),
          departure: [r.departureCity, r.departureCountry].filter(Boolean).join(", "),
        };
      }
    }

    const artistKm = new Map<string, number>();
    for (const r of withKm) {
      artistKm.set(r.artistId, (artistKm.get(r.artistId) ?? 0) + (r.travelKm ?? 0));
    }
    const topByArtistKm = topN(
      Array.from(artistKm.entries()).map(([aid, km]) => ({
        name: artistName.get(aid) ?? "Artist",
        value: Math.round(km),
        detail: `${Math.round(km).toLocaleString("en-US")} km`,
      })),
      8,
    );

    const departureCount = new Map<string, number>();
    const departureKm = new Map<string, number>();
    for (const r of liveFlat) {
      const k = r.departureCity?.trim();
      if (!k) continue;
      departureCount.set(k, (departureCount.get(k) ?? 0) + 1);
      if (r.travelKm != null) {
        departureKm.set(k, (departureKm.get(k) ?? 0) + r.travelKm);
      }
    }
    const byDepartureCity = topN(
      Array.from(departureCount.entries()).map(([name, value]) => ({
        name,
        value,
        detail: `${value} concert${value === 1 ? "" : "s"}`,
      })),
      8,
    );
    const kmByDepartureCity = topN(
      Array.from(departureKm.entries()).map(([name, km]) => ({
        name,
        value: Math.round(km),
        detail: `${Math.round(km).toLocaleString("en-US")} km`,
      })),
      8,
    );

    const countriesSet = new Set<string>();
    for (const r of liveFlat) {
      const c = venueRow.get(r.venueId)?.country;
      if (c) countriesSet.add(c.toLowerCase());
    }

    return {
      totalKm,
      avgKm,
      longestTrip,
      shortestTrip,
      topByArtistKm,
      byDepartureCity,
      kmByDepartureCity,
      countriesReached: countriesSet.size,
      furthestFromHome,
    };
  })();

  /* ============================================================== */
  /* FINANCE                                                          */
  /* ============================================================== */
  const financeStats: FinanceStats = (() => {
    const withTicket = liveFlat.filter(hasLoggedEurTicketPrice);
    const totalCents = withTicket.reduce((acc, r) => acc + (r.ticketCents ?? 0), 0);
    const totalSpentEur = totalCents / 100;
    const avgTicketEur =
      withTicket.length > 0 ? totalCents / withTicket.length / 100 : null;

    let mostExpensive: FinanceStats["mostExpensive"] = null;
    let cheapest: FinanceStats["cheapest"] = null;
    for (const r of withTicket) {
      const eur = (r.ticketCents ?? 0) / 100;
      if (!mostExpensive || eur > mostExpensive.eur) {
        mostExpensive = { eur, ref: toRef(r) };
      }
      if (eur > 0 && (!cheapest || eur < cheapest.eur)) {
        cheapest = { eur, ref: toRef(r) };
      }
    }

    const artistCents = new Map<string, number>();
    for (const r of withTicket) {
      artistCents.set(r.artistId, (artistCents.get(r.artistId) ?? 0) + (r.ticketCents ?? 0));
    }
    const topSpendByArtist = topN(
      Array.from(artistCents.entries()).map(([aid, c]) => ({
        name: artistName.get(aid) ?? "Artist",
        value: Math.round(c / 100),
        detail: `€${Math.round(c / 100).toLocaleString("en-US")}`,
      })),
      8,
    );

    const yearMap = new Map<number, { sum: number; n: number }>();
    for (const r of withTicket) {
      const y = yearOf(r.date);
      if (y == null) continue;
      const bag = yearMap.get(y) ?? { sum: 0, n: 0 };
      bag.sum += r.ticketCents ?? 0;
      bag.n += 1;
      yearMap.set(y, bag);
    }
    const avgPricePerYear = Array.from(yearMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, { sum, n }]) => ({ year, eur: sum / n / 100 }));

    const perMinSamples: { ratio: number; ref: ConcertRef }[] = [];
    for (const r of withTicket) {
      if (!r.durationMin || r.durationMin <= 0) continue;
      const eur = (r.ticketCents ?? 0) / 100;
      perMinSamples.push({ ratio: eur / r.durationMin, ref: toRef(r) });
    }
    let cheapestPerMin: FinanceStats["cheapestPerMin"] = null;
    let mostExpensivePerMin: FinanceStats["mostExpensivePerMin"] = null;
    const avgEurPerMin =
      perMinSamples.length > 0
        ? perMinSamples.reduce((acc, s) => acc + s.ratio, 0) / perMinSamples.length
        : null;
    for (const s of perMinSamples) {
      if (!cheapestPerMin || s.ratio < cheapestPerMin.eurPerMin) {
        cheapestPerMin = { eurPerMin: s.ratio, ref: s.ref };
      }
      if (!mostExpensivePerMin || s.ratio > mostExpensivePerMin.eurPerMin) {
        mostExpensivePerMin = { eurPerMin: s.ratio, ref: s.ref };
      }
    }

    return {
      totalSpentEur,
      avgTicketEur,
      mostExpensive,
      cheapest,
      topSpendByArtist,
      avgPricePerYear,
      cheapestPerMin,
      mostExpensivePerMin,
      avgEurPerMin,
    };
  })();

  return {
    hasData: true,
    generatedAtIso: new Date().toISOString(),
    concerts,
    artists: {
      ...artistsStats,
      totalUniqueGuests: concerts.totalUniqueGuests,
      avgGuestsPerShow: concerts.avgGuestsPerShow,
      mostGuestsAtShow: concerts.mostGuestsAtShow,
    },
    songs: songsStats,
    venues: venuesStats,
    travel: travelStats,
    finance: financeStats,
  };
}
