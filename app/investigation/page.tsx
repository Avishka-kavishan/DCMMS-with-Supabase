"use client";

import "../../i18n";
import "../daily-mail/daily-mail.css";
import "../dashboard-common.css";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sidebar } from "@/components/Sidebar";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { signOut } from "@/lib/auth";

interface Inquiry {
  id: string;
  inquiryNo: string;
  subject: string;
  targetDate: string;
  status: "Scheduled" | "In Progress" | "Evidence Review" | "Completed";
}

export default function InvestigationPage() {
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
    const firstName = t("investigationName").split(" ")[0];
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
    document.title = `${t("investigationDashboardTitle")} | DCMMS`;
  }, [lang, t]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  // Inquiry database state
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);

  // Fetch inquiries (cases) from database on mount
  useEffect(() => {
    const fetchInquiries = async () => {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from("dcmms_cases")
            .select("*")
            .order("case_no", { ascending: true });

          if (error) throw error;

          if (data) {
            const mappedInquiries = data
              .filter((item: any) => item.case_no.includes("INQ/"))
              .map((item: any) => ({
                id: item.id,
                inquiryNo: item.case_no,
                subject: item.subject,
                targetDate: item.assigned_date || "2026-07-01",
                status: item.status as Inquiry["status"],
              }));
            setInquiries(mappedInquiries);
            return;
          }
        } catch (err) {
          console.error("Failed to fetch inquiries from Supabase, falling back", err);
        }
      }

      // Fallback
      const defaults = [
        {
          id: "1",
          inquiryNo: "INQ/2026/001",
          subject: "Formal disciplinary inquiry - Student misconduct at Royal College",
          targetDate: "2026-07-05",
          status: "In Progress" as const,
        },
        {
          id: "2",
          inquiryNo: "INQ/2026/002",
          subject: "Preliminary investigation on teacher absenteeism - Jaffna Office",
          targetDate: "2026-07-12",
          status: "Evidence Review" as const,
        },
        {
          id: "3",
          inquiryNo: "INQ/2026/003",
          subject: "Inquiry into safety guidelines violation - Annual Sports Meet",
          targetDate: "2026-07-20",
          status: "Scheduled" as const,
        },
      ];
      setInquiries(defaults);
    };
    fetchInquiries();
  }, []);

  // Calendar Events State for widget
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [isCalendarLoading, setIsCalendarLoading] = useState(true);

  useEffect(() => {
    const fetchWidgetEvents = async () => {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from("dcmms_calendar_events")
            .select("*");

          if (!error && data) {
            const mapped = data.map((item: any) => ({
              id: item.id,
              summary: item.summary,
              description: item.description || "",
              start: { dateTime: item.start_time },
              end: { dateTime: item.end_time },
              location: item.location || "",
              source: item.source || "User Input"
            }));
            const sorted = mapped.sort((a: any, b: any) => {
              return new Date(a.start?.dateTime).getTime() - new Date(b.start?.dateTime).getTime();
            });
            setCalendarEvents(sorted);
            setIsCalendarLoading(false);
            return;
          }
        } catch (err) {
          console.error("Failed to fetch calendar events from Supabase in widget", err);
        }
      }

      // Fallback
      try {
        const stored = localStorage.getItem("dcmms_calendar_events");
        const list = stored ? JSON.parse(stored) : [
          {
            id: "mock-inq-001",
            summary: "Inquiry Hearing: INQ/2026/001",
            description: "Formal disciplinary inquiry - Student misconduct at Royal College",
            start: { dateTime: "2026-07-05T10:00:00+05:30" },
            end: { dateTime: "2026-07-05T12:00:00+05:30" },
            location: "Discipline Branch, Ministry of Education, Isurupaya",
            source: "Inquiry Target Date"
          },
          {
            id: "mock-inq-002",
            summary: "Inquiry Hearing: INQ/2026/002",
            description: "Preliminary investigation on teacher absenteeism - Jaffna Office",
            start: { dateTime: "2026-07-12T09:30:00+05:30" },
            end: { dateTime: "2026-07-12T11:30:00+05:30" },
            location: "Zonal Education Office, Jaffna",
            source: "Inquiry Target Date"
          },
          {
            id: "mock-inq-003",
            summary: "Inquiry Hearing: INQ/2026/003",
            description: "Inquiry into safety guidelines violation - Annual Sports Meet",
            start: { dateTime: "2026-07-20T14:00:00+05:30" },
            end: { dateTime: "2026-07-20T16:00:00+05:30" },
            location: "Discipline Branch, Ministry of Education, Isurupaya",
            source: "Inquiry Target Date"
          },
          {
            id: "mock-appt-001",
            summary: "Officer Appointment: DCMMS/2026/001",
            description: "Inquiry Officer appointment date for Student Misconduct case.",
            start: { dateTime: "2026-07-10T09:00:00+05:30" },
            end: { dateTime: "2026-07-10T10:00:00+05:30" },
            location: "Discipline Branch, Isurupaya",
            source: "Officer Appointment Date"
          }
        ];
        const sorted = list.sort((a: any, b: any) => {
          return new Date(a.start?.dateTime).getTime() - new Date(b.start?.dateTime).getTime();
        });
        setCalendarEvents(sorted);
      } catch (err) {
        console.error("Failed to load local calendar events in widget", err);
      } finally {
        setIsCalendarLoading(false);
      }
    };
    fetchWidgetEvents();
  }, []);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

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

  // Filter inquiries list in real-time
  const filteredInquiries = inquiries.filter((item) => {
    return (
      item.inquiryNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.status.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Dynamic counts calculations
  const activeInquiriesCount = inquiries.length;
  const inProgressInquiriesCount = inquiries.filter((i) => i.status === "In Progress").length;
  const evidenceReviewsInquiriesCount = inquiries.filter((i) => i.status === "Evidence Review").length;
  const scheduledHearingsInquiriesCount = inquiries.filter((i) => i.status === "Scheduled").length;

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
        role="investigation"
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
                <h2 className="dashboard-main-title">{t("investigationDashboardTitle")}</h2>
                <p className="dashboard-main-subtitle">{t("investigationDashboardDesc")}</p>
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

          {/* Stats section */}
          <section className="dashboard-stats-grid">
            <div className="hero-action-card">
              <h4>Active Inquiries</h4>
              <p>{activeInquiriesCount}</p>
            </div>
            <div className="hero-action-card">
              <h4>In Progress</h4>
              <p className="val-info">{inProgressInquiriesCount}</p>
            </div>
            <div className="hero-action-card">
              <h4>Evidence Reviews</h4>
              <p className="val-purple">{evidenceReviewsInquiriesCount}</p>
            </div>
            <div className="hero-action-card">
              <h4>Scheduled Hearings</h4>
              <p className="val-warning">{scheduledHearingsInquiriesCount}</p>
            </div>
          </section>

          {/* Upcoming Calendar Events widget */}
          <section className="upcoming-events-widget">
            <div className="upcoming-events-container">
              <div className="upcoming-events-header">
                <h4 className="upcoming-events-title">
                  <svg className="upcoming-events-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Upcoming Disciplinary Events (Calendar API)
                </h4>
                <a href="/calendar" className="upcoming-events-link">View Full Calendar &rarr;</a>
              </div>
              
              {isCalendarLoading ? (
                <div className="upcoming-events-loading">Loading upcoming calendar events...</div>
              ) : calendarEvents.length > 0 ? (
                <div className="upcoming-events-grid">
                  {calendarEvents.slice(0, 3).map((ev: any, index: number) => {
                    const dateStr = new Date(ev.start?.dateTime).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
                    const timeStr = new Date(ev.start?.dateTime).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                    return (
                      <div key={index} className="upcoming-event-card">
                        <div className="upcoming-event-time-row">
                          <span>{dateStr}</span>
                          <span>{timeStr}</span>
                        </div>
                        <h5 className="upcoming-event-subject">{ev.summary}</h5>
                        <p className="upcoming-event-description">{ev.description}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="upcoming-events-empty">No upcoming events synced in Calendar.</div>
              )}
            </div>
          </section>

          {/* ── Inquiry List Section ── */}
          <section className="letters-list-section">
            {/* Header Filter Panel */}
            <div className="letters-list-header">
              <h3 className="section-title">Inquiry Cases</h3>

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
                    placeholder="Search inquiries..."
                    className="search-input"
                  />
                </div>
              </div>
            </div>

            {/* inquiries listing table */}
            <div className="table-responsive-container">
              <table className="letters-data-table">
                <thead>
                  <tr>
                    <th scope="col">Inquiry No</th>
                    <th scope="col">Target Completion Date</th>
                    <th scope="col">Subject / Matter</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInquiries.length > 0 ? (
                    filteredInquiries.map((item) => (
                      <tr key={item.id} className="letter-table-row">
                        <td className="font-semibold text-primary">{item.inquiryNo}</td>
                        <td>{item.targetDate}</td>
                        <td className="subject-cell">{item.subject}</td>
                        <td>
                          <span className={`badge-badge badge-status-assigned`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="text-center actions-cell">
                          <button
                            className="btn-action-view"
                            onClick={() => {
                              alert(`Inquiry details:\nInquiry No: ${item.inquiryNo}\nSubject: ${item.subject}\nTarget Date: ${item.targetDate}`);
                            }}
                            title="View Details"
                          >
                            <svg className="action-row-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-muted">
                        No inquiries found matching search
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
