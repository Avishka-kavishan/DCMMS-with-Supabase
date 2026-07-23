"use client";

import "../../i18n";
import "./calendar.css";
import "../dashboard-common.css";
import "../daily-mail/daily-mail.css"; // Reuse general dashboard styles
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sidebar } from "@/components/Sidebar";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { signOut } from "@/lib/auth";

interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  start: { dateTime: string };
  end: { dateTime: string };
  location?: string;
  source: string;
}

export default function CalendarPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  // Hydration state
  const [mounted, setMounted] = useState(false);

  // Accessibility & language state
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");
  const lang = i18n.language;

  // Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date("2026-07-01")); // Anchor at July 2026 for demo consistency
  const [selectedDate, setSelectedDate] = useState<Date>(new Date("2026-07-05"));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiveApi, setIsLiveApi] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Form State
  const [formSummary, setFormSummary] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formTimeStart, setFormTimeStart] = useState("");
  const [formTimeEnd, setFormTimeEnd] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch events from Supabase (or fallback to localStorage)
  const fetchEvents = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from("dcmms_calendar")
          .select("*")
          .order("start_time", { ascending: true });

        if (error) throw error;

        if (data) {
          const mapped: CalendarEvent[] = data.map((item: any) => ({
            id: item.id,
            summary: item.summary,
            description: item.description || "",
            start: { dateTime: item.start_time },
            end: { dateTime: item.end_time },
            location: item.location || "",
            source: item.source || "User Input",
          }));
          setEvents(mapped);
          setIsLiveApi(true);
          return;
        }
      }

      // Local storage fallback
      setIsLiveApi(false);
      const stored = localStorage.getItem("dcmms_calendar_events");
      if (stored) {
        try {
          setEvents(JSON.parse(stored));
        } catch {
          setEvents([]);
        }
      } else {
        // Default demo events
        const defaults: CalendarEvent[] = [
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
            description: "Teacher absenteeism investigation - Jaffna Office",
            start: { dateTime: "2026-07-12T09:30:00+05:30" },
            end: { dateTime: "2026-07-12T11:30:00+05:30" },
            location: "Zonal Education Office, Jaffna",
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
        setEvents(defaults);
        localStorage.setItem("dcmms_calendar_events", JSON.stringify(defaults));
      }
    } catch (e: any) {
      console.error(e);
      setApiError("Unable to establish calendar connection. Using simulated dashboard data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (mounted) {
      fetchEvents();

      if (isSupabaseConfigured) {
        const channel = supabase
          .channel("calendar-realtime")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "dcmms_calendar" },
            () => {
              fetchEvents();
            }
          )
          .subscribe();

        const interval = setInterval(fetchEvents, 5000);

        return () => {
          supabase.removeChannel(channel);
          clearInterval(interval);
        };
      }
    }
  }, [mounted]);


  // Sync document page title & HTML element lang
  useEffect(() => {
    if (mounted) {
      document.documentElement.lang = lang;
      document.title = `${t("calendarTitle", "Calendar Scheduler")} | DCMMS`;
    }
  }, [lang, mounted, t]);

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

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut();
    router.push("/");
  };

  // Session guard — redirect to login if not authenticated
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) router.replace("/");
    });
  }, [router]);

  // Render loading state until mounted to prevent Next.js hydration issues
  if (!mounted) {
    return null;
  }

  // Monthly Calendar Helper Calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNamesEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthNamesSi = ["ජනවාරි", "පෙබරවාරි", "මාර්තු", "අප්‍රේල්", "මැයි", "ජූනි", "ජූලි", "අගෝස්තු", "සැප්තැම්බර්", "ඔක්තෝබර්", "නොවැම්බර්", "දෙසැම්බර්"];
  const monthNamesTa = ["ஜனவரி", "பிப்ரவரி", "மார்ச்", "ஏப்ரல்", "மே", "ஜூன்", "ஜூலை", "ஆகஸ்ட்", "செப்டம்பர்", "அக்டோபர்", "நவம்பர்", "டிசம்பர்"];

  const currentMonthName = lang === "si" ? monthNamesSi[month] : lang === "ta" ? monthNamesTa[month] : monthNamesEn[month];

  // First day of the month offset
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  // Total days in month
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  // Total days in previous month
  const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

  // Grid days generation
  const calendarDays = [];

  // Previous month padding days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    calendarDays.push({
      day: totalDaysInPrevMonth - i,
      date: new Date(year, month - 1, totalDaysInPrevMonth - i),
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let i = 1; i <= totalDaysInMonth; i++) {
    calendarDays.push({
      day: i,
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }

  // Next month padding days to round up to a complete week grid row (multiple of 7)
  const remainingCells = 42 - calendarDays.length;
  for (let i = 1; i <= remainingCells; i++) {
    calendarDays.push({
      day: i,
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }

  // Localized week titles
  const weekDaysEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekDaysSi = ["ඉරිදා", "සඳුදා", "අඟහරුදා", "බදාදා", "බ්‍රහස්පතින්දා", "සිකුරාදා", "සෙනසුරාදා"];
  const weekDaysTa = ["ஞாயிறு", "திங்கள்", "செவ்வாய்", "புதன்", "வியாழன்", "வெள்ளி", "சனி"];

  const weekDayLabels = lang === "si" ? weekDaysSi : lang === "ta" ? weekDaysTa : weekDaysEn;

  // Filter events for the selected date
  const selectedDateEvents = events.filter((ev) => {
    if (!ev.start?.dateTime) return false;
    const evDate = new Date(ev.start.dateTime);
    return (
      evDate.getFullYear() === selectedDate.getFullYear() &&
      evDate.getMonth() === selectedDate.getMonth() &&
      evDate.getDate() === selectedDate.getDate()
    );
  });

  // Navigate Months
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Submit custom event
  const handleSubmitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSummary || !formTimeStart || !formTimeEnd) {
      alert("Please fill in all mandatory fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedFormatted = selectedDate.toISOString().split("T")[0];
      const startDateTime = `${selectedFormatted}T${formTimeStart}:00+05:30`;
      const endDateTime = `${selectedFormatted}T${formTimeEnd}:00+05:30`;
      const newId = `event-${Date.now()}`;

      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from("dcmms_calendar")
          .upsert({
            id: newId,
            summary: formSummary,
            description: formDesc || null,
            location: formLocation || null,
            start_time: startDateTime,
            end_time: endDateTime,
            source: "Manual Submission",
          });

        if (error) throw error;
      } else {
        // Fallback to localStorage
        const stored = localStorage.getItem("dcmms_calendar_events");
        const list: CalendarEvent[] = stored ? JSON.parse(stored) : [];
        list.push({
          id: newId,
          summary: formSummary,
          description: formDesc || "",
          start: { dateTime: startDateTime },
          end: { dateTime: endDateTime },
          location: formLocation || "",
          source: "Manual Submission",
        });
        localStorage.setItem("dcmms_calendar_events", JSON.stringify(list));
      }

      // Reset form states
      setFormSummary("");
      setFormDesc("");
      setFormLocation("");
      setFormTimeStart("");
      setFormTimeEnd("");

      // Reload events
      await fetchEvents();
      alert("Event scheduled successfully!");
    } catch (e: any) {
      alert(`Error scheduling event: ${e.message || e}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="dashboard-container" data-font-scale={fontScale}>
      {/* Skip Link (A11y) */}
      <a href="#calendar-main-content" className="skip-link">
        {t("skipLink")}
      </a>

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
        role="admin" // Defaulting sidebar layout context to admin
      />

      <div className="dashboard-layout">
        <main id="calendar-main-content" className="dashboard-content">
          
          {/* Dashboard Page Header */}
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
                <h2 className="dashboard-main-title">{t("calendarTitle", "Calendar Scheduler")}</h2>
                <p className="dashboard-main-subtitle">{t("calendarDesc", "Synchronize and monitor disciplinary inquiries, hearings, and official events")}</p>
              </div>
            </div>

            <div className="dashboard-header-right">
              {/* Accessibility Scale Controller */}
              <div className="accessibility-adjuster-bar" role="radiogroup" aria-label="Font Sizing Adjustment">
                <button 
                  className={`size-btn size-btn-small${fontScale === "small" ? " active" : ""}`}
                  onClick={() => setFontScale("small")}
                  aria-label={t("fontSmall")}
                >A</button>
                <button 
                  className={`size-btn size-btn-medium${fontScale === "medium" ? " active" : ""}`}
                  onClick={() => setFontScale("medium")}
                  aria-label={t("fontMedium")}
                >A</button>
                <button 
                  className={`size-btn size-btn-large${fontScale === "large" ? " active" : ""}`}
                  onClick={() => setFontScale("large")}
                  aria-label={t("fontLarge")}
                >A</button>
              </div>

              <div className="divider-line" aria-hidden="true" />

              {/* Languages switch radio buttons */}
              <div className="trilingual-language-selector" role="radiogroup" aria-label="Translate Dashboard Language">
                <button 
                  className={`lang-btn${lang === "si" ? " active" : ""}`} 
                  onClick={() => changeLanguage("si")}
                  lang="si"
                >සිංහල</button>
                <button 
                  className={`lang-btn${lang === "ta" ? " active" : ""}`} 
                  onClick={() => changeLanguage("ta")}
                  lang="ta"
                >தமிழ்</button>
                <button 
                  className={`lang-btn${lang === "en" ? " active" : ""}`} 
                  onClick={() => changeLanguage("en")}
                  lang="en"
                >English</button>
              </div>
            </div>
          </header>

          {/* Connection Status Card */}
          <div className="calendar-status-card">
            <div className="status-info">
              <span className="status-label">{t("calendarStatus", "Google Calendar Status")}</span>
              <div className="status-value-group">
                <span className={`status-indicator-dot ${isLiveApi ? "live" : "simulated"}`} />
                <span className="status-title">
                  {isLiveApi ? "Live Google Calendar API Connected" : "Simulated Google Calendar API Mode"}
                </span>
              </div>
              {apiError && <span className="status-error-text">{apiError}</span>}
            </div>
            <div>
              <span className={`status-badge ${isLiveApi ? "live" : "simulated"}`}>
                {isLiveApi ? "API Active" : "Mock Active"}
              </span>
            </div>
          </div>

          {/* Core Content Grid */}
          <div className="calendar-page-layout">
            
            {/* Left Calendar Grid Card */}
            <div className="calendar-card">
              <div className="calendar-header-nav">
                <h3 className="calendar-title-month">{currentMonthName} {year}</h3>
                <div className="calendar-nav-buttons">
                  <button 
                    className="btn-nav-cal" 
                    onClick={handlePrevMonth} 
                    aria-label="Previous Month"
                  >
                    <svg className="calendar-nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button 
                    className="btn-nav-cal" 
                    onClick={handleNextMonth} 
                    aria-label="Next Month"
                  >
                    <svg className="calendar-nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Day names headers */}
              <div className="calendar-grid-header">
                {weekDayLabels.map((dayLabel, index) => (
                  <div key={index}>{dayLabel}</div>
                ))}
              </div>

              {/* Calendar Grid Cells */}
              <div className="calendar-grid-days">
                {calendarDays.map((cell, idx) => {
                  const hasInquiry = events.some((ev) => {
                    const d = new Date(ev.start?.dateTime);
                    return cell.isCurrentMonth && d.getDate() === cell.day && d.getMonth() === month && d.getFullYear() === year && ev.summary.toLowerCase().includes("inquiry");
                  });

                  const hasOfficer = events.some((ev) => {
                    const d = new Date(ev.start?.dateTime);
                    return cell.isCurrentMonth && d.getDate() === cell.day && d.getMonth() === month && d.getFullYear() === year && ev.summary.toLowerCase().includes("officer");
                  });

                  const isSelected = selectedDate.getDate() === cell.day && selectedDate.getMonth() === cell.date.getMonth() && selectedDate.getFullYear() === cell.date.getFullYear();
                  const isToday = new Date().toDateString() === cell.date.toDateString();

                  return (
                    <button
                      key={idx}
                      className={`calendar-day-cell ${cell.isCurrentMonth ? "" : "outside-month"} ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}`}
                      onClick={() => cell.isCurrentMonth && setSelectedDate(cell.date)}
                      aria-label={`${cell.day} ${currentMonthName}`}
                      disabled={!cell.isCurrentMonth}
                    >
                      <span className="day-number">{cell.day}</span>
                      <div className="day-event-indicators">
                        {hasInquiry && <span className="event-dot inquiry" title="Inquiry event" />}
                        {hasOfficer && <span className="event-dot officer" title="Officer appointment" />}
                        {cell.isCurrentMonth && events.some(ev => {
                          const d = new Date(ev.start?.dateTime);
                          return d.getDate() === cell.day && d.getMonth() === month && d.getFullYear() === year && !ev.summary.toLowerCase().includes("inquiry") && !ev.summary.toLowerCase().includes("officer");
                        }) && <span className="event-dot google" title="Other event" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Information & Form Sidebar */}
            <div className="calendar-events-panel">
              
              {/* Event Display Panel */}
              <div className="events-panel-card">
                <h4 className="panel-section-title">{t("calendarSelectedEvents", "Scheduled Events")}</h4>
                <span className="selected-date-label">
                  {selectedDate.toLocaleDateString(
                    lang === "si" ? "si-LK" : lang === "ta" ? "ta-LK" : "en-US",
                    { weekday: "long", year: "numeric", month: "long", day: "numeric" }
                  )}
                </span>

                <div className="events-list">
                  {isLoading ? (
                    <div className="empty-events-state">Loading calendar events...</div>
                  ) : selectedDateEvents.length > 0 ? (
                    selectedDateEvents.map((ev, index) => {
                      const isTypeInq = ev.summary.toLowerCase().includes("inquiry");
                      const isTypeAppt = ev.summary.toLowerCase().includes("officer");
                      const startTime = new Date(ev.start?.dateTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                      const endTime = new Date(ev.end?.dateTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

                      return (
                        <div key={index} className={`event-item-card ${isTypeInq ? "inquiry" : isTypeAppt ? "officer" : "google"}`}>
                          <div className="event-card-header">
                            <h5 className="event-card-title">{ev.summary}</h5>
                            <span className={`event-card-source ${isTypeInq ? "inquiry" : isTypeAppt ? "officer" : "google"}`}>
                              {isTypeInq ? "Inquiry" : isTypeAppt ? "Officer" : "Google Event"}
                            </span>
                          </div>
                          <p className="event-card-desc">{ev.description}</p>
                          <div className="event-card-meta">
                            <div className="meta-row">
                              <svg className="meta-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{startTime} - {endTime}</span>
                            </div>
                            {ev.location && (
                              <div className="meta-row">
                                <svg className="meta-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>{ev.location}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="empty-events-state">
                      <svg className="empty-events-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {t("calendarNoEvents", "No events scheduled for this day.")}
                    </div>
                  )}
                </div>
              </div>

              {/* Event Setup Form Panel */}
              <div className="events-panel-card">
                <h4 className="panel-section-title">{t("calendarAddEvent", "Schedule Event")}</h4>
                <form className="event-form" onSubmit={handleSubmitEvent}>
                  <div className="form-field-group">
                    <label htmlFor="formSummary" className="field-label">Event Summary *</label>
                    <input 
                      type="text" 
                      id="formSummary" 
                      className="field-input" 
                      placeholder="e.g. Disciplinary Inquiry - Hearing"
                      value={formSummary}
                      onChange={(e) => setFormSummary(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-field-group">
                    <label htmlFor="formDesc" className="field-label">Description / Remarks</label>
                    <textarea 
                      id="formDesc" 
                      className="field-input textarea-no-resize" 
                      placeholder="Case details, notes, etc."
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                    />
                  </div>
                  <div className="form-field-group">
                    <label htmlFor="formLocation" className="field-label">Location / Room</label>
                    <input 
                      type="text" 
                      id="formLocation" 
                      className="field-input" 
                      placeholder="e.g. Conference Room B"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                    />
                  </div>
                  
                  <div className="form-row">
                    <div className="form-field-group">
                      <label htmlFor="formTimeStart" className="field-label">Start Time *</label>
                      <input 
                        type="time" 
                        id="formTimeStart" 
                        className="field-input"
                        value={formTimeStart}
                        onChange={(e) => setFormTimeStart(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-field-group">
                      <label htmlFor="formTimeEnd" className="field-label">End Time *</label>
                      <input 
                        type="time" 
                        id="formTimeEnd" 
                        className="field-input"
                        value={formTimeEnd}
                        onChange={(e) => setFormTimeEnd(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="btn-submit-event" 
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Syncing..." : t("calendarEventSubmit", "Schedule Event")}
                  </button>
                </form>
              </div>
            </div>
          </div>
          <SiteFooter />
        </main>
      </div>
    </div>
  );
}
