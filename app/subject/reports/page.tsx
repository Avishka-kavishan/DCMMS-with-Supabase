"use client";

import "../../../i18n";
import "../../daily-mail/daily-mail.css";
import "../../dashboard-common.css";
import "../subject.css";
import "./reports.css";
import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Sidebar } from "@/components/Sidebar";
import { SiteFooter } from "@/components/SiteFooter";
import { getCurrentProfile, signOut, UserProfile } from "@/lib/auth";
import { getSubjectReportsCategorizedLettersServer } from "@/lib/db-actions";
import {
  Shield,
  Mail,
  Calendar as CalendarIcon,
  Search,
  Filter,
  Eye,
  Edit3,
  Printer,
  RefreshCw,
  FileText,
  User,
  Building,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  ChevronRight,
  ArrowRight,
  Inbox,
  LayoutGrid,
  Table as TableIcon,
  Tag,
  MapPin,
  HelpCircle,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Download,
  ShieldAlert,
  Scale
} from "lucide-react";

interface LetterReportItem {
  id: string;
  ref_number: string;
  letter_no: string;
  subject_file_no: string;
  file_name: "discipline" | "mail" | "inquiry" | string;
  nature_of_letter?: string;
  future_action: string;
  date_prepared_and_submitted_for_signature: string | null;

  // Complaint & Letter Details
  subject: string;
  classification_of_complaint_letter: string;
  name_of_the_presenting_the_complain: string;
  address_of_the_person_presenting_the_complaint: string;
  received_date: string | null;
  letter_date: string | null;
  priority: string;
  mode_of_receipt: string;
  add_sec_instructions: string;
  status: string;

  // Accused Officer Details
  accused_officer_name: string;
  accused_designation: string;
  nic_no: string;
  date_of_birth: string | null;
  appointment_date: string | null;
  officer_address: string;
  accused_officers?: any[];

  // Accused School / Institute Details
  accused_school_name: string;
  school_address: string;
  province: string;
  district: string;
  zone: string;

  // Disciplinary Inquiry Details
  inquiry_details?: {
    is_formal_inspection?: boolean;
    chairman?: { name: string; position?: string; email?: string };
    members?: Array<{ name: string; position?: string; email?: string }>;
    appointment_letter_date?: string;
    report_due_date?: string;
    recommendation_report?: string;
    recommendation_approved?: string;
    disciplinary_order?: string;
    approval_secretary_status?: string;
    approval_secretary_details?: string;
    order_start_date?: string;
    order_end_date?: string;
    inv_officer_name?: string;
    inv_officer_designation?: string;
    complaint_officer_name?: string;
    maintenance_officer_name?: string;
  } | null;

  created_at: string | null;
  updated_at: string | null;
}

export default function SubjectOfficerReportsPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const lang = i18n.language;

  // Sidebar and UI states
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");

  // Tab state: "discipline" | "mail" | "inquiries"
  const [activeTab, setActiveTab] = useState<"discipline" | "mail" | "inquiries">("discipline");
  // Default view is TABLE as requested
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Expanded row ID for inline drawer
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Data states
  const [disciplineLetters, setDisciplineLetters] = useState<LetterReportItem[]>([]);
  const [mailLetters, setMailLetters] = useState<LetterReportItem[]>([]);
  const [disciplinaryInquiryLetters, setDisciplinaryInquiryLetters] = useState<LetterReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedActionFilter, setSelectedActionFilter] = useState("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState("all");

  // Detail Modal state
  const [selectedLetter, setSelectedLetter] = useState<LetterReportItem | null>(null);

  // Load user profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const prof = await getCurrentProfile();
        setProfile(prof);
      } catch (e) {
        console.error("Error loading profile:", e);
      }
    };
    loadProfile();
  }, []);

  // Fetch report letters from PostgreSQL and merge with localStorage fallbacks
  const fetchLetters = async () => {
    try {
      setLoading(true);
      const res = await getSubjectReportsCategorizedLettersServer();

      let discList: LetterReportItem[] = [];
      let mailList: LetterReportItem[] = [];
      let inqList: LetterReportItem[] = [];

      if (res && res.success) {
        discList = res.disciplineLetters || [];
        mailList = res.mailLetters || [];
        inqList = res.disciplinaryInquiries || res.inquiryLetters || [];
      }

      // Check client-side localStorage fallbacks to capture offline/unsynced entries
      if (typeof window !== "undefined") {
        try {
          const storedCases = localStorage.getItem("dcmms_cases");
          const storedActions = localStorage.getItem("dcmms_new_letter_current_case");
          const storedConcerned = localStorage.getItem("dcmms_officer_concerned");

          const localCases = storedCases ? JSON.parse(storedCases) : [];
          const localActions = storedActions ? JSON.parse(storedActions) : [];
          const localConcernedMap = storedConcerned ? JSON.parse(storedConcerned) : {};

          const seenRefs = new Set([
            ...discList.map((d) => d.ref_number.toLowerCase()),
            ...mailList.map((m) => m.ref_number.toLowerCase()),
            ...inqList.map((i) => i.ref_number.toLowerCase()),
          ]);

          const checkIsLocalInquiry = (actOrCase: any) => {
            const rawNature = String(
              actOrCase.nature_of_letter ||
              actOrCase.nature ||
              actOrCase.letterType ||
              actOrCase.letter_type ||
              actOrCase.type ||
              actOrCase.natureOfLetter ||
              ""
            ).trim().toLowerCase();
            if (rawNature === "request" || rawNature === "ඉල්ලීම" || rawNature === "கோரிக்கை") return false;
            if (rawNature === "complaint" || rawNature.includes("complaint") || rawNature.includes("පැමිණිලි") || rawNature.includes("முறைப்பாடு")) return false;
            if (rawNature.includes("answer") || rawNature.includes("පිළිතුරු") || rawNature.includes("பதில்")) return false;
            if (
              rawNature === "inquiry" ||
              rawNature.startsWith("inquiry") ||
              rawNature === "inquiry / investigation" ||
              rawNature === "disciplinary inquiry" ||
              rawNature.includes("inquiry") ||
              rawNature.includes("විමසුම්") ||
              rawNature.includes("පරීක්ෂණ") ||
              rawNature.includes("විමර්ශන") ||
              rawNature.includes("விசாரணை")
            ) {
              return true;
            }
            const rawFn = String(actOrCase.fileName || actOrCase.file_name || "").trim().toLowerCase();
            return rawFn === "inquiry" || rawFn === "disciplinary_inquiry";
          };

          // Merge any cases from localActions that might not be in DB yet
          if (Array.isArray(localActions)) {
            localActions.forEach((act: any) => {
              const cNo = String(act.caseNo || "").trim();
              if (cNo && !seenRefs.has(cNo.toLowerCase())) {
                seenRefs.add(cNo.toLowerCase());
                const con = localConcernedMap[cNo] || {};
                const firstPerson = con.persons && con.persons.length > 0 ? con.persons[0] : null;

                const rawFn = String(act.fileName || act.file_name || "discipline").toLowerCase();
                const isMail = rawFn === "mail" || rawFn.includes("mail") || rawFn.includes("තැපැල්");
                const resolvedNature = String(act.nature_of_letter || act.nature || act.letterType || act.type || "").trim();

                const item: LetterReportItem = {
                  id: act.id || `local-${cNo}`,
                  ref_number: cNo,
                  letter_no: cNo,
                  subject_file_no: act.specialNotes || cNo,
                  file_name: isMail ? "mail" : "discipline",
                  nature_of_letter: resolvedNature,
                  future_action: act.upcomingAction || act.reportState || "",
                  date_prepared_and_submitted_for_signature: act.receivedDate || "",
                  subject: act.description || `Case ${cNo}`,
                  classification_of_complaint_letter: "nominal",
                  name_of_the_presenting_the_complain: "Complainant",
                  address_of_the_person_presenting_the_complaint: con.schoolAddress || "",
                  received_date: act.receivedDate || "",
                  letter_date: act.receivedDate || "",
                  priority: "medium",
                  mode_of_receipt: "By Hand",
                  add_sec_instructions: "",
                  status: act.reportState || "In Progress",
                  accused_officer_name: con.officerName || firstPerson?.name || "",
                  accused_designation: con.position || firstPerson?.position || "",
                  nic_no: con.nic || firstPerson?.nic || "",
                  date_of_birth: con.dob || firstPerson?.dob || "",
                  appointment_date: con.appointmentDate || firstPerson?.appointmentDate || "",
                  officer_address: con.address || firstPerson?.address || "",
                  accused_officers: con.persons || [],
                  accused_school_name: con.instituteName || "",
                  school_address: con.schoolAddress || "",
                  province: "",
                  district: "",
                  zone: "",
                  created_at: new Date().toISOString().split("T")[0],
                  updated_at: new Date().toISOString().split("T")[0],
                };

                if (isMail) {
                  mailList.push(item);
                } else {
                  discList.push(item);
                }

                if (checkIsLocalInquiry(act)) {
                  inqList.push(item);
                }
              }
            });
          }

          // Merge any cases from localCases
          if (Array.isArray(localCases)) {
            localCases.forEach((c: any) => {
              const cNo = String(c.caseNo || c.refNo || "").trim();
              if (cNo && !seenRefs.has(cNo.toLowerCase())) {
                seenRefs.add(cNo.toLowerCase());
                const rawFn = String(c.fileName || c.file_name || "discipline").toLowerCase();
                const isMail = rawFn === "mail" || rawFn.includes("mail") || rawFn.includes("තැපැල්");
                const resolvedNature = String(c.nature_of_letter || c.nature || c.letterType || c.type || "").trim();

                const item: LetterReportItem = {
                  id: c.id || `local-case-${cNo}`,
                  ref_number: cNo,
                  letter_no: c.letterNo || cNo,
                  subject_file_no: cNo,
                  file_name: isMail ? "mail" : "discipline",
                  nature_of_letter: resolvedNature,
                  future_action: c.upcomingAction || "",
                  date_prepared_and_submitted_for_signature: c.assignedDate || c.receivedDate || "",
                  subject: c.subject || `Case ${cNo}`,
                  classification_of_complaint_letter: c.classification || "nominal",
                  name_of_the_presenting_the_complain: c.sender || "Complainant",
                  address_of_the_person_presenting_the_complaint: c.instituteName || "",
                  received_date: c.receivedDate || "",
                  letter_date: c.letterDate || c.receivedDate || "",
                  priority: (c.priority || "medium").toLowerCase(),
                  mode_of_receipt: "Normal Post",
                  add_sec_instructions: c.directives || "",
                  status: c.status || "In Progress",
                  accused_officer_name: c.accusedName || "",
                  accused_designation: c.accusedDesignation || "",
                  nic_no: "",
                  date_of_birth: "",
                  appointment_date: "",
                  officer_address: "",
                  accused_officers: [],
                  accused_school_name: c.schoolName || c.instituteName || "",
                  school_address: "",
                  province: "",
                  district: "",
                  zone: "",
                  created_at: c.createdAt || new Date().toISOString().split("T")[0],
                  updated_at: new Date().toISOString().split("T")[0],
                };

                if (isMail) {
                  mailList.push(item);
                } else {
                  discList.push(item);
                }

                if (checkIsLocalInquiry(c)) {
                  inqList.push(item);
                }
              }
            });
          }
        } catch (e) {
          console.warn("Local storage fallback sync warning:", e);
        }
      }

      setDisciplineLetters(discList);
      setMailLetters(mailList);
      setDisciplinaryInquiryLetters(inqList);
    } catch (err) {
      console.error("Error fetching report letters:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLetters();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchLetters();
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut();
    router.push("/login");
  };

  // Switch tabs and reset pagination & row expansion
  const handleTabChange = (tab: "discipline" | "mail" | "inquiries") => {
    setActiveTab(tab);
    setCurrentPage(1);
    setExpandedRowId(null);
  };

  // Get active list based on selected tab (Discipline vs Mail vs Disciplinary inquiries)
  const currentLettersList = useMemo(() => {
    if (activeTab === "mail") return mailLetters;
    if (activeTab === "inquiries") return disciplinaryInquiryLetters;
    return disciplineLetters;
  }, [activeTab, disciplineLetters, mailLetters, disciplinaryInquiryLetters]);

  // Filtered letters based on search and dropdown filters
  const filteredLetters = useMemo(() => {
    return currentLettersList.filter((item) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesRef = item.ref_number.toLowerCase().includes(query);
        const matchesFileNo = item.subject_file_no.toLowerCase().includes(query);
        const matchesSubject = item.subject.toLowerCase().includes(query);
        const matchesComplainant = item.name_of_the_presenting_the_complain.toLowerCase().includes(query);
        const matchesOfficer = item.accused_officer_name.toLowerCase().includes(query);
        const matchesSchool = item.accused_school_name.toLowerCase().includes(query);
        const matchesAction = item.future_action.toLowerCase().includes(query);

        if (!matchesRef && !matchesFileNo && !matchesSubject && !matchesComplainant && !matchesOfficer && !matchesSchool && !matchesAction) {
          return false;
        }
      }

      // 2. Action Filter
      if (selectedActionFilter !== "all") {
        const act = (item.future_action || "").toLowerCase();
        if (selectedActionFilter === "inspection") {
          const isInsp = act.includes("inspection") || act.includes("inquiry") || act.includes("පරීක්ෂණ") || act.includes("පරීක්ශන");
          if (!isInsp) return false;
        } else if (selectedActionFilter === "investigation") {
          const isInv = act.includes("investigation") || act.includes("විමර්ශන") || act.includes("මූලික");
          if (!isInv) return false;
        } else if (selectedActionFilter === "finalize") {
          const isFin = act.includes("finalize") || act.includes("අවසන්");
          if (!isFin) return false;
        }
      }

      // 3. Status Filter
      if (selectedStatusFilter !== "all") {
        const st = (item.status || "").toLowerCase();
        if (selectedStatusFilter === "closed" && !st.includes("closed")) return false;
        if (selectedStatusFilter === "in_progress" && !st.includes("progress")) return false;
        if (selectedStatusFilter === "inquiry" && (!st.includes("inquiry") && !st.includes("inspection"))) return false;
      }

      // 4. Priority Filter
      if (selectedPriorityFilter !== "all") {
        if (item.priority !== selectedPriorityFilter) return false;
      }

      return true;
    });
  }, [currentLettersList, searchQuery, selectedActionFilter, selectedStatusFilter, selectedPriorityFilter]);

  // Paginated letters for Table view
  const paginatedLetters = useMemo(() => {
    if (pageSize === -1) return filteredLetters;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredLetters.slice(startIndex, startIndex + pageSize);
  }, [filteredLetters, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    if (pageSize === -1) return 1;
    return Math.max(1, Math.ceil(filteredLetters.length / pageSize));
  }, [filteredLetters.length, pageSize]);

  // Stats calculation for the currently active tab
  const stats = useMemo(() => {
    const total = currentLettersList.length;
    let inProgress = 0;
    let inquiries = 0;
    let closed = 0;

    currentLettersList.forEach((item) => {
      const st = (item.status || "").toLowerCase();
      const act = (item.future_action || "").toLowerCase();

      if (st.includes("closed") || act.includes("finalize") || act.includes("අවසන්")) {
        closed++;
      } else if (st.includes("inquiry") || act.includes("inspection") || act.includes("inquiry") || act.includes("පරීක්ෂණ")) {
        inquiries++;
      } else {
        inProgress++;
      }
    });

    return { total, inProgress, inquiries, closed };
  }, [currentLettersList]);

  // Toggle inline drawer for a specific row
  const toggleRowExpansion = (refId: string) => {
    setExpandedRowId((prev) => (prev === refId ? null : refId));
  };

  // CSV Export
  const handleExportCSV = () => {
    if (filteredLetters.length === 0) return;
    const headers = [
      "Letter No",
      "Subject File No",
      "File Category",
      "Nature of Letter",
      "Future Action",
      "Date Prepared & Submitted",
      "Subject / Matter",
      "Classification",
      "Complainant Name",
      "Complainant Address",
      "Received Date",
      "Priority",
      "Accused Officer Name",
      "Position",
      "NIC No",
      "School Name",
      "School Address",
      "Status",
      "Inquiry Chairman",
      "Inquiry Committee Members",
      "Inquiry Report Due Date",
      "Disciplinary Order"
    ];

    const rows = filteredLetters.map((l) => [
      `"${l.ref_number || ""}"`,
      `"${l.subject_file_no || ""}"`,
      `"${l.file_name || ""}"`,
      `"${l.nature_of_letter || ""}"`,
      `"${(l.future_action || "").replace(/"/g, '""')}"`,
      `"${l.date_prepared_and_submitted_for_signature || ""}"`,
      `"${(l.subject || "").replace(/"/g, '""')}"`,
      `"${l.classification_of_complaint_letter || ""}"`,
      `"${(l.name_of_the_presenting_the_complain || "").replace(/"/g, '""')}"`,
      `"${(l.address_of_the_person_presenting_the_complaint || "").replace(/"/g, '""')}"`,
      `"${l.received_date || ""}"`,
      `"${l.priority || ""}"`,
      `"${(l.accused_officer_name || "").replace(/"/g, '""')}"`,
      `"${(l.accused_designation || "").replace(/"/g, '""')}"`,
      `"${l.nic_no || ""}"`,
      `"${(l.accused_school_name || "").replace(/"/g, '""')}"`,
      `"${(l.school_address || "").replace(/"/g, '""')}"`,
      `"${l.status || ""}"`,
      `"${(l.inquiry_details?.chairman?.name || "").replace(/"/g, '""')}"`,
      `"${((l.inquiry_details?.members || []).map((m: any) => m.name).join("; ") || "").replace(/"/g, '""')}"`,
      `"${l.inquiry_details?.report_due_date || ""}"`,
      `"${(l.inquiry_details?.disciplinary_order || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DCMMS_Report_${activeTab}_Letters_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`subject-dashboard-container font-scale-${fontScale}`} style={{ minHeight: "100vh", display: "flex", flexDirection: "column", width: "100%" }}>
      {/* Sidebar Navigation */}
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
        role="subject"
      />

      <div className="dashboard-layout" style={{ flex: 1, width: "100%" }}>
        {/* Main Content Area - Full Screen Width */}
        <main id="reports-main-content" className="dashboard-content" style={{ width: "100%", maxWidth: "100%", flex: 1, display: "flex", flexDirection: "column", padding: "24px 32px" }}>
          {/* Top App Bar Header Matching Other Pages */}
          <header className="dashboard-header" style={{ width: "100%" }}>
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
                  {lang === "si" ? "විෂය භාර නිලධාරී" : lang === "ta" ? "பாடப் பொறுப்பு அதிகாரி" : "Subject Officer"}
                </h2>
                <p className="dashboard-main-subtitle">
                  {lang === "si"
                    ? "වාර්තා සහ විශ්ලේෂණ සේවා අවකාශය"
                    : lang === "ta"
                    ? "அறிக்கைகள் மற்றும் பகுப்பாய்வு பணியிடம்"
                    : "Reports & Analytics Workspace"}
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
                    aria-label={t("fontSmall", "Small")}
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
                    aria-label={t("fontMedium", "Medium")}
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
                    aria-label={t("fontLarge", "Large")}
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

          {/* Full Screen Page Content Container */}
          <div style={{ width: "100%", flex: 1, display: "flex", flexDirection: "column", marginTop: "20px" }}>
            
            {/* Top Header Actions Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
              {/* Navigation Tab Bar (Discipline / Mail / Disciplinary inquiries) with Live Counts */}
              <div className="navigation-tab-list" style={{ margin: 0 }}>
                <button
                  type="button"
                  className={`nav-tab-btn${activeTab === "discipline" ? " active" : ""}`}
                  onClick={() => handleTabChange("discipline")}
                  id="tab-discipline"
                  aria-selected={activeTab === "discipline"}
                >
                  <Shield className="tab-icon" size={18} />
                  <span>{lang === "si" ? "විනය" : lang === "ta" ? "ஒழுக்கம்" : "Discipline"}</span>
                  <span className="tab-count-badge">{disciplineLetters.length}</span>
                </button>

                <button
                  type="button"
                  className={`nav-tab-btn${activeTab === "mail" ? " active" : ""}`}
                  onClick={() => handleTabChange("mail")}
                  id="tab-mail"
                  aria-selected={activeTab === "mail"}
                >
                  <Mail className="tab-icon" size={18} />
                  <span>{lang === "si" ? "තැපැල්" : lang === "ta" ? "அஞ்சல்" : "Mail"}</span>
                  <span className="tab-count-badge">{mailLetters.length}</span>
                </button>

                <button
                  type="button"
                  className={`nav-tab-btn${activeTab === "inquiries" ? " active" : ""}`}
                  onClick={() => handleTabChange("inquiries")}
                  id="tab-disciplinary-inquiries"
                  aria-selected={activeTab === "inquiries"}
                >
                  <ShieldAlert className="tab-icon" size={18} />
                  <span>{lang === "si" ? "විනය විමසුම්" : lang === "ta" ? "ஒழுங்கு விசாரණைகள்" : "Disciplinary inquiries"}</span>
                  <span
                    className="tab-count-badge"
                    style={activeTab === "inquiries" ? { backgroundColor: "#ea580c" } : undefined}
                  >
                    {disciplinaryInquiryLetters.length}
                  </span>
                </button>
              </div>

              {/* Right View Controls & Actions */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <div className="view-mode-toggle" role="group" aria-label="View Mode">
                  <button
                    type="button"
                    className={`view-mode-btn${viewMode === "table" ? " active" : ""}`}
                    onClick={() => setViewMode("table")}
                    title="Table View"
                  >
                    <TableIcon size={15} />
                    <span>{lang === "si" ? "වගුව" : lang === "ta" ? "அட்டவணை" : "Table"}</span>
                  </button>
                  <button
                    type="button"
                    className={`view-mode-btn${viewMode === "cards" ? " active" : ""}`}
                    onClick={() => setViewMode("cards")}
                    title="Cards Detail View"
                  >
                    <LayoutGrid size={15} />
                    <span>{lang === "si" ? "කාඩ්පත්" : lang === "ta" ? "அட்டைகள்" : "Cards"}</span>
                  </button>
                </div>

                <button
                  type="button"
                  className="btn-card-action btn-edit-case"
                  onClick={handleExportCSV}
                  disabled={filteredLetters.length === 0}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "38px" }}
                  title="Export to CSV"
                >
                  <Download size={15} />
                  <span>{lang === "si" ? "CSV බාගන්න" : "Export CSV"}</span>
                </button>

                <button
                  type="button"
                  className="btn-card-action btn-print-mini"
                  onClick={() => window.print()}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "38px" }}
                  title="Print Report"
                >
                  <Printer size={15} />
                  <span>{lang === "si" ? "මුද්‍රණය" : lang === "ta" ? "அச்சிடுக" : "Print"}</span>
                </button>

                <button
                  type="button"
                  className="btn-card-action btn-edit-case"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "38px" }}
                  title="Refresh Records"
                >
                  <RefreshCw size={15} className={isRefreshing ? "animate-spin" : ""} />
                  <span>{lang === "si" ? "නැවුම් කරන්න" : lang === "ta" ? "புதுப்பி" : "Refresh"}</span>
                </button>
              </div>
            </div>

            {/* Statistics Bar for the Selected Category */}
            <div className="reports-stats-grid" style={{ marginBottom: "20px" }}>
              <div className="report-stat-card">
                <div className="report-stat-top">
                  <div className={`report-stat-icon-wrapper ${activeTab === "discipline" ? "blue" : activeTab === "mail" ? "purple" : "orange"}`}>
                    {activeTab === "discipline" ? <Shield size={20} /> : activeTab === "mail" ? <Mail size={20} /> : <ShieldAlert size={20} />}
                  </div>
                  <span className={`category-header-pill ${activeTab}`}>
                    {activeTab === "discipline"
                      ? (lang === "si" ? "විනය" : "Discipline")
                      : activeTab === "mail"
                      ? (lang === "si" ? "තැපැල්" : "Mail")
                      : (lang === "si" ? "විනය විමසුම්" : lang === "ta" ? "ஒழுங்கு விசாரණைகள்" : "Disciplinary Inquiries")}
                  </span>
                </div>
                <div>
                  <div className="report-stat-value">{stats.total}</div>
                  <div className="report-stat-label">
                    {lang === "si"
                      ? (activeTab === "discipline" ? "මුළු විනය ලිපි" : activeTab === "mail" ? "මුළු තැපැල් ලිපි" : "මුළු විනය විමසුම්")
                      : lang === "ta"
                      ? (activeTab === "discipline" ? "மொத்த ஒழுக்க கடிதங்கள்" : activeTab === "mail" ? "மொத்த அஞ்சல் கடிதங்கள்" : "மொத்த ஒழுங்கு விசாரණைகள்")
                      : `Total ${activeTab === "discipline" ? "Discipline" : activeTab === "mail" ? "Mail" : "Disciplinary Inquiry"} Letters`}
                  </div>
                </div>
              </div>

              <div className="report-stat-card">
                <div className="report-stat-top">
                  <div className="report-stat-icon-wrapper orange">
                    <Clock size={20} />
                  </div>
                  <span className="report-stat-badge orange">{lang === "si" ? "ක්‍රියාත්මක" : "Active"}</span>
                </div>
                <div>
                  <div className="report-stat-value">{stats.inProgress}</div>
                  <div className="report-stat-label">
                    {lang === "si" ? "සිදුවෙමින් පවතින විමර්ශන" : lang === "ta" ? "நடைபெறும் விசாரணைகள்" : "In Progress Cases"}
                  </div>
                </div>
              </div>

              <div className="report-stat-card">
                <div className="report-stat-top">
                  <div className="report-stat-icon-wrapper yellow">
                    <AlertTriangle size={20} />
                  </div>
                  <span className="report-stat-badge yellow">{lang === "si" ? "පරීක්ෂණ" : "Inquiry"}</span>
                </div>
                <div>
                  <div className="report-stat-value">{stats.inquiries}</div>
                  <div className="report-stat-label">
                    {lang === "si" ? "පරීක්ෂණ / විමර්ශන පියවර" : lang === "ta" ? "விசாரணை நடவடிக்கைகள்" : "Inquiry / Inspection"}
                  </div>
                </div>
              </div>

              <div className="report-stat-card">
                <div className="report-stat-top">
                  <div className="report-stat-icon-wrapper green">
                    <CheckCircle size={20} />
                  </div>
                  <span className="report-stat-badge green">{lang === "si" ? "අවසන්" : "Closed"}</span>
                </div>
                <div>
                  <div className="report-stat-value">{stats.closed}</div>
                  <div className="report-stat-label">
                    {lang === "si" ? "අවසන් කරන ලද ගොනු" : lang === "ta" ? "முடிக்கப்பட்ட கோப்புகள்" : "Finalized / Closed Files"}
                  </div>
                </div>
              </div>
            </div>

            {/* Search and Filters Toolbar */}
            <div className="reports-filter-panel" style={{ marginBottom: "20px" }}>
              <div className="reports-filter-grid">
                {/* Search query input */}
                <div className="filter-group" style={{ gridColumn: "span 2" }}>
                  <label htmlFor="report-search-input">
                    {lang === "si" ? "ලිපි සොයන්න" : lang === "ta" ? "கடிதம் தேடு" : "Search Letters"}
                  </label>
                  <div className="report-search-wrapper">
                    <Search className="search-icon" size={16} />
                    <input
                      id="report-search-input"
                      type="text"
                      className="filter-control"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder={
                        lang === "si"
                          ? "ලිපි අංකය, විෂය ගොනු අංකය, නිලධාරියා, පාසල හෝ විෂය සොයන්න..."
                          : lang === "ta"
                          ? "கடித எண், கோப்பு எண், அதிகாரி, பாடசாலை தேடுக..."
                          : "Search by Letter No, File No, Officer Name, School, Subject..."
                      }
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setCurrentPage(1);
                        }}
                        style={{ position: "absolute", right: "10px", background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
                        title="Clear Search"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter by Future Action */}
                <div className="filter-group">
                  <label htmlFor="filter-action">
                    {lang === "si" ? "ඉදිරි ක්‍රියාමාර්ග" : lang === "ta" ? "எதிர்கால நடவடிக்கை" : "Future Action"}
                  </label>
                  <select
                    id="filter-action"
                    className="filter-control"
                    value={selectedActionFilter}
                    onChange={(e) => {
                      setSelectedActionFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="all">{lang === "si" ? "සියල්ල" : lang === "ta" ? "அனைத்தும்" : "All Actions"}</option>
                    <option value="inspection">
                      {lang === "si" ? "පරීක්ෂණයක් සිදු කිරීම" : lang === "ta" ? "ஆய்வு நடத்துதல்" : "Conduct an inspection"}
                    </option>
                    <option value="investigation">
                      {lang === "si" ? "මූලික විමර්ශනය" : lang === "ta" ? "ஆரம்ப விசாரணை" : "Initial investigation"}
                    </option>
                    <option value="finalize">
                      {lang === "si" ? "ගොනුව අවසන් කිරීම" : lang === "ta" ? "இறுதி செய்தல்" : "Finalize the file"}
                    </option>
                  </select>
                </div>

                {/* Filter by Status */}
                <div className="filter-group">
                  <label htmlFor="filter-status">
                    {lang === "si" ? "තත්ත්වය" : lang === "ta" ? "நிலை" : "Status"}
                  </label>
                  <select
                    id="filter-status"
                    className="filter-control"
                    value={selectedStatusFilter}
                    onChange={(e) => {
                      setSelectedStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="all">{lang === "si" ? "සියලු තත්ත්ව" : lang === "ta" ? "அனைத்து நிலைகள்" : "All Statuses"}</option>
                    <option value="in_progress">{lang === "si" ? "සිදුවෙමින් පවතින" : "In Progress"}</option>
                    <option value="inquiry">{lang === "si" ? "පරීක්ෂණ මට්ටමේ" : "Conducting Inquiry"}</option>
                    <option value="closed">{lang === "si" ? "අවසන් කළ" : "Closed"}</option>
                  </select>
                </div>

                {/* Filter by Priority */}
                <div className="filter-group">
                  <label htmlFor="filter-priority">
                    {lang === "si" ? "ප්‍රමුඛතාව" : lang === "ta" ? "முன்னுரிமை" : "Priority"}
                  </label>
                  <select
                    id="filter-priority"
                    className="filter-control"
                    value={selectedPriorityFilter}
                    onChange={(e) => {
                      setSelectedPriorityFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="all">{lang === "si" ? "සියල්ල" : "All Priorities"}</option>
                    <option value="high">{lang === "si" ? "ඉහළ (High)" : "High"}</option>
                    <option value="medium">{lang === "si" ? "මධ්‍යම (Medium)" : "Medium"}</option>
                    <option value="low">{lang === "si" ? "සාමාන්‍ය (Low)" : "Low"}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Loading Indicator */}
            {loading && (
              <div style={{ padding: "60px", textAlign: "center", backgroundColor: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
                <RefreshCw size={36} className="animate-spin" style={{ color: "#2563eb", margin: "0 auto 16px" }} />
                <h4 style={{ margin: "0 0 6px", color: "#1e293b", fontSize: "16px" }}>
                  {lang === "si" ? "ලිපි වාර්තා ලබාගනිමින් පවතී..." : lang === "ta" ? "தரவு ஏற்றப்படுகிறது..." : "Loading categorized letter records..."}
                </h4>
                <p style={{ margin: 0, color: "#64748b", fontSize: "13px" }}>
                  {lang === "si" ? "කරුණාකර රැඳී සිටින්න." : "Please wait a moment."}
                </p>
              </div>
            )}

            {/* Empty State */}
            {!loading && filteredLetters.length === 0 && (
              <div
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "14px",
                  border: "1px solid #e2e8f0",
                  padding: "60px 32px",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  minHeight: "360px",
                }}
              >
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "16px",
                    backgroundColor: activeTab === "discipline" ? "#eff6ff" : activeTab === "mail" ? "#f5f3ff" : "#fff7ed",
                    color: activeTab === "discipline" ? "#2563eb" : activeTab === "mail" ? "#7c3aed" : "#ea580c",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "16px",
                  }}
                >
                  <Inbox size={32} />
                </div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#1e293b", margin: "0 0 8px" }}>
                  {searchQuery || selectedActionFilter !== "all" || selectedStatusFilter !== "all"
                    ? (lang === "si" ? "ගැලපෙන ලිපි වාර්තා හමු නොවීය" : "No matching letters found")
                    : activeTab === "discipline"
                    ? (lang === "si" ? "විනය අංශයේ ලිපි කිසිවක් නැත" : "No Discipline Letters Found")
                    : activeTab === "mail"
                    ? (lang === "si" ? "තැපැල් අංශයේ ලිපි කිසිවක් නැත" : "No Mail Letters Found")
                    : (lang === "si" ? "විනය විමසුම් වාර්තා කිසිවක් නැත" : "No Disciplinary Inquiries Found")}
                </h3>
                <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 20px", maxWidth: "520px" }}>
                  {searchQuery || selectedActionFilter !== "all"
                    ? (lang === "si" ? "ඔබේ සෙවුම් පද හෝ පෙරහන් වෙනස් කර නැවත උත්සාහ කරන්න." : "Try adjusting your search query or filters.")
                    : activeTab === "discipline"
                    ? (lang === "si" ? "ලිපි පරිපාලනයේදී ගොනු නම 'විනය' ලෙස තෝරා සුරකින ලද ලිපි මෙහි දිස්වේ." : "Letters saved with file name 'Discipline' in Case Administration will appear here.")
                    : activeTab === "mail"
                    ? (lang === "si" ? "ලිපි පරිපාලනයේදී ගොනු නම 'තැපැල්' ලෙස තෝරා සුරකින ලද ලිපි මෙහි දිස්වේ." : "Letters saved with file name 'Mail' in Case Administration will appear here.")
                    : (lang === "si" ? "විනය විමසුම් හෝ පරීක්ෂණ පියවරට යොමු කරන ලද ලිපි මෙහි දිස්වේ." : "Cases undergoing formal disciplinary inquiries and inspections will appear here.")}
                </p>
                <Link
                  href="/subject"
                  className="btn-card-action btn-view-details"
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px", textDecoration: "none" }}
                >
                  <ArrowRight size={16} />
                  <span>{lang === "si" ? "විෂය භාර උපකරණ පුවරුවට" : "Go to Subject Dashboard"}</span>
                </Link>
              </div>
            )}

            {/* PRIMARY VIEW: Full Comprehensive Data Table with Expandable Detail Drawers */}
            {!loading && filteredLetters.length > 0 && viewMode === "table" && (
              <div className="reports-table-card">
                {/* Table Header Bar */}
                <div className="reports-table-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span className={`category-header-pill ${activeTab}`}>
                      {activeTab === "discipline"
                        ? (lang === "si" ? "විනය අංශය" : "Discipline Section")
                        : activeTab === "mail"
                        ? (lang === "si" ? "තැපැල් අංශය" : "Mail Section")
                        : (lang === "si" ? "විනය විමසුම්" : lang === "ta" ? "ஒழுங்கு விசாரණைகள்" : "Disciplinary Inquiries")}
                    </span>
                    <h3 style={{ margin: 0 }}>
                      {activeTab === "discipline"
                        ? (lang === "si" ? "විනය ලිපි ලේඛන විස්තර වාර්තාව" : "Discipline Letters Details Table")
                        : activeTab === "mail"
                        ? (lang === "si" ? "තැපැල් ලිපි ලේඛන විස්තර වාර්තාව" : "Mail Letters Details Table")
                        : (lang === "si" ? "විනය විමසුම් විස්තර වාර්තාව" : "Disciplinary Inquiries Details Table")}
                    </h3>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 600 }}>
                      {filteredLetters.length} {lang === "si" ? "ලිපි" : "letters"}
                    </span>
                    {/* Rows per page selector */}
                    <select
                      className="filter-control"
                      style={{ height: "32px", padding: "4px 8px", fontSize: "12px", width: "auto" }}
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      aria-label="Items per page"
                    >
                      <option value={10}>10 per page</option>
                      <option value={25}>25 per page</option>
                      <option value={50}>50 per page</option>
                      <option value={-1}>Show All</option>
                    </select>
                  </div>
                </div>

                {/* Table with ALL Letter Details */}
                <div className="table-wrapper">
                  <table className="reports-table">
                    <thead>
                      <tr>
                        <th style={{ width: "40px", textAlign: "center" }}>#</th>
                        <th style={{ width: "40px", textAlign: "center" }}></th>
                        <th>{lang === "si" ? "ලිපි අංකය (Letter No)" : "Letter No"}</th>
                        <th>{lang === "si" ? "විෂය ගොනු අංකය" : "Subject File No"}</th>
                        <th>{lang === "si" ? "ගොනු නම" : "File Name"}</th>
                        <th>{lang === "si" ? "ගනු ලබන ඉදිරි ක්‍රියාමාර්ග" : "Future Action Taken"}</th>
                        <th>{lang === "si" ? "අත්සනට ඉදිරිපත් කළ දිනය" : "Date Prepared & Submitted"}</th>
                        <th>{lang === "si" ? "පැමිණිල්ලේ විෂයය" : "Subject / Matter"}</th>
                        <th>{lang === "si" ? "පැමිණිලිකරු" : "Complainant"}</th>
                        <th>{lang === "si" ? "චෝදනා ලැබූ නිලධාරියා" : "Accused Officer"}</th>
                        <th>{lang === "si" ? "ජා.හැ. අංකය" : "NIC No"}</th>
                        <th>{lang === "si" ? "පාසල / ආයතනය" : "School / Institute"}</th>
                        <th>{lang === "si" ? "ලැබුණු දිනය" : "Received Date"}</th>
                        <th>{lang === "si" ? "තත්ත්වය" : "Status"}</th>
                        <th style={{ textAlign: "right" }}>{lang === "si" ? "ක්‍රියාමාර්ග" : "Actions"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLetters.map((letter, idx) => {
                        const isExpanded = expandedRowId === letter.ref_number;
                        const rowNumber = (pageSize === -1 ? 0 : (currentPage - 1) * pageSize) + idx + 1;
                        const isMail = letter.file_name === "mail";

                        return (
                          <React.Fragment key={`group-${letter.ref_number || letter.id || idx}`}>
                            <tr
                              className={`table-row-item ${isExpanded ? "expanded" : ""}`}
                              onClick={() => toggleRowExpansion(letter.ref_number)}
                            >
                              {/* Row Index */}
                              <td style={{ textAlign: "center", color: "#94a3b8", fontWeight: 600 }}>
                                {rowNumber}
                              </td>

                              {/* Toggle Chevron Button */}
                              <td style={{ textAlign: "center" }}>
                                <button
                                  type="button"
                                  className={`table-expand-btn ${isExpanded ? "active" : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleRowExpansion(letter.ref_number);
                                  }}
                                  aria-label={isExpanded ? "Collapse details" : "Expand details"}
                                  title="Expand full letter details"
                                >
                                  <ChevronDown size={14} />
                                </button>
                              </td>

                              {/* 1. ලිපි අංකය (Letter No / Ref No) */}
                              <td style={{ whiteSpace: "nowrap" }}>
                                <span className="ref-pill-primary" style={{ padding: "3px 8px", fontSize: "12px" }}>
                                  <Tag size={12} style={{ color: isMail ? "#7c3aed" : "#2563eb" }} />
                                  <strong>{letter.ref_number}</strong>
                                </span>
                              </td>

                              {/* 2. විෂය ගොනු අංකය (Subject File No) */}
                              <td style={{ whiteSpace: "nowrap" }}>
                                <span className="sub-ref-pill" style={{ padding: "3px 8px", fontSize: "12px" }}>
                                  {letter.subject_file_no || "—"}
                                </span>
                              </td>

                              {/* 3. ගොනු නම (File Name) */}
                              <td>
                                <span className={`category-header-pill ${letter.file_name === "inquiry" || activeTab === "inquiries" ? "inquiries" : letter.file_name}`} style={{ padding: "2px 8px", fontSize: "11px" }}>
                                  {letter.file_name === "mail"
                                    ? (lang === "si" ? "තැපැල්" : lang === "ta" ? "அஞ்சல்" : "Mail")
                                    : letter.file_name === "inquiry" || activeTab === "inquiries"
                                    ? (lang === "si" ? "විනය විමසුම්" : lang === "ta" ? "ஒழுங்கு விசாரණைகள்" : "Inquiry")
                                    : (lang === "si" ? "විනය" : lang === "ta" ? "ஒழுக்கம்" : "Discipline")}
                                </span>
                              </td>

                              {/* 4. ගනු ලබන ඉදිරි ක්‍රියාමාර්ග (Future Action Taken) */}
                              <td>
                                <span style={{ color: "#1d4ed8", fontWeight: 700, fontSize: "13px" }}>
                                  {letter.future_action ? t(letter.future_action, letter.future_action) : "—"}
                                </span>
                              </td>

                              {/* 5. අත්සනට ඉදිරිපත් කළ දිනය (Date Prepared & Submitted) */}
                              <td style={{ whiteSpace: "nowrap" }}>
                                {letter.date_prepared_and_submitted_for_signature ? (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#334155" }}>
                                    <CalendarIcon size={12} style={{ color: "#64748b" }} />
                                    {letter.date_prepared_and_submitted_for_signature}
                                  </span>
                                ) : (
                                  <span style={{ color: "#94a3b8" }}>—</span>
                                )}
                              </td>

                              {/* 6. පැමිණිල්ලේ විෂයය (Subject / Matter) */}
                              <td style={{ maxWidth: "220px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={letter.subject}>
                                <strong>{letter.subject || "—"}</strong>
                                {letter.classification_of_complaint_letter && (
                                  <div style={{ fontSize: "10px", color: "#64748b", textTransform: "capitalize" }}>
                                    ({letter.classification_of_complaint_letter})
                                  </div>
                                )}
                              </td>

                              {/* 7. පැමිණිලිකරුගේ නම (Complainant Name) */}
                              <td style={{ maxWidth: "160px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={letter.name_of_the_presenting_the_complain}>
                                {letter.name_of_the_presenting_the_complain || "—"}
                              </td>

                              {/* 8. චෝදනා ලැබූ නිලධාරියා (Accused Officer) */}
                              <td style={{ whiteSpace: "nowrap" }}>
                                <strong>{letter.accused_officer_name || "—"}</strong>
                                {letter.accused_designation && (
                                  <div style={{ fontSize: "11px", color: "#64748b" }}>
                                    {letter.accused_designation}
                                  </div>
                                )}
                              </td>

                              {/* 9. ජා.හැ. අංකය (NIC No) */}
                              <td style={{ whiteSpace: "nowrap", fontFamily: "monospace", fontSize: "12px" }}>
                                {letter.nic_no || "—"}
                              </td>

                              {/* 10. පාසල / ආයතනය (School / Institute) */}
                              <td style={{ maxWidth: "180px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={letter.accused_school_name}>
                                {letter.accused_school_name || "—"}
                                {letter.district && (
                                  <div style={{ fontSize: "10px", color: "#64748b" }}>
                                    {letter.district}
                                  </div>
                                )}
                              </td>

                              {/* 11. ලැබුණු දිනය (Received Date) */}
                              <td style={{ whiteSpace: "nowrap", fontSize: "12px" }}>
                                {letter.received_date || letter.letter_date || "—"}
                              </td>

                              {/* 12. තත්ත්වය (Status) */}
                              <td style={{ whiteSpace: "nowrap" }}>
                                <span
                                  className={`status-chip ${
                                    letter.status.toLowerCase().includes("closed")
                                      ? "closed"
                                      : letter.status.toLowerCase().includes("inquiry") || letter.status.toLowerCase().includes("inspection")
                                      ? "pending"
                                      : "inprogress"
                                  }`}
                                  style={{ padding: "3px 8px", fontSize: "11px" }}
                                >
                                  {letter.status.toLowerCase().includes("closed") ? (
                                    <CheckCircle size={11} />
                                  ) : letter.status.toLowerCase().includes("inquiry") ? (
                                    <AlertTriangle size={11} />
                                  ) : (
                                    <Clock size={11} />
                                  )}
                                  <span>{letter.status}</span>
                                </span>
                              </td>

                              {/* 13. ක්‍රියාමාර්ග (Actions) */}
                              <td style={{ textAlign: "right", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                                <div style={{ display: "inline-flex", gap: "6px" }}>
                                  <button
                                    type="button"
                                    className="btn-card-action btn-view-details"
                                    style={{ padding: "4px 8px", fontSize: "12px" }}
                                    onClick={() => setSelectedLetter(letter)}
                                    title="View Full Details Modal"
                                  >
                                    <Eye size={13} />
                                  </button>

                                  <Link
                                    href={`/subject/add-details?caseNo=${encodeURIComponent(letter.ref_number)}`}
                                    className="btn-card-action btn-edit-case"
                                    style={{ padding: "4px 8px", fontSize: "12px" }}
                                    title="Open / Edit Case Details"
                                  >
                                    <Edit3 size={13} />
                                  </Link>

                                  {(activeTab === "inquiries" || letter.file_name === "inquiry" || Boolean(letter.inquiry_details)) && (
                                    <Link
                                      href={`/subject/disciplinary-inspection?caseNo=${encodeURIComponent(letter.ref_number)}`}
                                      className="btn-card-action"
                                      style={{ padding: "4px 8px", fontSize: "12px", background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" }}
                                      title={lang === "si" ? "විනය පරීක්ෂණ විස්තර" : "Disciplinary Inspection"}
                                    >
                                      <Scale size={13} />
                                    </Link>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Expandable Sub-Row displaying ALL details right inside the table */}
                            {isExpanded && (
                              <tr key={`expand-${letter.ref_number}-${idx}`} className="table-expanded-detail-tr">
                                <td colSpan={15}>
                                  <div className={`table-detail-drawer-inner ${isMail ? "mail-theme" : (activeTab === "inquiries" || letter.file_name === "inquiry" || Boolean(letter.inquiry_details)) ? "inquiry-theme" : ""}`}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                                      <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                                        {activeTab === "inquiries" || letter.file_name === "inquiry" ? (
                                          <ShieldAlert size={16} style={{ color: "#ea580c" }} />
                                        ) : (
                                          <FileText size={16} style={{ color: isMail ? "#7c3aed" : "#2563eb" }} />
                                        )}
                                        <span>
                                          {lang === "si" ? "ලිපියේ සම්පූර්ණ විස්තර" : "Letter Full Details"} — {letter.ref_number}
                                        </span>
                                      </h4>

                                      <div style={{ display: "flex", gap: "8px" }}>
                                        <button
                                          type="button"
                                          className="btn-card-action btn-view-details"
                                          style={{ padding: "4px 10px", fontSize: "12px" }}
                                          onClick={() => setSelectedLetter(letter)}
                                        >
                                          <Eye size={12} />
                                          <span>{lang === "si" ? "පොප්අප් එකෙන් බලන්න" : "Open Modal"}</span>
                                        </button>
                                        <Link
                                          href={`/subject/add-details?caseNo=${encodeURIComponent(letter.ref_number)}`}
                                          className="btn-card-action btn-edit-case"
                                          style={{ padding: "4px 10px", fontSize: "12px" }}
                                        >
                                          <Edit3 size={12} />
                                          <span>{lang === "si" ? "සංස්කරණය" : "Edit Case"}</span>
                                        </Link>
                                        {(activeTab === "inquiries" || letter.file_name === "inquiry" || Boolean(letter.inquiry_details)) && (
                                          <Link
                                            href={`/subject/disciplinary-inspection?caseNo=${encodeURIComponent(letter.ref_number)}`}
                                            className="btn-card-action"
                                            style={{ padding: "4px 10px", fontSize: "12px", background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" }}
                                          >
                                            <Scale size={12} />
                                            <span>{lang === "si" ? "විනය පරීක්ෂණ" : "Inspection"}</span>
                                          </Link>
                                        )}
                                      </div>
                                    </div>

                                    {/* 4 Structured Information Columns */}
                                    <div className="report-letter-sections-grid" style={{ padding: 0 }}>
                                      {/* Box 1: Case Admin */}
                                      <div className={`letter-detail-box ${isMail ? "theme-mail" : ""}`}>
                                        <h5 className="detail-box-title">
                                          <FileCheck size={14} />
                                          <span>{lang === "si" ? "1. ලිපි පරිපාලනය" : "1. Case Administration"}</span>
                                        </h5>
                                        <div className="detail-field-list">
                                          <div className="detail-field-item">
                                            <span className="detail-field-label">ගොනු නම (File Name)</span>
                                            <span className="detail-field-value" style={{ color: isMail ? "#7c3aed" : "#2563eb", textTransform: "capitalize" }}>
                                              {letter.file_name}
                                            </span>
                                          </div>
                                          <div className="detail-field-item">
                                            <span className="detail-field-label">ලිපි අංකය (Letter No)</span>
                                            <span className="detail-field-value">{letter.ref_number}</span>
                                          </div>
                                          <div className="detail-field-item">
                                            <span className="detail-field-label">විෂය ගොනු අංකය (Subject File No)</span>
                                            <span className="detail-field-value">{letter.subject_file_no || "—"}</span>
                                          </div>
                                          <div className="detail-field-item">
                                            <span className="detail-field-label">ගනු ලබන ඉදිරි ක්‍රියාමාර්ග (Future Action)</span>
                                            <span className="detail-field-value highlight-action">{letter.future_action ? t(letter.future_action, letter.future_action) : "—"}</span>
                                          </div>
                                          <div className="detail-field-item">
                                            <span className="detail-field-label">අත්සනට ඉදිරිපත් කළ දිනය (Submission Date)</span>
                                            <span className="detail-field-value">{letter.date_prepared_and_submitted_for_signature || "—"}</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Box 2: Complaint Details */}
                                      <div className={`letter-detail-box ${isMail ? "theme-mail" : ""}`}>
                                        <h5 className="detail-box-title">
                                          <FileText size={14} />
                                          <span>{lang === "si" ? "2. ලිපිය සහ පැමිණිල්ල" : "2. Letter & Complaint"}</span>
                                        </h5>
                                        <div className="detail-field-list">
                                          <div className="detail-field-item">
                                            <span className="detail-field-label">පැමිණිල්ලට අදාළ කරුණ (Subject)</span>
                                            <span className="detail-field-value" style={{ fontWeight: 700 }}>{letter.subject}</span>
                                          </div>
                                          <div className="detail-field-item">
                                            <span className="detail-field-label">{lang === "si" ? "ලිපියේ ස්වභාවය" : "Nature of Letter"}</span>
                                            <span className="detail-field-value" style={{ fontWeight: 600, color: "#0369a1" }}>{letter.nature_of_letter || "—"}</span>
                                          </div>
                                          <div className="detail-field-item">
                                            <span className="detail-field-label">වර්ගීකරණය (Classification)</span>
                                            <span className="detail-field-value" style={{ textTransform: "capitalize" }}>
                                              {letter.classification_of_complaint_letter}
                                            </span>
                                          </div>
                                          <div className="detail-field-item">
                                            <span className="detail-field-label">පැමිණිලිකරුගේ නම (Complainant)</span>
                                            <span className="detail-field-value">{letter.name_of_the_presenting_the_complain || "—"}</span>
                                          </div>
                                          <div className="detail-field-item">
                                            <span className="detail-field-label">ලිපිනය (Address)</span>
                                            <span className="detail-field-value">{letter.address_of_the_person_presenting_the_complaint || "—"}</span>
                                          </div>
                                          <div className="detail-field-item">
                                            <span className="detail-field-label">ලැබුණු දිනය (Received Date)</span>
                                            <span className="detail-field-value">{letter.received_date || letter.letter_date || "—"}</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Box 3: Accused Officer */}
                                      <div className={`letter-detail-box ${isMail ? "theme-mail" : ""}`}>
                                        <h5 className="detail-box-title">
                                          <User size={14} />
                                          <span>{lang === "si" ? "3. චෝදනා ලැබූ නිලධාරියා" : "3. Accused Officer"}</span>
                                        </h5>
                                        <div className="detail-field-list">
                                          <div className="detail-field-item">
                                            <span className="detail-field-label">නම (Officer Name)</span>
                                            <span className="detail-field-value">{letter.accused_officer_name || "—"}</span>
                                          </div>
                                          <div className="detail-field-item">
                                            <span className="detail-field-label">තනතුර (Position / Designation)</span>
                                            <span className="detail-field-value">{letter.accused_designation || "—"}</span>
                                          </div>
                                          <div className="detail-field-item">
                                            <span className="detail-field-label">ජාතික හැඳුනුම්පත් අංකය (NIC)</span>
                                            <span className="detail-field-value">{letter.nic_no || "—"}</span>
                                          </div>
                                          <div className="detail-field-item">
                                            <span className="detail-field-label">උපන් දිනය (DOB) / පත්වීම් දිනය</span>
                                            <span className="detail-field-value">
                                              {letter.date_of_birth ? `DOB: ${letter.date_of_birth}` : ""}
                                              {letter.appointment_date ? ` | Appt: ${letter.appointment_date}` : ""}
                                              {!letter.date_of_birth && !letter.appointment_date ? "—" : ""}
                                            </span>
                                          </div>
                                          <div className="detail-field-item">
                                            <span className="detail-field-label">ලිපිනය (Officer Address)</span>
                                            <span className="detail-field-value">{letter.officer_address || "—"}</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Box 4: School / Institute */}
                                      <div className={`letter-detail-box ${isMail ? "theme-mail" : ""}`}>
                                        <h5 className="detail-box-title">
                                          <Building size={14} />
                                          <span>{lang === "si" ? "4. පාසල / ආයතනය" : "4. School & Location"}</span>
                                        </h5>
                                        <div className="detail-field-list">
                                          <div className="detail-field-item">
                                            <span className="detail-field-label">පාසල / ආයතනය (School Name)</span>
                                            <span className="detail-field-value">{letter.accused_school_name || "—"}</span>
                                          </div>
                                          <div className="detail-field-item">
                                            <span className="detail-field-label">පාසල් ලිපිනය (Address)</span>
                                            <span className="detail-field-value">{letter.school_address || "—"}</span>
                                          </div>
                                          <div className="detail-field-item">
                                            <span className="detail-field-label">පළාත, දිස්ත්‍රික්කය සහ කලාපය</span>
                                            <span className="detail-field-value">
                                              {[letter.province, letter.district, letter.zone].filter(Boolean).join(" / ") || "—"}
                                            </span>
                                          </div>
                                          {letter.add_sec_instructions && (
                                            <div className="detail-field-item">
                                              <span className="detail-field-label">අතිරේක ලේකම්ගේ උපදෙස්</span>
                                              <span className="detail-field-value" style={{ fontStyle: "italic", color: "#475569" }}>
                                                {letter.add_sec_instructions}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Box 5: Disciplinary Inquiry & Committee Details */}
                                      {(activeTab === "inquiries" || letter.file_name === "inquiry" || Boolean(letter.inquiry_details)) && (
                                        <div className="letter-detail-box theme-inquiry" style={{ borderLeft: "3px solid #ea580c" }}>
                                          <h5 className="detail-box-title" style={{ color: "#c2410c" }}>
                                            <ShieldAlert size={14} />
                                            <span>{lang === "si" ? "5. විනය විමසුම් විස්තර" : "5. Inquiry & Committee Details"}</span>
                                          </h5>
                                          <div className="detail-field-list">
                                            <div className="detail-field-item">
                                              <span className="detail-field-label">පරීක්ෂණ සභාපති (Chairman)</span>
                                              <span className="detail-field-value" style={{ fontWeight: 600 }}>
                                                {letter.inquiry_details?.chairman?.name || "—"}
                                                {letter.inquiry_details?.chairman?.position ? ` (${letter.inquiry_details.chairman.position})` : ""}
                                              </span>
                                            </div>
                                            <div className="detail-field-item">
                                              <span className="detail-field-label">කාරක සභා සාමාජිකයින් (Members)</span>
                                              <span className="detail-field-value">
                                                {letter.inquiry_details?.members && letter.inquiry_details.members.length > 0
                                                  ? letter.inquiry_details.members.map((m: any) => m.name).join(", ")
                                                  : "—"}
                                              </span>
                                            </div>
                                            <div className="detail-field-item">
                                              <span className="detail-field-label">වාර්තාව ඉදිරිපත් කළ යුතු දිනය (Due Date)</span>
                                              <span className="detail-field-value">
                                                {letter.inquiry_details?.report_due_date || "—"}
                                              </span>
                                            </div>
                                            <div className="detail-field-item">
                                              <span className="detail-field-label">විනය නියෝගය (Disciplinary Order)</span>
                                              <span className="detail-field-value highlight-action" style={{ color: "#c2410c" }}>
                                                {letter.inquiry_details?.disciplinary_order || "—"}
                                              </span>
                                            </div>
                                            <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                              <Link
                                                href={`/subject/disciplinary-inspection?caseNo=${encodeURIComponent(letter.ref_number)}`}
                                                className="btn-card-action"
                                                style={{ fontSize: "11px", padding: "3px 8px", background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" }}
                                              >
                                                <Scale size={12} />
                                                <span>{lang === "si" ? "විනය පරීක්ෂණ පිටුව" : "Disciplinary Inspection"}</span>
                                              </Link>
                                              <Link
                                                href={`/subject/conduct-inquiry?caseNo=${encodeURIComponent(letter.ref_number)}`}
                                                className="btn-card-action"
                                                style={{ fontSize: "11px", padding: "3px 8px", background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" }}
                                              >
                                                <FileText size={12} />
                                                <span>{lang === "si" ? "පරීක්ෂණ මෙහෙයවීම" : "Conduct Inquiry"}</span>
                                              </Link>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Table Pagination Bar */}
                {pageSize !== -1 && totalPages > 1 && (
                  <div className="reports-table-pagination">
                    <div>
                      {lang === "si" ? "පෙන්වන්නේ" : "Showing"}{" "}
                      <strong>{(currentPage - 1) * pageSize + 1}</strong> -{" "}
                      <strong>{Math.min(currentPage * pageSize, filteredLetters.length)}</strong>{" "}
                      {lang === "si" ? "මුළු" : "of"}{" "}
                      <strong>{filteredLetters.length}</strong>
                    </div>

                    <div className="pagination-controls">
                      <button
                        type="button"
                        className="pagination-btn"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        {lang === "si" ? "පෙර" : "Previous"}
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                        if (p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1) {
                          return (
                            <button
                              key={`page-${p}`}
                              type="button"
                              className={`pagination-btn ${currentPage === p ? "active" : ""}`}
                              onClick={() => setCurrentPage(p)}
                            >
                              {p}
                            </button>
                          );
                        } else if (Math.abs(p - currentPage) === 2) {
                          return <span key={`ellipsis-${p}`} style={{ padding: "0 4px" }}>...</span>;
                        }
                        return null;
                      })}

                      <button
                        type="button"
                        className="pagination-btn"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        {lang === "si" ? "ඊළඟ" : "Next"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Alternative Cards Detail View */}
            {!loading && filteredLetters.length > 0 && viewMode === "cards" && (
              <div className="report-letter-cards-list">
                {filteredLetters.map((letter) => {
                  const isMail = letter.file_name === "mail";
                  const isInquiry = activeTab === "inquiries" || letter.file_name === "inquiry" || Boolean(letter.inquiry_details);
                  return (
                    <article
                      key={letter.id || letter.ref_number}
                      className={`report-letter-card ${isMail ? "theme-mail" : isInquiry ? "theme-inquiries" : "theme-discipline"}`}
                    >
                      {/* Top Bar with Primary Identifiers & Badges */}
                      <div className="report-letter-card-topbar">
                        <div className="card-ref-badge-group">
                          <span className="ref-pill-primary">
                            <Tag size={14} style={{ color: isMail ? "#7c3aed" : isInquiry ? "#ea580c" : "#2563eb" }} />
                            <strong>{lang === "si" ? "ලිපි අංකය" : "Letter No"}:</strong> {letter.ref_number}
                          </span>

                          <span className="sub-ref-pill">
                            <strong>{lang === "si" ? "විෂය ගොනු අංකය" : "Subject File No"}:</strong> {letter.subject_file_no || "—"}
                          </span>

                          <span className={`category-header-pill ${isInquiry ? "inquiries" : letter.file_name}`}>
                            {letter.file_name === "mail"
                              ? (lang === "si" ? "තැපැල්" : lang === "ta" ? "அஞ்சல்" : "Mail")
                              : isInquiry
                              ? (lang === "si" ? "විනය විමසුම්" : lang === "ta" ? "ஒழுங்கு விசாரණைகள்" : "Inquiry")
                              : (lang === "si" ? "විනය" : lang === "ta" ? "ஒழுக்கம்" : "Discipline")}
                          </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                          <span className={`priority-chip ${letter.priority || "medium"}`}>
                            {letter.priority || "Medium"}
                          </span>

                          <span
                            className={`status-chip ${
                              letter.status.toLowerCase().includes("closed")
                                ? "closed"
                                : letter.status.toLowerCase().includes("inquiry") || letter.status.toLowerCase().includes("inspection")
                                ? "pending"
                                : "inprogress"
                            }`}
                          >
                            {letter.status.toLowerCase().includes("closed") ? (
                              <CheckCircle size={13} />
                            ) : letter.status.toLowerCase().includes("inquiry") ? (
                              <AlertTriangle size={13} />
                            ) : (
                              <Clock size={13} />
                            )}
                            <span>{letter.status}</span>
                          </span>
                        </div>
                      </div>

                      {/* Four Detailed Information Sections */}
                      <div className="report-letter-sections-grid">
                        {/* Section 1: Case Administration Details */}
                        <div className={`letter-detail-box ${isMail ? "theme-mail" : ""}`}>
                          <h4 className="detail-box-title">
                            <FileCheck size={16} />
                            <span>{lang === "si" ? "1. ලිපි පරිපාලනය" : "1. Case Administration"}</span>
                          </h4>
                          <div className="detail-field-list">
                            <div className="detail-field-item">
                              <span className="detail-field-label">{lang === "si" ? "ගොනු නම (File Name)" : "File Name"}</span>
                              <span className="detail-field-value" style={{ textTransform: "capitalize", color: isMail ? "#7c3aed" : "#2563eb" }}>
                                {letter.file_name}
                              </span>
                            </div>
                            <div className="detail-field-item">
                              <span className="detail-field-label">{lang === "si" ? "ලිපි අංකය (Letter No)" : "Letter Number"}</span>
                              <span className="detail-field-value">{letter.ref_number}</span>
                            </div>
                            <div className="detail-field-item">
                              <span className="detail-field-label">{lang === "si" ? "විෂය ගොනු අංකය" : "Subject File No"}</span>
                              <span className="detail-field-value">{letter.subject_file_no || "—"}</span>
                            </div>
                            <div className="detail-field-item">
                              <span className="detail-field-label">{lang === "si" ? "ගනු ලබන ඉදිරි ක්‍රියාමාර්ග" : "Future Action Taken"}</span>
                              <span className="detail-field-value highlight-action">{letter.future_action ? t(letter.future_action, letter.future_action) : "—"}</span>
                            </div>
                            <div className="detail-field-item">
                              <span className="detail-field-label">{lang === "si" ? "අත්සනට ඉදිරිපත් කළ දිනය" : "Date Prepared & Submitted"}</span>
                              <span className="detail-field-value">{letter.date_prepared_and_submitted_for_signature || "—"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Section 2: Complaint Information */}
                        <div className={`letter-detail-box ${isMail ? "theme-mail" : ""}`}>
                          <h4 className="detail-box-title">
                            <FileText size={16} />
                            <span>{lang === "si" ? "2. ලිපිය / පැමිණිල්ලේ විස්තර" : "2. Letter & Complaint"}</span>
                          </h4>
                          <div className="detail-field-list">
                            <div className="detail-field-item">
                              <span className="detail-field-label">{lang === "si" ? "පැමිණිල්ලට අදාළ කරුණ / විෂයය" : "Subject / Complaint Matter"}</span>
                              <span className="detail-field-value" style={{ fontWeight: 700 }}>{letter.subject || "—"}</span>
                            </div>
                            <div className="detail-field-item">
                              <span className="detail-field-label">{lang === "si" ? "වර්ගීකරණය (Classification)" : "Classification"}</span>
                              <span className="detail-field-value" style={{ textTransform: "capitalize" }}>
                                {letter.classification_of_complaint_letter}
                              </span>
                            </div>
                            <div className="detail-field-item">
                              <span className="detail-field-label">{lang === "si" ? "පැමිණිලිකරු / එවූ පාර්ශවය" : "Complainant / Sender"}</span>
                              <span className="detail-field-value">{letter.name_of_the_presenting_the_complain || "—"}</span>
                            </div>
                            <div className="detail-field-item">
                              <span className="detail-field-label">{lang === "si" ? "පැමිණිලිකරුගේ ලිපිනය" : "Complainant Address"}</span>
                              <span className="detail-field-value">{letter.address_of_the_person_presenting_the_complaint || "—"}</span>
                            </div>
                            <div className="detail-field-item">
                              <span className="detail-field-label">{lang === "si" ? "ලැබුණු දිනය" : "Received Date"}</span>
                              <span className="detail-field-value">{letter.received_date || letter.letter_date || "—"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Section 3: Accused Officer */}
                        <div className={`letter-detail-box ${isMail ? "theme-mail" : ""}`}>
                          <h4 className="detail-box-title">
                            <User size={16} />
                            <span>{lang === "si" ? "3. චෝදනා ලැබූ නිලධාරියා" : "3. Accused Officer"}</span>
                          </h4>
                          <div className="detail-field-list">
                            <div className="detail-field-item">
                              <span className="detail-field-label">{lang === "si" ? "නිලධාරියාගේ නම" : "Officer Name"}</span>
                              <span className="detail-field-value">{letter.accused_officer_name || "—"}</span>
                            </div>
                            <div className="detail-field-item">
                              <span className="detail-field-label">{lang === "si" ? "තනතුර (Position)" : "Designation"}</span>
                              <span className="detail-field-value">{letter.accused_designation || "—"}</span>
                            </div>
                            <div className="detail-field-item">
                              <span className="detail-field-label">{lang === "si" ? "ජාතික හැඳුනුම්පත් අංකය" : "NIC Number"}</span>
                              <span className="detail-field-value">{letter.nic_no || "—"}</span>
                            </div>
                            <div className="detail-field-item">
                              <span className="detail-field-label">{lang === "si" ? "උපන් දිනය / පත්වීම් දිනය" : "DOB / Appointment Date"}</span>
                              <span className="detail-field-value">
                                {letter.date_of_birth ? `DOB: ${letter.date_of_birth}` : ""}
                                {letter.appointment_date ? ` | Appt: ${letter.appointment_date}` : ""}
                                {!letter.date_of_birth && !letter.appointment_date ? "—" : ""}
                              </span>
                            </div>
                            <div className="detail-field-item">
                              <span className="detail-field-label">{lang === "si" ? "නිලධාරියාගේ ලිපිනය" : "Officer Address"}</span>
                              <span className="detail-field-value">{letter.officer_address || "—"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Section 4: School & Location */}
                        <div className={`letter-detail-box ${isMail ? "theme-mail" : ""}`}>
                          <h4 className="detail-box-title">
                            <Building size={16} />
                            <span>{lang === "si" ? "4. අදාළ පාසල / ආයතනය" : "4. School & Location"}</span>
                          </h4>
                          <div className="detail-field-list">
                            <div className="detail-field-item">
                              <span className="detail-field-label">{lang === "si" ? "පාසල / ආයතනය" : "School / Institute"}</span>
                              <span className="detail-field-value">{letter.accused_school_name || "—"}</span>
                            </div>
                            <div className="detail-field-item">
                              <span className="detail-field-label">{lang === "si" ? "පාසල් ලිපිනය" : "School Address"}</span>
                              <span className="detail-field-value">{letter.school_address || "—"}</span>
                            </div>
                            <div className="detail-field-item">
                              <span className="detail-field-label">{lang === "si" ? "පළාත, දිස්ත්‍රික්කය සහ කලාපය" : "Location"}</span>
                              <span className="detail-field-value">
                                {[letter.province, letter.district, letter.zone].filter(Boolean).join(" / ") || "—"}
                              </span>
                            </div>
                            {letter.add_sec_instructions && (
                              <div className="detail-field-item">
                                <span className="detail-field-label">{lang === "si" ? "අතිරේක ලේකම් උපදෙස්" : "Add. Sec Directives"}</span>
                                <span className="detail-field-value" style={{ fontStyle: "italic", color: "#475569" }}>
                                  {letter.add_sec_instructions}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Section 5: Disciplinary Inquiry Details */}
                        {isInquiry && (
                          <div className="letter-detail-box theme-inquiry" style={{ borderLeft: "3px solid #ea580c" }}>
                            <h4 className="detail-box-title" style={{ color: "#c2410c" }}>
                              <ShieldAlert size={16} />
                              <span>{lang === "si" ? "5. විනය විමසුම් විස්තර" : "5. Inquiry & Committee"}</span>
                            </h4>
                            <div className="detail-field-list">
                              <div className="detail-field-item">
                                <span className="detail-field-label">සභාපති (Chairman)</span>
                                <span className="detail-field-value" style={{ fontWeight: 600 }}>
                                  {letter.inquiry_details?.chairman?.name || "—"}
                                  {letter.inquiry_details?.chairman?.position ? ` (${letter.inquiry_details.chairman.position})` : ""}
                                </span>
                              </div>
                              <div className="detail-field-item">
                                <span className="detail-field-label">සාමාජිකයින් (Members)</span>
                                <span className="detail-field-value">
                                  {letter.inquiry_details?.members && letter.inquiry_details.members.length > 0
                                    ? letter.inquiry_details.members.map((m: any) => m.name).join(", ")
                                    : "—"}
                                </span>
                              </div>
                              <div className="detail-field-item">
                                <span className="detail-field-label">දිනය (Due Date)</span>
                                <span className="detail-field-value">
                                  {letter.inquiry_details?.report_due_date || "—"}
                                </span>
                              </div>
                              <div className="detail-field-item">
                                <span className="detail-field-label">විනය නියෝගය (Order)</span>
                                <span className="detail-field-value highlight-action" style={{ color: "#c2410c" }}>
                                  {letter.inquiry_details?.disciplinary_order || "—"}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Card Footer */}
                      <div className="report-letter-card-footer">
                        <div className="card-footer-meta">
                          {letter.date_prepared_and_submitted_for_signature && (
                            <span>
                              <CalendarIcon size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
                              {lang === "si" ? "දිනය" : "Date"}: {letter.date_prepared_and_submitted_for_signature}
                            </span>
                          )}
                          <span>
                            {lang === "si" ? "ගොනු වර්ගය" : "File Type"}: <strong>{isMail ? "Mail" : isInquiry ? "Disciplinary Inquiry" : "Discipline"}</strong>
                          </span>
                        </div>

                        <div className="card-footer-actions">
                          <button
                            type="button"
                            className="btn-card-action btn-view-details"
                            onClick={() => setSelectedLetter(letter)}
                          >
                            <Eye size={14} />
                            <span>{lang === "si" ? "සම්පූර්ණ විස්තර බලන්න" : "View Full Details"}</span>
                          </button>

                          <Link
                            href={`/subject/add-details?caseNo=${encodeURIComponent(letter.ref_number)}`}
                            className="btn-card-action btn-edit-case"
                          >
                            <Edit3 size={14} />
                            <span>{lang === "si" ? "සංස්කරණය / විස්තර" : "Open / Edit"}</span>
                          </Link>

                          {isInquiry && (
                            <Link
                              href={`/subject/disciplinary-inspection?caseNo=${encodeURIComponent(letter.ref_number)}`}
                              className="btn-card-action"
                              style={{ background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa", display: "inline-flex", alignItems: "center", gap: "5px" }}
                            >
                              <Scale size={14} />
                              <span>{lang === "si" ? "පරීක්ෂණ" : "Inspection"}</span>
                            </Link>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Comprehensive Letter Detail Modal */}
      {selectedLetter && (
        <div className="detail-modal-overlay" onClick={() => setSelectedLetter(null)}>
          <div className="detail-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="detail-modal-header">
              <div>
                <h3>
                  <FileText size={20} />
                  <span>
                    {lang === "si" ? "ලිපි විස්තර සම්පූර්ණ වාර්තාව" : "Letter Comprehensive Details"} - {selectedLetter.ref_number}
                  </span>
                </h3>
                <p>
                  {selectedLetter.file_name === "mail"
                    ? "Mail Category File"
                    : selectedLetter.file_name === "inquiry" || selectedLetter.inquiry_details
                    ? "Disciplinary Inquiry Case"
                    : "Discipline Category File"}{" "}
                  • {selectedLetter.subject_file_no}
                </p>
              </div>
              <button
                type="button"
                className="detail-modal-close-btn"
                onClick={() => setSelectedLetter(null)}
                aria-label="Close Modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="detail-modal-content">
              {/* Header Badges Bar */}
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", paddingBottom: "12px", borderBottom: "1px solid #e2e8f0" }}>
                <span className={`category-header-pill ${selectedLetter.file_name === "inquiry" || selectedLetter.inquiry_details ? "inquiries" : selectedLetter.file_name}`}>
                  {selectedLetter.file_name === "mail"
                    ? "Mail"
                    : selectedLetter.file_name === "inquiry" || selectedLetter.inquiry_details
                    ? (lang === "si" ? "විනය විමසුම්" : lang === "ta" ? "ஒழுங்கு விசாரණைகள்" : "Disciplinary Inquiry")
                    : "Discipline"}
                </span>
                <span className={`status-chip inprogress`}>{selectedLetter.status}</span>
                <span className={`priority-chip ${selectedLetter.priority || "medium"}`}>{selectedLetter.priority || "Medium"}</span>
                {selectedLetter.date_prepared_and_submitted_for_signature && (
                  <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "auto" }}>
                    Prepared & Submitted: <strong>{selectedLetter.date_prepared_and_submitted_for_signature}</strong>
                  </span>
                )}
              </div>

              {/* 4 Detail Grid Sections in Modal */}
              <div className="report-letter-sections-grid" style={{ padding: 0 }}>
                {/* 1. Case Administration */}
                <div className="letter-detail-box">
                  <h4 className="detail-box-title">
                    <FileCheck size={16} />
                    <span>{lang === "si" ? "1. ලිපි පරිපාලනය" : "1. Case Administration"}</span>
                  </h4>
                  <div className="detail-field-list">
                    <div className="detail-field-item">
                      <span className="detail-field-label">File Name</span>
                      <span className="detail-field-value">{selectedLetter.file_name}</span>
                    </div>
                    <div className="detail-field-item">
                      <span className="detail-field-label">Letter Number</span>
                      <span className="detail-field-value">{selectedLetter.ref_number}</span>
                    </div>
                    <div className="detail-field-item">
                      <span className="detail-field-label">Subject File No</span>
                      <span className="detail-field-value">{selectedLetter.subject_file_no || "—"}</span>
                    </div>
                    <div className="detail-field-item">
                      <span className="detail-field-label">Future Action</span>
                      <span className="detail-field-value highlight-action">{selectedLetter.future_action ? t(selectedLetter.future_action, selectedLetter.future_action) : "—"}</span>
                    </div>
                    <div className="detail-field-item">
                      <span className="detail-field-label">Submission Date</span>
                      <span className="detail-field-value">{selectedLetter.date_prepared_and_submitted_for_signature || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Complaint Info */}
                <div className="letter-detail-box">
                  <h4 className="detail-box-title">
                    <FileText size={16} />
                    <span>{lang === "si" ? "2. ලිපිය සහ පැමිණිල්ල" : "2. Letter & Complaint"}</span>
                  </h4>
                  <div className="detail-field-list">
                    <div className="detail-field-item">
                      <span className="detail-field-label">Subject Matter</span>
                      <span className="detail-field-value">{selectedLetter.subject}</span>
                    </div>
                    <div className="detail-field-item">
                      <span className="detail-field-label">{lang === "si" ? "ලිපියේ ස්වභාවය" : "Nature of Letter"}</span>
                      <span className="detail-field-value" style={{ fontWeight: 600, color: "#0369a1" }}>{selectedLetter.nature_of_letter || "—"}</span>
                    </div>
                    <div className="detail-field-item">
                      <span className="detail-field-label">Classification</span>
                      <span className="detail-field-value">{selectedLetter.classification_of_complaint_letter}</span>
                    </div>
                    <div className="detail-field-item">
                      <span className="detail-field-label">Complainant / Sender</span>
                      <span className="detail-field-value">{selectedLetter.name_of_the_presenting_the_complain || "—"}</span>
                    </div>
                    <div className="detail-field-item">
                      <span className="detail-field-label">Complainant Address</span>
                      <span className="detail-field-value">{selectedLetter.address_of_the_person_presenting_the_complaint || "—"}</span>
                    </div>
                    <div className="detail-field-item">
                      <span className="detail-field-label">Receipt Date</span>
                      <span className="detail-field-value">{selectedLetter.received_date || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Accused Officer */}
                <div className="letter-detail-box">
                  <h4 className="detail-box-title">
                    <User size={16} />
                    <span>{lang === "si" ? "3. චෝදනා ලැබූ නිලධාරියා" : "3. Accused Officer"}</span>
                  </h4>
                  <div className="detail-field-list">
                    <div className="detail-field-item">
                      <span className="detail-field-label">Officer Name</span>
                      <span className="detail-field-value">{selectedLetter.accused_officer_name || "—"}</span>
                    </div>
                    <div className="detail-field-item">
                      <span className="detail-field-label">Position / Designation</span>
                      <span className="detail-field-value">{selectedLetter.accused_designation || "—"}</span>
                    </div>
                    <div className="detail-field-item">
                      <span className="detail-field-label">NIC Number</span>
                      <span className="detail-field-value">{selectedLetter.nic_no || "—"}</span>
                    </div>
                    <div className="detail-field-item">
                      <span className="detail-field-label">Date of Birth</span>
                      <span className="detail-field-value">{selectedLetter.date_of_birth || "—"}</span>
                    </div>
                    <div className="detail-field-item">
                      <span className="detail-field-label">Appointment Date</span>
                      <span className="detail-field-value">{selectedLetter.appointment_date || "—"}</span>
                    </div>
                    <div className="detail-field-item">
                      <span className="detail-field-label">Address</span>
                      <span className="detail-field-value">{selectedLetter.officer_address || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* 4. School / Institute */}
                <div className="letter-detail-box">
                  <h4 className="detail-box-title">
                    <Building size={16} />
                    <span>{lang === "si" ? "4. අදාළ පාසල / ආයතනය" : "4. School & Location"}</span>
                  </h4>
                  <div className="detail-field-list">
                    <div className="detail-field-item">
                      <span className="detail-field-label">School / Institute Name</span>
                      <span className="detail-field-value">{selectedLetter.accused_school_name || "—"}</span>
                    </div>
                    <div className="detail-field-item">
                      <span className="detail-field-label">School Address</span>
                      <span className="detail-field-value">{selectedLetter.school_address || "—"}</span>
                    </div>
                    <div className="detail-field-item">
                      <span className="detail-field-label">Province / District / Zone</span>
                      <span className="detail-field-value">
                        {[selectedLetter.province, selectedLetter.district, selectedLetter.zone].filter(Boolean).join(" / ") || "—"}
                      </span>
                    </div>
                    {selectedLetter.add_sec_instructions && (
                      <div className="detail-field-item">
                        <span className="detail-field-label">Additional Secretary Instructions</span>
                        <span className="detail-field-value" style={{ fontStyle: "italic" }}>
                          {selectedLetter.add_sec_instructions}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Disciplinary Inquiry & Inspection Details */}
                {(selectedLetter.inquiry_details || selectedLetter.file_name === "inquiry") && (
                  <div className="letter-detail-box theme-inquiry" style={{ borderLeft: "3px solid #ea580c" }}>
                    <h4 className="detail-box-title" style={{ color: "#c2410c" }}>
                      <ShieldAlert size={16} />
                      <span>{lang === "si" ? "5. විනය විමසුම් විස්තර" : "5. Inquiry & Inspection Details"}</span>
                    </h4>
                    <div className="detail-field-list">
                      <div className="detail-field-item">
                        <span className="detail-field-label">Inquiry Chairman</span>
                        <span className="detail-field-value" style={{ fontWeight: 600 }}>
                          {selectedLetter.inquiry_details?.chairman?.name || "—"}
                          {selectedLetter.inquiry_details?.chairman?.position ? ` (${selectedLetter.inquiry_details.chairman.position})` : ""}
                        </span>
                      </div>
                      <div className="detail-field-item">
                        <span className="detail-field-label">Committee Members</span>
                        <span className="detail-field-value">
                          {selectedLetter.inquiry_details?.members && selectedLetter.inquiry_details.members.length > 0
                            ? selectedLetter.inquiry_details.members.map((m: any) => m.name).join(", ")
                            : "—"}
                        </span>
                      </div>
                      <div className="detail-field-item">
                        <span className="detail-field-label">Report Due Date</span>
                        <span className="detail-field-value">
                          {selectedLetter.inquiry_details?.report_due_date || "—"}
                        </span>
                      </div>
                      <div className="detail-field-item">
                        <span className="detail-field-label">Disciplinary Order</span>
                        <span className="detail-field-value highlight-action" style={{ color: "#c2410c" }}>
                          {selectedLetter.inquiry_details?.disciplinary_order || "—"}
                        </span>
                      </div>
                      {selectedLetter.inquiry_details?.recommendation_report && (
                        <div className="detail-field-item">
                          <span className="detail-field-label">Recommendation Report</span>
                          <span className="detail-field-value">
                            {selectedLetter.inquiry_details.recommendation_report}
                          </span>
                        </div>
                      )}
                      {selectedLetter.inquiry_details?.approval_secretary_status && (
                        <div className="detail-field-item">
                          <span className="detail-field-label">Secretary Approval</span>
                          <span className="detail-field-value">
                            {selectedLetter.inquiry_details.approval_secretary_status}
                            {selectedLetter.inquiry_details.approval_secretary_details ? ` - ${selectedLetter.inquiry_details.approval_secretary_details}` : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="detail-modal-footer">
              <button
                type="button"
                className="btn-card-action btn-print-mini"
                onClick={() => window.print()}
              >
                <Printer size={15} />
                <span>{lang === "si" ? "මුද්‍රණය කරන්න" : "Print"}</span>
              </button>

              <Link
                href={`/subject/add-details?caseNo=${encodeURIComponent(selectedLetter.ref_number)}`}
                className="btn-card-action btn-edit-case"
              >
                <Edit3 size={15} />
                <span>{lang === "si" ? "සංස්කරණයට යන්න" : "Open in Add Details"}</span>
              </Link>

              {(selectedLetter.inquiry_details || selectedLetter.file_name === "inquiry") && (
                <Link
                  href={`/subject/disciplinary-inspection?caseNo=${encodeURIComponent(selectedLetter.ref_number)}`}
                  className="btn-card-action"
                  style={{ background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <Scale size={15} />
                  <span>{lang === "si" ? "විනය පරීක්ෂණ පිටුව" : "Disciplinary Inspection"}</span>
                </Link>
              )}

              <button
                type="button"
                className="btn-card-action btn-view-details"
                onClick={() => setSelectedLetter(null)}
              >
                <span>{lang === "si" ? "වසන්න" : "Close"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
