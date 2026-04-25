import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import { en, ru, es, pt, de, fr, it, tr, ja, zh, ar } from "./languages";

export const SUPPORTED_LANGUAGES: { code: string; label: string }[] = [
  { code: "system", label: "System" },
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "it", label: "Italiano" },
  { code: "tr", label: "Türkçe" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
  { code: "ar", label: "العربية" }
];

function detectSystemLanguage(): string {
  const code = (Localization.getLocales()[0]?.languageCode ?? "en").toLowerCase();
  if (code.startsWith("ru")) return "ru";
  if (code.startsWith("es")) return "es";
  if (code.startsWith("pt")) return "pt";
  if (code.startsWith("de")) return "de";
  if (code.startsWith("fr")) return "fr";
  if (code.startsWith("it")) return "it";
  if (code.startsWith("tr")) return "tr";
  if (code.startsWith("ja")) return "ja";
  if (code.startsWith("zh")) return "zh";
  if (code.startsWith("ar")) return "ar";
  return "en";
}

const initialLng = detectSystemLanguage();

i18n
  .use(initReactI18next)
  .init({
    resources: { en, ru, es, pt, de, fr, it, tr, ja, zh, ar },
    lng: initialLng,
    fallbackLng: "en",
    interpolation: { escapeValue: false }
  });

export function applyLanguage(code: string) {
  if (!code || code === "system") {
    i18n.changeLanguage(detectSystemLanguage());
  } else {
    i18n.changeLanguage(code);
  }
}

export default i18n;
