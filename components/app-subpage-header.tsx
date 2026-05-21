import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export function ChevronBackIcon() {
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

type Props = {
  title: string;
  backHref: string;
  backLabel: string;
  trailing?: ReactNode;
};

/** Inline style so the top inset always renders, regardless of Tailwind JIT scanning. */
const HEADER_STYLE: CSSProperties = {
  paddingTop: "max(30px, calc(env(safe-area-inset-top, 0px) + 12px))",
};

export function AppSubpageHeader(props: Props) {
  const { title, backHref, backLabel, trailing } = props;

  return (
    <header
      className="relative z-10 mx-auto flex w-full max-w-[430px] flex-row items-center justify-between gap-4 px-6"
      style={HEADER_STYLE}
    >
      <Link
        href={backHref}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10"
        aria-label={backLabel}
      >
        <ChevronBackIcon />
      </Link>
      <h1 className="min-w-0 flex-1 text-center text-[16px] font-semibold leading-[19px] text-white">
        {title}
      </h1>
      {trailing ?? <div className="inline-flex h-9 w-9 shrink-0" aria-hidden />}
    </header>
  );
}
