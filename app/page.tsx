import {
  formatKmPassport,
  formatMusicHours,
  getDashboardPassportNumbers,
  getLatestConcertForDashboard,
  getHomeProfileHeader,
} from "@/lib/home-data";
import { getDashboardStatistics } from "@/lib/statistics/dashboard-stats";
import { listHomeCardTemplates } from "@/app/statistics/home-card-templates";
import type { FlightyAppHomePayload } from "@/app/prototype/flighty/app-home-payload";
import FlightyHomeClient from "@/app/prototype/flighty/home/flighty-home-client";
import { Chivo_Mono, Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-flighty-inter",
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

const chivoMono = Chivo_Mono({
  subsets: ["latin"],
  variable: "--font-flighty-chivo",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [stats, profile, passport, latest, cardTemplates] = await Promise.all([
    getDashboardStatistics(),
    getHomeProfileHeader(),
    getDashboardPassportNumbers(),
    getLatestConcertForDashboard(),
    listHomeCardTemplates(),
  ]);

  const points = stats?.mapsAndLineup.venueHeatPoints ?? [];

  const appHome: FlightyAppHomePayload = {
    displayName: profile.displayName,
    tagline: profile.tagline,
    avatarUrl: profile.avatarUrl,
    concertsCount: passport.concertsCount,
    kmTraveledFormatted: formatKmPassport(passport.kmTraveledSum),
    musicTimeHours: formatMusicHours(passport.musicTimeMinutesSum),
    artistsCount: passport.distinctArtistsCount,
    venuesCount: passport.distinctVenuesCount,
    uniqueSongsCount: passport.uniqueSongTitlesLive,
    cardTemplates,
    latest: latest
      ? {
          artistName: latest.artistName,
          venueCityLine: latest.venueCityLine,
          dateLabel: latest.dateLabel,
          tourName: latest.tourName,
        }
      : null,
  };

  return (
    <div
      className={`${inter.variable} ${chivoMono.variable} min-h-[100dvh] bg-[#0a0a0a] text-white antialiased`}
      style={{ fontFamily: "var(--font-flighty-inter), system-ui, sans-serif" }}
    >
      <div className="flex min-h-[100dvh] items-stretch justify-center bg-neutral-950">
        <FlightyHomeClient points={points} appHome={appHome} />
      </div>
    </div>
  );
}
