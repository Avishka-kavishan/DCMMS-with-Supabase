"use client";

import "../../i18n";
import "../daily-mail/daily-mail.css";
import "../dashboard-common.css";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sidebar } from "@/components/Sidebar";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { signOut, getCurrentProfile } from "@/lib/auth";
import { 
  UserPlus, X, Edit, Trash2, Check, Eye, ClipboardList, 
  UserCheck, Shield, ChevronRight, Calendar as CalendarIcon, 
  FileText, Clock, AlertCircle, Info, CheckCircle
} from "lucide-react";

interface Inquiry {
  id: string;
  inquiryNo: string;
  subject: string;
  targetDate: string;
  status: "Scheduled" | "In Progress" | "Evidence Review" | "Completed" | "Preliminary Investigation" | "Conducting preliminary investigations" | "Under Investigation";
  assignedOfficer?: string;
  notes?: string;
}

interface Officer {
  id: string;
  fullName: string;
  email: string;
  role: "investigation_officer";
  status: "Active" | "Inactive";
  createdAt: string;
}

export default function InvestigationPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  // Accessibility & language state
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");
  const lang = i18n.language;

  // Tabs state
  const [activeTab, setActiveTab] = useState<"cases" | "officers">("cases");

  // Mobile sidebar visibility state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Dynamic localized greeting
  const [greeting, setGreeting] = useState("");

  // Inquiries & Officers state
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalendarLoading, setIsCalendarLoading] = useState(true);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);

  // Search/Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [officerSearchQuery, setOfficerSearchQuery] = useState("");

  // Case details modal state
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<Inquiry | null>(null);
  const [concernedOfficer, setConcernedOfficer] = useState<any>(null);
  const [subjectActions, setSubjectActions] = useState<any[]>([]);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);

  // Case details form state (editable by Investigation Administrator)
  const [assignee, setAssignee] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [investigationStatus, setInvestigationStatus] = useState<Inquiry["status"]>("In Progress");
  const [investigationNotes, setInvestigationNotes] = useState("");

  // Officer form modal state
  const [isOfficerModalOpen, setIsOfficerModalOpen] = useState(false);
  const [isOfficerEditMode, setIsOfficerEditMode] = useState(false);
  const [editingOfficerId, setEditingOfficerId] = useState<string | null>(null);
  const [officerNameForm, setOfficerNameForm] = useState("");
  const [officerEmailForm, setOfficerEmailForm] = useState("");
  const [officerStatusForm, setOfficerStatusForm] = useState<"Active" | "Inactive">("Active");
  const [officerErrors, setOfficerErrors] = useState<Record<string, string>>({});
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // ── Sync Greeting ────────────────────────────────────────────────────────
  useEffect(() => {
    const hour = new Date().getHours();
    let greetingKey = "greetingMorning";
    if (hour >= 12 && hour < 17) {
      greetingKey = "greetingAfternoon";
    } else if (hour >= 17 || hour < 5) {
      greetingKey = "greetingEvening";
    }

    const loadGreeting = async () => {
      let displayName = t("investigationName", "Suresh");
      if (isSupabaseConfigured) {
        const prof = await getCurrentProfile();
        if (prof) {
          displayName = prof.full_name;
        }
      }
      const firstName = displayName.split(" ")[0];
      setGreeting(`${t(greetingKey)}, ${firstName}!`);
    };
    loadGreeting();
  }, [t]);

  // ── Close sidebar on Escape ────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ── Sync document title ───────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${t("investigationDashboardTitle")} | DCMMS`;
  }, [lang, t]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  // ── Fetch Inquiries & Officers ────────────────────────────────────────────
  const fetchInquiries = async () => {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from("dcmms_subject")
          .select("*")
          .order("case_no", { ascending: true });

        if (error) throw error;

        if (data) {
          // Include any cases that are in an investigation status
          const mappedInquiries = data
            .filter((item: any) => 
              item.case_no.includes("INQ/") || 
              item.status === "Preliminary Investigation" ||
              item.status === "Conducting preliminary investigations" ||
              item.status === "Under Investigation" ||
              item.status === "Institutional Preliminary Investigation" ||
              item.status === "Delegation of authority to conduct a provincial preliminary investigation"
            )
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

    // Fallback if not configured or query fails
    if (typeof window !== "undefined") {
      const storedCases = localStorage.getItem("dcmms_cases");
      if (storedCases) {
        try {
          const list = JSON.parse(storedCases);
          const mapped = list
            .filter((item: any) => 
              item.caseNo.includes("INQ/") || 
              item.status === "Preliminary Investigation" ||
              item.status === "Conducting preliminary investigations" ||
              item.status === "Under Investigation"
            )
            .map((item: any) => ({
              id: item.id || `case-${item.caseNo}`,
              inquiryNo: item.caseNo,
              subject: item.subject,
              targetDate: item.targetDate || item.assignedDate || "2026-07-01",
              status: item.status,
            }));
          setInquiries(mapped);
          return;
        } catch (e) {
          console.error("Failed to parse local storage cases", e);
        }
      }
    }

    const defaults: Inquiry[] = [
      {
        id: "1",
        inquiryNo: "INQ/2026/001",
        subject: "Formal disciplinary inquiry - Student misconduct at Royal College",
        targetDate: "2026-07-05",
        status: "In Progress",
      },
      {
        id: "2",
        inquiryNo: "INQ/2026/002",
        subject: "Preliminary investigation on teacher absenteeism - Jaffna Office",
        targetDate: "2026-07-12",
        status: "Evidence Review",
      },
      {
        id: "3",
        inquiryNo: "INQ/2026/003",
        subject: "Inquiry into safety guidelines violation - Annual Sports Meet",
        targetDate: "2026-07-20",
        status: "Scheduled",
      },
    ];
    setInquiries(defaults);
  };

  const fetchInvestigationOfficers = async () => {
    let result: Officer[] = [];
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from("dcmms_profiles")
          .select("id, full_name, email, status, created_at")
          .eq("role", "investigation_officer")
          .order("created_at", { ascending: false });

        if (!error && data) {
          result = data.map((p: any) => ({
            id: p.id,
            fullName: p.full_name || "",
            email: p.email || "",
            role: "investigation_officer",
            status: (p.status === "Inactive" ? "Inactive" : "Active") as "Active" | "Inactive",
            createdAt: (p.created_at || "").slice(0, 10),
          }));
        }
      } catch (err) {
        console.error("Failed to load investigation officers:", err);
      }
    }

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_custom_profiles");
      if (stored) {
        try {
          const list = JSON.parse(stored) as Officer[];
          const localInvestigation = list.filter((o) => o.role === "investigation_officer");
          const dbIds = new Set(result.map((o) => o.id));
          localInvestigation.forEach((lo) => {
            if (!dbIds.has(lo.id)) {
              result.push({
                id: lo.id,
                fullName: lo.fullName,
                email: lo.email,
                role: "investigation_officer",
                status: lo.status || "Active",
                createdAt: lo.createdAt || new Date().toISOString().slice(0, 10)
              });
            }
          });
        } catch (e) {
          console.error("Failed to merge local profiles:", e);
        }
      }
    }

    setOfficers(result);
  };

  const fetchWidgetEvents = async () => {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from("dcmms_calendar")
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

  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      await Promise.all([fetchInquiries(), fetchInvestigationOfficers(), fetchWidgetEvents()]);
      setIsLoading(false);
    };
    initData();

    // Subscribe to real-time changes
    const channel1 = supabase
      .channel("invest-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_subject" }, fetchInquiries)
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_profiles" }, fetchInvestigationOfficers)
      .subscribe();

    const interval = setInterval(() => {
      fetchInquiries();
      fetchInvestigationOfficers();
    }, 8000);

    return () => {
      supabase.removeChannel(channel1);
      clearInterval(interval);
    };
  }, []);

  // ── Session guard ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) router.replace("/");
    });
  }, [router]);

  // ── Log out handler ────────────────────────────────────────────────────────
  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut();
    router.push("/");
  };

  // ── Open Case details modal & Load Subject Officer submissions ─────────────
  const handleOpenCaseModal = async (inq: Inquiry) => {
    setSelectedCase(inq);
    setIsDetailsLoading(true);
    setIsCaseModalOpen(true);
    
    // Set initial form states
    setTargetDate(inq.targetDate || "");
    setInvestigationStatus(inq.status || "In Progress");
    setInvestigationNotes("");
    
    let concernedData: any = null;
    let detailList: any[] = [];

    // 1. Fetch from Supabase
    if (isSupabaseConfigured) {
      try {
        const { data: cData } = await supabase
          .from("dcmms_concerned_officers")
          .select("*")
          .eq("case_no", inq.inquiryNo)
          .maybeSingle();
        if (cData) concernedData = cData;

        const { data: dData } = await supabase
          .from("dcmms_subject_details")
          .select("*")
          .eq("case_no", inq.inquiryNo)
          .order("received_date", { ascending: false });
        if (dData) detailList = dData;
      } catch (e) {
        console.error("Failed to load details from Supabase", e);
      }
    }

    // 2. Fallback to localStorage
    if (typeof window !== "undefined") {
      if (!concernedData) {
        try {
          const storedConcerned = localStorage.getItem("dcmms_officer_concerned");
          if (storedConcerned) {
            const map = JSON.parse(storedConcerned);
            if (map[inq.inquiryNo]) concernedData = map[inq.inquiryNo];
          }
        } catch (e) {}
      }

      if (detailList.length === 0) {
        try {
          const storedActions = localStorage.getItem("dcmms_new_letter_current_case");
          if (storedActions) {
            const list = JSON.parse(storedActions);
            detailList = list.filter((a: any) => a.caseNo === inq.inquiryNo);
          }
        } catch (e) {}
      }
    }

    // Extract assignee if existing logs contain assignment
    const assignLog = detailList.find(d => d.step_taken && d.step_taken.includes("Assigned to"));
    if (assignLog) {
      const match = assignLog.step_taken.match(/Assigned to ([^.]+)/);
      if (match) setAssignee(match[1]);
    } else {
      // Check local storage cases as fallback
      if (typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem("dcmms_cases");
          if (stored) {
            const list = JSON.parse(stored);
            const found = list.find((c: any) => c.caseNo === inq.inquiryNo);
            if (found && found.assignedTo) {
              setAssignee(found.assignedTo);
            } else {
              setAssignee("");
            }
          }
        } catch (e) {}
      }
    }

    setConcernedOfficer(concernedData);
    setSubjectActions(detailList);
    setIsDetailsLoading(false);
  };

  // ── Save Investigation Details (Submit details sent by subject officer) ──
  const handleSaveInvestigationDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;

    const caseNo = selectedCase.inquiryNo;
    const now = new Date().toISOString().slice(0, 10);
    const actionId = `inves-action-${caseNo}-${Date.now()}`;
    const desc = `Investigation Update: Assigned to ${assignee || "unassigned"}. Target completion: ${targetDate || "none"}.`;

    if (isSupabaseConfigured) {
      try {
        // 1. Update main case status and assigned date in dcmms_subject
        const { error: caseError } = await supabase
          .from("dcmms_subject")
          .update({
            status: investigationStatus,
            assigned_date: targetDate || null,
          })
          .eq("case_no", caseNo);

        if (caseError) throw caseError;

        // 2. Insert new action log to dcmms_subject_details
        const { error: actionError } = await supabase
          .from("dcmms_subject_details")
          .insert({
            id: actionId,
            case_no: caseNo,
            received_date: now,
            report_state: investigationStatus,
            special_notes: investigationNotes || null,
            subject_officer_name: assignee || "Investigation Administrator",
            step_taken: desc,
          });

        if (actionError) throw actionError;
      } catch (err: any) {
        console.error("Failed to save investigation details to Supabase:", err);
      }
    }

    // Local storage fallback
    if (typeof window !== "undefined") {
      // 1. Update status/assignment in dcmms_cases list
      try {
        const storedCases = localStorage.getItem("dcmms_cases");
        if (storedCases) {
          const list = JSON.parse(storedCases);
          const updated = list.map((c: any) => {
            if (c.caseNo === caseNo) {
              return {
                ...c,
                status: investigationStatus,
                assignedTo: assignee || c.assignedTo,
                targetDate: targetDate || c.targetDate,
              };
            }
            return c;
          });
          localStorage.setItem("dcmms_cases", JSON.stringify(updated));
        }
      } catch (e) {}

      // 2. Add log details in dcmms_new_letter_current_case
      try {
        const storedActions = localStorage.getItem("dcmms_new_letter_current_case") || "[]";
        const list = JSON.parse(storedActions);
        list.push({
          id: actionId,
          caseNo: caseNo,
          subjectOfficerName: assignee || "Investigation Administrator",
          reportState: investigationStatus,
          receivedDate: now,
          stepTaken: desc,
          specialNotes: investigationNotes,
          isDraft: false,
        });
        localStorage.setItem("dcmms_new_letter_current_case", JSON.stringify(list));
      } catch (e) {}
    }

    showToast("Investigation details updated successfully!");
    setIsCaseModalOpen(false);
    fetchInquiries();
  };

  // ── Officer form validation ───────────────────────────────────────────────
  const validateOfficerForm = () => {
    const newErrors: Record<string, string> = {};
    if (!officerNameForm.trim()) newErrors.name = t("pleaseFillAllFields", "Name is required.");
    if (!officerEmailForm.trim()) {
      newErrors.email = t("pleaseFillAllFields", "Email is required.");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(officerEmailForm.trim())) {
      newErrors.email = "Please enter a valid email address.";
    }
    setOfficerErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Save Investigation Officer ────────────────────────────────────────────
  const handleSaveOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateOfficerForm()) return;

    const isNew = !isOfficerEditMode || !editingOfficerId;
    const oId = isNew ? `inv-${Date.now()}` : editingOfficerId!;
    const now = new Date().toISOString().slice(0, 10);

    const officer: Officer = {
      id: oId,
      fullName: officerNameForm.trim(),
      email: officerEmailForm.trim().toLowerCase(),
      role: "investigation_officer",
      status: officerStatusForm,
      createdAt: isNew ? now : officers.find(o => o.id === editingOfficerId)?.createdAt || now
    };

    if (isSupabaseConfigured) {
      try {
        const payload: any = {
          full_name: officer.fullName,
          role: "investigation_officer",
          status: officer.status
        };
        if (!isNew && !officer.id.startsWith("inv-")) {
          payload.id = officer.id;
        }
        const { error } = await supabase.from("dcmms_profiles").upsert(payload);
        if (error) throw error;
      } catch (err) {
        console.error("Failed to save officer in Supabase:", err);
      }
    }

    // Save to local storage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_custom_profiles") || "[]";
      let list = [];
      try { list = JSON.parse(stored); } catch (e) {}
      list = list.filter((o: any) => o.id !== officer.id);
      list.push({
        id: officer.id,
        fullName: officer.fullName,
        email: officer.email,
        role: "investigation_officer",
        status: officer.status,
        createdAt: officer.createdAt
      });
      localStorage.setItem("dcmms_custom_profiles", JSON.stringify(list));
    }

    showToast(isOfficerEditMode ? "Investigation officer updated!" : "Investigation officer registered!");
    setIsOfficerModalOpen(false);
    fetchInvestigationOfficers();
  };

  // ── Delete Officer ────────────────────────────────────────────────────────
  const handleDeleteOfficer = async (officer: Officer) => {
    if (!confirm(`Are you sure you want to delete ${officer.fullName}?`)) return;

    if (isSupabaseConfigured && !officer.id.startsWith("inv-")) {
      try {
        const { error } = await supabase.from("dcmms_profiles").delete().eq("id", officer.id);
        if (error) throw error;
      } catch (err) {
        console.error("Failed to delete from Supabase:", err);
      }
    }

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_custom_profiles");
      if (stored) {
        try {
          let list = JSON.parse(stored);
          list = list.filter((o: any) => o.id !== officer.id);
          localStorage.setItem("dcmms_custom_profiles", JSON.stringify(list));
        } catch (e) {}
      }
    }

    showToast("Investigation officer removed successfully.");
    fetchInvestigationOfficers();
  };

  // ── Toggle Officer Status ──────────────────────────────────────────────────
  const handleToggleOfficerStatus = async (officer: Officer) => {
    const nextStatus = officer.status === "Active" ? "Inactive" : "Active";

    if (isSupabaseConfigured && !officer.id.startsWith("inv-")) {
      try {
        await supabase
          .from("dcmms_profiles")
          .update({ status: nextStatus })
          .eq("id", officer.id);
      } catch (e) {
        console.error("Failed to toggle status in Supabase", e);
      }
    }

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_custom_profiles");
      if (stored) {
        try {
          const list = JSON.parse(stored);
          const updated = list.map((o: any) => {
            if (o.id === officer.id) return { ...o, status: nextStatus };
            return o;
          });
          localStorage.setItem("dcmms_custom_profiles", JSON.stringify(updated));
        } catch (e) {}
      }
    }

    showToast(`Status updated to ${nextStatus}.`);
    fetchInvestigationOfficers();
  };

  // ── Filters ────────────────────────────────────────────────────────────────
  const filteredInquiries = inquiries.filter((item) => {
    const query = searchQuery.toLowerCase().trim();
    return (
      item.inquiryNo.toLowerCase().includes(query) ||
      item.subject.toLowerCase().includes(query) ||
      item.status.toLowerCase().includes(query)
    );
  });

  const filteredOfficers = officers.filter((item) => {
    const query = officerSearchQuery.toLowerCase().trim();
    return (
      item.fullName.toLowerCase().includes(query) ||
      item.email.toLowerCase().includes(query)
    );
  });

  // Count calculations
  const activeInquiriesCount = inquiries.length;
  const inProgressInquiriesCount = inquiries.filter((i) => i.status === "In Progress" || i.status === "Preliminary Investigation" || i.status === "Conducting preliminary investigations" || i.status === "Under Investigation").length;
  const evidenceReviewsInquiriesCount = inquiries.filter((i) => i.status === "Evidence Review").length;
  const scheduledHearingsInquiriesCount = inquiries.filter((i) => i.status === "Scheduled").length;

  return (
    <div className="dashboard-container" data-font-scale={fontScale}>
      {/* Skip Link (A11y) */}
      <a href="#dashboard-main-content" className="skip-link">
        {t("skipLink")}
      </a>

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
        role="investigation"
        setIsModalOpen={(open) => {
          if (open) {
            setActiveTab("officers");
            setIsOfficerModalOpen(true);
          }
        }}
      />

      <div className="dashboard-layout">
        <main id="dashboard-main-content" className="dashboard-content">
          
          {/* Toast Notification */}
          {toastMessage && (
            <div className="toast-notification">
              <CheckCircle className="toast-icon" />
              <span>{toastMessage}</span>
            </div>
          )}

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
                <h2 className="dashboard-main-title">{t("investigationDashboardTitle", "Investigation Administrator Dashboard")}</h2>
                <p className="dashboard-main-subtitle">{t("investigationDashboardDesc")}</p>
              </div>
            </div>

            <div className="dashboard-header-right">
              {/* Date Badge */}
              <div className="date-badge">
                <CalendarIcon className="date-icon" />
                <span suppressHydrationWarning>
                  {new Date().toLocaleDateString(
                    lang === "si" ? "si-LK" : lang === "ta" ? "ta-LK" : "en-US",
                    { year: "numeric", month: "long", day: "numeric" }
                  )}
                </span>
              </div>

              <div className="divider-line" aria-hidden="true" />

              {/* Accessibility Font Adjuster */}
              <div className="accessibility-adjuster-bar" role="radiogroup" aria-label="Font Sizing Adjustment">
                <label className={`size-btn size-btn-small${fontScale === "small" ? " active" : ""}`}>
                  <input type="radio" name="dashboardFontScale" value="small" checked={fontScale === "small"} onChange={() => setFontScale("small")} aria-label={t("fontSmall")} className="sr-only" />
                  A
                </label>
                <label className={`size-btn size-btn-medium${fontScale === "medium" ? " active" : ""}`}>
                  <input type="radio" name="dashboardFontScale" value="medium" checked={fontScale === "medium"} onChange={() => setFontScale("medium")} aria-label={t("fontMedium")} className="sr-only" />
                  A
                </label>
                <label className={`size-btn size-btn-large${fontScale === "large" ? " active" : ""}`}>
                  <input type="radio" name="dashboardFontScale" value="large" checked={fontScale === "large"} onChange={() => setFontScale("large")} aria-label={t("fontLarge")} className="sr-only" />
                  A
                </label>
              </div>

              <div className="divider-line" aria-hidden="true" />

              {/* Language selector */}
              <div className="trilingual-language-selector" role="radiogroup" aria-label="Translate Dashboard Language">
                <label className={`lang-btn${lang === "si" ? " active" : ""}`} lang="si">
                  <input type="radio" name="dashboardLang" value="si" checked={lang === "si"} onChange={() => changeLanguage("si")} aria-label="Switch dashboard language to Sinhala" className="sr-only" />
                  සිංහල
                </label>
                <label className={`lang-btn${lang === "ta" ? " active" : ""}`} lang="ta">
                  <input type="radio" name="dashboardLang" value="ta" checked={lang === "ta"} onChange={() => changeLanguage("ta")} aria-label="Switch dashboard language to Tamil" className="sr-only" />
                  தமிழ்
                </label>
                <label className={`lang-btn${lang === "en" ? " active" : ""}`} lang="en">
                  <input type="radio" name="dashboardLang" value="en" checked={lang === "en"} onChange={() => changeLanguage("en")} aria-label="Switch dashboard language to English" className="sr-only" />
                  English
                </label>
              </div>
            </div>
          </header>

          {/* ── Welcome Banner Greeting ── */}
          <section className="welcome-greeting-section">
            <h3 className="greeting-text">{greeting}</h3>
          </section>

          {/* ── Dashboard Stats Overview ── */}
          <section className="dashboard-stats-grid">
            <div className="hero-action-card">
              <h4>{lang === "si" ? "ක්‍රියාකාරී විමර්ශන" : "Active Inquiries"}</h4>
              <p>{activeInquiriesCount}</p>
            </div>
            <div className="hero-action-card">
              <h4>{lang === "si" ? "සිදුවෙමින් පවතින" : "In Progress"}</h4>
              <p className="val-info">{inProgressInquiriesCount}</p>
            </div>
            <div className="hero-action-card">
              <h4>{lang === "si" ? "සාක්ෂි සමාලෝචන" : "Evidence Reviews"}</h4>
              <p className="val-purple">{evidenceReviewsInquiriesCount}</p>
            </div>
            <div className="hero-action-card">
              <h4>{lang === "si" ? "සැලසුම් කළ විභාග" : "Scheduled Hearings"}</h4>
              <p className="val-warning">{scheduledHearingsInquiriesCount}</p>
            </div>
          </section>

          {/* ── Tabbed View Selection ── */}
          <div className="navigation-tab-list" style={{ marginTop: "24px", marginBottom: "20px" }}>
            <button
              className={`nav-tab-btn${activeTab === "cases" ? " active" : ""}`}
              onClick={() => setActiveTab("cases")}
            >
              <ClipboardList className="tab-icon" />
              <span>{lang === "si" ? "විමර්ශන නඩු ලේඛනය" : "Inquiry & Investigation Cases"}</span>
            </button>
            <button
              className={`nav-tab-btn${activeTab === "officers" ? " active" : ""}`}
              onClick={() => setActiveTab("officers")}
            >
              <UserCheck className="tab-icon" />
              <span>{lang === "si" ? "විමර්ශන නිලධාරීන් ලියාපදිංචිය" : "Register & Manage Officers"}</span>
            </button>
          </div>

          {/* ==================== TAB 1: CASES LIST ==================== */}
          {activeTab === "cases" && (
            <>
              {/* Upcoming Calendar widget */}
              <section className="upcoming-events-widget">
                <div className="upcoming-events-container">
                  <div className="upcoming-events-header">
                    <h4 className="upcoming-events-title">
                      <CalendarIcon className="upcoming-events-icon" />
                      {lang === "si" ? "මෑතකාලීන දිනසටහන් සිදුවීම්" : "Upcoming Disciplinary Events (Calendar API)"}
                    </h4>
                    <a href="/calendar" className="upcoming-events-link">
                      {lang === "si" ? "සියල්ල බලන්න" : "View Full Calendar"} &rarr;
                    </a>
                  </div>
                  
                  {isCalendarLoading ? (
                    <div className="upcoming-events-loading">Loading calendar events...</div>
                  ) : calendarEvents.length > 0 ? (
                    <div className="upcoming-events-grid">
                      {calendarEvents.slice(0, 2).map((ev: any, index: number) => {
                        const dateStr = new Date(ev.start?.dateTime).toLocaleDateString(lang === "si" ? "si-LK" : "en-US", { weekday: "short", month: "short", day: "numeric" });
                        const timeStr = new Date(ev.start?.dateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
                    <div className="upcoming-events-empty">No events scheduled.</div>
                  )}
                </div>
              </section>

              {/* Inquiry Cases table list */}
              <section className="letters-list-section">
                <div className="letters-list-header">
                  <h3 className="section-title">
                    {lang === "si" ? "විමර්ශනයට නියමිත ලිපි සහ ගොනු" : "Inquiry & Investigation Cases"}
                  </h3>
                  <div className="letters-filters-group">
                    <div className="search-box">
                      <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={lang === "si" ? "විමර්ශන සොයන්න..." : "Search inquiries..."}
                        className="search-input"
                      />
                    </div>
                  </div>
                </div>

                <div className="table-responsive-container">
                  <table className="letters-data-table">
                    <thead>
                      <tr>
                        <th scope="col">{lang === "si" ? "විමර්ශන අංකය" : "Inquiry No"}</th>
                        <th scope="col">{lang === "si" ? "ඉලක්කගත අවසන් දිනය" : "Target Completion Date"}</th>
                        <th scope="col">{lang === "si" ? "විෂය කරුණ" : "Subject / Matter"}</th>
                        <th scope="col">{lang === "si" ? "තත්ත්වය" : "Status"}</th>
                        <th scope="col" className="text-center">{lang === "si" ? "ක්‍රියාමාර්ග" : "Actions"}</th>
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
                              <span className={`badge-badge ${
                                item.status === "Completed" ? "badge-status-closed" : "badge-status-assigned"
                              }`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="text-center actions-cell">
                              <button
                                className="btn-action-view"
                                onClick={() => handleOpenCaseModal(item)}
                                title="Update Investigation Details"
                                style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}
                              >
                                <Edit className="action-row-icon" size={16} />
                                <span>{lang === "si" ? "විස්තර එක් කරන්න" : "Add/Edit Details"}</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-center py-4 text-muted">
                            No cases found matching search
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* ==================== TAB 2: OFFICERS LIST ==================== */}
          {activeTab === "officers" && (
            <section className="letters-list-section">
              <div className="letters-list-header">
                <h3 className="section-title">
                  {lang === "si" ? "විමර්ශන නිලධாரීන්ගේ නාමාවලිය" : "Investigation Officers"}
                </h3>
                <div className="letters-filters-group">
                  <div className="search-box">
                    <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={officerSearchQuery}
                      onChange={(e) => setOfficerSearchQuery(e.target.value)}
                      placeholder={lang === "si" ? "නිලධාරීන් සොයන්න..." : "Search officers..."}
                      className="search-input"
                    />
                  </div>
                  <button
                    className="btn-new-letter"
                    onClick={() => {
                      setIsOfficerEditMode(false);
                      setEditingOfficerId(null);
                      setOfficerNameForm("");
                      setOfficerEmailForm("");
                      setOfficerStatusForm("Active");
                      setOfficerErrors({});
                      setIsOfficerModalOpen(true);
                    }}
                    style={{ padding: "10px 18px", fontSize: "14px" }}
                  >
                    <UserPlus size={16} />
                    <span>{lang === "si" ? "නිලධාරියෙකු ලියාපදිංචි කරන්න" : "Register Officer"}</span>
                  </button>
                </div>
              </div>

              <div className="table-responsive-container">
                <table className="letters-data-table">
                  <thead>
                    <tr>
                      <th scope="col">{lang === "si" ? "සම්පූර්ණ නම" : "Full Name"}</th>
                      <th scope="col">{lang === "si" ? "ඊමේල් ලිපිනය" : "Email Address"}</th>
                      <th scope="col">{lang === "si" ? "ලියාපදිංචි දිනය" : "Date Registered"}</th>
                      <th scope="col">{lang === "si" ? "තත්ත්වය" : "Status"}</th>
                      <th scope="col" className="text-center">{lang === "si" ? "ක්‍රියාමාර්ග" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOfficers.length > 0 ? (
                      filteredOfficers.map((o) => (
                        <tr key={o.id} className="letter-table-row">
                          <td className="font-semibold text-primary">{o.fullName}</td>
                          <td>{o.email}</td>
                          <td>{o.createdAt}</td>
                          <td>
                            <button
                              onClick={() => handleToggleOfficerStatus(o)}
                              className={`badge-badge ${
                                o.status === "Active" ? "badge-status-inprogress" : "badge-status-pending"
                              }`}
                              style={{ border: "none", cursor: "pointer" }}
                              title="Click to toggle status"
                            >
                              {o.status}
                            </button>
                          </td>
                          <td className="text-center actions-cell">
                            <div style={{ display: "inline-flex", gap: "10px" }}>
                              <button
                                className="btn-action-edit"
                                onClick={() => {
                                  setIsOfficerEditMode(true);
                                  setEditingOfficerId(o.id);
                                  setOfficerNameForm(o.fullName);
                                  setOfficerEmailForm(o.email);
                                  setOfficerStatusForm(o.status);
                                  setOfficerErrors({});
                                  setIsOfficerModalOpen(true);
                                }}
                                title="Edit Officer"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                className="btn-action-delete"
                                onClick={() => handleDeleteOfficer(o)}
                                title="Delete Officer"
                                style={{ color: "#ef4444" }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-4 text-muted">
                          No investigation officers registered yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <SiteFooter />
        </main>
      </div>

      {/* ==================== CASE DETAILS & INVESTIGATION EDIT MODAL ==================== */}
      {isCaseModalOpen && selectedCase && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="case-modal-title">
          <div className="modal-content-wrapper premium-modal" style={{ maxWidth: "850px", width: "95%" }}>
            
            <header className="modal-header">
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <ClipboardList className="header-icon" size={24} style={{ color: "#4f46e5" }} />
                <div>
                  <h3 id="case-modal-title" className="modal-title">
                    {lang === "si" ? "විමර්ශන විස්තර සහ පැවරුම්" : "Investigation Actions & Details"}
                  </h3>
                  <p className="modal-subtitle">Case Ref: {selectedCase.inquiryNo}</p>
                </div>
              </div>
              <button 
                type="button" 
                className="modal-close-btn"
                onClick={() => setIsCaseModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </header>

            {isDetailsLoading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>Loading case logs...</div>
            ) : (
              <form onSubmit={handleSaveInvestigationDetails} className="modal-body-scrollable">
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  
                  {/* Part 1: Details sent by Subject Officer */}
                  <div className="details-section-card" style={{ backgroundColor: "#f9fafb", padding: "16px", borderRadius: "10px", border: "1px solid #e5e7eb" }}>
                    <h4 style={{ margin: "0 0 12px 0", fontSize: "16px", color: "#374151", display: "flex", alignItems: "center", gap: "8px" }}>
                      <Info size={18} style={{ color: "#4f46e5" }} />
                      <span>{lang === "si" ? "විෂයභාර නිලධාරී විසින් එවන ලද තොරතුරු" : "Details Sent by Subject Officer"}</span>
                    </h4>

                    {concernedOfficer ? (
                      <div className="details-grid-3col" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                        <div className="detail-field">
                          <span style={{ fontSize: "12px", color: "#6B7280", display: "block" }}>
                            {lang === "si" ? "චෝදනා ලැබූ නිලධාරියාගේ නම" : "Officer Concerned Name"}
                          </span>
                          <span style={{ fontWeight: 600, color: "#111827" }}>{concernedOfficer.officerName || "—"}</span>
                        </div>
                        <div className="detail-field">
                          <span style={{ fontSize: "12px", color: "#6B7280", display: "block" }}>{lang === "si" ? "ජාතික හැඳුनुම්පත් අංකය" : "NIC Number"}</span>
                          <span style={{ fontWeight: 600, color: "#111827" }}>{concernedOfficer.nic || "—"}</span>
                        </div>
                        <div className="detail-field">
                          <span style={{ fontSize: "12px", color: "#6B7280", display: "block" }}>{lang === "si" ? "තනතුර" : "Designation"}</span>
                          <span style={{ fontWeight: 600, color: "#111827" }}>{concernedOfficer.position || "—"}</span>
                        </div>
                        <div className="detail-field">
                          <span style={{ fontSize: "12px", color: "#6B7280", display: "block" }}>{lang === "si" ? "ලිපිනය" : "Address"}</span>
                          <span style={{ fontWeight: 600, color: "#111827" }}>{concernedOfficer.address || "—"}</span>
                        </div>
                        <div className="detail-field">
                          <span style={{ fontSize: "12px", color: "#6B7280", display: "block" }}>{lang === "si" ? "පාසල / ආයතනය" : "School / Institute"}</span>
                          <span style={{ fontWeight: 600, color: "#111827" }}>{concernedOfficer.instituteName || "—"}</span>
                        </div>
                        <div className="detail-field">
                          <span style={{ fontSize: "12px", color: "#6B7280", display: "block" }}>{lang === "si" ? "විනය ශාඛාවට ලද දිනය" : "Received Date"}</span>
                          <span style={{ fontWeight: 600, color: "#111827" }}>{concernedOfficer.appointmentDate || "—"}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="alert-badge" style={{ display: "flex", gap: "8px", alignItems: "center", padding: "8px 12px", backgroundColor: "#fef3c7", color: "#d97706", borderRadius: "6px" }}>
                        <AlertCircle size={16} />
                        <span style={{ fontSize: "13px" }}>No specific accused officer details recorded by subject branch.</span>
                      </div>
                    )}

                    {/* Action history log from Subject Officer */}
                    {subjectActions.length > 0 && (
                      <div style={{ marginTop: "16px", borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
                        <span style={{ fontSize: "12px", color: "#6B7280", display: "block", marginBottom: "8px", fontWeight: 600 }}>
                          {lang === "si" ? "ක්‍රියාමාර්ග ඉතිහාසය" : "Subject Branch Action History"}
                        </span>
                        <div style={{ maxHeight: "120px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                          {subjectActions.map((act, i) => (
                            <div key={i} style={{ fontSize: "13px", display: "flex", gap: "8px", backgroundColor: "#fff", padding: "6px 10px", borderRadius: "6px", border: "1px solid #f3f4f6" }}>
                              <span style={{ color: "#6b7280", whiteSpace: "nowrap" }}>{act.received_date || act.receivedDate}</span>
                              <strong style={{ color: "#4b5563" }}>[{act.report_state || act.reportState}]:</strong>
                              <span style={{ color: "#1f2937" }}>{act.step_taken || act.stepTaken}</span>
                              {act.special_notes && <em style={{ color: "#6b7280" }}>({act.special_notes})</em>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Part 2: Add Investigation details by Investigation Administrator */}
                  <div>
                    <h4 style={{ margin: "0 0 16px 0", fontSize: "16px", color: "#374151", display: "flex", alignItems: "center", gap: "8px" }}>
                      <Shield size={18} style={{ color: "#4f46e5" }} />
                      <span>{lang === "si" ? "විමර්ශන ප්‍රගතිය සහ පියවර ඇතුළත් කිරීම" : "Add/Update Investigation Details"}</span>
                    </h4>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                      
                      {/* Assign investigation officer */}
                      <div className="form-field-group">
                        <label htmlFor="modalAssignee" className="field-label">
                          {lang === "si" ? "පැවරූ විමර්ශන නිලධාරියා" : "Assign Investigation Officer"}
                        </label>
                        <select
                          id="modalAssignee"
                          value={assignee}
                          onChange={(e) => setAssignee(e.target.value)}
                          className="field-select"
                        >
                          <option value="">{lang === "si" ? "නිලධාරියෙකු තෝරන්න..." : "Select officer..."}</option>
                          {officers
                            .filter(o => o.status === "Active")
                            .map((o) => (
                              <option key={o.id} value={o.fullName}>{o.fullName}</option>
                          ))}
                        </select>
                      </div>

                      {/* Target date */}
                      <div className="form-field-group">
                        <label htmlFor="modalTargetDate" className="field-label">
                          {lang === "si" ? "විමර්ශනය අවසන් කළ යුතු ඉලක්කගත දිනය" : "Target Completion Date"}
                        </label>
                        <input
                          id="modalTargetDate"
                          type="date"
                          value={targetDate}
                          onChange={(e) => setTargetDate(e.target.value)}
                          className="field-input"
                        />
                      </div>

                      {/* Investigation Status */}
                      <div className="form-field-group">
                        <label htmlFor="modalStatus" className="field-label">
                          {lang === "si" ? "විමර්ශන තත්ත්වය" : "Investigation Status"}
                        </label>
                        <select
                          id="modalStatus"
                          value={investigationStatus}
                          onChange={(e) => setInvestigationStatus(e.target.value as any)}
                          className="field-select"
                        >
                          <option value="Scheduled">Scheduled</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Evidence Review">Evidence Review</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>
                    </div>

                    {/* Investigation progress notes */}
                    <div className="form-field-group" style={{ marginTop: "16px" }}>
                      <label htmlFor="modalNotes" className="field-label">
                        {lang === "si" ? "විමර්ශන සටහන් සහ ප්‍රගතිය" : "Investigation Progress Notes / Step Taken"}
                      </label>
                      <textarea
                        id="modalNotes"
                        rows={3}
                        value={investigationNotes}
                        onChange={(e) => setInvestigationNotes(e.target.value)}
                        placeholder="Enter current investigation actions taken, hearing dates, or report summaries..."
                        className="field-input"
                        style={{ resize: "vertical" }}
                      />
                    </div>
                  </div>

                </div>

                <footer className="modal-footer" style={{ marginTop: "24px" }}>
                  <button 
                    type="button" 
                    className="btn-action-cancel"
                    onClick={() => setIsCaseModalOpen(false)}
                  >
                    {t("cancelBtn")}
                  </button>
                  <button 
                    type="submit" 
                    className="btn-new-letter"
                    style={{ padding: "10px 24px" }}
                  >
                    {lang === "si" ? "තොරතුරු සුරකින්න" : "Save Progress Details"}
                  </button>
                </footer>
              </form>
            )}

          </div>
        </div>
      )}

      {/* ==================== OFFICER REGISTER/EDIT MODAL ==================== */}
      {isOfficerModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="officer-modal-title">
          <div className="modal-content-wrapper premium-modal" style={{ maxWidth: "500px", width: "95%" }}>
            
            <header className="modal-header">
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <UserPlus className="header-icon" size={24} style={{ color: "#4f46e5" }} />
                <h3 id="officer-modal-title" className="modal-title">
                  {isOfficerEditMode 
                    ? (lang === "si" ? "නිලධාරී තොරතුරු සංස්කරණය" : "Edit Investigation Officer") 
                    : (lang === "si" ? "නව විමර්ශන නිලධාරී ලියාපදිංචිය" : "Register Investigation Officer")}
                </h3>
              </div>
              <button 
                type="button" 
                className="modal-close-btn"
                onClick={() => setIsOfficerModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </header>

            <form onSubmit={handleSaveOfficer}>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "20px 0" }}>
                
                {/* Officer Name */}
                <div className="form-field-group">
                  <label htmlFor="formOfficerName" className="field-label">
                    {lang === "si" ? "නිලධாரියාගේ සම්පූර්ණ නම" : "Full Name"} <span className="required-star">*</span>
                  </label>
                  <input
                    id="formOfficerName"
                    type="text"
                    value={officerNameForm}
                    onChange={(e) => setOfficerNameForm(e.target.value)}
                    placeholder="e.g., Ranjith Bandara"
                    className={`field-input${officerErrors.name ? " error" : ""}`}
                  />
                  {officerErrors.name && <span className="error-text" style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px", display: "block" }}>{officerErrors.name}</span>}
                </div>

                {/* Email Address */}
                <div className="form-field-group">
                  <label htmlFor="formOfficerEmail" className="field-label">
                    {lang === "si" ? "විද්‍යුත් තැපැල් ලිපිනය" : "Email Address"} <span className="required-star">*</span>
                  </label>
                  <input
                    id="formOfficerEmail"
                    type="text"
                    value={officerEmailForm}
                    onChange={(e) => setOfficerEmailForm(e.target.value)}
                    placeholder="e.g., ranjith@moe.gov.lk"
                    className={`field-input${officerErrors.email ? " error" : ""}`}
                    disabled={isOfficerEditMode}
                  />
                  {officerErrors.email && <span className="error-text" style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px", display: "block" }}>{officerErrors.email}</span>}
                </div>

                {/* Status */}
                <div className="form-field-group">
                  <label htmlFor="formOfficerStatus" className="field-label">{lang === "si" ? "තත්ත්වය" : "Status"}</label>
                  <select
                    id="formOfficerStatus"
                    value={officerStatusForm}
                    onChange={(e) => setOfficerStatusForm(e.target.value as any)}
                    className="field-select"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

              </div>

              <footer className="modal-footer">
                <button 
                  type="button" 
                  className="btn-action-cancel"
                  onClick={() => setIsOfficerModalOpen(false)}
                >
                  {t("cancelBtn")}
                </button>
                <button 
                  type="submit" 
                  className="btn-new-letter"
                  style={{ padding: "10px 24px" }}
                >
                  {lang === "si" ? "සුරකින්න" : "Save Officer"}
                </button>
              </footer>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
