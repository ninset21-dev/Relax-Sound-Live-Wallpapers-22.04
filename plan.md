# plan.md — Relax Sound Live Wallpapers

## 1) Objectives
- Restore correct app identity: **Relax Sound Live Wallpapers**, package **com.relaxsound.livewallpaper**, expo owner **alexander30**, correct backend URL.
- Make radio reliable: **no overlap**, **single stream**, **pauses on screen off / app background**, does not randomly stop.
- Fix navigation + UI reliability: **Effects tab opens**, **VolumeWidget works** and is integrated.
- Make native live wallpaper consistent with app: effects **synced** and particles **2x larger**.
- Make Android widget controls functional (play/pause/next/prev/volume) end-to-end.

## 2) Implementation Steps (phased)

### Phase 1 — Core POC (isolation): “One radio at a time + lifecycle pause”
User stories:
1. As a user, switching stations should immediately stop the previous stream and start only the new one.
2. As a user, when I lock the phone screen, audio pauses.
3. As a user, when I return to the app, audio resumes only if I left it playing.
4. As a user, I can play/pause without the player getting into a stuck state.
5. As a user, audio does not silently die after several minutes.

Steps:
- Add a small RN-only debug screen or script-like helper in `AppContext` to:
  - switch stations repeatedly (10–20 times)
  - log `Audio.Sound` lifecycle (create/stop/unload)
  - verify `AppState` transitions pause/resume behavior.
- Fix `AppContext` audio engine:
  - enforce a **single global** `Audio.Sound` instance
  - ensure **await stopAsync + unloadAsync** before creating next
  - ensure `setOnPlaybackStatusUpdate` handles errors/stream end and retries safely
  - set `Audio.setAudioModeAsync` with correct Android interruption/background flags to avoid overlap.
- Decide policy: **pause on background** (per your requirement) and **do not keep playing** when screen off.

Checkpoint: don’t proceed until station switching + background/screen-off pause works consistently.

### Phase 2 — V1 App Development: identity + routing + widget state + language
User stories:
1. As a user, I see the correct app name and branding everywhere.
2. As a user, the app language defaults to my Android system language.
3. As a user, I can open the Effects tab and change effects.
4. As a user, the volume widget appears above tabs and can be collapsed/expanded.
5. As a user, moving the volume slider always changes the volume.

Steps:
- App identity + config:
  - Update `frontend/app.json`: name/slug/scheme/icon strings where needed, `android.package` → `com.relaxsound.livewallpaper`, owner → `alexander30`.
  - Update `frontend/eas.json`: remove wrong backend host; set `EXPO_PUBLIC_BACKEND_URL` to correct value or leave empty and document.
  - Remove/replace `HARDCODED_BACKEND` in `photos.tsx`; use only env + safe fallback.
- Routing:
  - Fix Effects tab navigation issue in `app/(tabs)/_layout.tsx` / route naming.
  - Verify `app/(tabs)/effects.tsx` renders and testIDs appear.
- AppContext correctness:
  - Add missing UI state: `isWidgetCollapsed`, `setIsWidgetCollapsed`.
  - Fix language detection: initialize from `expo-localization` first; persist overrides.
  - Ensure `nextStation/prevStation` go through the same “single stream” path.
- VolumeWidget:
  - Integrate into `app/_layout.tsx` so it renders globally above tabs.
  - Fix slider gesture start-position bug (use absolute position or store pan start value on begin).
  - Ensure `setVolume` updates the playing sound and native module (if present).

### Phase 3 — Radio stations cleanup (10 unique, working)
User stories:
1. As a user, every station plays.
2. As a user, stations are not duplicated.
3. As a user, switching stations never glitches.
4. As a user, station names/genres match the stream.
5. As a user, Next/Prev cycles through all stations correctly.

Steps:
- Replace `RADIO_STATIONS` with 10 unique SomaFM (or other stable) MP3 streams.
- Add lightweight runtime validation:
  - attempt HEAD/GET (server-side optional) or handle playback error with UI feedback.

### Phase 4 — Native Android plugins: package rename + particles 2x + gestures + widget actions
User stories:
1. As a user, native live wallpaper shows the same effect/intensity/speed as in-app.
2. As a user, particles are visibly larger (≈2x).
3. As a user, double-tap on the live wallpaper locks the screen (when admin enabled).
4. As a user, widget Play/Pause/Next/Prev works.
5. As a user, widget volume buttons change device media volume and station text updates.

Steps:
- Update config plugins `withLiveWallpaper.js` and `withAppWidget.js`:
  - package constant → `com.relaxsound.livewallpaper`.
  - ensure MainApplication patching still works.
- LiveWallpaperService:
  - multiply particle sizes by 2 (all effect branches in `resetP` / draw functions).
  - ensure effect settings read from prefs exactly match app keys (`effect_type`, `effect_intensity`, `effect_speed`).
  - verify gesture handling (double-tap timing/threshold) and ensure it triggers `DevicePolicyManager.lockNow()`.
- Widget Provider:
  - implement missing PLAY/PAUSE behavior (currently no action wired) by starting/stopping `AudioService` or toggling a shared pref that service observes.
  - implement NEXT/PREV to actually change stream and restart playback (service should observe `station_index` and update `radio_url`).
  - ensure notification + widget text reflect station name.

### Phase 5 — Regression testing + release prep
User stories:
1. As a user, all tabs work and no screen is blank.
2. As a user, radio never overlaps and always pauses on background.
3. As a user, effects selection changes both in-app overlay and native live wallpaper.
4. As a user, widget controls work without opening the app.
5. As a user, language defaults correctly and persists.

Steps:
- Add/update `test_result.md` with tasks and retest flags.
- Run backend tests (FastAPI) and quick manual E2E on Android emulator/device.
- Validate EAS build config for APK/AAB.

### Phase 6 — Push to GitHub
- Commit with clear messages per phase.
- Push to the target repo.

## 3) Next Actions (immediate)
1. Apply Phase 1 POC fixes in `AppContext` (radio lifecycle + AppState pause).
2. Fix Effects tab routing.
3. Add `isWidgetCollapsed` state and mount `VolumeWidget` in root layout.
4. Replace duplicate station list.
5. Update plugin package + native code generation and rebuild Android project.

## 4) Success Criteria
- Switching stations never produces overlapping audio; previous stream stops within ~300ms.
- Audio pauses when app backgrounds or screen locks; resumes only when user returns and playback was active.
- Effects tab reliably navigates and effect/intensity/speed update overlay.
- Volume slider changes volume immediately and consistently.
- Android widget Play/Pause/Next/Prev + volume buttons work.
- Live wallpaper particles are ~2x larger and effects match in-app selection.
- App name/package/owner/backend URL are correct; build works via EAS.
