# Relax Sound Live Wallpapers

Android app that combines live wallpapers with ambient audio — procedural particle effects overlay your photos and videos while curated radio or local music plays in the background.

Built with **Expo React Native** (TypeScript) + native **Kotlin** modules injected via custom Expo Config Plugins.

<p align="center">
  <img src="design-v2/Home & Wallpaper Setup.png" width="260" alt="Home & Wallpaper Setup" />
  <img src="design-v2/Music & Radio Hub.png" width="260" alt="Music & Radio Hub" />
  <img src="design-v2/Advanced Settings.png" width="260" alt="Advanced Settings" />
</p>
<p align="center">
  <img src="design-v2/Widget Preview & Config.png" width="260" alt="Widget Preview & Config" />
  <img src="design-v2/About & Social.png" width="260" alt="About & Social" />
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

### Live Wallpapers
- Android `WallpaperService` with Canvas/OpenGL rendering
- Independent **HOME** / **LOCK** screen targets (or both simultaneously)
- Auto-rotate wallpapers on a timer from a multi-select photo/video set or a public Google Photos album
- Video wallpaper support with optional video audio pass-through

### Visual Effects
Ten procedural particle effects with adjustable intensity, speed, and FPS:

| Effect | Description |
|--------|-------------|
| Snow | Falling snowflakes |
| Rain | Raindrop streaks |
| Bubbles | Floating soap bubbles |
| Leaves | Autumn leaf drift |
| Flowers | Petal shower |
| Particles | Abstract particle field |
| Fireflies | Glowing firefly swarm |
| Stars | Twinkling starfield |
| Cherry Blossom | Sakura petal fall |
| Plasma | Animated plasma waves |

### Music & Radio
- **Local playback** — pick tracks via SAF multi-select
- **Online radio** — 50 000+ stations via [Radio Browser API](https://api.radio-browser.info) across 20 genres (relax, ambient, nature, chillout, lounge, classical, jazz, meditation, piano, electronic, downtempo, lo-fi, rock, pop, dance, rap, news, talk, indie, folk)
- Quality auto-adaptation based on network type (Wi-Fi / 5G / 4G / 3G)
- Repeat modes: off, repeat all, repeat one
- Smart station probe — verifies stream reachability before playback

### Audio Engine
- Foreground `ExoPlayer` service with persistent notification
- Single-stream guarantee — no duplicate audio leaks
- Smooth fade-in on resume (configurable duration)
- Auto-pause on screen off / audio-focus loss (configurable: **Always Play** or **Pause-Aware** mode)

### Widgets & Overlays
- **Home screen widgets** — three `AppWidgetProvider` sizes with volume slider, play/pause, next/prev, mode toggle, and track title
- **Floating overlay** — `SYSTEM_ALERT_WINDOW` overlay with swipe volume and collapse button (positioned bottom-right)
- Customizable widget and overlay opacity

### Accessibility
- **Double-tap lock** — `AccessibilityService`-powered screen lock via gesture

### UI / UX
- **Glassmorphism** dark-green theme with blur and transparency
- Customizable accent color and UI opacity
- Onboarding modal for first-time users
- Animated splash screen

### Internationalization
Auto-detects Android system language. Eleven languages supported:

English · Русский · Español · Português · Deutsch · Français · Italiano · Türkçe · 日本語 · 中文 · العربية

### Build Optimizations
ProGuard/R8 with custom keep rules, resource shrinking, Hermes JS engine

---

## Architecture

The app follows a **Config Plugin** pattern: all native Kotlin code lives in `plugins/native/` as JavaScript template strings. During `expo prebuild`, custom plugins inject these sources into the generated `android/` project along with the required manifest entries, resources, and Gradle dependencies.

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

---

## Project Structure

```
app/                         Expo Router screens (tab navigation)
├── (tabs)/
│   ├── index.tsx            Home — media picker, wallpaper controls
│   ├── music.tsx            Music — local player + online radio
│   ├── effects.tsx          Effects — particle configuration
│   └── settings.tsx         Settings — perf mode, language, widgets, overlay
│
src/
├── components/              Reusable UI components
│   ├── AnimatedSplash.tsx       Animated splash overlay
│   ├── BackgroundGradient.tsx   Full-screen gradient backdrop
│   ├── EffectPreview.tsx        In-app particle preview
│   ├── GlassCard.tsx            Glassmorphism card surface
│   ├── GlobalEffectLayer.tsx    App-wide overlay effect layer
│   ├── Hint.tsx                 Contextual hint tooltip
│   ├── OnboardingModal.tsx      First-launch walkthrough
│   ├── PrimaryButton.tsx        Themed action button
│   ├── SmoothSlider.tsx         Animated slider control
│   └── VideoThumb.tsx           Video thumbnail generator
├── contexts/AppContext.tsx   Global state management + native bridge orchestration
├── i18n/                    i18next setup with 11 language bundles
├── native/index.ts          TypeScript interfaces for native modules (proxy-stubbed on non-Android)
├── services/
│   ├── radio.ts             Radio Browser API client with quality tiers & station probing
│   └── googlePhotos.ts      Public Google Photos album scraper
└── theme/theme.ts           Glassmorphism dark-green design tokens

plugins/                     Expo Config Plugins (build-time Android injection)
├── withLiveWallpaper.js     Wallpaper service + engine + effect renderer
├── withAudioService.js      Foreground ExoPlayer service
├── withAppWidget.js         Home screen widgets (3 sizes)
├── withFloatingWidget.js    SYSTEM_ALERT_WINDOW overlay
├── withAccessibilityService.js  Double-tap lock
├── withWallpaperModule.js   JS ↔ native bridge for wallpaper control
├── withTransparentActivity.js   Transparent theme activity
├── utils.js                 Shared file-writing helpers
└── native/                  Kotlin source templates
    ├── LiveWallpaperService.kt.js
    ├── WallpaperEngine.kt.js
    └── EffectRenderer.kt.js

assets/                      App icons (PNG, SVG, adaptive) and splash screen
design-v2/                   UI mockups and design references
```

---

## Requirements

| Tool          | Version                              |
|---------------|--------------------------------------|
| Node.js       | 18+ (LTS recommended)               |
| npm           | 9+                                   |
| EAS CLI       | >= 13.0.0                            |
| Expo SDK      | ~52                                  |
| Android SDK   | compileSdk 35, minSdk 24 (Android 7.0+) |
| Java / JDK    | 17 (for local `expo run:android`)    |

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
# equivalent to: expo prebuild --platform android --clean
```

This runs all config plugins and produces the `android/` directory with injected Kotlin sources and manifest entries.

### 4. Run on a connected device / emulator

```bash
npm run android
# equivalent to: expo run:android
```

Or start the Expo dev server:

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

Produces a standalone `.apk` with release signing. Gradle command: `:app:assembleRelease`.

### Production APK

```bash
npm run build:production
# eas build -p android --profile production
```

Produces a signed `.apk` ready for distribution.

### Submit to Google Play

```bash
npx eas submit -p android
```

---

## Scripts Reference

| Script                     | Command                                          | Description                              |
|----------------------------|--------------------------------------------------|------------------------------------------|
| `npm start`                | `expo start`                                     | Start Expo dev server                    |
| `npm run android`          | `expo run:android`                               | Build and run on Android device/emulator |
| `npm run prebuild`         | `expo prebuild --platform android --clean`       | Generate native Android project          |
| `npm run build:apk`        | `eas build -p android --profile preview`         | Build APK via EAS (testing)              |
| `npm run build:production` | `eas build -p android --profile production`      | Build APK via EAS (production)           |
| `npm run lint`             | `expo lint`                                      | Run ESLint                               |
| `npm run typecheck`        | `tsc --noEmit`                                   | TypeScript type checking                 |

---

## Localization

The app supports **11 languages**, auto-detected from the Android system locale via `expo-localization` and `i18next`. Users can also manually override the language in Settings.

| Language | Code |
|----------|------|
| English | `en` |
| Русский | `ru` |
| Español | `es` |
| Português | `pt` |
| Deutsch | `de` |
| Français | `fr` |
| Italiano | `it` |
| Türkçe | `tr` |
| 日本語 | `ja` |
| 中文 | `zh` |
| العربية | `ar` |

Translation bundles are defined in `src/i18n/languages.ts`. To add a new language, create a translation object following the existing structure and register it in the `i18n.init()` call in `src/i18n/index.ts`.

---

## Performance Modes

Configurable in **Settings > App Mode**:

| Mode     | FPS | Intensity | Best for                        |
|----------|-----|-----------|----------------------------------|
| Eco      | 15  | 0.3       | Battery saving, older devices   |
| Balanced | 30  | User-set  | Default daily use               |
| High     | 60  | User-set  | Smooth visuals, flagship phones |

---

## Tech Stack

**Frontend:** React Native 0.76, Expo SDK 52, Expo Router, React Native Reanimated, Gesture Handler, expo-blur, expo-av, expo-image, FlashList

**Native:** Kotlin, ExoPlayer (Media3), Canvas/OpenGL rendering, Android WallpaperService, Foreground Service, AppWidgetProvider, AccessibilityService

**Build:** EAS Build, Expo Config Plugins, Hermes, ProGuard/R8

**Networking:** Radio Browser API (50 000+ stations), Google Photos album scraping, NetInfo adaptive quality

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
