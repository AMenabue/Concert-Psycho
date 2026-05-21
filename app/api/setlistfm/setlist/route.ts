import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE = "https://api.setlist.fm/rest/1.0";

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const apiKey = process.env.SETLISTFM_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "SETLISTFM_API_KEY non configurata sul server" },
        { status: 500 },
      );
    }

    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "Parametro id obbligatorio" }, { status: 400 });
    }

    const headers: HeadersInit = {
      Accept: "application/json",
      "x-api-key": apiKey,
    };

    const url = `${BASE}/setlist/${encodeURIComponent(id)}`;
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Setlist.fm setlist: ${res.status}` },
        { status: 502 },
      );
    }

    const setlist = await res.json();
    return NextResponse.json(setlist);
  } catch (e) {
    console.error("[setlistfm/setlist]", e);
    return NextResponse.json(
      { error: "Errore durante il caricamento della setlist" },
      { status: 500 },
    );
  }
}
