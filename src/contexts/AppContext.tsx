import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { AppState } from "react-native";
import { Audio, Wallpaper, Widget, Floating, Accessibility, onAudioState } from "@/native";

export type MediaItem = { uri: string; type: "image" | "video"; name?: string };
export type Track = { uri: string; title: string };
export type PerfMode = "balanced" | "high" | "eco";
export type StartupSource = "radio" | "local";
export type Quality = "auto" | "low" | "med" | "high";
export type EffectKind = "none" | "snow" | "rain" | "bubbles" | "leaves" | "flowers" | "particles" | "fireflies";

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
  language: "system" | "ru" | "en";
  overlayEnabled: boolean;
  a11yEnabled: boolean;
  liveWallpaperActive: boolean;
}
type Ctx = AppState_ & {
  addMedia(items: MediaItem[]): void;
  clearMedia(): void;
  setTracks(t: Track[]): void;
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
  play(t: Track): Promise<void>;
  togglePlay(): Promise<void>;
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

  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) => {
      if (st !== "active") {
        Audio.pause().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  const api: Ctx = useMemo(
    () => ({
      ...state,
      addMedia: (items) => persist({ mediaLibrary: [...state.mediaLibrary, ...items] }),
      clearMedia: () => persist({ mediaLibrary: [] }),
      setTracks: (t) => persist({ tracks: t }),
      setVolume: (v) => {
        persist({ volume: v });
        Audio.setVolume(v).catch(() => {});
        Widget.updateWidgetState(state.currentTrack?.title ?? "Relax", v, "audio").catch(() => {});
      },
      setFadeMs: (ms) => { persist({ fadeMs: ms }); Audio.setFadeMs(ms).catch(() => {}); },
      setPerfMode: (m) => {
        persist({ perfMode: m, fps: m === "eco" ? 15 : m === "high" ? 60 : 30, intensity: m === "eco" ? 0.3 : state.intensity });
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
      play: async (t) => {
        persist({ currentTrack: t });
        try {
          await Audio.play(t.uri, t.title);
          await Widget.updateWidgetState(t.title, state.volume, "audio");
        } catch (e) { console.warn("play fail", e); }
      },
      togglePlay: async () => { try { await Audio.toggle(); } catch {} },
      applyLiveWallpaper: async (mode) => {
        try {
          const video = state.mediaLibrary.find((m) => m.type === "video");
          const image = state.mediaLibrary.find((m) => m.type === "image");
          await Wallpaper.setLiveWallpaper({
            videoUri: video?.uri ?? null,
            imageUri: image?.uri ?? null,
            effect: state.effect,
            intensity: state.intensity,
            speed: state.speed,
            fps: state.fps
          });
          if (mode !== "both" && image) {
            // fall back to static for the other surface to honor separate home/lock
            await Wallpaper.setStaticWallpaper(image.uri, mode);
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
