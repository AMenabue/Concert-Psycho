import type { AdvanceHighlight, ConcertsStats } from "../data";
import {
  BarChart,
  DonutRatio,
  HeroNumberCard,
  MiniBars,
  SectionTitle,
  SpotlightCard,
  StatCard,
  StatTile,
  formatDate,
  formatHm,
  formatNumber,
} from "@/components/stats/stat-primitives";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** JS `getUTCDay()`: 0=Sun … 6=Sat — chart displays Mon → Sun. */
const DOW_JS_ORDER_MON_FIRST = [1, 2, 3, 4, 5, 6, 0] as const;
const DOW_LABELS_MON_FIRST = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function perDayOfWeekMonFirst(rows: { dow: number; count: number }[]) {
  const byDow = new Map(rows.map((r) => [r.dow, r.count]));
  return DOW_JS_ORDER_MON_FIRST.map((dow, i) => ({
    label: DOW_LABELS_MON_FIRST[i].slice(0, 1),
    value: byDow.get(dow) ?? 0,
  }));
}

const MONO_STYLE = { fontFamily: "var(--font-flighty-chivo), ui-monospace, monospace" };

export function ConcertsPanel({ data }: { data: ConcertsStats }) {
  if (data.total === 0) {
    return (
      <div className="px-1 py-4">
        <p className="text-sm text-neutral-500">No concerts logged yet.</p>
      </div>
    );
  }

  const monthName = (m: number | null | undefined) =>
    m != null && m >= 0 && m < 12 ? MONTH_LABELS[m] : "—";

  return (
    <div className="flex flex-col gap-6 pb-12">
      <HeroNumberCard
        value={formatNumber(data.total)}
        label="Concerts attended"
        sublabel={
          data.firstEver && data.latest
            ? `From ${formatDate(data.firstEver.date)} to ${formatDate(data.latest.date)}`
            : null
        }
        accent="yellow"
      />

      <div className="grid grid-cols-2 gap-2.5">
        <StatTile
          value={data.mostActiveYear ? data.mostActiveYear.year : "—"}
          label="Most active year"
          hint={
            data.mostActiveYear
              ? `${data.mostActiveYear.count} concerts`
              : undefined
          }
        />
        <StatTile
          value={monthName(data.mostActiveMonth?.month)}
          label="Top month"
          hint={
            data.mostActiveMonth
              ? `${data.mostActiveMonth.count} shows over the years`
              : undefined
          }
        />
        <StatTile
          value={formatNumber(data.longestMonthStreak)}
          label="Longest streak"
          hint="consecutive months with a show"
        />
        <StatTile
          value={formatNumber(data.longestGapDays)}
          label="Longest gap"
          hint="days between two shows"
          unit="d"
        />
      </div>

      {data.perYear.length > 0 ? (
        <div>
          <SectionTitle eyebrow="Activity">By year</SectionTitle>
          <StatCard>
            <BarChart
              data={data.perYear.map((y) => ({
                label: String(y.year),
                value: y.count,
              }))}
              formatValue={(v) => `${v}`}
            />
          </StatCard>
        </div>
      ) : null}

      <div>
        <SectionTitle eyebrow="Seasonality">By month</SectionTitle>
        <StatCard>
          <MiniBars
            data={data.perMonth.map((m) => ({
              label: MONTH_LABELS[m.month].slice(0, 1),
              value: m.count,
            }))}
            height={80}
          />
        </StatCard>
      </div>

      <div>
        <SectionTitle eyebrow="Schedule">By day of week</SectionTitle>
        <StatCard>
          <MiniBars
            data={perDayOfWeekMonFirst(data.perDayOfWeek)}
            height={70}
            accentColor="#7aa2ff"
          />
        </StatCard>
      </div>

      {(data.totalMusicMinutes > 0 || data.longestShow != null) && (
        <div>
          <SectionTitle eyebrow="Duration">Hours of music</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5">
            <StatTile
              value={formatHm(data.totalMusicMinutes)}
              label="Total hours of music"
              hint="from logged shows"
            />
            {data.longestShow ? (
              <StatTile
                value={formatHm(data.longestShow.minutes)}
                label="Longest show"
                hint={data.longestShow.ref.artistName}
              />
            ) : (
              <StatTile value="—" label="Longest show" />
            )}
          </div>
        </div>
      )}

      {(data.mostDaysBoughtInAdvance ||
        data.fewestDaysBoughtInAdvance ||
        data.avgDaysBetween != null ||
        data.avgDaysBoughtInAdvance != null) && (
        <div>
          <SectionTitle eyebrow="Timing">Planning &amp; pacing</SectionTitle>

          {data.mostDaysBoughtInAdvance || data.fewestDaysBoughtInAdvance ? (
            <div className="grid grid-cols-2 gap-2.5">
              {data.mostDaysBoughtInAdvance ? (
                <AdvanceTicketCard
                  label="Most in advance"
                  highlight={data.mostDaysBoughtInAdvance}
                  accent="#7aa2ff"
                />
              ) : (
                <AdvanceTicketCardEmpty label="Most in advance" />
              )}
              {data.fewestDaysBoughtInAdvance ? (
                <AdvanceTicketCard
                  label="Closest to show"
                  highlight={data.fewestDaysBoughtInAdvance}
                  accent="#ffd166"
                />
              ) : (
                <AdvanceTicketCardEmpty label="Closest to show" />
              )}
            </div>
          ) : null}

          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            {data.avgDaysBetween != null ? (
              <StatTile
                value={formatNumber(data.avgDaysBetween)}
                label="Avg days between concerts"
                hint="across your full history"
                unit="d"
              />
            ) : null}
            {data.avgDaysBoughtInAdvance != null ? (
              <StatTile
                value={formatNumber(data.avgDaysBoughtInAdvance)}
                label="Avg ticket lead time"
                hint="when purchase date is logged"
                unit="d"
              />
            ) : null}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <StatCard>
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            Format
          </p>
          <DonutRatio
            parts={[
              { label: "Single concerts", value: data.singleConcerts, color: "#7aa2ff" },
              { label: "Festivals", value: data.festivals, color: "#ffd166" },
            ]}
            centerTop={formatNumber(data.total)}
            centerBottom="total shows"
            size={120}
          />
        </StatCard>
        <StatCard>
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            Seating
          </p>
          <DonutRatio
            parts={[
              { label: "Standing", value: data.standing, color: "#ff6363" },
              { label: "Seated", value: data.seated, color: "#7be0a6" },
            ]}
            centerTop={`${Math.round((data.standing / Math.max(data.total, 1)) * 100)}%`}
            centerBottom="standing"
            size={120}
          />
        </StatCard>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {data.firstEver ? (
          <SpotlightCard
            eyebrow="First concert ever"
            title={data.firstEver.artistName}
            value={formatDate(data.firstEver.date)}
            context={
              [data.firstEver.venueName, data.firstEver.city]
                .filter(Boolean)
                .join(" · ") || null
            }
          />
        ) : null}
        {data.latest ? (
          <SpotlightCard
            eyebrow="Latest concert"
            title={data.latest.artistName}
            value={formatDate(data.latest.date)}
            context={
              [data.latest.venueName, data.latest.city].filter(Boolean).join(" · ") || null
            }
          />
        ) : null}
      </div>
    </div>
  );
}

function AdvanceTicketCard(props: {
  label: string;
  highlight: AdvanceHighlight;
  accent: string;
}) {
  const { label, highlight, accent } = props;
  const ref = highlight.ref;
  return (
    <StatCard>
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
        {label}
      </p>
      <p
        className="mt-2 text-[28px] font-semibold leading-[1] tracking-tight"
        style={{ ...MONO_STYLE, color: accent }}
      >
        {formatNumber(highlight.days)}
        <span className="ml-1 text-[14px] text-neutral-500">d</span>
      </p>
      <p className="mt-2 line-clamp-2 text-[14px] font-semibold text-white">{ref.artistName}</p>
      <p className="mt-0.5 line-clamp-1 text-[11px] text-neutral-500">
        {[ref.venueName, ref.city].filter(Boolean).join(" · ")}
      </p>
    </StatCard>
  );
}

function AdvanceTicketCardEmpty(props: { label: string }) {
  return (
    <StatCard>
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
        {props.label}
      </p>
      <p className="mt-4 text-sm text-neutral-600">—</p>
    </StatCard>
  );
}
