/** FNV-1a style hash for deterministic "random" stamp layout / colours. */
export function strHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Same venue → same shape index (0-4). Mapped to actual CSS by the renderer
 * because some variants need clip-path / SVG outlines for the real stamp look.
 */
export type StampShape = 0 | 1 | 2 | 3 | 4;
export function venueShapeIndex(venueId: string): StampShape {
  return (strHash(venueId) % 5) as StampShape;
}

/** @deprecated kept for backwards compat — prefer venueShapeIndex + renderer mapping. */
export function venueShapeClass(venueId: string): string {
  switch (strHash(venueId) % 5) {
    case 0: return "rounded-none";
    case 1: return "rounded-[20px]";
    case 2: return "rounded-sm";
    case 3: return "rounded-full";
    default: return "rounded-[40px]";
  }
}

/** Same venue → font slot index 0–3 (map to actual CSS font string in component). */
export function venueFontIndex(venueId: string): 0 | 1 | 2 | 3 {
  return (strHash(venueId) % 4) as 0 | 1 | 2 | 3;
}

/** Same artist id → same ink colour. */
export function artistInkColor(artistId: string): string {
  const hue = strHash(artistId) % 360;
  return `hsl(${hue} 58% 30%)`;
}
