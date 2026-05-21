"use client";

import {
  importSetlistfmAttendedConcerts,
  updateProfileSetlistfmUserId,
} from "@/app/(protected)/concerts/new/actions";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const cardClass =
  "rounded-[16px] border border-white/[0.08] bg-white/[0.04] p-5 shadow-sm";

const inputClass =
  "mt-1.5 w-full rounded-[10px] border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-white/25 focus:ring-1 focus:ring-white/20";

export function SetlistBulkImportCard(props: { initialSetlistfmUserId: string | null }) {
  const router = useRouter();
  const [userId, setUserId] = useState(props.initialSetlistfmUserId ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function saveAndImport() {
    setMsg(null);
    startTransition(async () => {
      const err = await updateProfileSetlistfmUserId(userId.trim() || null);
      if (err?.error) {
        setMsg(err.error);
        return;
      }
      const r = await importSetlistfmAttendedConcerts();
      const parts = [`Imported ${r.imported}`, `Already in archive: ${r.skippedExisting}`];
      if (r.errors.length) parts.push(r.errors.slice(0, 3).join("; "));
      setMsg(parts.join(" · "));
      router.refresh();
    });
  }

  return (
    <section className={cardClass}>
      <h2 className="text-[15px] font-semibold text-white">Import from Setlist.fm</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-400">
        Enter your Setlist.fm profile username (from{" "}
        <span className="text-neutral-300">setlist.fm/user/your-name</span>) to import every
        concert you marked as attended.
      </p>
      <label className="mt-4 block text-[12px] text-neutral-500">
        Setlist.fm username
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="e.g. yourusername"
          className={inputClass}
          autoComplete="off"
        />
      </label>
      <button
        type="button"
        disabled={isPending || !userId.trim()}
        onClick={saveAndImport}
        className="mt-4 w-full rounded-[10px] bg-white px-4 py-2.5 text-sm font-medium text-neutral-950 transition hover:bg-neutral-100 disabled:opacity-40"
      >
        {isPending ? "Importing…" : "Import attended concerts"}
      </button>
      {msg ? (
        <p className="mt-3 text-[12px] leading-relaxed text-neutral-400" role="status">
          {msg}
        </p>
      ) : null}
    </section>
  );
}
