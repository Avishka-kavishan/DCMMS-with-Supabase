"use client";

import "../../../i18n";
import "../../daily-mail/daily-mail.css";
import "../../dashboard-common.css";
import "../subject.css";
import "./reports.css";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sidebar } from "@/components/Sidebar";
import { SiteFooter } from "@/components/SiteFooter";
import { getCurrentProfile, signOut, UserProfile } from "@/lib/auth";
import {
  Shield,
  Mail,
  Calendar as CalendarIcon
} from "lucide-react";

export default function SubjectOfficerReportsPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const lang = i18n.language;

  // Sidebar and UI states
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");

  // Tab state: "discipline" | "mail"
  const [activeTab, setActiveTab] = useState<"discipline" | "mail">("discipline");

  // Load user profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const prof = await getCurrentProfile();
        setProfile(prof);
      } catch (e) {
        console.error("Error loading profile:", e);
      }
    };
    loadProfile();
  }, []);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut();
    router.push("/login");
  };

  return (
    <div className={`subject-dashboard-container font-scale-${fontScale}`} style={{ minHeight: "100vh", display: "flex", flexDirection: "column", width: "100%" }}>
      {/* Sidebar Navigation */}
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
        role="subject"
      />

      <div className="dashboard-layout" style={{ flex: 1, width: "100%" }}>
        {/* Main Content Area - Full Screen Width */}
        <main id="reports-main-content" className="dashboard-content" style={{ width: "100%", maxWidth: "100%", flex: 1, display: "flex", flexDirection: "column", padding: "24px 32px" }}>
          {/* Top App Bar Header Matching Other Pages */}
          <header className="dashboard-header" style={{ width: "100%" }}>
            <div className="dashboard-header-left">
              <button
                className="menu-toggle-btn"
                aria-label="Toggle Sidebar Menu"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                {...(isSidebarOpen ? { "aria-expanded": "true" } : { "aria-expanded": "false" })}
              >
                <svg className="hamburger-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="dashboard-title-area">
                <h2 className="dashboard-main-title">
                  {lang === "si" ? "විෂය භාර නිලධාරී" : lang === "ta" ? "பாடப் பொறுப்பு அதிகாரி" : "Subject Officer"}
                </h2>
                <p className="dashboard-main-subtitle">
                  {lang === "si"
                    ? "වාර්තා සහ විශ්ලේෂණ සේවා අවකාශය"
                    : lang === "ta"
                    ? "அறிக்கைகள் மற்றும் பகுப்பாய்வு பணியிடம்"
                    : "Reports & Analytics Workspace"}
                </p>
              </div>
            </div>

            <div className="dashboard-header-right">
              {/* Date display badge */}
              <div className="date-badge">
                <svg className="date-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span suppressHydrationWarning>
                  {new Date().toLocaleDateString(
                    lang === "si" ? "si-LK" : lang === "ta" ? "ta-LK" : "en-US",
                    { year: "numeric", month: "long", day: "numeric" }
                  )}
                </span>
              </div>

              <div className="divider-line" aria-hidden="true" />

              {/* Accessibility Scale Radio Group */}
              <div className="accessibility-adjuster-bar" role="radiogroup" aria-label="Font Sizing Adjustment">
                <label className={`size-btn size-btn-small${fontScale === "small" ? " active" : ""}`}>
                  <input
                    type="radio"
                    name="dashboardFontScale"
                    value="small"
                    checked={fontScale === "small"}
                    onChange={() => setFontScale("small")}
                    aria-label={t("fontSmall", "Small")}
                    className="sr-only"
                  />
                  A
                </label>
                <label className={`size-btn size-btn-medium${fontScale === "medium" ? " active" : ""}`}>
                  <input
                    type="radio"
                    name="dashboardFontScale"
                    value="medium"
                    checked={fontScale === "medium"}
                    onChange={() => setFontScale("medium")}
                    aria-label={t("fontMedium", "Medium")}
                    className="sr-only"
                  />
                  A
                </label>
                <label className={`size-btn size-btn-large${fontScale === "large" ? " active" : ""}`}>
                  <input
                    type="radio"
                    name="dashboardFontScale"
                    value="large"
                    checked={fontScale === "large"}
                    onChange={() => setFontScale("large")}
                    aria-label={t("fontLarge", "Large")}
                    className="sr-only"
                  />
                  A
                </label>
              </div>

              <div className="divider-line" aria-hidden="true" />

              {/* Translation controls */}
              <div className="trilingual-language-selector" role="radiogroup" aria-label="Translate Dashboard Language">
                <label className={`lang-btn${lang === "si" ? " active" : ""}`} lang="si">
                  <input
                    type="radio"
                    name="dashboardLang"
                    value="si"
                    checked={lang === "si"}
                    onChange={() => changeLanguage("si")}
                    aria-label="Switch dashboard language to Sinhala"
                    className="sr-only"
                  />
                  සිංහල
                </label>
                <label className={`lang-btn${lang === "ta" ? " active" : ""}`} lang="ta">
                  <input
                    type="radio"
                    name="dashboardLang"
                    value="ta"
                    checked={lang === "ta"}
                    onChange={() => changeLanguage("ta")}
                    aria-label="Switch dashboard language to Tamil"
                    className="sr-only"
                  />
                  தமிழ்
                </label>
                <label className={`lang-btn${lang === "en" ? " active" : ""}`} lang="en">
                  <input
                    type="radio"
                    name="dashboardLang"
                    value="en"
                    checked={lang === "en"}
                    onChange={() => changeLanguage("en")}
                    aria-label="Switch dashboard language to English"
                    className="sr-only"
                  />
                  English
                </label>
              </div>
            </div>
          </header>

          {/* Full Screen Page Content Container */}
          <div style={{ width: "100%", flex: 1, display: "flex", flexDirection: "column", marginTop: "20px" }}>
            {/* Navigation Tab Bar (Discipline / Mail) */}
            <div className="navigation-tab-list" style={{ marginBottom: "20px", alignSelf: "flex-start" }}>
              <button
                type="button"
                className={`nav-tab-btn${activeTab === "discipline" ? " active" : ""}`}
                onClick={() => setActiveTab("discipline")}
              >
                <Shield className="tab-icon" />
                <span>{t("discipline", "Discipline")}</span>
              </button>

              <button
                type="button"
                className={`nav-tab-btn${activeTab === "mail" ? " active" : ""}`}
                onClick={() => setActiveTab("mail")}
              >
                <Mail className="tab-icon" />
                <span>{t("mail", "Mail")}</span>
              </button>
            </div>

            {/* Tab 1: Discipline Content - Full Screen Width */}
            {activeTab === "discipline" && (
              <section className="tab-content-wrapper" key="discipline-tab" style={{ width: "100%", flex: 1, display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "14px",
                    border: "1px solid #e2e8f0",
                    padding: "60px 32px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.03)",
                    width: "100%",
                    flex: 1,
                    minHeight: "450px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    color: "#64748b"
                  }}
                >
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "16px",
                      backgroundColor: "#eff6ff",
                      color: "#2563eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "18px"
                    }}
                  >
                    <Shield size={32} />
                  </div>
                  <h3 style={{ fontSize: "20px", fontWeight: 700, color: "#1e293b", margin: "0 0 8px" }}>
                    {lang === "si" ? "විනය අංශය" : lang === "ta" ? "ஒழுக்கப் பிரிவு" : "Discipline Section"}
                  </h3>
                  <p style={{ fontSize: "14px", color: "#64748b", margin: 0, maxWidth: "600px" }}>
                    {lang === "si"
                      ? "විනය නඩු පිළිබඳ විස්තර සහ කළමනාකරණය මෙහි දිස්වේ."
                      : lang === "ta"
                      ? "ஒழுங்கு நடவடிக்கைகள் மற்றும் மேலாண்மை விவரங்கள் இங்கே காட்டப்படும்."
                      : "Discipline cases management and records will appear here."}
                  </p>
                </div>
              </section>
            )}

            {/* Tab 2: Mail Content - Full Screen Width */}
            {activeTab === "mail" && (
              <section className="tab-content-wrapper" key="mail-tab" style={{ width: "100%", flex: 1, display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "14px",
                    border: "1px solid #e2e8f0",
                    padding: "60px 32px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.03)",
                    width: "100%",
                    flex: 1,
                    minHeight: "450px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    color: "#64748b"
                  }}
                >
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "16px",
                      backgroundColor: "#eff6ff",
                      color: "#2563eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "18px"
                    }}
                  >
                    <Mail size={32} />
                  </div>
                  <h3 style={{ fontSize: "20px", fontWeight: 700, color: "#1e293b", margin: "0 0 8px" }}>
                    {lang === "si" ? "තැපැල් අංශය" : lang === "ta" ? "அஞ்சல் பிரிவு" : "Mail Section"}
                  </h3>
                  <p style={{ fontSize: "14px", color: "#64748b", margin: 0, maxWidth: "600px" }}>
                    {lang === "si"
                      ? "දෛනික තැපැල් ලිපි සහ ලේඛන මෙහි දිස්වේ."
                      : lang === "ta"
                      ? "தினசரி அஞ்சல் கடிதங்கள் மற்றும் ஆவணங்கள் இங்கே காட்டப்படும்."
                      : "Daily mail letters and documents will appear here."}
                  </p>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
