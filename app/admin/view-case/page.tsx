"use client";

import "../../../i18n";
import "../../daily-mail/daily-mail.css";
import "../../dashboard-common.css";
import "../../subject/view-case/view-case.css";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sidebar } from "@/components/Sidebar";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getCurrentProfile, dashboardPath } from "@/lib/auth";

interface LetterData {
  refNo: string;
  senderName?: string;
  subject?: string;
  priority?: string;
  status?: string;
  officerName?: string;
  instituteName?: string;
  receivedDate?: string;
  letterNo?: string;
}

interface TrackingEntry {
  id: string;
  step: number;
  officerName: string;
  action: string;
  date: string;
  time: string;
  status: "Completed" | "Current" | "Pending";
}

function StatusBadge({ status }: { status: TrackingEntry["status"] }) {
  const cls =
    status === "Completed" ? "badge-completed"
    : status === "Current" ? "badge-current"
    : "badge-pending";
  return (
    <span className={`vc-status-badge ${cls}`}>
      <span className="vc-status-dot" />
      {status}
    </span>
  );
}

function TimelineDot({ status }: { status: TrackingEntry["status"] }) {
  const cls =
    status === "Completed" ? "dot-completed"
    : status === "Current" ? "dot-current"
    : "dot-pending";
  return (
    <div className={`vc-timeline-dot ${cls}`}>
      <svg className="vc-dot-check" viewBox="0 0 24 24" fill="none">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  );
}

function AdminViewCaseInner() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const caseNoParam = searchParams?.get("caseNo") || "";

  const lang = i18n.language;
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [letterData, setLetterData] = useState<LetterData | null>(null);
  const [trackingEntries, setTrackingEntries] = useState<TrackingEntry[]>([]);

  const getFormattedDate = () => {
    const date = new Date();
    if (lang === "si") return date.toLocaleDateString("si-LK", { day: "numeric", month: "long", year: "numeric" });
    if (lang === "ta") return date.toLocaleDateString("ta-LK", { day: "numeric", month: "long", year: "numeric" });
    return date.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setIsSidebarOpen(false); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `View Case ${caseNoParam} | DCMMS Admin`;
  }, [lang, caseNoParam]);

  const changeLanguage = (lng: string) => i18n.changeLanguage(lng);

  useEffect(() => {
    const verifyAndFetch = async () => {
      // Admin role check
      if (isSupabaseConfigured) {
        try {
          const profile = await getCurrentProfile();
          if (!profile || profile.role !== "admin") {
            router.replace(profile ? dashboardPath(profile.role) : "/");
            return;
          }
        } catch {
          router.replace("/");
          return;
        }
      }

      if (caseNoParam) {
        // Fetch case info
        if (isSupabaseConfigured) {
          try {
            const { data } = await supabase
              .from("dcmms_daily_mail")
              .select("*")
              .eq("ref_no", caseNoParam)
              .single();
            if (data) {
              setLetterData({
                refNo: data.ref_no,
                senderName: data.sender_name,
                subject: data.subject,
                priority: data.priority,
                status: data.status,
                officerName: data.officer_name,
                instituteName: data.institute_name,
                receivedDate: data.received_date,
                letterNo: data.letter_no,
              });
            }
          } catch (e) { console.error(e); }
        }

        // Build tracking entries
        const entries: TrackingEntry[] = [];
        if (isSupabaseConfigured) {
          try {
            const { data: actionsData } = await supabase
              .from("dcmms_subject_details")
              .select("*")
              .eq("case_no", caseNoParam)
              .order("received_date", { ascending: true });
            if (actionsData && actionsData.length > 0) {
              actionsData.forEach((d: any, idx: number) => {
                const isLast = idx === actionsData.length - 1;
                entries.push({
                  id: d.id,
                  step: idx + 1,
                  officerName: d.subject_officer_name || "Subject Officer",
                  action: d.step_taken || "Letter Registered in to the system",
                  date: d.received_date || "—",
                  time: d.received_date
                    ? new Date(d.received_date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
                    : "—",
                  status: d.report_state === "Closed" ? "Completed" : isLast ? "Current" : "Completed",
                });
              });
            }
          } catch (e) { console.error(e); }
        }

        if (entries.length === 0 && typeof window !== "undefined") {
          const storedActions = localStorage.getItem("dcmms_new_letter_current_case");
          if (storedActions) {
            try {
              const list = JSON.parse(storedActions) as any[];
              const filtered = list
                .filter((a) => a.caseNo === caseNoParam)
                .sort((a, b) => new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime());
              filtered.forEach((a, idx) => {
                const isLast = idx === filtered.length - 1;
                entries.push({
                  id: a.id || `${idx}`,
                  step: idx + 1,
                  officerName: a.subjectOfficerName || "Subject Officer",
                  action: a.stepTaken || "Letter Registered in to the system",
                  date: a.receivedDate || "—",
                  time: "—",
                  status: a.reportState === "Closed" ? "Completed" : isLast ? "Current" : "Completed",
                });
              });
            } catch { /* ignore */ }
          }
        }

        // Placeholder if still empty
        if (entries.length === 0) {
          const today = new Date().toLocaleDateString("en-GB");
          const roles = ["Daily Reporter", "Daily Reporter", "Daily Reporter", "Daily Reporter", "Daily Reporter", "Subject Officer", "Investigation Officer"];
          roles.forEach((role, idx) => {
            entries.push({
              id: `placeholder-${idx}`,
              step: idx + 1,
              officerName: "A.K. Rathnaweera",
              action: "Letter Registered in to the system",
              date: today,
              time: "15:02",
              status: idx < 5 ? "Completed" : idx === 5 ? "Current" : "Pending",
            });
          });
        }

        setTrackingEntries(entries);
      }

      setCheckingAuth(false);
      setIsLoading(false);
    };

    verifyAndFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseNoParam, router]);

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push("/");
  };

  if (checkingAuth) {
    return <div className="page-loading-container"><div>Loading…</div></div>;
  }

  const totalSteps = trackingEntries.length;
  const currentStep = trackingEntries.filter((e) => e.status !== "Pending").length;

  return (
    <div className="dashboard-container" data-font-scale={fontScale}>
      <a href="#dashboard-main-content" className="skip-link">{t("skipLink")}</a>

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
        role="admin"
      />

      <div className="dashboard-layout">
        <main id="dashboard-main-content" className="dashboard-content">
          {/* ── Header ── */}
          <header className="dashboard-header">
            <div className="dashboard-header-left">
              <button
                className="menu-toggle-btn"
                aria-label="Toggle Sidebar Menu"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                aria-expanded={isSidebarOpen}
              >
                <svg className="hamburger-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="dashboard-title-area">
                <h2 className="dashboard-main-title">{t("adminDashboardTitle", "Administrator")}</h2>
                <p className="dashboard-main-subtitle">{t("adminDashboardDesc", "Manage users and view case details")}</p>
              </div>
            </div>

            <div className="dashboard-header-right">
              <div className="date-badge">
                <span suppressHydrationWarning>{getFormattedDate()}</span>
                <svg className="date-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="divider-line" aria-hidden="true" />
              <div className="accessibility-adjuster-bar" role="radiogroup">
                {(["small", "medium", "large"] as const).map((s) => (
                  <label key={s} className={`size-btn size-btn-${s}${fontScale === s ? " active" : ""}`}>
                    <input type="radio" name="adminVcFontScale" value={s} checked={fontScale === s} onChange={() => setFontScale(s)} className="sr-only" />
                    A
                  </label>
                ))}
              </div>
              <div className="divider-line" aria-hidden="true" />
              <div className="trilingual-language-selector" role="radiogroup">
                {[["si", "සිංහල"], ["ta", "தமிழ்"], ["en", "English"]].map(([code, label]) => (
                  <label key={code} className={`lang-btn${lang === code ? " active" : ""}`}>
                    <input type="radio" name="adminVcLang" value={code} checked={lang === code} onChange={() => changeLanguage(code)} className="sr-only" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </header>

          {/* ── Body ── */}
          <div className="view-case-wrapper">
            <div className="view-case-header">
              <div className="view-case-title-group">
                <h1>Case Information</h1>
                <p>View the full details and progress of this case</p>
              </div>
              <Link href="/admin" className="btn-back-home">
                <svg className="btn-back-home-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                ← Back to Home
              </Link>
            </div>

            {isLoading ? (
              <div className="vc-loading">Loading case details…</div>
            ) : (
              <>
                {/* Case Info Card */}
                <div className="case-info-card">
                  <h2 className="case-info-card-title">
                    Case Information
                    {caseNoParam && <span className="case-info-card-subtitle">#{caseNoParam}</span>}
                  </h2>
                  <div className="case-info-grid">
                    <div className="case-info-field">
                      <span className="case-info-label">Case ID</span>
                      <span className="case-info-value">{caseNoParam || letterData?.letterNo || "—"}</span>
                    </div>
                    <div className="case-info-field">
                      <span className="case-info-label">Case Title</span>
                      <span className="case-info-value">{letterData?.subject || caseNoParam || "—"}</span>
                    </div>
                    <div className="case-info-field">
                      <span className="case-info-label">Institute</span>
                      <span className="case-info-value">{letterData?.instituteName || "—"}</span>
                    </div>
                    <div className="case-info-field">
                      <span className="case-info-label">Complain</span>
                      <span className="case-info-value">{letterData?.senderName || "—"}</span>
                    </div>
                    <div className="case-info-field">
                      <span className="case-info-label">Subject Officer</span>
                      <span className="case-info-value">{letterData?.officerName || "—"}</span>
                    </div>
                    <div className="case-info-field">
                      <span className="case-info-label">Last Updated</span>
                      <span className="case-info-value">{letterData?.receivedDate || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Progress Timeline */}
                <div className="vc-section-card">
                  <div className="vc-section-header">
                    <div>
                      <h2 className="vc-section-title">Progress Timeline</h2>
                      <p className="vc-section-subtitle">Track the journey of this case through each stage</p>
                    </div>
                    <span className="vc-step-counter">{currentStep}/{totalSteps}</span>
                  </div>
                  <div className="vc-timeline">
                    {trackingEntries.map((entry) => (
                      <div key={entry.id} className="vc-timeline-item">
                        <div className="vc-timeline-left">
                          <TimelineDot status={entry.status} />
                        </div>
                        <div className="vc-timeline-right">
                          <div className={`vc-timeline-card${entry.status === "Current" ? " card-current" : entry.status === "Pending" ? " card-pending" : ""}`}>
                            <div>
                              <p className="vc-timeline-officer">{entry.officerName}</p>
                              <p className="vc-timeline-name">A.K. Rithnaweera</p>
                              <div className="vc-timeline-meta">
                                <svg className="vc-timeline-clock" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                </svg>
                                <span>{entry.date}&nbsp;&nbsp;{entry.time}</span>
                              </div>
                            </div>
                            <StatusBadge status={entry.status} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tracking History Table */}
                <div className="vc-section-card">
                  <div className="vc-section-header">
                    <div>
                      <h2 className="vc-section-title">Tracking History</h2>
                      <p className="vc-section-subtitle">Check the all movement of the case</p>
                    </div>
                  </div>
                  {trackingEntries.length === 0 ? (
                    <div className="vc-empty-state">No tracking history found for this case.</div>
                  ) : (
                    <div className="vc-table-wrapper">
                      <table className="vc-tracking-table">
                        <thead>
                          <tr>
                            <th>Step</th>
                            <th>Officer</th>
                            <th>Action</th>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trackingEntries.map((entry) => (
                            <tr key={entry.id}>
                              <td><span className="vc-step-badge">{entry.step}</span></td>
                              <td>{entry.officerName}</td>
                              <td>{entry.action}</td>
                              <td>{entry.date}</td>
                              <td>{entry.time}</td>
                              <td><StatusBadge status={entry.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <SiteFooter />
        </main>
      </div>
    </div>
  );
}

export default function AdminViewCasePage() {
  return (
    <Suspense fallback={<div className="page-loading-container"><div>Loading…</div></div>}>
      <AdminViewCaseInner />
    </Suspense>
  );
}
