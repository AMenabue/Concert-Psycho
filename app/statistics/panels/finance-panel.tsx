import type { ConcertRef, FinanceStats } from "../data";
import {
  BarChart,
  HeroNumberCard,
  SectionTitle,
  StatCard,
  StatTile,
  TrendChart,
  formatDate,
  formatEur,
} from "@/components/stats/stat-primitives";

const MONO_STYLE = { fontFamily: "var(--font-flighty-chivo), ui-monospace, monospace" };

const FINANCE_CARD_EYEBROW_CLASS =
  "min-h-[32px] text-[11px] font-medium uppercase leading-[14px] tracking-[0.12em] text-neutral-500";

function concertPlaceLine(ref: ConcertRef): string | null {
  const place = [ref.venueName, ref.city].filter(Boolean).join(", ");
  return place || null;
}

function ConcertWhereAndDate({ concert }: { concert: ConcertRef }) {
  const place = concertPlaceLine(concert);
  const date = formatDate(concert.date);
  if (!place && date === "—") return null;
  return (
    <div className="mt-1 flex flex-col gap-0.5 text-[12px] leading-[16px] text-neutral-500">
      {place ? <p className="line-clamp-2">{place}</p> : null}
      {date !== "—" ? <p>{date}</p> : null}
    </div>
  );
}

function FinanceTicketCard(props: {
  eyebrow: string;
  concert: ConcertRef;
  priceEur: number;
  priceColor: string;
}) {
  const { eyebrow, concert, priceEur, priceColor } = props;
  return (
    <StatCard>
      <p className={FINANCE_CARD_EYEBROW_CLASS}>{eyebrow}</p>
      <p className="mt-2 line-clamp-2 text-[16px] font-semibold text-white">{concert.artistName}</p>
      <p
        className="mt-1 text-[24px] font-semibold leading-[28px] tracking-tight"
        style={{ ...MONO_STYLE, color: priceColor }}
      >
        {formatEur(priceEur)}
      </p>
      <ConcertWhereAndDate concert={concert} />
    </StatCard>
  );
}

function PerMinuteShowCard(props: {
  eyebrow: string;
  concert: ConcertRef;
  eurPerMin: number;
  priceColor: string;
}) {
  const { eyebrow, concert, eurPerMin, priceColor } = props;
  return (
    <StatCard>
      <p className={FINANCE_CARD_EYEBROW_CLASS}>{eyebrow}</p>
      <p className="mt-2 line-clamp-2 text-[16px] font-semibold text-white">{concert.artistName}</p>
      <p className="mt-1 text-[13px] font-semibold" style={{ ...MONO_STYLE, color: priceColor }}>
        €{eurPerMin.toFixed(2)} / min
      </p>
      <ConcertWhereAndDate concert={concert} />
    </StatCard>
  );
}

function PerMinuteAverageCard(props: { eurPerMin: number }) {
  return (
    <StatCard>
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
        Average
      </p>
      <p className="mt-2 text-[24px] font-semibold leading-[28px] tracking-tight text-white" style={MONO_STYLE}>
        €{props.eurPerMin.toFixed(2)} / min
      </p>
      <p className="mt-1 text-[12px] leading-[16px] text-neutral-500">
        Across logged shows with ticket and duration
      </p>
    </StatCard>
  );
}

export function FinancePanel({ data }: { data: FinanceStats }) {
  const hasFinance = data.totalSpentEur > 0 || data.mostExpensive != null;

  if (!hasFinance) {
    return (
      <div className="px-1 py-4">
        <p className="text-sm text-neutral-500">No ticket prices logged yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      {hasFinance ? (
        <HeroNumberCard
          value={formatEur(data.totalSpentEur)}
          label="Total spent on tickets"
          sublabel="lifetime, EUR tickets only"
          accent="orange"
        />
      ) : null}

      <StatTile
        value={data.avgTicketEur != null ? formatEur(data.avgTicketEur) : "—"}
        label="Average ticket"
        hint="across logged tickets"
      />

      {data.mostExpensive || data.cheapest ? (
        <div className="grid grid-cols-2 gap-2.5">
          {data.mostExpensive ? (
            <FinanceTicketCard
              eyebrow="Most expensive ticket"
              concert={data.mostExpensive.ref}
              priceEur={data.mostExpensive.eur}
              priceColor="#ffd166"
            />
          ) : null}
          {data.cheapest ? (
            <FinanceTicketCard
              eyebrow="Cheapest ticket"
              concert={data.cheapest.ref}
              priceEur={data.cheapest.eur}
              priceColor="#7be0a6"
            />
          ) : null}
        </div>
      ) : null}

      {data.avgPricePerYear.length >= 2 ? (
        <div>
          <SectionTitle eyebrow="Trend">Average ticket price per year</SectionTitle>
          <StatCard>
            <TrendChart
              data={data.avgPricePerYear.map((y) => ({
                label: String(y.year),
                value: Math.round(y.eur),
              }))}
              formatValue={(v) => `€${v}`}
            />
          </StatCard>
        </div>
      ) : null}

      {data.topSpendByArtist.length > 0 ? (
        <div>
          <SectionTitle eyebrow="Per artist">Most spent on artists</SectionTitle>
          <StatCard>
            <BarChart
              data={data.topSpendByArtist.slice(0, 6).map((a) => ({
                label: a.name,
                value: a.value,
              }))}
              formatValue={(v) => `€${v.toLocaleString("en-US")}`}
              accent="orange"
            />
          </StatCard>
        </div>
      ) : null}

      {data.cheapestPerMin || data.mostExpensivePerMin || data.avgEurPerMin != null ? (
        <div>
          <SectionTitle eyebrow="Pricing">Cost per minute of music</SectionTitle>
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              {data.mostExpensivePerMin ? (
                <PerMinuteShowCard
                  eyebrow="Most expensive"
                  concert={data.mostExpensivePerMin.ref}
                  eurPerMin={data.mostExpensivePerMin.eurPerMin}
                  priceColor="#ffd166"
                />
              ) : null}
              {data.cheapestPerMin ? (
                <PerMinuteShowCard
                  eyebrow="Cheapest"
                  concert={data.cheapestPerMin.ref}
                  eurPerMin={data.cheapestPerMin.eurPerMin}
                  priceColor="#7be0a6"
                />
              ) : null}
            </div>
            {data.avgEurPerMin != null ? (
              <PerMinuteAverageCard eurPerMin={data.avgEurPerMin} />
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="px-1 text-[11px] text-neutral-500">
        Tickets logged in non‑EUR currencies are excluded from these totals.
      </div>
    </div>
  );
}
