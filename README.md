# Relax Sound Live Wallpapers

> Android app that combines live wallpapers with ambient audio — procedural particle effects overlay your photos and videos while curated internet radio or local music plays in the background.

Built with **Expo React Native** (TypeScript) + native **Kotlin** modules injected via custom Expo Config Plugins.

<p align="center">
  <img src="design-v2/Home%20%26%20Wallpaper%20Setup.png" width="180" alt="Home screen" />
  <img src="design-v2/Music%20%26%20Radio%20Hub.png" width="180" alt="Music & Radio" />
  <img src="design-v2/Advanced%20Settings.png" width="180" alt="Settings" />
  <img src="design-v2/Widget%20Preview%20%26%20Config.png" width="180" alt="Widgets" />
</p>

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Requirements](#requirements)
- [Getting Started](#getting-started)
- [Build & Deploy](#build--deploy)
- [Scripts Reference](#scripts-reference)
- [Localization](#localization)
- [Performance Modes](#performance-modes)
- [Tech Stack](#tech-stack)
- [Contributing](#contributing)
- [License](#license)

---

## Features

| Category | Details |
|---|---|
| **Live Wallpapers** | `WallpaperService` with Canvas/OpenGL rendering; independent HOME / LOCK screen targets |
| **Visual Effects** | Snow, rain, bubbles, leaves, flowers, particles, fireflies, stars, cherry blossom, plasma — adjustable intensity, speed, and FPS |
| **Auto-Rotate** | Timer-based cycling from a multi-select photo/video set or a public Google Photos album |
| **Music Player** | Local tracks via SAF multi-select + online radio (20 + genres via [Radio Browser API](https://api.radio-browser.info)) with network-adaptive quality |
| **Foreground Audio Service** | Persistent ExoPlayer playback, single-stream guarantee, auto-pause on screen off / audio-focus loss, smooth fade-in on resume |
| **Home Screen Widgets** | 3 `AppWidgetProvider` sizes — volume slider, play / pause, next / prev, mode toggle, track title |
| **Floating Overlay Widget** | `SYSTEM_ALERT_WINDOW` overlay with swipe volume slider and collapse button |
| **Double-Tap Lock** | `AccessibilityService`-powered screen lock via gesture |
| **Glassmorphism UI** | Dark-green theme with blur, transparency, and user-tunable accent color |
| **Internationalization** | 11 languages auto-detected from Android system locale (see [Localization](#localization)) |
| **Build Optimizations** | ProGuard / R8, resource shrinking, Hermes JS engine |

---

## Architecture

All native Kotlin code lives in `plugins/native/` as JavaScript template strings. During `expo prebuild`, custom config plugins inject these sources into the generated `android/` project along with the required manifest entries, resources, and Gradle dependencies.

```
┌──────────────────────────────────────────────────┐
│  React Native (TypeScript)                       │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐ │
│  │  Home   │  │ Music  │  │Effects │  │Settings│ │
│  └───┬────┘  └───┬────┘  └───┬────┘  └───┬────┘ │
│      └───────────┴───────────┴───────────┘       │
│                  AppContext                       │
│         (state, persistence, native bridge)       │
├──────────────────────────────────────────────────┤
│  Native Modules (Kotlin via NativeModules)       │
│  ┌──────────────┐  ┌──────────────┐              │
│  │ WallpaperModule│  │ AudioModule │              │
│  ├──────────────┤  ├──────────────┤              │
│  │ WidgetModule │  │FloatingModule│              │
│  ├──────────────┤  ├──────────────┤              │
│  │ A11yModule   │  │              │              │
│  └──────────────┘  └──────────────┘              │
├──────────────────────────────────────────────────┤
│  Android Services                                │
│  RelaxWallpaperService ─ RelaxAudioService       │
│  AppWidgetProvider ─ FloatingWidgetService        │
│  RelaxAccessibilityService                       │
└──────────────────────────────────────────────────┘
```

Key design decisions:

- **Config Plugin pattern** — no manual Android project edits; everything is generated at prebuild time.
- **Proxy-based native bridge** — on non-Android environments, native calls are stubbed via a `Proxy` so the JS layer never crashes.
- **State hydration** — on launch, AsyncStorage data is merged with real-time native module status for consistency.

---

## Project Structure

```
app/                            Expo Router screens (tab navigation)
├── (tabs)/
│   ├── index.tsx               Home — media picker, wallpaper controls
│   ├── music.tsx               Music — local player + online radio
│   ├── effects.tsx             Effects — particle configuration
│   └── settings.tsx            Settings — perf mode, language, widgets, overlay
│
src/
├── components/                 Reusable UI (GlassCard, Hint, PrimaryButton, …)
├── contexts/AppContext.tsx      Global state + native bridge orchestration
├── i18n/
│   ├── index.ts                i18next initialisation
│   └── languages.ts            Translation dictionaries (11 locales)
├── native/index.ts             TypeScript interfaces for native modules
├── services/
│   ├── radio.ts                Radio Browser API client with quality tiers
│   └── googlePhotos.ts         Public Google Photos album scraper
└── theme/theme.ts              Glassmorphism dark-green design tokens

plugins/                        Expo Config Plugins (build-time Android injection)
├── withLiveWallpaper.js        Wallpaper service + engine + effect renderer
├── withAudioService.js         Foreground ExoPlayer service
├── withAppWidget.js            Home screen widgets
├── withFloatingWidget.js       SYSTEM_ALERT_WINDOW overlay
├── withAccessibilityService.js Double-tap lock
├── withWallpaperModule.js      JS ↔ native bridge for wallpaper control
├── withTransparentActivity.js  Transparent launcher activity
├── utils.js                    Shared file-writing helpers
└── native/                     Kotlin source templates
    ├── LiveWallpaperService.kt.js
    ├── WallpaperEngine.kt.js
    └── EffectRenderer.kt.js

assets/                         App icons (PNG, SVG, adaptive) and splash screen
design-v2/                      UI mockups and screenshots
```

---

## Requirements

| Tool | Version |
|---|---|
| Node.js | 18 + (LTS recommended) |
| npm | 9 + |
| EAS CLI | ≥ 13.0.0 |
| Expo SDK | ~52 |
| Android SDK | compileSdk 35, minSdk 24 (Android 7.0 +) |
| Java / JDK | 17 (for local `expo run:android`) |

> **Note:** iOS is not supported — this project targets Android only.

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
# runs: expo prebuild --platform android --clean
```

This executes all config plugins and produces the `android/` directory with injected Kotlin sources and manifest entries.

### 4. Run on a connected device or emulator

```bash
npm run android
# runs: expo run:android
```

Or start the Expo dev server for hot-reload development:

```bash
npm start
```

---

## Build & Deploy

All builds use [Expo Application Services (EAS)](https://docs.expo.dev/eas/).

### Login to EAS

```bash
npx eas login
```

### Preview APK (for testing)

```bash
npm run build:apk
# eas build -p android --profile preview
```

Produces a standalone `.apk` with release signing (`gradleCommand: :app:assembleRelease`).

### Production build (for Google Play)

```bash
npm run build:production
# eas build -p android --profile production
```

Produces a signed `.apk` for store distribution.

> **Tip:** Google Play requires `.aab` (Android App Bundle) for new app submissions. To switch, change `"buildType": "apk"` to `"app-bundle"` in the `production` profile of `eas.json`.

### Submit to Google Play

```bash
npx eas submit -p android
```

---

## Scripts Reference

| Script | Command | Description |
|---|---|---|
| `npm start` | `expo start` | Start Expo dev server |
| `npm run android` | `expo run:android` | Build and run on Android device / emulator |
| `npm run prebuild` | `expo prebuild --platform android --clean` | Generate native Android project |
| `npm run build:apk` | `eas build -p android --profile preview` | Build APK via EAS (testing) |
| `npm run build:production` | `eas build -p android --profile production` | Build APK via EAS (store release) |
| `npm run lint` | `expo lint` | Run ESLint |
| `npm run typecheck` | `tsc --noEmit` | TypeScript type checking |

---

## Localization

The app supports **11 languages**, auto-detected from the Android system locale via `expo-localization` and `i18next`:

| Code | Language |
|---|---|
| `en` | English (base) |
| `ru` | Russian |
| `es` | Spanish |
| `pt` | Portuguese |
| `de` | German |
| `fr` | French |
| `it` | Italian |
| `tr` | Turkish |
| `ja` | Japanese |
| `zh` | Chinese (Simplified) |
| `ar` | Arabic |

Translations are defined in `src/i18n/languages.ts`. To add a new language, create a translation object following the existing structure and register it in the `i18n.init()` call in `src/i18n/index.ts`. Untranslated keys fall back to English automatically.

---

## Performance Modes

Configurable in **Settings → App Mode**:

| Mode | FPS | Intensity | Best for |
|---|---|---|---|
| Eco | 15 | 0.3 | Battery saving, older devices |
| Balanced | 30 | User-set | Default daily use |
| High | 60 | User-set | Smooth visuals, flagship phones |

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React Native 0.76, Expo SDK 52, Expo Router, Reanimated, Gesture Handler, expo-blur, expo-linear-gradient |
| **Native** | Kotlin, ExoPlayer (Media3), Canvas / OpenGL, WallpaperService, Foreground Service, AppWidgetProvider, AccessibilityService |
| **Build** | EAS Build, Expo Config Plugins, Hermes, ProGuard / R8 |
| **Networking** | Radio Browser API, Google Photos scraping, NetInfo adaptive quality |

---

## Contributing

Contributions are welcome. Please open an issue first to discuss proposed changes.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push and open a Pull Request

Run lint and type checks before submitting:

```bash
npm run lint && npm run typecheck
```

---

## License

This project is proprietary. All rights reserved.

---

_Originally written and maintained by contributors and [Devin](https://app.devin.ai), with updates from the core team._
