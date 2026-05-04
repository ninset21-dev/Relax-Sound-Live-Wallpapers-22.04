# Relax Sound Live Wallpapers

> Android app that pairs animated live wallpapers with ambient audio — procedural particle effects (rain, snow, fireflies, leaves…) overlay your photos or videos while curated radio or local music keeps playing reliably in the background.

[![Platform](https://img.shields.io/badge/platform-Android%207.0%2B-3DDC84?logo=android&logoColor=white)](#requirements)
[![Expo SDK](https://img.shields.io/badge/Expo%20SDK-52-000020?logo=expo&logoColor=white)](https://docs.expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.76-61DAFB?logo=react&logoColor=white)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Build](https://img.shields.io/badge/build-EAS-4630EB?logo=expo&logoColor=white)](https://docs.expo.dev/eas/)
[![License](https://img.shields.io/badge/license-Proprietary-lightgrey)](#license)

Built with **Expo React Native** (TypeScript) and native **Kotlin** modules injected at build time via custom Expo Config Plugins. Designed for users who want a persistent, customizable home-screen experience without giving up battery life or performance.

<p align="center">
  <img src="design-v2/Home%20%26%20Wallpaper%20Setup.png" alt="Home & Wallpaper Setup" width="280" />
  <img src="design-v2/Music%20%26%20Radio%20Hub.png" alt="Music & Radio Hub" width="280" />
  <img src="design-v2/Widget%20Preview%20%26%20Config.png" alt="Widget Preview & Config" width="280" />
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
- [Tech Stack](#tech-stack)
- [Permissions](#permissions)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)
- [Credits](#credits)

---

## Features

- **Live Wallpapers** — `WallpaperService` with Canvas/OpenGL rendering; independent HOME and LOCK screen targets.
- **Visual Effects** — snow, rain, bubbles, leaves, flowers, particles, and fireflies with adjustable intensity, speed, and FPS.
- **Auto-Rotate Wallpapers** — timer-based cycling from a multi-select photo/video set or a public Google Photos album.
- **Music Player** — local tracks via Storage Access Framework multi-select plus online radio (20+ genres via the [Radio Browser API](https://api.radio-browser.info)) with quality auto-adaptation based on network speed.
- **Foreground Audio Service** — persistent ExoPlayer playback, single-stream guarantee, auto-pause on screen-off / audio-focus loss, smooth fade-in on resume.
- **Home Screen Widgets** — three `AppWidgetProvider` sizes: volume slider, play/pause, next/prev, mode toggle, and current track title.
- **Floating Overlay Widget** — `SYSTEM_ALERT_WINDOW` overlay with swipe volume slider and collapse button.
- **Double-Tap Lock** — `AccessibilityService`-powered screen lock via gesture.
- **Glassmorphism UI** — dark-green theme with blur and transparency layers.
- **Internationalization** — auto-detects Android system language (Russian / English) at first launch.
- **Build Optimizations** — ProGuard/R8, resource shrinking, Hermes JS engine, New Architecture (Fabric/TurboModules) enabled.

---

## Screenshots

| Home & Wallpaper Setup | Music & Radio Hub | Widget Preview & Config |
|---|---|---|
| ![Home](design-v2/Home%20%26%20Wallpaper%20Setup.png) | ![Music](design-v2/Music%20%26%20Radio%20Hub.png) | ![Widgets](design-v2/Widget%20Preview%20%26%20Config.png) |

| Advanced Settings | About & Social |
|---|---|
| ![Settings](design-v2/Advanced%20Settings.png) | ![About](design-v2/About%20%26%20Social.png) |

> Mockups from `design-v2/`. The shipping app may differ slightly from these reference designs.

---

## Architecture

The app follows a **Config Plugin** pattern: all native Kotlin code lives under `plugins/native/` as JavaScript template strings. During `expo prebuild`, custom plugins inject these sources into the generated `android/` project along with the required `AndroidManifest.xml` entries, resources, and Gradle dependencies.

```
┌──────────────────────────────────────────────────┐
│  React Native (TypeScript)                       │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  │
│  │  Home  │  │ Music  │  │Effects │  │Settings│  │
│  └───┬────┘  └───┬────┘  └───┬────┘  └───┬────┘  │
│      └───────────┴───────────┴───────────┘       │
│                  AppContext                      │
│         (state, persistence, native bridge)      │
├──────────────────────────────────────────────────┤
│  Native Modules (Kotlin via NativeModules)       │
│  ┌───────────────┐  ┌───────────────┐            │
│  │WallpaperModule│  │  AudioModule  │            │
│  ├───────────────┤  ├───────────────┤            │
│  │ WidgetModule  │  │FloatingModule │            │
│  ├───────────────┤  ├───────────────┤            │
│  │  A11yModule   │  │               │            │
│  └───────────────┘  └───────────────┘            │
├──────────────────────────────────────────────────┤
│  Android Services                                │
│  RelaxWallpaperService — RelaxAudioService       │
│  AppWidgetProvider     — FloatingWidgetService   │
│  RelaxAccessibilityService                       │
└──────────────────────────────────────────────────┘
```

---

## Project Structure

```
app/                              Expo Router screens (tab navigation)
├── _layout.tsx                   Root navigator + theme provider
└── (tabs)/
    ├── index.tsx                 Home — media picker, wallpaper controls
    ├── music.tsx                 Music — local player + online radio
    ├── effects.tsx               Effects — particle configuration
    └── settings.tsx              Settings — perf mode, language, widgets, overlay

src/
├── components/                   Reusable UI: GlassCard, Hint, PrimaryButton,
│                                 BackgroundGradient, AnimatedSplash,
│                                 EffectPreview, GlobalEffectLayer,
│                                 OnboardingModal, SmoothSlider, VideoThumb
├── contexts/AppContext.tsx       Global state, persistence, native-bridge orchestration
├── i18n/
│   ├── index.ts                  i18next setup with RU/EN translations
│   └── languages.ts              Language metadata + fallback logic
├── native/index.ts               TypeScript interfaces for native modules
│                                 (proxy-stubbed on non-Android platforms)
├── services/
│   ├── radio.ts                  Radio Browser API client with quality tiers
│   └── googlePhotos.ts           Public Google Photos album scraper
└── theme/theme.ts                Glassmorphism dark-green design tokens

plugins/                          Expo Config Plugins (build-time Android injection)
├── withLiveWallpaper.js          Wallpaper service + engine + effect renderer
├── withAudioService.js           Foreground ExoPlayer service
├── withAppWidget.js              Home-screen widgets
├── withFloatingWidget.js         SYSTEM_ALERT_WINDOW overlay
├── withAccessibilityService.js   Double-tap lock service
├── withWallpaperModule.js        JS ↔ native bridge for wallpaper control
├── withTransparentActivity.js    Transparent picker activity for SAF
├── utils.js                      Shared file-writing helpers
└── native/                       Kotlin source templates
    ├── LiveWallpaperService.kt.js
    ├── WallpaperEngine.kt.js
    └── EffectRenderer.kt.js

assets/                           App icons (PNG, SVG, adaptive) and splash screen
design-v2/                        UI mockups for each screen (used in this README)
app.json                          Expo configuration + Android permissions manifest
eas.json                          EAS Build profiles (development, preview, production)
```

---

## Requirements

| Tool        | Version                                 |
|-------------|-----------------------------------------|
| Node.js     | 18+ (LTS recommended)                   |
| npm         | 9+ (or compatible Yarn / pnpm)          |
| EAS CLI     | `>= 13.0.0`                             |
| Expo SDK    | `~52`                                   |
| Android SDK | `compileSdk 35`, `minSdk 24` (Android 7.0+) |
| Java / JDK  | 17 (for local `expo run:android`)       |

> **Note:** This project targets Android only. An `ios` script exists for development tooling, but iOS builds are not supported and many native features (live wallpaper, accessibility lock, system overlay) are Android-specific.

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
# or: yarn install
```

### 3. Generate the native Android project

```bash
npm run prebuild
# equivalent to: expo prebuild --platform android --clean
```

This runs all config plugins and produces the `android/` directory with injected Kotlin sources, manifest entries, and Gradle dependencies. The `android/` folder is generated and is **not** checked into the repo.

### 4. Run on a connected device or emulator

```bash
npm run android
# equivalent to: expo run:android
```

Or start the Expo dev server (for JS-only iteration once a dev build is installed):

```bash
npm start
```

> **Tip:** After installing the app, manually enable it as the system live wallpaper from your launcher's wallpaper picker. The Settings screen has a one-tap shortcut.

---

## Build & Deploy

All distributable builds use [Expo Application Services (EAS)](https://docs.expo.dev/eas/). Build profiles live in [`eas.json`](./eas.json).

### Login to EAS

```bash
npx eas login
```

### Preview APK (for internal testing)

```bash
npm run build:apk
# eas build -p android --profile preview
```

Produces a standalone, release-signed `.apk` (Gradle command: `:app:assembleRelease`).

### Production build (for Google Play)

```bash
npm run build:production
# eas build -p android --profile production
```

Produces a signed Android app bundle ready for store submission.

### Submit to Google Play

```bash
npx eas submit -p android
```

---

## Scripts Reference

| Script                      | Command                                          | Description                                |
|-----------------------------|--------------------------------------------------|--------------------------------------------|
| `npm start`                 | `expo start`                                     | Start the Expo dev server                  |
| `npm run android`           | `expo run:android`                               | Build and run on Android device / emulator |
| `npm run prebuild`          | `expo prebuild --platform android --clean`       | Generate the native Android project        |
| `npm run build:apk`         | `eas build -p android --profile preview`         | Build APK via EAS (internal testing)       |
| `npm run build:production`  | `eas build -p android --profile production`      | Build release via EAS (store submission)   |
| `npm run lint`              | `expo lint`                                      | Run ESLint                                 |
| `npm run typecheck`         | `tsc --noEmit`                                   | TypeScript type checking                   |

---

## Localization

The app supports **Russian** and **English**, auto-detected from the Android system locale via `expo-localization` and `i18next`.

Translations are defined inline in [`src/i18n/index.ts`](./src/i18n/index.ts). To add a new language:

1. Add a translation object following the existing `ru` / `en` structure.
2. Register it in the `i18n.init()` resources block.
3. Add metadata (display name, RTL flag) to [`src/i18n/languages.ts`](./src/i18n/languages.ts).

---

## Performance Modes

Configurable in **Settings → App Mode**:

| Mode      | FPS | Intensity | Best for                          |
|-----------|-----|-----------|-----------------------------------|
| Eco       | 15  | 0.3       | Battery saving, older devices     |
| Balanced  | 30  | User-set  | Default daily use                 |
| High      | 60  | User-set  | Smooth visuals, flagship phones   |

---

## Tech Stack

**Frontend:** React Native 0.76, Expo SDK 52, Expo Router, React Native Reanimated, Gesture Handler, `expo-blur`, `expo-image`, `expo-video-thumbnails`, FlashList.

**Native (Kotlin):** ExoPlayer (Media3), Canvas/OpenGL rendering, `WallpaperService`, Foreground Service, `AppWidgetProvider`, `AccessibilityService`.

**Build:** EAS Build, Expo Config Plugins, Hermes, ProGuard / R8, New Architecture (Fabric/TurboModules).

**Networking:** Radio Browser API, Google Photos public-album scraping, NetInfo-driven adaptive quality.

---

## Permissions

The app requests only what is required to run live wallpapers and persistent audio. The full list is in [`app.json`](./app.json); key permissions:

| Permission                          | Why it's needed                                          |
|-------------------------------------|----------------------------------------------------------|
| `BIND_WALLPAPER` / `SET_WALLPAPER`  | Register and apply the live wallpaper engine            |
| `FOREGROUND_SERVICE_MEDIA_PLAYBACK` | Keep ExoPlayer playing while the app is backgrounded    |
| `READ_MEDIA_IMAGES` / `_VIDEO` / `_AUDIO` | Pick local photos, videos, and music tracks       |
| `SYSTEM_ALERT_WINDOW`               | Floating volume / playback overlay                      |
| `POST_NOTIFICATIONS`                | Foreground-service notification (Android 13+)           |
| `RECEIVE_BOOT_COMPLETED`            | Restart the wallpaper engine after device reboot        |

`CAMERA` and `RECORD_AUDIO` are explicitly **blocked** to make permissions intent unambiguous.

---

## Troubleshooting

- **Wallpaper doesn't appear in the picker** — make sure the APK was installed (a debug bundle from `expo start` is not enough). The wallpaper service is registered only when the native build is installed.
- **Audio stops when the screen turns off** — check the app's perf mode and toggle **Always-Play** in Settings; some OEMs (Xiaomi, Huawei) require enabling autostart and disabling battery optimization for the app.
- **Floating widget doesn't show** — grant the *"Display over other apps"* permission from Android settings.
- **Double-tap lock not working** — enable the *Relax Sound* accessibility service in Android Settings → Accessibility.

---

## Contributing

Contributions are welcome. Please open an issue first to discuss substantial changes.

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/my-feature`.
3. Make your changes with focused commits.
4. Run lint and type checks before submitting:
   ```bash
   npm run lint && npm run typecheck
   ```
5. Push and open a Pull Request against `main`.

---

## License

This project is **proprietary**. All rights reserved by the project owner.

If a `LICENSE` file is added in the future, that file becomes the source of truth for licensing terms.

---

## Credits

- Maintained by [@ninset21-dev](https://github.com/ninset21-dev).
- Radio metadata courtesy of the [Radio Browser](https://www.radio-browser.info/) community.
- Icons by [Expo Vector Icons](https://icons.expo.fyi/).

> _Originally written and maintained by contributors and [Devin](https://app.devin.ai), with updates from the core team._
