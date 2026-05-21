"use client";

import type { VenueHeatmapSpot } from "@/lib/map/venue-heatmap-types";
import {
  buildCityClusters,
  CITY_HEAT_ZOOM_MAX,
  pickHeatmapClickTarget,
  type HeatmapClickSelection,
  type VenueHeatmapCityCluster,
} from "@/lib/map/venue-heatmap-clusters";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

function CityHeatPopup({ cluster }: { cluster: VenueHeatmapCityCluster }) {
  const location = [cluster.city, cluster.country].filter(Boolean).join(", ");
  const concertLabel =
    cluster.concertCount === 1
      ? "1 concerto"
      : `${cluster.concertCount} concerti`;
  const artistLabel =
    cluster.artistNames.length === 1
      ? "1 artista visto"
      : `${cluster.artistNames.length} artisti visti`;
  const listedVenues = cluster.venues.slice(0, 8);
  const moreVenues = cluster.venues.length - listedVenues.length;

  return (
    <div className="max-w-[220px] rounded-[12px] border border-white/[0.08] bg-[#1a1a1a] px-3 py-2.5 text-left shadow-md">
      {location ? (
        <p className="text-[14px] font-semibold leading-tight text-white">{location}</p>
      ) : null}
      <p className="mt-1.5 text-[12px] font-medium text-[#7aa2ff]">{concertLabel}</p>
      <p className="mt-0.5 text-[11px] text-neutral-400">{artistLabel}</p>
      {listedVenues.length > 0 ? (
        <ul className="mt-2 space-y-0.5 border-t border-white/[0.06] pt-2">
          {listedVenues.map((venue) => (
            <li
              key={venue.name}
              className="truncate text-[11px] leading-snug text-neutral-300"
            >
              {venue.name}
              {venue.concertCount > 1 ? (
                <span className="text-neutral-500"> · {venue.concertCount}</span>
              ) : null}
            </li>
          ))}
          {moreVenues > 0 ? (
            <li className="text-[10px] text-neutral-600">+{moreVenues} altre venue</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

function VenueHeatPopup({ spot }: { spot: VenueHeatmapSpot }) {
  const location = [spot.city, spot.country].filter(Boolean).join(", ");
  const concertLabel =
    spot.concertCount === 1 ? "1 concert" : `${spot.concertCount} concerts`;
  const artists = spot.artistNames.slice(0, 6);
  const more = spot.artistNames.length - artists.length;

  return (
    <div className="max-w-[188px] rounded-[12px] border border-white/[0.08] bg-[#1a1a1a] px-3 py-2.5 text-left shadow-md">
      <p className="text-[14px] font-semibold leading-tight text-white">{spot.venueName}</p>
      {location ? (
        <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{location}</p>
      ) : null}
      <p className="mt-1.5 text-[12px] font-medium text-[#7aa2ff]">{concertLabel}</p>
      {artists.length > 0 ? (
        <ul className="mt-2 space-y-0.5 border-t border-white/[0.06] pt-2">
          {artists.map((name) => (
            <li
              key={name}
              className="truncate text-[11px] leading-snug text-neutral-400"
              style={{
                fontFamily: "var(--font-flighty-chivo), ui-monospace, monospace",
              }}
            >
              {name}
            </li>
          ))}
          {more > 0 ? (
            <li className="text-[10px] text-neutral-600">+{more} more</li>
          ) : null}
        </ul>
      ) : null}
    </div>
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
                zIndexOffset={2000}
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
                zIndexOffset={2000}
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
          minWidth={160}
          maxWidth={220}
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
