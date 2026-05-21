import { Fragment } from "react";

export type ConcertSongListItem = {
  position: number;
  title: string;
  isEncore: boolean;
  isCover: boolean;
  setName: string | null;
  guestName?: string | null;
  /** Tag da Setlist `info` (live debut, snippet, …). */
  infoTags?: string[];
  /** Artista originale della cover (Setlist `cover.name`); il tag in DB resta «Cover». */
  coverOriginalArtist?: string | null;
};

export function ConcertSongList(props: {
  songs: ConcertSongListItem[];
  className?: string;
  emptyMessage?: string;
}) {
  const { songs, className, emptyMessage } = props;
  if (songs.length === 0) {
    return emptyMessage ? (
      <p className="text-sm text-neutral-500">{emptyMessage}</p>
    ) : null;
  }
  return (
    <ol
      className={
        className ??
        "max-h-80 list-none space-y-0 overflow-auto text-sm"
      }
    >
      {songs.map((s, i) => {
        const prevSet =
          i > 0 ? (songs[i - 1].setName ?? "") : "\u0000";
        const currSet = s.setName ?? "";
        const showSetHeader = i === 0 || currSet !== prevSet;
        return (
          <Fragment key={`${s.position}-${s.title}-${i}`}>
            {showSetHeader ? (
              <li className="border-b border-neutral-800 pt-3 first:pt-0">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  {s.setName?.trim() || "Set"}
                </h3>
              </li>
            ) : null}
            <li className="flex flex-wrap items-baseline gap-2 border-b border-neutral-800/80 py-1.5 pl-1">
              <span className="w-8 shrink-0 text-neutral-500">
                {s.position}.
              </span>
              <span className="text-neutral-100">{s.title}</span>
              {s.isEncore ? (
                <span className="rounded bg-violet-900/60 px-1.5 py-0.5 text-xs text-violet-200">
                  ENCORE
                </span>
              ) : null}
              {s.isCover ? (
                <span className="inline-flex flex-wrap items-baseline gap-1 rounded bg-amber-900/50 px-1.5 py-0.5 text-xs text-amber-200">
                  <span>COVER</span>
                  {s.coverOriginalArtist?.trim() ? (
                    <span className="font-normal text-amber-100/90">
                      di {s.coverOriginalArtist.trim()}
                    </span>
                  ) : null}
                </span>
              ) : null}
              {s.guestName ? (
                <span className="text-xs text-neutral-500">
                  con {s.guestName}
                </span>
              ) : null}
              {(s.infoTags ?? [])
                .filter(
                  (tag) =>
                    !s.isCover ||
                    tag.trim().toLowerCase() !== "cover",
                )
                .map((tag, ti) => (
                <span
                  key={`${s.position}-${ti}-${tag}`}
                  className="rounded bg-sky-900/50 px-1.5 py-0.5 text-xs font-medium text-sky-100"
                >
                  {tag}
                </span>
              ))}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
