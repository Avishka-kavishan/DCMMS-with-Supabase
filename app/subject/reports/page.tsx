"use client";

import "../../../i18n";
import "../../daily-mail/daily-mail.css";
import "../../dashboard-common.css";
import "../subject.css";
import "./reports.css";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sidebar } from "@/components/Sidebar";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getCurrentProfile, signOut, UserProfile } from "@/lib/auth";
import {
  FileText,
  Printer,
  Filter,
  Calendar as CalendarIcon,
  CheckCircle,
  Clock,
  RefreshCw,
  Search,
  ChevronRight,
  AlertCircle,
  UserCheck,
  FileSpreadsheet,
  Layers,
  Inbox
} from "lucide-react";

interface ReportCase {
  id: string;
  caseNo: string;
  assignedDate: string;
  receivedDate: string;
  letterDate?: string;
  subject: string;
  priority: "high" | "medium" | "low";
  status: "In Progress" | "Closed" | "Pending" | string;
  officerName?: string;
  extensionStatus?: string;
  extensionTerm?: string;
  answerLettersCount?: number;
  hasDetails?: boolean;
}

export default function SubjectOfficerReportsPage() {
  const { t, i18n } = useTranslation();
  const router = routerHook();
  
  // Sidebar and UI states
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<ReportCase[]>([]);
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [extensionFilter, setExtensionFilter] = useState<string>("all");

  // Load user profile and cases
  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut();
    router.push("/login");
  };

  const getFormattedDate = () => {
    const today = new Date();
    return today.toLocaleDateString("en-GB", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const prof = await getCurrentProfile();
      setProfile(prof);

      const activeOfficerName = prof?.full_name || "Subject Officer";
      const activeNameClean = activeOfficerName.trim().toLowerCase();

      const isOfficerMatched = (targetName: string) => {
        if (!activeNameClean) return true;
        if (!targetName || typeof targetName !== "string" || !targetName.trim()) return false;
        const cleanTarget = targetName.trim().toLowerCase();
        const isGenericTarget =
          cleanTarget === "subject officer" ||
          cleanTarget === "විෂය නිලධාරී" ||
          cleanTarget === "පවරන ලද විෂය භාර නිලධාරී" ||
          cleanTarget === "assigned subject officer" ||
          cleanTarget === "unassigned";
        const isGenericActive =
          activeNameClean === "subject officer" ||
          activeNameClean === "විෂය නිලධාරී" ||
          activeNameClean === "පවරන ලද විෂය භාර නිලධාරී" ||
          activeNameClean === "assigned subject officer";

        if (isGenericTarget || isGenericActive) return true;

        return (
          cleanTarget === activeNameClean ||
          cleanTarget.includes(activeNameClean) ||
          activeNameClean.includes(cleanTarget)
        );
      };

      let fetchedCases: ReportCase[] = [];

      // 1. Fetch from Supabase dcmms_subject table
      if (isSupabaseConfigured) {
        const { data: subjectData, error: subjectError } = await supabase
          .from("dcmms_subject")
          .select("*")
          .order("created_at", { ascending: false });

        if (!subjectError && subjectData) {
          // Fetch extension requests
          const { data: extData } = await supabase
            .from("dcmms_extension_requests")
            .select("*");

          const extMap = new Map<string, any>();
          if (extData) {
            extData.forEach((ex: any) => {
              if (ex.case_no) extMap.set(ex.case_no, ex);
            });
          }

          // Fetch action details
          const { data: detailsData } = await supabase
            .from("dcmms_subject_details")
            .select("case_no");
          const caseDetailsSet = new Set(detailsData ? detailsData.map((d: any) => d.case_no) : []);

          subjectData.forEach((item: any) => {
            const sOfficer = item.officer_name || item.assigned_officer || item.subject_officer || item.subject_officer_name || "";
            if (item.case_no && isOfficerMatched(sOfficer)) {
              const extInfo = extMap.get(item.case_no);
              fetchedCases.push({
                id: item.id || item.case_no,
                caseNo: item.case_no,
                assignedDate: item.assigned_date || item.created_at?.split("T")[0] || "",
                receivedDate: item.received_date || item.assigned_date || "",
                letterDate: item.letter_date || "",
                subject: item.subject || "Discipline Management Case",
                priority: (item.priority?.toLowerCase() as any) || "medium",
                status: item.status || (caseDetailsSet.has(item.case_no) ? "In Progress" : "Pending"),
                officerName: sOfficer || activeOfficerName,
                extensionStatus: extInfo ? extInfo.status : "None",
                extensionTerm: extInfo ? extInfo.extension_term : "None",
                hasDetails: caseDetailsSet.has(item.case_no)
              });
            }
          });
        }
      }

      // 2. Fetch local storage fallback if empty or offline
      if (typeof window !== "undefined") {
        try {
          const localCases = JSON.parse(localStorage.getItem("dcmms_cases") || "[]");
          if (Array.isArray(localCases) && localCases.length > 0) {
            const localExt = JSON.parse(localStorage.getItem("dcmms_extension_requests") || "[]");
            const extMapLocal = new Map<string, any>();
            if (Array.isArray(localExt)) {
              localExt.forEach((ex: any) => {
                if (ex.caseNo) extMapLocal.set(ex.caseNo, ex);
              });
            }

            localCases.forEach((lc: any) => {
              const caseNo = lc.caseNo || lc.case_no || lc.id;
              if (caseNo && !fetchedCases.some((c) => c.caseNo === caseNo)) {
                const sOfficer = lc.officerName || lc.assignedOfficer || "";
                if (isOfficerMatched(sOfficer)) {
                  const extInfo = extMapLocal.get(caseNo);
                  fetchedCases.push({
                    id: lc.id || caseNo,
                    caseNo: caseNo,
                    assignedDate: lc.assignedDate || lc.createdAt?.split("T")[0] || "",
                    receivedDate: lc.receivedDate || lc.assignedDate || "",
                    letterDate: lc.letterDate || "",
                    subject: lc.subject || "Discipline Management Case",
                    priority: (lc.priority?.toLowerCase() as any) || "medium",
                    status: lc.status || "In Progress",
                    officerName: sOfficer || activeOfficerName,
                    extensionStatus: extInfo ? extInfo.status : "None",
                    extensionTerm: extInfo ? extInfo.extensionTerm : "None",
                  });
                }
              }
            });
          }
        } catch (e) {
          console.error("Localstorage cases load error", e);
        }
      }

      // Default sample fallback if no records exist yet
      if (fetchedCases.length === 0) {
        fetchedCases = [
          {
            id: "sample-1",
            caseNo: "INQ/2026/0020",
            assignedDate: "2026-08-06",
            receivedDate: "2026-08-06",
            letterDate: "2026-08-06",
            subject: "Formal disciplinary inquiry regarding misconduct",
            priority: "low",
            status: "In Progress",
            officerName: activeOfficerName,
            extensionStatus: "None",
            extensionTerm: "Standard Timeline"
          },
          {
            id: "sample-2",
            caseNo: "INQ/2026/0009",
            assignedDate: "2026-07-31",
            receivedDate: "2026-07-31",
            letterDate: "2026-07-28",
            subject: "Submission of explanation letter for provincial officers",
            priority: "low",
            status: "Extension Requested",
            officerName: activeOfficerName,
            extensionStatus: "Pending",
            extensionTerm: "First Extension (1st)"
          }
        ];
      }

      setCases(fetchedCases);
    } catch (err) {
      console.error("Error loading subject reports data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to handle router without SSR warnings
  function routerHook() {
    try {
      return useRouter();
    } catch (e) {
      return { push: (url: string) => { window.location.href = url; } } as any;
    }
  }

  // Filtered cases calculation
  const filteredCases = useMemo(() => {
    return cases.filter((item) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNo = item.caseNo.toLowerCase().includes(q);
        const matchSub = item.subject.toLowerCase().includes(q);
        const matchOfficer = (item.officerName || "").toLowerCase().includes(q);
        if (!matchNo && !matchSub && !matchOfficer) return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "in_progress" && item.status !== "In Progress") return false;
        if (statusFilter === "closed" && item.status !== "Closed") return false;
        if (statusFilter === "pending" && item.status !== "Pending") return false;
        if (statusFilter === "extension_requested" && item.status !== "Extension Requested") return false;
      }

      // Priority filter
      if (priorityFilter !== "all") {
        if (item.priority !== priorityFilter) return false;
      }

      // Extension filter
      if (extensionFilter !== "all") {
        if (extensionFilter === "with_ext" && (!item.extensionStatus || item.extensionStatus === "None")) return false;
        if (extensionFilter === "no_ext" && item.extensionStatus && item.extensionStatus !== "None") return false;
      }

      // Date Range Presets / Inputs
      if (startDate) {
        if (item.assignedDate && item.assignedDate < startDate) return false;
      }
      if (endDate) {
        if (item.assignedDate && item.assignedDate > endDate) return false;
      }

      return true;
    });
  }, [cases, searchQuery, statusFilter, priorityFilter, extensionFilter, startDate, endDate]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = cases.length;
    const inProgress = cases.filter((c) => c.status === "In Progress").length;
    const closed = cases.filter((c) => c.status === "Closed").length;
    const pending = cases.filter((c) => c.status === "Pending" || c.status === "Extension Requested").length;
    const withExtensions = cases.filter((c) => c.extensionStatus && c.extensionStatus !== "None").length;
    const highPriority = cases.filter((c) => c.priority === "high").length;
    const mediumPriority = cases.filter((c) => c.priority === "medium").length;
    const lowPriority = cases.filter((c) => c.priority === "low").length;

    return {
      total,
      inProgress,
      closed,
      pending,
      withExtensions,
      highPriority,
      mediumPriority,
      lowPriority,
      inProgressPct: total > 0 ? Math.round((inProgress / total) * 100) : 0,
      closedPct: total > 0 ? Math.round((closed / total) * 100) : 0,
      pendingPct: total > 0 ? Math.round((pending / total) * 100) : 0
    };
  }, [cases]);

  // Export to CSV
  const exportToCSV = () => {
    if (filteredCases.length === 0) return;
    const isSi = i18n.language === "si";
    const headers = isSi
      ? ["ගොනු අංකය", "විෂයය / මාතෘකාව", "පැවරූ දිනය", "ලැබුණු දිනය", "ප්‍රමුඛතාව", "තත්ත්වය", "කාල දීර්ඝ තත්ත්වය"]
      : ["Case Number", "Subject", "Assigned Date", "Received Date", "Priority", "Status", "Extension Status"];

    const rows = filteredCases.map((c) => [
      `"${c.caseNo}"`,
      `"${c.subject.replace(/"/g, '""')}"`,
      `"${c.assignedDate || "N/A"}"`,
      `"${c.receivedDate || "N/A"}"`,
      `"${c.priority}"`,
      `"${c.status}"`,
      `"${c.extensionStatus || "None"}"`
    ]);

    const bom = "\uFEFF";
    const csvContent = bom + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Subject_Officer_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Report
  const triggerPrint = () => {
    window.print();
  };

  return (
    <div className="dashboard-container" data-font-scale={fontScale}>
      {/* Skip Link (A11y) */}
      <a href="#reports-main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Navigation Sidebar Component */}
      <Sidebar
        role="subject"
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
      />

      <div className="dashboard-layout">
        {/* Main Content Area */}
        <main id="reports-main-content" className="dashboard-content">
          {/* Top App Bar Header Matching Subject Workspace */}
          <header className="dashboard-header">
            <div className="dashboard-header-left">
              <button
                className="menu-toggle-btn"
                aria-label="Toggle Navigation Sidebar"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                <svg className="hamburger-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="dashboard-title-area">
                <h2 className="dashboard-main-title">Subject Officer</h2>
                <p className="dashboard-main-subtitle">Reports & Analytics Workspace</p>
              </div>
            </div>

            <div className="dashboard-header-right">
              {/* Date Badge */}
              <div className="date-badge">
                <span suppressHydrationWarning>{getFormattedDate()}</span>
                <CalendarIcon className="date-icon" />
              </div>

              <div className="divider-line" aria-hidden="true" />

              {/* Accessibility Font Scale Adjuster */}
              <div className="accessibility-adjuster-bar" role="radiogroup" aria-label="Font Sizing Adjustment">
                <label className={`size-btn size-btn-small${fontScale === "small" ? " active" : ""}`}>
                  <input
                    type="radio"
                    name="font-scale"
                    value="small"
                    checked={fontScale === "small"}
                    onChange={() => setFontScale("small")}
                  />
                  A-
                </label>
                <label className={`size-btn size-btn-medium${fontScale === "medium" ? " active" : ""}`}>
                  <input
                    type="radio"
                    name="font-scale"
                    value="medium"
                    checked={fontScale === "medium"}
                    onChange={() => setFontScale("medium")}
                  />
                  A
                </label>
                <label className={`size-btn size-btn-large${fontScale === "large" ? " active" : ""}`}>
                  <input
                    type="radio"
                    name="font-scale"
                    value="large"
                    checked={fontScale === "large"}
                    onChange={() => setFontScale("large")}
                  />
                  A+
                </label>
              </div>

              <div className="divider-line" aria-hidden="true" />

              {/* User Profile Badge */}
              <div className="header-user-badge">
                <UserCheck className="user-icon" />
                <span className="user-name">{profile?.full_name || "Subject Officer"}</span>
              </div>
            </div>
          </header>

          <div className="reports-container">
            {/* Header Banner */}
            <div className="reports-header-card">
              <div className="reports-header-title-area">
                <h1>Subject Officer Reports & Analytics</h1>
                <p>
                  Comprehensive performance analysis, case status tracking, and extension history report.
                </p>
              </div>

              <div className="reports-actions-group">
                <button className="btn-report-action secondary" onClick={loadDashboardData} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  <span>Refresh Data</span>
                </button>

                <button className="btn-report-action secondary" onClick={exportToCSV}>
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export CSV</span>
                </button>

                <button className="btn-report-action primary" onClick={triggerPrint}>
                  <Printer className="w-4 h-4" />
                  <span>Print Report</span>
                </button>
              </div>
            </div>

            {/* Stats KPI Overview */}
            <div className="reports-stats-grid">
              <div className="report-stat-card">
                <div className="report-stat-top">
                  <div className="report-stat-icon-wrapper blue">
                    <Layers className="w-5 h-5" />
                  </div>
                  <span className="report-stat-badge blue">Total Cases</span>
                </div>
                <div className="report-stat-value">{stats.total}</div>
                <div className="report-stat-label">Assigned Discipline Cases</div>
              </div>

              <div className="report-stat-card">
                <div className="report-stat-top">
                  <div className="report-stat-icon-wrapper orange">
                    <Clock className="w-5 h-5" />
                  </div>
                  <span className="report-stat-badge orange">{stats.inProgressPct}% of Total</span>
                </div>
                <div className="report-stat-value">{stats.inProgress}</div>
                <div className="report-stat-label">Cases In Progress</div>
              </div>

              <div className="report-stat-card">
                <div className="report-stat-top">
                  <div className="report-stat-icon-wrapper green">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <span className="report-stat-badge green">{stats.closedPct}% of Total</span>
                </div>
                <div className="report-stat-value">{stats.closed}</div>
                <div className="report-stat-label">Completed / Closed Cases</div>
              </div>

              <div className="report-stat-card">
                <div className="report-stat-top">
                  <div className="report-stat-icon-wrapper yellow">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <span className="report-stat-badge yellow">{stats.pendingPct}% of Total</span>
                </div>
                <div className="report-stat-value">{stats.pending}</div>
                <div className="report-stat-label">Pending / Initial Response</div>
              </div>

              <div className="report-stat-card">
                <div className="report-stat-top">
                  <div className="report-stat-icon-wrapper purple">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <span className="report-stat-badge blue">{stats.withExtensions} Active</span>
                </div>
                <div className="report-stat-value">{stats.withExtensions}</div>
                <div className="report-stat-label">Time Extensions Requested</div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="reports-filter-panel">
              <div className="reports-filter-header">
                <h3>
                  <Filter className="w-4 h-4 text-blue-600" />
                  <span>Report Filters & Search</span>
                </h3>

                {(searchQuery || statusFilter !== "all" || priorityFilter !== "all" || extensionFilter !== "all" || startDate || endDate) && (
                  <button
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline"
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                      setPriorityFilter("all");
                      setExtensionFilter("all");
                      setStartDate("");
                      setEndDate("");
                    }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>

              <div className="reports-filter-grid">
                <div className="filter-group">
                  <label>Search Case / Subject</label>
                  <div className="report-search-wrapper">
                    <Search className="search-icon" />
                    <input
                      type="text"
                      className="filter-control"
                      placeholder="Search Case No or Subject..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="filter-group">
                  <label>Status</label>
                  <select
                    className="filter-control"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Statuses</option>
                    <option value="in_progress">In Progress</option>
                    <option value="closed">Closed</option>
                    <option value="pending">Pending</option>
                    <option value="extension_requested">Extension Requested</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label>Priority</label>
                  <select
                    className="filter-control"
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                  >
                    <option value="all">All Priorities</option>
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label>Time Extensions</label>
                  <select
                    className="filter-control"
                    value={extensionFilter}
                    onChange={(e) => setExtensionFilter(e.target.value)}
                  >
                    <option value="all">All Cases</option>
                    <option value="with_ext">With Extensions</option>
                    <option value="no_ext">Without Extensions</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label>From Date</label>
                  <input
                    type="date"
                    className="filter-control"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div className="filter-group">
                  <label>To Date</label>
                  <input
                    type="date"
                    className="filter-control"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Visual Charts Grid */}
            <div className="reports-charts-grid">
              {/* Status Breakdown Bar */}
              <div className="report-chart-card">
                <h4>Case Status Distribution</h4>
                <div className="chart-bar-container">
                  <div className="chart-bar-item">
                    <div className="chart-bar-label-group">
                      <span>In Progress</span>
                      <span>{stats.inProgress} ({stats.inProgressPct}%)</span>
                    </div>
                    <div className="chart-bar-track">
                      <div
                        className="chart-bar-fill inprogress"
                        style={{ width: `${stats.inProgressPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="chart-bar-item">
                    <div className="chart-bar-label-group">
                      <span>Completed / Closed</span>
                      <span>{stats.closed} ({stats.closedPct}%)</span>
                    </div>
                    <div className="chart-bar-track">
                      <div
                        className="chart-bar-fill closed"
                        style={{ width: `${stats.closedPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="chart-bar-item">
                    <div className="chart-bar-label-group">
                      <span>Pending Action</span>
                      <span>{stats.pending} ({stats.pendingPct}%)</span>
                    </div>
                    <div className="chart-bar-track">
                      <div
                        className="chart-bar-fill pending"
                        style={{ width: `${stats.pendingPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Priority Breakdown Bar */}
              <div className="report-chart-card">
                <h4>Case Priority Breakdown</h4>
                <div className="chart-bar-container">
                  <div className="chart-bar-item">
                    <div className="chart-bar-label-group">
                      <span>High Priority</span>
                      <span>{stats.highPriority}</span>
                    </div>
                    <div className="chart-bar-track">
                      <div
                        className="chart-bar-fill high"
                        style={{ width: `${stats.total > 0 ? (stats.highPriority / stats.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="chart-bar-item">
                    <div className="chart-bar-label-group">
                      <span>Medium Priority</span>
                      <span>{stats.mediumPriority}</span>
                    </div>
                    <div className="chart-bar-track">
                      <div
                        className="chart-bar-fill medium"
                        style={{ width: `${stats.total > 0 ? (stats.mediumPriority / stats.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="chart-bar-item">
                    <div className="chart-bar-label-group">
                      <span>Low Priority</span>
                      <span>{stats.lowPriority}</span>
                    </div>
                    <div className="chart-bar-track">
                      <div
                        className="chart-bar-fill low"
                        style={{ width: `${stats.total > 0 ? (stats.lowPriority / stats.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Reports Data Table */}
            <div className="reports-table-card">
              <div className="reports-table-header">
                <h3>Subject Officer Cases Detailed Log ({filteredCases.length})</h3>
                <div className="text-xs text-gray-500 font-medium">
                  Showing {filteredCases.length} of {cases.length} total entries
                </div>
              </div>

              {filteredCases.length === 0 ? (
                <div className="empty-table-state">
                  <Inbox />
                  <p className="font-semibold text-gray-700 text-base">No cases found matching your criteria</p>
                  <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or date range.</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="reports-table">
                    <thead>
                      <tr>
                        <th>Case No</th>
                        <th>Subject / Description</th>
                        <th>Assigned Date</th>
                        <th>Extension Term</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCases.map((item) => (
                        <tr key={item.id}>
                          <td className="font-semibold text-gray-900">{item.caseNo}</td>
                          <td style={{ maxWidth: "320px" }}>
                            <div className="font-medium text-gray-900 line-clamp-2">{item.subject}</div>
                          </td>
                          <td>{item.assignedDate || "N/A"}</td>
                          <td>
                            {item.extensionStatus && item.extensionStatus !== "None" ? (
                              <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-md font-semibold">
                                {item.extensionTerm || item.extensionStatus}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Standard Timeline</span>
                            )}
                          </td>
                          <td>
                            <span className={`priority-chip ${item.priority}`}>
                              {item.priority}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`status-chip ${
                                item.status === "In Progress"
                                  ? "inprogress"
                                  : item.status === "Closed"
                                  ? "closed"
                                  : "pending"
                              }`}
                            >
                              {item.status === "In Progress" && <Clock className="w-3.5 h-3.5" />}
                              {item.status === "Closed" && <CheckCircle className="w-3.5 h-3.5" />}
                              {(item.status === "Pending" || item.status === "Extension Requested") && <AlertCircle className="w-3.5 h-3.5" />}
                              {item.status}
                            </span>
                          </td>
                          <td className="text-right">
                            <Link
                              href={`/subject/add-details?id=${encodeURIComponent(item.caseNo)}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors"
                            >
                              <span>Details</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
