"use client";

import { useEffect, useRef } from "react";
import { HIDE_SCROLLBAR_CLASS } from "@/lib/app-subpage-layout";

export type PillOption<T extends string = string> = {
  id: T;
  label: string;
};

type Props<T extends string> = {
  options: readonly PillOption<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
};

/**
 * Horizontal pill/tab row.
 * Same padding for every button so the label never shifts.
 * Auto-scrolls the active pill into view so it's always visible
 * when changed by swipe on a sibling pager.
 */
export function HorizontalPillNav<T extends string>(props: Props<T>) {
  const { options, value, onChange, ariaLabel = "Filter" } = props;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const scroller = scrollerRef.current;
    const btn = buttonsRef.current[value as string];
    if (!scroller || !btn) return;

    const sRect = scroller.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    const margin = 12;

    if (bRect.left < sRect.left + margin) {
      scroller.scrollBy({
        left: bRect.left - sRect.left - margin,
        behavior: "smooth",
      });
    } else if (bRect.right > sRect.right - margin) {
      scroller.scrollBy({
        left: bRect.right - sRect.right + margin,
        behavior: "smooth",
      });
    }
  }, [value]);

  return (
    <div
      ref={scrollerRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`flex h-[38px] w-full flex-nowrap items-center gap-[14px] overflow-x-auto overflow-y-hidden scroll-smooth ${HIDE_SCROLLBAR_CLASS}`}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            ref={(el) => {
              buttonsRef.current[opt.id as string] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className="relative flex h-[38px] shrink-0 items-center justify-center border-0 bg-transparent px-[14px]"
          >
            {active ? (
              <span
                aria-hidden
                className="absolute inset-0 rounded-[11px] border border-solid border-[#414141] bg-[#262626]"
              />
            ) : null}
            <span
              className={`relative z-10 whitespace-nowrap text-[15px] leading-[18px] ${
                active ? "font-normal text-white" : "font-light text-[#777]"
              }`}
            >
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
