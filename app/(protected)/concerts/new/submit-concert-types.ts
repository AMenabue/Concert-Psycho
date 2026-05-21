export type SubmitSongRow = {
  title: string;
  position: number;
  isEncore: boolean;
  isCover: boolean;
  isTape?: boolean;
  /** Testo unico per tutti i featuring (con `, `). */
  featuringNames: string | null;
  /** Primo featuring per `guest_artist_id` (legacy); tutti gli ospiti in `featuringGuests`. */
  firstFeaturingName: string | null;
  firstFeaturingMbid: string | null;
  /** Ospiti collegati (nomi + mbid opzionale); se assente si deriva da `featuringNames`. */
  featuringGuests?: { name: string; mbid: string | null }[];
  /** Campo `info` grezzo Setlist.fm. */
  songInfo: string | null;
  /** Etichette tag (Live Debut, …) → tabella `song_tags` + `gig_song_tags`. */
  tagLabels: string[];
  setName: string | null;
  /** Artista originale della cover (solo UI / colonna testo). */
  coverOriginalArtist: string | null;
  coverOriginalArtistMbid?: string | null;
};

export type SubmitNewConcertPayload = {
  artistMode: "existing" | "create";
  artistId?: string;
  newArtistName?: string;
  newArtistGenre?: string;
  venueMode: "existing" | "create";
  venueId?: string;
  newVenueName?: string;
  newVenueCity?: string;
  newVenueCountry?: string;
  newVenueLat?: string;
  newVenueLng?: string;
  newVenueSetlistfmVenueId?: string | null;
  newVenueSetlistfmUrl?: string | null;
  newVenueCityGeoId?: string | null;
  newVenueState?: string | null;
  newVenueStateCode?: string | null;
  newVenueCountryCode?: string | null;
  /** Se true e venue esistente senza id Setlist, aggiorna colonne venue da import. */
  fillVenueSetlistfmFromImport?: boolean;
  importVenueSetlistfmId?: string | null;
  importVenueSetlistfmUrl?: string | null;
  importVenueCityGeoId?: string | null;
  importVenueState?: string | null;
  importVenueStateCode?: string | null;
  importVenueCountryCode?: string | null;
  concertDate: string;
  tourName: string;
  isFestival: boolean;
  sector: string;
  isStanding: boolean;
  ticketPriceEur: string;
  ticketCurrency: string;
  departureCity: string;
  departureCountry: string;
  /** Ticket bought on (DD/MM/YYYY) — stored as days_bought_in_advance. */
  ticketPurchasedOn?: string;
  /** Opening acts (not co-headliners) → `gig_lineup_artists`. */
  lineupArtistNames: string[];
  /** Setlist joint billing co-headliners (e.g. "A & B" → second name). */
  coHeadlinerArtistNames?: string[];
  source?: "manual" | "setlistfm_import";
  setlistfmSetlistId?: string | null;
  setlistfmArtistMbid?: string | null;
  setlistfmVersionId?: string | null;
  setlistfmLastUpdated?: string | null;
  setlistfmUrl?: string | null;
  setlistfmArtistUrl?: string | null;
  setlistfmVenueUrl?: string | null;
  setlistfmClockJson?: Record<string, unknown> | null;
  setlistfmInfo?: string | null;
  concertDurationMinutes?: number | null;
  songs?: SubmitSongRow[];
};
