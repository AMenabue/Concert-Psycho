import { parseFeaturingNamesList } from "@/lib/setlistfm/parse";

export type GigSongGuestInput = {
  guestArtistId: string | null;
  featuringNames: string | null;
};

function normName(name: string): string {
  return name.trim().toLowerCase();
}

/** Unique guests on one show by artist name (merges duplicate DB ids for the same person). */
export function countUniqueGuestsForGig(
  headlinerArtistId: string,
  songs: GigSongGuestInput[],
  featuringArtistIds: string[] = [],
  artistNameById: Map<string, string> = new Map(),
): number {
  const head = headlinerArtistId.trim();
  const headlinerName = normName(artistNameById.get(head) ?? "");

  const uniqueNames = new Set<string>();

  const addId = (artistId: string) => {
    const id = artistId.trim();
    if (!id || id === head) return;
    const name = artistNameById.get(id)?.trim();
    if (name) {
      const key = normName(name);
      if (key && key !== headlinerName) uniqueNames.add(key);
      return;
    }
    uniqueNames.add(`__id:${id}`);
  };

  for (const aid of featuringArtistIds) addId(aid);
  for (const s of songs) {
    if (s.guestArtistId) addId(s.guestArtistId);
  }

  for (const s of songs) {
    for (const name of parseFeaturingNamesList(s.featuringNames)) {
      const key = normName(name);
      if (key && key !== headlinerName) uniqueNames.add(key);
    }
  }

  return uniqueNames.size;
}

/** Name keys for one show (for lifetime union across gigs). */
export function collectUniqueGuestNameKeysForGig(
  headlinerArtistId: string,
  songs: GigSongGuestInput[],
  featuringArtistIds: string[] = [],
  artistNameById: Map<string, string> = new Map(),
): Set<string> {
  const head = headlinerArtistId.trim();
  const headlinerName = normName(artistNameById.get(head) ?? "");
  const uniqueNames = new Set<string>();

  const addId = (artistId: string) => {
    const id = artistId.trim();
    if (!id || id === head) return;
    const name = artistNameById.get(id)?.trim();
    if (name) {
      const key = normName(name);
      if (key && key !== headlinerName) uniqueNames.add(key);
      return;
    }
    uniqueNames.add(`__id:${id}`);
  };

  for (const aid of featuringArtistIds) addId(aid);
  for (const s of songs) {
    if (s.guestArtistId) addId(s.guestArtistId);
  }
  for (const s of songs) {
    for (const name of parseFeaturingNamesList(s.featuringNames)) {
      const key = normName(name);
      if (key && key !== headlinerName) uniqueNames.add(key);
    }
  }
  return uniqueNames;
}

export function buildGuestArtistIdsByGig(
  songs: { id: string; gig_id: string; guest_artist_id: string | null }[],
  featLinks: { gig_song_id: string; artist_id: string }[],
): Map<string, Set<string>> {
  const songToGig = new Map<string, string>();
  for (const s of songs) songToGig.set(s.id, s.gig_id);

  const byGig = new Map<string, Set<string>>();

  const add = (gigId: string, artistId: string) => {
    const gid = gigId.trim();
    const aid = artistId.trim();
    if (!gid || !aid) return;
    if (!byGig.has(gid)) byGig.set(gid, new Set());
    byGig.get(gid)!.add(aid);
  };

  for (const s of songs) {
    if (s.guest_artist_id) add(s.gig_id, s.guest_artist_id);
  }
  for (const fl of featLinks) {
    const gid = songToGig.get(fl.gig_song_id);
    if (gid) add(gid, fl.artist_id);
  }

  return byGig;
}

export function guestCountForGig(
  gigId: string,
  headlinerArtistId: string,
  guestByGig: Map<string, Set<string>>,
  songsByGig: Map<string, GigSongGuestInput[]>,
  artistNameById: Map<string, string> = new Map(),
): number {
  const head = headlinerArtistId.trim();
  const ids = Array.from(guestByGig.get(gigId) ?? []).filter((id) => id !== head);
  const songs = songsByGig.get(gigId) ?? [];
  return countUniqueGuestsForGig(head, songs, ids, artistNameById);
}
