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
import { SiteFooter } from "@/components/SiteFooter";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getCurrentProfile, dashboardPath } from "@/lib/auth";
const formatStepTaken = (step: string, t: any) => {
  if (!step) return "";
  if (step.startsWith("[EduSecApproval:")) {
    const isApproved = step.includes("EduSecApproval:yes");
    const dateMatch = step.match(/Date:([^\]\s]+)/);
    const dateStr = dateMatch ? dateMatch[1] : "";
    if (isApproved) {
      return `${t("eduSecretaryApproval")}: ${t("yesLabel")} (${t("approvalDate")}: ${dateStr})`;
    } else {
      return `${t("eduSecretaryApproval")}: ${t("noLabel")}`;
    }
  }
  return step;
};

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

  // Sync letter data with flowchart states on load
  useEffect(() => {
    if (letterData) {
      const cleanVal = (val: string | null | undefined) => {
        if (!val) return "";
        const trimmed = val.trim();
        if (trimmed.toUpperCase() === "N/A" || trimmed === "—" || trimmed === "-") return "";
        return trimmed;
      };

      setComplainantName(cleanVal(letterData.senderName));
      setComplainantAddress(cleanVal(letterData.senderAddress));
      setSchoolName(cleanVal(letterData.instituteName));
      setComplaintMatter(cleanVal(letterData.subject));
      
      const isAnon = !letterData.senderName || 
                     letterData.senderName.toLowerCase().includes("anonymous") || 
                     letterData.senderName.toLowerCase().includes("නිර්නාමික") ||
                     letterData.regionProvince?.toLowerCase().includes("anonymous");
      setClassification(isAnon ? "anonymous" : "nominal");

      // Check if case is old
      let localIsOld = false;
      if (typeof window !== "undefined") {
        const storedCases = localStorage.getItem("dcmms_cases");
        if (storedCases) {
          try {
            const casesList = JSON.parse(storedCases);
            const foundCase = casesList.find((c: any) => c.caseNo === letterData.refNo);
            if (foundCase) {
              localIsOld = !!foundCase.isOld;
            }
          } catch (e) {}
        }
      }
      setComplaintAge(localIsOld ? "old" : "new");
    }
  }, [letterData]);

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
  const [priority, setPriority] = useState("medium");

  // Flowchart Form States (as in the flowchart diagram)
  const [classification, setClassification] = useState<"nominal" | "anonymous">("nominal");
  const [complainantName, setComplainantName] = useState("");
  const [complainantAddress, setComplainantAddress] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [complaintMatter, setComplaintMatter] = useState("");
  const [complaintAge, setComplaintAge] = useState<"new" | "old">("new");

  // Form States - Right Card ("If officer concerned with the Complaint")
  const [isConcerned, setIsConcerned] = useState<"yes" | "no">("no");
  const [eduSecretaryApproval, setEduSecretaryApproval] = useState<"yes" | "no">("no");
  const [approvalDate, setApprovalDate] = useState("");
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
              setPriority(data.priority || "medium");
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
                setPriority(found.priority || "medium");
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
                
                const rawStep = latest.stepTaken || "";
                if (rawStep.startsWith("[EduSecApproval:")) {
                  const isApproved = rawStep.includes("EduSecApproval:yes");
                  setEduSecretaryApproval(isApproved ? "yes" : "no");
                  const dateMatch = rawStep.match(/Date:([^\]\s]+)/);
                  setApprovalDate(dateMatch ? dateMatch[1] : "");
                  setStepTaken("");
                } else {
                  setEduSecretaryApproval("no");
                  setApprovalDate("");
                  setStepTaken(rawStep);
                }
                
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
              const cleanVal = (val: string | null | undefined) => {
                if (!val) return "";
                const trimmed = val.trim();
                if (trimmed.toUpperCase() === "N/A" || trimmed === "—" || trimmed === "-") return "";
                return trimmed;
              };
              setIsConcerned(concernedData.officer_name ? "yes" : "no");
              setOfficerName(cleanVal(concernedData.officer_name));
              setOfficerPosition(cleanVal(concernedData.position));
              setOfficerApptDate(cleanVal(concernedData.appointment_date));
              setOfficerAddress(cleanVal(concernedData.address));
              setFileRelated(cleanVal(concernedData.institute_name));
              setOfficerDob(cleanVal((concernedData as any).dob));
              setOfficerNic(cleanVal((concernedData as any).nic));
              if (concernedData.institute_name) {
                setSchoolName(cleanVal(concernedData.institute_name));
              }
              if (concernedData.institute_address) {
                setSchoolAddress(concernedData.institute_address);
              }
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
              const mapped = found.map((item: any) => ({
                id: item.id,
                refNo: item.caseNo || item.refNo,
                officerName: item.mailOfficerName || item.officerName,
                senderName: item.senderName,
                subject: item.letterTitle || item.subject,
                letterType: item.letterType,
                letterDate: item.mailDate || item.letterDate,
                receivedDate: item.receivedDate,
              }));
              setSubsequentMails(mapped);
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
                
                const rawStep = latest.stepTaken || "";
                if (rawStep.startsWith("[EduSecApproval:")) {
                  const isApproved = rawStep.includes("EduSecApproval:yes");
                  setEduSecretaryApproval(isApproved ? "yes" : "no");
                  const dateMatch = rawStep.match(/Date:([^\]\s]+)/);
                  setApprovalDate(dateMatch ? dateMatch[1] : "");
                  setStepTaken("");
                } else {
                  setEduSecretaryApproval("no");
                  setApprovalDate("");
                  setStepTaken(rawStep);
                }
                
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
                const cleanVal = (val: string | null | undefined) => {
                  if (!val) return "";
                  const trimmed = val.trim();
                  if (trimmed.toUpperCase() === "N/A" || trimmed === "—" || trimmed === "-") return "";
                  return trimmed;
                };
                setIsConcerned(existingConcerned.officerName ? "yes" : "no");
                setOfficerName(cleanVal(existingConcerned.officerName));
                setOfficerPosition(cleanVal(existingConcerned.position));
                setOfficerApptDate(cleanVal(existingConcerned.appointmentDate));
                setOfficerAddress(cleanVal(existingConcerned.address));
                setFileRelated(cleanVal(existingConcerned.instituteName));
                setOfficerDob(cleanVal(existingConcerned.dob));
                setOfficerNic(cleanVal(existingConcerned.nic));
                if (existingConcerned.instituteName) {
                  setSchoolName(cleanVal(existingConcerned.instituteName));
                }
                if (existingConcerned.schoolAddress) {
                  setSchoolAddress(cleanVal(existingConcerned.schoolAddress));
                }
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
    const serializedStepTaken = `[EduSecApproval:${eduSecretaryApproval}${eduSecretaryApproval === "yes" && approvalDate ? `|Date:${approvalDate}` : ""}]`;

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

        // Update the priority, complainant, school and classification in dcmms_daily_mail as well
        await supabase
          .from("dcmms_daily_mail")
          .update({
            priority: priority,
            sender_name: classification === "anonymous" ? "Anonymous" : (complainantName || null),
            sender_address: classification === "anonymous" ? "N/A" : (complainantAddress || null),
            institute_name: schoolName || null,
            subject: complaintMatter || null,
            region_province: classification === "anonymous" ? "Anonymous" : "Nominal",
          })
          .eq("ref_no", refNo);

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
            step_taken: serializedStepTaken,
          });

        if (actionError) throw actionError;

        // Save concerned officer details and school details to dcmms_concerned_officers
        const { error: concernedError } = await supabase
          .from("dcmms_concerned_officers")
          .upsert({
            id: `concerned-${refNo}`,
            case_no: refNo,
            officer_name: isConcerned === "yes" ? (officerName || null) : null,
            institute_name: schoolName || null,
            institute_address: schoolAddress || null,
            position: isConcerned === "yes" ? (officerPosition || null) : null,
            address: isConcerned === "yes" ? (officerAddress || null) : null,
            appointment_date: isConcerned === "yes" ? (officerApptDate || null) : null,
            dob: isConcerned === "yes" ? (officerDob || null) : null,
            nic: isConcerned === "yes" ? (officerNic || null) : null,
          });
        if (concernedError) throw concernedError;

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
        stepTaken: serializedStepTaken,
        specialNotes,
        isDraft: isDraftMode,
      });
      localStorage.setItem("dcmms_new_letter_current_case", JSON.stringify(cleanList));

      // Save concerned
      const storedConcerned = localStorage.getItem("dcmms_officer_concerned") || "{}";
      let concernedMap = {};
      try { concernedMap = JSON.parse(storedConcerned); } catch (e) {}
      (concernedMap as any)[refNo] = {
        caseNo: refNo,
        officerName: isConcerned === "yes" ? officerName : "",
        position: isConcerned === "yes" ? officerPosition : "",
        appointmentDate: isConcerned === "yes" ? officerApptDate : "",
        address: isConcerned === "yes" ? officerAddress : "",
        dob: isConcerned === "yes" ? officerDob : "",
        nic: isConcerned === "yes" ? officerNic : "",
        instituteName: schoolName,
        schoolAddress: schoolAddress,
      };
      localStorage.setItem("dcmms_officer_concerned", JSON.stringify(concernedMap));

      // Update case status locally
      const storedCases = localStorage.getItem("dcmms_cases");
      if (storedCases) {
        try {
          const casesList = JSON.parse(storedCases);
          const updated = casesList.map((c: any) => {
            if (c.caseNo === refNo) {
              return { ...c, status: status || c.status, isOld: complaintAge === "old" };
            }
            return c;
          });
          localStorage.setItem("dcmms_cases", JSON.stringify(updated));
        } catch (e) {}
      }

      // Also update daily mail letters details in localStorage
      const storedLetters = localStorage.getItem("dcmms_letters");
      if (storedLetters) {
        try {
          const lettersList = JSON.parse(storedLetters);
          const updatedLetters = lettersList.map((l: any) => {
            if (l.refNo === refNo) {
              return {
                ...l,
                priority: priority,
                senderName: classification === "anonymous" ? "Anonymous" : complainantName,
                senderAddress: classification === "anonymous" ? "N/A" : complainantAddress,
                instituteName: schoolName,
                subject: complaintMatter,
                regionProvince: classification === "anonymous" ? "Anonymous" : "Nominal",
              };
            }
            return l;
          });
          localStorage.setItem("dcmms_letters", JSON.stringify(updatedLetters));
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
                    <h3 className="current-details-title">
                      <svg className="card-title-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" style={{ color: "#2563eb" }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {t("currentDetails", "Current details")}
                    </h3>
                    <div className="case-details-grid">
                      {/* Case No */}
                      <div className="case-detail-item-premium">
                        <div className="detail-icon-container">
                          <svg className="detail-svg-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                          </svg>
                        </div>
                        <div className="detail-content-container">
                          <span className="detail-label-premium">{t("caseNoLabel", "Case No.")}</span>
                          <span className="detail-value-premium">{letterData.letterNo || "—"}</span>
                        </div>
                      </div>

                      {/* Name of Subject Officer */}
                      <div className="case-detail-item-premium">
                        <div className="detail-icon-container">
                          <svg className="detail-svg-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div className="detail-content-container">
                          <span className="detail-label-premium">{t("officerNameLabel", "Name of Subject Officer")}</span>
                          <span className="detail-value-premium">{letterData.officerName || "—"}</span>
                        </div>
                      </div>

                      {/* Reference Number */}
                      <div className="case-detail-item-premium">
                        <div className="detail-icon-container">
                          <svg className="detail-svg-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="detail-content-container">
                          <span className="detail-label-premium">{t("refNoLabel", "Reference Number")}</span>
                          <span className="detail-value-premium">{letterData.refNo || "—"}</span>
                        </div>
                      </div>

                      {/* Priority */}
                      <div className="case-detail-item-premium">
                        <div className="detail-icon-container">
                          <svg className="detail-svg-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <div className="detail-content-container">
                          <span className="detail-label-premium">{t("priorityLabel", "Priority")}</span>
                          <span className={`detail-priority-pill pill-${letterData.priority?.toLowerCase()}`}>
                            {letterData.priority ? (t(`priority${letterData.priority.charAt(0).toUpperCase() + letterData.priority.slice(1).toLowerCase()}`, letterData.priority) as string) : "—"}
                          </span>
                        </div>
                      </div>

                      {/* Received Date */}
                      <div className="case-detail-item-premium">
                        <div className="detail-icon-container">
                          <svg className="detail-svg-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="detail-content-container">
                          <span className="detail-label-premium">{t("receivedDateLabel", "Received Date")}</span>
                          <span className="detail-value-premium">{letterData.receivedDate || "—"}</span>
                        </div>
                      </div>

                      {/* Letter Type */}
                      <div className="case-detail-item-premium">
                        <div className="detail-icon-container">
                          <svg className="detail-svg-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="detail-content-container">
                          <span className="detail-label-premium">{t("letterTypeLabel", "Letter Type")}</span>
                          <span className="detail-value-premium">
                            {letterData.letterType ? t(letterData.letterType) : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {subsequentMails && subsequentMails.length > 0 && (
                  <div className="subsequent-letters-table-card">
                    <h2 className="card-title-header">
                      <svg className="card-title-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 19v-8.93a2 2 0 01.89-1.664l8-5.333a2 2 0 012.22 0l8 5.333A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-2.25-1.5a2 2 0 00-2.22 0l-2.25 1.5" />
                      </svg>
                      {t("subsequentMailReceivedTable", "Subsequent Letters Received for Case")}
                    </h2>
                    <div className="table-responsive-container">
                      <table className="letters-data-table subsequent-table">
                        <thead>
                          <tr>
                            <th scope="col">{t("senderName", "Sender Name")}</th>
                            <th scope="col">{t("letterType", "Letter Type")}</th>
                            <th scope="col">{t("letterDate", "Letter Date")}</th>
                            <th scope="col">{t("receivedDate", "Received Date")}</th>
                            <th scope="col">{t("nameOfOfficer", "Name of Subject Officer")}</th>
                            <th scope="col">{t("subjectText", "Subject")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subsequentMails.map((mail: any, index: number) => (
                            <tr key={mail.id || index} className="letter-table-row">
                              <td className="font-semibold text-primary">{mail.senderName}</td>
                              <td>{mail.letterType ? t(mail.letterType) : "—"}</td>
                              <td>{mail.letterDate}</td>
                              <td>{mail.receivedDate}</td>
                              <td>{mail.officerName ? t(mail.officerName) : "—"}</td>
                              <td className="subject-cell">{mail.subject}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="add-details-cards-grid">
                  {/* ───────────────── Left Card ("Complaint Information" Flowchart) ───────────────── */}
                  <div className="add-details-card">
                    <h2 className="card-title-header">
                      <svg className="card-title-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {t("complaintClassification", "Classification of Complaint")}
                    </h2>

                    <div className="flowchart-container">
                      {/* Step 1: Case Administration */}
                      <div className="flowchart-step">
                        <div className="step-indicator">1</div>
                        <div className="step-content">
                          <h3 className="step-section-title">{t("caseAdministration", "Case Administration")}</h3>
                          
                          <div className="form-grid-2">
                            {/* Reference Number */}
                            <div className="form-field-group">
                              <label htmlFor="refNo" className="field-label">
                                {t("refNo")} <span className="required-star">*</span>
                              </label>
                              <input
                                id="refNo"
                                type="text"
                                required
                                readOnly
                                value={refNo}
                                className="field-input"
                                style={{ backgroundColor: "#e2e8f0", cursor: "not-allowed" }}
                              />
                            </div>

                            {/* File number of the institute where letter was received */}
                            <div className="form-field-group">
                              <label htmlFor="fileRelated" className="field-label">
                                {t("instituteFileNo")}
                              </label>
                              <input
                                id="fileRelated"
                                type="text"
                                value={fileRelated}
                                onChange={(e) => setFileRelated(e.target.value)}
                                className="field-input"
                                placeholder="e.g. EP/DM/01"
                              />
                            </div>
                          </div>

                          <div className="form-grid-2 mt-3">
                            {/* Subject File Number (විෂය ගොනු අංකය) */}
                            <div className="form-field-group">
                              <label htmlFor="specialNotes" className="field-label">
                                {t("subjectFileNo")}
                              </label>
                              <input
                                id="specialNotes"
                                type="text"
                                value={specialNotes}
                                onChange={(e) => setSpecialNotes(e.target.value)}
                                className="field-input"
                                placeholder="e.g. SUB/FILE/102"
                              />
                            </div>

                            {/* Priority */}
                            <div className="form-field-group">
                              <label htmlFor="priority" className="field-label">
                                {t("priority")}
                              </label>
                              <div className="priority-select-wrapper">
                                <span className={`priority-dot-indicator dot-${priority}`} />
                                <div className="select-wrapper" style={{ flex: 1 }}>
                                  <select
                                    id="priority"
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value)}
                                    className="field-select"
                                  >
                                    <option value="high" className="priority-option-high">{t("priorityHigh")}</option>
                                    <option value="medium" className="priority-option-medium">{t("priorityMedium")}</option>
                                    <option value="low" className="priority-option-low">{t("priorityLow")}</option>
                                  </select>
                                  <div className="select-arrow-container">
                                    <svg className="select-arrow-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Status (තත්ත්වය) */}
                            <div className="form-field-group" style={{ gridColumn: "span 2", gap: "4px" }}>
                              <span className="field-label" style={{ display: "block" }}>
                                {t("status")} <span className="required-star">*</span>
                              </span>
                              <div className="classification-toggle-group" style={{ marginTop: "0px" }} role="radiogroup" aria-label="Report Status Toggle">
                                <button
                                  type="button"
                                  className={`toggle-btn ${reportState === "Institutional Preliminary Investigation" ? "active" : ""}`}
                                  onClick={() => setReportState("Institutional Preliminary Investigation")}
                                  aria-checked={reportState === "Institutional Preliminary Investigation"}
                                  role="radio"
                                >
                                  {t("statusInstitutionalPreliminary")}
                                </button>
                                <button
                                  type="button"
                                  className={`toggle-btn ${reportState === "Provincial Preliminary Investigation" ? "active" : ""}`}
                                  onClick={() => setReportState("Provincial Preliminary Investigation")}
                                  aria-checked={reportState === "Provincial Preliminary Investigation"}
                                  role="radio"
                                >
                                  {t("statusProvincialPreliminary")}
                                </button>
                              </div>
                            </div>

                            {/* Date prepared and submitted for signature (ලිපිය සකසා අත්සනට ඉදිරිපත් කළ දිනය) */}
                            <div className="form-field-group">
                              <label htmlFor="receivedDate" className="field-label">
                                {t("datePreparedSubmitted")}
                              </label>
                              <div className="input-icon-wrapper">
                                <input
                                  id="receivedDate"
                                  type="date"
                                  value={receivedDate}
                                  onChange={(e) => setReceivedDate(e.target.value)}
                                  className="field-input input-with-right-icon"
                                />
                                <svg className="input-right-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 2: Classification */}
                      <div className="flowchart-step">
                        <div className="step-indicator">2</div>
                        <div className="step-content">
                          <span className="field-label" style={{ display: "block", marginBottom: "8px" }}>
                            {t("complaintClassification", "Classification of complaint letter")} <span className="required-star">*</span>
                          </span>
                          <div className="classification-toggle-group" role="radiogroup" aria-label="Complaint Classification">
                            <button
                              type="button"
                              className={`toggle-btn ${classification === "nominal" ? "active" : ""}`}
                              onClick={() => setClassification("nominal")}
                              aria-checked={classification === "nominal"}
                              role="radio"
                            >
                              {t("nominalLabel", "Nominal")}
                            </button>
                            <button
                              type="button"
                              className={`toggle-btn ${classification === "anonymous" ? "active" : ""}`}
                              onClick={() => setClassification("anonymous")}
                              aria-checked={classification === "anonymous"}
                              role="radio"
                            >
                              {t("anonymousLabel", "Anonymous")}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Step 3: Complainant Details (Shown only if nominal) */}
                      {classification === "nominal" && (
                        <div className="flowchart-step animated-fade-in">
                          <div className="step-indicator">3</div>
                          <div className="step-content">
                            <h3 className="step-section-title">{t("complainantDetailsTitle", "Complainant Details")}</h3>
                            <div className="form-grid-2">
                              <div className="form-field-group">
                                <label htmlFor="complainantName" className="field-label">
                                  {t("complainantName", "Name of the person presenting the complaint")} <span className="required-star">*</span>
                                </label>
                                <input
                                  id="complainantName"
                                  type="text"
                                  required={classification === "nominal"}
                                  value={complainantName}
                                  onChange={(e) => setComplainantName(e.target.value)}
                                  className="field-input"
                                  placeholder="Enter name..."
                                />
                              </div>
                              <div className="form-field-group">
                                <label htmlFor="complainantAddress" className="field-label">
                                  {t("complainantAddress", "Address of the person presenting the complaint")}
                                </label>
                                <input
                                  id="complainantAddress"
                                  type="text"
                                  value={complainantAddress}
                                  onChange={(e) => setComplainantAddress(e.target.value)}
                                  className="field-input"
                                  placeholder="Enter address..."
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>

                  {/* ───────────────── Right Card ("Related Person & Status" Flowchart) ───────────────── */}
                  <div className="add-details-card">
                    <h2 className="card-title-header">
                      <svg className="card-title-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                      {t("relatedPersonStatus", "Related Person & Status")}
                    </h2>

                    <div className="flowchart-container">
                      {/* Step 4: Concerned Person */}
                      <div className="flowchart-step">
                        <div className="step-indicator">{classification === "nominal" ? "4" : "3"}</div>
                        <div className="step-content">
                          <span className="field-label" style={{ display: "block", marginBottom: "8px" }}>
                            {t("personRelatedQuestion", "Is there a person related to the complaint?")}
                          </span>
                          <div className="classification-toggle-group" role="radiogroup" aria-label="Concerned Person Toggle">
                            <button
                              type="button"
                              className={`toggle-btn ${isConcerned === "yes" ? "active" : ""}`}
                              onClick={() => setIsConcerned("yes")}
                              aria-checked={isConcerned === "yes"}
                              role="radio"
                            >
                              {t("yesLabel", "Yes")}
                            </button>
                            <button
                              type="button"
                              className={`toggle-btn ${isConcerned === "no" ? "active" : ""}`}
                              onClick={() => setIsConcerned("no")}
                              aria-checked={isConcerned === "no"}
                              role="radio"
                            >
                              {t("noLabel", "No")}
                            </button>
                          </div>

                          {isConcerned === "yes" && (
                            <div className="concerned-person-fields animated-fade-in" style={{ marginTop: "20px" }}>
                              <h3 className="step-section-title">{t("personRelatedDetails", "Concerned Person Details")}</h3>
                              <div className="form-grid-2">
                                <div className="form-field-group">
                                  <label htmlFor="officerName" className="field-label">
                                    {t("personName", "Person's Name")} <span className="required-star">*</span>
                                  </label>
                                  <input
                                    id="officerName"
                                    type="text"
                                    required={isConcerned === "yes"}
                                    value={officerName}
                                    onChange={(e) => setOfficerName(e.target.value)}
                                    className="field-input"
                                    placeholder="Enter name..."
                                  />
                                </div>
                                <div className="form-field-group">
                                  <label htmlFor="officerPosition" className="field-label">
                                    {t("personDesignation", "Person's Designation / Position")}
                                  </label>
                                  <input
                                    id="officerPosition"
                                    type="text"
                                    value={officerPosition}
                                    onChange={(e) => setOfficerPosition(e.target.value)}
                                    className="field-input"
                                    placeholder="Enter position..."
                                  />
                                </div>
                              </div>

                              <div className="form-grid-2 mt-3">
                                <div className="form-field-group">
                                  <label htmlFor="officerDob" className="field-label">{t("dateOfBirth")}</label>
                                  <input
                                    id="officerDob"
                                    type="date"
                                    value={officerDob}
                                    onChange={(e) => setOfficerDob(e.target.value)}
                                    className="field-input"
                                  />
                                </div>
                                <div className="form-field-group">
                                  <label htmlFor="officerNic" className="field-label">{t("nicNumber")}</label>
                                  <input
                                    id="officerNic"
                                    type="text"
                                    value={officerNic}
                                    onChange={(e) => setOfficerNic(e.target.value)}
                                    className="field-input"
                                    placeholder="NIC number"
                                  />
                                </div>
                              </div>

                              <div className="form-grid-2 mt-3">
                                <div className="form-field-group">
                                  <label htmlFor="officerApptDate" className="field-label">{t("appointmentDate")}</label>
                                  <input
                                    id="officerApptDate"
                                    type="date"
                                    value={officerApptDate}
                                    onChange={(e) => setOfficerApptDate(e.target.value)}
                                    className="field-input"
                                  />
                                </div>
                                <div className="form-field-group">
                                  <label htmlFor="officerAddress" className="field-label">{t("addressLabel")}</label>
                                  <input
                                    id="officerAddress"
                                    type="text"
                                    value={officerAddress}
                                    onChange={(e) => setOfficerAddress(e.target.value)}
                                    className="field-input"
                                    placeholder="Address"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Step 5: School Details */}
                      <div className="flowchart-step">
                        <div className="step-indicator">{classification === "nominal" ? "5" : "4"}</div>
                        <div className="step-content">
                          <h3 className="step-section-title">{t("schoolDetailsTitle", "School Details")}</h3>
                          <div className="form-grid-2">
                            <div className="form-field-group">
                              <label htmlFor="schoolName" className="field-label">
                                {t("schoolName", "School Name")} <span className="required-star">*</span>
                              </label>
                              <input
                                id="schoolName"
                                type="text"
                                required
                                value={schoolName}
                                onChange={(e) => setSchoolName(e.target.value)}
                                className="field-input"
                                placeholder="Enter school name..."
                              />
                            </div>
                            <div className="form-field-group">
                              <label htmlFor="schoolAddress" className="field-label">
                                {t("schoolAddress", "School Address")}
                              </label>
                              <input
                                id="schoolAddress"
                                type="text"
                                value={schoolAddress}
                                onChange={(e) => setSchoolAddress(e.target.value)}
                                className="field-input"
                                placeholder="Enter school address..."
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 6: Subject Matter */}
                      <div className="flowchart-step">
                        <div className="step-indicator">{classification === "nominal" ? "6" : "5"}</div>
                        <div className="step-content">
                          <div className="form-field-group">
                            <label htmlFor="complaintMatter" className="field-label">
                              {t("complaintMatterLabel", "Matter related to the complaint")} <span className="required-star">*</span>
                            </label>
                            <textarea
                              id="complaintMatter"
                              required
                              value={complaintMatter}
                              onChange={(e) => setComplaintMatter(e.target.value)}
                              className="field-textarea"
                              placeholder="Enter details of the complaint matter..."
                              rows={4}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Step 7: Education Secretary's Approval */}
                      <div className="flowchart-step">
                        <div className="step-indicator">{classification === "nominal" ? "7" : "6"}</div>
                        <div className="step-content">
                          <span className="field-label" style={{ display: "block", marginBottom: "8px" }}>
                            {t("eduSecretaryApproval", "Education Secretary's Approval")} <span className="required-star">*</span>
                          </span>
                          <div className="classification-toggle-group" role="radiogroup" aria-label="Education Secretary Approval Toggle">
                            <button
                              type="button"
                              className={`toggle-btn ${eduSecretaryApproval === "yes" ? "active" : ""}`}
                              onClick={() => setEduSecretaryApproval("yes")}
                              aria-checked={eduSecretaryApproval === "yes"}
                              role="radio"
                            >
                              {t("yesLabel", "Yes")}
                            </button>
                            <button
                              type="button"
                              className={`toggle-btn ${eduSecretaryApproval === "no" ? "active" : ""}`}
                              onClick={() => setEduSecretaryApproval("no")}
                              aria-checked={eduSecretaryApproval === "no"}
                              role="radio"
                            >
                              {t("noLabel", "No")}
                            </button>
                          </div>

                          {eduSecretaryApproval === "yes" && (
                            <div className="form-field-group animated-fade-in" style={{ marginTop: "16px" }}>
                              <label htmlFor="approvalDate" className="field-label">
                                {t("approvalDate", "Approved Date")} <span className="required-star">*</span>
                              </label>
                              <input
                                id="approvalDate"
                                type="date"
                                required={eduSecretaryApproval === "yes"}
                                value={approvalDate}
                                onChange={(e) => setApprovalDate(e.target.value)}
                                className="field-input"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* Timeline of actions taken (placed at the bottom of the card) */}
                    {previousActions && previousActions.length > 0 && (
                      <div className="previous-actions-timeline" style={{ marginTop: "32px", paddingTop: "24px", borderTop: "2px solid #e2e8f0" }}>
                        <h3 className="timeline-title" style={{ fontSize: "15px", fontWeight: "700" }}>
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
                              <p className="timeline-step">{formatStepTaken(act.stepTaken, t)}</p>
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
          <SiteFooter />
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
