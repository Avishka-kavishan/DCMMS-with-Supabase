import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import si from "./locales/si.json";
import ta from "./locales/ta.json";

const savedLang = typeof window !== "undefined" ? (localStorage.getItem("dcmms_lang") || "si") : "si";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    si: { translation: si },
    ta: { translation: ta },
  },
  lng: savedLang,
  fallbackLng: "si",
  interpolation: {
    escapeValue: false, // React already escapes output
  },
});

if (typeof window !== "undefined") {
  i18n.on("languageChanged", (lng) => {
    localStorage.setItem("dcmms_lang", lng);
  });
}

export default i18n;
