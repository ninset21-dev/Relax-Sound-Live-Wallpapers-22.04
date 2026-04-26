/**
 * Radio Browser API client (https://api.radio-browser.info) — 50k+ free stations.
 * Supports filtering by tag/genre and three quality tiers. Auto quality uses NetInfo.
 */
import NetInfo from "@react-native-community/netinfo";

export interface Station {
  stationuuid: string;
  name: string;
  url_resolved: string;
  url: string;
  bitrate: number;
  codec: string;
  country: string;
  tags: string;
  favicon: string;
}

const SERVERS = [
  "https://de1.api.radio-browser.info",
  "https://at1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info"
];

let cachedServer = SERVERS[0];

async function pickServer(): Promise<string> {
  for (const s of SERVERS) {
    try {
      const r = await fetch(`${s}/json/stats`, { method: "GET" });
      if (r.ok) { cachedServer = s; return s; }
    } catch {}
  }
  return cachedServer;
}

export async function searchStations(params: {
  tag?: string;
  name?: string;
  limit?: number;
}): Promise<Station[]> {
  const s = await pickServer();
  const qs = new URLSearchParams();
  if (params.tag) qs.set("tag", params.tag);
  if (params.name) qs.set("name", params.name);
  qs.set("hidebroken", "true");
  qs.set("order", "clickcount");
  qs.set("reverse", "true");
  qs.set("limit", String(params.limit ?? 80));
  // Request last-check-ok via is_https=false is not a real filter, but we
  // additionally post-filter below using the fields returned by the API.
  const r = await fetch(`${s}/json/stations/search?${qs.toString()}`);
  if (!r.ok) return [];
  const raw = (await r.json()) as (Station & {
    lastcheckok?: number | boolean;
    lastcheckoktime_iso8601?: string | null;
  })[];
  // Radio Browser marks broken stations with lastcheckok === 0 and, despite
  // hidebroken=true, sometimes still returns them. Belt-and-braces filter:
  // keep only stations with a resolvable URL, a non-zero bitrate, and a
  // positive lastcheckok flag.
  return raw.filter(
    (s) =>
      (s.url_resolved || s.url) &&
      s.bitrate > 0 &&
      (s.lastcheckok === undefined ||
        s.lastcheckok === 1 ||
        s.lastcheckok === true)
  );
}

// Curated whitelist: req #17 — keep only the most-listened-to global stations.
// We restrict country codes to majors (US/CA/UK/EU/AU/JP) to drop low-traffic
// long-tail stations and use clickcount ordering. Also skip stations whose
// `lastcheckok` is not 1 to ensure each entry is currently reachable.
const GLOBAL_COUNTRIES = new Set([
  "United States Of America", "United States", "Canada", "United Kingdom",
  "Germany", "France", "Italy", "Spain", "Netherlands", "Sweden", "Norway",
  "Denmark", "Poland", "Czech Republic", "Austria", "Switzerland",
  "Australia", "Japan", "South Korea", "Brazil", "Mexico", "Ireland",
  "Belgium", "Portugal", "Finland", "New Zealand"
]);

export async function popularByGenre(tag: string, quality: "auto" | "low" | "med" | "high"): Promise<Station[]> {
  const all = await searchStations({ tag, limit: 200 });
  if (!all.length) return [];
  const bw = await bitrateCapFor(quality);
  // Curated cut: only stations from major-traffic countries with healthy
  // bitrate (>=48kbps, weeds out tiny vanity streams).
  const curated = all.filter(
    (s) =>
      GLOBAL_COUNTRIES.has(s.country) &&
      s.bitrate >= 48 &&
      (bw === 0 ? true : s.bitrate <= bw)
  );
  const ordered = curated.length >= 10 ? curated : all.filter((s) => s.bitrate > 0);
  return ordered.slice(0, 40);
}

/**
 * Pull a random pool spanning multiple genres. Used by the "shuffle across
 * genres" button (req #16). We sample 8 genres in parallel and return a
 * mixed pool the caller can pick from.
 */
export async function randomFromAllGenres(limitPerGenre = 8): Promise<Station[]> {
  const sampleGenres = [...GENRES].sort(() => Math.random() - 0.5).slice(0, 8);
  const lists = await Promise.all(
    sampleGenres.map((g) => popularByGenre(g, "auto").catch(() => []))
  );
  const merged: Station[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const s of list.slice(0, limitPerGenre)) {
      const id = s.stationuuid;
      if (!seen.has(id)) { seen.add(id); merged.push(s); }
    }
  }
  return merged.sort(() => Math.random() - 0.5).slice(0, 80);
}

/**
 * Actively probe station URLs for reachability. HEAD requests are often
 * blocked by stream servers, so we do a tightly bounded GET — using a
 * Range: bytes=0-0 header so the server only returns one byte (or the
 * response headers, if it ignores Range). We also limit concurrency so we
 * never have more than 6 streams open at once, which keeps mobile-data
 * usage well under ~50KB per genre switch.
 */
export async function probeStations(stations: Station[], timeoutMs = 2500): Promise<Station[]> {
  const probeOne = async (s: Station): Promise<boolean> => {
    const url = s.url_resolved || s.url;
    if (!url) return false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, {
        method: "GET",
        signal: ctrl.signal,
        // Many shoutcast servers honour Range and stop sending after a single
        // byte; the rest fall back to streaming, which we abort below.
        headers: { Range: "bytes=0-0" },
      });
      if (!(r.ok || r.status === 206 || r.status === 302 || r.status === 301)) return false;
      const ct = (r.headers.get("content-type") || "").toLowerCase();
      if (
        ct.includes("audio/") ||
        ct.includes("application/ogg") ||
        ct.includes("application/octet-stream")
      ) return true;
      const low = url.toLowerCase().split("?")[0];
      if (/\.(mp3|aac|ogg|m4a|flac|wav|opus|webm)$/.test(low)) return true;
      return false;
    } catch {
      return false;
    } finally {
      // Always abort — otherwise a successful probe leaves a never-ending
      // audio stream open, leaking connections and battery across many probes.
      ctrl.abort();
      clearTimeout(timer);
    }
  };
  // Bounded concurrency pool — at most CONCURRENCY in-flight at a time.
  const CONCURRENCY = 6;
  const results = new Array<boolean>(stations.length).fill(false);
  let cursor = 0;
  const workers = new Array(Math.min(CONCURRENCY, stations.length)).fill(0).map(async () => {
    while (cursor < stations.length) {
      const idx = cursor++;
      results[idx] = await probeOne(stations[idx]);
    }
  });
  await Promise.all(workers);
  return stations.filter((_, i) => results[i]);
}

async function bitrateCapFor(q: "auto" | "low" | "med" | "high"): Promise<number> {
  if (q === "low") return 64;
  if (q === "med") return 128;
  if (q === "high") return 1000;
  const state = await NetInfo.fetch();
  if (state.type === "wifi") return 1000;
  if (state.type === "cellular") {
    // @ts-ignore
    const g = (state.details as any)?.cellularGeneration ?? "4g";
    if (g === "5g") return 320;
    if (g === "4g") return 192;
    if (g === "3g") return 96;
    return 64;
  }
  return 128;
}

export const GENRES = [
  "relax", "ambient", "nature", "chillout", "lounge", "classical",
  "jazz", "meditation", "piano", "electronic", "downtempo", "lofi",
  "rock", "pop", "dance", "rap", "news", "talk", "indie", "folk"
];
