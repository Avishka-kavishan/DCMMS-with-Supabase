"use client";

import "../../i18n";
import "../daily-mail/daily-mail.css";
import "../dashboard-common.css";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sidebar } from "@/components/Sidebar";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase, isSupabaseConfigured, logAuditEvent } from "@/lib/supabase";
import { signOut, getCurrentProfile } from "@/lib/auth";
import { getInvestigationOfficersServer, assignOfficerToInvestigationServer, logAuditEventServer, getAccusedOfficerByRefServer, getCommitteeOfficersWithSchoolsServer, saveChairmanByCaseServer, getChairmanByCaseServer, saveMembersByCaseServer, getMembersByCaseServer, saveCaseByDateExtensionServer } from "@/lib/db-actions";
import { 
  UserPlus, X, Edit, Trash2, Check, Eye, ClipboardList, 
  UserCheck, Shield, ChevronRight, Calendar as CalendarIcon, 
  FileText, Clock, AlertCircle, Info, CheckCircle, Search, 
  User, Mail, ArrowRight, Sparkles, Filter, RefreshCw, FileCheck,
  Building, CreditCard, MapPin, Award, Send, CheckSquare, Layers, GraduationCap, Plus,
  Bell, BellRing, ChevronDown, ChevronUp, Minimize2, Maximize2
} from "lucide-react";

interface Inquiry {
  id: string;
  inquiryNo: string;
  subject: string;
  targetDate: string;
  status: "Scheduled" | "In Progress" | "Evidence Review" | "Completed" | "Preliminary Investigation" | "Conducting preliminary investigations" | "Under Investigation";
  assignedOfficer?: string;
  subjectOfficer?: string;
  notes?: string;
  createdAt?: string;
  appointmentDate?: string;
  reportDueDate?: string;
}

interface Officer {
  id: string;
  employeeNo?: string;
  fullName: string;
  nicNo?: string;
  officerRole?: "Chairman" | "Member";
  position?: string;
  studiedSchools?: string[];
  childrenSchools?: string[];
  email: string;
  role: "investigation_officer";
  status: "Active" | "Inactive";
  createdAt: string;
}

export default function InvestigationPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  // Accessibility & language state
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");
  const lang = i18n.language;

  const formatSubjectOfficerName = (raw?: string | null, currentLang: string = lang): string => {
    if (!raw || typeof raw !== "string" || !raw.trim()) {
      return currentLang === "si" ? "පවරන ලද විෂය භාර නිලධාරී" : "Assigned Subject Officer";
    }
    const trimmed = raw.trim();
    const lower = trimmed.toLowerCase();
    if (
      lower === "subject officer" ||
      lower === "විෂය නිලධාරී" ||
      lower === "පවරන ලද විෂය භාර නිලධාරී" ||
      lower === "පවරන ලද විෂය භාර නිලධාරියා" ||
      lower === "assigned subject officer" ||
      lower === "unassigned" ||
      lower === "නොපවරන ලද"
    ) {
      return currentLang === "si" ? "පවරන ලද විෂය භාර නිලධාරී" : "Assigned Subject Officer";
    }
    return trimmed;
  };

  const formatToInputDate = (dateStr?: string | null): string => {
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
    return trimmed;
  };

  // Tabs state
  const [activeTab, setActiveTab] = useState<"cases" | "officers">("cases");

  // Mobile sidebar visibility state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Dynamic localized greeting
  const [greeting, setGreeting] = useState("");

  // Inquiries & Officers state
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalendarLoading, setIsCalendarLoading] = useState(true);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);

  // Subject Officer Date Notifications state
  const [subjectOfficerNotifications, setSubjectOfficerNotifications] = useState<any[]>([]);
  const [isNotifLoading, setIsNotifLoading] = useState(true);
  const [isNotificationsMinimized, setIsNotificationsMinimized] = useState(true);
  const [showAllNotifications, setShowAllNotifications] = useState(true);
  const [seenNotifIds, setSeenNotifIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("dcmms_seen_notifications");
        return stored ? JSON.parse(stored) : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const markAsSeen = (id: string) => {
    setSeenNotifIds((prev) => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("dcmms_seen_notifications", JSON.stringify(updated));
        } catch (e) {}
      }
      return updated;
    });
  };

  const markAllAsSeen = () => {
    const allIds = subjectOfficerNotifications.map((n) => n.id);
    const updated = Array.from(new Set([...seenNotifIds, ...allIds]));
    setSeenNotifIds(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("dcmms_seen_notifications", JSON.stringify(updated));
      } catch (e) {}
    }
  };

  const unseenCount = subjectOfficerNotifications.filter((n) => !seenNotifIds.includes(n.id)).length;
  const [notifFilter, setNotifFilter] = useState<"all" | "unread">("all");
  const displayedNotifs = subjectOfficerNotifications.filter((n) => {
    if (notifFilter === "unread") {
      return !seenNotifIds.includes(n.id);
    }
    return true;
  });

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("All");
  const [officerFilter, setOfficerFilter] = useState<string>("All");
  const [officerSearchQuery, setOfficerSearchQuery] = useState("");
  const [officerPositionFilter, setOfficerPositionFilter] = useState<string>("All");

  // Case details modal state
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<Inquiry | null>(null);
  const [concernedOfficer, setConcernedOfficer] = useState<any>(null);
  const [concernedOfficersList, setConcernedOfficersList] = useState<any[]>([]);
  const [subjectActions, setSubjectActions] = useState<any[]>([]);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Case details form state (editable by Investigation Administrator)
  const [assignee, setAssignee] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [investigationStatus, setInvestigationStatus] = useState<Inquiry["status"]>("In Progress");
  const [investigationNotes, setInvestigationNotes] = useState("");
  const [fileRefNoForm, setFileRefNoForm] = useState("");

  // Subject Officer Assignment Data Flow state (Investigation Admin <-> Subject Officer)
  const [subjOfficerName, setSubjOfficerName] = useState("");
  const [subjectOfficersList, setSubjectOfficersList] = useState<string[]>([]);
  const [customSubjectOfficerInput, setCustomSubjectOfficerInput] = useState("");
  const [subjAppointmentDate, setSubjAppointmentDate] = useState("");
  const [subjReportDueDate, setSubjReportDueDate] = useState("");
  const [subjExtensionTerm, setSubjExtensionTerm] = useState<string>("None");
  const [subjExtensionStartDate, setSubjExtensionStartDate] = useState("");
  const [subjExtensionEndDate, setSubjExtensionEndDate] = useState("");
  const [existingAssignment, setExistingAssignment] = useState<any>(null);

  // Sequential 4-Step Workflow state
  const [workflowStep, setWorkflowStep] = useState<number>(1);
  const [step1AssignedOfficers, setStep1AssignedOfficers] = useState<string[]>([]);
  const [step2AppointmentDate, setStep2AppointmentDate] = useState("");
  const [step2ReportDueDate, setStep2ReportDueDate] = useState("");
  const [step2Submitted, setStep2Submitted] = useState(false);
  const [step3ExtensionTerm, setStep3ExtensionTerm] = useState<string>("None");
  const [step3ExtensionStartDate, setStep3ExtensionStartDate] = useState("");
  const [step3ExtensionEndDate, setStep3ExtensionEndDate] = useState("");
  const [step3ExtensionRequested, setStep3ExtensionRequested] = useState(false);
  const [step3ExtensionCertified, setStep3ExtensionCertified] = useState(false);
  const [step4FinalReport, setStep4FinalReport] = useState("");
  const [step4ApprovalDate, setStep4ApprovalDate] = useState("");
  const [step4Completed, setStep4Completed] = useState(false);

  // Investigation Committee Assignment state (1 Chairman + Many Members)
  const [selectedChairman, setSelectedChairman] = useState<any | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<any[]>([]);
  const [memberSelectId, setMemberSelectId] = useState("");
  const [customMemberInput, setCustomMemberInput] = useState("");

  const parseSchoolList = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map((s) => String(s).trim()).filter(Boolean);
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (!trimmed) return [];
      if (trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed.map((s) => String(s).trim()).filter(Boolean);
        } catch (e) {}
      }
      return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [];
  };

  const getCaseInstitutes = (): string[] => {
    const institutes = new Set<string>();
    if (Array.isArray(concernedOfficersList)) {
      concernedOfficersList.forEach((co: any) => {
        const inst = co.institute_name || co.instituteName || co.school_name || co.schoolName || co.school || co.institute || "";
        if (typeof inst === "string" && inst.trim()) {
          institutes.add(inst.trim());
        }
      });
    }
    if (selectedCase) {
      const sc = selectedCase as any;
      const inst = sc.institute_name || sc.instituteName || sc.school || sc.schoolName || sc.accused_school_name || sc.accusedSchool || "";
      if (typeof inst === "string" && inst.trim()) {
        institutes.add(inst.trim());
      }
    }
    return Array.from(institutes);
  };

  const isOfficerConnectedToCaseInstitute = (off: any, caseInsts: string[]): boolean => {
    if (!caseInsts || caseInsts.length === 0) return false;

    const officerSchools: string[] = [
      ...parseSchoolList(off.studiedSchools),
      ...parseSchoolList(off.studied_schools),
      ...parseSchoolList(off.childrenSchools),
      ...parseSchoolList(off.children_schools),
      ...parseSchoolList(off.member_school_name),
      ...parseSchoolList(off.member_children_schools_name),
    ];

    if (off.institute_name) officerSchools.push(off.institute_name);
    if (off.instituteName) officerSchools.push(off.instituteName);
    if (off.school) officerSchools.push(off.school);
    if (off.schoolName) officerSchools.push(off.schoolName);

    const cleanOfficerSchools = officerSchools
      .map((s) => (typeof s === "string" ? s.trim().toLowerCase() : ""))
      .filter(Boolean);

    if (cleanOfficerSchools.length === 0) return false;

    return caseInsts.some((caseInst) => {
      const cleanCaseInst = caseInst.trim().toLowerCase();
      if (!cleanCaseInst) return false;
      return cleanOfficerSchools.some(
        (offSch) => offSch === cleanCaseInst || offSch.includes(cleanCaseInst) || cleanCaseInst.includes(offSch)
      );
    });
  };

  const syncMembersToCase = async (caseRef: string, membersList: any[]) => {
    if (!caseRef || !caseRef.trim()) return;
    const cleanRef = caseRef.trim();
    try {
      await saveMembersByCaseServer(cleanRef, membersList);
    } catch (e) {}

    if (isSupabaseConfigured) {
      try {
        await supabase.from("members_by_case").delete().eq("ref_number", cleanRef);
        if (membersList.length > 0) {
          const rowsToInsert = [];
          for (const m of membersList) {
            const fName = (m.fullName || m.full_name || m.name || "").trim();
            if (!fName) continue;
            let validEmail = null;
            if (m.email) {
              const { data: commData } = await supabase
                .from("commitee_table")
                .select("email")
                .ilike("email", m.email.trim())
                .maybeSingle();
              if (commData) validEmail = commData.email;
            }
            rowsToInsert.push({
              ref_number: cleanRef,
              full_name: fName,
              position: m.position || m.officerRole || "Member",
              email: validEmail,
              updated_at: new Date().toISOString(),
            });
          }
          if (rowsToInsert.length > 0) {
            await supabase.from("members_by_case").insert(rowsToInsert);
          }
        }
      } catch (e) {}
    }
  };

  const handleSelectChairman = async (officerId: string) => {
    const currentCaseRefNo = selectedCase ? (selectedCase.inquiryNo || (selectedCase as any).caseNo || (selectedCase as any).refNo || "") : "";
    if (!officerId) {
      setSelectedChairman(null);
      if (currentCaseRefNo) {
        try {
          await saveChairmanByCaseServer(currentCaseRefNo, null);
        } catch (e) {}
        if (isSupabaseConfigured) {
          try {
            await supabase.from("chairment_by_case").delete().eq("ref_number", currentCaseRefNo.trim());
          } catch (e) {}
        }
      }
      return;
    }
    const found = officers.find((o) => o.id === officerId);
    if (found) {
      setSelectedChairman(found);
      const filteredMembers = selectedMembers.filter((m) => m.id !== officerId && m.fullName !== found.fullName);
      setSelectedMembers(filteredMembers);
      if (currentCaseRefNo) {
        const payload = {
          fullName: found.fullName || (found as any).name || "",
          position: found.position || "Chairman",
          email: found.email || "",
        };
        try {
          await saveChairmanByCaseServer(currentCaseRefNo, payload);
        } catch (e) {}
        syncMembersToCase(currentCaseRefNo, filteredMembers);
        if (isSupabaseConfigured) {
          try {
            let validEmail = null;
            if (found.email) {
              const { data: commData } = await supabase
                .from("commitee_table")
                .select("email")
                .ilike("email", found.email.trim())
                .maybeSingle();
              if (commData) validEmail = commData.email;
            }
            await supabase.from("chairment_by_case").upsert({
              ref_number: currentCaseRefNo.trim(),
              full_name: payload.fullName,
              position: payload.position,
              email: validEmail,
              updated_at: new Date().toISOString(),
            }, { onConflict: "ref_number" });
          } catch (e) {}
        }
      }
    }
  };

  const handleAddMemberSelect = (officerId: string) => {
    const currentCaseRefNo = selectedCase ? (selectedCase.inquiryNo || (selectedCase as any).caseNo || (selectedCase as any).refNo || "") : "";
    if (!officerId) return;
    const found = officers.find((o) => o.id === officerId);
    if (found) {
      if (selectedChairman && (selectedChairman.id === officerId || selectedChairman.fullName === found.fullName)) {
        showToast(lang === "si" ? "මෙම නිලධාරියා දැනටමත් සභාපති ලෙස තෝරා ඇත." : "This officer is already selected as Chairman.");
        setMemberSelectId("");
        return;
      }
      if (selectedMembers.some((m) => m.id === officerId || m.fullName === found.fullName)) {
        showToast(lang === "si" ? "මෙම නිලධාරියා දැනටමත් සාමාජිකයෙකු ලෙස එක් කර ඇත." : "This officer is already in the members list.");
        setMemberSelectId("");
        return;
      }
      const updated = [...selectedMembers, found];
      setSelectedMembers(updated);
      setMemberSelectId("");
      if (currentCaseRefNo) {
        syncMembersToCase(currentCaseRefNo, updated);
      }
    }
  };

  const handleAddCustomMember = () => {
    const currentCaseRefNo = selectedCase ? (selectedCase.inquiryNo || (selectedCase as any).caseNo || (selectedCase as any).refNo || "") : "";
    const name = customMemberInput.trim();
    if (!name) return;
    if (selectedChairman && (selectedChairman.fullName || selectedChairman.name || "").toLowerCase() === name.toLowerCase()) {
      showToast(lang === "si" ? "මෙම නම දැනටමත් සභාපති ලෙස තෝරා ඇත." : "This name is already selected as Chairman.");
      return;
    }
    if (selectedMembers.some((m) => (m.fullName || m.name || "").toLowerCase() === name.toLowerCase())) {
      showToast(lang === "si" ? "මෙම සාමාජිකයා දැනටමත් එක් කර ඇත." : "This member is already added.");
      return;
    }
    const customMember = {
      id: `custom-m-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      fullName: name,
      officerRole: "Member",
      role: "investigation_officer",
    };
    const updated = [...selectedMembers, customMember];
    setSelectedMembers(updated);
    setCustomMemberInput("");
    if (currentCaseRefNo) {
      syncMembersToCase(currentCaseRefNo, updated);
    }
  };

  const handleRemoveMember = (index: number) => {
    const currentCaseRefNo = selectedCase ? (selectedCase.inquiryNo || (selectedCase as any).caseNo || (selectedCase as any).refNo || "") : "";
    const updated = selectedMembers.filter((_, i) => i !== index);
    setSelectedMembers(updated);
    if (currentCaseRefNo) {
      syncMembersToCase(currentCaseRefNo, updated);
    }
  };

  const handleRemoveChairman = async () => {
    const currentCaseRefNo = selectedCase ? (selectedCase.inquiryNo || (selectedCase as any).caseNo || (selectedCase as any).refNo || "") : "";
    setSelectedChairman(null);
    if (currentCaseRefNo) {
      try {
        await saveChairmanByCaseServer(currentCaseRefNo, null);
      } catch (e) {}
      if (isSupabaseConfigured) {
        try {
          await supabase.from("chairment_by_case").delete().eq("ref_number", currentCaseRefNo.trim());
        } catch (e) {}
      }
    }
  };

  // Officer form modal state
  const [isOfficerModalOpen, setIsOfficerModalOpen] = useState(false);
  const [isOfficerEditMode, setIsOfficerEditMode] = useState(false);
  const [editingOfficerId, setEditingOfficerId] = useState<string | null>(null);
  const [officerNameForm, setOfficerNameForm] = useState("");
  const [officerNicForm, setOfficerNicForm] = useState("");
  const [officerRoleTypeForm, setOfficerRoleTypeForm] = useState<"Chairman" | "Member">("Member");
  const [studiedSchoolsForm, setStudiedSchoolsForm] = useState<string[]>([]);
  const [newStudiedSchoolInput, setNewStudiedSchoolInput] = useState("");
  const [childrenSchoolsForm, setChildrenSchoolsForm] = useState<string[]>([]);
  const [newChildrenSchoolInput, setNewChildrenSchoolInput] = useState("");
  const [officerEmailForm, setOfficerEmailForm] = useState("");
  const [officerStatusForm, setOfficerStatusForm] = useState<"Active" | "Inactive">("Active");
  const [officerErrors, setOfficerErrors] = useState<Record<string, string>>({});
  const [toastMessage, setToastMessage] = useState("");

  const handleAddStudiedSchool = () => {
    const trimmed = newStudiedSchoolInput.trim();
    if (trimmed && !studiedSchoolsForm.includes(trimmed)) {
      setStudiedSchoolsForm((prev) => [...prev, trimmed]);
      setNewStudiedSchoolInput("");
    }
  };

  const handleRemoveStudiedSchool = (index: number) => {
    setStudiedSchoolsForm((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddChildrenSchool = () => {
    const trimmed = newChildrenSchoolInput.trim();
    if (trimmed && !childrenSchoolsForm.includes(trimmed)) {
      setChildrenSchoolsForm((prev) => [...prev, trimmed]);
      setNewChildrenSchoolInput("");
    }
  };

  const handleRemoveChildrenSchool = (index: number) => {
    setChildrenSchoolsForm((prev) => prev.filter((_, i) => i !== index));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Helper: Initials generator for officer avatars
  const getInitials = (name: string) => {
    if (!name) return "IO";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Helper: Calculate remaining days badge
  const getRemainingDaysBadge = (dateStr?: string) => {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (isNaN(diffDays)) return null;

    if (diffDays < 0) {
      return (
        <span style={{ fontSize: "11px", color: "#dc2626", backgroundColor: "#fef2f2", padding: "2px 8px", borderRadius: "12px", border: "1px solid #fca5a5", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <AlertCircle size={12} />
          {t("overdueBy", "Overdue by")} {Math.abs(diffDays)} {lang === "si" ? "දින" : "days"}
        </span>
      );
    } else if (diffDays <= 3) {
      return (
        <span style={{ fontSize: "11px", color: "#d97706", backgroundColor: "#fffbeb", padding: "2px 8px", borderRadius: "12px", border: "1px solid #fde68a", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <Clock size={12} />
          {diffDays} {t("daysRemaining", "days remaining")}
        </span>
      );
    } else {
      return (
        <span style={{ fontSize: "11px", color: "#166534", backgroundColor: "#f0fdf4", padding: "2px 8px", borderRadius: "12px", border: "1px solid #bbf7d0", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <CheckCircle size={12} />
          {diffDays} {t("daysRemaining", "days remaining")}
        </span>
      );
    }
  };

  // ── Sync Greeting ────────────────────────────────────────────────────────
  useEffect(() => {
    const hour = new Date().getHours();
    let greetingKey = "greetingMorning";
    if (hour >= 12 && hour < 17) {
      greetingKey = "greetingAfternoon";
    } else if (hour >= 17 || hour < 5) {
      greetingKey = "greetingEvening";
    }

    const loadGreeting = async () => {
      let displayName = t("investigationName", "Investigation Officer");
      const prof = await getCurrentProfile();
      if (prof && prof.full_name) {
        displayName = prof.full_name;
      }
      const defaultText = hour >= 12 && hour < 17 ? "Good Afternoon" : hour >= 17 || hour < 5 ? "Good Evening" : "Good Morning";
      const timeGreeting = t(greetingKey, defaultText);
      setGreeting(`${timeGreeting}, ${displayName}!`);
    };
    loadGreeting();
  }, [t]);

  // ── Keyboard ESC handler for sidebar & modals ──────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSidebarOpen(false);
        setIsCaseModalOpen(false);
        setIsOfficerModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ── Sync document title ───────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${t("investigationDashboardTitle")} | DCMMS`;
  }, [lang, t]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  // ── Fetch Inquiries & Officers ────────────────────────────────────────────
  // ── Fetch Inquiries & Officers ────────────────────────────────────────────
  const fetchInquiries = async () => {
    const datesMap = new Map<string, { appointmentDate?: string; reportDueDate?: string }>();

    if (isSupabaseConfigured) {
      try {
        const { data: assignmentsData } = await supabase
          .from("dcmms_subject_assignments")
          .select("case_no, subject_officer_name, appointment_date, report_due_date");

        const asgnMap = new Map<string, string>();
        if (assignmentsData) {
          assignmentsData.forEach((a: any) => {
            const key = (a.case_no || a.caseNo || "").trim().toLowerCase();
            const officerName = a.subject_officer_name || a.subjectOfficerName;
            if (key && officerName && typeof officerName === "string" && officerName.trim()) {
              asgnMap.set(key, officerName.trim());
            }
            if (key && (a.appointment_date || a.appointmentDate || a.report_due_date || a.reportDueDate)) {
              datesMap.set(key, {
                appointmentDate: formatToInputDate(a.appointment_date || a.appointmentDate),
                reportDueDate: formatToInputDate(a.report_due_date || a.reportDueDate),
              });
            }
          });
        }

        // Fetch subject officer from dcmms_subject_details for fallback
        try {
          const { data: detailsData } = await supabase
            .from("dcmms_subject_details")
            .select("case_no, subject_officer_name");
          if (detailsData) {
            detailsData.forEach((d: any) => {
              const key = (d.case_no || "").trim().toLowerCase();
              const officerName = d.subject_officer_name;
              if (key && officerName && typeof officerName === "string" && officerName.trim() && !asgnMap.has(key)) {
                asgnMap.set(key, officerName.trim());
              }
            });
          }
        } catch (e) {}

        const { data: mailData } = await supabase
          .from("dcmms_daily_mail")
          .select("ref_no, subject_officer_name, officer_name");

        if (mailData) {
          mailData.forEach((m: any) => {
            const key = (m.ref_no || m.case_no || "").trim().toLowerCase();
            const officerName = m.subject_officer_name || m.officer_name;
            if (key && officerName && typeof officerName === "string" && officerName.trim() && !asgnMap.has(key)) {
              asgnMap.set(key, officerName.trim());
            }
          });
        }

        const { data, error } = await supabase
          .from("dcmms_subject")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (data) {
          const mappedInquiries = data
            .map((item: any) => {
              const itemNo = (item.case_no || item.inquiryNo || item.caseNo || "").trim().toLowerCase();
              const assignedSubjOfficer = asgnMap.get(itemNo) || item.subject_officer_name || item.officer_name || item.subjectOfficerName || item.subject_officer || item.subjectOfficer || "";
              const dateInfo = datesMap.get(itemNo) || {};
              return {
                id: item.id,
                inquiryNo: item.case_no,
                subject: item.subject,
                targetDate: item.assigned_date || "2026-07-30",
                status: item.status as Inquiry["status"],
                assignedOfficer: item.officer_name || item.assigned_officer,
                subjectOfficer: assignedSubjOfficer,
                appointmentDate: dateInfo.appointmentDate || formatToInputDate(item.appointment_date || item.appointmentDate),
                reportDueDate: dateInfo.reportDueDate || formatToInputDate(item.report_due_date || item.reportDueDate),
                createdAt: item.created_at || new Date().toISOString(),
              };
            });

          mappedInquiries.sort((a: any, b: any) => {
            const timeA = new Date(a.createdAt || 0).getTime();
            const timeB = new Date(b.createdAt || 0).getTime();
            if (timeA !== timeB) {
              return timeB - timeA;
            }
            const dateA = new Date(a.targetDate || 0).getTime();
            const dateB = new Date(b.targetDate || 0).getTime();
            return dateB - dateA;
          });

          setInquiries(mappedInquiries);
          fetchSubjectOfficerNotifications(mappedInquiries);
          return;
        }
      } catch (err) {
        console.error("Failed to fetch inquiries from Supabase, falling back", err);
      }
    }

    // Fallback if not configured or query fails
    if (typeof window !== "undefined") {
      const storedCases = localStorage.getItem("dcmms_cases");
      const storedAsgns = localStorage.getItem("dcmms_subject_assignments");
      const storedDetails = localStorage.getItem("dcmms_new_letter_current_case");
      const storedLetters = localStorage.getItem("dcmms_letters");
      const localAsgnMap = new Map<string, string>();

      if (storedAsgns) {
        try {
          const list = JSON.parse(storedAsgns);
          list.forEach((a: any) => {
            const key = (a.caseNo || a.case_no || "").trim().toLowerCase();
            const officerName = a.subjectOfficerName || a.subject_officer_name;
            if (key && officerName && typeof officerName === "string" && officerName.trim()) {
              localAsgnMap.set(key, officerName.trim());
            }
            if (key && (a.appointmentDate || a.appointment_date || a.reportDueDate || a.report_due_date)) {
              datesMap.set(key, {
                appointmentDate: formatToInputDate(a.appointmentDate || a.appointment_date),
                reportDueDate: formatToInputDate(a.reportDueDate || a.report_due_date),
              });
            }
          });
        } catch (e) {}
      }

      if (storedDetails) {
        try {
          const list = JSON.parse(storedDetails);
          if (Array.isArray(list)) {
            list.forEach((d: any) => {
              const key = (d.caseNo || d.case_no || "").trim().toLowerCase();
              const officerName = d.subjectOfficerName || d.subject_officer_name;
              if (key && officerName && typeof officerName === "string" && officerName.trim() && !localAsgnMap.has(key)) {
                if (!officerName.toLowerCase().includes("kumara") && officerName.toLowerCase() !== "subject officer") {
                  localAsgnMap.set(key, officerName.trim());
                }
              }
            });
          }
        } catch (e) {}
      }

      if (storedLetters) {
        try {
          const list = JSON.parse(storedLetters);
          if (Array.isArray(list)) {
            list.forEach((l: any) => {
              const key = (l.refNo || l.caseNo || "").trim().toLowerCase();
              const officerName = l.subjectOfficerName || l.subject_officer_name;
              if (key && officerName && typeof officerName === "string" && officerName.trim() && !localAsgnMap.has(key)) {
                if (!officerName.toLowerCase().includes("kumara")) {
                  localAsgnMap.set(key, officerName.trim());
                }
              }
              if (key && (l.appointmentDate || l.reportDueDate)) {
                if (!datesMap.has(key)) {
                  datesMap.set(key, {
                    appointmentDate: formatToInputDate(l.appointmentDate),
                    reportDueDate: formatToInputDate(l.reportDueDate),
                  });
                }
              }
            });
          }
        } catch (e) {}
      }

      if (storedCases) {
        try {
          const list = JSON.parse(storedCases);
          const mapped = list
            .map((item: any) => {
              const itemNo = (item.caseNo || item.inquiryNo || item.case_no || "").trim().toLowerCase();
              const assignedSubjOfficer = localAsgnMap.get(itemNo) || item.subjectOfficerName || item.subject_officer_name || item.subjectOfficer || item.subject_officer || "";
              const dateInfo = datesMap.get(itemNo) || {};
              return {
                id: item.id || `case-${item.caseNo}`,
                inquiryNo: item.caseNo,
                subject: item.subject,
                targetDate: item.targetDate || item.assignedDate || "2026-07-30",
                status: item.status,
                assignedOfficer: item.assignedOfficer || item.assignedTo || item.officerName,
                subjectOfficer: assignedSubjOfficer,
                appointmentDate: dateInfo.appointmentDate || formatToInputDate(item.appointmentDate || item.appointment_date),
                reportDueDate: dateInfo.reportDueDate || formatToInputDate(item.reportDueDate || item.report_due_date),
                createdAt: item.createdAt || item.created_at || new Date().toISOString(),
              };
            });

          mapped.sort((a: any, b: any) => {
            const timeA = new Date(a.createdAt || 0).getTime();
            const timeB = new Date(b.createdAt || 0).getTime();
            if (timeA !== timeB) {
              return timeB - timeA;
            }
            const dateA = new Date(a.targetDate || 0).getTime();
            const dateB = new Date(b.targetDate || 0).getTime();
            return dateB - dateA;
          });

          setInquiries(mapped);
          return;
        } catch (e) {
          console.error("Failed to parse local storage cases", e);
        }
      }
    }

    const defaults: Inquiry[] = [
      {
        id: "1",
        inquiryNo: "INQ/2026/001",
        subject: "Formal disciplinary inquiry - Student misconduct at Royal College",
        targetDate: "2026-07-28",
        status: "In Progress",
        assignedOfficer: "Nimali Jayasinghe",
        subjectOfficer: "Imasha Gunasekara",
      },
      {
        id: "2",
        inquiryNo: "INQ/2026/002",
        subject: "Preliminary investigation on teacher absenteeism - Jaffna Office",
        targetDate: "2026-08-05",
        status: "Evidence Review",
        assignedOfficer: "Suresh Silva",
        subjectOfficer: "Kamal Perera",
      },
      {
        id: "3",
        inquiryNo: "INQ/2026/003",
        subject: "Inquiry into safety guidelines violation - Annual Sports Meet",
        targetDate: "2026-08-12",
        status: "Scheduled",
        assignedOfficer: "Nimali Jayasinghe",
        subjectOfficer: "Rathnaweera",
      },
    ];
    setInquiries(defaults);
    fetchSubjectOfficerNotifications(defaults);
  };

  const fetchInvestigationOfficers = async () => {
    let result: Officer[] = [];
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();

    const addOfficer = (raw: any) => {
      const fullName = (raw.fullName || raw.full_name || raw.name || "").trim();
      if (!fullName) return;

      const nameKey = fullName.toLowerCase();
      const id = raw.id || `inv-${nameKey}`;

      if (seenIds.has(id) || seenNames.has(nameKey)) return;

      seenIds.add(id);
      seenNames.add(nameKey);

      const studied = parseSchoolList(raw.studiedSchools || raw.studied_schools || raw.member_school_name);
      const children = parseSchoolList(raw.childrenSchools || raw.children_schools || raw.member_children_schools_name);

      const rolePos = (raw.position || raw.officerRole || raw.officer_role || "").trim();
      const isChairman = rolePos.toLowerCase() === "chairman" || rolePos.toLowerCase().includes("chairman");
      const roleType = isChairman ? "Chairman" : "Member";

      result.push({
        id,
        employeeNo: raw.employeeNo || raw.employee_no || "",
        fullName,
        nicNo: raw.nicNo || raw.nic_no || "",
        officerRole: roleType,
        position: rolePos || roleType,
        studiedSchools: studied,
        childrenSchools: children,
        email: raw.email || "",
        role: "investigation_officer",
        status: (raw.status === "Inactive" || raw.state === "Inactive" ? "Inactive" : "Active") as "Active" | "Inactive",
        createdAt: (raw.createdAt || raw.created_at || new Date().toISOString()).slice(0, 10),
      });
    };

    // 1. Fetch from PostgreSQL commitee_table & school_table
    try {
      const commRes = await getCommitteeOfficersWithSchoolsServer();
      if (commRes && commRes.success && Array.isArray(commRes.data)) {
        commRes.data.forEach(addOfficer);
      }
    } catch (e) {}

    // 2. Fetch from Supabase commitee_table & dcmms_investigation_officers
    if (isSupabaseConfigured) {
      try {
        const { data: dbComm } = await supabase
          .from("commitee_table")
          .select("*")
          .order("created_at", { ascending: false });
        if (dbComm && dbComm.length > 0) {
          dbComm.forEach(addOfficer);
        }
      } catch (err) {}

      try {
        const { data: dbInv } = await supabase
          .from("dcmms_investigation_officers")
          .select("*")
          .order("created_at", { ascending: false });
        if (dbInv && dbInv.length > 0) {
          dbInv.forEach(addOfficer);
        }
      } catch (err) {}

      try {
        const { data: dbProf } = await supabase
          .from("dcmms_profiles")
          .select("*")
          .eq("role", "investigation_officer")
          .order("created_at", { ascending: false });
        if (dbProf && dbProf.length > 0) {
          dbProf.forEach(addOfficer);
        }
      } catch (err) {}
    }

    if (typeof window !== "undefined") {
      const keys = ["dcmms_investigation_officers", "dcmms_custom_profiles", "dcmms_profiles"];
      keys.forEach((key) => {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const list = JSON.parse(stored);
            if (Array.isArray(list)) {
              list.forEach((item: any) => {
                if (key === "dcmms_investigation_officers" || item.role === "investigation_officer") {
                  addOfficer(item);
                }
              });
            }
          }
        } catch (e) {}
      });
    }

    setOfficers(result);

    // Fetch Subject Officers directly from dcmms_profiles DB table, assignments tables & local storage
    const defaultSubjectOfficers = [
      "Rathnaweera",
      "Kamal Perera",
      "Suresh Silva",
      "Aruni Rajapaksha",
      "Kumara",
    ];
    const subjSet = new Set<string>(defaultSubjectOfficers);

    if (isSupabaseConfigured) {
      try {
        // 1. Load registered Subject Officers from dcmms_profiles DB table
        const { data: dbSubj } = await supabase
          .from("dcmms_profiles")
          .select("full_name, role, officer_role, status");
        if (dbSubj && Array.isArray(dbSubj)) {
          dbSubj.forEach((p: any) => {
            const r = (p.role || p.officer_role || "").toLowerCase();
            if ((r.includes("subject") || r === "subject_officer") && p.status !== "Inactive" && p.full_name) {
              subjSet.add(p.full_name.trim());
            }
          });
        }

        // 2. Load from dcmms_subject_assignments table
        const { data: dbAsgnList } = await supabase
          .from("dcmms_subject_assignments")
          .select("subject_officer_name");
        if (dbAsgnList && Array.isArray(dbAsgnList)) {
          dbAsgnList.forEach((a: any) => {
            if (a.subject_officer_name && a.subject_officer_name.trim()) {
              const name = a.subject_officer_name.trim();
              if (name !== "Subject Officer" && name !== "Unassigned") subjSet.add(name);
            }
          });
        }

        // 3. Load from dcmms_subject table
        const { data: dbSubjCases } = await supabase
          .from("dcmms_subject")
          .select("subject_officer_name");
        if (dbSubjCases && Array.isArray(dbSubjCases)) {
          dbSubjCases.forEach((s: any) => {
            if (s.subject_officer_name && s.subject_officer_name.trim()) {
              const name = s.subject_officer_name.trim();
              if (name !== "Subject Officer" && name !== "Unassigned") subjSet.add(name);
            }
          });
        }
      } catch (e) {
        console.warn("Supabase Subject Officers table query warning:", e);
      }
    }

    if (typeof window !== "undefined") {
      const storedCustom = localStorage.getItem("dcmms_custom_profiles");
      if (storedCustom) {
        try {
          const list = JSON.parse(storedCustom);
          if (Array.isArray(list)) {
            list.forEach((item: any) => {
              const r = (item.role || item.officerRole || "").toLowerCase();
              if ((r.includes("subject") || r === "subject_officer") && item.fullName) {
                subjSet.add(item.fullName.trim());
              }
            });
          }
        } catch (e) {}
      }

      const storedOfficers = localStorage.getItem("dcmms_subject_officers");
      if (storedOfficers) {
        try {
          const list = JSON.parse(storedOfficers);
          if (Array.isArray(list)) {
            list.forEach((item: any) => {
              if (typeof item === "string" && item.trim()) subjSet.add(item.trim());
              else if (item?.fullName) subjSet.add(item.fullName.trim());
            });
          }
        } catch (e) {}
      }
    }

    setSubjectOfficersList(Array.from(subjSet));
  };

  const fetchWidgetEvents = async () => {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from("dcmms_calendar")
          .select("*");

        if (!error && data) {
          const mapped = data.map((item: any) => ({
            id: item.id,
            summary: item.summary,
            description: item.description || "",
            start: { dateTime: item.start_time },
            end: { dateTime: item.end_time },
            location: item.location || "",
            source: item.source || "User Input"
          }));
          const sorted = mapped.sort((a: any, b: any) => {
            return new Date(a.start?.dateTime).getTime() - new Date(b.start?.dateTime).getTime();
          });
          setCalendarEvents(sorted);
          setIsCalendarLoading(false);
          return;
        }
      } catch (err) {
        console.error("Failed to fetch calendar events from Supabase in widget", err);
      }
    }

    // Fallback
    try {
      const stored = localStorage.getItem("dcmms_calendar_events");
      const list = stored ? JSON.parse(stored) : [
        {
          id: "mock-inq-001",
          summary: "Inquiry Hearing: INQ/2026/001",
          description: "Formal disciplinary inquiry - Student misconduct at Royal College",
          start: { dateTime: "2026-07-28T10:00:00+05:30" },
          end: { dateTime: "2026-07-28T12:00:00+05:30" },
          location: "Discipline Branch, Ministry of Education, Isurupaya",
          source: "Inquiry Target Date"
        },
        {
          id: "mock-inq-002",
          summary: "Inquiry Hearing: INQ/2026/002",
          description: "Preliminary investigation on teacher absenteeism - Jaffna Office",
          start: { dateTime: "2026-08-05T09:30:00+05:30" },
          end: { dateTime: "2026-08-05T11:30:00+05:30" },
          location: "Zonal Education Office, Jaffna",
          source: "Inquiry Target Date"
        }
      ];
      const sorted = list.sort((a: any, b: any) => {
        return new Date(a.start?.dateTime).getTime() - new Date(b.start?.dateTime).getTime();
      });
      setCalendarEvents(sorted);
    } catch (err) {
      console.error("Failed to load local calendar events in widget", err);
    } finally {
      setIsCalendarLoading(false);
    }
  };

  const fetchSubjectOfficerNotifications = async (currentInquiries?: any[]) => {
    setIsNotifLoading(true);
    const notifMap = new Map<string, any>();

    const formatVal = (v: any) => {
      if (!v || v === "—") return "—";
      const formatted = formatToInputDate(v);
      return formatted || v;
    };

    if (isSupabaseConfigured) {
      // 1. Fetch from dcmms_subject_assignments table
      try {
        const { data, error } = await supabase
          .from("dcmms_subject_assignments")
          .select("*")
          .order("updated_at", { ascending: false });

        if (!error && data && data.length > 0) {
          data.forEach((item: any) => {
            const caseNo = item.case_no || item.caseNo;
            if (!caseNo) return;
            const appt = formatVal(item.appointment_date || item.appointmentDate);
            const due = formatVal(item.report_due_date || item.reportDueDate);
            const key = caseNo.trim().toLowerCase();
            notifMap.set(key, {
              id: item.id || `notif-${caseNo}`,
              caseNo: caseNo,
              subjectOfficerName: item.subject_officer_name || item.subjectOfficerName || "Assigned Subject Officer",
              appointmentDate: appt,
              reportDueDate: due,
              submittedAt: item.updated_at ? (typeof item.updated_at === "string" ? item.updated_at.split("T")[0] : new Date(item.updated_at).toLocaleDateString()) : new Date().toLocaleDateString(),
              status: item.status || "Dates Submitted"
            });
          });
        }
      } catch (err) {
        console.error("Failed to fetch subject officer notifications from Supabase", err);
      }

      // 2. Fetch from dcmms_subject table
      try {
        const { data, error } = await supabase
          .from("dcmms_subject")
          .select("*")
          .order("updated_at", { ascending: false });

        if (!error && data && data.length > 0) {
          data.forEach((item: any) => {
            const caseNo = item.case_no || item.inquiryNo || item.caseNo;
            if (!caseNo) return;
            const appt = formatVal(item.appointment_date || item.appointmentDate);
            const due = formatVal(item.report_due_date || item.reportDueDate || item.assigned_date);
            const key = caseNo.trim().toLowerCase();
            const existing = notifMap.get(key);
            const subjName = item.subject_officer_name || item.officer_name || item.subjectOfficerName || "Assigned Subject Officer";

            if (!existing) {
              notifMap.set(key, {
                id: item.id || `sub-notif-${caseNo}`,
                caseNo: caseNo,
                subjectOfficerName: subjName,
                appointmentDate: appt,
                reportDueDate: due,
                submittedAt: item.updated_at ? (typeof item.updated_at === "string" ? item.updated_at.split("T")[0] : new Date(item.updated_at).toLocaleDateString()) : new Date().toLocaleDateString(),
                status: item.status || "Dates Submitted"
              });
            } else {
              if (existing.appointmentDate === "—" && appt !== "—") existing.appointmentDate = appt;
              if (existing.reportDueDate === "—" && due !== "—") existing.reportDueDate = due;
              if ((!existing.subjectOfficerName || existing.subjectOfficerName === "Assigned Subject Officer") && subjName !== "Assigned Subject Officer") {
                existing.subjectOfficerName = subjName;
              }
            }
          });
        }
      } catch (err) {
        console.error("Failed to fetch dcmms_subject for notifications", err);
      }
    }

    // 3. Merge/fallback from localStorage keys
    const localKeys = ["dcmms_subject_assignments", "dcmms_cases", "dcmms_letters", "dcmms_inquiries", "dcmms_subject", "dcmms_new_letter_current_case", "dcmms_daily_mail"];
    localKeys.forEach((keyName) => {
      try {
        const stored = localStorage.getItem(keyName);
        if (stored) {
          const localList = JSON.parse(stored);
          if (Array.isArray(localList)) {
            localList.forEach((item: any) => {
              const caseNo = item.caseNo || item.case_no || item.inquiryNo || item.refNo;
              if (!caseNo) return;
              const appt = formatVal(item.appointmentDate || item.appointment_date);
              const due = formatVal(item.reportDueDate || item.report_due_date || item.targetDate || item.assignedDate);
              const normKey = caseNo.trim().toLowerCase();
              const existing = notifMap.get(normKey);
              const subjName = item.subjectOfficerName || item.subject_officer_name || item.subjectOfficer || item.officer_name || "Assigned Subject Officer";

              if (!existing) {
                const rawSubTime = item.datesSubmitTimestamp || item.updatedAt || item.updated_at;
                const cleanSubTime = rawSubTime ? (typeof rawSubTime === "string" ? rawSubTime.split("T")[0] : new Date(rawSubTime).toLocaleDateString()) : new Date().toLocaleDateString();
                notifMap.set(normKey, {
                  id: item.id || `local-${keyName}-${caseNo}`,
                  caseNo: caseNo,
                  subjectOfficerName: subjName,
                  appointmentDate: appt,
                  reportDueDate: due,
                  submittedAt: cleanSubTime,
                  status: item.status || "Dates Submitted"
                });
              } else {
                if (existing.appointmentDate === "—" && appt !== "—") existing.appointmentDate = appt;
                if (existing.reportDueDate === "—" && due !== "—") existing.reportDueDate = due;
                if ((!existing.subjectOfficerName || existing.subjectOfficerName === "Assigned Subject Officer") && subjName !== "Assigned Subject Officer") {
                  existing.subjectOfficerName = subjName;
                }
              }
            });
          }
        }
      } catch (err) {
        console.error(`Failed to read ${keyName} for notifications`, err);
      }
    });

    // 4. Merge all active inquiries from parameter or state
    const inqsToMerge = currentInquiries && currentInquiries.length > 0 ? currentInquiries : inquiries;
    if (Array.isArray(inqsToMerge) && inqsToMerge.length > 0) {
      inqsToMerge.forEach((inq: any) => {
        const caseNo = inq.inquiryNo || inq.caseNo;
        if (!caseNo) return;
        const normKey = caseNo.trim().toLowerCase();
        const appt = formatVal(inq.appointmentDate || inq.appointment_date);
        const due = formatVal(inq.reportDueDate || inq.report_due_date || inq.targetDate);
        const subjName = inq.subjectOfficer || inq.subject_officer_name || inq.assignedOfficer || "Assigned Subject Officer";
        const existing = notifMap.get(normKey);

        if (!existing) {
          notifMap.set(normKey, {
            id: inq.id || `inq-notif-${caseNo}`,
            caseNo: caseNo,
            subjectOfficerName: subjName,
            appointmentDate: appt,
            reportDueDate: due,
            submittedAt: inq.createdAt ? new Date(inq.createdAt).toLocaleDateString() : new Date().toLocaleDateString(),
            status: "Dates Submitted by Subject Officer"
          });
        } else {
          if (existing.appointmentDate === "—" && appt !== "—") existing.appointmentDate = appt;
          if (existing.reportDueDate === "—" && due !== "—") existing.reportDueDate = due;
          if ((!existing.subjectOfficerName || existing.subjectOfficerName === "Assigned Subject Officer") && subjName !== "Assigned Subject Officer") {
            existing.subjectOfficerName = subjName;
          }
        }
      });
    }

    let notifList = Array.from(notifMap.values());

    // Sort notifications so cases with valid dates appear first
    notifList.sort((a, b) => {
      const aHasDates = (a.appointmentDate !== "—" ? 1 : 0) + (a.reportDueDate !== "—" ? 1 : 0);
      const bHasDates = (b.appointmentDate !== "—" ? 1 : 0) + (b.reportDueDate !== "—" ? 1 : 0);
      if (aHasDates !== bHasDates) return bHasDates - aHasDates;
      return a.caseNo.localeCompare(b.caseNo);
    });

    // Fallback demonstration notifications if none found
    if (notifList.length === 0) {
      notifList = [
        {
          id: "demo-notif-001",
          caseNo: "INQ/2026/001",
          subjectOfficerName: "K. L. Gamage",
          appointmentDate: "2026-07-28",
          reportDueDate: "2026-08-30",
          submittedAt: new Date().toLocaleDateString(),
          status: "Dates Submitted by Subject Officer"
        },
        {
          id: "demo-notif-002",
          caseNo: "INQ/2026/002",
          subjectOfficerName: "M. R. Perera",
          appointmentDate: "2026-08-01",
          reportDueDate: "2026-09-15",
          submittedAt: new Date().toLocaleDateString(),
          status: "Dates Submitted by Subject Officer"
        }
      ];
    }

    setSubjectOfficerNotifications(notifList);
    setIsNotifLoading(false);
  };

  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchInquiries(),
        fetchInvestigationOfficers(),
        fetchWidgetEvents(),
        fetchSubjectOfficerNotifications()
      ]);
      setIsLoading(false);
    };
    initData();

    // Real-time subscription
    const channel1 = supabase
      .channel("invest-realtime-enhanced")
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_subject" }, () => {
        fetchInquiries();
        fetchSubjectOfficerNotifications();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_profiles" }, fetchInvestigationOfficers)
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_subject_assignments" }, () => fetchSubjectOfficerNotifications())
      .subscribe();

    const handleLocalUpdates = () => {
      fetchSubjectOfficerNotifications();
      fetchInquiries();
      fetchInvestigationOfficers();
    };

    window.addEventListener("storage", handleLocalUpdates);
    window.addEventListener("dcmms_assignment_updated", handleLocalUpdates);
    window.addEventListener("dcmms_data_updated", handleLocalUpdates);

    const interval = setInterval(() => {
      fetchInquiries();
      fetchInvestigationOfficers();
      fetchSubjectOfficerNotifications();
    }, 15000);


    return () => {
      supabase.removeChannel(channel1);
      window.removeEventListener("storage", handleLocalUpdates);
      window.removeEventListener("dcmms_assignment_updated", handleLocalUpdates);
      window.removeEventListener("dcmms_data_updated", handleLocalUpdates);
      clearInterval(interval);
    };
  }, []);

  // ── Session guard ──────────────────────────────────────────────────────────
  useEffect(() => {
    getCurrentProfile().then((profile) => {
      if (!profile || profile.role !== "investigation_officer") router.replace("/");
    });
  }, [router]);

  // ── Log out handler ────────────────────────────────────────────────────────
  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut();
    router.push("/");
  };

  // ── Open Case details modal & Load Subject Officer submissions ─────────────
  const handleOpenCaseModal = async (inq: Inquiry) => {
    setSelectedCase(inq);
    setIsDetailsLoading(true);
    setIsCaseModalOpen(true);
    
    // Set initial form states
    setTargetDate(inq.targetDate || "");
    setInvestigationStatus(inq.status || "In Progress");
    setInvestigationNotes("");
    setFileRefNoForm((inq as any).investigationFileNo || (inq as any).fileNo || (inq as any).fileRefNo || "");

    // Load existing Subject Officer assignment (Data Flow)
    if (typeof window !== "undefined") {
      try {
        const storedAssignments = localStorage.getItem("dcmms_subject_assignments");
        if (storedAssignments) {
          const list = JSON.parse(storedAssignments);
          const searchKey = String(inq.inquiryNo || (inq as any).caseNo || (inq as any).refNo || "").trim().toLowerCase();
          const found = list.find((a: any) => 
            String(a.caseNo || a.case_no || a.id || "").trim().toLowerCase() === searchKey ||
            searchKey.includes(String(a.caseNo || a.case_no || "").trim().toLowerCase())
          );
          if (found) {
            setExistingAssignment(found);
            setSubjOfficerName(found.subjectOfficerName || inq.subjectOfficer || "");
            const appt = formatToInputDate(found.appointmentDate || found.appointment_date || inq.appointmentDate);
            const due = formatToInputDate(found.reportDueDate || found.report_due_date || inq.reportDueDate || inq.targetDate);
            setSubjAppointmentDate(appt);
            setSubjReportDueDate(due);
            setStep2AppointmentDate(appt);
            setStep2ReportDueDate(due);
            setStep2Submitted(!!found.datesSubmittedBySubject);

            setSubjExtensionTerm(found.extensionTerm || "None");
            setSubjExtensionStartDate(found.extensionStartDate || "");
            setSubjExtensionEndDate(found.extensionEndDate || "");

            setWorkflowStep(found.currentStep || (found.reportApprovedByAdmin ? 5 : (found.datesSubmittedBySubject ? 3 : (found.subjectOfficerName ? 2 : 1))));
            setStep1AssignedOfficers(Array.isArray(found.assignedOfficers) ? found.assignedOfficers : (found.subjectOfficerName ? [found.subjectOfficerName] : []));
            setStep3ExtensionTerm(found.extensionTerm || "None");
            setStep3ExtensionStartDate(found.extensionStartDate || "");
            setStep3ExtensionEndDate(found.extensionEndDate || "");
            setStep3ExtensionRequested(!!found.extensionRequestedByAdmin);
            setStep3ExtensionCertified(!!found.certificationSubmitted);
            setStep4FinalReport(found.finalReportContent || found.reportContent || "");
            setStep4ApprovalDate(found.approvalDate || "");
            setStep4Completed(!!found.reportApprovedByAdmin);
          } else {
            setExistingAssignment(null);
            setSubjOfficerName(inq.subjectOfficer || "");
            const appt = formatToInputDate(inq.appointmentDate);
            const due = formatToInputDate(inq.reportDueDate || inq.targetDate);
            setSubjAppointmentDate(appt);
            setSubjReportDueDate(due);
            setStep2AppointmentDate(appt);
            setStep2ReportDueDate(due);

            setWorkflowStep(inq.assignedOfficer ? 2 : 1);
            setStep1AssignedOfficers(inq.assignedOfficer ? [inq.assignedOfficer] : []);
            setStep2Submitted(false);
            setStep3ExtensionTerm("None");
            setStep3ExtensionStartDate("");
            setStep3ExtensionEndDate("");
            setStep3ExtensionRequested(false);
            setStep3ExtensionCertified(false);
            setStep4FinalReport("");
            setStep4ApprovalDate("");
            setStep4Completed(false);
          }
        } else {
          setExistingAssignment(null);
          setSubjOfficerName(inq.assignedOfficer || "");
          const appt = formatToInputDate(inq.appointmentDate);
          const due = formatToInputDate(inq.reportDueDate || inq.targetDate);
          setSubjAppointmentDate(appt);
          setSubjReportDueDate(due);
          setStep2AppointmentDate(appt);
          setStep2ReportDueDate(due);
        }

        const currentCaseRefNo = inq.inquiryNo || (inq as any).caseNo || (inq as any).refNo || "";
        if (currentCaseRefNo) {
          try {
            const chairRes = await getChairmanByCaseServer(currentCaseRefNo);
            if (chairRes && chairRes.success && chairRes.data) {
              const chairRow = chairRes.data;
              if (chairRow.full_name) {
                setSelectedChairman({
                  id: chairRow.id || `chair-${chairRow.ref_number}`,
                  fullName: chairRow.full_name,
                  position: chairRow.position || "Chairman",
                  email: chairRow.email || "",
                  officerRole: "Chairman",
                });
              }
            }
          } catch (e) {}

          try {
            const memRes = await getMembersByCaseServer(currentCaseRefNo);
            if (memRes && memRes.success && Array.isArray(memRes.data) && memRes.data.length > 0) {
              const mappedMembers = memRes.data.map((row: any) => ({
                id: row.id || `mem-${row.ref_number}-${row.id}`,
                fullName: row.full_name,
                name: row.full_name,
                position: row.position || "Member",
                email: row.email || "",
                officerRole: "Member",
              }));
              setSelectedMembers(mappedMembers);
            }
          } catch (e) {}
        }
      } catch (e) {
        console.error("Failed to load assignment data", e);
      }
    }
    
    let concernedData: any = null;
    let concernedList: any[] = [];
    let detailList: any[] = [];

    // 1. Fetch from Supabase
    if (isSupabaseConfigured) {
      try {
        const searchCaseNo = (inq.inquiryNo || (inq as any).caseNo || (inq as any).refNo || "").trim();
        if (searchCaseNo) {
          const { data: dbAsgn } = await supabase
            .from("dcmms_subject_assignments")
            .select("*")
            .ilike("case_no", searchCaseNo)
            .maybeSingle();
          if (dbAsgn) {
            const appt = formatToInputDate(dbAsgn.appointment_date || dbAsgn.appointmentDate);
            const due = formatToInputDate(dbAsgn.report_due_date || dbAsgn.reportDueDate);

            const found = {
              id: dbAsgn.id,
              caseNo: dbAsgn.case_no,
              subjectOfficerName: dbAsgn.subject_officer_name,
              status: dbAsgn.status,
              assignedOfficers: dbAsgn.assigned_officers,
              chairman: dbAsgn.chairman,
              members: dbAsgn.members,
              appointmentDate: appt,
              reportDueDate: due,
              datesSubmittedBySubject: dbAsgn.dates_submitted_by_subject || dbAsgn.datesSubmittedBySubject || false,
              extensionTerm: dbAsgn.extension_term,
              extensionStartDate: dbAsgn.extension_start_date,
              extensionEndDate: dbAsgn.extension_end_date,
              extensionRequestedByAdmin: !!(dbAsgn.extension_requested_by_admin),
              extensionApprovalStatus: dbAsgn.extension_approval_status,
              extensionDecisionDate: dbAsgn.extension_decision_date,
              certificationSubmitted: dbAsgn.certification_submitted,
              reportSubmitDate: dbAsgn.report_submit_date,
              reportContent: dbAsgn.report_content,
              investigationFileNo: dbAsgn.investigation_file_no,
              investigationStatus: dbAsgn.investigation_status,
              investigationNotes: dbAsgn.investigation_notes,
            };
            setExistingAssignment((prev: any) => ({
              ...prev,
              ...found,
              appointmentDate: appt || prev?.appointmentDate,
              reportDueDate: due || prev?.reportDueDate,
            }));
            setSubjOfficerName(found.subjectOfficerName || inq.subjectOfficer || "");
            if (appt) setSubjAppointmentDate(appt);
            if (due) setSubjReportDueDate(due);
            if (appt) setStep2AppointmentDate(appt);
            if (due) setStep2ReportDueDate(due);
            if (found.datesSubmittedBySubject) setStep2Submitted(true);
            if (found.extensionTerm) {
              setSubjExtensionTerm(found.extensionTerm as any);
              setStep3ExtensionTerm(found.extensionTerm as any);
            }
            if (found.extensionStartDate) {
              setSubjExtensionStartDate(found.extensionStartDate);
              setStep3ExtensionStartDate(found.extensionStartDate);
            }
            if (found.extensionEndDate) {
              setSubjExtensionEndDate(found.extensionEndDate);
              setStep3ExtensionEndDate(found.extensionEndDate);
            }
            if (found.chairman) setSelectedChairman(found.chairman);
            if (found.members && Array.isArray(found.members)) setSelectedMembers(found.members);
          }

          // First attempt to load accused officers from PostgreSQL accused_officer_table & accused_school_table
          try {
            const pgRes = await getAccusedOfficerByRefServer(searchCaseNo);
            if (pgRes && pgRes.success && pgRes.data) {
              const d = pgRes.data;
              const officersList = Array.isArray(d.accused_officers) && d.accused_officers.length > 0
                ? d.accused_officers
                : (d.accused_officer ? [d.accused_officer] : []);
              if (officersList.length > 0) {
                concernedList = officersList.map((ao: any) => ({
                  officer_name: ao.accused_officer_name || ao.officer_name || "",
                  position: ao.position || "",
                  dob: ao.date_of_birth ? String(ao.date_of_birth).split("T")[0] : "",
                  nic: ao.nic_no || ao.nic || "",
                  appointment_date: ao.appointment_date ? String(ao.appointment_date).split("T")[0] : "",
                  address: ao.address || ao.officer_address || "",
                  institute_name: ao.accused_school_name || ao.institute_name || d.accused_school?.accused_school_name || "",
                  institute_address: ao.school_address || d.accused_school?.address || "",
                }));
                concernedData = d;
              }
            }
          } catch (pgErr) {
            console.warn("Failed to load accused officer details from PostgreSQL:", pgErr);
          }

          if (concernedList.length === 0) {
            const { data: cData } = await supabase
              .from("dcmms_concerned_officers")
              .select("*")
              .ilike("case_no", searchCaseNo);
            if (cData && cData.length > 0) {
              concernedList = cData;
              concernedData = cData[0];
            }
          }
        }

        const { data: dData } = await supabase
          .from("dcmms_subject_details")
          .select("*")
          .eq("case_no", inq.inquiryNo)
          .order("received_date", { ascending: false });
        if (dData) detailList = dData;
      } catch (e) {
        console.error("Failed to load details from Supabase", e);
      }
    }

    // 2. Fallback to localStorage
    if (typeof window !== "undefined") {
      if (concernedList.length === 0) {
        try {
          const storedConcerned = localStorage.getItem("dcmms_officer_concerned");
          if (storedConcerned) {
            const map = JSON.parse(storedConcerned);
            const targetKeys = [inq.inquiryNo, (inq as any).caseNo, (inq as any).refNo].filter(Boolean).map(k => String(k).trim().toLowerCase());
            const matchedKey = Object.keys(map).find(k => targetKeys.includes(k.trim().toLowerCase()));
            const item = matchedKey ? map[matchedKey] : map[inq.inquiryNo];
            if (item) {
              concernedData = item;
              if (Array.isArray(item.persons) && item.persons.length > 0) {
                concernedList = item.persons.map((p: any) => ({
                  officer_name: p.name || p.officer_name || p.officerName,
                  position: p.position || p.designation,
                  dob: p.dob,
                  nic: p.nic,
                  appointment_date: p.appointmentDate || p.appointment_date,
                  address: p.address,
                  institute_name: item.instituteName || item.schoolName,
                  institute_address: item.schoolAddress || item.instituteAddress,
                }));
              } else if (item.accusedOfficer || item.accused_officer) {
                concernedList = [{
                  officer_name: item.accusedOfficer || item.accused_officer,
                  position: item.position || item.designation,
                  dob: item.dob,
                  nic: item.nic,
                  appointment_date: item.appointmentDate || item.appointment_date,
                  address: item.address,
                  institute_name: item.instituteName || item.schoolName,
                  institute_address: item.schoolAddress || item.instituteAddress,
                }];
              }
            }
          }
        } catch (e) {}

        // 3. Fallback to inline case properties
        if (concernedList.length === 0 && (inq as any).persons && Array.isArray((inq as any).persons)) {
          concernedList = (inq as any).persons.map((p: any) => ({
            officer_name: p.name || p.officer_name || p.officerName,
            position: p.position || p.designation,
            dob: p.dob,
            nic: p.nic,
            appointment_date: p.appointmentDate || p.appointment_date,
            address: p.address,
            institute_name: p.instituteName || (inq as any).schoolName,
            institute_address: p.schoolAddress || (inq as any).schoolAddress,
          }));
        } else if (concernedList.length === 0 && ((inq as any).accusedOfficer || (inq as any).accused_officer)) {
          concernedList = [{
            officer_name: (inq as any).accusedOfficer || (inq as any).accused_officer,
            position: (inq as any).position || (inq as any).designation,
            dob: (inq as any).dob,
            nic: (inq as any).nic,
            appointment_date: (inq as any).appointmentDate || (inq as any).appointment_date,
            address: (inq as any).address,
            institute_name: (inq as any).instituteName || (inq as any).schoolName,
            institute_address: (inq as any).schoolAddress || (inq as any).instituteAddress,
          }];
        }
      }

      if (detailList.length === 0) {
        try {
          const storedActions = localStorage.getItem("dcmms_new_letter_current_case");
          if (storedActions) {
            const list = JSON.parse(storedActions);
            detailList = list.filter((a: any) => a.caseNo === inq.inquiryNo);
          }
        } catch (e) {}
      }
    }

    // Extract assignee if existing logs contain assignment
    const assignLog = detailList.find(d => (d.step_taken && d.step_taken.includes("Assigned to")) || (d.stepTaken && d.stepTaken.includes("Assigned to")));
    if (assignLog) {
      const text = assignLog.step_taken || assignLog.stepTaken || "";
      const match = text.match(/Assigned to ([^.]+)/);
      if (match) setAssignee(match[1].trim());
    } else {
      if (typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem("dcmms_cases");
          if (stored) {
            const list = JSON.parse(stored);
            const found = list.find((c: any) => c.caseNo === inq.inquiryNo);
            if (found && found.assignedTo) {
              setAssignee(found.assignedTo);
            } else {
              setAssignee("");
            }
          }
        } catch (e) {}
      }
    }

    const cleanConcerned = (concernedList || []).filter((officer) => {
      if (!officer) return false;
      const name = (officer.officer_name || officer.officerName || "").trim();
      if (!name) return false;
      const subjName = (inq?.subjectOfficer || inq?.assignedOfficer || subjOfficerName || "").trim();
      if (subjName && name.toLowerCase() === subjName.toLowerCase()) {
        if (!officer.nic && !officer.position && !officer.address && !officer.dob) {
          return false;
        }
      }
      return true;
    });

    setConcernedOfficer(concernedData);
    setConcernedOfficersList(cleanConcerned);
    setSubjectActions(detailList);
    setIsDetailsLoading(false);
  };

  // ── Quick Preset Note Click Handler ──────────────────────────────────────
  const handleAddPresetNote = (presetText: string) => {
    if (!investigationNotes) {
      setInvestigationNotes(presetText);
    } else {
      setInvestigationNotes((prev) => `${prev}\n• ${presetText}`);
    }
  };

  // ── Handler: Investigation Administrator sends Investigation Committee Assignment details to Subject Officer ──
  const handleSendCommitteeToSubjectOfficer = async () => {
    if (!selectedChairman && selectedMembers.length === 0) {
      showToast(lang === "si" ? "කරුණාකර අවම වශයෙන් සභාපතිවරයෙකු හෝ එක් කමිටු සාමාජිකයෙකු තෝරන්න." : "Please select a Chairman or at least one Committee Member first.");
      return;
    }

    const caseNo = selectedCase?.inquiryNo || (selectedCase as any)?.caseNo || (selectedCase as any)?.refNo || (selectedCase as any)?.case_no || (selectedCase as any)?.id;
    if (!caseNo) {
      showToast(lang === "si" ? "නඩු අංකය සොයාගත නොහැකි විය." : "Case Reference Number not found.");
      return;
    }

    const targetOfficer = subjOfficerName.trim() || assignee.trim() || selectedCase?.subjectOfficer || selectedCase?.assignedOfficer || "";
    if (!targetOfficer || targetOfficer === "Subject Officer" || targetOfficer === "Unassigned") {
      showToast(lang === "si" ? "කරුණාකර තොරතුරු යැවිය යුතු විෂය භාර නිලධාරියා තෝරන්න." : "Please select a Subject Officer to send the committee details to.");
      return;
    }
    const displayOfficerName = formatSubjectOfficerName(targetOfficer, lang);

    const chairmanPart = selectedChairman ? `Chairman: ${selectedChairman.fullName || selectedChairman.name}` : "";
    const membersPart = selectedMembers.length > 0 ? `Members: ${selectedMembers.map((m) => m.fullName || m.name).join(", ")}` : "";
    const formattedAssignedText = [chairmanPart, membersPart].filter(Boolean).join(" | ") || targetOfficer;

    const now = new Date().toISOString().slice(0, 10);
    const actionId = `act-committee-${caseNo}-${Date.now()}`;
    const desc = `Investigation Committee Assignment details (${formattedAssignedText}) sent to Subject Officer (${displayOfficerName}).`;

    setIsSaving(true);

    const updatedRecord = {
      ...(existingAssignment || {}),
      id: existingAssignment?.id || `asgn-${caseNo}-${Date.now()}`,
      caseNo,
      subjectOfficerName: targetOfficer || "Subject Officer",
      assignedOfficers: formattedAssignedText,
      chairman: selectedChairman,
      members: selectedMembers,
      committeeSent: true,
      committeeSentAt: now,
      status: "Committee Details Sent to Subject Officer",
      updatedAt: now
    };

    setExistingAssignment(updatedRecord);

    if (selectedChairman && caseNo) {
      const payload = {
        fullName: selectedChairman.fullName || selectedChairman.name || "",
        position: selectedChairman.position || "Chairman",
        email: selectedChairman.email || "",
      };
      try {
        await saveChairmanByCaseServer(caseNo, payload);
      } catch (e) {}
      if (isSupabaseConfigured) {
        try {
          let validEmail = null;
          if (selectedChairman.email) {
            const { data: commData } = await supabase
              .from("commitee_table")
              .select("email")
              .ilike("email", selectedChairman.email.trim())
              .maybeSingle();
            if (commData) validEmail = commData.email;
          }
          await supabase.from("chairment_by_case").upsert({
            ref_number: caseNo.trim(),
            full_name: payload.fullName,
            position: payload.position,
            email: validEmail,
            updated_at: new Date().toISOString(),
          }, { onConflict: "ref_number" });
        } catch (e) {}
      }
    }

    if (caseNo) {
      try {
        await syncMembersToCase(caseNo, selectedMembers);
      } catch (e) {}
    }

    if (typeof window !== "undefined") {
      try {
        const storedAssignments = localStorage.getItem("dcmms_subject_assignments") || "[]";
        let list = JSON.parse(storedAssignments);
        list = list.filter((a: any) => a.caseNo !== caseNo);
        list.push(updatedRecord);
        localStorage.setItem("dcmms_subject_assignments", JSON.stringify(list));
      } catch (e) {}

      try {
        const storedLetters = localStorage.getItem("dcmms_letters") || "[]";
        let letters = JSON.parse(storedLetters);
        const idx = letters.findIndex((l: any) => l.refNo === caseNo);
        if (idx >= 0) {
          letters[idx].officerName = targetOfficer || letters[idx].officerName;
          letters[idx].committeeDetails = formattedAssignedText;
          letters[idx].status = "assigned";
        } else {
          letters.push({
            id: `let-${caseNo}-${Date.now()}`,
            refNo: caseNo,
            officerName: targetOfficer || "Subject Officer",
            subject: selectedCase?.subject || `Assigned Inquiry Case (${caseNo})`,
            receivedDate: now,
            status: "assigned",
            committeeDetails: formattedAssignedText,
            priority: "high"
          });
        }
        localStorage.setItem("dcmms_letters", JSON.stringify(letters));
      } catch (e) {}

      try {
        const storedCases = localStorage.getItem("dcmms_cases") || "[]";
        let cases = JSON.parse(storedCases);
        const idx = cases.findIndex((c: any) => c.caseNo === caseNo || c.refNo === caseNo);
        if (idx >= 0) {
          cases[idx].assignedTo = targetOfficer || cases[idx].assignedTo;
          cases[idx].subjectOfficer = targetOfficer || cases[idx].subjectOfficer;
          cases[idx].assignedOfficers = formattedAssignedText;
          cases[idx].chairman = selectedChairman;
          cases[idx].members = selectedMembers;
          cases[idx].status = "Committee Details Sent";
        }
        localStorage.setItem("dcmms_cases", JSON.stringify(cases));
      } catch (e) {}

      try {
        const storedActions = localStorage.getItem("dcmms_new_letter_current_case") || "[]";
        const list = JSON.parse(storedActions);
        list.unshift({
          id: actionId,
          caseNo: caseNo,
          subjectOfficerName: targetOfficer || "Subject Officer",
          reportState: "Committee Details Sent",
          receivedDate: now,
          stepTaken: desc,
          specialNotes: `Committee Assignment: ${formattedAssignedText}`,
        });
        localStorage.setItem("dcmms_new_letter_current_case", JSON.stringify(list));
      } catch (e) {}
    }

    if (isSupabaseConfigured) {
      try {
        await supabase.from("dcmms_subject_assignments").upsert({
          case_no: caseNo,
          subject_officer_name: targetOfficer || "Subject Officer",
          assigned_officers: [formattedAssignedText],
          chairman: selectedChairman || null,
          members: selectedMembers || null,
          status: "Committee Details Sent to Subject Officer",
        }, { onConflict: "case_no" });

        // 1. Update all existing daily mail letters for this case
        await supabase
          .from("dcmms_daily_mail")
          .update({
            officer_name: targetOfficer,
            name_of_subject_officer: targetOfficer,
            status: "assigned",
          })
          .eq("ref_no", caseNo);

        // 2. Upsert daily mail for this case ref_no
        await supabase.from("dcmms_daily_mail").upsert({
          id: `mail-${caseNo}-${(targetOfficer || "subject_officer").trim().toLowerCase().replace(/\s+/g, "_")}`,
          ref_no: caseNo,
          officer_name: targetOfficer || "Subject Officer",
          name_of_subject_officer: targetOfficer || "Subject Officer",
          subject: selectedCase?.subject || `Assigned Inquiry Case (${caseNo})`,
          received_date: now,
          status: "assigned"
        });

        // 3. Insert subject details history action log
        await supabase.from("dcmms_subject_details").insert({
          id: actionId,
          case_no: caseNo,
          ref_no: caseNo,
          received_date: now,
          report_state: "Committee Details Sent",
          special_notes: `Committee Assignment: ${formattedAssignedText}`,
          subject_officer_name: targetOfficer || "Subject Officer",
          officer_name: targetOfficer || "Subject Officer",
          step_taken: desc,
        });

        // 4. Update and Upsert case in dcmms_subject table
        await supabase
          .from("dcmms_subject")
          .update({
            subject_officer_name: targetOfficer,
            officer_name: targetOfficer,
            assigned_officer: targetOfficer,
            status: "Committee Details Sent",
            updated_at: new Date().toISOString(),
          })
          .eq("case_no", caseNo);

        await supabase.from("dcmms_subject").upsert({
          id: `case-${caseNo}`,
          case_no: caseNo,
          subject: selectedCase?.subject || `Assigned Inquiry Case (${caseNo})`,
          status: "Committee Details Sent",
          subject_officer_name: targetOfficer || "Subject Officer",
          officer_name: targetOfficer || "Subject Officer",
          assigned_officer: targetOfficer || "Subject Officer",
        }, { onConflict: "case_no" });
      } catch (e) {
        console.warn("Supabase committee details send error:", e);
      }
    }

    setIsSaving(false);
    showToast(
      lang === "si"
        ? `විමර්ශන කමිටු පත්වීම් තොරතුරු ${displayOfficerName} වෙත සාර්ථකව යවන ලදී!`
        : `Investigation Committee Assignment details successfully sent to ${displayOfficerName}!`
    );
  };

  // ── Step 1 Handler: Admin Submits Assigned Officers ───────────────────────
  const handleStep1SubmitOfficers = async () => {
    if (!subjOfficerName.trim()) {
      showToast("Please select/enter the assigned officer first!");
      return;
    }
    const caseNo = selectedCase?.inquiryNo || (selectedCase as any)?.caseNo || (selectedCase as any)?.refNo || (selectedCase as any)?.case_no || (selectedCase as any)?.id;
    if (!caseNo) return;
    const now = new Date().toISOString().slice(0, 10);
    const assignedName = subjOfficerName.trim();

    const updatedRecord = {
      ...(existingAssignment || {}),
      id: existingAssignment?.id || `asgn-${caseNo}-${Date.now()}`,
      caseNo,
      subjectOfficerName: assignedName,
      assignedOfficers: [assignedName],
      currentStep: 2,
      assignedDate: now,
      status: "Officers Assigned",
      updatedAt: now
    };

    setExistingAssignment(updatedRecord);
    setWorkflowStep(2);

    if (typeof window !== "undefined") {
      try {
        const storedAssignments = localStorage.getItem("dcmms_subject_assignments") || "[]";
        let list = JSON.parse(storedAssignments);
        list = list.filter((a: any) => a.caseNo !== caseNo);
        list.push(updatedRecord);
        localStorage.setItem("dcmms_subject_assignments", JSON.stringify(list));
      } catch (e) {}

      // Sync dcmms_letters
      try {
        const storedLetters = localStorage.getItem("dcmms_letters") || "[]";
        let letters = JSON.parse(storedLetters);
        const exists = letters.some((l: any) => l.refNo === caseNo && l.officerName?.toLowerCase() === assignedName.toLowerCase());
        if (!exists) {
          letters.push({
            id: `let-${caseNo}-${Date.now()}`,
            refNo: caseNo,
            officerName: assignedName,
            subject: selectedCase?.subject || `Assigned Inquiry Case (${caseNo})`,
            receivedDate: now,
            status: "assigned",
            priority: "high"
          });
          localStorage.setItem("dcmms_letters", JSON.stringify(letters));
        }
      } catch (e) {}

      // Sync dcmms_cases
      try {
        const storedCases = localStorage.getItem("dcmms_cases") || "[]";
        let cases = JSON.parse(storedCases);
        const idx = cases.findIndex((c: any) => c.caseNo === caseNo || c.refNo === caseNo);
        if (idx >= 0) {
          cases[idx].assignedTo = assignedName;
          cases[idx].subjectOfficer = assignedName;
          cases[idx].subjectOfficerName = assignedName;
        }
        localStorage.setItem("dcmms_cases", JSON.stringify(cases));
      } catch (e) {}

      if (isSupabaseConfigured) {
        try {
          await supabase.from("dcmms_subject_assignments").upsert({
            id: updatedRecord.id,
            case_no: caseNo,
            subject_officer_name: assignedName,
            status: "Officers Assigned",
            assigned_officers: [assignedName]
          });

          await supabase.from("dcmms_daily_mail").upsert({
            id: `mail-${caseNo}-${assignedName.trim().toLowerCase().replace(/\s+/g, "_")}`,
            ref_no: caseNo,
            officer_name: assignedName,
            subject: selectedCase?.subject || `Assigned Inquiry Case (${caseNo})`,
            received_date: now,
            status: "assigned"
          });

          await supabase.from("dcmms_subject").upsert({
            id: `case-${caseNo}`,
            case_no: caseNo,
            subject: selectedCase?.subject || `Assigned Inquiry Case (${caseNo})`,
            priority: "high",
            status: "Officers Assigned",
            assigned_date: now,
            subject_officer_name: assignedName,
            officer_name: assignedName,
          });
        } catch (e) {}
      }
    }
    showToast("Step 1 Complete: Assigned Officer submitted! Step 2 unlocked for Subject Officer.");
  };

  // ── Step 2 Handler: Admin Confirms / Saves Appointment Date & Due Date ────
  const handleStep2ConfirmDatesAdmin = async () => {
    if (!step2AppointmentDate || !step2ReportDueDate) {
      showToast("Please select both Appointment Letter Date and Report Due Date!");
      return;
    }
    const caseNo = selectedCase?.inquiryNo;
    if (!caseNo) return;
    const now = new Date().toISOString().slice(0, 10);

    const updatedRecord = {
      ...(existingAssignment || {}),
      id: existingAssignment?.id || `asgn-${caseNo}`,
      caseNo,
      appointmentDate: step2AppointmentDate,
      reportDueDate: step2ReportDueDate,
      datesSubmittedBySubject: true,
      status: "Appointment & Due Dates Set",
      updatedAt: now,
    };

    setExistingAssignment(updatedRecord);
    setSubjAppointmentDate(step2AppointmentDate);
    setSubjReportDueDate(step2ReportDueDate);
    setStep2Submitted(true);

    if (typeof window !== "undefined") {
      try {
        const storedAssignments = localStorage.getItem("dcmms_subject_assignments") || "[]";
        let list = JSON.parse(storedAssignments);
        list = list.filter((a: any) => a.caseNo !== caseNo);
        list.push(updatedRecord);
        localStorage.setItem("dcmms_subject_assignments", JSON.stringify(list));
      } catch (e) {}
    }

    if (isSupabaseConfigured) {
      try {
        await supabase.from("dcmms_subject_assignments").upsert({
          id: updatedRecord.id,
          case_no: caseNo,
          appointment_date: step2AppointmentDate,
          report_due_date: step2ReportDueDate,
          dates_submitted_by_subject: true,
          status: updatedRecord.status,
        });
      } catch (e) {}
    }

    showToast(lang === "si" ? `Step 2: පත්වීම් ලිපිය දිනය (${step2AppointmentDate}) සහ වාර්තා දිනය (${step2ReportDueDate}) සාර්ථකව සුරකියි!` : `Step 2: Appointment Date (${step2AppointmentDate}) and Due Date (${step2ReportDueDate}) saved!`);
  };
  // ── Step 3 Handler: Admin Requests Extension ──
  const handleStep3RequestExtension = async () => {
    const extensionTermToUse = step3ExtensionTerm !== "None" ? step3ExtensionTerm : subjExtensionTerm;
    const extensionStartToUse = step3ExtensionStartDate || subjExtensionStartDate;
    const extensionEndToUse = step3ExtensionEndDate || subjExtensionEndDate;

    if (extensionTermToUse === "None") {
      showToast(lang === "si" ? "කරුණාකර දිනයන් දීර්ඝ කිරීමේ වාරය (පළමු, දෙවන, හෝ තෙවන) තෝරන්න!" : "Please select an Extension Term (First, Second, or Third)!");
      return;
    }
    if (!extensionStartToUse || !extensionEndToUse) {
      showToast(lang === "si" ? "කරුණාකර දීර්ඝ කිරීමේ ආරම්භ සහ අවසාන දිනයන් දෙකම තෝරන්න!" : "Please select both Extension Start Date and End Date!");
      return;
    }
    const caseNo = selectedCase?.inquiryNo || (selectedCase as any)?.caseNo || (selectedCase as any)?.refNo;
    if (!caseNo) return;
    const now = new Date().toISOString().slice(0, 10);
    const actionId = `act-ext-${caseNo}-${Date.now()}`;
    const targetOfficer = subjOfficerName.trim() || (existingAssignment?.subjectOfficerName !== "Subject Officer" ? existingAssignment?.subjectOfficerName : "") || (selectedCase as any)?.subjectOfficer || "Subject Officer";
    const desc = `Extension of Days Request (Sent for Approval): ${extensionTermToUse} Extension (${extensionStartToUse} to ${extensionEndToUse}) sent to Subject Officer (${targetOfficer}) for approval.`;

    const updatedRecord: any = {
      ...(existingAssignment || {}),
      id: existingAssignment?.id || `asgn-${caseNo}-${Date.now()}`,
      caseNo,
      subjectOfficerName: targetOfficer,
      extensionTerm: extensionTermToUse,
      extensionStartDate: extensionStartToUse,
      extensionEndDate: extensionEndToUse,
      extensionRequestedByAdmin: true,
      extensionApprovalStatus: "Pending",
      extensionDecisionDate: null,
      currentStep: 3,
      status: "Extension Requested",
      updatedAt: now
    };

    setExistingAssignment(updatedRecord);
    setSubjExtensionTerm(extensionTermToUse);
    setSubjExtensionStartDate(extensionStartToUse);
    setSubjExtensionEndDate(extensionEndToUse);
    setStep3ExtensionTerm(extensionTermToUse);
    setStep3ExtensionStartDate(extensionStartToUse);
    setStep3ExtensionEndDate(extensionEndToUse);
    setStep3ExtensionRequested(true);
    setWorkflowStep(3);

    if (typeof window !== "undefined") {
      const matchKey = String(caseNo || "").trim().toLowerCase();
      try {
        const storedAssignments = localStorage.getItem("dcmms_subject_assignments") || "[]";
        let list = JSON.parse(storedAssignments);
        list = list.filter((a: any) => String(a.caseNo || a.case_no || "").trim().toLowerCase() !== matchKey);
        list.push(updatedRecord);
        localStorage.setItem("dcmms_subject_assignments", JSON.stringify(list));
      } catch (e) {}

      try {
        const storedLetters = localStorage.getItem("dcmms_letters") || "[]";
        let letters = JSON.parse(storedLetters);
        const idx = letters.findIndex((l: any) => String(l.refNo || l.caseNo || "").trim().toLowerCase() === matchKey);
        if (idx >= 0) {
          letters[idx].extensionTerm = extensionTermToUse;
          letters[idx].extensionStartDate = extensionStartToUse;
          letters[idx].extensionEndDate = extensionEndToUse;
          letters[idx].extension_term = extensionTermToUse;
          letters[idx].extension_start_date = extensionStartToUse;
          letters[idx].extension_end_date = extensionEndToUse;
          letters[idx].extensionRequested = true;
          letters[idx].extensionRequestedByAdmin = true;
          letters[idx].extension_requested_by_admin = true;
          letters[idx].extensionApprovalStatus = "Pending";
          letters[idx].extension_approval_status = "Pending";
          letters[idx].extensionDecisionDate = null;
          letters[idx].extension_decision_date = null;
          letters[idx].status = "Extension Requested";
          if (targetOfficer) letters[idx].officerName = targetOfficer;
          localStorage.setItem("dcmms_letters", JSON.stringify(letters));
        }
      } catch (e) {}

      try {
        const storedCases = localStorage.getItem("dcmms_cases") || "[]";
        let cases = JSON.parse(storedCases);
        const idx = cases.findIndex((c: any) => String(c.caseNo || c.refNo || "").trim().toLowerCase() === matchKey);
        if (idx >= 0) {
          cases[idx].extensionTerm = extensionTermToUse;
          cases[idx].extensionStartDate = extensionStartToUse;
          cases[idx].extensionEndDate = extensionEndToUse;
          cases[idx].extension_term = extensionTermToUse;
          cases[idx].extension_start_date = extensionStartToUse;
          cases[idx].extension_end_date = extensionEndToUse;
          cases[idx].extensionRequested = true;
          cases[idx].extensionRequestedByAdmin = true;
          cases[idx].extension_requested_by_admin = true;
          cases[idx].extensionApprovalStatus = "Pending";
          cases[idx].extension_approval_status = "Pending";
          cases[idx].extensionDecisionDate = null;
          cases[idx].extension_decision_date = null;
          cases[idx].status = "Extension Requested";
          localStorage.setItem("dcmms_cases", JSON.stringify(cases));
        }
      } catch (e) {}

      // Log action into dcmms_new_letter_current_case
      try {
        const storedActions = localStorage.getItem("dcmms_new_letter_current_case") || "[]";
        let actionsList = [];
        try { actionsList = JSON.parse(storedActions); } catch (e) {}
        if (!Array.isArray(actionsList)) actionsList = [];
        actionsList.unshift({
          id: actionId,
          caseNo: caseNo,
          receivedDate: now,
          reportState: "Extension of Days Request (Sent for Approval)",
          specialNotes: `Extension Term: ${extensionTermToUse} | Start Date: ${extensionStartToUse} | End Date: ${extensionEndToUse}`,
          subjectOfficerName: targetOfficer,
          stepTaken: desc,
        });
        localStorage.setItem("dcmms_new_letter_current_case", JSON.stringify(actionsList));
      } catch (e) {}

      window.dispatchEvent(new CustomEvent("dcmms_assignment_updated"));
      window.dispatchEvent(new CustomEvent("dcmms_notifications_updated"));
      window.dispatchEvent(new CustomEvent("dcmms_data_updated"));
      window.dispatchEvent(new Event("storage"));
    }

    // Save into dedicated PostgreSQL case_by_date_extention table
    const cleanStart = extensionStartToUse ? (new Date(extensionStartToUse).toString() !== "Invalid Date" ? new Date(extensionStartToUse).toISOString().slice(0, 10) : extensionStartToUse) : null;
    const cleanEnd = extensionEndToUse ? (new Date(extensionEndToUse).toString() !== "Invalid Date" ? new Date(extensionEndToUse).toISOString().slice(0, 10) : extensionEndToUse) : null;

    const extFullPayload: any = {
      subject_file_no: caseNo,
      sub_file_no: caseNo,
      extention_term: extensionTermToUse || "First Extension (1st)",
      start_date: cleanStart,
      end_date: cleanEnd,
      approval_status: "Pending",
    };

    try {
      await saveCaseByDateExtensionServer(extFullPayload);
    } catch (e) {
      console.error("Failed to save to PostgreSQL case_by_date_extention:", e);
    }

    if (isSupabaseConfigured) {
      try {
        const existingId = existingAssignment?.id || `asgn-${caseNo}`;

        const upsertPayload: any = {
          id: existingId,
          case_no: caseNo,
          subject_officer_name: targetOfficer,
          assigned_officers: (() => {
            const ao = updatedRecord.assignedOfficers || existingAssignment?.assignedOfficers;
            return Array.isArray(ao) ? ao : (ao ? [ao] : null);
          })(),
          chairman: updatedRecord.chairman || existingAssignment?.chairman || null,
          members: updatedRecord.members || existingAssignment?.members || null,
          appointment_date: updatedRecord.appointmentDate || existingAssignment?.appointmentDate || null,
          report_due_date: updatedRecord.reportDueDate || existingAssignment?.reportDueDate || null,
          extension_term: extensionTermToUse,
          extension_start_date: extensionStartToUse,
          extension_end_date: extensionEndToUse,
          extension_requested_by_admin: true,
          extension_approval_status: "Pending",
          extension_decision_date: null,
          status: "Extension Requested",
        };

        const { error: upsertError } = await supabase.from("dcmms_subject_assignments").upsert(upsertPayload, { onConflict: "id" });

        if (upsertError) {
          console.warn("Extension upsert error:", upsertError);
        }

        const subUpdateObj: any = {
          status: "Extension Requested",
          updated_at: new Date().toISOString(),
        };

        await supabase
          .from("dcmms_subject")
          .update(subUpdateObj)
          .eq("case_no", caseNo);

        // Save into dedicated case_by_date_extention table with formatted dates & fallback
        const cleanStart = extensionStartToUse ? (new Date(extensionStartToUse).toString() !== "Invalid Date" ? new Date(extensionStartToUse).toISOString().slice(0, 10) : extensionStartToUse) : null;
        const cleanEnd = extensionEndToUse ? (new Date(extensionEndToUse).toString() !== "Invalid Date" ? new Date(extensionEndToUse).toISOString().slice(0, 10) : extensionEndToUse) : null;

        const extFullPayload: any = {
          subject_file_no: caseNo,
          sub_file_no: caseNo,
          extention_term: extensionTermToUse || "First Extension (1st)",
          start_date: cleanStart,
          end_date: cleanEnd,
          approval_status: "Pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        try {
          await saveCaseByDateExtensionServer(extFullPayload);
        } catch (e) {}

        const { error: extErr } = await supabase.from("case_by_date_extention").insert(extFullPayload);
        if (extErr) {
          console.warn("Primary case_by_date_extention insert failed, retrying with base columns:", extErr.message);
          const { error: fallbackErr } = await supabase.from("case_by_date_extention").insert({
            subject_file_no: caseNo,
            extention_term: extensionTermToUse || "First Extension (1st)",
            start_date: cleanStart,
            end_date: cleanEnd,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          if (fallbackErr) {
            console.error("Fallback case_by_date_extention insert error:", fallbackErr.message);
          } else {
            console.log("Successfully saved date extension to case_by_date_extention table!");
          }
        } else {
          console.log("Successfully saved date extension to case_by_date_extention table!");
        }
      } catch (e) {
        console.warn("Extension Supabase error:", e);
      }
    }

    showToast(
      lang === "si"
        ? "දිනයන් දීර්ඝ කිරීමේ ඉල්ලීම විෂය නිලධාරියා වෙත සාර්ථකව යවන ලදී!"
        : "Extension request sent to Subject Officer!"
    );
  };

  // ── Step 4 Handler: Admin Submits Final Report & Approval Date ─────────────
  const handleStep4SubmitFinalReport = async () => {
    if (!step4FinalReport.trim()) {
      showToast("Please enter the Final Investigation Report findings!");
      return;
    }
    if (!step4ApprovalDate) {
      showToast("Please select the Approval Date!");
      return;
    }
    const caseNo = selectedCase?.inquiryNo;
    if (!caseNo) return;
    const now = new Date().toISOString().slice(0, 10);

    const updatedRecord = {
      ...(existingAssignment || {}),
      id: existingAssignment?.id || `asgn-${caseNo}-${Date.now()}`,
      caseNo,
      finalReportContent: step4FinalReport.trim(),
      approvalDate: step4ApprovalDate,
      reportApprovedByAdmin: true,
      approvalTimestamp: now,
      currentStep: 5,
      status: "Completed & Approved",
      updatedAt: now
    };

    setExistingAssignment(updatedRecord);
    setStep4Completed(true);
    setWorkflowStep(5);

    if (typeof window !== "undefined") {
      try {
        const storedAssignments = localStorage.getItem("dcmms_subject_assignments") || "[]";
        let list = JSON.parse(storedAssignments);
        list = list.filter((a: any) => a.caseNo !== caseNo);
        list.push(updatedRecord);
        localStorage.setItem("dcmms_subject_assignments", JSON.stringify(list));
      } catch (e) {}
    }
    showToast("Step 4 Complete: Final Investigation Report & Approval Date submitted to Subject Officer!");
  };

  // ── Save Investigation Details ──
  const handleSaveInvestigationDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    if (!investigationNotes.trim()) {
      showToast(lang === "si" ? "කරුණාකර විමර්ශන සටහන ඇතුළත් කරන්න." : "Please enter progress notes for the investigation.");
      return;
    }

    setIsSaving(true);
    const caseNo = selectedCase.inquiryNo;
    const now = new Date().toISOString().slice(0, 10);
    const actionId = `inves-action-${caseNo}-${Date.now()}`;
    const targetOfficer = subjOfficerName.trim() || assignee.trim();
    const desc = `Investigation Update: Assigned to ${targetOfficer || "Unassigned"}. Target completion: ${targetDate || subjReportDueDate || "Not set"}. ${investigationNotes}`;

    if (isSupabaseConfigured) {
      try {
        // 1. Update main case status and target date in dcmms_subject
        const { error: caseError } = await supabase
          .from("dcmms_subject")
          .update({
            status: investigationStatus,
            assigned_date: targetDate || subjReportDueDate || null,
          })
          .eq("case_no", caseNo);

        if (caseError) console.warn("Supabase case update warning:", caseError);

        // 2. Assign letter to Subject Officer in dcmms_daily_mail so it appears on their dashboard
        if (targetOfficer) {
          const { error: mailError } = await supabase
            .from("dcmms_daily_mail")
            .update({
              officer_name: targetOfficer,
              status: "assigned",
            })
            .eq("ref_no", caseNo);

          if (mailError) console.warn("Supabase daily mail officer update warning:", mailError);
        }

        // 3. Insert new action log to dcmms_subject_details
        const { error: actionError } = await supabase
          .from("dcmms_subject_details")
          .insert({
            id: actionId,
            case_no: caseNo,
            received_date: now,
            report_state: investigationStatus,
            special_notes: investigationNotes || null,
            subject_officer_name: targetOfficer || "Investigation Administrator",
            step_taken: desc,
          });

        if (actionError) console.warn("Supabase detail insert warning:", actionError);

        // 4. Upsert inquiry investigation record in dcmms_investigation
        try {
          await supabase.from("dcmms_investigation").upsert({
            id: selectedCase.id || `inv-${caseNo}`,
            case_no: caseNo,
            inquiry_no: caseNo,
            subject: selectedCase.subject,
            target_date: targetDate || subjReportDueDate || selectedCase.targetDate,
            status: investigationStatus,
            assigned_officer: targetOfficer || null,
            notes: investigationNotes || null,
          });
        } catch (invErr) {
          console.warn("Supabase dcmms_investigation upsert warning:", invErr);
        }

        // 5. Upsert preliminary investigation log in dcmms_preliminary_investigations
        try {
          await supabase.from("dcmms_preliminary_investigations").upsert({
            id: `prelim-${caseNo}`,
            case_no: caseNo,
            reason: selectedCase.subject,
            committee_members: selectedMembers,
            appointment_date: step2AppointmentDate || null,
            report_due_date: step2ReportDueDate || null,
            findings: investigationNotes || null,
            observations: desc,
            status: investigationStatus,
            updated_at: new Date().toISOString()
          });
        } catch (pErr) {
          console.warn("Supabase prelim insert warning:", pErr);
        }

        // 6. Audit log entry
        await logAuditEvent(
          "SAVE_INVESTIGATION_DETAILS",
          "dcmms_investigation",
          caseNo,
          { status: investigationStatus, notes: investigationNotes }
        );
      } catch (err: any) {
        console.error("Failed to save investigation details to Supabase:", err);
      }
    }

    // Local storage fallback
    if (typeof window !== "undefined") {
      try {
        const storedCases = localStorage.getItem("dcmms_cases");
        if (storedCases) {
          const list = JSON.parse(storedCases);
          const updated = list.map((c: any) => {
            if (c.caseNo === caseNo) {
              return {
                ...c,
                status: investigationStatus,
                assignedTo: targetOfficer || c.assignedTo,
                targetDate: targetDate || c.targetDate,
                investigationFileNo: fileRefNoForm,
                fileNo: fileRefNoForm,
                fileRefNo: fileRefNoForm,
              };
            }
            return c;
          });
          localStorage.setItem("dcmms_cases", JSON.stringify(updated));
        }
      } catch (e) {}

      if (targetOfficer) {
        try {
          const storedLetters = localStorage.getItem("dcmms_letters");
          if (storedLetters) {
            const list = JSON.parse(storedLetters);
            const updated = list.map((l: any) => {
              if (l.refNo === caseNo) {
                return {
                  ...l,
                  officerName: targetOfficer,
                  status: "assigned",
                };
              }
              return l;
            });
            localStorage.setItem("dcmms_letters", JSON.stringify(updated));
          }
        } catch (e) {}
      }

      try {
        const storedActions = localStorage.getItem("dcmms_new_letter_current_case") || "[]";
        const list = JSON.parse(storedActions);
        list.push({
          id: actionId,
          caseNo: caseNo,
          subjectOfficerName: targetOfficer || "Investigation Administrator",
          reportState: investigationStatus,
          receivedDate: now,
          stepTaken: desc,
          specialNotes: investigationNotes,
          fileRef: fileRefNoForm,
          isDraft: false,
        });
        localStorage.setItem("dcmms_new_letter_current_case", JSON.stringify(list));
      } catch (e) {}
    }

    // Save/Update Subject Officer Assignment Data Flow record
    if (targetOfficer || selectedChairman || selectedMembers.length > 0) {
      const chairmanPart = selectedChairman ? `Chairman: ${selectedChairman.fullName || selectedChairman.name || selectedChairman}` : "";
      const membersPart = selectedMembers.length > 0 ? `Members: ${selectedMembers.map((m) => m.fullName || m.name || m).join(", ")}` : "";
      const formattedAssignedText = [chairmanPart, membersPart].filter(Boolean).join(" | ") || targetOfficer;

      const assignmentRecord = {
        id: existingAssignment?.id || `asgn-${caseNo}-${Date.now()}`,
        caseNo: caseNo,
        subjectOfficerName: targetOfficer || (selectedChairman ? selectedChairman.fullName : "Subject Officer"),
        assignedOfficers: formattedAssignedText,
        chairman: selectedChairman,
        members: selectedMembers,
        appointmentDate: subjAppointmentDate || now,
        reportDueDate: subjReportDueDate || targetDate || "",
        extensionTerm: step3ExtensionTerm !== "None" ? step3ExtensionTerm : subjExtensionTerm,
        extensionStartDate: step3ExtensionStartDate || subjExtensionStartDate || "",
        extensionEndDate: step3ExtensionEndDate || subjExtensionEndDate || "",
        certificationSubmitted: existingAssignment?.certificationSubmitted || false,
        certificationDate: existingAssignment?.certificationDate || "",
        reportSubmitDate: existingAssignment?.reportSubmitDate || "",
        reportContent: existingAssignment?.reportContent || "",
        status: existingAssignment?.status || "Assigned",
        updatedAt: now,
      };

      if (typeof window !== "undefined") {
        try {
          const storedAssignments = localStorage.getItem("dcmms_subject_assignments") || "[]";
          let list = JSON.parse(storedAssignments);
          list = list.filter((a: any) => a.caseNo !== caseNo);
          list.push(assignmentRecord);
          localStorage.setItem("dcmms_subject_assignments", JSON.stringify(list));
        } catch (e) {
          console.error("Failed to save assignment to localStorage", e);
        }
      }

      if (isSupabaseConfigured) {
        try {
          await supabase.from("dcmms_subject_assignments").upsert({
            id: assignmentRecord.id,
            case_no: assignmentRecord.caseNo,
            subject_officer_name: assignmentRecord.subjectOfficerName,
            assigned_officers: Array.isArray(formattedAssignedText) ? formattedAssignedText : (formattedAssignedText ? [formattedAssignedText] : null),
            chairman: selectedChairman || assignmentRecord.chairman || null,
            members: (selectedMembers && selectedMembers.length > 0) ? selectedMembers : (assignmentRecord.members || null),
            appointment_date: assignmentRecord.appointmentDate,
            report_due_date: assignmentRecord.reportDueDate,
            extension_term: assignmentRecord.extensionTerm,
            extension_start_date: assignmentRecord.extensionStartDate,
            extension_end_date: assignmentRecord.extensionEndDate,
            certification_submitted: assignmentRecord.certificationSubmitted,
            certification_date: assignmentRecord.certificationDate,
            report_submit_date: assignmentRecord.reportSubmitDate,
            report_content: assignmentRecord.reportContent,
            status: assignmentRecord.status,
          });
        } catch (e) {
          console.warn("Supabase assignment save warning:", e);
        }
      }
    }

    setIsSaving(false);
    showToast(lang === "si" ? "විමර්ශන තොරතුරු සාර්ථකව යාවත්කාලීන කර අදාළ විෂය නිලධාරියා වෙත යවන ලදී!" : "Investigation details updated and sent to the case subject officer!");
    setIsCaseModalOpen(false);
    fetchInquiries();
  };


  // ── Officer form validation ───────────────────────────────────────────────
  const validateOfficerForm = () => {
    const newErrors: Record<string, string> = {};
    if (!officerNameForm.trim()) newErrors.name = t("pleaseFillAllFields", "Officer Name is required.");
    if (!officerNicForm.trim()) newErrors.nic = "NIC No is required.";
    if (!officerEmailForm.trim()) {
      newErrors.email = t("pleaseFillAllFields", "Email is required.");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(officerEmailForm.trim())) {
      newErrors.email = "Please enter a valid email address.";
    }
    setOfficerErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Save Investigation Officer ────────────────────────────────────────────
  const handleSaveOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateOfficerForm()) return;

    setIsSaving(true);
    const isNew = !isOfficerEditMode || !editingOfficerId;
    const oId = isNew ? `inv-${Date.now()}` : editingOfficerId!;
    const now = new Date().toISOString().slice(0, 10);

    const officer: Officer = {
      id: oId,
      fullName: officerNameForm.trim(),
      nicNo: officerNicForm.trim(),
      officerRole: officerRoleTypeForm,
      studiedSchools: studiedSchoolsForm,
      childrenSchools: childrenSchoolsForm,
      email: officerEmailForm.trim().toLowerCase(),
      role: "investigation_officer",
      status: officerStatusForm,
      createdAt: isNew ? now : officers.find(o => o.id === editingOfficerId)?.createdAt || now
    };

    if (isSupabaseConfigured) {
      try {
        const invPayload: any = {
          id: officer.id,
          full_name: officer.fullName,
          nic_no: officer.nicNo,
          officer_role: officer.officerRole,
          studied_schools: officer.studiedSchools,
          children_schools: officer.childrenSchools,
          email: officer.email,
          status: officer.status,
        };
        await supabase.from("dcmms_investigation_officers").upsert(invPayload);

        // Sync schools to dcmms_schools table
        const allSchools = Array.from(new Set([...(officer.studiedSchools || []), ...(officer.childrenSchools || [])]));
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
          isOfficerEditMode ? "UPDATE_OFFICER" : "REGISTER_OFFICER",
          "dcmms_investigation_officers",
          officer.id,
          { fullName: officer.fullName, role: officer.officerRole, nicNo: officer.nicNo }
        );
      } catch (err) {
        console.error("Failed to save officer in Supabase:", err);
      }
    }

    if (typeof window !== "undefined") {
      ["dcmms_custom_profiles", "dcmms_investigation_officers"].forEach((key) => {
        try {
          const stored = localStorage.getItem(key) || "[]";
          let list = [];
          try { list = JSON.parse(stored); } catch (e) {}
          if (Array.isArray(list)) {
            list = list.filter((o: any) => o.id !== officer.id && (o.fullName || o.full_name) !== officer.fullName);
            list.push(officer);
            localStorage.setItem(key, JSON.stringify(list));
          }
        } catch (e) {}
      });
    }

    setIsSaving(false);
    showToast(isOfficerEditMode ? "Investigation officer updated!" : "Investigation officer registered!");
    setIsOfficerModalOpen(false);
    fetchInvestigationOfficers();
  };

  // ── Delete Officer ────────────────────────────────────────────────────────
  const handleDeleteOfficer = async (officer: Officer) => {
    if (!confirm(`Are you sure you want to delete ${officer.fullName}?`)) return;

    if (isSupabaseConfigured && officer.id && !officer.id.startsWith("inv-") && !officer.id.startsWith("off-")) {
      try {
        await supabase.from("dcmms_profiles").delete().eq("id", officer.id);
        await supabase.from("dcmms_investigation_officers").delete().eq("id", officer.id);
      } catch (err) {
        console.warn("Supabase deletion warning:", err);
      }
    }

    if (typeof window !== "undefined") {
      const storedCustom = localStorage.getItem("dcmms_custom_profiles");
      if (storedCustom) {
        try {
          let list = JSON.parse(storedCustom);
          list = list.filter((o: any) => o.id !== officer.id && o.fullName !== officer.fullName);
          localStorage.setItem("dcmms_custom_profiles", JSON.stringify(list));
        } catch (e) {}
      }

      const storedInv = localStorage.getItem("dcmms_investigation_officers");
      if (storedInv) {
        try {
          let list = JSON.parse(storedInv);
          list = list.filter((o: any) => o.id !== officer.id && o.fullName !== officer.fullName);
          localStorage.setItem("dcmms_investigation_officers", JSON.stringify(list));
        } catch (e) {}
      }
    }

    showToast("Investigation officer removed successfully.");
    fetchInvestigationOfficers();
  };

  // ── Toggle Officer Status ──────────────────────────────────────────────────
  const handleToggleOfficerStatus = async (officer: Officer) => {
    const nextStatus = officer.status === "Active" ? "Inactive" : "Active";

    if (isSupabaseConfigured && !officer.id.startsWith("inv-")) {
      try {
        await supabase
          .from("dcmms_profiles")
          .update({ status: nextStatus })
          .eq("id", officer.id);
      } catch (e) {
        console.error("Failed to toggle status in Supabase", e);
      }
    }

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_custom_profiles");
      if (stored) {
        try {
          const list = JSON.parse(stored);
          const updated = list.map((o: any) => {
            if (o.id === officer.id) return { ...o, status: nextStatus };
            return o;
          });
          localStorage.setItem("dcmms_custom_profiles", JSON.stringify(list));
        } catch (e) {}
      }
    }

    showToast(`Status updated to ${nextStatus}.`);
    fetchInvestigationOfficers();
  };

  // ── Filters & Search ────────────────────────────────────────────────────────
  const filteredInquiries = inquiries.filter((item) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = (
      item.inquiryNo.toLowerCase().includes(query) ||
      item.subject.toLowerCase().includes(query) ||
      item.status.toLowerCase().includes(query) ||
      (item.assignedOfficer && item.assignedOfficer.toLowerCase().includes(query)) ||
      (item.subjectOfficer && item.subjectOfficer.toLowerCase().includes(query))
    );

    if (!matchesSearch) return false;

    // Status filter
    if (statusFilter !== "All") {
      if (statusFilter === "In Progress") {
        const isProg = item.status === "In Progress" || item.status === "Preliminary Investigation" || item.status === "Conducting preliminary investigations" || item.status === "Under Investigation";
        if (!isProg) return false;
      } else if (item.status !== statusFilter) {
        return false;
      }
    }

    // Urgency / Target Date filter
    if (urgencyFilter !== "All") {
      if (item.targetDate) {
        const target = new Date(item.targetDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        target.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (urgencyFilter === "Overdue" && diffDays >= 0) return false;
        if (urgencyFilter === "DueSoon" && (diffDays < 0 || diffDays > 7)) return false;
        if (urgencyFilter === "OnTrack" && diffDays <= 7) return false;
      }
    }

    // Assigned Officer filter
    if (officerFilter !== "All") {
      if (officerFilter === "Unassigned") {
        if (item.assignedOfficer && item.assignedOfficer.trim() !== "") return false;
      } else {
        if (item.assignedOfficer !== officerFilter) return false;
      }
    }

    return true;
  });

  const filteredOfficers = officers.filter((item) => {
    const query = officerSearchQuery.toLowerCase().trim();
    const matchesSearch =
      item.fullName.toLowerCase().includes(query) ||
      item.email.toLowerCase().includes(query) ||
      (item.employeeNo && item.employeeNo.toLowerCase().includes(query)) ||
      (item.nicNo && item.nicNo.toLowerCase().includes(query));
    
    const pos = (item.position || item.officerRole || "").toLowerCase();
    const matchesPosition =
      officerPositionFilter === "All" ||
      (officerPositionFilter === "Chairman" && pos === "chairman") ||
      (officerPositionFilter === "Member" && pos === "member");

    return matchesSearch && matchesPosition;
  });

  // Count calculations
  const activeInquiriesCount = inquiries.length;
  const inProgressInquiriesCount = inquiries.filter((i) => i.status === "In Progress" || i.status === "Preliminary Investigation" || i.status === "Conducting preliminary investigations" || i.status === "Under Investigation").length;
  const evidenceReviewsInquiriesCount = inquiries.filter((i) => i.status === "Evidence Review").length;
  const scheduledHearingsInquiriesCount = inquiries.filter((i) => i.status === "Scheduled").length;

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
        role="investigation"
        setIsModalOpen={(open) => {
          if (open) {
            setActiveTab("officers");
            setIsOfficerModalOpen(true);
          }
        }}
      />

      <div className="dashboard-layout">
        <main id="dashboard-main-content" className="dashboard-content">
          
          {/* Toast Notification */}
          {toastMessage && (
            <div className="toast-notification" style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#065f46", color: "#ffffff", padding: "12px 20px", borderRadius: "10px", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)", position: "fixed", bottom: "24px", right: "24px", zIndex: 9999 }}>
              <CheckCircle size={20} style={{ color: "#34d399" }} />
              <span style={{ fontWeight: 600, fontSize: "14px" }}>{toastMessage}</span>
            </div>
          )}

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
                <h2 className="dashboard-main-title">{t("investigationDashboardTitle", "Investigation Administrator Dashboard")}</h2>
                <p className="dashboard-main-subtitle">{t("investigationDashboardDesc")}</p>
              </div>
            </div>

            <div className="dashboard-header-right">
              {/* Date Badge */}
              <div className="date-badge">
                <CalendarIcon className="date-icon" />
                <span suppressHydrationWarning>
                  {new Date().toLocaleDateString(
                    lang === "si" ? "si-LK" : lang === "ta" ? "ta-LK" : "en-US",
                    { year: "numeric", month: "long", day: "numeric" }
                  )}
                </span>
              </div>

              <div className="divider-line" aria-hidden="true" />

              {/* Accessibility Font Adjuster */}
              <div className="accessibility-adjuster-bar" role="radiogroup" aria-label="Font Sizing Adjustment">
                <label className={`size-btn size-btn-small${fontScale === "small" ? " active" : ""}`}>
                  <input type="radio" name="dashboardFontScale" value="small" checked={fontScale === "small"} onChange={() => setFontScale("small")} aria-label={t("fontSmall")} className="sr-only" />
                  A
                </label>
                <label className={`size-btn size-btn-medium${fontScale === "medium" ? " active" : ""}`}>
                  <input type="radio" name="dashboardFontScale" value="medium" checked={fontScale === "medium"} onChange={() => setFontScale("medium")} aria-label={t("fontMedium")} className="sr-only" />
                  A
                </label>
                <label className={`size-btn size-btn-large${fontScale === "large" ? " active" : ""}`}>
                  <input type="radio" name="dashboardFontScale" value="large" checked={fontScale === "large"} onChange={() => setFontScale("large")} aria-label={t("fontLarge")} className="sr-only" />
                  A
                </label>
              </div>

              <div className="divider-line" aria-hidden="true" />

              {/* Trilingual language selector */}
              <div className="trilingual-language-selector" role="radiogroup" aria-label="Translate Dashboard Language">
                <label className={`lang-btn${lang === "si" ? " active" : ""}`} lang="si">
                  <input type="radio" name="dashboardLang" value="si" checked={lang === "si"} onChange={() => changeLanguage("si")} aria-label="Switch dashboard language to Sinhala" className="sr-only" />
                  සිංහල
                </label>
                <label className={`lang-btn${lang === "ta" ? " active" : ""}`} lang="ta">
                  <input type="radio" name="dashboardLang" value="ta" checked={lang === "ta"} onChange={() => changeLanguage("ta")} aria-label="Switch dashboard language to Tamil" className="sr-only" />
                  தமிழ்
                </label>
                <label className={`lang-btn${lang === "en" ? " active" : ""}`} lang="en">
                  <input type="radio" name="dashboardLang" value="en" checked={lang === "en"} onChange={() => changeLanguage("en")} aria-label="Switch dashboard language to English" className="sr-only" />
                  English
                </label>
              </div>
            </div>
          </header>

          {/* ── Welcome Banner Greeting ── */}
          <section className="welcome-greeting-section" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 className="greeting-text" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>{greeting}</span>
                <Sparkles size={20} style={{ color: "#f59e0b" }} />
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#64748b" }}>
                {lang === "si" 
                  ? "මෙමගින් ඔබට විමර්ශන නඩු විස්තර සහ විමර්ශන නිලධාරීන් පහසුවෙන් කළමනාකරණය කළ හැකිය."
                  : "Manage inquiry progress, assign officers, and update case records seamlessly."}
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button 
                onClick={() => { fetchInquiries(); fetchInvestigationOfficers(); }} 
                className="btn-action-view"
                style={{ padding: "8px 14px", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px" }}
                title="Refresh Data"
              >
                <RefreshCw size={14} />
                <span>{lang === "si" ? "යාවත්කාලීන කරන්න" : "Refresh"}</span>
              </button>
            </div>
          </section>

          {/* ── Interactive Dashboard Stats Overview ── */}
          <section className="dashboard-stats-grid">
            <div 
              className={`hero-action-card${statusFilter === "All" ? " active-stat-card" : ""}`}
              onClick={() => setStatusFilter("All")}
              style={{ cursor: "pointer", border: statusFilter === "All" ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", transition: "transform 0.2s ease" }}
            >
              <h4>{lang === "si" ? "ක්‍රියාකාරී විමර්ශන" : "Active Inquiries"}</h4>
              <p>{activeInquiriesCount}</p>
            </div>
            <div 
              className={`hero-action-card${statusFilter === "In Progress" ? " active-stat-card" : ""}`}
              onClick={() => setStatusFilter("In Progress")}
              style={{ cursor: "pointer", border: statusFilter === "In Progress" ? "2px solid #2196f3" : "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", transition: "transform 0.2s ease" }}
            >
              <h4>{lang === "si" ? "සිදුවෙමින් පවතින" : "In Progress"}</h4>
              <p className="val-info">{inProgressInquiriesCount}</p>
            </div>
            <div 
              className={`hero-action-card${statusFilter === "Evidence Review" ? " active-stat-card" : ""}`}
              onClick={() => setStatusFilter("Evidence Review")}
              style={{ cursor: "pointer", border: statusFilter === "Evidence Review" ? "2px solid #9c27b0" : "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", transition: "transform 0.2s ease" }}
            >
              <h4>{lang === "si" ? "සාක්ෂි සමාලෝචන" : "Evidence Reviews"}</h4>
              <p className="val-purple">{evidenceReviewsInquiriesCount}</p>
            </div>
            <div 
              className={`hero-action-card${statusFilter === "Scheduled" ? " active-stat-card" : ""}`}
              onClick={() => setStatusFilter("Scheduled")}
              style={{ cursor: "pointer", border: statusFilter === "Scheduled" ? "2px solid #ff9800" : "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", transition: "transform 0.2s ease" }}
            >
              <h4>{lang === "si" ? "සැලසුම් කළ විභාග" : "Scheduled Hearings"}</h4>
              <p className="val-warning">{scheduledHearingsInquiriesCount}</p>
            </div>
          </section>

          {/* ── Tabbed View Selection ── */}
          <div className="navigation-tab-list" style={{ marginTop: "24px", marginBottom: "20px" }}>
            <button
              className={`nav-tab-btn${activeTab === "cases" ? " active" : ""}`}
              onClick={() => setActiveTab("cases")}
            >
              <ClipboardList className="tab-icon" />
              <span>{lang === "si" ? "විමර්ශන නඩු ලේඛනය" : "Inquiry & Investigation Cases"}</span>
            </button>
            <button
              className={`nav-tab-btn${activeTab === "officers" ? " active" : ""}`}
              onClick={() => setActiveTab("officers")}
            >
              <UserCheck className="tab-icon" />
              <span>{lang === "si" ? "විමර්ශන නිලධාරීන් ලියාපදිංචිය" : "Register & Manage Officers"}</span>
            </button>
          </div>

          {/* ==================== TAB 1: CASES LIST ==================== */}
          {activeTab === "cases" && (
            <>
              {/* Notifications Widget: Facebook-Style Subject Officer Notifications */}
              <section className="upcoming-events-widget" style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1px solid #e4e6eb", padding: "16px 20px", marginBottom: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <div className="upcoming-events-container">
                  {/* FB Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: isNotificationsMinimized ? "none" : "1px solid #f0f2f5", paddingBottom: isNotificationsMinimized ? "0" : "12px", marginBottom: isNotificationsMinimized ? "0" : "12px", flexWrap: "wrap", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ position: "relative", width: "40px", height: "40px", borderRadius: "50%", backgroundColor: unseenCount > 0 ? "#e7f3ff" : "#f0f2f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Bell size={20} style={{ color: unseenCount > 0 ? "#1877f2" : "#65676b" }} />
                        {unseenCount > 0 && (
                          <span style={{ position: "absolute", top: "-2px", right: "-2px", backgroundColor: "#e41e3f", color: "#ffffff", fontSize: "11px", fontWeight: 800, padding: "1px 6px", borderRadius: "10px", border: "2px solid #ffffff" }}>
                            {unseenCount}
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#050505", letterSpacing: "-0.2px" }}>
                          {lang === "si" ? "විෂය නිලධාරී දැනුම්දීම්" : "Notifications"}
                        </h4>
                        <div style={{ fontSize: "12px", color: "#65676b", fontWeight: 600 }}>
                          {lang === "si" ? "පත්වීම් ලිපිය සහ වාර්තා දිනයන් ලැබීම" : "Subject Officer Appointment & Report Due Dates"}
                        </div>
                      </div>
                    </div>

                    {/* Header Action Controls */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {unseenCount > 0 && (
                        <button
                          type="button"
                          onClick={() => markAllAsSeen()}
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "#1877f2",
                            backgroundColor: "#e7f3ff",
                            border: "none",
                            borderRadius: "8px",
                            padding: "6px 12px",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px"
                          }}
                          title="Mark all as read"
                        >
                          <CheckCircle size={14} />
                          <span>{lang === "si" ? "සියල්ල කියවූ බවට" : "Mark all as read"}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsNotificationsMinimized((prev) => !prev)}
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#65676b",
                          backgroundColor: "#f0f2f5",
                          border: "none",
                          borderRadius: "8px",
                          padding: "6px 12px",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                        title={isNotificationsMinimized ? "Expand Notifications" : "Minimize Notifications"}
                      >
                        {isNotificationsMinimized ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                      </button>
                    </div>
                  </div>

                  {!isNotificationsMinimized && (
                    <>
                      {/* FB Filter Pills: All / Unread */}
                      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                        <button
                          type="button"
                          onClick={() => setNotifFilter("all")}
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            padding: "6px 16px",
                            borderRadius: "18px",
                            border: "none",
                            backgroundColor: notifFilter === "all" ? "#e7f3ff" : "#f0f2f5",
                            color: notifFilter === "all" ? "#1877f2" : "#050505",
                            cursor: "pointer"
                          }}
                        >
                          {lang === "si" ? "සියල්ල" : "All"} ({subjectOfficerNotifications.length})
                        </button>

                        <button
                          type="button"
                          onClick={() => setNotifFilter("unread")}
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            padding: "6px 16px",
                            borderRadius: "18px",
                            border: "none",
                            backgroundColor: notifFilter === "unread" ? "#e7f3ff" : "#f0f2f5",
                            color: notifFilter === "unread" ? "#1877f2" : "#050505",
                            cursor: "pointer"
                          }}
                        >
                          {lang === "si" ? "නුදුටු" : "Unread"} ({unseenCount})
                        </button>
                      </div>

                      {/* FB Notification Items List */}
                      {isNotifLoading ? (
                        <div style={{ padding: "20px", textAlign: "center", color: "#65676b", fontSize: "13px" }}>
                          {lang === "si" ? "දැනුම්දීම් පූරණය වෙමින් පවතී..." : "Loading notifications..."}
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {displayedNotifs.length > 0 ? (
                            displayedNotifs.map((notif: any, index: number) => {
                              const isUnseen = !seenNotifIds.includes(notif.id);
                              const initial = (notif.subjectOfficerName || "S").trim().charAt(0).toUpperCase();
                              const displayDate = typeof notif.submittedAt === "string" && notif.submittedAt.includes("T") ? notif.submittedAt.split("T")[0] : notif.submittedAt;

                              return (
                                <div
                                  key={notif.id || index}
                                  onClick={() => markAsSeen(notif.id)}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "12px 14px",
                                    borderRadius: "12px",
                                    backgroundColor: isUnseen ? "#e7f3ff" : "#ffffff",
                                    border: isUnseen ? "1px solid #cce4ff" : "1px solid #f0f2f5",
                                    cursor: "pointer",
                                    transition: "all 0.15s ease",
                                    gap: "12px"
                                  }}
                                >
                                  {/* Left FB Avatar with Badge */}
                                  <div style={{ position: "relative", flexShrink: 0 }}>
                                    <div style={{ width: "46px", height: "46px", borderRadius: "50%", backgroundColor: isUnseen ? "#1877f2" : "#e4e6eb", color: isUnseen ? "#ffffff" : "#050505", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 800 }}>
                                      {initial}
                                    </div>
                                    <div style={{ position: "absolute", bottom: "-2px", right: "-2px", width: "20px", height: "20px", borderRadius: "50%", backgroundColor: "#42b72a", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #ffffff" }}>
                                      <CalendarIcon size={11} />
                                    </div>
                                  </div>

                                  {/* Middle Content */}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: "14px", color: "#050505", lineHeight: "1.35" }}>
                                      <span style={{ fontWeight: 800, color: "#1877f2" }}>
                                        {formatSubjectOfficerName(notif.subjectOfficerName, lang)}
                                      </span>{" "}
                                      <span>{lang === "si" ? "විසින් දිනයන් ඇතුළත් කරන ලදී: " : "submitted dates for "}</span>
                                      <span style={{ fontWeight: 800, color: "#050505" }}>
                                        {lang === "si" ? "නඩු අංක " : "Case No: "}{notif.caseNo}
                                      </span>
                                    </div>

                                    {/* Prominent Appt & Due Date Pills */}
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
                                      <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#eff6ff", color: "#1d4ed8", padding: "3px 10px", borderRadius: "6px", border: "1px solid #bfdbfe", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                        <CalendarIcon size={12} />
                                        <span>{lang === "si" ? "පත්වීම් දිනය: " : "Appt: "}{notif.appointmentDate || "—"}</span>
                                      </span>

                                      <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#fff7ed", color: "#c2410c", padding: "3px 10px", borderRadius: "6px", border: "1px solid #fed7aa", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                        <Clock size={12} />
                                        <span>{lang === "si" ? "වාර්තා දිනය: " : "Report Due: "}{notif.reportDueDate || "—"}</span>
                                      </span>

                                      <span style={{ fontSize: "11px", color: "#65676b", fontWeight: 600 }}>
                                        • {displayDate}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Right side Indicator & Action Button */}
                                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                                    {isUnseen && (
                                      <span style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#1877f2" }} title="Unread notification"></span>
                                    )}

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        markAsSeen(notif.id);
                                        router.push(`/investigation/add-details?caseNo=${notif.caseNo}`);
                                      }}
                                      style={{
                                        padding: "7px 14px",
                                        fontSize: "12px",
                                        fontWeight: 700,
                                        color: isUnseen ? "#ffffff" : "#1877f2",
                                        backgroundColor: isUnseen ? "#1877f2" : "#e7f3ff",
                                        border: "none",
                                        borderRadius: "8px",
                                        cursor: "pointer",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "5px",
                                        transition: "all 0.15s ease"
                                      }}
                                    >
                                      <Eye size={14} />
                                      <span>{lang === "si" ? "විස්තර" : "View Case"}</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div style={{ padding: "24px", textAlign: "center", color: "#65676b", fontSize: "13px", backgroundColor: "#f0f2f5", borderRadius: "12px" }}>
                              {lang === "si" ? "දැනුම්දීම් කිසිවක් නැත." : "No notifications found."}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>

              {/* Inquiry Cases Table & Interactive Controls */}
              <section className="letters-list-section">
                <div className="letters-list-header" style={{ flexDirection: "column", alignItems: "stretch", gap: "16px" }}>
                  
                  {/* Title & Filter Stats Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                    <div>
                      <h3 className="section-title" style={{ margin: 0 }}>
                        {lang === "si" ? "විමර්ශනයට නියමිත ලිපි සහ ගොනු" : "Inquiry & Investigation Cases"}
                      </h3>
                      <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 500 }}>
                        {t("showingResults", { count: filteredInquiries.length, total: inquiries.length })}
                      </span>
                    </div>

                    {/* Reset Filters button */}
                    {(statusFilter !== "All" || urgencyFilter !== "All" || officerFilter !== "All" || searchQuery !== "") && (
                      <button
                        type="button"
                        onClick={() => {
                          setStatusFilter("All");
                          setUrgencyFilter("All");
                          setOfficerFilter("All");
                          setSearchQuery("");
                        }}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 14px",
                          fontSize: "12px",
                          color: "#dc2626",
                          backgroundColor: "#fef2f2",
                          border: "1px solid #fca5a5",
                          borderRadius: "8px",
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 0.15s ease"
                        }}
                      >
                        <X size={14} />
                        <span>{lang === "si" ? "සියලුම පෙරහන් ඉවත් කරන්න" : "Reset All Filters"}</span>
                      </button>
                    )}
                  </div>

                  {/* Multi-Option Filter Panel */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", backgroundColor: "#f8fafc", padding: "14px 16px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                    
                    {/* Search Input */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {lang === "si" ? "සෙවීම" : "Keyword Search"}
                      </label>
                      <div className="search-box" style={{ width: "100%", margin: 0, backgroundColor: "#ffffff" }}>
                        <Search className="search-icon" size={15} />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={t("searchInquiries", "Search ref, subject...")}
                          className="search-input"
                          style={{ width: "100%" }}
                        />
                        {searchQuery && (
                          <button 
                            onClick={() => setSearchQuery("")}
                            style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: "0 6px" }}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Status Filter Dropdown */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {lang === "si" ? "තත්ත්වය අනුව" : "Status Filter"}
                      </label>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", color: "#0f172a", backgroundColor: "#ffffff", fontWeight: 600, width: "100%" }}
                      >
                        <option value="All">{lang === "si" ? "සියලුම තත්ත්වයන්" : "All Statuses"}</option>
                        <option value="In Progress">⚡ In Progress</option>
                        <option value="Evidence Review">🔍 Evidence Review</option>
                        <option value="Scheduled">🗓️ Scheduled Hearings</option>
                        <option value="Preliminary Investigation">📋 Preliminary Investigation</option>
                        <option value="Under Investigation">🕵️ Under Investigation</option>
                        <option value="Completed">✅ Completed</option>
                      </select>
                    </div>

                    {/* Due Date / Urgency Filter */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {lang === "si" ? "ඉලක්කගත දිනය / ප්‍රමුඛතාව" : "Urgency / Due Date"}
                      </label>
                      <select
                        value={urgencyFilter}
                        onChange={(e) => setUrgencyFilter(e.target.value)}
                        style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", color: "#0f172a", backgroundColor: "#ffffff", fontWeight: 600, width: "100%" }}
                      >
                        <option value="All">{lang === "si" ? "සියලුම දිනයන්" : "All Target Dates"}</option>
                        <option value="Overdue">🔴 Overdue Cases</option>
                        <option value="DueSoon">🟡 Due Soon (&le; 7 days)</option>
                        <option value="OnTrack">🟢 Normal / On Track</option>
                      </select>
                    </div>

                    {/* Assigned Officer Filter */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {lang === "si" ? "පැවරූ නිලධාරියා අනුව" : "Assigned Officer"}
                      </label>
                      <select
                        value={officerFilter}
                        onChange={(e) => setOfficerFilter(e.target.value)}
                        style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", color: "#0f172a", backgroundColor: "#ffffff", fontWeight: 600, width: "100%" }}
                      >
                        <option value="All">{lang === "si" ? "සියලුම නිලධාරීන්" : "All Officers"}</option>
                        <option value="Unassigned">{lang === "si" ? "නොපවරන ලද නඩු" : "Unassigned Cases"}</option>
                        {officers.map((o) => (
                          <option key={o.id} value={o.fullName}>{o.fullName}</option>
                        ))}
                      </select>
                    </div>

                  </div>

                </div>

                <div className="table-responsive-container">
                  <table className="letters-data-table">
                    <thead>
                      <tr>
                        <th scope="col">{lang === "si" ? "විමර්ශන අංකය" : "Inquiry No"}</th>
                        <th scope="col">{t("targetCompletionDate", lang === "si" ? "අති.ලේ වෙත ලද දිනය" : "Date Received at Addl. Sec.")}</th>
                        <th scope="col">{lang === "si" ? "විෂය කරුණ" : "Subject / Matter"}</th>
                        <th scope="col">{t("assignedSubjectOfficer", "Assigned Subject Officer")}</th>
                        <th scope="col">{lang === "si" ? "පත්වීම් ලිපියේ දිනය" : "Appt. Letter Date"}</th>
                        <th scope="col">{lang === "si" ? "වාර්තා දිනය" : "Report Due Date"}</th>
                        <th scope="col">{lang === "si" ? "තත්ත්වය" : "Status"}</th>
                        <th scope="col" className="text-center">{lang === "si" ? "ක්‍රියාමාර්ග" : "Actions"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={8} className="text-center py-4 text-muted">
                            {lang === "si" ? "තොරතුරු පූරණය වෙමින් පවතී..." : "Loading inquiries..."}
                          </td>
                        </tr>
                      ) : filteredInquiries.length > 0 ? (
                        filteredInquiries.map((item) => (
                          <tr key={item.id} className="letter-table-row">
                            <td className="font-semibold text-primary" style={{ whiteSpace: "nowrap" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <FileText size={16} style={{ color: "#4f46e5" }} />
                                <span>{item.inquiryNo}</span>
                              </div>
                            </td>
                            <td>
                              <span style={{ fontWeight: 500, color: "#334155" }}>{item.targetDate || "-"}</span>
                            </td>
                            <td className="subject-cell" style={{ maxWidth: "300px" }}>
                              <div style={{ fontWeight: 600, color: "#1e293b" }}>{item.subject}</div>
                            </td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 600, color: "#334155" }}>
                                <User size={14} style={{ color: "#4f46e5" }} />
                                <span>{formatSubjectOfficerName(item.subjectOfficer, lang)}</span>
                              </div>
                            </td>
                            <td>
                              {item.appointmentDate ? (
                                <span style={{ fontWeight: 700, color: "#0369a1", backgroundColor: "#f0f9ff", border: "1px solid #bae6fd", padding: "4px 8px", borderRadius: "6px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
                                  <CalendarIcon size={12} />
                                  {item.appointmentDate}
                                </span>
                              ) : (
                                <span style={{ color: "#94a3b8", fontSize: "12px", fontStyle: "italic" }}>—</span>
                              )}
                            </td>
                            <td>
                              {item.reportDueDate ? (
                                <span style={{ fontWeight: 700, color: "#b91c1c", backgroundColor: "#fef2f2", border: "1px solid #fca5a5", padding: "4px 8px", borderRadius: "6px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
                                  <Clock size={12} />
                                  {item.reportDueDate}
                                </span>
                              ) : (
                                <span style={{ color: "#94a3b8", fontSize: "12px", fontStyle: "italic" }}>—</span>
                              )}
                            </td>
                            <td>
                              <span className={`badge-badge ${
                                item.status === "Completed" 
                                  ? "badge-status-closed" 
                                  : item.status === "Scheduled"
                                  ? "badge-status-pending"
                                  : "badge-status-assigned"
                              }`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="text-center actions-cell">
                              <button
                                className="btn-action-view"
                                onClick={() => router.push(`/investigation/add-details?caseNo=${item.inquiryNo}`)}
                                title="Update Investigation Details"
                                style={{ display: "inline-flex", gap: "6px", alignItems: "center", padding: "8px 14px", backgroundColor: "#4f46e5", color: "#ffffff", borderRadius: "6px", fontWeight: 600 }}
                              >
                                <Edit size={15} />
                                <span>{lang === "si" ? "විස්තර සටහන් කරන්න" : "Add/Edit Details"}</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="text-center py-4 text-muted">
                            <div style={{ padding: "30px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                              <AlertCircle size={28} style={{ color: "#94a3b8" }} />
                              <span>{t("noCasesFound", "No matching inquiry cases found")}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* ==================== TAB 2: OFFICERS LIST ==================== */}
          {activeTab === "officers" && (
            <section className="letters-list-section">
              <div className="letters-list-header">
                <div>
                  <h3 className="section-title" style={{ margin: 0 }}>
                    {lang === "si" ? "විමර්ශන නිලධාරීන්ගේ නාමාවලිය" : "Investigation Officers Directory"}
                  </h3>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    Registered active and inactive officers available for inquiry assignment
                  </span>
                </div>
                <div className="letters-filters-group">
                  <div className="search-box">
                    <Search className="search-icon" size={16} />
                    <input
                      type="text"
                      value={officerSearchQuery}
                      onChange={(e) => setOfficerSearchQuery(e.target.value)}
                      placeholder={lang === "si" ? "නිලධාරීන් සොයන්න..." : "Search officers by name, emp no, email..."}
                      className="search-input"
                    />
                  </div>
                  <select
                    value={officerPositionFilter}
                    onChange={(e) => setOfficerPositionFilter(e.target.value)}
                    style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", backgroundColor: "#ffffff" }}
                  >
                    <option value="All">{lang === "si" ? "සියලුම තනතුරු" : "All Positions"}</option>
                    <option value="Chairman">{lang === "si" ? "සභාපති (Chairman)" : "Chairman"}</option>
                    <option value="Member">{lang === "si" ? "සාමාජික (Member)" : "Member"}</option>
                  </select>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn-new-letter"
                      onClick={() => router.push("/investigation/officer-registration")}
                      style={{ padding: "10px 18px", fontSize: "14px", display: "inline-flex", alignItems: "center", gap: "8px", backgroundColor: "#4f46e5", color: "#ffffff" }}
                    >
                      <UserPlus size={16} />
                      <span>{lang === "si" ? "ලියාපදිංචි කිරීමේ වෙනම පිටුව" : "Register Officer (Separate Page)"}</span>
                    </button>
                    <button
                      type="button"
                      className="btn-new-letter"
                      onClick={() => {
                        setIsOfficerEditMode(false);
                        setEditingOfficerId(null);
                        setOfficerNameForm("");
                        setOfficerNicForm("");
                        setOfficerRoleTypeForm("Member");
                        setStudiedSchoolsForm([]);
                        setNewStudiedSchoolInput("");
                        setChildrenSchoolsForm([]);
                        setNewChildrenSchoolInput("");
                        setOfficerEmailForm("");
                        setOfficerStatusForm("Active");
                        setOfficerErrors({});
                        setIsOfficerModalOpen(true);
                      }}
                      style={{ padding: "10px 18px", fontSize: "14px", display: "inline-flex", alignItems: "center", gap: "8px", backgroundColor: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1" }}
                    >
                      <UserPlus size={16} />
                      <span>{lang === "si" ? "ඉක්මන් ඇතුළත් කිරීම" : "Quick Add Modal"}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="table-responsive-container">
                <table className="letters-data-table">
                  <thead>
                    <tr>
                      <th scope="col">{lang === "si" ? "නිලධාරියාගේ නම සහ NIC" : "Officer Name & NIC"}</th>
                      <th scope="col">{lang === "si" ? "ඉගෙනුම ලැබූ පාසල්" : "Studied Schools"}</th>
                      <th scope="col">{lang === "si" ? "දරුවන්ගේ පාසල්" : "Children's Schools"}</th>
                      <th scope="col">{lang === "si" ? "ඊමේල් ලිපිනය" : "Email Address"}</th>
                      <th scope="col">{lang === "si" ? "ලියාපදිංචි දිනය" : "Date Registered"}</th>
                      <th scope="col">{lang === "si" ? "තත්ත්වය" : "Status"}</th>
                      <th scope="col" className="text-center">{lang === "si" ? "ක්‍රියාමාර්ග" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOfficers.length > 0 ? (
                      filteredOfficers.map((o) => (
                        <tr key={o.id} className="letter-table-row">
                          <td className="font-semibold text-primary">
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              <div style={{ width: "38px", height: "38px", borderRadius: "50%", backgroundColor: "#e0e7ff", color: "#4338ca", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "13px" }}>
                                {getInitials(o.fullName)}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
                                  <span>{o.fullName}</span>
                                  <span style={{ fontSize: "11px", backgroundColor: o.officerRole === "Chairman" ? "#fef3c7" : "#e0e7ff", color: o.officerRole === "Chairman" ? "#92400e" : "#3730a3", padding: "1px 7px", borderRadius: "10px", fontWeight: 600 }}>
                                    {o.officerRole || "Member"}
                                  </span>
                                </div>
                                <span style={{ fontSize: "11px", color: "#475569", display: "inline-block", backgroundColor: "#f1f5f9", padding: "1px 6px", borderRadius: "4px", marginTop: "2px" }}>
                                  NIC: {o.nicNo || "N/A"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            {o.studiedSchools && o.studiedSchools.length > 0 ? (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxWidth: "200px" }}>
                                {o.studiedSchools.map((s, idx) => (
                                  <span key={idx} style={{ fontSize: "11px", backgroundColor: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: "12px", fontWeight: 500 }}>
                                    {s}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: "12px", color: "#94a3b8" }}>—</span>
                            )}
                          </td>
                          <td>
                            {o.childrenSchools && o.childrenSchools.length > 0 ? (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxWidth: "200px" }}>
                                {o.childrenSchools.map((s, idx) => (
                                  <span key={idx} style={{ fontSize: "11px", backgroundColor: "#fef3c7", color: "#b45309", padding: "2px 8px", borderRadius: "12px", fontWeight: 500 }}>
                                    {s}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: "12px", color: "#94a3b8" }}>—</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#475569" }}>
                              <Mail size={14} style={{ color: "#94a3b8" }} />
                              <span>{o.email}</span>
                            </div>
                          </td>
                          <td>{o.createdAt}</td>
                          <td>
                            <button
                              onClick={() => handleToggleOfficerStatus(o)}
                              className={`badge-badge ${
                                o.status === "Active" ? "badge-status-inprogress" : "badge-status-pending"
                              }`}
                              style={{ border: "none", cursor: "pointer", transition: "transform 0.15s ease" }}
                              title="Click to toggle officer status"
                            >
                              {o.status}
                            </button>
                          </td>
                          <td className="text-center actions-cell">
                            <div style={{ display: "inline-flex", gap: "8px" }}>
                              <button
                                className="btn-action-edit"
                                onClick={() => {
                                  setIsOfficerEditMode(true);
                                  setEditingOfficerId(o.id);
                                  setOfficerNameForm(o.fullName);
                                  setOfficerNicForm(o.nicNo || "");
                                  setOfficerRoleTypeForm(o.officerRole || "Member");
                                  setStudiedSchoolsForm(Array.isArray(o.studiedSchools) ? [...o.studiedSchools] : []);
                                  setNewStudiedSchoolInput("");
                                  setChildrenSchoolsForm(Array.isArray(o.childrenSchools) ? [...o.childrenSchools] : []);
                                  setNewChildrenSchoolInput("");
                                  setOfficerEmailForm(o.email);
                                  setOfficerStatusForm(o.status);
                                  setOfficerErrors({});
                                  setIsOfficerModalOpen(true);
                                }}
                                title="Edit Officer Details"
                                style={{ padding: "6px 10px", borderRadius: "6px", backgroundColor: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1" }}
                              >
                                <Edit size={15} />
                              </button>
                              <button
                                className="btn-action-delete"
                                onClick={() => handleDeleteOfficer(o)}
                                title="Delete Officer"
                                style={{ padding: "6px 10px", borderRadius: "6px", backgroundColor: "#fef2f2", color: "#ef4444", border: "1px solid #fca5a5" }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-4 text-muted">
                          No investigation officers found matching your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <SiteFooter />
        </main>
      </div>

      {/* ==================== CASE DETAILS & INVESTIGATION EDIT MODAL ==================== */}
      {isCaseModalOpen && selectedCase && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="case-modal-title">
          <div className="modal-content-wrapper premium-modal" style={{ maxWidth: "880px", width: "95%", borderRadius: "16px", overflow: "hidden" }}>
            
            {/* Modal Header */}
            <header className="modal-header" style={{ padding: "20px 24px", backgroundColor: "#1e1b4b", color: "#ffffff", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Shield size={24} style={{ color: "#818cf8" }} />
                </div>
                <div>
                  <h3 id="case-modal-title" className="modal-title" style={{ color: "#ffffff", margin: 0, fontSize: "18px", fontWeight: 700 }}>
                    {lang === "si" ? "විමර්ශන විස්තර සහ ප්‍රගති සටහන්" : "Investigation Progress & Action Form"}
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                    <span style={{ fontSize: "12px", color: "#c7d2fe", backgroundColor: "rgba(255,255,255,0.15)", padding: "2px 8px", borderRadius: "4px", fontWeight: 600 }}>
                      Ref: {selectedCase.inquiryNo}
                    </span>
                    <span style={{ fontSize: "12px", color: "#a5b4fc" }}>
                      Target: {selectedCase.targetDate}
                    </span>
                  </div>
                </div>
              </div>
              <button 
                type="button" 
                className="modal-close-btn"
                onClick={() => setIsCaseModalOpen(false)}
                aria-label="Close modal"
                style={{ color: "#ffffff", backgroundColor: "rgba(255,255,255,0.1)", border: "none", padding: "8px", borderRadius: "50%", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </header>

            {isDetailsLoading ? (
              <div style={{ padding: "50px", textAlign: "center", color: "#64748b", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                <RefreshCw size={28} className="animate-spin" style={{ color: "#4f46e5" }} />
                <span>Loading case records and background history...</span>
              </div>
            ) : (
              <form onSubmit={handleSaveInvestigationDetails} className="modal-body-scrollable" style={{ padding: "24px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  
                  {/* Case Subject Highlight Banner */}
                  <div style={{ backgroundColor: "#f8fafc", borderLeft: "4px solid #4f46e5", padding: "14px 18px", borderRadius: "8px", borderTop: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {lang === "si" ? "විෂය කරුණ" : "Case Subject / Matter"}
                    </span>
                    <h4 style={{ margin: "4px 0 0 0", fontSize: "15px", color: "#0f172a", fontWeight: 700 }}>
                      {selectedCase.subject}
                    </h4>
                  </div>

                  {/* Accused Officer Grid */}
                  <div className="details-section-card" style={{ backgroundColor: "#ffffff", padding: "18px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                    <h4 style={{ margin: "0 0 14px 0", fontSize: "15px", color: "#1e293b", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                      <User size={18} style={{ color: "#4f46e5" }} />
                      <span>{lang === "si" ? "චෝදනා ලැබූ නිලධාරියාගේ තොරතුරු (විෂයභාර අංශයෙන්)" : "Accused Officer Details (From Subject Branch)"}</span>
                    </h4>

                    {concernedOfficersList && concernedOfficersList.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        {concernedOfficersList.map((officer, idx) => (
                          <div key={idx} style={{ backgroundColor: "#f8fafc", padding: "12px 14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                            {concernedOfficersList.length > 1 && (
                              <span style={{ fontSize: "12px", fontWeight: 700, color: "#4f46e5", display: "block", marginBottom: "8px" }}>
                                {lang === "si" ? `පුද්ගලයා #${idx + 1}` : `Person #${idx + 1}`}
                              </span>
                            )}
                            <div className="details-grid-3col" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
                              <div className="detail-field">
                                <span style={{ fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                                  <User size={12} /> {lang === "si" ? "නිලධාරියාගේ නම" : "Officer Name"}
                                </span>
                                <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{officer.officer_name || officer.officerName || "—"}</span>
                              </div>

                              <div className="detail-field">
                                <span style={{ fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                                  <CreditCard size={12} /> {lang === "si" ? "ජාතික හැඳුනුම්පත් අංකය" : "NIC Number"}
                                </span>
                                <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{officer.nic || "—"}</span>
                              </div>

                              <div className="detail-field">
                                <span style={{ fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                                  <Award size={12} /> {lang === "si" ? "තනතුර" : "Designation"}
                                </span>
                                <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{officer.position || "—"}</span>
                              </div>

                              <div className="detail-field">
                                <span style={{ fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                                  <Building size={12} /> {lang === "si" ? "පාසල / ආයතනය" : "School / Institute"}
                                </span>
                                <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{officer.institute_name || officer.instituteName || "—"}</span>
                              </div>

                              {(officer.dob || officer.date_of_birth) && (
                                <div className="detail-field">
                                  <span style={{ fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                                    <CalendarIcon size={12} /> {lang === "si" ? "උපන් දිනය" : "Date of Birth"}
                                  </span>
                                  <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{officer.dob || officer.date_of_birth}</span>
                                </div>
                              )}

                              {(officer.appointment_date || officer.appointmentDate) && (
                                <div className="detail-field">
                                  <span style={{ fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                                    <CalendarIcon size={12} /> {lang === "si" ? "පත්වීම් දිනය" : "Date of Appointment"}
                                  </span>
                                  <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{officer.appointment_date || officer.appointmentDate}</span>
                                </div>
                              )}

                              <div className="detail-field">
                                <span style={{ fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                                  <MapPin size={12} /> {lang === "si" ? "ලිපිනය" : "Address"}
                                </span>
                                <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{officer.address || "—"}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: "10px", alignItems: "center", padding: "12px 16px", backgroundColor: "#fffbeb", color: "#b45309", borderRadius: "8px", border: "1px solid #fef3c7" }}>
                        <AlertCircle size={18} />
                        <span style={{ fontSize: "13px" }}>
                          {lang === "si"
                            ? "මෙම විමර්ශනය සඳහා වෙන් වූ චෝදනා ලැබූ නිලධාරියාගේ තොරතුරු තවමත් ඇතුළත් කර නොමැත."
                            : "No specific accused officer personal record registered for this inquiry yet."}
                        </span>
                      </div>
                    )}
                  </div>



                  {/* Investigation Committee Assignment (Choose 1 Chairman & Many Members) */}
                  <div className="details-section-card" style={{ backgroundColor: "#ffffff", padding: "18px", borderRadius: "12px", border: "1px solid #cbd5e1", boxShadow: "0 2px 4px rgba(0,0,0,0.03)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                      <h4 style={{ margin: 0, fontSize: "15px", color: "#1e293b", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                        <UserCheck size={18} style={{ color: "#4f46e5" }} />
                        <span>{lang === "si" ? "විමර්ශන කමිටුව / මණ්ඩලය පත් කිරීම (1 සභාපති සහ සාමාජිකයින්)" : "Investigation Committee Assignment (1 Chairman & Members)"}</span>
                      </h4>
                      <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#e0e7ff", color: "#3730a3", padding: "3px 10px", borderRadius: "12px" }}>
                        {selectedChairman ? "1 Chairman" : "No Chairman"} • {selectedMembers.length} {selectedMembers.length === 1 ? "Member" : "Members"}
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      {getCaseInstitutes().length > 0 && (
                        <div style={{ fontSize: "11px", color: "#b45309", backgroundColor: "#fffbe6", border: "1px solid #fde047", padding: "8px 12px", borderRadius: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                          <Shield size={14} style={{ color: "#d97706" }} />
                          <span>
                            {lang === "si"
                              ? `'${getCaseInstitutes().join(", ")}' පාසලට/ආයතනයට සම්බන්ධ (ඉගෙනගත්/දරුවන් සිටින) නිලධාරීන් ගැටුම් වැළැක්වීමට තේරීම් වලින් ඉවත් කර ඇත.`
                              : `Officers associated with '${getCaseInstitutes().join(", ")}' (studied/children school) are filtered out to prevent conflict of interest.`}
                          </span>
                        </div>
                      )}
                      
                      {/* 1. CHOOSE CHAIRMAN (1 Chairman) */}
                      <div style={{ backgroundColor: "#fffbe6", padding: "14px", borderRadius: "10px", border: "1px solid #fef08a" }}>
                        <label htmlFor="chairmanSelectModal" style={{ fontSize: "13px", fontWeight: 700, color: "#854d0e", display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                          <Award size={16} style={{ color: "#d97706" }} />
                          <span>{lang === "si" ? "1. සභාපති නිලධාරී තේරීම (තනි සභාපතිවරයෙක් පමණි)" : "1. Choose Inquiry Chairman (Single Chairman)"}</span>
                        </label>
                        
                        {selectedChairman ? (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#ffffff", padding: "10px 14px", borderRadius: "8px", border: "1px solid #fde047" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "#d97706", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "14px" }}>
                                {getInitials(selectedChairman.fullName || selectedChairman.name || "C")}
                              </div>
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "14px" }}>
                                    {selectedChairman.fullName || selectedChairman.name}
                                  </span>
                                  <span style={{ fontSize: "10px", backgroundColor: "#fef3c7", color: "#92400e", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                                    CHAIRMAN / සභාපති
                                  </span>
                                </div>
                                <span style={{ fontSize: "11px", color: "#64748b" }}>
                                  NIC: {selectedChairman.nicNo || selectedChairman.nic || "N/A"} {selectedChairman.email ? `• ${selectedChairman.email}` : ""}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={handleRemoveChairman}
                              style={{ color: "#dc2626", backgroundColor: "#fef2f2", border: "1px solid #fca5a5", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                            >
                              <X size={14} />
                              <span>{lang === "si" ? "ඉවත් කරන්න" : "Change"}</span>
                            </button>
                          </div>
                        ) : (
                          <select
                            id="chairmanSelectModal"
                            value=""
                            onChange={(e) => handleSelectChairman(e.target.value)}
                            className="field-select"
                            style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #fde047", backgroundColor: "#ffffff", fontSize: "13px" }}
                          >
                            <option value="">{lang === "si" ? "-- ලියාපදිංචි සභාපතිවරුන්ගෙන් තෝරන්න --" : "-- Select Chairman from Registered Chairmen --"}</option>
                            {officers
                              .filter((off) => {
                                const pos = (off.position || off.officerRole || "").toLowerCase();
                                return pos === "chairman";
                              })
                              .filter((off) => !isOfficerConnectedToCaseInstitute(off, getCaseInstitutes()))
                              .map((off) => (
                                <option key={off.id} value={off.id}>
                                  {off.fullName} {off.employeeNo ? `[${off.employeeNo}]` : ""} {off.nicNo ? `- NIC: ${off.nicNo}` : ""}
                                </option>
                              ))}
                          </select>
                        )}
                      </div>

                      {/* 2. CHOOSE MANY MEMBERS (Multiple Members) */}
                      <div style={{ backgroundColor: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                        <label style={{ fontSize: "13px", fontWeight: 700, color: "#334155", display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                          <UserCheck size={16} style={{ color: "#4f46e5" }} />
                          <span>{lang === "si" ? "2. කමිටු සාමාජිකයින් එක් කිරීම (සාමාජිකයින් කිහිපදෙනෙකු)" : "2. Choose Committee Members (Many Members)"}</span>
                        </label>

                        {/* Selector & Add Member Row */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px", marginBottom: "12px" }}>
                          <select
                            value={memberSelectId}
                            onChange={(e) => {
                              setMemberSelectId(e.target.value);
                              if (e.target.value) handleAddMemberSelect(e.target.value);
                            }}
                            className="field-select"
                            style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", backgroundColor: "#ffffff", fontSize: "13px" }}
                          >
                            <option value="">{lang === "si" ? "-- ලියාපදිංචි සාමාජිකයින්ගෙන් තෝරා එක් කරන්න --" : "-- Select Registered Member to Add --"}</option>
                            {officers
                              .filter((off) => {
                                const pos = (off.position || off.officerRole || "").toLowerCase();
                                return pos === "member";
                              })
                              .filter((off) => !isOfficerConnectedToCaseInstitute(off, getCaseInstitutes()))
                              .filter((o) => !selectedChairman || (selectedChairman.id !== o.id && selectedChairman.fullName !== o.fullName))
                              .filter((o) => !selectedMembers.some((m) => m.id === o.id || m.fullName === o.fullName))
                              .map((off) => (
                                <option key={off.id} value={off.id}>
                                  + {off.fullName} {off.employeeNo ? `[${off.employeeNo}]` : ""} {off.nicNo ? `- NIC: ${off.nicNo}` : ""}
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* Manual Name Input for non-registered members */}
                        <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                          <input
                            type="text"
                            placeholder={lang === "si" ? "නැතහොත් වෙනත් සාමාජිකයෙකුගේ නම ඇතුළත් කරන්න..." : "Or type custom member full name..."}
                            value={customMemberInput}
                            onChange={(e) => setCustomMemberInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomMember(); } }}
                            style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                          />
                          <button
                            type="button"
                            onClick={handleAddCustomMember}
                            style={{ padding: "8px 14px", backgroundColor: "#4f46e5", color: "#ffffff", border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                          >
                            <Plus size={14} />
                            <span>{lang === "si" ? "එක් කරන්න" : "Add Member"}</span>
                          </button>
                        </div>

                        {/* Members Cards List */}
                        {selectedMembers.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {selectedMembers.map((member, idx) => (
                              <div
                                key={member.id || idx}
                                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#ffffff", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                  <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#e0e7ff", color: "#3730a3", width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    #{idx + 1}
                                  </span>
                                  <div>
                                    <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px", display: "block" }}>
                                      {member.fullName || member.name}
                                    </span>
                                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                                      Member {member.nicNo || member.nic ? `• NIC: ${member.nicNo || member.nic}` : ""}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMember(idx)}
                                  style={{ color: "#ef4444", backgroundColor: "#fef2f2", border: "1px solid #fca5a5", padding: "4px 8px", borderRadius: "6px", cursor: "pointer" }}
                                  title="Remove Member"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ padding: "12px", textAlign: "center", color: "#94a3b8", fontSize: "12px", backgroundColor: "#ffffff", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
                            {lang === "si" ? "තවමත් සාමාජිකයින් තෝරා නොමැත. ඉහත ලැයිස්තුවෙන් හෝ නම ඇතුළත් කර එක් කරන්න." : "No committee members added yet. Select from the dropdown or type a name above."}
                          </div>
                        )}
                      </div>



                      {/* Action Button: Send Investigation Committee Assignment details to Subject Officer */}
                      <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          onClick={handleSendCommitteeToSubjectOfficer}
                          disabled={isSaving}
                          style={{
                            padding: "10px 20px",
                            backgroundColor: "#2563eb",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "8px",
                            fontWeight: 600,
                            fontSize: "13px",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            boxShadow: "0 2px 4px rgba(37,99,235,0.25)",
                            transition: "all 0.15s ease"
                          }}
                        >
                          <Send size={16} />
                          <span>
                            {lang === "si"
                              ? "විමර්ශන කමිටු පත්කිරීමේ තොරතුරු විෂය නිලධාරී වෙත යවන්න"
                              : "Send Investigation Committee Assignment details to Subject Officer"}
                          </span>
                        </button>
                      </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", backgroundColor: "#f0f9ff", padding: "16px", borderRadius: "10px", border: "1px solid #bae6fd" }}>
                      <div style={{ backgroundColor: "#ffffff", padding: "12px 14px", borderRadius: "8px", border: "1px solid #bae6fd" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                          <CalendarIcon size={14} />
                          {lang === "si" ? "පත්වීම් ලිපියේ දිනය" : "Appointment Letter Date"}
                        </div>
                        <div style={{ fontSize: "15px", fontWeight: 800, color: (step2AppointmentDate || existingAssignment?.appointmentDate) ? "#0284c7" : "#94a3b8" }}>
                          {step2AppointmentDate || existingAssignment?.appointmentDate || (lang === "si" ? "තවමත් විෂය නිලධාරී විසින් ඇතුළත් කර නැත" : "Not assigned yet by Subject Officer")}
                        </div>
                      </div>

                      <div style={{ backgroundColor: "#ffffff", padding: "12px 14px", borderRadius: "8px", border: "1px solid #fca5a5" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#b91c1c", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                          <Clock size={14} />
                          {lang === "si" ? "වාර්තාව ලබාදිය යුතු දිනය" : "Report Due Date"}
                        </div>
                        <div style={{ fontSize: "15px", fontWeight: 800, color: (step2ReportDueDate || existingAssignment?.reportDueDate) ? "#dc2626" : "#94a3b8" }}>
                          {step2ReportDueDate || existingAssignment?.reportDueDate || (lang === "si" ? "තවමත් විෂය නිලධාරී විසින් ඇතුළත් කර නැත" : "Not assigned yet by Subject Officer")}
                        </div>
                      </div>
                    </div>

                    {/* ── Extension of Days Subsection (Directly inside Step 2 card under appointment/due dates) ── */}
                    <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px dashed #cbd5e1" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <label style={{ fontSize: "13px", fontWeight: 700, color: "#92400e", display: "flex", alignItems: "center", gap: "6px" }}>
                          <Clock size={16} style={{ color: "#d97706" }} />
                          <span>{lang === "si" ? "දිනයන් දීර්ඝ කිරීමේ කොටස (අනුමැතිය සඳහා යවන ලදී):" : "Extension of Days Request (Sent for Approval):"}</span>
                        </label>

                        {/* Status Badge */}
                        {existingAssignment?.extensionApprovalStatus === "Approved" ? (
                          <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#dcfce7", color: "#15803d", padding: "3px 10px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                            <CheckCircle size={13} />
                            {lang === "si" ? `අදාළ බලධාරියා අනුමත කළා (${existingAssignment?.extensionDecisionDate || ""})` : `Approved by Relevant Authority (${existingAssignment?.extensionDecisionDate || ""})`}
                          </span>
                        ) : existingAssignment?.extensionApprovalStatus === "Disapproved" ? (
                          <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#fee2e2", color: "#b91c1c", padding: "3px 10px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                            <X size={13} />
                            {lang === "si" ? `අදාළ බලධාරියා ප්‍රතික්ෂේප කළා (${existingAssignment?.extensionDecisionDate || ""})` : `Disapproved by Relevant Authority (${existingAssignment?.extensionDecisionDate || ""})`}
                          </span>
                        ) : (step3ExtensionRequested || subjExtensionTerm !== "None" || (subjExtensionStartDate && subjExtensionEndDate)) ? (
                          <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#fef3c7", color: "#b45309", padding: "3px 10px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                            <Clock size={13} />
                            {lang === "si" ? "අනුමැතිය අපේක්ෂාවෙන්" : "Awaiting Approval"}
                          </span>
                        ) : (
                          <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#f1f5f9", color: "#64748b", padding: "3px 10px", borderRadius: "12px" }}>
                            {lang === "si" ? "දිනයන් දීර්ඝ කිරීමක් නැත" : "No Extension Requested"}
                          </span>
                        )}
                      </div>

                      <div style={{ backgroundColor: "#fffbeb", padding: "16px", borderRadius: "10px", border: "1px solid #fde68a", display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
                          
                          {/* Extension Term Select */}
                          <div>
                            <label htmlFor="modalExtensionTermSelect" style={{ fontSize: "12px", fontWeight: 700, color: "#92400e", display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                              <Clock size={14} /> {lang === "si" ? "දීර්ඝ කිරීමේ වාරය (Extension Term):" : "Extension Term:"}
                            </label>
                            <select
                              id="modalExtensionTermSelect"
                              value={step3ExtensionTerm !== "None" ? step3ExtensionTerm : subjExtensionTerm}
                              onChange={(e) => {
                                const val = e.target.value as any;
                                setStep3ExtensionTerm(val);
                                setSubjExtensionTerm(val);
                              }}
                              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #fde047", fontSize: "13px", fontWeight: 700, color: "#78350f", backgroundColor: "#ffffff" }}
                            >
                              <option value="None">{lang === "si" ? "-- තෝරන්න (None) --" : "-- Select Term --"}</option>
                              <option value="First">{lang === "si" ? "පළමු දීර්ඝ කිරීම (First Extension)" : "First Extension (1st)"}</option>
                              <option value="Second">{lang === "si" ? "දෙවන දීර්ඝ කිරීම (Second Extension)" : "Second Extension (2nd)"}</option>
                              <option value="Third">{lang === "si" ? "තෙවන දීර්ඝ කිරීම (3rd — උපරිමය)" : "Third Extension (3rd) — Maximum"}</option>
                              
                            </select>
                          </div>

                          {/* Extension Start Date */}
                          <div>
                            <label htmlFor="modalExtensionStartDateInput" style={{ fontSize: "12px", fontWeight: 700, color: "#92400e", display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                              <CalendarIcon size={14} /> {lang === "si" ? "ආරම්භක දිනය (Extension Start Date):" : "Extension Start Date:"}
                            </label>
                            <input
                              id="modalExtensionStartDateInput"
                              type="date"
                              value={step3ExtensionStartDate || subjExtensionStartDate}
                              onChange={(e) => {
                                setStep3ExtensionStartDate(e.target.value);
                                setSubjExtensionStartDate(e.target.value);
                              }}
                              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #fde047", fontSize: "14px", fontWeight: 700, color: "#78350f", backgroundColor: "#ffffff" }}
                            />
                          </div>

                          {/* Extension End Date */}
                          <div>
                            <label htmlFor="modalExtensionEndDateInput" style={{ fontSize: "12px", fontWeight: 700, color: "#92400e", display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                              <CalendarIcon size={14} /> {lang === "si" ? "අවසාන දිනය (Extension End Date):" : "Extension End Date:"}
                            </label>
                            <input
                              id="modalExtensionEndDateInput"
                              type="date"
                              value={step3ExtensionEndDate || subjExtensionEndDate}
                              onChange={(e) => {
                                setStep3ExtensionEndDate(e.target.value);
                                setSubjExtensionEndDate(e.target.value);
                              }}
                              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #fde047", fontSize: "14px", fontWeight: 700, color: "#78350f", backgroundColor: "#ffffff" }}
                            />
                          </div>

                        </div>

                        {/* Action Button: Send Extension Request to Subject Officer */}
                        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px", marginTop: "4px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={handleStep3RequestExtension}
                            style={{ padding: "10px 18px", backgroundColor: "#d97706", color: "#ffffff", border: "none", borderRadius: "8px", fontWeight: 600, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", boxShadow: "0 2px 4px rgba(217,119,6,0.25)" }}
                          >
                            <Send size={15} />
                            <span>{lang === "si" ? "විෂය නිලධාරියා වෙත යවන්න" : "Send to Subject Officer"}</span>
                          </button>
                        </div>
                      </div>

                      {/* ── Subject Officer Decision: Read-only status display for Investigation Admin ── */}
                      {(step3ExtensionRequested || subjExtensionTerm !== "None" || (subjExtensionStartDate && subjExtensionEndDate) || existingAssignment?.extensionRequestedByAdmin) && existingAssignment?.extensionApprovalStatus && (
                        <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #fde68a" }}>
                          {existingAssignment?.extensionApprovalStatus === "Approved" ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#f0fdf4", padding: "12px 16px", borderRadius: "10px", border: "1px solid #86efac" }}>
                              <CheckCircle size={20} style={{ color: "#16a34a", flexShrink: 0 }} />
                              <div>
                                <div style={{ fontWeight: 700, color: "#15803d", fontSize: "13px" }}>{lang === "si" ? "විෂය නිලධාරියා විසින් අනුමත කරන ලදී" : "Extension Approved by Subject Officer"}</div>
                                <div style={{ fontSize: "12px", color: "#166534" }}>{lang === "si" ? `නව වාර්තා දිනය: ${step3ExtensionEndDate || subjExtensionEndDate || ""}` : `Decision Date: ${existingAssignment?.extensionDecisionDate || ""} | New Due Date: ${step3ExtensionEndDate || subjExtensionEndDate || ""}`}</div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#fef2f2", padding: "12px 16px", borderRadius: "10px", border: "1px solid #fca5a5" }}>
                              <X size={20} style={{ color: "#dc2626", flexShrink: 0 }} />
                              <div>
                                <div style={{ fontWeight: 700, color: "#b91c1c", fontSize: "13px" }}>{lang === "si" ? "විෂය නිලධාරියා විසින් ප්‍රතික්ෂේප කරන ලදී" : "Extension Disapproved by Subject Officer"}</div>
                                <div style={{ fontSize: "12px", color: "#991b1b" }}>{lang === "si" ? `ප්‍රතිඵල දිනය: ${existingAssignment?.extensionDecisionDate || ""}` : `Decision Date: ${existingAssignment?.extensionDecisionDate || ""}`}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Add/Update Investigation Progress Form Section */}
                  <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #cbd5e1", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
                    <h4 style={{ margin: "0 0 16px 0", fontSize: "16px", color: "#0f172a", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                      <FileCheck size={20} style={{ color: "#4f46e5" }} />
                      <span>{lang === "si" ? "විමර්ශන ප්‍රගතිය සහ පියවර ඇතුළත් කිරීම" : "Record Progress & Update Inquiry Details"}</span>
                    </h4>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
                      
                      {/* Investigation File Number (විමර්ශන ගොනු අංකය) */}
                      <div className="form-field-group">
                        <label htmlFor="modalFileRefNo" className="field-label" style={{ fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: "6px" }}>
                          <FileText size={14} style={{ color: "#4f46e5" }} />
                          {lang === "si" ? "විමර්ශන ගොනු අංකය" : t("investigationFileNo", "Investigation File No.")}
                        </label>
                        <input
                          id="modalFileRefNo"
                          type="text"
                          placeholder={lang === "si" ? "උදා: INV/FILE/2026/01" : "e.g. INV/FILE/2026/01"}
                          value={fileRefNoForm}
                          onChange={(e) => setFileRefNoForm(e.target.value)}
                          className="field-input"
                          style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", width: "100%" }}
                        />
                      </div>

                      {/* Investigation Status (විමර්ශන තත්ත්වය) */}
                      <div className="form-field-group">
                        <label htmlFor="modalStatus" className="field-label" style={{ fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: "6px" }}>
                          <Layers size={14} style={{ color: "#4f46e5" }} />
                          {lang === "si" ? "විමර්ශන තත්ත්වය" : "Investigation Status"}
                        </label>
                        <select
                          id="modalStatus"
                          value={investigationStatus}
                          onChange={(e) => setInvestigationStatus(e.target.value as any)}
                          className="field-select"
                          style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", width: "100%" }}
                        >
                          <option value="Scheduled">{lang === "si" ? "🗓️ නියමිතයි (Scheduled)" : "🗓️ Scheduled"}</option>
                          <option value="In Progress">{lang === "si" ? "⚡ සිදුවෙමින් පවතියි (In Progress)" : "⚡ In Progress"}</option>
                          <option value="Evidence Review">{lang === "si" ? "🔍 සාක්ෂි සමාලෝචනය (Evidence Review)" : "🔍 Evidence Review"}</option>
                          <option value="Preliminary Investigation">{lang === "si" ? "📋 මූලික විමර්ශනය (Preliminary Investigation)" : "📋 Preliminary Investigation"}</option>
                          <option value="Under Investigation">{lang === "si" ? "🕵️ විමර්ශනය යටතේ පවතියි (Under Investigation)" : "🕵️ Under Investigation"}</option>
                          <option value="Completed">{lang === "si" ? "✅ අවසන් කර ඇත (Completed)" : "✅ Completed"}</option>
                        </select>
                      </div>
                    </div>

                    {/* Quick Preset Note Templates */}
                    <div style={{ marginTop: "18px" }}>
                      <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569", display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                        <Sparkles size={14} style={{ color: "#f59e0b" }} />
                        <span>{lang === "si" ? "ඉක්මන් ක්‍රියාමාර්ග සටහන් (එක් කිරීමට ක්ලික් කරන්න):" : t("quickNoteTemplates", "Quick Action Presets (Click to insert):")}</span>
                      </label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {[
                          { label: lang === "si" ? "+ සාක්ෂිකරුවන්ගේ ප්‍රකාශ" : "+ Witness Statement Recorded", val: lang === "si" ? "සාක්ෂිකරුවන්ගෙන් ප්‍රකාශ ලබා ගන්නා ලදී." : t("presetWitnessStatement", "Witness statement recorded.") },
                          { label: lang === "si" ? "+ විභාග දිනය නියම කිරීම" : "+ Hearing Scheduled", val: lang === "si" ? "විමර්ශන විභාග දිනය නියම කරන ලදී." : t("presetHearingScheduled", "Inquiry hearing scheduled.") },
                          { label: lang === "si" ? "+ සාක්ෂි සමාලෝචනය" : "+ Evidence Reviewed", val: lang === "si" ? "සාක්ෂි සහ ලේඛන සමාලෝචනය කරන ලදී." : t("presetEvidenceReviewed", "Evidence & documentation reviewed.") },
                          { label: lang === "si" ? "+ අතරමැදි වාර්තාව" : "+ Interlocutory Report", val: lang === "si" ? "අතරමැදි ප්‍රගති වාර්තාව ඉදිරිපත් කරන ලදී." : t("presetInterlocutoryReport", "Interlocutory status report submitted.") },
                          { label: lang === "si" ? "+ අවසන් වාර්තාව" : "+ Final Report Complete", val: lang === "si" ? "අවසාන විමර්ශන වාර්තාව සම්පූර්ණ කරන ලදී." : t("presetFinalReport", "Final investigation report completed.") },
                        ].map((chip, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleAddPresetNote(chip.val)}
                            style={{
                              padding: "5px 12px",
                              fontSize: "12px",
                              backgroundColor: "#f1f5f9",
                              color: "#334155",
                              border: "1px solid #cbd5e1",
                              borderRadius: "16px",
                              cursor: "pointer",
                              fontWeight: 600,
                              transition: "all 0.15s ease"
                            }}
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Progress Notes */}
                    <div className="form-field-group" style={{ marginTop: "16px" }}>
                      <label htmlFor="modalNotes" className="field-label" style={{ fontWeight: 600, color: "#334155" }}>
                        {lang === "si" ? "විමර්ශන සටහන සහ ප්‍රගති විස්තරය" : "Investigation Progress Notes & Steps Taken"} <span style={{ color: "#dc2626" }}>*</span>
                      </label>
                      <textarea
                        id="modalNotes"
                        rows={4}
                        value={investigationNotes}
                        onChange={(e) => setInvestigationNotes(e.target.value)}
                        placeholder={lang === "si" ? "වත්මන් විමර්ශන පියවර, විභාග දින, සාක්ෂි සටහන් ඇතුළත් කරන්න..." : "Enter current investigation actions taken, hearing dates, or report summaries..."}
                        className="field-input"
                        style={{ padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", width: "100%", resize: "vertical" }}
                      />
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", fontSize: "11px", color: "#64748b" }}>
                        <span>{lang === "si" ? "විභාග දින, සාක්ෂිකරුවන්ගේ තොරතුරු හෝ වාර්තා සාරාංශ ඇතුළත් කරන්න." : "Include hearing dates, witness references, or report summaries."}</span>
                        <span>{investigationNotes.length} chars</span>
                      </div>
                    </div>
                  </div>

                </div>
                </div>

                <footer className="modal-footer" style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                  <button 
                    type="button" 
                    className="btn-action-cancel"
                    onClick={() => setIsCaseModalOpen(false)}
                    style={{ padding: "10px 20px", borderRadius: "8px", backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1", color: "#475569", fontWeight: 600 }}
                  >
                    {t("cancelBtn")}
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="btn-new-letter"
                    style={{ padding: "10px 24px", borderRadius: "8px", backgroundColor: "#4f46e5", color: "#ffffff", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "8px" }}
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} />
                        <span>{lang === "si" ? "තොරතුරු සුරකින්න" : "Save Progress Details"}</span>
                      </>
                    )}
                  </button>
                </footer>
              </form>
            )}

          </div>
        </div>
      )}

      {/* ==================== OFFICER REGISTER/EDIT MODAL ==================== */}
      {isOfficerModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="officer-modal-title" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="modal-content-wrapper premium-modal" style={{ maxWidth: "780px", width: "95%", maxHeight: "92vh", borderRadius: "16px", overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)", display: "flex", flexDirection: "column" }}>
            
            {/* Modal Header */}
            <header className="modal-header" style={{ padding: "14px 20px", backgroundColor: "#1e1b4b", color: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <UserPlus size={20} style={{ color: "#818cf8" }} />
                </div>
                <div>
                  <h3 id="officer-modal-title" className="modal-title" style={{ color: "#ffffff", margin: 0, fontSize: "16px", fontWeight: 700 }}>
                    {isOfficerEditMode 
                      ? (lang === "si" ? "නිලධාරී තොරතුරු සංස්කරණය" : "Edit Investigation Officer") 
                      : (lang === "si" ? "නව විමර්ශන නිලධාරී ලියාපදිංචිය" : "Register Investigation Officer")}
                  </h3>
                  <p style={{ margin: 0, fontSize: "11px", color: "#cbd5e1" }}>
                    {lang === "si" ? "පහත තොරතුරු සම්පූර්ණ කර පද්ධතියට එක් කරන්න" : "Fill out officer credentials & school details below"}
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                className="modal-close-btn"
                onClick={() => setIsOfficerModalOpen(false)}
                aria-label="Close modal"
                style={{ color: "#ffffff", backgroundColor: "rgba(255,255,255,0.1)", border: "none", padding: "6px", borderRadius: "50%", cursor: "pointer" }}
              >
                <X size={16} />
              </button>
            </header>

            <form onSubmit={handleSaveOfficer} style={{ padding: "16px 20px", backgroundColor: "#ffffff", display: "flex", flexDirection: "column", overflowY: "auto" }}>
              
              {/* Dynamic Live Preview Header Banner */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "#f8fafc", padding: "10px 14px", borderRadius: "10px", border: "1px solid #e2e8f0", marginBottom: "14px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: officerRoleTypeForm === "Chairman" ? "#d97706" : "#4f46e5", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "15px", flexShrink: 0 }}>
                  {getInitials(officerNameForm)}
                </div>
                <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "14px", marginRight: "8px" }}>
                      {officerNameForm || (lang === "si" ? "නව නිලධාරියාගේ නම" : "New Officer Name")}
                    </span>
                    <span style={{ fontSize: "11px", backgroundColor: officerRoleTypeForm === "Chairman" ? "#fef3c7" : "#e0e7ff", color: officerRoleTypeForm === "Chairman" ? "#92400e" : "#3730a3", padding: "2px 8px", borderRadius: "12px", fontWeight: 700 }}>
                      {officerRoleTypeForm}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "10px", fontSize: "12px", color: "#64748b" }}>
                    <span>NIC: <strong style={{ color: "#334155" }}>{officerNicForm || "N/A"}</strong></span>
                    <span>•</span>
                    <span>Status: <strong style={{ color: officerStatusForm === "Active" ? "#16a34a" : "#dc2626" }}>{officerStatusForm}</strong></span>
                  </div>
                </div>
              </div>

              {/* Side-by-Side 2-Column Main Form Grid (NO SCROLL NEEDED) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", alignItems: "start" }}>
                
                {/* LEFT COLUMN: Basic Information */}
                <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <h4 style={{ fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                    <User size={14} style={{ color: "#4f46e5" }} />
                    {lang === "si" ? "1. මූලික තොරතුරු" : "1. Basic Credentials"}
                  </h4>

                  {/* Officer Name */}
                  <div className="form-field-group">
                    <label htmlFor="formOfficerName" className="field-label" style={{ fontWeight: 600, color: "#334155", fontSize: "12px" }}>
                      {lang === "si" ? "නිලධාරියාගේ නම" : "Officer Name"} <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <input
                      id="formOfficerName"
                      type="text"
                      value={officerNameForm}
                      onChange={(e) => setOfficerNameForm(e.target.value)}
                      placeholder="e.g., Ranjith Bandara"
                      className={`field-input${officerErrors.name ? " error" : ""}`}
                      style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", width: "100%", fontSize: "13px" }}
                    />
                    {officerErrors.name && <span style={{ color: "#ef4444", fontSize: "11px", marginTop: "2px", display: "block" }}>{officerErrors.name}</span>}
                  </div>

                  {/* NIC No & Role Grid Row */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    {/* NIC No */}
                    <div className="form-field-group">
                      <label htmlFor="formOfficerNic" className="field-label" style={{ fontWeight: 600, color: "#334155", fontSize: "12px" }}>
                        {lang === "si" ? "NIC අංකය" : "NIC No"} <span style={{ color: "#dc2626" }}>*</span>
                      </label>
                      <input
                        id="formOfficerNic"
                        type="text"
                        value={officerNicForm}
                        onChange={(e) => setOfficerNicForm(e.target.value)}
                        placeholder="e.g., 198512345678"
                        className={`field-input${officerErrors.nic ? " error" : ""}`}
                        style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", width: "100%", fontSize: "13px" }}
                      />
                      {officerErrors.nic && <span style={{ color: "#ef4444", fontSize: "11px", marginTop: "2px", display: "block" }}>{officerErrors.nic}</span>}
                    </div>

                    {/* Role / Position */}
                    <div className="form-field-group">
                      <label htmlFor="formOfficerRoleType" className="field-label" style={{ fontWeight: 600, color: "#334155", fontSize: "12px" }}>
                        {lang === "si" ? "තනතුර (Role)" : "Role / Position"} <span style={{ color: "#dc2626" }}>*</span>
                      </label>
                      <select
                        id="formOfficerRoleType"
                        value={officerRoleTypeForm}
                        onChange={(e) => setOfficerRoleTypeForm(e.target.value as "Chairman" | "Member")}
                        className="field-select"
                        style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", width: "100%", backgroundColor: "#ffffff", fontSize: "13px", fontWeight: 600 }}
                      >
                        <option value="Chairman">Chairman</option>
                        <option value="Member">Member</option>
                      </select>
                    </div>
                  </div>

                  {/* Email & Status Grid Row */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    {/* Email Address */}
                    <div className="form-field-group">
                      <label htmlFor="formOfficerEmail" className="field-label" style={{ fontWeight: 600, color: "#334155", fontSize: "12px" }}>
                        {lang === "si" ? "ඊමේල් ලිපිනය" : "Email Address"} <span style={{ color: "#dc2626" }}>*</span>
                      </label>
                      <input
                        id="formOfficerEmail"
                        type="text"
                        value={officerEmailForm}
                        onChange={(e) => setOfficerEmailForm(e.target.value)}
                        placeholder="ranjith@moe.gov.lk"
                        className={`field-input${officerErrors.email ? " error" : ""}`}
                        disabled={isOfficerEditMode}
                        style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", width: "100%", fontSize: "13px" }}
                      />
                      {officerErrors.email && <span style={{ color: "#ef4444", fontSize: "11px", marginTop: "2px", display: "block" }}>{officerErrors.email}</span>}
                    </div>

                    {/* Status */}
                    <div className="form-field-group">
                      <label htmlFor="formOfficerStatus" className="field-label" style={{ fontWeight: 600, color: "#334155", fontSize: "12px" }}>
                        {lang === "si" ? "තත්ත්වය" : "Status"}
                      </label>
                      <select
                        id="formOfficerStatus"
                        value={officerStatusForm}
                        onChange={(e) => setOfficerStatusForm(e.target.value as any)}
                        className="field-select"
                        style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", width: "100%", backgroundColor: "#ffffff", fontSize: "13px" }}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                </div>

                {/* RIGHT COLUMN: Educational & School Details */}
                <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <h4 style={{ fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                    <GraduationCap size={15} style={{ color: "#0284c7" }} />
                    {lang === "si" ? "2. අධ්‍යාපනික සහ පාසල් තොරතුරු" : "2. School Background"}
                  </h4>

                  {/* Studied Schools */}
                  <div className="form-field-group">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <label className="field-label" style={{ fontWeight: 600, color: "#334155", fontSize: "12px", margin: 0 }}>
                        {lang === "si" ? "ඉගෙනුම ලැබූ පාසල්" : "Studied Schools"}
                      </label>
                      <span style={{ fontSize: "10px", color: "#0284c7", fontWeight: 700, backgroundColor: "#e0f2fe", padding: "1px 6px", borderRadius: "8px" }}>
                        {studiedSchoolsForm.length} added
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <input
                        type="text"
                        value={newStudiedSchoolInput}
                        onChange={(e) => setNewStudiedSchoolInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddStudiedSchool();
                          }
                        }}
                        placeholder={lang === "si" ? "පාසල + Enter" : "School name & Enter..."}
                        style={{ padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", flex: 1, fontSize: "12px" }}
                      />
                      <button
                        type="button"
                        onClick={handleAddStudiedSchool}
                        style={{ padding: "7px 12px", borderRadius: "6px", backgroundColor: "#0284c7", color: "#ffffff", border: "none", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}
                      >
                        + Add
                      </button>
                    </div>

                    {studiedSchoolsForm.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", backgroundColor: "#f8fafc", padding: "6px 8px", borderRadius: "6px", border: "1px solid #e2e8f0", marginTop: "6px", maxHeight: "54px", overflowY: "auto" }}>
                        {studiedSchoolsForm.map((school, index) => (
                          <span key={index} style={{ display: "inline-flex", alignItems: "center", gap: "4px", backgroundColor: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600 }}>
                            {school}
                            <button
                              type="button"
                              onClick={() => handleRemoveStudiedSchool(index)}
                              style={{ background: "none", border: "none", color: "#0369a1", cursor: "pointer", display: "flex", padding: 0 }}
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginTop: "3px", fontStyle: "italic" }}>
                        No schools added yet.
                      </span>
                    )}
                  </div>

                  {/* Children's Schools */}
                  <div className="form-field-group">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <label className="field-label" style={{ fontWeight: 600, color: "#334155", fontSize: "12px", margin: 0 }}>
                        {lang === "si" ? "දරුවන්ගේ පාසල්" : "Children's Schools"}
                      </label>
                      <span style={{ fontSize: "10px", color: "#d97706", fontWeight: 700, backgroundColor: "#fef3c7", padding: "1px 6px", borderRadius: "8px" }}>
                        {childrenSchoolsForm.length} added
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <input
                        type="text"
                        value={newChildrenSchoolInput}
                        onChange={(e) => setNewChildrenSchoolInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddChildrenSchool();
                          }
                        }}
                        placeholder={lang === "si" ? "පාසල + Enter" : "School name & Enter..."}
                        style={{ padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", flex: 1, fontSize: "12px" }}
                      />
                      <button
                        type="button"
                        onClick={handleAddChildrenSchool}
                        style={{ padding: "7px 12px", borderRadius: "6px", backgroundColor: "#d97706", color: "#ffffff", border: "none", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}
                      >
                        + Add
                      </button>
                    </div>

                    {childrenSchoolsForm.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", backgroundColor: "#f8fafc", padding: "6px 8px", borderRadius: "6px", border: "1px solid #e2e8f0", marginTop: "6px", maxHeight: "54px", overflowY: "auto" }}>
                        {childrenSchoolsForm.map((school, index) => (
                          <span key={index} style={{ display: "inline-flex", alignItems: "center", gap: "4px", backgroundColor: "#fef3c7", color: "#b45309", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600 }}>
                            {school}
                            <button
                              type="button"
                              onClick={() => handleRemoveChildrenSchool(index)}
                              style={{ background: "none", border: "none", color: "#b45309", cursor: "pointer", display: "flex", padding: 0 }}
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginTop: "3px", fontStyle: "italic" }}>
                        No schools added yet.
                      </span>
                    )}
                  </div>

                </div>

              </div>

              {/* Form Footer Buttons */}
              <footer className="modal-footer" style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button 
                  type="button" 
                  className="btn-action-cancel"
                  onClick={() => setIsOfficerModalOpen(false)}
                  style={{ padding: "8px 18px", borderRadius: "6px", backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1", color: "#475569", fontWeight: 600, fontSize: "13px" }}
                >
                  {t("cancelBtn")}
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="btn-new-letter"
                  style={{ padding: "8px 24px", borderRadius: "6px", backgroundColor: "#4f46e5", color: "#ffffff", fontWeight: 600, fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px", boxShadow: "0 2px 4px rgba(79,70,229,0.2)" }}
                >
                  {isSaving ? "Saving..." : (lang === "si" ? "සුරකින්න" : "Save Officer")}
                </button>
              </footer>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
