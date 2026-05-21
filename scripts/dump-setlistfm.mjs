/**
 * Verifica quali chiavi torna la API per una setlist (es. orari / durata).
 *
 * Uso (PowerShell):
 *   npm run dump-setlistfm -- b4455ea
 * La chiave si legge da .env.local (SETLISTFM_API_KEY) se presente.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readSetlistKeyFromEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return null;
  const text = fs
    .readFileSync(envPath, "utf8")
    .replace(/^\uFEFF/, "");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\r/g, "").trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^SETLISTFM_API_KEY\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[1].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    return v.trim() || null;
  }
  return null;
}

const keyFromFile = readSetlistKeyFromEnvLocal();
const key = (keyFromFile ?? process.env.SETLISTFM_API_KEY ?? "").trim();
const id = process.argv[2]?.trim();

if (!id || !key) {
  console.error(
    "Manca SETLISTFM_API_KEY: mettila in .env.local (root progetto) oppure esporta la variabile d'ambiente, poi:",
  );
  console.error("  npm run dump-setlistfm -- <setlistId>");
  process.exitCode = 1;
} else {
  const url = `https://api.setlist.fm/rest/1.0/setlist/${encodeURIComponent(id)}`;

  async function run() {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "x-api-key": key },
    });
    if (!res.ok) {
      console.error("HTTP", res.status, await res.text());
      process.exitCode = 1;
      return;
    }
    const json = await res.json();
    console.log("Chiavi top-level:", Object.keys(json).sort().join(", "));

    const clockish =
      /door|start|end|time|duration|schedule|clock|settime|setTimes|slot/i;
    const skip = new Set([
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
    const picked = {};
    for (const [k, v] of Object.entries(json)) {
      if (skip.has(k) || v == null) continue;
      if (clockish.test(k)) picked[k] = v;
    }
    console.log(
      "Campi che sembrano orari/durata:",
      Object.keys(picked).length ? JSON.stringify(picked, null, 2) : "(nessuno)",
    );
  }

  run().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
