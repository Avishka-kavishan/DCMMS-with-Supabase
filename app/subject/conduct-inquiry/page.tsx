"use client";

import "@/i18n";
import "../../globals.css";
import "../../daily-mail/daily-mail.css";
import "../../dashboard-common.css";
import "../subject.css";
import "./conduct-inquiry.css";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getCurrentProfile, signOut } from "@/lib/auth";
import {
  saveCaseByAppointmentAndReportDueDateServer,
  saveCaseByDateExtensionServer,
  getCaseByDateExtensionServer,
  getConductInquiryCaseDetailsServer,
  getAvailableConductInquiryCasesServer,
  saveChairmanByCaseServer,
  getChairmanByCaseServer,
  saveMembersByCaseServer,
  getMembersByCaseServer,
  getCommitteeOfficersWithSchoolsServer,
  saveReplyLetterDetailsServer,
  saveConductInquiryServer,
} from "@/lib/db-actions";
import {
  ArrowLeft,
  ShieldCheck,
  UserCheck,
  Calendar as CalendarIcon,
  Clock,
  Sparkles,
  Compass,
  FileText,
  User,
  Building,
  Plus,
  X,
  CheckCircle,
  AlertCircle,
  Menu,
  ChevronRight,
  Layers,
  Send,
  Save,
} from "lucide-react";

const formatToInputDate = (dateStr?: string | null): string => {
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

function parseCommitteeDetails(asgn: any) {
  let chairmanName = "";
  let chairmanEmail = "";
  let memberList: Array<{ name: string; email: string; idNo?: string }> = [];

  if (asgn?.chairman) {
    if (typeof asgn.chairman === "object" && asgn.chairman !== null) {
      chairmanName = asgn.chairman.fullName || asgn.chairman.name || asgn.chairman.full_name || asgn.chairman.officer_name || "";
      chairmanEmail = asgn.chairman.email || asgn.chairman.nicNo || asgn.chairman.nic || asgn.chairman.nic_no || asgn.chairman.employeeNo || "";
    } else if (typeof asgn.chairman === "string") {
      if (asgn.chairman.startsWith("{")) {
        try {
          const parsed = JSON.parse(asgn.chairman);
          chairmanName = parsed.fullName || parsed.name || parsed.full_name || parsed.officer_name || "";
          chairmanEmail = parsed.email || parsed.nicNo || parsed.nic || parsed.nic_no || parsed.employeeNo || "";
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
          return {
            name: m.fullName || m.name || m.full_name || m.officer_name || "",
            email: m.email || m.nicNo || m.nic || m.idNo || m.employeeNo || "",
            idNo: m.idNo || m.nic || m.email || "",
          };
        }
        return { name: String(m || ""), email: "", idNo: "" };
      }).filter((m: any) => m.name.trim() !== "" && m.name !== "undefined");
    } else if (typeof asgn.members === "string") {
      try {
        const parsed = JSON.parse(asgn.members);
        if (Array.isArray(parsed)) {
          memberList = parsed.map((m: any) => (typeof m === "object" ? { name: m.fullName || m.name || m.full_name || m.officer_name || "", email: m.email || m.nicNo || m.nic || m.idNo || "", idNo: m.idNo || m.nic || m.email || "" } : { name: String(m), email: "", idNo: "" })).filter((m: any) => m.name.trim() !== "" && m.name !== "undefined");
        } else {
          memberList = asgn.members.split(",").map((s: string) => ({ name: s.trim(), email: "", idNo: "" })).filter((m: any) => m.name.trim() !== "" && m.name !== "undefined");
        }
      } catch (e) {
        memberList = asgn.members.split(",").map((s: string) => ({ name: s.trim(), email: "", idNo: "" })).filter((m: any) => m.name.trim() !== "" && m.name !== "undefined");
      }
    }
  }

  if (chairmanName === "undefined" || chairmanName === "null") chairmanName = "";
  return { chairmanName, chairmanEmail, chairmanNic: chairmanEmail, memberList };
}

function ConductInquiryContent() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang = i18n.language;

  const paramCaseNo = searchParams?.get("caseNo") || "";

  // Hydration state
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Authentication & Profile State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");

  // Available cases list for switcher
  const [availableCases, setAvailableCases] = useState<any[]>([]);
  const [selectedCaseNo, setSelectedCaseNo] = useState<string>(paramCaseNo);

  // Form State matching the Paper Sketch
  const [formState, setFormState] = useState<{
    caseNo: string;
    accusedName: string;
    accusedDesignation: string;
    schoolName: string;
    subject: string;
    stage: string;
    priority: string;
    inquiryType: "Institutional basic inquiry" | "Province basic inquiry";
    // Institutional basic inquiry
    chairmanName: string;
    chairmanEmail: string;
    chairmanId?: string;
    members: Array<{ name: string; email: string; idNo?: string }>;
    appointmentLetterDate: string;
    reportDueDate: string;
    extensionTerm: string;
    extensionStartDate: string;
    extensionEndDate: string;
    upcomingAction: string;
    // Province basic inquiry
    appointmentDate: string;
    dueDate: string;
    title: string;
    approvalDate: string;
    reportReceivedDate: string;
    officers: string[];
    // Common
    recommendation: string;
  }>({
    caseNo: "",
    accusedName: "—",
    accusedDesignation: "—",
    schoolName: "—",
    subject: "—",
    stage: "Conducting an Inquiry",
    priority: "medium",
    inquiryType: "Institutional basic inquiry",
    chairmanName: "",
    chairmanEmail: "",
    chairmanId: "",
    members: [{ name: "", email: "", idNo: "" }],
    appointmentLetterDate: "",
    reportDueDate: "",
    extensionTerm: "None",
    extensionStartDate: "",
    extensionEndDate: "",
    upcomingAction: "",
    appointmentDate: "",
    dueDate: "",
    title: "",
    approvalDate: "",
    reportReceivedDate: "",
    officers: [],
    recommendation: "",
  });

  const [officerInput, setOfficerInput] = useState("");

  const handleAddOfficer = () => {
    const val = officerInput.trim();
    if (!val) return;
    if (!formState.officers.includes(val)) {
      setFormState((prev) => ({
        ...prev,
        officers: [...prev.officers, val],
      }));
    }
    setOfficerInput("");
  };

  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4500);
  };

  // Registered Committee Officers for Chairman & Members Autocomplete / Auto-fill
  const [committeeOfficers, setCommitteeOfficers] = useState<Array<{ id: string; fullName: string; email?: string; position?: string }>>([]);

  useEffect(() => {
    getCommitteeOfficersWithSchoolsServer().then(async (res) => {
      let list: any[] = [];
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        list = res.data.map((o: any) => ({
          id: o.id,
          fullName: o.full_name || o.fullName || "",
          email: o.email || "",
          position: o.position || o.officer_role || "Member",
        }));
      }
      if (list.length === 0 && isSupabaseConfigured) {
        try {
          const { data: dbComm } = await supabase.from("commitee_table").select("*");
          if (dbComm && dbComm.length > 0) {
            list = dbComm.map((o: any) => ({
              id: o.id,
              fullName: o.full_name || o.fullName || "",
              email: o.email || "",
              position: o.position || o.officer_role || "Member",
            }));
          }
        } catch (e) {}
      }
      if (list.length > 0) {
        setCommitteeOfficers(list);
      }
    }).catch(async () => {
      if (isSupabaseConfigured) {
        try {
          const { data: dbComm } = await supabase.from("commitee_table").select("*");
          if (dbComm && dbComm.length > 0) {
            setCommitteeOfficers(
              dbComm.map((o: any) => ({
                id: o.id,
                fullName: o.full_name || o.fullName || "",
                email: o.email || "",
                position: o.position || o.officer_role || "Member",
              }))
            );
          }
        } catch (e) {}
      }
    });
  }, []);

  // Load User Profile
  useEffect(() => {
    getCurrentProfile().then((profile) => {
      if (profile) setCurrentUser(profile);
    });
  }, []);

  // Fetch Cases and Assignments with Server Actions & Database Auto-Fill
  useEffect(() => {
    const loadCasesData = async () => {
      const casesMap = new Map<string, any>();
      let assignmentsList: any[] = [];

      // 1. PostgreSQL Server Action: Fetch all cases with joined accused officer & school info
      try {
        const serverCases = await getAvailableConductInquiryCasesServer();
        if (serverCases && serverCases.success && Array.isArray(serverCases.data)) {
          serverCases.data.forEach((c: any) => {
            const key = (c.caseNo || "").trim().toLowerCase();
            if (key) {
              casesMap.set(key, { ...c });
            }
          });
        }
      } catch (e) {
        console.warn("Error fetching available inquiry cases from DB:", e);
      }

      // 2. Supabase Realtime DB if available
      if (isSupabaseConfigured) {
        try {
          const { data: dbCases } = await supabase.from("dcmms_cases").select("*");
          if (dbCases && dbCases.length > 0) {
            dbCases.forEach((c: any) => {
              const key = (c.caseNo || c.case_no || c.refNo || "").trim().toLowerCase();
              if (key) {
                const existing = casesMap.get(key) || {};
                casesMap.set(key, {
                  ...existing,
                  caseNo: c.caseNo || c.case_no || c.refNo || existing.caseNo || key,
                  accusedName: c.accusedName || c.accused_name || existing.accusedName || "",
                  accusedDesignation: c.accusedDesignation || c.accused_designation || c.designation || existing.accusedDesignation || "Educational Officer",
                  schoolName: c.schoolName || c.institute_name || c.school_name || existing.schoolName || "",
                  subject: c.subject || c.description || existing.subject || `Inquiry Case ${key}`,
                  stage: c.stage || "Conducting an Inquiry",
                  priority: c.priority || "medium",
                });
              }
            });
          }
          const { data: dbAsgns } = await supabase.from("dcmms_subject_assignments").select("*");
          if (dbAsgns && dbAsgns.length > 0) {
            assignmentsList = dbAsgns;
          }
        } catch (e) {}
      }

      // 3. LocalStorage Fallback & Merge
      if (typeof window !== "undefined") {
        try {
          const storedCases = localStorage.getItem("dcmms_cases");
          if (storedCases) {
            const parsed = JSON.parse(storedCases);
            if (Array.isArray(parsed)) {
              parsed.forEach((c: any) => {
                const key = (c.caseNo || c.case_no || c.refNo || "").trim().toLowerCase();
                if (key) {
                  const existing = casesMap.get(key) || {};
                  casesMap.set(key, {
                    ...existing,
                    caseNo: c.caseNo || c.case_no || c.refNo || existing.caseNo || key,
                    accusedName: c.accusedName || c.accused_name || existing.accusedName || "",
                    accusedDesignation: c.accusedDesignation || c.accused_designation || c.designation || existing.accusedDesignation || "Educational Officer",
                    schoolName: c.schoolName || c.institute_name || c.school_name || existing.schoolName || "",
                    subject: c.subject || c.description || existing.subject || `Inquiry Case ${key}`,
                    stage: c.stage || "Conducting an Inquiry",
                    priority: c.priority || "medium",
                  });
                }
              });
            }
          }
          const storedAsgns = localStorage.getItem("dcmms_subject_assignments");
          if (storedAsgns) {
            const parsedAsgns = JSON.parse(storedAsgns);
            if (Array.isArray(parsedAsgns)) {
              parsedAsgns.forEach((a: any) => {
                if (!assignmentsList.some((x: any) => (x.caseNo || x.case_no) === (a.caseNo || a.case_no))) {
                  assignmentsList.push(a);
                }
              });
            }
          }
        } catch (e) {}
      }

      // Ensure target case (paramCaseNo or DMMS/T/02) is present in map
      if (paramCaseNo && !casesMap.has(paramCaseNo.trim().toLowerCase())) {
        casesMap.set(paramCaseNo.trim().toLowerCase(), {
          caseNo: paramCaseNo,
          letterNo: paramCaseNo,
          accusedName: "",
          accusedDesignation: "Educational Officer",
          schoolName: "",
          subject: `Inquiry Case ${paramCaseNo}`,
          stage: "Conducting an Inquiry",
          priority: "medium",
        });
      }

      if (!casesMap.has("dmms/t/02")) {
        casesMap.set("dmms/t/02", {
          caseNo: "DMMS/T/02",
          letterNo: "SUB/AD/002",
          accusedName: "Nathasha",
          accusedDesignation: "Teacher",
          schoolName: "C.W.W. KANNANGARA M.M.V.",
          subject: "Disciplinary inspection proceedings initiated by Subject Officer",
          stage: "Conducting an Inquiry",
          priority: "medium",
        });
      }

      const formatted = Array.from(casesMap.values()).map((c: any) => {
        const cNo = c.caseNo || "";
        const asgn = assignmentsList.find((a: any) => (a.caseNo || a.case_no || "").trim().toLowerCase() === cNo.trim().toLowerCase());
        return {
          ...c,
          assignment: asgn,
        };
      });

      setAvailableCases(formatted);

      // Select target case
      const targetCaseNo = paramCaseNo || (formatted[0]?.caseNo || "DMMS/T/02");
      setSelectedCaseNo(targetCaseNo);
      loadCaseIntoForm(targetCaseNo, formatted, assignmentsList);
    };

    loadCasesData();
  }, [paramCaseNo]);

  const loadCaseIntoForm = async (caseNo: string, casesList = availableCases, asgnsList: any[] = []) => {
    if (!caseNo) return;
    const cleanCaseNo = caseNo.trim();
    const foundCase = casesList.find((c: any) => (c.caseNo || "").trim().toLowerCase() === cleanCaseNo.toLowerCase());
    
    let asgn = foundCase?.assignment;
    if (!asgn && typeof window !== "undefined") {
      try {
        const storedAsgns = localStorage.getItem("dcmms_subject_assignments") || "[]";
        const parsed = JSON.parse(storedAsgns);
        asgn = parsed.find((a: any) => String(a.caseNo || a.case_no || "").trim().toLowerCase() === cleanCaseNo.toLowerCase());
      } catch (e) {}
    }

    const committee = asgn ? parseCommitteeDetails(asgn) : { chairmanName: "", chairmanEmail: "", memberList: [] };

    let membersList = committee.memberList;
    if (membersList.length === 0 && foundCase?.members && Array.isArray(foundCase.members) && foundCase.members.length > 0) {
      membersList = foundCase.members.map((m: any) => ({
        name: m.name || m.fullName || m.full_name || "",
        email: m.email || "",
        idNo: m.email || m.position || "",
      })).filter((m: any) => m.name.trim() !== "");
    }
    if (membersList.length === 0) {
      membersList = [{ name: "", email: "", idNo: "" }];
    }

    // Set initial synchronous form state
    setFormState({
      caseNo: cleanCaseNo,
      accusedName: foundCase?.accusedName && foundCase.accusedName !== "—" ? foundCase.accusedName : "—",
      accusedDesignation: foundCase?.accusedDesignation && foundCase.accusedDesignation !== "—" ? foundCase.accusedDesignation : "Educational Officer",
      schoolName: foundCase?.schoolName && foundCase.schoolName !== "—" ? foundCase.schoolName : "—",
      subject: foundCase?.subject && foundCase.subject !== "—" ? foundCase.subject : `Inquiry Case ${cleanCaseNo}`,
      stage: foundCase?.stage || "Conducting an Inquiry",
      priority: foundCase?.priority || "medium",
      inquiryType: (asgn?.inquiryType || asgn?.inquiry_type || "Institutional basic inquiry") as any,
      chairmanName: committee.chairmanName || (foundCase?.chairman?.name || foundCase?.chairman?.fullName || ""),
      chairmanEmail: committee.chairmanEmail || (foundCase?.chairman?.email || ""),
      chairmanId: committee.chairmanEmail || (foundCase?.chairman?.email || ""),
      members: membersList,
      appointmentLetterDate: formatToInputDate(asgn?.appointmentDate || asgn?.appointment_date),
      reportDueDate: formatToInputDate(asgn?.reportDueDate || asgn?.report_due_date),
      extensionTerm: asgn?.extensionTerm || asgn?.extension_term || "None",
      extensionStartDate: formatToInputDate(asgn?.extensionStartDate || asgn?.extension_start_date),
      extensionEndDate: formatToInputDate(asgn?.extensionEndDate || asgn?.extension_end_date),
      upcomingAction: asgn?.upcomingAction || asgn?.upcoming_action || foundCase?.upcomingAction || foundCase?.upcoming_action || "",
      appointmentDate: formatToInputDate(asgn?.provAppointmentDate || asgn?.appointment_date),
      dueDate: formatToInputDate(asgn?.provDueDate || asgn?.due_date),
      title: asgn?.title || "",
      approvalDate: formatToInputDate(asgn?.approvalDate || asgn?.approval_date),
      reportReceivedDate: formatToInputDate(asgn?.reportReceivedDate || asgn?.report_received_date),
      officers: Array.isArray(asgn?.officers) ? asgn.officers : (typeof asgn?.officers === "string" && asgn.officers.trim() ? asgn.officers.split(",").map((s: string) => s.trim()).filter(Boolean) : []),
      recommendation: asgn?.recommendation || asgn?.recommendationText || asgn?.notes || "",
    });

    // Asynchronously fetch rich auto-fill details from PostgreSQL and Supabase
    try {
      const res = await getConductInquiryCaseDetailsServer(cleanCaseNo);
      if (res && res.success && res.data) {
        const d = res.data;
        const validFetchedMembers = (d.members && Array.isArray(d.members) && d.members.length > 0 && d.members[0].name) ? d.members : null;

        setFormState((prev) => ({
          ...prev,
          caseNo: cleanCaseNo,
          accusedName: d.accusedName || (prev.accusedName !== "—" ? prev.accusedName : "—"),
          accusedDesignation: d.accusedDesignation || (prev.accusedDesignation !== "—" ? prev.accusedDesignation : "Educational Officer"),
          schoolName: d.schoolName || (prev.schoolName !== "—" ? prev.schoolName : "—"),
          subject: d.subject || (prev.subject !== "—" ? prev.subject : `Inquiry Case ${cleanCaseNo}`),
          inquiryType: (d.inquiryType as any) || prev.inquiryType || "Institutional basic inquiry",
          chairmanName: d.chairmanName || prev.chairmanName,
          chairmanEmail: d.chairmanEmail || d.chairmanId || prev.chairmanEmail,
          chairmanId: d.chairmanEmail || d.chairmanId || prev.chairmanId,
          members: validFetchedMembers || prev.members,
          appointmentLetterDate: formatToInputDate(d.appointmentLetterDate) || prev.appointmentLetterDate,
          reportDueDate: formatToInputDate(d.reportDueDate) || prev.reportDueDate,
          extensionTerm: d.extensionTerm && d.extensionTerm !== "None" ? d.extensionTerm : prev.extensionTerm,
          extensionStartDate: formatToInputDate(d.extensionStartDate) || prev.extensionStartDate,
          extensionEndDate: formatToInputDate(d.extensionEndDate) || prev.extensionEndDate,
          upcomingAction: d.upcomingAction || prev.upcomingAction || "",
          appointmentDate: formatToInputDate(d.appointmentDate) || prev.appointmentDate,
          dueDate: formatToInputDate(d.dueDate) || prev.dueDate,
          title: d.title || prev.title,
          approvalDate: formatToInputDate(d.approvalDate) || prev.approvalDate,
          reportReceivedDate: formatToInputDate(d.reportReceivedDate) || prev.reportReceivedDate,
          officers: Array.isArray(d.officers) ? d.officers : (typeof d.officers === "string" && d.officers.trim() ? d.officers.split(",").map((s: string) => s.trim()).filter(Boolean) : prev.officers),
          recommendation: d.recommendation || prev.recommendation,
        }));

        // Supabase Fallback for members if server returned empty
        if (!validFetchedMembers && isSupabaseConfigured) {
          try {
            const { data: supaMems } = await supabase
              .from("members_by_case")
              .select("*")
              .ilike("ref_number", cleanCaseNo);
            if (supaMems && supaMems.length > 0) {
              const mapped = supaMems.map((m: any) => ({
                name: m.full_name || m.fullName || "",
                email: m.email || "",
                idNo: m.email || m.position || "",
              })).filter((m: any) => m.name.trim() !== "");
              if (mapped.length > 0) {
                setFormState((prev) => {
                  if (prev.caseNo.toLowerCase() === cleanCaseNo.toLowerCase()) {
                    return { ...prev, members: mapped };
                  }
                  return prev;
                });
              }
            }
          } catch (e) {}
        }

        // Supabase Fallback for Date Extension if not retrieved
        if ((!d.extensionTerm || d.extensionTerm === "None") && isSupabaseConfigured) {
          try {
            const { data: supaExt } = await supabase
              .from("case_by_date_extention")
              .select("*")
              .or(`subject_file_no.ilike.${cleanCaseNo.trim()},sub_file_no.ilike.${cleanCaseNo.trim()}`)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (supaExt) {
              let term = supaExt.extention_term || supaExt.extension_term || "None";
              if (term.includes("1") || term.toLowerCase().includes("first")) term = "1st Extension";
              else if (term.includes("2") || term.toLowerCase().includes("second")) term = "2nd Extension";
              else if (term.includes("3") || term.toLowerCase().includes("third")) term = "3rd Extension";
              else if (term.includes("4") || term.toLowerCase().includes("fourth")) term = "4th Extension";

              setFormState((prev) => {
                if (prev.caseNo.toLowerCase() === cleanCaseNo.toLowerCase()) {
                  return {
                    ...prev,
                    extensionTerm: term,
                    extensionStartDate: formatToInputDate(supaExt.start_date) || prev.extensionStartDate,
                    extensionEndDate: formatToInputDate(supaExt.end_date) || prev.extensionEndDate,
                  };
                }
                return prev;
              });
            }
          } catch (e) {}
        }

        // Also update availableCases state so dropdown options show updated officer names
        setAvailableCases((prevList) =>
          prevList.map((c) =>
            (c.caseNo || "").trim().toLowerCase() === cleanCaseNo.toLowerCase()
              ? {
                  ...c,
                  accusedName: d.accusedName || c.accusedName,
                  accusedDesignation: d.accusedDesignation || c.accusedDesignation,
                  schoolName: d.schoolName || c.schoolName,
                  subject: d.subject || c.subject,
                }
              : c
          )
        );
      }
    } catch (err) {
      console.warn("Auto-fill server action fallback:", err);
    }
  };

  const handleSelectCaseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCaseNo = e.target.value;
    setSelectedCaseNo(newCaseNo);
    loadCaseIntoForm(newCaseNo);
  };

  // Save Handler
  const handleSave = async () => {
    if (!formState.caseNo) {
      showToast(lang === "si" ? "කරුණාකර යොමු අංකයක් තෝරන්න" : "Please select a valid case number.");
      return;
    }

    setSaving(true);
    try {
      const caseNo = formState.caseNo;

      const chairmanObj = formState.chairmanName.trim()
        ? {
            name: formState.chairmanName.trim(),
            fullName: formState.chairmanName.trim(),
            email: formState.chairmanEmail.trim() || undefined,
            nic: formState.chairmanEmail.trim() || undefined,
            nicNo: formState.chairmanEmail.trim() || undefined,
          }
        : null;

      const validMembers = formState.members
        .filter((m) => m.name.trim() !== "")
        .map((m) => ({
          name: m.name.trim(),
          fullName: m.name.trim(),
          email: m.email.trim() || undefined,
          nic: m.email.trim() || undefined,
          idNo: m.email.trim() || undefined,
        }));

      const isInqInstitutional = formState.inquiryType === "Institutional basic inquiry";
      const apptDate = isInqInstitutional ? (formState.appointmentLetterDate || null) : (formState.appointmentDate || null);
      const dueDate = isInqInstitutional ? (formState.reportDueDate || null) : (formState.dueDate || null);
      const extTerm = isInqInstitutional ? (formState.extensionTerm || "None") : "None";
      const extStart = isInqInstitutional ? (formState.extensionStartDate || null) : null;
      const extEnd = isInqInstitutional ? (formState.extensionEndDate || null) : null;
      const recommendationText = formState.recommendation || "";
      const upcomingAct = isInqInstitutional ? (formState.upcomingAction || "") : "";
      const officersText = formState.officers.join(", ");

      // 1. LocalStorage update
      if (typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem("dcmms_subject_assignments") || "[]";
          let list = JSON.parse(stored);
          const idx = list.findIndex((a: any) => String(a.caseNo || a.case_no || "").trim().toLowerCase() === caseNo.trim().toLowerCase());

          const updatedRecord = {
            ...(idx >= 0 ? list[idx] : {}),
            id: idx >= 0 && list[idx].id ? list[idx].id : `asgn-${caseNo}`,
            caseNo: caseNo,
            case_no: caseNo,
            subjectOfficerName: "Assigned Subject Officer",
            inquiryType: formState.inquiryType,
            inquiry_type: formState.inquiryType,
            chairman: chairmanObj,
            members: validMembers,
            appointmentDate: apptDate,
            appointment_date: apptDate,
            reportDueDate: dueDate,
            report_due_date: dueDate,
            datesSubmittedBySubject: true,
            extensionTerm: extTerm,
            extension_term: extTerm,
            extensionStartDate: extStart,
            extension_start_date: extStart,
            extensionEndDate: extEnd,
            extension_end_date: extEnd,
            // Province fields
            provAppointmentDate: formState.appointmentDate || null,
            provDueDate: formState.dueDate || null,
            title: formState.title || "",
            approvalDate: formState.approvalDate || null,
            reportReceivedDate: formState.reportReceivedDate || null,
            officers: formState.officers,
            recommendation: recommendationText,
            recommendationText: recommendationText,
            upcomingAction: upcomingAct,
            upcoming_action: upcomingAct,
            notes: recommendationText || (idx >= 0 ? list[idx].notes : ""),
            status: upcomingAct.toLowerCase().includes("finalize") || upcomingAct.includes("අතිරේක ලේකම්") || upcomingAct.includes("මාණ්ඩලික") || upcomingAct.includes("කටයුතු අවසන්") ? "Closed" : "Conducting an Inquiry",
            updatedAt: new Date().toISOString(),
          };

          if (idx >= 0) {
            list[idx] = updatedRecord;
          } else {
            list.push(updatedRecord);
          }
          localStorage.setItem("dcmms_subject_assignments", JSON.stringify(list));
        } catch (e) {}

        try {
          const storedCases = localStorage.getItem("dcmms_cases") || "[]";
          let casesList = JSON.parse(storedCases);
          const cIdx = casesList.findIndex((c: any) => String(c.caseNo || c.refNo || "").trim().toLowerCase() === caseNo.trim().toLowerCase());
          if (cIdx >= 0) {
            casesList[cIdx].inquiryType = formState.inquiryType;
            casesList[cIdx].appointmentDate = apptDate;
            casesList[cIdx].reportDueDate = dueDate;
            casesList[cIdx].targetDate = dueDate;
            if (upcomingAct) {
              casesList[cIdx].upcomingAction = upcomingAct;
              casesList[cIdx].upcoming_action = upcomingAct;
            }
            if (upcomingAct.toLowerCase().includes("finalize") || upcomingAct.includes("අතිරේක ලේකම්") || upcomingAct.includes("මාණ්ඩලික") || upcomingAct.includes("කටයුතු අවසන්")) {
              casesList[cIdx].status = "Closed";
              casesList[cIdx].stage = "Closed";
            } else {
              casesList[cIdx].status = "Conducting an Inquiry";
              casesList[cIdx].stage = "Conducting an Inquiry";
            }
            if (recommendationText) {
              casesList[cIdx].recommendation = recommendationText;
            }
            localStorage.setItem("dcmms_cases", JSON.stringify(casesList));
          }
        } catch (e) {}

        window.dispatchEvent(new CustomEvent("dcmms_assignment_updated"));
        window.dispatchEvent(new Event("storage"));
      }

      // 2. Dedicated PostgreSQL Unified Server Action
      try {
        await saveConductInquiryServer({
          case_no: caseNo,
          inquiry_type: formState.inquiryType,
          chairman_name: chairmanObj?.name || null,
          chairman_email: chairmanObj?.email || null,
          committee_members: validMembers,
          appointment_letter_date: formState.appointmentLetterDate || null,
          report_due_date: formState.reportDueDate || null,
          extension_term: extTerm,
          extension_start_date: extStart,
          extension_end_date: extEnd,
          upcoming_action: upcomingAct,
          appointment_date: formState.appointmentDate || null,
          due_date: formState.dueDate || null,
          title: formState.title || null,
          approval_date: formState.approvalDate || null,
          report_received_date: formState.reportReceivedDate || null,
          officers: officersText || null,
          recommendation: recommendationText,
        });
      } catch (e) {}

      // 2.1 Sync PostgreSQL Dates Table
      try {
        await saveCaseByAppointmentAndReportDueDateServer({
          subject_file_no: caseNo,
          sub_file_no: caseNo,
          inquiry_type: formState.inquiryType,
          appointment_letter_date: formState.appointmentLetterDate || null,
          report_due_date: formState.reportDueDate || null,
          appointment_date: formState.appointmentDate || null,
          due_date: formState.dueDate || null,
          title: formState.title || null,
          approval_date: formState.approvalDate || null,
          report_received_date: formState.reportReceivedDate || null,
          officers: officersText || null,
          recommendation: recommendationText,
          upcoming_action: upcomingAct || null,
          dates_submitted_by_subject: true,
        });
      } catch (e) {}

      if (isInqInstitutional) {
        try {
          await saveChairmanByCaseServer(caseNo, chairmanObj ? {
            fullName: chairmanObj.name,
            email: chairmanObj.email,
            position: "Chairman",
          } : null);
        } catch (e) {}

        try {
          await saveMembersByCaseServer(
            caseNo,
            validMembers.map((m) => ({
              fullName: m.fullName,
              email: m.email,
              position: "Member",
            }))
          );
        } catch (e) {}

        try {
          await saveReplyLetterDetailsServer({
            ref_number: caseNo,
            upcoming_action: upcomingAct || null,
            description: recommendationText || null,
          });
        } catch (e) {}

        try {
          if (extTerm && extTerm !== "None" && (extStart || extEnd)) {
            await saveCaseByDateExtensionServer({
              subject_file_no: caseNo,
              sub_file_no: caseNo,
              extention_term: extTerm,
              start_date: extStart,
              end_date: extEnd,
              approval_status: "Pending",
            });
          } else if (extTerm === "None" && !extStart && !extEnd) {
            await saveCaseByDateExtensionServer({
              subject_file_no: caseNo,
              sub_file_no: caseNo,
              extention_term: "None",
              start_date: null,
              end_date: null,
              approval_status: "None",
            });
          }
        } catch (e) {}
      }

      // 3. Supabase Table Upsert
      if (isSupabaseConfigured) {
        // 3.0. Upsert to Supabase conduct_inquiry_table
        try {
          await supabase.from("conduct_inquiry_table").upsert({
            case_no: caseNo.trim(),
            inquiry_type: formState.inquiryType,
            chairman_name: chairmanObj?.name || null,
            chairman_email: chairmanObj?.email || null,
            committee_members: validMembers,
            appointment_letter_date: formState.appointmentLetterDate || null,
            report_due_date: formState.reportDueDate || null,
            extension_term: extTerm,
            extension_start_date: extStart,
            extension_end_date: extEnd,
            upcoming_action: upcomingAct || null,
            appointment_date: formState.appointmentDate || null,
            due_date: formState.dueDate || null,
            title: formState.title || null,
            approval_date: formState.approvalDate || null,
            report_received_date: formState.reportReceivedDate || null,
            officers: officersText || null,
            recommendation: recommendationText,
            updated_at: new Date().toISOString(),
          }, { onConflict: "case_no" });
        } catch (e) {}

        // 3.1. Upsert to Supabase case_by_appointment_and_report_due_date
        try {
          await supabase.from("case_by_appointment_and_report_due_date").upsert({
            subject_file_no: caseNo.trim(),
            sub_file_no: caseNo.trim(),
            inquiry_type: formState.inquiryType,
            appointment_letter_date: formState.appointmentLetterDate || null,
            report_due_date: formState.reportDueDate || null,
            appointment_date: formState.appointmentDate || null,
            due_date: formState.dueDate || null,
            title: formState.title || null,
            approval_date: formState.approvalDate || null,
            report_received_date: formState.reportReceivedDate || null,
            officers: officersText || null,
            recommendation: recommendationText,
            upcoming_action: upcomingAct || null,
            dates_submitted_by_subject: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: "subject_file_no" });
        } catch (e) {}

        // 3.2. Institutional Committee tables on Supabase
        if (isInqInstitutional) {
          try {
            if (chairmanObj) {
              let validEmail = null;
              if (chairmanObj.email) {
                const { data: commData } = await supabase
                  .from("commitee_table")
                  .select("email")
                  .ilike("email", chairmanObj.email.trim())
                  .maybeSingle();
                if (commData) validEmail = commData.email;
              }
              await supabase.from("chairment_by_case").upsert({
                ref_number: caseNo.trim(),
                full_name: chairmanObj.name,
                position: "Chairman",
                email: validEmail,
                updated_at: new Date().toISOString(),
              }, { onConflict: "ref_number" });
            } else {
              await supabase.from("chairment_by_case").delete().eq("ref_number", caseNo.trim());
            }
          } catch (e) {}

          try {
            await supabase.from("members_by_case").delete().eq("ref_number", caseNo.trim());
            if (validMembers.length > 0) {
              const memberRowsToInsert = [];
              for (const m of validMembers) {
                const fName = (m.fullName || m.name || "").trim();
                if (!fName) continue;
                let validEmail = m.email ? m.email.trim() : null;
                if (validEmail) {
                  const { data: commData } = await supabase
                    .from("commitee_table")
                    .select("email")
                    .ilike("email", validEmail)
                    .maybeSingle();
                  if (commData?.email) validEmail = commData.email;
                } else if (fName) {
                  const { data: commByName } = await supabase
                    .from("commitee_table")
                    .select("email")
                    .ilike("full_name", fName)
                    .maybeSingle();
                  if (commByName?.email) validEmail = commByName.email;
                }

                memberRowsToInsert.push({
                  ref_number: caseNo.trim(),
                  full_name: fName,
                  position: "Member",
                  email: validEmail,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
              }

              if (memberRowsToInsert.length > 0) {
                await supabase.from("members_by_case").insert(memberRowsToInsert);
              }
            }
          } catch (e) {}

          try {
            if (extTerm && extTerm !== "None" && (extStart || extEnd)) {
              const { data: existingExt } = await supabase
                .from("case_by_date_extention")
                .select("id")
                .or(`subject_file_no.ilike.${caseNo.trim()},sub_file_no.ilike.${caseNo.trim()}`)
                .limit(1)
                .maybeSingle();

              const extPayload: any = {
                subject_file_no: caseNo.trim(),
                sub_file_no: caseNo.trim(),
                extention_term: extTerm,
                start_date: extStart,
                end_date: extEnd,
                approval_status: "Pending",
                updated_at: new Date().toISOString(),
              };

              if (existingExt && existingExt.id) {
                await supabase
                  .from("case_by_date_extention")
                  .update(extPayload)
                  .eq("id", existingExt.id);
              } else {
                extPayload.created_at = new Date().toISOString();
                const { error: insErr } = await supabase
                  .from("case_by_date_extention")
                  .insert(extPayload);
                if (insErr) {
                  await supabase.from("case_by_date_extention").insert({
                    subject_file_no: caseNo.trim(),
                    extention_term: extTerm,
                    start_date: extStart,
                    end_date: extEnd,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  });
                }
              }
            } else if (extTerm === "None" && !extStart && !extEnd) {
              await supabase
                .from("case_by_date_extention")
                .delete()
                .or(`subject_file_no.ilike.${caseNo.trim()},sub_file_no.ilike.${caseNo.trim()}`);
            }
          } catch (e) {}
        }

        try {
          await supabase.from("dcmms_subject_assignments").upsert({
            case_no: caseNo,
            subject_officer_name: "Assigned Subject Officer",
            inquiry_type: formState.inquiryType,
            chairman: chairmanObj,
            members: validMembers,
            appointment_date: apptDate,
            report_due_date: dueDate,
            extension_term: extTerm,
            extension_start_date: extStart,
            extension_end_date: extEnd,
            title: formState.title || null,
            approval_date: formState.approvalDate || null,
            report_received_date: formState.reportReceivedDate || null,
            officers: officersText || null,
            recommendation: recommendationText,
            upcoming_action: upcomingAct,
            notes: recommendationText,
            status: upcomingAct.toLowerCase().includes("finalize") || upcomingAct.includes("අතිරේක ලේකම්") || upcomingAct.includes("මාණ්ඩලික") || upcomingAct.includes("කටයුතු අවසන්") ? "Closed" : "Conducting an Inquiry",
            updated_at: new Date().toISOString(),
          });
        } catch (e) {}
      }

      showToast(t("inquiryDetailsSavedSuccess", "Inquiry details saved successfully!"));
      setTimeout(() => {
        router.push("/subject?tab=conducting_inquiry");
      }, 1000);
    } catch (err: any) {
      console.error("Save error:", err);
      showToast("Error saving inquiry details: " + (err?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

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

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (e) {}
    router.push("/login");
  };

  if (!mounted) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <div className="loading-spinner" />
          <div style={{ color: "#64748b", fontWeight: 600, fontSize: "14px" }}>
            Loading Conduct an inquiry...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container" data-font-scale={fontScale} suppressHydrationWarning>
      {/* Skip Link (A11y) */}
      <a href="#dashboard-main-content" className="skip-link">
        {t("skipLink", "Skip to main content")}
      </a>

      {/* Sidebar Navigation */}
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
        role="subject"
      />

      <div className="dashboard-layout">
        <main id="dashboard-main-content" className="dashboard-content">
          {/* ── Top App Bar Header ── */}
          <header className="dashboard-header" suppressHydrationWarning>
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
              <div className="dashboard-title-area" suppressHydrationWarning>
                <h2 className="dashboard-main-title">{t("subjectOfficer", "Subject Officer")}</h2>
                <p className="dashboard-main-subtitle">{t("subjectOfficerDesc", "Conducting an Inquiry Management & Details")}</p>
              </div>
            </div>

            <div className="dashboard-header-right" suppressHydrationWarning>
              {/* Date display badge */}
              <div className="date-badge">
                <span suppressHydrationWarning>{getFormattedDate()}</span>
                <svg className="date-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
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
                    aria-label={t("fontSmall", "Small text")}
                    className="sr-only"
                  />
                  A-
                </label>
                <label className={`size-btn size-btn-medium${fontScale === "medium" ? " active" : ""}`}>
                  <input
                    type="radio"
                    name="dashboardFontScale"
                    value="medium"
                    checked={fontScale === "medium"}
                    onChange={() => setFontScale("medium")}
                    aria-label={t("fontMedium", "Default text")}
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
                    aria-label={t("fontLarge", "Large text")}
                    className="sr-only"
                  />
                  A+
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
                    onChange={() => i18n.changeLanguage("si")}
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
                    onChange={() => i18n.changeLanguage("ta")}
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
                    onChange={() => i18n.changeLanguage("en")}
                    aria-label="Switch dashboard language to English"
                    className="sr-only"
                  />
                  English
                </label>
              </div>
            </div>
          </header>

          {/* Main Form Page Container */}
          <section className="conduct-inquiry-page-wrapper" suppressHydrationWarning>
            {/* Toast Notification */}
            {toastMessage && (
              <div className="toast-notification" role="alert" style={{ marginBottom: "16px" }}>
                <div className="toast-icon">
                  <CheckCircle size={18} />
                </div>
                <span className="toast-text">{toastMessage}</span>
                <button type="button" className="toast-close" onClick={() => setToastMessage("")}>
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Breadcrumbs */}
            <div className="conduct-inquiry-breadcrumb" suppressHydrationWarning>
              <Link href="/subject">{t("subjectOfficer", "Subject Officer")}</Link>
              <ChevronRight size={14} />
              <Link href="/subject?tab=conducting_inquiry">{t("conductingInquiryTab", "Conducting an inquiry")}</Link>
              <ChevronRight size={14} />
              <span style={{ color: "#0f172a", fontWeight: 700 }}>{t("conductInquiryTitle", "Conduct an inquiry")}</span>
            </div>

            {/* Page Header */}
            <div className="conduct-inquiry-page-header" suppressHydrationWarning>
              <div className="conduct-inquiry-title-group" suppressHydrationWarning>
                <h1>
                  <ShieldCheck style={{ color: "#0284c7", width: "28px", height: "28px" }} />
                  <span>{t("conductInquiryTitle", "Conduct an inquiry")}</span>
                </h1>
                <p suppressHydrationWarning>
                  {lang === "si"
                    ? "පරීක්ෂණ කමිටු තොරතුරු, ලිපි දිනයන්, දින දීර්ඝ කිරීම් සහ මූලික විමර්ශන නිර්දේශ වාර්තා කිරීම."
                    : lang === "ta"
                    ? "விசாரணைக் குழு விவரங்கள், நியமன தேதிகள், நீட்டிப்பு காலங்கள் மற்றும் விரிவான பரிந்துரைகள்."
                    : "Appointed inquiry committee members, appointment & due dates, extension terms, and detailed recommendations."}
                </p>
              </div>

              <div className="conduct-inquiry-header-actions" suppressHydrationWarning>
                <Link href="/subject?tab=conducting_inquiry" className="btn-back-inquiries">
                  <ArrowLeft size={16} />
                  <span>{lang === "si" ? "නැවත ලැයිස්තුවට" : "Back to Inquiries"}</span>
                </Link>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-save-inquiry-main"
                >
                  {saving ? (
                    <>
                      <Clock size={16} className="animate-spin" />
                      <span>{lang === "si" ? "ඉදිරිපත් කරමින් පවතී..." : lang === "ta" ? "சமர்ப்பிக்கப்படுகிறது..." : "Submitting..."}</span>
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>{t("submitInquiryDetails", "Submit")}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Main Form Layout */}
            <div className="conduct-inquiry-form-layout">
              
              {/* SECTION 1: Case Current Details (From paper sketch: "case current details.") */}
              <div className="conduct-inquiry-section-card" style={{ borderColor: "#bae6fd", backgroundColor: "#ffffff" }}>
                <div className="conduct-inquiry-section-header" style={{ borderColor: "#e0f2fe" }}>
                  <div className="conduct-inquiry-section-title" style={{ color: "#0369a1" }}>
                    <FileText size={18} style={{ color: "#0284c7" }} />
                    <span>{t("caseCurrentDetails", "Case Current Details")}</span>
                  </div>

                  {availableCases.length > 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Switch Case:</span>
                      <select
                        value={selectedCaseNo}
                        onChange={handleSelectCaseChange}
                        className="ci-select"
                        style={{ width: "auto", minWidth: "220px", padding: "6px 12px", fontSize: "13px" }}
                      >
                        {availableCases.map((c: any) => (
                          <option key={c.caseNo} value={c.caseNo}>
                            {c.caseNo} — {c.accusedName || "Officer"}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="case-preview-banner">
                  <div className="case-preview-item">
                    <span className="case-preview-label">{t("caseNo", "Case / Letter No")}:</span>
                    <span className="case-preview-value" style={{ color: "#0284c7", fontWeight: 800, fontSize: "15px" }}>
                      {formState.caseNo || "—"}
                    </span>
                  </div>

                  <div className="case-preview-item">
                    <span className="case-preview-label">{t("accusedOfficer", "Accused Officer")}:</span>
                    <span className="case-preview-value">
                      {formState.accusedName || "—"}
                    </span>
                  </div>

                  <div className="case-preview-item">
                    <span className="case-preview-label">{t("designation", "Designation")}:</span>
                    <span className="case-preview-value">
                      {formState.accusedDesignation || "—"}
                    </span>
                  </div>

                  <div className="case-preview-item">
                    <span className="case-preview-label">{t("institute", "Institution / School")}:</span>
                    <span className="case-preview-value">
                      {formState.schoolName || "—"}
                    </span>
                  </div>

                  <div className="case-preview-item" style={{ gridColumn: "1 / -1" }}>
                    <span className="case-preview-label">{t("subjectText", "Subject / Matter of the letter")}:</span>
                    <span className="case-preview-value" style={{ fontWeight: 500, color: "#334155" }}>
                      {formState.subject || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* INQUIRY COMMITTEE DETAILS & TYPE OF INQUIRY (PAPER SKETCH DESIGN) */}
              <div className="ci-type-selector-banner">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <div className="ci-subheading">
                      <ShieldCheck size={20} style={{ color: "#0284c7" }} />
                      <span>{t("inquiryCommitteeDetails", "Inquiry commitee details.")}</span>
                    </div>
                    <span style={{ fontSize: "12.5px", color: "#64748b" }}>
                      {lang === "si" ? "පරීක්ෂණ වර්ගය තෝරා අදාළ කමිටු තොරතුරු සම්පූර්ණ කරන්න." : "Select inquiry type and provide designated committee details."}
                    </span>
                  </div>

                  {/* Dropdown matching the sketch: "type of inquiry" */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <label htmlFor="inquiryTypeSelect" style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
                      {t("typeOfInquiry", "type of inquiry")} :
                    </label>
                    <select
                      id="inquiryTypeSelect"
                      className="ci-select"
                      style={{ width: "auto", minWidth: "250px", padding: "8px 14px", fontWeight: 700, borderColor: "#0284c7" }}
                      value={formState.inquiryType}
                      onChange={(e) => setFormState((prev) => ({ ...prev, inquiryType: e.target.value as any }))}
                    >
                      <option value="Institutional basic inquiry">
                        {t("institutionalBasicInquiry", "Institutional basic inquiry")}
                      </option>
                      <option value="Province basic inquiry">
                        {t("provinceBasicInquiry", "Province basic inquiry")}
                      </option>
                    </select>
                  </div>
                </div>

                {/* Quick Toggle Pills */}
                <div className="ci-type-pills">
                  <button
                    type="button"
                    onClick={() => setFormState((prev) => ({ ...prev, inquiryType: "Institutional basic inquiry" }))}
                    className={`ci-type-pill ${formState.inquiryType === "Institutional basic inquiry" ? "active-institutional" : ""}`}
                  >
                    <Building size={16} />
                    <span>• {t("institutionalBasicInquiry", "Institutional basic inquiry")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormState((prev) => ({ ...prev, inquiryType: "Province basic inquiry" }))}
                    className={`ci-type-pill ${formState.inquiryType === "Province basic inquiry" ? "active-province" : ""}`}
                  >
                    <Compass size={16} />
                    <span>• {t("provinceBasicInquiry", "Province basic inquiry")}</span>
                  </button>
                </div>
              </div>

              {/* ============================================================
                  CASE 1: IF SELECT THE INSTITUTIONAL BASIC INQUIRY (Sketch Left Box)
                  ============================================================ */}
              {formState.inquiryType === "Institutional basic inquiry" && (
                <div className="ci-sketch-container institutional">
                  <div className="ci-sketch-tag institutional">
                    <Building size={14} />
                    <span>{lang === "si" ? "ආයතනික මූලික පරීක්ෂණය (if select the institutional basic inquiry)" : "if select the institutional basic inquiry"}</span>
                  </div>

                  {/* Chairman details row: chairman name & chairman email */}
                  <div className="conduct-inquiry-section-card" style={{ marginBottom: "18px" }}>
                    <div className="conduct-inquiry-section-header">
                      <div className="conduct-inquiry-section-title">
                        <UserCheck size={18} style={{ color: "#0284c7" }} />
                        <span>👑 {lang === "si" ? "සභාපති විස්තර (Chairman Details)" : "Chairman Details"}</span>
                      </div>
                    </div>
                    <div className="ci-grid-2">
                      <div className="ci-input-group">
                        <label className="ci-label">
                          <span>{t("chairmanName", "chairman name")} :</span>
                        </label>
                        <input
                          type="text"
                          list="ci-chairman-datalist"
                          className="ci-input"
                          placeholder={lang === "si" ? "සභාපති නිලධාරීගේ නම ඇතුළත් කරන්න" : "Enter Chairman's name"}
                          value={formState.chairmanName}
                          onChange={(e) => {
                            const val = e.target.value;
                            const matched = committeeOfficers.find((o) => o.fullName.toLowerCase().trim() === val.toLowerCase().trim());
                            setFormState((prev) => ({
                              ...prev,
                              chairmanName: val,
                              chairmanEmail: matched?.email ? matched.email : prev.chairmanEmail,
                              chairmanId: matched?.email ? matched.email : prev.chairmanId,
                            }));
                          }}
                        />
                        <datalist id="ci-chairman-datalist">
                          {committeeOfficers.map((o) => (
                            <option key={o.id || o.fullName} value={o.fullName}>
                              {o.position ? `${o.fullName} (${o.position})` : o.fullName} {o.email ? `- ${o.email}` : ""}
                            </option>
                          ))}
                        </datalist>
                      </div>

                      <div className="ci-input-group">
                        <label className="ci-label">
                          <span>{t("chairmanEmail", "chairman email")} :</span>
                        </label>
                        <input
                          type="email"
                          className="ci-input"
                          placeholder={lang === "si" ? "සභාපති විද්‍යුත් තැපෑල (chairman@moe.gov.lk)" : "Enter Chairman's email"}
                          value={formState.chairmanEmail}
                          onChange={(e) =>
                            setFormState((prev) => ({ ...prev, chairmanEmail: e.target.value, chairmanId: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Committee member row: member name & member email */}
                  <div className="conduct-inquiry-section-card" style={{ marginBottom: "18px" }}>
                    <div className="conduct-inquiry-section-header">
                      <div className="conduct-inquiry-section-title">
                        <UserCheck size={18} style={{ color: "#0284c7" }} />
                        <span>👥 {t("inquiryCommitteeDetails", "committee member")} :</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setFormState((prev) => ({
                            ...prev,
                            members: [...prev.members, { name: "", email: "", idNo: "" }],
                          }));
                        }}
                        className="ci-btn-add-member"
                        title="Add another committee member"
                      >
                        <Plus size={15} />
                        <span>{t("addMember", "Add Member (+)")}</span>
                      </button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {formState.members.map((member, mIdx) => (
                        <div key={mIdx} className="ci-member-card">
                          <div style={{ flex: 1 }}>
                            <label className="ci-label" style={{ fontSize: "11.5px", marginBottom: "5px" }}>
                              {t("memberName", "member name")} #{mIdx + 1} :
                            </label>
                            <input
                              type="text"
                              list={`ci-member-datalist-${mIdx}`}
                              className="ci-input"
                              placeholder={lang === "si" ? `සාමාජික #${mIdx + 1} නම` : `member #${mIdx + 1} name`}
                              value={member.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                const matched = committeeOfficers.find((o) => o.fullName.toLowerCase().trim() === val.toLowerCase().trim());
                                const updated = [...formState.members];
                                updated[mIdx].name = val;
                                if (matched?.email) {
                                  updated[mIdx].email = matched.email;
                                  updated[mIdx].idNo = matched.email;
                                }
                                setFormState((prev) => ({ ...prev, members: updated }));
                              }}
                            />
                            <datalist id={`ci-member-datalist-${mIdx}`}>
                              {committeeOfficers.map((o) => (
                                <option key={o.id || o.fullName} value={o.fullName}>
                                  {o.position ? `${o.fullName} (${o.position})` : o.fullName} {o.email ? `- ${o.email}` : ""}
                                </option>
                              ))}
                            </datalist>
                          </div>

                          <div style={{ flex: 1 }}>
                            <label className="ci-label" style={{ fontSize: "11.5px", marginBottom: "5px" }}>
                              {t("memberEmail", "member email")} :
                            </label>
                            <input
                              type="email"
                              className="ci-input"
                              placeholder={lang === "si" ? "සාමාජික විද්‍යුත් තැපෑල (member@moe.gov.lk)" : "Enter member's email"}
                              value={member.email || member.idNo || ""}
                              onChange={(e) => {
                                const updated = [...formState.members];
                                updated[mIdx].email = e.target.value;
                                updated[mIdx].idNo = e.target.value;
                                setFormState((prev) => ({ ...prev, members: updated }));
                              }}
                            />
                          </div>

                          {formState.members.length > 1 && (
                            <div style={{ alignSelf: "flex-end", marginBottom: "2px" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setFormState((prev) => ({
                                    ...prev,
                                    members: prev.members.filter((_, idx) => idx !== mIdx),
                                  }));
                                }}
                                className="ci-btn-remove-member"
                                title="Remove member"
                              >
                                <X size={18} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Appointment date & Report due date: Appointment letter date & report due date */}
                  <div className="conduct-inquiry-section-card" style={{ marginBottom: "18px" }}>
                    <div className="conduct-inquiry-section-header">
                      <div className="conduct-inquiry-section-title">
                        <CalendarIcon size={18} style={{ color: "#0284c7" }} />
                        <span>{t("appointmentLetterDateAndReportDueDate", "Appointment date & Report due date.")}</span>
                      </div>
                    </div>

                    <div className="ci-grid-2">
                      <div className="ci-input-group">
                        <label className="ci-label">
                          <span>📅 {t("appointmentLetterDate", "Appointment letter date")} :</span>
                        </label>
                        <input
                          type="date"
                          className="ci-input"
                          value={formState.appointmentLetterDate}
                          onChange={(e) =>
                            setFormState((prev) => ({ ...prev, appointmentLetterDate: e.target.value }))
                          }
                        />
                      </div>

                      <div className="ci-input-group">
                        <label className="ci-label">
                          <span>🎯 {t("reportDueDate", "report due date")} :</span>
                        </label>
                        <input
                          type="date"
                          className="ci-input"
                          value={formState.reportDueDate}
                          onChange={(e) =>
                            setFormState((prev) => ({ ...prev, reportDueDate: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Extention of days: extention term, start date, End date */}
                  <div className="conduct-inquiry-section-card" style={{ marginBottom: "18px" }}>
                    <div className="conduct-inquiry-section-header">
                      <div className="conduct-inquiry-section-title">
                        <Clock size={18} style={{ color: "#d97706" }} />
                        <span>{t("extensionOfDays", "Extention of days.")}</span>
                      </div>
                    </div>

                    <div className="ci-grid-3">
                      <div className="ci-input-group">
                        <label className="ci-label">
                          <span>⏱ {t("extensionTerm", "extention term")} :</span>
                        </label>
                        <select
                          className="ci-select"
                          value={formState.extensionTerm}
                          onChange={(e) =>
                            setFormState((prev) => ({ ...prev, extensionTerm: e.target.value }))
                          }
                        >
                          <option value="None">{lang === "si" ? "නැත (None)" : "None"}</option>
                          <option value="1st Extension">{lang === "si" ? "1 වන දිගුව (1st Extension)" : "1st Extension"}</option>
                          <option value="2nd Extension">{lang === "si" ? "2 වන දිගුව (2nd Extension)" : "2nd Extension"}</option>
                          <option value="3rd Extension">{lang === "si" ? "3 වන දිගුව (3rd Extension)" : "3rd Extension"}</option>
                          <option value="4th Extension">{lang === "si" ? "4 වන දිගුව (4th Extension)" : "4th Extension"}</option>
                        </select>
                      </div>

                      <div className="ci-input-group">
                        <label className="ci-label">
                          <span>📅 {t("extensionStartDate", "start date")} :</span>
                        </label>
                        <input
                          type="date"
                          className="ci-input"
                          value={formState.extensionStartDate}
                          onChange={(e) =>
                            setFormState((prev) => ({ ...prev, extensionStartDate: e.target.value }))
                          }
                        />
                      </div>

                      <div className="ci-input-group">
                        <label className="ci-label">
                          <span>📅 {t("extensionEndDate", "End date")} :</span>
                        </label>
                        <input
                          type="date"
                          className="ci-input"
                          value={formState.extensionEndDate}
                          onChange={(e) =>
                            setFormState((prev) => ({ ...prev, extensionEndDate: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Recommendation */}
                  <div className="conduct-inquiry-section-card" style={{ marginBottom: "18px" }}>
                    <div className="conduct-inquiry-section-header">
                      <div className="conduct-inquiry-section-title">
                        <Sparkles size={18} style={{ color: "#6366f1" }} />
                        <span>{t("recommendation", "Reccommendation")} :</span>
                      </div>
                    </div>

                    <div className="ci-input-group">
                      <textarea
                        rows={4}
                        className="ci-textarea"
                        placeholder={t("recommendationPlaceholder", "Enter detailed inquiry findings, observations, and recommendations...")}
                        value={formState.recommendation}
                        onChange={(e) =>
                          setFormState((prev) => ({ ...prev, recommendation: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  {/* Upcoming actions to be taken */}
                  <div className="conduct-inquiry-section-card">
                    <div className="conduct-inquiry-section-header">
                      <div className="conduct-inquiry-section-title">
                        <Compass size={18} style={{ color: "#0284c7" }} />
                        <span>{t("upcomingActions", "upcomming actions to be taken.")}</span>
                      </div>
                    </div>

                    <div className="ci-input-group">
                      <select
                        id="upcomingActionsSelect"
                        className="ci-select"
                        value={formState.upcomingAction}
                        onChange={(e) =>
                          setFormState((prev) => ({ ...prev, upcomingAction: e.target.value }))
                        }
                        required
                      >
                        <option value="">
                          {lang === "si" ? "ක්‍රියාමාර්ගයක් තෝරන්න..." : lang === "ta" ? "நடவடிக்கையைத் தேர்ந்தெடுக்கவும்..." : "Select upcoming action..."}
                        </option>
                        <option value="Initial investigation">
                          {t("actionInitialInvestigation", "Initial investigation")}
                        </option>
                        <option value="Conduct an inspection">
                          {t("actionConductInspection", "Conduct an inspection")}
                        </option>
                        <option value="Finalize the file according to the additional secretary's instruction">
                          {t("actionFinalizeFileAccordingToSecretary", "Finalize the file according to the additional secretary's instruction")}
                        </option>
                        {formState.upcomingAction && ![
                          "",
                          "Initial investigation",
                          "Conduct an inspection",
                          "Finalize the file according to the additional secretary's instruction"
                        ].includes(formState.upcomingAction) && (
                          <option value={formState.upcomingAction}>
                            {t(formState.upcomingAction, formState.upcomingAction)}
                          </option>
                        )}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================
                  CASE 2: IF SELECT THE PROVINCE BASIC INQUIRY (Sketch Right Box)
                  ============================================================ */}
              {formState.inquiryType === "Province basic inquiry" && (
                <div className="ci-sketch-container province">
                  <div className="ci-sketch-tag province">
                    <Compass size={14} />
                    <span>{lang === "si" ? "පළාත් මූලික පරීක්ෂණය (if select the province basic inquiry)" : "if select the province basic inquiry"}</span>
                  </div>

                  {/* Row 1: Appointment date & Due date */}
                  <div className="conduct-inquiry-section-card" style={{ marginBottom: "18px" }}>
                    <div className="ci-grid-2">
                      <div className="ci-input-group">
                        <label className="ci-label">
                          <span>📅 {t("appointmentDate", "Appointment date")} :</span>
                        </label>
                        <input
                          type="date"
                          className="ci-input"
                          value={formState.appointmentDate}
                          onChange={(e) => setFormState((prev) => ({ ...prev, appointmentDate: e.target.value }))}
                        />
                      </div>

                      <div className="ci-input-group">
                        <label className="ci-label">
                          <span>🎯 {t("dueDate", "Due date")} :</span>
                        </label>
                        <input
                          type="date"
                          className="ci-input"
                          value={formState.dueDate}
                          onChange={(e) => setFormState((prev) => ({ ...prev, dueDate: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Title & Approval date */}
                  <div className="conduct-inquiry-section-card" style={{ marginBottom: "18px" }}>
                    <div className="ci-grid-2">
                      <div className="ci-input-group">
                        <label className="ci-label">
                          <span>📝 {t("inquiryTitle", "Title")} :</span>
                        </label>
                        <input
                          type="text"
                          className="ci-input"
                          placeholder={lang === "si" ? "පරීක්ෂණ මාතෘකාව ඇතුළත් කරන්න" : "Enter inquiry title"}
                          value={formState.title}
                          onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
                        />
                      </div>

                      <div className="ci-input-group">
                        <label className="ci-label">
                          <span>📅 {t("approvalDate", "Approval date")} :</span>
                        </label>
                        <input
                          type="date"
                          className="ci-input"
                          value={formState.approvalDate}
                          onChange={(e) => setFormState((prev) => ({ ...prev, approvalDate: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Report received date */}
                  <div className="conduct-inquiry-section-card" style={{ marginBottom: "18px" }}>
                    <div className="ci-input-group">
                      <label className="ci-label">
                        <span>📥 {t("reportReceivedDate", "Report received date")} :</span>
                      </label>
                      <input
                        type="date"
                        className="ci-input"
                        value={formState.reportReceivedDate}
                        onChange={(e) => setFormState((prev) => ({ ...prev, reportReceivedDate: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Row 4: Officers : [ input ] [+] */}
                  <div className="conduct-inquiry-section-card" style={{ marginBottom: "18px" }}>
                    <div className="conduct-inquiry-section-header">
                      <div className="conduct-inquiry-section-title">
                        <User size={18} style={{ color: "#0d9488" }} />
                        <span>👮 {t("officers", "Officers")} :</span>
                      </div>
                    </div>

                    <div className="ci-officers-input-row">
                      <input
                        type="text"
                        list="ci-province-officer-datalist"
                        className="ci-input"
                        placeholder={t("officerNamePlaceholder", "Enter or select officer name...")}
                        value={officerInput}
                        onChange={(e) => setOfficerInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddOfficer();
                          }
                        }}
                      />
                      <datalist id="ci-province-officer-datalist">
                        {committeeOfficers.map((o) => (
                          <option key={o.id || o.fullName} value={o.fullName}>
                            {o.position ? `${o.fullName} (${o.position})` : o.fullName}
                          </option>
                        ))}
                      </datalist>

                      <button
                        type="button"
                        onClick={handleAddOfficer}
                        className="ci-btn-add-officer"
                        title="Add Officer (+)"
                      >
                        <Plus size={20} />
                      </button>
                    </div>

                    {formState.officers.length > 0 && (
                      <div className="ci-officers-chips-container">
                        {formState.officers.map((officer, oIdx) => (
                          <div key={oIdx} className="ci-officer-chip">
                            <span>{officer}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setFormState((prev) => ({
                                  ...prev,
                                  officers: prev.officers.filter((_, idx) => idx !== oIdx),
                                }));
                              }}
                              title="Remove officer"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Row 5: Recommendation */}
                  <div className="conduct-inquiry-section-card">
                    <div className="conduct-inquiry-section-header">
                      <div className="conduct-inquiry-section-title">
                        <Sparkles size={18} style={{ color: "#0d9488" }} />
                        <span>{t("recommendation", "Reccommendation")} :</span>
                      </div>
                    </div>

                    <div className="ci-input-group">
                      <textarea
                        rows={4}
                        className="ci-textarea"
                        placeholder={t("recommendationPlaceholder", "Enter detailed inquiry findings, observations, and recommendations...")}
                        value={formState.recommendation}
                        onChange={(e) => setFormState((prev) => ({ ...prev, recommendation: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================
                  SUBMIT BUTTON (Matching paper sketch: "submit.")
                  ============================================================ */}
              <div className="conduct-inquiry-bottom-bar" style={{ justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-save-inquiry-main"
                  style={{ minWidth: "260px", padding: "14px 36px", fontSize: "16px", borderRadius: "12px" }}
                >
                  {saving ? (
                    <>
                      <Clock size={18} className="animate-spin" />
                      <span>{lang === "si" ? "ඉදිරිපත් කරමින් පවතී..." : lang === "ta" ? "சமர்ப்பிக்கப்படுகிறது..." : "Submitting..."}</span>
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      <span>{t("submitInquiryDetails", "Submit")}</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </section>

          {/* Footer Branding Notice */}
          <SiteFooter />
        </main>
      </div>
    </div>
  );
}

export default function ConductInquiryPage() {
  return (
    <Suspense fallback={<div className="loading-spinner-container"><div className="loading-spinner" /></div>}>
      <ConductInquiryContent />
    </Suspense>
  );
}
