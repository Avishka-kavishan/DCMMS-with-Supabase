"use client";

import "../../i18n";
import "./daily-mail.css";
import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sidebar } from "@/components/Sidebar";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { signOut } from "@/lib/auth";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

interface Letter {
  id: string;
  refNo: string;
  receivedDate: string;
  letterDate: string;
  senderName: string;
  senderAddress?: string;
  subject: string;
  priority: "high" | "medium" | "low";
  status: "registered" | "assigned" | "pending";
  letterNo?: string;
  letterType?: string;
  officerName?: string;
  subjectCategory?: string;
  instituteName?: string;
  regionProvince?: "region" | "province";
}

export default function DailyMailPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  // Accessibility & language state
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");
  const lang = i18n.language;

  // Mobile sidebar visibility state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Dynamic localized greeting based on time of day
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const hour = new Date().getHours();
    let greetingKey = "greetingMorning";
    if (hour >= 12 && hour < 17) {
      greetingKey = "greetingAfternoon";
    } else if (hour >= 17 || hour < 5) {
      greetingKey = "greetingEvening";
    }
    const firstName = t("welcomeUser").split(" ")[0];
    setGreeting(`${t(greetingKey)}, ${firstName}!`);
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
    document.title = `${t("dailyMailReporter")} | DCMMS`;
  }, [lang, t]);

  // Fetch letters from Supabase (or fallback to localStorage) on mount
  useEffect(() => {
    const fetchLetters = async () => {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from("dcmms_letters")
            .select("*")
            .order("created_at", { ascending: false });

          if (error) throw error;

          if (data) {
            const mapped = data.map((db: any) => ({
              id: db.id,
              refNo: db.ref_no,
              letterNo: db.letter_no || "",
              receivedDate: db.received_date,
              letterDate: db.letter_date,
              senderName: db.sender_name,
              senderAddress: db.sender_address || "N/A",
              subject: db.subject,
              priority: db.priority,
              status: db.status,
              letterType: db.letter_type || "",
              officerName: db.officer_name || "",
              subjectCategory: db.subject_category || "",
              instituteName: db.institute_name || "",
              regionProvince: db.region_province || "",
            }));
            setLetters(mapped);
            return;
          }
        } catch (err) {
          console.error("Supabase letters fetch error, falling back to local storage:", err);
        }
      }

      // Local storage fallback
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("dcmms_letters");
        if (stored) {
          try {
            setLetters(JSON.parse(stored));
          } catch (e) {
            console.error("Error parsing stored letters", e);
          }
        } else {
          setLetters([]);
        }
      }
    };
    fetchLetters();

    // Subscribe to real-time updates from Supabase
    const channel = supabase
      .channel("daily-mail-realtime-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_letters" }, fetchLetters)
      .subscribe();

    // Fallback: auto-refresh every 5 seconds
    const interval = setInterval(fetchLetters, 5_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  // Check for registration success flag on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const showSuccess = localStorage.getItem("show_register_success");
      if (showSuccess === "true") {
        triggerToast(t("toastSuccess"));
        localStorage.removeItem("show_register_success");
      }
    }
  }, [t]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  // Letters listing state (initially empty, loaded from database)
  const [letters, setLetters] = useState<Letter[]>([]);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "high" | "medium" | "low">("all");

  // Success Notification Toast state
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  // Trigger toast notification helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 4000);
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

  // Filter letters list in real-time
  const filteredLetters = letters.filter((letter) => {
    const matchesSearch =
      letter.refNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (letter.letterNo || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      letter.senderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (letter.instituteName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (letter.letterType || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (letter.subjectCategory || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (letter.officerName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      letter.subject.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPriority = priorityFilter === "all" || letter.priority === priorityFilter;

    return matchesSearch && matchesPriority;
  });

  // Handle reset search filters
  const handleResetFilters = (e: React.MouseEvent) => {
    e.preventDefault();
    setSearchQuery("");
    setPriorityFilter("all");
  };

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
                <h2 className="dashboard-main-title">{t("dailyMailReporter")}</h2>
                <p className="dashboard-main-subtitle">{t("registerLettersDesc")}</p>
              </div>
            </div>

            <div className="dashboard-header-right">
              {/* Date display badge */}
              <div className="date-badge">
                <svg className="date-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span suppressHydrationWarning>
                  {new Date().toLocaleDateString(
                    lang === "si" ? "si-LK" : lang === "ta" ? "ta-LK" : "en-US",
                    { year: "numeric", month: "long", day: "numeric" }
                  )}
                </span>
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

          {/* ── Quick Action Hero Cards (Figma Hero Banner) ── */}
          <section className="hero-banner-card-section">
            <div className="hero-action-card">
              <div className="hero-action-graphics">
                <div className="hero-circle-plus-badge">
                  <svg className="hero-plus-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
              </div>
              <div className="hero-action-details">
                <div className="sub-action">
                  <h4 className="hero-action-title">{t("registerLetterComplainBanner")}</h4>
                  <p className="hero-action-description">Easily log new incoming correspondence and files for dispatching to subject officers.</p>
                </div>
                <button className="btn-hero-action" onClick={() => router.push("/daily-mail/register")}>
                  {t("newLetterBtn")}
                </button>
              </div>
            </div>
          </section>

          {/* ── Letter Entries Section ── */}
          <section className="letters-list-section">
            
            {/* Header Filter Panel */}
            <div className="letters-list-header">
              <h3 className="section-title">{t("letterEntries")}</h3>
              
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
                    placeholder={t("searchLettersPlaceholder")}
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
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                {/* Reset filters action */}
                <a href="#" className="view-all-reset-link" onClick={handleResetFilters}>
                  {t("viewAll")} <span className="arrow-span">→</span>
                </a>
              </div>
            </div>

            {/* letters listing dynamic display grid/table */}
            <div className="table-responsive-container">
              <table className="letters-data-table">
                <thead>
                  <tr>
                    <th scope="col">{t("refNo")} / {t("letterNo")}</th>
                    <th scope="col">{t("receivedDate")}</th>
                    <th scope="col">{t("senderName")} / {t("instituteName")}</th>
                    <th scope="col">{t("letterType")}</th>
                    <th scope="col">{t("subjectCategory")}</th>
                    <th scope="col">{t("nameOfOfficer")}</th>
                    <th scope="col">{t("letterTitle")}</th>
                    <th scope="col" className="text-center">{t("edit", "Edit")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLetters.length > 0 ? (
                    filteredLetters.map((letter) => (
                      <tr key={letter.id} className="letter-table-row">
                        <td className="font-semibold text-primary">
                          <div className="ref-cell">
                            <span className="ref-no-display">{letter.refNo}</span>
                            {letter.letterNo && (
                              <span className="letter-no-display">{letter.letterNo}</span>
                            )}
                          </div>
                        </td>
                        <td>{letter.receivedDate}</td>
                        <td>
                          <div className="sender-cell">
                            <span className="sender-display-name">{letter.senderName}</span>
                            {letter.instituteName && (
                              <span className="sender-display-address">{letter.instituteName}</span>
                            )}
                          </div>
                        </td>
                        <td>{letter.letterType || "—"}</td>
                        <td>
                          {letter.subjectCategory ? (
                            t(`opt${letter.subjectCategory.replace(/\s+/g, "")}`, letter.subjectCategory)
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {letter.officerName ? (
                            t(`opt${letter.officerName.replace(/\s+/g, "")}`, letter.officerName)
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="subject-cell">{letter.subject}</td>
                        <td className="text-center actions-cell">
                          <button
                            className="btn-action-view"
                            onClick={() => router.push(`/daily-mail/register?id=${letter.id}`)}
                            title="Edit Letter"
                            aria-label="Edit Letter"
                          >
                            <svg className="action-row-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            className="btn-action-add-subsequent"
                            onClick={() => router.push(`/daily-mail/register?caseNo=${letter.refNo}&subsequent=true`)}
                            title={t("addMailForCase", "Add Mail for Case")}
                            aria-label="Add subsequent mail for this case"
                          >
                            <svg className="action-row-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="empty-table-state-cell">
                        <div className="empty-state-card">
                          <svg className="empty-state-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 19v-8.93a2 2 0 01.89-1.664l8-5.333a2 2 0 012.22 0l8 5.333A2 2 0 0121 10.07V19M3 19a2 2 0 002-2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-2.25-1.5a2 2 0 00-2.22 0l-2.25 1.5" />
                          </svg>
                          <p>{t("noLettersFound")}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Footer Branding Notice ── */}
          <footer className="dashboard-content-footer">
            <p>{t("footerText")}</p>
          </footer>
        </main>
      </div>

      {/* Modal and success toast removed or placed globally */}

      {/* ============================================================
         SUCCESS TOAST COMPONENT
         ============================================================ */}
      <div className={`toast-notification${showToast ? " show" : ""}`} role="status" aria-live="polite">
        <svg className="toast-success-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{toastMessage}</span>
      </div>

    </div>
  );
}
