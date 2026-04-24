# Relax Sound Live Wallpapers

Android-приложение живых обоев со звуками на Expo React Native + нативными модулями Kotlin.

## Ключевые возможности
- **Живые обои** (WallpaperService с OpenGL/Canvas частицами) с раздельной установкой на HOME / LOCK
- **Эффекты**: снег, дождь, пузыри, листья, цветы, частицы, светлячки с настройкой интенсивности/скорости/FPS
- **Автосмена обоев** по таймеру из мультивыбора фото/видео и из публичного альбома Google Photos
- **Музыка**: локальный проигрыватель (мульти-выбор треков через SAF) + онлайн-радио по жанрам (Radio Browser API) с выбором качества потока и автоадаптацией по скорости сети
- **Foreground аудио-сервис** с ExoPlayer, один поток в момент, автопауза при screen off / audio focus / смене приложения, плавный fade-in при возвращении на главный экран
- **3 виджета** разных размеров (AppWidgetProvider): ползунок громкости, play/pause, next/prev, переключение режима, смена обоев, название трека
- **Плавающий виджет** поверх всех приложений (SYSTEM_ALERT_WINDOW) со свайп-ползунком громкости и кнопкой сворачивания
- **Двойной тап → блокировка** экрана через AccessibilityService
- **Режимы производительности/экономии** в настройках
- **Glassmorphism** тёмно-зелёная тема с прозрачностью
- **i18n**: по умолчанию — язык Android (RU / EN)
- Инструкции и подсказки во всём приложении
- Оптимизации: Proguard/R8, resource shrinking, Hermes

## Структура
```
app/                 — экраны expo-router (tabs: index/music/effects/settings)
src/                 — theme, i18n, контексты, нативные обёртки, сервисы
plugins/             — Expo config plugins, которые во время `expo prebuild`
                       инжектят Kotlin-код и manifest-записи в android/
  native/            — Kotlin исходники (в JS-обёртке)
  withLiveWallpaper.js
  withAppWidget.js
  withFloatingWidget.js
  withAccessibilityService.js
  withAudioService.js
  withWallpaperModule.js
assets/              — icon.svg / icon.png / adaptive-icon / splash
```

## Скрипты
```
npm install
npm run prebuild        # expo prebuild --platform android --clean
npm run build:apk       # eas build -p android --profile preview (APK для тестов)
npm run build:production
npm run typecheck
```

## Сборка APK через EAS
1. `eas login` — логин в expo.dev
2. `eas build:configure` — если нужно
3. `npm run build:apk`
