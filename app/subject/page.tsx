"use client";

import "../../i18n";
import "../daily-mail/daily-mail.css";
import "../dashboard-common.css";
import "./subject.css";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sidebar } from "@/components/Sidebar";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getCurrentProfile, signOut, UserProfile } from "@/lib/auth";
import { CheckCircle, XCircle, FileText, Send, Clock, X, AlertCircle, ShieldCheck, Calendar as CalendarIcon, ChevronDown, ChevronUp } from "lucide-react";

interface Case {
  id: string;
  caseNo: string;
  assignedDate: string;
  receivedDate: string;
  letterDate?: string;
  createdAt?: string;
  subject: string;
  priority: "high" | "medium" | "low";
  status: "In Progress" | "Closed" | "Pending";
  isOld?: boolean;
}

export const formatToInputDate = (dateStr?: string | null): string => {
  if (!dateStr || typeof dateStr !== "string") return "";
  const trimmed = dateStr.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (trimmed.includes("T")) {
    const parts = trimmed.split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(parts)) return parts;
  }
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return "";
};

export function parseCommitteeDetails(asgn: any) {
  let chairmanName = "";
  let chairmanNic = "";
  let memberList: string[] = [];

  if (asgn?.chairman) {
    if (typeof asgn.chairman === "object" && asgn.chairman !== null) {
      chairmanName = asgn.chairman.fullName || asgn.chairman.name || asgn.chairman.officer_name || "";
      chairmanNic = asgn.chairman.nicNo || asgn.chairman.nic || asgn.chairman.nic_no || "";
    } else if (typeof asgn.chairman === "string") {
      if (asgn.chairman.startsWith("{")) {
        try {
          const parsed = JSON.parse(asgn.chairman);
          chairmanName = parsed.fullName || parsed.name || parsed.officer_name || "";
          chairmanNic = parsed.nicNo || parsed.nic || parsed.nic_no || "";
        } catch (e) {
          chairmanName = asgn.chairman;
        }
      } else {
        chairmanName = asgn.chairman;
      }
    }
  }

  if (asgn?.members) {
    if (Array.isArray(asgn.members)) {
      memberList = asgn.members.map((m: any) => {
        if (typeof m === "object" && m !== null) {
          return m.fullName || m.name || m.officer_name || "";
        }
        return String(m || "");
      }).filter(Boolean);
    } else if (typeof asgn.members === "string") {
      try {
        const parsed = JSON.parse(asgn.members);
        if (Array.isArray(parsed)) {
          memberList = parsed.map((m: any) => (typeof m === "object" ? m.fullName || m.name || m.officer_name : String(m))).filter(Boolean);
        } else {
          memberList = asgn.members.split(",").map((s: string) => s.trim()).filter(Boolean);
        }
      } catch (e) {
        memberList = asgn.members.split(",").map((s: string) => s.trim()).filter(Boolean);
      }
    }
  }

  const rawText = String(asgn?.assignedOfficers || asgn?.assigned_officers || asgn?.officerName || asgn?.committeeDetails || "").trim();

  if (!chairmanName && rawText) {
    if (rawText.includes("Chairman:")) {
      const match = rawText.match(/Chairman:\s*([^|]+)/i);
      if (match && match[1]) chairmanName = match[1].trim();
    } else if (rawText.includes("(Chairman)")) {
      const match = rawText.match(/([^(,]+)\s*\(Chairman\)/i);
      if (match && match[1]) chairmanName = match[1].trim();
    }
  }

  if (memberList.length === 0 && rawText) {
    if (rawText.includes("Members:")) {
      const match = rawText.match(/Members:\s*([^|]+)/i);
      if (match && match[1]) {
        memberList = match[1].split(",").map((s) => s.trim()).filter(Boolean);
      }
    } else if (rawText.includes("(Member)") || rawText.includes("(Members)")) {
      const matches = rawText.matchAll(/([^(,]+)\s*\(Members?\)/gi);
      for (const m of matches) {
        if (m[1] && m[1].trim()) memberList.push(m[1].trim());
      }
    }
  }

  const isPlaceholder = !rawText || rawText.includes("—") || rawText.includes("not yet assigned") || rawText.includes("යවා නොමැත");
  const hasDetails = !!(chairmanName || memberList.length > 0 || (!isPlaceholder && rawText));

  return {
    chairmanName,
    chairmanNic,
    memberList,
    rawText: isPlaceholder ? "" : rawText,
    hasDetails
  };
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
      if (e.key === "Escape" && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSidebarOpen]);

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
            const activeNameClean = (activeProfile.full_name || "").trim().toLowerCase();

            // 1. Fetch letters from dcmms_daily_mail
            const { data: letters, error: lettersError } = await supabase
              .from("dcmms_daily_mail")
              .select("ref_no, received_date, letter_date, created_at, officer_name, subject, priority");

            if (lettersError) throw lettersError;

            // 2. Fetch assignments from dcmms_subject_assignments
            const { data: assignmentsData } = await supabase
              .from("dcmms_subject_assignments")
              .select("*");

            // 3. Fetch subsequent mails from dcmms_subsequent_mails
            const { data: subsequentData } = await supabase
              .from("dcmms_subsequent_mails")
              .select("case_no, mail_officer_name, received_date");

            const refToReceivedDate = new Map<string, string>();
            const refToLetterDate = new Map<string, string>();
            const refToCreatedAt = new Map<string, string>();
            const refToMailMeta = new Map<string, { subject?: string; priority?: string }>();

            const isOfficerMatched = (targetName: string) => {
              if (!activeNameClean) return true;
              if (!targetName || typeof targetName !== "string" || !targetName.trim()) return false;
              const cleanTarget = targetName.trim().toLowerCase();
              const isGenericTarget =
                cleanTarget === "subject officer" ||
                cleanTarget === "විෂය නිලධාරී" ||
                cleanTarget === "පවරන ලද විෂය භාර නිලධාරී" ||
                cleanTarget === "assigned subject officer" ||
                cleanTarget === "unassigned";
              const isGenericActive =
                activeNameClean === "subject officer" ||
                activeNameClean === "විෂය නිලධාරී" ||
                activeNameClean === "පවරන ලද විෂය භාර නිලධාරී" ||
                activeNameClean === "assigned subject officer";

              if (isGenericTarget || isGenericActive) return true;

              return (
                cleanTarget === activeNameClean ||
                cleanTarget.includes(activeNameClean) ||
                activeNameClean.includes(cleanTarget)
              );
            };

            if (letters) {
              letters.forEach((l: any) => {
                if (l.ref_no && isOfficerMatched(l.officer_name)) {
                  refToReceivedDate.set(l.ref_no, l.received_date);
                  if (l.letter_date) refToLetterDate.set(l.ref_no, l.letter_date);
                  if (l.created_at) refToCreatedAt.set(l.ref_no, l.created_at);
                  refToMailMeta.set(l.ref_no, { subject: l.subject, priority: l.priority });
                }
              });
            }

            if (assignmentsData) {
              assignmentsData.forEach((a: any) => {
                const asgnOfficer = a.subject_officer_name || a.subjectOfficerName || "";
                const isMatch = isOfficerMatched(asgnOfficer);

                if (a.case_no && isMatch) {
                  if (!refToReceivedDate.has(a.case_no)) {
                    refToReceivedDate.set(a.case_no, new Date().toISOString().split("T")[0]);
                  }
                }
              });
            }

            if (subsequentData) {
              subsequentData.forEach((m: any) => {
                if (m.case_no && isOfficerMatched(m.mail_officer_name)) {
                  if (!refToReceivedDate.has(m.case_no)) {
                    refToReceivedDate.set(m.case_no, m.received_date || new Date().toISOString().split("T")[0]);
                  }
                }
              });
            }

            // 4. Fetch dcmms_subject directly for matching cases
            const { data: directCases } = await supabase
              .from("dcmms_subject")
              .select("*");

            if (directCases) {
              directCases.forEach((item: any) => {
                const sOfficer = item.officer_name || item.assigned_officer || item.subject_officer || item.subject_officer_name || "";
                if (item.case_no && isOfficerMatched(sOfficer)) {
                  if (!refToReceivedDate.has(item.case_no)) {
                    refToReceivedDate.set(item.case_no, item.assigned_date || new Date().toISOString().split("T")[0]);
                  }
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
              const { data: detailsData } = await supabase
                .from("dcmms_subject_details")
                .select("case_no")
                .in("case_no", assignedRefNos);

              const casesWithDetails = new Set(detailsData ? detailsData.map((d: any) => d.case_no) : []);
              const fetchedCaseNos = new Set(casesData ? casesData.map((c: any) => c.case_no) : []);

              const mapped: Case[] = [];

              if (casesData) {
                casesData.forEach((item: any) => {
                  mapped.push({
                    id: item.id,
                    caseNo: item.case_no,
                    assignedDate: item.assigned_date,
                    receivedDate: refToReceivedDate.get(item.case_no) || item.assigned_date,
                    letterDate: refToLetterDate.get(item.case_no) || item.letter_date || refToReceivedDate.get(item.case_no) || item.assigned_date,
                    createdAt: item.created_at || refToCreatedAt.get(item.case_no),
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
                  });
                });
              }

              // Fallback for ref_nos that are assigned to this officer but don't have a row in dcmms_subject yet
              assignedRefNos.forEach((refNo) => {
                if (!fetchedCaseNos.has(refNo)) {
                  const meta = refToMailMeta.get(refNo) || {};
                  mapped.push({
                    id: `case-${refNo}`,
                    caseNo: refNo,
                    assignedDate: refToReceivedDate.get(refNo) || new Date().toISOString().split("T")[0],
                    receivedDate: refToReceivedDate.get(refNo) || new Date().toISOString().split("T")[0],
                    letterDate: refToLetterDate.get(refNo) || refToReceivedDate.get(refNo) || new Date().toISOString().split("T")[0],
                    createdAt: refToCreatedAt.get(refNo) || new Date().toISOString(),
                    subject: meta.subject || `Assigned Case (${refNo})`,
                    priority: (meta.priority as any) || "medium",
                    status: "In Progress",
                    isOld: casesWithDetails.has(refNo),
                  });
                }
              });

              mapped.sort((a: any, b: any) => {
                const timeA = new Date(a.createdAt || 0).getTime();
                const timeB = new Date(b.createdAt || 0).getTime();
                if (timeA !== timeB) {
                  return timeB - timeA;
                }
                const dateA = new Date(a.letterDate || a.receivedDate || a.assignedDate || 0).getTime();
                const dateB = new Date(b.letterDate || b.receivedDate || b.assignedDate || 0).getTime();
                return dateB - dateA;
              });

              setCases(mapped);
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
        const storedAsgns = localStorage.getItem("dcmms_subject_assignments");
        let activeName = profile?.full_name || t("subjectName");
        const activeNameClean = activeName.trim().toLowerCase();

        if (storedCases || storedLetters || storedAsgns) {
          try {
            const casesList = storedCases ? JSON.parse(storedCases) : [];
            const lettersList = storedLetters ? JSON.parse(storedLetters) : [];
            const asgnsList = storedAsgns ? JSON.parse(storedAsgns) : [];

            // Filter letters/assignments assigned to the active name
            const refToReceivedDate = new Map<string, string>();

            const refToLetterDate = new Map<string, string>();

            lettersList
              .filter((l: any) => {
                const name = (l.officerName || "").trim().toLowerCase();
                return name === activeNameClean || (name && activeNameClean.includes(name)) || (name && name.includes(activeNameClean));
              })
              .forEach((l: any) => {
                if (l.refNo) {
                  refToReceivedDate.set(l.refNo, l.receivedDate);
                  if (l.letterDate || l.letter_date) {
                    refToLetterDate.set(l.refNo, l.letterDate || l.letter_date);
                  }
                }
              });

            asgnsList
              .filter((a: any) => {
                const name = (a.subjectOfficerName || a.subject_officer_name || "").trim().toLowerCase();
                const asgnText = (typeof a.assignedOfficers === "string" ? a.assignedOfficers : (typeof a.assigned_officers === "string" ? a.assigned_officers : JSON.stringify(a.assignedOfficers || a.assigned_officers || ""))).trim().toLowerCase();
                const chairmanName = (a.chairman?.fullName || a.chairman?.name || "").trim().toLowerCase();
                const memberNames = Array.isArray(a.members) ? a.members.map((m: any) => (m.fullName || m.name || "").trim().toLowerCase()).join(" ") : "";
                const fullText = `${name} ${asgnText} ${chairmanName} ${memberNames}`;

                return (
                  name === activeNameClean || 
                  (name && activeNameClean.includes(name)) || 
                  (name && name.includes(activeNameClean)) ||
                  (activeNameClean && fullText.includes(activeNameClean))
                );
              })
              .forEach((a: any) => {
                const targetCaseNo = a.caseNo || a.case_no;
                if (targetCaseNo && !refToReceivedDate.has(targetCaseNo)) {
                  refToReceivedDate.set(targetCaseNo, new Date().toISOString().split("T")[0]);
                }
              });

            casesList.forEach((c: any) => {
              const cOfficer = (c.assignedTo || c.officerName || c.subjectOfficerName || "").trim().toLowerCase();
              const targetCaseNo = c.caseNo || c.refNo;
              if (targetCaseNo && (cOfficer === activeNameClean || (cOfficer && activeNameClean.includes(cOfficer)) || (cOfficer && cOfficer.includes(activeNameClean)))) {
                if (!refToReceivedDate.has(targetCaseNo)) {
                  refToReceivedDate.set(targetCaseNo, c.targetDate || c.assignedDate || new Date().toISOString().split("T")[0]);
                }
              }
            });

            if (refToReceivedDate.size === 0) {
              casesList.forEach((c: any) => {
                const targetCaseNo = c.caseNo || c.refNo;
                if (targetCaseNo) refToReceivedDate.set(targetCaseNo, c.targetDate || c.assignedDate || new Date().toISOString().split("T")[0]);
              });
            }

            const finalRefNos = Array.from(refToReceivedDate.keys());

            // Check actions in localStorage
            const storedActions = localStorage.getItem("dcmms_new_letter_current_case") || "[]";
            let actionsList = [];
            try { actionsList = JSON.parse(storedActions); } catch (e) { }
            const casesWithActions = new Set(
              Array.isArray(actionsList)
                ? actionsList.map((a: any) => a.caseNo)
                : []
            );

            // Filter cases matching finalRefNos or load casesList
            const existingCaseNos = new Set(casesList.map((c: any) => c.caseNo));
            let filtered = casesList
              .filter((c: any) => finalRefNos.length === 0 || finalRefNos.includes(c.caseNo) || finalRefNos.includes(c.refNo))
              .map((c: any) => ({
                ...c,
                receivedDate: refToReceivedDate.get(c.caseNo) || c.assignedDate,
                letterDate: refToLetterDate.get(c.caseNo) || c.letterDate || c.letter_date || refToReceivedDate.get(c.caseNo) || c.assignedDate,
                isOld: c.isOld !== undefined ? c.isOld : (casesWithActions.has(c.caseNo) || c.status === "Closed" || c.status === "Pending"),
              }));

            if (filtered.length === 0 && casesList.length > 0) {
              filtered = casesList.map((c: any) => ({
                ...c,
                receivedDate: c.assignedDate || new Date().toISOString().split("T")[0],
                letterDate: c.letterDate || c.assignedDate || new Date().toISOString().split("T")[0],
              }));
            }

            // Fallback for missing cases in localStorage
            finalRefNos.forEach((refNo) => {
              if (!existingCaseNos.has(refNo)) {
                const matchingLetter = lettersList.find((l: any) => l.refNo === refNo);
                filtered.push({
                  id: `case-${refNo}`,
                  caseNo: refNo,
                  assignedDate: refToReceivedDate.get(refNo) || new Date().toISOString().split("T")[0],
                  receivedDate: refToReceivedDate.get(refNo) || new Date().toISOString().split("T")[0],
                  letterDate: refToLetterDate.get(refNo) || matchingLetter?.letterDate || matchingLetter?.letter_date || refToReceivedDate.get(refNo) || new Date().toISOString().split("T")[0],
                  subject: matchingLetter?.subject || `Assigned Case (${refNo})`,
                  priority: matchingLetter?.priority || "medium",
                  status: "In Progress",
                  isOld: casesWithActions.has(refNo),
                });
              }
            });

            if (filtered.length === 0) {
              filtered = [
                {
                  id: "case-INQ/2026/001",
                  caseNo: "INQ/2026/001",
                  assignedDate: "2026-07-28",
                  receivedDate: "2026-07-28",
                  letterDate: "2026-07-28",
                  subject: "Formal disciplinary inquiry - Student misconduct at Royal College",
                  priority: "high",
                  status: "In Progress",
                  isOld: true,
                },
                {
                  id: "case-INQ/2026/002",
                  caseNo: "INQ/2026/002",
                  assignedDate: "2026-08-05",
                  receivedDate: "2026-08-05",
                  letterDate: "2026-08-05",
                  subject: "Preliminary investigation on teacher absenteeism - Jaffna Office",
                  priority: "medium",
                  status: "In Progress",
                  isOld: false,
                },
                {
                  id: "case-INQ/2026/003",
                  caseNo: "INQ/2026/003",
                  assignedDate: "2026-08-12",
                  receivedDate: "2026-08-12",
                  letterDate: "2026-08-12",
                  subject: "Inquiry into safety guidelines violation - Annual Sports Meet",
                  priority: "low",
                  status: "In Progress",
                  isOld: false,
                },
              ];
            }

            filtered.sort((a: any, b: any) => {
              const timeA = new Date(a.createdAt || a.created_at || 0).getTime();
              const timeB = new Date(b.createdAt || b.created_at || 0).getTime();
              if (timeA !== timeB) {
                return timeB - timeA;
              }
              const dateA = new Date(a.letterDate || a.receivedDate || a.assignedDate || 0).getTime();
const dateB = new Date(b.letterDate || b.receivedDate || b.assignedDate || 0).getTime();
              return dateB - dateA;
            });
            setCases(filtered);
          } catch (e) {
            console.error("Error parsing localStorage fallback data");
          }
        }
      }
    };

    fetchCases();

    const handleSyncAll = () => {
      fetchCases();
      if (typeof fetchAssignments === "function") {
        fetchAssignments();
      }
    };

    const channel = supabase
      .channel("subject-realtime-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_subject" }, handleSyncAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_daily_mail" }, handleSyncAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_subject_assignments" }, handleSyncAll)
      .subscribe();

    const interval = setInterval(handleSyncAll, 2_500);

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === "dcmms_subject_assignments" || e.key === "dcmms_cases" || e.key === "dcmms_letters") {
        handleSyncAll();
      }
    };

    window.addEventListener("storage", handleStorageEvent);
    window.addEventListener("dcmms_assignment_updated", handleSyncAll);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageEvent);
      window.removeEventListener("dcmms_assignment_updated", handleSyncAll);
    };
  }, [profile, t]);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "high" | "medium" | "low">("all");

  // Subject Officer Assignment Data Flow State & Handlers
  const [assignments, setAssignments] = useState<any[]>([]);
  const [draftDates, setDraftDates] = useState<Record<string, { appointmentDate?: string; reportDueDate?: string }>>({});
  const draftDatesRef = useRef<Record<string, { appointmentDate?: string; reportDueDate?: string }>>({});

  useEffect(() => {
    draftDatesRef.current = draftDates;
  }, [draftDates]);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [activeAssignment, setActiveAssignment] = useState<any>(null);
  const [reportDateForm, setReportDateForm] = useState(new Date().toISOString().slice(0, 10));
  const [reportContentForm, setReportContentForm] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [isDirectivesSectionMinimized, setIsDirectivesSectionMinimized] = useState(false);
  const [minimizedCaseIds, setMinimizedCaseIds] = useState<Record<string, boolean>>({});

  const toggleCaseMinimize = (caseId: string) => {
    setMinimizedCaseIds((prev) => ({
      ...prev,
      [caseId]: !prev[caseId]
    }));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  const fetchAssignments = async () => {
    let list: any[] = [];
    if (isSupabaseConfigured) {
      try {
        const { data: dbAsgns } = await supabase.from("dcmms_subject_assignments").select("*");
        const { data: dbDetails } = await supabase.from("dcmms_subject_details").select("*");

        const detailsByCase: Record<string, any> = {};
        if (dbDetails && dbDetails.length > 0) {
          dbDetails.forEach((d: any) => {
            const cNo = d.case_no || d.ref_no;
            if (cNo && (d.report_state === "Committee Details Sent" || d.special_notes?.includes("Chairman:") || d.step_taken?.includes("Chairman:"))) {
              detailsByCase[cNo] = d;
            }
          });
        }

        if (dbAsgns && dbAsgns.length > 0) {
          list = dbAsgns.map((a: any) => {
            const caseNo = a.case_no || a.caseNo;
            const det = detailsByCase[caseNo];

            let rawOfficers = a.assigned_officers || a.assignedOfficers || "";
            let text = Array.isArray(rawOfficers) ? rawOfficers.filter(Boolean).join(" | ") : String(rawOfficers || "");
            let chairman = a.chairman;
            let members = a.members;

            if (!text && det) {
              text = det.special_notes || det.step_taken || "";
            }

            if (!text && (chairman || members)) {
              const chairmanPart = chairman ? `Chairman: ${chairman.fullName || chairman.name}` : "";
              const membersPart = Array.isArray(members) && members.length > 0 ? `Members: ${members.map((m: any) => m.fullName || m.name).join(", ")}` : "";
              text = [chairmanPart, membersPart].filter(Boolean).join(" | ");
            }

            return {
              id: a.id,
              caseNo,
              subjectOfficerName: a.subject_officer_name || a.subjectOfficerName || det?.subject_officer_name || det?.officer_name,
              assignedOfficers: text,
              chairman: chairman,
              members: members,
              appointmentDate: formatToInputDate(a.appointment_date || a.appointmentDate),
              reportDueDate: formatToInputDate(a.report_due_date || a.reportDueDate),
              extensionTerm: a.extension_term || a.extensionTerm,
              extensionStartDate: a.extension_start_date || a.extensionStartDate,
              extensionEndDate: a.extension_end_date || a.extensionEndDate,
              extensionApprovalStatus: a.extension_approval_status || a.extensionApprovalStatus,
              extensionDecisionDate: a.extension_decision_date || a.extensionDecisionDate,
              extensionRequestedByAdmin: !!(a.extension_requested_by_admin || a.extensionRequestedByAdmin),
              extensionSubmittedBySubject: !!(a.extension_submitted_by_subject || a.extensionSubmittedBySubject),
              certificationSubmitted: a.certification_submitted || a.certificationSubmitted,
              reportSubmitDate: a.report_submit_date || a.reportSubmitDate,
              reportContent: a.report_content || a.reportContent,
              afterInvestigationSent: a.after_investigation_sent || a.afterInvestigationSent,
              afterInvestigationDate: a.after_investigation_date || a.afterInvestigationDate,
              investigationFileNo: a.investigation_file_no || a.investigationFileNo,
              investigationStatus: a.investigation_status || a.investigationStatus,
              investigationNotes: a.investigation_notes || a.investigationNotes,
              progressDetails: a.progress_details || a.progressDetails,
              status: a.status,
              datesSubmittedBySubject: !!((a.appointment_date || a.appointmentDate) && (a.report_due_date || a.reportDueDate)),
            };
          });
        }

        if (dbDetails && dbDetails.length > 0) {
          dbDetails.forEach((d: any) => {
            const cNo = d.case_no || d.ref_no;
            if (cNo && (d.report_state === "Committee Details Sent" || d.special_notes?.includes("Chairman:") || d.step_taken?.includes("Chairman:"))) {
              const idx = list.findIndex((a) => a.caseNo === cNo);
              if (idx < 0) {
                list.push({
                  id: `asgn-${cNo}`,
                  caseNo: cNo,
                  subjectOfficerName: d.subject_officer_name || d.officer_name || "Subject Officer",
                  assignedOfficers: d.special_notes || d.step_taken || "",
                  chairman: null,
                  members: [],
                  status: "Committee Details Sent to Subject Officer",
                  committeeSent: true,
                  datesSubmittedBySubject: false,
                });
              }
            }
          });
        }
      } catch (e) {}
    }

    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("dcmms_subject_assignments");
        if (stored) {
          const localList = JSON.parse(stored);
          if (Array.isArray(localList)) {
            localList.forEach((la: any) => {
              let text = la.assignedOfficers || la.assigned_officers || "";
              if (!text && (la.chairman || la.members)) {
                const chairmanPart = la.chairman ? `Chairman: ${la.chairman.fullName || la.chairman.name}` : "";
                const membersPart = Array.isArray(la.members) && la.members.length > 0 ? `Members: ${la.members.map((m: any) => m.fullName || m.name).join(", ")}` : "";
                text = [chairmanPart, membersPart].filter(Boolean).join(" | ");
              }
              const targetCaseNo = String(la.caseNo || la.case_no || "").trim().toLowerCase();
              const idx = list.findIndex((a) => String(a.caseNo || a.case_no || "").trim().toLowerCase() === targetCaseNo);
              
              const normExtTerm = la.extensionTerm || la.extension_term;
              const normExtStart = la.extensionStartDate || la.extension_start_date;
              const normExtEnd = la.extensionEndDate || la.extension_end_date;
              const normExtApproval = la.extensionApprovalStatus || la.extension_approval_status;
              const normExtReq = la.extensionRequestedByAdmin !== undefined ? la.extensionRequestedByAdmin : la.extension_requested_by_admin;

              if (idx >= 0) {
                list[idx] = { 
                  ...list[idx], 
                  ...la, 
                  assignedOfficers: text || list[idx].assignedOfficers,
                  appointmentDate: formatToInputDate(la.appointmentDate || la.appointment_date || list[idx].appointmentDate),
                  reportDueDate: formatToInputDate(la.reportDueDate || la.report_due_date || list[idx].reportDueDate),
                  extensionTerm: normExtTerm || list[idx].extensionTerm,
                  extensionStartDate: normExtStart || list[idx].extensionStartDate,
                  extensionEndDate: normExtEnd || list[idx].extensionEndDate,
                  extensionApprovalStatus: normExtApproval !== undefined ? normExtApproval : list[idx].extensionApprovalStatus,
                  extensionRequestedByAdmin: normExtReq !== undefined ? !!normExtReq : list[idx].extensionRequestedByAdmin,
                };
              } else {
                list.push({ 
                  ...la, 
                  caseNo: la.caseNo || la.case_no,
                  assignedOfficers: text,
                  appointmentDate: formatToInputDate(la.appointmentDate || la.appointment_date),
                  reportDueDate: formatToInputDate(la.reportDueDate || la.report_due_date),
                  extensionTerm: normExtTerm,
                  extensionStartDate: normExtStart,
                  extensionEndDate: normExtEnd,
                  extensionApprovalStatus: normExtApproval,
                  extensionRequestedByAdmin: !!normExtReq,
                });
              }
            });
          }
        }
      } catch (e) {}
    }

    let activeName = profile?.full_name || t("subjectName");
    const activeNameClean = (activeName || "").trim().toLowerCase();

    // Auto-synthesize assignment directives from dcmms_cases / cases state if not in list
    if (typeof window !== "undefined") {
      try {
        const storedCases = localStorage.getItem("dcmms_cases");
        if (storedCases) {
          const casesList = JSON.parse(storedCases);
          if (Array.isArray(casesList)) {
            casesList.forEach((c: any) => {
              const targetCaseNo = String(c.caseNo || c.refNo || "").trim().toLowerCase();
              const idx = list.findIndex((a: any) => String(a.caseNo || a.case_no || "").trim().toLowerCase() === targetCaseNo);
              const extTerm = c.extensionTerm || c.extension_term;
              const extStart = c.extensionStartDate || c.extension_start_date;
              const extEnd = c.extensionEndDate || c.extension_end_date;
              const extReq = c.extensionRequested || c.extensionRequestedByAdmin || c.extension_requested_by_admin;
              const extApprove = c.extensionApprovalStatus || c.extension_approval_status;
              const extDate = c.extensionDecisionDate || c.extension_decision_date;

              if (idx >= 0) {
                if (extTerm) list[idx].extensionTerm = extTerm;
                if (extStart) list[idx].extensionStartDate = extStart;
                if (extEnd) {
                  list[idx].extensionEndDate = extEnd;
                  list[idx].reportDueDate = extEnd;
                }
                if (extReq) list[idx].extensionRequestedByAdmin = true;
                if (extApprove) list[idx].extensionApprovalStatus = extApprove;
                if (extDate) list[idx].extensionDecisionDate = extDate;
              } else if (targetCaseNo && (c.assignedOfficers || c.chairman || c.members || c.committeeDetails || c.status === "Committee Details Sent" || extReq || extStart)) {
                const chairmanPart = c.chairman ? `Chairman: ${c.chairman.fullName || c.chairman.name}` : "";
                const membersPart = Array.isArray(c.members) && c.members.length > 0 ? `Members: ${c.members.map((m: any) => m.fullName || m.name).join(", ")}` : "";
                const formattedText = c.assignedOfficers || [chairmanPart, membersPart].filter(Boolean).join(" | ") || "Investigation Committee Assigned";
                list.push({
                  id: `asgn-${c.caseNo || c.refNo}`,
                  caseNo: c.caseNo || c.refNo,
                  subjectOfficerName: c.subjectOfficerName || c.assignedTo || c.subjectOfficer || activeName || "Subject Officer",
                  assignedOfficers: formattedText,
                  chairman: c.chairman || null,
                  members: c.members || [],
                  extensionTerm: extTerm,
                  extensionStartDate: extStart,
                  extensionEndDate: extEnd,
                  appointmentDate: formatToInputDate(c.appointmentDate || c.appointment_date),
                  reportDueDate: formatToInputDate(extEnd || c.reportDueDate || c.report_due_date),
                  extensionApprovalStatus: extApprove || "Approved",
                  extensionDecisionDate: extDate,
                  extensionRequestedByAdmin: !!extReq,
                  status: c.status || "Committee Details Sent to Subject Officer",
                  committeeSent: true,
                  datesSubmittedBySubject: false,
                });
              }
            });
          }
        }
      } catch (e) {}

      try {
        const storedLetters = localStorage.getItem("dcmms_letters");
        if (storedLetters) {
          const lettersList = JSON.parse(storedLetters);
          if (Array.isArray(lettersList)) {
            lettersList.forEach((l: any) => {
              const targetCaseNo = String(l.refNo || l.caseNo || "").trim().toLowerCase();
              const extTerm = l.extensionTerm || l.extension_term;
              const extStart = l.extensionStartDate || l.extension_start_date;
              const extEnd = l.extensionEndDate || l.extension_end_date;
              const extReq = l.extensionRequested || l.extensionRequestedByAdmin || l.extension_requested_by_admin;
              const extApprove = l.extensionApprovalStatus || l.extension_approval_status;
              const extDate = l.extensionDecisionDate || l.extension_decision_date;

              if (targetCaseNo && (extTerm || extStart || extReq || extEnd)) {
                const idx = list.findIndex((a: any) => String(a.caseNo || a.case_no || "").trim().toLowerCase() === targetCaseNo);
                if (idx >= 0) {
                  if (extTerm) list[idx].extensionTerm = extTerm;
                  if (extStart) list[idx].extensionStartDate = extStart;
                  if (extEnd) {
                    list[idx].extensionEndDate = extEnd;
                    list[idx].reportDueDate = extEnd;
                  }
                  if (extReq) list[idx].extensionRequestedByAdmin = true;
                  if (extApprove) list[idx].extensionApprovalStatus = extApprove;
                  if (extDate) list[idx].extensionDecisionDate = extDate;
                }
              }
            });
          }
        }
      } catch (e) {}
    }

    if (list.length > 0) {
      const relevant = list.filter((a: any) => {
        const asgnOfficers = a.assignedOfficers || a.assigned_officers;
        const hasArrayOfficers = Array.isArray(asgnOfficers) && asgnOfficers.length > 0;
        const hasStringOfficers = typeof asgnOfficers === "string" && asgnOfficers.trim().length > 0 && asgnOfficers.trim() !== "[]" && asgnOfficers.trim() !== "null";
        const hasChairman = !!(a.chairman?.fullName || a.chairman?.name || (typeof a.chairman === "string" && a.chairman.trim().length > 0));
        const hasMembers = Array.isArray(a.members) && a.members.length > 0;
        const hasDatesOrAdminFlag = !!(a.officersAssignedByAdmin || a.appointmentDate || a.reportDueDate || a.appointment_date || a.report_due_date || a.committeeSent || a.committee_sent || a.status || a.extensionStartDate || a.extension_start_date || a.extensionTerm || a.extension_term || a.extensionRequestedByAdmin);

        const hasOfficersAssigned = hasArrayOfficers || hasStringOfficers || hasChairman || hasMembers || hasDatesOrAdminFlag;

        if (!hasOfficersAssigned) return false;

        const officer = (a.subjectOfficerName || a.subject_officer_name || "").trim().toLowerCase();

        const isGenericOfficer =
          !officer ||
          officer === "subject officer" ||
          officer === "විෂය නිලධාරී" ||
          officer === "පවරන ලද විෂය භාර නිලධාරී" ||
          officer === "assigned subject officer" ||
          officer === "unassigned";

        const isGenericActive =
          !activeNameClean ||
          activeNameClean === "subject officer" ||
          activeNameClean === "විෂය නිලධාරී" ||
          activeNameClean === "පවරන ලද විෂය භාර නිලධාරී" ||
          activeNameClean === "assigned subject officer";

        const hasExtensionDetails = !!(
          a.extensionRequestedByAdmin ||
          a.extension_requested_by_admin ||
          a.extensionRequested ||
          a.extensionStartDate ||
          a.extension_start_date ||
          a.extensionEndDate ||
          a.extension_end_date ||
          (a.extensionTerm && a.extensionTerm !== "None") ||
          (a.extension_term && a.extension_term !== "None") ||
          a.extensionApprovalStatus ||
          a.extension_approval_status ||
          (a.status && String(a.status).toLowerCase().includes("extension"))
        );

        if (hasExtensionDetails || isGenericOfficer || isGenericActive) return true;

        return (
          officer === activeNameClean ||
          officer.includes(activeNameClean) ||
          activeNameClean.includes(officer)
        );
      });

      const mergedRelevant = relevant.map((a: any) => {
        const caseKey = a.caseNo || a.id;
        const currentDrafts = draftDatesRef.current;
        const draft = (caseKey && currentDrafts[caseKey]) || (a.id && currentDrafts[a.id]) || (a.caseNo && currentDrafts[a.caseNo]);
        const appt = draft?.appointmentDate !== undefined ? draft.appointmentDate : formatToInputDate(a.appointmentDate || a.appointment_date);
        const due = draft?.reportDueDate !== undefined ? draft.reportDueDate : formatToInputDate(a.reportDueDate || a.report_due_date);
        return {
          ...a,
          appointmentDate: appt,
          reportDueDate: due,
        };
      });

      setAssignments(mergedRelevant);
    } else {
      setAssignments([]);
    }
  };

  useEffect(() => {
    fetchAssignments();

    const channel = supabase
      .channel("subject-assignments-realtime-channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_subject_assignments" }, fetchAssignments)
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_subject_details" }, fetchAssignments)
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_subject" }, fetchAssignments)
      .subscribe();

    const interval = setInterval(fetchAssignments, 2500);

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === "dcmms_subject_assignments" || e.key === "dcmms_cases" || e.key === "dcmms_letters") {
        fetchAssignments();
      }
    };

    window.addEventListener("storage", handleStorageEvent);
    window.addEventListener("dcmms_assignment_updated", fetchAssignments);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageEvent);
      window.removeEventListener("dcmms_assignment_updated", fetchAssignments);
    };
  }, [profile, t]);

  // Step 2 Handler: Subject Officer Submits Appointment Date & Report Due Date
  const handleStep2SubmitDates = (asgn: any, appointmentDate: string, reportDueDate: string) => {
    const finalAppt = formatToInputDate(appointmentDate);
    const finalDue = formatToInputDate(reportDueDate);

    if (!finalAppt || !finalDue) {
      showToast("Please select both Appointment Date and Report Due Date!");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const updated = {
      ...asgn,
      appointmentDate: finalAppt,
      reportDueDate: finalDue,
      datesSubmittedBySubject: true,
      datesSubmitTimestamp: today,
      currentStep: 3,
      status: "Dates Confirmed",
      updatedAt: today,
    };

    const caseKey = asgn.caseNo || asgn.id;
    const updatedDrafts = { ...draftDatesRef.current };
    delete updatedDrafts[caseKey];
    if (asgn.id) delete updatedDrafts[asgn.id];
    if (asgn.caseNo) delete updatedDrafts[asgn.caseNo];
    draftDatesRef.current = updatedDrafts;
    setDraftDates(updatedDrafts);

    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("dcmms_subject_assignments") || "[]";
        let list = JSON.parse(stored);
        list = list.filter((a: any) => a.id !== asgn.id && a.caseNo !== asgn.caseNo);
        list.push(updated);
        localStorage.setItem("dcmms_subject_assignments", JSON.stringify(list));
      } catch (e) {}

      try {
        const storedCases = localStorage.getItem("dcmms_cases") || "[]";
        let cases = JSON.parse(storedCases);
        const matchKey = String(asgn.caseNo || "").trim().toLowerCase();
        const idx = cases.findIndex((c: any) => String(c.caseNo || c.refNo || "").trim().toLowerCase() === matchKey);
        if (idx >= 0) {
          cases[idx].appointmentDate = finalAppt;
          cases[idx].reportDueDate = finalDue;
          cases[idx].targetDate = finalDue;
          cases[idx].datesSubmittedBySubject = true;
          cases[idx].status = "Dates Confirmed";
        }
        localStorage.setItem("dcmms_cases", JSON.stringify(cases));
      } catch (e) {}

      try {
        const storedLetters = localStorage.getItem("dcmms_letters") || "[]";
        let letters = JSON.parse(storedLetters);
        const matchKey = String(asgn.caseNo || "").trim().toLowerCase();
        const idx = letters.findIndex((l: any) => String(l.refNo || l.caseNo || "").trim().toLowerCase() === matchKey);
        if (idx >= 0) {
          letters[idx].appointmentDate = finalAppt;
          letters[idx].reportDueDate = finalDue;
          letters[idx].datesSubmittedBySubject = true;
          letters[idx].status = "Dates Confirmed";
        }
        localStorage.setItem("dcmms_letters", JSON.stringify(letters));
      } catch (e) {}

      window.dispatchEvent(new CustomEvent("dcmms_assignment_updated"));
      window.dispatchEvent(new Event("storage"));
    }

    if (isSupabaseConfigured) {
      supabase.from("dcmms_subject_assignments").upsert({
        id: updated.id || `asgn-${updated.caseNo}`,
        case_no: updated.caseNo,
        subject_officer_name: updated.subjectOfficerName,
        assigned_officers: Array.isArray(updated.assignedOfficers) ? updated.assignedOfficers : (updated.assignedOfficers ? [updated.assignedOfficers] : null),
        chairman: updated.chairman || null,
        members: updated.members || null,
        appointment_date: finalAppt,
        report_due_date: finalDue,
        dates_submitted_by_subject: true,
        status: updated.status,
      }).then();
    }

    showToast("Step 2 Complete: Appointment Date & Report Due Date submitted to Investigation Administrator!");
    fetchAssignments();
  };

  // Step 3/4: Subject Officer Approves or Disapproves Extension Request
  const handleExtensionDecision = async (asgn: any, approved: boolean) => {
    const today = new Date().toISOString().slice(0, 10);
    const status = approved ? "Approved" : "Disapproved";
    const caseNo = asgn.caseNo || asgn.case_no;
    const extEnd = asgn.extensionEndDate || asgn.extension_end_date;

    const updated: any = {
      ...asgn,
      caseNo,
      extensionApprovalStatus: status,
      extensionDecisionDate: today,
      status: approved ? "Extension Approved" : "Extension Disapproved",
      updatedAt: today,
    };

    if (approved && extEnd) {
      updated.reportDueDate = extEnd;
      updated.report_due_date = extEnd;

      const dueId = `due-date-${asgn.id || caseNo}`;
      const dueEl = document.getElementById(dueId) as HTMLInputElement;
      if (dueEl) {
        dueEl.value = extEnd;
      }
    }

    setAssignments((prev) =>
      prev.map((item) =>
        (item.id === asgn.id || item.caseNo === caseNo || item.case_no === caseNo)
          ? { ...item, ...updated }
          : item
      )
    );

    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("dcmms_subject_assignments") || "[]";
        let list = JSON.parse(stored);
        list = list.filter((a: any) => (a.caseNo || a.case_no) !== caseNo);
        list.push(updated);
        localStorage.setItem("dcmms_subject_assignments", JSON.stringify(list));
      } catch (e) {}

      try {
        const storedLetters = localStorage.getItem("dcmms_letters") || "[]";
        let letters = JSON.parse(storedLetters);
        const idx = letters.findIndex((l: any) => l.refNo === caseNo || l.caseNo === caseNo);
        if (idx >= 0) {
          letters[idx].extensionApprovalStatus = status;
          letters[idx].extensionDecisionDate = today;
          letters[idx].status = approved ? "Extension Approved" : "Extension Disapproved";
          if (approved && extEnd) {
            letters[idx].reportDueDate = extEnd;
            letters[idx].report_due_date = extEnd;
          }
          localStorage.setItem("dcmms_letters", JSON.stringify(letters));
        }
      } catch (e) {}

      try {
        const storedCases = localStorage.getItem("dcmms_cases") || "[]";
        let cases = JSON.parse(storedCases);
        const idx = cases.findIndex((c: any) => c.caseNo === caseNo || c.refNo === caseNo);
        if (idx >= 0) {
          cases[idx].extensionApprovalStatus = status;
          cases[idx].extensionDecisionDate = today;
          cases[idx].status = approved ? "Extension Approved" : "Extension Disapproved";
          if (approved && extEnd) {
            cases[idx].reportDueDate = extEnd;
            cases[idx].report_due_date = extEnd;
          }
          localStorage.setItem("dcmms_cases", JSON.stringify(cases));
        }
      } catch (e) {}

      // Update calendar events in localStorage if approved — same pattern as syncCalendar for appointment date
      if (approved && extEnd) {
        try {
          const storedCal = localStorage.getItem("dcmms_calendar_events") || "[]";
          let calEvents = JSON.parse(storedCal);
          let updatedCal = false;
          calEvents = calEvents.map((ev: any) => {
            const evCase = ev.caseNo || ev.case_no || ev.refNo;
            if ((evCase === caseNo) && (ev.source === "Report Due Date" || ev.type === "report_due" || String(ev.summary || "").toLowerCase().includes("report due"))) {
              updatedCal = true;
              return { ...ev, date: extEnd, start: extEnd, end: extEnd, extensionApplied: true };
            }
            return ev;
          });
          if (!updatedCal) {
            calEvents.push({
              id: `ext-due-${caseNo}-${today}`,
              caseNo,
              case_no: caseNo,
              date: extEnd,
              start: extEnd,
              end: extEnd,
              summary: `Extension Due: ${caseNo}`,
              description: `Extended report due date for Case ${caseNo} after Officer in Charge approval.`,
              source: "Extension Due Date",
              type: "extension_due",
            });
          }
          localStorage.setItem("dcmms_calendar_events", JSON.stringify(calEvents));
        } catch (e) {}
      }

      window.dispatchEvent(new CustomEvent("dcmms_assignment_updated"));
      window.dispatchEvent(new Event("storage"));
    }

    if (isSupabaseConfigured) {
      try {
        await supabase.from("dcmms_subject_assignments").upsert({
          case_no: caseNo,
          subject_officer_name: updated.subjectOfficerName || updated.subject_officer_name || null,
          assigned_officers: Array.isArray(updated.assignedOfficers) ? updated.assignedOfficers : (updated.assignedOfficers ? [updated.assignedOfficers] : null),
          chairman: updated.chairman || null,
          members: updated.members || null,
          appointment_date: updated.appointmentDate || updated.appointment_date || null,
          report_due_date: (approved && extEnd) ? extEnd : (updated.reportDueDate || updated.report_due_date || null),
          extension_term: updated.extensionTerm || updated.extension_term,
          extension_start_date: updated.extensionStartDate || updated.extension_start_date,
          extension_end_date: updated.extensionEndDate || updated.extension_end_date,
          extension_requested_by_admin: true,
          extension_approval_status: status,
          extension_decision_date: today,
          certification_submitted: updated.certificationSubmitted || false,
          report_submit_date: updated.reportSubmitDate || null,
          report_content: updated.reportContent || null,
          status: updated.status,
        }, { onConflict: "case_no" });
      } catch (err) {
        console.warn("Supabase subject assignments update warning:", err);
      }

      try {
        const subUpdateObj: any = {
          status: updated.status,
        };
        if (approved && extEnd) {
          subUpdateObj.report_due_date = extEnd;
        }

        await supabase.from("dcmms_subject").update(subUpdateObj).eq("case_no", caseNo);
      } catch (err) {
        console.warn("Supabase subject update warning:", err);
      }

      try {
        const prelimUpdateObj: any = {
          extension_approval_status: status,
          extension_decision_date: today,
          status: approved ? "Extension Approved" : "Extension Disapproved",
        };
        if (approved && extEnd) {
          prelimUpdateObj.report_due_date = extEnd;
        }
        await supabase.from("dcmms_preliminary_investigations")
          .update(prelimUpdateObj)
          .eq("case_no", caseNo);
      } catch (err) {
        console.warn("Supabase prelim update warning:", err);
      }

      if (approved && extEnd) {
        try {
          await supabase.from("dcmms_calendar").upsert({
            id: `ext-due-${caseNo}`,
            case_no: caseNo,
            date: extEnd,
            summary: `Extension Due: ${caseNo}`,
            description: `Extended report due date for Case ${caseNo} approved by Subject Officer.`,
            source: "Extension Due Date",
          }, { onConflict: "id" });
        } catch (err) {
          console.warn("Supabase calendar update warning:", err);
        }
      }
    }

    showToast(
      approved
        ? (lang === "si" ? `දීර්ඝ කිරීම අනුමත කළා (වාර්තා දිනය ${extEnd || ""} දක්වා දීර්ඝ විය) — Admin වෙත යවා ඇත!` : `Extension Approved (Due date updated to ${extEnd || ""}) and sent to Investigation Admin!`)
        : (lang === "si" ? "දීර්ඝ කිරීම ප්‍රතික්ෂේප කළා — Admin වෙත යවා ඇත!" : "Extension Disapproved and sent to Investigation Admin!")
    );
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
        assigned_officers: Array.isArray(updated.assignedOfficers) ? updated.assignedOfficers : (updated.assignedOfficers ? [updated.assignedOfficers] : null),
        chairman: updated.chairman || null,
        members: updated.members || null,
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
        assigned_officers: Array.isArray(updated.assignedOfficers) ? updated.assignedOfficers : (updated.assignedOfficers ? [updated.assignedOfficers] : null),
        chairman: updated.chairman || null,
        members: updated.members || null,
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
          <section style={{ marginBottom: "24px" }}>
            {/* Section Header */}
            <div
              onClick={() => setIsDirectivesSectionMinimized(!isDirectivesSectionMinimized)}
              style={{
                background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
                borderRadius: isDirectivesSectionMinimized ? "16px" : "16px 16px 0 0",
                padding: "18px 24px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                userSelect: "none",
                transition: "border-radius 0.2s ease"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Send size={20} style={{ color: "#93c5fd" }} />
                <div>
                  <div style={{ color: "#ffffff", fontWeight: 700, fontSize: "15px" }}>
                    {lang === "si" ? "විමර්ශන නියෝග සහ සහතික කිරීම් — දත්ත ප්‍රවාහය" : "Investigation Directives & Data Flow"}
                  </div>
                  <div style={{ color: "#93c5fd", fontSize: "12px", marginTop: "2px" }}>
                    {lang === "si" ? "විෂය නිලධාරී ↔ විමර්ශන පරිපාලක | ක්‍රියාකාරකම් සහ අනුමතිය" : "Subject Officer ↔ Investigation Admin | Actions and approvals"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, padding: "4px 14px", borderRadius: "20px", backgroundColor: "rgba(255,255,255,0.15)", color: "#ffffff" }}>
                  {assignments.length} {lang === "si" ? "නඩු" : "Active Cases"}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDirectivesSectionMinimized(!isDirectivesSectionMinimized);
                  }}
                  title={isDirectivesSectionMinimized ? (lang === "si" ? "විහිදුවන්න (Expand)" : "Expand Section") : (lang === "si" ? "හකුලන්න (Minimize)" : "Minimize Section")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 14px",
                    borderRadius: "20px",
                    backgroundColor: "rgba(255,255,255,0.2)",
                    color: "#ffffff",
                    border: "1px solid rgba(255,255,255,0.35)",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 700,
                    transition: "all 0.2s ease"
                  }}
                >
                  {isDirectivesSectionMinimized ? (
                    <>
                      <ChevronDown size={15} />
                      <span>{lang === "si" ? "විහිදුවන්න" : "Expand"}</span>
                    </>
                  ) : (
                    <>
                      <ChevronUp size={15} />
                      <span>{lang === "si" ? "හකුලන්න" : "Minimize"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {!isDirectivesSectionMinimized && (
              <div style={{ backgroundColor: "#ffffff", borderRadius: "0 0 16px 16px", border: "1px solid #e2e8f0", borderTop: "none" }}>
                {assignments.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                    {assignments.map((asgn, asgnIdx) => {
                      const isDatesSubmitted = !!asgn.datesSubmittedBySubject;
                      const isExtensionRequested = !!(
                        (asgn.extensionStartDate && asgn.extensionEndDate) ||
                        asgn.extensionRequestedByAdmin ||
                        asgn.status === "Extension Requested" ||
                        asgn.extensionTerm
                      );
                      const extensionStatus = asgn.extensionApprovalStatus;
                      const hasAfterInvestigation = !!(asgn.afterInvestigationSent || asgn.investigationFileNo || asgn.investigationStatus);

                      const apptId = `app-date-${asgn.id}`;
                      const dueId = `due-date-${asgn.id}`;
                      const isCaseMinimized = !!minimizedCaseIds[asgn.id];

                      return (
                        <div key={asgn.id} style={{ borderBottom: asgnIdx < assignments.length - 1 ? "1px solid #f1f5f9" : "none", padding: "24px" }}>
                          
                          {/* Case Header */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isCaseMinimized ? "0" : "20px", flexWrap: "wrap", gap: "8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "linear-gradient(135deg, #1e3a5f, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <FileText size={20} style={{ color: "#ffffff" }} />
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: "16px", color: "#0f172a" }}>
                                  {lang === "si" ? "නඩු අංකය:" : "Case:"} {asgn.caseNo}
                                </div>
                                <div style={{ fontSize: "12px", color: "#64748b" }}>
                                  {lang === "si" ? "පවරන ලද විෂය භාර නිලධාරියා:" : "Assigned Subject Officer:"} <strong>{(!asgn.subjectOfficerName || asgn.subjectOfficerName.toLowerCase().includes("kumara") || asgn.subjectOfficerName === "Subject Officer" || asgn.subjectOfficerName === "විෂය නිලධාරී") ? (lang === "si" ? "පවරන ලද විෂය භාර නිලධාරී" : "Assigned Subject Officer") : asgn.subjectOfficerName}</strong>
                                </div>
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <span style={{ fontSize: "12px", fontWeight: 700, padding: "5px 14px", borderRadius: "20px", backgroundColor: hasAfterInvestigation ? "#dcfce7" : isDatesSubmitted ? "#dbeafe" : "#fef3c7", color: hasAfterInvestigation ? "#15803d" : isDatesSubmitted ? "#1d4ed8" : "#b45309" }}>
                                {hasAfterInvestigation ? (lang === "si" ? "✓ Step 5 — විමර්ශනය අවසන්" : "✓ Step 5 — After-Investigation Received") : isDatesSubmitted ? (lang === "si" ? "● Step 2 — දිනයන් තහවුරු කළා" : "● Step 2 — Dates Confirmed") : (lang === "si" ? "● Step 1 — නිලධාරීන් පත් කළා" : "● Step 1 — Officers Assigned")}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleCaseMinimize(asgn.id)}
                                title={isCaseMinimized ? (lang === "si" ? "විහිදුවන්න (Expand)" : "Expand Case") : (lang === "si" ? "හකුලන්න (Minimize)" : "Minimize Case")}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  padding: "5px 12px",
                                  borderRadius: "8px",
                                  backgroundColor: "#f1f5f9",
                                  color: "#334155",
                                  border: "1px solid #cbd5e1",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  transition: "all 0.2s ease"
                                }}
                              >
                                {isCaseMinimized ? (
                                  <>
                                    <ChevronDown size={14} />
                                    <span>{lang === "si" ? "විහිදුවන්න" : "Expand"}</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronUp size={14} />
                                    <span>{lang === "si" ? "හකුලන්න" : "Minimize"}</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Step Timeline */}
                          {!isCaseMinimized && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>

                              {/* ── STEP 1 ── Officers Assigned (Read-Only, from Admin) */}
                              <div style={{ display: "flex", gap: "16px" }}>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "36px" }}>
                                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg, #4f46e5, #6366f1)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "13px", flexShrink: 0 }}>1</div>
                                  <div style={{ width: "2px", flex: 1, minHeight: "16px", backgroundColor: "#4f46e5", marginTop: "4px", marginBottom: "4px" }} />
                                </div>
                                <div style={{ flex: 1, marginBottom: "16px" }}>
                                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e1b4b", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <span>{lang === "si" ? "1. පත් කළ විමර්ශන නිලධාරීන් (Admin විසින් යවන ලදී)" : "Step 1: Assigned Investigation Officers (Received from Admin)"}</span>
                                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", backgroundColor: "#dbeafe", color: "#1d4ed8" }}>✓ Received</span>
                                  </div>
                                  <div style={{ backgroundColor: "#f0f4ff", borderRadius: "10px", border: "1px solid #c7d2fe", padding: "12px 16px" }}>
                                    <div style={{ fontSize: "12px", color: "#3730a3", fontWeight: 600, marginBottom: "4px" }}>
                                      {lang === "si" ? "📋 නිලධාරීන් / කමිටුව:" : "📋 Investigation Committee:"}
                                    </div>
                                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e1b4b" }}>
                                      {(() => {
                                        const committee = parseCommitteeDetails(asgn);
                                        if (!committee.hasDetails) {
                                          return (
                                            <span style={{ color: "#64748b", fontWeight: 500, fontStyle: "italic" }}>
                                              {lang === "si" ? "— (නිලධාරීන් යවා නොමැත)" : "— (Officers not yet assigned)"}
                                            </span>
                                          );
                                        }

                                        return (
                                          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                                            {committee.chairmanName && (
                                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                                <span style={{ fontSize: "11px", backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "3px 10px", borderRadius: "12px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                                  👑 {lang === "si" ? "සභාපති" : "CHAIRMAN"}
                                                </span>
                                                <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "14px" }}>
                                                  {committee.chairmanName}
                                                </span>
                                                {committee.chairmanNic && (
                                                  <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>(NIC: {committee.chairmanNic})</span>
                                                )}
                                              </div>
                                            )}

                                            {committee.memberList.length > 0 && (
                                              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                                                <span style={{ fontSize: "11px", backgroundColor: "#e0e7ff", color: "#3730a3", border: "1px solid #c7d2fe", padding: "3px 10px", borderRadius: "12px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                                  👥 {lang === "si" ? `සාමාජිකයින් (${committee.memberList.length})` : `MEMBERS (${committee.memberList.length})`}
                                                </span>
                                                {committee.memberList.map((mName, idx) => (
                                                  <span key={idx} style={{ fontSize: "12px", backgroundColor: "#ffffff", border: "1px solid #cbd5e1", padding: "3px 10px", borderRadius: "6px", color: "#334155", fontWeight: 600 }}>
                                                    {mName}
                                                  </span>
                                                ))}
                                              </div>
                                            )}

                                            {!committee.chairmanName && committee.memberList.length === 0 && committee.rawText && (
                                              <span style={{ fontWeight: 700, color: "#0f172a" }}>
                                                {committee.rawText}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* ── STEP 2 ── Subject Officer Enters Appointment Date & Report Due Date */}
                              <div style={{ display: "flex", gap: "16px" }}>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "36px" }}>
                                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: isDatesSubmitted ? "#0284c7" : "#e2e8f0", color: isDatesSubmitted ? "#fff" : "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "13px", flexShrink: 0 }}>2</div>
                                  <div style={{ width: "2px", flex: 1, minHeight: "16px", backgroundColor: isDatesSubmitted ? "#0284c7" : "#e2e8f0", marginTop: "4px", marginBottom: "4px" }} />
                                </div>
                                <div style={{ flex: 1, marginBottom: "16px" }}>
                                  <div style={{ fontSize: "13px", fontWeight: 700, color: isDatesSubmitted ? "#0369a1" : "#1e293b", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <span>{lang === "si" ? "2. පත්වීම් ලිපිය දිනය සහ වාර්තා දිනය ඇතුළත් කරන්න" : "Step 2: Enter Appointment Letter Date & Report Due Date → Send to Admin"}</span>
                                    {isDatesSubmitted ? (
                                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", backgroundColor: "#dbeafe", color: "#1d4ed8" }}>✓ Sent</span>
                                    ) : (
                                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", backgroundColor: "#fef3c7", color: "#b45309" }}>{lang === "si" ? "⚡ ඔබේ ක්‍රියාව අවශ්‍යයි" : "⚡ Action Required"}</span>
                                    )}
                                  </div>
                                  <div style={{ backgroundColor: isDatesSubmitted ? "#f0f9ff" : "#f8fafc", borderRadius: "10px", border: `1px solid ${isDatesSubmitted ? "#bae6fd" : "#e2e8f0"}`, padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                                    {isDatesSubmitted && (
                                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "4px" }}>
                                        <div style={{ backgroundColor: "#ffffff", padding: "10px", borderRadius: "8px", border: "1px solid #bae6fd" }}>
                                          <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>📅 {lang === "si" ? "පත්වීම් ලිපිය දිනය" : "Appointment Letter Date"}</div>
                                          <div style={{ fontSize: "15px", fontWeight: 700, color: "#0369a1", marginTop: "2px" }}>{asgn.appointmentDate}</div>
                                        </div>
                                        <div style={{ backgroundColor: "#ffffff", padding: "10px", borderRadius: "8px", border: "1px solid #fecaca" }}>
                                          <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>⏳ {lang === "si" ? "වාර්තාව ලැබිය යුතු දිනය" : "Report Due Date"}</div>
                                          <div style={{ fontSize: "15px", fontWeight: 700, color: "#dc2626", marginTop: "2px" }}>{asgn.reportDueDate}</div>
                                        </div>
                                      </div>
                                    )}
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                      <div>
                                        <label style={{ fontSize: "11px", fontWeight: 700, color: "#0369a1", display: "block", marginBottom: "4px" }}>
                                          📅 {lang === "si" ? "පත්වීම් ලිපිය දිනය:" : "Appointment Letter Date:"}
                                        </label>
                                        <input
                                          type="date"
                                          id={apptId}
                                          value={formatToInputDate(asgn.appointmentDate)}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            const caseKey = asgn.caseNo || asgn.id;
                                            const currentDrafts = (draftDatesRef.current || {}) as Record<string, any>;
                                            const updated: Record<string, any> = {
                                              ...currentDrafts,
                                              [caseKey]: { ...(currentDrafts[caseKey] || {}), appointmentDate: val }
                                            };
                                            if (asgn.id) updated[asgn.id] = { ...(updated[asgn.id] || {}), appointmentDate: val };
                                            if (asgn.caseNo) updated[asgn.caseNo] = { ...(updated[asgn.caseNo] || {}), appointmentDate: val };
                                            draftDatesRef.current = updated;
                                            setDraftDates(updated);
                                            setAssignments((prev) =>
                                              prev.map((item) =>
                                                (item.id === asgn.id || item.caseNo === asgn.caseNo)
                                                  ? { ...item, appointmentDate: val, appointment_date: val }
                                                  : item
                                              )
                                            );
                                          }}
                                          style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #bae6fd", fontSize: "13px", backgroundColor: "#ffffff" }}
                                        />
                                      </div>
                                      <div>
                                        <label style={{ fontSize: "11px", fontWeight: 700, color: "#dc2626", display: "block", marginBottom: "4px" }}>
                                          ⏳ {lang === "si" ? "වාර්තාව ලැබිය යුතු දිනය:" : "Report Must Be Received By:"}
                                        </label>
                                        <input
                                          type="date"
                                          id={dueId}
                                          value={formatToInputDate(asgn.reportDueDate)}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            const caseKey = asgn.caseNo || asgn.id;
                                            setDraftDates((prev) => ({
                                              ...prev,
                                              [caseKey]: { ...(prev[caseKey] || {}), reportDueDate: val }
                                            }));
                                            setAssignments((prev) =>
                                              prev.map((item) =>
                                                (item.id === asgn.id || item.caseNo === asgn.caseNo)
                                                  ? { ...item, reportDueDate: val, report_due_date: val }
                                                  : item
                                              )
                                            );
                                          }}
                                          style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #fecaca", fontSize: "13px", backgroundColor: "#ffffff" }}
                                        />
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const appEl = document.getElementById(apptId) as HTMLInputElement;
                                        const dueEl = document.getElementById(dueId) as HTMLInputElement;
                                        handleStep2SubmitDates(asgn, appEl?.value || "", dueEl?.value || "");
                                      }}
                                      style={{ padding: "9px 18px", background: "linear-gradient(135deg, #0284c7, #0369a1)", color: "#ffffff", border: "none", borderRadius: "10px", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", width: "fit-content" }}
                                    >
                                      <Send size={14} />
                                      {isDatesSubmitted ? (lang === "si" ? "දිනයන් යාවත්කාලීන කරන්න (Step 2)" : "Update & Re-send Dates (Step 2)") : (lang === "si" ? "දිනයන් Admin වෙත යවන්න (Step 2)" : "Send Dates to Investigation Admin (Step 2)")}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* ── STEP 3 & 4 ── Extension of Days Details (Sent/Granted by Investigation Admin) */}
                              {(() => {
                                const extTerm = asgn.extensionTerm || asgn.extension_term;
                                const extStart = asgn.extensionStartDate || asgn.extension_start_date;
                                const extEnd = asgn.extensionEndDate || asgn.extension_end_date;
                                const extReq = asgn.extensionRequestedByAdmin || asgn.extension_requested_by_admin || asgn.extensionRequested;
                                const extensionStatus = asgn.extensionApprovalStatus || asgn.extension_approval_status;

                                const hasExtensionData = !!(
                                  extStart ||
                                  extEnd ||
                                  (extTerm && extTerm !== "None") ||
                                  extReq ||
                                  (asgn.status && String(asgn.status).toLowerCase().includes("extension"))
                                );

                                const isApproved = extensionStatus === "Approved";
                                const isDisapproved = extensionStatus === "Disapproved";
                                const isPending = hasExtensionData && !isApproved && !isDisapproved;

                                return (
                                  <div style={{ display: "flex", gap: "16px" }}>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "36px" }}>
                                      <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: isApproved ? "#16a34a" : isDisapproved ? "#dc2626" : hasExtensionData ? "#d97706" : "#cbd5e1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "12px", flexShrink: 0 }}>3/4</div>
                                      <div style={{ width: "2px", flex: 1, minHeight: "16px", backgroundColor: isApproved ? "#16a34a" : isDisapproved ? "#fca5a5" : hasExtensionData ? "#fde047" : "#e2e8f0", marginTop: "4px", marginBottom: "4px" }} />
                                    </div>
                                    <div style={{ flex: 1, marginBottom: "16px" }}>
                                      <div style={{ fontSize: "13px", fontWeight: 700, color: isApproved ? "#15803d" : isDisapproved ? "#b91c1c" : hasExtensionData ? "#b45309" : "#334155", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <span>{lang === "si" ? "3 & 4. දිනයන් දීර්ඝ කිරීමේ කොටස (Extension of Days Details)" : "Steps 3 & 4: Extension of Days Details"}</span>
                                        {isApproved ? (
                                          <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", backgroundColor: "#dcfce7", color: "#15803d" }}>
                                            ✓ {lang === "si" ? "අනුමත කරන ලදී (Extension Approved)" : "Extension Approved"}
                                          </span>
                                        ) : isDisapproved ? (
                                          <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", backgroundColor: "#fee2e2", color: "#b91c1c" }}>
                                            ✕ {lang === "si" ? "ප්‍රතික්ෂේප කරන ලදී (Extension Disapproved)" : "Extension Disapproved"}
                                          </span>
                                        ) : hasExtensionData ? (
                                          <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", backgroundColor: "#fef3c7", color: "#b45309" }}>
                                            ⏳ {lang === "si" ? "අනුමැතිය අපේක්ෂාවෙන් (Pending Approval)" : "Pending Approval"}
                                          </span>
                                        ) : (
                                          <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", backgroundColor: "#f1f5f9", color: "#64748b" }}>
                                            {lang === "si" ? "දීර්ඝ කිරීමක් නැත" : "No Extension Granted"}
                                          </span>
                                        )}
                                      </div>

                                      {hasExtensionData ? (
                                        <div style={{ backgroundColor: isApproved ? "#f0fdf4" : isDisapproved ? "#fef2f2" : "#fffbeb", borderRadius: "10px", border: `1px solid ${isApproved ? "#bbf7d0" : isDisapproved ? "#fca5a5" : "#fde68a"}`, padding: "14px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", fontSize: "12px" }}>
                                            <div style={{ backgroundColor: "#ffffff", padding: "10px", borderRadius: "8px", border: `1px solid ${isApproved ? "#bbf7d0" : isDisapproved ? "#fca5a5" : "#fde68a"}` }}>
                                              <div style={{ fontSize: "10px", color: isApproved ? "#166534" : isDisapproved ? "#991b1b" : "#92400e", fontWeight: 700, textTransform: "uppercase" }}>{lang === "si" ? "වාරය" : "Extension Term"}</div>
                                              <div style={{ fontWeight: 700, color: isApproved ? "#15803d" : isDisapproved ? "#b91c1c" : "#b45309", marginTop: "2px", fontSize: "13px" }}>{extTerm || "First"}</div>
                                            </div>
                                            <div style={{ backgroundColor: "#ffffff", padding: "10px", borderRadius: "8px", border: `1px solid ${isApproved ? "#bbf7d0" : isDisapproved ? "#fca5a5" : "#fde68a"}` }}>
                                              <div style={{ fontSize: "10px", color: isApproved ? "#166534" : isDisapproved ? "#991b1b" : "#92400e", fontWeight: 700, textTransform: "uppercase" }}>{lang === "si" ? "ආරම්භ දිනය" : "Start Date"}</div>
                                              <div style={{ fontWeight: 700, color: isApproved ? "#15803d" : isDisapproved ? "#b91c1c" : "#b45309", marginTop: "2px", fontSize: "13px" }}>{extStart || "—"}</div>
                                            </div>
                                            <div style={{ backgroundColor: "#ffffff", padding: "10px", borderRadius: "8px", border: `1px solid ${isApproved ? "#bbf7d0" : isDisapproved ? "#fca5a5" : "#fde68a"}` }}>
                                              <div style={{ fontSize: "10px", color: isApproved ? "#166534" : isDisapproved ? "#991b1b" : "#92400e", fontWeight: 700, textTransform: "uppercase" }}>{lang === "si" ? "අවසාන දිනය" : "End Date"}</div>
                                              <div style={{ fontWeight: 700, color: isApproved ? "#15803d" : isDisapproved ? "#b91c1c" : "#b45309", marginTop: "2px", fontSize: "13px" }}>{extEnd || "—"}</div>
                                            </div>
                                          </div>

                                          <div style={{ padding: "10px 14px", borderRadius: "8px", backgroundColor: isApproved ? "#dcfce7" : isDisapproved ? "#fee2e2" : "#fef3c7", color: isApproved ? "#15803d" : isDisapproved ? "#991b1b" : "#b45309", fontWeight: 700, fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
                                            {isApproved ? <CheckCircle size={16} /> : isDisapproved ? <XCircle size={16} /> : <Clock size={16} />}
                                            <span>
                                              {isApproved
                                                ? (lang === "si"
                                                  ? `විමර්ශන පරිපාලක විසින් ලබාදුන් දිනයන් දීර්ඝ කිරීම අනුමත කරන ලදී. වාර්තා ලබාදීමේ දිනය ${extEnd || ""} දක්වා දීර්ඝ කර ඇත.`
                                                  : `Extension of dates approved. Report due date extended to ${extEnd || ""}.`)
                                                : isDisapproved
                                                ? (lang === "si"
                                                  ? `දිනයන් දීර්ඝ කිරීමේ ඉල්ලීම ප්‍රතික්ෂේප කර ඇත.`
                                                  : `Extension request has been disapproved.`)
                                                : (lang === "si"
                                                  ? `විමර්ශන පරිපාලක (Investigation Admin) විසින් දිනයන් දීර්ඝ කිරීමේ තොරතුරු ලබා දී ඇත. කරුණාකර අනුමත කරන්න හෝ ප්‍රතික්ෂේප කරන්න.`
                                                  : `Extension dates proposed by Investigation Admin. Please review and approve or disapprove below.`)}
                                            </span>
                                          </div>

                                          {/* Action Buttons: Approve / Disapprove Buttons */}
                                          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "4px", flexWrap: "wrap" }}>
                                            <button
                                              type="button"
                                              onClick={() => handleExtensionDecision(asgn, true)}
                                              style={{
                                                padding: "8px 16px",
                                                borderRadius: "8px",
                                                backgroundColor: isApproved ? "#15803d" : "#16a34a",
                                                color: "#ffffff",
                                                border: "none",
                                                fontWeight: 700,
                                                fontSize: "13px",
                                                cursor: "pointer",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "6px",
                                                boxShadow: "0 2px 4px rgba(22,163,74,0.25)",
                                              }}
                                            >
                                              <CheckCircle size={16} />
                                              <span>{lang === "si" ? "අනුමත කරන්න (Approve)" : "Approve Extension"}</span>
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => handleExtensionDecision(asgn, false)}
                                              style={{
                                                padding: "8px 16px",
                                                borderRadius: "8px",
                                                backgroundColor: isDisapproved ? "#b91c1c" : "#dc2626",
                                                color: "#ffffff",
                                                border: "none",
                                                fontWeight: 700,
                                                fontSize: "13px",
                                                cursor: "pointer",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "6px",
                                                boxShadow: "0 2px 4px rgba(220,38,38,0.25)",
                                              }}
                                            >
                                              <XCircle size={16} />
                                              <span>{lang === "si" ? "ප්‍රතික්ෂේප කරන්න (Disapprove)" : "Disapprove Extension"}</span>
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div style={{ backgroundColor: "#f8fafc", borderRadius: "10px", border: "1px dashed #cbd5e1", padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px", color: "#64748b", fontSize: "13px" }}>
                                          <Clock size={18} style={{ color: "#94a3b8", flexShrink: 0 }} />
                                          <span>
                                            {lang === "si"
                                              ? "⏳ විමර්ශන පරිපාලක (Investigation Admin) විසින් දිනයන් දීර්ඝ කිරීමක් මෙම නඩුව සඳහා තවම ලබාදී නොමැත."
                                              : "⏳ No extension of dates has been granted by Investigation Admin for this case yet."}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* ── STEP 5 ── After-Investigation Details Received from Admin */}
                              <div style={{ display: "flex", gap: "16px" }}>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "36px" }}>
                                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: hasAfterInvestigation ? "linear-gradient(135deg, #16a34a, #22c55e)" : "linear-gradient(135deg, #94a3b8, #cbd5e1)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "13px", flexShrink: 0 }}>5</div>
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: "13px", fontWeight: 700, color: hasAfterInvestigation ? "#15803d" : "#94a3b8", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <span>{lang === "si" ? "5. විමර්ශනයෙන් පසු තොරතුරු (Admin ගෙන් ලැබෙයි)" : "Step 5: After-Investigation Details (Received from Admin)"}</span>
                                    {hasAfterInvestigation && (
                                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", backgroundColor: "#dcfce7", color: "#15803d" }}>✓ Received {asgn.afterInvestigationDate || ""}</span>
                                    )}
                                  </div>
                                  {hasAfterInvestigation ? (
                                    <div style={{ backgroundColor: "#f0fdf4", borderRadius: "10px", border: "1px solid #bbf7d0", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px" }}>
                                        <div style={{ backgroundColor: "#ffffff", padding: "10px", borderRadius: "8px", border: "1px solid #d1fae5" }}>
                                          <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>{lang === "si" ? "ගොනු අංකය" : "Investigation File No."}</div>
                                          <div style={{ fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>{asgn.investigationFileNo || "—"}</div>
                                        </div>
                                        <div style={{ backgroundColor: "#ffffff", padding: "10px", borderRadius: "8px", border: "1px solid #d1fae5" }}>
                                          <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>{lang === "si" ? "විමර්ශන තත්ත්වය" : "Investigation Status"}</div>
                                          <div style={{ fontWeight: 700, color: "#2563eb", marginTop: "2px" }}>{asgn.investigationStatus || asgn.status || "—"}</div>
                                        </div>
                                        <div style={{ backgroundColor: "#ffffff", padding: "10px", borderRadius: "8px", border: "1px solid #d1fae5", gridColumn: "1 / -1" }}>
                                          <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: "4px" }}>📝 {lang === "si" ? "විමර්ශන සටහන්" : "Investigation Notes"}</div>
                                          <div style={{ fontSize: "12px", color: "#334155", whiteSpace: "pre-wrap", maxHeight: "80px", overflowY: "auto" }}>{asgn.investigationNotes || "—"}</div>
                                        </div>
                                        <div style={{ backgroundColor: "#ffffff", padding: "10px", borderRadius: "8px", border: "1px solid #d1fae5", gridColumn: "1 / -1" }}>
                                          <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: "4px" }}>📈 {lang === "si" ? "ප්‍රගති විස්තර" : "Progress Details"}</div>
                                          <div style={{ fontSize: "12px", color: "#334155", whiteSpace: "pre-wrap", maxHeight: "80px", overflowY: "auto" }}>{asgn.progressDetails || "—"}</div>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ backgroundColor: "#f8fafc", borderRadius: "10px", border: "1px dashed #cbd5e1", padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px", color: "#94a3b8", fontSize: "13px" }}>
                                      <Clock size={18} style={{ color: "#cbd5e1", flexShrink: 0 }} />
                                      <span>{lang === "si" ? "⏳ විමර්ශනය අවසන් වූ විට, Admin ගොනු අංකය, තත්ත්වය, සටහන් සහ ප්‍රගති විස්තර ඔබ වෙත යවනු ඇත." : "⏳ After the investigation, Admin will send the Investigation File No., Status, Notes & Progress Details here."}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                            </div>
                          )}

                        </div>
                      );
                    })}
                </div>
              ) : (
                <div style={{ padding: "48px 24px", textAlign: "center" }}>
                  <div style={{ width: "56px", height: "56px", borderRadius: "50%", backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <Clock size={24} style={{ color: "#94a3b8" }} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "15px", color: "#334155", marginBottom: "6px" }}>
                    {lang === "si" ? "විමර්ශන නිලධාරීන් පත් කර නොමැත" : "No Investigation Directives Yet"}
                  </div>
                  <div style={{ fontSize: "13px", color: "#94a3b8" }}>
                    {lang === "si" ? "Investigation Administrator විසින් නිලධාරීන් පත් කළ විට, ඔවුන් මෙතන දිස්වනු ඇත." : "Once the Investigation Administrator assigns investigation officers, directives will appear here."}
                  </div>
                </div>
              )}
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
                    <th scope="col">{lang === "si" ? "විමර්ශන කමිටුව" : "Investigation Committee"}</th>
                    <th scope="col">{t("letterDate")}</th>
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
                    filteredCases.map((item) => {
                      const matchingAsgn = assignments.find((a: any) =>
                        String(a.caseNo || a.case_no || "").trim().toLowerCase() === String(item.caseNo || "").trim().toLowerCase()
                      );

                      return (
                        <tr key={item.id} className="letter-table-row">
                          <td className="font-semibold">{item.caseNo}</td>
                          <td>
                            {(() => {
                              if (!matchingAsgn) return <span style={{ fontSize: "11px", color: "#94a3b8" }}>— (Pending)</span>;

                              const committee = parseCommitteeDetails(matchingAsgn);

                              if (committee.chairmanName || committee.memberList.length > 0) {
                                return (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxWidth: "240px" }}>
                                    {committee.chairmanName && (
                                      <span style={{ fontSize: "11px", backgroundColor: "#fef3c7", color: "#92400e", padding: "3px 8px", borderRadius: "6px", fontWeight: 700, display: "inline-block" }}>
                                        👑 {lang === "si" ? "සභාපති" : "Chairman"}: {committee.chairmanName}
                                      </span>
                                    )}
                                    {committee.memberList.length > 0 && (
                                      <span style={{ fontSize: "11px", backgroundColor: "#f1f5f9", color: "#334155", padding: "3px 8px", borderRadius: "6px", fontWeight: 600, display: "inline-block" }}>
                                        👥 {lang === "si" ? "සාමාජිකයින්" : "Members"}: {committee.memberList.join(", ")}
                                      </span>
                                    )}
                                  </div>
                                );
                              }

                              if (committee.rawText) {
                                return (
                                  <span style={{ fontSize: "11px", color: "#1e3a5f", fontWeight: 600, backgroundColor: "#eff6ff", padding: "3px 8px", borderRadius: "6px" }}>
                                    📋 {committee.rawText}
                                  </span>
                                );
                              }

                              return <span style={{ fontSize: "11px", color: "#94a3b8" }}>— (Pending)</span>;
                            })()}
                          </td>
                          <td>{item.letterDate || item.receivedDate || item.assignedDate}</td>
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
                              const rem = calculateReminder(item.letterDate || item.receivedDate || item.assignedDate, item.priority, item.status);
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
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="text-center py-4 text-muted">
                        No cases found matching search
                      </td>
                    </tr>
                  )}
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
