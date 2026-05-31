"use client";

import { Music2 } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  formatMusicHours,
  type DashboardPassportNumbers,
  type PassportStatsPublic,
} from "@/lib/passport-display";

import { formatKmPassport, type PassportStampPreview } from "@/lib/passport-display";
import { artistInkColor, strHash, venueFontIndex, venueShapeIndex } from "@/lib/passport-stamp-style";

export type Frame107Props = {
  passport: DashboardPassportNumbers;
  stats: PassportStatsPublic;
  issuedLabel: string;
  userDisplayName: string;
  issuedTodayMrz: string;
  /** Default home location (passport place of issue). */
  placeOfIssue?: string;
  /** Recent concerts → stamps on pages 3, 4, 5, ... (paged). */
  stamps?: PassportStampPreview[];
  /** Applied to the measurement viewport (should fill available space from the page layout). */
  className?: string;
};

const inter = "var(--font-passport2-inter), ui-sans-serif, system-ui, sans-serif";
const jetbrains = "var(--font-passport2-jetbrains), ui-monospace, monospace";
const chivo = "var(--font-passport2-chivo), ui-monospace, monospace";
const kode = "var(--font-passport2-kode), ui-monospace, monospace";
const oswald = "var(--font-passport2-oswald), ui-sans-serif, system-ui, sans-serif";

const HINGE_Y = 254;
const CARD_W = 380;
const CARD_H = 498;

/** Uniform scale so the fixed-layout card fits its container without stretching. */
function usePassportScale(containerRef: RefObject<HTMLDivElement | null>) {
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w < 1 || h < 1) return;
      setScale(Math.min(1, w / CARD_W, h / CARD_H));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [containerRef]);

  return scale;
}

/** Mini note row: top halves stay tight to the outer edge (original look). */
const NOTE_STRIP_TOP_INSET_PX = 6;
/** Bottom halves need more inset — optical + rounded card makes notes read too low at 6–10px. */
const NOTE_STRIP_BOTTOM_INSET_PX = 20;

/** MRZ line length — slightly OVER-fills the band; the band clips both ends
 *  (text is centred) so the `<<<` always reach the left/right edges regardless
 *  of device font metrics. */
const MRZ_LINE_LEN = 52;
/** Fixed MRZ font size in the card's 380px coordinate space (scales with the
 *  card transform). Using px — not vw — keeps it identical on phone and desktop. */
const MRZ_FONT_SIZE_PX = 11;

/** Page 2 lorem watermark — same brown for page 1 crowd art. */
const PASSPORT_LOREM_WATERMARK = "rgba(92, 74, 58, 0.18)" as const;
/** Slightly stronger than lorem so thin SVG strokes read on the cover. */
const PASSPORT_CROWD_WATERMARK = "rgba(92, 74, 58, 0.24)" as const;

/** Holographic chip — MRZ aligns to its outer right edge. */
const HOLO_LEFT_PX = 335;
const HOLO_W_PX = 26;
const MRZ_LEFT_PX = 16;
/** Right edge of the MRZ band aligns with the right edge of the stats grid
 *  (left 16 + width 347 = 363), i.e. where the "Venues" column ends. */
const MRZ_RIGHT_PAD_PX = CARD_W - (16 + 347);

const FIGMA_LOREM_CORE =
  "eros eu diam eum facilisis elit, consequat, velit feugait sit praesent sed nonummy vulputate qui accumsan in dolore Lorem luptatum nostrud iriure dignissim euismod consectetuer iusto magna zzril ipsum enim vel nulla tation nibh blandit amet, esse dolore odio vero ad tincidunt delenit illum suscipit ullamcorper augue quis ut molestie autem exerci aliquip te minim facilisi. at lobortis commodo adipiscing nulla Ut veniam, consequat. dolor ut et laoreet in feugiat ex aliquam nisl Duis wisi dolore et dolor erat hendrerit duis vel ea volutpat. Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. Ut wisi enim ad minim veniam, quis nostrud exerci tation ullamcorper suscipit lobortis nisl ut aliquip ex ea commodo consequat. Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie consequat, vel illum dolore eu feugiat nulla facilisis at vero eros et accumsan et iusto odio dignissim qui blandit praesent luptatum zzril delenit augue duis dolore te feugait nulla facilisi. ";

function fmtDateShort(d: string): string {
  const t = Date.parse(d);
  if (!Number.isFinite(t)) return d;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
    .format(t)
    .toUpperCase();
}

/** Compact numeric date for stamps: "22/06/24". */
function fmtDateNumeric(d: string): string {
  const t = Date.parse(d);
  if (!Number.isFinite(t)) return d;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(t);
}

/** Venue label without the trailing ", City" — just the venue name. */
function venueNameOnly(label: string): string {
  const name = label.split(",")[0]?.trim();
  return name && name.length > 0 ? name : label;
}

function fmtDateMrz(d: string): string {
  const t = Date.parse(d);
  if (!Number.isFinite(t)) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
    .format(t)
    .toUpperCase()
    .replace(/\s+/g, "");
}

function mrzNameToken(name: string): string {
  const t = name.trim().toUpperCase().replace(/\s+/g, "<");
  return t.length > 0 ? t : "USER";
}

/** Pad with `<` on **both** sides so `core` stays centred; total length = `targetLen`. */
function padMrzLineCentered(core: string, targetLen: number): string {
  const c = core.toUpperCase();
  if (c.length >= targetLen) return c.slice(0, targetLen);
  const padTotal = targetLen - c.length;
  const left = Math.floor(padTotal / 2);
  const right = padTotal - left;
  return "<".repeat(left) + c + "<".repeat(right);
}

/** Small note strip used along the outer edge of every page (top of card on
 *  top-half pages, bottom of card on bottom-half pages). Many tiny notes
 *  arranged in a row that covers almost the full card width. */
const MINI_NOTE_COUNT = 28;
function MiniNoteStrip({ colorClass = "text-[#5c4a3a]/55" }: { colorClass?: string }) {
  return (
    <div
      className="flex flex-row items-center justify-center gap-[7px]"
      aria-hidden
    >
      {Array.from({ length: MINI_NOTE_COUNT }, (_, i) => (
        <Music2
          key={i}
          className={`shrink-0 ${colorClass}`}
          style={{ width: 6, height: 8, minWidth: 6 }}
          strokeWidth={2}
        />
      ))}
    </div>
  );
}

const CARD_SHADOW =
  "25px 108px 44px rgba(66, 173, 255, 0.01), 14px 61px 37px rgba(66, 173, 255, 0.05), 6px 27px 28px rgba(66, 173, 255, 0.09), 2px 7px 15px rgba(66, 173, 255, 0.1)";

/**
 * Stamp outlines (viewBox 130x42).
 * All shapes have a double border to feel like real stamps.
 */
type StampShapeDef = {
  outline: ReactNode;
  padX: number;
  padY: number;
};

const STAMP_SHAPES: readonly StampShapeDef[] = [
  // 0 — Sharp rectangle, double border (classic, like NEW YORK)
  {
    outline: (
      <>
        <rect x={1} y={1} width={128} height={40} fill="none" stroke="currentColor" strokeWidth={1.4} />
        <rect x={3.5} y={3.5} width={123} height={35} fill="none" stroke="currentColor" strokeWidth={0.6} />
      </>
    ),
    padX: 8,
    padY: 5,
  },
  // 1 — Horizontal hexagon with double border (like JAKARTA / VENICE)
  {
    outline: (
      <>
        <path d="M 12 1.5 L 118 1.5 L 128 21 L 118 40.5 L 12 40.5 L 2 21 Z" fill="none" stroke="currentColor" strokeWidth={1.4} />
        <path d="M 14 4 L 116 4 L 124.5 21 L 116 38 L 14 38 L 5.5 21 Z" fill="none" stroke="currentColor" strokeWidth={0.5} />
      </>
    ),
    padX: 14,
    padY: 5,
  },
  // 2 — Pill / capsule with double border (like MARSEILLE)
  {
    outline: (
      <>
        <rect x={1} y={1} width={128} height={40} rx={20} ry={20} fill="none" stroke="currentColor" strokeWidth={1.4} />
        <rect x={3.5} y={3.5} width={123} height={35} rx={17.5} ry={17.5} fill="none" stroke="currentColor" strokeWidth={0.5} />
      </>
    ),
    padX: 17,
    padY: 5,
  },
  // 3 — Oval / ellipse with double border (like PARIS / SEATTLE)
  {
    outline: (
      <>
        <ellipse cx={65} cy={21} rx={63.5} ry={19.5} fill="none" stroke="currentColor" strokeWidth={1.4} />
        <ellipse cx={65} cy={21} rx={60.5} ry={16.5} fill="none" stroke="currentColor" strokeWidth={0.5} />
      </>
    ),
    padX: 14,
    padY: 5,
  },
  // 4 — Rounded rectangle with double border (like AMSTERDAM / HOUSTON)
  {
    outline: (
      <>
        <rect x={1} y={1} width={128} height={40} rx={5} ry={5} fill="none" stroke="currentColor" strokeWidth={1.4} />
        <rect x={4} y={4} width={122} height={34} rx={3} ry={3} fill="none" stroke="currentColor" strokeWidth={0.5} />
      </>
    ),
    padX: 8,
    padY: 5,
  },
];

/**
 * Six hand-crafted positions inside one half (380 × HINGE_Y).
 * Designed so the same set works in BOTH halves:
 * - top half: note strip occupies y=4..16 → stamps must start below ~20
 * - bottom half: note strip occupies y=232..244 → stamps must end above ~222
 * - all sides: at least 8 px margin from the binding (y=0 or y=254) and from
 *   the card left/right edges.
 * X values are deliberately varied (10, 215, 60, 235, 18, 170) so the stamps
 * don't read as a 2-column grid.
 */
type StampSlot = { x: number; y: number; rot: number };
const STAMP_SLOTS: readonly StampSlot[] = [
  { x: 10,  y: 24,  rot: -7 },
  { x: 215, y: 32,  rot: 5  },
  { x: 60,  y: 88,  rot: 8  },
  { x: 235, y: 104, rot: -4 },
  { x: 18,  y: 150, rot: 6  },
  { x: 170, y: 172, rot: -9 },
];

const STAMPS_PER_HALF = 6;
const STAMPS_PER_SPREAD = 12;
const STAMP_W = 130;
const STAMP_H = 42;
const FONT_BY_INDEX = [inter, jetbrains, chivo, kode] as const;

/** Renders one stamp using its slot + per-stamp jitter. */
function StampPiece({ stamp, slot }: { stamp: PassportStampPreview; slot: StampSlot }) {
  const h = strHash(stamp.gigId + stamp.attendanceId);
  const jx = ((h >> 0) & 0xf) - 7;      // -7..+8
  const jy = ((h >> 4) & 0x7) - 3;      // -3..+4
  const jr = ((h >> 8) & 0x7) - 3;      // -3..+4
  const ink = artistInkColor(stamp.artistId);
  const shape = STAMP_SHAPES[venueShapeIndex(stamp.venueId)];
  const font = FONT_BY_INDEX[venueFontIndex(stamp.venueId)];
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: slot.x + jx,
        top: slot.y + jy,
        width: STAMP_W,
        height: STAMP_H,
        transform: `rotate(${slot.rot + jr}deg)`,
        transformOrigin: "center center",
        color: ink,
        fontFamily: font,
      }}
    >
      <svg
        viewBox={`0 0 ${STAMP_W} ${STAMP_H}`}
        width={STAMP_W}
        height={STAMP_H}
        className="absolute inset-0"
        aria-hidden
      >
        {shape.outline}
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-[1px] text-center"
        style={{ padding: `${shape.padY}px ${shape.padX}px` }}
      >
        <p
          className="w-full truncate uppercase leading-[15px] tracking-[0.01em]"
          style={{ fontFamily: oswald, fontWeight: 700, fontSize: 14 }}
        >
          {stamp.artistName}
        </p>
        <div className="flex w-full min-w-0 items-baseline justify-center gap-[3px] text-[6.5px] font-semibold uppercase leading-[8px] tracking-[0.04em]">
          <span className="shrink-0 tabular-nums">{fmtDateNumeric(stamp.rawDate)}</span>
          <span className="shrink-0" aria-hidden>
            {"\u2022"}
          </span>
          <span className="min-w-0 truncate">{venueNameOnly(stamp.venueLabel)}</span>
        </div>
      </div>
    </div>
  );
}

/** Decorative half-face: cream paper, mini note strip at the OUTER edge.
 *  Top half: tight `NOTE_STRIP_TOP_INSET_PX` from top (unchanged from earlier).
 *  Bottom half: larger `NOTE_STRIP_BOTTOM_INSET_PX` from bottom so it matches the top look. */
function StampHalfFace({
  stamps,
  isBottomHalf,
  pageLabel,
  showEmptyHint,
}: {
  stamps: PassportStampPreview[];
  isBottomHalf: boolean;
  pageLabel?: string;
  showEmptyHint?: boolean;
}) {
  return (
    <>
      {/* Subtle cream noise */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
        aria-hidden
      />
      {/* Mini note strip at the OUTER edge of the page (same inset top vs bottom). */}
      <div
        className="pointer-events-none absolute left-0 right-0 flex justify-center"
        style={
          isBottomHalf
            ? { bottom: NOTE_STRIP_BOTTOM_INSET_PX }
            : { top: NOTE_STRIP_TOP_INSET_PX }
        }
      >
        <MiniNoteStrip />
      </div>
      {/* Stamps in their 6 slot positions */}
      {stamps.map((s, i) => (
        <StampPiece key={s.attendanceId} stamp={s} slot={STAMP_SLOTS[i]!} />
      ))}
      {/* Page label — placed at the opposite edge from the notes */}
      {pageLabel ? (
        <div
          className="pointer-events-none absolute left-3"
          style={
            isBottomHalf
              ? { top: NOTE_STRIP_TOP_INSET_PX }
              : { bottom: NOTE_STRIP_TOP_INSET_PX }
          }
        >
          <p className="text-[8.5px] font-semibold uppercase tracking-[0.2em] text-[#6b5a45]/55">
            {pageLabel}
          </p>
        </div>
      ) : null}
      {showEmptyHint ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          <p className="text-center text-[11px] leading-snug text-[#5c4f42]/75" style={{ fontFamily: inter }}>
            No concerts yet — your stamps will appear here once you log a few.
          </p>
        </div>
      ) : null}
    </>
  );
}

export function Frame107OpenBook({
  passport,
  stats,
  issuedLabel,
  userDisplayName,
  issuedTodayMrz,
  placeOfIssue: placeOfIssueProp = "—",
  stamps = [],
  className,
}: Frame107Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scale = usePassportScale(viewportRef);
  /**
   * pageIndex semantics:
   *   0 → spread 1 (page 1 cover top, page 2 data bottom)
   *   1 → spread 2 (page 3 top, page 4 bottom)
   *   2 → spread 3 (page 5 top, page 6 bottom)
   *   ...
   * Each step forward = one bottom sheet flips up around the hinge.
   *
   * zPageIndex mirrors pageIndex but is updated at the MIDPOINT of the flip
   * animation. This lets the rotating sheet keep its "old" z-index while it
   * is still in the half it came from (so it remains visible), and only
   * switch z-index when it's perpendicular to the viewer (invisible).
   */
  const [pageIndex, setPageIndex] = useState(0);
  const [zPageIndex, setZPageIndex] = useState(0);
  const lockedRef = useRef(false);

  const FLIP_MS = 850;

  const memberSince =
    stats?.overview?.firstConcertDate != null && String(stats.overview.firstConcertDate) !== ""
      ? fmtDateShort(String(stats.overview.firstConcertDate))
      : "—";

  const memberSinceMrz =
    stats?.overview?.firstConcertDate != null && String(stats.overview.firstConcertDate) !== ""
      ? fmtDateMrz(String(stats.overview.firstConcertDate))
      : "";

  const placeOfIssue = placeOfIssueProp.trim() || "—";
  const km = passport.kmTraveledSum;
  const concertTimeVal = formatMusicHours(passport.musicTimeMinutesSum);
  const artistsVal = String(Math.round(passport.distinctArtistsCount));
  const distanceKm = `${formatKmPassport(Number.isFinite(km) ? km : 0)} km`;
  const venuesVal = String(Math.round(passport.distinctVenuesCount));
  const dateOfIssue = stats?.generatedAtIso ? fmtDateShort(stats.generatedAtIso) : issuedLabel;

  const { mrzLine1, mrzLine2 } = useMemo(() => {
    const n = mrzNameToken(userDisplayName);
    const m = memberSinceMrz.replace(/[^A-Z0-9]/gi, "") || "UNKNOWN";
    const line1Core = `<<<<${n}<<<<MEMBERSINCE${m}<<<<`;
    const iss = (issuedTodayMrz || "UNKNOWN").replace(/[^A-Z0-9]/gi, "");
    const line2Core = `<<<<ISSUED${iss}<<<<CONCERTPSYCHO<<<<`;
    return {
      mrzLine1: padMrzLineCentered(line1Core, MRZ_LINE_LEN),
      mrzLine2: padMrzLineCentered(line2Core, MRZ_LINE_LEN),
    };
  }, [userDisplayName, memberSinceMrz, issuedTodayMrz]);

  const loremFill = useMemo(() => FIGMA_LOREM_CORE.repeat(32), []);

  // numSpreads always >= 1. Each spread after 1 holds 12 stamps.
  const numSpreads = stamps.length === 0 ? 2 : 1 + Math.ceil(stamps.length / STAMPS_PER_SPREAD);
  // numSheets equals numSpreads: sheet k bridges spread k+1 (its front) and spread k+2 (its back).
  // Last sheet's back is unused unless we want to allow a "next" empty spread.
  const numSheets = numSpreads;

  const canGoForward = pageIndex < numSpreads - 1;
  const canGoBackward = pageIndex > 0;

  const navigate = useCallback(
    (dir: 1 | -1) => {
      if (lockedRef.current) return;
      const next = pageIndex + dir;
      if (next < 0 || next > numSpreads - 1) return;
      lockedRef.current = true;
      setPageIndex(next);
      // Update z-index at the midpoint of the flip so the sheet remains
      // visible while it's still in the half it's leaving.
      window.setTimeout(() => setZPageIndex(next), Math.round(FLIP_MS / 2));
      window.setTimeout(() => {
        lockedRef.current = false;
      }, FLIP_MS);
    },
    [pageIndex, numSpreads],
  );

  // Safety: if pageIndex and zPageIndex ever desync (e.g., StrictMode double-mount),
  // reconcile after a full animation cycle.
  useEffect(() => {
    if (zPageIndex === pageIndex) return;
    const t = window.setTimeout(() => setZPageIndex(pageIndex), FLIP_MS + 50);
    return () => window.clearTimeout(t);
  }, [pageIndex, zPageIndex]);

  const handleTopTap = useCallback(() => navigate(-1), [navigate]);
  const handleBottomTap = useCallback(() => navigate(1), [navigate]);

  /** Resolves which stamps belong to a sheet's front and back faces. */
  const getSheetStamps = (k: number): { front: PassportStampPreview[]; back: PassportStampPreview[] } => {
    if (k === 0) {
      return { front: [], back: stamps.slice(0, STAMPS_PER_HALF) };
    }
    const frontStart = STAMPS_PER_SPREAD * k - STAMPS_PER_HALF;
    const backStart = STAMPS_PER_SPREAD * k;
    return {
      front: stamps.slice(frontStart, frontStart + STAMPS_PER_HALF),
      back: stamps.slice(backStart, backStart + STAMPS_PER_HALF),
    };
  };

  return (
    <div
      ref={viewportRef}
      className={className ? `flex w-full items-center justify-center ${className}` : "flex w-full items-center justify-center"}
      data-passport-viewport
    >
      <div
        className="relative shrink-0"
        style={{ width: CARD_W * scale, height: CARD_H * scale }}
        data-figma-node="Frame-107"
      >
        <div
          className="absolute left-1/2 top-0"
          style={{
            width: CARD_W,
            height: CARD_H,
            transform: `translateX(-50%) scale(${scale})`,
            transformOrigin: "top center",
          }}
        >
        {/* Card shadow */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[11px] bg-white"
          style={{ boxShadow: CARD_SHADOW }}
          aria-hidden
        />

        {/* 3D scene root — perspective + overflow:hidden live HERE (no preserve-3d).
            Stacking between sheets is handled via z-index, so we don't need
            preserve-3d on this element (which would conflict with overflow:hidden).
            Each sheet still uses preserve-3d for its own front/back faces. */}
        <div
          className="absolute inset-0 overflow-hidden rounded-[11px]"
          style={{ perspective: 1600 }}
        >
          {/* ── TOP BASE — Page 1 cover, always present at the top half ───────── */}
          <div
            className="absolute left-0 top-0 overflow-hidden bg-[#f7f0e4]"
            style={{
              width: CARD_W,
              height: HINGE_Y,
              zIndex: 1,
            }}
            aria-hidden
          >
            {/* Crowd — same brown as page 2 lorem, recolored via mask (not grey stroke) */}
            <div
              className="pointer-events-none absolute inset-0 z-[1]"
              style={{
                backgroundColor: PASSPORT_CROWD_WATERMARK,
                maskImage: "url(/assets/passport/crowd.svg)",
                WebkitMaskImage: "url(/assets/passport/crowd.svg)",
                maskRepeat: "no-repeat",
                WebkitMaskRepeat: "no-repeat",
                maskSize: "cover",
                WebkitMaskSize: "cover",
                maskPosition: "center bottom",
                WebkitMaskPosition: "center bottom",
              }}
              aria-hidden
            />
            {/* Subtle noise */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.16]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`,
              }}
            />
            {/* Warm highlight */}
            <div
              className="pointer-events-none absolute inset-0 opacity-50"
              style={{
                background:
                  "radial-gradient(55% 45% at 50% 12%, rgba(255,250,240,0.7) 0%, transparent 60%)",
              }}
            />
            {/* Mini note strip at the top edge (matches the look of pages 3+). */}
            <div
              className="pointer-events-none absolute left-0 right-0 z-[3] flex justify-center"
              style={{ top: NOTE_STRIP_TOP_INSET_PX }}
            >
              <MiniNoteStrip />
            </div>
            {/* Vertical edge label */}
            <div className="pointer-events-none absolute bottom-[24px] left-[6px] top-[40px] z-[5] flex w-[14px] items-center justify-center">
              <span
                className="whitespace-nowrap text-[12px] font-normal uppercase leading-[14px] tracking-[0.12em] text-[#23007D]"
                style={{
                  fontFamily: jetbrains,
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                }}
              >
                Concert Psycho App
              </span>
            </div>
            {/* Binding line is drawn once globally at HINGE_Y (see below). */}
          </div>

          {/* ── SHEETS STACK ────────────────────────────────────────────────────
              Sheet k physically lives in the BOTTOM half by default and rotates
              up around the hinge when its `flipped` state becomes true.
              Z-index strategy (`zPageIndex` lags `pageIndex` by FLIP_MS/2):
                - Un-flipped (still in bottom half): z = 1000 - k so sheet 0 is
                  on top of sheet 1, etc.
                - Flipped (now in top half):         z = 100  + k so the most
                  recently flipped sheet sits on top.
              The top base has z=1 (always below every flipped sheet). */}
          {Array.from({ length: numSheets }, (_, k) => {
            const flipped = pageIndex > k;         // drives the rotation
            const flippedZ = zPageIndex > k;       // drives the z-index
            const sheetStamps = getSheetStamps(k);
            const z = flippedZ ? 100 + k : 1000 - k;
            return (
              <div
                key={k}
                className="absolute left-0"
                style={{
                  top: HINGE_Y,
                  width: CARD_W,
                  // Sheet is HINGE_Y tall so its flipped state fully covers the top half.
                  // The bottom 10px overflow when un-flipped is clipped by the card.
                  height: HINGE_Y,
                  zIndex: z,
                  transformOrigin: "50% 0",
                  transformStyle: "preserve-3d",
                  transform: `rotateX(${flipped ? 180 : 0}deg)`,
                  transition: `transform ${FLIP_MS}ms cubic-bezier(0.33, 1, 0.68, 1)`,
                }}
              >
                {/* FRONT face — visible when sheet is at the bottom (un-flipped) */}
                <div
                  className="absolute inset-0 overflow-hidden bg-[#f7f0e4]"
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                  }}
                >
                  {k === 0 ? (
                    /* Page 2 — passport data leaf */
                    <>
                      {/* Subtle noise */}
                      <div
                        className="pointer-events-none absolute inset-0 opacity-[0.16]"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`,
                        }}
                        aria-hidden
                      />
                      {/* Warm gradient */}
                      <div
                        className="pointer-events-none absolute left-[2px] top-[-50px] h-[313px] w-[376px] opacity-40"
                        style={{
                          background:
                            "linear-gradient(188deg, transparent 40%, rgba(92,74,58,0.08) 100%), radial-gradient(40% 30% at 50% 55%, rgba(92,74,58,0.05) 0%, transparent 70%)",
                        }}
                        aria-hidden
                      />
                      {/* Lorem watermark */}
                      <div
                        className="pointer-events-none absolute left-[4px] top-[7px] z-0 flex h-[236px] w-[374px] items-center overflow-hidden"
                        style={{
                          fontFamily: jetbrains,
                          fontWeight: 500,
                          fontSize: "4px",
                          lineHeight: "5px",
                          color: PASSPORT_LOREM_WATERMARK,
                        }}
                        aria-hidden
                      >
                        <p className="m-0 box-border w-full px-1 text-justify">{loremFill}</p>
                      </div>
                      {/* Stats block */}
                      <div className="pointer-events-none absolute left-[16px] top-[17px] z-[2] flex w-[347px] flex-col items-start gap-[14px]">
                        <div className="flex w-[262px] flex-col justify-center gap-[9px]">
                          <div className="flex w-[262px] flex-col items-start gap-[3px]">
                            <p
                              className="w-[262px] text-[16px] font-semibold leading-[19px] tracking-[0.02em] text-[#23007D]"
                              style={{ fontFamily: inter, margin: "-2px 0 0 0" }}
                            >
                              My Lifetime Passport
                            </p>
                            <p
                              className="w-[262px] text-[10px] font-normal leading-[12px] text-black/70"
                              style={{ fontFamily: inter }}
                            >
                              Passport {"\u22c5"} Pass {"\u22c5"} Pasaporte
                            </p>
                          </div>
                          <div className="flex w-[75px] flex-col items-start">
                            <p
                              className="w-full text-[36px] font-semibold leading-[46px] text-[#23007D]"
                              style={{ fontFamily: kode }}
                            >
                              {(() => {
                                const n = Math.round(passport.concertsCount);
                                return n < 100 ? String(n).padStart(2, "0") : String(n);
                              })()}
                            </p>
                            <p
                              className="w-full text-[20px] font-normal leading-[24px] text-[#382190]"
                              style={{ fontFamily: inter }}
                            >
                              Concerts
                            </p>
                          </div>
                        </div>
                        <div className="grid w-[347px] grid-cols-4 gap-x-1 self-stretch">
                          {(
                            [
                              { label: "Music time", value: concertTimeVal },
                              { label: "Artists", value: artistsVal },
                              { label: "Traveled", value: distanceKm },
                              { label: "Venues", value: venuesVal },
                            ] as const
                          ).map(({ label, value }) => (
                            <div key={label} className="flex w-full min-w-0 flex-col items-stretch gap-[3px]">
                              <span
                                className="w-full text-center text-[10px] font-normal leading-[12px] text-[rgba(35,0,125,0.83)]"
                                style={{ fontFamily: inter }}
                              >
                                {label}
                              </span>
                              <span
                                className="w-full text-center text-[14px] font-semibold tabular-nums leading-[17px] text-[#23007D]"
                                style={{ fontFamily: chivo }}
                              >
                                {value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Authority text */}
                      <div
                        className="pointer-events-none absolute left-[184px] top-[59px] z-[2] flex w-[159px] flex-col gap-[2px] opacity-75 mix-blend-multiply"
                        style={{ fontFamily: jetbrains }}
                      >
                        <p className="flex h-4 w-full items-center text-[10px] font-medium leading-[13px] text-[rgba(35,0,125,0.83)]">
                          Authority Concert Psycho
                        </p>
                        <p className="flex h-4 w-full items-center text-[10px] font-medium leading-[13px] text-[rgba(35,0,125,0.83)]">
                          Place of issue {placeOfIssue}
                        </p>
                        <p className="flex h-4 w-full items-center text-[10px] font-medium leading-[13px] text-[rgba(35,0,125,0.83)]">
                          Date of issue {dateOfIssue}
                        </p>
                        <p className="flex h-4 w-full items-center text-[10px] font-medium leading-[13px] text-[rgba(35,0,125,0.83)]">
                          Member since {memberSince}
                        </p>
                      </div>
                      {/* Hologram chip */}
                      <div
                        className="pointer-events-none absolute left-[335px] top-[16px] z-[2] h-[24px] w-[26px] rounded-[3px] opacity-95 mix-blend-luminosity"
                        style={{
                          background:
                            "conic-gradient(from 180deg at 50% 50%, #fff 0deg, #000 54deg, #fff 100deg, #000 148deg, #fff 198deg, #000 238deg, #fff 280deg, #000 328deg, #fff 360deg), radial-gradient(circle at 100% 0%, #05bee1 0%, #ffc74f 22%, #939cad 40%, #05bee1 60%, #9cc080 82%, #05bee1 100%)",
                          backgroundBlendMode: "screen, normal",
                        }}
                        aria-hidden
                      />
                      {/* MRZ */}
                      <div
                        className="pointer-events-none absolute top-[188px] z-[2] min-w-0 overflow-hidden"
                        style={{
                          fontFamily: jetbrains,
                          left: MRZ_LEFT_PX,
                          right: MRZ_RIGHT_PAD_PX,
                        }}
                      >
                        <p
                          className="m-0 w-full whitespace-nowrap text-center font-light uppercase leading-[12px] tracking-[0.07em] text-[#23007D]/85 mix-blend-plus-darker"
                          style={{ fontSize: MRZ_FONT_SIZE_PX }}
                        >
                          {mrzLine1}
                        </p>
                        <p
                          className="m-0 mt-1 w-full whitespace-nowrap text-center font-light uppercase leading-[12px] tracking-[0.07em] text-[#23007D]/85 mix-blend-plus-darker"
                          style={{ fontSize: MRZ_FONT_SIZE_PX }}
                        >
                          {mrzLine2}
                        </p>
                      </div>
                    </>
                  ) : (
                    /* Pages 4, 6, 8, ... — stamp halves */
                    <StampHalfFace
                      stamps={sheetStamps.front}
                      isBottomHalf
                      pageLabel={`Page ${2 * k + 2}`}
                    />
                  )}
                </div>

                {/* BACK face — visible when sheet is flipped up (covering top half) */}
                <div
                  className="absolute inset-0 overflow-hidden bg-[#f7f0e4]"
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: "rotateX(180deg) translateZ(0.5px)",
                  }}
                >
                  <StampHalfFace
                    stamps={sheetStamps.back}
                    isBottomHalf={false}
                    pageLabel={`Page ${2 * k + 3}`}
                    showEmptyHint={k === 0 && stamps.length === 0}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* ── NAVIGATION ───────────────────────────────────────────────────────
            Tap top half  → go back  (top sheet flips down).
            Tap bottom half → go forward (bottom sheet flips up). */}
        {canGoBackward && (
          <button
            type="button"
            className="absolute inset-x-0 top-0 z-[40] m-0 cursor-pointer border-0 bg-transparent p-0 outline-none"
            style={{ height: HINGE_Y }}
            aria-label="Previous spread"
            tabIndex={0}
            onClick={handleTopTap}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleTopTap();
              }
            }}
          >
            <span className="sr-only">Previous</span>
          </button>
        )}
        {canGoForward && (
          <button
            type="button"
            className="absolute inset-x-0 bottom-0 z-[40] m-0 cursor-pointer border-0 bg-transparent p-0 outline-none"
            style={{ top: HINGE_Y }}
            aria-label="Next spread"
            tabIndex={0}
            onClick={handleBottomTap}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleBottomTap();
              }
            }}
          >
            <span className="sr-only">Next</span>
          </button>
        )}
        {/* Always-visible binding between halves (above 3D + nav; taps pass through). */}
        <div
          className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-[#c9b89a]/55"
          style={{ top: HINGE_Y, zIndex: 50 }}
          aria-hidden
        />
        </div>
      </div>
    </div>
  );
}
