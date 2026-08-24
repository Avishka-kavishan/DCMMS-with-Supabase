"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sidebar } from "@/components/Sidebar";
import { getCurrentProfile, signOut } from "@/lib/auth";
import { 
  exportToExcel, 
  getActiveExcelPassword, 
  setActiveExcelPassword, 
  DEFAULT_EXCEL_PASSWORD 
} from "@/lib/export-excel";
import { supabase } from "@/lib/supabase";
import { 
  getActiveSessions, 
  getSessionHistory, 
  getAuditLogs, 
  forceLogoutUser,
  logAuditEvent,
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

  // Excel Export Password Management State
  const [currentExcelPassword, setCurrentExcelPassword] = useState(DEFAULT_EXCEL_PASSWORD);
  const [isPwdVisible, setIsPwdVisible] = useState(false);
  const [newExcelPassword, setNewExcelPassword] = useState("");
  const [confirmExcelPassword, setConfirmExcelPassword] = useState("");
  const [isNewPwdVisible, setIsNewPwdVisible] = useState(false);
  const [isSavingExcelPwd, setIsSavingExcelPwd] = useState(false);
  const [excelStatusMsg, setExcelStatusMsg] = useState<{ text: string; type: "success" | "error" | "" }>({ text: "", type: "" });
  const [isCopiedPwd, setIsCopiedPwd] = useState(false);

  // Search & Filter State
  const [activeLogTab, setActiveLogTab] = useState<"audit" | "sessions">("audit");
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [logTypeFilter, setLogTypeFilter] = useState("all");
  const [sessionStatusFilter, setSessionStatusFilter] = useState("all");
  const [accountSearchQuery, setAccountSearchQuery] = useState("");
  const [accountRoleFilter, setAccountRoleFilter] = useState("all");

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCurrentExcelPassword(getActiveExcelPassword());

    const handlePwdChange = () => {
      setCurrentExcelPassword(getActiveExcelPassword());
    };
    window.addEventListener("dcmms_excel_password_changed", handlePwdChange);
    return () => {
      window.removeEventListener("dcmms_excel_password_changed", handlePwdChange);
    };
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
      (log.username || "").toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      (log.email || "").toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      (log.action || "").toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      (log.details || "").toLowerCase().includes(logSearchQuery.toLowerCase());
    
    if (logTypeFilter === "all") return matchesSearch;
    if (logTypeFilter === "officers") return matchesSearch && (log.action.toLowerCase().includes("letter") || log.action.toLowerCase().includes("case") || log.action.toLowerCase().includes("inquiry") || log.action.toLowerCase().includes("investigation") || log.action.toLowerCase().includes("scheduled") || log.action.toLowerCase().includes("extension") || log.action.toLowerCase().includes("stage"));
    if (logTypeFilter === "failures") return matchesSearch && log.action.toLowerCase().includes("fail");
    if (logTypeFilter === "sessions") return matchesSearch && (log.action.toLowerCase().includes("login") || log.action.toLowerCase().includes("logout"));
    if (logTypeFilter === "admin") return matchesSearch && (log.action.toLowerCase().includes("force") || log.action.toLowerCase().includes("admin") || log.action.toLowerCase().includes("status") || log.action.toLowerCase().includes("register") || log.action.toLowerCase().includes("password"));
    return matchesSearch;
  });

  // Filtered Sessions
  const filteredSessions = sessionHistory.filter(s => {
    const matchesSearch =
      (s.username || "").toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      (s.email || "").toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      (s.ip_address || "").toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      (s.status || "").toLowerCase().includes(logSearchQuery.toLowerCase());

    if (sessionStatusFilter === "all") return matchesSearch;
    return matchesSearch && s.status === sessionStatusFilter;
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

  // Export Sessions to Excel (.xlsx with sheet protection)
  const exportSessionsToExcel = () => {
    const dataToExport = filteredSessions.length > 0 ? filteredSessions : sessionHistory;
    if (!dataToExport || dataToExport.length === 0) {
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

    const rows = dataToExport.map((s) => {
      const durFormatted = s.duration
        ? `${Math.floor(s.duration / 60)}m ${s.duration % 60}s`
        : s.status === "active"
        ? "Active"
        : "—";

      return [
        s.id,
        s.username || "—",
        s.email || "—",
        new Date(s.login_time).toLocaleString(),
        s.logout_time ? new Date(s.logout_time).toLocaleString() : "—",
        s.duration ?? "",
        durFormatted,
        s.status,
        s.ip_address || "127.0.0.1",
      ];
    });

    exportToExcel(
      `DCMMS_User_Sessions_${new Date().toISOString().split("T")[0]}`,
      headers,
      rows,
      { sheetName: "Session History" }
    );
  };

  // Export Audit Logs to Excel (.xlsx with sheet protection)
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
      log.id,
      new Date(log.timestamp).toLocaleString(),
      log.user_id || "N/A",
      log.username || "—",
      log.email || "—",
      log.action || "—",
      (log.details || "").replace(/[\r\n]+/g, " "),
    ]);

    exportToExcel(
      `DCMMS_Audit_Logs_${new Date().toISOString().split("T")[0]}`,
      headers,
      rows,
      { sheetName: "Audit Trail" }
    );
  };

  // Export Accounts to Excel (.xlsx with sheet protection)
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
      a.employee_no || "",
      a.full_name || "",
      a.email || "",
      a.role || "",
      a.is_active ? "Active" : "Inactive",
      a.created_by_name || (a.created_by ? "System Admin" : "System Root"),
      a.created_at ? new Date(a.created_at).toLocaleString() : "—",
    ]);

    exportToExcel(
      `DCMMS_Register_Officer_Accounts_${new Date().toISOString().split("T")[0]}`,
      headers,
      rows,
      { sheetName: "Officer Accounts" }
    );
  };

  const handleToggleAccountStatus = async (account: RegisteredAccount) => {
    const newStatus = !account.is_active;
    await toggleRegisterOfficerStatusServer(account.id, newStatus);
    loadData();
  };

  const handleCopyExcelPassword = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(currentExcelPassword);
      setIsCopiedPwd(true);
      setTimeout(() => setIsCopiedPwd(false), 2000);
    }
  };

  const handleUpdateExcelPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setExcelStatusMsg({ text: "", type: "" });

    if (!newExcelPassword || newExcelPassword.trim().length < 4) {
      setExcelStatusMsg({
        text: "Password must be at least 4 characters long.",
        type: "error",
      });
      return;
    }

    if (newExcelPassword !== confirmExcelPassword) {
      setExcelStatusMsg({
        text: "New password and confirmation password do not match.",
        type: "error",
      });
      return;
    }

    setIsSavingExcelPwd(true);
    try {
      setActiveExcelPassword(newExcelPassword.trim());
      setCurrentExcelPassword(newExcelPassword.trim());

      await logAuditEvent(
        null,
        adminName,
        "",
        "EXCEL_PASSWORD_UPDATED",
        `Excel sheet protection password was updated to a custom key by System Admin ${adminName}`
      );

      setNewExcelPassword("");
      setConfirmExcelPassword("");
      setExcelStatusMsg({
        text: "Excel sheet protection password updated successfully! All future exports will use this new unlock key.",
        type: "success",
      });

      // Reload audit logs to show the new event
      const logs = await getAuditLogs();
      setAuditLogs(logs);
    } catch (err: any) {
      setExcelStatusMsg({
        text: err?.message || "Failed to update password.",
        type: "error",
      });
    } finally {
      setIsSavingExcelPwd(false);
    }
  };

  const handleResetExcelPasswordToDefault = async () => {
    if (!confirm("Are you sure you want to reset the Excel sheet protection password to system default (DCMMS@Secure2026)?")) {
      return;
    }

    setIsSavingExcelPwd(true);
    try {
      setActiveExcelPassword(DEFAULT_EXCEL_PASSWORD);
      setCurrentExcelPassword(DEFAULT_EXCEL_PASSWORD);
      setNewExcelPassword("");
      setConfirmExcelPassword("");

      await logAuditEvent(
        null,
        adminName,
        "",
        "EXCEL_PASSWORD_RESET",
        `Excel sheet protection password was reset to system default by System Admin ${adminName}`
      );

      setExcelStatusMsg({
        text: "Excel password reset to system default (DCMMS@Secure2026).",
        type: "success",
      });

      const logs = await getAuditLogs();
      setAuditLogs(logs);
    } catch (err: any) {
      setExcelStatusMsg({
        text: err?.message || "Failed to reset password.",
        type: "error",
      });
    } finally {
      setIsSavingExcelPwd(false);
    }
  };

  const handleTestExcelExport = () => {
    const testHeaders = ["System Ref", "Verification Module", "Timestamp", "Security State"];
    const testRows = [
      ["DCMMS-SEC-01", "Sheet Protection Test", new Date().toLocaleString(), "LOCKED (Read-Only)"],
      ["DCMMS-SEC-02", "Password Verification", new Date().toISOString(), `Protected with Key: ${currentExcelPassword}`],
    ];
    exportToExcel(`DCMMS_Password_Verification_Sample_${new Date().toISOString().split("T")[0]}`, testHeaders, testRows, {
      sheetName: "Security Test",
      password: currentExcelPassword,
    });
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

          {/* ── Excel Export Sheet Protection & Password Reset ── */}
          <div className="excel-security-card">
            <div className="sysadmin-card-header-flex">
              <div>
                <h3 className="card-title-header" style={{ marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                  <svg className="card-title-icon" fill="none" viewBox="0 0 24 24" stroke="#1e3a8a" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  {t("excelSecurityTitle", "Excel Export Sheet Protection & Unlock Password")}
                </h3>
                <p style={{ margin: 0, fontSize: "0.825rem", color: "#64748b" }}>
                  {t("excelSecurityDesc", "All spreadsheet exports (.xlsx) are locked against tampering. Configure or reset the administrative unprotect password below.")}
                </p>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ 
                  background: "#dcfce7", 
                  color: "#15803d", 
                  padding: "4px 10px", 
                  borderRadius: 20, 
                  fontSize: "0.75rem", 
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block" }}></span>
                  {t("protectionActive", "Active Protection Enforced")}
                </span>
                <button
                  type="button"
                  className="btn-icon-action"
                  onClick={handleTestExcelExport}
                  title="Download a test .xlsx sheet to verify unlock in Excel"
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {t("testExport", "Test Sample Export")}
                </button>
                <button
                  type="button"
                  className="btn-icon-action"
                  style={{ background: "#1e40af", color: "#ffffff", borderColor: "#1e3a8a" }}
                  onClick={() => router.push("/system-admin/excel-security")}
                  title="Open dedicated Excel security management page"
                >
                  <span>Open Full Page &rarr;</span>
                </button>
              </div>
            </div>

            <div className="excel-security-grid">
              {/* Left Column: Current Password Details */}
              <div className="excel-current-box">
                <div>
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {t("currentUnlockPassword", "Current Unlock Password")}
                  </span>
                  <div className="excel-pwd-display-row">
                    <span>
                      {isPwdVisible ? currentExcelPassword : "•".repeat(Math.max(currentExcelPassword.length, 8))}
                    </span>
                    <button
                      type="button"
                      className="excel-toggle-btn"
                      style={{ position: "static" }}
                      onClick={() => setIsPwdVisible(!isPwdVisible)}
                      title={isPwdVisible ? "Hide password" : "Show password"}
                    >
                      {isPwdVisible ? (
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                    {t("excelUnlockTip", "To unprotect in MS Excel: Go to Review tab > Unprotect Sheet > Enter this password.")}
                  </p>
                </div>

                <div className="excel-pwd-actions" style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className="btn-icon-action"
                    onClick={handleCopyExcelPassword}
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    {isCopiedPwd ? t("copied", "Copied!") : t("copyPassword", "Copy Password")}
                  </button>
                  <button
                    type="button"
                    className="btn-reset-default"
                    style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                    onClick={handleResetExcelPasswordToDefault}
                    disabled={isSavingExcelPwd}
                  >
                    {t("resetToDefault", "Reset to Default")}
                  </button>
                </div>
              </div>

              {/* Right Column: Reset & Change Password Form */}
              <div className="excel-form-box">
                <form onSubmit={handleUpdateExcelPassword}>
                  <div className="excel-input-group">
                    <label htmlFor="new-excel-pwd">{t("newExcelPassword", "Set New Excel Unlock Password")}</label>
                    <div className="excel-input-wrapper">
                      <input
                        id="new-excel-pwd"
                        type={isNewPwdVisible ? "text" : "password"}
                        placeholder="Enter new password (min. 4 chars)..."
                        value={newExcelPassword}
                        onChange={(e) => setNewExcelPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="excel-toggle-btn"
                        onClick={() => setIsNewPwdVisible(!isNewPwdVisible)}
                      >
                        {isNewPwdVisible ? (
                          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="excel-input-group">
                    <label htmlFor="confirm-excel-pwd">{t("confirmExcelPassword", "Confirm New Password")}</label>
                    <div className="excel-input-wrapper">
                      <input
                        id="confirm-excel-pwd"
                        type={isNewPwdVisible ? "text" : "password"}
                        placeholder="Re-type new password to confirm..."
                        value={confirmExcelPassword}
                        onChange={(e) => setConfirmExcelPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  <div className="excel-btn-group">
                    <button
                      type="submit"
                      className="btn-save-pwd"
                      disabled={isSavingExcelPwd || !newExcelPassword}
                    >
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {isSavingExcelPwd ? t("saving", "Saving...") : t("savePassword", "Update Protection Password")}
                    </button>
                  </div>

                  {excelStatusMsg.text && (
                    <div className={`excel-msg-badge ${excelStatusMsg.type}`}>
                      {excelStatusMsg.type === "success" ? (
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      <span>{excelStatusMsg.text}</span>
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>

          {/* ── Combined System Audit Trail & User Session History ── */}
          <div className="sysadmin-card-section">
            <div className="sysadmin-card-header-flex">
              <div>
                <h3 className="card-title-header" style={{ marginBottom: 4 }}>
                  <svg className="card-title-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {t("sysAdminCombinedTitle", "User Session History & System Audit Trail")}
                </h3>
                <p style={{ margin: 0, fontSize: "0.825rem", color: "#64748b" }}>
                  {t("sysAdminCombinedSubtitle", "Integrated monitoring of system event logs, security actions, and user session lifecycles.")}
                </p>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button 
                  className="btn-export-excel" 
                  onClick={activeLogTab === "audit" ? exportAuditLogsToExcel : exportSessionsToExcel}
                  title={`Export ${activeLogTab === "audit" ? "Audit Trail" : "Session History"} to Excel / CSV`}
                >
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {t("exportExcel", "Export to Excel")}
                </button>
              </div>
            </div>

            {/* Navigation Tabs Switcher */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginTop: 16, marginBottom: 16 }}>
              <div className="sysadmin-tabs-nav" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeLogTab === "audit"}
                  className={`sysadmin-tab-btn ${activeLogTab === "audit" ? "active" : ""}`}
                  onClick={() => setActiveLogTab("audit")}
                >
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>{t("sysAdminTabAudit", "System Audit Trail & Event Logs")}</span>
                  <span className="sysadmin-tab-badge">{filteredLogs.length}</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeLogTab === "sessions"}
                  className={`sysadmin-tab-btn ${activeLogTab === "sessions" ? "active" : ""}`}
                  onClick={() => setActiveLogTab("sessions")}
                >
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{t("sysAdminTabSessions", "User Session History")}</span>
                  <span className="sysadmin-tab-badge">{filteredSessions.length}</span>
                </button>
              </div>
            </div>

            {/* Filters Bar for Active Tab */}
            <div className="sysadmin-filter-bar" style={{ marginBottom: 18 }}>
              <input
                type="text"
                className="filter-input-search"
                placeholder={
                  activeLogTab === "audit"
                    ? t("sysAdminSearchLogsPlaceholder", "Search audit logs by user, email, action, or details...")
                    : t("sysAdminSearchSessionsPlaceholder", "Search session history by user, email, IP, or status...")
                }
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
              />

              {activeLogTab === "audit" ? (
                <select 
                  className="filter-select-type"
                  value={logTypeFilter}
                  onChange={(e) => setLogTypeFilter(e.target.value)}
                >
                  <option value="all">{t("sysAdminAllEvents", "All Events")}</option>
                  <option value="officers">{t("sysAdminOfficerActionsOnly", "Officer & Case Operations")}</option>
                  <option value="sessions">{t("sysAdminSessionsOnly", "Session Activities Only")}</option>
                  <option value="failures">{t("sysAdminFailuresOnly", "Failed Attempts Only")}</option>
                  <option value="admin">{t("sysAdminAdminActionsOnly", "Admin Actions Only")}</option>
                </select>
              ) : (
                <select 
                  className="filter-select-type"
                  value={sessionStatusFilter}
                  onChange={(e) => setSessionStatusFilter(e.target.value)}
                >
                  <option value="all">{t("sysAdminAllStatuses", "All Session Statuses")}</option>
                  <option value="active">{t("sysAdminStatusActive", "Active Sessions")}</option>
                  <option value="logged_out">{t("sysAdminStatusLoggedOut", "Logged Out")}</option>
                  <option value="forced_logged_out">{t("sysAdminStatusForcedOut", "Forced Terminated")}</option>
                </select>
              )}
            </div>

            {/* Tab 1: Audit Trail & Event Logs */}
            {activeLogTab === "audit" && (
              filteredLogs.length > 0 ? (
                <div className="table-responsive-container">
                  <table className="sysadmin-data-table font-mono text-xs">
                    <thead>
                      <tr>
                        <th style={{ width: "20%" }}>{t("sysAdminTimestamp", "Timestamp")}</th>
                        <th style={{ width: "18%" }}>{t("sysAdminUser", "User")}</th>
                        <th style={{ width: "22%" }}>{t("sysAdminAction", "Event Action")}</th>
                        <th style={{ width: "40%" }}>{t("sysAdminDetails", "Detail Description")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.slice(0, 30).map((log) => {
                        const isFailed = log.action.toLowerCase().includes("fail");
                        const isForced = log.action.toLowerCase().includes("force");
                        const isLogin = log.action.toLowerCase().includes("login") && !isFailed;
                        const isLogout = log.action.toLowerCase().includes("logout") && !isForced;
                        const isCase = log.action.toLowerCase().includes("letter") || log.action.toLowerCase().includes("case") || log.action.toLowerCase().includes("inquiry") || log.action.toLowerCase().includes("investigation") || log.action.toLowerCase().includes("scheduled") || log.action.toLowerCase().includes("extension") || log.action.toLowerCase().includes("stage");
                        const isAdmin = log.action.toLowerCase().includes("admin") || log.action.toLowerCase().includes("status") || log.action.toLowerCase().includes("register") || log.action.toLowerCase().includes("password");

                        const pillClass = isFailed ? "failed" : isForced ? "forced" : isLogin ? "login" : isLogout ? "logout" : isCase ? "case" : isAdmin ? "admin" : "default";

                        return (
                          <tr key={log.id} className={`sysadmin-table-row audit-row ${isFailed ? "failure-log" : ""}`}>
                            <td className="text-gray-500 font-sans text-xs">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td>
                              <div className="font-semibold text-gray-900 font-sans">{log.username}</div>
                              <div className="text-[11px] text-gray-500 font-sans">{log.email}</div>
                            </td>
                            <td>
                              <span className={`action-pill ${pillClass} font-sans`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="text-gray-600 font-sans text-xs">{log.details}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-state-text">{t("sysAdminNoAuditMatches", "No audit log records match the search filter.")}</p>
              )
            )}

            {/* Tab 2: User Session History */}
            {activeLogTab === "sessions" && (
              filteredSessions.length > 0 ? (
                <div className="table-responsive-container">
                  <table className="sysadmin-data-table">
                    <thead>
                      <tr>
                        <th style={{ width: "22%" }}>{t("sysAdminUserName", "User Name")}</th>
                        <th style={{ width: "20%" }}>{t("sysAdminLoginTime", "Login Time")}</th>
                        <th style={{ width: "20%" }}>{t("sysAdminLogoutTime", "Logout Date/Time")}</th>
                        <th style={{ width: "14%" }}>{t("sysAdminDuration", "Session Duration")}</th>
                        <th style={{ width: "12%" }}>{t("sysAdminStatus", "Status")}</th>
                        <th style={{ width: "12%" }}>{t("sysAdminIP", "IP Address")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSessions.slice(0, 30).map((history) => {
                        const duration = history.duration 
                          ? `${Math.floor(history.duration / 60)}m ${history.duration % 60}s`
                          : history.status === "active" ? "Active" : "—";
                        return (
                          <tr key={history.id} className="sysadmin-table-row">
                            <td>
                              <div className="font-semibold text-gray-900">{history.username}</div>
                              <div className="text-xs text-gray-500">{history.email}</div>
                            </td>
                            <td className="text-xs text-gray-600">{new Date(history.login_time).toLocaleString()}</td>
                            <td className="text-xs text-gray-600">{history.logout_time ? new Date(history.logout_time).toLocaleString() : "—"}</td>
                            <td>
                              <span className="duration-pill">
                                {duration}
                              </span>
                            </td>
                            <td>
                              <span className={`badge-status ${history.status}`}>
                                {history.status === "active" ? "Active" : history.status === "forced_logged_out" ? "Forced Out" : "Logged Out"}
                              </span>
                            </td>
                            <td className="font-mono text-xs text-gray-500">{history.ip_address || "127.0.0.1"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-state-text">{t("sysAdminNoSessionMatches", "No session history records match the search filter.")}</p>
              )
            )}
          </div>

        </main>
      </div>
    </div>
  );
}

