import type { SongsStats } from "../data";
import {
  HeroNumberCard,
  RankedList,
  SectionTitle,
  StatCard,
  StatTile,
  formatNumber,
} from "@/components/stats/stat-primitives";

export function SongsPanel({ data }: { data: SongsStats }) {
  if (data.totalUniqueTitles === 0) {
    return (
      <div className="px-1 py-4">
        <p className="text-sm text-neutral-500">No setlist songs logged yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      <HeroNumberCard
        value={formatNumber(data.totalUniqueTitles)}
        label="Unique songs heard live"
        sublabel={`${formatNumber(data.totalSongRows)} total song rows in your setlists`}
        accent="green"
      />

      <div className="grid grid-cols-3 gap-2">
        <StatTile
          value={formatNumber(data.songsHeardOnce)}
          label="Heard once"
          hint="rare gems"
        />
        <StatTile
          value={formatNumber(data.coverCount)}
          label="Covers"
          hint="across sets"
        />
        <StatTile
          value={formatNumber(data.guestCount)}
          label="With guest"
          hint="surprise moments"
        />
      </div>

      <div>
        <SectionTitle eyebrow="Repeat plays">Most heard songs</SectionTitle>
        <StatCard padded={false}>
          <div className="p-3">
            <RankedList items={data.topByPlays} max={8} accent="green" />
          </div>
        </StatCard>
      </div>

      <div>
        <SectionTitle eyebrow="Travelers">Heard in most different cities</SectionTitle>
        <StatCard padded={false}>
          <div className="p-3">
            <RankedList items={data.topByDistinctCities} max={6} accent="blue" />
          </div>
        </StatCard>
      </div>

      <div>
        <SectionTitle eyebrow="Travelers">Heard at most venues</SectionTitle>
        <StatCard padded={false}>
          <div className="p-3">
            <RankedList items={data.topByDistinctVenues} max={6} accent="yellow" />
          </div>
        </StatCard>
      </div>

      <div>
        <SectionTitle eyebrow="Set structure">Openers & closers</SectionTitle>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <StatCard padded={false}>
            <div className="p-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                Most common opener
              </p>
              <RankedList items={data.mostCommonOpener} max={4} accent="green" />
            </div>
          </StatCard>
          <StatCard padded={false}>
            <div className="p-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                Most common closer
              </p>
              <RankedList items={data.mostCommonCloser} max={4} accent="blue" />
            </div>
          </StatCard>
        </div>
      </div>

      <div>
        <SectionTitle eyebrow="Encores">Most common encore songs</SectionTitle>
        <StatCard padded={false}>
          <div className="p-3">
            <RankedList items={data.mostCommonEncore} max={6} accent="orange" />
          </div>
        </StatCard>
      </div>
    </div>
  );
}
