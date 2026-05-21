import type { RedCardTemplate } from "@/components/home/red-stat-card";

/** Dati serializzabili dalla home server → `FlightyHomeClient` / `FlightyFrame82`. */
export type FlightyAppHomePayload = {
  displayName: string;
  tagline: string;
  avatarUrl: string | null;
  concertsCount: number;
  kmTraveledFormatted: string;
  musicTimeHours: string;
  artistsCount: number;
  venuesCount: number;
  uniqueSongsCount: number;
  /** Pre-built random-card templates for the red home card. */
  cardTemplates: RedCardTemplate[];
  latest: {
    artistName: string;
    venueCityLine: string;
    dateLabel: string;
    tourName: string | null;
  } | null;
};
