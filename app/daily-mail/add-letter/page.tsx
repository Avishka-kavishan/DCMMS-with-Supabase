"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { 
  ArrowLeft, 
  FileText, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Check
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { SiteFooter } from "@/components/SiteFooter";
import { signOut, getCurrentProfile, getRoleDisplayName, UserProfile } from "@/lib/auth";
import { 
  saveDailyMailRecordServer, 
  getNextDailyMailLetterNoServer 
} from "@/lib/db-actions";
import { supabase, isSupabaseConfigured, logAuditEvent } from "@/lib/supabase";

import "../../../i18n";
import "../../dashboard-common.css";
import "../daily-mail.css";
import "../register/register.css";

export default function AddNewLetterPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const lang = i18n.language;

  const [mounted, setMounted] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Form Field States
  const [letterNo, setLetterNo] = useState("");
  const [letterType, setLetterType] = useState("Complaint");
  const [sendBy, setSendBy] = useState("");
  const [letterDate, setLetterDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // UI / Submission States
  const [isAutoGeneratingNo, setIsAutoGeneratingNo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submittedLetter, setSubmittedLetter] = useState<any | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Trilingual letter types with localized labels
  const letterTypes = [
    { 
      value: "Complaint", 
      labelEn: "Disciplinary Complaint", 
      labelSi: "විනය පැමිණිල්ල (Disciplinary)", 
      labelTa: "ஒழுக்காற்று முறைப்பாடு" 
    },
    { 
      value: "Inquiry", 
      labelEn: "Inquiry / Investigation", 
      labelSi: "පරීක්ෂණ ලිපිය (Inquiry)", 
      labelTa: "விசாரணை கடிதம்" 
    },
    { 
      value: "Appeal", 
      labelEn: "Appeal", 
      labelSi: "අභියාචනය (Appeal)", 
      labelTa: "மேන්முறையீடு" 
    },
    { 
      value: "Request", 
      labelEn: "Request / Inquiry", 
      labelSi: "ඉල්ලීම (Request)", 
      labelTa: "கோரிக்கை" 
    },
    { 
      value: "Notification", 
      labelEn: "Official Notification", 
      labelSi: "දැනුම්දීම (Notification)", 
      labelTa: "அறிவித்தல்" 
    },
    { 
      value: "Regular Letter", 
      labelEn: "Regular Correspondence", 
      labelSi: "සාමාන්‍ය ලිපිය (General)", 
      labelTa: "சாதாரண கடிதம்" 
    },
    { 
      value: "Answer Letter", 
      labelEn: "Answer Letter", 
      labelSi: "පිළිතුරු ලිපිය (Answer)", 
      labelTa: "பதில் கடிதம்" 
    },
    { 
      value: "Other", 
      labelEn: "Other Document", 
      labelSi: "වෙනත් (Other)", 
      labelTa: "பிற" 
    }
  ];

  // Auto-generate next Letter No based on letterDate
  const generateNextLetterNo = async (targetDate: string) => {
    setIsAutoGeneratingNo(true);
    try {
      const res = await getNextDailyMailLetterNoServer(targetDate);
      if (res && res.success && res.nextLetterNo) {
        setLetterNo(res.nextLetterNo);
      } else {
        const d = new Date(targetDate || Date.now());
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        setLetterNo(`${y}/${m}/${day}/001`);
      }
    } catch (e) {
      console.warn("Auto-generate letter no failed:", e);
    } finally {
      setIsAutoGeneratingNo(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    getCurrentProfile().then((prof) => {
      if (prof) setProfile(prof);
    });
    generateNextLetterNo(letterDate);
  }, []);

  // Handle Letter Date change -> recalculate suggested letter no
  const handleDateChange = (newDate: string) => {
    setLetterDate(newDate);
    if (!letterNo || letterNo.includes("/")) {
      generateNextLetterNo(newDate);
    }
  };

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!letterNo.trim()) {
      errs.letterNo = lang === "si" ? "කරුණාකර ලිපි අංකය ඇතුළත් කරන්න." : lang === "ta" ? "கடித எண்ணை உள்ளிடவும்." : "Please enter the letter number.";
    }
    if (!letterType.trim()) {
      errs.letterType = lang === "si" ? "කරුණාකර ලිපි වර්ගය තෝරන්න." : lang === "ta" ? "கடித வகையைத் தேர்ந்தெடுக்கவும்." : "Please select the letter type.";
    }
    if (!sendBy.trim()) {
      errs.sendBy = lang === "si" ? "කරුණාකර එවූ පාර්ශවය ඇතුළත් කරන්න." : lang === "ta" ? "அனுப்பியவரை உள்ளிடவும்." : "Please enter the sender party / organization.";
    }
    if (!letterDate.trim()) {
      errs.letterDate = lang === "si" ? "කරුණාකර ලිපි දිනය තෝරන්න." : lang === "ta" ? "கடிதத் திகதியைத் தேர்ந்தெடுக்கவும்." : "Please select the letter date.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const currentUserName = profile?.full_name || "Daily Mail Officer";

      const payload = {
        letter_no: letterNo.trim(),
        letterNo: letterNo.trim(),
        letter_number: letterNo.trim(),
        serial_no: letterNo.trim(),
        refNo: letterNo.trim(),
        type: letterType,
        letterType: letterType,
        nature_of_letter: letterType,
        sender: sendBy.trim(),
        senderName: sendBy.trim(),
        sender_party: sendBy.trim(),
        received_date: letterDate,
        receivedDate: letterDate,
        letterDate: letterDate,
        submitted_date: letterDate,
        method: "Post",
        status: "registered",
        priority: "Normal",
        created_by_name: currentUserName
      };

      // 1. Save via Server Action to PostgreSQL
      const res = await saveDailyMailRecordServer(payload);

      if (res.success) {
        setSubmittedLetter({
          ...payload,
          id: res.data?.id || `letter-${Date.now()}`
        });

        // 2. Audit log
        await logAuditEvent(
          "REGISTER_NEW_LETTER",
          "daily_mail_letter_table",
          res.data?.id || letterNo,
          { letter_no: payload.letter_no, type: payload.type, sender: payload.sender, date: payload.letterDate }
        );

        setShowSuccessModal(true);
      } else {
        setErrorMessage(res.error || "Failed to register letter in database.");
      }
    } catch (err: any) {
      console.error("Error submitting letter:", err);
      setErrorMessage(err?.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSendBy("");
    setErrors({});
    setErrorMessage("");
    generateNextLetterNo(letterDate);
  };

  const handleAddAnother = () => {
    setShowSuccessModal(false);
    handleReset();
  };

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut();
    router.push("/");
  };

  if (!mounted) return null;

  return (
    <div className="dashboard-container" data-font-scale={fontScale} suppressHydrationWarning>
      {/* Skip Link (A11y) */}
      <a href="#dashboard-main-content" className="skip-link">
        {t("skipLink", "Skip to main content")}
      </a>

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
        role="dailymail"
      />

      <div className="dashboard-layout">
        <main id="dashboard-main-content" className="dashboard-content">
          
          {/* Top App Bar Header - Same standard DCMMS navbar */}
          <header className="dashboard-header">
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
                <h2 className="dashboard-main-title">{getRoleDisplayName(profile?.raw_role || profile?.role, t) || t("dailyMailReporter")}</h2>
                <p className="dashboard-main-subtitle">{t("registerLettersDesc")}</p>
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
                    aria-label={t("fontSmall")}
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
                    aria-label={t("fontMedium")}
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
                    aria-label={t("fontLarge")}
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

          {/* Standalone Register Page Wrapper (Same standard DCMMS form styling) */}
          <section className="register-page-wrapper">
            <div className="register-card">
              
              {/* Layout title area */}
              <div className="register-header-container">
                <div className="register-header-left">
                  <h1 className="register-title">{t("addNewLetterTitle", "Add New Letter")}</h1>
                  <p className="register-subtitle">
                    {t("addNewLetterSubtitle", "Fill in the basic incoming letter details to register it into the system.")}
                  </p>
                </div>
                
                <div className="register-header-right-btns">
                  <Link href="/daily-mail" className="btn-back-home">
                    <svg className="btn-back-home-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    {t("backToHome", "Back to Home")}
                  </Link>
                </div>
              </div>

              {errorMessage && (
                <div className="alert-banner error" style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#b91c1c", fontSize: "0.875rem", marginBottom: "16px" }}>
                  <AlertCircle size={18} style={{ display: "inline", marginRight: 8, verticalAlign: "middle" }} />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="register-grid-form">
                
                {/* Step Card: Basic Letter Information */}
                <div className="register-step-card">
                  <h2 className="register-step-title">
                    {lang === "si" ? "1. මූලික ලිපි තොරතුරු (Basic Letter Details)" : "1. Basic Letter Details"}
                  </h2>

                  <div className="register-step-grid">
                    
                    {/* 1. Letter No */}
                    <div className="form-field-group">
                      <label className="field-label" htmlFor="letterNo">
                        <span>{t("letterNoLabel", "Letter No")}</span>
                        <span style={{ color: "#ef4444" }}> *</span>
                      </label>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <input
                          id="letterNo"
                          type="text"
                          value={letterNo}
                          onChange={(e) => setLetterNo(e.target.value)}
                          placeholder={t("letterNoPlaceholder", "e.g. 2026/09/17/001")}
                          className={`field-input ${errors.letterNo ? "input-error" : ""}`}
                          style={{ flex: 1, fontFamily: "monospace", fontWeight: 600 }}
                        />
                        <button
                          type="button"
                          onClick={() => generateNextLetterNo(letterDate)}
                          disabled={isAutoGeneratingNo}
                          style={{
                            height: "42px",
                            padding: "0 14px",
                            backgroundColor: "#e2e8f0",
                            color: "#0f172a",
                            border: "none",
                            borderRadius: "6px",
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            cursor: "pointer",
                            whiteSpace: "nowrap"
                          }}
                          title="Auto-generate sequential letter number"
                        >
                          {isAutoGeneratingNo ? "…" : `⚡ ${t("autoGenerate", "Auto")}`}
                        </button>
                      </div>
                      {errors.letterNo && <span style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: 4 }}>{errors.letterNo}</span>}
                    </div>

                    {/* 2. Letter Type */}
                    <div className="form-field-group">
                      <label className="field-label" htmlFor="letterType">
                        <span>{t("letterTypeLabel", "Letter Type")}</span>
                        <span style={{ color: "#ef4444" }}> *</span>
                      </label>
                      <select
                        id="letterType"
                        value={letterType}
                        onChange={(e) => setLetterType(e.target.value)}
                        className={`field-select ${errors.letterType ? "input-error" : ""}`}
                      >
                        {letterTypes.map((lt) => {
                          const label = lang === "si" ? lt.labelSi : lang === "ta" ? lt.labelTa : lt.labelEn;
                          return (
                            <option key={lt.value} value={lt.value}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                      {errors.letterType && <span style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: 4 }}>{errors.letterType}</span>}
                    </div>

                    {/* 3. Letter Date */}
                    <div className="form-field-group">
                      <label className="field-label" htmlFor="letterDate">
                        <span>{t("letterDateLabel", "Letter Date")}</span>
                        <span style={{ color: "#ef4444" }}> *</span>
                      </label>
                      <input
                        id="letterDate"
                        type="date"
                        value={letterDate}
                        onChange={(e) => handleDateChange(e.target.value)}
                        className={`field-input ${errors.letterDate ? "input-error" : ""}`}
                      />
                      {errors.letterDate && <span style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: 4 }}>{errors.letterDate}</span>}
                    </div>

                    {/* 4. Send By (Full width) */}
                    <div className="form-field-group" style={{ gridColumn: "1 / -1" }}>
                      <label className="field-label" htmlFor="sendBy">
                        <span>{t("sendByLabel", "Send By")}</span>
                        <span style={{ color: "#ef4444" }}> *</span>
                      </label>
                      <input
                        id="sendBy"
                        type="text"
                        value={sendBy}
                        onChange={(e) => setSendBy(e.target.value)}
                        placeholder={t("sendByPlaceholder", "e.g. Western Provincial Dept / Principal / Citizen Name")}
                        className={`field-input ${errors.sendBy ? "input-error" : ""}`}
                      />
                      {errors.sendBy && <span style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: 4 }}>{errors.sendBy}</span>}
                    </div>

                  </div>
                </div>

                {/* Form Actions Bar */}
                <div className="register-form-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "16px" }}>
                  <button
                    type="button"
                    onClick={() => router.push("/daily-mail")}
                    className="btn-back-home"
                    style={{
                      padding: "10px 24px",
                      borderRadius: "6px",
                      backgroundColor: "#e2e8f0",
                      color: "#0f172a",
                      border: "none",
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    {t("cancel", "Cancel")}
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-submit-complaint"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "10px 28px",
                      borderRadius: "6px",
                      backgroundColor: "#0e162f",
                      color: "#ffffff",
                      border: "none",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>{lang === "si" ? "ලියාපදිංචි වෙමින් පවතී..." : "Submitting..."}</span>
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        <span>{t("submitLetterBtn", "Submit Letter")}</span>
                      </>
                    )}
                  </button>
                </div>

              </form>

            </div>
          </section>

        </main>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(14, 22, 47, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "16px" }}>
          <div style={{ background: "#ffffff", borderRadius: "12px", maxWidth: "480px", width: "100%", padding: "28px", textAlign: "center", boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)" }}>
            <div style={{ width: "60px", height: "60px", borderRadius: "50%", backgroundColor: "#dcfce7", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <CheckCircle2 size={40} />
            </div>

            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0e162f", margin: 0 }}>
              {t("letterSubmittedSuccess", "Letter registered successfully!")}
            </h3>
            
            <p style={{ fontSize: "0.875rem", color: "#64748b", margin: "6px 0 18px" }}>
              {lang === "si"
                ? `ලිපි අංකය ${submittedLetter?.letter_no} යටතේ සාර්ථකව පද්ධතියට එක් කරන ලදී.`
                : `Letter has been registered under Reference No: ${submittedLetter?.letter_no}`}
            </p>

            <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", textAlign: "left", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                <span style={{ color: "#64748b", fontWeight: 600 }}>{t("letterNoLabel", "Letter No")}:</span>
                <span style={{ color: "#0e162f", fontWeight: 700, fontFamily: "monospace" }}>{submittedLetter?.letter_no}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                <span style={{ color: "#64748b", fontWeight: 600 }}>{t("letterTypeLabel", "Letter Type")}:</span>
                <span style={{ color: "#0e162f", fontWeight: 700 }}>{submittedLetter?.type}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                <span style={{ color: "#64748b", fontWeight: 600 }}>{t("sendByLabel", "Send By")}:</span>
                <span style={{ color: "#0e162f", fontWeight: 700 }}>{submittedLetter?.sender}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                <span style={{ color: "#64748b", fontWeight: 600 }}>{t("letterDateLabel", "Letter Date")}:</span>
                <span style={{ color: "#0e162f", fontWeight: 700 }}>{submittedLetter?.letterDate}</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={handleAddAnother}
                style={{ flex: 1, padding: "10px 14px", borderRadius: "6px", backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1", color: "#0e162f", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}
              >
                + {t("addAnotherLetter", "Add Another Letter")}
              </button>

              <button
                type="button"
                onClick={() => router.push("/daily-mail")}
                style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "10px 14px", borderRadius: "6px", backgroundColor: "#0e162f", color: "#ffffff", border: "none", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}
              >
                <Check size={16} />
                <span>{t("goToDailyMailList", "View in Daily Mail List")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}
