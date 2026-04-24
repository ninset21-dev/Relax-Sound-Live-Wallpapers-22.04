import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";

const ru = {
  translation: {
    tabs: { home: "Главная", music: "Музыка", effects: "Эффекты", settings: "Настройки" },
    home: {
      title: "Главная",
      intro: "Выберите фото или видео для живых обоев на главном экране и экране блокировки.",
      addPhotos: "Добавить фото / видео",
      addPhotosHint: "Откроется системный выбор — можно выбрать сразу несколько.",
      pickFolder: "Выбрать папку целиком",
      googlePhotos: "Альбом Google Photos",
      googlePhotosHint: "Берётся из вашей общей ссылки. Нажмите, чтобы свернуть / развернуть.",
      collapse: "Свернуть", expand: "Развернуть",
      autoChange: "Автосмена по таймеру",
      autoChangeHint: "Циклично меняет обои из выбранного набора.",
      interval: "Интервал",
      setWallpaper: "Установить обои",
      setHome: "На главный экран",
      setLock: "На экран блокировки",
      setBoth: "На оба экрана",
      previewDisabled: "Предпросмотр эффектов отключён по вашему пожеланию.",
      fromUrl: "Добавить по ссылке из интернета",
      empty: "Пока ничего не добавлено — нажмите «Добавить всё»."
    },
    music: {
      title: "Музыка",
      local: "Моя музыка (с телефона)",
      pick: "Выбрать треки (мульти-выбор)",
      pickHint: "Отмечайте несколько файлов в системном выборщике.",
      radio: "Онлайн радио",
      radioHint: "Сотни станций. Выберите жанр.",
      genre: "Жанр",
      quality: "Качество потока",
      qualityAuto: "Авто", qualityLow: "Низкое", qualityMed: "Среднее", qualityHigh: "Высокое",
      startupSource: "Источник при запуске",
      startupRadio: "Радио", startupLocal: "Моя музыка",
      nowPlaying: "Сейчас играет",
      noTrack: "Нет трека",
      play: "Играть", pause: "Пауза", next: "Следующий", prev: "Предыдущий",
      volume: "Громкость приложения", fadeIn: "Плавное нарастание громкости"
    },
    effects: {
      title: "Эффекты",
      intro: "Эффекты применяются к живым обоям и синхронизированы с приложением.",
      none: "Без эффекта",
      snow: "Снег", rain: "Дождь", bubbles: "Пузыри", leaves: "Листья",
      flowers: "Цветы", particles: "Частицы", fireflies: "Светлячки",
      intensity: "Интенсивность", speed: "Скорость", fps: "Частота кадров",
      apply: "Применить к живым обоям"
    },
    settings: {
      title: "Настройки",
      language: "Язык",
      systemLanguage: "Как в системе Android",
      doubleTapLock: "Двойной тап — блокировка экрана",
      doubleTapHint: "Требуется разрешение Accessibility. Нажмите «Открыть настройки».",
      openA11y: "Открыть настройки доступа",
      overlay: "Плавающий виджет поверх всех окон",
      overlayRequest: "Разрешить наложение",
      overlayShow: "Показать плавающий виджет",
      overlayHide: "Скрыть плавающий виджет",
      perfMode: "Режим приложения",
      perfHigh: "Производительность",
      perfEco: "Экономия энергии",
      perfBalanced: "Баланс",
      instructions: "Инструкции",
      howWidgets: "Как добавить виджеты на главный экран",
      howWidgetsBody: "1) Долгое нажатие на пустом месте главного экрана. 2) Выберите «Виджеты». 3) Найдите «Relax Sound» и перетащите нужный размер.",
      howMusic: "Как добавить свою музыку/радио как фон",
      howMusicBody: "Во вкладке «Музыка» выберите «Моя музыка» и укажите файлы через системный выборщик. Для радио выберите жанр и нажмите на станцию.",
      howAutoChange: "Как настроить автосмену обоев",
      howAutoChangeBody: "На «Главной» нажмите «Добавить фото/видео», отметьте несколько файлов, затем включите «Автосмена по таймеру» и укажите интервал.",
      links: "Контакты автора",
      instagram: "Подпишитесь для вдохновления (Instagram)",
      email: "Обратная связь",
      website: "Сайт с профессиональными снимками"
    },
    common: {
      save: "Сохранить", cancel: "Отмена", yes: "Да", no: "Нет",
      chooseAll: "Добавить всё (выбрать несколько файлов)",
      on: "Вкл", off: "Выкл",
      seconds: "сек"
    }
  }
};

const en = {
  translation: {
    tabs: { home: "Home", music: "Music", effects: "Effects", settings: "Settings" },
    home: {
      title: "Home",
      intro: "Pick photos or videos to use as live wallpapers on your home and lock screens.",
      addPhotos: "Add photos / videos",
      addPhotosHint: "Opens the system picker — select multiple at once.",
      pickFolder: "Pick a whole folder",
      googlePhotos: "Google Photos album",
      googlePhotosHint: "Taken from your shared link. Tap to collapse / expand.",
      collapse: "Collapse", expand: "Expand",
      autoChange: "Auto-change on a timer",
      autoChangeHint: "Cycles through wallpapers from the selected set.",
      interval: "Interval",
      setWallpaper: "Apply wallpaper",
      setHome: "Home screen",
      setLock: "Lock screen",
      setBoth: "Both screens",
      previewDisabled: "Effect preview disabled as requested.",
      fromUrl: "Add from a URL",
      empty: "Nothing added yet — tap \"Add all\"."
    },
    music: {
      title: "Music",
      local: "My music (from phone)",
      pick: "Pick tracks (multi-select)",
      pickHint: "Select several files in the system picker.",
      radio: "Online radio",
      radioHint: "Hundreds of stations. Pick a genre.",
      genre: "Genre",
      quality: "Stream quality",
      qualityAuto: "Auto", qualityLow: "Low", qualityMed: "Medium", qualityHigh: "High",
      startupSource: "Source on startup",
      startupRadio: "Radio", startupLocal: "My music",
      nowPlaying: "Now playing",
      noTrack: "No track",
      play: "Play", pause: "Pause", next: "Next", prev: "Previous",
      volume: "App volume", fadeIn: "Volume fade-in"
    },
    effects: {
      title: "Effects",
      intro: "Effects are applied to the live wallpaper and synchronised with the app.",
      none: "No effect",
      snow: "Snow", rain: "Rain", bubbles: "Bubbles", leaves: "Leaves",
      flowers: "Flowers", particles: "Particles", fireflies: "Fireflies",
      intensity: "Intensity", speed: "Speed", fps: "Frame rate",
      apply: "Apply to live wallpaper"
    },
    settings: {
      title: "Settings",
      language: "Language",
      systemLanguage: "Follow Android system",
      doubleTapLock: "Double-tap to lock screen",
      doubleTapHint: "Requires Accessibility permission. Tap \"Open settings\".",
      openA11y: "Open Accessibility settings",
      overlay: "Floating widget over all apps",
      overlayRequest: "Grant overlay permission",
      overlayShow: "Show floating widget",
      overlayHide: "Hide floating widget",
      perfMode: "App mode",
      perfHigh: "Performance",
      perfEco: "Power saver",
      perfBalanced: "Balanced",
      instructions: "Instructions",
      howWidgets: "How to add widgets to the home screen",
      howWidgetsBody: "1) Long-press an empty area of the home screen. 2) Choose \"Widgets\". 3) Find \"Relax Sound\" and drag the size you want.",
      howMusic: "How to add your music / radio as the background",
      howMusicBody: "In the Music tab, choose \"My music\" and pick files through the system picker. For radio, pick a genre and tap a station.",
      howAutoChange: "How to set up wallpaper auto-change",
      howAutoChangeBody: "On the Home tab tap \"Add photos/videos\", select several files, then enable \"Auto-change on a timer\" and set the interval.",
      links: "Contact the author",
      instagram: "Follow for inspiration (Instagram)",
      email: "Feedback",
      website: "Portfolio website"
    },
    common: {
      save: "Save", cancel: "Cancel", yes: "Yes", no: "No",
      chooseAll: "Add all (multi-select files)",
      on: "On", off: "Off", seconds: "sec"
    }
  }
};

const locale = Localization.getLocales()[0]?.languageCode ?? "en";
const lng = locale.startsWith("ru") ? "ru" : "en";

i18n
  .use(initReactI18next)
  .init({
    resources: { ru, en },
    lng,
    fallbackLng: "en",
    interpolation: { escapeValue: false }
  });

export default i18n;
