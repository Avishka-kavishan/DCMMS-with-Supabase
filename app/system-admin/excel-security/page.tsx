"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { 
  ShieldCheck, 
  Lock, 
  Key, 
  Eye, 
  EyeOff, 
  Copy, 
  CheckCircle, 
  RefreshCcw, 
  Download, 
  FileSpreadsheet, 
  AlertCircle,
  HelpCircle,
  Clock,
  Sparkles
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { getCurrentProfile, signOut } from "@/lib/auth";
import { 
  exportToExcel, 
  getActiveExcelPassword, 
  setActiveExcelPassword, 
  DEFAULT_EXCEL_PASSWORD 
} from "@/lib/export-excel";
import { getAuditLogs, logAuditEvent, AuditLog } from "@/lib/security";

import "../../../i18n";
import "../../dashboard-common.css";
import "../../daily-mail/daily-mail.css";
import "../system-admin.css";

export default function ExcelSecurityPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");
  const lang = i18n.language;

  const [adminName, setAdminName] = useState("System Admin");
  const [currentPassword, setCurrentPassword] = useState(DEFAULT_EXCEL_PASSWORD);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  
  // Form State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Audit Logs filtered for Excel security
  const [auditHistory, setAuditHistory] = useState<AuditLog[]>([]);

  useEffect(() => {
    setMounted(true);
    setCurrentPassword(getActiveExcelPassword());

    const initData = async () => {
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

      await loadAuditHistory();
    };

    initData();

    const handlePasswordChange = () => {
      setCurrentPassword(getActiveExcelPassword());
    };
    window.addEventListener("dcmms_excel_password_changed", handlePasswordChange);
    return () => {
      window.removeEventListener("dcmms_excel_password_changed", handlePasswordChange);
    };
  }, [router]);

  const loadAuditHistory = async () => {
    try {
      const logs = await getAuditLogs();
      const excelLogs = logs.filter(
        (l) =>
          l.action === "EXCEL_PASSWORD_UPDATED" ||
          l.action === "EXCEL_PASSWORD_RESET" ||
          (l.details || "").toLowerCase().includes("excel")
      );
      setAuditHistory(excelLogs);
    } catch (e) {
      console.error("Failed to load audit history:", e);
    }
  };

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleCopyPassword = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(currentPassword);
      setCopied(true);
      showToast(t("copied", "Password copied to clipboard!"));
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleGenerateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    let gen = "DCMMS@";
    for (let i = 0; i < 6; i++) {
      gen += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(gen);
    setConfirmPassword(gen);
    showToast("Generated a strong suggested password. Click 'Update Protection Password' to save.", "success");
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || newPassword.trim().length < 4) {
      showToast("Password must be at least 4 characters long.", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast("New password and confirmation do not match.", "error");
      return;
    }

    setIsSaving(true);
    try {
      const trimmed = newPassword.trim();
      setActiveExcelPassword(trimmed);
      setCurrentPassword(trimmed);

      await logAuditEvent(
        null,
        adminName,
        "",
        "EXCEL_PASSWORD_UPDATED",
        `Excel export protection password updated to custom key by System Admin ${adminName}`
      );

      setNewPassword("");
      setConfirmPassword("");
      showToast(t("excelPasswordUpdated", "Excel export protection password updated successfully!"), "success");
      await loadAuditHistory();
    } catch (err: any) {
      showToast(err?.message || "Failed to update password.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    if (
      !confirm(
        "Are you sure you want to reset the Excel export protection password to the system default (DCMMS@Secure2026)?"
      )
    ) {
      return;
    }

    setIsSaving(true);
    try {
      setActiveExcelPassword(DEFAULT_EXCEL_PASSWORD);
      setCurrentPassword(DEFAULT_EXCEL_PASSWORD);
      setNewPassword("");
      setConfirmPassword("");

      await logAuditEvent(
        null,
        adminName,
        "",
        "EXCEL_PASSWORD_RESET",
        `Excel export protection password reset to default by System Admin ${adminName}`
      );

      showToast("Excel password reset to system default (DCMMS@Secure2026).", "success");
      await loadAuditHistory();
    } catch (err: any) {
      showToast(err?.message || "Failed to reset password.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestExport = () => {
    const headers = [
      "Verification Token",
      "Module",
      "Protection Mechanism",
      "Active Password Key",
      "Generated Timestamp",
      "Status"
    ];

    const rows = [
      [
        `DCMMS-SEC-${Date.now().toString().slice(-6)}`,
        "Excel Protection Lab",
        "OpenXML Native Worksheet Protection & Cell Locking",
        currentPassword,
        new Date().toLocaleString(),
        "PROTECTED (Read-Only)"
      ],
      [
        `DCMMS-SEC-${(Date.now() + 1).toString().slice(-6)}`,
        "System Security Test",
        "Tamper Prevention Layer",
        currentPassword,
        new Date().toISOString(),
        "LOCKED"
      ]
    ];

    exportToExcel(`DCMMS_Password_Verification_Lab_${new Date().toISOString().split("T")[0]}`, headers, rows, {
      sheetName: "Security Test",
      password: currentPassword,
    });

    showToast("Downloaded protected test spreadsheet! Try editing a cell in MS Excel to test unlock.", "success");
  };

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut();
    router.replace("/");
  };

  if (!mounted) {
    return <div className="system-admin-container" style={{ minHeight: "100vh", opacity: 0 }}></div>;
  }

  // Password strength helper
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, text: "", color: "#cbd5e1" };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 10) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 2) return { score, text: "Weak", color: "#ef4444" };
    if (score <= 4) return { score, text: "Good", color: "#f59e0b" };
    return { score, text: "Strong", color: "#10b981" };
  };

  const strength = getPasswordStrength(newPassword);

  return (
    <div className="system-admin-container" data-font-scale={fontScale}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            zIndex: 9999,
            backgroundColor: toastMessage.type === "success" ? "#065f46" : "#991b1b",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: 10,
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: "0.9rem",
            fontWeight: 600,
            animation: "fadeIn 0.3s ease-out",
          }}
        >
          {toastMessage.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Skip Link */}
      <a href="#excel-security-main" className="skip-link">Skip to main content</a>

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
        role="system_admin"
      />

      <div className="dashboard-layout">
        <main id="excel-security-main" className="dashboard-content">
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.825rem", color: "#64748b", marginBottom: 2 }}>
                  <span style={{ cursor: "pointer" }} onClick={() => router.push("/system-admin")}>System Admin</span>
                  <span>/</span>
                  <span style={{ color: "#1e3a8a", fontWeight: 600 }}>Excel Export Security</span>
                </div>
                <h2 className="dashboard-main-title">
                  {t("excelSecurityTitle", "Excel Export Sheet Protection & Unlock Password")}
                </h2>
                <p className="dashboard-main-subtitle">
                  {t("excelSecurityDesc", "All spreadsheet exports (.xlsx) are locked against tampering. Configure or reset the administrative unprotect password below.")}
                </p>
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

          {/* Security Status Banner */}
          <div style={{
            background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)",
            color: "#ffffff",
            borderRadius: 16,
            padding: "24px 28px",
            marginBottom: 24,
            boxShadow: "0 10px 25px -5px rgba(30, 58, 138, 0.25)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 20
          }}>
            <div style={{ maxWidth: 720 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.15)", padding: "4px 12px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.5px", marginBottom: 10 }}>
                <ShieldCheck size={14} />
                {t("excelBannerLayerBadge", "SYSTEM PROTECTION LAYER ACTIVE")}
              </div>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "1.3rem", fontWeight: 700 }}>
                {t("excelBannerTitle", "Tamper-Proof Spreadsheet Protection")}
              </h3>
              <p style={{ margin: 0, fontSize: "0.875rem", opacity: 0.9, lineHeight: 1.5 }}>
                {t("excelBannerDesc", "When users download spreadsheets across Investigation Dossiers, Daily Mail Reports, Session Trails, and Branch Accounts, all data cells are automatically marked as Read-Only. Unauthorized editing is blocked unless this administrative unlock password is provided.")}
              </p>
            </div>

            <button
              onClick={handleTestExport}
              style={{
                backgroundColor: "#ffffff",
                color: "#1e3a8a",
                border: "none",
                borderRadius: 10,
                padding: "12px 20px",
                fontSize: "0.9rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
                transition: "all 0.2s"
              }}
            >
              <Download size={16} />
              {t("testExport", "Test Sample Export")}
            </button>
          </div>

          {/* Main 2-Column Management Layout */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 24, marginBottom: 28 }}>
            {/* Left Box: Active Password Card */}
            <div style={{
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              padding: 24,
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between"
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: "#dbeafe", color: "#1e40af", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Key size={20} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>
                        {t("currentUnlockPassword", "Current Unlock Password")}
                      </h4>
                      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        {t("activeKeyEnforced", "Active key enforced on exports")}
                      </span>
                    </div>
                  </div>

                  <span style={{ background: "#dcfce7", color: "#15803d", padding: "3px 8px", borderRadius: 6, fontSize: "0.725rem", fontWeight: 700 }}>
                    {t("enforcedBadge", "ENFORCED")}
                  </span>
                </div>

                {/* Password Display Box */}
                <div style={{
                  background: "#f8fafc",
                  border: "2px dashed #cbd5e1",
                  borderRadius: 12,
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  margin: "18px 0"
                }}>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>
                      {t("activePasswordLabel", "Active Password")}
                    </span>
                    <div style={{ fontFamily: "monospace", fontSize: "1.35rem", fontWeight: 700, color: "#0f172a", letterSpacing: "1.5px", marginTop: 4 }}>
                      {isPasswordVisible ? currentPassword : "•".repeat(Math.max(currentPassword.length, 10))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      padding: "8px 12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "#475569"
                    }}
                  >
                    {isPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                    {isPasswordVisible ? t("hide", "Hide") : t("show", "Show")}
                  </button>
                </div>

                <div style={{ background: "#eff6ff", borderLeft: "4px solid #3b82f6", padding: "12px 16px", borderRadius: 8, fontSize: "0.825rem", color: "#1e40af", lineHeight: 1.5 }}>
                  <strong>{t("howToUnlockTitle", "How to unlock in Excel:")}</strong> {t("howToUnlockDesc", "Open downloaded file → click Review tab → click Unprotect Sheet → type this password.")}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 24, paddingTop: 18, borderTop: "1px solid #f1f5f9" }}>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    background: "#1e3a8a",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6
                  }}
                >
                  <Copy size={16} />
                  {copied ? t("copied", "Copied!") : t("copyPassword", "Copy Password")}
                </button>

                <button
                  type="button"
                  onClick={handleResetToDefault}
                  disabled={isSaving}
                  style={{
                    padding: "10px 14px",
                    background: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    color: "#64748b",
                    borderRadius: 8,
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <RefreshCcw size={14} />
                  {t("resetToDefault", "Reset to Default")}
                </button>
              </div>
            </div>

            {/* Right Box: Change Password Form */}
            <div style={{
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              padding: 24,
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)"
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "#f3e8ff", color: "#7e22ce", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Lock size={20} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>
                      {t("newExcelPassword", "Set New Excel Unlock Password")}
                    </h4>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      {t("updateFutureDesc", "Update the administrative password for future exports")}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateRandomPassword}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: "6px 10px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#6b21a8",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  <Sparkles size={13} />
                  {t("generateStrong", "Generate Strong")}
                </button>
              </div>

              <form onSubmit={handleUpdatePassword}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    {t("newExcelPassword", "New Password")}
                  </label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      type={isNewPasswordVisible ? "text" : "password"}
                      placeholder="Enter new export protection password..."
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 42px 10px 14px",
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        fontSize: "0.9rem",
                        outline: "none"
                      }}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setIsNewPasswordVisible(!isNewPasswordVisible)}
                      style={{
                        position: "absolute",
                        right: 10,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#64748b"
                      }}
                    >
                      {isNewPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Password Strength Meter */}
                  {newPassword && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#64748b", marginBottom: 3 }}>
                        <span>{t("passwordStrength", "Password Strength:")}</span>
                        <span style={{ fontWeight: 700, color: strength.color }}>
                          {strength.text === "Weak" ? t("weak", "Weak") : strength.text === "Good" ? t("good", "Good") : t("strong", "Strong")}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 4, height: 4, borderRadius: 2, overflow: "hidden" }}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            style={{
                              flex: 1,
                              backgroundColor: i <= strength.score ? strength.color : "#e2e8f0",
                              transition: "background-color 0.2s"
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    {t("confirmExcelPassword", "Confirm New Password")}
                  </label>
                  <input
                    type={isNewPasswordVisible ? "text" : "password"}
                    placeholder="Re-enter password to confirm..."
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: "0.9rem",
                      outline: "none"
                    }}
                    autoComplete="new-password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSaving || !newPassword}
                  style={{
                    width: "100%",
                    padding: "12px 20px",
                    background: "#1e40af",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    cursor: isSaving || !newPassword ? "not-allowed" : "pointer",
                    opacity: isSaving || !newPassword ? 0.6 : 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    transition: "background-color 0.2s"
                  }}
                >
                  <ShieldCheck size={18} />
                  {isSaving ? t("updatingSecurityKey", "Updating Security Key...") : t("savePassword", "Update Protection Password")}
                </button>
              </form>
            </div>
          </div>

          {/* Audit History & Activity Logs */}
          <div className="sysadmin-card-section">
            <div className="sysadmin-card-header-flex">
              <div>
                <h3 className="card-title-header" style={{ marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                  <Clock size={20} color="#1e3a8a" />
                  {t("excelAuditHistoryTitle", "Excel Security Event History")}
                </h3>
                <p style={{ margin: 0, fontSize: "0.825rem", color: "#64748b" }}>
                  {t("excelAuditHistoryDesc", "Immutable audit records of all Excel export password modifications and reset operations.")}
                </p>
              </div>
            </div>

            {auditHistory.length > 0 ? (
              <div className="table-responsive-container" style={{ marginTop: 16 }}>
                <table className="sysadmin-data-table">
                  <thead>
                    <tr>
                      <th>{t("eventTimestamp", "Event Timestamp")}</th>
                      <th>{t("adminUser", "Admin User")}</th>
                      <th>{t("action", "Action")}</th>
                      <th>{t("auditDetails", "Audit Details")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditHistory.map((log) => (
                      <tr key={log.id} className="sysadmin-table-row">
                        <td style={{ whiteSpace: "nowrap", fontSize: "0.8rem", color: "#475569" }}>
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="font-semibold text-primary" style={{ fontSize: "0.85rem" }}>
                          {log.username || "System Admin"}
                        </td>
                        <td>
                          <span
                            className={`action-pill ${
                              log.action === "EXCEL_PASSWORD_RESET" ? "forced" : "admin"
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td style={{ fontSize: "0.85rem", color: "#334155" }}>
                          {log.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "32px 16px", color: "#94a3b8" }}>
                <FileSpreadsheet size={36} style={{ margin: "0 auto 8px auto", opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: "0.875rem" }}>{t("noEventsRecorded", "No password change events recorded yet.")}</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
