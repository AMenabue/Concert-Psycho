/** Passport aggregates shown on passport UIs — safe to import from Client Components (no server APIs). */
export type DashboardPassportNumbers = {
  concertsCount: number;
  kmTraveledSum: number;
  musicTimeMinutesSum: number;
  distinctArtistsCount: number;
  distinctVenuesCount: number;
  uniqueSongTitlesLive: number;
};

/** Live music duration from minutes, e.g. 1h 30m (home + passport). */
export function formatMusicHours(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return "0h 0m";
  const total = Math.round(totalMinutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${m}m`;
}

/** Comma-formatted km for passport UI (client-safe). */
export function formatKmPassport(km: number): string {
  if (!Number.isFinite(km)) return "0";
  return Math.round(km).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** Concert rows for passport stamp spread (pages 3–4 and beyond). */
export type PassportStampPreview = {
  attendanceId: string;
  gigId: string;
  artistName: string;
  venueLabel: string;
  artistId: string;
  venueId: string;
  dateLabel: string;
  /** ISO date string "YYYY-MM-DD" for chronological sorting in the component. */
  rawDate: string;
};

/** Client-safe slice of stats used by Frame 107 (avoid importing `"use server"` modules in client bundles). */
export type PassportStatsPublic = {
  generatedAtIso?: string;
  overview?: {
    firstConcertDate?: string | number | null;
  };
} | null;
