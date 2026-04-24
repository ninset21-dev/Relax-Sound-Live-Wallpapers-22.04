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

export async function popularByGenre(tag: string, quality: "auto" | "low" | "med" | "high"): Promise<Station[]> {
  const all = await searchStations({ tag, limit: 120 });
  if (!all.length) return [];
  const bw = await bitrateCapFor(quality);
  const filtered = all.filter((s) => (bw === 0 ? true : s.bitrate <= bw && s.bitrate > 0));
  const ordered = filtered.length > 10 ? filtered : all;
  return ordered.slice(0, 50);
}

/**
 * Actively probe station URLs for reachability. HEAD requests are often
 * blocked by stream servers, so we do a short GET with a signal-abort after
 * a tight timeout — a successful response (or any 2xx/3xx redirect) means
 * the stream is alive.
 */
export async function probeStations(stations: Station[], timeoutMs = 2000): Promise<Station[]> {
  const probe = async (s: Station): Promise<boolean> => {
    const url = s.url_resolved || s.url;
    if (!url) return false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { method: "GET", signal: ctrl.signal });
      return r.ok || r.status === 302 || r.status === 301;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };
  const results = await Promise.all(stations.map(probe));
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
