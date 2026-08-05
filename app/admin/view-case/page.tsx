"use client";

import "../../../i18n";
import "../../daily-mail/daily-mail.css";
import "../../dashboard-common.css";
import "./view-case.css";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sidebar } from "@/components/Sidebar";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getCurrentProfile, dashboardPath } from "@/lib/auth";

const formatStepTaken = (step: string, t: any) => {
  if (!step) return "";
  if (step.startsWith("[EduSecApproval:")) {
    const isApproved = step.includes("EduSecApproval:yes");
    const dateMatch = step.match(/Date:([^\]\s]+)/);
    const dateStr = dateMatch ? dateMatch[1] : "";
    if (isApproved) {
      return `${t("eduSecretaryApproval")}: ${t("yesLabel")} (${t("approvalDate")}: ${dateStr})`;
    } else {
      return `${t("eduSecretaryApproval")}: ${t("noLabel")}`;
    }
  }
  return step;
};

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
  role: string;
  officerName: string;
  action: string;
  date: string;
  time: string;
  sortTs: number;
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [letterData, setLetterData] = useState<LetterData | null>(null);
  const [trackingEntries, setTrackingEntries] = useState<TrackingEntry[]>([]);

  // ── Fetch tracking entries (all sources merged) ─────────────────────
  const fetchTracking = async (caseNo: string) => {
    if (!isSupabaseConfigured || !caseNo) return;

    const raw: Array<{
      id: string; role: string; officerName: string;
      action: string; date: string; sortTs: number;
    }> = [];

    // 1. Daily Mail registrations
    try {
      const { data: mailRows } = await supabase
        .from("dcmms_daily_mail")
        .select("id, received_date, letter_date, officer_name, sender_name, subject, letter_type, status")
        .eq("ref_no", caseNo)
        .order("received_date", { ascending: true });
      if (mailRows) {
        mailRows.forEach((d: any, i: number) => {
          const dateStr = d.received_date || d.letter_date || "";
          raw.push({
            id: `dm-${d.id}`,
            role: "Daily Reporter",
            officerName: d.officer_name || "Daily Mail Officer",
            action: i === 0
              ? `Initial complaint received – ${d.subject || "Letter registered into the system"}`
              : `Subsequent letter registered – ${d.subject || d.sender_name || "Letter received"}`,
            date: dateStr,
            sortTs: dateStr ? new Date(dateStr).getTime() : i,
          });
        });
      }
    } catch (e) { console.error("Failed to fetch daily_mail rows", e); }

    // 2. Subject Officer actions
    try {
      const { data: actionRows } = await supabase
        .from("dcmms_subject_details")
        .select("id, received_date, subject_officer_name, step_taken, report_state")
        .eq("case_no", caseNo)
        .order("received_date", { ascending: true });
      if (actionRows) {
        actionRows.forEach((d: any) => {
          const dateStr = d.received_date || "";
          raw.push({
            id: `so-${d.id}`,
            role: "Subject Officer",
            officerName: d.subject_officer_name || "Subject Officer",
            action: d.step_taken ? formatStepTaken(d.step_taken, t) : `Case update – ${d.report_state || "In Progress"}`,
            date: dateStr,
            sortTs: dateStr ? new Date(dateStr).getTime() : Date.now(),
          });
        });
      }
    } catch (e) { console.error("Failed to fetch subject_details rows", e); }

    if (raw.length === 0) return;

    raw.sort((a, b) => a.sortTs - b.sortTs);

    setTrackingEntries(raw.map((r, idx) => ({
      ...r,
      step: idx + 1,
      time: r.date
        ? new Date(r.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
        : "—",
      status: (idx === raw.length - 1 ? "Current" : "Completed") as TrackingEntry["status"],
    })));
  };

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

        // Build tracking
        if (isSupabaseConfigured) {
          await fetchTracking(caseNoParam);
        }

        // LocalStorage fallback
        if (trackingEntries.length === 0 && typeof window !== "undefined") {
          const storedActions = localStorage.getItem("dcmms_new_letter_current_case");
          if (storedActions) {
            try {
              const list = JSON.parse(storedActions) as any[];
              const filtered = list
                .filter((a) => a.caseNo === caseNoParam)
                .sort((a, b) => new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime());
              setTrackingEntries(filtered.map((a, idx) => ({
                id: a.id || `${idx}`,
                step: idx + 1,
                role: "Subject Officer",
                officerName: a.subjectOfficerName || "Subject Officer",
                action: a.stepTaken || "Letter Registered in to the system",
                date: a.receivedDate || "—",
                time: "—",
                sortTs: a.receivedDate ? new Date(a.receivedDate).getTime() : idx,
                status: (a.reportState === "Closed" ? "Completed" : idx === filtered.length - 1 ? "Current" : "Completed") as TrackingEntry["status"],
              })));
            } catch { /* ignore */ }
          }
        }
      }

      setCheckingAuth(false);
      setIsLoading(false);
    };

    verifyAndFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseNoParam, router]);

  // ── Supabase Realtime & Interval subscription ─────────────────────────────
  useEffect(() => {
    if (!caseNoParam) return;

    let channel: any = null;
    if (isSupabaseConfigured) {
      channel = supabase
        .channel(`tracking-admin-${caseNoParam}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "dcmms_subject_details" },
          async () => {
            setIsRefreshing(true);
            await fetchTracking(caseNoParam);
            setIsRefreshing(false);
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "dcmms_daily_mail" },
          async () => {
            setIsRefreshing(true);
            await fetchTracking(caseNoParam);
            setIsRefreshing(false);
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "dcmms_subject_assignments" },
          async () => {
            setIsRefreshing(true);
            await fetchTracking(caseNoParam);
            setIsRefreshing(false);
          }
        )
        .subscribe();
    }

    const handleLocalUpdate = async () => {
      await fetchTracking(caseNoParam);
    };

    window.addEventListener("storage", handleLocalUpdate);
    window.addEventListener("dcmms_data_updated", handleLocalUpdate);
    window.addEventListener("dcmms_assignment_updated", handleLocalUpdate);

    const interval = setInterval(handleLocalUpdate, 2500);

    return () => {
      if (channel) supabase.removeChannel(channel);
      window.removeEventListener("storage", handleLocalUpdate);
      window.removeEventListener("dcmms_data_updated", handleLocalUpdate);
      window.removeEventListener("dcmms_assignment_updated", handleLocalUpdate);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseNoParam]);

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
                      <h2 className="vc-section-title">
                        Progress Timeline
                        {isSupabaseConfigured && (
                          <span style={{ marginLeft: 10, display: "inline-flex", alignItems: "center", gap: 5, fontSize: "11px", fontWeight: 500, color: "#16a34a", background: "#dcfce7", padding: "2px 8px", borderRadius: 20 }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#16a34a", display: "inline-block", animation: "pulse 1.5s ease-in-out infinite" }} />
                            Live
                          </span>
                        )}
                      </h2>
                      <p className="vc-section-subtitle">
                        Track the journey of this case through each stage
                        {isRefreshing && <span style={{ marginLeft: 8, color: "#6366f1", fontSize: "11px" }}>Refreshing…</span>}
                      </p>
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
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p className="vc-timeline-officer">{entry.role}</p>
                              <p className="vc-timeline-name">{entry.officerName}</p>
                              <p style={{ fontSize: "calc(12px * var(--font-scale))", color: "#475569", margin: "4px 0", wordBreak: "break-word" }}>
                                {entry.action}
                              </p>
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
                            <th>Role</th>
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
                              <td>
                                <span style={{
                                  fontSize: "calc(11px * var(--font-scale))",
                                  fontWeight: 600,
                                  padding: "3px 10px",
                                  borderRadius: 20,
                                  background: entry.role === "Daily Reporter" ? "#eff6ff" : "#f0fdf4",
                                  color: entry.role === "Daily Reporter" ? "#1d4ed8" : "#15803d",
                                }}>{entry.role}</span>
                              </td>
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
