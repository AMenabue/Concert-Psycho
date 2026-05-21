/** Parse ISO date (YYYY-MM-DD or datetime) at noon UTC to avoid timezone drift. */
export function parseConcertIsoDate(iso: string): Date | null {
  const t = iso?.trim();
  if (!t) return null;
  const d = new Date(t.length <= 10 ? `${t}T12:00:00` : t);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** e.g. `30 Apr 2026 · Monday` */
export function formatConcertDateWithWeekday(iso: string): string {
  const d = parseConcertIsoDate(iso);
  if (!d) return iso?.trim() || "—";
  const datePart = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long" });
  return `${datePart} · ${weekday}`;
}
