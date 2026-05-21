import type { TravelStats } from "../data";
import {
  BarChart,
  HeroNumberCard,
  RankedList,
  SectionTitle,
  SpotlightCard,
  StatCard,
  formatDate,
  formatNumber,
} from "@/components/stats/stat-primitives";

export function TravelPanel({ data }: { data: TravelStats }) {
  const hasData =
    data.totalKm > 0 ||
    data.longestTrip != null ||
    data.byDepartureCity.length > 0 ||
    data.kmByDepartureCity.length > 0 ||
    data.topByArtistKm.length > 0;

  if (!hasData) {
    return (
      <div className="px-1 py-4">
        <p className="text-sm text-neutral-500">
          No travel data yet — set a departure city on a concert to start tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      <HeroNumberCard
        value={formatNumber(data.totalKm)}
        unit="km"
        label="Total km traveled"
        sublabel="across all your concerts"
        accent="green"
      />

      {data.longestTrip ? (
        <SpotlightCard
          eyebrow="Furthest journey"
          title={data.longestTrip.ref.artistName}
          value={`${formatNumber(data.longestTrip.km)} km`}
          context={
            [
              data.longestTrip.ref.venueName,
              data.longestTrip.ref.city,
              formatDate(data.longestTrip.ref.date),
            ]
              .filter(Boolean)
              .join(" · ") || null
          }
        />
      ) : null}

      {data.furthestFromHome && data.furthestFromHome.km !== data.longestTrip?.km ? (
        <SpotlightCard
          eyebrow="Furthest from a home base"
          title={data.furthestFromHome.ref.artistName}
          value={`${formatNumber(data.furthestFromHome.km)} km from ${data.furthestFromHome.departure}`}
          context={
            [data.furthestFromHome.ref.venueName, data.furthestFromHome.ref.city]
              .filter(Boolean)
              .join(" · ") || null
          }
        />
      ) : null}

      {data.shortestTrip ? (
        <StatCard>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            Shortest trip
          </p>
          <p className="mt-1 text-[16px] font-semibold text-white">
            {data.shortestTrip.ref.artistName}
          </p>
          <p className="text-[13px] text-neutral-400">
            {formatNumber(data.shortestTrip.km)} km ·{" "}
            {data.shortestTrip.ref.venueName}
          </p>
        </StatCard>
      ) : null}

      {data.topByArtistKm.length > 0 ? (
        <div>
          <SectionTitle eyebrow="Devotion">Km traveled per artist</SectionTitle>
          <StatCard>
            <BarChart
              data={data.topByArtistKm.slice(0, 6).map((a) => ({
                label: a.name,
                value: a.value,
              }))}
              formatValue={(v) => `${v.toLocaleString("en-US")} km`}
              accent="orange"
            />
          </StatCard>
        </div>
      ) : null}

      {data.byDepartureCity.length > 0 ? (
        <div>
          <SectionTitle eyebrow="Departures">Concerts by departure city</SectionTitle>
          <StatCard padded={false}>
            <div className="p-3">
              <RankedList items={data.byDepartureCity} max={6} accent="blue" />
            </div>
          </StatCard>
        </div>
      ) : null}

      {data.kmByDepartureCity.length > 0 ? (
        <div>
          <SectionTitle eyebrow="Departures">Km traveled from each city</SectionTitle>
          <StatCard>
            <BarChart
              data={data.kmByDepartureCity.slice(0, 6).map((d) => ({
                label: d.name,
                value: d.value,
              }))}
              formatValue={(v) => `${v.toLocaleString("en-US")} km`}
              accent="violet"
            />
          </StatCard>
        </div>
      ) : null}
    </div>
  );
}
