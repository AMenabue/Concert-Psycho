import {
  isCombinedBillingArtistName,
  planBillingHeadliners,
} from "@/lib/gigs/billing-headliners";
import {
  extractSetlistPersistMeta,
  parseSetlistSongs,
  setlistEventDateToIso,
  type SlSetlistFull,
} from "@/lib/setlistfm/parse";
import { canonicalVenueFromSetlist } from "@/lib/geo/canonical-location";
import {
  findVenueForSetlistImport,
  searchArtists,
  type ArtistRow,
  type VenueRow,
} from "./actions";

export type SetlistSelectionDraft = {
  importedSetlist: SlSetlistFull;
  parsedSongs: ReturnType<typeof parseSetlistSongs>;
  setlistfmSetlistId: string;
  setlistArtistMbid: string | null;
  concertDate: string;
  tourName: string;
  artistMode: "existing" | "create";
  artistSelected: ArtistRow | null;
  newArtistName: string;
  venueMode: "existing" | "create";
  venueSelected: VenueRow | null;
  newVenueName: string;
  newVenueCity: string;
  newVenueCountry: string;
  newVenueLat: string;
  newVenueLng: string;
  newVenueSetlistfmId: string;
  newVenueSetlistfmUrl: string;
  newVenueCityGeoId: string;
  newVenueState: string;
  newVenueStateCode: string;
  newVenueCountryCode: string;
  lineupArtistNames: string[];
  coHeadlinerArtistNames: string[];
  meta: ReturnType<typeof extractSetlistPersistMeta>;
  displayArtist: string;
  displayVenue: string;
};

export async function applySetlistSelection(sl: SlSetlistFull): Promise<SetlistSelectionDraft> {
  const parsed = parseSetlistSongs(sl);
  const meta = extractSetlistPersistMeta(sl);
  const iso = setlistEventDateToIso(sl.eventDate) ?? "";
  const tourName = sl.tour?.name?.trim() ?? "";

  let artistMode: "existing" | "create" = "create";
  let artistSelected: ArtistRow | null = null;
  let newArtistName = "";
  const aname = sl.artist?.name?.trim() ?? "";
  const ambid = sl.artist?.mbid?.trim() ?? null;

  const billing = planBillingHeadliners(aname);

  if (billing?.isSplit) {
    for (const part of billing.names) {
      const rows = await searchArtists(part);
      const match = rows.find(
        (r) =>
          r.name.toLowerCase() === part.toLowerCase() &&
          !isCombinedBillingArtistName(r.name),
      );
      if (match) {
        artistMode = "existing";
        artistSelected = match;
        break;
      }
    }
    if (!artistSelected) newArtistName = billing.primaryName;
  } else if (aname) {
    const rows = await searchArtists(aname);
    const match =
      rows.find((r) => r.name.toLowerCase() === aname.toLowerCase()) ?? rows[0];
    if (match) {
      artistMode = "existing";
      artistSelected = match;
    } else {
      newArtistName = aname;
    }
  }

  const vName = sl.venue?.name?.trim() ?? "";
  const vCity = sl.venue?.city?.name?.trim() ?? "";
  const vCountry = sl.venue?.city?.country?.name?.trim() ?? "";
  const lat = sl.venue?.city?.coords?.lat;
  const lng = sl.venue?.city?.coords?.long;
  const canonVenue = canonicalVenueFromSetlist({
    name: vName,
    city: vCity,
    country: vCountry,
  });

  let venueMode: "existing" | "create" = "create";
  let venueSelected: VenueRow | null = null;
  let newVenueName = canonVenue.name;
  let newVenueCity = canonVenue.city;
  let newVenueCountry = vCountry;
  let newVenueLat = typeof lat === "number" ? String(lat) : "";
  let newVenueLng = typeof lng === "number" ? String(lng) : "";

  const existingVenue = await findVenueForSetlistImport({
    setlistfmVenueId: meta.venueSetlistfmId,
    name: vName,
    city: vCity,
    country: vCountry,
  });
  if (existingVenue) {
    venueMode = "existing";
    venueSelected = existingVenue;
  }

  const displayArtist =
    billing?.displayName ?? artistSelected?.name ?? newArtistName ?? aname;
  const displayVenue = venueSelected
    ? `${venueSelected.name}, ${venueSelected.city}`
    : [newVenueName, newVenueCity, newVenueCountry].filter(Boolean).join(", ");

  return {
    importedSetlist: sl,
    parsedSongs: parsed,
    setlistfmSetlistId: sl.id ?? "",
    setlistArtistMbid: billing?.isSplit ? null : ambid,
    concertDate: iso,
    tourName,
    artistMode,
    artistSelected,
    newArtistName,
    venueMode,
    venueSelected,
    newVenueName,
    newVenueCity,
    newVenueCountry,
    newVenueLat,
    newVenueLng,
    newVenueSetlistfmId: meta.venueSetlistfmId ?? "",
    newVenueSetlistfmUrl: meta.venueUrl ?? "",
    newVenueCityGeoId: meta.cityGeoId ?? "",
    newVenueState: meta.state ?? "",
    newVenueStateCode: meta.stateCode ?? "",
    newVenueCountryCode: meta.countryCode ?? "",
    lineupArtistNames: [],
    coHeadlinerArtistNames: billing?.coHeadlinerNames ?? [],
    meta,
    displayArtist,
    displayVenue,
  };
}
