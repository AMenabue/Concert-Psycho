"use server";

import {
  createHomeLocation,
  deleteHomeLocation,
  listHomeLocations,
  setDefaultHomeLocation,
  updateHomeLocation,
  updateProfileSetlistfmUserId,
  type HomeLocationRow,
} from "@/app/(protected)/concerts/new/actions";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type SettingsPageData = {
  email: string;
  displayName: string;
  avatarUrl: string | null;
  setlistfmUserId: string | null;
  homeLocations: HomeLocationRow[];
};

export async function getSettingsPageData(): Promise<SettingsPageData | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: prof }, homeLocations] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url, setlistfm_user_id")
      .eq("id", user.id)
      .maybeSingle(),
    listHomeLocations(),
  ]);

  const p = prof as {
    display_name?: string | null;
    avatar_url?: string | null;
    setlistfm_user_id?: string | null;
  } | null;

  const displayName =
    String(p?.display_name ?? "").trim() || user.email?.split("@")[0] || "You";

  return {
    email: user.email ?? "",
    displayName,
    avatarUrl: String(p?.avatar_url ?? "").trim() || null,
    setlistfmUserId: String(p?.setlistfm_user_id ?? "").trim() || null,
    homeLocations,
  };
}

export async function updateProfileSettings(payload: {
  displayName: string;
}): Promise<{ error: string } | { ok: true }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const displayName = payload.displayName.trim();
  if (!displayName) return { error: "Display name is required." };

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateProfileAvatarUrl(
  avatarUrl: string | null,
): Promise<{ error: string } | { ok: true }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const url = avatarUrl?.trim() || null;
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: url })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}

export {
  createHomeLocation,
  deleteHomeLocation,
  setDefaultHomeLocation,
  updateHomeLocation,
  updateProfileSetlistfmUserId,
};
