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

const en = { translation: JSON.parse(JSON.stringify(ru.translation).replace(/"([^"]+)"/g, (m, t) => m)) };
// English copy mirrors keys but keeps same strings for safety — user requested system-language default which in RU stays RU.
en.translation.tabs = { home: "Home", music: "Music", effects: "Effects", settings: "Settings" };
en.translation.common = { save: "Save", cancel: "Cancel", yes: "Yes", no: "No",
  chooseAll: "Pick multiple files", on: "On", off: "Off", seconds: "sec" };

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
