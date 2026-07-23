"use client";

import "@/i18n";
import "../../daily-mail/daily-mail.css";
import "../../dashboard-common.css";
import "../../subject/subject.css";
import "../../subject/add-details/add-details.css";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sidebar } from "@/components/Sidebar";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getCurrentProfile, signOut } from "@/lib/auth";
import { 
  Shield, User, Calendar as CalendarIcon, FileCheck, Send, Clock, 
  CheckCircle, ArrowLeft, RefreshCw, AlertCircle, Award, Building, 
  MapPin, CreditCard, UserPlus, CheckSquare, FileText, Info, X
} from "lucide-react";

function InvestigationCaseDetailsContent() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const caseNoParam = searchParams?.get("caseNo") || "INQ/2026/001";
  const lang = i18n.language;

  // Layout & Accessibility State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Case Data State
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [officers, setOfficers] = useState<any[]>([]);
  const [concernedOfficersList, setConcernedOfficersList] = useState<any[]>([]);
  const [existingAssignment, setExistingAssignment] = useState<any>(null);
  const [previousActions, setPreviousActions] = useState<any[]>([]);

  // Form State
  const [assignee, setAssignee] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [status, setStatus] = useState("In Progress");
  const [inquiryNotes, setInquiryNotes] = useState("");

  // Step 1: Assign Officers to Subject Officer (1 Chairman + Many Members)
  const [step1AssignedOfficers, setStep1AssignedOfficers] = useState("");
  const [selectedChairman, setSelectedChairman] = useState<any | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<any[]>([]);
  const [memberSelectId, setMemberSelectId] = useState("");
  
  // Step 3: Extension of Dates (Start & End Date, Term: First, Second, Third)
  const [step3Term, setStep3Term] = useState<"First" | "Second" | "Third">("First");
  const [step3StartDate, setStep3StartDate] = useState("");
  const [step3EndDate, setStep3EndDate] = useState("");

  // Step 5: Send Report Submit Date (Approval Date)
  const [step4ApprovalDate, setStep4ApprovalDate] = useState("");

  // Sync title and language
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `Investigation Case ${caseNoParam} | DCMMS`;
  }, [lang, caseNoParam]);

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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut();
    router.push("/login");
  };

  // Load Case Details & Data Flow Assignments
  useEffect(() => {
    const loadDetails = async () => {
      setIsLoading(true);

      // Load registered officers strictly from the Investigation Officer Registration Form storage
      let fetchedOfficers: any[] = [];
      if (typeof window !== "undefined") {
        const storedInv = localStorage.getItem("dcmms_investigation_officers");
        if (storedInv) {
          try {
            const list = JSON.parse(storedInv);
            if (Array.isArray(list)) fetchedOfficers.push(...list);
          } catch (e) {}
        }

        const storedCustom = localStorage.getItem("dcmms_custom_profiles");
        if (storedCustom) {
          try {
            const list = JSON.parse(storedCustom);
            if (Array.isArray(list)) {
              list.forEach((item: any) => {
                if (!fetchedOfficers.some((o) => o.id === item.id || o.fullName === item.fullName)) {
                  fetchedOfficers.push({
                    id: item.id,
                    fullName: item.fullName,
                    nicNo: item.nicNo,
                    officerRole: item.officerRole || "Member",
                    studiedSchools: item.studiedSchools || [],
                    childrenSchools: item.childrenSchools || [],
                    email: item.email,
                    role: item.role,
                    status: item.status,
                  });
                }
              });
            }
          } catch (e) {}
        }
      }

      if (isSupabaseConfigured) {
        try {
          const { data: dbInv } = await supabase.from("dcmms_investigation_officers").select("*");
          if (dbInv && dbInv.length > 0) {
            dbInv.forEach((p: any) => {
              const mapped = {
                id: p.id,
                fullName: p.full_name || p.fullName,
                nicNo: p.nic_no || p.nicNo,
                officerRole: p.officer_role || p.officerRole || "Member",
                studiedSchools: p.studied_schools || p.studiedSchools || [],
                childrenSchools: p.children_schools || p.childrenSchools || [],
                email: p.email,
                role: p.role,
                status: p.status,
              };
              if (!fetchedOfficers.some((o) => o.id === mapped.id || o.fullName === mapped.fullName)) {
                fetchedOfficers.push(mapped);
              }
            });
          }
        } catch (e) {
          console.warn("Supabase investigation officers load warning:", e);
        }
      }

      setOfficers(fetchedOfficers);

      // Load case data
      let matchedCase: any = null;
      if (typeof window !== "undefined") {
        const storedCases = localStorage.getItem("dcmms_cases");
        if (storedCases) {
          try {
            const list = JSON.parse(storedCases);
            matchedCase = list.find((c: any) => c.caseNo === caseNoParam || c.inquiryNo === caseNoParam);
          } catch (e) {}
        }
      }

      if (!matchedCase) {
        matchedCase = {
          id: `case-${Date.now()}`,
          inquiryNo: caseNoParam,
          caseNo: caseNoParam,
          subject: "Formal disciplinary inquiry regarding misconduct",
          targetDate: new Date().toISOString().slice(0, 10),
          assignee: "Kavishan",
          status: "In Progress",
          inquiryNotes: "",
          complainantName: "Director of Education",
        };
      }

      setSelectedCase(matchedCase);
      setAssignee(matchedCase.assignee || "");
      setTargetDate(matchedCase.targetDate || new Date().toISOString().slice(0, 10));
      setStatus(matchedCase.status || "In Progress");
      setInquiryNotes(matchedCase.inquiryNotes || matchedCase.notes || "");

      // Load accused/concerned officer details
      if (typeof window !== "undefined") {
        const storedConcerned = localStorage.getItem("dcmms_officer_concerned");
        if (storedConcerned) {
          try {
            const concernedMap = JSON.parse(storedConcerned);
            const entry = concernedMap[caseNoParam];
            if (entry) {
              if (Array.isArray(entry.persons) && entry.persons.length > 0) {
                setConcernedOfficersList(entry.persons);
              } else if (entry.officerName) {
                setConcernedOfficersList([{
                  officer_name: entry.officerName,
                  nic: entry.nic,
                  position: entry.position,
                  institute_name: entry.instituteName,
                  address: entry.address,
                }]);
              }
            }
          } catch (e) {}
        }
      }

      // Load Data Flow Assignment
      let assignment: any = null;
      if (typeof window !== "undefined") {
        const storedAsgn = localStorage.getItem("dcmms_subject_assignments");
        if (storedAsgn) {
          try {
            const list = JSON.parse(storedAsgn);
            assignment = list.find((a: any) => a.caseNo === caseNoParam);
          } catch (e) {}
        }
      }
      setExistingAssignment(assignment);
      if (assignment) {
        if (assignment.assignedOfficers) setStep1AssignedOfficers(assignment.assignedOfficers);
        if (assignment.extensionTerm) setStep3Term(assignment.extensionTerm);
        if (assignment.extensionStartDate) setStep3StartDate(assignment.extensionStartDate);
        if (assignment.extensionEndDate) setStep3EndDate(assignment.extensionEndDate);
        if (assignment.reportSubmitDate) setStep4ApprovalDate(assignment.reportSubmitDate);
      }

      // Load previous actions history
      let loadedActions: any[] = [];
      if (typeof window !== "undefined") {
        const storedActions = localStorage.getItem("dcmms_new_letter_current_case") || "[]";
        try {
          const list = JSON.parse(storedActions);
          if (Array.isArray(list)) {
            loadedActions = list.filter((a: any) => a.caseNo === caseNoParam || a.inquiryNo === caseNoParam);
          }
        } catch (e) {}
      }

      if (isSupabaseConfigured) {
        try {
          const { data: actionsData } = await supabase
            .from("dcmms_subject_details")
            .select("*")
            .eq("case_no", caseNoParam)
            .order("received_date", { ascending: false });

          if (actionsData && actionsData.length > 0) {
            const mapped = actionsData.map((d: any) => ({
              id: d.id,
              caseNo: d.case_no,
              receivedDate: d.received_date,
              reportState: d.report_state,
              specialNotes: d.special_notes,
              subjectOfficerName: d.subject_officer_name,
              stepTaken: d.step_taken,
            }));
            loadedActions = [...loadedActions, ...mapped];
          }
        } catch (e) {}
      }

      setPreviousActions(loadedActions);

      setIsLoading(false);
    };

    loadDetails();
  }, [caseNoParam]);

  // Helper to save assignment
  const saveSubjectAssignment = async (updatedFields: Partial<any>) => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_subject_assignments") || "[]";
      let list: any[] = [];
      try { list = JSON.parse(stored); } catch (e) {}
      
      const idx = list.findIndex((a) => a.caseNo === caseNoParam);
      const updated = {
        id: assignmentExistingId(),
        caseNo: caseNoParam,
        subjectOfficerName: "Subject Officer",
        status: status,
        updatedAt: new Date().toISOString(),
        ...(idx >= 0 ? list[idx] : {}),
        ...updatedFields,
      };

      if (idx >= 0) list[idx] = updated;
      else list.push(updated);

      localStorage.setItem("dcmms_subject_assignments", JSON.stringify(list));
      setExistingAssignment(updated);

      if (isSupabaseConfigured) {
        try {
          await supabase.from("dcmms_subject_assignments").upsert({
            id: updated.id,
            case_no: updated.caseNo,
            subject_officer_name: updated.subjectOfficerName,
            status: updated.status,
            assigned_officers: updated.assignedOfficers || null,
            appointment_date: updated.appointmentDate || null,
            report_due_date: updated.reportDueDate || null,
            extension_term: updated.extensionTerm || null,
            extension_start_date: updated.extensionStartDate || null,
            extension_end_date: updated.extensionEndDate || null,
            certification_submitted: updated.certificationSubmitted || false,
            report_submit_date: updated.reportSubmitDate || null,
            report_content: updated.reportContent || null,
          });
        } catch (e) {}
      }
    }
  };

  const assignmentExistingId = () => existingAssignment?.id || `asgn-${Date.now()}`;

  // Step 1: Admin Submits Assigned Officers (1 Chairman & Many Members)
  const handleStep1SubmitOfficers = async () => {
    if (!selectedChairman && selectedMembers.length === 0 && !step1AssignedOfficers.trim()) {
      alert("Please select a Chairman or at least one Committee Member.");
      return;
    }

    const chairmanPart = selectedChairman ? `Chairman: ${selectedChairman.fullName}` : "";
    const membersPart = selectedMembers.length > 0 ? `Members: ${selectedMembers.map((m) => m.fullName).join(", ")}` : "";
    const formattedAssignedText = [chairmanPart, membersPart].filter(Boolean).join(" | ") || step1AssignedOfficers;

    setStep1AssignedOfficers(formattedAssignedText);

    await saveSubjectAssignment({
      assignedOfficers: formattedAssignedText,
      chairman: selectedChairman,
      members: selectedMembers,
      status: "Officers Assigned",
    });
    showToast("Step 1: Assigned Officers Committee (1 Chairman & Members) submitted to Subject Officer!");
  };

  // Step 3: Admin Sends Extension Request
  const handleStep3RequestExtension = async () => {
    if (!step3StartDate || !step3EndDate) {
      alert("Please select both Extension Start Date and End Date.");
      return;
    }
    await saveSubjectAssignment({
      extensionTerm: step3Term,
      extensionStartDate: step3StartDate,
      extensionEndDate: step3EndDate,
      certificationSubmitted: false,
    });
    showToast(`Step 3: Extension Request (${step3Term} Term) sent to Subject Officer!`);
  };

  // Step 5: Admin Sends Report Submit Date
  const handleStep4SubmitFinalReport = async () => {
    if (!step4ApprovalDate) {
      alert("Please select Report Submit Date.");
      return;
    }
    await saveSubjectAssignment({
      reportSubmitDate: step4ApprovalDate,
      status: "Approved",
    });
    showToast("Step 5: Report Submit Date sent to Subject Officer!");
  };

  // Submit Main Investigation Form
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    if (typeof window !== "undefined") {
      const storedCases = localStorage.getItem("dcmms_cases");
      if (storedCases) {
        try {
          const list = JSON.parse(storedCases);
          const updatedList = list.map((c: any) => {
            if (c.caseNo === caseNoParam || c.inquiryNo === caseNoParam) {
              return {
                ...c,
                assignee,
                targetDate,
                status,
                inquiryNotes,
                updatedAt: new Date().toISOString(),
              };
            }
            return c;
          });
          localStorage.setItem("dcmms_cases", JSON.stringify(updatedList));
        } catch (e) {}
      }

      // Save action entry into previous actions history
      const newActionItem = {
        id: `act-${Date.now()}`,
        caseNo: caseNoParam,
        receivedDate: new Date().toISOString().slice(0, 10),
        reportState: status,
        specialNotes: inquiryNotes,
        subjectOfficerName: assignee || "Investigation Officer",
        stepTaken: `Inquiry progress updated (${status}). Assigned: ${assignee || "Officer"}.`,
      };

      const storedActions = localStorage.getItem("dcmms_new_letter_current_case") || "[]";
      let actionsList = [];
      try { actionsList = JSON.parse(storedActions); } catch (e) {}
      if (!Array.isArray(actionsList)) actionsList = [];
      actionsList.unshift(newActionItem);
      localStorage.setItem("dcmms_new_letter_current_case", JSON.stringify(actionsList));
      setPreviousActions((prev) => [newActionItem, ...prev]);
    }

    setIsSaving(false);
    showToast("Investigation record saved successfully!");
    setTimeout(() => {
      router.push("/investigation");
    }, 1000);
  };

  if (isLoading) {
    return (
      <div className="page-loading-container" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "12px" }}>
        <RefreshCw size={32} className="animate-spin" style={{ color: "#4f46e5" }} />
        <span>Loading investigation case records...</span>
      </div>
    );
  }

  return (
    <div className="dashboard-container" data-font-scale={fontScale}>
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
        role="investigation"
      />

      <div className="dashboard-layout">
        <main id="dashboard-main-content" className="dashboard-content">

          {/* ── Top Header App Bar ── */}
          <header className="dashboard-header">
            <div className="dashboard-header-left">
              <button
                className="menu-toggle-btn"
                aria-label="Toggle Sidebar Menu"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                <svg className="hamburger-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="dashboard-title-area">
                <h2 className="dashboard-main-title">
                  {lang === "si" ? "විමර්ශන පරිපාලක උපකරණ පුවරුව" : "Investigation Administrator"}
                </h2>
                <p className="dashboard-main-subtitle">
                  {lang === "si" ? "විමර්ශන පියවර සහ දත්ත ප්‍රවාහය කළමනාකරණය" : "Investigation Progress & Subject Officer Data Flow"}
                </p>
              </div>
            </div>

            <div className="dashboard-header-right">
              <div className="date-badge">
                <span suppressHydrationWarning>{getFormattedDate()}</span>
                <svg className="date-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>

              <div className="divider-line" aria-hidden="true" />

              <div className="accessibility-adjuster-bar" role="radiogroup" aria-label="Font Sizing">
                <label className={`size-btn size-btn-small${fontScale === "small" ? " active" : ""}`}>
                  <input type="radio" name="fontScale" value="small" checked={fontScale === "small"} onChange={() => setFontScale("small")} className="sr-only" /> A
                </label>
                <label className={`size-btn size-btn-medium${fontScale === "medium" ? " active" : ""}`}>
                  <input type="radio" name="fontScale" value="medium" checked={fontScale === "medium"} onChange={() => setFontScale("medium")} className="sr-only" /> A
                </label>
                <label className={`size-btn size-btn-large${fontScale === "large" ? " active" : ""}`}>
                  <input type="radio" name="fontScale" value="large" checked={fontScale === "large"} onChange={() => setFontScale("large")} className="sr-only" /> A
                </label>
              </div>

              <div className="divider-line" aria-hidden="true" />

              <div className="trilingual-language-selector">
                <label className={`lang-btn${lang === "si" ? " active" : ""}`}>
                  <input type="radio" name="lang" value="si" checked={lang === "si"} onChange={() => i18n.changeLanguage("si")} className="sr-only" /> සිංහල
                </label>
                <label className={`lang-btn${lang === "ta" ? " active" : ""}`}>
                  <input type="radio" name="lang" value="ta" checked={lang === "ta"} onChange={() => i18n.changeLanguage("ta")} className="sr-only" /> தமிழ்
                </label>
                <label className={`lang-btn${lang === "en" ? " active" : ""}`}>
                  <input type="radio" name="lang" value="en" checked={lang === "en"} onChange={() => i18n.changeLanguage("en")} className="sr-only" /> English
                </label>
              </div>
            </div>
          </header>

          {/* ── Main Form Page Section ── */}
          <section className="add-details-page-wrapper">
            <div className="add-details-main-card">
              
              {/* Header Title Bar */}
              <div className="add-details-header-container">
                <div className="add-details-header-left">
                  <h1 className="add-details-title" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Shield size={24} style={{ color: "#4f46e5" }} />
                    <span>{lang === "si" ? "විමර්ශන විස්තර සහ ප්‍රගති සටහන්" : "Investigation Progress & Action Form"}</span>
                  </h1>
                  <p className="add-details-subtitle">
                    Ref: <strong style={{ color: "#4f46e5" }}>{caseNoParam}</strong> | Target: <strong>{targetDate}</strong>
                  </p>
                </div>
                <div className="add-details-header-right-btns">
                  <Link href="/investigation" className="btn-back-home">
                    <svg className="btn-back-home-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    {lang === "si" ? "නැවත ප්‍රධාන පුවරුවට" : "Back to Dashboard"}
                  </Link>
                </div>
              </div>

              <form onSubmit={handleSaveForm} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>

                {/* Previous Subject Details Card */}
                <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #cbd5e1", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                  <h4 style={{ margin: "0 0 14px 0", fontSize: "15px", color: "#1e1b4b", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                    <FileText size={18} style={{ color: "#4f46e5" }} />
                    <span>{lang === "si" ? "පෙර විෂය නිලධාරී සටහන් සහ විෂය විස්තර" : "Previous Subject Officer Details & Case Metadata"}</span>
                  </h4>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
                    
                    {/* Case No */}
                    <div style={{ backgroundColor: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "block" }}>
                        {lang === "si" ? "නඩු අංකය / යොමු අංකය" : "Case / Reference No"}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#4f46e5" }}>
                        {caseNoParam}
                      </span>
                    </div>

                    {/* Subject Officer */}
                    <div style={{ backgroundColor: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "block" }}>
                        {lang === "si" ? "විෂය නිලධාරියාගේ නම" : "Name of Subject Officer"}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                        {existingAssignment?.subjectOfficerName || selectedCase?.subjectOfficerName || selectedCase?.officerName || "Subject Officer"}
                      </span>
                    </div>

                    {/* Complainant */}
                    <div style={{ backgroundColor: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "block" }}>
                        {lang === "si" ? "පැමිණිලිකරුගේ නම" : "Complainant Name"}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                        {selectedCase?.complainantName || "Director of Education"}
                      </span>
                    </div>

                    {/* Target / Due Date */}
                    <div style={{ backgroundColor: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "block" }}>
                        {lang === "si" ? "වාර්තා භාරදිය යුතු දිනය" : "Report Due Date"}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#dc2626" }}>
                        {existingAssignment?.reportDueDate || selectedCase?.targetDate || "2026-06-05"}
                      </span>
                    </div>

                  </div>

                  {/* Complaint Matter */}
                  <div style={{ marginTop: "14px", backgroundColor: "#f8fafc", padding: "12px 14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                    <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", display: "block" }}>
                      {lang === "si" ? "පෙර විෂය කරුණ / පැමිණිල්ලේ සාරාංශය" : "Subject Matter / Complaint Summary"}
                    </span>
                    <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#1e293b", fontWeight: 600 }}>
                      {selectedCase?.subject || "Formal disciplinary inquiry regarding teacher absenteeism and misconduct"}
                    </p>
                  </div>
                </div>

                {/* Accused Officer Personal Record Details */}
                <div style={{ backgroundColor: "#ffffff", padding: "18px", borderRadius: "12px", border: "1px solid #cbd5e1" }}>
                  <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#1e1b4b", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                    <User size={16} style={{ color: "#4f46e5" }} />
                    <span>{lang === "si" ? "චෝදනා ලැබූ නිලධාරියාගේ තොරතුරු" : "Accused Officer Personal Record"}</span>
                  </h4>

                  {concernedOfficersList.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {concernedOfficersList.map((officer, idx) => (
                        <div key={idx} style={{ backgroundColor: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                            <div>
                              <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>Officer Name</span>
                              <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{officer.officer_name || officer.officerName || "—"}</span>
                            </div>
                            <div>
                              <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>NIC Number</span>
                              <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{officer.nic || "—"}</span>
                            </div>
                            <div>
                              <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>Designation</span>
                              <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{officer.position || "—"}</span>
                            </div>
                            <div>
                              <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>School / Institute</span>
                              <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{officer.institute_name || officer.instituteName || "—"}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", padding: "12px 16px", backgroundColor: "#fffbeb", color: "#b45309", borderRadius: "8px", border: "1px solid #fef3c7" }}>
                      <AlertCircle size={18} />
                      <span style={{ fontSize: "13px" }}>No specific accused officer personal record registered for this inquiry yet.</span>
                    </div>
                  )}
                </div>



                {/* ==================== INVESTIGATION ADMIN <-> SUBJECT OFFICER DATA FLOW ==================== */}
                <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #cbd5e1", display: "flex", flexDirection: "column", gap: "16px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.03)" }}>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
                    <h4 style={{ margin: 0, fontSize: "16px", color: "#0369a1", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                      <Send size={20} style={{ color: "#0284c7" }} />
                      <span>Investigation Administrator &amp; Subject Officer Data Flow</span>
                    </h4>
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "4px 12px", borderRadius: "12px", backgroundColor: existingAssignment?.reportContent ? "#dcfce7" : "#e0f2fe", color: existingAssignment?.reportContent ? "#166534" : "#0369a1" }}>
                      {existingAssignment?.reportContent ? "✓ Final Report Completed" : "Data Flow In Progress"}
                    </span>
                  </div>

                  {/* FLOW STEP 1: Select & Assign Registered Officers (1 Chairman & Many Members) */}
                  <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#1e1b4b", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <UserPlus size={16} style={{ color: "#4f46e5" }} />
                        <span>1. Select &amp; Submit Assigned Officers (Admin ➔ Subject Officer)</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <Link
                          href="/investigation/officer-registration"
                          style={{ fontSize: "12px", color: "#4f46e5", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px", backgroundColor: "#e0e7ff", padding: "4px 10px", borderRadius: "8px", textDecoration: "none" }}
                        >
                          <UserPlus size={13} />
                          <span>{lang === "si" ? "+ පරීක්ෂණ නිලධාරී ලියාපදිංචි කිරීමේ පෝරමය" : "+ Register Officer Form"}</span>
                        </Link>
                        <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
                          Structure: 1 Chairman + Committee Members
                        </span>
                      </div>
                    </div>

                    {/* SELECT 1 CHAIRMAN */}
                    <div style={{ backgroundColor: "#ffffff", padding: "14px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
                      <label style={{ fontSize: "12px", fontWeight: 700, color: "#92400e", display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                        <Award size={14} style={{ color: "#d97706" }} />
                        <span>{lang === "si" ? "සභාපති තෝරන්න (Select 1 Chairman):" : "Select Committee Chairman (1 Chairman):"}</span>
                      </label>

                      <select
                        value={selectedChairman?.id || ""}
                        onChange={(e) => {
                          const found = officers.find((o) => o.id === e.target.value);
                          setSelectedChairman(found || null);
                        }}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", backgroundColor: "#ffffff", fontWeight: 600 }}
                      >
                        <option value="">-- Choose Chairman --</option>
                        {officers.map((o) => (
                          <option key={o.id} value={o.id}>
                            [{o.officerRole || "Officer"}] {o.fullName} (NIC: {o.nicNo || "N/A"})
                          </option>
                        ))}
                      </select>

                      {/* Selected Chairman Officer Card with Schools */}
                      {selectedChairman && (
                        <div style={{ marginTop: "10px", padding: "12px", borderRadius: "8px", backgroundColor: "#fffbeb", border: "1px solid #fde68a" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontWeight: 700, color: "#78350f", fontSize: "14px" }}>{selectedChairman.fullName}</span>
                              <span style={{ fontSize: "11px", backgroundColor: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: "10px", fontWeight: 700 }}>
                                Chairman (සභාපති)
                              </span>
                            </div>
                            <span style={{ fontSize: "12px", color: "#64748b" }}>NIC: <strong>{selectedChairman.nicNo || "N/A"}</strong></span>
                          </div>

                          {/* Studied Schools */}
                          <div style={{ fontSize: "12px", marginTop: "6px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 600, color: "#0369a1" }}>🎓 Studied Schools:</span>
                            {selectedChairman.studiedSchools && selectedChairman.studiedSchools.length > 0 ? (
                              selectedChairman.studiedSchools.map((s: string, idx: number) => (
                                <span key={idx} style={{ backgroundColor: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600 }}>
                                  {s}
                                </span>
                              ))
                            ) : (
                              <span style={{ color: "#94a3b8", fontStyle: "italic" }}>None listed</span>
                            )}
                          </div>

                          {/* Children's Schools */}
                          <div style={{ fontSize: "12px", marginTop: "4px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 600, color: "#b45309" }}>🏫 Children's Schools:</span>
                            {selectedChairman.childrenSchools && selectedChairman.childrenSchools.length > 0 ? (
                              selectedChairman.childrenSchools.map((s: string, idx: number) => (
                                <span key={idx} style={{ backgroundColor: "#fef3c7", color: "#b45309", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600 }}>
                                  {s}
                                </span>
                              ))
                            ) : (
                              <span style={{ color: "#94a3b8", fontStyle: "italic" }}>None listed</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* SELECT MANY MEMBERS */}
                    <div style={{ backgroundColor: "#ffffff", padding: "14px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
                      <label style={{ fontSize: "12px", fontWeight: 700, color: "#3730a3", display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                        <User size={14} style={{ color: "#4f46e5" }} />
                        <span>{lang === "si" ? "සාමාජිකයින් තෝරන්න (Select Committee Members - Add Many):" : "Select Committee Members (Add Many Members):"}</span>
                      </label>

                      <div style={{ display: "flex", gap: "8px" }}>
                        <select
                          value={memberSelectId}
                          onChange={(e) => setMemberSelectId(e.target.value)}
                          style={{ flex: 1, padding: "9px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", backgroundColor: "#ffffff" }}
                        >
                          <option value="">-- Choose Member Officer to Add --</option>
                          {officers
                            .filter((o) => o.id !== selectedChairman?.id && !selectedMembers.some((m) => m.id === o.id))
                            .map((o) => (
                              <option key={o.id} value={o.id}>
                                [{o.officerRole || "Member"}] {o.fullName} (NIC: {o.nicNo || "N/A"})
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            if (memberSelectId) {
                              const found = officers.find((o) => o.id === memberSelectId);
                              if (found) {
                                setSelectedMembers((prev) => [...prev, found]);
                                setMemberSelectId("");
                              }
                            }
                          }}
                          style={{ padding: "9px 16px", backgroundColor: "#4f46e5", color: "#ffffff", border: "none", borderRadius: "8px", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
                        >
                          + Add Member
                        </button>
                      </div>

                      {/* Selected Members Cards List */}
                      {selectedMembers.length > 0 && (
                        <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                          {selectedMembers.map((mem, idx) => (
                            <div key={mem.id || idx} style={{ padding: "10px 12px", borderRadius: "8px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <span style={{ fontWeight: 700, color: "#166534", fontSize: "13px" }}>{mem.fullName}</span>
                                  <span style={{ fontSize: "10px", backgroundColor: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: "10px", fontWeight: 700 }}>
                                    Member #{idx + 1}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedMembers((prev) => prev.filter((m) => m.id !== mem.id))}
                                  style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center" }}
                                  title="Remove member"
                                >
                                  <X size={16} />
                                </button>
                              </div>

                              {/* Studied & Children's Schools */}
                              <div style={{ display: "flex", gap: "12px", marginTop: "4px", fontSize: "11px", flexWrap: "wrap" }}>
                                <div>
                                  <span style={{ fontWeight: 600, color: "#0369a1" }}>🎓 Studied: </span>
                                  {mem.studiedSchools && mem.studiedSchools.length > 0 ? (
                                    mem.studiedSchools.join(", ")
                                  ) : (
                                    <span style={{ color: "#94a3b8" }}>—</span>
                                  )}
                                </div>
                                <div>
                                  <span style={{ fontWeight: 600, color: "#b45309" }}>🏫 Children: </span>
                                  {mem.childrenSchools && mem.childrenSchools.length > 0 ? (
                                    mem.childrenSchools.join(", ")
                                  ) : (
                                    <span style={{ color: "#94a3b8" }}>—</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Submit Assigned Officers Button */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginTop: "4px" }}>
                      <button
                        type="button"
                        onClick={handleStep1SubmitOfficers}
                        style={{ padding: "10px 20px", backgroundColor: "#4f46e5", color: "#ffffff", border: "none", borderRadius: "8px", fontWeight: 600, fontSize: "13px", cursor: "pointer", boxShadow: "0 2px 4px rgba(79,70,229,0.2)" }}
                      >
                        Submit Assigned Officers Committee
                      </button>

                      {existingAssignment?.assignedOfficers && (
                        <span style={{ fontSize: "12px", color: "#166534", fontWeight: 700, backgroundColor: "#dcfce7", padding: "4px 12px", borderRadius: "8px" }}>
                          ✓ Submitted: {existingAssignment.assignedOfficers}
                        </span>
                      )}
                    </div>

                  </div>

                  {/* FLOW STEP 2: Appointment Date & Report Due Date (Received from Subject Officer) */}
                  <div style={{ backgroundColor: "#f0f9ff", padding: "14px", borderRadius: "10px", border: "1px solid #bae6fd", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#0369a1", display: "flex", alignItems: "center", gap: "6px" }}>
                      <CalendarIcon size={15} />
                      <span>2. Appointment Date &amp; Report Due Date (Received from Subject Officer)</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", fontSize: "13px", color: "#1e293b", marginTop: "4px" }}>
                      <div style={{ backgroundColor: "#ffffff", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                        📅 <strong>Appointment Date:</strong> <span style={{ color: "#0369a1", fontWeight: 700 }}>{existingAssignment?.appointmentDate || "Pending Subject Officer"}</span>
                      </div>
                      <div style={{ backgroundColor: "#ffffff", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                        ⏳ <strong>Report Due Date:</strong> <span style={{ color: "#dc2626", fontWeight: 700 }}>{existingAssignment?.reportDueDate || "Pending Subject Officer"}</span>
                      </div>
                    </div>
                  </div>

                  {/* FLOW STEP 3 & 4: Extension of Dates & Certification */}
                  <div style={{ backgroundColor: "#fffbeb", padding: "14px", borderRadius: "10px", border: "1px solid #fef3c7", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#b45309", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Clock size={15} />
                      <span>3 &amp; 4. Extension of Dates (Start/End Date, Term: First/Second/Third) &amp; Certification</span>
                    </div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                      <div>
                        <label style={{ fontSize: "11px", fontWeight: 600, color: "#78350f" }}>Extension Term</label>
                        <select
                          value={step3Term}
                          onChange={(e) => setStep3Term(e.target.value as any)}
                          style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", backgroundColor: "#ffffff" }}
                        >
                          <option value="First">First Term</option>
                          <option value="Second">Second Term</option>
                          <option value="Third">Third Term</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: "11px", fontWeight: 600, color: "#78350f" }}>Start Date</label>
                        <input
                          type="date"
                          value={step3StartDate}
                          onChange={(e) => setStep3StartDate(e.target.value)}
                          style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", backgroundColor: "#ffffff" }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: "11px", fontWeight: 600, color: "#78350f" }}>End Date</label>
                        <input
                          type="date"
                          value={step3EndDate}
                          onChange={(e) => setStep3EndDate(e.target.value)}
                          style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", backgroundColor: "#ffffff" }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                      <button
                        type="button"
                        onClick={handleStep3RequestExtension}
                        style={{ padding: "7px 14px", backgroundColor: "#d97706", color: "#ffffff", border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}
                      >
                        Send Extension Request to Subject Officer
                      </button>

                      {existingAssignment?.extensionStartDate && (
                        <span style={{ fontSize: "12px", fontWeight: 700, color: existingAssignment.certificationSubmitted ? "#166534" : "#b45309" }}>
                          {existingAssignment.certificationSubmitted ? "✓ Certified by Subject Officer" : "⏳ Pending Subject Officer Certification"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* FLOW STEP 5: Send Report Submit Date (Admin -> Subject) */}
                  <div style={{ backgroundColor: "#f0fdf4", padding: "14px", borderRadius: "10px", border: "1px solid #bbf7d0", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#166534", display: "flex", alignItems: "center", gap: "6px" }}>
                      <FileCheck size={15} />
                      <span>5. Send Report Submit Date (Admin ➔ Subject Officer)</span>
                    </div>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        type="date"
                        value={step4ApprovalDate}
                        onChange={(e) => setStep4ApprovalDate(e.target.value)}
                        style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", backgroundColor: "#ffffff" }}
                      />
                      <button
                        type="button"
                        onClick={handleStep4SubmitFinalReport}
                        style={{ padding: "8px 16px", backgroundColor: "#16a34a", color: "#ffffff", border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
                      >
                        Send Report Submit Date
                      </button>
                    </div>
                  </div>

                  {/* DISPLAY SUBMITTED REPORT FROM SUBJECT OFFICER */}
                  {existingAssignment?.reportContent && (
                    <div style={{ backgroundColor: "#ffffff", padding: "14px", borderRadius: "10px", border: "1px solid #4f46e5" }}>
                      <div style={{ fontWeight: 700, color: "#4338ca", fontSize: "13px", marginBottom: "6px" }}>
                        📄 Investigation Report Added by Subject Officer (Submitted on {existingAssignment.reportSubmitDate || "recent"}):
                      </div>
                      <p style={{ margin: 0, fontSize: "13px", color: "#1e293b", whiteSpace: "pre-wrap" }}>
                        {existingAssignment.reportContent}
                      </p>
                    </div>
                  )}

                </div>

                {/* Add/Update Investigation Progress Form Section */}
                <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #cbd5e1", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.03)" }}>
                  <h4 style={{ margin: "0 0 16px 0", fontSize: "16px", color: "#0f172a", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                    <FileCheck size={20} style={{ color: "#4f46e5" }} />
                    <span>{lang === "si" ? "විමර්ශන ප්‍රගතිය සහ පියවර ඇතුළත් කිරීම" : "Record Progress & Update Inquiry Details"}</span>
                  </h4>



                  {/* Quick Action Notes Tags */}
                  <div style={{ marginTop: "16px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#475569", display: "block", marginBottom: "6px" }}>
                      ⚡ Quick Progress Notes:
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {[
                        "සාක්ෂිකරුවන්ගෙන් ප්‍රකාශ ලබා ගැනීම",
                        "විභාග දිනය නියම කිරීම",
                        "සාක්ෂි සටහන් කිරීම",
                        "අතරමැදි වාර්තාව",
                        "අවසාන වාර්තාව",
                      ].map((tag, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setInquiryNotes((prev) => (prev ? `${prev}\n• ${tag}` : `• ${tag}`))}
                          style={{ padding: "4px 10px", borderRadius: "16px", backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1", fontSize: "12px", color: "#334155", cursor: "pointer", fontWeight: 500 }}
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes Textarea */}
                  <div style={{ marginTop: "16px" }}>
                    <label style={{ fontWeight: 600, color: "#334155", display: "block", fontSize: "13px", marginBottom: "4px" }}>
                      {lang === "si" ? "විමර්ශන සටහන් සහ ප්‍රගති විස්තර *" : "Investigation Notes & Progress Details *"}
                    </label>
                    <textarea
                      rows={5}
                      value={inquiryNotes}
                      onChange={(e) => setInquiryNotes(e.target.value)}
                      placeholder="Enter inquiry steps, hearing dates, witness notes, or report summaries..."
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", resize: "vertical", backgroundColor: "#ffffff" }}
                    />
                  </div>

                </div>

                {/* Bottom Action Footer */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "14px", paddingTop: "16px", borderTop: "1px solid #e2e8f0" }}>
                  <button
                    type="button"
                    onClick={() => router.push("/investigation")}
                    className="btn-cancel"
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
                    {isSaving ? (lang === "si" ? "සුරකිමින්..." : "Saving...") : (lang === "si" ? "තොරතුරු සුරකින්න" : "Save Progress Details")}
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
            <CheckCircle size={14} color="#fff" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}

export default function InvestigationCaseDetailsPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center" }}>Loading page...</div>}>
      <InvestigationCaseDetailsContent />
    </Suspense>
  );
}
