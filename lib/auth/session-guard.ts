import { createClient } from "@/lib/supabase/server";
import { isProtectedPath } from "@/lib/auth/route-policy";
import { redirect } from "next/navigation";

/**
 * Session refresh + route protection in Node (root layout).
 * Middleware stays Supabase-free so Vercel Edge does not crash.
 */
export async function refreshSessionAndGuard(pathname: string): Promise<void> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtectedPath(pathname) && !user) {
    redirect("/login");
  }

  if (user && pathname.startsWith("/login")) {
    redirect("/");
  }
}
