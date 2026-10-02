"use client";

import "@/i18n";
import "../../globals.css";
import "../../daily-mail/daily-mail.css";
import "../../dashboard-common.css";
import "../subject.css";
import "./appeal-details.css";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { SiteFooter } from "@/components/SiteFooter";
import { getCurrentProfile, signOut } from "@/lib/auth";
import {
  ArrowLeft,
  CheckCircle2,
  X,
  FileText,
  User,
  Calendar,
  Scale,
  AlertCircle,
  Send,
  Loader2,
  ChevronRight,
  FolderOpen,
  Bookmark,
  Building,
  Briefcase,
  FileCheck,
  Clock,
  Info,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AppealFormData {
  appealFiledDate: string;
  appealType: "aat" | "psc" | "other" | "";
  decision: string;
}

// ─── Inner Component (uses searchParams) ─────────────────────────────────────
function AppealDetailsContent() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || "si";
  const router = useRouter();
  const searchParams = useSearchParams();

  // Extract appeal data from URL params
  const caseNo = searchParams?.get("caseNo") || "";
  const appealRef = searchParams?.get("appealRef") || "";
  const appellantName = searchParams?.get("appellantName") || "";
  const appellantDesignation = searchParams?.get("appellantDesignation") || "";
  const schoolName = searchParams?.get("schoolName") || "";
  const appealGround = searchParams?.get("appealGround") || "";
  const originalOrder = searchParams?.get("originalOrder") || "";
  const submissionDate = searchParams?.get("submissionDate") || "";
  const currentAuthority = (searchParams?.get("appealAuthority") || "").toLowerCase();

  // UI States
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  // Form States
  const [formData, setFormData] = useState<AppealFormData>({
    appealFiledDate: "",
    appealType: "",
    decision: "",
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    setMounted(true);
    let initialType: AppealFormData["appealType"] = "";
    if (currentAuthority.includes("aat")) initialType = "aat";
    else if (currentAuthority.includes("psc")) initialType = "psc";
    else if (currentAuthority.includes("other")) initialType = "other";

    setFormData((prev) => ({
      ...prev,
      appealType: prev.appealType || initialType,
    }));
  }, [currentAuthority]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsSidebarOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    getCurrentProfile().then((profile) => {
      if (!profile) { router.replace("/"); return; }
      const allowed = [
        "subject_officer", "admin", "chief_clerk", "chief_clerk_discipline",
        "chief_clerk_investigation", "system_admin"
      ];
      if (!allowed.includes(profile.role)) {
        router.replace("/subject");
        return;
      }
      setCurrentUserProfile(profile);
    });
  }, [router]);

  const getFormattedDate = () => {
    const date = new Date();
    if (lang === "si") {
      return date.toLocaleDateString("si-LK", { day: "numeric", month: "long", year: "numeric" });
    }
    if (lang === "ta") {
      return date.toLocaleDateString("ta-LK", { day: "numeric", month: "long", year: "numeric" });
    }
    return date.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (e) {}
    router.push("/login");
  };

  const setTodayDate = () => {
    const today = new Date().toISOString().split("T")[0];
    setFormData((p) => ({ ...p, appealFiledDate: today }));
    if (errors.appealFiledDate) setErrors((p) => ({ ...p, appealFiledDate: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string | undefined> = {};
    if (!formData.appealFiledDate)
      newErrors.appealFiledDate = lang === "si" ? "අභියාචනය ගොනු කළ දිනය අවශ්‍යයි" : "Appeal filed date is required";
    if (!formData.appealType)
      newErrors.appealType = lang === "si" ? "අභියාචනයේ වර්ගය තෝරන්න" : "Please select the type of appeal";
    if (!formData.decision.trim())
      newErrors.decision = lang === "si" ? "අභියාචනා තීරණය ඇතුළත් කරන්න" : "Please enter the appeal decision";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const existing: any[] = JSON.parse(localStorage.getItem("dcmms_appeals") || "[]");
      let found = false;
      const updated = existing.map((a: any) => {
        const key = a.appealRef || a.caseNo || a.id || "";
        if (key === appealRef || key === caseNo || a.caseNo === caseNo) {
          found = true;
          return {
            ...a,
            appealFiledDate: formData.appealFiledDate,
            appealType: formData.appealType,
            decision: formData.decision,
            stageKey: "relief_granted",
            stage: lang === "si" ? "නිෂ්පාදිතය ලබා දෙන ලදී" : "Closed / Decision Issued",
            status: "closed",
          };
        }
        return a;
      });
      if (!found && caseNo) {
        updated.push({
          id: `app-${caseNo}-detail`,
          caseNo,
          appealRef: appealRef || `APP/${caseNo}`,
          appellantName,
          appellantDesignation,
          schoolName,
          appealGround,
          originalOrder,
          submissionDate,
          appealFiledDate: formData.appealFiledDate,
          appealType: formData.appealType,
          decision: formData.decision,
          stageKey: "relief_granted",
          stage: lang === "si" ? "නිෂ්පාදිතය ලබා දෙන ලදී" : "Closed / Decision Issued",
          status: "closed",
          priority: "medium",
        });
      }
      localStorage.setItem("dcmms_appeals", JSON.stringify(updated));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dcmms_data_updated"));
      }
      setSubmitted(true);
      setTimeout(() => router.push("/subject?tab=appeals"), 2000);
    } catch (e) {
      console.error("Failed to save appeal details:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => router.push("/subject?tab=appeals");

  if (!mounted) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <Loader2 size={36} className="spin-icon" style={{ color: "#2563eb" }} />
          <div style={{ color: "#64748b", fontWeight: 600, fontSize: "14px" }}>
            Loading Appeal Details...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container" data-font-scale={fontScale} suppressHydrationWarning>
      {/* Skip Link (A11y) */}
      <a href="#dashboard-main-content" className="skip-link">
        {t("skipLink", "Skip to main content")}
      </a>

      {/* Sidebar Navigation */}
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
        role="subject"
      />

      <div className="dashboard-layout">
        <main id="dashboard-main-content" className="dashboard-content">
          {/* ── Top App Bar Header ── */}
          <header className="dashboard-header" suppressHydrationWarning>
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
              <div className="dashboard-title-area" suppressHydrationWarning>
                <h2 className="dashboard-main-title">{t("subjectOfficer", "Subject Officer")}</h2>
                <p className="dashboard-main-subtitle">{t("subjectOfficerDesc", "Monitor and manage disciplinary case")}</p>
              </div>
            </div>

            <div className="dashboard-header-right" suppressHydrationWarning>
              {/* Date display badge */}
              <div className="date-badge">
                <span suppressHydrationWarning>{getFormattedDate()}</span>
                <svg className="date-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
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
                    aria-label={t("fontSmall", "Small text")}
                    className="sr-only"
                  />
                  A-
                </label>
                <label className={`size-btn size-btn-medium${fontScale === "medium" ? " active" : ""}`}>
                  <input
                    type="radio"
                    name="dashboardFontScale"
                    value="medium"
                    checked={fontScale === "medium"}
                    onChange={() => setFontScale("medium")}
                    aria-label={t("fontMedium", "Default text")}
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
                    aria-label={t("fontLarge", "Large text")}
                    className="sr-only"
                  />
                  A+
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
                    onChange={() => i18n.changeLanguage("si")}
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
                    onChange={() => i18n.changeLanguage("ta")}
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
                    onChange={() => i18n.changeLanguage("en")}
                    aria-label="Switch dashboard language to English"
                    className="sr-only"
                  />
                  English
                </label>
              </div>
            </div>
          </header>

          {/* ── Main Scrollable Page Area ── */}
          <section className="appeal-page-wrapper" suppressHydrationWarning>
            <div className="appeal-main-card">
              
              {/* Breadcrumb Navigation */}
              <nav className="appeal-breadcrumb-nav" aria-label="Breadcrumb">
                <Link href="/subject">{t("subjectOfficer", "Subject Officer")}</Link>
                <ChevronRight size={14} />
                <Link href="/subject?tab=appeals">
                  {lang === "si" ? "අභියාචනා" : lang === "ta" ? "மேல்முறையீடுகள்" : "Appeals"}
                </Link>
                <ChevronRight size={14} />
                <span style={{ color: "#0f172a", fontWeight: 700 }}>
                  {lang === "si" ? "අභියාචන ලේඛනය — විස්තර" : "Appeal Form — Add Details"}
                </span>
              </nav>

              {/* Header with Title, Badges, and Back Action */}
              <div className="appeal-header-container">
                <div className="appeal-header-left">
                  <div className="appeal-header-title-row">
                    <div className="appeal-title-icon-badge">
                      <Scale size={22} />
                    </div>
                    <div>
                      <h1 className="appeal-header-title">
                        {lang === "si" ? "අභියාචන ලේඛනය — විස්තර එක් කරන්න" : "Appeal Form — Add Details"}
                      </h1>
                      <p className="appeal-header-subtitle">
                        {lang === "si"
                          ? "චූදිත නිලධාරියා ඉදිරිපත් කළ අභියාචනයේ තොරතුරු සමාලෝචනය කර අවසන් තීරණය ඇතුළත් කරන්න."
                          : "Review the accused officer's appeal records and submit the final administrative decision."}
                      </p>
                    </div>
                  </div>

                  {/* Informative Pill Badges */}
                  <div className="appeal-header-badges">
                    {caseNo && (
                      <span className="appeal-badge-pill case-no">
                        <FolderOpen size={13} />
                        <span>Case: {caseNo}</span>
                      </span>
                    )}
                    {appealRef && (
                      <span className="appeal-badge-pill appeal-ref">
                        <Bookmark size={13} />
                        <span>Appeal Ref: {appealRef}</span>
                      </span>
                    )}
                    <span className="appeal-badge-pill status-open">
                      <Clock size={13} />
                      <span>{lang === "si" ? "අභියාචනය සලකා බැලීම" : "Pending Decision"}</span>
                    </span>
                  </div>
                </div>

                <div className="appeal-header-right">
                  <Link href="/subject?tab=appeals" className="btn-back-appeals">
                    <ArrowLeft size={16} />
                    <span>{lang === "si" ? "ආපසු අභියාචනා වෙත" : "Back to Appeals"}</span>
                  </Link>
                </div>
              </div>

              {submitted ? (
                /* Success Notification Box */
                <div className="appeal-success-box">
                  <CheckCircle2 size={54} style={{ color: "#16a34a", margin: "0 auto" }} />
                  <h2>
                    {lang === "si"
                      ? "අභියාචනා තීරණය සාර්ථකව සටහන් විය!"
                      : "Appeal Decision Recorded Successfully!"}
                  </h2>
                  <p>
                    {lang === "si"
                      ? "නඩුව 'Closed / Decision Issued' ලෙස සලකුණු කෙරිණි. ඔබව නැවත අභියාචනා ලැයිස්තුවට හරවා යවනු ලැබේ..."
                      : "The case has been marked as Closed / Decision Issued. Redirecting you to the appeals registry..."}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  
                  {/* ── CARD 1: Accused Officer Previous Details (Signature DCMMS card style) ── */}
                  <div className="appeal-officer-details-card">
                    <div className="appeal-card-header">
                      <h3 className="appeal-card-title">
                        <User size={18} style={{ color: "#2563eb" }} />
                        <span>{lang === "si" ? "චූදිත නිලධාරියාගේ විස්තර" : "Accused Officer Previous Details"}</span>
                      </h3>
                      <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
                        {caseNo ? `Case No: ${caseNo}` : "Reference Details"}
                      </span>
                    </div>

                    <div className="appeal-officer-grid">
                      {/* Case Number */}
                      <div className="appeal-officer-item">
                        <div className="officer-item-icon">
                          <FolderOpen size={18} />
                        </div>
                        <div className="officer-item-content">
                          <span className="officer-item-label">{lang === "si" ? "නඩු අංකය" : "Case Number"}</span>
                          <span className="officer-item-value" style={{ color: "#2563eb", fontWeight: 700 }}>
                            {caseNo || "—"}
                          </span>
                        </div>
                      </div>

                      {/* Appeal Reference */}
                      <div className="appeal-officer-item">
                        <div className="officer-item-icon">
                          <Bookmark size={18} />
                        </div>
                        <div className="officer-item-content">
                          <span className="officer-item-label">{lang === "si" ? "අභියාචනය යොමු අංකය" : "Appeal Reference"}</span>
                          <span className="officer-item-value" style={{ color: "#7c3aed", fontWeight: 700 }}>
                            {appealRef || "—"}
                          </span>
                        </div>
                      </div>

                      {/* Appellant Name */}
                      <div className="appeal-officer-item">
                        <div className="officer-item-icon">
                          <User size={18} />
                        </div>
                        <div className="officer-item-content">
                          <span className="officer-item-label">{lang === "si" ? "ආයාචකයාගේ නම" : "Appellant Name"}</span>
                          <span className="officer-item-value">{appellantName || "—"}</span>
                        </div>
                      </div>

                      {/* Designation */}
                      <div className="appeal-officer-item">
                        <div className="officer-item-icon">
                          <Briefcase size={18} />
                        </div>
                        <div className="officer-item-content">
                          <span className="officer-item-label">{lang === "si" ? "තනතුර" : "Designation"}</span>
                          <span className="officer-item-value">{appellantDesignation || "—"}</span>
                        </div>
                      </div>

                      {/* School / Institute */}
                      <div className="appeal-officer-item">
                        <div className="officer-item-icon">
                          <Building size={18} />
                        </div>
                        <div className="officer-item-content">
                          <span className="officer-item-label">{lang === "si" ? "ආයතනය / පාසල" : "School / Institute"}</span>
                          <span className="officer-item-value">{schoolName || "—"}</span>
                        </div>
                      </div>

                      {/* Submission Date */}
                      <div className="appeal-officer-item">
                        <div className="officer-item-icon">
                          <Calendar size={18} />
                        </div>
                        <div className="officer-item-content">
                          <span className="officer-item-label">{lang === "si" ? "ඉදිරිපත් කළ දිනය" : "Submission Date"}</span>
                          <span className="officer-item-value">{submissionDate || "—"}</span>
                        </div>
                      </div>

                      {/* Appeal Ground */}
                      {appealGround && (
                        <div className="appeal-officer-item span-full">
                          <div className="officer-item-icon">
                            <FileText size={18} />
                          </div>
                          <div className="officer-item-content" style={{ width: "100%" }}>
                            <span className="officer-item-label">{lang === "si" ? "අභියාචනයට හේතුව" : "Appeal Ground"}</span>
                            <div className="appeal-callout-box">
                              {appealGround}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Original Order */}
                      {originalOrder && (
                        <div className="appeal-officer-item span-full">
                          <div className="officer-item-icon">
                            <Scale size={18} />
                          </div>
                          <div className="officer-item-content" style={{ width: "100%" }}>
                            <span className="officer-item-label">{lang === "si" ? "මුල් නියෝගය" : "Original Order"}</span>
                            <div className="appeal-callout-box" style={{ borderLeftColor: "#7c3aed" }}>
                              {originalOrder}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── CARD 2: Appeal Details & Decision Entry ── */}
                  <div className="appeal-form-card">
                    <div className="appeal-card-header">
                      <h3 className="appeal-card-title">
                        <FileCheck size={18} style={{ color: "#2563eb" }} />
                        <span>{lang === "si" ? "අභියාචන විස්තර සහ තීරණය" : "Appeal Details & Final Decision"}</span>
                      </h3>
                      <span style={{ fontSize: "12px", color: "#ef4444", fontWeight: 700 }}>
                        * Required fields
                      </span>
                    </div>

                    <div className="appeal-form-fields-grid">
                      {/* Date Accused Filed Appeal */}
                      <div className="appeal-field-group">
                        <label htmlFor="appeal-filed-date" className="appeal-field-label">
                          <span className="appeal-field-label-left">
                            <Calendar size={14} style={{ color: "#2563eb" }} />
                            <span>{lang === "si" ? "චූදිතයා අභියාචනය ගොනු කළ දිනය" : "Date the Accused Filed the Appeal"}</span>
                            <span className="required-star">*</span>
                          </span>
                          <button
                            type="button"
                            onClick={setTodayDate}
                            className="btn-today-helper"
                            title="Set today's date"
                          >
                            {lang === "si" ? "අද දිනය" : "Today"}
                          </button>
                        </label>
                        <input
                          id="appeal-filed-date"
                          type="date"
                          value={formData.appealFiledDate}
                          onChange={(e) => {
                            setFormData((p) => ({ ...p, appealFiledDate: e.target.value }));
                            if (errors.appealFiledDate) setErrors((p) => ({ ...p, appealFiledDate: undefined }));
                          }}
                          className={`appeal-field-input ${errors.appealFiledDate ? "has-error" : ""}`}
                        />
                        {errors.appealFiledDate && (
                          <div className="appeal-field-error">
                            <AlertCircle size={12} />
                            <span>{errors.appealFiledDate}</span>
                          </div>
                        )}
                      </div>

                      {/* Type of Appeal with Quick-Select Pills */}
                      <div className="appeal-field-group">
                        <label className="appeal-field-label">
                          <span className="appeal-field-label-left">
                            <Scale size={14} style={{ color: "#2563eb" }} />
                            <span>{lang === "si" ? "අභියාචනයේ වර්ගය" : "Type of Appeal"}</span>
                            <span className="required-star">*</span>
                          </span>
                        </label>

                        {/* Interactive Pill Buttons for Quick Selection */}
                        <div className="appeal-type-pills-row" role="radiogroup" aria-label="Type of Appeal">
                          <button
                            type="button"
                            className={`appeal-type-pill ${formData.appealType === "aat" ? "active" : ""}`}
                            onClick={() => {
                              setFormData((p) => ({ ...p, appealType: "aat" }));
                              if (errors.appealType) setErrors((p) => ({ ...p, appealType: undefined }));
                            }}
                          >
                            <span>AAT</span>
                            <span style={{ fontSize: "11px", opacity: 0.85 }}>(Tribunal)</span>
                          </button>

                          <button
                            type="button"
                            className={`appeal-type-pill ${formData.appealType === "psc" ? "active" : ""}`}
                            onClick={() => {
                              setFormData((p) => ({ ...p, appealType: "psc" }));
                              if (errors.appealType) setErrors((p) => ({ ...p, appealType: undefined }));
                            }}
                          >
                            <span>PSC</span>
                            <span style={{ fontSize: "11px", opacity: 0.85 }}>(Commission)</span>
                          </button>

                          <button
                            type="button"
                            className={`appeal-type-pill ${formData.appealType === "other" ? "active" : ""}`}
                            onClick={() => {
                              setFormData((p) => ({ ...p, appealType: "other" }));
                              if (errors.appealType) setErrors((p) => ({ ...p, appealType: undefined }));
                            }}
                          >
                            <span>{lang === "si" ? "වෙනත්" : "Other"}</span>
                          </button>
                        </div>

                        {errors.appealType && (
                          <div className="appeal-field-error" style={{ marginTop: "4px" }}>
                            <AlertCircle size={12} />
                            <span>{errors.appealType}</span>
                          </div>
                        )}
                      </div>

                      {/* Decision Textarea */}
                      <div className="appeal-field-group full-width">
                        <label htmlFor="appeal-decision" className="appeal-field-label">
                          <span className="appeal-field-label-left">
                            <FileText size={14} style={{ color: "#2563eb" }} />
                            <span>{lang === "si" ? "අභියාචනය පිළිබඳ තීරණය" : "Decision / Order Issued"}</span>
                            <span className="required-star">*</span>
                          </span>
                        </label>
                        <textarea
                          id="appeal-decision"
                          rows={4}
                          value={formData.decision}
                          onChange={(e) => {
                            setFormData((p) => ({ ...p, decision: e.target.value }));
                            if (errors.decision) setErrors((p) => ({ ...p, decision: undefined }));
                          }}
                          placeholder={
                            lang === "si"
                              ? "අභියාචනය සම්බන්ධයෙන් ගනු ලැබූ අවසන් තීරණය හෝ නියෝගය මෙහි සටහන් කරන්න..."
                              : "Enter the decision made regarding this appeal (e.g., relief granted, penalty modified, or appeal dismissed)..."
                          }
                          className={`appeal-field-textarea ${errors.decision ? "has-error" : ""}`}
                        />
                        {errors.decision && (
                          <div className="appeal-field-error">
                            <AlertCircle size={12} />
                            <span>{errors.decision}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Informative Guidance Banner */}
                    <div className="appeal-info-banner">
                      <Info size={18} className="appeal-info-icon" />
                      <span>
                        {lang === "si"
                          ? "සටහන: මෙම පෝරමය ඉදිරිපත් කළ පසු මෙම නඩුවේ තත්වය 'Closed / Decision Issued' ලෙස ස්වයංක්‍රීයව යාවත්කාලීන වේ."
                          : "Notice: Submitting this form will finalize the appeal and mark this case as Closed / Decision Issued in the DCMMS registry."}
                      </span>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="appeal-actions-row">
                      <button
                        id="appeal-close-btn"
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="btn-appeal-cancel"
                      >
                        <X size={15} />
                        <span>{lang === "si" ? "අවලංගු කරන්න" : "Cancel"}</span>
                      </button>

                      <button
                        id="appeal-submit-btn"
                        type="submit"
                        disabled={isSubmitting}
                        className="btn-appeal-submit"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 size={16} className="spin-icon" />
                            <span>{lang === "si" ? "සුරකිමින් පවතී..." : "Submitting..."}</span>
                          </>
                        ) : (
                          <>
                            <Send size={16} />
                            <span>{lang === "si" ? "තීරණය ඉදිරිපත් කරන්න" : "Submit Decision"}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* Standard Footer */}
            <SiteFooter />
          </section>
        </main>
      </div>

      <style>{`
        .spin-icon { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default function AppealDetailsPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <Loader2 size={36} className="spin-icon" style={{ color: "#2563eb" }} />
      </div>
    }>
      <AppealDetailsContent />
    </Suspense>
  );
}
