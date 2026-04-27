import { NativeModules, DeviceEventEmitter, Platform } from "react-native";

type Promiselike<T> = Promise<T>;

export interface WallpaperParams {
  videoUri?: string | null;
  imageUri?: string | null;
  videoAudio?: boolean;
  effect?:
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
  intensity?: number; // 0..1
  speed?: number; // 0.2..3
  fps?: number; // 10..60
}

interface WallpaperModuleI {
  setStaticWallpaper(uri: string, target: "home" | "lock" | "both"): Promiselike<boolean>;
  setLiveWallpaper(p: WallpaperParams): Promiselike<boolean>;
  updateWallpaperParams(p: WallpaperParams): Promiselike<boolean>;
  isLiveWallpaperActive(): Promiselike<boolean>;
}
interface AudioModuleI {
  play(url: string, title: string): Promiselike<boolean>;
  playSwitch?(url: string, title: string): Promiselike<boolean>;
  pause(): Promiselike<boolean>;
  toggle(): Promiselike<boolean>;
  setVolume(v: number): Promiselike<boolean>;
  setFadeMs(ms: number): Promiselike<boolean>;
  setPlaylist(items: { uri: string; title: string }[], index: number): Promiselike<boolean>;
  duck(): Promiselike<boolean>;
  unduck(): Promiselike<boolean>;
  toggleRepeat?(): Promiselike<boolean>;
  setRepeatMode?(mode: "off" | "all" | "one"): Promiselike<boolean>;
  setPlaybackMode?(mode: "alwaysPlay" | "pauseAware"): Promiselike<string>;
}
interface WidgetModuleI {
  updateWidgetState(title: string, volume: number, mode: string): Promiselike<boolean>;
  setMediaLibrary(items: { uri: string; type: string }[]): Promiselike<boolean>;
  setAutoChange(enabled: boolean, seconds: number): Promiselike<boolean>;
  setTheme?(accentHex: string, widgetOpacity: number, floatingOpacity: number): Promiselike<boolean>;
}
interface FloatingModuleI {
  hasOverlayPermission(): Promiselike<boolean>;
  requestOverlayPermission(): Promiselike<boolean>;
  show(): Promiselike<boolean>;
  hide(): Promiselike<boolean>;
}
interface AccessibilityModuleI {
  isEnabled(): Promiselike<boolean>;
  openAccessibilitySettings(): Promiselike<boolean>;
}

const noop = async () => false as const;
const stub = new Proxy(
  {},
  { get: () => noop }
) as any;

const isAndroid = Platform.OS === "android";

export const Wallpaper: WallpaperModuleI = isAndroid
  ? (NativeModules.RelaxWallpaperModule as WallpaperModuleI) ?? stub
  : stub;
export const Audio: AudioModuleI = isAndroid
  ? (NativeModules.RelaxAudioModule as AudioModuleI) ?? stub
  : stub;
export const Widget: WidgetModuleI = isAndroid
  ? (NativeModules.RelaxWidgetModule as WidgetModuleI) ?? stub
  : stub;
export const Floating: FloatingModuleI = isAndroid
  ? (NativeModules.RelaxFloatingModule as FloatingModuleI) ?? stub
  : stub;
export const Accessibility: AccessibilityModuleI = isAndroid
  ? (NativeModules.RelaxAccessibilityModule as AccessibilityModuleI) ?? stub
  : stub;

export const onAudioState = (cb: (s: { title: string; isPlaying: boolean; volume: number; repeatMode?: string }) => void) =>
  DeviceEventEmitter.addListener("RelaxAudioState", cb);

export const onAudioRequest = (cb: (r: { direction: "next" | "prev" }) => void) =>
  DeviceEventEmitter.addListener("RelaxAudioRequest", cb);
