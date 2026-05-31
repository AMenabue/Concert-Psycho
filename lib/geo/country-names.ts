/**
 * Map an ISO 3166-1 alpha-2 country code (e.g. "IT") to a full display name
 * (e.g. "Italy"). Falls back to the original string when it is not a 2-letter
 * code or cannot be resolved (so already-full names pass through unchanged).
 */

let regionNames: Intl.DisplayNames | null | undefined;

function getRegionNames(): Intl.DisplayNames | null {
  if (regionNames !== undefined) return regionNames;
  try {
    regionNames = new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    regionNames = null;
  }
  return regionNames;
}

const MANUAL_OVERRIDES: Record<string, string> = {
  UK: "United Kingdom",
  USA: "United States",
};

export function countryDisplayName(input: string | null | undefined): string {
  const raw = String(input ?? "").trim();
  if (!raw) return raw;

  const upper = raw.toUpperCase();
  if (MANUAL_OVERRIDES[upper]) return MANUAL_OVERRIDES[upper];

  // Only attempt code → name resolution for 2-letter codes.
  if (/^[A-Za-z]{2}$/.test(raw)) {
    const dn = getRegionNames();
    const resolved = dn?.of(upper);
    if (resolved && resolved !== upper) return resolved;
  }

  return raw;
}
