"use client";

import "../../../i18n";
import "../../daily-mail/daily-mail.css";
import "../../dashboard-common.css";
import "../subject.css";
import "./add-details.css";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sidebar } from "@/components/Sidebar";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getCurrentProfile, dashboardPath } from "@/lib/auth";

function CaseDetailsForm() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const caseNoParam = searchParams?.get("caseNo") || "CA/2026/01";

  // Accessibility & language state
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [letterData, setLetterData] = useState<any>(null);
  const [subsequentMails, setSubsequentMails] = useState<any[]>([]);
  const [previousActions, setPreviousActions] = useState<any[]>([]);
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");
  const lang = i18n.language;

  // Format date statically to match mockup
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

  // Mobile sidebar visibility state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  // Sync document properties
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${t("addSubjectDetailsTitle")} | DCMMS`;
  }, [lang, t]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  // Form States - Left Card ("Add Details")
  const [subjectOfficer, setSubjectOfficer] = useState("");
  const [reportState, setReportState] = useState("");
  const [receivedDate, setReceivedDate] = useState("2026-06-23");
  const [stepTaken, setStepTaken] = useState("");
  const [refNo, setRefNo] = useState(caseNoParam);
  const [fileRelated, setFileRelated] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");

  // Form States - Right Card ("If officer concerned with the Complaint")
  const [isConcerned, setIsConcerned] = useState<"yes" | "no">("no");
  const [officerName, setOfficerName] = useState("");
  const [officerDob, setOfficerDob] = useState("");
  const [officerNic, setOfficerNic] = useState("");
  const [officerPosition, setOfficerPosition] = useState("");
  const [officerApptDate, setOfficerApptDate] = useState("");
  const [officerAddress, setOfficerAddress] = useState("");

  // Verify role and pre-populate fields on mount
  useEffect(() => {
    const verifyAndFetch = async () => {
      // 1. Role verification
      if (isSupabaseConfigured) {
        try {
          const profile = await getCurrentProfile();
          if (!profile || profile.role !== "subject_officer") {
            if (profile) {
              router.replace(dashboardPath(profile.role));
            } else {
              router.replace("/");
            }
            return;
          }
        } catch (err) {
          console.error("Auth check failed:", err);
          router.replace("/");
          return;
        }
      }

      // 2. Fetch complaint details (Daily Mail form details)
      if (caseNoParam) {
        if (isSupabaseConfigured) {
          try {
            const { data, error } = await supabase
              .from("dcmms_daily_mail")
              .select("*")
              .eq("ref_no", caseNoParam)
              .single();

            if (error && error.code !== "PGRST116") throw error;

            if (data) {
              setLetterData({
                id: data.id,
                refNo: data.ref_no,
                senderName: data.sender_name,
                senderAddress: data.sender_address,
                letterDate: data.letter_date,
                receivedDate: data.received_date,
                subject: data.subject,
                priority: data.priority,
                status: data.status,
                letterNo: data.letter_no,
                letterType: data.letter_type,
                officerName: data.officer_name,
                subjectCategory: data.subject_category,
                instituteName: data.institute_name,
                regionProvince: data.region_province,
              });
            }
          } catch (e) {
            console.error("Failed to fetch letter details from Supabase", e);
          }
        }

        // Fetch from local storage fallback for Daily Mail details
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem("dcmms_letters");
          if (stored) {
            try {
              const list = JSON.parse(stored);
              const found = list.find((item: any) => item.refNo === caseNoParam);
              if (found) {
                setLetterData(found);
              }
            } catch (e) {
              console.error("Failed to parse letters from local storage", e);
            }
          }
        }

        // 3. Fetch subject details (from dcmms_subject_details and dcmms_concerned_officers)
        if (isSupabaseConfigured) {
          try {
            // Load subsequent mails for this case
            const { data: mailsData, error: mailsError } = await supabase
              .from("dcmms_subsequent_mails")
              .select("*")
              .eq("case_no", caseNoParam);

            if (!mailsError && mailsData) {
              const mapped = mailsData.map((d: any) => ({
                id: d.id,
                refNo: d.case_no,
                officerName: d.mail_officer_name,
                senderName: d.sender_name,
                subject: d.letter_title,
                letterType: d.letter_type,
                letterDate: d.mail_date,
                receivedDate: d.received_date,
              }));
              setSubsequentMails(mapped);
            }

            // Load new letter actions history list
            const { data: actionsData, error: actionError } = await supabase
              .from("dcmms_subject_details")
              .select("*")
              .eq("case_no", caseNoParam)
              .order("received_date", { ascending: false });

            if (!actionError && actionsData) {
              const mapped = actionsData.map((d: any) => ({
                id: d.id,
                caseNo: d.case_no,
                receivedDate: d.received_date,
                reportState: d.report_state,
                specialNotes: d.special_notes,
                subjectOfficerName: d.subject_officer_name,
                stepItem: d.step_taken, // map step_taken to stepItem just in case
                stepTaken: d.step_taken,
              }));
              setPreviousActions(mapped);

              // Pre-populate the form inputs with the most recent action details
              if (mapped.length > 0) {
                const latest = mapped[0];
                setSubjectOfficer(latest.subjectOfficerName || "");
                setReportState(latest.reportState || "");
                setReceivedDate(latest.receivedDate || "2026-06-23");
                setStepTaken(latest.stepTaken || "");
                setRefNo(latest.caseNo || caseNoParam);
                setSpecialNotes(latest.specialNotes || "");
              }
            }

            // Load concerned officer details
            const { data: concernedData, error: concernedError } = await supabase
              .from("dcmms_concerned_officers")
              .select("*")
              .eq("case_no", caseNoParam)
              .single();

            if (concernedError && concernedError.code !== "PGRST116") throw concernedError;

            if (concernedData) {
              setIsConcerned("yes");
              setOfficerName(concernedData.officer_name || "");
              setOfficerPosition(concernedData.position || "");
              setOfficerApptDate(concernedData.appointment_date || "");
              setOfficerAddress(concernedData.address || "");
              setFileRelated(concernedData.institute_name || ""); // institute name fallback
              setOfficerDob((concernedData as any).dob || "");
              setOfficerNic((concernedData as any).nic || "");
            } else {
              setIsConcerned("no");
            }
          } catch (e) {
            console.error("Failed to fetch case details from Supabase", e);
          }
        }

        // Local storage fallbacks
        if (typeof window !== "undefined") {
          // Subsequent mails fallback
          const storedMails = localStorage.getItem("dcmms_new_mail_current_case");
          if (storedMails) {
            try {
              const list = JSON.parse(storedMails);
              const found = list.filter((item: any) => item.caseNo === caseNoParam);
              setSubsequentMails(found);
            } catch (e) {
              console.error("Failed to parse subsequent letters from localStorage", e);
            }
          }

          // Actions list timeline fallback
          const storedActions = localStorage.getItem("dcmms_new_letter_current_case");
          if (storedActions) {
            try {
              const actionsMap = JSON.parse(storedActions);
              let foundActions = [];
              if (Array.isArray(actionsMap)) {
                foundActions = actionsMap.filter((item: any) => item.caseNo === caseNoParam);
              } else if (actionsMap[caseNoParam]) {
                foundActions = [actionsMap[caseNoParam]];
              }

              foundActions.sort((a: any, b: any) => new Date(b.receivedDate).getTime() - new Date(a.receivedDate).getTime());
              setPreviousActions(foundActions);

              if (foundActions.length > 0) {
                const latest = foundActions[0];
                setSubjectOfficer(latest.subjectOfficerName || "");
                setReportState(latest.reportState || "");
                setReceivedDate(latest.receivedDate || "2026-06-23");
                setStepTaken(latest.stepTaken || "");
                setRefNo(latest.caseNo || caseNoParam);
                setSpecialNotes(latest.specialNotes || "");
              }
            } catch (e) {
              console.error("Failed to parse actions from localStorage", e);
            }
          }

          const storedConcerned = localStorage.getItem("dcmms_officer_concerned");
          if (storedConcerned) {
            try {
              const concernedMap = JSON.parse(storedConcerned);
              const existingConcerned = concernedMap[caseNoParam];
              if (existingConcerned) {
                setIsConcerned("yes");
                setOfficerName(existingConcerned.officerName || "");
                setOfficerPosition(existingConcerned.position || "");
                setOfficerApptDate(existingConcerned.appointmentDate || "");
                setOfficerAddress(existingConcerned.address || "");
                setFileRelated(existingConcerned.instituteName || "");
                setOfficerDob(existingConcerned.dob || "");
                setOfficerNic(existingConcerned.nic || "");
              }
            } catch (e) {
              console.error("Failed to parse concerned officer from localStorage", e);
            }
          }
        }
      }

      setCheckingAuth(false);
    };

    verifyAndFetch();
  }, [caseNoParam, router]);

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push("/");
  };

  const syncCalendar = async (apptDate: string) => {
    if (!apptDate) return;
    const newEvent = {
      id: `mock-${Date.now()}`,
      summary: `Officer Appointment: ${refNo}`,
      description: `Appointment date for Inquiry Officer ${officerName || ""} for Subject: ${subjectOfficer || ""}.`,
      start: { dateTime: `${apptDate}T09:00:00+05:30` },
      end: { dateTime: `${apptDate}T10:00:00+05:30` },
      location: officerAddress || "Discipline Branch, Isurupaya",
      source: "Officer Appointment Date",
    };

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from("dcmms_calendar")
          .upsert({
            id: newEvent.id,
            summary: newEvent.summary,
            description: newEvent.description,
            start_time: newEvent.start.dateTime,
            end_time: newEvent.end.dateTime,
            location: newEvent.location,
            source: newEvent.source,
          });
        return;
      } catch (err) {
        console.error("Failed to sync calendar to Supabase", err);
      }
    }

    // Fallback
    try {
      const stored = localStorage.getItem("dcmms_calendar_events") || "[]";
      const list = JSON.parse(stored);
      list.push(newEvent);
      localStorage.setItem("dcmms_calendar_events", JSON.stringify(list));
    } catch (err) {
      console.error("Failed to sync to local calendar storage", err);
    }
  };

  const saveCaseData = async (status: string, isDraftMode = false) => {
    const actionId = `action-${refNo}-${Date.now()}`;
    if (isSupabaseConfigured) {
      try {
        // Ensure the case row exists (needed for FK constraint)
        await supabase
          .from("dcmms_subject")
          .upsert({
            id: `case-${refNo}`,
            case_no: refNo,
            status: status || "In Progress",
          }, { onConflict: "case_no", ignoreDuplicates: true });

        // Save action/letters details as a new row in dcmms_subject_details
        const { error: actionError } = await supabase
          .from("dcmms_subject_details")
          .insert({
            id: actionId,
            case_no: refNo,
            received_date: receivedDate || null,
            report_state: status || "Pending",
            special_notes: specialNotes || null,
            subject_officer_name: subjectOfficer || null,
            step_taken: stepTaken || null,
          });

        if (actionError) throw actionError;

        // Save concerned officer details (if concerned is yes)
        if (isConcerned === "yes") {
          const { error: concernedError } = await supabase
            .from("dcmms_concerned_officers")
            .upsert({
              id: `concerned-${refNo}`,
              case_no: refNo,
              officer_name: officerName || null,
              institute_name: fileRelated || null,
              institute_address: "N/A",
              position: officerPosition || null,
              address: officerAddress || null,
              appointment_date: officerApptDate || null,
              dob: officerDob || null,
              nic: officerNic || null,
            });
          if (concernedError) throw concernedError;
        } else {
          // Delete from dcmms_concerned_officers if not concerned
          await supabase
            .from("dcmms_concerned_officers")
            .delete()
            .eq("case_no", refNo);
        }

        // Update main case status
        const { data: caseData, error: fetchError } = await supabase
          .from("dcmms_subject")
          .select("*")
          .eq("case_no", refNo)
          .single();

        if (!fetchError && caseData) {
          await supabase
            .from("dcmms_subject")
            .upsert({
              ...caseData,
              status: status || caseData.status,
            });
        }
      } catch (err) {
        console.error("Supabase save failed, falling back to localStorage:", err);
      }
    }

    // Save to Local Storage fallbacks
    if (typeof window !== "undefined") {
      // Save actions to a list
      const storedActions = localStorage.getItem("dcmms_new_letter_current_case") || "[]";
      let actionsList = [];
      try { actionsList = JSON.parse(storedActions); } catch (e) {}
      if (!Array.isArray(actionsList)) { actionsList = []; }
      
      // Remove any existing draft action for this case before pushing the new one
      const cleanList = actionsList.filter((a: any) => a.id !== actionId);
      
      cleanList.push({
        id: actionId,
        caseNo: refNo,
        subjectOfficerName: subjectOfficer,
        reportState: status,
        receivedDate,
        stepTaken,
        specialNotes,
        isDraft: isDraftMode,
      });
      localStorage.setItem("dcmms_new_letter_current_case", JSON.stringify(cleanList));

      // Save concerned
      const storedConcerned = localStorage.getItem("dcmms_officer_concerned") || "{}";
      let concernedMap = {};
      try { concernedMap = JSON.parse(storedConcerned); } catch (e) {}
      if (isConcerned === "yes") {
        (concernedMap as any)[refNo] = {
          caseNo: refNo,
          officerName,
          position: officerPosition,
          appointmentDate: officerApptDate,
          address: officerAddress,
          instituteName: fileRelated,
          dob: officerDob,
          nic: officerNic,
        };
      } else {
        delete (concernedMap as any)[refNo];
      }
      localStorage.setItem("dcmms_officer_concerned", JSON.stringify(concernedMap));

      // Update case status locally
      const storedCases = localStorage.getItem("dcmms_cases");
      if (storedCases) {
        try {
          const casesList = JSON.parse(storedCases);
          const updated = casesList.map((c: any) => {
            if (c.caseNo === refNo) {
              return { ...c, status: status || c.status };
            }
            return c;
          });
          localStorage.setItem("dcmms_cases", JSON.stringify(updated));
        } catch (e) {}
      }
    }
  };

  // Submit case details form handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (officerApptDate) {
      syncCalendar(officerApptDate);
    }

    if (!refNo) {
      alert("Reference Number is required.");
      return;
    }

    await saveCaseData(reportState || "In Progress", false);
    alert("Case details updated successfully!");
    router.push("/subject");
  };

  // Save as draft handler
  const handleSaveDraft = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (!refNo) {
      alert("Please fill in the Reference Number to save as draft.");
      return;
    }

    await saveCaseData(reportState || "Pending", true);
    alert("Draft saved successfully!");
    router.push("/subject");
  };

  // Close case handler
  const handleCloseCase = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (!refNo) {
      alert("Reference Number is required.");
      return;
    }

    if (officerApptDate) {
      syncCalendar(officerApptDate);
    }

    await saveCaseData("Closed", false);
    alert("Case closed and submitted successfully!");
    router.push("/subject");
  };

  if (checkingAuth) {
    return (
      <div className="page-loading-container">
        <div>Loading...</div>
      </div>
    );
  }

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
        role="subject"
      />

      <div className="dashboard-layout">
        <main id="dashboard-main-content" className="dashboard-content">
          {/* ── Top App Bar Header ── */}
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
                <h2 className="dashboard-main-title">Subject Officer</h2>
                <p className="dashboard-main-subtitle">{t("subjectOfficerDesc")}</p>
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

          {/* Form container section */}
          <section className="add-details-page-wrapper">
            <div className="add-details-main-card">
              <form onSubmit={handleSubmit}>
                {/* Layout title area */}
                <div className="add-details-header-container">
                  <div className="add-details-header-left">
                    <h1 className="add-details-title">{t("addSubjectDetailsTitle")}</h1>
                    <p className="add-details-subtitle">{t("addSubjectDetailsDesc")}</p>
                  </div>
                  <div className="add-details-header-right-btns">
                    <Link href="/subject" className="btn-back-home">
                      <svg
                        className="btn-back-home-icon"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                      {t("backToHome")}
                    </Link>
                    <button
                      type="button"
                      className="btn-action-draft-top"
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

                {letterData && (
                  <div className="current-case-details-card">
                    <h3 className="current-details-title">{t("currentDetails", "Current details")}</h3>
                    <div className="case-details-grid">
                      <div className="case-details-column">
                        <div className="case-detail-item">
                          <span className="detail-label">{t("caseNoLabel", "Case No. :")}</span>
                          <span className="detail-value">{letterData.letterNo || ""}</span>
                        </div>
                        <div className="case-detail-item">
                          <span className="detail-label">{t("priorityLabel", "Priority :")}</span>
                          <span className="detail-value">
                            {letterData.priority ? (t(`priority${letterData.priority.charAt(0).toUpperCase() + letterData.priority.slice(1).toLowerCase()}`, letterData.priority) as string) : ""}
                          </span>
                        </div>
                      </div>
                      <div className="case-details-column">
                        <div className="case-detail-item">
                          <span className="detail-label">{t("officerNameLabel", "Name of Subject Officer :")}</span>
                          <span className="detail-value">{letterData.officerName || ""}</span>
                        </div>
                        <div className="case-detail-item">
                          <span className="detail-label">{t("receivedDateLabel", "Received Date :")}</span>
                          <span className="detail-value">{letterData.receivedDate || ""}</span>
                        </div>
                      </div>
                      <div className="case-details-column">
                        <div className="case-detail-item">
                          <span className="detail-label">{t("refNoLabel", "Reference Number :")}</span>
                          <span className="detail-value">{letterData.refNo || ""}</span>
                        </div>
                        <div className="case-detail-item">
                          <span className="detail-label">{t("letterTypeLabel", "Letter Type :")}</span>
                          <span className="detail-value">
                            {letterData.letterType ? t(letterData.letterType) : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {subsequentMails && subsequentMails.length > 0 && subsequentMails.map((mail: any, index: number) => (
                  <div key={mail.id || index} className="registered-complaint-card subsequent-mail-card">
                    <h2 className="card-title-header">
                      <svg className="card-title-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 19v-8.93a2 2 0 01.89-1.664l8-5.333a2 2 0 012.22 0l8 5.333A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-2.25-1.5a2 2 0 00-2.22 0l-2.25 1.5" />
                      </svg>
                      {t("subsequentMailReceived", "Subsequent Mail Received")} #{index + 1}
                    </h2>
                    <div className="complaint-details-grid">
                      <div className="complaint-detail-item">
                        <span className="complaint-detail-label">{t("senderName", "Sender Name")}:</span>
                        <span className="complaint-detail-value">{mail.senderName}</span>
                      </div>
                      <div className="complaint-detail-item">
                        <span className="complaint-detail-label">{t("letterDate", "Letter Date")}:</span>
                        <span className="complaint-detail-value">{mail.letterDate}</span>
                      </div>
                      <div className="complaint-detail-item">
                        <span className="complaint-detail-label">{t("receivedDate", "Received Date")}:</span>
                        <span className="complaint-detail-value">{mail.receivedDate}</span>
                      </div>
                      <div className="complaint-detail-item">
                        <span className="complaint-detail-label">{t("subject", "Subject")}:</span>
                        <span className="complaint-detail-value">{mail.subject}</span>
                      </div>
                      {mail.letterType && (
                        <div className="complaint-detail-item">
                          <span className="complaint-detail-label">{t("letterType", "Letter Type")}:</span>
                          <span className="complaint-detail-value">{t(mail.letterType)}</span>
                        </div>
                      )}
                      {mail.officerName && (
                        <div className="complaint-detail-item">
                          <span className="complaint-detail-label">{t("nameOfOfficer", "Name of Subject officer")}:</span>
                          <span className="complaint-detail-value">{mail.officerName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <div className="add-details-cards-grid">
                {/* ───────────────── Left Card ("Add Details") ───────────────── */}
                <div className="add-details-card">
                  <h2 className="card-title-header">
                    <svg
                      className="card-title-icon"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    {t("addDetails")}
                  </h2>

                  <div className="left-card-form">
                    {/* Previous Actions History Timeline */}
                    {previousActions && previousActions.length > 0 && (
                      <div className="previous-actions-timeline">
                        <h3 className="timeline-title">
                          <svg className="action-row-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {t("previousActionsHistory", "History of Actions Taken")}
                        </h3>
                        <div className="timeline-items-wrapper">
                          {previousActions.map((act: any, idx: number) => (
                            <div key={act.id || idx} className="timeline-item">
                              <div className="timeline-header">
                                <span>{act.receivedDate}</span>
                                <span className={`timeline-status timeline-status-${act.reportState?.toLowerCase().replace(/\s+/g, "") || "pending"}`}>
                                  {t(act.reportState || "Pending")}
                                </span>
                              </div>
                              <p className="timeline-step">{act.stepTaken}</p>
                              {act.specialNotes && (
                                <p className="timeline-notes">
                                  {t("notes", "Notes")}: {act.specialNotes}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Subject Officer Select */}
                    <div className="form-field-group field-subject-officer">
                      <label htmlFor="subjectOfficer" className="field-label">
                        {t("subjectOfficerLabel")}
                      </label>
                      <div className="select-wrapper">
                        <select
                          id="subjectOfficer"
                          value={subjectOfficer}
                          onChange={(e) => setSubjectOfficer(e.target.value)}
                          className="field-select"
                        >
                          <option value="">{t("selectRole")}</option>
                          <option value="Kamal Perera">{t("optKamalPerera")}</option>
                          <option value="Suresh Silva">{t("optSureshSilva")}</option>
                          <option value="Aruni Rajapaksha">{t("optAruniRajapaksha")}</option>
                        </select>
                        <div className="select-arrow-container">
                          <svg
                            className="select-arrow-icon"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Report State Select */}
                    <div className="form-field-group field-report-state">
                      <label htmlFor="reportState" className="field-label">
                        {t("reportState")}
                      </label>
                      <div className="select-wrapper">
                        <select
                          id="reportState"
                          value={reportState}
                          onChange={(e) => setReportState(e.target.value)}
                          className="field-select"
                        >
                          <option value="">Choose report state</option>
                          <option value="In Progress">{t("statusInProgress")}</option>
                          <option value="Pending">{t("statusPending")}</option>
                          <option value="Closed">{t("statusClosed")}</option>
                        </select>
                        <div className="select-arrow-container">
                          <svg
                            className="select-arrow-icon"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Received Date */}
                    <div className="form-field-group field-received-date">
                      <label htmlFor="receivedDate" className="field-label">
                        {t("receivedDate")}
                      </label>
                      <div className="input-icon-wrapper">
                        <input
                          id="receivedDate"
                          type="date"
                          value={receivedDate}
                          onChange={(e) => setReceivedDate(e.target.value)}
                          className="field-input input-with-right-icon"
                        />
                        <svg
                          className="input-right-icon"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Step Taken */}
                    <div className="form-field-group field-step-taken">
                      <label htmlFor="stepTaken" className="field-label">
                        {t("stepTaken")}
                      </label>
                      <textarea
                        id="stepTaken"
                        value={stepTaken}
                        onChange={(e) => setStepTaken(e.target.value)}
                        className="field-textarea"
                      />
                    </div>

                    {/* Reference Number */}
                    <div className="form-field-group field-reference-number">
                      <label htmlFor="refNo" className="field-label">
                        {t("refNo")} <span className="required-star">*</span>
                      </label>
                      <input
                        id="refNo"
                        type="text"
                        required
                        value={refNo}
                        onChange={(e) => setRefNo(e.target.value)}
                        className="field-input"
                      />
                    </div>

                    {/* File related to Letter */}
                    <div className="form-field-group field-file-related">
                      <label htmlFor="fileRelated" className="field-label">
                        {t("fileRelatedToLetter")}
                      </label>
                      <input
                        id="fileRelated"
                        type="text"
                        value={fileRelated}
                        onChange={(e) => setFileRelated(e.target.value)}
                        className="field-input"
                      />
                    </div>

                    {/* Special Notes */}
                    <div className="form-field-group field-special-notes">
                      <label htmlFor="specialNotes" className="field-label">
                        {t("specialNotes")}
                      </label>
                      <input
                        id="specialNotes"
                        type="text"
                        value={specialNotes}
                        onChange={(e) => setSpecialNotes(e.target.value)}
                        className="field-input"
                      />
                    </div>
                  </div>
                </div>

                {/* ───────────────── Right Card ("If officer concerned with Complaint") ───────────────── */}
                <div className="add-details-card">
                  <div className="right-card-form">
                    {/* Concern Question and square checkbox-style radios */}
                    <div className="form-field-group">
                      <span className="field-label">{t("officerConcernedQuestion")}</span>
                      <div className="radio-group-container">
                        <label className="radio-option-label">
                          <input
                            type="radio"
                            name="isConcerned"
                            value="yes"
                            checked={isConcerned === "yes"}
                            onChange={() => setIsConcerned("yes")}
                            className="radio-input-square"
                          />
                          {t("yesLabel")}
                        </label>
                        <label className="radio-option-label">
                          <input
                            type="radio"
                            name="isConcerned"
                            value="no"
                            checked={isConcerned === "no"}
                            onChange={() => setIsConcerned("no")}
                            className="radio-input-square"
                          />
                          {t("noLabel")}
                        </label>
                      </div>
                    </div>

                    {/* Name */}
                    <div className="form-field-group">
                      <label htmlFor="officerName" className="field-label">
                        {t("concernedName")}
                      </label>
                      <input
                        id="officerName"
                        type="text"
                        value={officerName}
                        onChange={(e) => setOfficerName(e.target.value)}
                        className="field-input"
                      />
                    </div>

                    {/* Date of Birth and NIC Number side-by-side */}
                    <div className="dob-nic-row">
                      <div className="form-field-group">
                        <label htmlFor="officerDob" className="field-label">
                          {t("dateOfBirth")}
                        </label>
                        <div className="input-icon-wrapper">
                          <input
                            id="officerDob"
                            type="date"
                            value={officerDob}
                            onChange={(e) => setOfficerDob(e.target.value)}
                            className="field-input input-with-right-icon"
                          />
                          <svg
                            className="input-right-icon"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                      </div>

                      <div className="form-field-group">
                        <label htmlFor="officerNic" className="field-label">
                          {t("nicNumber")}
                        </label>
                        <input
                          id="officerNic"
                          type="text"
                          value={officerNic}
                          onChange={(e) => setOfficerNic(e.target.value)}
                          className="field-input"
                        />
                      </div>
                    </div>

                    {/* Position */}
                    <div className="form-field-group">
                      <label htmlFor="officerPosition" className="field-label">
                        {t("positionLabel")}
                      </label>
                      <input
                        id="officerPosition"
                        type="text"
                        value={officerPosition}
                        onChange={(e) => setOfficerPosition(e.target.value)}
                        className="field-input"
                      />
                    </div>

                    {/* Appointment Date */}
                    <div className="form-field-group">
                      <label htmlFor="officerApptDate" className="field-label">
                        {t("appointmentDate")}
                      </label>
                      <div className="input-icon-wrapper">
                        <input
                          id="officerApptDate"
                          type="date"
                          value={officerApptDate}
                          onChange={(e) => setOfficerApptDate(e.target.value)}
                          className="field-input input-with-right-icon"
                        />
                        <svg
                          className="input-right-icon"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Address */}
                    <div className="form-field-group">
                      <label htmlFor="officerAddress" className="field-label">
                        {t("addressLabel")}
                      </label>
                      <input
                        id="officerAddress"
                        type="text"
                        value={officerAddress}
                        onChange={(e) => setOfficerAddress(e.target.value)}
                        className="field-input"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="add-details-form-actions">
                <button
                  type="button"
                  className="btn-action-cancel"
                  onClick={() => router.push("/subject")}
                >
                  {t("cancelBtn")}
                </button>
                <button
                  type="button"
                  className="btn-action-close-case"
                  onClick={handleCloseCase}
                >
                  {t("caseClosedBtn")}
                </button>
                <button
                  type="submit"
                  className="btn-action-submit"
                >
                  {t("submitBtn")}
                </button>
              </div>
            </form>
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

export default function AddCaseDetailsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CaseDetailsForm />
    </Suspense>
  );
}
