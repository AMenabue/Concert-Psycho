"use client";

import type { DashboardConcertRow } from "@/lib/concerts/list-actions";
import { HorizontalPillNav } from "@/components/horizontal-pill-nav";
import { HorizontalSwipePager } from "@/components/horizontal-swipe-pager";
import { HIDE_SCROLLBAR_CLASS } from "@/lib/app-subpage-layout";
import { formatConcertDateWithWeekday } from "@/lib/format-concert-date";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function yearFromConcert(iso: string): number {
  const d = new Date(iso + (iso.length <= 10 ? "T12:00:00" : ""));
  if (Number.isNaN(d.getTime())) return new Date().getFullYear();
  return d.getFullYear();
}

type YearFilterId = "all" | `${number}`;

function ConcertCardsList(props: {
  items: DashboardConcertRow[];
  detailHref: (id: string) => string;
}) {
  const { items, detailHref } = props;
  return (
    <ul className="flex w-full flex-col gap-[10px] pb-8 pt-1">
      {items.length === 0 ? (
        <li>
          <p className="text-sm text-neutral-500">No concerts for this selection.</p>
        </li>
      ) : (
        items.map((c) => (
          <li key={c.id}>
            <Link
              href={detailHref(c.id)}
              className="relative block min-h-[120px] w-full overflow-hidden rounded-[16px] px-5 pb-4 pt-5 shadow-sm ring-1 ring-black/5 transition hover:opacity-95"
              style={{
                backgroundImage:
                  "linear-gradient(238.93deg, rgb(206, 223, 240) 4.67%, rgb(195, 199, 248) 68.8%)",
              }}
            >
              <p
                className="text-[34px] font-normal leading-tight tracking-tight text-[#003c63]"
                style={{ fontFamily: "var(--font-flighty-chivo), ui-monospace, monospace" }}
              >
                {c.artist_name}
              </p>
              <p className="mt-1 text-[16px] text-[rgba(25,78,118,0.58)]">{c.venue_label}</p>
              <p className="mt-1 text-[15px] text-[#003c63]/85">
                {formatConcertDateWithWeekday(c.concert_date)}
              </p>
              {c.tour_name ? (
                <p className="mt-2 max-w-[95%] truncate text-[13px] text-[rgba(25,78,118,0.55)]">
                  {c.tour_name}
                </p>
              ) : null}
            </Link>
          </li>
        ))
      )}
    </ul>
  );
}

export function ConcertsListClient(props: {
  concerts: DashboardConcertRow[];
  concertBasePath?: string;
}) {
  const { concerts, concertBasePath = "/concerts" } = props;
  const [index, setIndex] = useState(0);

  const yearOptions = useMemo(() => {
    const ys = new Set<number>();
    for (const c of concerts) ys.add(yearFromConcert(c.concert_date));
    return Array.from(ys).sort((a, b) => b - a);
  }, [concerts]);

  const pillOptions = useMemo(
    () => [
      { id: "all" as YearFilterId, label: "All-Time" },
      ...yearOptions.map((y) => ({ id: String(y) as YearFilterId, label: String(y) })),
    ],
    [yearOptions],
  );

  useEffect(() => {
    if (index >= pillOptions.length) setIndex(0);
  }, [index, pillOptions.length]);

  const pillValue: YearFilterId = pillOptions[index]?.id ?? "all";
  const detailHref = (id: string) => `${concertBasePath.replace(/\/$/, "")}/${id}`;

  const panels = useMemo(
    () =>
      pillOptions.map((opt) => {
        const items =
          opt.id === "all"
            ? concerts
            : concerts.filter(
                (c) => yearFromConcert(c.concert_date) === Number.parseInt(opt.id, 10),
              );
        return (
          <div key={opt.id} className="px-[19px]">
            <ConcertCardsList items={items} detailHref={detailHref} />
          </div>
        );
      }),
    [pillOptions, concerts, concertBasePath],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[23px] self-stretch">
      {/* Pill nav — padded to match card gutters */}
      <div className="px-[19px]">
        <HorizontalPillNav
          options={pillOptions}
          value={pillValue}
          onChange={(id) => {
            const i = pillOptions.findIndex((p) => p.id === id);
            if (i >= 0) setIndex(i);
          }}
          ariaLabel="Concert years"
        />
      </div>

      {/* Full-width swiper — includes gutters so pages slide naturally */}
      <HorizontalSwipePager
        activeIndex={index}
        onIndexChange={setIndex}
        panelCount={pillOptions.length}
        className={HIDE_SCROLLBAR_CLASS}
      >
        {panels}
      </HorizontalSwipePager>
    </div>
  );
}
