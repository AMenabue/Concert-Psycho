import { SectionTitle } from "@/components/stats/stat-primitives";
import type { NamedValue } from "@/app/(protected)/statistics/data";

const MONO_STYLE = { fontFamily: "var(--font-flighty-chivo), ui-monospace, monospace" };

type Props = {
  topByCities: NamedValue[];
  topByCountries: NamedValue[];
  topByVenues: NamedValue[];
};

/** Artist with the widest geographic reach — only axes where count is > 1. */
export function ReachChampions(props: Props) {
  const candidates = [
    { eyebrow: "Cities", top: props.topByCities[0], color: "#7be0a6" },
    { eyebrow: "Countries", top: props.topByCountries[0], color: "#7aa2ff" },
    { eyebrow: "Venues", top: props.topByVenues[0], color: "#ff9d5c" },
  ].filter((c): c is typeof c & { top: NamedValue } =>
    Boolean(c.top && c.top.value > 1),
  );

  if (candidates.length === 0) return null;

  const gridClass =
    candidates.length === 1
      ? "grid grid-cols-1 gap-2"
      : candidates.length === 2
        ? "grid grid-cols-2 gap-2"
        : "grid grid-cols-3 gap-2";

  return (
    <div>
      <SectionTitle eyebrow="Geography">Reach champions</SectionTitle>
      <p className="-mt-2 mb-2 px-1 text-[12px] text-neutral-500">
        Artists you&apos;ve seen in the most different places.
      </p>
      <div className={gridClass}>
        {candidates.map((c) => (
          <ChampionTile
            key={c.eyebrow}
            eyebrow={c.eyebrow}
            top={c.top}
            color={c.color}
          />
        ))}
      </div>
    </div>
  );
}

function ChampionTile(props: {
  eyebrow: string;
  top: NamedValue;
  color: string;
}) {
  const { eyebrow, top, color } = props;
  return (
    <div
      className="flex flex-col gap-1 rounded-[14px] border border-white/[0.06] bg-[#1a1a1a] p-3"
      style={{ borderColor: `${color}33` }}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
        {eyebrow}
      </p>
      <p
        className="text-[22px] font-semibold leading-[1]"
        style={{ ...MONO_STYLE, color }}
      >
        {top.value}
      </p>
      <p
        className="line-clamp-2 text-[12px] font-medium leading-[14px] text-white"
        title={top.name}
      >
        {top.name}
      </p>
    </div>
  );
}
