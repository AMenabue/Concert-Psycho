import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/concerts",
  "/settings",
  "/statistics",
  "/passport",
] as const;

function isProtectedPath(path: string): boolean {
  if (path === "/") return true;
  return PROTECTED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

function readSupabaseEnv(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/** Keep Set-Cookie from session refresh when returning a redirect. */
function forwardCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  return to;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = path.slice("/dashboard".length) || "/";
    return NextResponse.redirect(url);
  }

  const env = readSupabaseEnv();
  if (!env) {
    if (isProtectedPath(path)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(env.url, env.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (isProtectedPath(path) && !user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return forwardCookies(response, NextResponse.redirect(url));
    }

    if (user && path.startsWith("/login")) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return forwardCookies(response, NextResponse.redirect(url));
    }

    return response;
  } catch {
    if (isProtectedPath(path)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Session refresh + auth for app routes only.
     * Skip static assets, Next internals, and API routes.
     */
    "/((?!_next/static|_next/image|_next/webpack-hmr|api/|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot)$).*)",
  ],
};
