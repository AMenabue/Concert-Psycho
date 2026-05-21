"use client";

import { HorizontalPillNav } from "@/components/horizontal-pill-nav";
import { HorizontalSwipePager } from "@/components/horizontal-swipe-pager";
import { HIDE_SCROLLBAR_CLASS } from "@/lib/app-subpage-layout";
import { useMemo, useState, type ReactNode } from "react";

type CategoryId = "concerts" | "artists" | "songs" | "venues" | "travel" | "finance";

type Panel = {
  id: CategoryId;
  label: string;
  node: ReactNode;
};

type Props = {
  panels: Panel[];
  hasData: boolean;
};

export function StatisticsClient({ panels, hasData }: Props) {
  const [index, setIndex] = useState(0);
  const activeId = panels[index]?.id ?? panels[0].id;

  const renderedPanels = useMemo(
    () =>
      panels.map((p) => (
        <div key={p.id} className="px-[19px]">
          {p.node}
        </div>
      )),
    [panels],
  );

  const options = useMemo(
    () => panels.map((p) => ({ id: p.id, label: p.label })),
    [panels],
  );

  if (!hasData) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-[23px] self-stretch">
        <div className="px-[19px]">
          <HorizontalPillNav
            options={options}
            value={activeId}
            onChange={(id) => {
              const i = panels.findIndex((p) => p.id === id);
              if (i >= 0) setIndex(i);
            }}
            ariaLabel="Statistics categories"
          />
        </div>
        <div className="px-[19px]">
          <p className="rounded-[16px] border border-white/[0.06] bg-[#1a1a1a] p-6 text-center text-sm text-neutral-500">
            Add a concert to start seeing your statistics here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[23px] self-stretch">
      <div className="px-[19px]">
        <HorizontalPillNav
          options={options}
          value={activeId}
          onChange={(id) => {
            const i = panels.findIndex((p) => p.id === id);
            if (i >= 0) setIndex(i);
          }}
          ariaLabel="Statistics categories"
        />
      </div>

      <HorizontalSwipePager
        activeIndex={index}
        onIndexChange={setIndex}
        panelCount={panels.length}
        className={HIDE_SCROLLBAR_CLASS}
      >
        {renderedPanels}
      </HorizontalSwipePager>
    </div>
  );
}
