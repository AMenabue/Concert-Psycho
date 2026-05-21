"use client";

import { RedStatCardGlows } from "@/components/home/flighty-card-glows";
import { FLIGHTY_HOME_ASSETS } from "@/lib/flighty/home-assets";
import { RotateCw } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { pickRandomHomeCardIndex } from "@/lib/home-red-card-index";

const learnMoreRed =
  "box-border flex h-[42px] w-[min(364px,calc(100%-28px))] shrink-0 items-center justify-between rounded-[8px] border-0 px-5 py-[9px] backdrop-blur-[19.5px] bg-[rgba(255,255,255,0.08)] " +
  "shadow-[inset_0_1px_0_rgba(255,220,220,0.18),inset_1px_0_0_rgba(255,255,255,0.06)]";

const mono = "font-[family-name:var(--font-flighty-chivo),ui-monospace,monospace]";

/** Figma Frame 70: hero 64/76 when numeric. */
function heroTypographyClass(hero: string): string {
  const numericCore = hero
    .replace(/^€\s*/, "")
    .replace(/\s*(km|%|y)\s*$/i, "")
    .trim();

  if (/^[\d,.$]+$/.test(numericCore)) {
    const digits = numericCore.replace(/,/g, "").length;
    if (digits <= 7) return "text-[64px] leading-[76px]";
    if (digits <= 9) return "text-[44px] leading-[48px]";
    return "text-[32px] leading-[36px]";
  }

  const len = hero.length;
  if (len <= 4) return "text-[64px] leading-[76px]";
  if (len <= 7) return "text-[44px] leading-[48px]";
  return "text-[32px] leading-[36px]";
}

export type RedCardTemplate = {
  id: string;
  hero: string;
  primary: string;
  context: string | null;
};

type Props = {
  templates: RedCardTemplate[];
  uniqueSongsCount: number;
  statsExploreHref: string;
};

export function DashboardRedStatCard(props: Props) {
  const { templates, uniqueSongsCount, statsExploreHref } = props;

  const views = useMemo<RedCardTemplate[]>(() => {
    if (templates.length > 0) return templates;
    return [
      {
        id: "fallback-unique-songs",
        hero: String(uniqueSongsCount),
        primary: "unique songs heard live",
        context: "across all your concerts",
      },
    ];
  }, [templates, uniqueSongsCount]);

  const templateIds = useMemo(() => views.map((v) => v.id), [views]);

  const [viewIndex, setViewIndex] = useState(0);
  const view = views[viewIndex] ?? views[0];

  useEffect(() => {
    if (views.length <= 1) return;
    setViewIndex((current) =>
      pickRandomHomeCardIndex(views.length, current, templateIds),
    );
  }, [views.length, templateIds]);

  const refresh = useCallback(() => {
    if (views.length <= 1) return;
    setViewIndex((current) =>
      pickRandomHomeCardIndex(views.length, current, templateIds),
    );
  }, [views.length, templateIds]);

  const primaryRef = useRef<HTMLParagraphElement>(null);
  const contextRef = useRef<HTMLParagraphElement>(null);
  const [contextWraps, setContextWraps] = useState(false);
  const [primaryWraps, setPrimaryWraps] = useState(false);

  useLayoutEffect(() => {
    const pri = primaryRef.current;
    const ctx = contextRef.current;
    // 18px/22px → una riga ≈ 22px; due righe ≈ 44px
    setPrimaryWraps(pri ? pri.scrollHeight > 26 : false);
    setContextWraps(ctx ? ctx.scrollHeight > 26 : false);
  }, [view.primary, view.context]);

  /** Solo spostamento verticale — sottotitolo sempre 18px come Figma */
  const textTop =
    primaryWraps && contextWraps
      ? 80
      : contextWraps
        ? 84
        : primaryWraps
          ? 88
          : 92;

  const heroClass = heroTypographyClass(view.hero);

  return (
    <div
      className="relative h-[215px] w-full shrink-0 overflow-hidden rounded-[16px] bg-[#621013]"
      data-dashboard-card="red"
    >
      <RedStatCardGlows />

      {/* 44 — Chivo Mono 600, top 18 */}
      <p
        className={`${mono} absolute left-[20px] top-[18px] z-20 line-clamp-1 max-w-[calc(100%-68px)] font-semibold text-white ${heroClass}`}
      >
        {view.hero}
      </p>

      {/* Frame 71 — titolo e sottotitolo sempre 18px; se serve più righe, sale il blocco */}
      <div
        className="absolute left-[20px] z-20 flex w-[min(292px,calc(100%-68px))] flex-col gap-px"
        style={{ top: textTop }}
      >
        <p
          ref={primaryRef}
          className="line-clamp-2 text-[18px] font-semibold leading-[22px] text-[rgba(255,255,255,0.99)]"
        >
          {view.primary}
        </p>
        {view.context ? (
          <p
            ref={contextRef}
            className="line-clamp-2 text-[18px] font-light leading-[22px] text-[rgba(255,255,255,0.46)]"
          >
            {view.context}
          </p>
        ) : null}
      </div>

      {/* Frame 63 — sempre top 159 (Figma), mai spostato */}
      <a
        href={statsExploreHref}
        className={`absolute left-1/2 top-[159px] z-30 -translate-x-1/2 ${learnMoreRed}`}
      >
        <span className="text-[14px] font-light leading-[17px] text-white">
          Explore all your stats
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          src={FLIGHTY_HOME_ASSETS.chevronRight}
          width={24}
          height={24}
          className="shrink-0"
        />
      </a>

      <button
        type="button"
        onClick={refresh}
        className="absolute right-[21px] top-[22px] z-30 flex h-[20px] w-[21px] items-center justify-center text-white/80 hover:text-white disabled:opacity-30"
        aria-label="Show another stat"
        disabled={views.length <= 1}
      >
        <RotateCw className="size-[18px]" strokeWidth={2} />
      </button>
    </div>
  );
}
