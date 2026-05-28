import { canonicalVenueFromSetlist } from "@/lib/geo/canonical-location";
import { planBillingHeadliners } from "@/lib/gigs/billing-headliners";
import {
  extractSetlistPersistMeta,
  parseSetlistSongs,
  setlistEventDateToIso,
  tagLabelsForConcertSong,
  type SlSetlistFull,
} from "@/lib/setlistfm/parse";
import type { SubmitNewConcertPayload, SubmitSongRow } from "./submit-concert-types";

export function submitSongRowsFromParsedSetlist(sl: SlSetlistFull): SubmitSongRow[] {
  return parseSetlistSongs(sl).map((s) => ({
    title: s.title,
    position: s.position,
    isEncore: s.isEncore,
    isCover: s.isCover,
    isTape: s.isTape,
    featuringNames: s.guestName,
    firstFeaturingName: s.firstFeaturingName,
    firstFeaturingMbid: s.firstFeaturingMbid,
    featuringGuests:
      s.featuringGuestsList.length > 0 ? s.featuringGuestsList : undefined,
    songInfo: s.songInfo,
    tagLabels: tagLabelsForConcertSong(s),
    coverOriginalArtist: s.coverOriginalArtist,
    coverOriginalArtistMbid: s.coverOriginalArtistMbid,
    setName: s.setName,
  }));
}

/** Payload minimo per import automatico (attended / resync brani) — prezzo 0, partenza vuota. */
export function buildAutoImportPayloadFromSetlist(
  sl: SlSetlistFull,
): SubmitNewConcertPayload {
  const meta = extractSetlistPersistMeta(sl);
  const iso = setlistEventDateToIso(sl.eventDate) ?? "";
  const v = sl.venue;
  const cityRaw = v?.city?.name?.trim() ?? "";
  const country = v?.city?.country?.name?.trim() ?? "";
  const canonVenue = canonicalVenueFromSetlist({
    name: v?.name?.trim() ?? "",
    city: cityRaw,
    country,
  });
  const lat = v?.city?.coords?.lat;
  const lng = v?.city?.coords?.long;

  const billing = planBillingHeadliners(sl.artist?.name);
  const setlistMbid = sl.artist?.mbid?.trim() ?? null;

  return {
    artistMode: "create",
    newArtistName: billing?.primaryName ?? sl.artist?.name?.trim() ?? "",
    newArtistGenre: "",
    venueMode: "create",
    newVenueName: canonVenue.name,
    newVenueCity: canonVenue.city,
    newVenueCountry: country,
    newVenueLat: typeof lat === "number" ? String(lat) : "",
    newVenueLng: typeof lng === "number" ? String(lng) : "",
    newVenueSetlistfmVenueId: meta.venueSetlistfmId,
    newVenueSetlistfmUrl: meta.venueUrl,
    newVenueCityGeoId: meta.cityGeoId,
    newVenueState: meta.state,
    newVenueStateCode: meta.stateCode,
    newVenueCountryCode: meta.countryCode,
    concertDate: iso,
    tourName: sl.tour?.name?.trim() ?? "",
    isFestival: false,
    sector: "",
    isStanding: true,
    ticketPriceEur: "",
    ticketCurrency: "EUR",
    departureCity: "",
    departureCountry: "",
    lineupArtistNames: [],
    coHeadlinerArtistNames: billing?.coHeadlinerNames ?? [],
    source: "setlistfm_import",
    setlistfmSetlistId: sl.id?.trim() ?? null,
    setlistfmArtistMbid: billing?.isSplit ? null : setlistMbid,
    setlistfmVersionId: meta.versionId,
    setlistfmLastUpdated: meta.lastUpdatedRaw,
    setlistfmUrl: meta.setlistUrl,
    setlistfmArtistUrl: meta.artistUrl,
    setlistfmVenueUrl: meta.venueUrl,
    setlistfmClockJson: meta.clockJson,
    setlistfmInfo: meta.setlistInfo,
    concertDurationMinutes: meta.durationMinutesInferred,
    songs: submitSongRowsFromParsedSetlist(sl),
  };
}
