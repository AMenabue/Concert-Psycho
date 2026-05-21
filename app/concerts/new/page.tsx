import { getMySetlistfmUserId } from "@/app/concerts/new/actions";
import { AppSubpageHeader } from "@/components/app-subpage-header";
import { getDeparturePresetsForUser } from "@/lib/dashboard/departure-presets";
import {
  APP_SUBPAGE_BODY_CLASS,
  APP_SUBPAGE_MAIN_CLASS,
} from "@/lib/app-subpage-layout";
import { AddConcertClient } from "./add-concert-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Add concert — Concert Psycho",
};

export default async function AddConcertPage() {
  const [setlistfmUserId, departurePresets] = await Promise.all([
    getMySetlistfmUserId(),
    getDeparturePresetsForUser(),
  ]);

  return (
    <main className={APP_SUBPAGE_MAIN_CLASS}>
      <AppSubpageHeader title="Add concert" backHref="/" backLabel="Back to home" />
      <div className={`${APP_SUBPAGE_BODY_CLASS} px-6`}>
        <AddConcertClient
          setlistfmUserId={setlistfmUserId}
          departurePresets={departurePresets}
        />
      </div>
    </main>
  );
}
