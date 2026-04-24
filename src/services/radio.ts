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
  const r = await fetch(`${s}/json/stations/search?${qs.toString()}`);
  if (!r.ok) return [];
  return (await r.json()) as Station[];
}

export async function popularByGenre(tag: string, quality: "auto" | "low" | "med" | "high"): Promise<Station[]> {
  const all = await searchStations({ tag, limit: 120 });
  if (!all.length) return [];
  const bw = await bitrateCapFor(quality);
  const filtered = all.filter((s) => (bw === 0 ? true : s.bitrate <= bw && s.bitrate > 0));
  const ordered = filtered.length > 10 ? filtered : all;
  return ordered.slice(0, 50);
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
