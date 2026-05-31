import { formatConcertDateWithWeekday } from "@/lib/format-concert-date";
import {
  formatGigHeadlinerDisplay,
  resolveGigBillingRoles,
  type LineupRowInput,
} from "@/lib/gigs/billing-headliners";
import { createClient } from "@/lib/supabase/server";
import type {
  DashboardPassportNumbers,
  PassportStampPreview,
} from "@/lib/passport-display";

export type {
  DashboardPassportNumbers,
  PassportStampPreview,
} from "@/lib/passport-display";
export { formatKmPassport, formatMusicHours } from "@/lib/passport-display";

function formatComma(n: number): string {
  return Math.round(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export type HomeProfileHeader = {
  displayName: string;
  tagline: string;
  avatarUrl: string | null;
};

export async function getHomeProfileHeader(): Promise<HomeProfileHeader> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { displayName: "Guest", tagline: "My concert log", avatarUrl: null };
  }
  const { data } = await supabase
    .from("profiles")
    .select("display_name, profile_tagline, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const row = data as {
    display_name?: string | null;
    profile_tagline?: string | null;
    avatar_url?: string | null;
  } | null;
  const dn = String(row?.display_name ?? "").trim();
  return {
    displayName: dn || user.email?.split("@")[0] || "You",
    tagline: String(row?.profile_tagline ?? "").trim() || "My concert log",
    avatarUrl: String(row?.avatar_url ?? "").trim() || null,
  };
}

export async function getDashboardDisplayName(): Promise<string> {
  const h = await getHomeProfileHeader();
  return h.displayName;
}

/** Default home location label for passport “Place of issue”. */
export async function getDefaultHomePlaceOfIssue(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "—";

  const { data: defaultRow } = await supabase
    .from("home_locations")
    .select("label,city,country")
    .eq("user_id", user.id)
    .eq("is_default", true)
    .maybeSingle();

  const row = defaultRow as { label?: string | null; city?: string | null; country?: string | null } | null;
  if (row) {
    const lab = String(row.label ?? "").trim();
    if (lab) return lab;
    const city = String(row.city ?? "").trim();
    const country = String(row.country ?? "").trim();
    if (city && country) return `${city}, ${country}`;
    if (city) return city;
    if (country) return country;
  }

  const { data: first } = await supabase
    .from("home_locations")
    .select("label,city,country")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const f = first as { label?: string | null; city?: string | null; country?: string | null } | null;
  if (!f) return "—";
  const lab = String(f.label ?? "").trim();
  if (lab) return lab;
  const city = String(f.city ?? "").trim();
  const country = String(f.country ?? "").trim();
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (country) return country;
  return "—";
}

export async function getDashboardPassportNumbers(): Promise<DashboardPassportNumbers> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const empty: DashboardPassportNumbers = {
    concertsCount: 0,
    kmTraveledSum: 0,
    musicTimeMinutesSum: 0,
    distinctArtistsCount: 0,
    distinctVenuesCount: 0,
    uniqueSongTitlesLive: 0,
  };
  if (!user) return empty;

  const { data: rows, error } = await supabase
    .from("gig_attendances")
    .select(
      `
      id,
      travel_km,
      gigs (
        id,
        artist_id,
        venue_id,
        concert_duration_minutes
      )
    `,
    )
    .eq("user_id", user.id);

  if (error || !rows?.length) return empty;

  type Row = {
    id: string;
    travel_km: number | null;
    gigs:
      | {
          id: string;
          artist_id: string;
          venue_id: string;
          concert_duration_minutes: number | null;
        }
      | {
          id: string;
          artist_id: string;
          venue_id: string;
          concert_duration_minutes: number | null;
        }[]
      | null;
  };

  const gigIds: string[] = [];
  const artistIds = new Set<string>();
  const venueIds = new Set<string>();
  let kmSum = 0;
  let minutesSum = 0;

  for (const r of rows as Row[]) {
    const g = Array.isArray(r.gigs) ? r.gigs[0] : r.gigs;
    if (!g?.id) continue;
    gigIds.push(g.id);
    if (g.artist_id) artistIds.add(g.artist_id);
    if (g.venue_id) venueIds.add(g.venue_id);
    const km = r.travel_km != null ? Number(r.travel_km) : 0;
    if (Number.isFinite(km)) kmSum += km;
    const dm = g.concert_duration_minutes != null ? Number(g.concert_duration_minutes) : 0;
    if (Number.isFinite(dm) && dm > 0) minutesSum += dm;
  }

  if (gigIds.length === 0) return empty;

  const [{ data: lineup }, { data: songs }] = await Promise.all([
    supabase.from("gig_lineup_artists").select("artist_id").in("gig_id", gigIds),
    supabase
      .from("gig_songs")
      .select("title, guest_artist_id, is_tape")
      .in("gig_id", gigIds),
  ]);

  for (const l of lineup ?? []) {
    const aid = (l as { artist_id?: string }).artist_id;
    if (aid) artistIds.add(aid);
  }

  const titleSet = new Set<string>();
  for (const s of songs ?? []) {
    if ((s as { is_tape?: boolean }).is_tape === true) continue;
    const t = String((s as { title?: string }).title ?? "").trim();
    if (t) titleSet.add(t.toLowerCase());
    const gid = (s as { guest_artist_id?: string | null }).guest_artist_id;
    if (gid) artistIds.add(gid);
  }

  return {
    concertsCount: rows.length,
    kmTraveledSum: kmSum,
    musicTimeMinutesSum: minutesSum,
    distinctArtistsCount: artistIds.size,
    distinctVenuesCount: venueIds.size,
    uniqueSongTitlesLive: titleSet.size,
  };
}

export type LatestConcertSummary = {
  attendanceId: string;
  artistName: string;
  venueCityLine: string;
  dateLabel: string;
  tourName: string | null;
};

export async function getLatestConcertForDashboard(): Promise<LatestConcertSummary | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rows } = await supabase
    .from("gig_attendances")
    .select(
      `
      id,
      gigs (
        gig_date,
        tour_name,
        artist_id,
        venue_id
      )
    `,
    )
    .eq("user_id", user.id);

  if (!rows?.length) return null;

  type R = {
    id: string;
    gigs:
      | {
          gig_date: string;
          tour_name: string | null;
          artist_id: string;
          venue_id: string;
        }
      | null
      | Array<{
          gig_date: string;
          tour_name: string | null;
          artist_id: string;
          venue_id: string;
        }>;
  };

  const flat = (rows as R[])
    .map((r) => {
      const g = Array.isArray(r.gigs) ? r.gigs[0] : r.gigs;
      if (!g) return null;
      return { attendanceId: r.id, ...g };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => (a.gig_date < b.gig_date ? 1 : a.gig_date > b.gig_date ? -1 : 0));

  const top = flat[0];
  if (!top) return null;

  const [{ data: ar }, { data: vn }] = await Promise.all([
    supabase.from("artists").select("name").eq("id", top.artist_id).maybeSingle(),
    supabase.from("venues").select("name,city").eq("id", top.venue_id).maybeSingle(),
  ]);

  const artistName =
    String((ar as { name?: string } | null)?.name ?? "").trim() || "Artist";
  const v = vn as { name?: string; city?: string } | null;
  const venueCityLine = v
    ? [String(v.name ?? "").trim(), String(v.city ?? "").trim()].filter(Boolean).join(", ")
    : "";

  const dateLabel = formatConcertDateWithWeekday(top.gig_date);

  return {
    attendanceId: top.attendanceId,
    artistName,
    venueCityLine,
    dateLabel,
    tourName: top.tour_name,
  };
}

/** Recent concerts for stamp previews; sorted oldest-first for chronological stamp ordering. */
export async function getPassportStampPreviews(max = 50): Promise<PassportStampPreview[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  /** Two-step load: nested `gigs (...)` embeds sometimes come back null in SSR; direct `gigs` select is reliable. */
  const { data: attendances, error: attErr } = await supabase
    .from("gig_attendances")
    .select("id, gig_id")
    .eq("user_id", user.id);

  if (attErr || !attendances?.length) return [];

  const gigIds = Array.from(
    new Set(
      (attendances as { gig_id: string }[]).map((a) => a.gig_id).filter(Boolean),
    ),
  );
  if (gigIds.length === 0) return [];

  const { data: gigs, error: gigErr } = await supabase
    .from("gigs")
    .select("id, gig_date, artist_id, venue_id, source")
    .in("id", gigIds);

  if (gigErr || !gigs?.length) return [];

  type GigRow = {
    id: string;
    gig_date: string;
    artist_id: string;
    venue_id: string;
    source: string | null;
  };
  const gigById = new Map((gigs as GigRow[]).map((g) => [g.id, g]));

  type Flat = {
    attendanceId: string;
    gigId: string;
    gig_date: string;
    artist_id: string;
    venue_id: string;
    source: string | null;
  };

  const flat = (attendances as { id: string; gig_id: string }[])
    .map((r): Flat | null => {
      const g = gigById.get(r.gig_id);
      if (!g?.gig_date) return null;
      return {
        attendanceId: r.id,
        gigId: r.gig_id,
        gig_date: g.gig_date,
        artist_id: g.artist_id,
        venue_id: g.venue_id,
        source: g.source ?? null,
      };
    })
    .filter((x): x is Flat => x != null)
    .sort((a, b) => (a.gig_date < b.gig_date ? -1 : a.gig_date > b.gig_date ? 1 : 0))
    .slice(0, max);

  if (flat.length === 0) return [];

  const artistIds = Array.from(new Set(flat.map((x) => x.artist_id).filter(Boolean))) as string[];
  const venueIds = Array.from(new Set(flat.map((x) => x.venue_id).filter(Boolean))) as string[];

  const [{ data: artists }, { data: venues }] = await Promise.all([
    artistIds.length
      ? supabase.from("artists").select("id,name").in("id", artistIds)
      : Promise.resolve({ data: [] as { id: string; name?: string }[] }),
    venueIds.length
      ? supabase.from("venues").select("id,name,city").in("id", venueIds)
      : Promise.resolve({ data: [] as { id: string; name?: string; city?: string }[] }),
  ]);

  const artistNameById = new Map<string, string>();
  for (const a of artists ?? []) {
    artistNameById.set(a.id as string, String((a as { name?: string }).name ?? "").trim() || "Artist");
  }

  const gigIdsForLineup = Array.from(new Set(flat.map((r) => r.gigId)));
  const lineupByGigId = new Map<string, LineupRowInput[]>();

  if (gigIdsForLineup.length > 0) {
    type LineupDbRow = {
      gig_id: string;
      artist_id: string;
      is_co_headliner?: boolean;
    };

    let lineupRows: LineupDbRow[] | null = null;
    const lineupRes = await supabase
      .from("gig_lineup_artists")
      .select("gig_id, artist_id, is_co_headliner")
      .in("gig_id", gigIdsForLineup);

    if (!lineupRes.error) {
      lineupRows = (lineupRes.data as LineupDbRow[] | null) ?? null;
    } else {
      const plain = await supabase
        .from("gig_lineup_artists")
        .select("gig_id, artist_id")
        .in("gig_id", gigIdsForLineup);
      lineupRows = (plain.data as LineupDbRow[] | null) ?? null;
    }

    const extraLineupArtistIds = new Set<string>();
    for (const lr of lineupRows ?? []) {
      const aid = String(lr.artist_id ?? "").trim();
      if (aid && !artistNameById.has(aid)) extraLineupArtistIds.add(aid);
    }
    if (extraLineupArtistIds.size > 0) {
      const { data: lineupArtists } = await supabase
        .from("artists")
        .select("id,name")
        .in("id", Array.from(extraLineupArtistIds));
      for (const a of lineupArtists ?? []) {
        artistNameById.set(
          a.id as string,
          String((a as { name?: string }).name ?? "").trim() || "Artist",
        );
      }
    }

    for (const lr of lineupRows ?? []) {
      const gid = lr.gig_id as string;
      if (!lineupByGigId.has(gid)) lineupByGigId.set(gid, []);
      lineupByGigId.get(gid)!.push({
        artist_id: lr.artist_id as string,
        is_co_headliner: Boolean(lr.is_co_headliner),
      });
    }
  }

  const { data: ampersandRows } = await supabase
    .from("artists")
    .select("id, name")
    .or("name.ilike.% & %,name.ilike.% / %")
    .limit(80);
  const ampersandArtists = (ampersandRows ?? []).map((row) => ({
    name: String((row as { name?: string }).name ?? "").trim(),
  }));

  const headlinerDisplayByGig = new Map<string, string>();
  for (const r of flat) {
    const aid = String(r.artist_id ?? "").trim();
    if (!aid) continue;
    const roles = resolveGigBillingRoles(
      aid,
      artistNameById.get(aid) ?? "",
      lineupByGigId.get(r.gigId) ?? [],
      artistNameById,
      r.source,
      ampersandArtists,
    );
    headlinerDisplayByGig.set(
      r.gigId,
      formatGigHeadlinerDisplay(roles, artistNameById, aid),
    );
  }

  const venueLabelById = new Map<string, string>();
  for (const v of venues ?? []) {
    const name = String((v as { name?: string }).name ?? "").trim();
    const city = String((v as { city?: string }).city ?? "").trim();
    venueLabelById.set(
      (v as { id: string }).id,
      [name, city].filter(Boolean).join(", "),
    );
  }

  return flat.map((r) => {
    const dateLabel = formatConcertDateWithWeekday(r.gig_date);
    const aid = String(r.artist_id ?? "");
    const vid = String(r.venue_id ?? "");
    const displayArtist =
      headlinerDisplayByGig.get(r.gigId) ??
      (aid ? (artistNameById.get(aid) ?? "Artist") : "Artist");
    return {
      attendanceId: r.attendanceId,
      gigId: r.gigId,
      artistName: displayArtist,
      venueLabel: vid ? (venueLabelById.get(vid) ?? "—") : "—",
      artistId: aid || "unknown-artist",
      venueId: vid || "unknown-venue",
      dateLabel,
      rawDate: r.gig_date,
    };
  });
}
