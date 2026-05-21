"use client";

import { applySetlistSelection, type SetlistSelectionDraft } from "@/app/(protected)/concerts/new/apply-setlist-selection";
import { submitNewConcertApp } from "@/app/(protected)/concerts/new/actions";
import type { SubmitSongRow } from "@/app/(protected)/concerts/new/submit-concert-types";
import type { DeparturePreset } from "@/app/(protected)/concerts/[id]/actions";
import { ConcertAttendanceFields } from "@/components/add-concert/concert-attendance-fields";
import {
  defaultDeparturePresetId,
  DEPARTURE_OTHER_ID,
} from "@/lib/departure/preset-utils";
import { SetlistBulkImportCard } from "@/components/add-concert/setlist-bulk-import-card";
import { formatConcertDateWithWeekday } from "@/lib/format-concert-date";
import {
  filterSetlistSongsForDisplay,
  tagLabelsForConcertSong,
  type SlSetlistFull,
} from "@/lib/setlistfm/parse";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const SETLIST_FM_DEBOUNCE_MS = 1000;

const cardClass =
  "rounded-[16px] border border-white/[0.08] bg-white/[0.04] p-5 shadow-sm";

const inputClass =
  "mt-1.5 w-full rounded-[10px] border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-white/25 focus:ring-1 focus:ring-white/20";

type SetlistSearchHit = {
  id: string;
  eventDate: string;
  venueName: string | null;
  cityName: string | null;
  countryName: string | null;
  tourName: string | null;
  totalSongs: number;
  artistName: string;
};

type Props = {
  setlistfmUserId: string | null;
  departurePresets: DeparturePreset[];
};

export function AddConcertClient(props: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const [slArtist, setSlArtist] = useState("");
  const [slDate, setSlDate] = useState("");
  const [slLoading, setSlLoading] = useState(false);
  const [slPickLoading, setSlPickLoading] = useState(false);
  const [slDelay, setSlDelay] = useState(false);
  const [slError, setSlError] = useState<string | null>(null);
  const [slResults, setSlResults] = useState<SetlistSearchHit[]>([]);
  const [draft, setDraft] = useState<SetlistSelectionDraft | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isStanding, setIsStanding] = useState(true);
  const [ticketEur, setTicketEur] = useState("");
  const [ticketCur, setTicketCur] = useState("EUR");
  const [departurePresetId, setDeparturePresetId] = useState(() =>
    defaultDeparturePresetId(props.departurePresets),
  );
  const [depCity, setDepCity] = useState("");
  const [depCountry, setDepCountry] = useState("");
  const [ticketPurchasedOn, setTicketPurchasedOn] = useState("");

  useEffect(() => {
    const id = defaultDeparturePresetId(props.departurePresets);
    setDeparturePresetId(id);
    const p = props.departurePresets.find((x) => x.id === id);
    if (p && id !== DEPARTURE_OTHER_ID) {
      setDepCity(p.city);
      setDepCountry(p.country);
    }
  }, [props.departurePresets]);

  function clearSelection() {
    setDraft(null);
    setSlResults([]);
    setSlError(null);
  }

  function scheduleSearch() {
    setSlError(null);
    if (!slArtist.trim() || !slDate.trim()) {
      setSlError("Enter artist name and concert date.");
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (pickTimer.current) clearTimeout(pickTimer.current);
    setSlDelay(true);
    searchTimer.current = setTimeout(() => {
      searchTimer.current = null;
      setSlDelay(false);
      void runSearch();
    }, SETLIST_FM_DEBOUNCE_MS);
  }

  async function runSearch() {
    setSlResults([]);
    setSlLoading(true);
    try {
      const res = await fetch(
        `/api/setlistfm/search-setlists?artistName=${encodeURIComponent(slArtist.trim())}&date=${encodeURIComponent(slDate.trim())}`,
      );
      const json = (await res.json()) as { error?: string; setlists?: SetlistSearchHit[] };
      if (!res.ok) {
        setSlError(json.error ?? "Setlist.fm search failed.");
        return;
      }
      const list = json.setlists ?? [];
      if (list.length === 0) setSlError("No shows found — try another artist or date.");
      else setSlResults(list);
    } catch {
      setSlError("Network error — try again.");
    } finally {
      setSlLoading(false);
    }
  }

  function schedulePick(id: string) {
    if (pickTimer.current) clearTimeout(pickTimer.current);
    setSlDelay(true);
    pickTimer.current = setTimeout(() => {
      pickTimer.current = null;
      setSlDelay(false);
      void runPick(id);
    }, SETLIST_FM_DEBOUNCE_MS);
  }

  async function runPick(id: string) {
    setSlPickLoading(true);
    setSlError(null);
    try {
      const res = await fetch(`/api/setlistfm/setlist?id=${encodeURIComponent(id)}`);
      const json = await res.json();
      if (!res.ok) {
        setSlError((json as { error?: string }).error ?? "Could not load this show.");
        return;
      }
      const next = await applySetlistSelection(json as SlSetlistFull);
      setDraft(next);
      setSlResults([]);
    } catch {
      setSlError("Could not load show details.");
    } finally {
      setSlPickLoading(false);
    }
  }

  function buildSongsPayload(): SubmitSongRow[] {
    if (!draft) return [];
    return draft.parsedSongs.map((s) => ({
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

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!draft) {
      setFormError("Search and confirm a show on Setlist.fm first.");
      return;
    }
    if (!ticketEur.trim()) {
      setFormError("Ticket price is required.");
      return;
    }

    const meta = draft.meta;
    startTransition(async () => {
      const result = await submitNewConcertApp({
        artistMode: draft.artistMode,
        artistId: draft.artistSelected?.id,
        newArtistName: draft.newArtistName,
        newArtistGenre: "",
        venueMode: draft.venueMode,
        venueId: draft.venueSelected?.id,
        newVenueName: draft.newVenueName,
        newVenueCity: draft.newVenueCity,
        newVenueCountry: draft.newVenueCountry,
        newVenueLat: draft.newVenueLat,
        newVenueLng: draft.newVenueLng,
        newVenueSetlistfmVenueId:
          draft.venueMode === "create" ? draft.newVenueSetlistfmId.trim() || null : null,
        newVenueSetlistfmUrl:
          draft.venueMode === "create" ? draft.newVenueSetlistfmUrl.trim() || null : null,
        newVenueCityGeoId:
          draft.venueMode === "create" ? draft.newVenueCityGeoId.trim() || null : null,
        newVenueState: draft.venueMode === "create" ? draft.newVenueState.trim() || null : null,
        newVenueStateCode:
          draft.venueMode === "create" ? draft.newVenueStateCode.trim() || null : null,
        newVenueCountryCode:
          draft.venueMode === "create" ? draft.newVenueCountryCode.trim() || null : null,
        fillVenueSetlistfmFromImport:
          draft.venueMode === "existing" &&
          !!draft.venueSelected &&
          !draft.venueSelected.setlistfm_venue_id &&
          !!meta?.venueSetlistfmId?.trim(),
        importVenueSetlistfmId: meta?.venueSetlistfmId ?? null,
        importVenueSetlistfmUrl: meta?.venueUrl ?? null,
        importVenueCityGeoId: meta?.cityGeoId ?? null,
        importVenueState: meta?.state ?? null,
        importVenueStateCode: meta?.stateCode ?? null,
        importVenueCountryCode: meta?.countryCode ?? null,
        concertDate: draft.concertDate,
        tourName: draft.tourName,
        isFestival: false,
        sector: "",
        isStanding,
        ticketPriceEur: ticketEur,
        ticketCurrency: ticketCur,
        departureCity: depCity,
        departureCountry: depCountry,
        ticketPurchasedOn: ticketPurchasedOn.trim() || undefined,
        lineupArtistNames: draft.lineupArtistNames,
        coHeadlinerArtistNames: draft.coHeadlinerArtistNames,
        source: "setlistfm_import",
        setlistfmSetlistId: draft.setlistfmSetlistId,
        setlistfmArtistMbid:
          draft.coHeadlinerArtistNames.length > 0 ? null : draft.setlistArtistMbid,
        setlistfmVersionId: meta?.versionId ?? null,
        setlistfmLastUpdated: meta?.lastUpdatedRaw ?? null,
        setlistfmUrl: meta?.setlistUrl ?? null,
        setlistfmArtistUrl: meta?.artistUrl ?? null,
        setlistfmVenueUrl: meta?.venueUrl ?? null,
        setlistfmClockJson: meta?.clockJson ?? null,
        setlistfmInfo: meta?.setlistInfo ?? null,
        concertDurationMinutes: meta?.durationMinutesInferred ?? null,
        songs: buildSongsPayload(),
      });

      if ("error" in result) {
        setFormError(result.error);
        return;
      }
      router.push(`/concerts/${result.attendanceId}`);
      router.refresh();
    });
  }

  const songCount = draft
    ? filterSetlistSongsForDisplay(draft.parsedSongs).length
    : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pb-10 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <SetlistBulkImportCard initialSetlistfmUserId={props.setlistfmUserId} />

      <section className={cardClass}>
        <h2 className="text-[15px] font-semibold text-white">Add a single concert</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-400">
          Search Setlist.fm by artist and date, confirm the show, then fill in your ticket
          and travel details.
        </p>

        {!draft ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-[12px] text-neutral-500">
                Artist
                <input
                  value={slArtist}
                  onChange={(e) => setSlArtist(e.target.value)}
                  placeholder="As on Setlist.fm"
                  className={inputClass}
                  autoComplete="off"
                />
              </label>
              <label className="block text-[12px] text-neutral-500">
                Date
                <input
                  type="date"
                  value={slDate}
                  onChange={(e) => setSlDate(e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>
            <button
              type="button"
              onClick={scheduleSearch}
              disabled={slLoading || slPickLoading || slDelay}
              className="mt-4 w-full rounded-[10px] border border-white/20 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-40"
            >
              {slDelay
                ? `Wait ${SETLIST_FM_DEBOUNCE_MS / 1000}s…`
                : slLoading
                  ? "Searching…"
                  : "Search on Setlist.fm"}
            </button>
            {slError ? <p className="mt-3 text-sm text-amber-200/90">{slError}</p> : null}
            {slResults.length > 0 ? (
              <ul className="mt-3 max-h-52 space-y-1 overflow-auto rounded-[10px] border border-white/10 bg-black/20 p-2">
                {slResults.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      disabled={slPickLoading || slDelay}
                      onClick={() => schedulePick(hit.id)}
                      className="w-full rounded-[8px] px-2 py-2.5 text-left text-sm transition hover:bg-white/10 disabled:opacity-50"
                    >
                      <span className="font-medium text-white">{hit.artistName}</span>
                      <span className="text-neutral-500"> · {hit.eventDate}</span>
                      <br />
                      <span className="text-neutral-400">
                        {hit.venueName ?? "Venue"}
                        {hit.cityName ? `, ${hit.cityName}` : ""}
                      </span>
                      <span className="text-neutral-600"> — {hit.totalSongs} songs</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <div className="mt-4 rounded-[12px] border border-[#7aa2ff]/30 bg-[#7aa2ff]/10 p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#9eb8ff]">
              Confirmed show
            </p>
            <p
              className="mt-2 font-[family-name:var(--font-flighty-chivo),ui-monospace,monospace] text-2xl leading-tight text-white"
            >
              {draft.displayArtist}
            </p>
            <p className="mt-1 text-sm text-neutral-300">{draft.displayVenue}</p>
            {draft.concertDate ? (
              <p className="mt-1 text-sm text-neutral-400">
                {formatConcertDateWithWeekday(draft.concertDate)}
              </p>
            ) : null}
            {draft.tourName ? (
              <p className="mt-1 text-xs text-neutral-500">Tour: {draft.tourName}</p>
            ) : null}
            <p className="mt-2 text-xs text-neutral-500">
              {songCount} songs in setlist
              {slPickLoading ? " · loading…" : ""}
            </p>
            <button
              type="button"
              onClick={clearSelection}
              className="mt-3 text-xs text-neutral-400 underline decoration-dotted underline-offset-2 hover:text-white"
            >
              Not this show — search again
            </button>
          </div>
        )}
      </section>

      {draft ? (
        <form onSubmit={onSubmit} className="space-y-5">
          <section className={cardClass}>
            <h2 className="text-[15px] font-semibold text-white">Your details</h2>
            <p className="mt-1 text-[13px] text-neutral-400">
              Same fields as on the concert page — ticket, departure, seating, and when you
              bought the ticket.
            </p>
            <div className="mt-4">
              <ConcertAttendanceFields
                departurePresets={props.departurePresets}
                isStanding={isStanding}
                onStandingChange={setIsStanding}
                ticketEur={ticketEur}
                onTicketEurChange={setTicketEur}
                ticketCur={ticketCur}
                onTicketCurChange={setTicketCur}
                departurePresetId={departurePresetId}
                onDeparturePresetIdChange={setDeparturePresetId}
                depCity={depCity}
                onDepCityChange={setDepCity}
                depCountry={depCountry}
                onDepCountryChange={setDepCountry}
                ticketPurchasedOn={ticketPurchasedOn}
                onTicketPurchasedOnChange={setTicketPurchasedOn}
              />
            </div>
          </section>

          {formError ? (
            <p className="rounded-[10px] border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {formError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-[10px] bg-white px-4 py-3 text-sm font-medium text-neutral-950 transition hover:bg-neutral-100 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save concert"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
