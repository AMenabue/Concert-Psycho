import { splitBillingArtistNames } from "@/lib/setlistfm/parse";

/** Setlist.fm joint billing in the main artist field (not "AC/DC"). */
export function isCombinedBillingArtistName(name: string | null | undefined): boolean {
  const raw = String(name ?? "").trim();
  if (!raw) return false;
  if (/\s\/\s/.test(raw)) return true;
  if (/\s&\s/.test(raw)) return true;
  return false;
}

export function parseBillingHeadlinerNames(
  setlistArtistName: string | null | undefined,
): string[] {
  return splitBillingArtistNames(String(setlistArtistName ?? ""));
}

export type BillingHeadlinerPlan = {
  names: string[];
  primaryName: string;
  coHeadlinerNames: string[];
  displayName: string;
  isSplit: boolean;
};

export function planBillingHeadliners(
  setlistArtistName: string | null | undefined,
): BillingHeadlinerPlan | null {
  const displayName = String(setlistArtistName ?? "").trim();
  if (!displayName) return null;
  const names = parseBillingHeadlinerNames(displayName);
  if (names.length === 0) return null;
  if (names.length === 1) {
    return {
      names,
      primaryName: names[0]!,
      coHeadlinerNames: [],
      displayName,
      isSplit: false,
    };
  }
  return {
    names,
    primaryName: names[0]!,
    coHeadlinerNames: names.slice(1),
    displayName,
    isSplit: true,
  };
}

function dedupeNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const t = n.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/** Infer billing names from headliner + line-up (legacy imports). */
export function resolveBillingNamesForGig(
  headlinerName: string,
  lineupArtistNames: string[],
  gigSource: string | null,
  ampersandArtists: { name: string }[] = [],
): string[] {
  const fromHeadliner = parseBillingHeadlinerNames(headlinerName);
  if (fromHeadliner.length > 1) return fromHeadliner;

  for (const ln of lineupArtistNames) {
    const fromLineup = parseBillingHeadlinerNames(ln);
    if (fromLineup.length > 1) return fromLineup;
  }

  if (lineupArtistNames.length > 0) {
    const headKey = headlinerName.trim().toLowerCase();
    const others = lineupArtistNames.filter((n) => n.trim().toLowerCase() !== headKey);
    if (others.length > 0 && others.length <= 4) {
      return dedupeNames([headlinerName, ...others]);
    }
  }

  const headKey = headlinerName.trim().toLowerCase();
  if (headKey) {
    for (const row of ampersandArtists) {
      const parsed = parseBillingHeadlinerNames(row.name);
      if (parsed.length > 1 && parsed.some((p) => p.trim().toLowerCase() === headKey)) {
        return parsed;
      }
    }
  }

  return fromHeadliner;
}

export type LineupRowInput = {
  artist_id: string;
  is_co_headliner?: boolean;
};

export type GigBillingRoles = {
  billingNames: string[];
  primaryArtistId: string;
  coHeadlinerArtistIds: string[];
  supportLineupArtistIds: string[];
};

function resolveNameToArtistIdOnGig(
  name: string,
  headlinerArtistId: string,
  headlinerName: string,
  lineup: LineupRowInput[],
  artistNameById: Map<string, string>,
): string | null {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  if (headlinerName.trim().toLowerCase() === key) return headlinerArtistId;
  for (const row of lineup) {
    const n = artistNameById.get(row.artist_id)?.trim().toLowerCase();
    if (n === key) return row.artist_id;
  }
  for (const [id, n] of Array.from(artistNameById.entries())) {
    if (n.trim().toLowerCase() === key) return id;
  }
  return null;
}

/** Classify line-up rows as co-headliner (shared billing) vs support opener. */
export function resolveGigBillingRoles(
  headlinerArtistId: string,
  headlinerName: string,
  lineup: LineupRowInput[],
  artistNameById: Map<string, string>,
  gigSource: string | null,
  ampersandArtists: { name: string }[] = [],
): GigBillingRoles {
  const lineupNames = lineup
    .map((row) => artistNameById.get(row.artist_id)?.trim() ?? "")
    .filter(Boolean);

  const billingNames = resolveBillingNamesForGig(
    headlinerName,
    lineupNames,
    gigSource,
    ampersandArtists,
  );

  if (billingNames.length <= 1) {
    const coFromFlag = lineup
      .filter((row) => row.is_co_headliner && row.artist_id !== headlinerArtistId)
      .map((row) => row.artist_id);
    const coSet = new Set(coFromFlag);
    const supportLineupArtistIds = lineup
      .filter((row) => row.artist_id !== headlinerArtistId && !coSet.has(row.artist_id))
      .map((row) => row.artist_id);
    return {
      billingNames: billingNames.length ? billingNames : [headlinerName],
      primaryArtistId: headlinerArtistId,
      coHeadlinerArtistIds: Array.from(coSet),
      supportLineupArtistIds,
    };
  }

  const resolvedIds: string[] = [];
  for (const name of billingNames) {
    const id = resolveNameToArtistIdOnGig(
      name,
      headlinerArtistId,
      headlinerName,
      lineup,
      artistNameById,
    );
    if (id) resolvedIds.push(id);
  }

  const uniqueResolved = Array.from(new Set(resolvedIds));
  const billingIdSet = new Set(uniqueResolved);

  // Prefer the gig's stored headliner when it is a real single artist (e.g. Setlist.fm "Mostro").
  let primaryArtistId = headlinerArtistId;
  if (isCombinedBillingArtistName(headlinerName) || !billingIdSet.has(headlinerArtistId)) {
    const headKey = headlinerName.trim().toLowerCase();
    primaryArtistId =
      uniqueResolved.find((id) => id === headlinerArtistId) ??
      uniqueResolved.find(
        (id) => artistNameById.get(id)?.trim().toLowerCase() === headKey,
      ) ??
      uniqueResolved[0] ??
      headlinerArtistId;
  }

  if (
    !isCombinedBillingArtistName(headlinerName) &&
    headlinerArtistId &&
    !billingIdSet.has(headlinerArtistId)
  ) {
    billingIdSet.add(headlinerArtistId);
  }

  const coHeadlinerArtistIds = Array.from(billingIdSet).filter(
    (id) => id !== primaryArtistId,
  );
  const supportLineupArtistIds = lineup
    .filter((row) => !billingIdSet.has(row.artist_id))
    .map((row) => row.artist_id);

  return {
    billingNames,
    primaryArtistId,
    coHeadlinerArtistIds,
    supportLineupArtistIds,
  };
}

export function isPseudoCombinedArtistId(
  artistId: string,
  artistNameById: Map<string, string>,
): boolean {
  return isCombinedBillingArtistName(artistNameById.get(artistId) ?? "");
}

/** Label for UI cards (stats, highlights): "Mostro" or "Lowlow & Mostro". */
export function formatGigHeadlinerDisplay(
  roles: GigBillingRoles,
  artistNameById: Map<string, string>,
  gigHeadlinerArtistId: string,
): string {
  const headIds = new Set([roles.primaryArtistId, ...roles.coHeadlinerArtistIds]);
  if (
    gigHeadlinerArtistId &&
    !isCombinedBillingArtistName(artistNameById.get(gigHeadlinerArtistId) ?? "")
  ) {
    headIds.add(gigHeadlinerArtistId);
  }

  const names: string[] = [];
  for (const id of Array.from(headIds)) {
    const n = artistNameById.get(id)?.trim();
    if (!n || isCombinedBillingArtistName(n)) continue;
    if (!names.some((x) => x.toLowerCase() === n.toLowerCase())) names.push(n);
  }

  if (names.length <= 1) {
    return names[0] ?? artistNameById.get(gigHeadlinerArtistId)?.trim() ?? "Artist";
  }

  names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return names.join(" & ");
}
