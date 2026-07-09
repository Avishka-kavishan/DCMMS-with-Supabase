"use client";

import "../../../i18n";
import "../daily-mail.css";
import "./register.css";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sidebar } from "@/components/Sidebar";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getCurrentProfile } from "@/lib/auth";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function RegisterComplaintForm() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Accessibility & language state
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");
  const lang = i18n.language;

  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubsequentMode, setIsSubsequentMode] = useState(false);

  const [officerOptions, setOfficerOptions] = useState<string[]>([
    "Kamal Perera",
    "Suresh Silva",
    "Aruni Rajapaksha",
  ]);

  // Mobile sidebar visibility state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Form State
  const [formState, setFormState] = useState({
    id: "",
    letterNo: "",
    senderName: "",
    letterType: "",
    officerName: "",
    subjectCategory: "",
    instituteName: "",
    refNo: "",
    letterDate: "",
    subject: "", // maps to Letter Title
    regionProvince: "" as "region" | "province" | "",
    receivedDate: "",
    priority: "medium" as "high" | "medium" | "low",
    status: "registered" as "registered" | "assigned" | "pending",
  });

  // Sync document properties
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${isEditMode ? t("editLetterTitle", "Edit Letter") : isSubsequentMode ? t("addSubsequentMailTitle", "Add Subsequent Mail") : t("registerComplaintTitle")} | DCMMS`;
  }, [lang, t, isEditMode, isSubsequentMode]);

  // Load subject officers on mount
  useEffect(() => {
    const loadOfficers = async () => {
      const namesSet = new Set<string>([
        "Kamal Perera",
        "Suresh Silva",
        "Aruni Rajapaksha",
      ]);

      // 1. Load from Supabase profiles
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from("dcmms_profiles")
            .select("full_name")
            .eq("role", "subject_officer");
          if (!error && data) {
            data.forEach((d: any) => {
              if (d.full_name) namesSet.add(d.full_name);
            });
          }
        } catch (e) {
          console.error("Failed to load subject officers from Supabase", e);
        }
      }

      // 2. Load from localStorage custom profiles
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("dcmms_custom_profiles");
        if (stored) {
          try {
            const list = JSON.parse(stored);
            list
              .filter((p: any) => p.role === "subject_officer")
              .forEach((p: any) => {
                if (p.fullName) namesSet.add(p.fullName);
              });
          } catch (e) {
            console.error("Failed to load custom profiles from localStorage", e);
          }
        }
      }

      setOfficerOptions(Array.from(namesSet));
    };

    loadOfficers();
  }, []);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push("/");
  };

  useEffect(() => {
    const id = searchParams.get("id");
    const caseNo = searchParams.get("caseNo");
    const subsequent = searchParams.get("subsequent") === "true";

    if (subsequent && caseNo) {
      setIsSubsequentMode(true);
      setFormState((prev) => ({
        ...prev,
        refNo: caseNo,
      }));
      return;
    }

    if (!id) return;

    const loadLetter = async () => {
      setIsEditMode(true);
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from("dcmms_letters")
            .select("*")
            .eq("id", id)
            .single();

          if (!error && data) {
            setFormState({
              id: data.id,
              letterNo: data.letter_no || "",
              senderName: data.sender_name || "",
              letterType: data.letter_type || "",
              officerName: data.officer_name || "",
              subjectCategory: data.subject_category || "",
              instituteName: data.institute_name || "",
              refNo: data.ref_no || "",
              letterDate: data.letter_date || "",
              subject: data.subject || "",
              regionProvince: data.region_province || "",
              receivedDate: data.received_date || "",
              priority: data.priority || "medium",
              status: data.status || "registered",
            });
            return;
          }
        } catch (err) {
          console.error("Failed to load letter for edit from Supabase:", err);
        }
      }

      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("dcmms_letters");
        if (stored) {
          try {
            const list = JSON.parse(stored);
            const found = list.find((item: any) => item.id === id);
            if (found) {
              setFormState({
                id: found.id,
                letterNo: found.letterNo || "",
                senderName: found.senderName || "",
                letterType: found.letterType || "",
                officerName: found.officerName || "",
                subjectCategory: found.subjectCategory || "",
                instituteName: found.instituteName || "",
                refNo: found.refNo || "",
                letterDate: found.letterDate || "",
                subject: found.subject || "",
                regionProvince: found.regionProvince || "",
                receivedDate: found.receivedDate || "",
                priority: found.priority || "medium",
                status: found.status || "registered",
              });
            }
          } catch (err) {
            console.error("Failed to parse stored letters for edit:", err);
          }
        }
      }
    };

    loadLetter();
  }, [searchParams]);

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Enforce required fields validation
    if (!formState.senderName || !formState.subjectCategory || !formState.refNo) {
      alert("Please fill in all required fields (Reference Number, Name of Sender, and Subject Category).");
      return;
    }

    const newLetter = {
      id: formState.id || Date.now().toString(),
      refNo: formState.refNo,
      senderName: formState.senderName,
      senderAddress: "N/A", // Default
      letterDate: formState.letterDate || new Date().toISOString().split("T")[0],
      receivedDate: formState.receivedDate || new Date().toISOString().split("T")[0],
      subject: formState.subject || "N/A", // maps to subject / title
      priority: formState.priority,
      status: formState.status,
      // Extra fields captured
      letterNo: formState.letterNo,
      letterType: formState.letterType,
      officerName: formState.officerName,
      subjectCategory: formState.subjectCategory,
      instituteName: formState.instituteName,
      regionProvince: formState.regionProvince,
    };

    if (isSubsequentMode) {
      if (isSupabaseConfigured) {
        try {
          // Ensure the case row exists (needed for FK constraint) before inserting subsequent mail
          const { error: caseUpsertError } = await supabase
            .from("dcmms_cases")
            .upsert({
              id: `case-${newLetter.refNo}`,
              case_no: newLetter.refNo,
              assigned_date: newLetter.receivedDate,
              subject: newLetter.subject || null,
              priority: newLetter.priority || "medium",
              status: "In Progress",
            }, { onConflict: "case_no", ignoreDuplicates: true });

          if (caseUpsertError) {
            console.warn("Case upsert warning (may already exist):", caseUpsertError.message);
          }

          const { error } = await supabase
            .from("dcmms_new_mail_current_case")
            .insert({
              id: newLetter.id,
              case_no: newLetter.refNo,
              mail_officer_name: newLetter.officerName || null,
              sender_name: newLetter.senderName,
              letter_title: newLetter.subject,
              letter_type: newLetter.letterType || null,
              mail_date: newLetter.letterDate,
              received_date: newLetter.receivedDate,
            });

          if (error) throw error;

          localStorage.setItem("show_register_success", "true");
          router.push("/daily-mail");
          return;
        } catch (err: any) {
          console.error("Failed to save subsequent mail to Supabase", err);
        }
      }


      // Local storage fallback for subsequent mails
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("dcmms_new_mail_current_case") || "[]";
        let list = [];
        try { list = JSON.parse(stored); } catch (e) {}
        list.push({
          id: newLetter.id,
          caseNo: newLetter.refNo,
          mailOfficerName: newLetter.officerName,
          senderName: newLetter.senderName,
          letterTitle: newLetter.subject,
          letterType: newLetter.letterType,
          mailDate: newLetter.letterDate,
          receivedDate: newLetter.receivedDate,
        });
        localStorage.setItem("dcmms_new_mail_current_case", JSON.stringify(list));
        localStorage.setItem("show_register_success", "true");
      }

      router.push("/daily-mail");
      return;
    }

    if (isSupabaseConfigured) {
      try {
        const { data: upserted, error } = await supabase
          .from("dcmms_letters")
          .upsert({
            id: newLetter.id,
            ref_no: newLetter.refNo,
            sender_name: newLetter.senderName,
            sender_address: newLetter.senderAddress,
            letter_date: newLetter.letterDate,
            received_date: newLetter.receivedDate,
            subject: newLetter.subject,
            priority: newLetter.priority,
            status: newLetter.status,
            letter_no: newLetter.letterNo || null,
            letter_type: newLetter.letterType || null,
            officer_name: newLetter.officerName || null,
            subject_category: newLetter.subjectCategory || null,
            institute_name: newLetter.instituteName || null,
            region_province: newLetter.regionProvince || null,
          })
          .select();

        if (error) {
          console.error("Supabase letters write error", error);
          throw error;
        }

        // Also write corresponding case to dcmms_cases so it displays for the subject officer
        const { error: caseError } = await supabase
          .from("dcmms_cases")
          .upsert({
            id: `case-${newLetter.refNo}`,
            case_no: newLetter.refNo,
            assigned_date: newLetter.receivedDate,
            subject: newLetter.subject,
            priority: newLetter.priority,
            status: "In Progress",
          });

        if (caseError) {
          console.error("Supabase cases write error", caseError);
          throw caseError;
        }

        // success
        console.debug("Supabase upsert returned:", upserted);
        localStorage.setItem("show_register_success", "true");
        const nextUrl = "/daily-mail";
        router.push(nextUrl);
        return;
      } catch (err: any) {
        // Better logging for client-side debugging
        try {
          console.error("Failed to save to Supabase, falling back to localStorage", err?.message ?? JSON.stringify(err));
        } catch (e) {
          console.error("Failed to save to Supabase, falling back to localStorage", err);
        }
        // show user-friendly alert (optional)
        if (typeof window !== "undefined") {
          alert("Failed to save to Supabase. Your changes will be stored locally.");
        }
      }
    }

    // Local storage fallback
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_letters");
      let lettersList = [];
      if (stored) {
        try {
          lettersList = JSON.parse(stored);
        } catch (err) {
          console.error("Failed to parse letters list", err);
        }
      }
      const updatedLetters = lettersList.filter((item: any) => item.id !== newLetter.id);
      localStorage.setItem("dcmms_letters", JSON.stringify([newLetter, ...updatedLetters]));

      // Also write case to dcmms_cases in localStorage fallback
      const storedCases = localStorage.getItem("dcmms_cases") || "[]";
      let casesList = [];
      try {
        casesList = JSON.parse(storedCases);
      } catch (err) {
        console.error("Failed to parse cases list", err);
      }
      const newCase = {
        id: `case-${newLetter.refNo}`,
        caseNo: newLetter.refNo,
        assignedDate: newLetter.receivedDate,
        subject: newLetter.subject,
        priority: newLetter.priority,
        status: "In Progress",
      };
      const updatedCases = casesList.filter((item: any) => item.caseNo !== newCase.caseNo);
      localStorage.setItem("dcmms_cases", JSON.stringify([newCase, ...updatedCases]));

      localStorage.setItem("show_register_success", "true");
    }

    const nextUrl = "/daily-mail";
    router.push(nextUrl);
  };

  // Save draft Handler
  const handleSaveDraft = async (e: React.MouseEvent) => {
    e.preventDefault();

    // Draft requires at least Reference number to identify it
    if (!formState.refNo) {
      alert("Please fill in the Reference Number to save as draft.");
      return;
    }

    const draftLetter = {
      id: formState.id || Date.now().toString(),
      refNo: formState.refNo,
      senderName: formState.senderName || "Unknown Sender",
      senderAddress: "N/A",
      letterDate: formState.letterDate || new Date().toISOString().split("T")[0],
      receivedDate: formState.receivedDate || new Date().toISOString().split("T")[0],
      subject: formState.subject || "Draft Complaint",
      priority: formState.priority,
      status: formState.status,
      // Extra fields
      letterNo: formState.letterNo,
      letterType: formState.letterType,
      officerName: formState.officerName,
      subjectCategory: formState.subjectCategory,
      instituteName: formState.instituteName,
      regionProvince: formState.regionProvince,
    };

    if (isSupabaseConfigured) {
      try {
        const { data: upsertedDraft, error } = await supabase
          .from("dcmms_letters")
          .upsert({
            id: draftLetter.id,
            ref_no: draftLetter.refNo,
            sender_name: draftLetter.senderName,
            sender_address: draftLetter.senderAddress,
            letter_date: draftLetter.letterDate,
            received_date: draftLetter.receivedDate,
            subject: draftLetter.subject,
            priority: draftLetter.priority,
            status: draftLetter.status,
            letter_no: draftLetter.letterNo || null,
            letter_type: draftLetter.letterType || null,
            officer_name: draftLetter.officerName || null,
            subject_category: draftLetter.subjectCategory || null,
            institute_name: draftLetter.instituteName || null,
            region_province: draftLetter.regionProvince || null,
          })
          .select();

        if (error) {
          console.error("Supabase draft write error", error);
          throw error;
        }

        console.debug("Supabase draft upsert returned:", upsertedDraft);
        localStorage.setItem("show_register_success", "true");
        router.push("/daily-mail");
        return;
      } catch (err: any) {
        try {
          console.error("Supabase draft write error, falling back to localStorage", err?.message ?? JSON.stringify(err));
        } catch (e) {
          console.error("Supabase draft write error, falling back to localStorage", err);
        }
        if (typeof window !== "undefined") {
          alert("Failed to save draft to Supabase. Your draft will be stored locally.");
        }
      }
    }

    // Local storage fallback
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_letters");
      let lettersList = [];
      if (stored) {
        try {
          lettersList = JSON.parse(stored);
        } catch (err) {
          console.error("Failed to parse letters list", err);
        }
      }
      const updatedLetters = lettersList.filter((item: any) => item.id !== draftLetter.id);
      localStorage.setItem("dcmms_letters", JSON.stringify([draftLetter, ...updatedLetters]));
      localStorage.setItem("show_register_success", "true");
    }

    router.push("/daily-mail");
  };

  // Close sidebar on Escape key press (A11y compliance)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="dashboard-container" data-font-scale={fontScale}>
      {/* Skip Link (A11y) */}
      <a href="#dashboard-main-content" className="skip-link">
        {t("skipLink")}
      </a>

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
      />

      <div className="dashboard-layout">
        <main id="dashboard-main-content" className="dashboard-content">
          
          {/* Top App Bar Header */}
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
                <h2 className="dashboard-main-title">{t("dailyMailReporter")}</h2>
                <p className="dashboard-main-subtitle">{t("registerLettersDesc")}</p>
              </div>
            </div>

            <div className="dashboard-header-right">
              {/* Date display badge */}
              <div className="date-badge">
                <svg className="date-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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

          {/* Standalone register complaint container */}
          <section className="register-page-wrapper">
            <div className="register-card">
              
              {/* Layout title area */}
              <div className="register-header-container">
                <div className="register-header-left">
                  <h1 className="register-title">
                    {isEditMode ? t("editLetterTitle", "Edit Letter") : t("registerComplaintTitle")}
                  </h1>
                  <p className="register-subtitle">
                    {isEditMode ? t("editLetterDesc", "Update the saved letter details and save changes.") : t("registerComplaintDesc")}
                  </p>
                </div>
                <div className="register-header-right-btns">
                  <Link href="/daily-mail" className="btn-back-home">
                    <svg className="btn-back-home-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    {t("backToHome")}
                  </Link>
                  <button
                    type="button"
                    className="btn-action-draft"
                    onClick={handleSaveDraft}
                    title={t("saveAsDraft")}
                    aria-label={t("saveAsDraft")}
                  >
                    <svg
                      className="btn-action-icon"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      width="20"
                      height="20"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V8l-4-4H8z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 20v-8M9 12h6" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Form entries section */}
              <div className="entries-container">
                <h2 className="entries-header">
                  <svg className="entries-header-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {t("letterEntries")}
                </h2>

                <form onSubmit={handleSubmit} className="register-grid-form">
                  
                  {/* Column 1 */}
                  <div className="form-field-group">
                    <label htmlFor="letterNo" className="field-label">{t("letterNo")}</label>
                    <input
                      id="letterNo"
                      type="text"
                      value={formState.letterNo}
                      onChange={(e) => setFormState({ ...formState, letterNo: e.target.value })}
                      placeholder={t("placeholderLetterNo")}
                      className="field-input"
                    />
                  </div>

                  {/* Column 2 */}
                  <div className="form-field-group">
                    <label htmlFor="senderName" className="field-label">{t("senderName")} <span className="required-star">*</span></label>
                    <input
                      id="senderName"
                      type="text"
                      required
                      value={formState.senderName}
                      onChange={(e) => setFormState({ ...formState, senderName: e.target.value })}
                      placeholder={t("senderPlaceholder")}
                      className="field-input"
                    />
                  </div>

                  {/* Column 3 */}
                  <div className="form-field-group">
                    <label htmlFor="letterType" className="field-label">{t("letterType")}</label>
                    <input
                      id="letterType"
                      type="text"
                      value={formState.letterType}
                      onChange={(e) => setFormState({ ...formState, letterType: e.target.value })}
                      placeholder={t("placeholderLetterType")}
                      className="field-input"
                    />
                  </div>

                  {/* Row 2 - Column 1 */}
                  <div className="form-field-group">
                    <label htmlFor="officerName" className="field-label">{t("nameOfOfficer")}</label>
                    <select
                      id="officerName"
                      value={formState.officerName}
                      onChange={(e) => setFormState({ ...formState, officerName: e.target.value })}
                      className="field-select"
                    >
                      <option value="">{t("selectRole")}</option>
                      {officerOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Row 2 - Column 2 */}
                  <div className="form-field-group">
                    <label htmlFor="subjectCategory" className="field-label">{t("subjectCategory")} <span className="required-star">*</span></label>
                    <select
                      id="subjectCategory"
                      required
                      value={formState.subjectCategory}
                      onChange={(e) => setFormState({ ...formState, subjectCategory: e.target.value })}
                      className="field-select"
                    >
                      <option value="">{t("selectRole")}</option>
                      <option value="Student Misconduct">{t("optStudentMisconduct")}</option>
                      <option value="Teacher Absenteeism">{t("optTeacherAbsenteeism")}</option>
                      <option value="Financial Mismanagement">{t("optFinancialMismanagement")}</option>
                      <option value="Administrative Issues">{t("optAdministrativeIssues")}</option>
                      <option value="Other">{t("optOther")}</option>
                    </select>
                  </div>

                  {/* Row 2 - Column 3 */}
                  <div className="form-field-group">
                    <label htmlFor="instituteName" className="field-label">{t("instituteName")}</label>
                    <div className="input-icon-wrapper">
                      <svg className="input-left-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        id="instituteName"
                        type="text"
                        value={formState.instituteName}
                        onChange={(e) => setFormState({ ...formState, instituteName: e.target.value })}
                        placeholder={t("placeholderInstituteName")}
                        className="field-input input-with-left-icon"
                      />
                    </div>
                  </div>

                  {/* Row 3 - Column 1 */}
                  <div className="form-field-group">
                    <label htmlFor="refNo" className="field-label">{t("refNo")} <span className="required-star">*</span></label>
                    <input
                      id="refNo"
                      type="text"
                      required
                      value={formState.refNo}
                      onChange={(e) => setFormState({ ...formState, refNo: e.target.value })}
                      placeholder={t("refPlaceholder")}
                      className="field-input"
                      readOnly={isSubsequentMode}
                    />
                  </div>

                  {/* Row 3 - Column 2 */}
                  <div className="form-field-group">
                    <label htmlFor="letterDate" className="field-label">{t("letterDate")}</label>
                    <div className="input-icon-wrapper">
                      <input
                        id="letterDate"
                        type="date"
                        value={formState.letterDate}
                        onChange={(e) => setFormState({ ...formState, letterDate: e.target.value })}
                        className="field-input input-with-right-icon"
                      />
                      <svg className="input-right-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>

                  {/* Row 3 - Column 3 (Spans 2 rows) */}
                  <div className="form-field-group grid-row-span-2">
                    <label htmlFor="subject" className="field-label">{t("letterTitle")}</label>
                    <textarea
                      id="subject"
                      value={formState.subject}
                      onChange={(e) => setFormState({ ...formState, subject: e.target.value })}
                      placeholder={t("subjectPlaceholder")}
                      className="field-textarea"
                    />
                  </div>

                  {/* Row 4 - Column 1 */}
                  <div className="form-field-group">
                    <span className="field-label">{t("regionProvince")}</span>
                    <div className="radio-group-container">
                      <label className="radio-option-label">
                        <input
                          type="radio"
                          name="regionProvince"
                          value="region"
                          checked={formState.regionProvince === "region"}
                          onChange={() => setFormState({ ...formState, regionProvince: "region" })}
                          className="radio-input-styled"
                          aria-label="Region"
                        />
                        {t("region")}
                      </label>
                      <label className="radio-option-label">
                        <input
                          type="radio"
                          name="regionProvince"
                          value="province"
                          checked={formState.regionProvince === "province"}
                          onChange={() => setFormState({ ...formState, regionProvince: "province" })}
                          className="radio-input-styled"
                          aria-label="Province"
                        />
                        {t("province")}
                      </label>
                    </div>
                  </div>

                  {/* Row 4 - Column 2 */}
                  <div className="form-field-group">
                    <label htmlFor="receivedDate" className="field-label">{t("receivedDate")}</label>
                    <div className="input-icon-wrapper">
                      <input
                        id="receivedDate"
                        type="date"
                        value={formState.receivedDate}
                        onChange={(e) => setFormState({ ...formState, receivedDate: e.target.value })}
                        className="field-input input-with-right-icon"
                      />
                      <svg className="input-right-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>

                  {/* Form Action Buttons */}
                  <div className="register-form-actions">
                    <button
                      type="button"
                      className="btn-action-cancel"
                      onClick={() => router.push("/daily-mail")}
                    >
                      {t("cancelBtn")}
                    </button>

                    <button
                      type="submit"
                      className="btn-action-submit"
                    >
                      {isEditMode ? t("saveChangesBtn", "Save Changes") : t("submitBtn")}
                    </button>
                  </div>

                </form>
              </div>

            </div>
          </section>

          {/* Footer Branding Notice */}
          <footer className="dashboard-content-footer">
            <p>{t("footerText")}</p>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default function RegisterComplaintPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RegisterComplaintForm />
    </Suspense>
  );
}
