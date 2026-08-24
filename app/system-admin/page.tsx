"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sidebar } from "@/components/Sidebar";
import { getCurrentProfile, signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { 
  getActiveSessions, 
  getSessionHistory, 
  getAuditLogs, 
  forceLogoutUser,
  UserSession,
  AuditLog
} from "@/lib/security";
import { 
  getRegisterOfficersServer, 
  toggleRegisterOfficerStatusServer 
} from "@/lib/db-actions";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from "recharts";

import "../../i18n";
import "../dashboard-common.css";
import "../daily-mail/daily-mail.css";
import "./system-admin.css";

interface RegisteredAccount {
  id: string;
  employee_no: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export default function SystemAdminDashboard() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");
  const lang = i18n.language;

  // Real-time states
  const [activeSessions, setActiveSessions] = useState<UserSession[]>([]);
  const [sessionHistory, setSessionHistory] = useState<UserSession[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [accounts, setAccounts] = useState<RegisteredAccount[]>([]);
  const [adminName, setAdminName] = useState("System Admin");

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [accountSearchQuery, setAccountSearchQuery] = useState("");
  const [accountRoleFilter, setAccountRoleFilter] = useState("all");
  const [logTypeFilter, setLogTypeFilter] = useState("all");

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadData = async () => {
    // Load current admin name
    const profile = await getCurrentProfile();
    if (profile) {
      setAdminName(profile.full_name);
      if (profile.role !== "system_admin") {
        router.replace("/");
        return;
      }
    } else {
      router.replace("/");
      return;
    }

    // Load security data
    const active = await getActiveSessions();
    const history = await getSessionHistory();
    const logs = await getAuditLogs();
    
    setActiveSessions(active);
    setSessionHistory(history);
    setAuditLogs(logs);

    // Load registered officer accounts from register_officer_table
    try {
      const regRes = await getRegisterOfficersServer();
      if (regRes.success && regRes.data) {
        setAccounts(regRes.data);
      }
    } catch (e) {
      console.error("Failed to load accounts:", e);
    }
  };

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("system-admin-security-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dcmms_sessions" },
        () => {
          loadData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dcmms_audit_logs" },
        () => {
          loadData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dcmms_profiles" },
        () => {
          loadData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "register_officer_table" },
        () => {
          loadData();
        }
      )
      .subscribe();

    const handleLocalUpdate = () => loadData();
    window.addEventListener("storage", handleLocalUpdate);
    window.addEventListener("dcmms_data_updated", handleLocalUpdate);

    const interval = setInterval(loadData, 15000);


    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("storage", handleLocalUpdate);
      window.removeEventListener("dcmms_data_updated", handleLocalUpdate);
      clearInterval(interval);
    };
  }, []);


  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut();
    if (typeof window !== "undefined") {
      localStorage.removeItem("dcmms_current_session_id");
    }
    router.push("/");
  };

  const handleForceLogout = async (sessionId: string) => {
    if (confirm(t("sysAdminConfirmForce"))) {
      await forceLogoutUser(sessionId, adminName);
      loadData();
    }
  };

  // Metrics calculations
  const totalActive = activeSessions.length;
  
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const loginsToday = sessionHistory.filter(s => new Date(s.login_time) >= todayStart).length;
  const logoutsToday = sessionHistory.filter(s => s.logout_time && new Date(s.logout_time) >= todayStart && s.status === "logged_out").length;
  const failedAttemptsToday = auditLogs.filter(log => log.action === "Failed Login Attempt" && new Date(log.timestamp) >= todayStart).length;

  // Filtered Audit Logs
  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = 
      log.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (logTypeFilter === "all") return matchesSearch;
    if (logTypeFilter === "failures") return matchesSearch && log.action === "Failed Login Attempt";
    if (logTypeFilter === "sessions") return matchesSearch && (log.action.includes("Login") || log.action.includes("Logout"));
    return matchesSearch;
  });

  // Chart Data preparation
  // Group activities by hour for today's chart
  const getChartData = () => {
    const hours = Array.from({ length: 12 }, (_, i) => {
      const hr = (new Date().getHours() - 11 + i + 24) % 24;
      return {
        hour: `${hr}:00`,
        Successful: 0,
        Failed: 0,
      };
    });

    sessionHistory.forEach(s => {
      const loginDate = new Date(s.login_time);
      const hoursAgo = Math.floor((Date.now() - loginDate.getTime()) / (1000 * 60 * 60));
      if (hoursAgo < 12) {
        const idx = 11 - hoursAgo;
        if (hours[idx]) {
          hours[idx].Successful += 1;
        }
      }
    });

    auditLogs.forEach(log => {
      if (log.action === "Failed Login Attempt") {
        const logDate = new Date(log.timestamp);
        const hoursAgo = Math.floor((Date.now() - logDate.getTime()) / (1000 * 60 * 60));
        if (hoursAgo < 12) {
          const idx = 11 - hoursAgo;
          if (hours[idx]) {
            hours[idx].Failed += 1;
          }
        }
      }
    });

    return hours;
  };

  const chartData = getChartData();

  // Export Sessions to Excel / CSV
  const exportSessionsToExcel = () => {
    if (!sessionHistory || sessionHistory.length === 0) {
      alert("No session history available to export.");
      return;
    }

    const headers = [
      "Session ID",
      "Officer / User",
      "Email",
      "Login Time",
      "Logout Time",
      "Duration (Seconds)",
      "Duration (Formatted)",
      "Status",
      "IP Address",
    ];

    const rows = sessionHistory.map((s) => {
      const durFormatted = s.duration
        ? `${Math.floor(s.duration / 60)}m ${s.duration % 60}s`
        : s.status === "active"
        ? "Active"
        : "—";

      return [
        `"${s.id}"`,
        `"${(s.username || "").replace(/"/g, '""')}"`,
        `"${(s.email || "").replace(/"/g, '""')}"`,
        `"${new Date(s.login_time).toLocaleString()}"`,
        `"${s.logout_time ? new Date(s.logout_time).toLocaleString() : "—"}"`,
        `"${s.duration ?? ""}"`,
        `"${durFormatted}"`,
        `"${s.status}"`,
        `"${s.ip_address || "127.0.0.1"}"`,
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `DCMMS_User_Sessions_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Audit Logs to Excel / CSV
  const exportAuditLogsToExcel = () => {
    const dataToExport = filteredLogs.length > 0 ? filteredLogs : auditLogs;
    if (!dataToExport || dataToExport.length === 0) {
      alert("No audit logs available to export.");
      return;
    }

    const headers = [
      "Log ID",
      "Timestamp",
      "User ID",
      "Username",
      "Email",
      "Action",
      "Details",
    ];

    const rows = dataToExport.map((log) => [
      `"${log.id}"`,
      `"${new Date(log.timestamp).toLocaleString()}"`,
      `"${log.user_id || "N/A"}"`,
      `"${(log.username || "").replace(/"/g, '""')}"`,
      `"${(log.email || "").replace(/"/g, '""')}"`,
      `"${(log.action || "").replace(/"/g, '""')}"`,
      `"${(log.details || "").replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `DCMMS_Audit_Logs_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Accounts to Excel / CSV
  const exportAccountsToExcel = () => {
    const dataToExport = filteredAccounts.length > 0 ? filteredAccounts : accounts;
    if (!dataToExport || dataToExport.length === 0) {
      alert("No accounts available to export.");
      return;
    }

    const headers = [
      "Employee No",
      "Full Name",
      "E-mail",
      "Role",
      "Account state",
      "Created by",
      "Created at",
    ];

    const rows = dataToExport.map((a) => [
      `"${a.employee_no || ""}"`,
      `"${(a.full_name || "").replace(/"/g, '""')}"`,
      `"${(a.email || "").replace(/"/g, '""')}"`,
      `"${(a.role || "").replace(/"/g, '""')}"`,
      `"${a.is_active ? "Active" : "Inactive"}"`,
      `"${(a.created_by_name || (a.created_by ? "System Admin" : "System Root")).replace(/"/g, '""')}"`,
      `"${a.created_at ? new Date(a.created_at).toLocaleString() : "—"}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `DCMMS_Register_Officer_Accounts_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleToggleAccountStatus = async (account: RegisteredAccount) => {
    const newStatus = !account.is_active;
    await toggleRegisterOfficerStatusServer(account.id, newStatus);
    loadData();
  };

  const filteredAccounts = accounts.filter((a) => {
    const matchesSearch =
      (a.full_name || "").toLowerCase().includes(accountSearchQuery.toLowerCase()) ||
      (a.employee_no || "").toLowerCase().includes(accountSearchQuery.toLowerCase()) ||
      (a.email || "").toLowerCase().includes(accountSearchQuery.toLowerCase()) ||
      (a.created_by_name || "").toLowerCase().includes(accountSearchQuery.toLowerCase());

    if (accountRoleFilter === "all") return matchesSearch;
    return matchesSearch && (a.role || "").toLowerCase().includes(accountRoleFilter.toLowerCase());
  });

  if (!mounted) {
    return <div className="system-admin-container" style={{ minHeight: "100vh", opacity: 0 }}></div>;
  }

  return (
    <div className="system-admin-container" data-font-scale={fontScale}>
      {/* Skip Link */}
      <a href="#sysadmin-main-content" className="skip-link">Skip to main content</a>

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
        role="system_admin"
      />

      <div className="dashboard-layout">
        <main id="sysadmin-main-content" className="dashboard-content">
          
          {/* Header */}
          <header className="dashboard-header">
            <div className="dashboard-header-left">
              <button 
                className="menu-toggle-btn" 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                aria-label="Toggle Sidebar"
              >
                <svg className="hamburger-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="dashboard-title-area">
                <h2 className="dashboard-main-title">{t("sysAdminTitle")}</h2>
                <p className="dashboard-main-subtitle">{t("sysAdminSubtitle")}</p>
              </div>
            </div>

            <div className="dashboard-header-right">
              {/* Language Switcher */}
              <div className="trilingual-language-selector">
                <button className={`lang-btn ${lang === "si" ? "active" : ""}`} onClick={() => i18n.changeLanguage("si")}>සිංහල</button>
                <button className={`lang-btn ${lang === "ta" ? "active" : ""}`} onClick={() => i18n.changeLanguage("ta")}>தமிழ்</button>
                <button className={`lang-btn ${lang === "en" ? "active" : ""}`} onClick={() => i18n.changeLanguage("en")}>English</button>
              </div>
            </div>
          </header>

          {/* Stats Grid */}
          <div className="sysadmin-stats-grid">
            <div className="sysadmin-stat-card">
              <div className="stat-card-header">
                <div className="stat-icon-wrapper active-users">
                  <svg className="stat-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <h3 className="stat-card-title">{t("sysAdminActiveUsers")}</h3>
              </div>
              <div className="stat-card-value">{totalActive}</div>
              <p className="stat-card-desc">{t("sysAdminActiveUsersDesc")}</p>
            </div>

            <div className="sysadmin-stat-card">
              <div className="stat-card-header">
                <div className="stat-icon-wrapper logins-today">
                  <svg className="stat-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                </div>
                <h3 className="stat-card-title">{t("sysAdminLoginsToday")}</h3>
              </div>
              <div className="stat-card-value">{loginsToday}</div>
              <p className="stat-card-desc">{t("sysAdminLoginsTodayDesc")}</p>
            </div>

            <div className="sysadmin-stat-card">
              <div className="stat-card-header">
                <div className="stat-icon-wrapper logouts-today">
                  <svg className="stat-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </div>
                <h3 className="stat-card-title">{t("sysAdminLogoutsToday")}</h3>
              </div>
              <div className="stat-card-value">{logoutsToday}</div>
              <p className="stat-card-desc">{t("sysAdminLogoutsTodayDesc")}</p>
            </div>

            <div className="sysadmin-stat-card danger">
              <div className="stat-card-header">
                <div className="stat-icon-wrapper failures-today">
                  <svg className="stat-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="stat-card-title">{t("sysAdminFailedLogins")}</h3>
              </div>
              <div className="stat-card-value">{failedAttemptsToday}</div>
              <p className="stat-card-desc">{t("sysAdminFailedLoginsDesc")}</p>
            </div>
          </div>

          {/* Chart Section */}
          <div className="sysadmin-chart-card">
            <h3 className="card-title-header">{t("sysAdminChartTitle")}</h3>
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="hour" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="Successful" stroke="#10B981" fillOpacity={1} fill="url(#colorSuccess)" />
                  <Area type="monotone" dataKey="Failed" stroke="#EF4444" fillOpacity={1} fill="url(#colorFailed)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Registered Accounts & Role Privileges (register_officer_table) ── */}
          <div className="sysadmin-card-section">
            <div className="sysadmin-card-header-flex">
              <div>
                <h3 className="card-title-header" style={{ marginBottom: 4 }}>
                  <svg className="card-title-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {t("sysAdminRegisteredAccounts", "System Accounts & Role Privileges")}
                </h3>
                <p style={{ margin: 0, fontSize: "0.825rem", color: "#64748b" }}>
                  Live synchronized directory from <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>public.register_officer_table</code>
                </p>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button 
                  className="btn-export-excel" 
                  onClick={exportAccountsToExcel}
                  title="Export accounts to Excel / CSV"
                >
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {t("exportExcel", "Export to Excel")}
                </button>
                <button
                  onClick={() => router.push("/system-admin/add-branch-admin")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    backgroundColor: "#1e40af",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  + {t("addBranchAdmin", "Add Branch Admin")}
                </button>
              </div>
            </div>

            {/* Filters Bar for Accounts */}
            <div className="sysadmin-filter-bar" style={{ marginTop: 16 }}>
              <input
                type="text"
                className="filter-input-search"
                placeholder={t("searchAccountsPlaceholder", "Search by Employee No, Full Name, Email, or Creator...")}
                value={accountSearchQuery}
                onChange={(e) => setAccountSearchQuery(e.target.value)}
              />
              <select 
                className="filter-select-type"
                value={accountRoleFilter}
                onChange={(e) => setAccountRoleFilter(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="system">System admin</option>
                <option value="branch">Branch admin</option>
                <option value="subject">Subject officer</option>
                <option value="daily">Daily mail officer</option>
                <option value="investigation">Investigation officer</option>
              </select>
            </div>

            {filteredAccounts.length > 0 ? (
              <div className="table-responsive-container">
                <table className="sysadmin-data-table">
                  <thead>
                    <tr>
                      <th style={{ width: "14%" }}>Employee No</th>
                      <th style={{ width: "18%" }}>Full Name</th>
                      <th style={{ width: "18%" }}>E-mail</th>
                      <th style={{ width: "14%" }}>Role</th>
                      <th style={{ width: "10%" }}>Account state</th>
                      <th style={{ width: "13%" }}>Created by</th>
                      <th style={{ width: "13%" }}>Created at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccounts.map((acc) => (
                      <tr key={acc.id} className="sysadmin-table-row">
                        <td className="font-semibold text-primary font-mono">{acc.employee_no || "—"}</td>
                        <td className="font-medium text-gray-900">{acc.full_name}</td>
                        <td className="text-gray-600">{acc.email}</td>
                        <td>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "3px 8px",
                              borderRadius: 6,
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              backgroundColor: acc.role?.toLowerCase().includes("system")
                                ? "#fee2e2"
                                : acc.role?.toLowerCase().includes("branch")
                                ? "#ede9fe"
                                : "#e0f2fe",
                              color: acc.role?.toLowerCase().includes("system")
                                ? "#b91c1c"
                                : acc.role?.toLowerCase().includes("branch")
                                ? "#6d28d9"
                                : "#0369a1",
                            }}
                          >
                            {acc.role || "User"}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => handleToggleAccountStatus(acc)}
                            title={`Click to ${acc.is_active ? "deactivate" : "activate"}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "3px 8px",
                              borderRadius: 12,
                              fontSize: "0.725rem",
                              fontWeight: 600,
                              border: "none",
                              cursor: "pointer",
                              backgroundColor: acc.is_active ? "#dcfce7" : "#fee2e2",
                              color: acc.is_active ? "#166534" : "#991b1b",
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                backgroundColor: acc.is_active ? "#16a34a" : "#dc2626",
                              }}
                            />
                            {acc.is_active ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="text-xs text-gray-600">
                          {acc.created_by_name || (acc.created_by ? "System Admin" : "System Root")}
                        </td>
                        <td className="text-xs text-gray-500">
                          {acc.created_at ? new Date(acc.created_at).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state-text">No registered accounts found in register_officer_table.</p>
            )}
          </div>

          {/* Active Sessions Control Panel */}
          <div className="sysadmin-card-section">
            <h3 className="card-title-header">
              <svg className="card-title-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              {t("sysAdminActiveSessions")}
            </h3>
            {activeSessions.length > 0 ? (
              <div className="table-responsive-container">
                <table className="sysadmin-data-table">
                  <thead>
                    <tr>
                      <th>{t("sysAdminUserName")}</th>
                      <th>{t("sysAdminEmail")}</th>
                      <th>{t("sysAdminLoginTime")}</th>
                      <th>{t("sysAdminIP")}</th>
                      <th>{t("sysAdminActions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSessions.map((session) => (
                      <tr key={session.id} className="sysadmin-table-row">
                        <td className="font-semibold text-primary">{session.username}</td>
                        <td>{session.email}</td>
                        <td>{new Date(session.login_time).toLocaleString()}</td>
                        <td className="font-mono text-xs">{session.ip_address || "127.0.0.1"}</td>
                        <td>
                          <button 
                            className="btn-force-logout" 
                            onClick={() => handleForceLogout(session.id)}
                            title="Terminate session immediately"
                          >
                            {t("sysAdminForceLogout")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state-text">{t("sysAdminNoActiveSessions")}</p>
            )}
          </div>

          {/* User Session History */}
          <div className="sysadmin-card-section">
            <div className="sysadmin-card-header-flex">
              <h3 className="card-title-header">
                <svg className="card-title-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t("sysAdminHistoryTitle")}
              </h3>
              <button 
                className="btn-export-excel" 
                onClick={exportSessionsToExcel}
                title="Export user session history to Excel"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t("exportExcel", "Export to Excel")}
              </button>
            </div>
            {sessionHistory.length > 0 ? (
              <div className="table-responsive-container">
                <table className="sysadmin-data-table">
                  <thead>
                    <tr>
                      <th>{t("sysAdminUserName")}</th>
                      <th>{t("sysAdminEmail")}</th>
                      <th>{t("sysAdminLoginTime")}</th>
                      <th>{t("sysAdminLogoutTime")}</th>
                      <th>{t("sysAdminDuration")}</th>
                      <th>{t("sysAdminStatus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionHistory.slice(0, 10).map((history) => {
                      const duration = history.duration 
                        ? `${Math.floor(history.duration / 60)}m ${history.duration % 60}s`
                        : history.status === "active" ? "Active" : "Unknown";
                      return (
                        <tr key={history.id} className="sysadmin-table-row">
                          <td className="font-semibold">{history.username}</td>
                          <td>{history.email}</td>
                          <td>{new Date(history.login_time).toLocaleString()}</td>
                          <td>{history.logout_time ? new Date(history.logout_time).toLocaleString() : "—"}</td>
                          <td>{duration}</td>
                          <td>
                            <span className={`badge-status ${history.status}`}>
                              {history.status === "active" ? "Active" : history.status === "forced_logged_out" ? "Forced Out" : "Logged Out"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state-text">{t("sysAdminNoHistory")}</p>
            )}
          </div>

          {/* Audit Logs & Trail */}
          <div className="sysadmin-card-section">
            <div className="sysadmin-card-header-flex">
              <h3 className="card-title-header">
                <svg className="card-title-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t("sysAdminAuditTitle")}
              </h3>
              <button 
                className="btn-export-excel" 
                onClick={exportAuditLogsToExcel}
                title="Export system audit logs to Excel"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t("exportExcel", "Export to Excel")}
              </button>
            </div>

            {/* Filters Bar */}
            <div className="sysadmin-filter-bar">
              <input
                type="text"
                className="filter-input-search"
                placeholder={t("sysAdminSearchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select 
                className="filter-select-type"
                value={logTypeFilter}
                onChange={(e) => setLogTypeFilter(e.target.value)}
              >
                <option value="all">{t("sysAdminAllEvents")}</option>
                <option value="failures">{t("sysAdminFailuresOnly")}</option>
                <option value="sessions">{t("sysAdminSessionsOnly")}</option>
              </select>
            </div>

            {filteredLogs.length > 0 ? (
              <div className="table-responsive-container">
                <table className="sysadmin-data-table font-mono text-xs">
                  <thead>
                    <tr>
                      <th style={{ width: "20%" }}>{t("sysAdminTimestamp")}</th>
                      <th style={{ width: "15%" }}>{t("sysAdminUser")}</th>
                      <th style={{ width: "25%" }}>{t("sysAdminAction")}</th>
                      <th style={{ width: "40%" }}>{t("sysAdminDetails")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.slice(0, 15).map((log) => (
                      <tr key={log.id} className={`sysadmin-table-row audit-row ${log.action.includes("Failed") ? "failure-log" : ""}`}>
                        <td>{new Date(log.timestamp).toLocaleString()}</td>
                        <td>
                          <div>{log.username}</div>
                          <div className="text-[10px] text-gray-500">{log.email}</div>
                        </td>
                        <td className="font-semibold">{log.action}</td>
                        <td className="text-gray-600">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state-text">{t("sysAdminNoAuditMatches")}</p>
            )}
          </div>

        </main>
      </div>
    </div>
  );
}

