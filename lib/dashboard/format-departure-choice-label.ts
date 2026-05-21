export type DepartureChoiceRow = {
  id: string;
  label: string;
  city: string;
  country: string;
};

/** Voce nel menu «Parti da»: case con etichetta; partenze da concerti precedenti solo città, paese. */
export function formatDepartureChoiceLabel(row: DepartureChoiceRow): string {
  if (row.id.startsWith("__recent__:")) return row.label;
  return `${row.label} (${row.city}, ${row.country})`;
}
