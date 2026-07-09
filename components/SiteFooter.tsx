"use client";

import React from "react";
import { useTranslation } from "react-i18next";

export function SiteFooter() {
  const { t } = useTranslation();

  return (
    <footer className="footer">
      <p className="footer-text">{t("footerText", "© 2026 Ministry of Education, Sri Lanka. All Rights Reserved.")}</p>
    </footer>
  );
}
