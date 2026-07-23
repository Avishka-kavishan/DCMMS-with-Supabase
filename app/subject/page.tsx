"use client";

import "../../i18n";
import "../daily-mail/daily-mail.css";
import "../dashboard-common.css";
import "./subject.css";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sidebar } from "@/components/Sidebar";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getCurrentProfile, signOut, UserProfile } from "@/lib/auth";
import { CheckCircle, FileText, Send, Clock, X, AlertCircle, ShieldCheck, Calendar as CalendarIcon } from "lucide-react";

interface Case {
  id: string;
  caseNo: string;
  assignedDate: string;
  receivedDate: string;
  subject: string;
  priority: "high" | "medium" | "low";
  status: "In Progress" | "Closed" | "Pending";
  isOld?: boolean;
}

export default function SubjectOfficerDashboard() {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  // Accessibility & language state
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");
  const lang = i18n.language;

  // Format date statically to match mockup
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

  // Mobile sidebar visibility state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Dynamic localized greeting based on time of day
  const [greeting, setGreeting] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    let greetingKey = "greetingMorning";
    if (hour >= 12 && hour < 17) {
      greetingKey = "greetingAfternoon";
    } else if (hour >= 17 || hour < 5) {
      greetingKey = "greetingEvening";
    }

    const loadProfileAndGreeting = async () => {
      let displayName = t("subjectName");
      if (isSupabaseConfigured) {
        const prof = await getCurrentProfile();
        if (prof) {
          setProfile(prof);
          displayName = prof.full_name;
        }
      }
      const firstName = displayName.split(" ")[0];
      setGreeting(`${t(greetingKey)}, ${firstName}!`);
    };

    loadProfileAndGreeting();
  }, [t]);

  // Close sidebar on Escape key press (A11y compliance)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Sync document properties
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${t("subjectDashboardTitle")} | DCMMS`;
  }, [lang, t]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  // Case management data state
  const [cases, setCases] = useState<Case[]>([]);

  // Load cases dynamically from database on mount or when profile is updated
  useEffect(() => {
    const fetchCases = async () => {
      if (isSupabaseConfigured) {
        try {
          let activeProfile = profile;
          if (!activeProfile) {
            activeProfile = await getCurrentProfile();
          }

          if (activeProfile) {
            // Fetch letters assigned to this officer
            const { data: letters, error: lettersError } = await supabase
              .from("dcmms_daily_mail")
              .select("ref_no, received_date")
              .eq("officer_name", activeProfile.full_name);

            if (lettersError) throw lettersError;

            const refToReceivedDate = new Map<string, string>();
            if (letters) {
              letters.forEach((l: any) => {
                if (l.ref_no) {
                  refToReceivedDate.set(l.ref_no, l.received_date);
                }
              });
            }

            const assignedRefNos = Array.from(refToReceivedDate.keys());

            if (assignedRefNos.length > 0) {
              const { data: casesData, error: casesError } = await supabase
                .from("dcmms_subject")
                .select("*")
                .in("case_no", assignedRefNos)
                .order("case_no", { ascending: true });

              if (casesError) throw casesError;

              // Fetch details to check if there are actions taken
              const { data: detailsData, error: detailsError } = await supabase
                .from("dcmms_subject_details")
                .select("case_no")
                .in("case_no", assignedRefNos);

              const casesWithDetails = new Set(detailsData ? detailsData.map((d: any) => d.case_no) : []);

              if (casesData) {
                const mapped = casesData.map((item: any) => ({
                  id: item.id,
                  caseNo: item.case_no,
                  assignedDate: item.assigned_date,
                  receivedDate: refToReceivedDate.get(item.case_no) || item.assigned_date,
                  subject: item.subject,
                  priority: item.priority,
                  status: item.status,
                  isOld: (typeof window !== "undefined" && (() => {
                    try {
                      const localCases = JSON.parse(localStorage.getItem("dcmms_cases") || "[]");
                      const found = localCases.find((lc: any) => lc.caseNo === item.case_no);
                      if (found && found.isOld !== undefined) return found.isOld;
                    } catch (e) {}
                    return casesWithDetails.has(item.case_no) || item.status === "Closed" || item.status === "Pending";
                  })()),
                }));
                mapped.sort((a: any, b: any) => {
                  if (!!a.isOld !== !!b.isOld) {
                    return a.isOld ? 1 : -1;
                  }
                  return new Date(b.receivedDate).getTime() - new Date(a.receivedDate).getTime();
                });
                setCases(mapped);
                return;
              }
            } else {
              setCases([]);
              return;
            }
          }
        } catch (e) {
          console.error("Failed to fetch cases from Supabase, falling back to localStorage", e);
        }
      }

      // Local storage fallback
      if (typeof window !== "undefined") {
        const storedCases = localStorage.getItem("dcmms_cases");
        const storedLetters = localStorage.getItem("dcmms_letters");
        let activeName = profile?.full_name || t("subjectName");

        if (storedCases && storedLetters) {
          try {
            const casesList = JSON.parse(storedCases);
            const lettersList = JSON.parse(storedLetters);

            // Filter letters assigned to the active name
            const refToReceivedDate = new Map<string, string>();
            lettersList
              .filter((l: any) => l.officerName === activeName)
              .forEach((l: any) => {
                if (l.refNo) {
                  refToReceivedDate.set(l.refNo, l.receivedDate);
                }
              });

            const assignedRefNos = Array.from(refToReceivedDate.keys());

            // Check actions in localStorage
            const storedActions = localStorage.getItem("dcmms_new_letter_current_case") || "[]";
            let actionsList = [];
            try { actionsList = JSON.parse(storedActions); } catch (e) { }
            const casesWithActions = new Set(
              Array.isArray(actionsList)
                ? actionsList.map((a: any) => a.caseNo)
                : []
            );

            // Filter cases matching assignedRefNos and map isOld
            const filtered = casesList
              .filter((c: any) => assignedRefNos.includes(c.caseNo))
              .map((c: any) => ({
                ...c,
                receivedDate: refToReceivedDate.get(c.caseNo) || c.assignedDate,
                isOld: c.isOld !== undefined ? c.isOld : (casesWithActions.has(c.caseNo) || c.status === "Closed" || c.status === "Pending"),
              }));
            filtered.sort((a: any, b: any) => {
              if (!!a.isOld !== !!b.isOld) {
                return a.isOld ? 1 : -1;
              }
              return new Date(b.receivedDate).getTime() - new Date(a.receivedDate).getTime();
            });
            setCases(filtered);
          } catch (e) {
            console.error("Error parsing localStorage fallback data", e);
          }
        } else {
          setCases([]);
        }
      }
    };
    fetchCases();

    // Subscribe to real-time updates from Supabase
    const channel = supabase
      .channel("subject-realtime-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_subject" }, fetchCases)
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_daily_mail" }, fetchCases)
      .subscribe();

    // Fallback: auto-refresh every 3 seconds
    const interval = setInterval(fetchCases, 3_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [profile, t]);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "high" | "medium" | "low">("all");

  // Subject Officer Assignment Data Flow State & Handlers (Diagram: Investigation Admin <-> Subject Officer)
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [activeAssignment, setActiveAssignment] = useState<any>(null);
  const [reportDateForm, setReportDateForm] = useState(new Date().toISOString().slice(0, 10));
  const [reportContentForm, setReportContentForm] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Load Assignments from localStorage / Supabase
  const fetchAssignments = async () => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("dcmms_subject_assignments");
        if (stored) {
          setAssignments(JSON.parse(stored));
        } else {
          setAssignments([]);
        }
      } catch (e) {
        console.error("Failed to parse subject assignments", e);
      }
    }
  };

  useEffect(() => {
    fetchAssignments();
    const interval = setInterval(fetchAssignments, 4000);
    return () => clearInterval(interval);
  }, []);

  // Step 2 Handler: Subject Officer Submits Appointment Date & Report Due Date
  const handleStep2SubmitDates = (asgn: any, appointmentDate: string, reportDueDate: string) => {
    if (!appointmentDate || !reportDueDate) {
      showToast("Please select both Appointment Date and Report Due Date!");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const updated = {
      ...asgn,
      appointmentDate,
      reportDueDate,
      datesSubmittedBySubject: true,
      datesSubmitTimestamp: today,
      currentStep: 3,
      status: "Dates Confirmed",
      updatedAt: today,
    };

    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("dcmms_subject_assignments") || "[]";
        let list = JSON.parse(stored);
        list = list.filter((a: any) => a.id !== asgn.id);
        list.push(updated);
        localStorage.setItem("dcmms_subject_assignments", JSON.stringify(list));
      } catch (e) {}
    }

    showToast("Step 2 Complete: Appointment Date & Report Due Date submitted to Investigation Administrator!");
    fetchAssignments();
  };

  // Handle Certification Submission (Data Flow: Subject Officer -> Investigation Admin)
  const handleCertifyAssignment = (asgn: any) => {
    const today = new Date().toISOString().slice(0, 10);
    const updated = {
      ...asgn,
      certificationSubmitted: true,
      certificationDate: today,
      status: "Certified",
      updatedAt: today,
    };

    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("dcmms_subject_assignments") || "[]";
        let list = JSON.parse(stored);
        list = list.filter((a: any) => a.id !== asgn.id);
        list.push(updated);
        localStorage.setItem("dcmms_subject_assignments", JSON.stringify(list));
      } catch (e) {}
    }

    if (isSupabaseConfigured) {
      supabase.from("dcmms_subject_assignments").upsert({
        id: updated.id,
        case_no: updated.caseNo,
        subject_officer_name: updated.subjectOfficerName,
        appointment_date: updated.appointmentDate,
        report_due_date: updated.reportDueDate,
        extension_term: updated.extensionTerm,
        extension_start_date: updated.extensionStartDate,
        extension_end_date: updated.extensionEndDate,
        certification_submitted: true,
        certification_date: today,
        report_submit_date: updated.reportSubmitDate || null,
        report_content: updated.reportContent || null,
        status: "Certified",
      }).then();
    }

    showToast("Certification submitted to Investigation Administrator!");
    fetchAssignments();
  };

  // Handle Opening Report Submission Modal
  const handleOpenReportModal = (asgn: any) => {
    setActiveAssignment(asgn);
    setReportDateForm(asgn.reportSubmitDate || new Date().toISOString().slice(0, 10));
    setReportContentForm(asgn.reportContent || "");
    setIsReportModalOpen(true);
  };

  // Handle Submitting Investigation Report (Data Flow: Subject Officer -> Investigation Admin)
  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssignment) return;
    if (!reportContentForm.trim()) {
      showToast("Please enter the investigation report content.");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const updated = {
      ...activeAssignment,
      reportSubmitDate: reportDateForm || today,
      reportContent: reportContentForm.trim(),
      status: "Report Submitted",
      updatedAt: today,
    };

    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("dcmms_subject_assignments") || "[]";
        let list = JSON.parse(stored);
        list = list.filter((a: any) => a.id !== activeAssignment.id);
        list.push(updated);
        localStorage.setItem("dcmms_subject_assignments", JSON.stringify(list));

        const storedActions = localStorage.getItem("dcmms_new_letter_current_case") || "[]";
        const actionsList = JSON.parse(storedActions);
        actionsList.push({
          id: `report-${activeAssignment.caseNo}-${Date.now()}`,
          caseNo: activeAssignment.caseNo,
          subjectOfficerName: activeAssignment.subjectOfficerName || profile?.full_name || "Subject Officer",
          reportState: "Report Submitted",
          receivedDate: reportDateForm || today,
          stepTaken: `Investigation Report Submitted on ${reportDateForm || today}`,
          specialNotes: reportContentForm.trim(),
        });
        localStorage.setItem("dcmms_new_letter_current_case", JSON.stringify(actionsList));
      } catch (e) {}
    }

    if (isSupabaseConfigured) {
      supabase.from("dcmms_subject_assignments").upsert({
        id: updated.id,
        case_no: updated.caseNo,
        subject_officer_name: updated.subjectOfficerName,
        appointment_date: updated.appointmentDate,
        report_due_date: updated.reportDueDate,
        extension_term: updated.extensionTerm,
        extension_start_date: updated.extensionStartDate,
        extension_end_date: updated.extensionEndDate,
        certification_submitted: updated.certificationSubmitted || true,
        certification_date: updated.certificationDate || today,
        report_submit_date: reportDateForm || today,
        report_content: reportContentForm.trim(),
        status: "Report Submitted",
      }).then();
    }

    showToast("Investigation Report successfully submitted to Investigation Administrator!");
    setIsReportModalOpen(false);
    fetchAssignments();
  };

  // Session guard — redirect to login if not authenticated
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) router.replace("/");
    });
  }, [router]);

  // Log out handler
  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut();
    router.push("/");
  };

  // Dynamic counts for stats cards
  const totalCasesCount = cases.length;
  const inProgressCasesCount = cases.filter((c) => c.status === "In Progress").length;
  const pendingCasesCount = cases.filter((c) => c.status === "Pending").length;
  const closedCasesCount = cases.filter((c) => c.status === "Closed").length;

  // Helper to calculate case deadlines and reminders
  const calculateReminder = (assignedDateStr: string, priority: "high" | "medium" | "low", status: string) => {
    if (status === "Closed") return { text: "Completed", color: "gray", active: false };

    const assigned = new Date(assignedDateStr);
    const today = new Date();
    const assignedMidnight = new Date(assigned.getFullYear(), assigned.getMonth(), assigned.getDate());
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const diffTime = todayMidnight.getTime() - assignedMidnight.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const currentHour = today.getHours();

    if (priority === "high") {
      // High priority = today (red color)
      // reminder is given at 10 a.m. and 2 p.m.
      if (diffDays === 0) {
        if (currentHour >= 14) {
          return { text: "Reminder: High Priority (2:00 PM check)", color: "red", active: true };
        } else if (currentHour >= 10) {
          return { text: "Reminder: High Priority (10:00 AM check)", color: "red", active: true };
        } else {
          return { text: "Action Required Today", color: "red", active: false };
        }
      } else if (diffDays > 0) {
        return { text: "Overdue (High Priority)", color: "red", active: true };
      }
      return { text: "Action Required Today", color: "red", active: false };
    }

    if (priority === "medium") {
      // Medium priority = 3 days (orange color)
      // Reminder on the last day (diffDays === 3)
      const daysRemaining = 3 - diffDays;
      if (daysRemaining === 0) {
        return { text: "Reminder: Last Day to Submit!", color: "orange", active: true };
      } else if (daysRemaining < 0) {
        return { text: `Overdue by ${Math.abs(daysRemaining)} days`, color: "red", active: true };
      } else {
        return { text: `${daysRemaining} days remaining`, color: "orange", active: false };
      }
    }

    if (priority === "low") {
      // Low priority = 21 days (green color)
      // Reminder on last 2 days (diffDays === 20 or 21)
      const daysRemaining = 21 - diffDays;
      if (daysRemaining <= 2 && daysRemaining >= 0) {
        return { text: `Reminder: ${daysRemaining} days left!`, color: "green", active: true };
      } else if (daysRemaining < 0) {
        return { text: `Overdue by ${Math.abs(daysRemaining)} days`, color: "red", active: true };
      } else {
        return { text: `${daysRemaining} days remaining`, color: "green", active: false };
      }
    }

    return { text: "No reminder", color: "gray", active: false };
  };

  // Get active reminders
  const activeReminders = cases.map(c => {
    const reminderInfo = calculateReminder(c.receivedDate, c.priority, c.status);
    return { ...c, reminderInfo };
  }).filter(r => r.reminderInfo.active);

  const totalPct = "100%";
  const inProgressPct = totalCasesCount > 0 ? `+${Math.round((inProgressCasesCount / totalCasesCount) * 100)}%` : "0%";
  const pendingPct = totalCasesCount > 0 ? `+${Math.round((pendingCasesCount / totalCasesCount) * 100)}%` : "0%";
  const closedPct = totalCasesCount > 0 ? `+${Math.round((closedCasesCount / totalCasesCount) * 100)}%` : "0%";

  // Filter cases list in real-time
  const filteredCases = cases.filter((item) => {
    const matchesSearch =
      item.caseNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.subject || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPriority = priorityFilter === "all" || item.priority === priorityFilter;

    return matchesSearch && matchesPriority;
  });

  return (
    <div className="dashboard-container" data-font-scale={fontScale}>
      {/* ── Skip Link (A11y) ── */}
      <a href="#dashboard-main-content" className="skip-link">
        {t("skipLink")}
      </a>

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
        role="subject"
      />

      {/* ── Layout Grid Wrapper ── */}
      <div className="dashboard-layout">
        {/* ============================================================
           MAIN WORKSPACE CONTENT AREA
           ============================================================ */}
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
                <h2 className="dashboard-main-title">Subject Officer</h2>
                <p className="dashboard-main-subtitle">{t("subjectOfficerDesc")}</p>
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
                    aria-label={t("fontSmall")}
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
                    aria-label={t("fontMedium")}
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
                    aria-label={t("fontLarge")}
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

          {/* ── Dynamic Welcome Banner Greeting ── */}
          <section className="welcome-greeting-section">
            <h3 className="greeting-text">{greeting}</h3>
          </section>

          {/* Reminders Alert Widget */}
          {activeReminders.length > 0 && (
            <div className="reminders-alert-widget">
              <div className="reminders-widget-header">
                <svg className="reminders-bell-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <h4 className="reminders-widget-title">Active Reminders / Attention Required</h4>
              </div>
              <ul className="reminders-widget-list">
                {activeReminders.map((r) => (
                  <li key={r.id} className="reminders-widget-item">
                    Case <strong>{r.caseNo}</strong> ({r.priority.toUpperCase()} priority) - {r.reminderInfo.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Stats section */}
          <section className="dashboard-stats-grid subject-stats-grid">
            <div className="premium-stat-card total-cases-card">
              <div className="premium-card-top">
                <div className="premium-card-title-area">
                  <svg className="premium-card-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>{t("totalCases")}</span>
                </div>
                <span className="premium-card-percentage">{totalPct}</span>
              </div>
              <div className="premium-card-bottom">
                <div className="premium-card-value-area">
                  <span className="premium-card-value">{String(totalCasesCount).padStart(2, "0")}</span>
                  <span className="premium-card-label">cases</span>
                </div>
                <div className="premium-card-sparkline">
                  <svg viewBox="0 0 100 30" width="80" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M 5,22 Q 25,10 45,20 T 75,8 T 95,15" strokeLinecap="round" />
                    <circle cx="75" cy="8" r="3" fill="#ffffff" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="premium-stat-card inprogress-cases-card">
              <div className="premium-card-top">
                <div className="premium-card-title-area">
                  <svg className="premium-card-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18" />
                  </svg>
                  <span>{t("inProgressCases")}</span>
                </div>
                <span className="premium-card-percentage">{inProgressPct}</span>
              </div>
              <div className="premium-card-bottom">
                <div className="premium-card-value-area">
                  <span className="premium-card-value">{String(inProgressCasesCount).padStart(2, "0")}</span>
                  <span className="premium-card-label">cases</span>
                </div>
                <div className="premium-card-sparkline">
                  <svg viewBox="0 0 100 30" width="80" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M 5,20 Q 25,25 45,12 T 75,5 T 95,15" strokeLinecap="round" />
                    <circle cx="75" cy="5" r="3" fill="#ffffff" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="premium-stat-card pending-cases-card">
              <div className="premium-card-top">
                <div className="premium-card-title-area">
                  <svg className="premium-card-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{t("pendingCases")}</span>
                </div>
                <span className="premium-card-percentage">{pendingPct}</span>
              </div>
              <div className="premium-card-bottom">
                <div className="premium-card-value-area">
                  <span className="premium-card-value">{String(pendingCasesCount).padStart(2, "0")}</span>
                  <span className="premium-card-label">cases</span>
                </div>
                <div className="premium-card-sparkline">
                  <svg viewBox="0 0 100 30" width="80" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M 5,15 Q 25,8 45,22 T 75,12 T 95,25" strokeLinecap="round" />
                    <circle cx="75" cy="12" r="3" fill="#ffffff" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="premium-stat-card closed-cases-card">
              <div className="premium-card-top">
                <div className="premium-card-title-area">
                  <svg className="premium-card-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{t("closeCases")}</span>
                </div>
                <span className="premium-card-percentage">{closedPct}</span>
              </div>
              <div className="premium-card-bottom">
                <div className="premium-card-value-area">
                  <span className="premium-card-value">{String(closedCasesCount).padStart(2, "0")}</span>
                  <span className="premium-card-label">cases</span>
                </div>
                <div className="premium-card-sparkline">
                  <svg viewBox="0 0 100 30" width="80" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M 5,25 Q 25,20 45,8 T 75,5 T 95,12" strokeLinecap="round" />
                    <circle cx="75" cy="5" r="3" fill="#ffffff" />
                  </svg>
                </div>
              </div>
            </div>
          </section>

          {/* ==================== INVESTIGATION DIRECTIVES & DATA FLOW SECTION ==================== */}
          <section className="letters-list-section" style={{ marginBottom: "24px" }}>
            <div className="letters-list-header" style={{ flexWrap: "wrap", gap: "10px" }}>
              <h3 className="section-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <Send size={20} style={{ color: "#0284c7" }} />
                <span>{lang === "si" ? "විමර්ශන නියෝග සහ සහතික කිරීම් (Data Flow Directives)" : "Investigation Directives & Certification Flow"}</span>
              </h3>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Directives, report due dates, extension terms from Investigation Administrator
              </span>
            </div>

            {assignments.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "16px", padding: "16px" }}>
                {assignments.map((asgn) => {
                  const isDatesSubmitted = !!asgn.datesSubmittedBySubject;
                  const isExtensionRequested = !!asgn.extensionRequestedByAdmin || (asgn.extensionTerm && asgn.extensionTerm !== "None");
                  const isCertified = !!asgn.certificationSubmitted;
                  const isApproved = !!asgn.reportApprovedByAdmin;

                  return (
                    <div key={asgn.id} style={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #cbd5e1", padding: "16px", boxShadow: "0 2px 4px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: "12px" }}>
                      
                      {/* Header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <FileText size={18} style={{ color: "#4f46e5" }} />
                          <span style={{ fontWeight: 700, fontSize: "15px", color: "#0f172a" }}>Case: {asgn.caseNo}</span>
                        </div>
                        <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "12px", backgroundColor: isApproved ? "#dcfce7" : isDatesSubmitted ? "#e0f2fe" : "#fef3c7", color: isApproved ? "#15803d" : isDatesSubmitted ? "#0369a1" : "#b45309" }}>
                          {isApproved ? "✓ Case Approved" : isDatesSubmitted ? "Step 2: Dates Sent" : "Step 1: Officers Assigned"}
                        </span>
                      </div>

                      {/* STEP 2: Subject Officer Submits Appointment Date & Report Due Date */}
                      {!isDatesSubmitted ? (
                        <div style={{ backgroundColor: "#f0f9ff", padding: "12px", borderRadius: "8px", border: "1px solid #bae6fd", display: "flex", flexDirection: "column", gap: "8px" }}>
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "#0369a1", display: "flex", alignItems: "center", gap: "6px" }}>
                            <CalendarIcon size={14} />
                            <span>Step 2: Enter & Send Appointment & Report Due Dates</span>
                          </div>
                          
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                            <div>
                              <label style={{ fontSize: "11px", fontWeight: 600, color: "#475569" }}>Appointment Date</label>
                              <input
                                type="date"
                                id={`app-date-${asgn.id}`}
                                defaultValue={asgn.appointmentDate || new Date().toISOString().slice(0, 10)}
                                style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: "11px", fontWeight: 600, color: "#475569" }}>Report Due Date</label>
                              <input
                                type="date"
                                id={`due-date-${asgn.id}`}
                                defaultValue={asgn.reportDueDate || new Date().toISOString().slice(0, 10)}
                                style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const appEl = document.getElementById(`app-date-${asgn.id}`) as HTMLInputElement;
                              const dueEl = document.getElementById(`due-date-${asgn.id}`) as HTMLInputElement;
                              handleStep2SubmitDates(asgn, appEl?.value || "", dueEl?.value || "");
                            }}
                            style={{ padding: "7px 12px", backgroundColor: "#0284c7", color: "#ffffff", border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "12px", cursor: "pointer", marginTop: "4px" }}
                          >
                            Send Dates to Investigation Admin (Step 2)
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: "#334155", backgroundColor: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                          <div>📅 Appointment Date: <strong style={{ color: "#0369a1" }}>{asgn.appointmentDate || "Not set"}</strong></div>
                          <div>⏳ Report Due Date: <strong style={{ color: "#dc2626" }}>{asgn.reportDueDate || "Not set"}</strong></div>
                        </div>
                      )}

                      {/* STEP 3: Extension Request & Certification */}
                      {isExtensionRequested && (
                        <div style={{ backgroundColor: "#fffbeb", padding: "10px 12px", borderRadius: "8px", border: "1px solid #fef3c7", fontSize: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                          <div style={{ fontWeight: 700, color: "#b45309", display: "flex", alignItems: "center", gap: "6px" }}>
                            <Clock size={14} />
                            <span>Extension Request ({asgn.extensionTerm || "First"} Term)</span>
                          </div>
                          <div>
                            Period: <strong>{asgn.extensionStartDate || "Start"}</strong> to <strong>{asgn.extensionEndDate || "End"}</strong>
                          </div>

                          {!isCertified ? (
                            <button
                              type="button"
                              onClick={() => handleCertifyAssignment(asgn)}
                              style={{ padding: "6px 10px", backgroundColor: "#d97706", color: "#ffffff", border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "11px", cursor: "pointer", alignSelf: "flex-start", marginTop: "2px" }}
                            >
                              ✓ Submit Certification for Extension (Step 3)
                            </button>
                          ) : (
                            <span style={{ fontSize: "11px", color: "#166534", fontWeight: 700, backgroundColor: "#dcfce7", padding: "3px 8px", borderRadius: "6px", width: "fit-content" }}>
                              ✓ Extension Certified ({asgn.certificationDate || "Done"})
                            </span>
                          )}
                        </div>
                      )}

                      {/* STEP 6 (Final Action): Subject Officer adds Investigation Report into related case */}
                      <div style={{ marginTop: "6px", paddingTop: "10px", borderTop: "1px dashed #e2e8f0" }}>
                        <button
                          type="button"
                          onClick={() => handleOpenReportModal(asgn)}
                          style={{ width: "100%", padding: "8px 14px", backgroundColor: "#4f46e5", color: "#ffffff", border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", boxShadow: "0 2px 4px rgba(79,70,229,0.2)" }}
                        >
                          <Send size={14} />
                          <span>{asgn.reportContent ? "Edit Investigation Report in Related Case" : "+ Add Investigation Report into Related Case"}</span>
                        </button>
                        {asgn.reportContent && (
                          <div style={{ fontSize: "11px", color: "#166534", marginTop: "4px", fontWeight: 600 }}>
                            ✓ Report added on {asgn.reportSubmitDate || "recent"}
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: "20px", textAlign: "center", color: "#94a3b8", fontSize: "13px", fontStyle: "italic" }}>
                No active directives assigned by Investigation Administrator yet.
              </div>
            )}
          </section>

          {/* ── Case Management Section ── */}
          <section className="letters-list-section">
            {/* Header Filter Panel */}
            <div className="letters-list-header">
              <h3 className="section-title">
                <svg className="section-title-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>{t("assignedCases")}</span>
              </h3>

              <div className="letters-filters-group">
                {/* Search Bar Input */}
                <div className="search-box">
                  <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("searchCasesPlaceholder")}
                    className="search-input"
                  />
                </div>

                {/* Priority Selection Filter */}
                <div className="filter-dropdown-wrapper">
                  <svg className="filter-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  <select
                    value={priorityFilter}
                    onChange={(e: any) => setPriorityFilter(e.target.value)}
                    className="filter-priority-select"
                    aria-label={t("priority")}
                  >
                    <option value="all">All Priorities</option>
                    <option value="high">{t("priorityHigh")}</option>
                    <option value="medium">{t("priorityMedium")}</option>
                    <option value="low">{t("priorityLow")}</option>
                  </select>
                </div>

                <a href="#" className="view-all-reset-link" onClick={(e) => { e.preventDefault(); setSearchQuery(""); setPriorityFilter("all"); }}>
                  {t("viewAll")} <span className="arrow-span">→</span>
                </a>
              </div>
            </div>

            {/* cases listing table */}
            <div className="table-responsive-container">
              <table className="letters-data-table">
                <thead>
                  <tr>
                    <th scope="col">{t("caseNo")}</th>
                    <th scope="col">{t("assignedDate")}</th>
                    <th scope="col">{t("subjectText")}</th>
                    <th scope="col">{t("priority")}</th>
                    <th scope="col">{t("status")}</th>
                    <th scope="col">{t("caseAge", "Case Age")}</th>
                    <th scope="col">Reminder</th>
                    <th scope="col" className="text-center">{t("addDetails")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.length > 0 ? (
                    filteredCases.map((item) => (
                      <tr key={item.id} className="letter-table-row">
                        <td className="font-semibold">{item.caseNo}</td>
                        <td>{item.assignedDate}</td>
                        <td className="subject-cell">{item.subject}</td>
                        <td>
                          <span className={`priority-text-container priority-text-${item.priority}`}>
                            <span className={`priority-dot dot-${item.priority}`} aria-hidden="true"></span>
                            {item.priority === "high" ? t("priorityHigh") : item.priority === "medium" ? t("priorityMedium") : t("priorityLow")}
                          </span>
                        </td>
                        <td>
                          {item.status === "In Progress" ? t("statusInProgress") :
                            item.status === "Closed" ? t("statusClosed") : t("statusPending")}
                        </td>
                        <td>
                          {item.isOld ? t("oldCase", "Old Case") : t("newCase", "New Case")}
                        </td>
                        <td>
                          {(() => {
                            const rem = calculateReminder(item.assignedDate, item.priority, item.status);
                            let colorClass = "reminder-text-gray";
                            let dotClass = "dot-gray";
                            if (rem.color === "red") {
                              colorClass = "reminder-text-red";
                              dotClass = "dot-red";
                            } else if (rem.color === "orange") {
                              colorClass = "reminder-text-orange";
                              dotClass = "dot-orange";
                            } else if (rem.color === "green") {
                              colorClass = "reminder-text-green";
                              dotClass = "dot-green";
                            }

                            return (
                              <span className={`reminder-text-container ${colorClass}`}>
                                <span className={`reminder-dot ${dotClass}`} aria-hidden="true"></span>
                                {rem.text}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="text-center actions-cell">
                          <Link
                            href={`/subject/add-details?caseNo=${item.caseNo}`}
                            className="add-details-link"
                          >
                            {t("addDetails")}
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="text-center py-4 text-muted">
                        No cases found matching search
                      </td>
                    </tr>
                  )}
                  {/* Mock placeholder stripes as shown in the screenshot */}
                  <tr className="placeholder-stripe-row"><td colSpan={8} aria-hidden="true"></td></tr>
                  <tr className="placeholder-stripe-row"><td colSpan={8} aria-hidden="true"></td></tr>
                  <tr className="placeholder-stripe-row"><td colSpan={8} aria-hidden="true"></td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Footer Branding Notice */}
          <SiteFooter />
        </main>
      </div>

      {/* ==================== SUBMIT INVESTIGATION REPORT MODAL ==================== */}
      {isReportModalOpen && activeAssignment && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
          <div className="modal-content-wrapper premium-modal" style={{ maxWidth: "600px", width: "95%", borderRadius: "16px", overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            
            <header className="modal-header" style={{ padding: "18px 24px", backgroundColor: "#1e1b4b", color: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Send size={20} style={{ color: "#818cf8" }} />
                </div>
                <div>
                  <h3 id="report-modal-title" style={{ color: "#ffffff", margin: 0, fontSize: "17px", fontWeight: 700 }}>
                    {lang === "si" ? "විමර්ශන වාර්තාව විමර්ශන පරිපාලක වෙත යොමු කිරීම" : "Submit Investigation Report"}
                  </h3>
                  <span style={{ fontSize: "12px", color: "#cbd5e1" }}>
                    Case: <strong>{activeAssignment.caseNo}</strong>
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsReportModalOpen(false)}
                style={{ color: "#ffffff", backgroundColor: "rgba(255,255,255,0.1)", border: "none", padding: "8px", borderRadius: "50%", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </header>

            <form onSubmit={handleSubmitReport} style={{ padding: "20px 24px", backgroundColor: "#ffffff" }}>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                
                {/* Directive Summary */}
                <div style={{ backgroundColor: "#f8fafc", padding: "12px 14px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px" }}>
                  <div style={{ fontWeight: 700, color: "#334155", marginBottom: "4px" }}>Directive Details:</div>
                  <div style={{ color: "#64748b" }}>
                    Appointment Date: <strong>{activeAssignment.appointmentDate || "N/A"}</strong> | Due Date: <strong>{activeAssignment.reportDueDate || "N/A"}</strong>
                  </div>
                </div>

                {/* Report Submit Date */}
                <div className="form-field-group">
                  <label htmlFor="formReportSubmitDate" className="field-label" style={{ fontWeight: 600, color: "#334155", fontSize: "13px" }}>
                    {lang === "si" ? "වාර්තාව භාරදෙන දිනය (Report Submit Date)" : "Report Submit Date"} <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    id="formReportSubmitDate"
                    type="date"
                    value={reportDateForm}
                    onChange={(e) => setReportDateForm(e.target.value)}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", width: "100%", fontSize: "14px" }}
                  />
                </div>

                {/* Investigation Report Details / Findings */}
                <div className="form-field-group">
                  <label htmlFor="formReportContent" className="field-label" style={{ fontWeight: 600, color: "#334155", fontSize: "13px" }}>
                    {lang === "si" ? "විමර්ශන වාර්තාව සහ සොයාගැනීම් (Investigation Report Content)" : "Investigation Report & Findings"} <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <textarea
                    id="formReportContent"
                    rows={5}
                    value={reportContentForm}
                    onChange={(e) => setReportContentForm(e.target.value)}
                    placeholder={lang === "si" ? "විමර්ශන සොයාගැනීම්, නිගමන සහ නිර්දේශ මෙහි සටහන් කරන්න..." : "Enter your investigation report findings, conclusions, and recommended actions here..."}
                    style={{ padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", width: "100%", fontSize: "14px", resize: "vertical" }}
                  />
                </div>

              </div>

              <footer style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  style={{ padding: "10px 20px", borderRadius: "8px", backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1", color: "#475569", fontWeight: 600, fontSize: "14px" }}
                >
                  {t("cancelBtn", "Cancel")}
                </button>
                <button
                  type="submit"
                  style={{ padding: "10px 26px", borderRadius: "8px", backgroundColor: "#4f46e5", color: "#ffffff", border: "none", fontWeight: 600, fontSize: "14px", display: "inline-flex", alignItems: "center", gap: "8px", boxShadow: "0 2px 4px rgba(79,70,229,0.2)", cursor: "pointer" }}
                >
                  <Send size={16} />
                  <span>{lang === "si" ? "පරිපාලක වෙත යොමු කරන්න" : "Submit Report to Admin"}</span>
                </button>
              </footer>

            </form>

          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-notification" style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#065f46", color: "#ffffff", padding: "12px 20px", borderRadius: "10px", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)", position: "fixed", bottom: "24px", right: "24px", zIndex: 9999 }}>
          <CheckCircle size={20} style={{ color: "#34d399" }} />
          <span style={{ fontWeight: 600, fontSize: "14px" }}>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
