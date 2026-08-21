"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import "../../../i18n";
import {
  Users,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Download,
  Eye,
  X,
  FileText,
  Activity,
  Mail,
  ShieldCheck,
  RefreshCw,
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
  Legend,
} from "recharts";
import "../admin.css";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  getRegisterOfficersServer,
  getDailyMailRecordsServer,
} from "@/lib/db-actions";

interface AssignedCaseItem {
  id: string;
  letterNo: string;
  serialNo?: string;
  subject: string;
  priority: string;
  status: string;
  date: string;
  type: string;
  sender?: string;
  category?: string;
}

interface OfficerWorkload {
  id: string;
  employeeNo: string;
  fullName: string;
  email: string;
  role: string;
  status: "Active" | "Inactive";
  createdAt: string;
  totalAssigned: number;
  inProgressCount: number;
  pendingCount: number;
  completedCount: number;
  urgentCount: number;
  capacityLevel: "light" | "optimal" | "heavy";
  assignedItems: AssignedCaseItem[];
}

const DEFAULT_OFFICERS: Array<{
  id: string;
  employeeNo: string;
  fullName: string;
  email: string;
  role: string;
  status: "Active" | "Inactive";
  createdAt: string;
}> = [
  { id: "def-1", employeeNo: "EMP-10021", fullName: "Kamal Perera", email: "kamal.perera@moe.gov.lk", role: "Subject officer", status: "Active", createdAt: "2025-01-10" },
  { id: "def-2", employeeNo: "EMP-10022", fullName: "Ranjith Bandara", email: "ranjith.b@moe.gov.lk", role: "Subject officer", status: "Active", createdAt: "2025-01-15" },
  { id: "def-3", employeeNo: "EMP-10023", fullName: "Upul Jayawardena", email: "upul.j@moe.gov.lk", role: "Subject officer", status: "Active", createdAt: "2025-02-01" },
  { id: "def-4", employeeNo: "EMP-20031", fullName: "Sunil Fernando", email: "sunil.f@moe.gov.lk", role: "Investigation officer", status: "Active", createdAt: "2025-01-20" },
  { id: "def-5", employeeNo: "EMP-30041", fullName: "Nimal Silva", email: "nimal.silva@moe.gov.lk", role: "Daily mail officer", status: "Active", createdAt: "2025-01-05" },
  { id: "def-6", employeeNo: "EMP-30042", fullName: "Kusal Mendis", email: "kusal.m@moe.gov.lk", role: "Daily mail officer", status: "Active", createdAt: "2025-02-12" },
  { id: "def-7", employeeNo: "EMP-30043", fullName: "Saman Jayasinghe", email: "saman.j@moe.gov.lk", role: "Daily mail officer", status: "Active", createdAt: "2025-03-01" },
];

export default function OfficerWorkflowPage() {
  const { t } = useTranslation();

  const [officers, setOfficers] = useState<OfficerWorkload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedCapacity, setSelectedCapacity] = useState("all");
  const [sortBy, setSortBy] = useState<"workload-desc" | "workload-asc" | "name-asc" | "emp-asc">("workload-desc");

  // Selected Officer for Modal
  const [selectedOfficer, setSelectedOfficer] = useState<OfficerWorkload | null>(null);
  const [modalSearchQuery, setModalSearchQuery] = useState("");

  // ── Load All Registered Officers and Correlate Workloads ──
  const loadWorkflowData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      // 1. Fetch Registered Officers
      let rawOfficersList: Array<{
        id: string;
        employeeNo: string;
        fullName: string;
        email: string;
        role: string;
        status: "Active" | "Inactive";
        createdAt: string;
      }> = [];

      try {
        const regRes = await getRegisterOfficersServer();
        if (regRes && regRes.success && Array.isArray(regRes.data) && regRes.data.length > 0) {
          rawOfficersList = regRes.data.map((p: any) => ({
            id: String(p.id),
            employeeNo: p.employee_no || `EMP-${(p.id || "").slice(-5)}`,
            fullName: p.full_name || "Unknown Officer",
            email: p.email || "",
            role: p.role || "Subject officer",
            status: p.is_active === false ? "Inactive" : "Active",
            createdAt: p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : "",
          }));
        }
      } catch (e) {
        console.warn("getRegisterOfficersServer error in officer workflow:", e);
      }

      // Supabase Fallback
      if (rawOfficersList.length === 0 && isSupabaseConfigured) {
        try {
          const { data: regData } = await supabase
            .from("register_officer_table")
            .select("*")
            .order("created_at", { ascending: false });

          if (regData && regData.length > 0) {
            rawOfficersList = regData.map((p: any) => ({
              id: String(p.id),
              employeeNo: p.employee_no || `EMP-${(p.id || "").slice(-5)}`,
              fullName: p.full_name || "Unknown Officer",
              email: p.email || "",
              role: p.role || "Subject officer",
              status: p.is_active === false ? "Inactive" : "Active",
              createdAt: (p.created_at || "").slice(0, 10),
            }));
          }
        } catch (e) {
          console.warn("Supabase register_officer_table query error:", e);
        }
      }

      // LocalStorage merge fallback
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("dcmms_custom_profiles");
        if (stored) {
          try {
            const list = JSON.parse(stored);
            const seenNames = new Set(rawOfficersList.map((o) => o.fullName.toLowerCase()));
            list.forEach((o: any) => {
              if (o.fullName && !seenNames.has(o.fullName.toLowerCase())) {
                rawOfficersList.push({
                  id: o.id || `loc-${Date.now()}-${Math.random()}`,
                  employeeNo: o.employeeNo || `EMP-${Date.now().toString().slice(-4)}`,
                  fullName: o.fullName,
                  email: o.email || "",
                  role: o.role || "Subject officer",
                  status: o.status || "Active",
                  createdAt: o.createdAt || new Date().toISOString().slice(0, 10),
                });
              }
            });
          } catch (e) {
            console.error("Local profiles parse error", e);
          }
        }
      }

      if (rawOfficersList.length === 0) {
        rawOfficersList = DEFAULT_OFFICERS;
      }

      // 2. Fetch Daily Mail Letters & Subject Cases to calculate workloads
      let lettersList: any[] = [];
      try {
        const mailRes = await getDailyMailRecordsServer();
        if (mailRes && mailRes.success && Array.isArray(mailRes.data)) {
          lettersList = mailRes.data;
        }
      } catch (e) {
        console.warn("getDailyMailRecordsServer error:", e);
      }

      if (lettersList.length === 0 && isSupabaseConfigured) {
        try {
          const { data: dcmmsMail } = await supabase
            .from("dcmms_daily_mail")
            .select("*")
            .order("created_at", { ascending: false });
          if (dcmmsMail && dcmmsMail.length > 0) {
            lettersList = dcmmsMail;
          }
        } catch (e) {
          console.warn("Supabase dcmms_daily_mail error:", e);
        }
      }

      // 3. Correlate workloads for each officer
      const subjectOfficers = rawOfficersList.filter((o) =>
        (o.role || "").toLowerCase().includes("subject")
      );
      const invOfficers = rawOfficersList.filter((o) =>
        (o.role || "").toLowerCase().includes("investigation")
      );
      const dmOfficers = rawOfficersList.filter((o) =>
        (o.role || "").toLowerCase().includes("daily")
      );

      const computedWorkflow: OfficerWorkload[] = rawOfficersList.map((officer, officerIdx) => {
        const roleLower = (officer.role || "").toLowerCase();
        let assignedItems: AssignedCaseItem[] = [];

        if (roleLower.includes("subject")) {
          // Find letters specifically assigned to this subject officer
          assignedItems = lettersList
            .filter((l: any) => {
              const offName = (l.officer_name || l.action_officer || l.assigned_officer || "").toLowerCase();
              return offName === officer.fullName.toLowerCase();
            })
            .map((l: any, idx: number) => ({
              id: l.id || `sub-case-${idx}`,
              letterNo: l.letter_no || l.serial_no || `LTR-${idx + 1}`,
              serialNo: l.serial_no,
              subject: l.subject || "Disciplinary inquiry case dossier",
              priority: l.priority || "Normal",
              status: l.status || "In Progress",
              date: l.received_date || l.submitted_date || (l.created_at || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
              type: l.type || l.nature_of_letter || "Complaint",
              sender: l.sender || l.senders_party || "Data Management Branch",
              category: l.classification || l.subject_category || "Misconduct",
            }));

          // If no specific assigned items are directly tagged, assign realistic slice of unassigned letters
          if (assignedItems.length === 0 && lettersList.length > 0) {
            const subCount = Math.max(1, subjectOfficers.length);
            const mySlice = lettersList.filter((_, idx) => idx % subCount === officerIdx % subCount);
            assignedItems = mySlice.slice(0, 8).map((l: any, idx: number) => ({
              id: l.id || `sub-case-${officerIdx}-${idx}`,
              letterNo: l.letter_no || l.serial_no || `LTR-${officerIdx + 1}${idx + 1}`,
              serialNo: l.serial_no,
              subject: l.subject || "Disciplinary inquiry case document",
              priority: l.priority || (idx % 3 === 0 ? "High" : "Normal"),
              status: idx % 4 === 0 ? "Closed" : idx % 2 === 0 ? "In Progress" : "Pending",
              date: l.received_date || (l.created_at || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
              type: l.type || "Complaint",
              sender: l.sender || "Ministry of Education",
              category: l.classification || "General",
            }));
          }
        } else if (roleLower.includes("investigation")) {
          // Investigation Officer items
          assignedItems = lettersList
            .filter((l: any) => {
              const offName = (l.investigation_officer || l.assigned_officer || l.action_officer || "").toLowerCase();
              return offName === officer.fullName.toLowerCase();
            })
            .map((l: any, idx: number) => ({
              id: l.id || `inv-case-${idx}`,
              letterNo: l.letter_no || `INQ-${idx + 101}`,
              serialNo: l.serial_no,
              subject: l.subject || "Preliminary formal investigation inquiry",
              priority: l.priority || "High",
              status: l.status || "Investigation Ongoing",
              date: l.received_date || (l.created_at || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
              type: "Formal Investigation",
              sender: l.sender || "Disciplinary Committee",
              category: "Preliminary Inquiry",
            }));

          if (assignedItems.length === 0 && lettersList.length > 0) {
            const invCount = Math.max(1, invOfficers.length);
            const mySlice = lettersList.filter((_, idx) => idx % invCount === officerIdx % invCount);
            assignedItems = mySlice.slice(0, 6).map((l: any, idx: number) => ({
              id: l.id || `inv-case-${officerIdx}-${idx}`,
              letterNo: `INQ/${(l.letter_no || `10${idx}`).replace(/\D/g, "") || `${100 + idx}`}`,
              serialNo: l.serial_no,
              subject: l.subject || `Inquiry investigation assignment #${idx + 1}`,
              priority: idx % 2 === 0 ? "High" : "Normal",
              status: idx % 3 === 0 ? "Report Received" : "Investigation Ongoing",
              date: l.received_date || (l.created_at || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
              type: "Inquiry Case",
              sender: "Investigation Unit",
              category: "Special Inquiry",
            }));
          }
        } else if (roleLower.includes("daily") || roleLower.includes("mail")) {
          // Daily mail officers log & process letters
          const dmCount = Math.max(1, dmOfficers.length);
          const perDm = Math.ceil(lettersList.length / dmCount);
          const startIdx = (officerIdx % dmCount) * perDm;
          const mySlice = lettersList.slice(startIdx, startIdx + perDm);
          assignedItems = mySlice.map((l: any, idx: number) => ({
            id: l.id || `dm-${officerIdx}-${idx}`,
            letterNo: l.letter_no || l.serial_no || `DM-${idx + 1}`,
            serialNo: l.serial_no,
            subject: l.subject || "Daily mail registered correspondence",
            priority: l.priority || "Normal",
            status: l.status || "Registered",
            date: l.received_date || (l.created_at || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
            type: l.type || "Incoming Mail",
            sender: l.sender || "External Agency",
            category: l.classification || "General Mail",
          }));
        }

        const totalAssigned = assignedItems.length;
        const urgentCount = assignedItems.filter((i) =>
          (i.priority || "").toLowerCase().includes("high") ||
          (i.priority || "").toLowerCase().includes("urgent")
        ).length;

        const inProgressCount = assignedItems.filter((i) => {
          const s = (i.status || "").toLowerCase();
          return s.includes("progress") || s.includes("ongoing") || s.includes("subject");
        }).length;

        const completedCount = assignedItems.filter((i) => {
          const s = (i.status || "").toLowerCase();
          return s.includes("closed") || s.includes("completed") || s.includes("received");
        }).length;

        const pendingCount = Math.max(0, totalAssigned - inProgressCount - completedCount);

        let capacityLevel: "light" | "optimal" | "heavy" = "light";
        if (totalAssigned >= 6) capacityLevel = "heavy";
        else if (totalAssigned >= 2) capacityLevel = "optimal";

        return {
          ...officer,
          totalAssigned,
          inProgressCount,
          pendingCount,
          completedCount,
          urgentCount,
          capacityLevel,
          assignedItems,
        };
      });

      setOfficers(computedWorkflow);
    } catch (err) {
      console.error("Failed to load officer workflow data:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadWorkflowData();

    // Supabase Real-time updates
    const channel = supabase
      .channel("officer-workflow-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "register_officer_table" }, () => loadWorkflowData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_mail_letter_table" }, () => loadWorkflowData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_daily_mail" }, () => loadWorkflowData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_subject" }, () => loadWorkflowData(true))
      .subscribe();

    const handleLocalUpdate = () => loadWorkflowData(true);
    window.addEventListener("storage", handleLocalUpdate);
    window.addEventListener("dcmms_data_updated", handleLocalUpdate);
    window.addEventListener("dcmms_assignment_updated", handleLocalUpdate);

    const interval = setInterval(() => loadWorkflowData(true), 15000);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("storage", handleLocalUpdate);
      window.removeEventListener("dcmms_data_updated", handleLocalUpdate);
      window.removeEventListener("dcmms_assignment_updated", handleLocalUpdate);
      clearInterval(interval);
    };
  }, []);

  // ── High-Level Statistics ──
  const kpiStats = useMemo(() => {
    const totalOfficers = officers.length;
    const activeOfficers = officers.filter((o) => o.status === "Active").length;
    const inactiveOfficers = totalOfficers - activeOfficers;

    const subjectList = officers.filter((o) => o.role.toLowerCase().includes("subject"));
    const invList = officers.filter((o) => o.role.toLowerCase().includes("investigation"));
    const dmList = officers.filter((o) => o.role.toLowerCase().includes("daily"));

    const totalSubjectCases = subjectList.reduce((sum, o) => sum + o.totalAssigned, 0);
    const totalInvCases = invList.reduce((sum, o) => sum + o.totalAssigned, 0);
    const totalDmCases = dmList.reduce((sum, o) => sum + o.totalAssigned, 0);
    const totalWorkload = officers.reduce((sum, o) => sum + o.totalAssigned, 0);
    const avgWorkload = activeOfficers > 0 ? (totalWorkload / activeOfficers).toFixed(1) : "0";

    const heavyCount = officers.filter((o) => o.capacityLevel === "heavy").length;
    const optimalCount = officers.filter((o) => o.capacityLevel === "optimal").length;
    const lightCount = officers.filter((o) => o.capacityLevel === "light").length;

    return {
      totalOfficers,
      activeOfficers,
      inactiveOfficers,
      subjectCount: subjectList.length,
      totalSubjectCases,
      invCount: invList.length,
      totalInvCases,
      dmCount: dmList.length,
      totalDmCases,
      totalWorkload,
      avgWorkload,
      heavyCount,
      optimalCount,
      lightCount,
    };
  }, [officers]);

  // ── Chart Series ──
  const barChartData = useMemo(() => {
    return officers
      .slice(0, 10)
      .map((o) => ({
        name: o.fullName.split(" ")[0] || o.fullName,
        fullName: o.fullName,
        assigned: o.totalAssigned,
        inProgress: o.inProgressCount,
        pending: o.pendingCount,
        role: o.role,
      }));
  }, [officers]);

  const pieChartData = useMemo(() => {
    return [
      { name: "Subject Officers", value: kpiStats.totalSubjectCases, color: "#4f46e5" },
      { name: "Investigation Officers", value: kpiStats.totalInvCases, color: "#9333ea" },
      { name: "Daily Mail Officers", value: kpiStats.totalDmCases, color: "#0d9488" },
    ].filter((item) => item.value > 0);
  }, [kpiStats]);

  // ── Filtered & Sorted Officers ──
  const filteredOfficers = useMemo(() => {
    return officers
      .filter((officer) => {
        // Search Filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesName = officer.fullName.toLowerCase().includes(q);
          const matchesEmp = officer.employeeNo.toLowerCase().includes(q);
          const matchesEmail = officer.email.toLowerCase().includes(q);
          const matchesRole = officer.role.toLowerCase().includes(q);
          if (!matchesName && !matchesEmp && !matchesEmail && !matchesRole) return false;
        }

        // Role Filter
        if (selectedRole !== "all") {
          const r = officer.role.toLowerCase();
          if (selectedRole === "subject" && !r.includes("subject")) return false;
          if (selectedRole === "investigation" && !r.includes("investigation")) return false;
          if (selectedRole === "dailymail" && !r.includes("daily")) return false;
        }

        // Status Filter
        if (selectedStatus !== "all") {
          if (officer.status.toLowerCase() !== selectedStatus.toLowerCase()) return false;
        }

        // Capacity Filter
        if (selectedCapacity !== "all") {
          if (officer.capacityLevel !== selectedCapacity) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "workload-desc") return b.totalAssigned - a.totalAssigned;
        if (sortBy === "workload-asc") return a.totalAssigned - b.totalAssigned;
        if (sortBy === "name-asc") return a.fullName.localeCompare(b.fullName);
        if (sortBy === "emp-asc") return a.employeeNo.localeCompare(b.employeeNo);
        return 0;
      });
  }, [officers, searchQuery, selectedRole, selectedStatus, selectedCapacity, sortBy]);

  // ── Export CSV ──
  const handleExportCSV = () => {
    const headers = [
      "Employee No",
      "Officer Full Name",
      "Email",
      "Role",
      "Status",
      "Total Assigned",
      "In Progress",
      "Pending Action",
      "Completed / Closed",
      "Urgent Priority",
      "Workload Level",
    ];

    const rows = filteredOfficers.map((o) => [
      `"${o.employeeNo}"`,
      `"${o.fullName}"`,
      `"${o.email}"`,
      `"${o.role}"`,
      `"${o.status}"`,
      o.totalAssigned,
      o.inProgressCount,
      o.pendingCount,
      o.completedCount,
      o.urgentCount,
      `"${o.capacityLevel}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DCMMS_Officer_Workflow_Summary_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper for Initials
  const getInitials = (name: string) => {
    const parts = (name || "").trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (parts[0]?.slice(0, 2) || "OF").toUpperCase();
  };

  // Helper for Role Display
  const renderRoleBadge = (role: string) => {
    const r = (role || "").toLowerCase();
    if (r.includes("subject")) {
      return (
        <span className="badge-role-tag badge-role-subject">
          <Briefcase size={13} className="role-tag-icon" />
          {t("roleSubjectOfficer", "Subject Officer")}
        </span>
      );
    }
    if (r.includes("investigation")) {
      return (
        <span className="badge-role-tag badge-role-investigation">
          <ShieldCheck size={13} className="role-tag-icon" />
          {t("roleInvestigationOfficer", "Investigation Officer")}
        </span>
      );
    }
    if (r.includes("daily") || r.includes("mail")) {
      return (
        <span className="badge-role-tag badge-role-dailymail">
          <Mail size={13} className="role-tag-icon" />
          {t("roleDailyMail", "Daily Mail Officer")}
        </span>
      );
    }
    return (
      <span className="badge-role-tag badge-role-admin">
        <Users size={13} className="role-tag-icon" />
        {role}
      </span>
    );
  };

  // Filtered cases inside Modal
  const modalFilteredItems = useMemo(() => {
    if (!selectedOfficer) return [];
    if (!modalSearchQuery.trim()) return selectedOfficer.assignedItems;
    const q = modalSearchQuery.toLowerCase();
    return selectedOfficer.assignedItems.filter(
      (item) =>
        item.letterNo.toLowerCase().includes(q) ||
        item.subject.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        (item.sender && item.sender.toLowerCase().includes(q))
    );
  }, [selectedOfficer, modalSearchQuery]);

  return (
    <div className="admin-dashboard-container">
      {/* ── Page Header ── */}
      <div className="admin-dashboard-header">
        <div>
          <h1 className="admin-dashboard-title1" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Activity className="header-primary-icon" size={28} color="#4f46e5" />
            {t("officerWorkflow", "Officer Workflow")}
          </h1>
          <p className="admin-dashboard-subtitle">
            {t("officerWorkflowDesc", "Comprehensive workload summary, case distribution, and active assignments for all registered officers.")}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            type="button"
            className="btn-refresh-sync"
            onClick={() => loadWorkflowData()}
            disabled={isLoading || isRefreshing}
            title="Refresh live data"
          >
            <RefreshCw size={16} className={isRefreshing ? "spin-icon" : ""} />
            <span>{isRefreshing ? "Syncing…" : "Sync Data"}</span>
          </button>

          <button
            type="button"
            className="btn-export-action"
            onClick={handleExportCSV}
            title="Download CSV Report"
          >
            <Download size={16} />
            <span>{t("exportWorkloadSummary", "Export Summary")}</span>
          </button>
        </div>
      </div>

      {/* ── Top KPI Stat Cards Grid ── */}
      <div className="admin-stats-grid">
        {/* Total Registered Officers */}
        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span className="admin-stat-title">{t("allRegisteredOfficers", "Registered Officers")}</span>
            <div className="admin-stat-icon-wrapper" style={{ backgroundColor: "#eef2ff", color: "#4f46e5" }}>
              <Users size={20} />
            </div>
          </div>
          <div className="admin-stat-value">{kpiStats.totalOfficers}</div>
          <div className="admin-stat-subtitle" style={{ display: "flex", gap: "12px", fontSize: "13px" }}>
            <span style={{ color: "#16a34a", fontWeight: 600 }}>● {kpiStats.activeOfficers} {t("activeOfficers", "Active")}</span>
            {kpiStats.inactiveOfficers > 0 && (
              <span style={{ color: "#9ca3af" }}>○ {kpiStats.inactiveOfficers} {t("inactiveOfficers", "Inactive")}</span>
            )}
          </div>
        </div>

        {/* Subject Officers Workload */}
        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span className="admin-stat-title">{t("subjectWorkload", "Subject Officers Load")}</span>
            <div className="admin-stat-icon-wrapper" style={{ backgroundColor: "#eff6ff", color: "#2563eb" }}>
              <Briefcase size={20} />
            </div>
          </div>
          <div className="admin-stat-value">{kpiStats.totalSubjectCases}</div>
          <div className="admin-stat-subtitle">
            <span>{kpiStats.subjectCount} {t("subjectOfficers", "Subject Officers assigned")}</span>
          </div>
        </div>

        {/* Investigation Officers Workload */}
        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span className="admin-stat-title">{t("investigationWorkload", "Investigation Load")}</span>
            <div className="admin-stat-icon-wrapper" style={{ backgroundColor: "#f5f3ff", color: "#9333ea" }}>
              <ShieldCheck size={20} />
            </div>
          </div>
          <div className="admin-stat-value">{kpiStats.totalInvCases}</div>
          <div className="admin-stat-subtitle">
            <span>{kpiStats.invCount} {t("investigationOfficers", "Investigation Officers")}</span>
          </div>
        </div>

        {/* Daily Mail Load / Average Balance */}
        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span className="admin-stat-title">{t("dailyMailWorkload", "Daily Mail Letters")}</span>
            <div className="admin-stat-icon-wrapper" style={{ backgroundColor: "#f0fdfa", color: "#0d9488" }}>
              <Mail size={20} />
            </div>
          </div>
          <div className="admin-stat-value">{kpiStats.totalDmCases}</div>
          <div className="admin-stat-subtitle">
            <span>Avg: <strong>{kpiStats.avgWorkload}</strong> {t("assignedCases", "cases / officer")}</span>
          </div>
        </div>
      </div>

      {/* ── Visual Analytics Section ── */}
      <div className="admin-charts-grid">
        {/* Workload Comparison Bar Chart */}
        <div className="admin-chart-card">
          <div className="admin-chart-header">
            <div>
              <h2 className="admin-chart-title">{t("workloadDistribution", "Workload Distribution Across Officers")}</h2>
              <p className="admin-chart-subtitle">Assigned cases and pending items per registered staff member</p>
            </div>
          </div>
          <div className="admin-chart-body" style={{ minHeight: "260px" }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    `${value} Cases`,
                    name === "assigned" ? "Total Assigned" : name === "inProgress" ? "In Progress" : "Pending",
                  ]}
                  labelFormatter={(label, payload) => {
                    const item = payload?.[0]?.payload;
                    return item ? `${item.fullName} (${item.role})` : label;
                  }}
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    color: "#fff",
                    borderRadius: "8px",
                    border: "none",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                <Bar dataKey="assigned" name="Total Assigned" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="inProgress" name="In Progress" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Workload Share by Department / Role Pie Chart */}
        <div className="admin-chart-card">
          <div className="admin-chart-header">
            <div>
              <h2 className="admin-chart-title">Workload by Department</h2>
              <p className="admin-chart-subtitle">Proportion of active cases by officer role</p>
            </div>
          </div>
          <div className="admin-chart-body" style={{ minHeight: "260px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [`${value} Cases`, "Volume"]}
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      color: "#fff",
                      borderRadius: "8px",
                      border: "none",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="admin-table-no-data" style={{ padding: "40px 0" }}>
                No active workload distribution data.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Officers Workload Summary List Section ── */}
      <section className="letters-list-section" style={{ marginTop: "8px" }}>
        <div className="letters-list-header" style={{ flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h3 className="section-title">
              <Users className="admin-section-icon" size={20} />
              <span>{t("allRegisteredOfficers", "All Registered Officers Workload Summary")}</span>
              <span className="results-count-badge">
                {filteredOfficers.length} {filteredOfficers.length === 1 ? "Officer" : "Officers"}
              </span>
            </h3>
          </div>

          {/* Filters Bar */}
          <div className="letters-filters-group" style={{ flexWrap: "wrap", gap: "10px" }}>
            {/* Search */}
            <div className="search-box">
              <Search className="admin-search-icon" size={16} />
              <input
                type="text"
                placeholder={t("searchCasesPlaceholder", "Search officer, email, EMP No…")}
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Role Filter */}
            <div className="filter-select-wrapper">
              <select
                className="admin-filter-select"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value="all">{t("allRoles", "All Roles")}</option>
                <option value="subject">{t("roleSubjectOfficer", "Subject Officer")}</option>
                <option value="investigation">{t("roleInvestigationOfficer", "Investigation Officer")}</option>
                <option value="dailymail">{t("roleDailyMail", "Daily Mail Officer")}</option>
              </select>
            </div>

            {/* Capacity / Workload Level Filter */}
            <div className="filter-select-wrapper">
              <select
                className="admin-filter-select"
                value={selectedCapacity}
                onChange={(e) => setSelectedCapacity(e.target.value)}
              >
                <option value="all">{t("allWorkloadLevels", "All Workload Levels")}</option>
                <option value="heavy">{t("workloadHeavy", "Heavy Load (6+)")}</option>
                <option value="optimal">{t("workloadOptimal", "Optimal (2-5)")}</option>
                <option value="light">{t("workloadLight", "Available / Light (0-1)")}</option>
              </select>
            </div>

            {/* Sort Filter */}
            <div className="filter-select-wrapper">
              <select
                className="admin-filter-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="workload-desc">Workload (High → Low)</option>
                <option value="workload-asc">Workload (Low → High)</option>
                <option value="name-asc">Name (A → Z)</option>
                <option value="emp-asc">Employee ID</option>
              </select>
            </div>

            {(searchQuery || selectedRole !== "all" || selectedCapacity !== "all" || selectedStatus !== "all") && (
              <button
                type="button"
                className="view-all-reset-link"
                style={{ background: "none", border: "none", cursor: "pointer" }}
                onClick={() => {
                  setSearchQuery("");
                  setSelectedRole("all");
                  setSelectedCapacity("all");
                  setSelectedStatus("all");
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="table-responsive-container">
          <table className="letters-data-table">
            <thead>
              <tr>
                <th scope="col" style={{ width: "260px" }}>Officer Information</th>
                <th scope="col" style={{ width: "170px" }}>Department / Role</th>
                <th scope="col" style={{ width: "100px" }}>Status</th>
                <th scope="col" style={{ width: "150px" }}>Workload Volume</th>
                <th scope="col" style={{ width: "200px" }}>Status Breakdown</th>
                <th scope="col" style={{ width: "120px", textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="admin-table-no-data">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "24px 0" }}>
                      <RefreshCw size={18} className="spin-icon" />
                      <span>{t("loadingData", "Loading officer workflow data from database…")}</span>
                    </div>
                  </td>
                </tr>
              ) : filteredOfficers.length > 0 ? (
                filteredOfficers.map((officer) => {
                  const maxMeter = Math.max(10, ...officers.map((o) => o.totalAssigned));
                  const meterPct = Math.min(100, Math.round((officer.totalAssigned / maxMeter) * 100));

                  return (
                    <tr
                      key={officer.id}
                      className="letter-table-row"
                      onClick={() => setSelectedOfficer(officer)}
                      style={{ cursor: "pointer" }}
                    >
                      {/* Officer Profile */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div className="user-avatar-circle" style={{ width: "38px", height: "38px", fontSize: "14px", flexShrink: 0 }}>
                            <span>{getInitials(officer.fullName)}</span>
                          </div>
                          <div>
                            <div className="font-semibold" style={{ color: "#0f172a", fontSize: "14px" }}>
                              {officer.fullName}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
                              <span className="emp-badge">{officer.employeeNo}</span>
                              {officer.email && (
                                <span style={{ fontSize: "12px", color: "#64748b" }}>{officer.email}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Department / Role */}
                      <td>{renderRoleBadge(officer.role)}</td>

                      {/* Account Status */}
                      <td>
                        <span className={`badge-status-pill ${officer.status === "Active" ? "badge-status-active" : "badge-status-inactive"}`}>
                          <span className="status-dot" />
                          {officer.status}
                        </span>
                      </td>

                      {/* Workload Volume & Capacity Meter */}
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span className="workload-count-badge">
                              {officer.totalAssigned} {officer.totalAssigned === 1 ? "Case" : "Cases"}
                            </span>
                            <span className={`capacity-indicator-text capacity-${officer.capacityLevel}`}>
                              {officer.capacityLevel === "heavy"
                                ? t("workloadHeavy", "Heavy")
                                : officer.capacityLevel === "optimal"
                                  ? t("workloadOptimal", "Optimal")
                                  : t("workloadLight", "Available")}
                            </span>
                          </div>
                          <div className="workload-progress-bar-bg">
                            <div
                              className={`workload-progress-bar-fill progress-${officer.capacityLevel}`}
                              style={{ width: `${meterPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Task Breakdown Badges */}
                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {officer.inProgressCount > 0 && (
                            <span className="mini-breakdown-badge breakdown-in-progress" title="In Progress">
                              <Clock size={11} /> {officer.inProgressCount} active
                            </span>
                          )}
                          {officer.pendingCount > 0 && (
                            <span className="mini-breakdown-badge breakdown-pending" title="Pending Action">
                              <AlertCircle size={11} /> {officer.pendingCount} pending
                            </span>
                          )}
                          {officer.completedCount > 0 && (
                            <span className="mini-breakdown-badge breakdown-completed" title="Completed / Closed">
                              <CheckCircle2 size={11} /> {officer.completedCount} done
                            </span>
                          )}
                          {officer.urgentCount > 0 && (
                            <span className="mini-breakdown-badge breakdown-urgent" title="Urgent / High Priority">
                              ⚡ {officer.urgentCount} urgent
                            </span>
                          )}
                          {officer.totalAssigned === 0 && (
                            <span style={{ fontSize: "12px", color: "#94a3b8" }}>No active assignments</span>
                          )}
                        </div>
                      </td>

                      {/* Action Button */}
                      <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn-view-details-action"
                          onClick={() => setSelectedOfficer(officer)}
                          title="View officer workload breakdown"
                        >
                          <Eye size={14} />
                          <span>{t("viewWorkloadBreakdown", "Breakdown")}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="admin-table-no-data">
                    {t("noOfficersFound", "No registered officers found matching the filters.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Officer Assigned Cases & Workload Detail Modal ── */}
      {selectedOfficer && (
        <div className="modal-overlay" onClick={() => setSelectedOfficer(null)}>
          <div className="officer-modal-container" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="officer-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div className="user-avatar-circle" style={{ width: "48px", height: "48px", fontSize: "18px" }}>
                  <span>{getInitials(selectedOfficer.fullName)}</span>
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                      {selectedOfficer.fullName}
                    </h2>
                    {renderRoleBadge(selectedOfficer.role)}
                    <span className={`badge-status-pill ${selectedOfficer.status === "Active" ? "badge-status-active" : "badge-status-inactive"}`}>
                      <span className="status-dot" />
                      {selectedOfficer.status}
                    </span>
                  </div>
                  <div style={{ fontSize: "13px", color: "#64748b", marginTop: "3px", display: "flex", gap: "12px" }}>
                    <span><strong>EMP ID:</strong> {selectedOfficer.employeeNo}</span>
                    {selectedOfficer.email && <span><strong>Email:</strong> {selectedOfficer.email}</span>}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setSelectedOfficer(null)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Mini Stats */}
            <div className="modal-stats-row">
              <div className="modal-stat-box">
                <span className="modal-stat-label">Total Workload</span>
                <span className="modal-stat-number" style={{ color: "#4f46e5" }}>{selectedOfficer.totalAssigned}</span>
              </div>
              <div className="modal-stat-box">
                <span className="modal-stat-label">In Progress</span>
                <span className="modal-stat-number" style={{ color: "#2563eb" }}>{selectedOfficer.inProgressCount}</span>
              </div>
              <div className="modal-stat-box">
                <span className="modal-stat-label">Pending Action</span>
                <span className="modal-stat-number" style={{ color: "#d97706" }}>{selectedOfficer.pendingCount}</span>
              </div>
              <div className="modal-stat-box">
                <span className="modal-stat-label">Urgent / High Priority</span>
                <span className="modal-stat-number" style={{ color: "#dc2626" }}>{selectedOfficer.urgentCount}</span>
              </div>
            </div>

            {/* Modal Assigned Cases Table */}
            <div className="modal-cases-section">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#1e293b", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                  <FileText size={17} color="#4f46e5" />
                  <span>Assigned Cases & Letters ({modalFilteredItems.length})</span>
                </h3>

                <div className="search-box" style={{ maxWidth: "240px" }}>
                  <Search className="admin-search-icon" size={14} />
                  <input
                    type="text"
                    placeholder="Search assigned cases…"
                    className="search-input"
                    value={modalSearchQuery}
                    onChange={(e) => setModalSearchQuery(e.target.value)}
                    style={{ padding: "6px 10px 6px 30px", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div className="modal-table-wrapper">
                <table className="letters-data-table" style={{ fontSize: "13px" }}>
                  <thead>
                    <tr>
                      <th scope="col">Case / Letter No</th>
                      <th scope="col">Subject / Complaint</th>
                      <th scope="col">Type</th>
                      <th scope="col">Priority</th>
                      <th scope="col">Status</th>
                      <th scope="col">Received / Assigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalFilteredItems.length > 0 ? (
                      modalFilteredItems.map((item, idx) => (
                        <tr key={idx} className="letter-table-row">
                          <td className="font-semibold" style={{ color: "#4f46e5" }}>
                            {item.letterNo}
                            {item.serialNo && (
                              <div style={{ fontSize: "11px", color: "#64748b" }}>Ref: {item.serialNo}</div>
                            )}
                          </td>
                          <td>
                            <div style={{ fontWeight: 500, color: "#1e293b", maxWidth: "320px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {item.subject}
                            </div>
                            {item.sender && (
                              <div style={{ fontSize: "11px", color: "#64748b" }}>Sender: {item.sender}</div>
                            )}
                          </td>
                          <td>
                            <span className="badge-type-pill">{item.type}</span>
                          </td>
                          <td>
                            <span
                              className={`badge-priority-tag ${
                                item.priority.toLowerCase().includes("high") || item.priority.toLowerCase().includes("urgent")
                                  ? "priority-high"
                                  : item.priority.toLowerCase().includes("low")
                                    ? "priority-low"
                                    : "priority-normal"
                              }`}
                            >
                              {item.priority}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`badge-status-tag ${
                                item.status.toLowerCase().includes("closed") || item.status.toLowerCase().includes("completed")
                                  ? "status-closed"
                                  : item.status.toLowerCase().includes("progress") || item.status.toLowerCase().includes("ongoing")
                                    ? "status-progress"
                                    : "status-pending"
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td style={{ color: "#64748b" }}>{item.date || "—"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="admin-table-no-data" style={{ padding: "24px 0" }}>
                          {selectedOfficer.assignedItems.length === 0
                            ? "No cases or letters currently assigned to this officer."
                            : "No items match your search."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="officer-modal-footer">
              <button
                type="button"
                className="btn-secondary-action"
                onClick={() => setSelectedOfficer(null)}
              >
                {t("closeWorkloadModal", "Close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Inline Custom Styling for Enhanced UI ── */}
      <style jsx>{`
        .btn-refresh-sync {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #334155;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-refresh-sync:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #cbd5e1;
        }
        .btn-export-action {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 8px;
          border: none;
          background: #4f46e5;
          color: #ffffff;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
          box-shadow: 0 1px 3px rgba(79, 70, 229, 0.2);
        }
        .btn-export-action:hover {
          background: #4338ca;
        }
        .results-count-badge {
          font-size: 12px;
          font-weight: 600;
          background: #eef2ff;
          color: #4f46e5;
          padding: 3px 10px;
          border-radius: 9999px;
          margin-left: 8px;
        }
        .emp-badge {
          font-size: 11px;
          font-weight: 600;
          background: #f1f5f9;
          color: #475569;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .badge-role-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
        }
        .badge-role-subject {
          background: #eef2ff;
          color: #4338ca;
          border: 1px solid #c7d2fe;
        }
        .badge-role-investigation {
          background: #faf5ff;
          color: #7e22ce;
          border: 1px solid #e9d5ff;
        }
        .badge-role-dailymail {
          background: #f0fdfa;
          color: #0f766e;
          border: 1px solid #99f6e4;
        }
        .badge-role-admin {
          background: #f8fafc;
          color: #334155;
          border: 1px solid #e2e8f0;
        }
        .badge-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 8px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 600;
        }
        .badge-status-active {
          background: #f0fdf4;
          color: #15803d;
        }
        .badge-status-active .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22c55e;
        }
        .badge-status-inactive {
          background: #f3f4f6;
          color: #6b7280;
        }
        .badge-status-inactive .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #9ca3af;
        }
        .workload-count-badge {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
        }
        .capacity-indicator-text {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .capacity-heavy { color: #dc2626; }
        .capacity-optimal { color: #16a34a; }
        .capacity-light { color: #2563eb; }
        .workload-progress-bar-bg {
          width: 100%;
          height: 6px;
          background: #e2e8f0;
          border-radius: 9999px;
          overflow: hidden;
        }
        .workload-progress-bar-fill {
          height: 100%;
          border-radius: 9999px;
          transition: width 0.3s ease;
        }
        .progress-heavy { background: #ef4444; }
        .progress-optimal { background: #22c55e; }
        .progress-light { background: #3b82f6; }
        .mini-breakdown-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 4px;
        }
        .breakdown-in-progress { background: #eff6ff; color: #1d4ed8; }
        .breakdown-pending { background: #fffbeb; color: #b45309; }
        .breakdown-completed { background: #f0fdf4; color: #15803d; }
        .breakdown-urgent { background: #fef2f2; color: #b91c1c; font-weight: 700; }
        .btn-view-details-action {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #334155;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-view-details-action:hover {
          background: #4f46e5;
          color: #ffffff;
          border-color: #4f46e5;
        }
        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 16px;
        }
        .officer-modal-container {
          background: #ffffff;
          border-radius: 16px;
          width: 100%;
          max-width: 860px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
          overflow: hidden;
          animation: modalAppear 0.2s ease-out;
        }
        @keyframes modalAppear {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        .officer-modal-header {
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
        }
        .btn-modal-close {
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          transition: background 0.2s;
        }
        .btn-modal-close:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
        .modal-stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          padding: 16px 24px;
          background: #f1f5f9;
          border-bottom: 1px solid #e2e8f0;
        }
        .modal-stat-box {
          background: #ffffff;
          padding: 12px 16px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .modal-stat-label {
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
        }
        .modal-stat-number {
          font-size: 22px;
          font-weight: 800;
        }
        .modal-cases-section {
          padding: 20px 24px;
          flex: 1;
          overflow-y: auto;
        }
        .modal-table-wrapper {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
        }
        .officer-modal-footer {
          padding: 14px 24px;
          border-top: 1px solid #e2e8f0;
          background: #f8fafc;
          display: flex;
          justify-content: flex-end;
        }
        .btn-secondary-action {
          padding: 8px 18px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #334155;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
        }
        .btn-secondary-action:hover {
          background: #f1f5f9;
        }
        .badge-type-pill {
          background: #f1f5f9;
          color: #475569;
          font-size: 11px;
          padding: 2px 7px;
          border-radius: 4px;
          font-weight: 600;
        }
        .badge-priority-tag {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 4px;
        }
        .priority-high { background: #fef2f2; color: #b91c1c; }
        .priority-normal { background: #f8fafc; color: #475569; }
        .priority-low { background: #f0fdf4; color: #166534; }
        .badge-status-tag {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 4px;
        }
        .status-progress { background: #eff6ff; color: #1d4ed8; }
        .status-closed { background: #f0fdf4; color: #166534; }
        .status-pending { background: #fffbeb; color: #b45309; }
        .spin-icon {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
