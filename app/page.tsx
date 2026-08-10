"use client";

import "../i18n";
import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { TextInput } from "@/components/TextInput";
import { Button } from "@/components/Button";
import { SiteFooter } from "@/components/SiteFooter";
import { dashboardPath, UserRole, getCurrentProfile, normalizeRole } from "@/lib/auth";
import { logLogin, logFailedLogin } from "@/lib/security";
import { loginOfficerServer } from "@/lib/db-actions";

/* Font scale map — LGWS 4.0 mandates at least 3 sizes */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function Home() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const lang = i18n.language;

  // Check search params for forced logout notice
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("reason") === "forced_logout") {
        setInfoMessage("Your session was terminated by a system administrator.");
      } else if (params.get("reason") === "inactivity_timeout") {
        setInfoMessage("Your session has timed out due to inactivity. Please log in again.");
      }
    }
  }, []);

  // If already signed in, redirect to correct dashboard
  useEffect(() => {
    const checkRedirect = async () => {
      const profile = await getCurrentProfile();
      if (profile?.role) {
        router.replace(dashboardPath(profile.role));
      }
    };
    checkRedirect();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError("");
    setInfoMessage("");
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      setLoginError("Please enter your email and password.");
      return;
    }

    const getSimulatedUser = () => {
      const emailLower = email.toLowerCase().trim();
      if (emailLower === "nathashasathsarani209@gmail.com" && (password === "123456" || password === "sysadmin123456")) {
        return { id: "officer-200280401310", full_name: "Nathasha Sathsarani", role: "system_admin" as UserRole, email };
      }
      if (emailLower === "avishkakavishan13@gmail.com" && (password === "123456" || password === "admin123")) {
        return { id: "officer-200133702441", full_name: "Avishka Kavishan", role: "admin" as UserRole, email };
      }
      if (emailLower === "avishakavishan3@gmail.com" && password === "kavi123456") {
        return { id: "sim-daily-mail", full_name: "Avishka", role: "daily_mail" as UserRole, email };
      }
      if (emailLower === "admin@dcmms.gov.lk" && password === "sysadmin123456") {
        return { id: "sim-sysadmin", full_name: "System Admin", role: "system_admin" as UserRole, email };
      }
      if (emailLower === "admin@admin.com" && password === "admin123") {
        return { id: "sim-admin", full_name: "Administrator", role: "admin" as UserRole, email };
      }
      // Check localStorage custom profiles if any match
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("dcmms_custom_profiles");
        if (stored) {
          try {
            const list = JSON.parse(stored);
            const match = list.find(
              (p: any) => p.email?.toLowerCase() === emailLower && p.password === password
            );
            if (match) {
              return {
                id: match.id || `sim-${match.role}`,
                full_name: match.fullName || "User",
                role: match.role as UserRole,
                email: match.email || email,
              };
            }
          } catch (e) {
            console.error(e);
          }
        }
      }
      return null;
    };

    setIsLoading(true);
    try {
      // 1. Primary: Login via PostgreSQL Server Action
      const res = await loginOfficerServer(email, password);

      if (res.success && res.data) {
        const userRole = normalizeRole(res.data.role);
        const sessionUser = {
          id: res.data.id,
          employee_no: res.data.employee_no,
          full_name: res.data.full_name,
          email: res.data.email,
          role: userRole,
        };

        if (typeof window !== "undefined") {
          localStorage.setItem("dcmms_simulated_session", JSON.stringify(sessionUser));
          localStorage.setItem("dcmms_current_session_id", res.data.id);
        }

        // Log successful login
        await logLogin(res.data.id, res.data.full_name, res.data.email);

        router.push(dashboardPath(userRole));
        return;
      }

      // 2. Fallback check for simulated/hardcoded users if PostgreSQL returned error
      const simUser = getSimulatedUser();
      if (simUser) {
        if (typeof window !== "undefined") {
          localStorage.setItem("dcmms_simulated_session", JSON.stringify(simUser));
          localStorage.setItem("dcmms_current_session_id", simUser.id);
        }
        await logLogin(simUser.id, simUser.full_name, email);
        router.push(dashboardPath(simUser.role as UserRole));
        return;
      }

      const errMsg = res.error || "Invalid email or password.";
      setLoginError(errMsg);
      try {
        await logFailedLogin(email, errMsg);
      } catch (logErr) {
        console.error("Failed to log failed login attempt:", logErr);
      }
    } catch (err: any) {
      const simUser = getSimulatedUser();
      if (simUser) {
        if (typeof window !== "undefined") {
          localStorage.setItem("dcmms_simulated_session", JSON.stringify(simUser));
          localStorage.setItem("dcmms_current_session_id", simUser.id);
        }
        router.push(dashboardPath(simUser.role as UserRole));
        return;
      }

      const errMsg = err.message || "Invalid email or password.";
      setLoginError(errMsg);
      try {
        await logFailedLogin(email, errMsg);
      } catch (logErr) {
        console.error("Failed to log failed login attempt:", logErr);
      }
    } finally {
      setIsLoading(false);
    }
  };

  /* Sync html[lang] and document.title with active language */
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t("docTitle");
  }, [lang, t]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div
      className="login-page"
      data-font-scale={fontScale}
    >
      {/* ── Skip Navigation Link (WCAG 2.4.1) ─────────────── */}
      <a href="#main-content" className="skip-link">
        {t("skipLink")}
      </a>

      {/* ── Header Bar ──────────────────────────────────────── */}
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
                name="fontScale"
                value="small"
                checked={fontScale === "small"}
                onChange={() => setFontScale("small")}
                aria-label={t("fontSmall")}
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
                name="fontScale"
                value="medium"
                checked={fontScale === "medium"}
                onChange={() => setFontScale("medium")}
                aria-label={t("fontMedium")}
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
                name="fontScale"
                value="large"
                checked={fontScale === "large"}
                onChange={() => setFontScale("large")}
                aria-label={t("fontLarge")}
                className="sr-only"
              />
              A
            </label>
          </div>

          <div className="controls-divider" aria-hidden="true" />

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
                name="language"
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
                name="language"
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
                name="language"
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

      {/* ── Main Body ───────────────────────────────────────── */}
      <main id="main-content" className="main-content">
        <div className="content-grid">

          {/* Left Column — DCMMS Branding & Portal Info */}
          <div className="left-panel">
            {/* DCMMS Branding Header */}
            <div className="brand-header">
              <div className="brand-icon-box" aria-hidden="true">
                <Image
                  src={`${basePath}/icon.svg`}
                  alt=""
                  width={32}
                  height={32}
                  className="brand-icon"
                />
              </div>
              <div className="brand-text">
                <h1 className="brand-title">DCMMS</h1>
                <p className="brand-subtitle">{t("subtitle")}</p>
              </div>
            </div>

            {/* Internal Staff Portal section */}
            <div className="portal-info">
              <h2 className="portal-heading">{t("portalHeading")}</h2>
              <p className="portal-description">{t("portalDesc")}</p>
            </div>

            {/* Security Warning Notices */}
            <div
              className="warning-list"
              role="note"
              aria-label="Security Warnings"
            >
              <div className="warning-item">
                <svg
                  className="warning-icon"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <p className="warning-text">{t("warningCreds")}</p>
              </div>
              <div className="warning-item">
                <svg
                  className="warning-icon"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                <p className="warning-text">{t("warningAuth")}</p>
              </div>
            </div>
          </div>

          {/* Right Column — Account Access Card */}
          <div className="right-panel">
            <div className="login-card">
              {/* Card Header */}
              <div className="card-header">
                <h2 className="card-title">{t("cardTitle")}</h2>
                <p className="card-subtitle">{t("cardSubtitle")}</p>
              </div>

              {/* Login Form */}
              <form className="login-form" onSubmit={handleSubmit} noValidate>
                {/* Error banner */}
                {loginError && (
                  <div role="alert" className="login-error-banner">
                    {loginError}
                  </div>
                )}

                {/* Info banner */}
                {infoMessage && (
                  <div role="alert" className="login-info-banner" style={{
                    padding: "12px 16px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(224, 86, 36, 0.15)",
                    border: "1px solid rgb(224, 86, 36)",
                    color: "rgb(224, 86, 36)",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    marginBottom: "16px",
                  }}>
                    {infoMessage}
                  </div>
                )}

                <TextInput
                  id="email"
                  name="email"
                  type="email"
                  label={t("emailLabel")}
                  required
                  autoComplete="email"
                  aria-required="true"
                />

                <TextInput
                  id="password"
                  name="password"
                  type="password"
                  label={t("passwordLabel")}
                  required
                  autoComplete="current-password"
                  aria-required="true"
                />

                {/* Login Button */}
                <div className="submit-wrapper">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Signing in…" : t("loginBtn")}
                  </Button>
                </div>

                {/* Register link */}
                <p className="login-register-hint">
                  Don&apos;t have an account?{" "}
                  <Link href="/register">Register here</Link>
                </p>
              </form>
            </div>
          </div>

        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <SiteFooter />
    </div>
  );
}
