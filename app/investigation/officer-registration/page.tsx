"use client";

import "../../../i18n";
import "../../daily-mail/daily-mail.css";
import "../../dashboard-common.css";
import "../../subject/subject.css";
import "../../subject/add-details/add-details.css";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sidebar } from "@/components/Sidebar";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase, isSupabaseConfigured, logAuditEvent } from "@/lib/supabase";
import { getCurrentProfile, signOut, dashboardPath } from "@/lib/auth";
import { 
  upsertInvestigationOfficerServer, 
  logAuditEventServer, 
  saveRegisterOfficerServer,
  saveCommitteeOfficerAndSchoolsServer,
  getCommitteeOfficersWithSchoolsServer,
  getSchoolSuggestionsServer 
} from "@/lib/db-actions";
import { 
  UserPlus, ArrowLeft, Check, X, GraduationCap, ShieldCheck, User, 
  CreditCard, Mail, Building, Award, RefreshCw 
} from "lucide-react";

export default function InvestigationOfficerRegistrationPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const lang = i18n.language;

  // Accessibility & Layout States
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");

  // Form State
  const [formName, setFormName] = useState("");
  const [formNic, setFormNic] = useState("");
  const [formOfficerRole, setFormOfficerRole] = useState<"Chairman" | "Member">("Member");
  const [formStudiedSchools, setFormStudiedSchools] = useState<string[]>([]);
  const [newStudiedInput, setNewStudiedInput] = useState("");
  const [formChildrenSchools, setFormChildrenSchools] = useState<string[]>([]);
  const [newChildrenInput, setNewChildrenInput] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formStatus, setFormStatus] = useState<"Active" | "Inactive">("Active");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [schoolSuggestions, setSchoolSuggestions] = useState<string[]>([]);

  // Fetch school suggestions from school_table, accused_school_table, institute_table
  useEffect(() => {
    getSchoolSuggestionsServer().then((res) => {
      if (res && res.success && Array.isArray(res.data)) {
        setSchoolSuggestions(res.data);
      }
    });
  }, []);


  // Sync document language and title
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${lang === "si" ? "පරීක්ෂණ නිලධාරී ලියාපදිංචිය" : "Investigation Officer Registration"} | DCMMS`;
  }, [lang]);

  // Formatted date badge
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

  const changeLanguage = (newLang: string) => {
    i18n.changeLanguage(newLang);
  };

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut();
    router.push("/login");
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Tag Handlers — Studied Schools
  const handleAddStudiedSchool = () => {
    const trimmed = newStudiedInput.trim();
    if (trimmed && !formStudiedSchools.includes(trimmed)) {
      setFormStudiedSchools((prev) => [...prev, trimmed]);
      setNewStudiedInput("");
    }
  };

  const handleRemoveStudiedSchool = (index: number) => {
    setFormStudiedSchools((prev) => prev.filter((_, i) => i !== index));
  };

  // Tag Handlers — Children's Schools
  const handleAddChildrenSchool = () => {
    const trimmed = newChildrenInput.trim();
    if (trimmed && !formChildrenSchools.includes(trimmed)) {
      setFormChildrenSchools((prev) => [...prev, trimmed]);
      setNewChildrenInput("");
    }
  };

  const handleRemoveChildrenSchool = (index: number) => {
    setFormChildrenSchools((prev) => prev.filter((_, i) => i !== index));
  };

  // Form Validation
  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!formName.trim()) {
      errs.name = lang === "si" ? "නිලධාරියාගේ නම ඇතුළත් කිරීම අනිවාර්ය වේ" : "Officer Name is required";
    }
    if (!formNic.trim()) {
      errs.nic = lang === "si" ? "ජාතික හැඳුනුම්පත් අංකය ඇතුළත් කිරීම අනිවාර්ය වේ" : "NIC Number is required";
    }
    if (!formEmail.trim()) {
      errs.email = lang === "si" ? "විද්‍යුත් තැපැල් ලිපිනය ඇතුළත් කිරීම අනිවාර්ය වේ" : "Email address is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    const now = new Date().toISOString().slice(0, 10);
    const newOfficer = {
      id: `off-${Date.now()}`,
      fullName: formName.trim(),
      nicNo: formNic.trim(),
      officerRole: formOfficerRole,
      studiedSchools: formStudiedSchools,
      childrenSchools: formChildrenSchools,
      email: formEmail.trim(),
      role: "investigation_officer",
      status: formStatus,
      createdAt: now,
    };

    // 1. Save to LocalStorage
    if (typeof window !== "undefined") {
      ["dcmms_investigation_officers", "dcmms_custom_profiles"].forEach((key) => {
        try {
          const stored = localStorage.getItem(key) || "[]";
          let list = JSON.parse(stored);
          if (!Array.isArray(list)) list = [];
          list = list.filter((o: any) => o.id !== newOfficer.id && (o.fullName || o.full_name) !== newOfficer.fullName);
          list.push(newOfficer);
          localStorage.setItem(key, JSON.stringify(list));
        } catch (err) {
          console.error("LocalStorage save error:", err);
        }
      });
    }

    // 2. Save to Supabase (if configured)
    if (isSupabaseConfigured) {
      try {
        const invPayload = {
          id: newOfficer.id,
          full_name: newOfficer.fullName,
          nic_no: newOfficer.nicNo,
          officer_role: newOfficer.officerRole,
          studied_schools: newOfficer.studiedSchools,
          children_schools: newOfficer.childrenSchools,
          email: newOfficer.email,
          status: newOfficer.status,
        };
        await supabase.from("dcmms_investigation_officers").upsert(invPayload);

        // Sync to commitee_table & school_table in Supabase
        await supabase.from("commitee_table").upsert({
          employee_no: newOfficer.nicNo || `EMP-${Date.now().toString().slice(-6)}`,
          full_name: newOfficer.fullName,
          email: newOfficer.email,
          position: newOfficer.officerRole,
          nic_no: newOfficer.nicNo,
          state: newOfficer.status,
        }).catch(() => {});

        await supabase.from("school_table").upsert({
          employee_no: newOfficer.nicNo || `EMP-${Date.now().toString().slice(-6)}`,
          member_school_name: newOfficer.studiedSchools.join(", "),
          member_children_schools_name: newOfficer.childrenSchools.join(", "),
        }).catch(() => {});

        // Sync schools to dcmms_schools table
        const allSchools = Array.from(new Set([...(newOfficer.studiedSchools || []), ...(newOfficer.childrenSchools || [])]));
        for (const schoolName of allSchools) {
          if (schoolName.trim()) {
            const schNo = `SCH-${schoolName.trim().toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
            await supabase.from("dcmms_schools").upsert(
              {
                school_no: schNo,
                school_name: schoolName.trim()
              },
              { onConflict: "school_no" }
            );
          }
        }

        // Audit log entry
        await logAuditEvent(
          "REGISTER_OFFICER",
          "dcmms_investigation_officers",
          newOfficer.id,
          { fullName: newOfficer.fullName, role: newOfficer.officerRole, nicNo: newOfficer.nicNo }
        );
      } catch (err) {
        console.warn("Supabase save warning:", err);
      }
    }

    // Always dual-persist to local PostgreSQL commitee_table & school_table via Prisma Server Action
    saveCommitteeOfficerAndSchoolsServer({
      employee_no: newOfficer.nicNo || `EMP-${Date.now().toString().slice(-6)}`,
      full_name: newOfficer.fullName,
      email: newOfficer.email,
      position: newOfficer.officerRole,
      nic_no: newOfficer.nicNo,
      state: newOfficer.status,
      studied_schools: newOfficer.studiedSchools,
      children_schools: newOfficer.childrenSchools,
    }).catch((e) => console.error("PostgreSQL saveCommitteeOfficerAndSchoolsServer error:", e));

    saveRegisterOfficerServer({
      employee_no: newOfficer.nicNo || `EMP-${Date.now().toString().slice(-6)}`,
      full_name: newOfficer.fullName,
      email: newOfficer.email,
      role: "Investigation officer",
      is_active: newOfficer.status === "Active",
    }).catch((e) => console.error("PostgreSQL saveRegisterOfficerServer error:", e));

    upsertInvestigationOfficerServer({
      officer_name: newOfficer.fullName,
      nic: newOfficer.nicNo,
      designation: newOfficer.officerRole,
      school_attended: newOfficer.studiedSchools.join(", "),
      children_school: newOfficer.childrenSchools.join(", "),
    }).catch((e) => console.error("PostgreSQL upsertInvestigationOfficer error:", e));

    logAuditEventServer(
      "REGISTER_OFFICER",
      "commitee_table",
      newOfficer.id,
      { fullName: newOfficer.fullName, role: newOfficer.officerRole, nicNo: newOfficer.nicNo }
    ).catch((e) => console.error("PostgreSQL audit error:", e));

    setIsSaving(false);
    showToast(lang === "si" ? "පරීක්ෂණ නිලධාරියා commitee_table සහ school_table වෙත සාර්ථකව සම්බන්ධ කර ලියාපදිංචි කරන ලදී!" : "Investigation Officer Registered & Linked to commitee_table and school_table Successfully!");
    if (typeof window !== "undefined") window.dispatchEvent(new Event("dcmms_data_updated"));


    setTimeout(() => {
      router.push("/investigation");
    }, 1200);
  };

  return (
    <div className="dashboard-container" data-font-scale={fontScale}>
      {/* Skip Link (A11y) */}
      <a href="#dashboard-main-content" className="skip-link">
        {t("skipLink", "Skip to main content")}
      </a>

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
        role="investigation"
      />

      <div className="dashboard-layout">
        <main id="dashboard-main-content" className="dashboard-content">
          
          {/* ── Top App Bar Header (Matches Subject Officer Header) ── */}
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
                <h2 className="dashboard-main-title">
                  {lang === "si" ? "විමර්ශන නිලධාරී" : "Investigation Officer"}
                </h2>
                <p className="dashboard-main-subtitle">
                  {lang === "si" ? "විමර්ශන නිලධාරීන් ලියාපදිංචි කිරීම සහ කළමනාකරණය" : "Investigation Officer Registration & Profile Management"}
                </p>
              </div>
            </div>

            <div className="dashboard-header-right">
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
                    aria-label="Font Small"
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
                    aria-label="Font Medium"
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
                    aria-label="Font Large"
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
                    aria-label="Switch language to Sinhala"
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
                    aria-label="Switch language to Tamil"
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
                    aria-label="Switch language to English"
                    className="sr-only"
                  />
                  English
                </label>
              </div>
            </div>
          </header>

          {/* ── Main Form Card Section (Matches Subject Officer Form Wrapper) ── */}
          <section className="add-details-page-wrapper">
            <div className="add-details-main-card">
              
              {/* Form Title & Back Navigation Header */}
              <div className="add-details-header-container">
                <div className="add-details-header-left">
                  <h1 className="add-details-title">
                    {lang === "si" ? "පරීක්ෂණ නිලධාරී ලියාපදිංචි කිරීමේ පෝරමය" : "Investigation Officer Registration Form"}
                  </h1>
                  <p className="add-details-subtitle">
                    {lang === "si" 
                      ? "නිලධාරියාගේ නම, ජාතික හැඳුනුම්පත, ඉගෙනුම ලැබූ පාසල්, දරුවන්ගේ පාසල් සහ තනතුර (සභාපති/සාමාජික) ඇතුළත් කරන්න"
                      : "Enter Officer Name, NIC No, Studied Schools, Children's Schools, and Role (Chairman / Member)"
                    }
                  </p>
                </div>
                <div className="add-details-header-right-btns">
                  <Link href="/investigation" className="btn-back-home">
                    <svg
                      className="btn-back-home-icon"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    {lang === "si" ? "නැවත ප්‍රධාන පුවරුවට" : "Back to Dashboard"}
                  </Link>
                </div>
              </div>

              {/* Live Profile Card Banner */}
              <div style={{ display: "flex", alignItems: "center", gap: "14px", backgroundColor: "#ffffff", padding: "14px 20px", borderRadius: "12px", border: "1px solid #cbd5e1", margin: "16px 24px 0 24px", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: formOfficerRole === "Chairman" ? "#d97706" : "#4f46e5", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "16px", flexShrink: 0, boxShadow: "0 2px 4px rgba(0,0,0,0.15)" }}>
                  {formName ? formName.trim().split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "?"}
                </div>
                <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "16px", marginRight: "10px" }}>
                      {formName || (lang === "si" ? "නව නිලධාරියාගේ නම" : "New Officer Name")}
                    </span>
                    <span style={{ fontSize: "11px", backgroundColor: formOfficerRole === "Chairman" ? "#fef3c7" : "#e0e7ff", color: formOfficerRole === "Chairman" ? "#92400e" : "#3730a3", padding: "3px 10px", borderRadius: "12px", fontWeight: 700 }}>
                      {formOfficerRole}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "16px", fontSize: "13px", color: "#64748b" }}>
                    <span>NIC: <strong style={{ color: "#1e293b" }}>{formNic || "N/A"}</strong></span>
                    <span>•</span>
                    <span>Status: <strong style={{ color: formStatus === "Active" ? "#16a34a" : "#dc2626" }}>{formStatus}</strong></span>
                  </div>
                </div>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
                
                {/* 2-Column Side-by-Side Main Form Layout */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "24px", alignItems: "start" }}>

                  {/* LEFT COLUMN: Basic Credentials */}
                  <div style={{ backgroundColor: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.5px", margin: 0, display: "flex", alignItems: "center", gap: "6px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                      <User size={18} />
                      <span>1. Basic Credentials &amp; Role</span>
                    </h3>

                    {/* Officer Name */}
                    <div className="form-field-group">
                      <label htmlFor="fullName" style={{ display: "block", fontWeight: 600, color: "#334155", fontSize: "13px", marginBottom: "4px" }}>
                        {lang === "si" ? "නිලධාරියාගේ නම" : "Officer Name"} <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input
                        id="fullName"
                        type="text"
                        placeholder="e.g. Ranjith Bandara"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        style={{ padding: "10px 12px", borderRadius: "8px", border: `1px solid ${errors.name ? "#ef4444" : "#cbd5e1"}`, width: "100%", fontSize: "14px", backgroundColor: "#ffffff" }}
                      />
                      {errors.name && <span style={{ fontSize: "11px", color: "#ef4444", marginTop: "3px", display: "block" }}>{errors.name}</span>}
                    </div>

                    {/* NIC No & Role - 2 columns */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div className="form-field-group">
                        <label htmlFor="nicNo" style={{ display: "block", fontWeight: 600, color: "#334155", fontSize: "13px", marginBottom: "4px" }}>
                          {lang === "si" ? "ජාතික හැඳුනුම්පත් අංකය" : "NIC No"} <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                          id="nicNo"
                          type="text"
                          placeholder="e.g. 198512345678"
                          value={formNic}
                          onChange={(e) => setFormNic(e.target.value)}
                          style={{ padding: "10px 12px", borderRadius: "8px", border: `1px solid ${errors.nic ? "#ef4444" : "#cbd5e1"}`, width: "100%", fontSize: "14px", backgroundColor: "#ffffff" }}
                        />
                        {errors.nic && <span style={{ fontSize: "11px", color: "#ef4444", marginTop: "3px", display: "block" }}>{errors.nic}</span>}
                      </div>

                      <div className="form-field-group">
                        <label htmlFor="officerRoleSelect" style={{ display: "block", fontWeight: 600, color: "#334155", fontSize: "13px", marginBottom: "4px" }}>
                          {lang === "si" ? "තනතුර / වගකීම" : "Role / Position"} <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <select
                          id="officerRoleSelect"
                          value={formOfficerRole}
                          onChange={(e) => setFormOfficerRole(e.target.value as "Chairman" | "Member")}
                          style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", width: "100%", backgroundColor: "#ffffff", fontSize: "14px", fontWeight: 600 }}
                        >
                          <option value="Chairman">Chairman (සභාපති)</option>
                          <option value="Member">Member (සාමාජික)</option>
                        </select>
                      </div>
                    </div>

                    {/* Email & Status - 2 columns */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div className="form-field-group">
                        <label htmlFor="email" style={{ display: "block", fontWeight: 600, color: "#334155", fontSize: "13px", marginBottom: "4px" }}>
                          {lang === "si" ? "විද්‍යුත් තැපෑල" : "Email Address"} <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                          id="email"
                          type="email"
                          placeholder="ranjith@moe.gov.lk"
                          value={formEmail}
                          onChange={(e) => setFormEmail(e.target.value)}
                          style={{ padding: "10px 12px", borderRadius: "8px", border: `1px solid ${errors.email ? "#ef4444" : "#cbd5e1"}`, width: "100%", fontSize: "14px", backgroundColor: "#ffffff" }}
                        />
                        {errors.email && <span style={{ fontSize: "11px", color: "#ef4444", marginTop: "3px", display: "block" }}>{errors.email}</span>}
                      </div>

                      <div className="form-field-group">
                        <label htmlFor="status" style={{ display: "block", fontWeight: 600, color: "#334155", fontSize: "13px", marginBottom: "4px" }}>
                          {lang === "si" ? "ගිණුමේ තත්ත්වය" : "Account Status"}
                        </label>
                        <select
                          id="status"
                          value={formStatus}
                          onChange={(e) => setFormStatus(e.target.value as "Active" | "Inactive")}
                          style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", width: "100%", backgroundColor: "#ffffff", fontSize: "14px" }}
                        >
                          <option value="Active">Active (සක්‍රිය)</option>
                          <option value="Inactive">Inactive (අක්‍රිය)</option>
                        </select>
                      </div>
                    </div>

                  </div>

                  {/* RIGHT COLUMN: School Background */}
                  <div style={{ backgroundColor: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#0284c7", textTransform: "uppercase", letterSpacing: "0.5px", margin: 0, display: "flex", alignItems: "center", gap: "6px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                      <GraduationCap size={18} />
                      <span>2. Educational Background (School History)</span>
                    </h3>

                    {/* Studied Schools */}
                    <div className="form-field-group">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <label style={{ fontWeight: 600, color: "#334155", fontSize: "13px", margin: 0 }}>
                          {lang === "si" ? "ඉගෙනගත් පාසල් (බොහෝ පාසල් ඇතුළත් කළ හැක)" : "Studied Schools (Can add many schools)"}
                        </label>
                        <span style={{ fontSize: "11px", color: "#0284c7", fontWeight: 700, backgroundColor: "#e0f2fe", padding: "2px 8px", borderRadius: "10px" }}>
                          {formStudiedSchools.length} {lang === "si" ? "ඇතුළත් කර ඇත" : "added"}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input
                          type="text"
                          list="school-suggestions-list"
                          placeholder={lang === "si" ? "පාසලේ නම ඇතුළත් කර Enter ඔබන්න..." : "Type school name & press Enter..."}
                          value={newStudiedInput}
                          onChange={(e) => setNewStudiedInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddStudiedSchool();
                            }
                          }}
                          style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", flex: 1, fontSize: "13px", backgroundColor: "#ffffff" }}
                        />
                        <button
                          type="button"
                          onClick={handleAddStudiedSchool}
                          style={{ padding: "9px 16px", borderRadius: "8px", backgroundColor: "#0284c7", color: "#ffffff", border: "none", fontWeight: 600, cursor: "pointer", fontSize: "13px" }}
                        >
                          + Add
                        </button>
                      </div>
                      {formStudiedSchools.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", backgroundColor: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", marginTop: "8px" }}>
                          {formStudiedSchools.map((s, idx) => (
                            <span key={idx} style={{ display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "#e0f2fe", color: "#0369a1", padding: "4px 10px", borderRadius: "16px", fontSize: "12px", fontWeight: 600 }}>
                              {s}
                              <button type="button" onClick={() => handleRemoveStudiedSchool(idx)} style={{ background: "none", border: "none", color: "#0369a1", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}>
                                <X size={13} />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#94a3b8", display: "block", marginTop: "4px", fontStyle: "italic" }}>
                          {lang === "si" ? "තවමත් පාසල් ඇතුළත් කර නොමැත." : "No schools added yet."}
                        </span>
                      )}
                    </div>

                    {/* Children's Schools */}
                    <div className="form-field-group">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <label style={{ fontWeight: 600, color: "#334155", fontSize: "13px", margin: 0 }}>
                          {lang === "si" ? "දරුවන් ඉගෙනුම ලබන පාසල් (බොහෝ පාසල් ඇතුළත් කළ හැක)" : "Children's Schools (Can add many schools)"}
                        </label>
                        <span style={{ fontSize: "11px", color: "#d97706", fontWeight: 700, backgroundColor: "#fef3c7", padding: "2px 8px", borderRadius: "10px" }}>
                          {formChildrenSchools.length} {lang === "si" ? "ඇතුළත් කර ඇත" : "added"}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input
                          type="text"
                          list="school-suggestions-list"
                          placeholder={lang === "si" ? "පාසලේ නම ඇතුළත් කර Enter ඔබන්න..." : "Type school name & press Enter..."}
                          value={newChildrenInput}
                          onChange={(e) => setNewChildrenInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddChildrenSchool();
                            }
                          }}
                          style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", flex: 1, fontSize: "13px", backgroundColor: "#ffffff" }}
                        />
                        <button
                          type="button"
                          onClick={handleAddChildrenSchool}
                          style={{ padding: "9px 16px", borderRadius: "8px", backgroundColor: "#d97706", color: "#ffffff", border: "none", fontWeight: 600, cursor: "pointer", fontSize: "13px" }}
                        >
                          + Add
                        </button>
                      </div>

                      {/* Datalist for school suggestions from school_table & institute_table */}
                      <datalist id="school-suggestions-list">
                        {schoolSuggestions.map((schoolName, idx) => (
                          <option key={idx} value={schoolName} />
                        ))}
                      </datalist>

                      {formChildrenSchools.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", backgroundColor: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", marginTop: "8px" }}>
                          {formChildrenSchools.map((s, idx) => (
                            <span key={idx} style={{ display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "#fef3c7", color: "#b45309", padding: "4px 10px", borderRadius: "16px", fontSize: "12px", fontWeight: 600 }}>
                              {s}
                              <button type="button" onClick={() => handleRemoveChildrenSchool(idx)} style={{ background: "none", border: "none", color: "#b45309", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}>
                                <X size={13} />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#94a3b8", display: "block", marginTop: "4px", fontStyle: "italic" }}>
                          {lang === "si" ? "තවමත් පාසල් ඇතුළත් කර නොමැත." : "No schools added yet."}
                        </span>
                      )}
                    </div>

                  </div>

                </div>

                {/* Bottom Form Action Buttons */}
                <div style={{ marginTop: "28px", paddingTop: "18px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: "14px" }}>
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => router.back()}
                    style={{ padding: "10px 24px", borderRadius: "8px", backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1", color: "#475569", fontWeight: 600, fontSize: "14px", cursor: "pointer" }}
                  >
                    {lang === "si" ? "අවලංගු කරන්න" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="btn-save"
                    style={{ padding: "10px 30px", borderRadius: "8px", backgroundColor: "#4f46e5", color: "#ffffff", border: "none", fontWeight: 600, fontSize: "14px", cursor: "pointer", boxShadow: "0 4px 6px -1px rgba(79,70,229,0.25)" }}
                  >
                    {isSaving ? (lang === "si" ? "සුරකිමින්..." : "Saving Officer...") : (lang === "si" ? "ලියාපදිංචි කරන්න" : "Save Investigation Officer")}
                  </button>
                </div>

              </form>

            </div>
          </section>

          <SiteFooter />
        </main>
      </div>

      {/* Success Toast */}
      {toastMessage && (
        <div style={{ position: "fixed", bottom: "24px", right: "24px", backgroundColor: "#0f172a", color: "#ffffff", padding: "12px 20px", borderRadius: "10px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: 600, zIndex: 9999 }}>
          <div style={{ width: "22px", height: "22px", borderRadius: "50%", backgroundColor: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Check size={14} color="#fff" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
