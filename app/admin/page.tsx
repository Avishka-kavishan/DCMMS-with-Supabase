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
  forwardLetterFromAdditionalSecretaryServer,
} from "@/lib/db-actions";
import { exportToExcel } from "@/lib/export-excel";
import {
  LetterOriginGroup,
  getLetterOriginGroup,
  getOriginBadge,
  isAssignedBySeniorAssistantSecretary,
} from "@/lib/letter-hierarchy";

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
  rawLetter?: any;
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
  if (roleRaw.includes("deputy") || roleRaw.includes("senior") || roleRaw.includes("නියෝජ්‍ය")) {
    return lang === "si" ? "නියෝජ්‍ය ලේකම්" : lang === "ta" ? "பிரதிச் செயலாளர்" : "Deputy Secretary";
  }
  if (roleRaw.includes("assistant") || roleRaw.includes("asst")) {
    return lang === "si" ? "සහකාර ලේකම්" : lang === "ta" ? "உதவிச் செயலாளர்" : "Assistant Secretary";
  }
  if (roleRaw.includes("daily") || roleRaw.includes("mail")) {
    return lang === "si" ? "දෛනික තැපැල් නිලධාරී" : lang === "ta" ? "தினசரி அஞ்சல் அதிகாரி" : "Daily Mail Officer";
  }
  if (roleRaw.includes("additional")) {
    return lang === "si" ? "අතිරේක ලේකම්" : lang === "ta" ? "கூடுதல் செயலாளர்" : "Additional Secretary";
  }

  // 2. Creator officer name match
  if (creator.includes("bandula")) {
    return lang === "si" ? "සහකාර ලේකම් (විනය)" : lang === "ta" ? "உதவிச் செயலாளர் (ஒழுக்கம்)" : "Assistant Secretary (Discipline)";
  }
  if (creator.includes("ranjith")) {
    return lang === "si" ? "සහකාර ලේකම් (විමර්ශන)" : lang === "ta" ? "உதவிச் செயலாளர் (விசாரணை)" : "Assistant Secretary (Investigation)";
  }
  if (creator.includes("dharshana") || creator.includes("deputy")) {
    return lang === "si" ? "නියෝජ්‍ය ලේකම්" : lang === "ta" ? "பிரதிச் செயலாளர்" : "Deputy Secretary";
  }
  if (creator.includes("nihal")) {
    return lang === "si" ? "අතිරේක ලේකම්" : lang === "ta" ? "கூடுதல் செயலாளர்" : "Additional Secretary";
  }
  if (creator.includes("daily mail")) {
    return lang === "si" ? "දෛනික තැපැල් නිලධාරී" : lang === "ta" ? "தினசரி அஞ்சல் அதிகாரி" : "Daily Mail Officer";
  }

  // 3. Addressed officer role match
  if (addrRole.includes("discipline")) {
    return lang === "si" ? "සහකාර ලේකම් (විනය)" : lang === "ta" ? "உதவிச் செயலாளர் (ஒழுக்கம்)" : "Assistant Secretary (Discipline)";
  }
  if (addrRole.includes("investigation") && (addrRole.includes("assistant") || addrRole.includes("sec"))) {
    return lang === "si" ? "සහකාර ලේකම් (විමර්ශන)" : lang === "ta" ? "உதவிச் செயலாளர் (விசாரணை)" : "Assistant Secretary (Investigation)";
  }
  if (addrRole.includes("deputy") || addrRole.includes("senior")) {
    return lang === "si" ? "නියෝජ්‍ය ලේකම්" : lang === "ta" ? "பிரதிச் செயலாளர்" : "Deputy Secretary";
  }
  if (addrRole.includes("assistant") || addrRole.includes("asst")) {
    return lang === "si" ? "සහකාර ලේකම්" : lang === "ta" ? "உதவிச் செயலாளர்" : "Assistant Secretary";
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
  const [allMappedCases, setAllMappedCases] = useState<CaseRow[]>([]);
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
  const [assignedLettersFilter, setAssignedLettersFilter] = useState<string>("all");

  // Forward Letter Modal state for Additional Secretary
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [forwardingLetter, setForwardingLetter] = useState<any | null>(null);
  const [forwardRecipientRole, setForwardRecipientRole] = useState<string>("senior_assistant_secretary");
  const [forwardRecipientName, setForwardRecipientName] = useState<string>("Dharshana Senanayake");
  const [forwardReasonInput, setForwardReasonInput] = useState<string>("");
  const [isSubmittingForward, setIsSubmittingForward] = useState(false);

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
        "chief_clerk_discipline",
        "chief_clerk_investigation",
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
              rawLetter: c,
            }));

            setAllMappedCases(mapped);
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

  // ── Role detection helpers ──────────────────────────────────────────────────
  const isChiefClerk = Boolean(
    isMounted && (
      currentUserProfile?.role === "chief_clerk" ||
      currentUserProfile?.role === "chief_clerk_discipline" ||
      currentUserProfile?.role === "chief_clerk_investigation" ||
      (currentUserProfile?.role || "").toLowerCase().includes("chief") ||
      (currentUserProfile?.role || "").toLowerCase().includes("clerk") ||
      (currentUserProfile?.role || "").toLowerCase().includes("clack") ||
      (currentUserProfile?.raw_role || "").toLowerCase().includes("chief") ||
      (currentUserProfile?.raw_role || "").toLowerCase().includes("clerk") ||
      (currentUserProfile?.raw_role || "").toLowerCase().includes("ශාඛා ප්‍රධානී")
    )
  );

  // Helper to check if an officer name is Senior Assistant Secretary (e.g. Dharshana Senanayake)
  const isAssignedToSeniorSec = (officer: string) => {
    const o = (officer || "").toLowerCase();
    return o.includes("dharshana") || o.includes("senanayake") || o.includes("senior assistant") || o.includes("deputy");
  };

  // Base list of cases for the current user role:
  // For Chief Clerk, ONLY display cases assigned/originated by the Senior Assistant Secretary
  const baseCases = React.useMemo(() => {
    if (isChiefClerk) {
      return allMappedCases.filter((c) => isAssignedBySeniorAssistantSecretary(c));
    }
    return allMappedCases;
  }, [allMappedCases, isChiefClerk]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const activeCases = React.useMemo(() => {
    return baseCases.filter(
      (c) =>
        (selectedType === "All types" || c.type === selectedType) &&
        (selectedStatus === "All statuses" || c.status === selectedStatus)
    );
  }, [baseCases, selectedType, selectedStatus]);

  const totalCasesCount = activeCases.length;
  const underInvestigationCount = activeCases.filter((c) => c.status === "Under Investigation").length;
  const closedCount = activeCases.filter((c) => c.status === "Closed").length;
  const underSubjectOfficerCount = activeCases.filter((c) => c.status === "Under Subject Officer").length;

  const pct = (n: number) =>
    totalCasesCount > 0 ? `${Math.round((n / totalCasesCount) * 100)}%` : "0%";

  // ── Chart data ─────────────────────────────────────────────────────────────
  const activeCaseDates = React.useMemo(() => {
    if (isChiefClerk) {
      return baseCases.map((c) => c.dateFiled).filter(Boolean);
    }
    return caseDates;
  }, [isChiefClerk, baseCases, caseDates]);

  const chartDataMap: Record<string, { name: string; cases: number }[]> = {
    Daily: buildDailyChart(activeCaseDates),
    Weekly: buildWeeklyChart(activeCaseDates),
    Monthly: buildMonthlyChart(activeCaseDates),
    Yearly: buildYearlyChart(activeCaseDates),
  };
  const chartData = chartDataMap[chartPeriod];

  // Apply filter ratio to chart when filters active
  const filterRatio = baseCases.length > 0 ? activeCases.length / baseCases.length : 1;
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
  const filteredRecentCases = React.useMemo(() => {
    let list = baseCases;
    if (isMounted && currentUserProfile?.role === "additional_secretary" && casesTab === "additional_secretary") {
      list = list.filter((c) => isAssignedToAddSec(c.assignedTo));
    }
    const q = searchQuery.toLowerCase().trim();
    return list.filter((c) => {
      const matchesType = selectedType === "All types" || c.type === selectedType;
      const matchesStatus = selectedStatus === "All statuses" || c.status === selectedStatus;
      const matchesSearch =
        !q ||
        c.caseNo.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q) ||
        c.assignedTo.toLowerCase().includes(q);
      return matchesType && matchesStatus && matchesSearch;
    });
  }, [baseCases, isMounted, currentUserProfile?.role, casesTab, searchQuery, selectedType, selectedStatus]);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut();
    router.push("/");
  };

  // ── Forward Letter from Additional Secretary Handler ───────────────────────
  const handleForwardLetterSubmit = async () => {
    if (!forwardingLetter) return;
    setIsSubmittingForward(true);
    try {
      const res = await forwardLetterFromAdditionalSecretaryServer({
        letterId: forwardingLetter.id,
        letterNo: forwardingLetter.letterNo,
        refNo: forwardingLetter.refNo,
        forwardToOfficerName: forwardRecipientName,
        forwardToRole: forwardRecipientRole,
        forwardReason: forwardReasonInput.trim(),
        senderName: forwardingLetter.sender,
      });

      if (res && res.success) {
        setDirectlyAssignedLetters((prev) =>
          prev.map((item) => {
            if (
              (item.letterNo && item.letterNo === forwardingLetter.letterNo) ||
              (item.refNo && item.refNo === forwardingLetter.refNo) ||
              (item.id && item.id === forwardingLetter.id)
            ) {
              return {
                ...item,
                forwardedTo: `${forwardRecipientName} (${forwardRecipientRole})`,
                forwardReason: forwardReasonInput.trim() || "Forwarded by Additional Secretary",
                actionOfficer: forwardRecipientName,
                addressedTo: forwardRecipientName,
                addressedRole: forwardRecipientRole,
                isForwarded: true,
              };
            }
            return item;
          })
        );

        setToastMessage(
          lang === "si"
            ? `ලිපිය සාර්ථකව ${forwardRecipientName} වෙත යොමු කරන ලදී!`
            : `Letter successfully forwarded to ${forwardRecipientName}!`
        );
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
        setIsForwardModalOpen(false);
        setForwardingLetter(null);

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("dcmms_data_updated"));
          window.dispatchEvent(new CustomEvent("dcmms_assignment_updated"));
          window.dispatchEvent(new CustomEvent("dcmms_notifications_updated"));
        }
      } else {
        alert(res?.error || "Failed to forward letter");
      }
    } catch (err: any) {
      console.error("Error in handleForwardLetterSubmit:", err);
      alert(err?.message || "Failed to forward letter");
    } finally {
      setIsSubmittingForward(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!isMounted) {
    return (
      <div className="admin-dashboard-container" style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#64748b", fontSize: "0.95rem", fontWeight: 500 }}>
          Loading Dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-container" suppressHydrationWarning>
      {/* Header section */}
      <div className="admin-dashboard-header" suppressHydrationWarning>
        <div suppressHydrationWarning>
          <h3 className="admin-dashboard-title1" suppressHydrationWarning>{t("dashboard", "Dashboard")}</h3>
          <h2 className="admin-dashboard-title" suppressHydrationWarning>{greeting}</h2>
          <p className="admin-dashboard-subtitle" suppressHydrationWarning>
            {isLoading
              ? t("loadingData", "Loading data…")
              : t("adminSubtitle", "{{count}} total cases", { count: totalCasesCount })}
          </p>
        </div>
        <div className="admin-filters-container" suppressHydrationWarning>
          <div className="admin-filter-wrapper" suppressHydrationWarning>
            <select
              aria-label="Filter by case type"
              className="admin-filter-select"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              suppressHydrationWarning
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
          <div className="admin-filter-wrapper" suppressHydrationWarning>
            <select
              aria-label="Filter by status"
              className="admin-filter-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              suppressHydrationWarning
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
            suppressHydrationWarning
          >
            <BarChart2 size={16} />
            <span suppressHydrationWarning>{t("viewAnalyticsCharts", "Analytics & Charts")}</span>
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
      {!isChiefClerk && (
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
      )}

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
                              href={`/admin/branch-selection?${new URLSearchParams({
                                id: l.id || "",
                                letterNo: l.letterNo || l.refNo || "",
                                refNo: l.refNo || l.letterNo || "",
                                sender: l.sender || "",
                                subject: l.subject || "",
                                type: l.type || "",
                                receivedDate: l.receivedDate || l.letterDate || "",
                                forwardReason: l.forwardReason || "",
                                createdByName: l.createdByName || "",
                              }).toString()}`}
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

      {/* ── Assigned & Forwarded Letters Section ── */}
      {(() => {
        if (directlyAssignedLetters.length === 0) return null;

        const isAddSec = isMounted && currentUserProfile?.role === "additional_secretary";
        const isSeniorAsstSec = isMounted && (currentUserProfile?.role === "senior_assistant_secretary" || (currentUserProfile?.role || "").toLowerCase().includes("senior") || (currentUserProfile?.role || "").toLowerCase().includes("deputy"));

        const baseLettersList = isChiefClerk
          ? directlyAssignedLetters.filter((l: any) => {
              const isDisc = 
                (l.addressedRole || "").toLowerCase().includes("discipline") || 
                (l.forwardedTo || "").toLowerCase().includes("discipline") || 
                (l.actionOfficer || "").toLowerCase().includes("bandula") ||
                (l.addressedTo || "").toLowerCase().includes("bandula");
              return isAssignedBySeniorAssistantSecretary(l) || isDisc;
            })
          : directlyAssignedLetters;

        const directCount = baseLettersList.filter((l: any) => !l.isForwarded).length;
        const forwardedCount = baseLettersList.filter((l: any) => l.isForwarded).length;

        // Group letters for Additional Secretary view:
        // 1. Deputy Secretary / Senior Assistant Secretary
        // 2. Assistant Secretary of Discipline
        // 3. Assistant Secretary of Investigations
        // 4. Meant directly for Additional Secretary
        const deputyLetters = directlyAssignedLetters.filter((l: any) => getLetterOriginGroup(l) === "deputy_secretary");
        const disciplineLetters = directlyAssignedLetters.filter((l: any) => getLetterOriginGroup(l) === "asst_sec_discipline");
        const investigationLetters = directlyAssignedLetters.filter((l: any) => getLetterOriginGroup(l) === "asst_sec_investigation");
        const directAddSecLetters = directlyAssignedLetters.filter((l: any) => getLetterOriginGroup(l) === "direct_additional_sec");

        const filteredList = baseLettersList.filter((l: any) => {
          if (isAddSec) {
            if (assignedLettersFilter === "deputy_secretary" && getLetterOriginGroup(l) !== "deputy_secretary") return false;
            if (assignedLettersFilter === "asst_sec_discipline" && getLetterOriginGroup(l) !== "asst_sec_discipline") return false;
            if (assignedLettersFilter === "asst_sec_investigation" && getLetterOriginGroup(l) !== "asst_sec_investigation") return false;
            if (assignedLettersFilter === "direct_additional_sec" && getLetterOriginGroup(l) !== "direct_additional_sec") return false;
          } else {
            // Safety guard for non-AddSec users: ensure letters displayed were entered by or assigned/forwarded to this officer
            if (currentUserProfile?.full_name) {
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
                  actOfficer.includes("deputy") ||
                  actOfficer.includes("ජ්‍යෙෂ්ඨ සහකාර") ||
                  fwdTo.includes("senior assistant") ||
                  fwdTo.includes("senior_assistant") ||
                  fwdTo.includes("deputy") ||
                  fwdTo.includes("ජ්‍යෙෂ්ඨ සහකාර") ||
                  addrTo.includes("senior assistant") ||
                  addrTo.includes("deputy") ||
                  addrRole.includes("senior") ||
                  addrRole.includes("deputy") ||
                  reason.includes("senior assistant") ||
                  reason.includes("deputy");
                if (!matchesSenior) {
                  return false;
                }
              } else if (isChiefClerk) {
                // Chief Clerk sees letters assigned by Senior Assistant Secretary or routed to Discipline Branch
                // Allow through
              } else {
                const myTokens = myName.split(/\s+/).filter((w: string) => w.length > 2 && !["mr.", "mrs.", "miss", "dr."].includes(w));
                const matchesCreator = creator.includes(myName) || myName.includes(creator) || (myTokens.length > 0 && myTokens.every((tk: string) => creator.includes(tk)));
                const matchesReason = reason.includes(myName) || (myTokens.length > 0 && myTokens.every((tk: string) => reason.includes(tk)));
                const matchesForward = fwdTo.includes(myName) || actOfficer.includes(myName);
                if (!matchesCreator && !matchesReason && !matchesForward && (creator || reason)) {
                  return false;
                }
              }
            }

            if (assignedLettersFilter === "direct" && l.isForwarded) return false;
            if (assignedLettersFilter === "forwarded" && !l.isForwarded) return false;
          }

          if (assignedLettersSearchQuery.trim()) {
            const q = assignedLettersSearchQuery.toLowerCase();
            const lNo = (l.letterNo || l.refNo || "").toLowerCase();
            const sender = (l.sender || "").toLowerCase();
            const roleLabel = getLetterOfficerRole(l, lang).toLowerCase();
            const assignedBy = (l.created_by_name || l.addressedTo || "").toLowerCase();
            const type = (l.type || "").toLowerCase();
            const subject = (l.subject || "").toLowerCase();
            return lNo.includes(q) || sender.includes(q) || assignedBy.includes(q) || roleLabel.includes(q) || type.includes(q) || subject.includes(q);
          }
          return true;
        });

        const title = isAddSec
          ? (lang === "si" ? "අතිරේක ලේකම් වෙත පවරන ලද ලිපි" : "Assigned Letters to Additional Secretary")
          : isSeniorAsstSec
          ? (lang === "si" ? "ජ්‍යෙෂ්ඨ සහකාර ලේකම් වෙත පවරන ලද ලිපි" : "Assigned Letters to Senior Assistant Secretary")
          : isChiefClerk
          ? (lang === "si" ? "ජ්‍යෙෂ්ඨ සහකාර ලේකම් විසින් පවරන ලද ලිපි" : "Letters Assigned by Senior Assistant Secretary")
          : (lang === "si" ? "ඔබ විසින් ඇතුළත් කළ ලිපි" : "Letters Entered by You");

        const description = isAddSec
          ? (lang === "si"
              ? "නියෝජ්‍ය ලේකම්, විනය සහකාර ලේකම් සහ විමර්ශන සහකාර ලේකම් මඟින් ලැබුණු ලිපි මෙන්ම අතිරේක ලේකම් වෙත සෘජුවම ලැබුණු ලිපි වෙන් වෙන්ව පහත දැක්වේ."
              : "Letters coming separately from Deputy Secretary, Assistant Secretary (Discipline), and Assistant Secretary (Investigations), with options to forward direct letters.")
          : isSeniorAsstSec
          ? (lang === "si"
              ? "අතිරේක ලේකම් මඟින් ඔබ වෙත විමර්ශන සහ විනය ක්‍රියාමාර්ග සඳහා යොමු කරන ලද සියලුම ලිපි සහ පැමිණිලි."
              : "All letters and complaints forwarded to Senior Assistant Secretary by Additional Secretary for review and action.")
          : isChiefClerk
          ? (lang === "si"
              ? "ජ්‍යෙෂ්ඨ සහකාර ලේකම් මඟින් විනය ශාඛාව වෙත පවරන ලද සියලුම ලිපි සහ පැමිණිලි."
              : "All letters and complaints assigned by Senior Assistant Secretary to the Discipline Branch.")
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
                    <span className="assigned-letters-count-pill">{filteredList.length}</span>
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
                {/* ── Executive Origin Breakdown KPI Cards (Visible for Additional Secretary) ── */}
                {isAddSec && (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "12px",
                    margin: "14px 20px 6px 20px"
                  }}>
                    {/* 1. Deputy Secretary */}
                    <div
                      onClick={() => setAssignedLettersFilter(assignedLettersFilter === "deputy_secretary" ? "all" : "deputy_secretary")}
                      style={{
                        padding: "14px 16px",
                        borderRadius: "12px",
                        backgroundColor: assignedLettersFilter === "deputy_secretary" ? "#f5f3ff" : "#ffffff",
                        border: assignedLettersFilter === "deputy_secretary" ? "2px solid #7c3aed" : "1.5px solid #e2e8f0",
                        cursor: "pointer",
                        boxShadow: assignedLettersFilter === "deputy_secretary" ? "0 4px 12px rgba(124, 58, 237, 0.15)" : "0 1px 3px rgba(0,0,0,0.04)",
                        transition: "all 0.2s ease"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#6b21a8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          🏛️ {lang === "si" ? "නියෝජ්‍ය ලේකම්" : "Deputy Secretary"}
                        </span>
                        <span style={{
                          padding: "2px 8px",
                          borderRadius: "12px",
                          backgroundColor: "#f3e8ff",
                          color: "#6b21a8",
                          fontSize: "12px",
                          fontWeight: 800
                        }}>
                          {deputyLetters.length}
                        </span>
                      </div>
                      <div style={{ fontSize: "20px", fontWeight: 800, color: "#1e1b4b" }}>
                        {deputyLetters.length} <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}>{lang === "si" ? "ලිපි" : "Letters"}</span>
                      </div>
                      <div style={{ fontSize: "11px", color: "#6b21a8", marginTop: "4px", fontWeight: 600 }}>
                        {lang === "si" ? "නියෝජ්‍ය ලේකම් මඟින් ලැබුණු" : "Received from Deputy Secretary"}
                      </div>
                    </div>

                    {/* 2. Assistant Secretary of Discipline */}
                    <div
                      onClick={() => setAssignedLettersFilter(assignedLettersFilter === "asst_sec_discipline" ? "all" : "asst_sec_discipline")}
                      style={{
                        padding: "14px 16px",
                        borderRadius: "12px",
                        backgroundColor: assignedLettersFilter === "asst_sec_discipline" ? "#fffbeb" : "#ffffff",
                        border: assignedLettersFilter === "asst_sec_discipline" ? "2px solid #d97706" : "1.5px solid #e2e8f0",
                        cursor: "pointer",
                        boxShadow: assignedLettersFilter === "asst_sec_discipline" ? "0 4px 12px rgba(217, 119, 6, 0.15)" : "0 1px 3px rgba(0,0,0,0.04)",
                        transition: "all 0.2s ease"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          ⚖️ {lang === "si" ? "විනය සහකාර ලේකම්" : "Asst. Sec (Discipline)"}
                        </span>
                        <span style={{
                          padding: "2px 8px",
                          borderRadius: "12px",
                          backgroundColor: "#fef3c7",
                          color: "#92400e",
                          fontSize: "12px",
                          fontWeight: 800
                        }}>
                          {disciplineLetters.length}
                        </span>
                      </div>
                      <div style={{ fontSize: "20px", fontWeight: 800, color: "#451a03" }}>
                        {disciplineLetters.length} <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}>{lang === "si" ? "ලිපි" : "Letters"}</span>
                      </div>
                      <div style={{ fontSize: "11px", color: "#b45309", marginTop: "4px", fontWeight: 600 }}>
                        {lang === "si" ? "විනය ශාඛාවෙන් ලැබුණු" : "Discipline Branch letters"}
                      </div>
                    </div>

                    {/* 3. Assistant Secretary of Investigations */}
                    <div
                      onClick={() => setAssignedLettersFilter(assignedLettersFilter === "asst_sec_investigation" ? "all" : "asst_sec_investigation")}
                      style={{
                        padding: "14px 16px",
                        borderRadius: "12px",
                        backgroundColor: assignedLettersFilter === "asst_sec_investigation" ? "#f0f9ff" : "#ffffff",
                        border: assignedLettersFilter === "asst_sec_investigation" ? "2px solid #0284c7" : "1.5px solid #e2e8f0",
                        cursor: "pointer",
                        boxShadow: assignedLettersFilter === "asst_sec_investigation" ? "0 4px 12px rgba(2, 132, 199, 0.15)" : "0 1px 3px rgba(0,0,0,0.04)",
                        transition: "all 0.2s ease"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          🔍 {lang === "si" ? "විමර්ශන සහකාර ලේකම්" : "Asst. Sec (Investigations)"}
                        </span>
                        <span style={{
                          padding: "2px 8px",
                          borderRadius: "12px",
                          backgroundColor: "#e0f2fe",
                          color: "#0369a1",
                          fontSize: "12px",
                          fontWeight: 800
                        }}>
                          {investigationLetters.length}
                        </span>
                      </div>
                      <div style={{ fontSize: "20px", fontWeight: 800, color: "#082f49" }}>
                        {investigationLetters.length} <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}>{lang === "si" ? "ලිපි" : "Letters"}</span>
                      </div>
                      <div style={{ fontSize: "11px", color: "#0284c7", marginTop: "4px", fontWeight: 600 }}>
                        {lang === "si" ? "විමර්ශන ශාඛාවෙන් ලැබුණු" : "Investigation Branch letters"}
                      </div>
                    </div>

                    {/* 4. Only for Additional Secretary */}
                    <div
                      onClick={() => setAssignedLettersFilter(assignedLettersFilter === "direct_additional_sec" ? "all" : "direct_additional_sec")}
                      style={{
                        padding: "14px 16px",
                        borderRadius: "12px",
                        backgroundColor: assignedLettersFilter === "direct_additional_sec" ? "#ecfdf5" : "#ffffff",
                        border: assignedLettersFilter === "direct_additional_sec" ? "2px solid #059669" : "1.5px solid #e2e8f0",
                        cursor: "pointer",
                        boxShadow: assignedLettersFilter === "direct_additional_sec" ? "0 4px 12px rgba(5, 150, 105, 0.15)" : "0 1px 3px rgba(0,0,0,0.04)",
                        transition: "all 0.2s ease"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#065f46", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          📬 {lang === "si" ? "අතිරේක ලේකම් වෙත පමණි" : "Only for Addl. Sec"}
                        </span>
                        <span style={{
                          padding: "2px 8px",
                          borderRadius: "12px",
                          backgroundColor: "#d1fae5",
                          color: "#065f46",
                          fontSize: "12px",
                          fontWeight: 800
                        }}>
                          {directAddSecLetters.length}
                        </span>
                      </div>
                      <div style={{ fontSize: "20px", fontWeight: 800, color: "#022c22" }}>
                        {directAddSecLetters.length} <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}>{lang === "si" ? "ලිපි" : "Letters"}</span>
                      </div>
                      <div style={{ fontSize: "11px", color: "#059669", marginTop: "4px", fontWeight: 600 }}>
                        {lang === "si" ? "සෘජුව ලැබුණු / යොමු කිරීමේ හැකියාව සහිත" : "Meant for Addl. Sec (Forwardable)"}
                      </div>
                    </div>
                  </div>
                )}

                {/* Executive Toolbar: Filter Tabs + Quick Search */}
                <div className="assigned-letters-toolbar">
                  <div className="assigned-letters-tabs">
                    {/* All */}
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
                        {baseLettersList.length}
                      </span>
                    </button>

                    {isAddSec ? (
                      <>
                        {/* 1. Deputy Secretary Tab */}
                        <button
                          type="button"
                          className={`assigned-letters-tab-btn ${assignedLettersFilter === "deputy_secretary" ? "active" : ""}`}
                          onClick={() => setAssignedLettersFilter("deputy_secretary")}
                        >
                          <span>🏛️ {lang === "si" ? "නියෝජ්‍ය ලේකම්" : "Deputy Secretary"}</span>
                          <span style={{
                            padding: "1px 6px",
                            borderRadius: "10px",
                            backgroundColor: assignedLettersFilter === "deputy_secretary" ? "#7c3aed" : "#e2e8f0",
                            color: assignedLettersFilter === "deputy_secretary" ? "#ffffff" : "#64748b",
                            fontSize: "11px",
                            fontWeight: 700
                          }}>
                            {deputyLetters.length}
                          </span>
                        </button>

                        {/* 2. Asst. Sec Discipline Tab */}
                        <button
                          type="button"
                          className={`assigned-letters-tab-btn ${assignedLettersFilter === "asst_sec_discipline" ? "active" : ""}`}
                          onClick={() => setAssignedLettersFilter("asst_sec_discipline")}
                        >
                          <span>⚖️ {lang === "si" ? "සහකාර ලේකම් (විනය)" : "Asst. Sec (Discipline)"}</span>
                          <span style={{
                            padding: "1px 6px",
                            borderRadius: "10px",
                            backgroundColor: assignedLettersFilter === "asst_sec_discipline" ? "#d97706" : "#e2e8f0",
                            color: assignedLettersFilter === "asst_sec_discipline" ? "#ffffff" : "#64748b",
                            fontSize: "11px",
                            fontWeight: 700
                          }}>
                            {disciplineLetters.length}
                          </span>
                        </button>

                        {/* 3. Asst. Sec Investigation Tab */}
                        <button
                          type="button"
                          className={`assigned-letters-tab-btn ${assignedLettersFilter === "asst_sec_investigation" ? "active" : ""}`}
                          onClick={() => setAssignedLettersFilter("asst_sec_investigation")}
                        >
                          <span>🔍 {lang === "si" ? "සහකාර ලේකම් (විමර්ශන)" : "Asst. Sec (Investigations)"}</span>
                          <span style={{
                            padding: "1px 6px",
                            borderRadius: "10px",
                            backgroundColor: assignedLettersFilter === "asst_sec_investigation" ? "#0284c7" : "#e2e8f0",
                            color: assignedLettersFilter === "asst_sec_investigation" ? "#ffffff" : "#64748b",
                            fontSize: "11px",
                            fontWeight: 700
                          }}>
                            {investigationLetters.length}
                          </span>
                        </button>

                        {/* 4. Only for Additional Secretary Tab */}
                        <button
                          type="button"
                          className={`assigned-letters-tab-btn ${assignedLettersFilter === "direct_additional_sec" ? "active" : ""}`}
                          onClick={() => setAssignedLettersFilter("direct_additional_sec")}
                        >
                          <span>📬 {lang === "si" ? "අතිරේක ලේකම් වෙත පමණි" : "Only for Addl. Sec"}</span>
                          <span style={{
                            padding: "1px 6px",
                            borderRadius: "10px",
                            backgroundColor: assignedLettersFilter === "direct_additional_sec" ? "#059669" : "#e2e8f0",
                            color: assignedLettersFilter === "direct_additional_sec" ? "#ffffff" : "#64748b",
                            fontSize: "11px",
                            fontWeight: 700
                          }}>
                            {directAddSecLetters.length}
                          </span>
                        </button>
                      </>
                    ) : (
                      <>
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
                          <span>{lang === "si" ? "යොමු වූ ලිපි" : "Forwarded"}</span>
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
                      </>
                    )}
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
                        <th>{isAddSec ? (lang === "si" ? "ලිපියේ ප්‍රභවය / යොමු කළ නිලධාරියා" : "Origin / Sender Officer") : (lang === "si" ? "ඇතුළත් කළ නිලධාරියා" : "Entered By")}</th>
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
                          const originGroup = getLetterOriginGroup(l);
                          const badge = getOriginBadge(originGroup, lang);
                          const isDirectAddSec = originGroup === "direct_additional_sec";
                          const isAlreadyForwarded = Boolean(
                            l.isForwarded &&
                            l.forwardedTo &&
                            l.forwardedTo !== "null" &&
                            !l.forwardedTo.toLowerCase().includes("additional") &&
                            !l.forwardedTo.toLowerCase().includes("nihal")
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
                                {isAddSec ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                                    <span
                                      title={l.created_by_name || l.addressedTo || ""}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "5px",
                                        fontSize: "12px",
                                        padding: "3px 9px",
                                        borderRadius: "6px",
                                        backgroundColor: badge.bg,
                                        color: badge.color,
                                        fontWeight: 700,
                                        border: `1px solid ${badge.border}`,
                                        whiteSpace: "nowrap",
                                        width: "fit-content"
                                      }}
                                    >
                                      <span>{badge.icon}</span>
                                      <span>{badge.label}</span>
                                    </span>
                                    {l.created_by_name && (
                                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                                        {l.created_by_name}
                                      </span>
                                    )}
                                    {isAlreadyForwarded && (
                                      <span style={{
                                        fontSize: "10.5px",
                                        color: "#059669",
                                        fontWeight: 600,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "3px"
                                      }}>
                                        ✓ {lang === "si" ? `යොමු විය: ${l.forwardedTo}` : `Fwd: ${l.forwardedTo}`}
                                      </span>
                                    )}
                                  </div>
                                ) : l.isForwarded ? (
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
                                <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", justifyContent: "flex-end" }}>
                                  {/* View Details Link */}
                                  <Link
                                    href={`/admin/view-letter?id=${encodeURIComponent(l.letterNo || l.refNo)}`}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "6px",
                                      backgroundColor: "#0f172a",
                                      color: "#ffffff",
                                      padding: "6px 12px",
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
                                    <span>{lang === "si" ? "විස්තර" : "View"}</span>
                                    <ArrowRight size={13} />
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* ── Forward Letter Modal for Additional Secretary ── */}
                {isForwardModalOpen && forwardingLetter && (
                  <div style={{
                    position: "fixed",
                    inset: 0,
                    backgroundColor: "rgba(15, 23, 42, 0.7)",
                    backdropFilter: "blur(6px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 99999,
                    padding: "16px",
                  }}>
                    <div style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "16px",
                      maxWidth: "580px",
                      width: "100%",
                      padding: "26px",
                      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
                      border: "1px solid #e2e8f0",
                      maxHeight: "92vh",
                      overflowY: "auto"
                    }}>
                      {/* Modal Header */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{
                            width: "38px",
                            height: "38px",
                            borderRadius: "10px",
                            backgroundColor: "#ecfdf5",
                            color: "#059669",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "1px solid #a7f3d0"
                          }}>
                            <Send size={18} />
                          </div>
                          <div>
                            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                              {lang === "si" ? "ලිපිය නිලධාරියෙකු වෙත යොමු කිරීම" : "Forward Letter to Officer"}
                            </h3>
                            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                              {lang === "si"
                                ? "අතිරේක ලේකම් වෙත ලැබුණු ලිපිය ඉදිරි ක්‍රියාමාර්ග සඳහා පහත නිලධාරියෙකු වෙත යොමු කරන්න."
                                : "Forward letter received by Additional Secretary for review and action."}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setIsForwardModalOpen(false); setForwardingLetter(null); }}
                          style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: "4px" }}
                        >
                          <X size={20} />
                        </button>
                      </div>

                      {/* Letter Preview Box */}
                      <div style={{
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        padding: "12px 14px",
                        marginBottom: "16px"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                            {lang === "si" ? "ලිපි අංකය" : "Letter No"}:
                          </span>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", fontFamily: "monospace" }}>
                            {forwardingLetter.letterNo || forwardingLetter.refNo}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                            {lang === "si" ? "එවූ පාර්ශවය" : "Sender"}:
                          </span>
                          <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#334155" }}>
                            {forwardingLetter.sender}
                          </span>
                        </div>
                        {forwardingLetter.subject && (
                          <div style={{ marginTop: "4px", paddingTop: "6px", borderTop: "1px dashed #cbd5e1" }}>
                            <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                              {lang === "si" ? "විෂය" : "Subject"}:
                            </span>
                            <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "#1e293b", fontWeight: 500 }}>
                              {forwardingLetter.subject}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Recipient Selection (The 3 target officers) */}
                      <div style={{ marginBottom: "16px" }}>
                        <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>
                          {lang === "si" ? "ලිපිය යොමු කරන නිලධාරියා තෝරන්න:" : "Select Recipient Officer:"}
                        </label>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {[
                            {
                              role: "senior_assistant_secretary",
                              name: "Dharshana Senanayake",
                              title: lang === "si" ? "නියෝජ්‍ය ලේකම් / ජ්‍යෙෂ්ඨ සහකාර ලේකම්" : "Deputy Secretary / Senior Assistant Secretary",
                              sub: "Dharshana Senanayake (SEC-TEST-003)",
                              icon: "🏛️"
                            },
                            {
                              role: "assistant_secretary_discipline",
                              name: "Bandula Gunawardena",
                              title: lang === "si" ? "සහකාර ලේකම් - විනය අංශය" : "Assistant Secretary - Discipline Branch",
                              sub: "Bandula Gunawardena (SEC-TEST-001)",
                              icon: "⚖️"
                            },
                            {
                              role: "assistant_secretary_investigation",
                              name: "Ranjith Siyambalapitiya",
                              title: lang === "si" ? "සහකාර ලේකම් - විමර්ශන අංශය" : "Assistant Secretary - Investigation Branch",
                              sub: "Ranjith Siyambalapitiya (SEC-TEST-002)",
                              icon: "🔍"
                            }
                          ].map((target) => {
                            const isSelected = forwardRecipientRole === target.role;
                            return (
                              <label
                                key={target.role}
                                onClick={() => {
                                  setForwardRecipientRole(target.role);
                                  setForwardRecipientName(target.name);
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "12px",
                                  padding: "10px 14px",
                                  borderRadius: "10px",
                                  border: isSelected ? "2px solid #059669" : "1.5px solid #e2e8f0",
                                  backgroundColor: isSelected ? "#ecfdf5" : "#ffffff",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease"
                                }}
                              >
                                <input
                                  type="radio"
                                  name="forwardTargetOfficer"
                                  checked={isSelected}
                                  onChange={() => {
                                    setForwardRecipientRole(target.role);
                                    setForwardRecipientName(target.name);
                                  }}
                                  style={{ accentColor: "#059669", width: "16px", height: "16px" }}
                                />
                                <span style={{ fontSize: "20px" }}>{target.icon}</span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: "13px", fontWeight: 700, color: isSelected ? "#065f46" : "#0f172a" }}>
                                    {target.title}
                                  </div>
                                  <div style={{ fontSize: "11.5px", color: isSelected ? "#047857" : "#64748b" }}>
                                    {target.sub}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Forwarding Instructions / Reason */}
                      <div style={{ marginBottom: "20px" }}>
                        <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                          {lang === "si" ? "යොමු කිරීමේ උපදෙස් / හේතුව:" : "Instructions / Forwarding Reason:"}
                        </label>
                        <textarea
                          rows={3}
                          value={forwardReasonInput}
                          onChange={(e) => setForwardReasonInput(e.target.value)}
                          placeholder={lang === "si"
                            ? "උපදෙස් හෝ යොමු කිරීමේ හේතුව සඳහන් කරන්න..."
                            : "Enter instructions or directive for the recipient..."}
                          style={{
                            width: "100%",
                            borderRadius: "8px",
                            border: "1.5px solid #cbd5e1",
                            padding: "8px 12px",
                            fontSize: "13px",
                            color: "#0f172a",
                            outline: "none",
                            resize: "vertical"
                          }}
                        />
                        {/* Quick Suggestions */}
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" }}>
                          {[
                            lang === "si" ? "විමර්ශන සහ විනය වාර්තාවක් සඳහා" : "For inquiry and disciplinary report",
                            lang === "si" ? "අවශ්‍ය ඉදිරි ක්‍රියාමාර්ග ගැනීම සඳහා" : "For necessary further action",
                            lang === "si" ? "සමාලෝචනය කර නිර්දේශ ඉදිරිපත් කරන්න" : "Review and submit recommendations",
                          ].map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => setForwardReasonInput(chip)}
                              style={{
                                background: "#f1f5f9",
                                border: "1px solid #e2e8f0",
                                borderRadius: "12px",
                                padding: "3px 8px",
                                fontSize: "11px",
                                color: "#334155",
                                fontWeight: 600,
                                cursor: "pointer"
                              }}
                            >
                              + {chip}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Modal Action Buttons */}
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                        <button
                          type="button"
                          onClick={() => { setIsForwardModalOpen(false); setForwardingLetter(null); }}
                          disabled={isSubmittingForward}
                          style={{
                            padding: "8px 16px",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            backgroundColor: "#f8fafc",
                            color: "#475569",
                            fontWeight: 600,
                            fontSize: "13px",
                            cursor: "pointer"
                          }}
                        >
                          {lang === "si" ? "අවලංගු කරන්න" : "Cancel"}
                        </button>
                        <button
                          type="button"
                          onClick={handleForwardLetterSubmit}
                          disabled={isSubmittingForward}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "7px",
                            padding: "8px 18px",
                            borderRadius: "8px",
                            border: "none",
                            backgroundColor: "#059669",
                            color: "#ffffff",
                            fontWeight: 700,
                            fontSize: "13px",
                            cursor: isSubmittingForward ? "not-allowed" : "pointer",
                            boxShadow: "0 2px 6px rgba(5, 150, 105, 0.3)"
                          }}
                        >
                          <Send size={14} />
                          <span>
                            {isSubmittingForward
                              ? (lang === "si" ? "යොමු කරමින්..." : "Forwarding...")
                              : (lang === "si" ? "ලිපිය යොමු කරන්න" : "Confirm Forward")}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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
              <h3 className="admin-analytics-banner-title" suppressHydrationWarning>
                {t("analyticsSlideBarTitle", "Visualization & Analytics")}
              </h3>
              <p className="admin-analytics-banner-subtitle" suppressHydrationWarning>
                {t("analyticsSlideBarSubtitle", "Trends, case distributions, and classification breakdown")}
              </p>
            </div>
          </div>
          <div className="admin-analytics-banner-actions">
            <button
              type="button"
              className="btn-analytics-drawer"
              onClick={() => setIsChartSlideBarOpen(true)}
              suppressHydrationWarning
            >
              <SlidersHorizontal size={15} />
              <span suppressHydrationWarning>{t("openChartsDrawer", "Slide Out Charts")}</span>
            </button>
            <button
              type="button"
              className="btn-analytics-toggle"
              onClick={() => setIsChartsExpanded(!isChartsExpanded)}
              suppressHydrationWarning
            >
              {isChartsExpanded ? (
                <>
                  <ChevronUp size={16} />
                  <span suppressHydrationWarning>{t("collapseCharts", "Hide Charts")}</span>
                </>
              ) : (
                <>
                  <ChevronDown size={16} />
                  <span suppressHydrationWarning>{t("expandCharts", "Show Charts")}</span>
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

      {/* Recent Cases Section */}
      <section className="letters-list-section">
        <div className="letters-list-header" style={{ flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <h3 className="section-title" style={{ margin: 0 }} suppressHydrationWarning>
              <svg className="admin-section-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {isChiefClerk ? (
                <>
                  <span suppressHydrationWarning>
                    {lang === "si" ? "ජ්‍යෙෂ්ඨ සහකාර ලේකම් මඟින් පවරන ලද ලිපි" : "Letters Assigned by Senior Assistant Secretary"}
                  </span>
                  <span style={{
                    marginLeft: "8px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "11px",
                    fontWeight: 700,
                    backgroundColor: "#ede9fe",
                    color: "#6d28d9",
                    padding: "3px 9px",
                    borderRadius: "12px",
                    border: "1px solid #ddd6fe"
                  }}>
                    🏛️ {lang === "si" ? "ශාඛා ප්‍රධානී සඳහා පමණි" : "Chief Clerk Exclusive"} ({filteredRecentCases.length})
                  </span>
                </>
              ) : (
                <span suppressHydrationWarning>{t("recentCases", "Recent Cases")}</span>
              )}
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
                suppressHydrationWarning
              />
            </div>
            {!isChiefClerk && (
              isMounted && currentUserProfile?.role === "additional_secretary" ? (
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
              )
            )}
            <button
              className="btn-export-excel"
              onClick={() => {
                const dataToExport = filteredRecentCases;
                const headers = ["Case No", "Date Filed", "Subject", "Assigned To", "Priority", "Status", "Classification"];
                const rows = dataToExport.map((c) => [c.caseNo, c.dateFiled, c.subject, c.assignedTo, c.priority, c.status, c.type]);
                exportToExcel(`DCMMS_Cases_Summary_${new Date().toISOString().split("T")[0]}`, headers, rows);
              }}
              title="Export Cases to Excel"
              suppressHydrationWarning
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span suppressHydrationWarning>{t("exportExcel", "Export to Excel")}</span>
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
              suppressHydrationWarning
            >
              <span suppressHydrationWarning>{t("viewAll", "View All")}</span> <span className="arrow-span">→</span>
            </a>
          </div>
        </div>

        <div className="table-responsive-container">
          <table className="letters-data-table">
            <thead>
              <tr suppressHydrationWarning>
                <th scope="col" suppressHydrationWarning>{t("caseNo", "Case No")}</th>
                <th scope="col" suppressHydrationWarning>{t("dateFiled", "Date Filed")}</th>
                <th scope="col" suppressHydrationWarning>{t("subjectText", "Subject")}</th>
                <th scope="col" suppressHydrationWarning>{t("assignedTo", "Assigned To")}</th>
                <th scope="col" suppressHydrationWarning>{t("priority", "Priority")}</th>
                <th scope="col" suppressHydrationWarning>{t("status", "Status")}</th>
                <th scope="col" className="admin-table-header-center" suppressHydrationWarning>{t("action", "Action")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="admin-table-no-data" suppressHydrationWarning>
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
                        {isAssignedToSeniorSec(item.assignedTo) && (
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            fontSize: "10px",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            backgroundColor: "#ede9fe",
                            color: "#6d28d9",
                            fontWeight: 700
                          }}>
                            {lang === "si" ? "ජ්‍යෙෂ්ඨ සහකාර ලේකම්" : "Senior Asst. Sec"}
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
                  <td colSpan={7} className="admin-table-no-data" suppressHydrationWarning>
                    {isChiefClerk
                      ? (lang === "si" ? "ජ්‍යෙෂ්ඨ සහකාර ලේකම් මඟින් පවරන ලද ලිපි කිසිවක් නොමැත." : "No letters assigned by Senior Assistant Secretary found.")
                      : (allCases.length === 0
                        ? t("noCasesInDatabase", "No cases found in the database yet.")
                        : t("noCasesMatchFilters", "No cases match the selected filters."))}
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
    <div className={`premium-stat-card ${cardClass}`} suppressHydrationWarning>
      <div className="premium-card-top" suppressHydrationWarning>
        <div className="premium-card-title-area" suppressHydrationWarning>
          {icon}
          <span suppressHydrationWarning>{title}</span>
        </div>
        <span className="premium-card-percentage" suppressHydrationWarning>{percentage}</span>
      </div>
      <div className="premium-card-bottom" suppressHydrationWarning>
        <div className="premium-card-value-area" suppressHydrationWarning>
          <span className="premium-card-value" suppressHydrationWarning>{value}</span>
          <span className="premium-card-label" suppressHydrationWarning>cases</span>
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
