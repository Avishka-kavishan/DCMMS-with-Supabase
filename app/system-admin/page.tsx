"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sidebar } from "@/components/Sidebar";
import { getCurrentProfile } from "@/lib/auth";
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
  const [adminName, setAdminName] = useState("System Admin");

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
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
    setActiveSessions(getActiveSessions());
    setSessionHistory(getSessionHistory());
    setAuditLogs(getAuditLogs());
  };

  useEffect(() => {
    loadData();
    // Refresh security dashboard data every 4 seconds
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    supabase.auth.signOut().then(() => {
      if (typeof window !== "undefined") {
        localStorage.removeItem("dcmms_current_session_id");
      }
      router.push("/");
    });
  };

  const handleForceLogout = async (sessionId: string) => {
    if (confirm("Are you sure you want to force logout this session? The user will be disconnected immediately.")) {
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
                <h2 className="dashboard-main-title">Security & Session Control Center</h2>
                <p className="dashboard-main-subtitle">Monitor logins, active sessions, and system audit logs.</p>
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
                <h3 className="stat-card-title">Currently Active Users</h3>
              </div>
              <div className="stat-card-value">{totalActive}</div>
              <p className="stat-card-desc">Real-time active web sessions</p>
            </div>

            <div className="sysadmin-stat-card">
              <div className="stat-card-header">
                <div className="stat-icon-wrapper logins-today">
                  <svg className="stat-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                </div>
                <h3 className="stat-card-title">Today&apos;s Logins</h3>
              </div>
              <div className="stat-card-value">{loginsToday}</div>
              <p className="stat-card-desc">Successful logins since midnight</p>
            </div>

            <div className="sysadmin-stat-card">
              <div className="stat-card-header">
                <div className="stat-icon-wrapper logouts-today">
                  <svg className="stat-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </div>
                <h3 className="stat-card-title">Today&apos;s Logouts</h3>
              </div>
              <div className="stat-card-value">{logoutsToday}</div>
              <p className="stat-card-desc">Graceful session terminations</p>
            </div>

            <div className="sysadmin-stat-card danger">
              <div className="stat-card-header">
                <div className="stat-icon-wrapper failures-today">
                  <svg className="stat-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="stat-card-title">Failed Logins</h3>
              </div>
              <div className="stat-card-value">{failedAttemptsToday}</div>
              <p className="stat-card-desc">Invalid credential events today</p>
            </div>
          </div>

          {/* Chart Section */}
          <div className="sysadmin-chart-card">
            <h3 className="card-title-header">Login Attempt Metrics (Last 12 Hours)</h3>
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

          {/* Active Sessions Control Panel */}
          <div className="sysadmin-card-section">
            <h3 className="card-title-header">
              <svg className="card-title-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Active User Sessions (Live Monitor)
            </h3>
            {activeSessions.length > 0 ? (
              <div className="table-responsive-container">
                <table className="sysadmin-data-table">
                  <thead>
                    <tr>
                      <th>User Name</th>
                      <th>Email Address</th>
                      <th>Login Time</th>
                      <th>Simulated IP</th>
                      <th>Actions</th>
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
                            Force Logout
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state-text">No active user sessions detected.</p>
            )}
          </div>

          {/* User Session History */}
          <div className="sysadmin-card-section">
            <h3 className="card-title-header">
              <svg className="card-title-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              User Session History
            </h3>
            {sessionHistory.length > 0 ? (
              <div className="table-responsive-container">
                <table className="sysadmin-data-table">
                  <thead>
                    <tr>
                      <th>User Name</th>
                      <th>Email</th>
                      <th>Login Date/Time</th>
                      <th>Logout Date/Time</th>
                      <th>Session Duration</th>
                      <th>Status</th>
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
              <p className="empty-state-text">No session history recorded.</p>
            )}
          </div>

          {/* Audit Logs & Trail */}
          <div className="sysadmin-card-section">
            <h3 className="card-title-header">
              <svg className="card-title-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              System Audit Trail & Event Logs
            </h3>

            {/* Filters Bar */}
            <div className="sysadmin-filter-bar">
              <input
                type="text"
                className="filter-input-search"
                placeholder="Search audit trail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select 
                className="filter-select-type"
                value={logTypeFilter}
                onChange={(e) => setLogTypeFilter(e.target.value)}
              >
                <option value="all">All Events</option>
                <option value="failures">Failed Attempts Only</option>
                <option value="sessions">Session Activities Only</option>
              </select>
            </div>

            {filteredLogs.length > 0 ? (
              <div className="table-responsive-container">
                <table className="sysadmin-data-table font-mono text-xs">
                  <thead>
                    <tr>
                      <th style={{ width: "20%" }}>Timestamp</th>
                      <th style={{ width: "15%" }}>User</th>
                      <th style={{ width: "25%" }}>Event Action</th>
                      <th style={{ width: "40%" }}>Detail Description</th>
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
              <p className="empty-state-text">No audit log records match the search filter.</p>
            )}
          </div>

        </main>
      </div>
    </div>
  );
}
