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
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getCurrentProfile, signOut, UserProfile } from "@/lib/auth";

interface Case {
  id: string;
  caseNo: string;
  assignedDate: string;
  subject: string;
  priority: "high" | "medium" | "low";
  status: "In Progress" | "Closed" | "Pending";
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
              .from("dcmms_letters")
              .select("ref_no")
              .eq("officer_name", activeProfile.full_name);

            if (lettersError) throw lettersError;

            const assignedRefNos = letters ? letters.map((l: any) => l.ref_no) : [];

            if (assignedRefNos.length > 0) {
              const { data: casesData, error: casesError } = await supabase
                .from("dcmms_cases")
                .select("*")
                .in("case_no", assignedRefNos)
                .order("case_no", { ascending: true });

              if (casesError) throw casesError;

              if (casesData) {
                const mapped = casesData.map((item: any) => ({
                  id: item.id,
                  caseNo: item.case_no,
                  assignedDate: item.assigned_date,
                  subject: item.subject,
                  priority: item.priority,
                  status: item.status,
                }));
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
            const assignedRefNos = lettersList
              .filter((l: any) => l.officerName === activeName)
              .map((l: any) => l.refNo);

            // Filter cases matching assignedRefNos
            const filtered = casesList.filter((c: any) => assignedRefNos.includes(c.caseNo));
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
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_cases" }, fetchCases)
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_letters" }, fetchCases)
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
                    <th scope="col" className="text-center">{t("addDetails")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.length > 0 ? (
                    filteredCases.map((item) => (
                      <tr key={item.id} className="letter-table-row">
                        <td className="font-semibold text-primary">{item.caseNo}</td>
                        <td>{item.assignedDate}</td>
                        <td className="subject-cell">{item.subject}</td>
                        <td>
                          {item.priority === "high" ? t("priorityHigh") : item.priority === "medium" ? t("priorityMedium") : t("priorityLow")}
                        </td>
                        <td>
                          <span className={`badge-badge ${
                            item.status === "In Progress" ? "badge-status-inprogress" :
                            item.status === "Closed" ? "badge-status-closed" : "badge-status-pending"
                          }`}>
                            {item.status === "In Progress" ? t("statusInProgress") :
                             item.status === "Closed" ? t("statusClosed") : t("statusPending")}
                          </span>
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
                      <td colSpan={6} className="text-center py-4 text-muted">
                        No cases found matching search
                      </td>
                    </tr>
                  )}
                  {/* Mock placeholder stripes as shown in the screenshot */}
                  <tr className="placeholder-stripe-row"><td colSpan={6} aria-hidden="true"></td></tr>
                  <tr className="placeholder-stripe-row"><td colSpan={6} aria-hidden="true"></td></tr>
                  <tr className="placeholder-stripe-row"><td colSpan={6} aria-hidden="true"></td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Footer Branding Notice */}
          <footer className="dashboard-content-footer">
            <p>{t("footerText")}</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
