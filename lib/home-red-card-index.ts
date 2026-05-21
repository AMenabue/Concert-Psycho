export function clampHomeCardIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

/** Group templates so refresh can skip the same kind (e.g. another guest-show card). */
export function homeCardTemplateCategory(id: string): string {
  if (id.startsWith("guests-at-show-")) return "guest-show";
  if (id === "total-unique-guests") return "guest-total";
  return id;
}

export function pickRandomHomeCardIndex(
  length: number,
  avoid?: number,
  templateIds?: string[],
): number {
  if (length <= 0) return 0;
  if (length === 1) return 0;

  const avoidCategory =
    avoid != null && templateIds?.[avoid]
      ? homeCardTemplateCategory(templateIds[avoid]!)
      : null;

  const candidates: number[] = [];
  for (let i = 0; i < length; i++) {
    if (i === avoid) continue;
    if (
      avoidCategory &&
      templateIds?.[i] &&
      homeCardTemplateCategory(templateIds[i]!) === avoidCategory
    ) {
      continue;
    }
    candidates.push(i);
  }

  const pool = candidates.length > 0 ? candidates : Array.from({ length }, (_, i) => i).filter((i) => i !== avoid);
  if (pool.length === 0) return avoid ?? 0;
  return pool[Math.floor(Math.random() * pool.length)]!;
}
