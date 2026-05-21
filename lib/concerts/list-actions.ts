"use server";

import {
  formatGigHeadlinerDisplay,
  resolveGigBillingRoles,
  type LineupRowInput,
} from "@/lib/gigs/billing-headliners";
import { parseSetlistSongInfo } from "@/lib/setlistfm/parse";
import { createClient } from "@/lib/supabase/server";

export type DashboardConcertSong = {
  title: string;
  position: number;
  is_encore: boolean;
  is_cover: boolean;
  /** Assente se il DB non ha ancora la colonna `is_tape`. */
  is_tape?: boolean;
  set_name: string | null;
  featuring_names: string | null;
  song_info: string | null;
  cover_original_artist: string | null;
  tag_labels: string[];
};

/** `id` = `gig_attendances.id` (la tua partecipazione); `gig_id` per risync condiviso. */
export type DashboardConcertRow = {
  id: string;
  gig_id: string;
  concert_date: string;
  tour_name: string | null;
  artist_name: string;
  venue_label: string;
  songs: DashboardConcertSong[];
};

type RawSongRow = Omit<DashboardConcertSong, "tag_labels"> & { id: string };

function buildDashboardRow(
  row: {
    id: unknown;
    gig_id: unknown;
    gig_date: unknown;
    tour_name: unknown;
  },
  artistName: string,
  venueLabel: string,
  rawSongs: RawSongRow[],
  tagsBySongId: Map<string, string[]>,
): DashboardConcertRow {
  const songs = [...rawSongs]
    .filter((s) => s.is_tape !== true)
    .sort((a, b) => a.position - b.position)
    .map((song) => {
      const fromJoin = tagsBySongId.get(song.id) ?? [];
      const fromInfo = song.song_info?.trim()
        ? parseSetlistSongInfo(song.song_info).tags
        : [];
      const seen = new Set<string>();
      const tag_labels: string[] = [];
      for (const t of [...fromJoin, ...fromInfo]) {
        const k = t.trim().toLowerCase();
        if (!k || seen.has(k)) continue;
        seen.add(k);
        tag_labels.push(t.trim());
      }
      if (song.is_cover && !seen.has("cover")) tag_labels.push("Cover");
      const { id: _id, ...rest } = song;
      return { ...rest, tag_labels } as DashboardConcertSong;
    });
  return {
    id: row.id as string,
    gig_id: row.gig_id as string,
    concert_date: row.gig_date as string,
    tour_name: (row.tour_name as string | null) ?? null,
    artist_name: artistName.trim() || "Artista",
    venue_label: venueLabel,
    songs,
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

/**
 * Lista le tue partecipazioni (`gig_attendances`) con metadati da `gigs` / artisti / venue / scaletta.
 */
export async function listMyConcerts(): Promise<DashboardConcertRow[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const base = await supabase
    .from("gig_attendances")
    .select(
      `
      id,
      gig_id,
      gigs (
        gig_date,
        tour_name,
        artist_id,
        venue_id,
        source
      )
    `,
    )
    .eq("user_id", user.id);

  if (base.error || !base.data?.length) return [];

  const rows = base.data as Array<{
    id: string;
    gig_id: string;
    gigs:
      | {
          gig_date: string;
          tour_name: string | null;
          artist_id: string;
          venue_id: string;
          source: string | null;
        }
      | {
          gig_date: string;
          tour_name: string | null;
          artist_id: string;
          venue_id: string;
          source: string | null;
        }[]
      | null;
  }>;

  const flat = rows
    .map((r) => {
      const g = Array.isArray(r.gigs) ? r.gigs[0] : r.gigs;
      return {
        attendanceId: r.id,
        gigId: r.gig_id,
        gig_date: g?.gig_date ?? "",
        tour_name: g?.tour_name ?? null,
        artist_id: g?.artist_id,
        venue_id: g?.venue_id,
        source: g?.source ?? null,
      };
    })
    .sort((a, b) => (a.gig_date < b.gig_date ? 1 : a.gig_date > b.gig_date ? -1 : 0));

  const artistIds = Array.from(
    new Set(
      flat
        .map((r) => r.artist_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const venueIds = Array.from(
    new Set(
      flat
        .map((r) => r.venue_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const artistNameById = new Map<string, string>();
  if (artistIds.length > 0) {
    const { data: artists } = await supabase
      .from("artists")
      .select("id,name")
      .in("id", artistIds);
    for (const a of artists ?? []) {
      artistNameById.set(
        a.id as string,
        String((a as { name?: string }).name ?? "").trim() || "Artista",
      );
    }
  }

  const venueLabelById = new Map<string, string>();
  if (venueIds.length > 0) {
    const { data: venues } = await supabase
      .from("venues")
      .select("id,name,city")
      .in("id", venueIds);
    for (const v of venues ?? []) {
      const name = String((v as { name?: string }).name ?? "").trim();
      const city = String((v as { city?: string }).city ?? "").trim();
      venueLabelById.set(
        (v as { id: string }).id,
        [name, city].filter(Boolean).join(", "),
      );
    }
  }

  const gigIds = Array.from(new Set(flat.map((r) => r.gigId)));

  const lineupByGigId = new Map<string, LineupRowInput[]>();
  const gigSourceByGig = new Map<string, string | null>();
  for (const r of flat) {
    gigSourceByGig.set(r.gigId, r.source ?? null);
  }

  if (gigIds.length > 0) {
    type LineupDbRow = {
      gig_id: string;
      artist_id: string;
      is_co_headliner?: boolean;
      artists?: { name?: string } | { name?: string }[] | null;
    };

    const lineupSelWithCo =
      "gig_id, artist_id, is_co_headliner, artists ( name )";
    const lineupSelNoCo = "gig_id, artist_id, artists ( name )";
    const lineupSelPlain = "gig_id, artist_id, is_co_headliner";

    let lineupRows: LineupDbRow[] | null = null;

    const lineupRes = await supabase
      .from("gig_lineup_artists")
      .select(lineupSelWithCo)
      .in("gig_id", gigIds);

    if (!lineupRes.error) {
      lineupRows = (lineupRes.data as LineupDbRow[] | null) ?? null;
    } else if (/is_co_headliner/i.test(lineupRes.error.message ?? "")) {
      const fallback = await supabase
        .from("gig_lineup_artists")
        .select(lineupSelNoCo)
        .in("gig_id", gigIds);
      lineupRows = (fallback.data as LineupDbRow[] | null) ?? null;
    } else {
      const plain = await supabase
        .from("gig_lineup_artists")
        .select(lineupSelPlain)
        .in("gig_id", gigIds);
      lineupRows = (plain.data as LineupDbRow[] | null) ?? null;
    }

    const lineupArtistIds = new Set<string>();
    if (lineupRows) {
      for (const lr of lineupRows) {
        const aid = String(lr.artist_id ?? "").trim();
        if (aid) lineupArtistIds.add(aid);
      }
    }

    const missingLineupIds = Array.from(lineupArtistIds).filter(
      (id) => !artistNameById.has(id),
    );
    if (missingLineupIds.length > 0) {
      const { data: lineupArtists } = await supabase
        .from("artists")
        .select("id,name")
        .in("id", missingLineupIds);
      for (const a of lineupArtists ?? []) {
        artistNameById.set(
          a.id as string,
          String((a as { name?: string }).name ?? "").trim() || "Artista",
        );
      }
    }

    if (lineupRows) {
      for (const lr of lineupRows) {
        const gid = lr.gig_id as string;
        const aid = lr.artist_id as string;
        const ar = lr.artists as { name?: string } | { name?: string }[] | null;
        const one = Array.isArray(ar) ? ar[0] : ar;
        const n = String(one?.name ?? "").trim();
        if (n) artistNameById.set(aid, n);
        if (!lineupByGigId.has(gid)) lineupByGigId.set(gid, []);
        lineupByGigId.get(gid)!.push({
          artist_id: aid,
          is_co_headliner: Boolean(
            (lr as { is_co_headliner?: boolean }).is_co_headliner,
          ),
        });
      }
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
    const aid = r.artist_id as string | null;
    if (!aid) continue;
    const roles = resolveGigBillingRoles(
      aid,
      artistNameById.get(aid) ?? "",
      lineupByGigId.get(r.gigId) ?? [],
      artistNameById,
      gigSourceByGig.get(r.gigId) ?? null,
      ampersandArtists,
    );
    headlinerDisplayByGig.set(
      r.gigId,
      formatGigHeadlinerDisplay(roles, artistNameById, aid),
    );
  }

  const selWithTape =
    "id, gig_id, title, position, is_encore, is_cover, is_tape, set_name, featuring_names, song_info, cover_original_artist";
  const selNoTape =
    "id, gig_id, title, position, is_encore, is_cover, set_name, featuring_names, song_info, cover_original_artist";

  const r1 = await supabase
    .from("gig_songs")
    .select(selWithTape)
    .in("gig_id", gigIds)
    .order("position", { ascending: true });

  let songData = r1.data;
  let songErr = r1.error;
  if (songErr && /is_tape/i.test(songErr.message ?? "")) {
    const r2 = await supabase
      .from("gig_songs")
      .select(selNoTape)
      .in("gig_id", gigIds)
      .order("position", { ascending: true });
    songData = r2.data as typeof r1.data;
    songErr = r2.error;
  }

  const songsByGig = new Map<string, RawSongRow[]>();
  const allSongIds: string[] = [];
  if (!songErr && songData) {
    for (const s of songData) {
      const gid = s.gig_id as string;
      const sid = s.id as string;
      if (!gid || !sid) continue;
      allSongIds.push(sid);
      const arr = songsByGig.get(gid) ?? [];
      arr.push(s as RawSongRow);
      songsByGig.set(gid, arr);
    }
  }

  const tagsBySongId = await loadTagsBySongId(supabase, allSongIds);

  return flat.map((r) => {
    const aid = r.artist_id as string | null;
    const vid = r.venue_id as string | null;
    const artistName = aid
      ? (headlinerDisplayByGig.get(r.gigId) ?? artistNameById.get(aid) ?? "Artista")
      : "Artista";
    const venueLabel = vid ? (venueLabelById.get(vid) ?? "") : "";
    return buildDashboardRow(
      {
        id: r.attendanceId,
        gig_id: r.gigId,
        gig_date: r.gig_date,
        tour_name: r.tour_name,
      },
      artistName,
      venueLabel,
      songsByGig.get(r.gigId) ?? [],
      tagsBySongId,
    );
  });
}
