"use client";

import { FoldedMapIcon } from "@/components/icons/folded-map-icon";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import type { VenueHeatMapPoint } from "@/components/map/venue-heat-map";
import type { FlightyAppHomePayload } from "../app-home-payload";
import { FlightyFrame82 } from "../flighty-frame-82";

/** Stesso stile dei tab Settings / Add Concert (dark). */
const mapToggleBtnClass =
  "box-border flex size-[38px] shrink-0 items-center justify-center rounded-[11px] border border-solid border-[#414141] bg-[#262626] text-white/90 shadow-none transition-colors hover:bg-[#303030] hover:text-white";

const VenueHeatMap = dynamic(
  () =>
    import("@/components/map/venue-heat-map").then((m) => m.VenueHeatMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse bg-neutral-900" aria-hidden />
    ),
  },
);

const sheetShadow =
  "shadow-[0px_4px_4px_rgba(0,0,0,0.25),0px_-204px_82px_rgba(0,0,0,0.01),0px_-115px_69px_rgba(0,0,0,0.05),0px_-51px_51px_rgba(0,0,0,0.09)]";

type Props = {
  points: VenueHeatMapPoint[];
  appHome: FlightyAppHomePayload | null;
};

export default function FlightyHomeClient({ points, appHome }: Props) {
  const [mapRevealed, setMapRevealed] = useState(false);
  const reveal = useCallback(() => setMapRevealed(true), []);
  const conceal = useCallback(() => setMapRevealed(false), []);
  const toggleMap = useCallback(() => setMapRevealed((v) => !v), []);

  const sheetClass = [
    "fixed left-1/2 z-30 flex w-full max-w-[430px] -translate-x-1/2 flex-col overflow-hidden rounded-t-[15px] border-2 border-[rgba(31,31,31,0.46)]",
    sheetShadow,
    "backdrop-blur-[35.25px] transition-[top,background-color] duration-300 ease-out",
    "bg-[rgba(19,19,19,0.99)]",
    mapRevealed ? "top-[min(622px,58vh)]" : "top-[230px]",
    "bottom-0",
  ].join(" ");

  return (
    <div className="relative mx-auto flex h-[100dvh] max-h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-black">
      <div className="absolute inset-0 z-0 min-h-0">
        {points.length > 0 ? (
          <VenueHeatMap
            fill
            mapInteractive={mapRevealed}
            showPopups={mapRevealed}
            points={points}
            className="h-full w-full"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-neutral-950 px-6 text-center text-sm text-neutral-500">
            <p>No venues with coordinates for the heat map.</p>
            <p className="text-xs text-neutral-600">
              Sign in and add concerts with latitude/longitude on venues to see your heat map here.
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={toggleMap}
        aria-label={mapRevealed ? "Mostra di nuovo la scheda" : "Mostra la heat map"}
        className={`absolute right-5 top-[47px] z-40 ${mapToggleBtnClass}`}
      >
        <FoldedMapIcon className="shrink-0" />
      </button>

      <div className={sheetClass}>
        <FlightyFrame82
          variant="dark"
          embedInSheet
          rootLayoutClassName="relative h-full min-h-0 w-full flex-1 bg-transparent"
          useChevronMapToggle
          mapExpanded={mapRevealed}
          cardsScrollLocked={mapRevealed}
          onRevealMap={reveal}
          onCollapseMap={conceal}
          onMapToggle={toggleMap}
          appHome={appHome}
        />
      </div>
    </div>
  );
}
