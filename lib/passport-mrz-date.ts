/** MRZ-style compact date e.g. 15MAY26 — safe on server and client. */
export function formatDateMrzCompact(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
    .format(d)
    .toUpperCase()
    .replace(/\s+/g, "");
}
