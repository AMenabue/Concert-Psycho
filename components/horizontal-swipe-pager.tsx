"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent,
} from "react";
import { HIDE_SCROLLBAR_CLASS } from "@/lib/app-subpage-layout";

const SWIPE_THRESHOLD_PX = 56;
const TRANSITION_MS = 320;

type Props = {
  activeIndex: number;
  onIndexChange: (index: number) => void;
  panelCount: number;
  children: ReactNode[];
  className?: string;
};

export function HorizontalSwipePager(props: Props) {
  const { activeIndex, onIndexChange, panelCount, children, className = "" } = props;
  const viewportRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [dragPx, setDragPx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const axisLocked = useRef<"x" | "y" | null>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w != null && w > 0) setViewportWidth(w);
    });
    ro.observe(el);
    setViewportWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const clampIndex = useCallback(
    (i: number) => Math.max(0, Math.min(panelCount - 1, i)),
    [panelCount],
  );

  const goTo = useCallback(
    (index: number) => {
      const next = clampIndex(index);
      setAnimating(true);
      setDragPx(0);
      onIndexChange(next);
    },
    [clampIndex, onIndexChange],
  );

  // Animate whenever activeIndex changes (pill tap or swipe)
  useEffect(() => {
    setAnimating(true);
    setDragPx(0);
  }, [activeIndex]);

  // New panel always starts at the top (swipe or pill navigation)
  useEffect(() => {
    const panel = panelRefs.current[activeIndex];
    if (panel) panel.scrollTop = 0;
  }, [activeIndex]);

  useEffect(() => {
    if (!animating) return;
    const t = window.setTimeout(() => setAnimating(false), TRANSITION_MS);
    return () => window.clearTimeout(t);
  }, [animating, activeIndex]);

  const offsetPx = -(activeIndex * viewportWidth) + dragPx;

  const onTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    touchStartY.current = e.touches[0]?.clientY ?? null;
    axisLocked.current = null;
    setAnimating(false);
  };

  const onTouchMove = (e: TouchEvent) => {
    const sx = touchStartX.current;
    const sy = touchStartY.current;
    const cx = e.touches[0]?.clientX;
    const cy = e.touches[0]?.clientY;
    if (sx == null || sy == null || cx == null || cy == null) return;

    const dx = cx - sx;
    const dy = cy - sy;

    if (axisLocked.current === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axisLocked.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (axisLocked.current !== "x") return;

    // Rubber-band at edges
    let next = dx;
    if (activeIndex === 0 && next > 0) next *= 0.25;
    if (activeIndex === panelCount - 1 && next < 0) next *= 0.25;
    setDragPx(next);
  };

  const onTouchEnd = () => {
    if (axisLocked.current === "x") {
      if (dragPx <= -SWIPE_THRESHOLD_PX) {
        goTo(activeIndex + 1);
      } else if (dragPx >= SWIPE_THRESHOLD_PX) {
        goTo(activeIndex - 1);
      } else {
        setAnimating(true);
        setDragPx(0);
      }
    } else {
      setDragPx(0);
    }
    touchStartX.current = null;
    touchStartY.current = null;
    axisLocked.current = null;
  };

  return (
    <div
      ref={viewportRef}
      className={`min-h-0 flex-1 overflow-hidden touch-pan-y ${className}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      {/* Sliding track — full width × N panels */}
      <div
        className="flex h-full will-change-transform"
        style={{
          width: viewportWidth > 0 ? viewportWidth * panelCount : `${panelCount * 100}%`,
          transform: `translate3d(${offsetPx}px, 0, 0)`,
          transition: animating
            ? `transform ${TRANSITION_MS}ms cubic-bezier(0.25, 0.1, 0.25, 1)`
            : "none",
        }}
      >
        {children.map((child, i) => (
          <div
            key={i}
            ref={(el) => {
              panelRefs.current[i] = el;
            }}
            className={`h-full shrink-0 overflow-y-auto ${HIDE_SCROLLBAR_CLASS}`}
            style={{ width: viewportWidth > 0 ? viewportWidth : `${100 / panelCount}%` }}
            aria-hidden={i !== activeIndex}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}
