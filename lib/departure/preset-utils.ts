import type { DeparturePreset } from "@/app/(protected)/concerts/[id]/actions";

export const DEPARTURE_OTHER_ID = "__other__";

export function defaultDeparturePreset(
  presets: DeparturePreset[],
): DeparturePreset | undefined {
  return presets.find((p) => p.isDefault) ?? presets[0];
}

export function defaultDeparturePresetId(presets: DeparturePreset[]): string {
  const d = defaultDeparturePreset(presets);
  if (d) return d.id;
  return DEPARTURE_OTHER_ID;
}

function normLoc(s: string): string {
  return s.trim().toLowerCase();
}

/** Match saved departure city/country to a saved preset, if any. */
export function departurePresetIdForAttendance(
  presets: DeparturePreset[],
  city: string | null | undefined,
  country: string | null | undefined,
): string {
  const c = String(city ?? "").trim();
  const co = String(country ?? "").trim();
  if (!c || !co) return "";
  const hit = presets.find(
    (p) => normLoc(p.city) === normLoc(c) && normLoc(p.country) === normLoc(co),
  );
  return hit?.id ?? DEPARTURE_OTHER_ID;
}

export function hasSavedDeparture(
  city: string | null | undefined,
  country: string | null | undefined,
): boolean {
  return Boolean(String(city ?? "").trim() && String(country ?? "").trim());
}
