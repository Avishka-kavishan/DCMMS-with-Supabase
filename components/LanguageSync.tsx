"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import "@/i18n";

export function LanguageSync() {
  const { i18n } = useTranslation();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dcmms_lang");
      if (saved && saved !== i18n.language) {
        i18n.changeLanguage(saved);
      }
    }
  }, [i18n]);

  return null;
}
