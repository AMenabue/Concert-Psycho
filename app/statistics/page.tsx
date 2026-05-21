import { AppSubpageHeader } from "@/components/app-subpage-header";
import { APP_SUBPAGE_BODY_CLASS, APP_SUBPAGE_MAIN_CLASS } from "@/lib/app-subpage-layout";
import { getFullStatistics } from "./data";
import { ArtistsPanel } from "./panels/artists-panel";
import { ConcertsPanel } from "./panels/concerts-panel";
import { FinancePanel } from "./panels/finance-panel";
import { SongsPanel } from "./panels/songs-panel";
import { TravelPanel } from "./panels/travel-panel";
import { VenuesPanel } from "./panels/venues-panel";
import { StatisticsClient } from "./statistics-client";

export const dynamic = "force-dynamic";

export default async function StatisticsPage() {
  const stats = await getFullStatistics();

  const panels = [
    { id: "concerts" as const, label: "Concerts", node: <ConcertsPanel data={stats.concerts} /> },
    { id: "artists" as const, label: "Artists", node: <ArtistsPanel data={stats.artists} /> },
    { id: "songs" as const, label: "Songs", node: <SongsPanel data={stats.songs} /> },
    { id: "venues" as const, label: "Venues", node: <VenuesPanel data={stats.venues} /> },
    { id: "travel" as const, label: "Travel", node: <TravelPanel data={stats.travel} /> },
    { id: "finance" as const, label: "Finance", node: <FinancePanel data={stats.finance} /> },
  ];

  return (
    <main className={APP_SUBPAGE_MAIN_CLASS}>
      <AppSubpageHeader title="Statistics" backHref="/" backLabel="Back to home" />
      <div className={APP_SUBPAGE_BODY_CLASS}>
        <StatisticsClient panels={panels} hasData={stats.hasData} />
      </div>
    </main>
  );
}
