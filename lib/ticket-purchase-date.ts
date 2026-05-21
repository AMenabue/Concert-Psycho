/** User-facing date format for ticket purchase input (day first). */
export const TICKET_PURCHASE_DATE_PLACEHOLDER = "DD/MM/YYYY";
export const TICKET_PURCHASE_DATE_HINT = "e.g. 15/03/2024";

/** Parse `DD/MM/YYYY` or `D/M/YYYY` (also accepts `-` separators). */
export function parseDdMmYyyy(input: string): Date | null {
  const t = input.trim();
  if (!t) return null;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  if (!m) return null;
  const day = Number.parseInt(m[1]!, 10);
  const month = Number.parseInt(m[2]!, 10);
  const year = Number.parseInt(m[3]!, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return d;
}

export function formatDdMmYyyyFromDate(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function parseConcertIso(iso: string): Date | null {
  const t = iso.trim();
  if (!t) return null;
  const d = new Date(t.length <= 10 ? `${t}T12:00:00Z` : t);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Days from purchase date to concert date (concert − purchase). */
export function daysInAdvanceFromPurchase(
  purchaseDdMmYyyy: string,
  concertDateIso: string,
): number | null {
  const purchase = parseDdMmYyyy(purchaseDdMmYyyy);
  const concert = parseConcertIso(concertDateIso);
  if (!purchase || !concert) return null;
  const ms = concert.getTime() - purchase.getTime();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (days < 0) return null;
  return days;
}

/** Pre-fill purchase field from stored days-in-advance + concert date. */
export function purchaseDateInputFromDaysInAdvance(
  concertDateIso: string,
  daysInAdvance: number,
): string {
  const concert = parseConcertIso(concertDateIso);
  if (!concert || !Number.isFinite(daysInAdvance) || daysInAdvance < 0) return "";
  const purchase = new Date(concert.getTime());
  purchase.setUTCDate(purchase.getUTCDate() - Math.round(daysInAdvance));
  return formatDdMmYyyyFromDate(purchase);
}
