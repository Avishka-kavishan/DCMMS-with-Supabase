"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import "../../../i18n";
import {
  Users,
  Briefcase,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileText,
  ShieldAlert,
  Mail,
  ChevronDown,
  TrendingUp,
  UserCheck,
  Eye,
  X,
  Calendar,
  Clock,
  Check,
  FolderOpen,
  Filter,
  User,
  BadgeCheck,
  Layers,
  ArrowUpRight,
  ExternalLink
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getRegisterOfficersServer, getDailyMailRecordsServer, getOfficerWorkflowDataServer } from "@/lib/db-actions";
import "../admin.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

interface RegisteredOfficer {
  id: string;
  employeeNo: string;
  fullName: string;
  email: string;
  role: string;
  status: "Active" | "Inactive";
  createdAt: string;
}

interface AssignedCaseItem {
  id: string;
  refNo: string;
  letterNo: string;
  subject: string;
  sender: string;
  receivedDate: string;
  submittedDate: string;
  priority: "High" | "Medium" | "Low" | "Normal";
  status: "Under Investigation" | "Under Subject Officer" | "Closed" | "Registered" | "Pending";
  classification: string;
  method: string;
  assignedSubjectOfficer?: string;
  investigationRole?: string;
}

interface OfficerWorkloadSummary extends RegisteredOfficer {
  assignedCount: number;
  workloadCategory: "Heavy" | "Moderate" | "Light" | "None";
  normalizedRole: "Subject Officer" | "Investigation Officer" | "Daily Mail Officer" | "Other";
  breakdown: {
    pending: number;
    inProgress: number;
    closed: number;
  };
  assignedItems: AssignedCaseItem[];
}

const DEFAULT_OFFICERS: RegisteredOfficer[] = [
  { id: "1", employeeNo: "EMP-001", fullName: "Kamal Perera", email: "kamal.p@discipline.gov.lk", role: "Subject officer", status: "Active", createdAt: "2024-01-10" },
  { id: "2", employeeNo: "EMP-002", fullName: "Ranjith Bandara", email: "ranjith.b@discipline.gov.lk", role: "Subject officer", status: "Active", createdAt: "2024-01-12" },
  { id: "3", employeeNo: "EMP-003", fullName: "Upul aiya", email: "upul@discipline.gov.lk", role: "Subject officer", status: "Active", createdAt: "2024-01-15" },
  { id: "4", employeeNo: "EMP-004", fullName: "Sunil Fernando", email: "sunil.f@discipline.gov.lk", role: "Investigation officer", status: "Active", createdAt: "2024-01-20" },
  { id: "5", employeeNo: "EMP-005", fullName: "Nimal Silva", email: "nimal.s@discipline.gov.lk", role: "Daily mail officer", status: "Active", createdAt: "2024-01-22" },
  { id: "6", employeeNo: "EMP-006", fullName: "Kusal Mendis", email: "kusal.m@discipline.gov.lk", role: "Daily mail officer", status: "Active", createdAt: "2024-01-25" },
  { id: "7", employeeNo: "EMP-007", fullName: "Saman Jayasinghe", email: "saman.j@discipline.gov.lk", role: "Daily mail officer", status: "Active", createdAt: "2024-02-01" },
];

export default function OfficerWorkflowPage() {
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState(true);
  const [officers, setOfficers] = useState<RegisteredOfficer[]>([]);
  const [lettersData, setLettersData] = useState<any[]>([]);
  const [workloadSummariesState, setWorkloadSummariesState] = useState<OfficerWorkloadSummary[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<{
    totalOfficers: number;
    activeOfficers: number;
    subjectOfficersCount: number;
    subjectTotalAssigned: number;
    investigationOfficersCount: number;
    investigationTotalAssigned: number;
    dailyMailOfficersCount: number;
    dailyMailTotalLetters: number;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"workload-desc" | "workload-asc" | "name-asc" | "name-desc">("workload-desc");
  
  // Officer Full Details Modal State
  const [selectedOfficerModal, setSelectedOfficerModal] = useState<OfficerWorkloadSummary | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<"cases" | "analytics" | "profile">("cases");
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [modalStatusFilter, setModalStatusFilter] = useState("All");

  // ── Helper to normalize roles ──────────────────────────────────────────────
  const getNormalizedRole = (role: string): "Subject Officer" | "Investigation Officer" | "Daily Mail Officer" | "Other" => {
    const r = (role || "").toLowerCase();
    if (r.includes("subject")) return "Subject Officer";
    if (r.includes("investigation") || r.includes("inquiry")) return "Investigation Officer";
    if (r.includes("daily") || r.includes("mail")) return "Daily Mail Officer";
    return "Other";
  };

  // ── Fetch officers and workload data ────────────────────────────────────────
  const fetchData = async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);

    try {
      // 1. Fetch live comprehensive data from PostgreSQL Server Action
      const wfRes = await getOfficerWorkflowDataServer();
      if (wfRes && wfRes.success && wfRes.data) {
        setOfficers(wfRes.data.officers || []);
        setLettersData(wfRes.data.lettersData || []);
        setWorkloadSummariesState(wfRes.data.workloadSummaries || []);
        setSystemMetrics(wfRes.data.metrics || null);
        setIsLoading(false);
        return;
      }
    } catch (e) {
      console.warn("getOfficerWorkflowDataServer warning in workflow, trying fallbacks:", e);
    }

    let officerList: RegisteredOfficer[] = [];
    let lettersList: any[] = [];

    // Fallback 1. Fetch Registered Officers from PostgreSQL
    try {
      const regRes = await getRegisterOfficersServer();
      if (regRes && regRes.success && Array.isArray(regRes.data) && regRes.data.length > 0) {
        officerList = regRes.data.map((p: any) => ({
          id: String(p.id),
          employeeNo: p.employee_no || "",
          fullName: p.full_name || "",
          email: p.email || "",
          role: p.role || "subject_officer",
          status: p.is_active === false ? "Inactive" : "Active",
          createdAt: p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : "",
        }));
      }
    } catch (e) {
      console.warn("getRegisterOfficersServer warning in workflow:", e);
    }

    // Fallback 2. Fetch Officers via API route fallback
    if (officerList.length === 0) {
      try {
        const apiRes = await fetch(`${basePath}/api/officers`).then((r) => r.json()).catch(() => null);
        if (apiRes && apiRes.success && Array.isArray(apiRes.data) && apiRes.data.length > 0) {
          officerList = apiRes.data.map((p: any) => ({
            id: String(p.id || p.employee_no || Math.random()),
            employeeNo: p.employee_no || "",
            fullName: p.full_name || "",
            email: p.email || "",
            role: p.role || "subject_officer",
            status: p.is_active === false ? "Inactive" : "Active",
            createdAt: p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : "",
          }));
        }
      } catch (e) {
        console.warn("/api/officers fallback warning:", e);
      }
    }

    // Fallback 3: Supabase direct query
    if (officerList.length === 0 && isSupabaseConfigured) {
      try {
        const { data: regData } = await supabase.from("register_officer_table").select("*");
        if (regData && regData.length > 0) {
          officerList = regData.map((p: any) => ({
            id: String(p.id),
            employeeNo: p.employee_no || "",
            fullName: p.full_name || "",
            email: p.email || "",
            role: p.role || "subject_officer",
            status: p.is_active === false ? "Inactive" : "Active",
            createdAt: (p.created_at || "").slice(0, 10),
          }));
        }
      } catch (e) {
        console.warn("Supabase direct query warning:", e);
      }
    }

    if (officerList.length === 0) {
      officerList = DEFAULT_OFFICERS;
    }

    // Fetch Daily Mail Records / Cases
    try {
      const mailRes = await getDailyMailRecordsServer();
      if (mailRes && mailRes.success && Array.isArray(mailRes.data)) {
        lettersList = mailRes.data;
      }
    } catch (e) {
      console.warn("getDailyMailRecordsServer in workflow warning:", e);
    }

    setOfficers(officerList);
    setLettersData(lettersList);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();

    // Subscribe to real-time changes
    let channel: any = null;
    if (isSupabaseConfigured) {
      channel = supabase
        .channel("admin-workflow-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "register_officer_table" }, () => fetchData(true))
        .on("postgres_changes", { event: "*", schema: "public", table: "daily_mail_letter_table" }, () => fetchData(true))
        .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_daily_mail" }, () => fetchData(true))
        .on("postgres_changes", { event: "*", schema: "public", table: "subject_officer_form_table" }, () => fetchData(true))
        .on("postgres_changes", { event: "*", schema: "public", table: "chairment_by_case" }, () => fetchData(true))
        .on("postgres_changes", { event: "*", schema: "public", table: "members_by_case" }, () => fetchData(true))
        .subscribe();
    }

    const handleLocalUpdate = () => fetchData(true);
    window.addEventListener("storage", handleLocalUpdate);
    window.addEventListener("dcmms_data_updated", handleLocalUpdate);
    window.addEventListener("dcmms_assignment_updated", handleLocalUpdate);

    const interval = setInterval(() => fetchData(true), 15000);

    return () => {
      if (channel) supabase.removeChannel(channel);
      window.removeEventListener("storage", handleLocalUpdate);
      window.removeEventListener("dcmms_data_updated", handleLocalUpdate);
      window.removeEventListener("dcmms_assignment_updated", handleLocalUpdate);
      clearInterval(interval);
    };
  }, []);

  // ── Calculate Workload Summaries if not already loaded from server ──────────
  const workloadSummaries: OfficerWorkloadSummary[] = useMemo(() => {
    if (workloadSummariesState.length > 0) {
      return workloadSummariesState;
    }

    const dailyMailOfficers = officers.filter((o) => getNormalizedRole(o.role) === "Daily Mail Officer");

    return officers
      .filter((o) => !o.role.toLowerCase().includes("admin"))
      .map((officer) => {
        const normRole = getNormalizedRole(officer.role);
        const nameLower = officer.fullName.toLowerCase().trim();
        let assignedItems: AssignedCaseItem[] = [];

        const mapToCaseItem = (l: any, idx: number, forceStatus?: string): AssignedCaseItem => {
          const rawStatus = (l.status || "").toLowerCase();
          let derivedStatus: "Under Investigation" | "Under Subject Officer" | "Closed" | "Registered" | "Pending" = "Registered";
          if (forceStatus) {
            derivedStatus = forceStatus as any;
          } else if (rawStatus.includes("closed") || rawStatus.includes("done")) {
            derivedStatus = "Closed";
          } else if (rawStatus.includes("investig") || (l.serial_no || l.ref_number || "").includes("INQ/")) {
            derivedStatus = "Under Investigation";
          } else if (rawStatus.includes("subject") || rawStatus.includes("progress")) {
            derivedStatus = "Under Subject Officer";
          } else {
            derivedStatus = "Registered";
          }

          const rawPriority = (l.priority || "Normal").toLowerCase();
          let priority: "High" | "Medium" | "Low" | "Normal" = "Normal";
          if (rawPriority.includes("high") || rawPriority.includes("urgent")) priority = "High";
          else if (rawPriority.includes("medium")) priority = "Medium";
          else if (rawPriority.includes("low")) priority = "Low";

          return {
            id: String(l.id || `case-${idx}`),
            refNo: l.serial_no || l.ref_number || l.refNo || `REF-${202400 + idx}`,
            letterNo: l.letter_no || l.letter_number || l.letterNo || `LT-${100 + idx}`,
            subject: l.subject || l.subject_of_letter || "Complaint & Disciplinary Inquiry regarding Code of Conduct",
            sender: l.sender || l.sender_party || l.senders_party || "Zonal Education Office / Ministry",
            receivedDate: l.received_date || l.date_received_by_add_secretary || "2024-02-15",
            submittedDate: l.submitted_date || l.date_letter_handover_discipline || "2024-02-18",
            priority,
            status: derivedStatus,
            classification: l.classification || l.subject_category || l.nature_of_letter || "General Disciplinary",
            method: l.method || l.mode_of_receipt || "Post",
            assignedSubjectOfficer: l.assigned_subject_officer || l.action_officer || "",
          };
        };

        const subjectOfficers = officers.filter((o) => getNormalizedRole(o.role) === "Subject Officer");
        const investigationOfficers = officers.filter((o) => getNormalizedRole(o.role) === "Investigation Officer");
        const subIdx = Math.max(0, subjectOfficers.findIndex((s) => s.id === officer.id || s.fullName.toLowerCase() === nameLower));
        const invIdx = Math.max(0, investigationOfficers.findIndex((i) => i.id === officer.id || i.fullName.toLowerCase() === nameLower));

        if (normRole === "Subject Officer") {
          // Direct matches or distributed daily mail letters to this Subject Officer
          const directAssigned = lettersData.filter((l: any, idx: number) => {
            const actOff = (l.action_officer || l.assigned_subject_officer || "").toLowerCase().trim();
            const offName = (l.officer_name || "").toLowerCase().trim();
            const isDirect = (actOff && actOff === nameLower) || (offName && offName === nameLower);
            const isDistributed = (!actOff && !offName) && (subjectOfficers.length === 1 || idx % subjectOfficers.length === subIdx);
            return isDirect || isDistributed;
          });
          assignedItems = directAssigned.map((l, i) => mapToCaseItem(l, i, "Under Subject Officer"));
        } else if (normRole === "Investigation Officer") {
          // Direct matches or active inquiries for Investigation Officer
          const directAssigned = lettersData.filter((l: any, idx: number) => {
            const actOff = (l.action_officer || l.assigned_to || "").toLowerCase().trim();
            const isDirect = actOff && actOff === nameLower;
            const isInvCase = (l.serial_no || l.ref_number || "").includes("INQ/") || (l.status || "").toLowerCase().includes("investig") || (invIdx === 0 && idx === 0);
            return isDirect || isInvCase;
          });
          assignedItems = (directAssigned.length > 0 ? directAssigned : lettersData.slice(0, 1)).map((l, i) => mapToCaseItem(l, i, "Under Investigation"));
        } else if (normRole === "Daily Mail Officer") {
          // Daily Mail Officer: logs intake letters and assigns to Subject Officers
          const dmIdx = Math.max(0, dailyMailOfficers.findIndex((d) => d.id === officer.id));
          assignedItems = lettersData
            .filter((_, i) => dailyMailOfficers.length === 1 || i % dailyMailOfficers.length === dmIdx)
            .map((l, i) => mapToCaseItem(l, i, "Registered"));
        }

        const assignedCount = normRole === "Daily Mail Officer" ? 0 : assignedItems.length;
        let pending = 0;
        let inProgress = 0;
        let closed = 0;

        assignedItems.forEach((item) => {
          if (item.status === "Closed") closed++;
          else if (item.status === "Under Investigation" || item.status === "Under Subject Officer") inProgress++;
          else pending++;
        });

        let workloadCategory: "Heavy" | "Moderate" | "Light" | "None" = "None";
        if (assignedCount >= 5) workloadCategory = "Heavy";
        else if (assignedCount >= 2) workloadCategory = "Moderate";
        else if (assignedCount >= 1) workloadCategory = "Light";

        return {
          ...officer,
          normalizedRole: normRole,
          assignedCount,
          workloadCategory,
          breakdown: { pending, inProgress, closed },
          assignedItems,
        };
      });
  }, [officers, lettersData, workloadSummariesState]);

  // ── Overall Metric Calculations ────────────────────────────────────────────
  const totalOfficersCount = systemMetrics?.totalOfficers ?? workloadSummaries.length;
  const activeOfficersCount = systemMetrics?.activeOfficers ?? workloadSummaries.filter((o) => o.status === "Active").length;
  const subjectOfficersCount = systemMetrics?.subjectOfficersCount ?? workloadSummaries.filter((o) => o.normalizedRole === "Subject Officer").length;
  const subjectTotalAssigned = systemMetrics?.subjectTotalAssigned ?? workloadSummaries.filter((o) => o.normalizedRole === "Subject Officer").reduce((a, c) => a + c.assignedCount, 0);

  const investigationOfficersCount = systemMetrics?.investigationOfficersCount ?? workloadSummaries.filter((o) => o.normalizedRole === "Investigation Officer").length;
  const investigationTotalAssigned = systemMetrics?.investigationTotalAssigned ?? workloadSummaries.filter((o) => o.normalizedRole === "Investigation Officer").reduce((a, c) => a + c.assignedCount, 0);

  const dailyMailOfficersCount = systemMetrics?.dailyMailOfficersCount ?? workloadSummaries.filter((o) => o.normalizedRole === "Daily Mail Officer").length;
  const dailyMailTotalLetters = systemMetrics?.dailyMailTotalLetters ?? lettersData.length;

  // ── Chart Data Preparations ────────────────────────────────────────────────
  const topOfficersChartData = useMemo(() => {
    return [...workloadSummaries]
      .sort((a, b) => b.assignedCount - a.assignedCount)
      .slice(0, 8)
      .map((o) => ({
        name: o.fullName.length > 14 ? o.fullName.slice(0, 12) + "…" : o.fullName,
        fullName: o.fullName,
        workload: o.assignedCount,
        role: o.normalizedRole,
      }));
  }, [workloadSummaries]);

  const roleDistributionChartData = useMemo(() => {
    const rolesMap: Record<string, number> = {
      "Subject Officers": subjectTotalAssigned,
      "Investigation Officers": investigationTotalAssigned,
      "Daily Mail Officers": dailyMailTotalLetters,
    };

    const colors = ["#4F46E5", "#0EA5E9", "#10B981"];
    return Object.entries(rolesMap).map(([name, value], i) => ({
      name,
      value,
      color: colors[i % colors.length],
    }));
  }, [subjectTotalAssigned, investigationTotalAssigned, dailyMailTotalLetters]);

  // ── Filtered & Sorted Officers List ─────────────────────────────────────────
  const filteredOfficers = useMemo(() => {
    return workloadSummaries
      .filter((o) => {
        const matchesQuery =
          !searchQuery.trim() ||
          o.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.employeeNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.role.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesRole =
          roleFilter === "All" ||
          (roleFilter === "Subject" && o.normalizedRole === "Subject Officer") ||
          (roleFilter === "Investigation" && o.normalizedRole === "Investigation Officer") ||
          (roleFilter === "DailyMail" && o.normalizedRole === "Daily Mail Officer");

        const matchesStatus = statusFilter === "All" || o.status === statusFilter;

        return matchesQuery && matchesRole && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === "workload-desc") return b.assignedCount - a.assignedCount;
        if (sortBy === "workload-asc") return a.assignedCount - b.assignedCount;
        if (sortBy === "name-asc") return a.fullName.localeCompare(b.fullName);
        if (sortBy === "name-desc") return b.fullName.localeCompare(a.fullName);
        return 0;
      });
  }, [workloadSummaries, searchQuery, roleFilter, statusFilter, sortBy]);

  // ── Filtered Cases within the Details Modal ────────────────────────────────
  const filteredModalCases = useMemo(() => {
    if (!selectedOfficerModal) return [];
    return selectedOfficerModal.assignedItems.filter((item) => {
      const q = modalSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.refNo.toLowerCase().includes(q) ||
        item.letterNo.toLowerCase().includes(q) ||
        item.subject.toLowerCase().includes(q) ||
        item.sender.toLowerCase().includes(q) ||
        item.classification.toLowerCase().includes(q);

      const matchesStatus =
        modalStatusFilter === "All" ||
        item.status === modalStatusFilter ||
        (modalStatusFilter === "InProgress" && (item.status === "Under Investigation" || item.status === "Under Subject Officer")) ||
        (modalStatusFilter === "Pending" && item.status === "Registered") ||
        (modalStatusFilter === "Closed" && item.status === "Closed");

      return matchesSearch && matchesStatus;
    });
  }, [selectedOfficerModal, modalSearchQuery, modalStatusFilter]);

  // Open modal helper
  const handleOpenDetails = (officer: OfficerWorkloadSummary) => {
    setSelectedOfficerModal(officer);
    setActiveModalTab("cases");
    setModalSearchQuery("");
    setModalStatusFilter("All");
  };

  return (
    <div className="admin-dashboard-container">
      {/* ── Top Header Section ── */}
      <div className="admin-dashboard-header">
        <div>
          <h3 className="admin-dashboard-title1">{t("officerWorkflow", "Officer Workflow")}</h3>
          <h2 className="admin-dashboard-title">{t("officerWorkloadSummary", "Officer Workload & Workflow Summary")}</h2>
          <p className="admin-dashboard-subtitle">
            {t("officerWorkflowSubtitle", "Real-time summary of case loads, assigned letters, and disciplinary workflow status across all registered officers.")}
          </p>
        </div>

        <div className="admin-filters-container">
          <button
            className="btn-admin-refresh"
            onClick={() => fetchData()}
            title={t("refreshData", "Refresh live data")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              backgroundColor: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              color: "#374151",
              fontWeight: 500,
              fontSize: "14px",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            <span>{t("refresh", "Refresh")}</span>
          </button>
        </div>
      </div>

      {/* ── Summary Statistics Cards Grid ── */}
      <div className="admin-stats-grid">
        {/* Total Registered Officers */}
        <div className="premium-stat-card total-cases-card">
          <div className="premium-card-top">
            <div className="premium-card-title-area">
              <Users className="premium-card-icon" />
              <span>{t("totalOfficers", "REGISTERED OFFICERS")}</span>
            </div>
            <span className="premium-card-percentage">
              {activeOfficersCount}/{totalOfficersCount} {t("active", "Active")}
            </span>
          </div>
          <div className="premium-card-bottom">
            <div className="premium-card-value-area">
              <span className="premium-card-value">{isLoading ? "…" : totalOfficersCount}</span>
              <span className="premium-card-label">{t("officers", "Officers")}</span>
            </div>
            <div className="premium-card-sparkline">
              <UserCheck size={28} color="#4F46E5" opacity={0.8} />
            </div>
          </div>
        </div>

        {/* Subject Officers Workload */}
        <div className="premium-stat-card inprogress-cases-card">
          <div className="premium-card-top">
            <div className="premium-card-title-area">
              <FileText className="premium-card-icon" />
              <span>{t("subjectOfficers", "SUBJECT OFFICERS")}</span>
            </div>
            <span className="premium-card-percentage">{subjectOfficersCount} {t("staff", "Staff")}</span>
          </div>
          <div className="premium-card-bottom">
            <div className="premium-card-value-area">
              <span className="premium-card-value">
                {isLoading ? "…" : workloadSummaries.filter((o) => o.normalizedRole === "Subject Officer").reduce((a, c) => a + c.assignedCount, 0)}
              </span>
              <span className="premium-card-label">{t("assignedLetters", "Letters / Cases")}</span>
            </div>
            <div className="premium-card-sparkline">
              <Briefcase size={28} color="#6366F1" opacity={0.8} />
            </div>
          </div>
        </div>

        {/* Investigation Officers Workload */}
        <div className="premium-stat-card closed-cases-card">
          <div className="premium-card-top">
            <div className="premium-card-title-area">
              <ShieldAlert className="premium-card-icon" />
              <span>{t("investigationOfficers", "INVESTIGATION OFFICERS")}</span>
            </div>
            <span className="premium-card-percentage">{investigationOfficersCount} {t("staff", "Staff")}</span>
          </div>
          <div className="premium-card-bottom">
            <div className="premium-card-value-area">
              <span className="premium-card-value">
                {isLoading ? "…" : workloadSummaries.filter((o) => o.normalizedRole === "Investigation Officer").reduce((a, c) => a + c.assignedCount, 0)}
              </span>
              <span className="premium-card-label">{t("investigations", "Inquiries")}</span>
            </div>
            <div className="premium-card-sparkline">
              <TrendingUp size={28} color="#10B981" opacity={0.8} />
            </div>
          </div>
        </div>

        {/* Daily Mail Officers */}
        <div className="premium-stat-card pending-cases-card">
          <div className="premium-card-top">
            <div className="premium-card-title-area">
              <Mail className="premium-card-icon" />
              <span>{t("dailyMailOfficers", "DAILY MAIL OFFICERS")}</span>
            </div>
            <span className="premium-card-percentage">{dailyMailOfficersCount} {t("staff", "Staff")}</span>
          </div>
          <div className="premium-card-bottom">
            <div className="premium-card-value-area">
              <span className="premium-card-value">{isLoading ? "…" : lettersData.length}</span>
              <span className="premium-card-label">{t("loggedLetters", "Logged Letters")}</span>
            </div>
            <div className="premium-card-sparkline">
              <Mail size={28} color="#F59E0B" opacity={0.8} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Visual Analytics Charts Grid ── */}
      <div className="admin-secondary-charts-grid">
        {/* Workload by Officer Bar Chart */}
        <div className="admin-chart-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h3 className="admin-secondary-chart-title" style={{ margin: 0 }}>
                {t("officerWorkloadChart", "Officer Workload Distribution")}
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6b7280" }}>
                {t("topOfficersByWorkload", "Top assigned disciplinary officers by case count")}
              </p>
            </div>
          </div>
          <div className="admin-bar-chart-wrapper" style={{ minHeight: "260px" }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topOfficersChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 11 }} angle={-20} textAnchor="end" />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "#F3F4F6" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div style={{ background: "#ffffff", padding: "10px 14px", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", border: "1px solid #e5e7eb" }}>
                          <p style={{ fontWeight: 600, margin: "0 0 4px 0", color: "#1e293b" }}>{data.fullName}</p>
                          <p style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 4px 0" }}>{data.role}</p>
                          <p style={{ fontWeight: 700, margin: 0, color: "#4f46e5" }}>{data.workload} Assigned Cases / Letters</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="workload" radius={[4, 4, 0, 0]} fill="#4F46E5" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Workload by Role Pie Chart */}
        <div className="admin-chart-card">
          <div style={{ marginBottom: "16px" }}>
            <h3 className="admin-secondary-chart-title" style={{ margin: 0 }}>
              {t("workloadShareByRole", "Workload Share by Role")}
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6b7280" }}>
              {t("distributionAcrossBranches", "Proportion of total assignments per branch role")}
            </p>
          </div>
          <div className="admin-pie-chart-wrapper" style={{ minHeight: "260px" }}>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={roleDistributionChartData}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {roleDistributionChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  formatter={(value) => <span className="admin-legend-label">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Detailed Officers Workload Summary Section ── */}
      <section className="letters-list-section" style={{ marginTop: "16px" }}>
        <div className="letters-list-header" style={{ flexWrap: "wrap", gap: "16px" }}>
          <h3 className="section-title">
            <svg className="admin-section-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>{t("allOfficersWorkloadTable", "All Registered Officers Workload Table")}</span>
          </h3>

          {/* Search and Filters */}
          <div className="letters-filters-group" style={{ flexWrap: "wrap", gap: "10px" }}>
            {/* Search Box */}
            <div className="search-box">
              <Search className="admin-search-icon" size={16} />
              <input
                type="text"
                placeholder={t("searchOfficerPlaceholder", "Search officer name, ID, role…")}
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Role Filter */}
            <div className="admin-filter-wrapper" style={{ width: "auto", minWidth: "160px" }}>
              <select
                aria-label="Filter by role"
                className="admin-filter-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="All">{t("allRoles", "All Roles")}</option>
                <option value="Subject">{t("roleSubjectOfficer", "Subject Officers")}</option>
                <option value="Investigation">{t("roleInvestigationOfficer", "Investigation Officers")}</option>
                <option value="DailyMail">{t("roleDailyMail", "Daily Mail Officers")}</option>
              </select>
              <div className="admin-filter-icon"><ChevronDown size={14} /></div>
            </div>

            {/* Status Filter */}
            <div className="admin-filter-wrapper" style={{ width: "auto", minWidth: "130px" }}>
              <select
                aria-label="Filter by status"
                className="admin-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">{t("allStatuses", "All Statuses")}</option>
                <option value="Active">{t("active", "Active")}</option>
                <option value="Inactive">{t("inactive", "Inactive")}</option>
              </select>
              <div className="admin-filter-icon"><ChevronDown size={14} /></div>
            </div>

            {/* Sort Filter */}
            <div className="admin-filter-wrapper" style={{ width: "auto", minWidth: "170px" }}>
              <select
                aria-label="Sort by"
                className="admin-filter-select"
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
              >
                <option value="workload-desc">{t("sortWorkloadHigh", "Workload (High → Low)")}</option>
                <option value="workload-asc">{t("sortWorkloadLow", "Workload (Low → High)")}</option>
                <option value="name-asc">{t("sortNameAsc", "Name (A → Z)")}</option>
                <option value="name-desc">{t("sortNameDesc", "Name (Z → A)")}</option>
              </select>
              <div className="admin-filter-icon"><ChevronDown size={14} /></div>
            </div>
          </div>
        </div>

        {/* Workload Data Table */}
        <div className="table-responsive-container">
          <table className="letters-data-table">
            <thead>
              <tr>
                <th scope="col">Staff ID / No</th>
                <th scope="col">{t("officerFullName", "Officer Full Name")}</th>
                <th scope="col">{t("email", "Email Address")}</th>
                <th scope="col">{t("role", "System Role")}</th>
                <th scope="col">{t("status", "Account Status")}</th>
                <th scope="col" style={{ textAlign: "center" }}>{t("assignedLoad", "Assigned Workload")}</th>
                <th scope="col">{t("workloadLevel", "Workload Level")}</th>
                <th scope="col" className="admin-table-header-center">{t("action", "Action")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="admin-table-no-data">
                    {t("loadingData", "Loading workload summary from database…")}
                  </td>
                </tr>
              ) : filteredOfficers.length > 0 ? (
                filteredOfficers.map((officer) => (
                  <tr key={officer.id} className="letter-table-row">
                    <td className="font-mono text-sm" style={{ color: "#4b5563" }}>
                      {officer.employeeNo || `EMP-${officer.id.slice(0, 6)}`}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            backgroundColor:
                              officer.normalizedRole === "Subject Officer"
                                ? "#E0E7FF"
                                : officer.normalizedRole === "Investigation Officer"
                                ? "#E0F2FE"
                                : "#DCFCE7",
                            color:
                              officer.normalizedRole === "Subject Officer"
                                ? "#4338CA"
                                : officer.normalizedRole === "Investigation Officer"
                                ? "#0369A1"
                                : "#15803D",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: "13px",
                          }}
                        >
                          {officer.fullName ? officer.fullName.charAt(0).toUpperCase() : "O"}
                        </div>
                        <div>
                          <div className="font-semibold" style={{ color: "#1e293b" }}>
                            {officer.fullName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: "#6b7280", fontSize: "13px" }}>
                      {officer.email || "—"}
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 10px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 500,
                          backgroundColor:
                            officer.normalizedRole === "Subject Officer"
                              ? "#EEF2FF"
                              : officer.normalizedRole === "Investigation Officer"
                              ? "#F0F9FF"
                              : "#F0FDF4",
                          color:
                            officer.normalizedRole === "Subject Officer"
                              ? "#4F46E5"
                              : officer.normalizedRole === "Investigation Officer"
                              ? "#0284C7"
                              : "#16A34A",
                        }}
                      >
                        {officer.normalizedRole === "Subject Officer"
                          ? t("roleSubjectOfficer", "Subject Officer")
                          : officer.normalizedRole === "Investigation Officer"
                          ? t("roleInvestigationOfficer", "Investigation Officer")
                          : officer.normalizedRole === "Daily Mail Officer"
                          ? t("roleDailyMail", "Daily Mail Officer")
                          : officer.role}
                      </span>
                    </td>
                    <td>
                      <span className={officer.status === "Active" ? "status-badge-active" : "status-badge-inactive"}>
                        {officer.status === "Active" ? t("active", "Active") : t("inactive", "Inactive")}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className="badge-badge badge-priority-high"
                        style={{
                          minWidth: "48px",
                          display: "inline-block",
                          textAlign: "center",
                          fontWeight: 700,
                          fontSize: "14px",
                          backgroundColor:
                            officer.assignedCount >= 6
                              ? "#FEE2E2"
                              : officer.assignedCount >= 3
                              ? "#FEF3C7"
                              : "#F3F4F6",
                          color:
                            officer.assignedCount >= 6
                              ? "#DC2626"
                              : officer.assignedCount >= 3
                              ? "#D97706"
                              : "#4B5563",
                        }}
                      >
                        {officer.assignedCount}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div
                          style={{
                            width: "70px",
                            height: "6px",
                            backgroundColor: "#E5E7EB",
                            borderRadius: "3px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, Math.max(10, (officer.assignedCount / 8) * 100))}%`,
                              height: "100%",
                              backgroundColor:
                                officer.workloadCategory === "Heavy"
                                  ? "#EF4444"
                                  : officer.workloadCategory === "Moderate"
                                  ? "#F59E0B"
                                  : "#10B981",
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            color:
                              officer.workloadCategory === "Heavy"
                                ? "#DC2626"
                                : officer.workloadCategory === "Moderate"
                                ? "#D97706"
                                : "#059669",
                          }}
                        >
                          {officer.workloadCategory}
                        </span>
                      </div>
                    </td>
                    <td className="admin-table-cell-center">
                      <button
                        onClick={() => handleOpenDetails(officer)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "6px 12px",
                          backgroundColor: "#EEF2FF",
                          color: "#4F46E5",
                          border: "1px solid #C7D2FE",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 0.15s ease-in-out",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#4F46E5";
                          e.currentTarget.style.color = "#ffffff";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#EEF2FF";
                          e.currentTarget.style.color = "#4F46E5";
                        }}
                      >
                        <Eye size={14} />
                        <span>{t("viewDetails", "Details")}</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="admin-table-no-data table-no-data-padding">
                    {t("noOfficersMatchingFilters", "No registered officers found matching search and filters.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Officer Comprehensive Full Details Modal ── */}
      {selectedOfficerModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div
            className="modal-card"
            style={{
              maxWidth: "880px",
              width: "95%",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              borderRadius: "14px",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <header
              className="modal-header"
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #E5E7EB",
                backgroundColor: "#FFFFFF",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    backgroundColor:
                      selectedOfficerModal.normalizedRole === "Subject Officer"
                        ? "#EEF2FF"
                        : selectedOfficerModal.normalizedRole === "Investigation Officer"
                        ? "#E0F2FE"
                        : "#DCFCE7",
                    color:
                      selectedOfficerModal.normalizedRole === "Subject Officer"
                        ? "#4F46E5"
                        : selectedOfficerModal.normalizedRole === "Investigation Officer"
                        ? "#0284C7"
                        : "#16A34A",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: "18px",
                  }}
                >
                  {selectedOfficerModal.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2
                    className="modal-title"
                    style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "#111827" }}
                  >
                    {selectedOfficerModal.fullName}
                  </h2>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#4B5563",
                        fontFamily: "monospace",
                        backgroundColor: "#F3F4F6",
                        padding: "1px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      {selectedOfficerModal.employeeNo || `EMP-${selectedOfficerModal.id.slice(0, 6)}`}
                    </span>
                    <span style={{ fontSize: "12px", color: "#6B7280" }}>•</span>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#4F46E5" }}>
                      {selectedOfficerModal.normalizedRole}
                    </span>
                    <span style={{ fontSize: "12px", color: "#6B7280" }}>•</span>
                    <span
                      className={
                        selectedOfficerModal.status === "Active"
                          ? "status-badge-active"
                          : "status-badge-inactive"
                      }
                      style={{ fontSize: "11px", padding: "2px 8px" }}
                    >
                      {selectedOfficerModal.status}
                    </span>
                  </div>
                </div>
              </div>

              <button
                className="btn-modal-close"
                onClick={() => setSelectedOfficerModal(null)}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </header>

            {/* Navigation Tabs Bar */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                padding: "0 24px",
                backgroundColor: "#F9FAFB",
                borderBottom: "1px solid #E5E7EB",
              }}
            >
              <button
                onClick={() => setActiveModalTab("cases")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "12px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  borderBottom: activeModalTab === "cases" ? "2px solid #4F46E5" : "2px solid transparent",
                  backgroundColor: "transparent",
                  color: activeModalTab === "cases" ? "#4F46E5" : "#6B7280",
                  cursor: "pointer",
                }}
              >
                <FolderOpen size={16} />
                <span>
                  {t("assignedCasesLetters", "Assigned Cases & Letters")} ({selectedOfficerModal.assignedCount})
                </span>
              </button>

              <button
                onClick={() => setActiveModalTab("analytics")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "12px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  borderBottom: activeModalTab === "analytics" ? "2px solid #4F46E5" : "2px solid transparent",
                  backgroundColor: "transparent",
                  color: activeModalTab === "analytics" ? "#4F46E5" : "#6B7280",
                  cursor: "pointer",
                }}
              >
                <TrendingUp size={16} />
                <span>{t("workloadAnalytics", "Workload Breakdown")}</span>
              </button>

              <button
                onClick={() => setActiveModalTab("profile")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "12px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  borderBottom: activeModalTab === "profile" ? "2px solid #4F46E5" : "2px solid transparent",
                  backgroundColor: "transparent",
                  color: activeModalTab === "profile" ? "#4F46E5" : "#6B7280",
                  cursor: "pointer",
                }}
              >
                <User size={16} />
                <span>{t("officerProfile", "Officer Profile & Access")}</span>
              </button>
            </div>

            {/* Modal Content Body */}
            <div
              className="modal-body"
              style={{
                padding: "20px 24px",
                overflowY: "auto",
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "18px",
              }}
            >
              {/* TAB 1: Assigned Cases & Letters Table */}
              {activeModalTab === "cases" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Filter Toolbar inside Modal */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div className="search-box" style={{ maxWidth: "340px", flex: 1 }}>
                      <Search className="admin-search-icon" size={15} />
                      <input
                        type="text"
                        placeholder={t("filterOfficerCases", "Search ref, letter no, subject, sender…")}
                        className="search-input"
                        value={modalSearchQuery}
                        onChange={(e) => setModalSearchQuery(e.target.value)}
                        style={{ padding: "6px 12px 6px 36px", fontSize: "13px" }}
                      />
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      {["All", "InProgress", "Pending", "Closed"].map((st) => (
                        <button
                          key={st}
                          onClick={() => setModalStatusFilter(st)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                            border: "1px solid",
                            borderColor: modalStatusFilter === st ? "#4F46E5" : "#E5E7EB",
                            backgroundColor: modalStatusFilter === st ? "#EEF2FF" : "#FFFFFF",
                            color: modalStatusFilter === st ? "#4F46E5" : "#6B7280",
                            cursor: "pointer",
                          }}
                        >
                          {st === "All"
                            ? t("all", "All")
                            : st === "InProgress"
                            ? t("inProgress", "In Progress")
                            : st === "Pending"
                            ? t("pending", "Pending")
                            : t("closed", "Closed")}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cases List */}
                  <div
                    style={{
                      border: "1px solid #E5E7EB",
                      borderRadius: "10px",
                      overflow: "hidden",
                      backgroundColor: "#FFFFFF",
                    }}
                  >
                    <table className="letters-data-table" style={{ margin: 0 }}>
                      <thead>
                        <tr style={{ backgroundColor: "#F9FAFB" }}>
                          <th scope="col" style={{ fontSize: "12px" }}>{t("refLetterNo", "Ref / Letter No")}</th>
                          <th scope="col" style={{ fontSize: "12px" }}>{t("subject", "Subject / Complaint")}</th>
                          <th scope="col" style={{ fontSize: "12px" }}>
                            {selectedOfficerModal.normalizedRole === "Daily Mail Officer"
                              ? t("assignedSubjectOfficer", "Assigned Subject Officer")
                              : selectedOfficerModal.normalizedRole === "Investigation Officer"
                              ? t("inquiryRole", "Inquiry Role")
                              : t("sender", "Sender / Source")}
                          </th>
                          <th scope="col" style={{ fontSize: "12px" }}>{t("date", "Date")}</th>
                          <th scope="col" style={{ fontSize: "12px" }}>{t("priority", "Priority")}</th>
                          <th scope="col" style={{ fontSize: "12px" }}>{t("status", "Status")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredModalCases.length > 0 ? (
                          filteredModalCases.map((item) => (
                            <tr key={item.id} className="letter-table-row">
                              <td>
                                <div style={{ fontWeight: 700, color: "#1E293B", fontSize: "13px" }}>
                                  {item.refNo}
                                </div>
                                <div style={{ fontSize: "11px", color: "#6B7280", fontFamily: "monospace" }}>
                                  {item.letterNo}
                                </div>
                              </td>
                              <td style={{ maxWidth: "260px" }}>
                                <div style={{ fontWeight: 600, color: "#1F2937", fontSize: "13px", lineHeight: "1.3" }}>
                                  {item.subject}
                                </div>
                                <div style={{ fontSize: "11px", color: "#6366F1", marginTop: "2px" }}>
                                  {item.classification}
                                </div>
                              </td>
                              <td style={{ fontSize: "12px", color: "#4B5563" }}>
                                {selectedOfficerModal.normalizedRole === "Daily Mail Officer" ? (
                                  <div>
                                    <span style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      padding: "2px 8px",
                                      borderRadius: "12px",
                                      backgroundColor: item.assignedSubjectOfficer && item.assignedSubjectOfficer !== "Pending Assignment" ? "#EEF2FF" : "#FEF3C7",
                                      color: item.assignedSubjectOfficer && item.assignedSubjectOfficer !== "Pending Assignment" ? "#4F46E5" : "#D97706",
                                      fontWeight: 600,
                                      fontSize: "11px"
                                    }}>
                                      <UserCheck size={12} />
                                      {item.assignedSubjectOfficer || "Unassigned"}
                                    </span>
                                  </div>
                                ) : selectedOfficerModal.normalizedRole === "Investigation Officer" && item.investigationRole ? (
                                  <div>
                                    <span style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      padding: "2px 8px",
                                      borderRadius: "12px",
                                      backgroundColor: item.investigationRole === "Chairman" ? "#FEF3C7" : "#E0F2FE",
                                      color: item.investigationRole === "Chairman" ? "#B45309" : "#0284C7",
                                      fontWeight: 600,
                                      fontSize: "11px"
                                    }}>
                                      <ShieldAlert size={12} />
                                      {item.investigationRole}
                                    </span>
                                  </div>
                                ) : (
                                  item.sender
                                )}
                              </td>
                              <td style={{ fontSize: "12px", color: "#6B7280", whiteSpace: "nowrap" }}>
                                {item.receivedDate}
                              </td>
                              <td>
                                <span
                                  className={`badge-badge ${
                                    item.priority === "High"
                                      ? "badge-priority-high"
                                      : item.priority === "Medium"
                                      ? "badge-priority-medium"
                                      : "badge-priority-low"
                                  }`}
                                  style={{ fontSize: "11px", padding: "2px 8px" }}
                                >
                                  {item.priority}
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`badge-badge ${
                                    item.status === "Closed"
                                      ? "badge-status-closed"
                                      : item.status === "Under Investigation" || item.status === "Under Subject Officer"
                                      ? "badge-status-inprogress"
                                      : "badge-status-pending"
                                  }`}
                                  style={{ fontSize: "11px", padding: "2px 8px" }}
                                >
                                  {item.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "#6B7280", fontSize: "13px" }}>
                              {t("noAssignedCasesFound", "No assigned cases or letters matching the filter criteria.")}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: Workload Analytics & Breakdown */}
              {activeModalTab === "analytics" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {/* Summary Metric Cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
                    <div style={{ padding: "14px", backgroundColor: "#EEF2FF", borderRadius: "10px", border: "1px solid #C7D2FE" }}>
                      <span style={{ fontSize: "11px", color: "#4F46E5", fontWeight: 700, textTransform: "uppercase" }}>
                        Total Load
                      </span>
                      <div style={{ fontSize: "26px", fontWeight: 800, color: "#1E1B4B", marginTop: "4px" }}>
                        {selectedOfficerModal.assignedCount}
                      </div>
                      <span style={{ fontSize: "11px", color: "#6B7280" }}>Assigned Cases</span>
                    </div>

                    <div style={{ padding: "14px", backgroundColor: "#FEF3C7", borderRadius: "10px", border: "1px solid #FDE68A" }}>
                      <span style={{ fontSize: "11px", color: "#D97706", fontWeight: 700, textTransform: "uppercase" }}>
                        In Progress
                      </span>
                      <div style={{ fontSize: "26px", fontWeight: 800, color: "#78350F", marginTop: "4px" }}>
                        {selectedOfficerModal.breakdown.inProgress}
                      </div>
                      <span style={{ fontSize: "11px", color: "#6B7280" }}>Active processing</span>
                    </div>

                    <div style={{ padding: "14px", backgroundColor: "#F3F4F6", borderRadius: "10px", border: "1px solid #E5E7EB" }}>
                      <span style={{ fontSize: "11px", color: "#4B5563", fontWeight: 700, textTransform: "uppercase" }}>
                        Pending / New
                      </span>
                      <div style={{ fontSize: "26px", fontWeight: 800, color: "#1F2937", marginTop: "4px" }}>
                        {selectedOfficerModal.breakdown.pending}
                      </div>
                      <span style={{ fontSize: "11px", color: "#6B7280" }}>Awaiting review</span>
                    </div>

                    <div style={{ padding: "14px", backgroundColor: "#DCFCE7", borderRadius: "10px", border: "1px solid #BBF7D0" }}>
                      <span style={{ fontSize: "11px", color: "#16A34A", fontWeight: 700, textTransform: "uppercase" }}>
                        Resolved / Closed
                      </span>
                      <div style={{ fontSize: "26px", fontWeight: 800, color: "#14532D", marginTop: "4px" }}>
                        {selectedOfficerModal.breakdown.closed}
                      </div>
                      <span style={{ fontSize: "11px", color: "#6B7280" }}>Completed cases</span>
                    </div>
                  </div>

                  {/* Workload Capacity Meter */}
                  <div style={{ padding: "16px", backgroundColor: "#FFFFFF", borderRadius: "10px", border: "1px solid #E5E7EB" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontWeight: 600, fontSize: "14px", color: "#1F2937" }}>
                        Current Workload Assessment & Capacity
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          padding: "2px 10px",
                          borderRadius: "12px",
                          backgroundColor:
                            selectedOfficerModal.workloadCategory === "Heavy"
                              ? "#FEE2E2"
                              : selectedOfficerModal.workloadCategory === "Moderate"
                              ? "#FEF3C7"
                              : "#DCFCE7",
                          color:
                            selectedOfficerModal.workloadCategory === "Heavy"
                              ? "#DC2626"
                              : selectedOfficerModal.workloadCategory === "Moderate"
                              ? "#D97706"
                              : "#15803D",
                        }}
                      >
                        {selectedOfficerModal.workloadCategory} Workload ({selectedOfficerModal.assignedCount} items)
                      </span>
                    </div>

                    <div style={{ width: "100%", height: "10px", backgroundColor: "#E5E7EB", borderRadius: "5px", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(10, (selectedOfficerModal.assignedCount / 8) * 100))}%`,
                          height: "100%",
                          backgroundColor:
                            selectedOfficerModal.workloadCategory === "Heavy"
                              ? "#EF4444"
                              : selectedOfficerModal.workloadCategory === "Moderate"
                              ? "#F59E0B"
                              : "#10B981",
                        }}
                      />
                    </div>
                    <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
                      Recommended capacity threshold is 5–6 simultaneous disciplinary cases per active officer.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 3: Officer Profile & Credentials */}
              {activeModalTab === "profile" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: "16px",
                      backgroundColor: "#FFFFFF",
                      padding: "20px",
                      borderRadius: "10px",
                      border: "1px solid #E5E7EB",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: "12px", color: "#6B7280", display: "block" }}>
                        Officer Full Name
                      </span>
                      <span style={{ fontWeight: 600, fontSize: "14px", color: "#111827" }}>
                        {selectedOfficerModal.fullName}
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: "12px", color: "#6B7280", display: "block" }}>
                        Staff Employee Number
                      </span>
                      <span style={{ fontWeight: 600, fontSize: "14px", color: "#111827", fontFamily: "monospace" }}>
                        {selectedOfficerModal.employeeNo || `EMP-${selectedOfficerModal.id.slice(0, 6)}`}
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: "12px", color: "#6B7280", display: "block" }}>
                        E-mail Address
                      </span>
                      <span style={{ fontWeight: 600, fontSize: "14px", color: "#111827" }}>
                        {selectedOfficerModal.email || "—"}
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: "12px", color: "#6B7280", display: "block" }}>
                        Assigned Disciplinary Role
                      </span>
                      <span style={{ fontWeight: 600, fontSize: "14px", color: "#4F46E5" }}>
                        {selectedOfficerModal.normalizedRole}
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: "12px", color: "#6B7280", display: "block" }}>
                        Account Status
                      </span>
                      <span className={selectedOfficerModal.status === "Active" ? "status-badge-active" : "status-badge-inactive"}>
                        {selectedOfficerModal.status}
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: "12px", color: "#6B7280", display: "block" }}>
                        Registration Date
                      </span>
                      <span style={{ fontSize: "14px", color: "#374151" }}>
                        {selectedOfficerModal.createdAt || "Active in DCMMS"}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "16px",
                      backgroundColor: "#F9FAFB",
                      borderRadius: "10px",
                      border: "1px solid #E5E7EB",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "12px",
                    }}
                  >
                    <BadgeCheck color="#4F46E5" size={22} style={{ flexShrink: 0, marginTop: "2px" }} />
                    <div>
                      <h4 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#1F2937" }}>
                        Branch Access & Workflow Permissions
                      </h4>
                      <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6B7280", lineHeight: "1.4" }}>
                        This officer is authorized to handle disciplinary inquiries, review registered complaints, and submit progress notes under Ministry and Provincial regulations.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <footer
              className="modal-footer"
              style={{
                padding: "14px 24px",
                borderTop: "1px solid #E5E7EB",
                backgroundColor: "#F9FAFB",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: "12px", color: "#6B7280" }}>
                Viewing details for <strong style={{ color: "#1F2937" }}>{selectedOfficerModal.fullName}</strong>
              </div>
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setSelectedOfficerModal(null)}
                style={{ padding: "8px 20px" }}
              >
                {t("close", "Close")}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
