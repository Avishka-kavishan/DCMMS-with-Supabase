"use client";

import React from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

interface SiteHeaderProps {
  fontScale?: "small" | "medium" | "large";
  setFontScale?: (scale: "small" | "medium" | "large") => void;
}

export function SiteHeader({ fontScale = "medium", setFontScale }: SiteHeaderProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <header className="header">
      {/* Logo */}
      <div className="header-logo">
        <Image
          src={`${basePath}/logo.png`}
          alt="Ministry of Education, Sri Lanka — Official Logo"
          width={768}
          height={107}
          className="brand-logo-img"
          priority
        />
      </div>

      {/* Trilingual Title */}
      <div className="header-title" role="banner">
        <div className="header-title-sinhala" lang="si">
          විනය ශාඛාව
        </div>
        <div className="header-title-tamil" lang="ta">
          ஒழுக்காற்றுப் பிரிவு
        </div>
        <div className="header-title-english" lang="en">
          DISCIPLINE BRANCH
        </div>
      </div>

      {/* Accessibility Controls Bar */}
      <div
        className="header-controls-bar"
        role="group"
        aria-label="Accessibility controls"
      >
        {/* Font Size Adjuster (LGWS 4.0 requirement) */}
        {setFontScale && (
          <div
            className="controls-group"
            role="radiogroup"
            aria-label="Font size"
          >
            <label
              className={`size-btn size-btn-small${
                fontScale === "small" ? " active" : ""
              }`}
            >
              <input
                type="radio"
                name="headerFontScale"
                value="small"
                checked={fontScale === "small"}
                onChange={() => setFontScale("small")}
                aria-label={t("fontSmall", "Small Font")}
                className="sr-only"
              />
              A
            </label>
            <label
              className={`size-btn size-btn-medium${
                fontScale === "medium" ? " active" : ""
              }`}
            >
              <input
                type="radio"
                name="headerFontScale"
                value="medium"
                checked={fontScale === "medium"}
                onChange={() => setFontScale("medium")}
                aria-label={t("fontMedium", "Medium Font")}
                className="sr-only"
              />
              A
            </label>
            <label
              className={`size-btn size-btn-large${
                fontScale === "large" ? " active" : ""
              }`}
            >
              <input
                type="radio"
                name="headerFontScale"
                value="large"
                checked={fontScale === "large"}
                onChange={() => setFontScale("large")}
                aria-label={t("fontLarge", "Large Font")}
                className="sr-only"
              />
              A
            </label>
          </div>
        )}

        {setFontScale && <div className="controls-divider" aria-hidden="true" />}

        {/* Language Switcher (LGWS 4.0 — trilingual) */}
        <div
          className="header-lang-selector"
          role="radiogroup"
          aria-label="Language selector"
        >
          <label
            className={`lang-btn${lang === "si" ? " active" : ""}`}
            lang="si"
          >
            <input
              type="radio"
              name="headerLanguage"
              value="si"
              checked={lang === "si"}
              onChange={() => changeLanguage("si")}
              aria-label="Switch language to Sinhala"
              className="sr-only"
            />
            සිංහල
          </label>
          <label
            className={`lang-btn${lang === "ta" ? " active" : ""}`}
            lang="ta"
          >
            <input
              type="radio"
              name="headerLanguage"
              value="ta"
              checked={lang === "ta"}
              onChange={() => changeLanguage("ta")}
              aria-label="Switch language to Tamil"
              className="sr-only"
            />
            தமிழ்
          </label>
          <label
            className={`lang-btn${lang === "en" ? " active" : ""}`}
            lang="en"
          >
            <input
              type="radio"
              name="headerLanguage"
              value="en"
              checked={lang === "en"}
              onChange={() => changeLanguage("en")}
              aria-label="Switch language to English"
              className="sr-only"
            />
            English
          </label>
        </div>
      </div>
    </header>
  );
}
