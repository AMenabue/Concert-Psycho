import type { GuestsAtShowHighlight } from "../data";
import {
  SectionTitle,
  StatCard,
  StatTile,
  formatDate,
  formatNumber,
} from "@/components/stats/stat-primitives";

const MONO_STYLE = { fontFamily: "var(--font-flighty-chivo), ui-monospace, monospace" };

export type SetlistGuestsData = {
  totalUniqueGuests: number;
  avgGuestsPerShow: number | null;
  mostGuestsAtShow: GuestsAtShowHighlight | null;
};

export function SetlistGuestsSection({ data }: { data: SetlistGuestsData }) {
  if (
    !(data.totalUniqueGuests > 0 || data.mostGuestsAtShow || data.avgGuestsPerShow != null)
  ) {
    return null;
  }

  return (
    <div>
      <SectionTitle eyebrow="Setlist">Guests</SectionTitle>
      <div className="grid grid-cols-2 gap-2.5">
        <StatTile
          value={formatNumber(data.totalUniqueGuests)}
          label="Unique guests seen"
          hint="across all your concerts"
        />
        {data.avgGuestsPerShow != null ? (
          <StatTile
            value={formatNumber(data.avgGuestsPerShow)}
            label="Avg guests per show"
            hint="unique per concert"
          />
        ) : (
          <StatTile value="—" label="Avg guests per show" />
        )}
      </div>
      {data.mostGuestsAtShow ? (
        <div className="mt-2.5">
          <GuestShowCard label="Most guests at one show" highlight={data.mostGuestsAtShow} />
        </div>
      ) : null}
    </div>
  );
}

function concertPlaceAndDate(ref: GuestsAtShowHighlight["ref"]): string {
  const place = [ref.venueName, ref.city].filter(Boolean).join(", ");
  const date = formatDate(ref.date);
  return [place, date !== "—" ? date : null].filter(Boolean).join(" · ");
}

function GuestShowCard(props: { label: string; highlight: GuestsAtShowHighlight }) {
  const { label, highlight } = props;
  const ref = highlight.ref;
  return (
    <StatCard>
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
        {label}
      </p>
      <p
        className="mt-2 text-[28px] font-semibold leading-[1] tracking-tight text-[#7be0a6]"
        style={MONO_STYLE}
      >
        {formatNumber(highlight.count)}
      </p>
      <p className="mt-2 line-clamp-2 text-[14px] font-semibold text-white">{ref.artistName}</p>
      <p className="mt-0.5 line-clamp-2 text-[11px] text-neutral-500">
        {concertPlaceAndDate(ref)}
      </p>
    </StatCard>
  );
}
