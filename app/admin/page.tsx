"use client";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "../../i18n";
import { useRouter } from "next/navigation";
import { Folder, Search, CheckCircle2, User, ChevronDown } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from "recharts";
import "./admin.css";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { signOut, getCurrentProfile } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CaseRow {
  id: string;
  caseNo: string;
  dateFiled: string;
  subject: string;
  assignedTo: string;
  priority: string;
  status: string;
  type: string;
}

interface OfficerStat {
  name: string;
  role: string;
  count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive a display status from a raw DB status string and case number */
function mapStatus(raw: string, caseNo: string): string {
  const s = (raw || "").toLowerCase();
  if (s.includes("closed")) return "Closed";
  if ((caseNo || "").includes("INQ/")) return "Under Investigation";
  return "Under Subject Officer";
}

/** Heuristic type label from subject text */
function mapType(subject: string): string {
  const s = (subject || "").toLowerCase();
  if (s.includes("forg") || s.includes("attendance")) return "Forgery";
  if (s.includes("assault") || s.includes("harass") || s.includes("misconduct") || s.includes("sport")) return "Assault";
  if (s.includes("theft") || s.includes("inventory")) return "Theft";
  if (s.includes("narco") || s.includes("drug")) return "Narcotics";
  if (s.includes("cyber") || s.includes("data") || s.includes("hack")) return "Cybercrime";
  return "Fraud";
}

/** Build a monthly chart series from an array of ISO date strings */
function buildMonthlyChart(dates: string[]): { name: string; cases: number }[] {
  const now = new Date();
  const months: { name: string; cases: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      name: d.toLocaleString("default", { month: "short" }),
      cases: 0,
    });
  }
  dates.forEach((iso) => {
    const d = new Date(iso);
    const diffMonths =
      (now.getFullYear() - d.getFullYear()) * 12 +
      (now.getMonth() - d.getMonth());
    if (diffMonths >= 0 && diffMonths < 12) {
      months[11 - diffMonths].cases += 1;
    }
  });
  return months;
}

/** Build a daily chart (last 7 days Mon–Sun) */
function buildDailyChart(dates: string[]): { name: string; cases: number }[] {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  dates.forEach((iso) => {
    const d = new Date(iso);
    if (d >= sevenDaysAgo) {
      const day = d.getDay(); // 0=Sun,1=Mon…
      const idx = day === 0 ? 6 : day - 1;
      counts[idx] += 1;
    }
  });
  return days.map((name, i) => ({ name, cases: counts[i] }));
}

/** Build weekly chart (last 8 weeks) */
function buildWeeklyChart(dates: string[]): { name: string; cases: number }[] {
  const weeks: { name: string; cases: number }[] = [];
  for (let i = 7; i >= 0; i--) weeks.push({ name: `W${8 - i}`, cases: 0 });
  const now = new Date();
  dates.forEach((iso) => {
    const d = new Date(iso);
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    const wIdx = Math.floor(diffDays / 7);
    if (wIdx >= 0 && wIdx < 8) weeks[7 - wIdx].cases += 1;
  });
  return weeks;
}

/** Build yearly chart (last 7 calendar years) */
function buildYearlyChart(dates: string[]): { name: string; cases: number }[] {
  const now = new Date();
  const years: { name: string; cases: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    years.push({ name: String(now.getFullYear() - i), cases: 0 });
  }
  dates.forEach((iso) => {
    const yr = String(new Date(iso).getFullYear());
    const entry = years.find((y) => y.name === yr);
    if (entry) entry.cases += 1;
  });
  return years;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { t } = useTranslation();
  const router = useRouter();

  const [chartPeriod, setChartPeriod] = useState("Monthly");
  const [greeting, setGreeting] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Dashboard filter states
  const [selectedType, setSelectedType] = useState("All types");
  const [selectedStatus, setSelectedStatus] = useState("All statuses");
  const [searchQuery, setSearchQuery] = useState("");

  // Live data from Supabase
  const [allCases, setAllCases] = useState<{ type: string; status: string }[]>([]);
  const [recentCases, setRecentCases] = useState<CaseRow[]>([]);
  const [caseDates, setCaseDates] = useState<string[]>([]);
  const [officerStats, setOfficerStats] = useState<OfficerStat[]>([]);

  // ── Session guard ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) router.replace("/");
    });
  }, [router]);

  // ── Greeting ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const hour = new Date().getHours();
    let greetingKey = "greetingMorning";
    if (hour >= 12 && hour < 17) greetingKey = "greetingAfternoon";
    else if (hour >= 17 || hour < 5) greetingKey = "greetingEvening";

    const loadGreeting = async () => {
      let displayName = t("adminName", "Aruni");
      if (isSupabaseConfigured) {
        const prof = await getCurrentProfile();
        if (prof) {
          displayName = prof.full_name;
        }
      }
      const firstName = displayName.split(" ")[0];
      setGreeting(`${t(greetingKey, "Good Morning")}, ${firstName}!`);
    };
    loadGreeting();
  }, [t]);

  // ── Fetch live data from Supabase ──────────────────────────────────────────
  useEffect(() => {
    const fetchCases = async () => {
      setIsLoading(true);
      try {
        if (!isSupabaseConfigured) {
          setIsLoading(false);
          return;
        }

        let mapped: CaseRow[] = [];

        // ── Cases query (may fail if table doesn't exist yet) ──
        try {
          const { data, error } = await supabase
            .from("dcmms_subject")
            .select("id, case_no, assigned_date, created_at, subject, priority, status")
            .order("created_at", { ascending: false });

          if (error) throw error;

          // Build a lookup map from dcmms_daily_mail to resolve which officer is assigned
          const { data: letterLookup } = await supabase
            .from("dcmms_daily_mail")
            .select("ref_no, officer_name");
          const officerMap: Record<string, string> = {};
          if (letterLookup) {
            letterLookup.forEach((l: any) => {
              if (l.ref_no && l.officer_name) officerMap[l.ref_no] = l.officer_name;
            });
          }

          if (data && data.length > 0) {
            mapped = data.map((c: any) => ({
              id: c.id,
              caseNo: c.case_no || c.id,
              dateFiled: (c.assigned_date || c.created_at || "").slice(0, 10),
              subject: c.subject || "",
              assignedTo: officerMap[c.case_no] || "—",
              priority: c.priority
                ? c.priority.charAt(0).toUpperCase() + c.priority.slice(1)
                : "Medium",
              status: mapStatus(c.status, c.case_no || c.id),
              type: mapType(c.subject),
            }));

            setAllCases(mapped.map((m) => ({ type: m.type, status: m.status })));
            setRecentCases(mapped.slice(0, 10));
            setCaseDates(
              data.map((c: any) => (c.created_at || c.assigned_date || "")).filter(Boolean)
            );
          }
        } catch (caseErr) {
          console.error("Failed to load cases from Supabase", caseErr);
        }

        // ── Officer stats query (independent of cases) ──
        try {
          const { data: profiles } = await supabase.from("dcmms_profiles").select("*");
          const { data: lettersData } = await supabase.from("dcmms_daily_mail").select("officer_name");

          if (profiles) {
            const stats: OfficerStat[] = profiles.map((p: any) => {
              let count = 0;
              if (p.role === "subject_officer") {
                count = (lettersData || []).filter((l: any) => l.officer_name === p.full_name).length;
              } else if (p.role === "investigation_officer") {
                count = mapped.filter((c) => c.assignedTo === p.full_name).length;
              }
              return { name: p.full_name, role: p.role, count };
            });
            setOfficerStats(stats);
          }
        } catch (officerErr) {
          console.error("Failed to load officer stats from Supabase", officerErr);
        }
      } catch (err) {
        console.error("Dashboard data load error", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCases();

    // Subscribe to real-time updates from Supabase
    const channel = supabase
      .channel("admin-realtime-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_subject" }, fetchCases)
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_daily_mail" }, fetchCases)
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_profiles" }, fetchCases)
      .subscribe();

    // Fallback: auto-refresh every 5 seconds in case Realtime is not enabled/blocked
    const interval = setInterval(fetchCases, 5_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const activeCases = allCases.filter(
    (c) =>
      (selectedType === "All types" || c.type === selectedType) &&
      (selectedStatus === "All statuses" || c.status === selectedStatus)
  );

  const totalCasesCount = activeCases.length;
  const underInvestigationCount = activeCases.filter((c) => c.status === "Under Investigation").length;
  const closedCount = activeCases.filter((c) => c.status === "Closed").length;
  const underSubjectOfficerCount = activeCases.filter((c) => c.status === "Under Subject Officer").length;

  const pct = (n: number) =>
    totalCasesCount > 0 ? `${Math.round((n / totalCasesCount) * 100)}%` : "0%";

  // ── Chart data ─────────────────────────────────────────────────────────────
  const chartDataMap: Record<string, { name: string; cases: number }[]> = {
    Daily: buildDailyChart(caseDates),
    Weekly: buildWeeklyChart(caseDates),
    Monthly: buildMonthlyChart(caseDates),
    Yearly: buildYearlyChart(caseDates),
  };
  const chartData = chartDataMap[chartPeriod];

  // Apply filter ratio to chart when filters active
  const filterRatio = allCases.length > 0 ? activeCases.length / allCases.length : 1;
  const filteredChartData = chartData.map((item) => ({
    ...item,
    cases: Math.round(
      item.cases * (selectedType === "All types" && selectedStatus === "All statuses" ? 1 : filterRatio)
    ),
  }));

  // ── Status / Type pie/bar data ─────────────────────────────────────────────
  const dynamicStatusData = [
    { name: "Under Investigation", value: underInvestigationCount, color: "#6366f1" },
    { name: "Closed", value: closedCount, color: "#10b981" },
    { name: "Under Subject Officer", value: underSubjectOfficerCount, color: "#f59e0b" },
  ];

  const typeNames = ["Fraud", "Cybercrime", "Assault", "Theft", "Narcotics", "Forgery"];
  const typeColors = ["#6366f1", "#8b5cf6", "#0ea5e9", "#f59e0b", "#10b981", "#3b82f6"];
  const dynamicTypeData = typeNames.map((name, i) => ({
    name,
    value: activeCases.filter((c) => c.type === name).length,
    color: typeColors[i],
  }));

  // ── Filtered recent cases table ────────────────────────────────────────────
  const filteredRecentCases = recentCases.filter((c) => {
    const matchesType = selectedType === "All types" || c.type === selectedType;
    const matchesStatus = selectedStatus === "All statuses" || c.status === selectedStatus;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      c.caseNo.toLowerCase().includes(q) ||
      c.subject.toLowerCase().includes(q) ||
      c.assignedTo.toLowerCase().includes(q);
    return matchesType && matchesStatus && matchesSearch;
  });

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut();
    router.push("/");
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="admin-dashboard-container">
      {/* Header section */}
      <div className="admin-dashboard-header">
        <div>
          <h3 className="admin-dashboard-title1">{t("dashboard", "Dashboard")}</h3>
          <h2 className="admin-dashboard-title">{greeting}</h2>
          <p className="admin-dashboard-subtitle">
            {isLoading
              ? t("loadingData", "Loading data…")
              : t("adminSubtitle", "{{count}} total cases", { count: totalCasesCount })}
          </p>
        </div>
        <div className="admin-filters-container">
          <div className="admin-filter-wrapper">
            <select
              aria-label="Filter by case type"
              className="admin-filter-select"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="All types">{t("allTypes", "All types")}</option>
              <option value="Fraud">{t("typeFraud", "Fraud")}</option>
              <option value="Cybercrime">{t("typeCybercrime", "Cybercrime")}</option>
              <option value="Assault">{t("typeAssault", "Assault")}</option>
              <option value="Theft">{t("typeTheft", "Theft")}</option>
              <option value="Narcotics">{t("typeNarcotics", "Narcotics")}</option>
              <option value="Forgery">{t("typeForgery", "Forgery")}</option>
            </select>
            <div className="admin-filter-icon"><ChevronDown /></div>
          </div>
          <div className="admin-filter-wrapper">
            <select
              aria-label="Filter by status"
              className="admin-filter-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="All statuses">{t("allStatuses", "All statuses")}</option>
              <option value="Under Investigation">{t("statusUnderInvestigation", "Under Investigation")}</option>
              <option value="Closed">{t("statusClosed", "Closed")}</option>
              <option value="Under Subject Officer">{t("statusUnderSubjectOfficer", "Under Subject Officer")}</option>
            </select>
            <div className="admin-filter-icon"><ChevronDown /></div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="admin-stats-grid">
        <StatCard
          title={t("totalCases", "TOTAL CASES")}
          value={isLoading ? "…" : totalCasesCount.toString()}
          percentage="100%"
          icon={<Folder className="premium-card-icon" />}
          cardClass="total-cases-card"
          sparklineD="M 5,22 Q 25,10 45,20 T 75,8 T 95,15"
        />
        <StatCard
          title={t("underInvestigation", "UNDER INVESTIGATION")}
          value={isLoading ? "…" : underInvestigationCount.toString()}
          percentage={isLoading ? "…" : pct(underInvestigationCount)}
          icon={<Search className="premium-card-icon" />}
          cardClass="inprogress-cases-card"
          sparklineD="M 5,20 Q 25,25 45,12 T 75,5 T 95,15"
        />
        <StatCard
          title={t("closed", "CLOSED")}
          value={isLoading ? "…" : closedCount.toString()}
          percentage={isLoading ? "…" : pct(closedCount)}
          icon={<CheckCircle2 className="premium-card-icon" />}
          cardClass="closed-cases-card"
          sparklineD="M 5,25 Q 25,20 45,8 T 75,5 T 95,12"
        />
        <StatCard
          title={t("underSubjectOfficer", "UNDER SUBJECT OFFICER")}
          value={isLoading ? "…" : underSubjectOfficerCount.toString()}
          percentage={isLoading ? "…" : pct(underSubjectOfficerCount)}
          icon={<User className="premium-card-icon" />}
          cardClass="pending-cases-card"
          sparklineD="M 5,15 Q 25,8 45,22 T 75,12 T 95,25"
        />
      </div>

      {/* Chart Section */}
      <div className="admin-chart-card">
        <div className="admin-chart-header">
          <div>
            <h3 className="admin-chart-title">{t("casesOverTime", "Cases over time")}</h3>
            <p className="admin-chart-subtitle">{t("newCasesPerPeriod", "New cases per period")}</p>
          </div>
          <div className="admin-chart-filters">
            {["Daily", "Weekly", "Monthly", "Yearly"].map((period) => (
              <button
                key={period}
                className={chartPeriod === period ? "admin-chart-filter-btn-active" : "admin-chart-filter-btn"}
                onClick={() => setChartPeriod(period)}
              >
                {t(period.toLowerCase(), period)}
              </button>
            ))}
          </div>
        </div>
        <div className="admin-chart-wrapper">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="caseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.3} />
                  <stop offset="50%" stopColor="#818CF8" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#C7D2FE" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} cursor={{ stroke: "#E5E7EB", strokeWidth: 1, strokeDasharray: "5 5" }} />
              <Area type="monotone" dataKey="cases" stroke="#4F46E5" strokeWidth={3} fill="url(#caseGradient)" dot={false} activeDot={{ r: 6, fill: "#4F46E5", stroke: "#fff", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Secondary Charts */}
      <div className="admin-secondary-charts-grid">
        {/* Status Distribution */}
        <div className="admin-chart-card">
          <h3 className="admin-secondary-chart-title">{t("statusDistribution", "Status distribution")}</h3>
          <div className="admin-pie-chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dynamicStatusData} cx="50%" cy="45%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" stroke="none">
                  {dynamicStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" formatter={(value) => <span className="admin-legend-label">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cases by Type */}
        <div className="admin-chart-card">
          <h3 className="admin-secondary-chart-title">{t("casesByType", "Cases by type")}</h3>
          <div className="admin-bar-chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dynamicTypeData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} allowDecimals={false} />
                <Tooltip cursor={{ fill: "#F3F4F6" }} contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {dynamicTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Officer Workload Section */}
      <section className="letters-list-section" style={{ marginTop: "32px" }}>
        <div className="letters-list-header">
          <h3 className="section-title">
            <svg className="admin-section-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>{t("officerWorkload", "Officer Workload")}</span>
          </h3>
        </div>
        <div className="table-responsive-container">
          <table className="letters-data-table">
            <thead>
              <tr>
                <th scope="col">{t("officerName", "Officer Name")}</th>
                <th scope="col">{t("role", "Role")}</th>
                <th scope="col" style={{ textAlign: "right" }}>{t("assignedLetters", "Assigned Cases / Letters")}</th>
              </tr>
            </thead>
            <tbody>
              {officerStats.length > 0 ? (
                officerStats.map((stat, idx) => (
                  <tr key={idx} className="letter-table-row">
                    <td className="font-semibold">{stat.name}</td>
                    <td>
                      {stat.role === "subject_officer"
                        ? t("roleSubjectOfficer", "Subject Officer")
                        : stat.role === "investigation_officer"
                        ? t("roleInvestigationOfficer", "Investigation Officer")
                        : t("roleDailyMail", "Daily Mail Officer")}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {stat.role === "daily_mail" ? "—" : (
                        <span className="badge-badge badge-priority-high" style={{ minWidth: "40px", display: "inline-block", textAlign: "center" }}>
                          {stat.count}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="admin-table-no-data">
                    {isLoading ? t("loadingData", "Loading data from database…") : t("noOfficersFound", "No officers found.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {/* Recent Cases Section */}
      <section className="letters-list-section">
        <div className="letters-list-header">
          <h3 className="section-title">
            <svg className="admin-section-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>{t("recentCases", "Recent Cases")}</span>
          </h3>
          <div className="letters-filters-group">
            <div className="search-box">
              <svg className="admin-search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder={t("searchCasesPlaceholder", "Search cases…")}
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <a
              href="#"
              className="view-all-reset-link"
              onClick={(e) => {
                e.preventDefault();
                setSelectedType("All types");
                setSelectedStatus("All statuses");
                setSearchQuery("");
              }}
            >
              {t("viewAll", "View All")} <span className="arrow-span">→</span>
            </a>
          </div>
        </div>

        <div className="table-responsive-container">
          <table className="letters-data-table">
            <thead>
              <tr>
                <th scope="col">{t("caseNo", "Case No")}</th>
                <th scope="col">{t("dateFiled", "Date Filed")}</th>
                <th scope="col">{t("subjectText", "Subject")}</th>
                <th scope="col">{t("assignedTo", "Assigned To")}</th>
                <th scope="col">{t("priority", "Priority")}</th>
                <th scope="col">{t("status", "Status")}</th>
                <th scope="col" className="admin-table-header-center">{t("action", "Action")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="admin-table-no-data">
                    {t("loadingData", "Loading data from database…")}
                  </td>
                </tr>
              ) : filteredRecentCases.length > 0 ? (
                filteredRecentCases.map((item) => (
                  <tr key={item.id} className="letter-table-row">
                    <td className="admin-table-case-no">{item.caseNo}</td>
                    <td>{item.dateFiled}</td>
                    <td className="subject-cell">{item.subject}</td>
                    <td>{item.assignedTo}</td>
                    <td>
                      <span
                        className={`badge-badge ${
                          item.priority === "High"
                            ? "badge-priority-high"
                            : item.priority === "Medium"
                            ? "badge-priority-medium"
                            : "badge-priority-low"
                        }`}
                      >
                        {item.priority === "High"
                          ? t("priorityHigh", "High")
                          : item.priority === "Medium"
                          ? t("priorityMedium", "Medium")
                          : t("priorityLow", "Low")}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge-badge ${
                          item.status === "Under Investigation"
                            ? "badge-status-inprogress"
                            : item.status === "Closed"
                            ? "badge-status-closed"
                            : "badge-status-pending"
                        }`}
                      >
                        {item.status === "Under Investigation"
                          ? t("statusUnderInvestigation", "Under Investigation")
                          : item.status === "Closed"
                          ? t("statusClosed", "Closed")
                          : t("statusUnderSubjectOfficer", "Under Subject Officer")}
                      </span>
                    </td>
                    <td className="admin-table-cell-center">
                      <a href={`/admin/view-case?caseNo=${item.caseNo}`} className="add-details-link">{t("view", "View")}</a>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="admin-table-no-data">
                    {allCases.length === 0
                      ? t("noCasesInDatabase", "No cases found in the database yet.")
                      : t("noCasesMatchFilters", "No cases match the selected filters.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ─── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({
  title,
  value,
  percentage,
  icon,
  cardClass,
  sparklineD,
}: {
  title: string;
  value: string;
  percentage: string;
  icon: React.ReactNode;
  cardClass: string;
  sparklineD: string;
}) {
  return (
    <div className={`premium-stat-card ${cardClass}`}>
      <div className="premium-card-top">
        <div className="premium-card-title-area">
          {icon}
          <span>{title}</span>
        </div>
        <span className="premium-card-percentage">{percentage}</span>
      </div>
      <div className="premium-card-bottom">
        <div className="premium-card-value-area">
          <span className="premium-card-value">{value}</span>
          <span className="premium-card-label">cases</span>
        </div>
        <div className="premium-card-sparkline">
          <svg viewBox="0 0 100 30" width="80" height="24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d={sparklineD} strokeLinecap="round" />
            <circle cx="75" cy="8" r="3" fill="#ffffff" />
          </svg>
        </div>
      </div>
    </div>
  );
}
