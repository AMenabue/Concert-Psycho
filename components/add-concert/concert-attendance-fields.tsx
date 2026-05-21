"use client";

import type { DeparturePreset } from "@/app/concerts/[id]/actions";
import {
  TICKET_PURCHASE_DATE_HINT,
  TICKET_PURCHASE_DATE_PLACEHOLDER,
} from "@/lib/ticket-purchase-date";

import { DEPARTURE_OTHER_ID } from "@/lib/departure/preset-utils";

function presetOptionLabel(p: { label: string; isDefault: boolean }): string {
  return p.isDefault ? `⌂ ${p.label}` : p.label;
}

const inputClass =
  "mt-1 w-full rounded-[10px] border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-white/25 focus:ring-1 focus:ring-white/20";

const labelClass = "text-[12px] text-neutral-500";

type Props = {
  departurePresets: DeparturePreset[];
  isStanding: boolean;
  onStandingChange: (standing: boolean) => void;
  ticketEur: string;
  onTicketEurChange: (v: string) => void;
  ticketCur: string;
  onTicketCurChange: (v: string) => void;
  departurePresetId: string;
  onDeparturePresetIdChange: (id: string) => void;
  depCity: string;
  onDepCityChange: (v: string) => void;
  depCountry: string;
  onDepCountryChange: (v: string) => void;
  ticketPurchasedOn: string;
  onTicketPurchasedOnChange: (v: string) => void;
  showTicketPurchaseDate?: boolean;
};

export function ConcertAttendanceFields(props: Props) {
  const {
    departurePresets,
    isStanding,
    onStandingChange,
    ticketEur,
    onTicketEurChange,
    ticketCur,
    onTicketCurChange,
    departurePresetId,
    onDeparturePresetIdChange,
    depCity,
    onDepCityChange,
    depCountry,
    onDepCountryChange,
    ticketPurchasedOn,
    onTicketPurchasedOnChange,
    showTicketPurchaseDate = true,
  } = props;

  const departureCityCountryDisabled = departurePresetId !== DEPARTURE_OTHER_ID;

  function onDepartureSelect(id: string) {
    onDeparturePresetIdChange(id);
    if (id === DEPARTURE_OTHER_ID) return;
    const preset = departurePresets.find((p) => p.id === id);
    if (preset) {
      onDepCityChange(preset.city);
      onDepCountryChange(preset.country);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Ticket price</label>
          <input
            value={ticketEur}
            onChange={(e) => onTicketEurChange(e.target.value)}
            inputMode="decimal"
            placeholder="e.g. 85.00"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Currency</label>
          <input
            value={ticketCur}
            onChange={(e) => onTicketCurChange(e.target.value.toUpperCase())}
            maxLength={3}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Departure</label>
        <select
          value={departurePresetId}
          onChange={(e) => onDepartureSelect(e.target.value)}
          className={inputClass}
        >
          {departurePresets.map((p) => (
            <option key={p.id} value={p.id}>
              {presetOptionLabel(p)}
            </option>
          ))}
          <option value={DEPARTURE_OTHER_ID}>Other (city &amp; country)</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>City</label>
          <input
            value={depCity}
            onChange={(e) => onDepCityChange(e.target.value)}
            disabled={departureCityCountryDisabled}
            className={`${inputClass} disabled:opacity-50`}
          />
        </div>
        <div>
          <label className={labelClass}>Country</label>
          <input
            value={depCountry}
            onChange={(e) => onDepCountryChange(e.target.value)}
            disabled={departureCityCountryDisabled}
            className={`${inputClass} disabled:opacity-50`}
          />
        </div>
      </div>

      <div>
        <span className={labelClass}>Seating</span>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => onStandingChange(true)}
            className={`flex-1 rounded-[10px] border px-3 py-2 text-sm transition ${
              isStanding
                ? "border-white bg-white text-neutral-950"
                : "border-white/15 text-neutral-300 hover:border-white/30"
            }`}
          >
            Standing
          </button>
          <button
            type="button"
            onClick={() => onStandingChange(false)}
            className={`flex-1 rounded-[10px] border px-3 py-2 text-sm transition ${
              !isStanding
                ? "border-white bg-white text-neutral-950"
                : "border-white/15 text-neutral-300 hover:border-white/30"
            }`}
          >
            Seated
          </button>
        </div>
      </div>

      {showTicketPurchaseDate ? (
        <div>
          <label className={labelClass}>When was the ticket bought? (optional)</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder={TICKET_PURCHASE_DATE_PLACEHOLDER}
            value={ticketPurchasedOn}
            onChange={(e) => onTicketPurchasedOnChange(e.target.value)}
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-neutral-500">
            {TICKET_PURCHASE_DATE_HINT} (day / month / year)
          </p>
        </div>
      ) : null}
    </div>
  );
}

export { DEPARTURE_OTHER_ID };
