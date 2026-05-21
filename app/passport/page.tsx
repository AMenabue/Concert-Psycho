import Link from "next/link";
import { Frame107OpenBook } from "@/components/passport/frame-107-open-book";
import { getDashboardStatistics } from "@/lib/statistics/dashboard-stats";
import {
  getDashboardDisplayName,
  getDashboardPassportNumbers,
  getDefaultHomePlaceOfIssue,
  getPassportStampPreviews,
} from "@/lib/home-data";
import { formatDateMrzCompact } from "@/lib/passport-mrz-date";

export const dynamic = "force-dynamic";

function ChevronBackIcon() {
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

function ShareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function PassportPage() {
  const [passport, stats, userDisplayName, stamps, placeOfIssue] = await Promise.all([
    getDashboardPassportNumbers(),
    getDashboardStatistics(),
    getDashboardDisplayName(),
    getPassportStampPreviews(50),
    getDefaultHomePlaceOfIssue(),
  ]);

  const issuedLabel =
    stats?.overview?.firstConcertDate != null && stats.overview.firstConcertDate !== ""
      ? String(stats.overview.firstConcertDate)
      : "—";

  const issuedTodayMrz = formatDateMrzCompact(new Date());

  return (
    <main className="relative min-h-[100dvh] w-full overflow-x-hidden bg-[#0C0C21] text-white">
      <div
        className="pointer-events-none absolute left-1/2 top-[5px] h-[211px] w-[202px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[rgba(113,58,255,0.75)] to-[rgba(57,76,255,0.75)] blur-[74px]"
        aria-hidden
      />

      <header className="relative z-10 mx-auto flex w-full max-w-[430px] flex-row items-center justify-between gap-4 px-6 pt-[85px]">
        <Link
          href="/"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10"
          aria-label="Back to home"
        >
          <ChevronBackIcon />
        </Link>
        <h1
          className="min-w-0 flex-1 text-center text-[24px] font-semibold leading-[29px] text-white"
          style={{ fontFamily: "var(--font-passport2-inter), ui-sans-serif, system-ui, sans-serif" }}
        >
          My Lifetime Passport
        </h1>
        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10"
          aria-label="Share"
        >
          <ShareIcon />
        </button>
      </header>

      <div className="relative z-10 mx-auto mt-[74px] flex justify-center px-4 pb-4">
        <Frame107OpenBook
          passport={passport}
          stats={stats}
          issuedLabel={issuedLabel}
          userDisplayName={userDisplayName}
          issuedTodayMrz={issuedTodayMrz}
          placeOfIssue={placeOfIssue}
          stamps={stamps}
        />
      </div>

      <p className="relative z-10 mx-auto max-w-[430px] px-6 pb-12 pt-6 text-center text-xs text-neutral-400">
        Tap the lower or upper part of the passport to flip pages.
      </p>
    </main>
  );
}
