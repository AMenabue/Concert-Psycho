import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge-safe only — no @supabase/ssr (crashes Vercel Edge on import).
 * Auth + session refresh: lib/auth/session-guard.ts in root layout (Node).
 */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = path.slice("/dashboard".length) || "/";
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  response.headers.set("x-pathname", path);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/webpack-hmr|api/|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot)$).*)",
  ],
};
