import {
  parseFeaturingNamesList,
  parseSetlistSongInfo,
  partitionFeaturingNamesAndTags,
  slugForSongTag,
} from "@/lib/setlistfm/parse";
import type { createClient } from "@/lib/supabase/server";

type Supabase = ReturnType<typeof createClient>;

function dedupeLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of labels) {
    const k = l.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(l.trim());
  }
  return out;
}

function normFeaturing(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

async function getOrCreateSongTagId(
  supabase: Supabase,
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
    cache.set(slug, existing.id as string);
    return existing.id as string;
  }

  const { data: inserted } = await supabase
    .from("song_tags")
    .insert({ label: trimmed, slug })
    .select("id")
    .single();
  if (inserted?.id) {
    cache.set(slug, inserted.id as string);
    return inserted.id as string;
  }

  const { data: retry } = await supabase
    .from("song_tags")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (retry?.id) {
    cache.set(slug, retry.id as string);
    return retry.id as string;
  }
  return null;
}

async function findArtistIdByName(
  supabase: Supabase,
  name: string,
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data: rows } = await supabase
    .from("artists")
    .select("id, name")
    .ilike("name", trimmed)
    .limit(8);
  const hit = (rows ?? []).find(
    (r) => String(r.name ?? "").trim().toLowerCase() === trimmed.toLowerCase(),
  );
  if (hit?.id) return hit.id as string;
  const { data: ins } = await supabase
    .from("artists")
    .insert({ name: trimmed, genre_primary: null })
    .select("id")
    .single();
  return (ins?.id as string) ?? null;
}

/** Reclassify performance tags (e.g. Acappella) stored as guests on existing songs. */
export async function repairMisclassifiedGuestsAsTagsForUser(
  supabase: Supabase,
  userId: string,
  gigIdsFilter?: string[],
): Promise<{ songsScanned: number; songsFixed: number; tagsLinked: number }> {
  const { data: attRows } = await supabase
    .from("gig_attendances")
    .select("gig_id")
    .eq("user_id", userId);

  let gigIds = Array.from(
    new Set((attRows ?? []).map((r) => r.gig_id as string).filter(Boolean)),
  );
  if (gigIdsFilter?.length) {
    const allowed = new Set(gigIdsFilter);
    gigIds = gigIds.filter((id) => allowed.has(id));
  }
  if (gigIds.length === 0) {
    return { songsScanned: 0, songsFixed: 0, tagsLinked: 0 };
  }

  const { data: songs } = await supabase
    .from("gig_songs")
    .select("id, guest_artist_id, featuring_names, song_info")
    .in("gig_id", gigIds);

  if (!songs?.length) {
    return { songsScanned: 0, songsFixed: 0, tagsLinked: 0 };
  }

  const songIds = songs.map((s) => s.id as string);
  const artistNameById = new Map<string, string>();

  const guestIds = Array.from(
    new Set(
      songs
        .map((s) => s.guest_artist_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  if (guestIds.length > 0) {
    const { data: artists } = await supabase
      .from("artists")
      .select("id, name")
      .in("id", guestIds);
    for (const a of artists ?? []) {
      artistNameById.set(a.id as string, String(a.name ?? "").trim());
    }
  }

  const { data: featLinks } = await supabase
    .from("gig_song_featuring_artists")
    .select("gig_song_id, artist_id")
    .in("gig_song_id", songIds);

  const featBySong = new Map<string, string[]>();
  const featArtistIds = new Set<string>();
  for (const fl of featLinks ?? []) {
    const sid = fl.gig_song_id as string;
    const aid = fl.artist_id as string;
    featArtistIds.add(aid);
    if (!featBySong.has(sid)) featBySong.set(sid, []);
    featBySong.get(sid)!.push(aid);
  }

  const missingFeatArtists = Array.from(featArtistIds).filter(
    (id) => !artistNameById.has(id),
  );
  if (missingFeatArtists.length > 0) {
    const { data: more } = await supabase
      .from("artists")
      .select("id, name")
      .in("id", missingFeatArtists);
    for (const a of more ?? []) {
      artistNameById.set(a.id as string, String(a.name ?? "").trim());
    }
  }

  const { data: tagLinks } = await supabase
    .from("gig_song_tags")
    .select("gig_song_id, song_tags ( label )")
    .in("gig_song_id", songIds);

  const tagsBySong = new Map<string, Set<string>>();
  for (const tl of tagLinks ?? []) {
    const sid = tl.gig_song_id as string;
    const st = tl.song_tags as { label?: string } | { label?: string }[] | null;
    const one = Array.isArray(st) ? st[0] : st;
    const lab = String(one?.label ?? "").trim().toLowerCase();
    if (!lab) continue;
    if (!tagsBySong.has(sid)) tagsBySong.set(sid, new Set());
    tagsBySong.get(sid)!.add(lab);
  }

  const tagCache = new Map<string, string>();
  let songsFixed = 0;
  let tagsLinked = 0;

  for (const song of songs) {
    const songId = song.id as string;
    const guestNames: string[] = [];

    for (const n of parseFeaturingNamesList(song.featuring_names as string | null)) {
      guestNames.push(n);
    }
    const headGuestId = song.guest_artist_id as string | null;
    if (headGuestId) {
      const n = artistNameById.get(headGuestId);
      if (n) guestNames.push(n);
    }
    for (const aid of featBySong.get(songId) ?? []) {
      const n = artistNameById.get(aid);
      if (n) guestNames.push(n);
    }

    const { featuring: guestsFromNames, tags: tagsFromNames } =
      partitionFeaturingNamesAndTags(guestNames);
    const fromInfo = parseSetlistSongInfo(song.song_info as string | null);

    const newFeaturing = dedupeLabels([
      ...guestsFromNames,
      ...fromInfo.extraFeaturingNames,
    ]);
    const newTags = dedupeLabels([...tagsFromNames, ...fromInfo.tags]);

    const newFeaturingStr =
      newFeaturing.length > 0 ? newFeaturing.join(", ") : null;
    const oldFeaturingStr = normFeaturing(song.featuring_names as string | null);
    const newFeaturingNorm = normFeaturing(newFeaturingStr);

    const existingTagKeys = tagsBySong.get(songId) ?? new Set<string>();
    const tagsNeedAdd = newTags.filter(
      (t) => !existingTagKeys.has(t.toLowerCase()),
    );

    const hadMisclassifiedGuest = tagsFromNames.length > 0;
    const featuringChanged = newFeaturingNorm !== oldFeaturingStr;
    const headWasTag =
      headGuestId != null &&
      tagsFromNames.some(
        (t) =>
          t.toLowerCase() ===
          (artistNameById.get(headGuestId) ?? "").toLowerCase(),
      );

    if (!hadMisclassifiedGuest && !featuringChanged && tagsNeedAdd.length === 0) {
      continue;
    }

    await supabase
      .from("gig_songs")
      .update({
        featuring_names: newFeaturingStr,
        guest_artist_id: null,
      })
      .eq("id", songId);

    await supabase
      .from("gig_song_featuring_artists")
      .delete()
      .eq("gig_song_id", songId);

    let firstGuestId: string | null = null;
    for (let i = 0; i < newFeaturing.length; i++) {
      const aid = await findArtistIdByName(supabase, newFeaturing[i]!);
      if (!aid) continue;
      if (!firstGuestId) firstGuestId = aid;
      await supabase.from("gig_song_featuring_artists").insert({
        gig_song_id: songId,
        artist_id: aid,
        sort_order: i,
      });
    }

    if (firstGuestId) {
      await supabase
        .from("gig_songs")
        .update({ guest_artist_id: firstGuestId })
        .eq("id", songId);
    }

    for (const label of tagsNeedAdd) {
      const tid = await getOrCreateSongTagId(supabase, label, tagCache);
      if (!tid) continue;
      const { error } = await supabase
        .from("gig_song_tags")
        .insert({ gig_song_id: songId, song_tag_id: tid });
      if (!error) tagsLinked += 1;
    }

    songsFixed += 1;
  }

  return {
    songsScanned: songs.length,
    songsFixed,
    tagsLinked,
  };
}
