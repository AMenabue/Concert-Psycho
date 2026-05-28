"use client";

import { Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { ConcertAttendanceFields } from "@/components/add-concert/concert-attendance-fields";
import {
  defaultDeparturePreset,
  departurePresetIdForAttendance,
  DEPARTURE_OTHER_ID,
  hasSavedDeparture,
} from "@/lib/departure/preset-utils";
import { formatHm } from "@/components/stats/stat-primitives";
import { APP_SUBPAGE_HEADER_STYLE } from "@/lib/app-subpage-layout";
import { formatConcertDateWithWeekday } from "@/lib/format-concert-date";
import { purchaseDateInputFromDaysInAdvance } from "@/lib/ticket-purchase-date";
import type { ConcertDetailPage, ConcertSongRow } from "./actions";
import { updateConcertDetailPage } from "./actions";

function formatDaysInAdvance(days: number | null): string {
  if (days == null || !Number.isFinite(days)) return "—";
  return `${Math.round(days).toLocaleString("en-US")} days`;
}

function centsToEurInput(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

function formatPrice(cents: number | null, currency: string | null): string {
  if (cents == null) return "—";
  const cur = (currency ?? "EUR").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${cur}`;
  }
}

function ChevronBackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 18L9 12L15 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function featText(song: ConcertSongRow): string | null {
  const display = song.featuring_display?.trim();
  if (display) return display;
  const g = song.guest_name?.trim();
  if (g) return g;
  const f = song.featuring_names?.trim();
  if (!f) return null;
  return f.replace(/^\s*feat\.?\s*/i, "").trim() || f;
}

function setlistFmPageHref(page: ConcertDetailPage): string | null {
  const url = page.setlistfmUrl?.trim();
  if (url) return url;
  const id = page.setlistfmSetlistId?.trim();
  if (id) return `https://www.setlist.fm/setlist/${encodeURIComponent(id)}`;
  return null;
}

function groupSongsBySet(songs: ConcertSongRow[]) {
  const order: string[] = [];
  const map = new Map<string, ConcertSongRow[]>();
  for (const s of songs) {
    const key = s.set_name?.trim() || "__main__";
    if (!map.has(key)) {
      order.push(key);
      map.set(key, []);
    }
    map.get(key)!.push(s);
  }
  return { order, map };
}

export function ConcertDetailClient(props: { initial: ConcertDetailPage }) {
  const { initial } = props;
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const a = initial.attendance;

  const [isStanding, setIsStanding] = useState(a.is_standing);
  const [ticketEur, setTicketEur] = useState(centsToEurInput(a.ticket_price_cents));
  const [ticketCur, setTicketCur] = useState(a.ticket_currency ?? "EUR");
  const [ticketPurchasedOn, setTicketPurchasedOn] = useState(() =>
    a.days_bought_in_advance != null
      ? purchaseDateInputFromDaysInAdvance(a.gig_date, a.days_bought_in_advance)
      : "",
  );
  const [departurePresetId, setDeparturePresetId] = useState(() => {
    if (!hasSavedDeparture(a.departure_city, a.departure_country)) {
      return DEPARTURE_OTHER_ID;
    }
    return departurePresetIdForAttendance(
      initial.departurePresets,
      a.departure_city,
      a.departure_country,
    );
  });
  const [depCity, setDepCity] = useState(a.departure_city ?? "");
  const [depCountry, setDepCountry] = useState(a.departure_country ?? "");

  const grouped = useMemo(() => groupSongsBySet(initial.songs), [initial.songs]);
  const setlistHref = setlistFmPageHref(initial);

  const applyDefaultDepartureSuggestion = useCallback(() => {
    if (hasSavedDeparture(a.departure_city, a.departure_country)) return;
    const def = defaultDeparturePreset(initial.departurePresets);
    if (!def) return;
    setDeparturePresetId(def.id);
    setDepCity(def.city);
    setDepCountry(def.country);
  }, [a.departure_city, a.departure_country, initial.departurePresets]);

  function resetFromInitial() {
    setIsStanding(a.is_standing);
    setTicketEur(centsToEurInput(a.ticket_price_cents));
    setTicketCur(a.ticket_currency ?? "EUR");
    setTicketPurchasedOn(
      a.days_bought_in_advance != null
        ? purchaseDateInputFromDaysInAdvance(a.gig_date, a.days_bought_in_advance)
        : "",
    );
    if (!hasSavedDeparture(a.departure_city, a.departure_country)) {
      setDeparturePresetId(DEPARTURE_OTHER_ID);
      setDepCity("");
      setDepCountry("");
    } else {
      setDeparturePresetId(
        departurePresetIdForAttendance(
          initial.departurePresets,
          a.departure_city,
          a.departure_country,
        ),
      );
      setDepCity(a.departure_city ?? "");
      setDepCountry(a.departure_country ?? "");
    }
    setErr(null);
  }

  function openEdit() {
    applyDefaultDepartureSuggestion();
    setEdit(true);
  }

  function save() {
    setErr(null);
    startTransition(async () => {
      const r = await updateConcertDetailPage(a.id, {
        isStanding,
        ticketPriceEur: ticketEur,
        ticketCurrency: ticketCur,
        ticketPurchasedOn,
        departureCity: depCity,
        departureCountry: depCountry,
      });
      if ("error" in r) {
        setErr(r.error);
        return;
      }
      setEdit(false);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-[430px] pb-16 text-white">
      <header
        className="relative z-10 flex w-full flex-row items-center justify-between gap-4 px-6"
        style={APP_SUBPAGE_HEADER_STYLE}
      >
        <Link
          href="/concerts"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10"
          aria-label="Back to concerts"
        >
          <ChevronBackIcon />
        </Link>
        <h1 className="min-w-0 flex-1 text-center text-[16px] font-semibold leading-[19px] text-white">
          Concerts
        </h1>
        <button
          type="button"
          onClick={() => {
            if (edit) {
              resetFromInitial();
              setEdit(false);
            } else {
              openEdit();
            }
          }}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10"
          aria-label={edit ? "Close settings" : "Your concert settings"}
        >
          <Settings className="size-[22px]" strokeWidth={1.75} />
        </button>
      </header>

      <div className="mt-6 px-6">
        <h2
          className="text-[34px] font-normal leading-tight tracking-tight text-neutral-50"
          style={{ fontFamily: "var(--font-flighty-chivo), ui-monospace, monospace" }}
        >
          {a.artist_name}
        </h2>
        {a.venue_label ? (
          <p className="mt-2 text-sm text-neutral-500">{a.venue_label}</p>
        ) : null}
        <p className="mt-1 text-sm text-neutral-500">
          {formatConcertDateWithWeekday(a.gig_date)}
        </p>
        {a.tour_name && !edit ? (
          <p className="mt-1 text-sm text-neutral-500">Tour: {a.tour_name}</p>
        ) : null}

        {!edit ? (
          <div className="mt-6 flex flex-wrap gap-8 text-sm">
            <div>
              <span className="text-neutral-500">Ticket</span>
              <p className="font-medium text-neutral-200">
                {formatPrice(a.ticket_price_cents, a.ticket_currency)}
              </p>
            </div>
            <div>
              <span className="text-neutral-500">Km traveled</span>
              <p className="font-medium text-neutral-200">
                {a.travel_km != null && Number.isFinite(a.travel_km)
                  ? `${Math.round(a.travel_km).toLocaleString("en-US")} km`
                  : "—"}
              </p>
            </div>
            <div>
              <span className="text-neutral-500">Bought in advance</span>
              <p className="font-medium text-neutral-200">
                {formatDaysInAdvance(a.days_bought_in_advance)}
              </p>
            </div>
            <div>
              <span className="text-neutral-500">Guests</span>
              <p className="font-medium text-neutral-200">
                {initial.uniqueGuestCount > 0
                  ? initial.uniqueGuestCount.toLocaleString("en-US")
                  : "—"}
              </p>
            </div>
            <div>
              <span className="text-neutral-500">Set time</span>
              <p className="font-medium text-neutral-200">
                {formatHm(initial.concert_duration_minutes)}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4 border-t border-neutral-800 pt-6">
            <ConcertAttendanceFields
              departurePresets={initial.departurePresets}
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

            <div className="flex flex-wrap gap-3 pt-2">
              {err ? <p className="w-full text-sm text-amber-300">{err}</p> : null}
              <button
                type="button"
                disabled={pending}
                onClick={save}
                className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-white disabled:opacity-50"
              >
                Save changes
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  resetFromInitial();
                  setEdit(false);
                }}
                className="rounded-md border border-neutral-600 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!edit ? (
          <section className="mt-10">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Setlist</h3>
            <div className="mt-3 space-y-6">
              {grouped.order.map((key) => {
                const list = grouped.map.get(key)!;
                return (
                  <div key={key}>
                    {key !== "__main__" ? (
                      <h4 className="mb-2 text-sm font-medium text-neutral-400">{key}</h4>
                    ) : null}
                    <ul className="space-y-0">
                      {list.map((song) => {
                        const feat = featText(song);
                        const tagLine = (song.tag_labels ?? []).filter(
                          (tag) =>
                            !song.is_cover || tag.trim().toLowerCase() !== "cover",
                        );
                        return (
                          <li
                            key={song.id}
                            className="flex gap-2 border-b border-neutral-800/80 py-2.5 text-sm"
                          >
                            <span className="w-8 shrink-0 text-neutral-500">{song.position}</span>
                            <div className="min-w-0 flex-1 text-neutral-100">
                              <span>{song.title}</span>
                              {feat ? (
                                <span className="text-neutral-400">
                                  {" "}
                                  with {feat}
                                </span>
                              ) : null}
                            </div>
                            <div className="ml-auto flex max-w-[48%] shrink-0 flex-wrap items-center justify-end gap-1">
                              {song.is_encore ? (
                                <span className="rounded bg-amber-900/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-100">
                                  Encore
                                </span>
                              ) : null}
                              {song.is_cover ? (
                                <span className="rounded bg-violet-900/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-violet-100">
                                  Cover
                                  {song.cover_original_artist?.trim() ? (
                                    <span className="ml-1 font-normal normal-case text-violet-200/90">
                                      ({song.cover_original_artist.trim()})
                                    </span>
                                  ) : null}
                                </span>
                              ) : null}
                              {tagLine.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>

            <p className="mt-8 text-center text-[11px] leading-relaxed text-neutral-500">
              Setlist data courtesy of{" "}
              {setlistHref ? (
                <a
                  href={setlistHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-300 underline underline-offset-2 hover:text-white"
                >
                  setlist.fm
                </a>
              ) : (
                <span>setlist.fm</span>
              )}
              .
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
