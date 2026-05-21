import { notFound } from "next/navigation";
import { getConcertDetailPage } from "@/app/(protected)/concerts/[id]/actions";
import { ConcertDetailClient } from "@/app/(protected)/concerts/[id]/concert-detail-client";
import { APP_SUBPAGE_MAIN_SCROLL_CLASS } from "@/lib/app-subpage-layout";

export const dynamic = "force-dynamic";

export default async function ConcertDetailPublicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getConcertDetailPage(id);
  if (!detail) notFound();

  return (
    <main className={APP_SUBPAGE_MAIN_SCROLL_CLASS}>
      <ConcertDetailClient initial={detail} />
    </main>
  );
}
