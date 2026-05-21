import { listMyConcerts } from "@/lib/concerts/list-actions";
import { ConcertsListClient } from "@/app/concerts/concerts-list-client";
import { AppSubpageHeader } from "@/components/app-subpage-header";
import { APP_SUBPAGE_BODY_CLASS, APP_SUBPAGE_MAIN_CLASS } from "@/lib/app-subpage-layout";

export const dynamic = "force-dynamic";

export default async function ConcertsPage() {
  const concerts = await listMyConcerts();

  return (
    <main className={APP_SUBPAGE_MAIN_CLASS}>
      <AppSubpageHeader title="Concerts" backHref="/" backLabel="Back to home" />
      <div className={APP_SUBPAGE_BODY_CLASS}>
        <ConcertsListClient concerts={concerts} concertBasePath="/concerts" />
      </div>
    </main>
  );
}
