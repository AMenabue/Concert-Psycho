import type { VenuesStats } from "../data";
import {
  BarChart,
  HeroNumberCard,
  RankedList,
  SectionTitle,
  StatCard,
  StatTile,
  formatNumber,
} from "@/components/stats/stat-primitives";

export function VenuesPanel({ data }: { data: VenuesStats }) {
  if (data.totalUnique === 0) {
    return (
      <div className="px-1 py-4">
        <p className="text-sm text-neutral-500">No venues tracked yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="grid grid-cols-2 gap-2.5">
        <HeroNumberCard
          value={formatNumber(data.totalUnique)}
          label="Unique venues"
          accent="blue"
        />
        <StatTile
          value={formatNumber(data.visitedOnce)}
          label="Visited only once"
          hint="of all venues"
        />
        <StatTile
          value={formatNumber(data.totalCities)}
          label="Cities visited"
          hint="for concerts"
        />
        <StatTile
          value={formatNumber(data.totalCountries)}
          label="Countries visited"
          hint="for concerts"
        />
      </div>

      <div>
        <SectionTitle eyebrow="Loyalty">Most visited venues</SectionTitle>
        <StatCard padded={false}>
          <div className="p-3">
            <RankedList items={data.topByVisits} max={8} accent="yellow" />
          </div>
        </StatCard>
      </div>

      <div>
        <SectionTitle eyebrow="Diversity">Most different artists seen</SectionTitle>
        <StatCard>
          <BarChart
            data={data.topByDistinctArtists.slice(0, 6).map((v) => ({
              label: v.name,
              value: v.value,
            }))}
            formatValue={(v) => `${v} artist${v === 1 ? "" : "s"}`}
            accent="violet"
          />
        </StatCard>
      </div>

      <div>
        <SectionTitle eyebrow="Map">Top cities</SectionTitle>
        <StatCard padded={false}>
          <div className="p-3">
            <RankedList items={data.topCities} max={6} accent="green" />
          </div>
        </StatCard>
      </div>

      <div>
        <SectionTitle eyebrow="Map">Top countries</SectionTitle>
        <StatCard padded={false}>
          <div className="p-3">
            <RankedList items={data.topCountries} max={6} accent="orange" />
          </div>
        </StatCard>
      </div>
    </div>
  );
}
