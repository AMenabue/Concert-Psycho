/** Venue point for Leaflet heat layer + click popup (stats, home map). */
export type VenueHeatmapSpot = {
  lat: number;
  lng: number;
  /** Heat intensity = concerts at this venue. */
  weight: number;
  venueName: string;
  city: string;
  country: string;
  concertCount: number;
  artistNames: string[];
};

/** @deprecated alias — use VenueHeatmapSpot */
export type VenueHeatMapPoint = VenueHeatmapSpot;
