"use client";
import React from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import "../../i18n";
import "../daily-mail/daily-mail.css";
import "../dashboard-common.css";
import "./admin.css";
import { Sidebar } from "@/components/Sidebar";
import { signOut, getCurrentProfile, UserProfile } from "@/lib/auth";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/lib/supabase";
import { getLetterEditRequestsServer, updateLetterEditRequestStatusServer } from "@/lib/db-actions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const pathname = usePathname();
  
  const [mounted, setMounted] = React.useState(false);
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");
  const lang = i18n.language;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Notification & Edit Approval Requests state
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const notifRef = React.useRef<HTMLDivElement>(null);

  const fetchPendingRequests = async () => {
    try {
      const res = await getLetterEditRequestsServer({ status: "Pending" });
      if (res && res.success && Array.isArray(res.data)) {
        setPendingRequests(res.data);
      }
    } catch (e) {
      console.warn("Failed to fetch pending approval requests:", e);
    }
  };

  React.useEffect(() => {
    setMounted(true);
    getCurrentProfile().then(setCurrentUserProfile);
    fetchPendingRequests();

    // Polling every 10 seconds for real-time notification updates
    const interval = setInterval(fetchPendingRequests, 10000);

    // Close dropdown on click outside
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      clearInterval(interval);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleQuickApprove = async (requestId: string, refNo: string) => {
    try {
      const adminName = currentUserProfile?.full_name || "Branch Administrator";
      const res = await updateLetterEditRequestStatusServer({
        requestId,
        status: "Approved",
        reviewed_by: adminName,
        reviewer_comments: "Approved via notification popover",
      });
      if (res && res.success) {
        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
        setToastMessage(`✓ Request for "${refNo}" approved successfully.`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
      } else {
        alert(res?.error || "Failed to approve request");
      }
    } catch (e: any) {
      alert("Error approving request: " + (e?.message || "Server error"));
    }
  };

  const handleQuickReject = async (requestId: string, refNo: string) => {
    const reason = prompt(lang === "si" ? "ප්‍රතික්ෂේප කිරීමට හේතුව:" : "Reason for rejection:") || "";
    try {
      const adminName = currentUserProfile?.full_name || "Branch Administrator";
      const res = await updateLetterEditRequestStatusServer({
        requestId,
        status: "Rejected",
        reviewed_by: adminName,
        reviewer_comments: reason,
      });
      if (res && res.success) {
        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
        setToastMessage(`Request for "${refNo}" rejected.`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
      } else {
        alert(res?.error || "Failed to reject request");
      }
    } catch (e: any) {
      alert("Error rejecting request: " + (e?.message || "Server error"));
    }
  };

  const getPageTitleAndSubtitle = () => {
    const cleanPath = (pathname || "").replace(/\/$/, "");
    if (cleanPath === "/admin/subject-officers") {
      return {
        title: t("subjectOfficer", "Subject Officer"),
        subtitle: t("subjectOfficerDescAdmin", "Oversee subject officer tasks")
      };
    }
    if (cleanPath === "/admin/investigation-officers") {
      return {
        title: t("investigationAdminTitle", "Investigation Administrators"),
        subtitle: t("investigationAdminDescAdmin", "Manage investigation administrator accounts")
      };
    }
    if (cleanPath === "/admin/daily-mail-officers") {
      return {
        title: t("dailyMailOfficers", "Daily Mail Officers"),
        subtitle: t("dailyMailOfficersDescAdmin", "Manage daily mail reporter accounts")
      };
    }
    if (cleanPath === "/admin/institutes") {
      return {
        title: t("educationalInstitutes", "Educational Institutes"),
        subtitle: t("educationalInstitutesDescAdmin", "Register and manage educational institutes")
      };
    }
    if (cleanPath === "/admin/officer-workflow") {
      return {
        title: t("officerWorkflow", "Officer Workflow"),
        subtitle: t("officerWorkflowDesc", "Workload summary and case distribution for all registered officers")
      };
    }
    if (cleanPath === "/admin/view-case") {
      return {
        title: t("caseDossierTitle", "Case Dossier & Investigation Timeline"),
        subtitle: t("caseDossierDesc", "Multi-role process tracking & officer workflow details")
      };
    }
    return {
      title: t("adminDashboardTitle", "Discipline Branch Administrator"),
      subtitle: t("adminDashboardDesc", "Manage cases and user access")
    };
  };

  const { title, subtitle } = getPageTitleAndSubtitle();

  const getFormattedDate = () => {
    const date = new Date();
    if (lang === "si") {
      return date.toLocaleDateString("si-LK", { day: "numeric", month: "long", year: "numeric" });
    }
    if (lang === "ta") {
      return date.toLocaleDateString("ta-LK", { day: "numeric", month: "long", year: "numeric" });
    }
    return date.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
  };

  const router = useRouter();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut();
    router.push("/");
  };

  return (
    <div className="dashboard-container" data-font-scale={fontScale} suppressHydrationWarning>
      {/* ── Skip Link (A11y) ── */}
      <a href="#dashboard-main-content" className="skip-link" suppressHydrationWarning>
        {t("skipLink", "Skip to main content")}
      </a>

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
        role="admin"
      />

      {/* ── Layout Grid Wrapper ── */}
      <div className="dashboard-layout">
        <main id="dashboard-main-content" className="dashboard-content">
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
                <h2 className="dashboard-main-title" suppressHydrationWarning>{title}</h2>
                <p className="dashboard-main-subtitle" suppressHydrationWarning>{subtitle}</p>
              </div>
            </div>

            <div className="dashboard-header-right">
              {/* Date display badge */}
              <div className="date-badge">
                <span suppressHydrationWarning>
                  {getFormattedDate()}
                </span>
                <svg className="date-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>

              {/* Notification Bell with Badge & Dropdown */}
              <div className="admin-notification-container" ref={notifRef}>
                <button
                  type="button"
                  className={`admin-notification-btn ${pendingRequests.length > 0 ? "has-notifications" : ""}`}
                  onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                  aria-label="Pending Edit Approval Requests Notifications"
                  title="Approval Requests"
                >
                  <svg style={{ width: "20px", height: "20px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {pendingRequests.length > 0 && (
                    <span className="admin-notification-badge">
                      {pendingRequests.length}
                    </span>
                  )}
                </button>

                {showNotifDropdown && (
                  <div className="admin-notification-dropdown">
                    <div className="admin-notification-header">
                      <div className="admin-notification-title">
                        <svg style={{ width: "18px", height: "18px", color: "#f59e0b" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        <span>{lang === "si" ? "සංස්කරණ අනුමැති ඉල්ලීම්" : "Edit Approval Requests"}</span>
                      </div>
                      <span className="admin-notification-count-tag">
                        {pendingRequests.length} {lang === "si" ? "බලාපොරොත්තුවෙන්" : "Pending"}
                      </span>
                    </div>

                    <div className="admin-notification-list">
                      {pendingRequests.length > 0 ? (
                        pendingRequests.map((req) => (
                          <div key={req.id} className="admin-notification-item">
                            <div className="admin-notification-item-top">
                              <span className="admin-notification-item-ref">
                                {req.ref_no || req.letter_id}
                              </span>
                              <span className="admin-notification-item-date">
                                {req.created_at ? new Date(req.created_at).toLocaleDateString() : ""}
                              </span>
                            </div>
                            <div className="admin-notification-item-by">
                              <strong>{req.requested_by}</strong> ({req.requester_role || "Officer"})
                            </div>
                            <div className="admin-notification-item-reason">
                              "{req.reason || "No reason specified"}"
                            </div>
                            <div className="admin-notification-actions">
                              <button
                                type="button"
                                className="btn-notif-approve"
                                onClick={() => handleQuickApprove(req.id, req.ref_no)}
                              >
                                ✓ {lang === "si" ? "අනුමත කරන්න" : "Approve"}
                              </button>
                              <button
                                type="button"
                                className="btn-notif-reject"
                                onClick={() => handleQuickReject(req.id, req.ref_no)}
                              >
                                ✕ {lang === "si" ? "ප්‍රතික්ෂේප" : "Reject"}
                              </button>
                              <Link
                                href={`/daily-mail/register?id=${encodeURIComponent(req.letter_id || req.ref_no)}`}
                                className="btn-notif-view"
                                onClick={() => setShowNotifDropdown(false)}
                              >
                                {lang === "si" ? "ලිපිය බලන්න →" : "View Letter →"}
                              </Link>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="admin-notification-empty">
                          <svg style={{ width: "32px", height: "32px", color: "#10b981", margin: "0 auto 8px auto" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>{lang === "si" ? "නව අනුමැති ඉල්ලීම් කිසිවක් නැත." : "No pending edit approval requests."}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
                    aria-label={t("fontSmall", "Small Font")}
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
                    aria-label={t("fontMedium", "Medium Font")}
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
                    aria-label={t("fontLarge", "Large Font")}
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

          {children}
          
          <SiteFooter />
        </main>
      </div>
    </div>
  );
}
