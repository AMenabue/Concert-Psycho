"use server";

import {
  formatGigHeadlinerDisplay,
  isCombinedBillingArtistName,
  resolveGigBillingRoles,
  type LineupRowInput,
} from "@/lib/gigs/billing-headliners";
import { canonicalCityName } from "@/lib/geo/canonical-location";
import { repairCombinedBillingGigsForUser } from "@/lib/gigs/repair-billing-gigs";
import { repairCanonicalVenueLocationsForUser } from "@/lib/venues/repair-canonical-locations";
import type { VenueHeatmapSpot } from "@/lib/map/venue-heatmap-types";
import { createClient } from "@/lib/supabase/server";

/** Valore mostrato: `null` = dato non disponibile o non ancora raccolto nel DB. */
export type StatScalar = string | number | null;

export type NamedCount = { name: string; count: number };

/** @deprecated use VenueHeatmapSpot */
export type VenueHeatPoint = VenueHeatmapSpot;

/** Per ogni headliner: artista in line-up (≠ headliner) più spesso sullo stesso gig. */
export type HeadlinerLineupBuddy = {
  headliner: string;
  support: string;
  sharedGigs: number;
};

/** Classifica artisti: serate distinte per ruolo (headliner, line-up, ospite in scaletta). */
export type RankedArtistPresence = {
  name: string;
  totalShows: number;
  asHeadliner: number;
  asLineupNotHeadliner: number;
  asGuestOnSongs: number;
};

export type DashboardStatistics = {
  generatedAtIso: string;
  overview: {
    concertsAttended: StatScalar;
    uniqueHeadlineArtists: StatScalar;
    uniqueVenues: StatScalar;
    uniqueVenueCities: StatScalar;
    uniqueVenueCountries: StatScalar;
    festivalsAttended: StatScalar;
    cancelledGigsInHistory: StatScalar;
    firstConcertDate: StatScalar;
    lastConcertDate: StatScalar;
    yearsSpanned: StatScalar;
    concertsPerYearJson: StatScalar;
  };
  artistsAndVenues: {
    topArtistsSeen: RankedArtistPresence[] | null;
    topVenues: NamedCount[] | null;
    topVenueCities: NamedCount[] | null;
    topVenueCountries: NamedCount[] | null;
  };
  personalAttendance: {
    standingShows: StatScalar;
    seatedShows: StatScalar;
    topSectors: NamedCount[] | null;
    distinctDepartureCityPairs: StatScalar;
    savedHomeLocations: StatScalar;
  };
  moneyAndTravel: {
    totalTicketSpendEur: StatScalar;
    avgTicketPriceEur: StatScalar;
    concertsWithTicketPrice: StatScalar;
    nonEurTicketRows: StatScalar;
    totalTravelKmReported: StatScalar;
    avgTravelKmWhenPresent: StatScalar;
    maxSingleTravelKm: StatScalar;
    minSingleTravelKm: StatScalar;
    avgDaysBoughtInAdvance: StatScalar;
  };
  setlistsAndSongs: {
    showsWithSetlist: StatScalar;
    totalSongRowsAcrossShows: StatScalar;
    uniqueSongTitlesHeard: StatScalar;
    encoreSongRows: StatScalar;
    coverSongRows: StatScalar;
    tapeSongRows: StatScalar;
    songsWithGuestCredit: StatScalar;
    avgSongsPerShowWhenSetlistPresent: StatScalar;
    topToursByShowCount: NamedCount[] | null;
    avgReportedDurationMinutes: StatScalar;
    /** Righe scaletta (no tape) con `album_title` valorizzato. */
    songRowsWithAlbumTitle: StatScalar;
    /** Distribuzione album sui brani (esclusi tape), da colonna opzionale. */
    topAlbumsBySongRow: NamedCount[] | null;
  };
  /** Mappa calore venue + coppie headliner↔support ricorrenti sul palco. */
  mapsAndLineup: {
    venueHeatPoints: VenueHeatPoint[];
    venuesWithCoordinates: number;
    venuesMissingCoordinates: number;
    headlinerLineupBuddies: HeadlinerLineupBuddy[] | null;
  };
  lineupAndTags: {
    lineupSlotRowsAcrossShows: StatScalar;
    distinctNonHeadlineLineupArtists: StatScalar;
    topLineupArtistNames: NamedCount[] | null;
    songTagRowsLinked: StatScalar;
    distinctSongTagLabels: StatScalar;
  };
  setlistfmAndProfile: {
    gigsLinkedToSetlistfm: StatScalar;
    setlistfmUserIdOnProfile: StatScalar;
  };
  /** Campi che vorrai salvare a mano / migration — oggi quasi sempre null. */
  plannedInputs: {
    transportModeSplitJson: StatScalar;
  };
  /** Idee dal brainstorm: tutto ciò che si può già derivare dai dati attuali. */
  nicheBrainstorm: {
    avgConcertsPerYearWithAtLeastOneShow: StatScalar;
    mostActiveMonthLabel: StatScalar;
    mostActiveYear: StatScalar;
    longestGapDaysBetweenShowDates: StatScalar;
    shortestGapDaysBetweenShowDates: StatScalar;
    avgDaysBetweenShowDates: StatScalar;
    maxConsecutiveCalendarDaysWithShow: StatScalar;
    daysWithMultipleShows: StatScalar;
    festivalSharePct: StatScalar;
    weekendShowSharePct: StatScalar;
    costPerLiveMinuteEur: StatScalar;
    coverShareOfSongRowsPct: StatScalar;
    encoreShareOfSongRowsPct: StatScalar;
    tapeShareOfSongRowsPct: StatScalar;
    songsHeardInExactlyOneGigTitleCount: StatScalar;
    songsHeardInThreePlusGigsTitleCount: StatScalar;
    artistWithMostDifferentCitiesLabel: StatScalar;
    artistWithMostDifferentVenuesLabel: StatScalar;
    topSupportActsNotHeadliner: NamedCount[] | null;
    supportActsAlsoSeenAsYourHeadlinerCount: StatScalar;
    longestGapDaysSameHeadliner: StatScalar;
    songsRepeatAcrossDifferentGigs: StatScalar;
    longestStreakSameHeadlinerShows: StatScalar;
    daysSinceLastConcert: StatScalar;
    topGenrePerYearJson: StatScalar;
    mostActiveSeasonLabel: StatScalar;
    mostActiveWeekdayLabel: StatScalar;
    nonFestivalShowSharePct: StatScalar;
    venuesVisitedAtLeastTwiceCount: StatScalar;
    topSingleVenueAttendanceSharePct: StatScalar;
    avgTicketPriceEurPerYearJson: StatScalar;
    totalReportedLiveMinutesSum: StatScalar;
    minReportedShowMinutes: StatScalar;
    maxReportedShowMinutes: StatScalar;
    bestEuroPerMinuteShowLabel: StatScalar;
    priciestTicketShowLabel: StatScalar;
    headlinerLifetimeTravelKmLeaderLabel: StatScalar;
    mostHeardLiveSongLabel: StatScalar;
    topLiveOpenersNotTape: NamedCount[] | null;
    topLiveClosersNotTape: NamedCount[] | null;
  };
};

function sortNamedCounts(map: Map<string, number>, top = 12): NamedCount[] {
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "it"))
    .slice(0, top);
}

function yearFromIsoDate(d: string): number | null {
  const t = d?.trim();
  if (!t) return null;
  const y = Number.parseInt(t.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

function namedCountsFromLowerTitleMap(
  map: Map<string, { display: string; n: number }>,
  top = 12,
): NamedCount[] {
  return Array.from(map.values())
    .map(({ display, n }) => ({ name: display, count: n }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "it"))
    .slice(0, top);
}

function bumpLowerTitleCount(
  map: Map<string, { display: string; n: number }>,
  raw: string,
) {
  const t = raw.trim();
  if (!t) return;
  const low = t.toLowerCase();
  const ex = map.get(low);
  if (ex) ex.n += 1;
  else map.set(low, { display: t, n: 1 });
}

function seasonIndexFromMonth(m: number): number {
  if (m === 12 || m <= 2) return 0;
  if (m <= 5) return 1;
  if (m <= 8) return 2;
  return 3;
}

export async function getDashboardStatistics(): Promise<DashboardStatistics | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  await repairCombinedBillingGigsForUser(supabase, user.id);
  await repairCanonicalVenueLocationsForUser(supabase, user.id);

  const { data: attRows, error: attErr } = await supabase
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
        id,
        gig_date,
        tour_name,
        is_festival,
        was_cancelled,
        concert_duration_minutes,
        setlistfm_setlist_id,
        artist_id,
        venue_id,
        source
      )
    `,
    )
    .eq("user_id", user.id);

  if (attErr || !attRows?.length) {
    return emptyStats();
  }

  const rows = attRows as Array<{
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
    gigs:
      | {
          id: string;
          gig_date: string;
          tour_name: string | null;
          is_festival: boolean;
          was_cancelled: boolean;
          concert_duration_minutes: number | null;
          setlistfm_setlist_id: string | null;
          artist_id: string;
          venue_id: string;
        }
      | Array<{
          id: string;
          gig_date: string;
          tour_name: string | null;
          is_festival: boolean;
          was_cancelled: boolean;
          concert_duration_minutes: number | null;
          setlistfm_setlist_id: string | null;
          artist_id: string;
          venue_id: string;
        }>
      | null;
  }>;

  const flat = rows.map((r) => {
    const g = Array.isArray(r.gigs) ? r.gigs[0] : r.gigs;
    return { ...r, gig: g };
  });

  const valid = flat.filter((r) => r.gig);
  if (valid.length === 0) return emptyStats();

  const gigIds = Array.from(new Set(valid.map((r) => r.gig_id)));
  const artistIds = Array.from(new Set(valid.map((r) => r.gig!.artist_id)));
  const venueIds = Array.from(new Set(valid.map((r) => r.gig!.venue_id)));

  const [{ data: artists }, { data: venues }, { data: profile }] =
    await Promise.all([
      supabase.from("artists").select("id,name,genre_primary").in("id", artistIds),
      supabase.from("venues").select("id,name,city,country_code,lat,lng").in("id", venueIds),
      supabase.from("profiles").select("setlistfm_user_id").eq("id", user.id).maybeSingle(),
    ]);

  const artistName = new Map<string, string>();
  const artistGenre = new Map<string, string>();
  for (const a of artists ?? []) {
    const id = a.id as string;
    artistName.set(
      id,
      String((a as { name?: string }).name ?? "").trim() || "Artista",
    );
    artistGenre.set(
      id,
      String((a as { genre_primary?: string }).genre_primary ?? "").trim() ||
        "—",
    );
  }

  const venueById = new Map<
    string,
    {
      name: string;
      city: string;
      country: string;
      lat: number | null;
      lng: number | null;
    }
  >();
  for (const v of venues ?? []) {
    const id = (v as { id: string }).id;
    const name = String((v as { name?: string }).name ?? "").trim();
    const city = String((v as { city?: string }).city ?? "").trim();
    const countryRaw = String(
      (v as { country_code?: string }).country_code ?? "",
    ).trim();
    const latRaw = (v as { lat?: number | null }).lat;
    const lngRaw = (v as { lng?: number | null }).lng;
    const lat =
      latRaw != null && Number.isFinite(Number(latRaw)) ? Number(latRaw) : null;
    const lng =
      lngRaw != null && Number.isFinite(Number(lngRaw)) ? Number(lngRaw) : null;
    venueById.set(id, { name, city, country: countryRaw, lat, lng });
  }

  const venueLabelCounts = new Map<string, number>();
  const cityCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();
  const tourCounts = new Map<string, number>();
  const sectorCounts = new Map<string, number>();
  const yearsCounts = new Map<number, number>();
  const dates: string[] = [];
  const monthCounts = new Map<number, number>();
  const artistCitySets = new Map<string, Set<string>>();
  const artistVenueSets = new Map<string, Set<string>>();

  let festivals = 0;
  let cancelled = 0;
  let standing = 0;
  let seated = 0;
  let setlistfmLinked = 0;
  let weekendShows = 0;
  let costEurNumForMinute = 0;
  let costDurationMinutesDen = 0;
  const durationSamples: number[] = [];
  const departurePairs = new Set<string>();

  let eurCentsSum = 0;
  let eurPriceRows = 0;
  let nonEurRows = 0;
  const travelSamples: number[] = [];
  const advanceSamples: number[] = [];
  const dowCounts = [0, 0, 0, 0, 0, 0, 0];
  const seasonCounts = [0, 0, 0, 0];
  const IT_DOW = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
  const IT_SEASON = ["Inverno", "Primavera", "Estate", "Autunno"];
  const eurTicketByYear = new Map<number, { cents: number; n: number }>();
  const travelKmByHeadliner = new Map<string, number>();
  let bestValueRatio = Infinity;
  let bestValueShowLabel: string | null = null;
  let priciestTicketCents = -1;
  let priciestTicketShowLabel: string | null = null;
  let totalReportedLiveMinutesSum = 0;
  for (const r of valid) {
    const g = r.gig!;
    dates.push(g.gig_date);
    const y = yearFromIsoDate(g.gig_date);
    if (y != null) yearsCounts.set(y, (yearsCounts.get(y) ?? 0) + 1);

    const md = g.gig_date.trim().split("-");
    if (md.length >= 2) {
      const m1 = Number.parseInt(md[1]!, 10);
      if (m1 >= 1 && m1 <= 12) {
        monthCounts.set(m1 - 1, (monthCounts.get(m1 - 1) ?? 0) + 1);
        const si = seasonIndexFromMonth(m1);
        seasonCounts[si] = seasonCounts[si] + 1;
      }
    }
    const dow = new Date(`${g.gig_date.trim()}T12:00:00Z`).getUTCDay();
    dowCounts[dow] = dowCounts[dow] + 1;
    if (dow === 0 || dow === 6) weekendShows += 1;

    if (g.is_festival) festivals += 1;
    if (g.was_cancelled) cancelled += 1;
    if (g.setlistfm_setlist_id?.trim()) setlistfmLinked += 1;
    if (g.concert_duration_minutes != null && Number.isFinite(g.concert_duration_minutes)) {
      const dm = Math.round(Number(g.concert_duration_minutes));
      durationSamples.push(dm);
      totalReportedLiveMinutesSum += dm;
    }

    const vn = venueById.get(g.venue_id);
    const vLabel = vn
      ? [vn.name, vn.city].filter(Boolean).join(", ") || vn.name || "Venue"
      : "Venue";
    venueLabelCounts.set(vLabel, (venueLabelCounts.get(vLabel) ?? 0) + 1);
    if (vn?.city) {
      const statCity = canonicalCityName(vn.city, vn.country ?? "");
      cityCounts.set(statCity, (cityCounts.get(statCity) ?? 0) + 1);
    }
    if (vn?.country) {
      countryCounts.set(vn.country, (countryCounts.get(vn.country) ?? 0) + 1);
    }

    const aid = g.artist_id;
    if (!artistCitySets.has(aid)) artistCitySets.set(aid, new Set());
    if (!artistVenueSets.has(aid)) artistVenueSets.set(aid, new Set());
    const cityKey = canonicalCityName(vn?.city ?? "", vn?.country ?? "")
      .trim()
      .toLowerCase();
    if (cityKey) artistCitySets.get(aid)!.add(cityKey);
    artistVenueSets.get(aid)!.add(g.venue_id);

    const tour = (g.tour_name ?? "").trim();
    if (tour) tourCounts.set(tour, (tourCounts.get(tour) ?? 0) + 1);

    if (r.is_standing) standing += 1;
    else seated += 1;

    const sec = (r.sector ?? "").trim();
    if (sec) sectorCounts.set(sec, (sectorCounts.get(sec) ?? 0) + 1);

    const cur = (r.ticket_currency ?? "EUR").trim().toUpperCase();
    if (
      r.ticket_price_cents != null &&
      Number.isFinite(r.ticket_price_cents) &&
      r.ticket_price_cents > 0
    ) {
      if (cur === "EUR") {
        eurCentsSum += r.ticket_price_cents;
        eurPriceRows += 1;
        if (y != null) {
          const bag = eurTicketByYear.get(y) ?? { cents: 0, n: 0 };
          bag.cents += r.ticket_price_cents;
          bag.n += 1;
          eurTicketByYear.set(y, bag);
        }
        if (r.ticket_price_cents > priciestTicketCents) {
          priciestTicketCents = r.ticket_price_cents;
          const euros = Math.round(r.ticket_price_cents) / 100;
          priciestTicketShowLabel = `${artistName.get(g.artist_id) ?? "Artista"} · ${g.gig_date} (${euros} €)`;
        }
      } else {
        nonEurRows += 1;
      }
    }

    const durMin =
      g.concert_duration_minutes != null &&
      Number.isFinite(g.concert_duration_minutes)
        ? Math.round(Number(g.concert_duration_minutes))
        : null;
    if (
      cur === "EUR" &&
      durMin != null &&
      durMin > 0 &&
      r.ticket_price_cents != null &&
      Number.isFinite(r.ticket_price_cents)
    ) {
      costEurNumForMinute += r.ticket_price_cents / 100;
      costDurationMinutesDen += durMin;
      const euros = r.ticket_price_cents / 100;
      const ratio = euros / durMin;
      if (ratio < bestValueRatio) {
        bestValueRatio = ratio;
        bestValueShowLabel = `${artistName.get(g.artist_id) ?? "Artista"} · ${g.gig_date} (${Math.round(ratio * 100) / 100} €/min)`;
      }
    }

    if (r.travel_km != null && Number.isFinite(Number(r.travel_km))) {
      const km = Math.round(Number(r.travel_km));
      travelSamples.push(km);
      travelKmByHeadliner.set(
        g.artist_id,
        (travelKmByHeadliner.get(g.artist_id) ?? 0) + km,
      );
    }
    if (r.days_bought_in_advance != null && Number.isFinite(r.days_bought_in_advance)) {
      advanceSamples.push(Math.round(Number(r.days_bought_in_advance)));
    }

    const dc = (r.departure_city ?? "").trim();
    const dco = (r.departure_country ?? "").trim();
    if (dc && dco) departurePairs.add(`${dc}\n${dco}`);
  }

  let bestSe = 0;
  let bestSeN = -1;
  for (let i = 0; i < 4; i++) {
    if (seasonCounts[i] > bestSeN) {
      bestSeN = seasonCounts[i];
      bestSe = i;
    }
  }
  const mostActiveSeasonLabel =
    bestSeN > 0 ? `${IT_SEASON[bestSe]} (${bestSeN})` : null;

  let bestDw = 0;
  let bestDwN = -1;
  for (let i = 0; i < 7; i++) {
    if (dowCounts[i] > bestDwN) {
      bestDwN = dowCounts[i];
      bestDw = i;
    }
  }
  const mostActiveWeekdayLabel =
    bestDwN > 0 ? `${IT_DOW[bestDw]} (${bestDwN})` : null;

  const nonFestivalShowSharePct =
    valid.length > 0
      ? Math.round((100 * (valid.length - festivals)) / valid.length)
      : null;

  let venuesVisitedAtLeastTwiceCount = 0;
  for (const c of Array.from(venueLabelCounts.values())) {
    if (c >= 2) venuesVisitedAtLeastTwiceCount += 1;
  }

  let maxVenueVisits = 0;
  for (const c of Array.from(venueLabelCounts.values())) {
    maxVenueVisits = Math.max(maxVenueVisits, c);
  }
  const topSingleVenueAttendanceSharePct =
    valid.length > 0
      ? Math.round((100 * maxVenueVisits) / valid.length)
      : null;

  const avgEurYear: Record<string, number> = {};
  for (const [yr, b] of Array.from(eurTicketByYear.entries())) {
    if (b.n > 0) {
      avgEurYear[String(yr)] = Math.round((b.cents / b.n / 100) * 10) / 10;
    }
  }
  const avgTicketPriceEurPerYearJson =
    Object.keys(avgEurYear).length > 0 ? JSON.stringify(avgEurYear) : null;

  const minReportedShowMinutes =
    durationSamples.length > 0 ? Math.min(...durationSamples) : null;
  const maxReportedShowMinutes =
    durationSamples.length > 0 ? Math.max(...durationSamples) : null;

  const bestEuroPerMinuteShowLabel: StatScalar =
    bestValueRatio === Infinity ? null : bestValueShowLabel;
  const priciestTicketShowLabelResolved: StatScalar =
    priciestTicketCents < 0 ? null : priciestTicketShowLabel;

  let leaderAid = "";
  let leaderKm = 0;
  for (const [haid, km] of Array.from(travelKmByHeadliner.entries())) {
    if (km > leaderKm) {
      leaderKm = km;
      leaderAid = haid;
    }
  }
  const headlinerLifetimeTravelKmLeaderLabel: StatScalar =
    leaderKm > 0
      ? `${artistName.get(leaderAid) ?? "Artista"} (~${Math.round(leaderKm)} km)`
      : null;

  const totalReportedLiveMinutesScalar: StatScalar =
    totalReportedLiveMinutesSum > 0 ? totalReportedLiveMinutesSum : null;

  dates.sort();
  const first = dates[0] ?? null;
  const last = dates[dates.length - 1] ?? null;
  const y0 = first ? yearFromIsoDate(first) : null;
  const y1 = last ? yearFromIsoDate(last) : null;
  const yearsSpanned =
    y0 != null && y1 != null ? Math.max(1, y1 - y0 + 1) : valid.length > 0 ? 1 : null;

  const perYearObj = Object.fromEntries(
    Array.from(yearsCounts.entries()).sort((a, b) => a[0] - b[0]),
  );

  const selWithTape =
    "id, gig_id, position, title, is_encore, is_cover, is_tape, featuring_names, guest_artist_id, album_title";
  const selNoTape =
    "id, gig_id, position, title, is_encore, is_cover, featuring_names, guest_artist_id, album_title";

  type GigSongAgg = {
    id: string;
    gig_id: string;
    position: number;
    title: string;
    is_encore: boolean | null;
    is_cover: boolean | null;
    is_tape?: boolean | null;
    featuring_names: string | null;
    guest_artist_id: string | null;
    album_title?: string | null;
  };

  let songRows: GigSongAgg[] = [];
  const rFull = await supabase.from("gig_songs").select(selWithTape).in("gig_id", gigIds);
  if (!rFull.error && rFull.data) {
    songRows = rFull.data as GigSongAgg[];
  } else if (rFull.error && /album_title/i.test(rFull.error.message ?? "")) {
    const selWtNoAlbum =
      "id, gig_id, position, title, is_encore, is_cover, is_tape, featuring_names, guest_artist_id";
    const selNtNoAlbum =
      "id, gig_id, position, title, is_encore, is_cover, featuring_names, guest_artist_id";
    const rWt = await supabase.from("gig_songs").select(selWtNoAlbum).in("gig_id", gigIds);
    if (!rWt.error && rWt.data) {
      songRows = rWt.data as GigSongAgg[];
    } else if (rWt.error && /is_tape/i.test(rWt.error.message ?? "")) {
      const rNt = await supabase
        .from("gig_songs")
        .select(selNtNoAlbum)
        .in("gig_id", gigIds);
      if (!rNt.error && rNt.data) songRows = rNt.data as GigSongAgg[];
    }
  } else if (rFull.error && /is_tape/i.test(rFull.error.message ?? "")) {
    const rNt = await supabase.from("gig_songs").select(selNoTape).in("gig_id", gigIds);
    if (!rNt.error && rNt.data) songRows = rNt.data as GigSongAgg[];
  }

  const songIds = songRows.map((s) => s.id).filter(Boolean);
  const songIdToGigId = new Map<string, string>();
  for (const s of songRows) {
    if (s.id) songIdToGigId.set(s.id, s.gig_id);
  }
  let featLinkRows: { gig_song_id: string; artist_id: string }[] = [];
  if (songIds.length > 0) {
    const { data: fr, error: featErr } = await supabase
      .from("gig_song_featuring_artists")
      .select("gig_song_id, artist_id")
      .in("gig_song_id", songIds);
    if (!featErr && fr) {
      featLinkRows = fr as { gig_song_id: string; artist_id: string }[];
    }
  }

  const uniqueTitles = new Set<string>();
  let encores = 0;
  let covers = 0;
  let tapes = 0;
  let withGuest = 0;
  const titleDisplayByKey = new Map<string, string>();
  const titleToGigSet = new Map<string, Set<string>>();
  const albumTitleCounts = new Map<string, { display: string; n: number }>();
  let songRowsWithAlbumTitleCount = 0;
  for (const s of songRows) {
    const t = String(s.title ?? "").trim();
    if (t) {
      const tl = t.toLowerCase();
      if (!titleDisplayByKey.has(tl)) titleDisplayByKey.set(tl, t);
      uniqueTitles.add(tl);
      const gid = s.gig_id;
      if (gid) {
        if (!titleToGigSet.has(tl)) titleToGigSet.set(tl, new Set());
        titleToGigSet.get(tl)!.add(gid);
      }
    }
    if (s.is_encore) encores += 1;
    if (s.is_cover) covers += 1;
    if (s.is_tape === true) tapes += 1;
    if ((s.featuring_names ?? "").trim()) withGuest += 1;
    const al = String(s.album_title ?? "").trim();
    if (al && s.is_tape !== true) {
      songRowsWithAlbumTitleCount += 1;
      bumpLowerTitleCount(albumTitleCounts, al);
    }
  }

  let mostHeardLiveSongLabel: string | null = null;
  let bestHeardN = 0;
  let bestHeardKey = "";
  for (const [tl, gset] of Array.from(titleToGigSet.entries())) {
    if (gset.size > bestHeardN) {
      bestHeardN = gset.size;
      bestHeardKey = tl;
    }
  }
  if (bestHeardN > 0) {
    const disp = titleDisplayByKey.get(bestHeardKey) ?? bestHeardKey;
    mostHeardLiveSongLabel = `${disp} (${bestHeardN} show)`;
  }

  const songsByGig = new Map<string, GigSongAgg[]>();
  for (const s of songRows) {
    if (!songsByGig.has(s.gig_id)) songsByGig.set(s.gig_id, []);
    songsByGig.get(s.gig_id)!.push(s);
  }
  const openerTitleCounts = new Map<string, { display: string; n: number }>();
  const closerTitleCounts = new Map<string, { display: string; n: number }>();
  for (const arr of Array.from(songsByGig.values())) {
    const sorted = arr.slice().sort((a, b) => a.position - b.position);
    const live = sorted.filter((x) => x.is_tape !== true);
    if (live.length === 0) continue;
    const op = String(live[0]!.title ?? "").trim();
    const cl = String(live[live.length - 1]!.title ?? "").trim();
    bumpLowerTitleCount(openerTitleCounts, op);
    bumpLowerTitleCount(closerTitleCounts, cl);
  }
  const topLiveOpenersNotTape =
    openerTitleCounts.size > 0 ? namedCountsFromLowerTitleMap(openerTitleCounts, 10) : null;
  const topLiveClosersNotTape =
    closerTitleCounts.size > 0 ? namedCountsFromLowerTitleMap(closerTitleCounts, 10) : null;

  const repeatSongsAcrossShows = Array.from(titleToGigSet.values()).filter(
    (set) => set.size > 1,
  ).length;

  const byDate = valid.slice().sort((a, b) =>
    a.gig!.gig_date.localeCompare(b.gig!.gig_date),
  );
  let bestStreak = 0;
  let curStreak = 0;
  let lastArtistId: string | null = null;
  for (const r of byDate) {
    const aid = r.gig!.artist_id;
    if (aid === lastArtistId) curStreak += 1;
    else {
      curStreak = 1;
      lastArtistId = aid;
    }
    bestStreak = Math.max(bestStreak, curStreak);
  }
  const longestStreakSameArtist = valid.length > 0 ? bestStreak : null;

  const showsWithSetlist = gigIds.filter((gid) =>
    songRows.some((s) => s.gig_id === gid),
  ).length;

  const { data: lineupRows } = await supabase
    .from("gig_lineup_artists")
    .select("gig_id, artist_id, is_co_headliner")
    .in("gig_id", gigIds);

  const gigToHeadliner = new Map<string, string>();
  const attendedGigIds = new Set<string>();
  for (const r of valid) {
    gigToHeadliner.set(r.gig_id, r.gig!.artist_id);
    attendedGigIds.add(r.gig_id);
  }

  const lineupByGigId = new Map<string, LineupRowInput[]>();
  for (const lr of lineupRows ?? []) {
    const gid = lr.gig_id as string;
    const aid = lr.artist_id as string;
    if (!attendedGigIds.has(gid)) continue;
    if (!lineupByGigId.has(gid)) lineupByGigId.set(gid, []);
    lineupByGigId.get(gid)!.push({
      artist_id: aid,
      is_co_headliner: Boolean((lr as { is_co_headliner?: boolean }).is_co_headliner),
    });
  }

  const gigSourceByGig = new Map<string, string | null>();
  for (const r of valid) {
    const g = r.gig!;
    gigSourceByGig.set(r.gig_id, (g as { source?: string | null }).source ?? null);
  }

  const guestByGig = new Map<string, Set<string>>();
  for (const fl of featLinkRows) {
    const gid = songIdToGigId.get(fl.gig_song_id);
    if (!gid || !attendedGigIds.has(gid)) continue;
    if (!guestByGig.has(gid)) guestByGig.set(gid, new Set());
    guestByGig.get(gid)!.add(fl.artist_id);
  }
  for (const s of songRows) {
    const gid = s.gig_id;
    const guestId = s.guest_artist_id;
    if (!guestId || !attendedGigIds.has(gid)) continue;
    if (!guestByGig.has(gid)) guestByGig.set(gid, new Set());
    guestByGig.get(gid)!.add(guestId);
  }

  const presenceArtistIds = new Set<string>();
  for (const r of valid) presenceArtistIds.add(r.gig!.artist_id);
  for (const lr of lineupRows ?? []) {
    if (attendedGigIds.has(lr.gig_id as string)) {
      presenceArtistIds.add(lr.artist_id as string);
    }
  }
  for (const fl of featLinkRows) {
    const gid = songIdToGigId.get(fl.gig_song_id);
    if (gid && attendedGigIds.has(gid)) {
      presenceArtistIds.add(fl.artist_id);
    }
  }

  const missingForPresence = Array.from(presenceArtistIds).filter(
    (id) => !artistName.has(id),
  );
  if (missingForPresence.length > 0) {
    const { data: moreArtists } = await supabase
      .from("artists")
      .select("id,name,genre_primary")
      .in("id", missingForPresence);
    for (const a of moreArtists ?? []) {
      const id = a.id as string;
      artistName.set(
        id,
        String((a as { name?: string }).name ?? "").trim() || "Artista",
      );
      artistGenre.set(
        id,
        String((a as { genre_primary?: string }).genre_primary ?? "").trim() ||
          "—",
      );
    }
  }

  const billingRolesByGig = new Map<string, ReturnType<typeof resolveGigBillingRoles>>();
  for (const r of valid) {
    const gid = r.gig_id;
    if (billingRolesByGig.has(gid)) continue;
    const g = r.gig!;
    billingRolesByGig.set(
      gid,
      resolveGigBillingRoles(
        g.artist_id,
        artistName.get(g.artist_id) ?? "",
        lineupByGigId.get(gid) ?? [],
        artistName,
        gigSourceByGig.get(gid) ?? null,
      ),
    );
  }

  const gigArtistIdByGig = new Map<string, string>();
  for (const r of valid) {
    gigArtistIdByGig.set(r.gig_id, r.gig!.artist_id);
  }

  const headlinerIdsForGig = (gid: string): Set<string> => {
    const roles = billingRolesByGig.get(gid);
    if (!roles) return new Set();
    const ids = new Set([roles.primaryArtistId, ...roles.coHeadlinerArtistIds]);
    const gigArtistId = gigArtistIdByGig.get(gid);
    if (
      gigArtistId &&
      !isCombinedBillingArtistName(artistName.get(gigArtistId) ?? "")
    ) {
      ids.add(gigArtistId);
    }
    return ids;
  };

  const nonHeadlineLineup = new Set<string>();
  const lineupNameCounts = new Map<string, number>();
  for (const r of valid) {
    const roles = billingRolesByGig.get(r.gig_id);
    if (!roles) continue;
    for (const aid of roles.supportLineupArtistIds) {
      nonHeadlineLineup.add(aid);
      const label = artistName.get(aid) ?? "Artista";
      lineupNameCounts.set(label, (lineupNameCounts.get(label) ?? 0) + 1);
    }
  }

  const supportCountByHeadliner = new Map<string, Map<string, number>>();
  for (const r of valid) {
    const gid = r.gig_id;
    const roles = billingRolesByGig.get(gid);
    if (!roles) continue;
    const h = roles.primaryArtistId;
    for (const sid of roles.supportLineupArtistIds) {
      if (!supportCountByHeadliner.has(h)) {
        supportCountByHeadliner.set(h, new Map());
      }
      const m = supportCountByHeadliner.get(h)!;
      m.set(sid, (m.get(sid) ?? 0) + 1);
    }
  }
  const headlinerLineupBuddiesRows: HeadlinerLineupBuddy[] = [];
  for (const [hid, sm] of Array.from(supportCountByHeadliner.entries())) {
    let bestSid = "";
    let bestN = 0;
    for (const [sid, n] of Array.from(sm.entries())) {
      if (n > bestN) {
        bestN = n;
        bestSid = sid;
      }
    }
    if (bestN > 0 && bestSid) {
      headlinerLineupBuddiesRows.push({
        headliner: artistName.get(hid) ?? "Artista",
        support: artistName.get(bestSid) ?? "Artista",
        sharedGigs: bestN,
      });
    }
  }
  headlinerLineupBuddiesRows.sort(
    (a, b) =>
      b.sharedGigs - a.sharedGigs ||
      a.headliner.localeCompare(b.headliner, "it"),
  );
  const headlinerLineupBuddies =
    headlinerLineupBuddiesRows.length > 0 ? headlinerLineupBuddiesRows : null;

  const topAlbumsBySongRow =
    albumTitleCounts.size > 0
      ? namedCountsFromLowerTitleMap(albumTitleCounts, 18)
      : null;

  const presenceRows: RankedArtistPresence[] = [];
  for (const aid of Array.from(presenceArtistIds)) {
    if (isCombinedBillingArtistName(artistName.get(aid) ?? "")) continue;
    let asHeadliner = 0;
    let asLineupNotHeadliner = 0;
    let asGuestOnSongs = 0;
    for (const gigId of Array.from(attendedGigIds)) {
      if (headlinerIdsForGig(gigId).has(aid)) asHeadliner += 1;
      else if (
        billingRolesByGig
          .get(gigId)
          ?.supportLineupArtistIds.includes(aid)
      ) {
        asLineupNotHeadliner += 1;
      } else if (guestByGig.get(gigId)?.has(aid)) asGuestOnSongs += 1;
    }
    const totalShows = asHeadliner + asLineupNotHeadliner + asGuestOnSongs;
    if (totalShows <= 0) continue;
    presenceRows.push({
      name: artistName.get(aid) ?? "Artista",
      totalShows,
      asHeadliner,
      asLineupNotHeadliner,
      asGuestOnSongs,
    });
  }
  presenceRows.sort(
    (a, b) =>
      b.totalShows - a.totalShows || a.name.localeCompare(b.name, "it"),
  );
  const topArtistsSeen =
    presenceRows.length > 0 ? presenceRows.slice(0, 24) : null;

  let tagRowCount: number | null = null;
  if (songIds.length > 0) {
    const { count } = await supabase
      .from("gig_song_tags")
      .select("gig_song_id", { count: "exact", head: true })
      .in("gig_song_id", songIds);
    tagRowCount = count ?? 0;
  }

  let distinctTags: number | null = null;
  if (songIds.length > 0) {
    const { data: tagDistinct } = await supabase
      .from("gig_song_tags")
      .select("song_tags(label)")
      .in("gig_song_id", songIds.slice(0, 500));
    const labels = new Set<string>();
    for (const tr of tagDistinct ?? []) {
      const st = tr.song_tags as { label?: string } | { label?: string }[] | null;
      const one = Array.isArray(st) ? st[0] : st;
      const lab = one?.label?.trim();
      if (lab) labels.add(lab.toLowerCase());
    }
    distinctTags = labels.size;
  }

  const { count: homeCount } = await supabase
    .from("home_locations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const avgDur =
    durationSamples.length > 0
      ? Math.round(
          durationSamples.reduce((a, b) => a + b, 0) / durationSamples.length,
        )
      : null;

  const avgSongsPerShow =
    showsWithSetlist > 0 ? Math.round(songRows.length / showsWithSetlist) : null;

  const slUser = (profile as { setlistfm_user_id?: string | null } | null)
    ?.setlistfm_user_id;

  const IT_MONTHS = [
    "Gen",
    "Feb",
    "Mar",
    "Apr",
    "Mag",
    "Giu",
    "Lug",
    "Ago",
    "Set",
    "Ott",
    "Nov",
    "Dic",
  ];

  const activeYears = yearsCounts.size;
  const avgConcertsPerActiveYear =
    activeYears > 0 ? Math.round((valid.length / activeYears) * 10) / 10 : null;

  let mostMo: number | null = null;
  let mostMoN = 0;
  for (const [mo, n] of Array.from(monthCounts.entries())) {
    if (n > mostMoN) {
      mostMoN = n;
      mostMo = mo;
    }
  }
  const mostActiveMonthLabel =
    mostMo != null && mostMoN > 0
      ? `${IT_MONTHS[mostMo]} (${mostMoN})`
      : null;

  let bestY: number | null = null;
  let bestYn = 0;
  for (const [yr, n] of Array.from(yearsCounts.entries())) {
    if (n > bestYn) {
      bestYn = n;
      bestY = yr;
    }
  }
  const mostActiveYear = bestY != null && bestYn > 0 ? bestY : null;

  const uniqueSortedDates = Array.from(
    new Set(valid.map((r) => r.gig!.gig_date.trim())),
  ).sort();
  let longestGapDays = 0;
  let shortestGapDays: number | null = null;
  let gapSum = 0;
  let gapN = 0;
  for (let i = 1; i < uniqueSortedDates.length; i++) {
    const a = uniqueSortedDates[i - 1]!;
    const b = uniqueSortedDates[i]!;
    const diff = Math.round(
      (Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) /
        86_400_000,
    );
    longestGapDays = Math.max(longestGapDays, diff);
    if (diff > 0) {
      shortestGapDays =
        shortestGapDays == null ? diff : Math.min(shortestGapDays, diff);
      gapSum += diff;
      gapN += 1;
    }
  }
  const avgDaysBetweenShowDates =
    gapN > 0 ? Math.round((gapSum / gapN) * 10) / 10 : null;

  const dayIndices = Array.from(
    new Set(
      valid.map((r) =>
        Math.floor(Date.parse(`${r.gig!.gig_date.trim()}T12:00:00Z`) / 86_400_000),
      ),
    ),
  ).sort((x, y) => x - y);
  let runDays = 1;
  let bestRunDays = 1;
  for (let i = 1; i < dayIndices.length; i++) {
    if (dayIndices[i] === dayIndices[i - 1]! + 1) runDays += 1;
    else runDays = 1;
    bestRunDays = Math.max(bestRunDays, runDays);
  }
  const maxConsecutiveCalendarDaysWithShow =
    dayIndices.length > 0 ? bestRunDays : null;

  const showsPerCalendarDay = new Map<string, number>();
  for (const r of valid) {
    const d = r.gig!.gig_date.trim();
    showsPerCalendarDay.set(d, (showsPerCalendarDay.get(d) ?? 0) + 1);
  }
  const daysWithMultipleShows = Array.from(showsPerCalendarDay.values()).filter(
    (c) => c > 1,
  ).length;

  const festivalSharePct =
    valid.length > 0 ? Math.round((100 * festivals) / valid.length) : null;
  const weekendShowSharePct =
    valid.length > 0 ? Math.round((100 * weekendShows) / valid.length) : null;

  const costPerLiveMinuteEur =
    costDurationMinutesDen > 0
      ? Math.round((100 * costEurNumForMinute) / costDurationMinutesDen) / 100
      : null;

  const nSongs = songRows.length;
  const coverShareOfSongRowsPct =
    nSongs > 0 ? Math.round((100 * covers) / nSongs) : null;
  const encoreShareOfSongRowsPct =
    nSongs > 0 ? Math.round((100 * encores) / nSongs) : null;
  const tapeShareOfSongRowsPct =
    nSongs > 0 ? Math.round((100 * tapes) / nSongs) : null;

  let songsOnce = 0;
  let songs3p = 0;
  for (const gset of Array.from(titleToGigSet.values())) {
    if (gset.size === 1) songsOnce += 1;
    if (gset.size >= 3) songs3p += 1;
  }

  let bestCityArtist = "";
  let bestCityN = 0;
  let bestVenueArtist = "";
  let bestVenueN = 0;
  for (const [aId, cset] of Array.from(artistCitySets.entries())) {
    const n = cset.size;
    if (n > bestCityN) {
      bestCityN = n;
      bestCityArtist = artistName.get(aId) ?? "Artista";
    }
  }
  for (const [aId, vset] of Array.from(artistVenueSets.entries())) {
    const n = vset.size;
    if (n > bestVenueN) {
      bestVenueN = n;
      bestVenueArtist = artistName.get(aId) ?? "Artista";
    }
  }
  const artistWithMostDifferentCitiesLabel =
    bestCityN > 0 ? `${bestCityArtist} (${bestCityN} città)` : null;
  const artistWithMostDifferentVenuesLabel =
    bestVenueN > 0 ? `${bestVenueArtist} (${bestVenueN} venue)` : null;

  const supportOnlyCounts = new Map<string, number>();
  for (const lr of lineupRows ?? []) {
    const gid = lr.gig_id as string;
    const sid = lr.artist_id as string;
    const gg = valid.find((x) => x.gig_id === gid)?.gig;
    if (!gg || sid === gg.artist_id) continue;
    const lab = artistName.get(sid) ?? "Artista";
    supportOnlyCounts.set(lab, (supportOnlyCounts.get(lab) ?? 0) + 1);
  }
  const topSupportActsNotHeadliner =
    supportOnlyCounts.size > 0 ? sortNamedCounts(supportOnlyCounts, 15) : null;

  const myHeadlinerIds = new Set(valid.map((r) => r.gig!.artist_id));
  const supportArtistIds = new Set<string>();
  for (const lr of lineupRows ?? []) {
    const gid = lr.gig_id as string;
    const sid = lr.artist_id as string;
    const gg = valid.find((x) => x.gig_id === gid)?.gig;
    if (!gg || sid === gg.artist_id) continue;
    supportArtistIds.add(sid);
  }
  let supportAlsoHeadliner = 0;
  for (const sid of Array.from(supportArtistIds)) {
    if (myHeadlinerIds.has(sid)) supportAlsoHeadliner += 1;
  }

  const datesByHeadliner = new Map<string, string[]>();
  for (const r of valid) {
    const hid = r.gig!.artist_id;
    const d = r.gig!.gig_date.trim();
    if (!datesByHeadliner.has(hid)) datesByHeadliner.set(hid, []);
    datesByHeadliner.get(hid)!.push(d);
  }
  let longestGapSameHead = 0;
  for (const ds of Array.from(datesByHeadliner.values())) {
    const uniq = Array.from(new Set(ds)).sort();
    for (let i = 1; i < uniq.length; i++) {
      const gdiff = Math.round(
        (Date.parse(`${uniq[i]!}T12:00:00Z`) -
          Date.parse(`${uniq[i - 1]!}T12:00:00Z`)) /
          86_400_000,
      );
      longestGapSameHead = Math.max(longestGapSameHead, gdiff);
    }
  }
  const longestGapDaysSameHeadliner =
    datesByHeadliner.size > 0 && longestGapSameHead > 0
      ? longestGapSameHead
      : null;

  const genreByYear = new Map<number, Map<string, number>>();
  for (const r of valid) {
    const yr = yearFromIsoDate(r.gig!.gig_date);
    if (yr == null) continue;
    const gen = artistGenre.get(r.gig!.artist_id) ?? "—";
    if (!genreByYear.has(yr)) genreByYear.set(yr, new Map());
    const gm = genreByYear.get(yr)!;
    gm.set(gen, (gm.get(gen) ?? 0) + 1);
  }
  const topGenrePerYear: Record<string, string> = {};
  for (const [yr, gm] of Array.from(genreByYear.entries())) {
    let topG = "";
    let topC = 0;
    for (const [g, c] of Array.from(gm.entries())) {
      if (c > topC) {
        topC = c;
        topG = g;
      }
    }
    if (topG) topGenrePerYear[String(yr)] = topG;
  }
  const topGenrePerYearJson =
    Object.keys(topGenrePerYear).length > 0
      ? JSON.stringify(topGenrePerYear)
      : null;

  const minSingleTravelKm =
    travelSamples.length > 0 ? Math.min(...travelSamples) : null;

  const venueVisitCounts = new Map<string, number>();
  const artistNamesByVenue = new Map<string, Set<string>>();
  for (const r of valid) {
    const vid = r.gig!.venue_id;
    venueVisitCounts.set(vid, (venueVisitCounts.get(vid) ?? 0) + 1);
    const roles = billingRolesByGig.get(r.gig_id);
    const display =
      roles != null
        ? formatGigHeadlinerDisplay(roles, artistName, r.gig!.artist_id)
        : (artistName.get(r.gig!.artist_id) ?? "Artist");
    if (!artistNamesByVenue.has(vid)) artistNamesByVenue.set(vid, new Set());
    artistNamesByVenue.get(vid)!.add(display);
  }
  const venueHeatPoints: VenueHeatmapSpot[] = [];
  let venuesWithCoordinates = 0;
  let venuesMissingCoordinates = 0;
  for (const [vid, weight] of Array.from(venueVisitCounts.entries())) {
    const vn = venueById.get(vid);
    if (!vn) continue;
    if (vn.lat == null || vn.lng == null) {
      venuesMissingCoordinates += 1;
      continue;
    }
    venuesWithCoordinates += 1;
    venueHeatPoints.push({
      lat: vn.lat,
      lng: vn.lng,
      weight,
      venueName: vn.name || "Venue",
      city: canonicalCityName(vn.city ?? "", vn.country ?? ""),
      country: vn.country ?? "",
      concertCount: weight,
      artistNames: Array.from(artistNamesByVenue.get(vid) ?? []).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" }),
      ),
    });
  }

  return {
    generatedAtIso: new Date().toISOString(),
    overview: {
      concertsAttended: valid.length,
      uniqueHeadlineArtists: artistIds.length,
      uniqueVenues: venueIds.length,
      uniqueVenueCities: cityCounts.size,
      uniqueVenueCountries: countryCounts.size,
      festivalsAttended: festivals,
      cancelledGigsInHistory: cancelled,
      firstConcertDate: first,
      lastConcertDate: last,
      yearsSpanned,
      concertsPerYearJson: JSON.stringify(perYearObj),
    },
    artistsAndVenues: {
      topArtistsSeen,
      topVenues: sortNamedCounts(venueLabelCounts),
      topVenueCities: sortNamedCounts(cityCounts),
      topVenueCountries:
        countryCounts.size > 0 ? sortNamedCounts(countryCounts, 20) : null,
    },
    personalAttendance: {
      standingShows: standing,
      seatedShows: seated,
      topSectors: sectorCounts.size > 0 ? sortNamedCounts(sectorCounts, 15) : null,
      distinctDepartureCityPairs: departurePairs.size,
      savedHomeLocations: homeCount ?? 0,
    },
    moneyAndTravel: {
      totalTicketSpendEur: eurPriceRows > 0 ? Math.round(eurCentsSum / 100) : null,
      avgTicketPriceEur:
        eurPriceRows > 0 ? Math.round(eurCentsSum / eurPriceRows / 100) : null,
      concertsWithTicketPrice: eurPriceRows > 0 ? eurPriceRows : null,
      nonEurTicketRows: nonEurRows > 0 ? nonEurRows : null,
      totalTravelKmReported:
        travelSamples.length > 0
          ? travelSamples.reduce((a, b) => a + b, 0)
          : null,
      avgTravelKmWhenPresent:
        travelSamples.length > 0
          ? Math.round(
              travelSamples.reduce((a, b) => a + b, 0) / travelSamples.length,
            )
          : null,
      maxSingleTravelKm:
        travelSamples.length > 0 ? Math.max(...travelSamples) : null,
      minSingleTravelKm,
      avgDaysBoughtInAdvance:
        advanceSamples.length > 0
          ? Math.round(
              advanceSamples.reduce((a, b) => a + b, 0) / advanceSamples.length,
            )
          : null,
    },
    setlistsAndSongs: {
      showsWithSetlist,
      totalSongRowsAcrossShows: songRows.length,
      uniqueSongTitlesHeard: uniqueTitles.size,
      encoreSongRows: encores,
      coverSongRows: covers,
      tapeSongRows: tapes,
      songsWithGuestCredit: withGuest,
      avgSongsPerShowWhenSetlistPresent: avgSongsPerShow,
      topToursByShowCount:
        tourCounts.size > 0 ? sortNamedCounts(tourCounts, 15) : null,
      avgReportedDurationMinutes: avgDur,
      songRowsWithAlbumTitle:
        songRowsWithAlbumTitleCount > 0 ? songRowsWithAlbumTitleCount : null,
      topAlbumsBySongRow,
    },
    mapsAndLineup: {
      venueHeatPoints,
      venuesWithCoordinates,
      venuesMissingCoordinates,
      headlinerLineupBuddies,
    },
    lineupAndTags: {
      lineupSlotRowsAcrossShows: (lineupRows ?? []).length,
      distinctNonHeadlineLineupArtists: nonHeadlineLineup.size,
      topLineupArtistNames:
        lineupNameCounts.size > 0 ? sortNamedCounts(lineupNameCounts, 20) : null,
      songTagRowsLinked: tagRowCount ?? 0,
      distinctSongTagLabels: distinctTags,
    },
    setlistfmAndProfile: {
      gigsLinkedToSetlistfm: setlistfmLinked,
      setlistfmUserIdOnProfile: slUser?.trim() ? slUser.trim() : null,
    },
    plannedInputs: {
      transportModeSplitJson: null,
    },
    nicheBrainstorm: {
      avgConcertsPerYearWithAtLeastOneShow: avgConcertsPerActiveYear,
      mostActiveMonthLabel,
      mostActiveYear,
      longestGapDaysBetweenShowDates:
        uniqueSortedDates.length >= 2 ? longestGapDays : null,
      shortestGapDaysBetweenShowDates: shortestGapDays,
      avgDaysBetweenShowDates,
      maxConsecutiveCalendarDaysWithShow,
      daysWithMultipleShows,
      festivalSharePct,
      weekendShowSharePct,
      costPerLiveMinuteEur,
      coverShareOfSongRowsPct,
      encoreShareOfSongRowsPct,
      tapeShareOfSongRowsPct,
      songsHeardInExactlyOneGigTitleCount: songsOnce > 0 ? songsOnce : null,
      songsHeardInThreePlusGigsTitleCount: songs3p > 0 ? songs3p : null,
      artistWithMostDifferentCitiesLabel,
      artistWithMostDifferentVenuesLabel,
      topSupportActsNotHeadliner,
      supportActsAlsoSeenAsYourHeadlinerCount:
        supportAlsoHeadliner > 0 ? supportAlsoHeadliner : null,
      longestGapDaysSameHeadliner,
      songsRepeatAcrossDifferentGigs:
        songRows.length > 0 ? repeatSongsAcrossShows : null,
      longestStreakSameHeadlinerShows: longestStreakSameArtist,
      daysSinceLastConcert:
        last != null
          ? Math.max(
              0,
              Math.floor(
                (Date.now() - new Date(`${last}T12:00:00`).getTime()) /
                  86_400_000,
              ),
            )
          : null,
      topGenrePerYearJson,
      mostActiveSeasonLabel,
      mostActiveWeekdayLabel,
      nonFestivalShowSharePct,
      venuesVisitedAtLeastTwiceCount,
      topSingleVenueAttendanceSharePct,
      avgTicketPriceEurPerYearJson,
      totalReportedLiveMinutesSum: totalReportedLiveMinutesScalar,
      minReportedShowMinutes,
      maxReportedShowMinutes,
      bestEuroPerMinuteShowLabel,
      priciestTicketShowLabel: priciestTicketShowLabelResolved,
      headlinerLifetimeTravelKmLeaderLabel,
      mostHeardLiveSongLabel,
      topLiveOpenersNotTape,
      topLiveClosersNotTape,
    },
  };
}

function emptyStats(): DashboardStatistics {
  const z: StatScalar = null;
  return {
    generatedAtIso: new Date().toISOString(),
    overview: {
      concertsAttended: z,
      uniqueHeadlineArtists: z,
      uniqueVenues: z,
      uniqueVenueCities: z,
      uniqueVenueCountries: z,
      festivalsAttended: z,
      cancelledGigsInHistory: z,
      firstConcertDate: z,
      lastConcertDate: z,
      yearsSpanned: z,
      concertsPerYearJson: z,
    },
    artistsAndVenues: {
      topArtistsSeen: null,
      topVenues: null,
      topVenueCities: null,
      topVenueCountries: null,
    },
    personalAttendance: {
      standingShows: z,
      seatedShows: z,
      topSectors: null,
      distinctDepartureCityPairs: z,
      savedHomeLocations: z,
    },
    moneyAndTravel: {
      totalTicketSpendEur: z,
      avgTicketPriceEur: z,
      concertsWithTicketPrice: z,
      nonEurTicketRows: z,
      totalTravelKmReported: z,
      avgTravelKmWhenPresent: z,
      maxSingleTravelKm: z,
      minSingleTravelKm: z,
      avgDaysBoughtInAdvance: z,
    },
    setlistsAndSongs: {
      showsWithSetlist: z,
      totalSongRowsAcrossShows: z,
      uniqueSongTitlesHeard: z,
      encoreSongRows: z,
      coverSongRows: z,
      tapeSongRows: z,
      songsWithGuestCredit: z,
      avgSongsPerShowWhenSetlistPresent: z,
      topToursByShowCount: null,
      avgReportedDurationMinutes: z,
      songRowsWithAlbumTitle: z,
      topAlbumsBySongRow: null,
    },
    mapsAndLineup: {
      venueHeatPoints: [],
      venuesWithCoordinates: 0,
      venuesMissingCoordinates: 0,
      headlinerLineupBuddies: null,
    },
    lineupAndTags: {
      lineupSlotRowsAcrossShows: z,
      distinctNonHeadlineLineupArtists: z,
      topLineupArtistNames: null,
      songTagRowsLinked: z,
      distinctSongTagLabels: z,
    },
    setlistfmAndProfile: {
      gigsLinkedToSetlistfm: z,
      setlistfmUserIdOnProfile: z,
    },
    plannedInputs: {
      transportModeSplitJson: z,
    },
    nicheBrainstorm: {
      avgConcertsPerYearWithAtLeastOneShow: z,
      mostActiveMonthLabel: z,
      mostActiveYear: z,
      longestGapDaysBetweenShowDates: z,
      shortestGapDaysBetweenShowDates: z,
      avgDaysBetweenShowDates: z,
      maxConsecutiveCalendarDaysWithShow: z,
      daysWithMultipleShows: z,
      festivalSharePct: z,
      weekendShowSharePct: z,
      costPerLiveMinuteEur: z,
      coverShareOfSongRowsPct: z,
      encoreShareOfSongRowsPct: z,
      tapeShareOfSongRowsPct: z,
      songsHeardInExactlyOneGigTitleCount: z,
      songsHeardInThreePlusGigsTitleCount: z,
      artistWithMostDifferentCitiesLabel: z,
      artistWithMostDifferentVenuesLabel: z,
      topSupportActsNotHeadliner: null,
      supportActsAlsoSeenAsYourHeadlinerCount: z,
      longestGapDaysSameHeadliner: z,
      songsRepeatAcrossDifferentGigs: z,
      longestStreakSameHeadlinerShows: z,
      daysSinceLastConcert: z,
      topGenrePerYearJson: z,
      mostActiveSeasonLabel: z,
      mostActiveWeekdayLabel: z,
      nonFestivalShowSharePct: z,
      venuesVisitedAtLeastTwiceCount: z,
      topSingleVenueAttendanceSharePct: z,
      avgTicketPriceEurPerYearJson: z,
      totalReportedLiveMinutesSum: z,
      minReportedShowMinutes: z,
      maxReportedShowMinutes: z,
      bestEuroPerMinuteShowLabel: z,
      priciestTicketShowLabel: z,
      headlinerLifetimeTravelKmLeaderLabel: z,
      mostHeardLiveSongLabel: z,
      topLiveOpenersNotTape: null,
      topLiveClosersNotTape: null,
    },
  };
}
