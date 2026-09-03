"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Image from "next/image";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getCurrentProfile, UserProfile } from "@/lib/auth";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  setIsModalOpen?: (isOpen: boolean) => void;
  handleLogout: (e: React.MouseEvent) => void;
  role?: "admin" | "dailymail" | "subject" | "investigation" | "system_admin";
}

interface MenuItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  badge?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
  setIsModalOpen,
  handleLogout,
  role,
}) => {
  const { t } = useTranslation();
  const pathname = usePathname() || "";

  // Auto-detect role from path if not provided explicitly
  const activeRole =
    role ||
    (pathname.includes("/admin")
      ? "admin"
      : pathname.includes("/system-admin")
        ? "system_admin"
        : pathname.includes("/subject")
          ? "subject"
          : pathname.includes("/investigation")
            ? "investigation"
            : "dailymail");

  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const prof = await getCurrentProfile();
      if (prof) {
        setProfile(prof);
      }
    };
    loadProfile();

    const handleSessionUpdate = () => {
      loadProfile();
    };

    window.addEventListener("storage", handleSessionUpdate);
    window.addEventListener("dcmms_session_updated", handleSessionUpdate);
    window.addEventListener("dcmms_data_updated", handleSessionUpdate);

    return () => {
      window.removeEventListener("storage", handleSessionUpdate);
      window.removeEventListener("dcmms_session_updated", handleSessionUpdate);
      window.removeEventListener("dcmms_data_updated", handleSessionUpdate);
    };
  }, []);

  // Determine user information dynamically from the logged-in profile session
  const userName = profile?.full_name || (
    activeRole === "system_admin"
      ? "System Administrator"
      : activeRole === "admin"
      ? t("adminName", "Branch Administrator")
      : activeRole === "subject"
      ? t("subjectName", "Subject Officer")
      : activeRole === "investigation"
      ? t("investigationName", "Investigation Officer")
      : t("roleDailyMail", "Daily Mail Officer")
  );

  const userEmail = profile?.email || (
    activeRole === "system_admin"
      ? "sysadmin@dcmms.gov.lk"
      : activeRole === "admin"
      ? "admin@dcmms.gov.lk"
      : activeRole === "subject"
      ? "subject@dcmms.gov.lk"
      : activeRole === "investigation"
      ? "investigation@dcmms.gov.lk"
      : "dailymail@dcmms.gov.lk"
  );

  // Generate initials dynamically from the actual user's name
  let userInitials = "U";
  const nameParts = (userName || "").trim().split(/\s+/).filter(Boolean);
  if (nameParts.length >= 2) {
    userInitials = (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
  } else if (nameParts.length === 1 && nameParts[0]) {
    userInitials = nameParts[0].slice(0, 2).toUpperCase();
  }

  // Quick Action button based on active role
  let quickActionButton = null;
  if (activeRole === "dailymail") {
    quickActionButton = (
      <Link href="/daily-mail/register" className="btn-sidebar-action" style={{ textDecoration: 'none' }}>
        <span className="plus-icon">+</span> {t("newLetterBtn")}
      </Link>
    );
  } else if (activeRole === "admin") {
    quickActionButton = (
      <Link href={`${basePath}/admin`} className="btn-sidebar-action" style={{ textDecoration: 'none', justifyContent: 'center' }}>
        {t("dashboard", "Dashboard")}
      </Link>
    );
  } else if (activeRole === "investigation") {
    quickActionButton = (
      <button 
        className="btn-sidebar-action" 
        onClick={() => {
          if (setIsModalOpen) {
            setIsModalOpen(true);
          } else {
            // fallback if sidebar used elsewhere
            window.location.hash = "#register-officer";
            const btn = document.querySelector(".btn-new-letter");
            if (btn) (btn as HTMLButtonElement).click();
          }
        }}
      >
        <span className="plus-icon">+</span> {t("registerOfficer", "Register Officer")}
      </button>
    );
  }

  const menuItems: Record<
    "admin" | "dailymail" | "subject" | "investigation" | "system_admin",
    MenuItem[]
  > = {
    dailymail: [],
    admin: [
      {
        id: "subject-officers",
        label: t("subjectOfficers", "Subject Officers"),
        href: `${basePath}/admin/subject-officers`,
        icon: (
          <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
        isActive: pathname.includes("/admin/subject-officers"),
      },
      {
        id: "investigation-officers",
        label: t("investigationAdmins", "Investigation Admins"),
        href: `${basePath}/admin/investigation-officers`,
        icon: (
          <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        ),
        isActive: pathname.includes("/admin/investigation-officers"),
      },
      {
        id: "daily-mail-officers",
        label: t("dailyMailOfficers", "Daily Mail Officers"),
        href: `${basePath}/admin/daily-mail-officers`,
        icon: (
          <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        ),
        isActive: pathname.includes("/admin/daily-mail-officers"),
      },
      {
        id: "institutes",
        label: t("institutes", "Institutes"),
        href: `${basePath}/admin/institutes`,
        icon: (
          <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ),
        isActive: pathname.includes("/admin/institutes"),
      },
      {
        id: "officer-workflow",
        label: t("officerWorkflow", "Officer Workflow"),
        href: `${basePath}/admin/officer-workflow`,
        icon: (
          <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
        isActive: pathname.includes("/admin/officer-workflow"),
      },
    ],
    subject: [
      {
        id: "dashboard",
        label: t("home", "Home"),
        href: `${basePath}/subject`,
        icon: (
          <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        ),
        isActive: pathname.endsWith("/subject") || pathname.endsWith("/subject/"),
      },
      {
        id: "recommendations",
        label: t("recommendations", "Recommendations"),
        href: `${basePath}/subject/recommendation`,
        icon: (
          <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        ),
        isActive: pathname.includes("/subject/recommendation") || pathname.includes("/subject/recommendations"),
      },
      {
        id: "reports",
        label: t("reports", "Reports"),
        href: `${basePath}/subject/reports`,
        icon: (
          <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
        isActive: pathname.includes("/subject/reports") || pathname.includes("/subject/report"),
      },
    ],
    investigation: [
      {
        id: "dashboard",
        label: t("dashboard", "Dashboard"),
        href: `${basePath}/investigation`,
        icon: (
          <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        ),
        isActive: pathname.endsWith("/investigation"),
      },
    ],
    system_admin: [
      {
        id: "dashboard",
        label: t("dashboard", "Dashboard"),
        href: `${basePath}/system-admin`,
        icon: (
          <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
        isActive: pathname.endsWith("/system-admin") || pathname.endsWith("/system-admin/"),
      },
      {
        id: "add-branch-admin",
        label: t("addBranchAdmin", "Add the branch admin"),
        href: `${basePath}/system-admin/add-branch-admin`,
        icon: (
          <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        ),
        isActive: pathname.includes("/system-admin/add-branch-admin"),
      },
      {
        id: "excel-security",
        label: t("excelExportSecurity", "Excel Export Security"),
        href: `${basePath}/system-admin/excel-security`,
        icon: (
          <svg className="menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        ),
        isActive: pathname.includes("/system-admin/excel-security"),
      },
    ],
  };

  const activeMenuItems = menuItems[activeRole] || menuItems.dailymail;

  return (
    <>
      {/* Backdrop overlay for viewport */}
      {isSidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* ============================================================
         SIDEBAR PANEL
         ============================================================ */}
      <aside className={`sidebar ${isSidebarOpen ? "open" : ""}`} suppressHydrationWarning>
        {/* Logo & Close Button Header */}
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon">
              <Image
                src={`${basePath}/icon.svg`}
                alt="DCMMS Logo"
                width={24}
                height={24}
                priority
              />
            </div>
            <div className="sidebar-brand-text">
              <h1 className="sidebar-brand-title">DCMMS</h1>
              <p className="sidebar-brand-subtitle" suppressHydrationWarning>{t("subtitle")}</p>
            </div>
          </div>

          <button
            className="btn-sidebar-close"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <svg className="close-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Quick Action Sidebar Button */}
        {quickActionButton && (
          <div className="sidebar-action-wrapper" suppressHydrationWarning>
            {quickActionButton}
          </div>
        )}

        {/* Sidebar Menu Navigation Links */}
        <nav className="sidebar-menu" aria-label="Sidebar navigation">
          <ul className="sidebar-menu-list">
            {activeMenuItems.map((item) => (
              <li key={item.id}>
                <a
                  href={item.href}
                  onClick={item.onClick}
                  className={`sidebar-menu-item ${item.isActive ? "active" : ""}`}
                >
                  {item.icon}
                  <span suppressHydrationWarning>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="badge-count">{item.badge}</span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Sidebar Footer User Info and Logout */}
        <div className="sidebar-footer" suppressHydrationWarning>
          <div className="user-profile-box">
            <div className="user-avatar-circle">
              <span suppressHydrationWarning>{userInitials}</span>
            </div>
            <div className="user-details">
              <span className="user-name" suppressHydrationWarning>{userName}</span>
              <span className="user-email" suppressHydrationWarning>{userEmail}</span>
            </div>
          </div>
          <a href="#" className="logout-link" onClick={async (e) => {
            if (profile?.id) {
              const { logLogout } = await import("@/lib/security");
              await logLogout(profile.id);
            }
            handleLogout(e);
          }}>
            <svg className="logout-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span suppressHydrationWarning>{t("logout")}</span>
          </a>
        </div>
      </aside>
    </>
  );
};
