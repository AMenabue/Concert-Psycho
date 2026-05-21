"use server";

import { getFullStatistics, type FullStatistics } from "./data";

/** A single random-card view: a hero number/value, "what" label, and small context line. */
export type HomeCardTemplate = {
  id: string;
  /** Hero (top): number + optional small unit baked in (€, h, %, …). */
  hero: string;
  /** Main label below the hero. */
  primary: string;
  /** Smaller muted line below the label. */
  context: string | null;
};

function formatInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function formatHm(minutes: number): string {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}m`;
}

const DOW_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/* ------------------------------------------------------------------ */
/* Template builders                                                   */
/* ------------------------------------------------------------------ */

function buildTemplatesFrom(stats: FullStatistics): HomeCardTemplate[] {
  if (!stats.hasData) return [];
  const out: HomeCardTemplate[] = [];

  // 1. Most heard song
  const topSong = stats.songs.topByPlays[0];
  if (topSong && topSong.value >= 2) {
    out.push({
      id: "most-heard-song",
      hero: formatInt(topSong.value),
      primary: `times you've heard "${topSong.name}"`,
      context: "across all your concerts",
    });
  }

  // 2. Most appearances (incl. guests)
  const topPresence = stats.artists.topByPresence[0];
  const topHead = stats.artists.topByHeadliner[0];
  if (topPresence && topHead && topPresence.value > topHead.value) {
    out.push({
      id: "presence-vs-headliner",
      hero: formatInt(topPresence.value),
      primary: `appearances by ${topPresence.name}`,
      context: `${topHead.value} as headliner, ${topPresence.value - topHead.value} as guest or in line-ups`,
    });
  }

  // 3. Furthest concert
  if (stats.travel.longestTrip) {
    const t = stats.travel.longestTrip;
    out.push({
      id: "longest-trip",
      hero: formatInt(t.km),
      primary: `km traveled to see ${t.ref.artistName}`,
      context: [t.ref.venueName, t.ref.city].filter(Boolean).join(" · ") || null,
    });
  }

  // 4. Longest followed artist
  if (stats.artists.longestFollowed) {
    const lf = stats.artists.longestFollowed;
    out.push({
      id: "longest-followed",
      hero: `${lf.years}y`,
      primary: `following ${lf.name}`,
      context: `since ${lf.firstYear}`,
    });
  }

  // 5. Most expensive ticket
  if (stats.finance.mostExpensive) {
    const m = stats.finance.mostExpensive;
    out.push({
      id: "most-expensive",
      hero: `€${formatInt(m.eur)}`,
      primary: "your most expensive ticket",
      context: `${m.ref.artistName} · ${m.ref.venueName || m.ref.city}`,
    });
  }

  // 6. Cheapest per minute (€/min)
  if (stats.finance.cheapestPerMin) {
    const c = stats.finance.cheapestPerMin;
    out.push({
      id: "cheapest-per-min",
      hero: `€${c.eurPerMin.toFixed(2)}`,
      primary: "per minute of music",
      context: `${c.ref.artistName} — your cheapest €/min concert`,
    });
  }

  // 7. Best weekday share (≥10 concerts)
  if (stats.concerts.total >= 10) {
    let bestDow = -1;
    let bestVal = 0;
    for (const d of stats.concerts.perDayOfWeek) {
      if (d.count > bestVal) {
        bestVal = d.count;
        bestDow = d.dow;
      }
    }
    if (bestDow >= 0) {
      const pct = Math.round((bestVal / stats.concerts.total) * 100);
      out.push({
        id: "best-weekday",
        hero: `${pct}%`,
        primary: `of your concerts happen on ${DOW_LABELS[bestDow]}`,
        context: "more than any other day",
      });
    }
  }

  // 8. Song heard at most venues
  const tv = stats.songs.topByDistinctVenues[0];
  if (tv && tv.value >= 3) {
    out.push({
      id: "song-venues",
      hero: formatInt(tv.value),
      primary: `venues where you heard "${tv.name}"`,
      context: tv.detail ?? null,
    });
  }

  // 9. Song heard in most cities
  const tc = stats.songs.topByDistinctCities[0];
  if (tc && tc.value >= 3) {
    out.push({
      id: "song-cities",
      hero: formatInt(tc.value),
      primary: `cities where you heard "${tc.name}"`,
      context: tc.detail ?? null,
    });
  }

  // 10. Hours listening to top artist live
  const tm = stats.artists.topByMusicMinutes[0];
  if (tm && tm.value >= 60) {
    out.push({
      id: "hours-per-artist",
      hero: formatHm(tm.value),
      primary: `listening to ${tm.name} live`,
      context: "across all their shows you attended",
    });
  }

  // 12. Longest show
  if (stats.concerts.longestShow) {
    const ls = stats.concerts.longestShow;
    out.push({
      id: "longest-show",
      hero: formatHm(ls.minutes),
      primary: "your longest show ever",
      context: `${ls.ref.artistName} · ${ls.ref.venueName || ls.ref.city}`,
    });
  }

  // 15. Total spent on top artist
  const tspend = stats.artists.topBySpend[0];
  if (tspend && tspend.value > 0) {
    out.push({
      id: "spend-per-artist",
      hero: `€${formatInt(tspend.value)}`,
      primary: `spent on ${tspend.name} tickets`,
      context: "lifetime",
    });
  }

  // Bonus: total km traveled
  if (stats.travel.totalKm > 100) {
    out.push({
      id: "total-km",
      hero: formatInt(stats.travel.totalKm),
      primary: "km traveled for concerts",
      context: `${stats.travel.countriesReached} countries reached`,
    });
  }

  // Bonus: total spent
  if (stats.finance.totalSpentEur > 0) {
    out.push({
      id: "total-spent",
      hero: `€${formatInt(stats.finance.totalSpentEur)}`,
      primary: "spent on tickets",
      context: "lifetime, EUR tickets only",
    });
  }

  // Bonus: total unique songs
  if (stats.songs.totalUniqueTitles > 0) {
    out.push({
      id: "unique-songs",
      hero: formatInt(stats.songs.totalUniqueTitles),
      primary: "unique songs heard live",
      context: `${formatInt(stats.songs.totalSongRows)} total song rows in your setlists`,
    });
  }

  // Guests at a specific show (rotate through concerts with guests)
  for (const g of stats.concerts.guestHighlightsByShow.slice(0, 12)) {
    const venue = g.ref.venueName || g.ref.city;
    out.push({
      id: `guests-at-show-${g.ref.gigId}`,
      hero: formatInt(g.count),
      primary: `guests seen live at ${g.ref.artistName}`,
      context: venue ? `in ${venue}` : null,
    });
  }

  if (stats.concerts.totalUniqueGuests > 0) {
    out.push({
      id: "total-unique-guests",
      hero: formatInt(stats.concerts.totalUniqueGuests),
      primary: "unique guests heard live",
      context: "across all your concerts",
    });
  }

  // Bonus: most active month
  if (stats.concerts.mostActiveMonth && stats.concerts.total >= 6) {
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    out.push({
      id: "most-active-month",
      hero: formatInt(stats.concerts.mostActiveMonth.count),
      primary: `concerts in ${months[stats.concerts.mostActiveMonth.month]}`,
      context: "your most active month",
    });
  }

  return out;
}

/** Build the random-card template pool for the authenticated user. */
export async function listHomeCardTemplates(): Promise<HomeCardTemplate[]> {
  const stats = await getFullStatistics();
  return buildTemplatesFrom(stats);
}
