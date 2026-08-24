"use client";

import "@/i18n";
import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { TextInput } from "@/components/TextInput";
import { Button } from "@/components/Button";
import { SiteFooter } from "@/components/SiteFooter";
import { saveRegisterOfficerServer } from "@/lib/db-actions";
import { getCurrentProfile } from "@/lib/auth";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function HumanCreatedRegistrationPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [employeeNo, setEmployeeNo] = useState("");
  const [role, setRole] = useState("System admin");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const lang = i18n.language;

  useEffect(() => {
    setEmployeeNo(`200399${Math.floor(100000 + Math.random() * 900000)}`);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${t("cardTitle", "Account Access")} | DCMMS`;
  }, [lang, t]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setRegisterError("");
    setSuccessMessage("");

    if (!fullName.trim() || !email.trim() || !employeeNo.trim() || !password) {
      setRegisterError("Please fill in all required fields.");
      return;
    }

    if (password.length < 6) {
      setRegisterError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setRegisterError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const currentAdmin = await getCurrentProfile();

      const res = await saveRegisterOfficerServer({
        employee_no: employeeNo.trim(),
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password: password,
        role: role,
        is_active: true,
        created_by: currentAdmin?.id || null,
      });

      if (res.success) {
        setSuccessMessage("Account registered successfully! Redirecting to login...");
        setTimeout(() => {
          router.push("/");
        }, 1500);
      } else {
        setRegisterError(res.error || "Failed to register account. Please try again.");
      }
    } catch (err: any) {
      console.error("Registration error:", err);
      setRegisterError(err?.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page" data-font-scale={fontScale}>
      {/* ── Skip Navigation Link (WCAG 2.4.1) ─────────────── */}
      <a href="#main-content" className="skip-link">
        {t("skipLink", "Skip to main content")}
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
        <div className="header-controls-bar" role="group" aria-label="Accessibility controls">
          {/* Font Size Adjuster */}
          <div className="controls-group" role="radiogroup" aria-label="Font size">
            <label className={`size-btn size-btn-small${fontScale === "small" ? " active" : ""}`}>
              <input
                type="radio"
                name="fontScale"
                value="small"
                checked={fontScale === "small"}
                onChange={() => setFontScale("small")}
                aria-label={t("fontSmall", "Small font")}
                className="sr-only"
              />
              A
            </label>
            <label className={`size-btn size-btn-medium${fontScale === "medium" ? " active" : ""}`}>
              <input
                type="radio"
                name="fontScale"
                value="medium"
                checked={fontScale === "medium"}
                onChange={() => setFontScale("medium")}
                aria-label={t("fontMedium", "Medium font")}
                className="sr-only"
              />
              A
            </label>
            <label className={`size-btn size-btn-large${fontScale === "large" ? " active" : ""}`}>
              <input
                type="radio"
                name="fontScale"
                value="large"
                checked={fontScale === "large"}
                onChange={() => setFontScale("large")}
                aria-label={t("fontLarge", "Large font")}
                className="sr-only"
              />
              A
            </label>
          </div>

          <div className="controls-divider" aria-hidden="true" />

          {/* Language Switcher */}
          <div className="header-lang-selector" role="radiogroup" aria-label="Language selector">
            <label className={`lang-btn${lang === "si" ? " active" : ""}`} lang="si">
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
            <label className={`lang-btn${lang === "ta" ? " active" : ""}`} lang="ta">
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
            <label className={`lang-btn${lang === "en" ? " active" : ""}`} lang="en">
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
            <div className="warning-list" role="note" aria-label="Security Warnings">
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

          {/* Right Column — Registration Card */}
          <div className="right-panel">
            <div className="login-card">
              {/* Card Header */}
              <div className="card-header">
                <h2 className="card-title">
                  {lang === "si" ? "ගිණුම් ලියාපදිංචිය" : lang === "ta" ? "கணக்கு பதிவு" : "Account Registration"}
                </h2>
                <p className="card-subtitle">
                  {lang === "si" ? "පද්ධති ප්‍රවේශය සඳහා නව ගිණුමක් සාදන්න." : lang === "ta" ? "கணினி அணுகலுக்காக புதிய கணக்கை உருவாக்கவும்." : "Register a new account for DCMMS access."}
                </p>
              </div>

              {/* Registration Form */}
              <form className="login-form" onSubmit={handleSubmit} noValidate>
                {/* Error banner */}
                {registerError && (
                  <div role="alert" className="login-error-banner">
                    {registerError}
                  </div>
                )}

                {/* Success banner */}
                {successMessage && (
                  <div
                    role="alert"
                    style={{
                      padding: "12px 16px",
                      borderRadius: "8px",
                      backgroundColor: "rgba(16, 185, 129, 0.15)",
                      border: "1px solid rgb(16, 185, 129)",
                      color: "rgb(6, 95, 70)",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                    }}
                  >
                    {successMessage}
                  </div>
                )}

                <TextInput
                  id="fullName"
                  name="fullName"
                  type="text"
                  label={lang === "si" ? "සම්පූර්ණ නම:" : lang === "ta" ? "முழுப் பெயர்:" : "Full Name:"}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                  aria-required="true"
                />

                <TextInput
                  id="email"
                  name="email"
                  type="email"
                  label={t("emailLabel")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  aria-required="true"
                />

                <TextInput
                  id="employeeNo"
                  name="employeeNo"
                  type="text"
                  label={lang === "si" ? "සේවක / කාර්ය මණ්ඩල අංකය:" : lang === "ta" ? "பணியாளர் எண்:" : "Staff / Employee ID:"}
                  value={employeeNo}
                  onChange={(e) => setEmployeeNo(e.target.value)}
                  required
                  aria-required="true"
                />

                <div className="form-group">
                  <label htmlFor="role" className="form-label">
                    {t("roleLabel", "Role:")}
                  </label>
                  <input
                    id="role"
                    name="role"
                    type="text"
                    className="form-input"
                    value={lang === "si" ? "පද්ධති පරිපාලක" : lang === "ta" ? "கணினி நிர்வாகி" : "System Administrator"}
                    readOnly
                    disabled
                    style={{ backgroundColor: "#f1f5f9", cursor: "not-allowed", fontWeight: 600, color: "#1e293b" }}
                  />
                </div>

                <TextInput
                  id="password"
                  name="password"
                  type="password"
                  label={t("passwordLabel")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  aria-required="true"
                />

                <TextInput
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  label={lang === "si" ? "මුරපදය තහවුරු කරන්න:" : lang === "ta" ? "கடவுச்சொல்லை உறுதிப்படுத்தவும்:" : "Confirm Password:"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  aria-required="true"
                />

                {/* Submit Button */}
                <div className="submit-wrapper">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading
                      ? (lang === "si" ? "ලියාපදිංචි වෙමින්..." : lang === "ta" ? "பதிவு செய்யப்படுகிறது..." : "Registering…")
                      : (lang === "si" ? "ලියාපදිංචි වන්න" : lang === "ta" ? "பதிவு செய்க" : "Register Account")}
                  </Button>
                </div>

                {/* Return to Login */}
                <p className="login-register-hint" style={{ textAlign: "center", margin: 0, fontSize: "0.875rem" }}>
                  {lang === "si" ? "දැනටමත් ගිණුමක් තිබේද? " : lang === "ta" ? "ஏற்கனவே கணக்கு உள்ளதா? " : "Already have an account? "}
                  <Link href="/" style={{ color: "var(--accent-color)", fontWeight: 600, textDecoration: "none" }}>
                    {t("loginBtn", "Login")}
                  </Link>
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
