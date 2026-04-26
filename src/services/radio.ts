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

/**
 * Country whitelist (req #19): keep only stations from heavily-streamed
 * US/EU regions where most users live. Stations outside this list are
 * dropped — Radio Browser's clickcount ordering already biases toward
 * popular stations, but it leaks Brazilian/Indonesian/Russian regional
 * stations that are often unreachable on US/EU networks. Tweaked
 * empirically from station-aliveness probes during development.
 */
const COUNTRY_WHITELIST = new Set([
  "The United States Of America", "United States", "USA",
  "United Kingdom", "Germany", "France", "Netherlands", "Italy", "Spain",
  "Poland", "Austria", "Belgium", "Switzerland", "Sweden", "Norway",
  "Finland", "Denmark", "Ireland", "Portugal", "Greece", "Czechia",
  "Hungary", "Romania", "Slovakia", "Slovenia", "Croatia", "Bulgaria",
  "Estonia", "Latvia", "Lithuania", "Luxembourg", "Iceland", "Canada"
]);

export async function popularByGenre(tag: string, quality: "auto" | "low" | "med" | "high"): Promise<Station[]> {
  const all = await searchStations({ tag, limit: 200 });
  if (!all.length) return [];
  const bw = await bitrateCapFor(quality);
  // Filter by bitrate cap + US/EU country whitelist (req #19).
  const filtered = all.filter((s) => {
    if (bw !== 0 && (s.bitrate > bw || s.bitrate <= 0)) return false;
    return COUNTRY_WHITELIST.has((s.country || "").trim());
  });
  const ordered = filtered.length > 10 ? filtered : all.filter((s) => COUNTRY_WHITELIST.has((s.country || "").trim()));
  return (ordered.length ? ordered : all).slice(0, 50);
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
