import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** Refresh session cookies on each request (Node server, not Edge). */
export async function refreshSession(): Promise<void> {
  if (!hasSupabaseEnv()) return;
  const supabase = createClient();
  await supabase.auth.getUser();
}

export async function requireAuth(): Promise<void> {
  if (!hasSupabaseEnv()) redirect("/login");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
}

export async function redirectIfAuthenticated(): Promise<void> {
  if (!hasSupabaseEnv()) return;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");
}
