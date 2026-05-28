"use client";

import type { VenueHeatmapSpot } from "@/lib/map/venue-heatmap-types";
import {
  buildCityClusters,
  CITY_HEAT_ZOOM_MAX,
  pickHeatmapClickTarget,
  type HeatmapClickSelection,
  type VenueHeatmapCityCluster,
} from "@/lib/map/venue-heatmap-clusters";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";

export type { VenueHeatmapSpot, VenueHeatMapPoint } from "@/lib/map/venue-heatmap-types";

type LWithHeat = typeof L & {
  heatLayer: (
    latlngs: [number, number, number][],
    options?: Record<string, unknown>,
  ) => L.Layer;
};

const MAP_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/**
 * Google Photos–style: cool purple for 1 show → green → yellow → orange → red for many.
 * Warm stops start earlier so 3–4 concerts already read as hot, not all purple when zoomed.
 */
const HEAT_GRADIENT: Record<number, string> = {
  0.0: "#3730a3",
  0.12: "#5b21b6",
  0.28: "#7c3aed",
  0.42: "#06b6d4",
  0.55: "#22c55e",
  0.68: "#a3e635",
  0.8: "#facc15",
  0.9: "#fb923c",
  1.0: "#ef4444",
};

/**
 * Absolute scale by concerts at this venue (not vs global max).
 * 1 = cool purple, 2–3 = green/teal, 4 = orange, 5+ = red.
 */
function heatIntensity01(concertCount: number): number {
  const w = Math.max(1, Math.round(concertCount));
  if (w >= 8) return 1;
  const stops: [number, number][] = [
    [1, 0.24],
    [2, 0.44],
    [3, 0.58],
    [4, 0.78],
    [5, 0.9],
    [8, 1],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [w0, v0] = stops[i]!;
    const [w1, v1] = stops[i + 1]!;
    if (w <= w1) {
      const t = w <= w0 ? 0 : (w - w0) / (w1 - w0);
      return v0 + t * (v1 - v0);
    }
  }
  return 1;
}

function FitBounds({ points }: { points: VenueHeatmapSpot[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const b = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.whenReady(() => {
      map.fitBounds(b, { padding: [32, 32], maxZoom: 14 });
      queueMicrotask(() => map.invalidateSize());
    });
  }, [map, points]);
  return null;
}

function MapInvalidateSize({ tick }: { tick: number }) {
  const map = useMap();
  useEffect(() => {
    const run = () => map.invalidateSize();
    map.whenReady(run);
    const t = window.setTimeout(run, 320);
    return () => window.clearTimeout(t);
  }, [map, tick]);
  return null;
}

function MapFillInteractionSync({ interactive }: { interactive: boolean }) {
  const map = useMap();
  useLayoutEffect(() => {
    const apply = () => {
      if (interactive) {
        map.dragging?.enable();
        map.touchZoom?.enable();
        map.scrollWheelZoom?.enable();
        map.doubleClickZoom?.enable();
        map.boxZoom?.enable();
        map.keyboard?.enable();
        requestAnimationFrame(() => map.invalidateSize());
      } else {
        map.dragging?.disable();
        map.touchZoom?.disable();
        map.scrollWheelZoom?.disable();
        map.doubleClickZoom?.disable();
        map.boxZoom?.disable();
        map.keyboard?.disable();
      }
    };
    if (map.getContainer()?.isConnected) apply();
    else map.whenReady(apply);
  }, [map, interactive]);
  return null;
}

function HeatLayer({ points }: { points: VenueHeatmapSpot[] }) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (points.length === 0) return;

    let cancelled = false;
    const Lh = L as LWithHeat;
    const triples: [number, number, number][] = points.map((p) => [
      p.lat,
      p.lng,
      heatIntensity01(p.weight),
    ]);

    const attach = () => {
      if (cancelled || !map.getContainer().isConnected) return;
      map.invalidateSize();
      const heatLayer = Lh.heatLayer(triples, {
        max: 1,
        minOpacity: 0.38,
        maxZoom: 21,
        radius: 32,
        blur: 18,
        gradient: HEAT_GRADIENT,
      });
      heatLayer.addTo(map);
      layerRef.current = heatLayer;
    };

    map.whenReady(() => {
      requestAnimationFrame(attach);
    });

    return () => {
      cancelled = true;
      const layer = layerRef.current;
      layerRef.current = null;
      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    };
  }, [map, points]);

  return null;
}

const MAP_CARD_GRADIENT =
  "linear-gradient(238.93deg, rgb(206, 223, 240) 4.67%, rgb(195, 199, 248) 68.8%)";
const mapCardSans =
  "font-[family-name:var(--font-flighty-inter),var(--font-passport2-inter),ui-sans-serif,system-ui,sans-serif]";
const mapCardMono = "font-[family-name:var(--font-flighty-chivo),ui-monospace,monospace]";

/** Shared city + venue popup — same header, stats row, list footer. */
function MapHeatPopupCard(props: {
  title: string;
  subtitle?: string;
  concertCount: number;
  artistCount: number;
  listItems: { key: string; label: string; suffix?: string }[];
  moreLabel?: string;
}) {
  const { title, subtitle, concertCount, artistCount, listItems, moreLabel } = props;

  return (
    <div
      className="map-heat-popup-card relative w-[min(252px,calc(100vw-48px))] shrink-0 overflow-hidden rounded-[16px] px-4 py-3.5 text-left shadow-lg ring-1 ring-black/8"
      style={{ backgroundImage: MAP_CARD_GRADIENT }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          background:
            "radial-gradient(ellipse 85% 55% at 10% 0%, rgba(255,255,255,0.5) 0%, transparent 52%)",
        }}
        aria-hidden
      />
      <div className="relative z-[1] flex flex-col gap-2">
        <div className="flex flex-col gap-px">
          <p
            className={`${mapCardSans} m-0 text-[18px] font-semibold leading-[21px] text-[#003c63]`}
          >
            {title}
          </p>
          {subtitle ? (
            <p
              className={`${mapCardSans} m-0 text-[13px] font-light leading-[15px] text-[rgba(25,78,118,0.58)]`}
            >
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="flex flex-row items-start gap-9">
          <MapStatPair label="Concerts" value={String(concertCount)} />
          <MapStatPair label="Artists seen" value={String(artistCount)} />
        </div>

        {listItems.length > 0 ? (
          <ul className="m-0 list-none space-y-px border-t border-[#003c63]/12 p-0 pt-2">
            {listItems.map((item) => (
              <li
                key={item.key}
                className={`${mapCardSans} truncate text-[14px] font-light leading-[16px] text-[#003c63]/90`}
              >
                {item.label}
                {item.suffix ? (
                  <span className="text-[rgba(25,78,118,0.5)]">{item.suffix}</span>
                ) : null}
              </li>
            ))}
            {moreLabel ? (
              <li
                className={`${mapCardSans} pt-px text-[12px] font-light leading-[14px] text-[rgba(25,78,118,0.55)]`}
              >
                {moreLabel}
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function MapStatPair(props: { label: string; value: string }) {
  return (
    <div className="flex w-[68px] shrink-0 flex-col items-start gap-px">
      <span
        className={`${mapCardSans} block text-[12px] font-light leading-[14px] text-[rgba(25,78,118,0.58)]`}
      >
        {props.label}
      </span>
      <span
        className={`${mapCardMono} map-heat-stat-value block text-[20px] font-semibold leading-none tracking-tight text-[#003c63] tabular-nums`}
      >
        {props.value}
      </span>
    </div>
  );
}

function CityHeatPopup({ cluster }: { cluster: VenueHeatmapCityCluster }) {
  const location = [cluster.city, cluster.country].filter(Boolean).join(", ");
  const listedVenues = cluster.venues.slice(0, 8);
  const moreVenues = cluster.venues.length - listedVenues.length;

  return (
    <MapHeatPopupCard
      title={location || "—"}
      concertCount={cluster.concertCount}
      artistCount={cluster.artistNames.length}
      listItems={listedVenues.map((venue) => ({
        key: venue.name,
        label: venue.name,
        suffix: venue.concertCount > 1 ? ` · ${venue.concertCount}` : undefined,
      }))}
      moreLabel={moreVenues > 0 ? `+${moreVenues} more venues` : undefined}
    />
  );
}

function VenueHeatPopup({ spot }: { spot: VenueHeatmapSpot }) {
  const location = [spot.city, spot.country].filter(Boolean).join(", ");
  const artists = spot.artistNames.slice(0, 6);
  const more = spot.artistNames.length - artists.length;

  return (
    <MapHeatPopupCard
      title={spot.venueName}
      subtitle={location || undefined}
      concertCount={spot.concertCount}
      artistCount={spot.artistNames.length}
      listItems={artists.map((name) => ({ key: name, label: name }))}
      moreLabel={more > 0 ? `+${more} more` : undefined}
    />
  );
}

function HeatmapClickLayer({
  points,
  showPopups,
}: {
  points: VenueHeatmapSpot[];
  showPopups: boolean;
}) {
  const map = useMap();
  const clusters = useMemo(() => buildCityClusters(points), [points]);
  const [zoom, setZoom] = useState(() => map.getZoom());
  const [selection, setSelection] = useState<HeatmapClickSelection | null>(null);
  const maxW = Math.max(...points.map((p) => p.weight), 1);

  const syncZoom = useCallback(() => setZoom(map.getZoom()), [map]);

  useEffect(() => {
    syncZoom();
    map.on("zoomend moveend", syncZoom);
    return () => {
      map.off("zoomend moveend", syncZoom);
    };
  }, [map, syncZoom]);

  useEffect(() => {
    setSelection(null);
  }, [zoom]);

  const cityMode = zoom < CITY_HEAT_ZOOM_MAX;

  const selectAt = useCallback(
    (latlng: L.LatLng) => {
      const pick = pickHeatmapClickTarget(map, latlng, points, clusters, zoom);
      if (pick) setSelection(pick);
    },
    [map, points, clusters, zoom],
  );

  useMapEvents({
    click(e) {
      if (!showPopups) return;
      L.DomEvent.stopPropagation(e);
      selectAt(e.latlng);
    },
  });

  const popupPosition: [number, number] | null = selection
    ? selection.kind === "city"
      ? [selection.cluster.lat, selection.cluster.lng]
      : [selection.spot.lat, selection.spot.lng]
    : null;

  return (
    <>
      {cityMode
        ? clusters
            .filter((c) => c.venueCount > 1)
            .map((cluster) => (
              <CircleMarker
                key={`city-${cluster.key}`}
                center={[cluster.lat, cluster.lng]}
                radius={40 + Math.max(0, CITY_HEAT_ZOOM_MAX - zoom) * 6}
                pathOptions={{
                  fillOpacity: 0,
                  opacity: 0,
                  stroke: false,
                  className: "venue-heat-hit",
                }}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e);
                    setSelection({ kind: "city", cluster });
                  },
                }}
              />
            ))
        : points.map((spot) => {
            const t = maxW > 1 ? (spot.weight - 1) / (maxW - 1) : 0;
            const hitRadius = 16 + t * 12;
            return (
              <CircleMarker
                key={`${spot.lat},${spot.lng},${spot.venueName}`}
                center={[spot.lat, spot.lng]}
                radius={hitRadius}
                pathOptions={{
                  fillOpacity: 0,
                  opacity: 0,
                  stroke: false,
                  className: "venue-heat-hit",
                }}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e);
                    setSelection({ kind: "venue", spot });
                  },
                }}
              />
            );
          })}

      {showPopups && selection && popupPosition ? (
        <Popup
          key={
            selection.kind === "city"
              ? `city-${selection.cluster.key}`
              : `venue-${selection.spot.venueName}-${selection.spot.lat}`
          }
          position={popupPosition}
          className="venue-heat-popup"
          closeButton={false}
          autoPan
          minWidth={1}
          maxWidth={280}
          eventHandlers={{ remove: () => setSelection(null) }}
        >
          {selection.kind === "city" ? (
            <CityHeatPopup cluster={selection.cluster} />
          ) : (
            <VenueHeatPopup spot={selection.spot} />
          )}
        </Popup>
      ) : null}
    </>
  );
}

type Props = {
  points: VenueHeatmapSpot[];
  className?: string;
  fill?: boolean;
  mapInteractive?: boolean;
  showPopups?: boolean;
};

export function VenueHeatMap(props: Props) {
  const { points, fill, mapInteractive = false, showPopups = false } = props;

  const mapKey = useMemo(
    () =>
      points
        .map(
          (p) =>
            `${p.lat.toFixed(4)},${p.lng.toFixed(4)},${p.weight},${p.artistNames.length}`,
        )
        .join("|"),
    [points],
  );

  if (points.length === 0) return null;

  const center: [number, number] = [points[0]!.lat, points[0]!.lng];
  const resizeTick = mapInteractive ? 1 : 0;

  const mapEl = (
    <MapContainer
      key={mapKey}
      center={center}
      zoom={5}
      zoomControl={false}
      scrollWheelZoom={fill ? mapInteractive : true}
      className={
        fill
          ? "z-0 h-full w-full overflow-hidden rounded-none border-0 bg-neutral-950"
          : "z-0 h-72 w-full overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950"
      }
      style={fill ? { height: "100%", width: "100%" } : { minHeight: "18rem" }}
    >
      {fill ? (
        <>
          <MapFillInteractionSync interactive={mapInteractive} />
          <MapInvalidateSize tick={resizeTick} />
        </>
      ) : null}
      <TileLayer
        attribution={MAP_TILE_ATTRIBUTION}
        url={MAP_TILE_URL}
        subdomains="abcd"
      />
      <FitBounds points={points} />
      <HeatLayer points={points} />
      <HeatmapClickLayer points={points} showPopups={showPopups} />
    </MapContainer>
  );

  if (fill) {
    return (
      <div className={`h-full min-h-0 w-full min-w-0 ${props.className ?? ""}`}>
        {mapEl}
      </div>
    );
  }

  return <div className={props.className ?? ""}>{mapEl}</div>;
}
