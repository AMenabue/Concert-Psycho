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
  if (!url || !anonKey || !url.startsWith("https://")) return null;
  return { url, anonKey };
}

function redirectWithSessionCookies(
  request: NextRequest,
  pathname: string,
  sessionResponse: NextResponse,
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const redirect = NextResponse.redirect(url);
  for (const { name, value } of sessionResponse.cookies.getAll()) {
    redirect.cookies.set(name, value);
  }
  return redirect;
}

async function handleAuth(request: NextRequest): Promise<NextResponse> {
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

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          try {
            if (options && Object.keys(options).length > 0) {
              response.cookies.set({ name, value, ...options });
            } else {
              response.cookies.set(name, value);
            }
          } catch {
            response.cookies.set(name, value);
          }
        }
      },
    },
  });

  // getSession: cookie-based + refresh; safer on Edge than extra getUser round-trips
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;

  if (isProtectedPath(path) && !user) {
    return NextResponse.redirect(
      new URL("/login", request.nextUrl.origin),
    );
  }

  if (user && path.startsWith("/login")) {
    return redirectWithSessionCookies(request, "/", response);
  }

  return response;
}

export async function middleware(request: NextRequest) {
  try {
    return await handleAuth(request);
  } catch {
    // Never crash the Edge worker — fail open so the site loads
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/webpack-hmr|api/|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot)$).*)",
  ],
};
