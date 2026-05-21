import type { ReactNode } from "react";

const MONO_STYLE = { fontFamily: "var(--font-flighty-chivo), ui-monospace, monospace" };

/* -------------------------------------------------------------- */
/* Section / Card containers                                       */
/* -------------------------------------------------------------- */

export function SectionTitle(props: { children: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-3 px-1">
      {props.eyebrow ? (
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
          {props.eyebrow}
        </p>
      ) : null}
      <h2 className="text-[20px] font-semibold leading-[24px] text-white">
        {props.children}
      </h2>
    </div>
  );
}

export function StatCard(props: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  const { children, className = "", padded = true } = props;
  return (
    <div
      className={`relative overflow-hidden rounded-[18px] border border-white/[0.06] bg-[#1a1a1a] ${
        padded ? "p-4" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------- */
/* Hero number                                                     */
/* -------------------------------------------------------------- */

export type AccentColor =
  | "default"
  | "red"
  | "blue"
  | "green"
  | "yellow"
  | "orange"
  | "violet"
  | "pink";

/** Hex values for each named accent — used by HeroNumberCard, RankedList, BarChart, MiniBars. */
export const ACCENT_HEX: Record<AccentColor, string> = {
  default: "#ffffff",
  red: "#ff6363",
  blue: "#7aa2ff",
  green: "#7be0a6",
  yellow: "#ffd166",
  orange: "#ff9d5c",
  violet: "#b794f6",
  pink: "#f78fb3",
};

export function HeroNumberCard(props: {
  value: string | number;
  label: string;
  sublabel?: string | null;
  unit?: string;
  accent?: AccentColor;
  className?: string;
}) {
  const { value, label, sublabel, unit, accent = "default", className = "" } = props;
  const color = ACCENT_HEX[accent];
  return (
    <StatCard className={className}>
      <p
        className="font-semibold leading-[1] tracking-tight"
        style={{ ...MONO_STYLE, fontSize: "44px", color }}
      >
        {value}
        {unit ? <span className="ml-1 text-[24px] text-neutral-500">{unit}</span> : null}
      </p>
      <p className="mt-3 text-[14px] font-semibold leading-[18px] text-white">{label}</p>
      {sublabel ? (
        <p className="mt-1 text-[12px] leading-[16px] text-neutral-500">{sublabel}</p>
      ) : null}
    </StatCard>
  );
}

/* -------------------------------------------------------------- */
/* Highlight (artist/song/venue spotlight)                         */
/* -------------------------------------------------------------- */

export function SpotlightCard(props: {
  eyebrow: string;
  title: string;
  value: string;
  context?: string | null;
  className?: string;
}) {
  const { eyebrow, title, value, context, className = "" } = props;
  return (
    <StatCard className={className}>
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
        {eyebrow}
      </p>
      <p
        className="mt-2 line-clamp-2 text-[24px] font-semibold leading-[28px] tracking-tight text-white"
        style={MONO_STYLE}
      >
        {title}
      </p>
      <p className="mt-2 text-[14px] font-semibold text-[#ffd166]">{value}</p>
      {context ? (
        <p className="mt-1 text-[12px] leading-[16px] text-neutral-500">{context}</p>
      ) : null}
    </StatCard>
  );
}

/* -------------------------------------------------------------- */
/* Ranked list (with bars)                                         */
/* -------------------------------------------------------------- */

export type RankedItem = {
  name: string;
  value: number;
  detail?: string | null;
};

export function RankedList(props: {
  items: RankedItem[];
  emptyText?: string;
  /** Max rows to render. */
  max?: number;
  /** Optional value formatter for the right-side number. */
  formatValue?: (v: number) => string;
  /** When true, render visual bars proportional to the top value. */
  showBars?: boolean;
  /** Color used for the proportional bar fill. Defaults to muted white. */
  accent?: AccentColor;
}) {
  const {
    items,
    emptyText = "—",
    max = 5,
    formatValue,
    showBars = true,
    accent = "default",
  } = props;
  if (!items?.length) {
    return <p className="px-1 text-sm text-neutral-500">{emptyText}</p>;
  }
  const slice = items.slice(0, max);
  const top = Math.max(...slice.map((i) => i.value), 1);
  const color = ACCENT_HEX[accent];
  const barBg = accent === "default" ? "rgba(255,255,255,0.05)" : `${color}22`;
  const numColor = accent === "default" ? "#d4d4d4" : color;

  return (
    <ul className="space-y-2">
      {slice.map((item, i) => {
        const pct = Math.max(8, Math.round((item.value / top) * 100));
        return (
          <li key={`${item.name}-${i}`} className="relative">
            <div className="relative flex items-center justify-between gap-3 rounded-[10px] bg-white/[0.03] px-3 py-2">
              {showBars ? (
                <div
                  className="absolute left-0 top-0 h-full rounded-[10px]"
                  style={{ width: `${pct}%`, background: barBg }}
                />
              ) : null}
              <div className="relative z-10 flex min-w-0 items-center gap-3">
                <span
                  className="w-5 shrink-0 text-[12px] font-medium"
                  style={{ ...MONO_STYLE, color: accent === "default" ? "#737373" : color }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 truncate text-[14px] font-medium text-white">
                  {item.name}
                </span>
              </div>
              <span
                className="relative z-10 shrink-0 text-[13px] font-semibold"
                style={{ ...MONO_STYLE, color: numColor }}
              >
                {item.detail ?? (formatValue ? formatValue(item.value) : item.value)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------- */
/* Chip cloud (compact, no bars)                                   */
/* -------------------------------------------------------------- */

export function ChipList(props: {
  items: { name: string; detail?: string | null }[];
  emptyText?: string;
  accent?: AccentColor;
  max?: number;
}) {
  const { items, emptyText = "—", accent = "default", max = 24 } = props;
  if (!items?.length) {
    return <p className="px-1 text-sm text-neutral-500">{emptyText}</p>;
  }
  const color = ACCENT_HEX[accent];
  const slice = items.slice(0, max);
  return (
    <div className="flex flex-wrap gap-1.5">
      {slice.map((item, i) => (
        <span
          key={`${item.name}-${i}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] px-2.5 py-1 text-[12px] font-medium text-white"
          style={{ background: accent === "default" ? "rgba(255,255,255,0.04)" : `${color}1f` }}
        >
          {item.name}
          {item.detail ? (
            <span className="text-[10px] font-normal text-neutral-500" style={MONO_STYLE}>
              {item.detail}
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- */
/* Bar chart (horizontal categorical)                              */
/* -------------------------------------------------------------- */

export function BarChart(props: {
  data: { label: string; value: number; sublabel?: string }[];
  /** Optional value formatter for the displayed number. */
  formatValue?: (v: number) => string;
  emptyText?: string;
  accent?: AccentColor;
}) {
  const { data, formatValue, emptyText = "—", accent = "blue" } = props;
  if (!data.length) return <p className="text-sm text-neutral-500">{emptyText}</p>;
  const top = Math.max(...data.map((d) => d.value), 1);
  const color = ACCENT_HEX[accent];
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => {
        const pct = top > 0 ? (d.value / top) * 100 : 0;
        return (
          <div key={`${d.label}-${i}`}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[12px] font-medium text-neutral-400">
                {d.label}
              </span>
              <span
                className="shrink-0 text-[12px] font-semibold"
                style={{ ...MONO_STYLE, color }}
              >
                {formatValue ? formatValue(d.value) : d.value}
              </span>
            </div>
            <div className="h-[6px] w-full overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(pct, d.value > 0 ? 4 : 0)}%`,
                  background: `linear-gradient(90deg, ${color} 0%, ${color}88 100%)`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- */
/* Vertical mini bars (calendar-like)                              */
/* -------------------------------------------------------------- */

export function MiniBars(props: {
  data: { label: string; value: number }[];
  height?: number;
  accentColor?: string;
  /** Show count above each non-zero bar (default true). */
  showValues?: boolean;
}) {
  const { data, height = 96, accentColor = "#ffd166", showValues = true } = props;
  const top = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-1.5">
      {data.map((d, i) => {
        const h = top > 0 ? Math.max(d.value > 0 ? 4 : 2, (d.value / top) * height) : 2;
        return (
          <div key={`${d.label}-${i}`} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className="flex w-full flex-col items-center justify-end"
              style={{ height: `${height}px` }}
            >
              {showValues && d.value > 0 ? (
                <span className="mb-1 text-[10px] leading-[12px] tabular-nums text-neutral-500">
                  {d.value}
                </span>
              ) : null}
              <div
                className="w-full rounded-[3px]"
                style={{
                  height: `${h}px`,
                  background:
                    d.value > 0
                      ? `linear-gradient(180deg, ${accentColor} 0%, ${accentColor}66 100%)`
                      : "rgba(255,255,255,0.05)",
                }}
              />
            </div>
            <span className="text-[10px] leading-[12px] text-neutral-500">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- */
/* Donut (for two-three way ratio)                                 */
/* -------------------------------------------------------------- */

export function DonutRatio(props: {
  parts: { label: string; value: number; color: string }[];
  centerTop?: string;
  centerBottom?: string;
  size?: number;
}) {
  const { parts, centerTop, centerBottom, size = 140 } = props;
  const total = parts.reduce((acc, p) => acc + p.value, 0);
  const radius = (size - 18) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={14}
        />
        {total > 0
          ? parts.map((p, i) => {
              const portion = p.value / total;
              const dash = portion * circumference;
              const seg = (
                <circle
                  key={`${p.label}-${i}`}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={p.color}
                  strokeWidth={14}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += dash;
              return seg;
            })
          : null}
      </svg>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {centerTop ? (
          <p
            className="text-[28px] font-semibold leading-[32px] text-white"
            style={MONO_STYLE}
          >
            {centerTop}
          </p>
        ) : null}
        {centerBottom ? (
          <p className="text-[12px] text-neutral-500">{centerBottom}</p>
        ) : null}
        <ul className="mt-1 space-y-1.5">
          {parts.map((p, i) => {
            const pct = total > 0 ? Math.round((p.value / total) * 100) : 0;
            return (
              <li
                key={`${p.label}-${i}`}
                className="flex items-center gap-2 text-[12px]"
              >
                <span
                  className="inline-block size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                <span className="min-w-0 flex-1 truncate text-neutral-300">{p.label}</span>
                <span className="font-semibold text-white" style={MONO_STYLE}>
                  {pct}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- */
/* Line chart (trend)                                              */
/* -------------------------------------------------------------- */

export function TrendChart(props: {
  data: { label: string; value: number }[];
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const { data, height = 100, formatValue } = props;
  if (data.length === 0) return <p className="text-sm text-neutral-500">—</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;
  const width = 320;
  const step = data.length > 1 ? width / (data.length - 1) : 0;
  const points = data.map((d, i) => {
    const x = i * step;
    const y = height - ((d.value - min) / range) * height;
    return [x, y] as const;
  });
  const path = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const area = `${path} L${(points[points.length - 1]?.[0] ?? 0).toFixed(1)} ${height} L0 ${height} Z`;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height + 24}`}
        preserveAspectRatio="none"
        className="h-[120px] w-full"
      >
        <defs>
          <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#7be0a6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#7be0a6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#trendFill)" />
        <path
          d={path}
          fill="none"
          stroke="#7be0a6"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.5} fill="#7be0a6" />
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-neutral-500">
        {data.map((d) => (
          <span key={d.label}>{d.label}</span>
        ))}
      </div>
      {formatValue ? (
        <div className="mt-1 flex justify-between text-[10px] font-semibold text-neutral-400">
          {data.map((d) => (
            <span key={`v-${d.label}`} style={MONO_STYLE}>
              {formatValue(d.value)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- */
/* Compact stat tile (used in 2-col grids)                         */
/* -------------------------------------------------------------- */

export function StatTile(props: {
  value: string | number;
  label: string;
  hint?: string;
  unit?: string;
  className?: string;
}) {
  const { value, label, hint, unit, className = "" } = props;
  return (
    <div
      className={`flex flex-col gap-1 rounded-[14px] border border-white/[0.06] bg-[#1a1a1a] p-3.5 ${className}`}
    >
      <p
        className="font-semibold leading-[1] tracking-tight text-white"
        style={{ ...MONO_STYLE, fontSize: "28px" }}
      >
        {value}
        {unit ? <span className="ml-1 text-[16px] text-neutral-500">{unit}</span> : null}
      </p>
      <p className="text-[12px] font-semibold leading-[15px] text-white">{label}</p>
      {hint ? (
        <p className="text-[11px] leading-[14px] text-neutral-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function formatNumber(n: number | null | undefined, suffix = ""): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n).toLocaleString("en-US")}${suffix}`;
}

export function formatEur(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `€${Math.round(n).toLocaleString("en-US")}`;
}

export function formatHm(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return "—";
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}m`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length <= 10 ? "T12:00:00" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
