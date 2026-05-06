# Relax Sound Live Wallpapers

> A privacy-friendly Android app that pairs **animated live wallpapers**, **ambient particle effects**, and **persistent ambient audio** (curated radio + local tracks) into a single, low-power, glassmorphism-themed experience.

[![Platform](https://img.shields.io/badge/platform-Android%207.0%2B-3DDC84?logo=android&logoColor=white)](#requirements)
[![Expo SDK](https://img.shields.io/badge/Expo%20SDK-52-000020?logo=expo&logoColor=white)](https://docs.expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.76-61DAFB?logo=react&logoColor=white)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Build](https://img.shields.io/badge/build-EAS-4630EB?logo=expo&logoColor=white)](https://docs.expo.dev/eas/)
[![License](https://img.shields.io/badge/license-Proprietary-lightgrey)](#license)

Built with **Expo (React Native + TypeScript)** plus native **Kotlin** modules injected at build time via custom **Expo Config Plugins**. The React Native New Architecture (`newArchEnabled: true`) is enabled.

<p align="center">
  <img src="design-v2/Home%20%26%20Wallpaper%20Setup.png" alt="Home & Wallpaper Setup" width="260" />
  <img src="design-v2/Music%20%26%20Radio%20Hub.png" alt="Music & Radio Hub" width="260" />
  <img src="design-v2/Widget%20Preview%20%26%20Config.png" alt="Widget Preview & Config" width="260" />
</p>

---

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Requirements](#requirements)
- [Getting Started](#getting-started)
- [Build & Deploy](#build--deploy)
- [Scripts Reference](#scripts-reference)
- [Localization](#localization)
- [Performance Modes](#performance-modes)
- [Permissions](#permissions)
- [Tech Stack](#tech-stack)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)
- [Credits](#credits)

---

## Features

- **Live Wallpapers** — `WallpaperService` engine with Canvas / OpenGL rendering and independent **HOME** and **LOCK** screen targets.
- **Atmosphere Effects** — snow, rain, bubbles, leaves, flowers, particles, fireflies, stars, cherry blossom, and plasma overlays with adjustable intensity, speed, and FPS (10–120).
- **Auto-Rotate Wallpapers** — native, timer-based cycling across a multi-select photo / video set or a public Google Photos album, with smooth fades.
- **Music Player** — local tracks via Storage Access Framework (SAF) multi-select, plus online radio (20+ genres via the [Radio Browser API](https://api.radio-browser.info)) with adaptive quality based on network speed.
- **Foreground Audio Service** — persistent **ExoPlayer (Media3)** playback, single-stream guarantee, audio-focus / ducking handling, gapless crossfade between tracks, smooth fade-in on resume.
- **Pause Modes** — `PauseAware` (auto-pause on screen off, resume on unlock) or `AlwaysPlay` (uninterrupted background playback).
- **Home Screen Widgets** — three `AppWidgetProvider` sizes with volume slider, play / pause, next / prev, mode toggle, and current track title.
- **Floating Overlay Widget** — a `SYSTEM_ALERT_WINDOW` overlay anchored bottom-right, with swipe volume slider and collapse button.
- **Double-Tap Lock** — `AccessibilityService`-powered screen lock via gesture, with deep-link to system A11y settings.
- **Glassmorphism UI** — dark-green theme with semi-transparent blurred cards, plus theme color and opacity controls.
- **Internationalization** — auto-detects the Android system locale across **11 languages** (see [Localization](#localization)).
- **Build Optimizations** — ProGuard / R8, resource shrinking, Hermes JS engine, React Native New Architecture (Fabric / TurboModules).

---

## Screenshots

Reference UI mockups live in [`design-v2/`](./design-v2). They illustrate the core surfaces of the app — the shipping app may differ slightly.

| Home & Wallpaper Setup | Music & Radio Hub | Atmosphere Effects |
|---|---|---|
| <img src="design-v2/Home%20%26%20Wallpaper%20Setup.png" alt="Home & Wallpaper Setup" width="240" /> | <img src="design-v2/Music%20%26%20Radio%20Hub.png" alt="Music & Radio Hub" width="240" /> | <img src="design-v2/Advanced%20Settings.png" alt="Atmosphere Effects" width="240" /> |

| Widget Preview & Config | About & Social |
|---|---|
| <img src="design-v2/Widget%20Preview%20%26%20Config.png" alt="Widget Preview & Config" width="240" /> | <img src="design-v2/About%20%26%20Social.png" alt="About & Social" width="240" /> |

---

## Architecture

The app follows an **Expo Config Plugin** pattern: every native Kotlin source lives in `plugins/native/` as JavaScript template strings. During `expo prebuild`, custom plugins write those sources into the generated `android/` project along with the required manifest entries, resources, and Gradle dependencies. The generated `android/` directory is git-ignored and reproducible from source.

```
┌──────────────────────────────────────────────────┐
│  React Native (TypeScript, Expo Router)          │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  │
│  │  Home  │  │ Music  │  │Effects │  │Settings│  │
│  └───┬────┘  └───┬────┘  └───┬────┘  └───┬────┘  │
│      └───────────┴───────────┴───────────┘       │
│                  AppContext                      │
│         (state, persistence, native bridge)      │
├──────────────────────────────────────────────────┤
│  Native Modules (Kotlin via NativeModules)       │
│  ┌────────────────┐  ┌────────────────┐          │
│  │ WallpaperModule│  │  AudioModule   │          │
│  ├────────────────┤  ├────────────────┤          │
│  │  WidgetModule  │  │ FloatingModule │          │
│  ├────────────────┤  ├────────────────┤          │
│  │   A11yModule   │  │                │          │
│  └────────────────┘  └────────────────┘          │
├──────────────────────────────────────────────────┤
│  Android Services                                │
│  RelaxWallpaperService ─ RelaxAudioService       │
│  AppWidgetProvider ──── FloatingWidgetService    │
│  RelaxAccessibilityService                       │
└──────────────────────────────────────────────────┘
```

---

## Project Structure

```
app/                          Expo Router screens (tab navigation)
├── _layout.tsx               Root layout (gradient + global effect layer)
└── (tabs)/
    ├── _layout.tsx           Tab bar
    ├── index.tsx             Home — media picker, wallpaper controls
    ├── music.tsx             Music — local player + online radio
    ├── effects.tsx           Effects — particle configuration
    └── settings.tsx          Settings — perf mode, language, widgets, overlay

src/
├── components/               Reusable UI (GlassCard, PrimaryButton, etc.)
├── contexts/AppContext.tsx   Global state + native-bridge orchestration
├── i18n/
│   ├── index.ts              i18next setup + locale auto-detection
│   └── languages.ts          11-language translation dictionaries
├── native/index.ts           TypeScript types for native modules (no-op stubs on non-Android)
├── services/
│   ├── radio.ts              Radio Browser client with quality tiers + probing
│   └── googlePhotos.ts       Public Google Photos album scraper
└── theme/theme.ts            Glassmorphism design tokens

plugins/                      Expo Config Plugins (build-time Android injection)
├── withLiveWallpaper.js      Wallpaper service + engine + effect renderer
├── withAudioService.js       Foreground ExoPlayer service
├── withAppWidget.js          Home screen widgets
├── withFloatingWidget.js     SYSTEM_ALERT_WINDOW overlay
├── withAccessibilityService.js  Double-tap lock
├── withWallpaperModule.js    JS ↔ native bridge for wallpaper control
├── withTransparentActivity.js   Launcher-transparent activity for live preview
├── utils.js                  Shared file-writing helpers
└── native/                   Kotlin source templates
    ├── LiveWallpaperService.kt.js
    ├── WallpaperEngine.kt.js
    └── EffectRenderer.kt.js

assets/                       App icons (PNG, SVG, adaptive) and splash screen
design-v2/                    Static UI mockups for the v2 redesign

app.json                      Expo manifest (permissions, plugins, version)
eas.json                      EAS Build profiles
metro.config.js               Metro bundler overrides (GLSL asset extensions)
babel.config.js               Babel + module-resolver config
tsconfig.json                 Strict TypeScript configuration
```

---

## Requirements

| Tool          | Version                                       |
|---------------|-----------------------------------------------|
| Node.js       | 18+ (LTS recommended)                         |
| npm           | 9+                                            |
| EAS CLI       | `>= 13.0.0`                                   |
| Expo SDK      | `~52`                                         |
| Android SDK   | `compileSdk 35`, `minSdk 24` (Android 7.0+)   |
| Java / JDK    | 17 (only for local `expo run:android`)        |

> **Note:** iOS is not supported. Every core feature (live wallpapers, foreground audio service, system-alert overlay, accessibility lock) depends on Android-specific APIs, so the app intentionally targets Android only.

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/ninset21-dev/Relax-Sound-Live-Wallpapers-22.04.git
cd Relax-Sound-Live-Wallpapers-22.04
```

### 2. Install dependencies

```bash
npm install
```

### 3. Generate the native Android project

```bash
npm run prebuild
# equivalent to: expo prebuild --platform android --clean
```

This runs every config plugin and produces the `android/` directory with the injected Kotlin sources, manifest entries, and Gradle dependencies.

### 4. Run on a connected device or emulator

```bash
npm run android
# equivalent to: expo run:android
```

Or start the Expo dev server (Metro) and launch from a development build:

```bash
npm start
```

> **Tip:** After installing the app, manually enable it as the system live wallpaper from your launcher's wallpaper picker. The Home screen also exposes a one-tap "Apply" shortcut.

---

## Build & Deploy

All distributable builds use [Expo Application Services (EAS)](https://docs.expo.dev/eas/). Profiles are defined in [`eas.json`](./eas.json).

### Login to EAS

```bash
npx eas login
```

### Preview APK (internal testing)

```bash
npm run build:apk
# eas build -p android --profile preview
```

Produces a release-signed `.apk`. Gradle command: `:app:assembleRelease`.

### Production APK (store-ready)

```bash
npm run build:production
# eas build -p android --profile production
```

The `production` profile is currently configured to output an `.apk` (`buildType: "apk"` in `eas.json`). If you need an Android App Bundle for Google Play, change `buildType` to `"app-bundle"` before running the command.

### Submit to Google Play

```bash
npx eas submit -p android
```

---

## Scripts Reference

| Script                       | Command                                          | Description                              |
|------------------------------|--------------------------------------------------|------------------------------------------|
| `npm start`                  | `expo start`                                     | Start Expo dev server (Metro)            |
| `npm run android`            | `expo run:android`                               | Build and run on Android device/emulator |
| `npm run prebuild`           | `expo prebuild --platform android --clean`       | Regenerate native Android project        |
| `npm run build:apk`          | `eas build -p android --profile preview`         | EAS preview APK build                    |
| `npm run build:production`   | `eas build -p android --profile production`      | EAS production build                     |
| `npm run lint`               | `expo lint`                                      | Run ESLint via Expo                      |
| `npm run typecheck`          | `tsc --noEmit`                                   | TypeScript type checking                 |

---

## Localization

The app ships with translations for **11 languages**: English, Russian, Spanish, Portuguese, German, French, Italian, Turkish, Japanese, Chinese, and Arabic. The active language is auto-detected from the Android system locale via `expo-localization` and falls back to English when no exact match exists. Users can override the choice (`system` or a specific language) in **Settings**.

Translation dictionaries live in [`src/i18n/languages.ts`](./src/i18n/languages.ts). To add a new language:

1. Add a translation object next to the existing entries in `languages.ts`.
2. Import it from [`src/i18n/index.ts`](./src/i18n/index.ts) and register it in the `resources` map and the `SUPPORTED_LANGUAGES` array.
3. Add a `code.startsWith(...)` check inside `detectSystemLanguage()` if you want it auto-selected.

---

## Performance Modes

Configurable in **Settings → App Mode**:

| Mode      | FPS | Default Intensity | Best for                          |
|-----------|-----|-------------------|-----------------------------------|
| Eco       | 15  | 0.3               | Battery saving, older devices     |
| Balanced  | 30  | User-set          | Default daily use                 |
| High      | 60  | User-set          | Smooth visuals, flagship devices  |

The native engine throttles between **10 and 120 FPS** regardless of the selected preset, so you can fine-tune further from the Effects screen.

---

## Permissions

The app requests only what is required to run live wallpapers and persistent audio. The full list lives in [`app.json`](./app.json); the most notable entries:

| Permission                                | Why it's needed                                          |
|-------------------------------------------|----------------------------------------------------------|
| `BIND_WALLPAPER` / `SET_WALLPAPER`        | Register and apply the live wallpaper engine            |
| `FOREGROUND_SERVICE_MEDIA_PLAYBACK`       | Keep ExoPlayer playing while the app is backgrounded    |
| `READ_MEDIA_IMAGES` / `_VIDEO` / `_AUDIO` | Pick local photos, videos, and music tracks            |
| `SYSTEM_ALERT_WINDOW`                     | Floating volume / playback overlay                      |
| `POST_NOTIFICATIONS`                      | Foreground-service notification (Android 13+)           |
| `RECEIVE_BOOT_COMPLETED`                  | Restart the wallpaper engine after device reboot        |

`CAMERA` and `RECORD_AUDIO` are explicitly **blocked** in `app.json` to make permission intent unambiguous.

---

## Tech Stack

**Frontend:** React Native 0.76, Expo SDK 52, Expo Router, React Native Reanimated, Gesture Handler, `expo-blur`, `expo-image`, `expo-video-thumbnails`, `expo-linear-gradient`.

**Native (Kotlin):** ExoPlayer (Media3), Canvas + OpenGL rendering, `WallpaperService`, Foreground Service, `AppWidgetProvider`, `AccessibilityService`, `SYSTEM_ALERT_WINDOW`.

**Build:** EAS Build, Expo Config Plugins, Hermes, ProGuard / R8, React Native New Architecture (Fabric / TurboModules).

**Networking:** Radio Browser API, Google Photos public-album scraping, `@react-native-community/netinfo` for adaptive quality.

**Persistence:** AsyncStorage for user preferences; `expo-file-system` + SAF for media materialization into app-private storage so the foreground audio / wallpaper services keep access after picker permissions expire.

---

## Troubleshooting

- **The wallpaper doesn't appear in the system picker.** Make sure the APK was actually installed — the Metro dev server alone is not enough. The wallpaper service is only registered once the native build is on the device.
- **Audio stops when the screen turns off.** Switch the playback mode to **Always-Play** in Settings. On some OEMs (Xiaomi, Huawei, OnePlus) you also need to enable autostart and disable battery optimization for the app.
- **The floating widget doesn't show up.** Grant the *"Display over other apps"* permission from Android Settings → Apps → Special access.
- **Double-tap lock doesn't work.** Enable the *Relax Sound* accessibility service in Android Settings → Accessibility (the app provides a deep-link button).
- **Radio stations fail to start.** The Radio Browser network rotates; pull-to-refresh in the Music tab probes mirrors and re-validates streams via lightweight HTTP `Range: bytes=0-0` requests.

---

## Contributing

Contributions are welcome. Please open an issue first to discuss any non-trivial proposal.

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/my-feature`).
3. Commit your changes with focused, conventional commit messages.
4. Run lint and type checks before submitting:
   ```bash
   npm run lint && npm run typecheck
   ```
5. Push the branch and open a Pull Request against `main`.

---

## License

This project is **proprietary**. All rights reserved by the project owner. The source is published for transparency and review only — redistribution or commercial reuse is not permitted without prior written permission. If a `LICENSE` file is added in the future, that file becomes the source of truth for licensing terms.

---

## Credits

- Maintained by [@ninset21-dev](https://github.com/ninset21-dev).
- Radio metadata courtesy of the [Radio Browser](https://www.radio-browser.info/) community.
- Iconography via [Expo Vector Icons](https://icons.expo.fyi/).

---

_README originally drafted and maintained by project contributors and [Devin](https://app.devin.ai), with revisions from the core team._
