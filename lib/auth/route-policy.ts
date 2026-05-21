export const PROTECTED_PREFIXES = [
  "/concerts",
  "/settings",
  "/statistics",
  "/passport",
] as const;

export function isProtectedPath(path: string): boolean {
  if (path === "/") return true;
  return PROTECTED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
