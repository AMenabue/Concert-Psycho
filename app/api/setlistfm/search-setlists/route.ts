import { createClient } from "@/lib/supabase/server";
import { countSongsInSetlist, type SlSetlistFull } from "@/lib/setlistfm/parse";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE = "https://api.setlist.fm/rest/1.0";

function yyyymmddToDdMmYyyy(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

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

    const artistName = request.nextUrl.searchParams.get("artistName")?.trim();
    const date = request.nextUrl.searchParams.get("date")?.trim();
    if (!artistName || !date) {
      return NextResponse.json(
        { error: "Parametri artistName e date (YYYY-MM-DD) obbligatori" },
        { status: 400 },
      );
    }

    const ddMMyyyy = yyyymmddToDdMmYyyy(date);
    if (!ddMMyyyy) {
      return NextResponse.json(
        { error: "date deve essere nel formato YYYY-MM-DD" },
        { status: 400 },
      );
    }

    const headers: HeadersInit = {
      Accept: "application/json",
      "x-api-key": apiKey,
    };

    const artistUrl = `${BASE}/search/artists?artistName=${encodeURIComponent(artistName)}&sort=relevance`;
    const artistRes = await fetch(artistUrl, { headers, cache: "no-store" });
    if (!artistRes.ok) {
      return NextResponse.json(
        { error: `Setlist.fm artist search: ${artistRes.status}` },
        { status: 502 },
      );
    }

    const setlistUrl = `${BASE}/search/setlists?artistName=${encodeURIComponent(artistName)}&date=${encodeURIComponent(ddMMyyyy)}`;
    const setlistRes = await fetch(setlistUrl, { headers, cache: "no-store" });
    if (!setlistRes.ok) {
      return NextResponse.json(
        { error: `Setlist.fm setlist search: ${setlistRes.status}` },
        { status: 502 },
      );
    }

    const body = (await setlistRes.json()) as {
      setlist?: SlSetlistFull[];
      total?: number;
    };

    const rawList = body.setlist ?? [];
    const setlists = rawList.map((sl) => {
      const venue = sl.venue;
      const city = venue?.city;
      const country = city?.country;
      const coords = city?.coords;
      return {
        id: sl.id ?? "",
        eventDate: sl.eventDate ?? "",
        venueName: venue?.name ?? null,
        cityName: city?.name ?? null,
        countryName: country?.name ?? null,
        lat: typeof coords?.lat === "number" ? coords.lat : null,
        lng: typeof coords?.long === "number" ? coords.long : null,
        tourName: sl.tour?.name ?? null,
        totalSongs: countSongsInSetlist(sl),
        artistName: sl.artist?.name ?? artistName,
        artistMbid: sl.artist?.mbid ?? null,
      };
    });

    return NextResponse.json({ setlists, total: body.total ?? setlists.length });
  } catch (e) {
    console.error("[setlistfm/search-setlists]", e);
    return NextResponse.json(
      { error: "Errore durante la ricerca su Setlist.fm" },
      { status: 500 },
    );
  }
}
