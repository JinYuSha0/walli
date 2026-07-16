import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import zh from "./locales/zh.json";

const getInitialLanguage = () => {
  const savedLanguage = window.localStorage.getItem("walli_core_language");

  if (savedLanguage === "en" || savedLanguage === "zh") {
    return savedLanguage;
  }

  return window.navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
};

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: getInitialLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

const syncDocumentLanguage = (language: string) => {
  const normalizedLanguage = language.startsWith("zh") ? "zh" : "en";

  document.documentElement.lang = normalizedLanguage;
  document.title = i18n.t("appBrand", { lng: normalizedLanguage });
};

syncDocumentLanguage(i18n.language);
i18n.on("languageChanged", syncDocumentLanguage);

export default i18n;
