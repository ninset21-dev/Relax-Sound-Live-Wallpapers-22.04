import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio, Wallpaper, Widget, Accessibility, onAudioState, onAudioRequest } from "@/native";

export type MediaItem = { uri: string; type: "image" | "video"; name?: string };
export type Track = { uri: string; title: string };
export type PerfMode = "balanced" | "high" | "eco";
export type StartupSource = "radio" | "local";
export type Quality = "auto" | "low" | "med" | "high";
export type EffectKind =
  | "none"
  | "snow"
  | "rain"
  | "bubbles"
  | "leaves"
  | "flowers"
  | "particles"
  | "fireflies"
  | "fog"
  | "frost"
  | "stars"
  | "aurora";

interface AppState_ {
  mediaLibrary: MediaItem[];
  tracks: Track[];
  currentTrack?: Track;
  isPlaying: boolean;
  volume: number;
  fadeMs: number;
  perfMode: PerfMode;
  startup: StartupSource;
  quality: Quality;
  effect: EffectKind;
  intensity: number;
  speed: number;
  fps: number;
  autoChangeEnabled: boolean;
  autoChangeSec: number;
  videoAudio: boolean;
  language: "system" | "ru" | "en";
  overlayEnabled: boolean;
  a11yEnabled: boolean;
  liveWallpaperActive: boolean;
}
type Ctx = AppState_ & {
  addMedia(items: MediaItem[]): void;
  removeMedia(uri: string): void;
  removeMediaMany(uris: string[]): void;
  clearMedia(): void;
  setTracks(t: Track[]): void;
  removeTrack(uri: string): void;
  setVolume(v: number): void;
  setFadeMs(ms: number): void;
  setPerfMode(m: PerfMode): void;
  setStartup(s: StartupSource): void;
  setQuality(q: Quality): void;
  setEffect(e: EffectKind): void;
  setIntensity(i: number): void;
  setSpeed(s: number): void;
  setFps(f: number): void;
  setAutoChangeEnabled(b: boolean): void;
  setAutoChangeSec(n: number): void;
  setVideoAudio(on: boolean): void;
  play(t: Track): Promise<void>;
  togglePlay(): Promise<void>;
  nextTrack(): Promise<void>;
  prevTrack(): Promise<void>;
  applyLiveWallpaper(mode: "home" | "lock" | "both"): Promise<void>;
  refreshA11y(): Promise<void>;
};

const Default: AppState_ = {
  mediaLibrary: [],
  tracks: [],
  isPlaying: false,
  volume: 0.7,
  fadeMs: 2500,
  perfMode: "balanced",
  startup: "radio",
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
  liveWallpaperActive: false
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
      if (raw) { try { setState((p) => ({ ...p, ...JSON.parse(raw) })); } catch {} }
      try { const active = await Wallpaper.isLiveWallpaperActive(); persist({ liveWallpaperActive: !!active }); } catch {}
      try { const a11y = await Accessibility.isEnabled(); persist({ a11yEnabled: !!a11y }); } catch {}
    })();
  }, []);

  useEffect(() => {
    const sub = onAudioState((s) =>
      setState((p) => ({ ...p, isPlaying: s.isPlaying, volume: s.volume, currentTrack: p.currentTrack ? { ...p.currentTrack, title: s.title || p.currentTrack.title } : p.currentTrack }))
    );
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
    const idx = state.currentTrack
      ? Math.max(0, state.tracks.findIndex((t) => t.uri === state.currentTrack!.uri))
      : 0;
    Audio.setPlaylist(state.tracks.map((t) => ({ uri: t.uri, title: t.title })), idx).catch(() => {});
  }, [state.tracks, state.currentTrack]);

  useEffect(() => {
    Widget.setMediaLibrary(state.mediaLibrary.map((m) => ({ uri: m.uri, type: m.type }))).catch(() => {});
  }, [state.mediaLibrary]);

  // Auto-change timer: every N seconds, pick the next image in the library
  // and push it to the native wallpaper engine. The engine re-reads prefs on
  // each frame tick so the swap is seamless.
  useEffect(() => {
    if (!state.autoChangeEnabled || state.mediaLibrary.length < 2) return;
    const images = state.mediaLibrary.filter((m) => m.type === "image");
    if (images.length < 2) return;
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % images.length;
      const pick = images[i];
      Wallpaper.updateWallpaperParams({ imageUri: pick.uri }).catch(() => {});
    }, Math.max(10, state.autoChangeSec) * 1000);
    return () => clearInterval(id);
  }, [state.autoChangeEnabled, state.autoChangeSec, state.mediaLibrary]);

  const api: Ctx = useMemo(
    () => ({
      ...state,
      addMedia: (items) => persist({ mediaLibrary: [...state.mediaLibrary, ...items] }),
      removeMedia: (uri) =>
        persist({ mediaLibrary: state.mediaLibrary.filter((m) => m.uri !== uri) }),
      removeMediaMany: (uris) => {
        const set = new Set(uris);
        persist({ mediaLibrary: state.mediaLibrary.filter((m) => !set.has(m.uri)) });
      },
      clearMedia: () => persist({ mediaLibrary: [] }),
      setTracks: (t) => persist({ tracks: t }),
      removeTrack: (uri) => persist({ tracks: state.tracks.filter((t) => t.uri !== uri) }),
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
      setStartup: (s) => persist({ startup: s }),
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
      play: async (t) => {
        persist({ currentTrack: t });
        try {
          await Audio.play(t.uri, t.title);
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
        try { await Audio.play(next.uri, next.title); } catch {}
      },
      prevTrack: async () => {
        if (state.tracks.length === 0) return;
        const idx = state.currentTrack
          ? state.tracks.findIndex((t) => t.uri === state.currentTrack!.uri)
          : -1;
        const prev = state.tracks[(idx - 1 + state.tracks.length) % state.tracks.length];
        persist({ currentTrack: prev });
        try { await Audio.play(prev.uri, prev.title); } catch {}
      },
      applyLiveWallpaper: async (mode) => {
        try {
          const video = state.mediaLibrary.find((m) => m.type === "video");
          const image = state.mediaLibrary.find((m) => m.type === "image");
          await Wallpaper.setLiveWallpaper({
            videoUri: video?.uri ?? null,
            imageUri: image?.uri ?? null,
            videoAudio: state.videoAudio,
            effect: state.effect,
            intensity: state.intensity,
            speed: state.speed,
            fps: state.fps
          });
          // Android's ACTION_CHANGE_LIVE_WALLPAPER installs on SYSTEM by
          // default; to install only on lock we still use that intent (the
          // live wallpaper goes on both) but also set a static image on the
          // other surface. For HOME-only we apply a static to LOCK; for
          // LOCK-only we apply a static to HOME.
          if (mode !== "both" && image) {
            const other: "home" | "lock" = mode === "home" ? "lock" : "home";
            await Wallpaper.setStaticWallpaper(image.uri, other);
          }
          persist({ liveWallpaperActive: true });
        } catch (e) { console.warn("apply wallpaper fail", e); }
      },
      refreshA11y: async () => {
        try { const v = await Accessibility.isEnabled(); persist({ a11yEnabled: !!v }); } catch {}
      }
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
