/** Mappa pieghevole a 4 pannelli (senza percorso tratteggiato / X). */
export function FoldedMapIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      width={20}
      height={20}
      aria-hidden
    >
      <path
        d="M4.5 7.25 8.25 5.25 12 7.25 15.75 5.25 19.5 7.25V16.75L15.75 18.75 12 16.75 8.25 18.75 4.5 16.75V7.25Z"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
      <path
        d="M8.25 5.25V18.75M12 7.25V16.75M15.75 5.25V18.75"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}
