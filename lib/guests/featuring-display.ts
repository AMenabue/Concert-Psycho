import { parseFeaturingNamesList } from "@/lib/setlistfm/parse";

function normKey(s: string): string {
  return s.trim().toLowerCase();
}

/** Merge link table, `featuring_names`, and legacy `guest_artist_id` for setlist UI. */
export function mergeFeaturingNamesForDisplay(
  fromLinks: string[],
  featuringNames: string | null | undefined,
  fallbackGuestName: string | null | undefined,
): string | null {
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (name: string) => {
    const t = name.trim();
    if (!t) return;
    const k = normKey(t);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };

  for (const n of fromLinks) push(n);
  for (const n of parseFeaturingNamesList(featuringNames)) push(n);
  const fb = fallbackGuestName?.trim();
  if (fb) push(fb);

  return out.length > 0 ? out.join(", ") : null;
}
