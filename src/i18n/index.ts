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
      volume: "Громкость приложения", fadeIn: "Плавное нарастание громкости",
      repeatOff: "Повтор: выкл", repeatAll: "Повтор всего", repeatOne: "Повтор трека"
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
      website: "Сайт с профессиональными снимками",
      languageHint: "Выберите язык интерфейса приложения.",
      uiOpacity: "Прозрачность интерфейса и виджетов",
      uiOpacityHint: "Управляет прозрачностью всех карточек в приложении и плавающего виджета.",
      legal: "Юридическая информация",
      about: "О приложении",
      privacy: "Политика конфиденциальности",
      terms: "Условия использования",
      continue: "Продолжить",
      a11yRationaleTitle: "Зачем нужно разрешение Accessibility?",
      a11yRationaleBody: "Приложение использует службу Специальных возможностей исключительно для одной цели: перехватить двойное касание экрана и заблокировать смартфон. Никакие данные не считываются, не сохраняются и не передаются. Служба не читает содержимое других приложений, не собирает ввод и работает только пока пользователь явно включил функцию «Двойной тап — блокировка». Вы можете отключить разрешение в любой момент в настройках Android.",
      aboutBody: "Relax Sound Live Wallpapers — это спокойные живые обои с природой, частицами и атмосферным радио/музыкой. Приложение создано с душой и вниманием к деталям. Все фотографии в приложении сняты автором Aliaksandr Kananovich (Instagram: konon_photographer, ninset8) и являются его авторской собственностью. Запрещено копирование и распространение изображений без явного разрешения автора.",
      termsBody: "Используя приложение Relax Sound Live Wallpapers, вы соглашаетесь со следующим:\n\n1) Приложение предоставляется \"как есть\" без каких-либо гарантий. Автор не несёт ответственности за любой вред, связанный с использованием приложения.\n\n2) Все фотографии, видеоматериалы и визуальный контент, интегрированные в приложение, являются собственностью автора Aliaksandr Kananovich (ninset8). Копирование, распространение, коммерческое использование изображений без письменного разрешения автора запрещено.\n\n3) Приложение может использовать радиостанции сторонних провайдеров (Radio Browser API). Автор не несёт ответственности за содержание сторонних потоков.\n\n4) Приложение запрашивает разрешения: доступ к медиатеке (для установки обоев), доступ к наложению поверх других приложений (для плавающего виджета) и службу Accessibility (только для функции «двойной тап — блокировка»). Отключить любое разрешение можно в настройках Android.\n\n5) Приложение не собирает персональные данные и не передаёт их третьим лицам. Полная политика конфиденциальности доступна по ссылке в разделе настроек.\n\n6) Автор оставляет за собой право обновлять условия использования. Продолжая использовать приложение после обновления условий, вы принимаете новую редакцию."
    },
    common: {
      save: "Сохранить", cancel: "Отмена", yes: "Да", no: "Нет",
      chooseAll: "Добавить всё (выбрать несколько файлов)",
      on: "Вкл", off: "Выкл",
      seconds: "сек"
    },
    actions: {}
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
      volume: "App volume", fadeIn: "Volume fade-in",
      repeatOff: "Repeat: off", repeatAll: "Repeat all", repeatOne: "Repeat one"
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
      website: "Portfolio website",
      languageHint: "Choose the app interface language.",
      uiOpacity: "Interface & widget opacity",
      uiOpacityHint: "Controls the transparency of all cards in the app and the floating widget.",
      legal: "Legal",
      about: "About",
      privacy: "Privacy policy",
      terms: "Terms of use",
      continue: "Continue",
      a11yRationaleTitle: "Why is Accessibility permission needed?",
      a11yRationaleBody: "The app uses the Accessibility service for one purpose only: to detect a double-tap gesture and lock the screen. It does not read, store or transmit any data. The service does not read other apps' content, does not capture input, and only runs while you have explicitly enabled the \"Double-tap to lock\" feature. You can disable the permission at any time in Android settings.",
      aboutBody: "Relax Sound Live Wallpapers is a calm live wallpaper app with nature scenes, particle effects and ambient radio/music. All photos in the app are captured by the author Aliaksandr Kananovich (Instagram: konon_photographer, ninset8) and are his exclusive property. Redistribution or commercial reuse of the images without explicit permission is not allowed.",
      termsBody: "By using Relax Sound Live Wallpapers you agree to the following:\n\n1) The app is provided \"as is\" without warranty. The author is not liable for damage caused by using the app.\n\n2) All photos, video and visual content integrated into the app are the property of the author Aliaksandr Kananovich (ninset8). Copying, distribution or commercial use without written permission is prohibited.\n\n3) The app may use third-party radio stations (Radio Browser API). The author is not responsible for third-party stream content.\n\n4) The app requests permissions: media library access (to set wallpapers), system overlay (for the floating widget) and Accessibility service (only for the \"double-tap to lock\" feature). You can revoke any permission in Android settings.\n\n5) The app does not collect personal data or share it with third parties. A full privacy policy is available via the link in the Settings section.\n\n6) The author may update these terms. Continuing to use the app after an update means you accept the new version."
    },
    common: {
      save: "Save", cancel: "Cancel", yes: "Yes", no: "No",
      chooseAll: "Add all (multi-select files)",
      on: "On", off: "Off", seconds: "sec"
    },
    actions: {}
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
