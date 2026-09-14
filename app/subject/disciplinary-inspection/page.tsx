"use client";

import "@/i18n";
import "../../globals.css";
import "../../daily-mail/daily-mail.css";
import "../../dashboard-common.css";
import "../subject.css";
import "./disciplinary-inspection.css";
import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getCurrentProfile, signOut } from "@/lib/auth";
import {
  saveFormalDisciplinaryInspectionServer,
  getFormalDisciplinaryInspectionServer,
  getAvailableConductInquiryCasesServer,
  getCommitteeOfficersWithSchoolsServer,
  saveCaseByAppointmentAndReportDueDateServer,
  saveCaseByDateExtensionServer,
  saveChairmanByCaseServer,
  saveMembersByCaseServer,
  getRecommendationsListServer,
} from "@/lib/db-actions";
import {
  ArrowLeft,
  ShieldAlert,
  Calendar as CalendarIcon,
  Clock,
  Sparkles,
  FileText,
  User,
  Building,
  Plus,
  X,
  CheckCircle,
  AlertCircle,
  Menu,
  ChevronRight,
  Save,
  Scale,
  Award,
  Layers,
  HelpCircle,
} from "lucide-react";

export const formatToInputDate = (dateStr?: string | null): string => {
  if (!dateStr || typeof dateStr !== "string") return "";
  const trimmed = dateStr.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (trimmed.includes("T")) {
    const parts = trimmed.split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(parts)) return parts;
  }
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return "";
};

function DisciplinaryInspectionContent() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang = i18n.language;

  const paramCaseNo = searchParams?.get("caseNo") || "";

  // Hydration state
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Authentication & Profile State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");

  // Available cases list for switcher
  const [availableCases, setAvailableCases] = useState<any[]>([]);
  const [selectedCaseNo, setSelectedCaseNo] = useState<string>(paramCaseNo);

  // Form State strictly matching the Paper Sketch
  const [formState, setFormState] = useState<{
    caseNo: string;
    accusedName: string;
    accusedDesignation: string;
    schoolName: string;
    subject: string;
    stage: string;
    priority: string;
    // Section 2: Inquiry committee details
    chairmanName: string;
    chairmanId: string;
    chairmanEmail: string;
    members: Array<{ name: string; idNo: string; email?: string }>;
    // Section 3: Appointment letter date & Report due date
    appointmentLetterDate: string;
    reportDueDate: string;
    // Section 4: Extension of days
    extensionTerm: string;
    extensionStartDate: string;
    extensionEndDate: string;
    // Section 5: Recommendation
    recommendation: string;
    // Section 6: Discipline command
    disciplineCommand: string;
    // Section 7: Approval of the secretary of education / Public service commission
    dateOfApproval: string;
    grantedApproval: string;
    otherDecision: string;
  }>({
    caseNo: "",
    accusedName: "—",
    accusedDesignation: "—",
    schoolName: "—",
    subject: "—",
    stage: "Formal Disciplinary Inspection",
    priority: "high",
    chairmanName: "",
    chairmanId: "",
    chairmanEmail: "",
    members: [{ name: "", idNo: "", email: "" }],
    appointmentLetterDate: "",
    reportDueDate: "",
    extensionTerm: "None",
    extensionStartDate: "",
    extensionEndDate: "",
    recommendation: "",
    disciplineCommand: "",
    dateOfApproval: "",
    grantedApproval: "Getting approval",
    otherDecision: "",
  });

  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4500);
  };

  // Registered Committee Officers for Chairman & Members Autocomplete / Auto-fill
  const [committeeOfficers, setCommitteeOfficers] = useState<Array<{ id: string; fullName: string; email?: string; position?: string; nicNo?: string }>>([]);

  useEffect(() => {
    getCommitteeOfficersWithSchoolsServer().then(async (res) => {
      let list: any[] = [];
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        list = res.data.map((o: any) => ({
          id: o.id,
          fullName: o.full_name || o.fullName || "",
          email: o.email || "",
          nicNo: o.nic_no || o.nic || o.email || "",
          position: o.position || o.officer_role || "Member",
        }));
      }
      if (list.length === 0 && isSupabaseConfigured) {
        try {
          const { data: dbComm } = await supabase.from("commitee_table").select("*");
          if (dbComm && dbComm.length > 0) {
            list = dbComm.map((o: any) => ({
              id: o.id,
              fullName: o.full_name || o.fullName || "",
              email: o.email || "",
              nicNo: o.nic_no || o.nic || o.email || "",
              position: o.position || o.officer_role || "Member",
            }));
          }
        } catch (e) {}
      }
      if (list.length > 0) {
        setCommitteeOfficers(list);
      }
    }).catch(async () => {
      if (isSupabaseConfigured) {
        try {
          const { data: dbComm } = await supabase.from("commitee_table").select("*");
          if (dbComm && dbComm.length > 0) {
            setCommitteeOfficers(
              dbComm.map((o: any) => ({
                id: o.id,
                fullName: o.full_name || o.fullName || "",
                email: o.email || "",
                nicNo: o.nic_no || o.nic || o.email || "",
                position: o.position || o.officer_role || "Member",
              }))
            );
          }
        } catch (e) {}
      }
    });
  }, []);

  // Load User Profile
  useEffect(() => {
    getCurrentProfile().then((profile) => {
      if (profile) setCurrentUser(profile);
    });
  }, []);

  // Fetch Cases and Disciplinary Records
  useEffect(() => {
    const loadCasesData = async () => {
      const casesMap = new Map<string, any>();

      // 1. PostgreSQL Server Action: Fetch available inquiry cases
      try {
        const serverCases = await getAvailableConductInquiryCasesServer();
        if (serverCases && serverCases.success && Array.isArray(serverCases.data)) {
          serverCases.data.forEach((c: any) => {
            const key = (c.caseNo || "").trim().toLowerCase();
            if (key) {
              casesMap.set(key, { ...c });
            }
          });
        }
      } catch (e) {
        console.warn("Error fetching available cases from DB:", e);
      }

      // 2. Fetch from recommendations for charge sheet and disciplinary info
      try {
        const recsRes = await getRecommendationsListServer();
        if (recsRes && recsRes.success && Array.isArray(recsRes.data)) {
          recsRes.data.forEach((r: any) => {
            const key = (r.caseNo || "").trim().toLowerCase();
            if (key) {
              const existing = casesMap.get(key) || {};
              casesMap.set(key, {
                ...existing,
                caseNo: r.caseNo,
                accusedName: r.accusedName || existing.accusedName || "",
                accusedDesignation: r.accusedDesignation || existing.accusedDesignation || "Educational Officer",
                schoolName: r.schoolName || existing.schoolName || "",
                subject: r.title || r.subject || existing.subject || `Disciplinary Case ${r.caseNo}`,
                stage: "Formal Disciplinary Inspection",
                priority: r.urgency || existing.priority || "high",
                recommendation: r.recommendationText || existing.recommendation || "",
                disciplineCommand: r.disciplinaryAction || r.disciplinaryOrder || existing.disciplineCommand || "",
                dateOfApproval: r.secretaryApprovalDate ? formatToInputDate(r.secretaryApprovalDate) : existing.dateOfApproval || "",
                otherDecision: r.secretaryApprovedRecommendation || existing.otherDecision || "",
              });
            }
          });
        }
      } catch (e) {}

      // 3. Supabase Realtime DB fallback
      if (isSupabaseConfigured) {
        try {
          const { data: dbCases } = await supabase.from("dcmms_cases").select("*");
          if (dbCases && dbCases.length > 0) {
            dbCases.forEach((c: any) => {
              const key = (c.caseNo || c.case_no || c.refNo || "").trim().toLowerCase();
              if (key) {
                const existing = casesMap.get(key) || {};
                casesMap.set(key, {
                  ...existing,
                  caseNo: c.caseNo || c.case_no || c.refNo || existing.caseNo || key,
                  accusedName: c.accusedName || c.accused_name || existing.accusedName || "",
                  accusedDesignation: c.accusedDesignation || c.accused_designation || c.designation || existing.accusedDesignation || "Educational Officer",
                  schoolName: c.schoolName || c.institute_name || c.school_name || existing.schoolName || "",
                  subject: c.subject || c.description || existing.subject || `Disciplinary Case ${key}`,
                  stage: "Formal Disciplinary Inspection",
                  priority: c.priority || "high",
                });
              }
            });
          }
        } catch (e) {}
      }

      // 4. LocalStorage Fallback & Merge
      if (typeof window !== "undefined") {
        try {
          const storedCases = localStorage.getItem("dcmms_cases");
          if (storedCases) {
            const parsed = JSON.parse(storedCases);
            if (Array.isArray(parsed)) {
              parsed.forEach((c: any) => {
                const key = (c.caseNo || c.case_no || c.refNo || "").trim().toLowerCase();
                if (key) {
                  const existing = casesMap.get(key) || {};
                  casesMap.set(key, {
                    ...existing,
                    caseNo: c.caseNo || c.case_no || c.refNo || existing.caseNo || key,
                    accusedName: c.accusedName || c.accused_name || existing.accusedName || "",
                    accusedDesignation: c.accusedDesignation || c.accused_designation || c.designation || existing.accusedDesignation || "Educational Officer",
                    schoolName: c.schoolName || c.institute_name || c.school_name || existing.schoolName || "",
                    subject: c.subject || c.description || existing.subject || `Disciplinary Case ${key}`,
                    stage: "Formal Disciplinary Inspection",
                    priority: c.priority || "high",
                  });
                }
              });
            }
          }
        } catch (e) {}
      }

      // Ensure target case (paramCaseNo) is present in map
      if (paramCaseNo && !casesMap.has(paramCaseNo.trim().toLowerCase())) {
        casesMap.set(paramCaseNo.trim().toLowerCase(), {
          caseNo: paramCaseNo,
          letterNo: paramCaseNo,
          accusedName: "Concerned Officer",
          accusedDesignation: "Educational Officer",
          schoolName: "Government Educational Institute",
          subject: `Formal Disciplinary Proceeding ${paramCaseNo}`,
          stage: "Formal Disciplinary Inspection",
          priority: "high",
        });
      }

      const casesList = Array.from(casesMap.values());
      setAvailableCases(casesList);

      const targetCaseNo = paramCaseNo || (casesList.length > 0 ? casesList[0].caseNo : "");
      if (targetCaseNo) {
        setSelectedCaseNo(targetCaseNo);
        populateFormDataForCase(targetCaseNo, casesMap.get(targetCaseNo.trim().toLowerCase()) || {});
      }
    };

    loadCasesData();
  }, [paramCaseNo]);

  // Load Form Data for Specific Case
  const populateFormDataForCase = async (caseNo: string, baseCase: any) => {
    if (!caseNo) return;

    let chairmanName = "";
    let chairmanId = "";
    let chairmanEmail = "";
    let members: Array<{ name: string; idNo: string; email?: string }> = [{ name: "", idNo: "", email: "" }];
    let appointmentLetterDate = "";
    let reportDueDate = "";
    let extensionTerm = "None";
    let extensionStartDate = "";
    let extensionEndDate = "";
    let recommendation = "";
    let disciplineCommand = "";
    let dateOfApproval = "";
    let grantedApproval = "Getting approval";
    let otherDecision = "";

    // 1. Fetch from PostgreSQL Server Action
    try {
      const formalRes = await getFormalDisciplinaryInspectionServer(caseNo);
      if (formalRes && formalRes.success && formalRes.data) {
        const d = formalRes.data;
        if (d.chairman && (d.chairman.fullName || d.chairman.name)) {
          chairmanName = d.chairman.fullName || d.chairman.name;
          chairmanId = d.chairman.idNo || d.chairman.email || "";
          chairmanEmail = d.chairman.email || "";
        }
        if (Array.isArray(d.members) && d.members.length > 0) {
          members = d.members.map((m: any) => ({
            name: m.name || m.fullName || "",
            idNo: m.idNo || m.email || "",
            email: m.email || "",
          }));
        }
        if (d.appointmentLetterDate) appointmentLetterDate = formatToInputDate(d.appointmentLetterDate);
        if (d.reportDueDate) reportDueDate = formatToInputDate(d.reportDueDate);
        if (d.extensionTerm) extensionTerm = d.extensionTerm;
        if (d.extensionStartDate) extensionStartDate = formatToInputDate(d.extensionStartDate);
        if (d.extensionEndDate) extensionEndDate = formatToInputDate(d.extensionEndDate);
        if (d.recommendation) recommendation = d.recommendation;
        if (d.disciplineCommand) disciplineCommand = d.disciplineCommand;
        if (d.dateOfApproval) dateOfApproval = formatToInputDate(d.dateOfApproval);
        if (d.grantedApproval) grantedApproval = d.grantedApproval;
        if (d.otherDecision) otherDecision = d.otherDecision;
      }
    } catch (e) {
      console.warn("Error loading server disciplinary inspection details:", e);
    }

    // 2. Fallback to localStorage / baseCase values
    if (typeof window !== "undefined") {
      try {
        const localData = localStorage.getItem(`dcmms_formal_disciplinary_${caseNo}`);
        if (localData) {
          const parsed = JSON.parse(localData);
          if (parsed.chairmanName && !chairmanName) chairmanName = parsed.chairmanName;
          if (parsed.chairmanId && !chairmanId) chairmanId = parsed.chairmanId;
          if (Array.isArray(parsed.members) && parsed.members.length > 0 && !members[0].name) {
            members = parsed.members;
          }
          if (parsed.appointmentLetterDate && !appointmentLetterDate) appointmentLetterDate = parsed.appointmentLetterDate;
          if (parsed.reportDueDate && !reportDueDate) reportDueDate = parsed.reportDueDate;
          if (parsed.extensionTerm && extensionTerm === "None") extensionTerm = parsed.extensionTerm;
          if (parsed.extensionStartDate && !extensionStartDate) extensionStartDate = parsed.extensionStartDate;
          if (parsed.extensionEndDate && !extensionEndDate) extensionEndDate = parsed.extensionEndDate;
          if (parsed.recommendation && !recommendation) recommendation = parsed.recommendation;
          if (parsed.disciplineCommand && !disciplineCommand) disciplineCommand = parsed.disciplineCommand;
          if (parsed.dateOfApproval && !dateOfApproval) dateOfApproval = parsed.dateOfApproval;
          if (parsed.grantedApproval && !grantedApproval) grantedApproval = parsed.grantedApproval;
          if (parsed.otherDecision && !otherDecision) otherDecision = parsed.otherDecision;
        }
      } catch (e) {}
    }

    setFormState({
      caseNo,
      accusedName: baseCase.accusedName || baseCase.accused_name || "Concerned Officer",
      accusedDesignation: baseCase.accusedDesignation || baseCase.accused_designation || baseCase.designation || "Educational Officer",
      schoolName: baseCase.schoolName || baseCase.institute_name || baseCase.school_name || "Government Educational Institute",
      subject: baseCase.subject || baseCase.title || baseCase.description || `Formal Disciplinary Proceeding ${caseNo}`,
      stage: baseCase.stage || "Formal Disciplinary Inspection",
      priority: baseCase.priority || "high",
      chairmanName,
      chairmanId,
      chairmanEmail,
      members: members.length > 0 ? members : [{ name: "", idNo: "", email: "" }],
      appointmentLetterDate,
      reportDueDate,
      extensionTerm: extensionTerm || "None",
      extensionStartDate,
      extensionEndDate,
      recommendation: recommendation || baseCase.recommendation || "",
      disciplineCommand: disciplineCommand || baseCase.disciplineCommand || "",
      dateOfApproval: dateOfApproval || baseCase.dateOfApproval || "",
      grantedApproval: grantedApproval || "Getting approval",
      otherDecision: otherDecision || baseCase.otherDecision || "",
    });
  };

  // Case switch handler
  const handleCaseChange = (newCaseNo: string) => {
    setSelectedCaseNo(newCaseNo);
    const target = availableCases.find((c) => (c.caseNo || "").trim().toLowerCase() === newCaseNo.trim().toLowerCase()) || {};
    populateFormDataForCase(newCaseNo, target);
    router.replace(`/subject/disciplinary-inspection?caseNo=${encodeURIComponent(newCaseNo)}`);
  };

  // Member Rows Add & Remove
  const handleAddMember = () => {
    setFormState((prev) => ({
      ...prev,
      members: [...prev.members, { name: "", idNo: "", email: "" }],
    }));
  };

  const handleRemoveMember = (idx: number) => {
    setFormState((prev) => {
      const updated = prev.members.filter((_, i) => i !== idx);
      return {
        ...prev,
        members: updated.length > 0 ? updated : [{ name: "", idNo: "", email: "" }],
      };
    });
  };

  const handleMemberChange = (idx: number, field: "name" | "idNo", value: string) => {
    setFormState((prev) => {
      const updated = [...prev.members];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, members: updated };
    });
  };

  // Chairman Select / Auto-fill
  const handleChairmanNameChange = (nameVal: string) => {
    const matched = committeeOfficers.find((o) => o.fullName.toLowerCase() === nameVal.trim().toLowerCase());
    setFormState((prev) => ({
      ...prev,
      chairmanName: nameVal,
      chairmanId: matched ? (matched.nicNo || matched.email || matched.id) : prev.chairmanId,
      chairmanEmail: matched?.email || prev.chairmanEmail,
    }));
  };

  // Member Select / Auto-fill
  const handleMemberSelect = (idx: number, nameVal: string) => {
    const matched = committeeOfficers.find((o) => o.fullName.toLowerCase() === nameVal.trim().toLowerCase());
    setFormState((prev) => {
      const updated = [...prev.members];
      updated[idx] = {
        name: nameVal,
        idNo: matched ? (matched.nicNo || matched.email || matched.id) : updated[idx]?.idNo || "",
        email: matched?.email || updated[idx]?.email || "",
      };
      return { ...prev, members: updated };
    });
  };

  // Save Form Handler
  const handleSaveForm = async () => {
    if (!formState.caseNo) {
      alert("Please select or specify a valid Case Number.");
      return;
    }

    setSaving(true);
    try {
      // 1. PostgreSQL Server Action
      const saveRes = await saveFormalDisciplinaryInspectionServer({
        caseNo: formState.caseNo,
        chairmanName: formState.chairmanName,
        chairmanId: formState.chairmanId,
        chairmanEmail: formState.chairmanEmail || formState.chairmanId,
        members: formState.members.filter((m) => m.name.trim() !== ""),
        appointmentLetterDate: formState.appointmentLetterDate || null,
        reportDueDate: formState.reportDueDate || null,
        extensionTerm: formState.extensionTerm,
        extensionStartDate: formState.extensionStartDate || null,
        extensionEndDate: formState.extensionEndDate || null,
        recommendation: formState.recommendation,
        disciplineCommand: formState.disciplineCommand,
        dateOfApproval: formState.dateOfApproval || null,
        grantedApproval: formState.grantedApproval,
        otherDecision: formState.otherDecision,
        updatedBy: currentUser?.fullName || currentUser?.email || "Subject Officer",
      });

      // 2. Supabase Realtime Storage
      if (isSupabaseConfigured) {
        try {
          await supabase.from("dcmms_cases").upsert({
            caseNo: formState.caseNo,
            stage: "Formal Disciplinary Inspection",
            updatedAt: new Date().toISOString(),
          }, { onConflict: "caseNo" });
        } catch (e) {}
      }

      // 3. LocalStorage persistence
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`dcmms_formal_disciplinary_${formState.caseNo}`, JSON.stringify(formState));
        } catch (e) {}
      }

      showToast("Formal Disciplinary Inspection details saved successfully!");
    } catch (error: any) {
      console.error("Save error:", error);
      showToast("Error saving inspection details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut();
    router.push("/");
  };

  if (!mounted) return null;

  return (
    <div className={`subject-dashboard-container font-scale-${fontScale}`}>
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fdi-toast-overlay">
          <div className="fdi-toast-content">
            <CheckCircle size={20} style={{ color: "#4ade80" }} />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Datalist for autocomplete committee officers */}
      <datalist id="committee-officers-list">
        {committeeOfficers.map((o, idx) => (
          <option key={`comm-${o.id}-${idx}`} value={o.fullName}>
            {o.position ? `${o.position} • ` : ""}{o.nicNo || o.email}
          </option>
        ))}
      </datalist>

      {/* Sidebar Navigation */}
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
        role="subject"
      />

      <div className="subject-main-content">
        {/* Top Navbar */}
        <header className="subject-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              className="btn-toggle-sidebar"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label="Toggle Sidebar"
            >
              <Menu size={20} />
            </button>
            <div className="subject-topbar-title">
              <ShieldAlert size={22} style={{ color: "#4f46e5" }} />
              <span>{lang === "si" ? "විධිමත් විනය පරීක්ෂණ පෝරමය" : "Formal Disciplinary Inspection Form"}</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {/* Font Scaler */}
            <div className="font-scaler-group">
              <button
                type="button"
                className={`btn-font-scale ${fontScale === "small" ? "active" : ""}`}
                onClick={() => setFontScale("small")}
                title="Small Font"
              >
                A-
              </button>
              <button
                type="button"
                className={`btn-font-scale ${fontScale === "medium" ? "active" : ""}`}
                onClick={() => setFontScale("medium")}
                title="Medium Font"
              >
                A
              </button>
              <button
                type="button"
                className={`btn-font-scale ${fontScale === "large" ? "active" : ""}`}
                onClick={() => setFontScale("large")}
                title="Large Font"
              >
                A+
              </button>
            </div>

            {/* Profile Pill */}
            {currentUser && (
              <div className="subject-user-pill">
                <User size={16} />
                <span>{currentUser.fullName || currentUser.email || "Subject Officer"}</span>
              </div>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="fdi-page-wrapper" style={{ padding: "16px 24px 48px" }}>
          
          {/* Breadcrumb Navigation */}
          <nav className="fdi-breadcrumb" aria-label="Breadcrumb">
            <Link href="/subject">{lang === "si" ? "ප්‍රධාන පුවරුව" : "Dashboard"}</Link>
            <ChevronRight size={14} />
            <Link href="/subject">{lang === "si" ? "විධිමත් විනය පරීක්ෂණ" : "Proper Disciplinary Inspection"}</Link>
            <ChevronRight size={14} />
            <span style={{ color: "#1e1b4b", fontWeight: 700 }}>
              {formState.caseNo || "Inspection Form"}
            </span>
          </nav>

          {/* Header & Main Actions */}
          <div className="fdi-page-header">
            <div className="fdi-title-group">
              <h1>
                <Scale style={{ color: "#4f46e5", width: "28px", height: "28px" }} />
                <span>
                  {lang === "si" ? "විධිමත් විනය පරීක්ෂණය (Formal Disciplinary Inspection)" : "Formal Disciplinary Inspection"}
                </span>
              </h1>
              <p>
                {lang === "si"
                  ? "ආයතන සංග්‍රහය සහ රාජ්‍ය සේවා කොමිෂන් සභා නියෝග යටතේ විධිමත් විනය පරීක්ෂණ තොරතුරු සම්පූර්ණ කරන්න."
                  : "Complete formal disciplinary inspection proceedings, inquiry committee appointments, extensions, and PSC commands."}
              </p>
            </div>

            <div className="fdi-header-actions">
              <Link href="/subject" className="btn-fdi-back">
                <ArrowLeft size={16} />
                <span>{lang === "si" ? "නැවත ලැයිස්තුවට" : "Back to Dashboard"}</span>
              </Link>

              <button
                type="button"
                onClick={handleSaveForm}
                disabled={saving}
                className="btn-fdi-save-main"
              >
                <Save size={16} />
                <span>{saving ? (lang === "si" ? "සුරකිමින්..." : "Saving...") : (lang === "si" ? "සුරකින්න" : "Save Details")}</span>
              </button>
            </div>
          </div>

          {/* Case Switcher Bar */}
          <div className="fdi-case-switcher-bar">
            <div className="fdi-case-switcher-left">
              <Layers size={18} style={{ color: "#4f46e5" }} />
              <span>{lang === "si" ? "අදාළ විනය ලිපිගොනුව තෝරන්න:" : "Select Disciplinary Case Reference:"}</span>
            </div>
            <div>
              <select
                value={selectedCaseNo}
                onChange={(e) => handleCaseChange(e.target.value)}
                className="fdi-case-select"
              >
                {availableCases.map((c, idx) => (
                  <option key={`opt-${c.caseNo}-${idx}`} value={c.caseNo}>
                    {c.caseNo} {c.accusedName ? `— ${c.accusedName}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ==================== FORM BODY (PAPER SKETCH SECTIONS) ==================== */}
          <div className="fdi-form-layout">

            {/* 1. Case Current Details (Section 1 in Sketch) */}
            <section className="fdi-section-card">
              <div className="fdi-section-header">
                <div className="fdi-section-title">
                  <FileText size={18} style={{ color: "#4f46e5" }} />
                  <span>{lang === "si" ? "1. නඩුවේ වත්මන් විස්තර" : "Case Current Details"}</span>
                </div>
                <span className="fdi-section-badge">
                  {lang === "si" ? "වත්මන් තත්ත්වය" : "Current Case"}
                </span>
              </div>

              <div className="fdi-case-preview-banner">
                <div className="fdi-preview-item">
                  <span className="fdi-preview-label">{lang === "si" ? "ලිපිගොනු අංකය" : "Case / Ref Number"}</span>
                  <span className="fdi-preview-value highlight-case">{formState.caseNo || "—"}</span>
                </div>

                <div className="fdi-preview-item">
                  <span className="fdi-preview-label">{lang === "si" ? "චෝදනා ලැබූ නිලධාරී" : "Accused Officer"}</span>
                  <span className="fdi-preview-value" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <User size={14} style={{ color: "#4f46e5" }} />
                    {formState.accusedName || "Concerned Officer"}
                  </span>
                </div>

                <div className="fdi-preview-item">
                  <span className="fdi-preview-label">{lang === "si" ? "තනතුර සහ ආයතනය" : "Designation & School / Institute"}</span>
                  <span className="fdi-preview-value" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Building size={14} style={{ color: "#64748b" }} />
                    {[formState.accusedDesignation, formState.schoolName].filter(Boolean).join(" • ") || "—"}
                  </span>
                </div>

                <div className="fdi-preview-item">
                  <span className="fdi-preview-label">{lang === "si" ? "විනය චෝදනාව / විෂයය" : "Disciplinary Charge / Subject"}</span>
                  <span className="fdi-preview-value">{formState.subject || "Formal Disciplinary Proceeding"}</span>
                </div>

                <div className="fdi-preview-item">
                  <span className="fdi-preview-label">{lang === "si" ? "ප්‍රමුඛතාවය" : "Priority"}</span>
                  <span className="fdi-preview-value">
                    <span className={`priority-text-container priority-text-${formState.priority}`}>
                      <span className={`priority-dot dot-${formState.priority}`} aria-hidden="true"></span>
                      {formState.priority === "high" ? "High" : formState.priority === "medium" ? "Medium" : "Low"}
                    </span>
                  </span>
                </div>
              </div>
            </section>

            {/* 2. Inquiry Committee Details (Section 2 in Sketch) */}
            <section className="fdi-section-card">
              <div className="fdi-section-header">
                <div className="fdi-section-title">
                  <User size={18} style={{ color: "#4f46e5" }} />
                  <span>{lang === "si" ? "2. පරීක්ෂණ කමිටු විස්තර" : "Inquiry Committee Details"}</span>
                </div>
                <span className="fdi-section-badge">
                  {lang === "si" ? "සභාපති සහ සාමාජිකයන්" : "Chairman & Members"}
                </span>
              </div>

              <div className="fdi-committee-box">
                {/* Chairman Details */}
                <div className="fdi-chairman-box">
                  <div style={{ fontSize: "13.5px", fontWeight: 800, color: "#1e1b4b", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Award size={16} style={{ color: "#4f46e5" }} />
                    <span>{lang === "si" ? "පරීක්ෂණ සභාපතිවරයාගේ තොරතුරු (Chairman Details)" : "Chairman Information"}</span>
                  </div>

                  <div className="fdi-grid-2">
                    <div className="fdi-input-group">
                      <label className="fdi-label">
                        <span>{lang === "si" ? "සභාපති නම" : "Chairman name"} :</span>
                      </label>
                      <input
                        type="text"
                        list="committee-officers-list"
                        value={formState.chairmanName}
                        onChange={(e) => handleChairmanNameChange(e.target.value)}
                        placeholder="Enter chairman name or select registered officer..."
                        className="fdi-input"
                      />
                    </div>

                    <div className="fdi-input-group">
                      <label className="fdi-label">
                        <span>{lang === "si" ? "සභාපති හැඳුනුම්පත් / නිල අංකය" : "Chairman id No"} :</span>
                      </label>
                      <input
                        type="text"
                        value={formState.chairmanId}
                        onChange={(e) => setFormState({ ...formState, chairmanId: e.target.value })}
                        placeholder="Enter Chairman ID / NIC / Email..."
                        className="fdi-input"
                      />
                    </div>
                  </div>
                </div>

                {/* Committee Members List */}
                <div className="fdi-members-container" style={{ marginTop: "16px" }}>
                  <div className="fdi-members-box-header">
                    <span style={{ fontSize: "13.5px", fontWeight: 800, color: "#1e1b4b" }}>
                      {lang === "si" ? "කමිටු සාමාජිකයන්ගේ තොරතුරු (Committee Members)" : "Committee Members Details"}
                    </span>
                    <button
                      type="button"
                      onClick={handleAddMember}
                      className="fdi-btn-add-member"
                      title="Add another committee member"
                    >
                      <Plus size={15} />
                      <span>{lang === "si" ? "සාමාජිකයෙකු එක් කරන්න (+)" : "Add Member (+)"}</span>
                    </button>
                  </div>

                  {formState.members.map((member, idx) => (
                    <div key={`member-row-${idx}`} className="fdi-member-row">
                      <div style={{ flex: 1 }}>
                        <label className="fdi-label" style={{ marginBottom: "4px" }}>
                          <span>{lang === "si" ? "සාමාජික නම" : "Member name"} :</span>
                          <span className="fdi-label-sub">(Member {idx + 1})</span>
                        </label>
                        <input
                          type="text"
                          list="committee-officers-list"
                          value={member.name}
                          onChange={(e) => handleMemberSelect(idx, e.target.value)}
                          placeholder={`Enter member ${idx + 1} name...`}
                          className="fdi-input"
                        />
                      </div>

                      <div style={{ flex: 1 }}>
                        <label className="fdi-label" style={{ marginBottom: "4px" }}>
                          <span>{lang === "si" ? "සාමාජික හැඳුනුම්පත් අංකය" : "Member id No."} :</span>
                        </label>
                        <input
                          type="text"
                          value={member.idNo}
                          onChange={(e) => handleMemberChange(idx, "idNo", e.target.value)}
                          placeholder={`Enter ID / NIC for member ${idx + 1}...`}
                          className="fdi-input"
                        />
                      </div>

                      {formState.members.length > 1 && (
                        <div style={{ paddingTop: "20px" }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(idx)}
                            className="fdi-btn-remove-member"
                            title="Remove this member"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* 3. Appointment Letter Date & Report Due Date (Section 3 in Sketch) */}
            <section className="fdi-section-card">
              <div className="fdi-section-header">
                <div className="fdi-section-title">
                  <CalendarIcon size={18} style={{ color: "#4f46e5" }} />
                  <span>{lang === "si" ? "3. පත්වීම් ලිපි දිනය සහ වාර්තා භාරදීමේ දිනය" : "Appointment Letter Date & Report Due Date"}</span>
                </div>
              </div>

              <div className="fdi-grid-2">
                <div className="fdi-input-group">
                  <label className="fdi-label">
                    <CalendarIcon size={14} style={{ color: "#4f46e5" }} />
                    <span>{lang === "si" ? "පත්වීම් ලිපි දිනය" : "Appointment letter date."} :</span>
                  </label>
                  <input
                    type="date"
                    value={formState.appointmentLetterDate}
                    onChange={(e) => setFormState({ ...formState, appointmentLetterDate: e.target.value })}
                    className="fdi-input"
                  />
                </div>

                <div className="fdi-input-group">
                  <label className="fdi-label">
                    <Clock size={14} style={{ color: "#ef4444" }} />
                    <span>{lang === "si" ? "වාර්තා භාරදීමේ දිනය" : "Report due date."} :</span>
                  </label>
                  <input
                    type="date"
                    value={formState.reportDueDate}
                    onChange={(e) => setFormState({ ...formState, reportDueDate: e.target.value })}
                    className="fdi-input"
                  />
                </div>
              </div>
            </section>

            {/* 4. Extension of Days (Section 4 in Sketch) */}
            <section className="fdi-section-card">
              <div className="fdi-section-header">
                <div className="fdi-section-title">
                  <Clock size={18} style={{ color: "#4f46e5" }} />
                  <span>{lang === "si" ? "4. දින දීර්ඝ කිරීම්" : "Extension of Days"}</span>
                </div>
                <span className="fdi-section-badge">
                  {lang === "si" ? "කාල සීමාව" : "Extension Period"}
                </span>
              </div>

              <div className="fdi-grid-3">
                <div className="fdi-input-group">
                  <label className="fdi-label">
                    <span>{lang === "si" ? "දීර්ඝ කිරීමේ වාරය" : "Extension term"} :</span>
                  </label>
                  <select
                    value={formState.extensionTerm}
                    onChange={(e) => setFormState({ ...formState, extensionTerm: e.target.value })}
                    className="fdi-select"
                  >
                    <option value="None">{lang === "si" ? "දීර්ඝ කිරීමක් නැත (None)" : "None"}</option>
                    <option value="First Extension (1st)">{lang === "si" ? "පළමු දීර්ඝ කිරීම (1st Extension)" : "1st Extension"}</option>
                    <option value="Second Extension (2nd)">{lang === "si" ? "දෙවන දීර්ඝ කිරීම (2nd Extension)" : "2nd Extension"}</option>
                    <option value="Third Extension (3rd)">{lang === "si" ? "තෙවන දීර්ඝ කිරීම (3rd Extension)" : "3rd Extension"}</option>
                    <option value="Fourth Extension (4th)">{lang === "si" ? "සිව්වන දීර්ඝ කිරීම (4th Extension)" : "4th Extension"}</option>
                    <option value="Final Extension">{lang === "si" ? "අවසාන දීර්ඝ කිරීම (Final Extension)" : "Final Extension"}</option>
                  </select>
                </div>

                <div className="fdi-input-group">
                  <label className="fdi-label">
                    <CalendarIcon size={14} style={{ color: "#4f46e5" }} />
                    <span>{lang === "si" ? "දීර්ඝ කිරීම ආරම්භක දිනය" : "Extension start date."} :</span>
                  </label>
                  <input
                    type="date"
                    value={formState.extensionStartDate}
                    onChange={(e) => setFormState({ ...formState, extensionStartDate: e.target.value })}
                    className="fdi-input"
                  />
                </div>

                <div className="fdi-input-group">
                  <label className="fdi-label">
                    <CalendarIcon size={14} style={{ color: "#4f46e5" }} />
                    <span>{lang === "si" ? "දීර්ඝ කිරීම අවසන් දිනය" : "Extension end date"} :</span>
                  </label>
                  <input
                    type="date"
                    value={formState.extensionEndDate}
                    onChange={(e) => setFormState({ ...formState, extensionEndDate: e.target.value })}
                    className="fdi-input"
                  />
                </div>
              </div>
            </section>

            {/* 5. Recommendation (Section 5 in Sketch) */}
            <section className="fdi-section-card">
              <div className="fdi-section-header">
                <div className="fdi-section-title">
                  <Sparkles size={18} style={{ color: "#4f46e5" }} />
                  <span>{lang === "si" ? "5. විනය නිර්දේශය" : "Recommendation."}</span>
                </div>
              </div>

              <div className="fdi-input-group">
                <label className="fdi-label">
                  <span>{lang === "si" ? "පරීක්ෂණ මණ්ඩලයේ / විෂයභාර නිලධාරී නිර්දේශය" : "Inquiry Board / Subject Officer Disciplinary Recommendation"} :</span>
                </label>
                <textarea
                  value={formState.recommendation}
                  onChange={(e) => setFormState({ ...formState, recommendation: e.target.value })}
                  placeholder="Enter formal disciplinary inquiry recommendation, findings, and notes..."
                  className="fdi-textarea"
                  rows={4}
                />
              </div>
            </section>

            {/* 6. Discipline Command (Section 6 in Sketch) */}
            <section className="fdi-section-card">
              <div className="fdi-section-header">
                <div className="fdi-section-title">
                  <Scale size={18} style={{ color: "#4f46e5" }} />
                  <span>{lang === "si" ? "6. විනය නියෝගය" : "Discipline command"}</span>
                </div>
              </div>

              <div className="fdi-input-group">
                <label className="fdi-label">
                  <span>{lang === "si" ? "විනය නියෝගය / දඬුවම් නියෝග විස්තර" : "Discipline Command / PSC Penalty & Directive Orders"} :</span>
                </label>
                <textarea
                  value={formState.disciplineCommand}
                  onChange={(e) => setFormState({ ...formState, disciplineCommand: e.target.value })}
                  placeholder="Enter discipline command, formal penalty order, or tribunal decisions under Establishment Code..."
                  className="fdi-textarea"
                  rows={4}
                />
              </div>
            </section>

            {/* 7. Approval of the Secretary of Education / PSC (Section 7 in Sketch) */}
            <section className="fdi-section-card">
              <div className="fdi-section-header">
                <div className="fdi-section-title">
                  <Award size={18} style={{ color: "#4f46e5" }} />
                  <span>
                    {lang === "si"
                      ? "7. අධ්‍යාපන ලේකම් / රාජ්‍ය සේවා කොමිෂන් සභාවේ අනුමැතිය"
                      : "Approval of the secretary of education / Public service commission"}
                  </span>
                </div>
              </div>

              <div className="fdi-grid-2">
                <div className="fdi-input-group">
                  <label className="fdi-label">
                    <CalendarIcon size={14} style={{ color: "#4f46e5" }} />
                    <span>{lang === "si" ? "අනුමත කළ දිනය" : "Date of approval"} :</span>
                  </label>
                  <input
                    type="date"
                    value={formState.dateOfApproval}
                    onChange={(e) => setFormState({ ...formState, dateOfApproval: e.target.value })}
                    className="fdi-input"
                  />
                </div>

                <div className="fdi-input-group">
                  <label className="fdi-label">
                    <span>{lang === "si" ? "ලබාදුන් අනුමැතිය" : "Granted approval"} :</span>
                  </label>
                  <select
                    value={formState.grantedApproval}
                    onChange={(e) => setFormState({ ...formState, grantedApproval: e.target.value })}
                    className="fdi-select"
                  >
                    <option value="Getting approval">{lang === "si" ? "අනුමැතිය ලබාගැනීම (Getting approval)" : "Getting approval"}</option>
                    <option value="Rejection">{lang === "si" ? "ප්‍රතික්ෂේප කිරීම (Rejection)" : "Rejection"}</option>
                  </select>
                </div>
              </div>

              {/* Other Decision (Conditional / Highlighted if selected Rejection as per sketch) */}
              <div className={`fdi-rejection-alert-box ${formState.grantedApproval === "Rejection" ? "rejection-active" : ""}`}>
                <div className={`fdi-rejection-note ${formState.grantedApproval === "Rejection" ? "rejection-active" : ""}`}>
                  <AlertCircle size={15} />
                  <span>
                    {formState.grantedApproval === "Rejection"
                      ? (lang === "si" ? "ප්‍රතික්ෂේප කර ඇත්නම් වෙනත් තීරණය සඳහන් කරන්න (if selected the Rejection)" : "if selected the Rejection — Specify reason & alternative decision")
                      : (lang === "si" ? "වෙනත් තීරණ / විධානයන් (Other decision)" : "Other decision (Active when Rejection is selected)")}
                  </span>
                </div>

                <div className="fdi-input-group">
                  <label className="fdi-label">
                    <span>{lang === "si" ? "වෙනත් තීරණය" : "Other decision"} :</span>
                  </label>
                  <textarea
                    value={formState.otherDecision}
                    onChange={(e) => setFormState({ ...formState, otherDecision: e.target.value })}
                    placeholder="Enter other decision, reconsideration notes, or rejection directives..."
                    className="fdi-textarea"
                    rows={3}
                  />
                </div>
              </div>
            </section>

            {/* Bottom Floating Actions */}
            <div className="fdi-bottom-bar">
              <Link href="/subject" className="btn-fdi-back">
                <ArrowLeft size={16} />
                <span>{lang === "si" ? "නැවත ලැයිස්තුවට" : "Back to Dashboard"}</span>
              </Link>

              <button
                type="button"
                onClick={handleSaveForm}
                disabled={saving}
                className="btn-fdi-save-main"
              >
                <Save size={16} />
                <span>{saving ? (lang === "si" ? "සුරකිමින්..." : "Saving...") : (lang === "si" ? "සුරකින්න" : "Save Formal Disciplinary Details")}</span>
              </button>
            </div>

          </div>
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}

export default function DisciplinaryInspectionPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center" }}>Loading Formal Disciplinary Inspection Form...</div>}>
      <DisciplinaryInspectionContent />
    </Suspense>
  );
}
