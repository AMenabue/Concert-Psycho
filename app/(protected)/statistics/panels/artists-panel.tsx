"use client";

import { useMemo, useState } from "react";
import type { ArtistLoyaltyRow, ArtistsStats } from "../data";
import { ReachChampions } from "@/components/stats/reach-champions";
import { SetlistGuestsSection } from "./setlist-guests-section";
import {
  BarChart,
  ChipList,
  HeroNumberCard,
  SectionTitle,
  SpotlightCard,
  StatCard,
  StatTile,
  formatNumber,
} from "@/components/stats/stat-primitives";

function loyaltyScore(row: ArtistLoyaltyRow, onlyHeadliner: boolean): number {
  return onlyHeadliner ? row.asHeadliner : row.asHeadliner + row.asLineup + row.asGuest;
}

function loyaltyDetail(row: ArtistLoyaltyRow): string | null {
  const parts: string[] = [];
  if (row.asHeadliner > 0) parts.push(`${row.asHeadliner} headliner`);
  if (row.asGuest > 0) parts.push(`${row.asGuest} guest`);
  if (row.asLineup > 0) parts.push(`${row.asLineup} line-up`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function ArtistsPanel({ data }: { data: ArtistsStats }) {
  const [onlyHeadliner, setOnlyHeadliner] = useState(false);

  const rankedLoyalty = useMemo(() => {
    return [...data.loyaltyRows]
      .map((row) => ({
        row,
        value: loyaltyScore(row, onlyHeadliner),
        detail: loyaltyDetail(row),
      }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value || a.row.name.localeCompare(b.row.name))
      .slice(0, 8);
  }, [data.loyaltyRows, onlyHeadliner]);

  if (data.totalUnique === 0) {
    return (
      <div className="px-1 py-4">
        <p className="text-sm text-neutral-500">No artists tracked yet.</p>
      </div>
    );
  }

  const topArtist = data.topByHeadliner[0];

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="grid grid-cols-2 gap-2.5">
        <HeroNumberCard
          value={formatNumber(data.totalUnique)}
          label="Artists seen live"
          sublabel="incl. guests & openers"
          accent="blue"
        />
        {topArtist ? (
          <SpotlightCard
            eyebrow="Most seen"
            title={topArtist.name}
            value={`${topArtist.value} ${topArtist.value === 1 ? "show" : "shows"}`}
            context="as headliner"
          />
        ) : (
          <StatTile value="—" label="Most seen artist" />
        )}
      </div>

      {data.longestFollowed ? (
        <SpotlightCard
          eyebrow="Longest followed"
          title={data.longestFollowed.name}
          value={`${data.longestFollowed.years} year${data.longestFollowed.years === 1 ? "" : "s"}`}
          context={`${data.longestFollowed.firstYear} → ${data.longestFollowed.lastYear}`}
        />
      ) : null}

      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionTitle eyebrow="Loyalty">Most appearances</SectionTitle>
          <label className="mb-3 flex shrink-0 cursor-pointer items-center gap-2 text-[12px] text-neutral-400">
            <span>Only as headliner</span>
            <button
              type="button"
              role="switch"
              aria-checked={onlyHeadliner}
              onClick={() => setOnlyHeadliner((v) => !v)}
              className={`relative h-[22px] w-[40px] rounded-full transition ${
                onlyHeadliner ? "bg-[#7aa2ff]" : "bg-neutral-700"
              }`}
            >
              <span
                className={`absolute top-[2px] size-[18px] rounded-full bg-white transition ${
                  onlyHeadliner ? "left-[20px]" : "left-[2px]"
                }`}
              />
            </button>
          </label>
        </div>
        <p className="mb-2 px-1 text-[12px] text-neutral-500">
          {onlyHeadliner
            ? "Headliner shows only, guest and line-up appearances hidden."
            : "Headliner, guest, and line-up appearances combined."}
        </p>
        <StatCard padded={false}>
          <div className="p-3">
            {rankedLoyalty.length === 0 ? (
              <p className="text-sm text-neutral-500">—</p>
            ) : (
              <ul className="space-y-2">
                {rankedLoyalty.map(({ row, value, detail }, i) => {
                  const top = rankedLoyalty[0]?.value ?? 1;
                  const pct = Math.max(8, Math.round((value / top) * 100));
                  return (
                    <li key={`${row.name}-${i}`} className="relative">
                      <div className="relative flex items-center justify-between gap-3 rounded-[10px] bg-white/[0.03] px-3 py-2">
                        <div
                          className="absolute left-0 top-0 h-full rounded-[10px]"
                          style={{
                            width: `${pct}%`,
                            background: "rgba(255, 209, 102, 0.13)",
                          }}
                        />
                        <div className="relative flex min-w-0 flex-1 items-baseline gap-x-3 overflow-hidden">
                          <span className="truncate text-[14px] font-medium leading-[20px] text-white">
                            {row.name}
                          </span>
                          {detail && !onlyHeadliner ? (
                            <span className="shrink-0 whitespace-nowrap text-[14px] font-normal leading-[20px] text-neutral-500">
                              {detail}
                            </span>
                          ) : null}
                        </div>
                        <span
                          className="relative shrink-0 text-[14px] font-semibold tabular-nums"
                          style={{ color: "#ffd166" }}
                        >
                          {value}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </StatCard>
      </div>

      <ReachChampions
        topByCities={data.topByCities}
        topByCountries={data.topByCountries}
        topByVenues={data.topByVenues}
      />

      {data.artistsSeenOnce.length > 0 ? (
        <div>
          <SectionTitle eyebrow="One-offs">Artists seen only once</SectionTitle>
          <StatCard>
            <ChipList items={data.artistsSeenOnce} accent="pink" max={30} />
          </StatCard>
        </div>
      ) : null}

      {data.topByMusicMinutes.length > 0 ? (
        <div>
          <SectionTitle eyebrow="Time invested">Hours of music per artist</SectionTitle>
          <StatCard>
            <BarChart
              data={data.topByMusicMinutes.slice(0, 6).map((a) => ({
                label: a.name,
                value: a.value,
              }))}
              formatValue={(m) => {
                const h = Math.floor(m / 60);
                const r = m % 60;
                if (h === 0) return `${r}m`;
                if (r === 0) return `${h}h`;
                return `${h}h ${r}m`;
              }}
              accent="violet"
            />
          </StatCard>
        </div>
      ) : null}

      <SetlistGuestsSection
        data={{
          totalUniqueGuests: data.totalUniqueGuests,
          avgGuestsPerShow: data.avgGuestsPerShow,
          mostGuestsAtShow: data.mostGuestsAtShow,
        }}
      />
    </div>
  );
}

