import { AppSubpageHeader } from "@/components/app-subpage-header";
import { getSettingsPageData } from "@/lib/settings/actions";
import {
  APP_SUBPAGE_BODY_CLASS,
  APP_SUBPAGE_MAIN_CLASS,
} from "@/lib/app-subpage-layout";
import { redirect } from "next/navigation";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings — Concert Psycho",
};

export default async function SettingsPage() {
  const data = await getSettingsPageData();
  if (!data) redirect("/login");

  return (
    <main className={APP_SUBPAGE_MAIN_CLASS}>
      <AppSubpageHeader title="Settings" backHref="/" backLabel="Back to home" />
      <div className={`${APP_SUBPAGE_BODY_CLASS} px-6`}>
        <SettingsClient initial={data} />
      </div>
    </main>
  );
}
