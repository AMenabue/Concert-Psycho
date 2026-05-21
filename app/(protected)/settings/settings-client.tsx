"use client";

import { LogoutButton } from "@/components/auth/logout-button";
import { SetlistBulkImportCard } from "@/components/add-concert/setlist-bulk-import-card";
import type { HomeLocationRow } from "@/app/(protected)/concerts/new/actions";
import type { SettingsPageData } from "@/lib/settings/actions";
import {
  createHomeLocation,
  deleteHomeLocation,
  setDefaultHomeLocation,
  updateHomeLocation,
  updateProfileAvatarUrl,
  updateProfileSettings,
} from "@/lib/settings/actions";
import { createClient } from "@/lib/supabase/client";
import { Home } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

const cardClass =
  "rounded-[16px] border border-white/[0.08] bg-white/[0.04] p-5 shadow-sm";

const inputClass =
  "mt-1.5 w-full rounded-[10px] border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-white/25 focus:ring-1 focus:ring-white/20";

const labelClass = "block text-[12px] text-neutral-500";

function sortHomes(rows: HomeLocationRow[]): HomeLocationRow[] {
  return [...rows].sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

type Props = {
  initial: SettingsPageData;
};

export function SettingsClient(props: Props) {
  const { initial } = props;
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState(initial.displayName);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [homes, setHomes] = useState(() => sortHomes(initial.homeLocations));

  const [newLabel, setNewLabel] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newCountry, setNewCountry] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editCountry, setEditCountry] = useState("");

  function saveProfile() {
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      const r = await updateProfileSettings({ displayName });
      if ("error" in r) setErr(r.error);
      else {
        setMsg("Profile saved.");
        router.refresh();
      }
    });
  }

  async function uploadAvatar(file: File) {
    setErr(null);
    setMsg(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErr("Not signed in.");
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setErr(
        "Could not upload image. Create a public Supabase Storage bucket named «avatars», or try a smaller file.",
      );
      return;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = `${pub.publicUrl}?t=${Date.now()}`;
    const r = await updateProfileAvatarUrl(url);
    if ("error" in r) setErr(r.error);
    else {
      setAvatarUrl(url);
      setMsg("Profile photo updated.");
      router.refresh();
    }
  }

  function addHome() {
    setErr(null);
    startTransition(async () => {
      const r = await createHomeLocation({
        label: newLabel,
        city: newCity,
        country: newCountry,
      });
      if ("error" in r) setErr(r.error);
      else {
        setHomes((prev) => sortHomes([...prev, r.location]));
        setNewLabel("");
        setNewCity("");
        setNewCountry("");
        setMsg("Departure home added.");
        router.refresh();
      }
    });
  }

  function saveEditHome() {
    if (!editingId) return;
    setErr(null);
    startTransition(async () => {
      const r = await updateHomeLocation({
        id: editingId,
        label: editLabel,
        city: editCity,
        country: editCountry,
      });
      if ("error" in r) setErr(r.error);
      else {
        setHomes((prev) =>
          sortHomes(prev.map((h) => (h.id === editingId ? r.location : h))),
        );
        setEditingId(null);
        setMsg("Departure home updated.");
        router.refresh();
      }
    });
  }

  function removeHome(id: string) {
    setErr(null);
    startTransition(async () => {
      const r = await deleteHomeLocation(id);
      if ("error" in r) setErr(r.error);
      else {
        setHomes((prev) => prev.filter((h) => h.id !== id));
        if (editingId === id) setEditingId(null);
        setMsg("Departure home removed.");
        router.refresh();
      }
    });
  }

  function makeDefault(id: string) {
    setErr(null);
    startTransition(async () => {
      const r = await setDefaultHomeLocation(id);
      if ("error" in r) setErr(r.error);
      else {
        setHomes((prev) =>
          sortHomes(
            prev.map((h) => ({
              ...h,
              is_default: h.id === id,
            })),
          ),
        );
        setMsg("Default departure home updated.");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pb-12 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <section className={cardClass}>
        <h2 className="text-[15px] font-semibold text-white">Profile</h2>
        <p className="mt-1 text-[13px] text-neutral-400">
          How you appear on the home screen header.
        </p>

        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative size-[72px] shrink-0 overflow-hidden rounded-full border border-white/15 bg-[#262626]"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-2xl font-semibold text-white/70">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </button>
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-sm text-white underline decoration-white/30 underline-offset-2 hover:decoration-white"
            >
              Change photo
            </button>
            {avatarUrl ? (
              <button
                type="button"
                className="mt-1 block text-xs text-neutral-500 hover:text-neutral-300"
                onClick={() => {
                  startTransition(async () => {
                    const r = await updateProfileAvatarUrl(null);
                    if (!("error" in r)) {
                      setAvatarUrl(null);
                      setMsg("Photo removed.");
                      router.refresh();
                    }
                  });
                }}
              >
                Remove photo
              </button>
            ) : null}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadAvatar(f);
              e.target.value = "";
            }}
          />
        </div>

        <label className={`mt-4 ${labelClass}`}>
          Display name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={inputClass}
          />
        </label>
        <p className="mt-2 text-[11px] text-neutral-600">{initial.email}</p>

        <button
          type="button"
          disabled={pending}
          onClick={saveProfile}
          className="mt-4 w-full rounded-[10px] bg-white px-4 py-2.5 text-sm font-medium text-neutral-950 hover:bg-neutral-100 disabled:opacity-50"
        >
          Save profile
        </button>
      </section>

      <section className={cardClass}>
        <h2 className="text-[15px] font-semibold text-white">Departure homes</h2>
        <p className="mt-1 text-[13px] text-neutral-400">
          Places you travel from. Shown when you log ticket and km for a show. Mark one as
          default to pre-fill new concerts (only when departure is still empty).
        </p>

        <ul className="mt-4 space-y-2">
          {homes.length === 0 ? (
            <li className="text-sm text-neutral-500">No departure homes yet.</li>
          ) : (
            homes.map((h: HomeLocationRow) => (
              <li
                key={h.id}
                className="rounded-[10px] border border-white/10 bg-black/20 px-3 py-2.5"
              >
                {editingId === h.id ? (
                  <div className="space-y-2">
                    <input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder="Label"
                      className={inputClass}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={editCity}
                        onChange={(e) => setEditCity(e.target.value)}
                        placeholder="City"
                        className={inputClass}
                      />
                      <input
                        value={editCountry}
                        onChange={(e) => setEditCountry(e.target.value)}
                        placeholder="Country"
                        className={inputClass}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={saveEditHome}
                        className="rounded-[8px] bg-white px-3 py-1.5 text-xs font-medium text-neutral-950"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-[8px] border border-white/20 px-3 py-1.5 text-xs text-neutral-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-medium text-white">
                        {h.is_default ? (
                          <Home
                            className="size-4 shrink-0 text-amber-200/90"
                            strokeWidth={2}
                            aria-hidden
                          />
                        ) : null}
                        <span className="truncate">{h.label}</span>
                        {h.is_default ? (
                          <span className="shrink-0 text-[10px] font-normal uppercase tracking-wide text-amber-200/70">
                            Default
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {h.city}, {h.country}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {!h.is_default ? (
                        <button
                          type="button"
                          disabled={pending}
                          className="text-xs text-neutral-400 hover:text-white"
                          onClick={() => makeDefault(h.id)}
                        >
                          Make default
                        </button>
                      ) : null}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-xs text-neutral-400 hover:text-white"
                          onClick={() => {
                            setEditingId(h.id);
                            setEditLabel(h.label);
                            setEditCity(h.city);
                            setEditCountry(h.country);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-xs text-red-400/90 hover:text-red-300"
                          onClick={() => removeHome(h.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))
          )}
        </ul>

        <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
          <p className="text-[12px] font-medium text-neutral-400">Add departure home</p>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (e.g. Parents house)"
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={newCity}
              onChange={(e) => setNewCity(e.target.value)}
              placeholder="City"
              className={inputClass}
            />
            <input
              value={newCountry}
              onChange={(e) => setNewCountry(e.target.value)}
              placeholder="Country"
              className={inputClass}
            />
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={addHome}
            className="w-full rounded-[10px] border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/5 disabled:opacity-50"
          >
            Add home
          </button>
        </div>
      </section>

      <SetlistBulkImportCard initialSetlistfmUserId={initial.setlistfmUserId} />

      <section className={cardClass}>
        <h2 className="text-[15px] font-semibold text-white">Account</h2>
        <p className="mt-1 text-[13px] text-neutral-400">Sign out of Concert Psycho.</p>
        <div className="mt-4">
          <LogoutButton />
        </div>
      </section>

      {err ? (
        <p className="rounded-[10px] border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="text-center text-sm text-neutral-400" role="status">
          {msg}
        </p>
      ) : null}
    </div>
  );
}
