"use client";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "../../i18n";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Folder, Search, CheckCircle2, User, ChevronDown, ChevronUp, Plus, MailCheck, Mail, FileText, BarChart2, SlidersHorizontal, X, Landmark, ArrowRight, Bell, Send } from "lucide-react";
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
import { signOut, getCurrentProfile, dashboardPath, getAddLetterButtonLabel } from "@/lib/auth";
import {
  getDailyMailRecordsServer,
  getLetterEditRequestsServer,
  updateLetterEditRequestStatusServer,
  getDirectlyAssignedLettersServer,
  getLettersForwardedToSeniorServer,
  createOfficerNotificationServer,
} from "@/lib/db-actions";
import { exportToExcel } from "@/lib/export-excel";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

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

/** Derive the officer role label from letter metadata */
function getLetterOfficerRole(letter: any, lang: string = "si"): string {
  const roleRaw = (letter.created_by_role || letter.createdByRole || "").toLowerCase().trim();
  const creator = (letter.created_by_name || "").toLowerCase().trim();
  const addrRole = (letter.addressedRole || letter.addressed_role || "").toLowerCase().trim();

  // 1. Direct role string match
  if (roleRaw.includes("discipline")) {
    return lang === "si" ? "සහකාර ලේකම් (විනය)" : lang === "ta" ? "உதவிச் செயலாளர் (ஒழுக்கம்)" : "Assistant Secretary (Discipline)";
  }
  if (roleRaw.includes("investigation") && (roleRaw.includes("assistant") || roleRaw.includes("sec"))) {
    return lang === "si" ? "සහකාර ලේකම් (විමර්ශන)" : lang === "ta" ? "உதவிச் செயலாளர் (விசாரணை)" : "Assistant Secretary (Investigation)";
  }
  if (roleRaw.includes("assistant") || roleRaw.includes("asst")) {
    return lang === "si" ? "සහකාර ලේකම්" : lang === "ta" ? "உதவிச் செயலாளர்" : "Assistant Secretary";
  }
  if (roleRaw.includes("senior")) {
    return lang === "si" ? "ජ්‍යෙෂ්ඨ සහකාර ලේකම්" : lang === "ta" ? "மூத்த உதவிச் செயலாளர்" : "Senior Assistant Secretary";
  }
  if (roleRaw.includes("daily") || roleRaw.includes("mail")) {
    return lang === "si" ? "දෛනික තැපැල් නිලධාරී" : lang === "ta" ? "தினசரி அஞ்சல் அதிகாரி" : "Daily Mail Officer";
  }
  if (roleRaw.includes("additional")) {
    return lang === "si" ? "අතිරේක ලේකම්" : lang === "ta" ? "கூடுதல் செயலாளர்" : "Additional Secretary";
  }

  // 2. Creator officer name match
  if (creator.includes("bandula")) {
    return lang === "si" ? "සහකාර ලේකම්" : lang === "ta" ? "உதவிச் செயலாளர்" : "Assistant Secretary";
  }
  if (creator.includes("ranjith")) {
    return lang === "si" ? "සහකාර ලේකම්" : lang === "ta" ? "உதவிச் செயலாளர்" : "Assistant Secretary";
  }
  if (creator.includes("dharshana")) {
    return lang === "si" ? "ජ්‍යෙෂ්ඨ සහකාර ලේකම්" : lang === "ta" ? "மூத்த உதவிச் செயலாளர்" : "Senior Assistant Secretary";
  }
  if (creator.includes("nihal")) {
    return lang === "si" ? "අතිරේක ලේකම්" : lang === "ta" ? "கூடுதல் செயலாளர்" : "Additional Secretary";
  }
  if (creator.includes("daily mail")) {
    return lang === "si" ? "දෛනික තැපැල් නිලධාරී" : lang === "ta" ? "தினசரி அஞ்சல் அதிகாரி" : "Daily Mail Officer";
  }

  // 3. Addressed officer role match
  if (addrRole.includes("discipline")) {
    return lang === "si" ? "සහකාර ලේකම්" : lang === "ta" ? "உதவிச் செயலாளர்" : "Assistant Secretary";
  }
  if (addrRole.includes("investigation") && (addrRole.includes("assistant") || addrRole.includes("sec"))) {
    return lang === "si" ? "සහකාර ලේකම්" : lang === "ta" ? "உதவிச் செயலாளர்" : "Assistant Secretary";
  }
  if (addrRole.includes("assistant") || addrRole.includes("asst")) {
    return lang === "si" ? "සහකාර ලේකම්" : lang === "ta" ? "உதவிச் செயலாளர்" : "Assistant Secretary";
  }
  if (addrRole.includes("senior")) {
    return lang === "si" ? "ජ්‍යෙෂ්ඨ සහකාර ලේකම්" : lang === "ta" ? "மூத்த உதவிச் செயலாளர்" : "Senior Assistant Secretary";
  }
  if (addrRole.includes("additional")) {
    return lang === "si" ? "අතිරේක ලේකම්" : lang === "ta" ? "கூடுதல் செயலாளர்" : "Additional Secretary";
  }

  // 4. Formatted raw role fallback
  if (roleRaw) {
    return roleRaw.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  }

  if (letter.isForwarded) {
    return lang === "si" ? "සහකාර ලේකම්" : "Assistant Secretary";
  }
  return lang === "si" ? "දෛනික තැපැල් නිලධාරී" : "Daily Mail Officer";
}

function AdminDashboardContent() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightLetterNo = searchParams?.get("highlight") || searchParams?.get("id") || "";

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
  const [casesTab, setCasesTab] = useState<"all" | "additional_secretary">("all");

  // Pending Letter Edit Approval Requests state
  const [pendingEditRequests, setPendingEditRequests] = useState<any[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  // Directly Assigned Letters from Daily Mail
  const [directlyAssignedLetters, setDirectlyAssignedLetters] = useState<any[]>([]);
  const [isDirectLettersMinimized, setIsDirectLettersMinimized] = useState(false);
  const [assignedLettersSearchQuery, setAssignedLettersSearchQuery] = useState("");
  const [assignedLettersFilter, setAssignedLettersFilter] = useState<"all" | "direct" | "forwarded">("all");

  // ── Letters forwarded TO Senior Assistant Secretary BY Additional Secretary ──
  const [seniorSecLetters, setSeniorSecLetters] = useState<any[]>([]);
  const [isSeniorLettersMinimized, setIsSeniorLettersMinimized] = useState(false);
  const [seniorLettersSearch, setSeniorLettersSearch] = useState("");
  const [seniorLettersNewCount, setSeniorLettersNewCount] = useState(0);
  const [showSeniorNotifBell, setShowSeniorNotifBell] = useState(false);

  // Visualization Charts Slide Bar & Collapsible state
  const [isChartSlideBarOpen, setIsChartSlideBarOpen] = useState(false);
  const [isChartsExpanded, setIsChartsExpanded] = useState(false);

  // Close chart slide bar on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isChartSlideBarOpen) {
        setIsChartSlideBarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isChartSlideBarOpen]);

  // ── Session guard & Data Loader ───────────────────────────────────────────
  useEffect(() => {
    setIsMounted(true);
    try {
      const sim = localStorage.getItem("dcmms_simulated_session");
      if (sim) {
        setCurrentUserProfile(JSON.parse(sim));
      } else {
        const r = localStorage.getItem("dcmms_user_role");
        if (r) setCurrentUserProfile({ role: r, full_name: localStorage.getItem("dcmms_username") || "User" });
      }
    } catch {}

    getCurrentProfile().then(async (profile) => {
      const allowedRoles = [
        "admin",
        "assistant_secretary_discipline",
        "senior_assistant_secretary",
        "additional_secretary",
        "chief_clerk",
        "assistant_secretary_investigation",
        "system_admin"
      ];
      if (!profile) {
        router.replace("/");
        return;
      }
      if (!allowedRoles.includes(profile.role)) {
        const target = dashboardPath(profile.role);
        if (target && target !== "/admin" && target !== "/") {
          router.replace(target);
        } else {
          router.replace("/?reason=unauthorized");
        }
        return;
      }
      setCurrentUserProfile(profile);

      // Load directly assigned letters for this Secretary / Admin
      if (profile) {
        try {
          const directRes = await getDirectlyAssignedLettersServer(profile.full_name, profile.role);
          if (directRes && directRes.success && Array.isArray(directRes.data)) {
            setDirectlyAssignedLetters(directRes.data);
          }
        } catch (e) {
          console.warn("Failed to load directly assigned letters in Admin:", e);
        }

        // ── For Senior Assistant Secretary: load letters forwarded by Additional Secretary ──
        const isSenior =
          profile.role === "senior_assistant_secretary" ||
          (profile.role || "").toLowerCase().includes("senior");
        if (isSenior) {
          try {
            const seniorRes = await getLettersForwardedToSeniorServer();
            if (seniorRes && seniorRes.success && Array.isArray(seniorRes.data)) {
              setSeniorSecLetters(seniorRes.data);
              // Determine truly new letters (not yet seen)
              const seenKey = "dcmms_senior_seen_letters";
              let seenIds: string[] = [];
              try { seenIds = JSON.parse(localStorage.getItem(seenKey) || "[]"); } catch {}
              const newOnes = seniorRes.data.filter((l: any) => !seenIds.includes(l.id));
              setSeniorLettersNewCount(newOnes.length);
              setShowSeniorNotifBell(newOnes.length > 0);
              // Send a notification to Senior's notification panel for each new letter
              if (newOnes.length > 0 && profile.full_name) {
                for (const nl of newOnes.slice(0, 3)) {
                  try {
                    await createOfficerNotificationServer({
                      targetOfficerName: profile.full_name,
                      targetRole: "senior_assistant_secretary",
                      letterNo: nl.letterNo || nl.refNo,
                      type: "letter_forwarded",
                      title: "New Letter from Additional Secretary",
                      message: `Letter ${nl.letterNo || nl.refNo} from "${nl.sender}" has been forwarded to you by ${nl.createdByName || "Additional Secretary"} for review and action.`,
                      senderName: nl.createdByName || "Additional Secretary",
                    });
                  } catch {}
                }
                window.dispatchEvent(new Event("dcmms_notifications_updated"));
              }
            }
          } catch (e) {
            console.warn("Failed to load senior secretary letters:", e);
          }
        }
      }
    });
  }, [router]);

  // ── Fetch Pending Letter Edit Approval Requests ───────────────────────────
  const fetchPendingEditRequests = async () => {
    try {
      setIsLoadingRequests(true);
      const res = await getLetterEditRequestsServer({ status: "Pending" });
      if (res && res.success && Array.isArray(res.data)) {
        setPendingEditRequests(res.data);
      }
    } catch (e) {
      console.warn("Failed to fetch pending edit requests:", e);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  const handleApproveRequest = async (requestId: string, refNo: string) => {
    try {
      const adminName = currentUserProfile?.full_name || "Branch Administrator";
      const res = await updateLetterEditRequestStatusServer({
        requestId,
        status: "Approved",
        reviewed_by: adminName,
        reviewer_comments: "Approved via Admin Dashboard",
      });
      if (res && res.success) {
        setPendingEditRequests((prev) => prev.filter((r) => r.id !== requestId));
        setToastMessage(`✓ Request for "${refNo}" approved. Officer can now edit the form.`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
      } else {
        alert(res?.error || "Failed to approve request");
      }
    } catch (e: any) {
      alert("Error approving request: " + (e?.message || "Server error"));
    }
  };

  const handleRejectRequest = async (requestId: string, refNo: string) => {
    const reason = prompt("Reason for rejection (optional):") || "";
    try {
      const adminName = currentUserProfile?.full_name || "Branch Administrator";
      const res = await updateLetterEditRequestStatusServer({
        requestId,
        status: "Rejected",
        reviewed_by: adminName,
        reviewer_comments: reason,
      });
      if (res && res.success) {
        setPendingEditRequests((prev) => prev.filter((r) => r.id !== requestId));
        setToastMessage(`Edit request for "${refNo}" rejected.`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
      } else {
        alert(res?.error || "Failed to reject request");
      }
    } catch (e: any) {
      alert("Error rejecting request: " + (e?.message || "Server error"));
    }
  };

  // ── Greeting ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const hour = new Date().getHours();
    let greetingKey = "greetingMorning";
    if (hour >= 12 && hour < 17) greetingKey = "greetingAfternoon";
    else if (hour >= 17 || hour < 5) greetingKey = "greetingEvening";

    const loadGreeting = async () => {
      let displayName = t("adminName", "Administrator");
      const prof = await getCurrentProfile();
      if (prof && prof.full_name) {
        displayName = prof.full_name;
      }
      const defaultText = hour >= 12 && hour < 17 ? "Good Afternoon" : hour >= 17 || hour < 5 ? "Good Evening" : "Good Morning";
      const timeGreeting = t(greetingKey, defaultText);
      setGreeting(`${timeGreeting}, ${displayName}!`);
    };
    loadGreeting();
    fetchPendingEditRequests();
  }, [t]);

  // ── Fetch live data from Supabase ──────────────────────────────────────────
  useEffect(() => {
    const fetchCases = async (isSilent = false) => {
      if (!isSilent) setIsLoading(true);
      try {

        let mapped: CaseRow[] = [];


        // ── Cases & Mail letters query ──
        try {
          let letters: any[] = [];
          try {
            const mailRes = await getDailyMailRecordsServer();
            if (mailRes && mailRes.success && Array.isArray(mailRes.data)) {
              letters = mailRes.data;
            }
          } catch (e) {
            console.warn("getDailyMailRecordsServer in fetchCases warning:", e);
          }

          if (letters.length === 0) {
            try {
              const mailApiRes = await fetch(`${basePath}/api/daily-mail`).then((r) => r.json()).catch(() => null);
              if (mailApiRes && mailApiRes.success && Array.isArray(mailApiRes.data)) {
                letters = mailApiRes.data;
              }
            } catch (e) {
              console.warn("/api/daily-mail fetch in fetchCases warning:", e);
            }
          }

          if (letters && letters.length > 0) {
            mapped = letters.map((c: any) => ({
              id: String(c.id),
              caseNo: c.serial_no || c.letter_no || String(c.id),
              dateFiled: c.received_date || c.submitted_date || (c.created_at ? String(c.created_at).slice(0, 10) : ""),
              subject: c.subject || "N/A",
              assignedTo: c.action_officer || c.officer_name || "Unassigned",
              priority: c.priority
                ? String(c.priority).charAt(0).toUpperCase() + String(c.priority).slice(1)
                : "Medium",
              status: c.status === "registered" ? "Under Subject Officer" : mapStatus(c.status || "", c.serial_no || String(c.id)),
              type: mapType(c.subject || ""),
            }));

            setAllCases(mapped.map((m) => ({ type: m.type, status: m.status })));
            setRecentCases(mapped.slice(0, 10));
            setCaseDates(
              letters.map((c: any) => (c.created_at || c.received_date || "")).filter(Boolean)
            );
          }
        } catch (caseErr) {
          console.error("Failed to load cases from database", caseErr);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_subject_assignments" }, fetchCases)
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_subject_details" }, fetchCases)
      .subscribe();

    const handleLocalUpdate = () => fetchCases(true);
    window.addEventListener("storage", handleLocalUpdate);
    window.addEventListener("dcmms_data_updated", handleLocalUpdate);
    window.addEventListener("dcmms_assignment_updated", handleLocalUpdate);

    // Background auto-refresh every 15 seconds silently (no UI flickering)
    const interval = setInterval(() => fetchCases(true), 15000);


    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("storage", handleLocalUpdate);
      window.removeEventListener("dcmms_data_updated", handleLocalUpdate);
      window.removeEventListener("dcmms_assignment_updated", handleLocalUpdate);
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

  // ── Helper to check if a case is assigned or forwarded to Additional Secretary ──
  const isAssignedToAddSec = (officer: string) => {
    const o = (officer || "").toLowerCase();
    return o.includes("nihal") || o.includes("additional") || o.includes("daily mail");
  };

  // ── Filtered recent cases table ────────────────────────────────────────────
  const filteredRecentCases = recentCases.filter((c) => {
    if (isMounted && currentUserProfile?.role === "additional_secretary" && casesTab === "additional_secretary") {
      if (!isAssignedToAddSec(c.assignedTo)) return false;
    }
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
          <button
            type="button"
            className="btn-analytics-slidebar-trigger"
            onClick={() => setIsChartSlideBarOpen(true)}
            title={t("viewAnalyticsCharts", "Analytics & Charts")}
          >
            <BarChart2 size={16} />
            <span>{t("viewAnalyticsCharts", "Analytics & Charts")}</span>
          </button>
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
          title={t("underSubjectOfficer", "UNDER SUBJECT OFFICER")}
          value={isLoading ? "…" : underSubjectOfficerCount.toString()}
          percentage={isLoading ? "…" : pct(underSubjectOfficerCount)}
          icon={<User className="premium-card-icon" />}
          cardClass="pending-cases-card"
          sparklineD="M 5,15 Q 25,8 45,22 T 75,12 T 95,25"
        />
        <StatCard
          title={t("closed", "CLOSED")}
          value={isLoading ? "…" : closedCount.toString()}
          percentage={isLoading ? "…" : pct(closedCount)}
          icon={<CheckCircle2 className="premium-card-icon" />}
          cardClass="closed-cases-card"
          sparklineD="M 5,25 Q 25,20 45,8 T 75,5 T 95,12"
        />
      </div>

      {/* ── Quick Action / Add New Letter & Complaint Hero Banner ── */}
      <section className="admin-hero-banner-section">
        <div className="admin-hero-card">
          <div className="admin-hero-left">
            <div className="admin-hero-icon-badge">
              <svg style={{ width: "26px", height: "26px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h4 className="admin-hero-title" suppressHydrationWarning>
                {isMounted && currentUserProfile?.role === "additional_secretary"
                  ? t("registerComplaintDetailed", "Full Complaint Registration")
                  : t("addNewLetterTitle", "Add New Letter")}
              </h4>
              <p className="admin-hero-subtitle" suppressHydrationWarning>
                {isMounted && currentUserProfile?.role === "additional_secretary"
                  ? (lang === "si"
                      ? "අතිරේක ලේකම් ලෙස නව පැමිණිලි සවිස්තරාත්මකව පද්ධතියට ලියාපදිංචි කර විනය ශාඛාවේ නිලධාරීන් වෙත යොමු කරන්න."
                      : "As Additional Secretary, register full incoming complaints directly into the system.")
                  : t("addNewLetterSubtitle", "Fill in the basic incoming letter details to register it into the system.")}
              </p>
            </div>
          </div>

          <div className="admin-hero-actions" style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }} suppressHydrationWarning>
            {isMounted && currentUserProfile?.role === "additional_secretary" ? (
              <button
                type="button"
                className="btn-hero-primary"
                onClick={() => router.push("/daily-mail/register")}
              >
                <FileText size={18} strokeWidth={2.4} />
                <span>{t("registerComplaintDetailed", "Full Complaint Registration")}</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn-hero-primary"
                onClick={() => router.push("/daily-mail/add-letter")}
              >
                <Plus size={18} strokeWidth={2.8} />
                <span suppressHydrationWarning>{getAddLetterButtonLabel(isMounted ? currentUserProfile?.role : undefined, isMounted ? currentUserProfile?.raw_role : undefined, t)}</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Assigned & Forwarded Letters Section ── */}
      {(() => {
        if (directlyAssignedLetters.length === 0) return null;

        const isAddSec = isMounted && currentUserProfile?.role === "additional_secretary";
        const isSeniorAsstSec = isMounted && (currentUserProfile?.role === "senior_assistant_secretary" || (currentUserProfile?.role || "").toLowerCase().includes("senior"));
        const directCount = directlyAssignedLetters.filter((l: any) => !l.isForwarded).length;
        const forwardedCount = directlyAssignedLetters.filter((l: any) => l.isForwarded).length;

        const filteredList = directlyAssignedLetters.filter((l: any) => {
          // Safety guard for non-AddSec users: ensure letters displayed were entered by or assigned/forwarded to this officer
          if (!isAddSec && currentUserProfile?.full_name) {
            const myName = currentUserProfile.full_name.toLowerCase().trim();
            const actOfficer = (l.actionOfficer || l.action_officer || "").toLowerCase().trim();
            const fwdTo = (l.forwardedTo || l.forwarded_to || "").toLowerCase().trim();
            const addrTo = (l.addressedTo || l.addressed_to || "").toLowerCase().trim();
            const addrRole = (l.addressedRole || l.addressed_role || "").toLowerCase().trim();
            const creator = (l.created_by_name || "").toLowerCase().trim();
            const reason = (l.forwardReason || l.forward_reason || "").toLowerCase().trim();

            if (isSeniorAsstSec) {
              // Exclude letters entered/created by Additional Secretary —
              // Senior Asst Sec only needs to see letters forwarded TO them, not those entered by Addl. Sec.
              const creatorRole = (l.created_by_role || l.createdByRole || "").toLowerCase().trim();
              if (creatorRole.includes("additional")) {
                return false;
              }
              const matchesSenior =
                actOfficer.includes(myName) ||
                fwdTo.includes(myName) ||
                addrTo.includes(myName) ||
                creator.includes(myName) ||
                reason.includes(myName) ||
                actOfficer.includes("senior assistant") ||
                actOfficer.includes("senior_assistant") ||
                actOfficer.includes("ජ්‍යෙෂ්ඨ සහකාර") ||
                fwdTo.includes("senior assistant") ||
                fwdTo.includes("senior_assistant") ||
                fwdTo.includes("ජ්‍යෙෂ්ඨ සහකාර") ||
                addrTo.includes("senior assistant") ||
                addrRole.includes("senior") ||
                reason.includes("senior assistant");
              if (!matchesSenior) {
                return false;
              }
            } else {
              const myTokens = myName.split(/\s+/).filter((w: string) => w.length > 2 && !["mr.", "mrs.", "miss", "dr."].includes(w));
              const matchesCreator = creator.includes(myName) || myName.includes(creator) || (myTokens.length > 0 && myTokens.every((tk: string) => creator.includes(tk)));
              const matchesReason = reason.includes(myName) || (myTokens.length > 0 && myTokens.every((tk: string) => reason.includes(tk)));
              if (!matchesCreator && !matchesReason && (creator || reason)) {
                return false;
              }
            }
          }

          if (assignedLettersFilter === "direct" && l.isForwarded) return false;
          if (assignedLettersFilter === "forwarded" && !l.isForwarded) return false;
          if (assignedLettersSearchQuery.trim()) {
            const q = assignedLettersSearchQuery.toLowerCase();
            const lNo = (l.letterNo || l.refNo || "").toLowerCase();
            const sender = (l.sender || "").toLowerCase();
            const roleLabel = getLetterOfficerRole(l, lang).toLowerCase();
            const assignedBy = (l.created_by_name || l.addressedTo || "").toLowerCase();
            const type = (l.type || "").toLowerCase();
            return lNo.includes(q) || sender.includes(q) || assignedBy.includes(q) || roleLabel.includes(q) || type.includes(q);
          }
          return true;
        });

        const title = isAddSec
          ? (lang === "si" ? "අතිරේක ලේකම් වෙත පවරන ලද ලිපි" : "Assigned Letters to Additional Secretary")
          : isSeniorAsstSec
          ? (lang === "si" ? "ජ්‍යෙෂ්ඨ සහකාර ලේකම් වෙත පවරන ලද ලිපි" : "Assigned Letters to Senior Assistant Secretary")
          : (lang === "si" ? "ඔබ විසින් ඇතුළත් කළ ලිපි" : "Letters Entered by You");

        const description = isAddSec
          ? (lang === "si"
              ? "සහකාර ලේකම්වරුන් සහ ජ්‍යෙෂ්ඨ සහකාර ලේකම් මඟින් ලැබුණු සහ අතිරේක ලේකම් වෙත යොමු කළ සියලුම ලිපි සහ පැමිණිලි."
              : "All letters registered and forwarded by Assistant Secretaries and Senior Assistant Secretary for executive review and action.")
          : isSeniorAsstSec
          ? (lang === "si"
              ? "අතිරේක ලේකම් මඟින් ඔබ වෙත විමර්ශන සහ විනය ක්‍රියාමාර්ග සඳහා යොමු කරන ලද සියලුම ලිපි සහ පැමිණිලි."
              : "All letters and complaints forwarded to Senior Assistant Secretary by Additional Secretary for review and action.")
          : (lang === "si"
              ? "ඔබ විසින් පද්ධතියට ඇතුළත් කර අතිරේක ලේකම් වෙත යොමු කරන ලද ලිපි."
              : "Letters entered by you and forwarded to the Additional Secretary.");

        return (
          <div className="assigned-letters-card">
            <div className="assigned-letters-header">
              <div className="assigned-letters-title-area">
                <div className="assigned-letters-icon-badge">
                  <MailCheck size={22} strokeWidth={2.2} />
                </div>
                <div>
                  <h3 className="assigned-letters-title" suppressHydrationWarning>
                    <span>{title}</span>
                    <span className="assigned-letters-count-pill">{directlyAssignedLetters.length}</span>
                  </h3>
                  <p className="assigned-letters-desc" suppressHydrationWarning>
                    {description}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDirectLettersMinimized(!isDirectLettersMinimized)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  backgroundColor: "#f8fafc",
                  color: "#334155",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  padding: "6px 14px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
              >
                {isDirectLettersMinimized ? (
                  <>
                    <ChevronDown size={16} />
                    <span>{lang === "si" ? "විස්තර පෙන්වන්න" : "Expand"}</span>
                  </>
                ) : (
                  <>
                    <ChevronUp size={16} />
                    <span>{lang === "si" ? "හකුලන්න" : "Collapse"}</span>
                  </>
                )}
              </button>
            </div>

            {!isDirectLettersMinimized && (
              <>
                {/* Executive Toolbar: Filter Tabs + Quick Search */}
                <div className="assigned-letters-toolbar">
                  <div className="assigned-letters-tabs">
                    <button
                      type="button"
                      className={`assigned-letters-tab-btn ${assignedLettersFilter === "all" ? "active" : ""}`}
                      onClick={() => setAssignedLettersFilter("all")}
                    >
                      <span>{lang === "si" ? "සියල්ල" : "All"}</span>
                      <span style={{
                        padding: "1px 6px",
                        borderRadius: "10px",
                        backgroundColor: assignedLettersFilter === "all" ? "#2563eb" : "#e2e8f0",
                        color: assignedLettersFilter === "all" ? "#ffffff" : "#64748b",
                        fontSize: "11px",
                        fontWeight: 700
                      }}>
                        {directlyAssignedLetters.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      className={`assigned-letters-tab-btn ${assignedLettersFilter === "direct" ? "active" : ""}`}
                      onClick={() => setAssignedLettersFilter("direct")}
                    >
                      <Mail size={13} style={{ color: assignedLettersFilter === "direct" ? "#2563eb" : "#64748b" }} />
                      <span>{lang === "si" ? "සෘජුව ලැබුණු" : "Direct Received"}</span>
                      <span style={{
                        padding: "1px 6px",
                        borderRadius: "10px",
                        backgroundColor: assignedLettersFilter === "direct" ? "#2563eb" : "#e2e8f0",
                        color: assignedLettersFilter === "direct" ? "#ffffff" : "#64748b",
                        fontSize: "11px",
                        fontWeight: 700
                      }}>
                        {directCount}
                      </span>
                    </button>

                    <button
                      type="button"
                      className={`assigned-letters-tab-btn ${assignedLettersFilter === "forwarded" ? "active" : ""}`}
                      onClick={() => setAssignedLettersFilter("forwarded")}
                    >
                      <Landmark size={13} style={{ color: assignedLettersFilter === "forwarded" ? "#059669" : "#64748b" }} />
                      <span>{lang === "si" ? "සහකාර ලේකම්වරුන්ගෙන් යොමු වූ" : "Forwarded"}</span>
                      <span style={{
                        padding: "1px 6px",
                        borderRadius: "10px",
                        backgroundColor: assignedLettersFilter === "forwarded" ? "#059669" : "#e2e8f0",
                        color: assignedLettersFilter === "forwarded" ? "#ffffff" : "#64748b",
                        fontSize: "11px",
                        fontWeight: 700
                      }}>
                        {forwardedCount}
                      </span>
                    </button>
                  </div>

                  <div className="assigned-letters-search-box">
                    <Search size={14} className="assigned-letters-search-icon" />
                    <input
                      type="text"
                      className="assigned-letters-search-input"
                      placeholder={lang === "si" ? "ලිපි අංකය, එවූ පාර්ශවය සොයන්න..." : "Search letter no, sender..."}
                      value={assignedLettersSearchQuery}
                      onChange={(e) => setAssignedLettersSearchQuery(e.target.value)}
                    />
                    {assignedLettersSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setAssignedLettersSearchQuery("")}
                        style={{
                          position: "absolute",
                          right: "8px",
                          background: "none",
                          border: "none",
                          color: "#94a3b8",
                          cursor: "pointer",
                          padding: "2px",
                          display: "flex",
                          alignItems: "center"
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="assigned-letters-table-container">
                  <table className="assigned-letters-table">
                    <thead>
                      <tr>
                        <th>{lang === "si" ? "ලිපි අංකය" : "Letter No"}</th>
                        <th>{isAddSec ? (lang === "si" ? "යොමු කළ නිලධාරියා" : "Forwarded By") : (lang === "si" ? "ඇතුළත් කළ නිලධාරියා" : "Entered By")}</th>
                        <th>{lang === "si" ? "ලිපි වර්ගය" : "Letter Type"}</th>
                        <th>{lang === "si" ? "එවූ පාර්ශවය" : "Sender"}</th>
                        <th>{lang === "si" ? "ලිපි දිනය" : "Letter Date"}</th>
                        <th>{lang === "si" ? "ලැබුණු දිනය" : "Received Date"}</th>
                        <th style={{ textAlign: "right" }}>{lang === "si" ? "ක්‍රියාමාර්ග" : "Actions"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredList.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: "center", padding: "36px 16px", color: "#64748b" }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                              <Search size={24} style={{ color: "#94a3b8" }} />
                              <span style={{ fontWeight: 600, fontSize: "14px", color: "#334155" }}>
                                {lang === "si" ? "ලිපි කිසිවක් හමු නොවීය" : "No matching letters found"}
                              </span>
                              <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                                {lang === "si" ? "වෙනත් සෙවුම් පදයක් හෝ පෙරහනක් භාවිතා කරන්න" : "Try adjusting your search or filter criteria"}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredList.map((l: any, idx: number) => {
                          const isComplaint = (l.type || "").toLowerCase().includes("complaint") || (l.type || "").includes("පැමිණි");
                          const isHighlighted = Boolean(
                            highlightLetterNo &&
                            ((l.letterNo && l.letterNo.toLowerCase() === highlightLetterNo.toLowerCase()) ||
                             (l.refNo && l.refNo.toLowerCase() === highlightLetterNo.toLowerCase()) ||
                             (l.id && String(l.id).toLowerCase() === highlightLetterNo.toLowerCase()))
                          );
                          return (
                            <tr
                              key={l.id || idx}
                              className={`assigned-letters-row ${isHighlighted ? "row-highlighted" : ""}`}
                              style={isHighlighted ? { backgroundColor: "#fef9c3", borderLeft: "4px solid #eab308", transition: "all 0.3s ease" } : {}}
                            >
                              <td>
                                <span style={{
                                  fontWeight: 700,
                                  color: "#0f172a",
                                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                  fontSize: "13px"
                                }}>
                                  {l.letterNo || l.refNo}
                                </span>
                              </td>
                              <td>
                                {l.isForwarded ? (
                                  <span
                                    title={l.created_by_name || l.addressedTo || ""}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "5px",
                                      fontSize: "12px",
                                      padding: "4px 10px",
                                      borderRadius: "6px",
                                      backgroundColor: "#ecfdf5",
                                      color: "#065f46",
                                      fontWeight: 600,
                                      border: "1px solid #a7f3d0",
                                      whiteSpace: "nowrap"
                                    }}
                                  >
                                    <Landmark size={13} style={{ color: "#059669" }} />
                                    <span>{getLetterOfficerRole(l, lang)}</span>
                                  </span>
                                ) : (
                                  <span
                                    title={l.created_by_name || l.addressedTo || ""}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "5px",
                                      fontSize: "12px",
                                      padding: "4px 10px",
                                      borderRadius: "6px",
                                      backgroundColor: "#eff6ff",
                                      color: "#1e40af",
                                      fontWeight: 600,
                                      border: "1px solid #bfdbfe",
                                      whiteSpace: "nowrap"
                                    }}
                                  >
                                    <Mail size={13} style={{ color: "#2563eb" }} />
                                    <span>{getLetterOfficerRole(l, lang)}</span>
                                  </span>
                                )}
                              </td>
                              <td>
                                <span style={{
                                  display: "inline-block",
                                  padding: "3px 9px",
                                  borderRadius: "6px",
                                  backgroundColor: isComplaint ? "#fff1f2" : "#f1f5f9",
                                  color: isComplaint ? "#be123c" : "#334155",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  border: isComplaint ? "1px solid #fecdd3" : "1px solid #e2e8f0"
                                }}>
                                  {l.type}
                                </span>
                              </td>
                              <td>
                                <span style={{ color: "#0f172a", fontWeight: 600, fontSize: "13px" }}>
                                  {l.sender}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontSize: "12.5px", color: "#475569", fontWeight: 500 }}>
                                  {l.letterDate || "—"}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontSize: "12.5px", color: "#475569", fontWeight: 500 }}>
                                  {l.receivedDate || "—"}
                                </span>
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <Link
                                  href={`/admin/view-letter?id=${encodeURIComponent(l.letterNo || l.refNo)}`}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    backgroundColor: "#0f172a",
                                    color: "#ffffff",
                                    padding: "6px 14px",
                                    borderRadius: "7px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    textDecoration: "none",
                                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                                    transition: "all 0.15s ease",
                                    whiteSpace: "nowrap"
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = "#2563eb";
                                    e.currentTarget.style.boxShadow = "0 3px 8px rgba(37, 99, 235, 0.3)";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = "#0f172a";
                                    e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.1)";
                                  }}
                                >
                                  <span>{lang === "si" ? "විස්තර බලන්න" : "View Details"}</span>
                                  <ArrowRight size={13} />
                                </Link>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* ── Pending Letter Edit Approval Requests Section ── */}
      {pendingEditRequests.length > 0 && (
        <div className="admin-approval-section-card">
          <div className="admin-approval-header">
            <div className="admin-approval-title-area">
              <div className="admin-approval-icon-badge">
                <svg style={{ width: "22px", height: "22px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div>
                <h3 className="admin-approval-title">
                  {lang === "si" ? "පොරොත්තු ලිපි සංස්කරණ අනුමැති ඉල්ලීම්" : "Pending Letter Edit Approval Requests"} ({pendingEditRequests.length})
                </h3>
                <p className="admin-approval-desc">
                  {lang === "si"
                    ? "නිලධාරීන් විසින් යොමු කර ඇති සංස්කරණ ඉල්ලීම් සමාලෝචනය කර අනුමත හෝ ප්‍රතික්ෂේප කරන්න."
                    : "Officers have requested permission to edit previously submitted letters. Review and approve or reject."}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchPendingEditRequests}
              disabled={isLoadingRequests}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                backgroundColor: "#ffffff",
                color: "#78350f",
                border: "1px solid #fde68a",
                borderRadius: "8px",
                padding: "6px 14px",
                fontSize: "12.5px",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              <span style={{ display: "inline-block", transform: isLoadingRequests ? "rotate(360deg)" : "none", transition: "transform 0.5s ease" }}>🔄</span>
              {lang === "si" ? "යාවත්කාලීන කරන්න" : "Refresh"}
            </button>
          </div>

          <div className="admin-approval-table-container">
            <table className="admin-approval-table">
              <thead>
                <tr>
                  <th>{lang === "si" ? "යොමු / ලිපි අංකය" : "Ref / Letter No"}</th>
                  <th>{lang === "si" ? "ඉල්ලුම් කළ නිලධාරී" : "Requested By"}</th>
                  <th>{lang === "si" ? "හේතුව" : "Reason for Edit"}</th>
                  <th>{lang === "si" ? "දිනය" : "Date Requested"}</th>
                  <th style={{ textAlign: "right" }}>{lang === "si" ? "ක්‍රියාමාර්ග" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {pendingEditRequests.map((req) => (
                  <tr key={req.id}>
                    <td>
                      <span style={{ fontWeight: 700, color: "#1e3a8a" }}>
                        {req.ref_no || req.letter_id}
                      </span>
                    </td>
                    <td>
                      <div>
                        <strong>{req.requested_by}</strong>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>
                          {req.requester_role || "Daily Mail Officer"} {req.requester_email ? `• ${req.requester_email}` : ""}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontStyle: "italic", color: "#475569" }}>
                        "{req.reason || "No reason provided"}"
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        {req.created_at ? new Date(req.created_at).toLocaleString() : "—"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="btn-notif-approve"
                          onClick={() => handleApproveRequest(req.id, req.ref_no)}
                        >
                          ✓ {lang === "si" ? "අනුමත කරන්න" : "Approve"}
                        </button>
                        <button
                          type="button"
                          className="btn-notif-reject"
                          onClick={() => handleRejectRequest(req.id, req.ref_no)}
                        >
                          ✕ {lang === "si" ? "ප්‍රතික්ෂේප" : "Reject"}
                        </button>
                        <Link
                          href={`/daily-mail/register?id=${encodeURIComponent(req.letter_id || req.ref_no)}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            backgroundColor: "#eff6ff",
                            color: "#2563eb",
                            border: "1px solid #bfdbfe",
                            padding: "5px 10px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                            textDecoration: "none"
                          }}
                        >
                          👁 {lang === "si" ? "බලන්න" : "Review Form"}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div className="toast-notification">
          <div className="toast-success-icon-container">
            <svg style={{ width: "16px", height: "16px", color: "#ffffff" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Visualization Charts Section (Banner + Collapsible + Slide-out Trigger) ── */}
      <section className="admin-analytics-section">
        <div className="admin-analytics-banner">
          <div className="admin-analytics-banner-left">
            <div className="admin-analytics-badge">
              <BarChart2 size={22} />
            </div>
            <div>
              <h3 className="admin-analytics-banner-title">
                {t("analyticsSlideBarTitle", "Visualization & Analytics")}
              </h3>
              <p className="admin-analytics-banner-subtitle">
                {t("analyticsSlideBarSubtitle", "Trends, case distributions, and classification breakdown")}
              </p>
            </div>
          </div>
          <div className="admin-analytics-banner-actions">
            <button
              type="button"
              className="btn-analytics-drawer"
              onClick={() => setIsChartSlideBarOpen(true)}
            >
              <SlidersHorizontal size={15} />
              <span>{t("openChartsDrawer", "Slide Out Charts")}</span>
            </button>
            <button
              type="button"
              className="btn-analytics-toggle"
              onClick={() => setIsChartsExpanded(!isChartsExpanded)}
            >
              {isChartsExpanded ? (
                <>
                  <ChevronUp size={16} />
                  <span>{t("collapseCharts", "Hide Charts")}</span>
                </>
              ) : (
                <>
                  <ChevronDown size={16} />
                  <span>{t("expandCharts", "Show Charts")}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {isChartsExpanded && (
          <div className="admin-analytics-collapsible-body">
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
          </div>
        )}
      </section>

      {/* ── Letters Forwarded to Senior Assistant Secretary Section ── */}
      {isMounted && (currentUserProfile?.role === "senior_assistant_secretary" || (currentUserProfile?.role || "").toLowerCase().includes("senior")) && seniorSecLetters.length > 0 && (
        <section style={{
          margin: "0 0 28px 0",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 4px 24px rgba(124, 58, 237, 0.10), 0 1px 4px rgba(0,0,0,0.07)",
          border: "1.5px solid #ede9fe",
          background: "linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%)",
        }}>
          {/* Section Header */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 24px 14px 24px",
            borderBottom: "1px solid #ede9fe",
            background: "linear-gradient(90deg, #7c3aed 0%, #6d28d9 100%)",
            color: "#fff",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "38px", height: "38px",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Send size={20} strokeWidth={2.2} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, letterSpacing: "0.01em" }}>
                  {lang === "si" ? "අතිරේක ලේකම් යොමු කළ ලිපි" : "Letters Sent by Additional Secretary"}
                  <span style={{
                    marginLeft: "10px",
                    background: "rgba(255,255,255,0.25)",
                    borderRadius: "20px",
                    padding: "1px 10px",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                  }}>{seniorSecLetters.length}</span>
                  {showSeniorNotifBell && seniorLettersNewCount > 0 && (
                    <span style={{
                      marginLeft: "8px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      background: "#f59e0b",
                      color: "#1e1e1e",
                      borderRadius: "20px",
                      padding: "2px 9px",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      animation: "seniorBellPulse 1.4s ease-in-out infinite",
                    }}>
                      <Bell size={11} strokeWidth={2.8} /> {seniorLettersNewCount} {lang === "si" ? "නව" : "New"}
                    </span>
                  )}
                </h3>
                <p style={{ margin: 0, fontSize: "0.78rem", opacity: 0.85, marginTop: "2px" }}>
                  {lang === "si"
                    ? "අතිරේක ලේකම් විසින් ඔබ වෙත යොමු කළ ලිපි සහ පැමිණිලි"
                    : "All letters and complaints forwarded to you by Additional Secretary for review and action"}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {/* Search */}
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  placeholder={lang === "si" ? "ලිපිය සොයන්න…" : "Search letters…"}
                  value={seniorLettersSearch}
                  onChange={(e) => setSeniorLettersSearch(e.target.value)}
                  style={{
                    padding: "6px 12px 6px 32px",
                    borderRadius: "8px",
                    border: "none",
                    fontSize: "0.8rem",
                    background: "rgba(255,255,255,0.18)",
                    color: "#fff",
                    outline: "none",
                    width: "180px",
                  }}
                />
                <Search size={13} strokeWidth={2} style={{ position: "absolute", left: "9px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.7)" }} />
              </div>
              {/* Mark all read button */}
              {showSeniorNotifBell && (
                <button
                  type="button"
                  onClick={() => {
                    const seenKey = "dcmms_senior_seen_letters";
                    const allIds = seniorSecLetters.map((l: any) => l.id);
                    try { localStorage.setItem(seenKey, JSON.stringify(allIds)); } catch {}
                    setSeniorLettersNewCount(0);
                    setShowSeniorNotifBell(false);
                  }}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.4)",
                    background: "rgba(255,255,255,0.15)",
                    color: "#fff",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    whiteSpace: "nowrap",
                  }}
                >
                  ✓ {lang === "si" ? "සියල්ල කියවා ඇත" : "Mark all read"}
                </button>
              )}
              {/* Minimize toggle */}
              <button
                type="button"
                onClick={() => setIsSeniorLettersMinimized(!isSeniorLettersMinimized)}
                style={{
                  background: "rgba(255,255,255,0.18)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                  cursor: "pointer",
                  padding: "6px 10px",
                  display: "flex", alignItems: "center",
                }}
                title={isSeniorLettersMinimized ? "Expand" : "Collapse"}
              >
                {isSeniorLettersMinimized ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>
            </div>
          </div>

          {/* Table body */}
          {!isSeniorLettersMinimized && (() => {
            const seenKey = "dcmms_senior_seen_letters";
            let seenIds: string[] = [];
            try { seenIds = JSON.parse(localStorage.getItem(seenKey) || "[]"); } catch {}

            const filtered = seniorSecLetters.filter((l: any) => {
              if (!seniorLettersSearch.trim()) return true;
              const q = seniorLettersSearch.toLowerCase();
              return (
                (l.letterNo || l.refNo || "").toLowerCase().includes(q) ||
                (l.sender || "").toLowerCase().includes(q) ||
                (l.subject || "").toLowerCase().includes(q) ||
                (l.type || "").toLowerCase().includes(q) ||
                (l.createdByName || "").toLowerCase().includes(q)
              );
            });

            return (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
                  <thead>
                    <tr style={{ background: "rgba(109, 40, 217, 0.08)" }}>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#5b21b6", whiteSpace: "nowrap" }}>🆕</th>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#5b21b6", whiteSpace: "nowrap" }}>{lang === "si" ? "ලිපි අංකය" : "Letter No."}</th>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#5b21b6" }}>{lang === "si" ? "යවන ලද්දා" : "Sender"}</th>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#5b21b6" }}>{lang === "si" ? "විෂය" : "Subject"}</th>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#5b21b6", whiteSpace: "nowrap" }}>{lang === "si" ? "ලිපි වර්ගය" : "Type"}</th>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#5b21b6", whiteSpace: "nowrap" }}>{lang === "si" ? "ලැබුණු දිනය" : "Received"}</th>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#5b21b6", whiteSpace: "nowrap" }}>{lang === "si" ? "යොමු කළේ" : "Forwarded By"}</th>
                      <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#5b21b6" }}>{lang === "si" ? "කාර්යය" : "Action"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "#9ca3af", fontSize: "0.9rem" }}>
                          {seniorLettersSearch
                            ? (lang === "si" ? "ගැළපෙන ලිපි සොයා නොගත්හ." : "No letters match your search.")
                            : (lang === "si" ? "ලිපි කිසිවක් නැත." : "No letters forwarded yet.")}
                        </td>
                      </tr>
                    ) : filtered.map((l: any, idx: number) => {
                      const isNew = !seenIds.includes(l.id);
                      const typeColor = l.type?.toLowerCase().includes("complaint") ? "#dc2626"
                        : l.type?.toLowerCase().includes("notification") ? "#7c3aed"
                        : "#0284c7";
                      return (
                        <tr key={l.id} style={{
                          borderBottom: "1px solid #ede9fe",
                          background: isNew ? "rgba(124,58,237,0.04)" : idx % 2 === 0 ? "#ffffff" : "rgba(245,243,255,0.5)",
                          transition: "background 0.15s",
                        }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(124,58,237,0.08)")}
                          onMouseLeave={e => (e.currentTarget.style.background = isNew ? "rgba(124,58,237,0.04)" : idx % 2 === 0 ? "#ffffff" : "rgba(245,243,255,0.5)")}
                        >
                          <td style={{ padding: "10px 14px", textAlign: "center" }}>
                            {isNew && (
                              <span style={{
                                display: "inline-block",
                                width: "9px", height: "9px",
                                borderRadius: "50%",
                                background: "#7c3aed",
                                boxShadow: "0 0 0 3px rgba(124,58,237,0.2)",
                              }} title="New" />
                            )}
                          </td>
                          <td style={{ padding: "10px 14px", fontWeight: 700, color: "#4c1d95", whiteSpace: "nowrap" }}>
                            {l.letterNo || l.refNo || "—"}
                          </td>
                          <td style={{ padding: "10px 14px", color: "#374151" }}>{l.sender}</td>
                          <td style={{ padding: "10px 14px", color: "#374151", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            title={l.subject}>{l.subject || "—"}</td>
                          <td style={{ padding: "10px 14px" }}>
                            <span style={{
                              padding: "2px 10px", borderRadius: "20px", fontSize: "0.75rem",
                              fontWeight: 700, background: `${typeColor}15`, color: typeColor,
                              border: `1px solid ${typeColor}30`,
                              whiteSpace: "nowrap",
                            }}>{l.type}</span>
                          </td>
                          <td style={{ padding: "10px 14px", color: "#6b7280", whiteSpace: "nowrap" }}>
                            {l.receivedDate || l.letterDate || "—"}
                          </td>
                          <td style={{ padding: "10px 14px", color: "#6b7280", whiteSpace: "nowrap" }}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: "5px",
                              padding: "2px 9px", borderRadius: "20px",
                              background: "rgba(124,58,237,0.10)", color: "#5b21b6",
                              fontSize: "0.76rem", fontWeight: 600,
                            }}>
                              🏛️ {
                                // Format the role string into a readable label
                                (() => {
                                  const raw = (l.createdByRole || "additional_secretary");
                                  return raw
                                    .replace(/_/g, " ")
                                    .replace(/\b\w/g, (c: string) => c.toUpperCase());
                                })()
                              }
                            </span>
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "center" }}>
                            <a
                              href={`/admin/view-case?caseNo=${encodeURIComponent(l.letterNo || l.refNo || "")}`}
                              style={{
                                display: "inline-block",
                                padding: "5px 14px",
                                borderRadius: "7px",
                                background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
                                color: "#fff",
                                fontWeight: 700,
                                fontSize: "0.78rem",
                                textDecoration: "none",
                                boxShadow: "0 2px 6px rgba(124,58,237,0.25)",
                                transition: "opacity 0.15s",
                              }}
                              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                            >
                              {lang === "si" ? "බලන්න" : "View"}
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </section>
      )}

      {/* Keyframe for the bell pulse animation */}
      <style>{`
        @keyframes seniorBellPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.5); }
          50% { box-shadow: 0 0 0 6px rgba(245,158,11,0); }
        }
      `}</style>

      {/* Recent Cases Section */}
      <section className="letters-list-section">
        <div className="letters-list-header" style={{ flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              <svg className="admin-section-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span>{t("recentCases", "Recent Cases")}</span>
            </h3>

            {isMounted && currentUserProfile?.role === "additional_secretary" && (
              <div style={{
                display: "inline-flex",
                backgroundColor: "#f1f5f9",
                borderRadius: "8px",
                padding: "3px",
                border: "1px solid #e2e8f0"
              }}>
                <button
                  type="button"
                  onClick={() => setCasesTab("all")}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: casesTab === "all" ? "#ffffff" : "transparent",
                    color: casesTab === "all" ? "#1e293b" : "#64748b",
                    boxShadow: casesTab === "all" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    transition: "all 0.15s ease"
                  }}
                >
                  {lang === "si" ? "සියලුම ලිපි / නඩු" : "All Cases"} ({recentCases.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCasesTab("additional_secretary")}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: casesTab === "additional_secretary" ? "#2563eb" : "transparent",
                    color: casesTab === "additional_secretary" ? "#ffffff" : "#64748b",
                    boxShadow: casesTab === "additional_secretary" ? "0 1px 3px rgba(37,99,235,0.3)" : "none",
                    transition: "all 0.15s ease"
                  }}
                >
                  🏛️ {lang === "si" ? "අතිරේක ලේකම් වෙත පවරන ලද ලිපි" : "Assigned to Additional Secretary"} ({recentCases.filter(c => isAssignedToAddSec(c.assignedTo)).length})
                </button>
              </div>
            )}
          </div>
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
            {isMounted && currentUserProfile?.role === "additional_secretary" ? (
              <button
                type="button"
                className="btn-add-letter-table"
                onClick={() => router.push("/daily-mail/register")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 14px",
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1d4ed8")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
                title={t("registerComplaintDetailed", "Full Complaint Registration")}
                suppressHydrationWarning
              >
                <Plus size={16} strokeWidth={2.5} />
                <span suppressHydrationWarning>{t("registerComplaintDetailed", "Full Complaint Registration")}</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn-add-letter-table"
                onClick={() => router.push("/daily-mail/add-letter")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 14px",
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1d4ed8")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
                title={getAddLetterButtonLabel(isMounted ? currentUserProfile?.role : undefined, isMounted ? currentUserProfile?.raw_role : undefined, t)}
                suppressHydrationWarning
              >
                <Plus size={16} strokeWidth={2.5} />
                <span suppressHydrationWarning>{getAddLetterButtonLabel(isMounted ? currentUserProfile?.role : undefined, isMounted ? currentUserProfile?.raw_role : undefined, t)}</span>
              </button>
            )}
            <button
              className="btn-export-excel"
              onClick={() => {
                const dataToExport = filteredRecentCases.length > 0 ? filteredRecentCases : recentCases;
                const headers = ["Case No", "Date Filed", "Subject", "Assigned To", "Priority", "Status", "Classification"];
                const rows = dataToExport.map((c) => [c.caseNo, c.dateFiled, c.subject, c.assignedTo, c.priority, c.status, c.type]);
                exportToExcel(`DCMMS_Cases_Summary_${new Date().toISOString().split("T")[0]}`, headers, rows);
              }}
              title="Export Cases to Excel"
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>{t("exportExcel", "Export to Excel")}</span>
            </button>
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
                    <td className="admin-table-case-no">
                      <Link
                        href={`/admin/view-case?caseNo=${encodeURIComponent(item.caseNo)}`}
                        style={{ color: "inherit", textDecoration: "none" }}
                      >
                        {item.caseNo}
                      </Link>
                    </td>
                    <td>{item.dateFiled}</td>
                    <td className="subject-cell">{item.subject}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600 }}>{item.assignedTo}</span>
                        {isAssignedToAddSec(item.assignedTo) && (
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            fontSize: "10px",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            backgroundColor: "#dbeafe",
                            color: "#1d4ed8",
                            fontWeight: 700
                          }}>
                            {lang === "si" ? "අතිරේක ලේකම්" : "Addl. Secretary"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge-badge ${item.priority === "High"
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
                        className={`badge-badge ${item.status === "Under Investigation"
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
                      <Link
                        href={`/admin/view-case?caseNo=${encodeURIComponent(item.caseNo)}`}
                        className="add-details-link"
                      >
                        {t("view", "View")}
                      </Link>
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

      {/* ── Visualization Charts Slide Bar Drawer (Offcanvas Side Panel) ── */}
      {isChartSlideBarOpen && (
        <div
          className="admin-charts-slidebar-overlay"
          onClick={() => setIsChartSlideBarOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`admin-charts-slidebar ${isChartSlideBarOpen ? "admin-charts-slidebar-open" : ""}`}
        aria-label={t("analyticsSlideBarTitle", "Visualization & Analytics")}
        role="dialog"
        aria-modal="true"
      >
        <div className="admin-charts-slidebar-header">
          <div className="admin-charts-slidebar-header-info">
            <div className="admin-charts-slidebar-icon">
              <BarChart2 size={22} />
            </div>
            <div>
              <h3 className="admin-charts-slidebar-title">
                {t("analyticsSlideBarTitle", "Visualization & Analytics")}
              </h3>
              <p className="admin-charts-slidebar-subtitle">
                {t("analyticsSlideBarSubtitle", "Trends, case distributions, and classification breakdown")}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="admin-charts-slidebar-close-btn"
            onClick={() => setIsChartSlideBarOpen(false)}
            aria-label={t("closeChartsDrawer", "Close Slide Bar")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="admin-charts-slidebar-content">
          {/* Quick Metrics Summary */}
          <div className="admin-charts-slidebar-metrics">
            <div className="admin-slidebar-metric-card" style={{ borderLeft: "3px solid #1e3a8a" }}>
              <div className="admin-slidebar-metric-label">{t("totalCases", "Total Cases")}</div>
              <div className="admin-slidebar-metric-val">{totalCasesCount}</div>
            </div>
            <div className="admin-slidebar-metric-card" style={{ borderLeft: "3px solid #ea580c" }}>
              <div className="admin-slidebar-metric-label">{t("underInvestigation", "In Investigation")}</div>
              <div className="admin-slidebar-metric-val">{underInvestigationCount}</div>
            </div>
            <div className="admin-slidebar-metric-card" style={{ borderLeft: "3px solid #d97706" }}>
              <div className="admin-slidebar-metric-label">{t("underSubjectOfficer", "Subject Officer")}</div>
              <div className="admin-slidebar-metric-val">{underSubjectOfficerCount}</div>
            </div>
            <div className="admin-slidebar-metric-card" style={{ borderLeft: "3px solid #16a34a" }}>
              <div className="admin-slidebar-metric-label">{t("closed", "Closed")}</div>
              <div className="admin-slidebar-metric-val">{closedCount}</div>
            </div>
          </div>

          {/* Chart 1: Cases over time */}
          <div className="admin-charts-slidebar-card">
            <div className="admin-charts-slidebar-card-header">
              <div>
                <h4 className="admin-charts-slidebar-card-title">{t("casesOverTime", "Cases over time")}</h4>
                <p className="admin-charts-slidebar-card-subtitle">{t("newCasesPerPeriod", "New cases per period")}</p>
              </div>
              <div className="admin-chart-filters">
                {["Daily", "Weekly", "Monthly", "Yearly"].map((period) => (
                  <button
                    key={`sb-${period}`}
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
                    <linearGradient id="caseGradientDrawer" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.3} />
                      <stop offset="50%" stopColor="#818CF8" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="#C7D2FE" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} cursor={{ stroke: "#E5E7EB", strokeWidth: 1, strokeDasharray: "5 5" }} />
                  <Area type="monotone" dataKey="cases" stroke="#4F46E5" strokeWidth={3} fill="url(#caseGradientDrawer)" dot={false} activeDot={{ r: 6, fill: "#4F46E5", stroke: "#fff", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Status Distribution */}
          <div className="admin-charts-slidebar-card">
            <h4 className="admin-charts-slidebar-card-title">{t("statusDistribution", "Status distribution")}</h4>
            <div className="admin-pie-chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dynamicStatusData} cx="50%" cy="45%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" stroke="none">
                    {dynamicStatusData.map((entry, index) => (
                      <Cell key={`sb-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" formatter={(value) => <span className="admin-legend-label">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Cases by Type */}
          <div className="admin-charts-slidebar-card">
            <h4 className="admin-charts-slidebar-card-title">{t("casesByType", "Cases by type")}</h4>
            <div className="admin-bar-chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dynamicTypeData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "#F3F4F6" }} contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {dynamicTypeData.map((entry, index) => (
                      <Cell key={`sb-bar-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </aside>
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

export default function AdminDashboard() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-slate-500 font-sans">Loading Dashboard...</div>}>
      <AdminDashboardContent />
    </React.Suspense>
  );
}
