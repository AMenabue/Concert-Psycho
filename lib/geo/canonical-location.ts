/**
 * Metro / suburb normalization for Setlist.fm imports and city stats.
 * Suburbs (Assago, Rho, …) roll up to the parent city (Milano) so heatmaps and
 * "cities visited" stay meaningful. Venue renames at the same place share one identity.
 */

export type CanonicalVenueInput = {
  name: string;
  city: string;
  country: string;
};

export type CanonicalVenueResult = {
  name: string;
  city: string;
};

type MetroArea = {
  /** Stored / displayed city name */
  displayCity: string;
  countryKeys: Set<string>;
  coreCityKeys: Set<string>;
  suburbKeys: Set<string>;
};

function normText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normCountry(country: string): string {
  const c = normText(country);
  if (c === "it" || c === "italia") return "italy";
  if (c === "uk" || c === "gb" || c === "great britain") return "united kingdom";
  if (c === "usa" || c === "us") return "united states";
  return c;
}

const METRO_AREAS: MetroArea[] = [
  {
    displayCity: "Milano",
    countryKeys: new Set(["italy"]),
    coreCityKeys: new Set(["milano", "milan"]),
    suburbKeys: new Set([
      "assago",
      "rho",
      "sesto san giovanni",
      "sesto",
      "corsico",
      "san donato milanese",
      "san donato",
      "pero",
      "cusago",
      "trezzano sul naviglio",
      "trezzano",
      "bresso",
      "cinisello balsamo",
      "cinisello",
      "peschiera borromeo",
      "rozzano",
      "pieve emanuele",
      "locate di triulzi",
      "locate triulzi",
      "buccinasco",
      "basiglio",
      "opera",
      "san giuliano milanese",
      "cologno monzese",
      "segrate",
      "vimodrone",
      "carugate",
      "pantigliate",
      "mediglia",
    ]),
  },
  {
    displayCity: "Roma",
    countryKeys: new Set(["italy"]),
    coreCityKeys: new Set(["roma", "rome"]),
    suburbKeys: new Set([
      "fiumicino",
      "eur",
      "guidonia",
      "pomezia",
      "monterotondo",
      "frascati",
      "marino",
      "ciampino",
    ]),
  },
  {
    displayCity: "London",
    countryKeys: new Set(["united kingdom"]),
    coreCityKeys: new Set(["london"]),
    suburbKeys: new Set([
      "greenwich",
      "wembley",
      "stratford",
      "hammersmith",
      "camden",
      "brixton",
      "islington",
    ]),
  },
  {
    displayCity: "Paris",
    countryKeys: new Set(["france"]),
    coreCityKeys: new Set(["paris"]),
    suburbKeys: new Set([
      "boulogne-billancourt",
      "saint-denis",
      "nanterre",
      "versailles",
      "montreuil",
    ]),
  },
  {
    displayCity: "Berlin",
    countryKeys: new Set(["germany", "deutschland"]),
    coreCityKeys: new Set(["berlin"]),
    suburbKeys: new Set(["potsdam"]),
  },
  {
    displayCity: "New York",
    countryKeys: new Set(["united states"]),
    coreCityKeys: new Set([
      "new york",
      "new york city",
      "nyc",
      "manhattan",
      "brooklyn",
      "queens",
      "bronx",
    ]),
    suburbKeys: new Set([
      "east rutherford",
      "newark",
      "jersey city",
      "hoboken",
    ]),
  },
];

function findMetro(country: string, city: string): MetroArea | null {
  const ck = normCountry(country);
  const cityKey = normText(city);
  if (!cityKey) return null;

  for (const metro of METRO_AREAS) {
    if (!metro.countryKeys.has(ck)) continue;
    if (metro.coreCityKeys.has(cityKey) || metro.suburbKeys.has(cityKey)) {
      return metro;
    }
  }
  return null;
}

/** City stored on venues and used in "cities visited" stats. */
export function canonicalCityName(city: string, country: string): string {
  const trimmed = city.trim();
  if (!trimmed) return trimmed;
  const metro = findMetro(country, trimmed);
  return metro?.displayCity ?? trimmed;
}

/** All city strings to match an existing venue row (suburb + core). */
export function metroCityMatchKeys(city: string, country: string): string[] {
  const metro = findMetro(country, city);
  if (!metro) return [city.trim()].filter(Boolean);
  const keys = new Set<string>([metro.displayCity]);
  for (const k of Array.from(metro.coreCityKeys)) keys.add(k);
  for (const k of Array.from(metro.suburbKeys)) keys.add(k);
  return Array.from(keys);
}

function isMilanoMetro(city: string, country: string): boolean {
  return findMetro(country, city)?.displayCity === "Milano";
}

/** Concert arena at Fiera Milano, Rho (Setlist.fm uses several names). */
export const CANONICAL_ARENA_CONCERTI_FIERA_MILANO = "Arena Concerti - Fiera Milano";

function isArenaConcertiFieraMilanoVenue(
  rawName: string,
  rawCity: string,
): boolean {
  const blob = `${rawName} ${rawCity}`;
  const n = normText(blob);
  const nameN = normText(rawName);
  const cityN = normText(rawCity);

  if (/arena\s*concerti/.test(n)) return true;
  if (/\brho\s*fiera\b/.test(n) || /\bfiera\s*(di\s*)?rho\b/.test(n)) return true;
  if (nameN === "rho fiera" || nameN === "fiera rho") return true;

  if (
    /allianz\s*cloud/.test(n) &&
    (cityN === "rho" || /\brho\b/.test(n) || /fiera\s*milano/.test(n))
  ) {
    return true;
  }

  if (/fiera\s*milano/.test(nameN) && (cityN === "rho" || /\brho\b/.test(cityN))) {
    return true;
  }

  return false;
}

/**
 * Same physical venue across sponsor renames (Setlist.fm) → one display name + metro city.
 */
export function canonicalVenueFromSetlist(
  input: CanonicalVenueInput,
): CanonicalVenueResult {
  const rawName = input.name.trim();
  const rawCity = input.city.trim();
  const city = canonicalCityName(rawCity, input.country);

  if (rawName && isMilanoMetro(city, input.country)) {
    const blob = `${rawName} ${rawCity}`;
    if (
      /forum\s*di\s*assago/i.test(blob) ||
      (/forum/i.test(blob) &&
        (/mediolanum|unipol|assago/i.test(blob) ||
          /assago/i.test(normText(rawCity))))
    ) {
      return { name: "Forum di Assago", city: "Milano" };
    }
    if (isArenaConcertiFieraMilanoVenue(rawName, rawCity)) {
      return { name: CANONICAL_ARENA_CONCERTI_FIERA_MILANO, city: "Milano" };
    }
    if (/san\s*siro|giuseppe\s*meazza|stadio\s*meazza/i.test(blob)) {
      return { name: "San Siro", city: "Milano" };
    }
  }

  return { name: rawName || input.name, city };
}

/** Stable key to match venues across imports (name + metro city + country). */
export function venueImportIdentityKey(
  name: string,
  city: string,
  country: string,
): string {
  const canon = canonicalVenueFromSetlist({ name, city, country });
  return `${normText(canon.name)}|${normText(canon.city)}|${normCountry(country)}`;
}

export function sameVenueIdentity(
  a: CanonicalVenueInput,
  b: CanonicalVenueInput,
): boolean {
  return (
    venueImportIdentityKey(a.name, a.city, a.country) ===
    venueImportIdentityKey(b.name, b.city, b.country)
  );
}
