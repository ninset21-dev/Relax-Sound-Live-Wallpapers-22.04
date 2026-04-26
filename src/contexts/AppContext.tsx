import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio, Wallpaper, Widget, Accessibility, onAudioState, onAudioRequest } from "@/native";

export type MediaItem = { uri: string; type: "image" | "video"; name?: string };
export type Track = { uri: string; title: string };
export type PerfMode = "balanced" | "high" | "eco";
export type Quality = "auto" | "low" | "med" | "high";
export type RepeatMode = "off" | "all" | "one";
// Effects fog/frost/aurora/meteor were removed at user request — they did
// not look right at native scale and added GPU cost.
export type EffectKind =
  | "none"
  | "snow"
  | "rain"
  | "bubbles"
  | "leaves"
  | "flowers"
  | "particles"
  | "fireflies"
  | "stars"
  | "cherryblossom"
  | "plasma";

interface AppState_ {
  mediaLibrary: MediaItem[];
  tracks: Track[];
  currentTrack?: Track;
  isPlaying: boolean;
  volume: number;
  fadeMs: number;
  perfMode: PerfMode;
  quality: Quality;
  effect: EffectKind;
  intensity: number;
  speed: number;
  fps: number;
  autoChangeEnabled: boolean;
  autoChangeSec: number;
  videoAudio: boolean;
  language:
    | "system"
    | "en" | "ru" | "es" | "pt" | "de" | "fr" | "it" | "tr" | "ja" | "zh" | "ar";
  overlayEnabled: boolean;
  a11yEnabled: boolean;
  liveWallpaperActive: boolean;
  repeatMode: RepeatMode;
  uiOpacity: number;
  // URI of the wallpaper image currently applied (drives the blurred
  // app background so the UI reflects the user's chosen scene).
  currentWallpaperUri?: string;
  wallpaperTarget: "home" | "lock" | "both";
  // req #18: persisted favorite radio stations.
  favoriteStations: import("@/services/radio").Station[];
  // req #12: first-launch onboarding modal acknowledged flag.
  onboardingDone: boolean;
}
type Ctx = AppState_ & {
  addMedia(items: MediaItem[]): void;
  setMedia(items: MediaItem[]): void;
  removeMedia(uri: string): void;
  removeMediaMany(uris: string[]): void;
  clearMedia(): void;
  setTracks(t: Track[]): void;
  removeTrack(uri: string): void;
  setVolume(v: number): void;
  setFadeMs(ms: number): void;
  setPerfMode(m: PerfMode): void;
  setQuality(q: Quality): void;
  setEffect(e: EffectKind): void;
  setIntensity(i: number): void;
  setSpeed(s: number): void;
  setFps(f: number): void;
  setAutoChangeEnabled(b: boolean): void;
  setAutoChangeSec(n: number): void;
  setVideoAudio(on: boolean): void;
  toggleRepeat(): void;
  setLanguage(l: AppState_["language"]): void;
  setUiOpacity(v: number): void;
  setWallpaperTarget(t: "home" | "lock" | "both"): void;
  play(t: Track): Promise<void>;
  togglePlay(): Promise<void>;
  nextTrack(): Promise<void>;
  prevTrack(): Promise<void>;
  applyLiveWallpaper(mode: "home" | "lock" | "both"): Promise<void>;
  refreshA11y(): Promise<void>;
  toggleFavoriteStation(s: import("@/services/radio").Station): void;
  setOnboardingDone(v: boolean): void;
};

const Default: AppState_ = {
  mediaLibrary: [],
  tracks: [],
  isPlaying: false,
  volume: 0.7,
  fadeMs: 2500,
  perfMode: "balanced",
  quality: "auto",
  effect: "none",
  intensity: 0.5,
  speed: 1,
  fps: 30,
  autoChangeEnabled: false,
  autoChangeSec: 60,
  videoAudio: false,
  language: "system",
  overlayEnabled: false,
  a11yEnabled: false,
  liveWallpaperActive: false,
  repeatMode: "off",
  uiOpacity: 1,
  wallpaperTarget: "both",
  favoriteStations: [],
  onboardingDone: false
};

const AppCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "relax.state.v1";

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState_>(Default);

  const persist = useCallback((next: Partial<AppState_>) => {
    setState((prev) => {
      const merged = { ...prev, ...next };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged)).catch(() => {});
      return merged;
    });
  }, []);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setState((p) => ({ ...p, ...parsed }));
          // Apply persisted language to i18next right after hydrate so all
          // screens render in the correct language before first paint.
          if (parsed?.language) {
            try {
              const { applyLanguage } = require("@/i18n");
              applyLanguage(parsed.language);
            } catch {}
          }
        } catch {}
      }
      try { const active = await Wallpaper.isLiveWallpaperActive(); persist({ liveWallpaperActive: !!active }); } catch {}
      try { const a11y = await Accessibility.isEnabled(); persist({ a11yEnabled: !!a11y }); } catch {}

      // First-launch autoplay (req #8): start a "Nature Radio Rain"
      // stream automatically the first time the app opens. We try Radio
      // Browser first (preferred — names + bitrates), then fall back to
      // a hardcoded public ambient-rain stream so autoplay works even
      // if Radio Browser is unreachable on the device's first launch.
      try {
        const seen = await AsyncStorage.getItem("relax_first_run_done");
        if (!seen) {
          await AsyncStorage.setItem("relax_first_run_done", "1");
          let url: string | null = null;
          let title = "Nature Radio Rain";
          try {
            const { searchStations } = require("@/services/radio");
            const candidates: any[] = await searchStations({ name: "Nature Radio Rain", limit: 8 });
            const fallback: any[] = candidates.length
              ? candidates
              : await searchStations({ tag: "rain", limit: 8 });
            const pick = fallback.find((s: any) => s.url_resolved || s.url);
            if (pick) {
              url = pick.url_resolved || pick.url || null;
              title = (pick.name || "Nature Radio Rain").toString().trim();
            }
          } catch {}
          if (!url) {
            // Hardcoded public ambient-rain stream as last-resort fallback.
            // Sleep Radio (radio.sleepradio.org / sleepradio.com) — used
            // here only because Radio Browser was unreachable on first run.
            url = "https://stream.zenolive.com/76hsw3ru0eruv";
          }
          try { Audio.setPlaylist?.([{ uri: url, title }], 0); } catch {}
          try { Audio.play(url, title); } catch {}
          setState((p) => ({ ...p, currentTrack: { uri: url!, title } }));
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const sub = onAudioState((s) => {
      setState((p) => {
        const nextRepeat = (s.repeatMode as RepeatMode) ?? p.repeatMode;
        // Persist the repeat mode if it actually changed (e.g. driven by
        // widget). High-frequency volume/playing toggles are NOT persisted
        // here to avoid hammering AsyncStorage on every audio broadcast.
        if (nextRepeat !== p.repeatMode) {
          AsyncStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ ...p, repeatMode: nextRepeat })
          ).catch(() => {});
        }
        return {
          ...p,
          isPlaying: s.isPlaying,
          volume: s.volume,
          repeatMode: nextRepeat,
          currentTrack: p.currentTrack ? { ...p.currentTrack, title: s.title || p.currentTrack.title } : p.currentTrack
        };
      });
    });
    return () => sub.remove();
  }, []);

  // Keep the latest state in a ref so native broadcast listeners always see it.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const step = (dir: "next" | "prev") => {
      const s = stateRef.current;
      if (s.tracks.length === 0) return;
      const i = s.currentTrack ? s.tracks.findIndex((t) => t.uri === s.currentTrack!.uri) : -1;
      const target = dir === "next"
        ? s.tracks[(i + 1) % s.tracks.length]
        : s.tracks[(i - 1 + s.tracks.length) % s.tracks.length];
      persist({ currentTrack: target });
      Audio.play(target.uri, target.title).catch(() => {});
    };
    const sub = onAudioRequest((r) => step(r.direction));
    return () => sub.remove();
  }, [persist]);

  // Intentionally do NOT auto-pause on AppState change: when the user is on
  // their Home screen the app is inactive but the wallpaper engine is visible
  // and music should keep playing. The native RelaxAudioService reacts to
  // SCREEN_OFF and the wallpaper engine's WALLPAPER_VISIBILITY broadcasts,
  // which is the correct source of truth for "is the user actually away".

  // Push audio playlist + image library to native so native-only widget/
  // floating controls can walk tracks and shuffle wallpapers without the
  // JS runtime.
  useEffect(() => {
    // Only (re)push the local tracks playlist when the currently-selected
    // item is actually a local track. If the user is listening to a radio
    // station, music.tsx has already pushed the stations list as the native
    // playlist and we must not overwrite it (doing so broke widget NEXT/PREV
    // when listening to radio).
    const isLocal = state.currentTrack
      ? state.tracks.some((t) => t.uri === state.currentTrack!.uri)
      : true;
    if (!isLocal) return;
    const idx = state.currentTrack
      ? Math.max(0, state.tracks.findIndex((t) => t.uri === state.currentTrack!.uri))
      : 0;
    Audio.setPlaylist(state.tracks.map((t) => ({ uri: t.uri, title: t.title })), idx).catch(() => {});
  }, [state.tracks, state.currentTrack]);

  useEffect(() => {
    Widget.setMediaLibrary(state.mediaLibrary.map((m) => ({ uri: m.uri, type: m.type }))).catch(() => {});
  }, [state.mediaLibrary]);

  // Auto-change: persist the setting into the widget prefs so the native
  // LiveWallpaperService engine can rotate media on its own (works in the
  // background even when the JS bundle isn't running. The native engine's
  // maybeAutoSwap() drives the actual wallpaper rotation; a duplicate JS
  // setInterval would race with it and produce double-rate swaps, so we
  // only push the configuration here and let native do the work.
  useEffect(() => {
    Widget.setAutoChange(state.autoChangeEnabled, state.autoChangeSec).catch(() => {});
  }, [state.autoChangeEnabled, state.autoChangeSec, state.mediaLibrary]);

  const api: Ctx = useMemo(
    () => ({
      ...state,
      addMedia: (items) => persist({ mediaLibrary: [...state.mediaLibrary, ...items] }),
      setMedia: (items) => persist({ mediaLibrary: items }),
      removeMedia: (uri) =>
        persist({ mediaLibrary: state.mediaLibrary.filter((m) => m.uri !== uri) }),
      removeMediaMany: (uris) => {
        const set = new Set(uris);
        persist({ mediaLibrary: state.mediaLibrary.filter((m) => !set.has(m.uri)) });
      },
      clearMedia: () => persist({ mediaLibrary: [] }),
      setTracks: (t) => persist({ tracks: t }),
      removeTrack: (uri) => {
        const tracks = state.tracks.filter((t) => t.uri !== uri);
        if (state.currentTrack?.uri === uri) {
          persist({ tracks, currentTrack: undefined });
        } else {
          persist({ tracks });
        }
      },
      setVolume: (v) => {
        persist({ volume: v });
        Audio.setVolume(v).catch(() => {});
        Widget.updateWidgetState(state.currentTrack?.title ?? "Relax", v, "audio").catch(() => {});
      },
      setFadeMs: (ms) => { persist({ fadeMs: ms }); Audio.setFadeMs(ms).catch(() => {}); },
      setPerfMode: (m) => {
        const newFps = m === "eco" ? 15 : m === "high" ? 60 : 30;
        const newIntensity = m === "eco" ? 0.3 : state.intensity;
        persist({ perfMode: m, fps: newFps, intensity: newIntensity });
        Wallpaper.updateWallpaperParams({ fps: newFps, intensity: newIntensity, speed: state.speed, effect: state.effect }).catch(() => {});
      },
      setQuality: (q) => persist({ quality: q }),
      setEffect: (e) => {
        persist({ effect: e });
        Wallpaper.updateWallpaperParams({ effect: e, intensity: state.intensity, speed: state.speed, fps: state.fps }).catch(() => {});
      },
      setIntensity: (i) => {
        persist({ intensity: i });
        Wallpaper.updateWallpaperParams({ intensity: i }).catch(() => {});
      },
      setSpeed: (s) => { persist({ speed: s }); Wallpaper.updateWallpaperParams({ speed: s }).catch(() => {}); },
      setFps: (f) => { persist({ fps: f }); Wallpaper.updateWallpaperParams({ fps: f }).catch(() => {}); },
      setAutoChangeEnabled: (b) => persist({ autoChangeEnabled: b }),
      setAutoChangeSec: (n) => persist({ autoChangeSec: Math.max(10, n) }),
      setVideoAudio: (on) => {
        persist({ videoAudio: on });
        Wallpaper.updateWallpaperParams({ videoAudio: on }).catch(() => {});
      },
      toggleRepeat: () => {
        // Cycle locally so the next AsyncStorage persist captures it (so
        // the UI shows the right icon even on a cold start before the
        // service has had a chance to broadcast). Native service owns the
        // authoritative state and will broadcast back if it disagrees.
        const next: RepeatMode =
          state.repeatMode === "off" ? "all" : state.repeatMode === "all" ? "one" : "off";
        persist({ repeatMode: next });
        Audio.toggleRepeat?.().catch(() => {});
      },
      setLanguage: (l) => {
        persist({ language: l });
        try {
          // Lazy import to avoid circular deps at module init time.
          const { applyLanguage } = require("@/i18n");
          applyLanguage(l);
        } catch {}
      },
      // Opacity is now 0-100% (shows through to underlying wallpaper when
      // lowered). Previous 30% floor was removed per user request.
      setUiOpacity: (v) => persist({ uiOpacity: Math.max(0, Math.min(1, v)) }),
      setWallpaperTarget: (t) => persist({ wallpaperTarget: t }),
      play: async (t) => {
        // If something is already playing, treat this as a track/station
        // switch — use the short fade-in path so the user doesn't perceive
        // a pause between the two items.
        const switching = state.isPlaying || !!state.currentTrack;
        persist({ currentTrack: t });
        try {
          if (switching && Audio.playSwitch) await Audio.playSwitch(t.uri, t.title);
          else await Audio.play(t.uri, t.title);
          await Widget.updateWidgetState(t.title, state.volume, "audio");
        } catch (e) { console.warn("play fail", e); }
      },
      togglePlay: async () => { try { await Audio.toggle(); } catch {} },
      nextTrack: async () => {
        if (state.tracks.length === 0) return;
        const idx = state.currentTrack
          ? state.tracks.findIndex((t) => t.uri === state.currentTrack!.uri)
          : -1;
        const next = state.tracks[(idx + 1) % state.tracks.length];
        persist({ currentTrack: next });
        // Use playSwitch (short fade-in) so the user doesn't perceive a pause
        // between the previous and next track.
        try {
          if (Audio.playSwitch) await Audio.playSwitch(next.uri, next.title);
          else await Audio.play(next.uri, next.title);
        } catch {}
      },
      prevTrack: async () => {
        if (state.tracks.length === 0) return;
        const idx = state.currentTrack
          ? state.tracks.findIndex((t) => t.uri === state.currentTrack!.uri)
          : -1;
        const prev = state.tracks[(idx - 1 + state.tracks.length) % state.tracks.length];
        persist({ currentTrack: prev });
        try {
          if (Audio.playSwitch) await Audio.playSwitch(prev.uri, prev.title);
          else await Audio.play(prev.uri, prev.title);
        } catch {}
      },
      applyLiveWallpaper: async (mode) => {
        try {
          const video = state.mediaLibrary.find((m) => m.type === "video");
          const image = state.mediaLibrary.find((m) => m.type === "image");
          // For LOCK-only installs Android needs the image applied as a
          // static wallpaper to the LOCK surface BEFORE the live wallpaper
          // intent (otherwise Android paints the live wallpaper over lock
          // anyway). For HOME-only we do the same with the other surface.
          if (mode === "lock" && image) {
            await Wallpaper.setStaticWallpaper(image.uri, "lock");
            // Skip the live-wallpaper picker so the lock-screen static
            // survives — live wallpapers always bind to HOME on Android
            // <14, which would clobber the dedicated lock image.
            persist({ liveWallpaperActive: true, currentWallpaperUri: image.uri });
            return;
          }
          await Wallpaper.setLiveWallpaper({
            videoUri: video?.uri ?? null,
            imageUri: image?.uri ?? null,
            videoAudio: state.videoAudio,
            effect: state.effect,
            intensity: state.intensity,
            speed: state.speed,
            fps: state.fps
          });
          if (mode === "home" && image) {
            // HOME-only: keep an explicit static on LOCK so the live
            // wallpaper doesn't bleed onto the lock screen.
            await Wallpaper.setStaticWallpaper(image.uri, "lock");
          }
          persist({
            liveWallpaperActive: true,
            currentWallpaperUri: image?.uri ?? state.currentWallpaperUri
          });
        } catch (e) { console.warn("apply wallpaper fail", e); }
      },
      refreshA11y: async () => {
        try { const v = await Accessibility.isEnabled(); persist({ a11yEnabled: !!v }); } catch {}
      },
      toggleFavoriteStation: (s) => {
        const cur = state.favoriteStations || [];
        const exists = cur.some((f) => f.stationuuid === s.stationuuid);
        const next = exists
          ? cur.filter((f) => f.stationuuid !== s.stationuuid)
          : [...cur, s];
        persist({ favoriteStations: next });
      },
      setOnboardingDone: (v) => persist({ onboardingDone: v })
    }),
    [state, persist]
  );

  return <AppCtx.Provider value={api}>{children}</AppCtx.Provider>;
};

export const useApp = (): Ctx => {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("AppProvider missing");
  return ctx;
};
