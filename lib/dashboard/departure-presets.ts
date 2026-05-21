import type { DeparturePreset } from "@/app/(protected)/concerts/[id]/actions";
import { createClient } from "@/lib/supabase/server";

export async function getDeparturePresetsForUser(): Promise<DeparturePreset[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: hlRows } = await supabase
    .from("home_locations")
    .select("id,label,city,country,is_default,created_at")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("label", { ascending: true });

  const departurePresets: DeparturePreset[] = [];
  const seen = new Set<string>();

  for (const row of hlRows ?? []) {
    const r = row as {
      id?: string;
      label?: string | null;
      city?: string | null;
      country?: string | null;
      is_default?: boolean | null;
    };
    const id = String(r.id ?? "").trim();
    const city = String(r.city ?? "").trim();
    const country = String(r.country ?? "").trim();
    if (!id || !city || !country) continue;
    const k = `${city.toLowerCase()}|${country.toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const lab = String(r.label ?? "").trim();
    departurePresets.push({
      id,
      label: lab || `${city}, ${country}`,
      city,
      country,
      isDefault: Boolean(r.is_default),
    });
  }

  return departurePresets;
}
