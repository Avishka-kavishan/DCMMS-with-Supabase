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
  Check,
  UserCheck,
  Users,
  Shield,
  Briefcase,
  Building,
  User,
  ArrowRight
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { SiteFooter } from "@/components/SiteFooter";
import { signOut, getCurrentProfile, getRoleDisplayName, UserProfile, dashboardPath } from "@/lib/auth";
import { 
  saveDailyMailRecordServer, 
  getNextDailyMailLetterNoServer,
  getAllAssignableOfficersServer,
  createOfficerNotificationServer,
  AssignableOfficer
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
  const [registeringOffice, setRegisteringOffice] = useState<string>("senior_assistant_secretary");
  const [letterNo, setLetterNo] = useState("");
  const [letterType, setLetterType] = useState("Complaint");
  const [sendBy, setSendBy] = useState("");
  const [letterDate, setLetterDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Assign Secretary State
  const [assignableOfficers, setAssignableOfficers] = useState<AssignableOfficer[]>([]);
  const [isLoadingOfficers, setIsLoadingOfficers] = useState(false);

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
      labelTa: "மேன்முறையீடு" 
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

  // Auto-generate next Letter No based on today's registration date
  const generateNextLetterNo = async (targetDate?: string) => {
    setIsAutoGeneratingNo(true);
    try {
      const todayStr = targetDate || new Date().toISOString().split("T")[0];
      const res = await getNextDailyMailLetterNoServer(todayStr);
      if (res && res.success && res.nextLetterNo) {
        setLetterNo(res.nextLetterNo);
      } else {
        const d = new Date(todayStr || Date.now());
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const day = d.getDate();
        setLetterNo(`${y}/${m}/${day}/1`);
      }
    } catch (e) {
      console.warn("Auto-generate letter no failed:", e);
    } finally {
      setIsAutoGeneratingNo(false);
    }
  };

  // Load assignable Additional Secretaries on mount
  const loadAssignableOfficers = async () => {
    setIsLoadingOfficers(true);
    try {
      const res = await getAllAssignableOfficersServer();
      if (res && res.success && Array.isArray(res.data)) {
        setAssignableOfficers(res.data);
      }
    } catch (e) {
      console.warn("Error loading assignable officers:", e);
    } finally {
      setIsLoadingOfficers(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    getCurrentProfile().then((prof) => {
      if (prof) {
        if (prof.role === "additional_secretary") {
          router.replace("/daily-mail/register");
          return;
        }
        setProfile(prof);
        if (prof.role === "assistant_secretary_investigation") {
          setRegisteringOffice("assistant_secretary_investigation");
        } else if (prof.role === "assistant_secretary_discipline") {
          setRegisteringOffice("assistant_secretary_discipline");
        } else {
          setRegisteringOffice("senior_assistant_secretary");
        }
      }
    });
    generateNextLetterNo();
    loadAssignableOfficers();
  }, [router]);

  // Handle Letter Date change - purely updates the letter date, does NOT alter letterNo
  const handleDateChange = (newDate: string) => {
    setLetterDate(newDate);
  };

  const additionalSecretaryOfficer = assignableOfficers.find(
    (o) => (o.role || o.normalized_role || "").toLowerCase().includes("additional secretary")
  ) || (assignableOfficers.length > 0 ? assignableOfficers[0] : null);

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
      const currentUserName = profile?.full_name || "Secretary Officer";
      const addSecOfficer = additionalSecretaryOfficer || assignableOfficers.find((o) => (o.role || "").toLowerCase().includes("additional")) || assignableOfficers[0] || null;
      const addSecName = addSecOfficer?.full_name || "Nihal Ranasinghe";
      const finalActionName = addSecName;
      const finalActionRole = "Additional Secretary";

      const senderOfficerTitle = 
        registeringOffice === "senior_assistant_secretary"
          ? (lang === "si" ? "ජ්‍යෙෂ්ඨ සහකාර ලේකම්" : lang === "ta" ? "சிரேஷ்ட உதவிச் செயலாளர்" : "Senior Assistant Secretary")
          : registeringOffice === "assistant_secretary_discipline"
          ? (lang === "si" ? "සහකාර ලේකම් (විනය)" : lang === "ta" ? "உதவிச் செயலாளர் (ஒழுக்காற்று)" : "Assistant Secretary (Discipline)")
          : (lang === "si" ? "සහකාර ලේකම් (විමර්ශන)" : lang === "ta" ? "உதவிச் செயலாளர் (விசாரணை)" : "Assistant Secretary (Investigation)");

      const todayStr = new Date().toISOString().split("T")[0];
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
        received_date: todayStr,
        receivedDate: todayStr,
        date_received_by_add_secretary: todayStr,
        letterDate: letterDate,
        letter_date: letterDate,
        submitted_date: todayStr,
        action_officer: finalActionName,
        officer_name: finalActionName,
        subject_officer_name: finalActionName,
        assigned_role: finalActionRole,
        addressed_to: finalActionName,
        addressed_role: "additional_secretary",
        forwarded_to: finalActionName,
        forward_reason: `Forwarded by ${senderOfficerTitle} (${currentUserName}) to Additional Secretary`,
        is_forwarded: true,
        method: "Post",
        status: "assigned",
        priority: "Normal",
        created_by_name: currentUserName,
        created_by_role: registeringOffice
      };

      // 1. Save via Server Action to PostgreSQL
      const res = await saveDailyMailRecordServer(payload);

      if (res.success) {
        setSubmittedLetter({
          ...payload,
          id: res.data?.id || `letter-${Date.now()}`,
          assignedOfficerName: finalActionName,
          assignedOfficerRole: finalActionRole,
          addressedOfficerName: senderOfficerTitle,
          addressedOfficerRole: registeringOffice,
          isForwarded: true,
          forwardedToOfficerName: finalActionName,
        });

        // 2. Direct letter notification to Additional Secretary
        if (finalActionName) {
          try {
            await createOfficerNotificationServer({
              targetOfficerName: finalActionName,
              targetRole: finalActionRole,
              caseNo: letterNo.trim(),
              letterNo: letterNo.trim(),
              type: "secretary_letter_forwarded",
              title: lang === "si" ? "නව ලිපියක් යොමු කර ඇත" : lang === "ta" ? "புதிய கடிதம் அனுப்பப்பட்டது" : "New Letter Forwarded",
              message: lang === "si" 
                ? `${senderOfficerTitle} (${currentUserName}) විසින් ${letterNo.trim()} අංක දරන ලිපිය (${sendBy.trim()}) ඔබ වෙත යොමු කර ඇත.`
                : `Letter ${letterNo.trim()} (${letterType}) from ${sendBy.trim()} has been forwarded to you by ${senderOfficerTitle} (${currentUserName}).`,
              senderName: `${currentUserName} (${senderOfficerTitle})`
            });
          } catch (notifErr) {
            console.warn("Notification server dispatch error:", notifErr);
          }
        }

        // 3. Audit log
        await logAuditEvent(
          "REGISTER_NEW_LETTER",
          "daily_mail_letter_table",
          res.data?.id || letterNo,
          {
            letter_no: payload.letter_no,
            type: payload.type,
            sender: payload.sender,
            addressed_to: payload.addressed_to,
            assigned_to: finalActionName,
            is_forwarded: false,
            date: payload.letterDate
          }
        );

        // 4. Dispatch sync events
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("dcmms_data_updated"));
          window.dispatchEvent(new CustomEvent("dcmms_assignment_updated"));
          window.dispatchEvent(new CustomEvent("dcmms_notifications_updated"));
          window.dispatchEvent(new StorageEvent("storage", { key: "dcmms_notifications" }));
          window.dispatchEvent(new StorageEvent("storage", { key: "dcmms_daily_mail" }));
        }

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
        role={profile?.role || "admin"}
      />

      <div className="dashboard-layout">
        <main id="dashboard-main-content" className="dashboard-content">
          
          {/* Top App Bar Header - Standard DCMMS navbar */}
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
                <h2 className="dashboard-main-title">{getRoleDisplayName(profile?.raw_role || profile?.role, t) || (lang === "si" ? "ලේකම් කාර්යාලය" : "Secretariat")}</h2>
                <p className="dashboard-main-subtitle">
                  {lang === "si"
                    ? "අලුතින් ලැබුණු ලිපි ලියාපදිංචි කර අතිරේක ලේකම් වෙත යොමු කරන්න"
                    : lang === "ta"
                    ? "புதிதாகப் பெறப்பட்ட கடிதங்களைப் பதிவு செய்து கூடுதல் செயலாளருக்கு அனுப்பவும்"
                    : "Register newly received letters and forward directly to Additional Secretary"}
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

          {/* Standalone Register Page Wrapper */}
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
                  <Link href={dashboardPath(profile?.role || "admin")} className="btn-back-home">
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
                    
                    {/* 0. Registering & Forwarding Officer (Assistant / Senior Assistant Secretary) */}
                    <div className="form-field-group" style={{ gridColumn: "1 / -1", marginBottom: "4px" }}>
                      <label className="field-label" htmlFor="registeringOffice" style={{ marginBottom: "6px" }}>
                        <span style={{ fontWeight: 700, color: "#0e162f", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <Building size={16} style={{ color: "#2563eb" }} />
                          {lang === "si" ? "ලිපිය ලියාපදිංචි කර යොමු කරන නිලධාරී / අංශය" : lang === "ta" ? "பதிவு செய்து அனுப்பும் அதிகாரி / பிரிவு" : "Registering & Forwarding Officer / Office"}
                        </span>
                        <span style={{ color: "#ef4444" }}> *</span>
                      </label>
                      <select
                        id="registeringOffice"
                        value={registeringOffice}
                        onChange={(e) => setRegisteringOffice(e.target.value)}
                        className="field-select"
                        style={{
                          fontWeight: 600,
                          color: "#0f172a",
                          backgroundColor: "#f8fafc",
                          border: "1.5px solid #94a3b8",
                          padding: "10px 14px",
                          borderRadius: "8px"
                        }}
                      >
                        <option value="senior_assistant_secretary">
                          {lang === "si" ? "ජ්‍යෙෂ්ඨ සහකාර ලේකම් (Senior Assistant Secretary)" : lang === "ta" ? "சிரேஷ்ட உதவிச் செயலாளர் (Senior Assistant Secretary)" : "Senior Assistant Secretary"}
                        </option>
                        <option value="assistant_secretary_discipline">
                          {lang === "si" ? "සහකාර ලේකම් - විනය ශාඛාව (Assistant Secretary - Discipline Branch)" : lang === "ta" ? "உதவிச் செயலாளர் - ஒழுக்காற்றுப் பிரிவு (Assistant Secretary - Discipline Branch)" : "Assistant Secretary - Discipline Branch"}
                        </option>
                        <option value="assistant_secretary_investigation">
                          {lang === "si" ? "සහකාර ලේකම් - විමර්ශන ශාඛාව (Assistant Secretary - Investigation Branch)" : lang === "ta" ? "உதவிச் செயலாளர் - விசாரணைப் பிரிவு (Assistant Secretary - Investigation Branch)" : "Assistant Secretary - Investigation Branch"}
                        </option>
                        <option value="chief_clerk">
                          {lang === "si" ? "ශාඛා ප්‍රධානී (Chief Clerk)" : lang === "ta" ? "முதன்மை எழுதுநர் (Chief Clerk)" : "Chief Clerk"}
                        </option>
                      </select>
                      <span style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 4, display: "block" }}>
                        {lang === "si" 
                          ? `වත්මන් පිවිසුම: ${profile?.full_name || "නිලධාරී"} (${getRoleDisplayName(profile?.raw_role || profile?.role, t)}) • ලිපිය සෘජුවම අතිරේක ලේකම් වෙත යොමු වේ.`
                          : `Active Officer: ${profile?.full_name || "Officer"} (${getRoleDisplayName(profile?.raw_role || profile?.role, t)}) • Registered letter will be directly forwarded to Additional Secretary.`}
                      </span>
                    </div>

                    {/* 1. Letter No */}
                    <div className="form-field-group">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <label className="field-label" htmlFor="letterNo" style={{ margin: 0 }}>
                          <span>{t("letterNoLabel", "Letter No")}</span>
                          <span style={{ color: "#ef4444" }}> *</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => generateNextLetterNo()}
                          disabled={isAutoGeneratingNo}
                          title={lang === "si" ? "නව ලිපි අංකය නැවත ලබාගන්න" : "Generate Next Letter No"}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: isAutoGeneratingNo ? "not-allowed" : "pointer",
                            padding: "2px 6px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "0.75rem",
                            color: "#0284c7",
                            fontWeight: 600,
                          }}
                        >
                          <RefreshCw size={12} className={isAutoGeneratingNo ? "animate-spin" : ""} />
                          <span>{lang === "si" ? "ස්වයංක්‍රීය අංකය" : lang === "ta" ? "தானியங்கு எண்" : "Auto No"}</span>
                        </button>
                      </div>
                      <input
                          id="letterNo"
                          type="text"
                          value={letterNo}
                          onChange={(e) => setLetterNo(e.target.value)}
                          placeholder={t("letterNoPlaceholder", "e.g. 2026/09/17/001")}
                          className={`field-input ${errors.letterNo ? "input-error" : ""}`}
                          style={{ fontFamily: "monospace", fontWeight: 600 }}
                        />
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

                    {/* 5. Destination Officer: Additional Secretary Only (No dropdown selection) */}
                    <div className="form-field-group" style={{ gridColumn: "1 / -1", marginTop: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                        <label className="field-label" style={{ margin: 0 }}>
                          <span style={{ fontWeight: 700, color: "#0e162f", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <UserCheck size={18} style={{ color: "#0d9488" }} />
                            {lang === "si" ? "ලිපිය යොමු වන නිලධාරී (අතිරේක ලේකම්)" : lang === "ta" ? "கடிதம் அனுப்பப்படும் அதிகாரி (கூடுதல் செயலாளர்)" : "Letter Recipient (Additional Secretary)"}
                          </span>
                        </label>

                        <span style={{
                          padding: "4px 12px",
                          borderRadius: "20px",
                          backgroundColor: "#ccfbf1",
                          color: "#0f766e",
                          fontWeight: 700,
                          fontSize: "0.75rem",
                          border: "1px solid #99f6e4"
                        }}>
                          🏛️ {lang === "si" ? "අතිරේක ලේකම් වෙත පමණි" : lang === "ta" ? "கூடுதல் செயலாளருக்கு மட்டுமே" : "To Additional Secretary Only"}
                        </span>
                      </div>

                      {/* Fixed Recipient Display Card */}
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "16px 20px",
                        backgroundColor: "#f0fdfa",
                        border: "1.5px solid #99f6e4",
                        borderRadius: "10px",
                        gap: "16px",
                        flexWrap: "wrap",
                        boxShadow: "0 1px 3px rgba(13, 148, 136, 0.08)"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                          <div style={{
                            width: "44px",
                            height: "44px",
                            borderRadius: "10px",
                            backgroundColor: "#ccfbf1",
                            color: "#0f766e",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "1.4rem",
                            border: "1px solid #99f6e4",
                            flexShrink: 0
                          }}>
                            🏛️
                          </div>
                          <div>
                            <div style={{ fontSize: "1rem", fontWeight: 800, color: "#0f766e" }}>
                              {additionalSecretaryOfficer?.full_name || "Nihal Ranasinghe"}
                              {additionalSecretaryOfficer?.employee_no ? ` (${additionalSecretaryOfficer.employee_no})` : ""}
                            </div>
                            <div style={{ fontSize: "0.85rem", color: "#115e59", fontWeight: 600 }}>
                              {lang === "si" ? "අතිරේක ලේකම් (Additional Secretary)" : lang === "ta" ? "கூடுதல் செயலாளர் (Additional Secretary)" : "Additional Secretary"}
                            </div>
                          </div>
                        </div>

                        <div style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          color: "#047857",
                          backgroundColor: "#d1fae5",
                          padding: "8px 16px",
                          borderRadius: "20px",
                          border: "1px solid #a7f3d0"
                        }}>
                          <span>✓ {lang === "si" ? "ලිපිය ඉදිරිපත් කළ විට සෘජුවම අතිරේක ලේකම් වෙත යොමු වේ" : lang === "ta" ? "சமர்ப்பித்தவுடன் நேரடியாக கூடுதல் செயலாளருக்கு அனுப்பப்படும்" : "Submitting will send letter directly to Additional Secretary"}</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Form Actions Bar */}
                <div className="register-form-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "16px" }}>
                  <button
                    type="button"
                    onClick={() => router.push(dashboardPath(profile?.role || "admin"))}
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
          <div style={{ background: "#ffffff", borderRadius: "12px", maxWidth: "500px", width: "100%", padding: "28px", textAlign: "center", boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)" }}>
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
              {submittedLetter?.isForwarded ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", paddingTop: "6px", borderTop: "1px dashed #cbd5e1" }}>
                    <span style={{ color: "#64748b", fontWeight: 600 }}>✉️ {t("addressedTo", "Addressed To")}:</span>
                    <span style={{ color: "#0f172a", fontWeight: 700 }}>
                      {submittedLetter?.addressedOfficerName} ({submittedLetter?.addressedOfficerRole})
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", padding: "8px 10px", borderRadius: "6px" }}>
                    <span style={{ color: "#166534", fontWeight: 700 }}>🏛️ {t("forwardedTo", "Forwarded To")}:</span>
                    <span style={{ color: "#14532d", fontWeight: 800 }}>
                      {submittedLetter?.forwardedToOfficerName || "Additional Secretary"}
                    </span>
                  </div>
                </>
              ) : submittedLetter?.assignedOfficerName ? (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", paddingTop: "6px", borderTop: "1px dashed #cbd5e1" }}>
                  <span style={{ color: "#0369a1", fontWeight: 700 }}>{t("assignedOfficer", "Assigned Officer")}:</span>
                  <span style={{ color: "#0369a1", fontWeight: 800 }}>
                    {submittedLetter?.assignedOfficerName} ({submittedLetter?.assignedOfficerRole || "Officer"})
                  </span>
                </div>
              ) : null}
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
                onClick={() => router.push(dashboardPath(profile?.role || "admin"))}
                style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "10px 14px", borderRadius: "6px", backgroundColor: "#0e162f", color: "#ffffff", border: "none", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}
              >
                <Check size={16} />
                <span>{t("goToAdminDashboard", "Return to Dashboard")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}
