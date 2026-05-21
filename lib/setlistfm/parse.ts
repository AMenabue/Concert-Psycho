/** Tipi minimi per la risposta JSON Setlist.fm (setlist completa). */

export type SlArtistRef = {
  mbid?: string;
  name?: string;
  sortName?: string;
  disambiguation?: string;
  url?: string;
  tmid?: number;
};

export type SlSong = {
  name?: string;
  /** Un solo artista in schema ufficiale; in pratica a volte è un array. */
  with?: SlArtistRef | SlArtistRef[];
  cover?: SlArtistRef;
  tape?: boolean;
  /** Note Setlist.fm: live debut, tour debut, snippet, with aggiuntivi, … */
  info?: string;
};

export type SlSet = {
  name?: string;
  /** 0 = set normale, 1+ = encore (intero). */
  encore?: number | string;
  song?: Array<SlSong | string> | SlSong;
};

export type SlSetlistFull = {
  id?: string;
  eventDate?: string;
  /** Testo libero sul concerto (linee guida Setlist.fm). */
  info?: string;
  /** Link attribuzione setlist.fm (obbligo licenza se mostri i dati). */
  url?: string;
  versionId?: string;
  lastUpdated?: string;
  lastFmEventId?: number;
  artist?: SlArtistRef;
  venue?: {
    id?: string;
    name?: string;
    url?: string;
    city?: {
      id?: string;
      name?: string;
      state?: string;
      stateCode?: string;
      coords?: { lat?: number; long?: number };
      country?: { name?: string; code?: string };
    };
  };
  tour?: { name?: string };
  /** Forma documentata API JSON */
  set?: SlSet[] | SlSet;
  /** Alcune risposte annidano i set qui */
  sets?: { set?: SlSet[] | SlSet };
};

export type ParsedSetlistSong = {
  position: number;
  title: string;
  isEncore: boolean;
  isCover: boolean;
  /** Brano da tape / playback — importato in DB, nascosto in scaletta UI. */
  isTape: boolean;
  /** Nome artista originale della cover (Setlist `cover.name`) — UI; tag DB = "Cover". */
  coverOriginalArtist: string | null;
  /** MusicBrainz id dell’artista originale della cover, se presente. */
  coverOriginalArtistMbid: string | null;
  /**
   * Tutti i featuring per la UI ("Gemitaiz, Joan Thiele"):
   * `with` (anche se array) + eventuali "with/con …" nel campo `info`.
   */
  guestName: string | null;
  /** Primo featuring (per FK `guest_artist_id` / MusicBrainz). */
  firstFeaturingName: string | null;
  firstFeaturingMbid: string | null;
  /** Tutti i featuring con mbid da `with` Setlist.fm ove disponibile (tabella ponte). */
  featuringGuestsList: { name: string; mbid: string | null }[];
  /** Testo `info` originale da Setlist.fm (persistenza). */
  songInfo: string | null;
  /** Parti di `info` trattate come tag (live debut, snippet, …), esclusi i featuring. */
  infoTags: string[];
  /** Nome del set da Setlist.fm (es. "Main Set", "Acoustic"). */
  setName: string | null;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

/** Estrae l'array di set da `set[]` oppure `sets.set[]` (o singolo oggetto). */
export function getSetlistSets(setlist: SlSetlistFull | Record<string, unknown>): SlSet[] {
  const root = setlist as Record<string, unknown>;

  const fromSets = asRecord(root.sets)?.set;
  if (fromSets !== undefined && fromSets !== null) {
    if (Array.isArray(fromSets)) return fromSets as SlSet[];
    return [fromSets as SlSet];
  }

  const top = root.set;
  if (top !== undefined && top !== null) {
    if (Array.isArray(top)) return top as SlSet[];
    return [top as SlSet];
  }

  return [];
}

function normalizeSongsInSet(st: SlSet): Array<SlSong | string> {
  const s = st.song;
  if (s === undefined || s === null) return [];
  if (Array.isArray(s)) return s;
  return [s as SlSong];
}

function encoreValueToNumber(encore: number | string | undefined | null): number {
  if (encore === undefined || encore === null) return 0;
  if (typeof encore === "number")
    return Number.isFinite(encore) ? encore : 0;
  const n = Number.parseInt(String(encore), 10);
  return Number.isFinite(n) ? n : 0;
}

/** encore 0 = set normale, 1+ = encore */
function setIsEncoreSet(st: SlSet): boolean {
  return encoreValueToNumber(st.encore) > 0;
}

function songIsTape(raw: SlSong): boolean {
  return raw.tape === true;
}

function coverExists(raw: SlSong): boolean {
  return raw.cover !== undefined && raw.cover !== null;
}

function coverOriginalName(raw: SlSong): string | null {
  const n =
    raw.cover && typeof raw.cover.name === "string"
      ? raw.cover.name.trim()
      : "";
  return n || null;
}

function coverOriginalMbid(raw: SlSong): string | null {
  const m =
    raw.cover && typeof raw.cover.mbid === "string"
      ? raw.cover.mbid.trim()
      : "";
  return m || null;
}

/**
 * Billing Setlist.fm: "Salmo / Noyz Narcos", "Gemitaiz & Madman" → nomi distinti.
 * Slash solo con spazi intorno evita di spezzare "AC/DC".
 */
export function splitBillingArtistNames(name: string): string[] {
  const raw = name.trim();
  if (!raw) return [];
  const out: string[] = [];
  for (const slashPart of raw.split(/\s*\/\s*/)) {
    for (const ampPart of slashPart.split(/\s*&\s*/)) {
      const p = ampPart.trim();
      if (p) out.push(p);
    }
  }
  return dedupeFeaturingNames(out);
}

function normalizeWithRefs(
  w: SlArtistRef | SlArtistRef[] | null | undefined,
): SlArtistRef[] {
  if (w == null) return [];
  return Array.isArray(w) ? w.filter(Boolean) : [w];
}

function mbidForFeaturingName(
  name: string | null,
  refs: SlArtistRef[],
): string | null {
  if (!name) return null;
  const low = name.toLowerCase();
  const ref = refs.find(
    (w) =>
      typeof w.name === "string" && w.name.trim().toLowerCase() === low,
  );
  const m = ref?.mbid;
  return typeof m === "string" && m.trim() ? m.trim() : null;
}

function dedupeFeaturingNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const t = n.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Da stringa tipo "Nome1, Nome2 & Nome3" (come `featuring_names`) → nomi distinti. */
export function parseFeaturingNamesList(raw: string | null | undefined): string[] {
  const t = raw?.trim();
  if (!t) return [];
  return dedupeFeaturingNames(splitFeaturingNamesBody(t));
}

function dedupeTagLabels(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const k = t.toLowerCase().replace(/\s+/g, " ").trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t.trim());
  }
  return out;
}

/** Frasi note Setlist.fm → etichetta canonica (dedup DB / filtri). */
const KNOWN_INFO_TAG = new Map<string, string>([
  ["new song", "New Song"],
  ["brand new", "Brand new"],
  ["live debut", "Live Debut"],
  ["tour debut", "Tour Debut"],
  ["world premiere", "World premiere"],
  ["snippet", "Snippet"],
  ["snippet only", "Snippet only"],
  ["performed twice", "Performed twice"],
  ["first time live", "First time live"],
  ["festival debut", "Festival debut"],
  ["acoustic", "Acoustic"],
  ["acoustic version", "Acoustic version"],
  ["piano version", "Piano version"],
  ["remix", "Remix"],
  ["acappella", "Acappella"],
  ["a cappella", "Acappella"],
  ["acapella", "Acappella"],
  ["a capella", "Acappella"],
]);

const FEAT_LINE = /^\s*(?:with|feat\.?|featuring|con)\s+(.+)$/i;

/** Slug stabile per tabella `song_tags` (dedup). */
export function slugForSongTag(label: string): string {
  const base = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (base || "tag").slice(0, 120);
}

function normKey(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Token o frase intera: se è un tag noto / descrittivo restituisce l’etichetta canonica,
 * altrimenti null (→ featuring).
 */
function classifyAsTag(token: string): string | null {
  const raw = token.trim();
  if (!raw) return null;
  const n = normKey(raw);

  const known = KNOWN_INFO_TAG.get(n);
  if (known) return known;

  const low = n;
  if (low.startsWith("contains elements")) return raw;
  if (low.startsWith("music video")) return raw;
  if (/^performed\s+/.test(low)) return raw;
  if (/\bintro\s*$/i.test(raw) && raw.length <= 56) return raw;
  if (/\b(since|filmed|during|exhibition|elements)\b/.test(low)) return raw;

  return null;
}

function appendFeaturingOrTags(
  names: string[],
  featuring: string[],
  tags: string[],
): void {
  for (const name of names) {
    const asTag = classifyAsTag(name);
    if (asTag) tags.push(asTag);
    else featuring.push(name);
  }
}

/** Spezza solo nomi (virgole e &) senza classificare. */
function splitFeaturingNamesBody(body: string): string[] {
  const out: string[] = [];
  for (const seg of body.split(/\s*,\s*/)) {
    const t = seg.replace(/^\+\s*/, "").trim();
    if (!t) continue;
    for (const sub of t.split(/\s*&\s*/)) {
      const u = sub.trim();
      if (u) out.push(u);
    }
  }
  return out;
}

function splitInfoIntoChunks(info: string): string[] {
  const out: string[] = [];
  for (const semi of info.split(/\s*;\s*|\s*\n\s*/)) {
    const s0 = semi.trim();
    if (!s0) continue;
    for (const dot of s0.split(/\.\s+/)) {
      const d = dot.trim();
      if (d) out.push(d);
    }
  }
  return out;
}

/**
 * Da `info` Setlist.fm: featuring aggiuntivi (oltre al campo `with`) e tag distinti.
 * - righe `with` / `con` / `feat` → nomi (anche con `,` e `&`)
 * - segmenti che iniziano con `+` o liste separate da virgole → ogni token è tag o nome
 * - frasi dopo `.` diventano tag separati (es. note lunghe, "Performed twice")
 */
export function extractInfoFeaturingAndTags(
  info: string | null | undefined,
): { featuring: string[]; tags: string[] } {
  const raw = typeof info === "string" ? info.trim() : "";
  if (!raw) return { featuring: [], tags: [] };

  const featuring: string[] = [];
  const tags: string[] = [];

  for (const chunk of splitInfoIntoChunks(raw)) {
    const t = chunk.trim();
    if (!t) continue;

    const featLine = t.match(FEAT_LINE);
    if (featLine) {
      appendFeaturingOrTags(
        splitFeaturingNamesBody(featLine[1] ?? ""),
        featuring,
        tags,
      );
      continue;
    }

    const hadLeadingPlus = /^\s*\+/.test(t);
    const stripped = t.replace(/^\+\s*/, "").trim();
    const hasComma = stripped.includes(",");

    if (hadLeadingPlus || hasComma) {
      for (const piece of stripped.split(/\s*,\s*/)) {
        const p = piece.replace(/^\+\s*/, "").trim();
        if (!p) continue;
        appendFeaturingOrTags(splitFeaturingNamesBody(p), featuring, tags);
      }
      continue;
    }

    const asTag = classifyAsTag(stripped);
    if (asTag) tags.push(asTag);
    else appendFeaturingOrTags(splitFeaturingNamesBody(stripped), featuring, tags);
  }

  return {
    featuring: dedupeFeaturingNames(featuring),
    tags: dedupeTagLabels(tags),
  };
}

/** Nomi artista → ospiti reali vs tag (Acappella, Acoustic, …). */
export function partitionFeaturingNamesAndTags(names: string[]): {
  featuring: string[];
  tags: string[];
} {
  const featuring: string[] = [];
  const tags: string[] = [];
  appendFeaturingOrTags(names, featuring, tags);
  return {
    featuring: dedupeFeaturingNames(featuring),
    tags: dedupeTagLabels(tags),
  };
}

/**
 * Compat: usato dalla dashboard su `song_info` legacy; i featuring vanno da `featuring_names`.
 */
export function parseSetlistSongInfo(info: string | null | undefined): {
  extraFeaturingNames: string[];
  tags: string[];
} {
  const { featuring, tags } = extractInfoFeaturingAndTags(info);
  return { extraFeaturingNames: featuring, tags };
}

/** dd-MM-yyyy → YYYY-MM-DD */
export function setlistEventDateToIso(eventDate: string | undefined): string | null {
  if (!eventDate || typeof eventDate !== "string") return null;
  const parts = eventDate.split("-");
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy || yyyy.length !== 4) return null;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

export function countSongsInSetlist(setlist: SlSetlistFull): number {
  return parseSetlistSongs(setlist).filter((s) => !s.isTape).length;
}

/** Tutti i brani inclusi tape (ordine Setlist.fm). */
export function countAllSongsInSetlist(setlist: SlSetlistFull): number {
  return parseSetlistSongs(setlist).length;
}

export function countEncoreSets(setlist: SlSetlistFull): number {
  return getSetlistSets(setlist).filter((st) => setIsEncoreSet(st)).length;
}

export function countEncoreSongs(songs: ParsedSetlistSong[]): number {
  return songs.filter((s) => s.isEncore && !s.isTape).length;
}

/** Scaletta senza brani tape (solo UI / conteggi “live”). */
export function filterSetlistSongsForDisplay(
  songs: ParsedSetlistSong[],
): ParsedSetlistSong[] {
  return songs.filter((s) => !s.isTape);
}

/**
 * Costruisce la lista piatta di canzoni da Setlist.fm:
 * - itera `set[]` o `sets.set[]`
 * - per ogni set, `song[]` (o singolo song)
 * - encore &gt; 0 ⇒ is_encore true per tutte le canzoni di quel set
 * - include `tape: true` con `isTape: true` (persistenza DB; UI li filtra)
 */
export function parseSetlistSongs(setlist: SlSetlistFull): ParsedSetlistSong[] {
  const sets = getSetlistSets(setlist);
  let position = 1;
  const out: ParsedSetlistSong[] = [];

  for (const st of sets) {
    const isEncore = setIsEncoreSet(st);
    const rawSetName =
      typeof st.name === "string" && st.name.trim() ? st.name.trim() : null;
    for (const raw of normalizeSongsInSet(st)) {
      if (typeof raw === "string") continue;
      if (!raw || typeof raw !== "object") continue;

      const song = raw as SlSong;
      const title = song.name?.trim();
      if (!title) continue;

      const isTape = songIsTape(song);

      const withRefs = normalizeWithRefs(song.with);
      const namesFromWith = withRefs
        .map((w) => (typeof w.name === "string" ? w.name.trim() : ""))
        .filter(Boolean);
      const withFeaturing: string[] = [];
      const withTags: string[] = [];
      appendFeaturingOrTags(namesFromWith, withFeaturing, withTags);
      const infoRaw =
        typeof song.info === "string" && song.info.trim()
          ? song.info.trim()
          : null;
      const { featuring: fromInfo, tags: fromInfoTags } =
        extractInfoFeaturingAndTags(infoRaw);
      const tags = dedupeTagLabels([...withTags, ...fromInfoTags]).filter((t) => {
        const low = t.trim().toLowerCase();
        return !(low.startsWith("cover") && low !== "cover");
      });
      const allFeaturing = dedupeFeaturingNames([...withFeaturing, ...fromInfo]);
      const joinedFeaturing =
        allFeaturing.length > 0 ? allFeaturing.join(", ") : null;
      const firstFeaturingName = allFeaturing[0] ?? null;
      const firstFeaturingMbid = mbidForFeaturingName(
        firstFeaturingName,
        withRefs,
      );
      const featuringGuestsList = allFeaturing.map((name) => ({
        name,
        mbid: mbidForFeaturingName(name, withRefs),
      }));

      const isCover = coverExists(song);
      out.push({
        position: position++,
        title,
        isEncore: isEncore,
        isCover,
        isTape,
        coverOriginalArtist: isCover ? coverOriginalName(song) : null,
        coverOriginalArtistMbid: isCover ? coverOriginalMbid(song) : null,
        guestName: joinedFeaturing,
        firstFeaturingName,
        firstFeaturingMbid,
        featuringGuestsList,
        songInfo: infoRaw,
        infoTags: tags,
        setName: rawSetName,
      });
    }
  }
  return out;
}

/** Tag da salvare in `song_tags`: niente "Cover di …"; una sola etichetta "Cover" se `isCover`. */
export function tagLabelsForConcertSong(s: {
  isCover: boolean;
  infoTags: string[];
  isTape?: boolean;
}): string[] {
  if (s.isTape) return [];
  const filtered = s.infoTags.filter((t) => {
    const low = t.trim().toLowerCase();
    return !(low.startsWith("cover") && low !== "cover");
  });
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of filtered) {
    const k = t.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t.trim());
  }
  if (s.isCover && !seen.has("cover")) out.push("Cover");
  return out;
}

const CLOCK_KEY_SKIP = new Set([
  "artist",
  "venue",
  "tour",
  "set",
  "sets",
  "id",
  "eventDate",
  "url",
  "versionId",
  "lastUpdated",
  "info",
  "lastFmEventId",
]);

function looksLikeClockKey(key: string): boolean {
  if (CLOCK_KEY_SKIP.has(key)) return false;
  if (key === "lastUpdated") return false;
  return /door|start|end|time|duration|schedule|clock|settime|setTimes|slot/i.test(
    key,
  );
}

/**
 * Copia in JSON campi “orari / durata” se l’API li aggiunge in futuro (o non documentati).
 * Utile per `setlistfm_clock_json` e debug (`scripts/dump-setlistfm.mjs`).
 */
export function extractSetlistClockLikeFields(
  setlist: SlSetlistFull | Record<string, unknown>,
): Record<string, unknown> | null {
  const root = setlist as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(root)) {
    if (v === undefined || v === null) continue;
    if (looksLikeClockKey(k)) picked[k] = v;
  }
  return Object.keys(picked).length > 0 ? picked : null;
}

function parseDurationHint(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    if (v > 48) return Math.round(v);
    return Math.round(v * 60);
  }
  if (typeof v === "string") {
    const n = Number.parseFloat(v.replace(",", ".").trim());
    if (Number.isFinite(n) && n > 0) {
      if (n > 48) return Math.round(n);
      return Math.round(n * 60);
    }
  }
  return null;
}

/**
 * Se il JSON contiene durata esplicita (minuti o ore secondo euristica), la restituisce.
 */
export function inferConcertDurationMinutesFromSetlistJson(
  setlist: SlSetlistFull | Record<string, unknown>,
): number | null {
  const root = setlist as Record<string, unknown>;
  const direct = parseDurationHint(root.concertDurationMinutes);
  if (direct !== null) return direct;
  const dm = parseDurationHint(root.durationMinutes ?? root.duration);
  if (dm !== null) return dm;
  const clock = extractSetlistClockLikeFields(setlist);
  if (!clock) return null;
  for (const v of Object.values(clock)) {
    const m = parseDurationHint(v);
    if (m !== null) return m;
  }
  return null;
}

export type SetlistPersistMeta = {
  versionId: string | null;
  /** Stringa originale API (es. `2013-10-20T05:18:08.000+0000`). */
  lastUpdatedRaw: string | null;
  setlistUrl: string | null;
  artistUrl: string | null;
  venueUrl: string | null;
  setlistInfo: string | null;
  clockJson: Record<string, unknown> | null;
  /** Minuti se ricavabili dal JSON; altrimenti null (compilabile a mano su DB). */
  durationMinutesInferred: number | null;
  venueSetlistfmId: string | null;
  cityGeoId: string | null;
  state: string | null;
  stateCode: string | null;
  countryCode: string | null;
};

export function extractSetlistPersistMeta(sl: SlSetlistFull): SetlistPersistMeta {
  const root = sl as Record<string, unknown>;
  const versionId =
    typeof root.versionId === "string" && root.versionId.trim()
      ? root.versionId.trim()
      : null;
  const lastUpdatedRaw =
    typeof root.lastUpdated === "string" && root.lastUpdated.trim()
      ? root.lastUpdated.trim()
      : null;
  const setlistUrl =
    typeof root.url === "string" && root.url.trim() ? root.url.trim() : null;
  const setlistInfo =
    typeof root.info === "string" && root.info.trim() ? root.info.trim() : null;

  const artist = sl.artist;
  const artistUrl =
    artist && typeof artist.url === "string" && artist.url.trim()
      ? artist.url.trim()
      : null;

  const venue = sl.venue;
  const venueUrl =
    venue && typeof venue.url === "string" && venue.url.trim()
      ? venue.url.trim()
      : null;
  const venueSetlistfmId =
    venue && typeof venue.id === "string" && venue.id.trim()
      ? venue.id.trim()
      : null;

  const city = venue?.city;
  const cityGeoId =
    city && typeof city.id === "string" && city.id.trim()
      ? city.id.trim()
      : null;
  const state =
    city && typeof city.state === "string" && city.state.trim()
      ? city.state.trim()
      : null;
  const stateCode =
    city && typeof city.stateCode === "string" && city.stateCode.trim()
      ? city.stateCode.trim()
      : null;
  const countryCode =
    city?.country &&
    typeof city.country.code === "string" &&
    city.country.code.trim()
      ? city.country.code.trim().toUpperCase()
      : null;

  const clockJson = extractSetlistClockLikeFields(sl);
  const durationMinutesInferred =
    inferConcertDurationMinutesFromSetlistJson(sl);

  return {
    versionId,
    lastUpdatedRaw,
    setlistUrl,
    artistUrl,
    venueUrl,
    setlistInfo,
    clockJson,
    durationMinutesInferred,
    venueSetlistfmId,
    cityGeoId,
    state,
    stateCode,
    countryCode,
  };
}
