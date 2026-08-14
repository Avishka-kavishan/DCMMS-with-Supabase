"use client";

import "@/i18n";
import "../../daily-mail/daily-mail.css";
import "../../dashboard-common.css";
import "../../subject/subject.css";
import "../../subject/add-details/add-details.css";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sidebar } from "@/components/Sidebar";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase, isSupabaseConfigured, logAuditEvent } from "@/lib/supabase";
import { getCurrentProfile, signOut } from "@/lib/auth";
import { getAccusedOfficerByRefServer, getCommitteeOfficersWithSchoolsServer, saveChairmanByCaseServer, getChairmanByCaseServer } from "@/lib/db-actions";
import { 
  Shield, User, Calendar as CalendarIcon, FileCheck, Send, Clock, 
  CheckCircle, ArrowLeft, RefreshCw, AlertCircle, Award, Building, 
  MapPin, CreditCard, UserPlus, CheckSquare, FileText, Info, X,
  UserCheck, Plus, Trash2
} from "lucide-react";

function InvestigationCaseDetailsContent() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const caseNoParam = searchParams?.get("id") || searchParams?.get("caseNo") || searchParams?.get("inquiryNo") || searchParams?.get("refNo") || "INQ/2026/001";
  const lang = i18n.language;

  // Layout & Accessibility State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoaded, setIsInitialLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Case Data State
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [officers, setOfficers] = useState<any[]>([]);
  const [concernedOfficersList, setConcernedOfficersList] = useState<any[]>([]);
  const [existingAssignment, setExistingAssignment] = useState<any>(null);
  const [previousActions, setPreviousActions] = useState<any[]>([]);

  // Form State
  const [assignee, setAssignee] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [status, setStatus] = useState("In Progress");
  const [inquiryNotes, setInquiryNotes] = useState("");
  const [investigationFileNo, setInvestigationFileNo] = useState("");

  // Subject Officer Selection State
  const [subjectOfficersList, setSubjectOfficersList] = useState<string[]>([]);
  const [selectedSubjectOfficer, setSelectedSubjectOfficer] = useState<string>("");
  const [customSubjectOfficerInput, setCustomSubjectOfficerInput] = useState<string>("");

  // Step 1: Assign Officers to Subject Officer (1 Chairman + Many Members)
  const [step1AssignedOfficers, setStep1AssignedOfficers] = useState("");
  const [selectedChairman, setSelectedChairman] = useState<any | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<any[]>([]);
  const [memberSelectId, setMemberSelectId] = useState("");
  const [customMemberInput, setCustomMemberInput] = useState("");

  const parseSchoolList = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map((s) => String(s).trim()).filter(Boolean);
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (!trimmed) return [];
      if (trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed.map((s) => String(s).trim()).filter(Boolean);
        } catch (e) {}
      }
      return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [];
  };

  const getCaseInstitutes = (): string[] => {
    const institutes = new Set<string>();
    if (Array.isArray(concernedOfficersList)) {
      concernedOfficersList.forEach((co: any) => {
        const inst = co.institute_name || co.instituteName || co.school_name || co.schoolName || co.school || co.institute || "";
        if (typeof inst === "string" && inst.trim()) {
          institutes.add(inst.trim());
        }
      });
    }
    if (selectedCase) {
      const inst = selectedCase.institute_name || selectedCase.instituteName || selectedCase.school || selectedCase.schoolName || selectedCase.accused_school_name || selectedCase.accusedSchool || "";
      if (typeof inst === "string" && inst.trim()) {
        institutes.add(inst.trim());
      }
    }
    return Array.from(institutes);
  };

  const isOfficerConnectedToCaseInstitute = (off: any, caseInsts: string[]): boolean => {
    if (!caseInsts || caseInsts.length === 0) return false;

    const officerSchools: string[] = [
      ...parseSchoolList(off.studiedSchools),
      ...parseSchoolList(off.studied_schools),
      ...parseSchoolList(off.childrenSchools),
      ...parseSchoolList(off.children_schools),
      ...parseSchoolList(off.member_school_name),
      ...parseSchoolList(off.member_children_schools_name),
    ];

    if (off.institute_name) officerSchools.push(off.institute_name);
    if (off.instituteName) officerSchools.push(off.instituteName);
    if (off.school) officerSchools.push(off.school);
    if (off.schoolName) officerSchools.push(off.schoolName);

    const cleanOfficerSchools = officerSchools
      .map((s) => (typeof s === "string" ? s.trim().toLowerCase() : ""))
      .filter(Boolean);

    if (cleanOfficerSchools.length === 0) return false;

    return caseInsts.some((caseInst) => {
      const cleanCaseInst = caseInst.trim().toLowerCase();
      if (!cleanCaseInst) return false;
      return cleanOfficerSchools.some(
        (offSch) => offSch === cleanCaseInst || offSch.includes(cleanCaseInst) || cleanCaseInst.includes(offSch)
      );
    });
  };

  const handleSelectChairman = async (officerId: string) => {
    if (!officerId) {
      setSelectedChairman(null);
      if (caseNoParam) {
        try {
          await saveChairmanByCaseServer(caseNoParam, null);
        } catch (e) {}
        if (isSupabaseConfigured) {
          try {
            await supabase.from("chairment_by_case").delete().eq("ref_number", caseNoParam.trim());
          } catch (e) {}
        }
      }
      return;
    }
    const found = officers.find((o) => o.id === officerId);
    if (found) {
      setSelectedChairman(found);
      setSelectedMembers((prev) => prev.filter((m) => m.id !== officerId && m.fullName !== found.fullName));
      if (caseNoParam) {
        const payload = {
          fullName: found.fullName || found.name || "",
          position: found.position || "Chairman",
          email: found.email || "",
        };
        try {
          await saveChairmanByCaseServer(caseNoParam, payload);
        } catch (e) {}
        if (isSupabaseConfigured) {
          try {
            let validEmail = null;
            if (found.email) {
              const { data: commData } = await supabase
                .from("commitee_table")
                .select("email")
                .ilike("email", found.email.trim())
                .maybeSingle();
              if (commData) validEmail = commData.email;
            }
            await supabase.from("chairment_by_case").upsert({
              ref_number: caseNoParam.trim(),
              full_name: payload.fullName,
              position: payload.position,
              email: validEmail,
              updated_at: new Date().toISOString(),
            }, { onConflict: "ref_number" });
          } catch (e) {}
        }
      }
    }
  };

  const handleAddMemberSelect = (officerId: string) => {
    if (!officerId) return;
    const found = officers.find((o) => o.id === officerId);
    if (found) {
      if (selectedChairman && (selectedChairman.id === officerId || selectedChairman.fullName === found.fullName)) {
        showToast(lang === "si" ? "මෙම නිලධාරියා දැනටමත් සභාපති ලෙස තෝරා ඇත." : "This officer is already selected as Chairman.");
        setMemberSelectId("");
        return;
      }
      if (selectedMembers.some((m) => m.id === officerId || m.fullName === found.fullName)) {
        showToast(lang === "si" ? "මෙම නිලධාරියා දැනටමත් සාමාජිකයෙකු ලෙස එක් කර ඇත." : "This officer is already in the members list.");
        setMemberSelectId("");
        return;
      }
      setSelectedMembers((prev) => [...prev, found]);
      setMemberSelectId("");
    }
  };

  const handleAddCustomMember = () => {
    const name = customMemberInput.trim();
    if (!name) return;
    if (selectedChairman && (selectedChairman.fullName || selectedChairman.name || "").toLowerCase() === name.toLowerCase()) {
      showToast(lang === "si" ? "මෙම නම දැනටමත් සභාපති ලෙස තෝරා ඇත." : "This name is already selected as Chairman.");
      return;
    }
    if (selectedMembers.some((m) => (m.fullName || m.name || "").toLowerCase() === name.toLowerCase())) {
      showToast(lang === "si" ? "මෙම සාමාජිකයා දැනටමත් එක් කර ඇත." : "This member is already added.");
      return;
    }
    const customMember = {
      id: `custom-m-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      fullName: name,
      officerRole: "Member",
      role: "investigation_officer",
    };
    setSelectedMembers((prev) => [...prev, customMember]);
    setCustomMemberInput("");
  };

  const handleRemoveMember = (index: number) => {
    setSelectedMembers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveChairman = async () => {
    setSelectedChairman(null);
    if (caseNoParam) {
      try {
        await saveChairmanByCaseServer(caseNoParam, null);
      } catch (e) {}
      if (isSupabaseConfigured) {
        try {
          await supabase.from("chairment_by_case").delete().eq("ref_number", caseNoParam.trim());
        } catch (e) {}
      }
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "IO";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

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
    return trimmed;
  };
  
  // Step 2: Check / Set Appointment Date & Report Due Date
  const [step2ApptDate, setStep2ApptDate] = useState("");
  const [step2DueDate, setStep2DueDate] = useState("");

  // Step 3: Extension of Dates (Start & End Date, Term: First, Second, Third — maximum 3 terms)
  const [step3Term, setStep3Term] = useState<string>("First");
  const [step3StartDate, setStep3StartDate] = useState("");
  const [step3EndDate, setStep3EndDate] = useState("");

  // Step 5: Send Report Submit Date (Approval Date)
  const [step4ApprovalDate, setStep4ApprovalDate] = useState("");

  // Sync title and language
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `Investigation Case ${caseNoParam} | DCMMS`;
  }, [lang, caseNoParam]);

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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut();
    router.push("/login");
  };

  // Load Case Details & Data Flow Assignments
  useEffect(() => {
    const loadDetails = async () => {
      setIsLoading(true);

      // Load registered officers strictly from commitee_table (PostgreSQL & Supabase) + local storage
      let fetchedOfficers: any[] = [];

      try {
        const commRes = await getCommitteeOfficersWithSchoolsServer();
        if (commRes && commRes.success && Array.isArray(commRes.data)) {
          commRes.data.forEach((p: any) => {
            const pos = (p.position || p.officer_role || p.officerRole || "Member").trim();
            const isChairman = pos.toLowerCase() === "chairman";
            const mapped = {
              id: p.id,
              employeeNo: p.employee_no || p.employeeNo || "",
              fullName: p.full_name || p.fullName,
              nicNo: p.nic_no || p.nicNo,
              position: pos,
              officerRole: isChairman ? "Chairman" : "Member",
              studiedSchools: Array.isArray(p.studied_schools) ? p.studied_schools : typeof p.studied_schools === "string" ? p.studied_schools.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
              childrenSchools: Array.isArray(p.children_schools) ? p.children_schools : typeof p.children_schools === "string" ? p.children_schools.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
              email: p.email,
              role: "investigation_officer",
              status: p.state || p.status || "Active",
            };
            if (!fetchedOfficers.some((o) => o.id === mapped.id || o.fullName === mapped.fullName)) {
              fetchedOfficers.push(mapped);
            }
          });
        }
      } catch (e) {
        console.warn("Server action committee officers load warning:", e);
      }

      if (typeof window !== "undefined") {
        const storedInv = localStorage.getItem("dcmms_investigation_officers");
        if (storedInv) {
          try {
            const list = JSON.parse(storedInv);
            if (Array.isArray(list)) {
              list.forEach((item: any) => {
                if (!fetchedOfficers.some((o) => o.id === item.id || o.fullName === item.fullName)) {
                  fetchedOfficers.push({
                    ...item,
                    employeeNo: item.employeeNo || item.employee_no || "",
                    position: item.position || item.officerRole || "Member",
                  });
                }
              });
            }
          } catch (e) {}
        }

        const storedCustom = localStorage.getItem("dcmms_custom_profiles");
        if (storedCustom) {
          try {
            const list = JSON.parse(storedCustom);
            if (Array.isArray(list)) {
              list.forEach((item: any) => {
                if (!fetchedOfficers.some((o) => o.id === item.id || o.fullName === item.fullName)) {
                  fetchedOfficers.push({
                    id: item.id,
                    employeeNo: item.employeeNo || item.employee_no || "",
                    fullName: item.fullName,
                    nicNo: item.nicNo,
                    position: item.position || item.officerRole || "Member",
                    officerRole: item.officerRole || "Member",
                    studiedSchools: item.studiedSchools || [],
                    childrenSchools: item.childrenSchools || [],
                    email: item.email,
                    role: item.role,
                    status: item.status,
                  });
                }
              });
            }
          } catch (e) {}
        }
      }

      if (isSupabaseConfigured) {
        try {
          const { data: dbComm } = await supabase.from("commitee_table").select("*");
          if (dbComm && dbComm.length > 0) {
            dbComm.forEach((p: any) => {
              const pos = (p.position || p.officer_role || p.officerRole || "Member").trim();
              const isChairman = pos.toLowerCase() === "chairman";
              const mapped = {
                id: p.id,
                employeeNo: p.employee_no || p.employeeNo || "",
                fullName: p.full_name || p.fullName,
                nicNo: p.nic_no || p.nicNo,
                position: pos,
                officerRole: isChairman ? "Chairman" : "Member",
                studiedSchools: [],
                childrenSchools: [],
                email: p.email,
                role: "investigation_officer",
                status: p.state || p.status || "Active",
              };
              if (!fetchedOfficers.some((o) => o.id === mapped.id || o.fullName === mapped.fullName)) {
                fetchedOfficers.push(mapped);
              }
            });
          }
        } catch (e) {}

        try {
          const { data: dbInv } = await supabase.from("dcmms_investigation_officers").select("*");
          if (dbInv && dbInv.length > 0) {
            dbInv.forEach((p: any) => {
              const pos = (p.position || p.officer_role || p.officerRole || "Member").trim();
              const mapped = {
                id: p.id,
                employeeNo: p.employee_no || p.employeeNo || "",
                fullName: p.full_name || p.fullName,
                nicNo: p.nic_no || p.nicNo,
                position: pos,
                officerRole: p.officer_role || p.officerRole || "Member",
                studiedSchools: p.studied_schools || p.studiedSchools || [],
                childrenSchools: p.children_schools || p.childrenSchools || [],
                email: p.email,
                role: p.role,
                status: p.status,
              };
              if (!fetchedOfficers.some((o) => o.id === mapped.id || o.fullName === mapped.fullName)) {
                fetchedOfficers.push(mapped);
              }
            });
          }
        } catch (e) {
          console.warn("Supabase investigation officers load warning:", e);
        }
      }

      setOfficers(fetchedOfficers);

      // Fetch Subject Officers directly from dcmms_profiles table, assignments tables & local storage
      const defaultSubjectOfficers = [
        "Rathnaweera",
        "Kamal Perera",
        "Suresh Silva",
        "Aruni Rajapaksha",
        "Kumara",
      ];
      const subjSet = new Set<string>(defaultSubjectOfficers);

      if (isSupabaseConfigured) {
        try {
          // 1. Primary: Load registered Subject Officers from dcmms_profiles DB table
          const { data: dbSubj } = await supabase
            .from("dcmms_profiles")
            .select("full_name, role, officer_role, status");
          if (dbSubj && Array.isArray(dbSubj)) {
            dbSubj.forEach((p: any) => {
              const r = (p.role || p.officer_role || "").toLowerCase();
              if ((r.includes("subject") || r === "subject_officer") && p.status !== "Inactive" && p.full_name) {
                subjSet.add(p.full_name.trim());
              }
            });
          }

          // 2. Load from dcmms_subject_assignments table
          const { data: dbAsgnList } = await supabase
            .from("dcmms_subject_assignments")
            .select("subject_officer_name");
          if (dbAsgnList && Array.isArray(dbAsgnList)) {
            dbAsgnList.forEach((a: any) => {
              if (a.subject_officer_name && a.subject_officer_name.trim()) {
                const name = a.subject_officer_name.trim();
                if (name !== "Subject Officer" && name !== "Unassigned") subjSet.add(name);
              }
            });
          }

          // 3. Load from dcmms_subject table
          const { data: dbSubjCases } = await supabase
            .from("dcmms_subject")
            .select("subject_officer_name");
          if (dbSubjCases && Array.isArray(dbSubjCases)) {
            dbSubjCases.forEach((s: any) => {
              if (s.subject_officer_name && s.subject_officer_name.trim()) {
                const name = s.subject_officer_name.trim();
                if (name !== "Subject Officer" && name !== "Unassigned") subjSet.add(name);
              }
            });
          }
        } catch (e) {
          console.warn("Supabase Subject Officers table query warning:", e);
        }
      }

      if (typeof window !== "undefined") {
        const storedCustom = localStorage.getItem("dcmms_custom_profiles");
        if (storedCustom) {
          try {
            const list = JSON.parse(storedCustom);
            if (Array.isArray(list)) {
              list.forEach((item: any) => {
                const r = (item.role || item.officerRole || "").toLowerCase();
                if ((r.includes("subject") || r === "subject_officer") && item.fullName) {
                  subjSet.add(item.fullName.trim());
                }
              });
            }
          } catch (e) {}
        }

        const storedOfficers = localStorage.getItem("dcmms_subject_officers");
        if (storedOfficers) {
          try {
            const list = JSON.parse(storedOfficers);
            if (Array.isArray(list)) {
              list.forEach((item: any) => {
                if (typeof item === "string" && item.trim()) subjSet.add(item.trim());
                else if (item?.fullName) subjSet.add(item.fullName.trim());
              });
            }
          } catch (e) {}
        }
      }

      const allSubjOfficers = Array.from(subjSet);
      setSubjectOfficersList(allSubjOfficers);

      // Load Data Flow Assignment FIRST
      let assignment: any = null;
      if (isSupabaseConfigured && caseNoParam) {
        try {
          const { data: dbAsgn } = await supabase
            .from("dcmms_subject_assignments")
            .select("*")
            .ilike("case_no", caseNoParam.trim())
            .maybeSingle();
          if (dbAsgn) {
            assignment = {
              id: dbAsgn.id,
              caseNo: dbAsgn.case_no,
              subjectOfficerName: dbAsgn.subject_officer_name,
              status: dbAsgn.status,
              assignedOfficers: dbAsgn.assigned_officers,
              appointmentDate: dbAsgn.appointment_date,
              reportDueDate: dbAsgn.report_due_date,
              datesSubmittedBySubject: dbAsgn.dates_submitted_by_subject || dbAsgn.datesSubmittedBySubject || false,
              chairman: dbAsgn.chairman,
              members: dbAsgn.members,
              extensionTerm: dbAsgn.extension_term,
              extensionStartDate: dbAsgn.extension_start_date,
              extensionEndDate: dbAsgn.extension_end_date,
              extensionApprovalStatus: dbAsgn.extension_approval_status,
              extensionDecisionDate: dbAsgn.extension_decision_date,
              certificationSubmitted: dbAsgn.certification_submitted,
              reportSubmitDate: dbAsgn.report_submit_date,
              reportContent: dbAsgn.report_content,
              afterInvestigationSent: dbAsgn.after_investigation_sent,
              afterInvestigationDate: dbAsgn.after_investigation_date,
              investigationFileNo: dbAsgn.investigation_file_no,
              investigationStatus: dbAsgn.investigation_status,
              investigationNotes: dbAsgn.investigation_notes,
              progressDetails: dbAsgn.progress_details,
            };
          }
        } catch (e) {}
      }

      if (typeof window !== "undefined") {
        const storedAsgn = localStorage.getItem("dcmms_subject_assignments");
        if (storedAsgn) {
          try {
            const list = JSON.parse(storedAsgn);
            const matchKey = String(caseNoParam || "").trim().toLowerCase();
            const found = list.find((a: any) => 
              String(a.caseNo || a.case_no || a.id || "").trim().toLowerCase() === matchKey ||
              String(a.caseNo || a.case_no || "").trim().toLowerCase().includes(matchKey)
            );
            if (found) {
              assignment = {
                ...found,
                ...assignment,
                appointmentDate: assignment?.appointmentDate || assignment?.appointment_date || found.appointmentDate || found.appointment_date,
                reportDueDate: assignment?.reportDueDate || assignment?.report_due_date || found.reportDueDate || found.report_due_date,
                datesSubmittedBySubject: assignment?.datesSubmittedBySubject || found.datesSubmittedBySubject || found.dates_submitted_by_subject,
              };
            }
          } catch (e) {}
        }

        if (!assignment?.appointmentDate || !assignment?.reportDueDate) {
          try {
            const storedCases = localStorage.getItem("dcmms_cases");
            if (storedCases) {
              const casesList = JSON.parse(storedCases);
              const matchKey = String(caseNoParam || "").trim().toLowerCase();
              const foundCase = casesList.find((c: any) =>
                String(c.caseNo || c.refNo || c.case_no || "").trim().toLowerCase() === matchKey
              );
              if (foundCase) {
                assignment = {
                  ...(assignment || {}),
                  appointmentDate: assignment?.appointmentDate || foundCase.appointmentDate || foundCase.appointment_date,
                  reportDueDate: assignment?.reportDueDate || foundCase.reportDueDate || foundCase.report_due_date,
                  datesSubmittedBySubject: assignment?.datesSubmittedBySubject || foundCase.datesSubmittedBySubject,
                };
              }
            }
          } catch (e) {}
        }
      }

      setExistingAssignment(assignment);
      if (assignment) {
        const apptVal = formatToInputDate(assignment.appointmentDate || assignment.appointment_date);
        const dueVal = formatToInputDate(assignment.reportDueDate || assignment.report_due_date);
        if (assignment.assignedOfficers) setStep1AssignedOfficers(assignment.assignedOfficers);
        if (apptVal) setStep2ApptDate(apptVal);
        if (dueVal) setStep2DueDate(dueVal);
        if (assignment.extensionTerm) setStep3Term(assignment.extensionTerm);
        if (assignment.extensionStartDate) setStep3StartDate(assignment.extensionStartDate);
        if (assignment.extensionEndDate) setStep3EndDate(assignment.extensionEndDate);
        if (assignment.reportSubmitDate) setStep4ApprovalDate(assignment.reportSubmitDate);
        if (assignment.investigationFileNo) setInvestigationFileNo(assignment.investigationFileNo);
        if (assignment.investigationNotes || assignment.progressDetails) setInquiryNotes(assignment.investigationNotes || assignment.progressDetails);
        if (assignment.investigationStatus) setStatus(assignment.investigationStatus);
        if (assignment.chairman) setSelectedChairman(assignment.chairman);
        if (assignment.members && Array.isArray(assignment.members)) setSelectedMembers(assignment.members);
      }

      if (caseNoParam) {
        try {
          const chairRes = await getChairmanByCaseServer(caseNoParam);
          if (chairRes && chairRes.success && chairRes.data) {
            const chairRow = chairRes.data;
            if (chairRow.full_name) {
              setSelectedChairman((prev: any) => {
                if (!prev) {
                  return {
                    id: chairRow.id || `chair-${chairRow.ref_number}`,
                    fullName: chairRow.full_name,
                    position: chairRow.position || "Chairman",
                    email: chairRow.email || "",
                    officerRole: "Chairman",
                  };
                }
                return prev;
              });
            }
          }
        } catch (e) {}
      }

      // Load case data
      let matchedCase: any = null;
      if (isSupabaseConfigured && caseNoParam) {
        try {
          const { data: dbMail } = await supabase
            .from("dcmms_daily_mail")
            .select("*")
            .ilike("ref_no", caseNoParam.trim())
            .maybeSingle();

          if (dbMail) {
            const officer = assignment?.subjectOfficerName || dbMail.subject_officer_name || dbMail.officer_name || "";
            matchedCase = {
              id: dbMail.id || `case-${caseNoParam}`,
              inquiryNo: dbMail.ref_no || caseNoParam,
              caseNo: dbMail.ref_no || caseNoParam,
              refNo: dbMail.ref_no || caseNoParam,
              subject: dbMail.subject || "Formal disciplinary inquiry regarding misconduct",
              targetDate: dbMail.received_date || new Date().toISOString().slice(0, 10),
              assignee: officer,
              subjectOfficerName: officer,
              officerName: dbMail.officer_name || dbMail.officerName || officer,
              status: "In Progress",
              inquiryNotes: dbMail.special_notes || "",
              complainantName: dbMail.sender_name || "Director of Education",
            };
          }
        } catch (e) {
          console.warn("Failed to fetch daily mail from Supabase:", e);
        }
      }

      if (!matchedCase && typeof window !== "undefined") {
        const storedCases = localStorage.getItem("dcmms_cases");
        if (storedCases) {
          try {
            const list = JSON.parse(storedCases);
            matchedCase = list.find((c: any) => 
              c.caseNo === caseNoParam || 
              c.inquiryNo === caseNoParam || 
              c.refNo === caseNoParam ||
              c.id === caseNoParam ||
              (c.caseNo && c.caseNo.toLowerCase() === caseNoParam.toLowerCase()) ||
              (c.refNo && c.refNo.toLowerCase() === caseNoParam.toLowerCase())
            );
          } catch (e) {}
        }

        if (!matchedCase) {
          const storedLetters = localStorage.getItem("dcmms_letters");
          if (storedLetters) {
            try {
              const list = JSON.parse(storedLetters);
              const found = list.find((l: any) => 
                l.refNo === caseNoParam || 
                l.id === caseNoParam ||
                (l.refNo && l.refNo.toLowerCase() === caseNoParam.toLowerCase())
              );
              if (found) {
                const officer = assignment?.subjectOfficerName || found.subjectOfficerName || found.subject_officer_name || found.officerName || "";
                matchedCase = {
                  id: found.id || `case-${caseNoParam}`,
                  inquiryNo: found.refNo || caseNoParam,
                  caseNo: found.refNo || caseNoParam,
                  refNo: found.refNo || caseNoParam,
                  subject: found.subject || "Formal disciplinary inquiry regarding misconduct",
                  targetDate: found.receivedDate || new Date().toISOString().slice(0, 10),
                  assignee: officer,
                  subjectOfficerName: officer,
                  officerName: found.officerName || officer,
                  status: found.status === "assigned" ? "In Progress" : "In Progress",
                  inquiryNotes: found.specialNotes || "",
                  complainantName: found.senderName || "Director of Education",
                };
              }
            } catch (e) {}
          }
        }
      }

      if (!matchedCase) {
        matchedCase = {
          id: `case-${Date.now()}`,
          inquiryNo: caseNoParam,
          caseNo: caseNoParam,
          refNo: caseNoParam,
          subject: "Formal disciplinary inquiry regarding misconduct",
          targetDate: new Date().toISOString().slice(0, 10),
          assignee: assignment?.subjectOfficerName || "",
          subjectOfficerName: assignment?.subjectOfficerName || "",
          officerName: assignment?.subjectOfficerName || "",
          status: "In Progress",
          inquiryNotes: "",
          complainantName: "Director of Education",
        };
      }

      const resolvedOfficer = assignment?.subjectOfficerName || matchedCase?.subjectOfficerName || matchedCase?.officerName || matchedCase?.subjectOfficer || matchedCase?.assignee || "";
      setSelectedCase(matchedCase);
      setAssignee(resolvedOfficer);
      
      const initialSubj = resolvedOfficer || allSubjOfficers[0] || "";
      setSelectedSubjectOfficer(initialSubj);
      if (initialSubj && !allSubjOfficers.includes(initialSubj)) {
        setSubjectOfficersList((prev) => [...prev, initialSubj]);
      }
      setTargetDate(matchedCase.targetDate || new Date().toISOString().slice(0, 10));
      setStatus(matchedCase.status || "In Progress");
      setInquiryNotes(matchedCase.inquiryNotes || matchedCase.notes || "");
      setInvestigationFileNo(matchedCase.investigationFileNo || matchedCase.fileNo || matchedCase.fileRefNo || "");
      let loadedActions: any[] = [];
      if (typeof window !== "undefined") {
        const storedActions = localStorage.getItem("dcmms_new_letter_current_case") || "[]";
        try {
          const list = JSON.parse(storedActions);
          if (Array.isArray(list)) {
            loadedActions = list.filter((a: any) => a.caseNo === caseNoParam || a.inquiryNo === caseNoParam);
          }
        } catch (e) {}
      }

      if (isSupabaseConfigured) {
        try {
          const { data: actionsData } = await supabase
            .from("dcmms_subject_details")
            .select("*")
            .eq("case_no", caseNoParam)
            .order("received_date", { ascending: false });

          if (actionsData && actionsData.length > 0) {
            const mapped = actionsData.map((d: any) => ({
              id: d.id,
              caseNo: d.case_no,
              receivedDate: d.received_date,
              reportState: d.report_state,
              specialNotes: d.special_notes,
              subjectOfficerName: d.subject_officer_name,
              stepTaken: d.step_taken,
            }));
            loadedActions = [...loadedActions, ...mapped];
          }
        } catch (e) {}
      }

      setPreviousActions(loadedActions);

      // Fetch Accused / Concerned Officers Information
      let fetchedConcerned: any[] = [];
      if (caseNoParam) {
        try {
          const pgRes = await getAccusedOfficerByRefServer(caseNoParam);
          if (pgRes && pgRes.success && pgRes.data) {
            const d = pgRes.data;
            const officersList = Array.isArray(d.accused_officers) && d.accused_officers.length > 0
              ? d.accused_officers
              : (d.accused_officer ? [d.accused_officer] : []);

            if (officersList.length > 0) {
              fetchedConcerned = officersList.map((ao: any) => ({
                officer_name: ao.accused_officer_name || ao.officer_name || "",
                position: ao.position || "",
                dob: ao.date_of_birth ? String(ao.date_of_birth).split("T")[0] : "",
                nic: ao.nic_no || ao.nic || "",
                appointment_date: ao.appointment_date ? String(ao.appointment_date).split("T")[0] : "",
                address: ao.address || ao.officer_address || "",
                institute_name: ao.accused_school_name || ao.institute_name || d.accused_school?.accused_school_name || "",
                institute_address: ao.school_address || d.accused_school?.address || "",
              }));
            }
          }
        } catch (e) {
          console.warn("Failed to load accused officer details from PostgreSQL:", e);
        }
      }

      if (fetchedConcerned.length === 0 && isSupabaseConfigured && caseNoParam) {
        try {
          const { data: cData } = await supabase
            .from("dcmms_concerned_officers")
            .select("*")
            .ilike("case_no", caseNoParam.trim());
          if (cData && cData.length > 0) {
            fetchedConcerned = cData.map((c: any) => ({
              officer_name: c.officer_name || c.name || c.officerName || "",
              position: c.position || c.designation || "",
              dob: c.dob || c.date_of_birth || "",
              nic: c.nic || c.nic_no || "",
              appointment_date: c.appointment_date || c.appointmentDate || c.date_of_appointment || "",
              address: c.address || "",
              institute_name: c.institute_name || c.school_name || c.instituteName || "",
              institute_address: c.institute_address || c.school_address || c.instituteAddress || "",
            }));
          }
        } catch (e) {
          console.warn("Failed to load concerned officers from Supabase:", e);
        }
      }

      if (fetchedConcerned.length === 0 && typeof window !== "undefined") {
        try {
          const storedConcerned = localStorage.getItem("dcmms_officer_concerned");
          if (storedConcerned) {
            const map = JSON.parse(storedConcerned);
            const targetKeys = [caseNoParam].filter(Boolean).map(k => String(k).trim().toLowerCase());
            const matchedKey = Object.keys(map).find(k => targetKeys.includes(k.trim().toLowerCase()));
            const item = matchedKey ? map[matchedKey] : map[caseNoParam];
            if (item) {
              if (Array.isArray(item.persons) && item.persons.length > 0) {
                fetchedConcerned = item.persons.map((p: any) => ({
                  officer_name: p.name || p.officer_name || p.officerName || "",
                  position: p.position || p.designation || "",
                  dob: p.dob || p.date_of_birth || "",
                  nic: p.nic || p.nic_no || "",
                  appointment_date: p.appointmentDate || p.appointment_date || "",
                  address: p.address || "",
                  institute_name: item.instituteName || item.schoolName || p.instituteName || "",
                  institute_address: item.schoolAddress || item.instituteAddress || p.schoolAddress || "",
                }));
              } else if (item.accusedOfficer || item.accused_officer) {
                fetchedConcerned = [{
                  officer_name: item.accusedOfficer || item.accused_officer || "",
                  position: item.position || item.designation || "",
                  dob: item.dob || "",
                  nic: item.nic || item.nic_no || "",
                  appointment_date: item.appointmentDate || item.appointment_date || "",
                  address: item.address || "",
                  institute_name: item.instituteName || item.schoolName || "",
                  institute_address: item.schoolAddress || item.instituteAddress || "",
                }];
              }
            }
          }
        } catch (e) {}

        if (fetchedConcerned.length === 0 && matchedCase) {
          if (Array.isArray(matchedCase.persons) && matchedCase.persons.length > 0) {
            fetchedConcerned = matchedCase.persons.map((p: any) => ({
              officer_name: p.name || p.officer_name || p.officerName || "",
              position: p.position || p.designation || "",
              dob: p.dob || "",
              nic: p.nic || "",
              appointment_date: p.appointmentDate || p.appointment_date || "",
              address: p.address || "",
              institute_name: p.instituteName || matchedCase.schoolName || "",
              institute_address: p.schoolAddress || matchedCase.schoolAddress || "",
            }));
          } else if (matchedCase.accusedOfficer || matchedCase.accused_officer) {
            fetchedConcerned = [{
              officer_name: matchedCase.accusedOfficer || matchedCase.accused_officer || "",
              position: matchedCase.position || matchedCase.designation || "",
              dob: matchedCase.dob || "",
              nic: matchedCase.nic || matchedCase.nicNo || "",
              appointment_date: matchedCase.appointmentDate || "",
              address: matchedCase.address || "",
              institute_name: matchedCase.instituteName || matchedCase.schoolName || "",
              institute_address: matchedCase.schoolAddress || matchedCase.instituteAddress || "",
            }];
          }
        }
      }

      // Filter out any Subject Officer bleed-through where name matches subject officer and lack accused details
      const cleanAccused = fetchedConcerned.filter((officer) => {
        if (!officer) return false;
        const name = (officer.officer_name || "").trim();
        if (!name) return false;
        const subjName = (resolvedOfficer || matchedCase?.subjectOfficerName || matchedCase?.subjectOfficer || "").trim();
        if (subjName && name.toLowerCase() === subjName.toLowerCase()) {
          if (!officer.nic && !officer.position && !officer.address && !officer.dob) {
            return false;
          }
        }
        return true;
      });

      setConcernedOfficersList(cleanAccused);

      setIsInitialLoaded(true);
      setIsLoading(false);
    };

    loadDetails();
  }, [caseNoParam]);

  const reloadAssignmentData = async () => {
    if (!caseNoParam) return;
    let assignment: any = null;
    if (isSupabaseConfigured && caseNoParam) {
      try {
        const { data: dbAsgn } = await supabase
          .from("dcmms_subject_assignments")
          .select("*")
          .ilike("case_no", caseNoParam.trim())
          .maybeSingle();
        if (dbAsgn) {
          assignment = {
            id: dbAsgn.id,
            caseNo: dbAsgn.case_no,
            subjectOfficerName: dbAsgn.subject_officer_name,
            status: dbAsgn.status,
            assignedOfficers: dbAsgn.assigned_officers,
            appointmentDate: dbAsgn.appointment_date,
            reportDueDate: dbAsgn.report_due_date,
            datesSubmittedBySubject: dbAsgn.dates_submitted_by_subject || dbAsgn.datesSubmittedBySubject || false,
            chairman: dbAsgn.chairman,
            members: dbAsgn.members,
            extensionTerm: dbAsgn.extension_term,
            extensionStartDate: dbAsgn.extension_start_date,
            extensionEndDate: dbAsgn.extension_end_date,
            extensionApprovalStatus: dbAsgn.extension_approval_status,
            extensionDecisionDate: dbAsgn.extension_decision_date,
            certificationSubmitted: dbAsgn.certification_submitted,
            reportSubmitDate: dbAsgn.report_submit_date,
            reportContent: dbAsgn.report_content,
            afterInvestigationSent: dbAsgn.after_investigation_sent,
            afterInvestigationDate: dbAsgn.after_investigation_date,
            investigationFileNo: dbAsgn.investigation_file_no,
            investigationStatus: dbAsgn.investigation_status,
            investigationNotes: dbAsgn.investigation_notes,
            progressDetails: dbAsgn.progress_details,
          };
        }
      } catch (e) {}
    }

    if (typeof window !== "undefined") {
      const storedAsgn = localStorage.getItem("dcmms_subject_assignments");
      if (storedAsgn) {
        try {
          const list = JSON.parse(storedAsgn);
          const found = list.find((a: any) => 
            (a.caseNo && String(a.caseNo).trim().toLowerCase() === String(caseNoParam).trim().toLowerCase()) ||
            (a.case_no && String(a.case_no).trim().toLowerCase() === String(caseNoParam).trim().toLowerCase())
          );
          if (found) {
            assignment = { ...assignment, ...found };
          }
        } catch (e) {}
      }
    }

    if (assignment) {
      setExistingAssignment((prev: any) => ({ ...prev, ...assignment }));
      if (!isInitialLoaded) {
        if (assignment.extensionTerm) setStep3Term(assignment.extensionTerm);
        if (assignment.extensionStartDate) setStep3StartDate(assignment.extensionStartDate);
        if (assignment.extensionEndDate) setStep3EndDate(assignment.extensionEndDate);
      }
    }
  };

  useEffect(() => {
    if (!caseNoParam) return;

    const channelName = `add-details-realtime-${caseNoParam.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dcmms_subject_assignments" },
        () => reloadAssignmentData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dcmms_subject" },
        () => reloadAssignmentData()
      )
      .subscribe();

    const interval = setInterval(reloadAssignmentData, 15000);


    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "dcmms_subject_assignments" || e.key === "dcmms_cases") {
        reloadAssignmentData();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("dcmms_assignment_updated", reloadAssignmentData);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("dcmms_assignment_updated", reloadAssignmentData);
    };
  }, [caseNoParam, isInitialLoaded]);

  const formatSubjectOfficerName = (raw?: string | null): string => {
    if (!raw || typeof raw !== "string" || !raw.trim()) {
      return lang === "si" ? "පවරන ලද විෂය භාර නිලධාරී" : "Assigned Subject Officer";
    }
    const trimmed = raw.trim();
    const lower = trimmed.toLowerCase();
    if (
      lower === "subject officer" ||
      lower === "විෂය නිලධාරී" ||
      lower === "පවරන ලද විෂය භාර නිලධාරී" ||
      lower === "පවරන ලද විෂය භාර නිලධාරියා" ||
      lower === "assigned subject officer" ||
      lower === "unassigned" ||
      lower === "නොපවරන ලද"
    ) {
      return lang === "si" ? "පවරන ලද විෂය භාර නිලධාරී" : "Assigned Subject Officer";
    }
    return trimmed;
  };
  const getDisplaySubjectOfficerName = () => {
    const raw = existingAssignment?.subjectOfficerName || selectedCase?.subjectOfficerName || selectedCase?.officerName || selectedCase?.subjectOfficer || (assignee && assignee.toLowerCase() !== "subject officer" ? assignee : "");
    return formatSubjectOfficerName(raw);
  };

  // Helper to save assignment
  const saveSubjectAssignment = async (updatedFields: Partial<any>) => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dcmms_subject_assignments") || "[]";
      let list: any[] = [];
      try { list = JSON.parse(stored); } catch (e) {}
      
      const matchKey = String(caseNoParam || "").trim().toLowerCase();
      const idx = list.findIndex((a) => String(a.caseNo || a.case_no || "").trim().toLowerCase() === matchKey);
      const existing = idx >= 0 ? list[idx] : {};
      
      const updated = {
        id: assignmentExistingId(),
        caseNo: caseNoParam,
        case_no: caseNoParam,
        subjectOfficerName: updatedFields.subjectOfficerName || existing.subjectOfficerName || assignee || "Subject Officer",
        status: status,
        updatedAt: new Date().toISOString(),
        datesSubmitTimestamp: new Date().toISOString(),
        ...existing,
        ...updatedFields,
        extensionTerm: updatedFields.extensionTerm || updatedFields.extension_term || existing.extensionTerm || existing.extension_term,
        extensionStartDate: updatedFields.extensionStartDate || updatedFields.extension_start_date || existing.extensionStartDate || existing.extension_start_date,
        extensionEndDate: updatedFields.extensionEndDate || updatedFields.extension_end_date || existing.extensionEndDate || existing.extension_end_date,
        extension_term: updatedFields.extensionTerm || updatedFields.extension_term || existing.extensionTerm || existing.extension_term,
        extension_start_date: updatedFields.extensionStartDate || updatedFields.extension_start_date || existing.extensionStartDate || existing.extension_start_date,
        extension_end_date: updatedFields.extensionEndDate || updatedFields.extension_end_date || existing.extensionEndDate || existing.extension_end_date,
        extensionRequestedByAdmin: updatedFields.extensionRequestedByAdmin !== undefined ? updatedFields.extensionRequestedByAdmin : true,
        extension_requested_by_admin: updatedFields.extensionRequestedByAdmin !== undefined ? updatedFields.extensionRequestedByAdmin : true,
      };

      if (idx >= 0) list[idx] = updated;
      else list.push(updated);

      localStorage.setItem("dcmms_subject_assignments", JSON.stringify(list));
      setExistingAssignment(updated);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("dcmms_assignment_updated"));
        window.dispatchEvent(new Event("dcmms_notifications_updated"));
        window.dispatchEvent(new Event("dcmms_data_updated"));
        window.dispatchEvent(new Event("storage"));
      }

      if (isSupabaseConfigured) {
        try {
          await supabase.from("dcmms_subject_assignments").upsert({
            case_no: updated.caseNo,
            subject_officer_name: updated.subjectOfficerName,
            status: updated.status,
            assigned_officers: Array.isArray(updated.assignedOfficers) ? updated.assignedOfficers : (updated.assignedOfficers ? [updated.assignedOfficers] : null),
            chairman: updated.chairman || null,
            members: updated.members || null,
            appointment_date: updated.appointmentDate || null,
            report_due_date: updated.reportDueDate || null,
            extension_term: updated.extension_term || updated.extensionTerm || null,
            extension_start_date: updated.extension_start_date || updated.extensionStartDate || null,
            extension_end_date: updated.extension_end_date || updated.extensionEndDate || null,
            extension_requested_by_admin: updated.extension_requested_by_admin !== undefined ? updated.extension_requested_by_admin : true,
            extension_approval_status: updated.extension_approval_status || updated.extensionApprovalStatus || null,
            extension_decision_date: updated.extension_decision_date || updated.extensionDecisionDate || null,
            certification_submitted: updated.certification_submitted || updated.certificationSubmitted || false,
            report_submit_date: updated.reportSubmitDate || null,
            report_content: updated.reportContent || null,
            after_investigation_sent: updated.afterInvestigationSent || false,
            after_investigation_date: updated.afterInvestigationDate || null,
            investigation_file_no: updated.investigationFileNo || null,
            investigation_status: updated.investigationStatus || null,
            investigation_notes: updated.investigationNotes || null,
            progress_details: updated.progressDetails || null,
          }, { onConflict: "case_no" });
        } catch (e) {}
      }
    }
  };

  const assignmentExistingId = () => existingAssignment?.id || `asgn-${caseNoParam}`;

  // Step 3: Admin Sends Extension Request to Subject Officer
  const handleStep3RequestExtension = async () => {
    if (!step3StartDate || !step3EndDate) {
      showToast(lang === "si" ? "කරුණාකර දීර්ඝ කිරීමේ ආරම්භ දිනය සහ අවසාන දිනය තෝරන්න." : "Please select both Extension Start Date and End Date.");
      return;
    }

    setIsSaving(true);
    const subjectOfficer = existingAssignment?.subjectOfficerName || assignee || getDisplaySubjectOfficerName() || "Subject Officer";
    const matchKey = String(caseNoParam || "").trim().toLowerCase();
    const now = new Date().toISOString().slice(0, 10);
    const actionId = `act-ext-${caseNoParam}-${Date.now()}`;
    const desc = `Extension of Days Request (Sent for Approval): ${step3Term} Extension (${step3StartDate} to ${step3EndDate}) sent to Subject Officer (${subjectOfficer}) for approval.`;

    const updatePayload: any = {
      subjectOfficerName: subjectOfficer,
      extensionTerm: step3Term,
      extensionStartDate: step3StartDate,
      extensionEndDate: step3EndDate,
      extension_term: step3Term,
      extension_start_date: step3StartDate,
      extension_end_date: step3EndDate,
      extensionRequestedByAdmin: true,
      extension_requested_by_admin: true,
      extensionApprovalStatus: "Pending",
      extension_approval_status: "Pending",
      extensionDecisionDate: null,
      extension_decision_date: null,
      status: "Extension Requested",
    };

    // 1. Save extension data to dcmms_subject_assignments (localStorage + Supabase)
    await saveSubjectAssignment(updatePayload);

    // 2. Also update dcmms_letters & action logs in localStorage so Subject Officer's page and timeline pick it up
    if (typeof window !== "undefined") {
      try {
        const storedLetters = localStorage.getItem("dcmms_letters") || "[]";
        let letters = JSON.parse(storedLetters);
        const idx = letters.findIndex((l: any) => String(l.refNo || l.caseNo || "").trim().toLowerCase() === matchKey);
        if (idx >= 0) {
          letters[idx].extensionTerm = step3Term;
          letters[idx].extensionStartDate = step3StartDate;
          letters[idx].extensionEndDate = step3EndDate;
          letters[idx].extension_term = step3Term;
          letters[idx].extension_start_date = step3StartDate;
          letters[idx].extension_end_date = step3EndDate;
          letters[idx].extensionRequested = true;
          letters[idx].extensionRequestedByAdmin = true;
          letters[idx].extensionApprovalStatus = "Pending";
          letters[idx].extensionDecisionDate = null;
          letters[idx].status = "Extension Requested";
          if (subjectOfficer) letters[idx].officerName = subjectOfficer;
        } else {
          letters.push({
            refNo: caseNoParam,
            caseNo: caseNoParam,
            officerName: subjectOfficer,
            extensionTerm: step3Term,
            extensionStartDate: step3StartDate,
            extensionEndDate: step3EndDate,
            extension_term: step3Term,
            extension_start_date: step3StartDate,
            extension_end_date: step3EndDate,
            extensionRequested: true,
            extensionRequestedByAdmin: true,
            extensionApprovalStatus: "Pending",
            extensionDecisionDate: null,
            status: "Extension Requested",
          });
        }
        localStorage.setItem("dcmms_letters", JSON.stringify(letters));
      } catch (e) {}

      // 3. Update dcmms_cases status
      try {
        const storedCases = localStorage.getItem("dcmms_cases") || "[]";
        let cases = JSON.parse(storedCases);
        const idx = cases.findIndex((c: any) => String(c.caseNo || c.refNo || "").trim().toLowerCase() === matchKey);
        if (idx >= 0) {
          cases[idx].extensionTerm = step3Term;
          cases[idx].extensionStartDate = step3StartDate;
          cases[idx].extensionEndDate = step3EndDate;
          cases[idx].extension_term = step3Term;
          cases[idx].extension_start_date = step3StartDate;
          cases[idx].extension_end_date = step3EndDate;
          cases[idx].extensionRequested = true;
          cases[idx].extensionRequestedByAdmin = true;
          cases[idx].extensionApprovalStatus = "Pending";
          cases[idx].extensionDecisionDate = null;
          cases[idx].status = "Extension Requested";
        } else {
          cases.push({
            caseNo: caseNoParam,
            refNo: caseNoParam,
            extensionTerm: step3Term,
            extensionStartDate: step3StartDate,
            extensionEndDate: step3EndDate,
            extension_term: step3Term,
            extension_start_date: step3StartDate,
            extension_end_date: step3EndDate,
            extensionRequested: true,
            extensionRequestedByAdmin: true,
            extensionApprovalStatus: "Pending",
            extensionDecisionDate: null,
            status: "Extension Requested",
          });
        }
        localStorage.setItem("dcmms_cases", JSON.stringify(cases));
      } catch (e) {}

      // 4. Save action log to previous actions history
      const newActionItem = {
        id: actionId,
        caseNo: caseNoParam,
        receivedDate: now,
        reportState: "Extension of Days Request (Sent for Approval)",
        specialNotes: `Extension Term: ${step3Term} | Start Date: ${step3StartDate} | End Date: ${step3EndDate}`,
        subjectOfficerName: subjectOfficer,
        stepTaken: desc,
      };

      try {
        const storedActions = localStorage.getItem("dcmms_new_letter_current_case") || "[]";
        let actionsList = [];
        try { actionsList = JSON.parse(storedActions); } catch (e) {}
        if (!Array.isArray(actionsList)) actionsList = [];
        actionsList.unshift(newActionItem);
        localStorage.setItem("dcmms_new_letter_current_case", JSON.stringify(actionsList));
        setPreviousActions((prev) => [newActionItem, ...prev]);
      } catch (e) {}

      // 5. Write a new notification entry to dcmms_notifications so Subject Officer gets an unread badge immediately
      try {
        const notifKey = "dcmms_notifications";
        const stored = localStorage.getItem(notifKey) || "[]";
        let notifs: any[] = [];
        try { notifs = JSON.parse(stored); } catch (e) {}
        if (!Array.isArray(notifs)) notifs = [];
        notifs.unshift({
          id: `notif-ext-${caseNoParam}-${step3Term}-${Date.now()}`,
          caseNo: caseNoParam,
          type: "extension_request",
          title: `Extension of Days Request (${step3Term})`,
          message: desc,
          targetOfficer: subjectOfficer,
          extensionTerm: step3Term,
          extensionStartDate: step3StartDate,
          extensionEndDate: step3EndDate,
          extensionApprovalStatus: "Pending",
          createdAt: new Date().toISOString(),
          read: false,
        });
        localStorage.setItem(notifKey, JSON.stringify(notifs));
      } catch (e) {}

      window.dispatchEvent(new CustomEvent("dcmms_assignment_updated"));
      window.dispatchEvent(new CustomEvent("dcmms_notifications_updated"));
      window.dispatchEvent(new CustomEvent("dcmms_data_updated"));
      window.dispatchEvent(new StorageEvent("storage", { key: "dcmms_subject_assignments" }));
      window.dispatchEvent(new StorageEvent("storage", { key: "dcmms_notifications" }));
    }

    if (isSupabaseConfigured) {
      try {
        // Update main subject status
        await supabase
          .from("dcmms_subject")
          .update({
            status: "Extension Requested",
            updated_at: new Date().toISOString(),
          })
          .ilike("case_no", caseNoParam.trim());

        // Log extension request action into dcmms_subject_details history log
        await supabase.from("dcmms_subject_details").insert({
          id: actionId,
          case_no: caseNoParam,
          ref_no: caseNoParam,
          received_date: now,
          report_state: "Extension of Days Request (Sent for Approval)",
          special_notes: `Extension Term: ${step3Term} | Start Date: ${step3StartDate} | End Date: ${step3EndDate}`,
          subject_officer_name: subjectOfficer,
          officer_name: subjectOfficer,
          step_taken: desc,
        });

        // Create a NEW notification per extension request (unique ID per term) so Subject Officer sees unread badge
        const extMailId = `mail-ext-${caseNoParam}-${step3Term.toLowerCase()}-${Date.now()}`;
        await supabase.from("dcmms_daily_mail").insert({
          id: extMailId,
          ref_no: caseNoParam,
          officer_name: subjectOfficer,
          name_of_subject_officer: subjectOfficer,
          subject: `Extension of Days Request (${step3Term}) — ${selectedCase?.subject || caseNoParam}`,
          received_date: now,
          status: "Extension Requested",
          extension_term: step3Term,
          extension_start_date: step3StartDate,
          extension_end_date: step3EndDate,
          extension_approval_status: "Pending",
        }).select();

        // Also keep the base mail record updated so the case still appears on Subject Officer's list
        await supabase.from("dcmms_daily_mail").upsert({
          id: `mail-${caseNoParam}-${subjectOfficer.trim().toLowerCase().replace(/\s+/g, "_")}`,
          ref_no: caseNoParam,
          officer_name: subjectOfficer,
          name_of_subject_officer: subjectOfficer,
          subject: selectedCase?.subject || `Assigned Inquiry Case (${caseNoParam})`,
          received_date: now,
          status: "Extension Requested",
          extension_term: step3Term,
          extension_start_date: step3StartDate,
          extension_end_date: step3EndDate,
          extension_approval_status: "Pending",
        }, { onConflict: "id" });
      } catch (e) {}
    }

    setIsSaving(false);
    showToast(
      lang === "si"
        ? `දිනයන් දීර්ඝ කිරීමේ ඉල්ලීම (අනුමැතිය සඳහා) - ${step3Term} (${step3StartDate} සිට ${step3EndDate} දක්වා) විෂය නිලධාරියා වෙත සාර්ථකව යවන ලදී!`
        : `Extension of Days Request (Sent for Approval) — ${step3Term} (${step3StartDate} to ${step3EndDate}) sent to Subject Officer!`
    );
  };

  // ── Handler: Investigation Administrator sends Investigation Committee Assignment details to Subject Officer ──
  const handleSendCommitteeToSubjectOfficer = async () => {
    if (!selectedChairman && selectedMembers.length === 0) {
      showToast(lang === "si" ? "කරුණාකර අවම වශයෙන් සභාපතිවරයෙකු හෝ එක් කමිටු සාමාජිකයෙකු තෝරන්න." : "Please select a Chairman or at least one Committee Member first.");
      return;
    }

    const targetOfficer = selectedSubjectOfficer?.trim() || getDisplaySubjectOfficerName();
    if (!targetOfficer || targetOfficer === "Subject Officer" || targetOfficer === "Unassigned") {
      showToast(lang === "si" ? "කරුණාකර තොරතුරු යැවිය යුතු විෂය භාර නිලධාරියා තෝරන්න." : "Please select a Subject Officer to send the committee details to.");
      return;
    }

    const chairmanPart = selectedChairman ? `Chairman: ${selectedChairman.fullName || selectedChairman.name}` : "";
    const membersPart = selectedMembers.length > 0 ? `Members: ${selectedMembers.map((m) => m.fullName || m.name).join(", ")}` : "";
    const formattedAssignedText = [chairmanPart, membersPart].filter(Boolean).join(" | ");

    setStep1AssignedOfficers(formattedAssignedText);
    setAssignee(targetOfficer);
    setIsSaving(true);

    await saveSubjectAssignment({
      subjectOfficerName: targetOfficer,
      assignedOfficers: formattedAssignedText,
      officerList: [targetOfficer],
      chairman: selectedChairman,
      members: selectedMembers,
      committeeSent: true,
      committeeSentAt: new Date().toISOString().slice(0, 10),
      status: "Committee Details Sent to Subject Officer",
    });

    if (selectedChairman && caseNoParam) {
      const payload = {
        fullName: selectedChairman.fullName || selectedChairman.name || "",
        position: selectedChairman.position || "Chairman",
        email: selectedChairman.email || "",
      };
      try {
        await saveChairmanByCaseServer(caseNoParam, payload);
      } catch (e) {}
      if (isSupabaseConfigured) {
        try {
          let validEmail = null;
          if (selectedChairman.email) {
            const { data: commData } = await supabase
              .from("commitee_table")
              .select("email")
              .ilike("email", selectedChairman.email.trim())
              .maybeSingle();
            if (commData) validEmail = commData.email;
          }
          await supabase.from("chairment_by_case").upsert({
            ref_number: caseNoParam.trim(),
            full_name: payload.fullName,
            position: payload.position,
            email: validEmail,
            updated_at: new Date().toISOString(),
          }, { onConflict: "ref_number" });
        } catch (e) {}
      }
    }

    const now = new Date().toISOString().slice(0, 10);
    const actionId = `act-committee-${caseNoParam}-${Date.now()}`;
    const desc = `Investigation Committee Assignment details (${formattedAssignedText}) sent to Subject Officer (${targetOfficer}).`;

    if (typeof window !== "undefined") {
      try {
        const storedLetters = localStorage.getItem("dcmms_letters") || "[]";
        let letters = JSON.parse(storedLetters);
        const idx = letters.findIndex((l: any) => l.refNo === caseNoParam);
        if (idx >= 0) {
          letters[idx].officerName = targetOfficer || letters[idx].officerName;
          letters[idx].committeeDetails = formattedAssignedText;
          letters[idx].status = "assigned";
        } else {
          letters.push({
            id: `let-${caseNoParam}-${Date.now()}`,
            refNo: caseNoParam,
            officerName: targetOfficer,
            subject: selectedCase?.subject || `Assigned Inquiry Case (${caseNoParam})`,
            receivedDate: now,
            status: "assigned",
            committeeDetails: formattedAssignedText,
            priority: "high"
          });
        }
        localStorage.setItem("dcmms_letters", JSON.stringify(letters));
      } catch (e) {}

      try {
        const storedCases = localStorage.getItem("dcmms_cases") || "[]";
        let cases = JSON.parse(storedCases);
        const idx = cases.findIndex((c: any) => c.caseNo === caseNoParam || c.refNo === caseNoParam);
        if (idx >= 0) {
          cases[idx].assignedTo = targetOfficer;
          cases[idx].subjectOfficer = targetOfficer;
          cases[idx].assignedOfficers = formattedAssignedText;
          cases[idx].status = "Committee Details Sent";
        }
        localStorage.setItem("dcmms_cases", JSON.stringify(cases));
      } catch (e) {}

      try {
        const storedActions = localStorage.getItem("dcmms_new_letter_current_case") || "[]";
        let actionsList = [];
        try { actionsList = JSON.parse(storedActions); } catch (e) {}
        if (!Array.isArray(actionsList)) actionsList = [];
        const newActionItem = {
          id: actionId,
          caseNo: caseNoParam,
          receivedDate: now,
          reportState: "Committee Details Sent",
          specialNotes: `Committee Assignment: ${formattedAssignedText}`,
          subjectOfficerName: targetOfficer,
          stepTaken: desc,
        };
        actionsList.unshift(newActionItem);
        localStorage.setItem("dcmms_new_letter_current_case", JSON.stringify(actionsList));
        setPreviousActions((prev) => [newActionItem, ...prev]);
      } catch (e) {}
    }

    if (isSupabaseConfigured) {
      try {
        // 1. Update all existing daily mail letters for this case
        await supabase
          .from("dcmms_daily_mail")
          .update({
            officer_name: targetOfficer,
            name_of_subject_officer: targetOfficer,
            status: "assigned",
          })
          .eq("ref_no", caseNoParam);

        // 2. Upsert daily mail for this case ref_no
        await supabase.from("dcmms_daily_mail").upsert({
          id: `mail-${caseNoParam}-${targetOfficer.trim().toLowerCase().replace(/\s+/g, "_")}`,
          ref_no: caseNoParam,
          officer_name: targetOfficer,
          name_of_subject_officer: targetOfficer,
          subject: selectedCase?.subject || `Assigned Inquiry Case (${caseNoParam})`,
          received_date: now,
          status: "assigned"
        });

        // 3. Insert subject details history action log
        await supabase.from("dcmms_subject_details").insert({
          id: actionId,
          case_no: caseNoParam,
          ref_no: caseNoParam,
          received_date: now,
          report_state: "Committee Details Sent",
          special_notes: `Committee Assignment: ${formattedAssignedText}`,
          subject_officer_name: targetOfficer,
          officer_name: targetOfficer,
          step_taken: desc,
        });

        // 4. Update and Upsert case in dcmms_subject table
        await supabase
          .from("dcmms_subject")
          .update({
            subject_officer_name: targetOfficer,
            officer_name: targetOfficer,
            assigned_officer: targetOfficer,
            status: "Committee Details Sent",
            updated_at: new Date().toISOString(),
          })
          .eq("case_no", caseNoParam);

        await supabase.from("dcmms_subject").upsert({
          id: `case-${caseNoParam}`,
          case_no: caseNoParam,
          subject: selectedCase?.subject || `Assigned Inquiry Case (${caseNoParam})`,
          status: "Committee Details Sent",
          subject_officer_name: targetOfficer,
          officer_name: targetOfficer,
          assigned_officer: targetOfficer,
        }, { onConflict: "case_no" });
      } catch (e) {
        console.warn("Supabase committee details assignment error:", e);
      }
    }

    setIsSaving(false);
    showToast(
      lang === "si"
        ? `විමර්ශන කමිටු පත්වීම් තොරතුරු ${targetOfficer} වෙත සාර්ථකව යවන ලදී!`
        : `Investigation Committee Assignment details successfully sent to ${targetOfficer}!`
    );
  };

  // Step 1: Admin Submits Assigned Officers (1 Chairman & Many Members)
  const handleStep1SubmitOfficers = async () => {
    if (!selectedChairman && selectedMembers.length === 0 && !step1AssignedOfficers.trim()) {
      alert("Please select a Chairman or at least one Committee Member.");
      return;
    }

    const chairmanPart = selectedChairman ? `Chairman: ${selectedChairman.fullName}` : "";
    const membersPart = selectedMembers.length > 0 ? `Members: ${selectedMembers.map((m) => m.fullName).join(", ")}` : "";
    const formattedAssignedText = [chairmanPart, membersPart].filter(Boolean).join(" | ") || step1AssignedOfficers;

    setStep1AssignedOfficers(formattedAssignedText);

    // Subject Officer is the system user with a profile who receives the case file
    const targetSubjectOfficer = getDisplaySubjectOfficerName();

    await saveSubjectAssignment({
      subjectOfficerName: targetSubjectOfficer,
      assignedOfficers: formattedAssignedText,
      officerList: [targetSubjectOfficer],
      chairman: selectedChairman,
      members: selectedMembers,
      status: "Officers Assigned",
    });

    if (typeof window !== "undefined") {
      // 1. Sync dcmms_letters in localStorage for the Subject Officer
      try {
        const storedLetters = localStorage.getItem("dcmms_letters") || "[]";
        let letters = JSON.parse(storedLetters);
        const exists = letters.some((l: any) => l.refNo === caseNoParam && l.officerName?.toLowerCase() === targetSubjectOfficer.toLowerCase());
        if (!exists) {
          letters.push({
            id: `let-${caseNoParam}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            refNo: caseNoParam,
            officerName: targetSubjectOfficer,
            subject: selectedCase?.subject || `Assigned Inquiry Case (${caseNoParam})`,
            receivedDate: new Date().toISOString().split("T")[0],
            status: "assigned",
            priority: "high"
          });
        }
        localStorage.setItem("dcmms_letters", JSON.stringify(letters));
      } catch (e) {}

      // 2. Sync dcmms_cases in localStorage
      try {
        const storedCases = localStorage.getItem("dcmms_cases") || "[]";
        let cases = JSON.parse(storedCases);
        const idx = cases.findIndex((c: any) => c.caseNo === caseNoParam || c.refNo === caseNoParam);
        if (idx >= 0) {
          cases[idx].assignedTo = targetSubjectOfficer;
          cases[idx].subjectOfficer = targetSubjectOfficer;
          cases[idx].subjectOfficerName = targetSubjectOfficer;
          cases[idx].assignedOfficers = formattedAssignedText;
        }
        localStorage.setItem("dcmms_cases", JSON.stringify(cases));
      } catch (e) {}

      // 3. Sync Supabase dcmms_daily_mail & dcmms_subject for the Subject Officer
      if (isSupabaseConfigured) {
        try {
          await supabase.from("dcmms_daily_mail").upsert({
            id: `mail-${caseNoParam}-${targetSubjectOfficer.trim().toLowerCase().replace(/\s+/g, "_")}`,
            ref_no: caseNoParam,
            officer_name: targetSubjectOfficer,
            subject: selectedCase?.subject || `Assigned Inquiry Case (${caseNoParam})`,
            received_date: new Date().toISOString().split("T")[0],
            status: "assigned"
          });

          await supabase.from("dcmms_subject").upsert({
            id: `case-${caseNoParam}`,
            case_no: caseNoParam,
            subject: selectedCase?.subject || `Assigned Inquiry Case (${caseNoParam})`,
            priority: "high",
            status: "Officers Assigned",
            assigned_date: new Date().toISOString().split("T")[0],
            subject_officer_name: targetSubjectOfficer,
            officer_name: targetSubjectOfficer,
          });
        } catch (e) {}
      }
    }

    const isGenericOrKumara = !targetSubjectOfficer || targetSubjectOfficer.toLowerCase().includes("kumara") || targetSubjectOfficer === "subject officer" || targetSubjectOfficer === "විෂය නිලධාරී" || targetSubjectOfficer === "පවරන ලද විෂය භාර නිලධාරී" || targetSubjectOfficer === "assigned subject officer";
    const officerLabel = isGenericOrKumara
      ? (lang === "si" ? "පවරන ලද විෂය භාර නිලධාරී" : "Assigned Subject Officer")
      : targetSubjectOfficer;

    showToast(lang === "si" ? `Step 1: පත් කළ විමර්ශන කමිටුව ${officerLabel} වෙත යවන ලදී!` : `Step 1: Assigned Officers Committee submitted to ${officerLabel}!`);
  };

  // Step 2: Admin Confirms / Sets Appointment Date & Report Due Date
  const handleStep2SubmitDatesAdmin = async () => {
    if (!step2ApptDate || !step2DueDate) {
      alert("Please select both Appointment Letter Date and Report Due Date.");
      return;
    }
    await saveSubjectAssignment({
      appointmentDate: step2ApptDate,
      reportDueDate: step2DueDate,
      datesSubmittedBySubject: true,
      status: "Appointment & Due Dates Set",
    });
    showToast(lang === "si" ? `Step 2: පත්වීම් ලිපිය දිනය (${step2ApptDate}) සහ වාර්තා දිනය (${step2DueDate}) සාර්ථකව තහවුරු කරන ලදී!` : `Step 2: Appointment Date (${step2ApptDate}) and Due Date (${step2DueDate}) saved!`);
  };



  // Step 4: Admin Records Progress & Updates Inquiry Details
  const handleStep4RecordProgress = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    const today = new Date().toISOString().slice(0, 10);

    await saveSubjectAssignment({
      afterInvestigationSent: true,
      afterInvestigationDate: today,
      investigationFileNo: investigationFileNo || null,
      investigationStatus: status,
      investigationNotes: inquiryNotes || null,
      progressDetails: inquiryNotes || null,
      status: status || "In Progress",
    });

    await handleSaveFormInternal();
    setIsSaving(false);
    showToast(lang === "si" ? "Step 4: විමර්ශන ප්‍රගතිය සහ විස්තර සාර්ථකව යාවත්කාලීන කරන ලදී!" : "Step 4: Progress recorded and inquiry details updated successfully!");
  };

  const handleSaveFormInternal = async () => {
    const now = new Date().toISOString().slice(0, 10);
    const actionId = `act-${Date.now()}`;
    const desc = `Inquiry progress updated (${status}). Assigned: ${assignee || "Officer"}. ${inquiryNotes}`;

    if (isSupabaseConfigured) {
      try {
        // 1. Update main case status and target date in dcmms_subject
        await supabase
          .from("dcmms_subject")
          .update({
            status: status,
            assigned_date: targetDate || null,
          })
          .eq("case_no", caseNoParam);

        // 2. Assign letter to Subject Officer in dcmms_daily_mail so it appears on their dashboard
        if (assignee) {
          await supabase
            .from("dcmms_daily_mail")
            .update({
              officer_name: assignee,
              status: "assigned",
            })
            .eq("ref_no", caseNoParam);
        }

        // 3. Insert new action log to dcmms_subject_details
        await supabase
          .from("dcmms_subject_details")
          .insert({
            id: actionId,
            case_no: caseNoParam,
            received_date: now,
            report_state: status,
            special_notes: inquiryNotes || null,
            subject_officer_name: assignee || "Investigation Administrator",
            step_taken: desc,
          });

        // 4. Upsert inquiry investigation record in dcmms_investigation
        await supabase.from("dcmms_investigation").upsert({
          id: `inv-${caseNoParam}`,
          case_no: caseNoParam,
          inquiry_no: caseNoParam,
          target_date: targetDate || null,
          status: status,
          assigned_officer: assignee || null,
          notes: inquiryNotes || null,
        });

        // 5. Upsert preliminary investigation log in dcmms_preliminary_investigations
        await supabase.from("dcmms_preliminary_investigations").upsert({
          id: `prelim-${caseNoParam}`,
          case_no: caseNoParam,
          committee_members: selectedMembers,
          appointment_date: step2ApptDate || null,
          report_due_date: step2DueDate || null,
          findings: inquiryNotes || null,
          observations: desc,
          status: status,
          updated_at: new Date().toISOString()
        });

        // 6. Audit log entry
        await logAuditEvent(
          "UPDATE_INVESTIGATION_PROGRESS",
          "dcmms_investigation",
          caseNoParam,
          { status, notes: inquiryNotes }
        );
      } catch (err) {
        console.error("Failed to save investigation details to Supabase:", err);
      }
    }

    if (typeof window !== "undefined") {
      const storedCases = localStorage.getItem("dcmms_cases");
      if (storedCases) {
        try {
          const list = JSON.parse(storedCases);
          const updatedList = list.map((c: any) => {
            if (c.caseNo === caseNoParam || c.inquiryNo === caseNoParam) {
              return {
                ...c,
                assignee,
                targetDate,
                status,
                inquiryNotes,
                updatedAt: new Date().toISOString(),
              };
            }
            return c;
          });
          localStorage.setItem("dcmms_cases", JSON.stringify(updatedList));
        } catch (e) {}
      }

      if (assignee) {
        try {
          const storedLetters = localStorage.getItem("dcmms_letters");
          if (storedLetters) {
            const list = JSON.parse(storedLetters);
            const updated = list.map((l: any) => {
              if (l.refNo === caseNoParam) {
                return {
                  ...l,
                  officerName: assignee,
                  status: "assigned",
                };
              }
              return l;
            });
            localStorage.setItem("dcmms_letters", JSON.stringify(updated));
          }
        } catch (e) {}
      }

      // Save action entry into previous actions history
      const newActionItem = {
        id: actionId,
        caseNo: caseNoParam,
        receivedDate: now,
        reportState: status,
        specialNotes: inquiryNotes,
        subjectOfficerName: assignee || "Investigation Officer",
        stepTaken: desc,
      };

      const storedActions = localStorage.getItem("dcmms_new_letter_current_case") || "[]";
      let actionsList = [];
      try { actionsList = JSON.parse(storedActions); } catch (e) {}
      if (!Array.isArray(actionsList)) actionsList = [];
      actionsList.unshift(newActionItem);
      localStorage.setItem("dcmms_new_letter_current_case", JSON.stringify(actionsList));
      setPreviousActions((prev) => [newActionItem, ...prev]);
    }

    // Also update the subject assignment with latest investigation data for the Subject Officer to see
    await saveSubjectAssignment({
      investigationFileNo: investigationFileNo || undefined,
      investigationStatus: status,
      investigationNotes: inquiryNotes || undefined,
      progressDetails: inquiryNotes || undefined,
    });

    setIsSaving(false);
    showToast(lang === "si" ? "විමර්ශන තොරතුරු සාර්ථකව යාවත්කාලීන කර අදාළ විෂය නිලධාරියා වෙත යවන ලදී!" : "Investigation record saved and sent to the case subject officer!");
    setTimeout(() => {
      router.push("/investigation");
    }, 1000);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleStep4RecordProgress();
  };


  if (isLoading) {
    return (
      <div className="page-loading-container" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "12px" }}>
        <RefreshCw size={32} className="animate-spin" style={{ color: "#4f46e5" }} />
        <span>Loading investigation case records...</span>
      </div>
    );
  }

  return (
    <div className="dashboard-container" data-font-scale={fontScale}>
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
        role="investigation"
      />

      <div className="dashboard-layout">
        <main id="dashboard-main-content" className="dashboard-content">

          {/* ── Top Header App Bar ── */}
          <header className="dashboard-header">
            <div className="dashboard-header-left">
              <button
                className="menu-toggle-btn"
                aria-label="Toggle Sidebar Menu"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                <svg className="hamburger-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="dashboard-title-area">
                <h2 className="dashboard-main-title">
                  {lang === "si" ? "විමර්ශන පරිපාලක උපකරණ පුවරුව" : "Investigation Administrator"}
                </h2>
                <p className="dashboard-main-subtitle">
                  {lang === "si" ? "විමර්ශන පියවර සහ දත්ත ප්‍රවාහය කළමනාකරණය" : "Investigation Progress & Subject Officer Data Flow"}
                </p>
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

              <div className="accessibility-adjuster-bar" role="radiogroup" aria-label="Font Sizing">
                <label className={`size-btn size-btn-small${fontScale === "small" ? " active" : ""}`}>
                  <input type="radio" name="fontScale" value="small" checked={fontScale === "small"} onChange={() => setFontScale("small")} className="sr-only" /> A
                </label>
                <label className={`size-btn size-btn-medium${fontScale === "medium" ? " active" : ""}`}>
                  <input type="radio" name="fontScale" value="medium" checked={fontScale === "medium"} onChange={() => setFontScale("medium")} className="sr-only" /> A
                </label>
                <label className={`size-btn size-btn-large${fontScale === "large" ? " active" : ""}`}>
                  <input type="radio" name="fontScale" value="large" checked={fontScale === "large"} onChange={() => setFontScale("large")} className="sr-only" /> A
                </label>
              </div>

              <div className="divider-line" aria-hidden="true" />

              <div className="trilingual-language-selector">
                <label className={`lang-btn${lang === "si" ? " active" : ""}`}>
                  <input type="radio" name="lang" value="si" checked={lang === "si"} onChange={() => i18n.changeLanguage("si")} className="sr-only" /> සිංහල
                </label>
                <label className={`lang-btn${lang === "ta" ? " active" : ""}`}>
                  <input type="radio" name="lang" value="ta" checked={lang === "ta"} onChange={() => i18n.changeLanguage("ta")} className="sr-only" /> தமிழ்
                </label>
                <label className={`lang-btn${lang === "en" ? " active" : ""}`}>
                  <input type="radio" name="lang" value="en" checked={lang === "en"} onChange={() => i18n.changeLanguage("en")} className="sr-only" /> English
                </label>
              </div>
            </div>
          </header>

          {/* ── Main Form Page Section ── */}
          <section className="add-details-page-wrapper">
            <div className="add-details-main-card">
              
              {/* Header Title Bar */}
              <div className="add-details-header-container">
                <div className="add-details-header-left">
                  <h1 className="add-details-title" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Shield size={24} style={{ color: "#4f46e5" }} />
                    <span>{lang === "si" ? "විමර්ශන විස්තර සහ ප්‍රගති සටහන්" : "Investigation Progress & Action Form"}</span>
                  </h1>
                  <p className="add-details-subtitle">
                    Ref: <strong style={{ color: "#4f46e5" }}>{caseNoParam}</strong> | Target: <strong>{targetDate}</strong>
                  </p>
                </div>
                <div className="add-details-header-right-btns">
                  <Link href="/investigation" className="btn-back-home">
                    <svg className="btn-back-home-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    {lang === "si" ? "නැවත ප්‍රධාන පුවරුවට" : "Back to Dashboard"}
                  </Link>
                </div>
              </div>

              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
                {/* Previous Subject Details Card */}
                <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #cbd5e1", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                  <h4 style={{ margin: "0 0 14px 0", fontSize: "15px", color: "#1e1b4b", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                    <FileText size={18} style={{ color: "#4f46e5" }} />
                    <span>{lang === "si" ? "පෙර විෂය නිලධාරී සටහන් සහ විෂය විස්තර" : "Previous Subject Officer Details & Case Metadata"}</span>
                  </h4>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
                    
                    {/* Case No */}
                    <div style={{ backgroundColor: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "block" }}>
                        {lang === "si" ? "නඩු අංකය / යොමු අංකය" : "Case / Reference No"}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#4f46e5" }}>
                        {caseNoParam}
                      </span>
                    </div>

                    {/* Subject Officer */}
                    <div style={{ backgroundColor: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "block" }}>
                        {lang === "si" ? "පවරන ලද විෂය භාර නිලධාරියා" : "Assigned Subject Officer"}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                        {getDisplaySubjectOfficerName()}
                      </span>
                    </div>

                    {/* Complainant */}
                    <div style={{ backgroundColor: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "block" }}>
                        {lang === "si" ? "පැමිණිලිකරුගේ නම" : "Complainant Name"}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                        {selectedCase?.complainantName || "Director of Education"}
                      </span>
                    </div>

                    {/* Appointment Letter Date */}
                    <div style={{ backgroundColor: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "block" }}>
                        {lang === "si" ? "පත්වීම් ලිපියේ දිනය" : "Appointment Letter Date"}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#0369a1" }}>
                        {existingAssignment?.appointmentDate || step2ApptDate || "—"}
                      </span>
                    </div>

                    {/* Target / Due Date */}
                    <div style={{ backgroundColor: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "block" }}>
                        {lang === "si" ? "වාර්තා භාරදිය යුතු දිනය" : "Report Due Date"}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#dc2626" }}>
                        {existingAssignment?.reportDueDate || step2DueDate || selectedCase?.targetDate || "—"}
                      </span>
                    </div>

                  </div>

                  {/* Complaint Matter */}
                  <div style={{ marginTop: "14px", backgroundColor: "#f8fafc", padding: "12px 14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                    <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", display: "block" }}>
                      {lang === "si" ? "පෙර විෂය කරුණ / පැමිණිල්ලේ සාරාංශය" : "Subject Matter / Complaint Summary"}
                    </span>
                    <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#1e293b", fontWeight: 600 }}>
                      {selectedCase?.subject || "Formal disciplinary inquiry regarding teacher absenteeism and misconduct"}
                    </p>
                  </div>
                </div>

                {/* Accused Officer(s) Information Card */}
                <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #cbd5e1", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                  <h4 style={{ margin: "0 0 14px 0", fontSize: "15px", color: "#1e1b4b", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                    <User size={18} style={{ color: "#4f46e5" }} />
                    <span>{t("relatedPersonStatus", "Accused Officer(s) Information")}</span>
                  </h4>

                  {concernedOfficersList && concernedOfficersList.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      {concernedOfficersList.map((officer, idx) => (
                        <div key={idx} style={{ backgroundColor: "#f8fafc", padding: "14px 16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                          {concernedOfficersList.length > 1 && (
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "#4f46e5", display: "block", marginBottom: "10px" }}>
                              {lang === "si" ? `චෝදිත නිලධාරියා #${idx + 1}` : lang === "ta" ? `குற்றம் சாட்டப்பட்ட அதிகாரி #${idx + 1}` : `Accused Officer #${idx + 1}`}
                            </span>
                          )}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                            {/* Officer Name */}
                            <div className="detail-field">
                              <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                                <User size={12} style={{ color: "#4f46e5" }} /> {lang === "si" ? "නිලධාරියාගේ නම" : lang === "ta" ? "அதிகாரியின் பெயர்" : "Officer Name"}
                              </span>
                              <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{officer.officer_name || "—"}</span>
                            </div>

                            {/* NIC Number */}
                            <div className="detail-field">
                              <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                                <CreditCard size={12} style={{ color: "#4f46e5" }} /> {lang === "si" ? "ජාතික හැඳුනුම්පත් අංකය" : lang === "ta" ? "தேசிய அடையாள அட்டை எண்" : "NIC Number"}
                              </span>
                              <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{officer.nic || "—"}</span>
                            </div>

                            {/* Designation / Position */}
                            <div className="detail-field">
                              <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                                <Award size={12} style={{ color: "#4f46e5" }} /> {lang === "si" ? "තනතුර" : lang === "ta" ? "பதவி" : "Designation"}
                              </span>
                              <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{officer.position || "—"}</span>
                            </div>

                            {/* School / Institute */}
                            <div className="detail-field">
                              <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                                <Building size={12} style={{ color: "#4f46e5" }} /> {lang === "si" ? "පාසල / ආයතනය" : lang === "ta" ? "பள்ளி / நிறுவனம்" : "School / Institute"}
                              </span>
                              <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{officer.institute_name || "—"}</span>
                            </div>

                            {/* Date of Birth */}
                            {officer.dob && (
                              <div className="detail-field">
                                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                                  <CalendarIcon size={12} style={{ color: "#4f46e5" }} /> {lang === "si" ? "උපන් දිනය" : lang === "ta" ? "பிறந்த திகதி" : "Date of Birth"}
                                </span>
                                <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{officer.dob}</span>
                              </div>
                            )}

                            {/* Date of Appointment */}
                            {officer.appointment_date && (
                              <div className="detail-field">
                                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                                  <CalendarIcon size={12} style={{ color: "#4f46e5" }} /> {lang === "si" ? "පත්වීම් දිනය" : lang === "ta" ? "நியமன திகதி" : "Date of Appointment"}
                                </span>
                                <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{officer.appointment_date}</span>
                              </div>
                            )}

                            {/* Address */}
                            <div className="detail-field">
                              <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                                <MapPin size={12} style={{ color: "#4f46e5" }} /> {lang === "si" ? "ලිපිනය" : lang === "ta" ? "முகவரி" : "Address"}
                              </span>
                              <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{officer.address || "—"}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", padding: "12px 16px", backgroundColor: "#fffbeb", color: "#b45309", borderRadius: "8px", border: "1px solid #fef3c7" }}>
                      <AlertCircle size={18} />
                      <span style={{ fontSize: "13px" }}>
                        {lang === "si"
                          ? "මෙම විමර්ශනය සඳහා වෙන් වූ චෝදනා ලැබූ නිලධාරියාගේ තොරතුරු තවමත් ඇතුළත් කර නොමැත."
                          : lang === "ta"
                          ? "இந்த விசாரணைக்காக பிரத்யேகமாக குற்றம் சாட்டப்பட்ட அதிகாரி தகவல் எதுவும் பதிவு செய்யப்படவில்லை."
                          : "No specific accused officer personal record registered for this inquiry yet."}
                      </span>
                    </div>
                  )}
                </div>

                {/* Investigation Committee Assignment (Choose 1 Chairman & Many Members) Card */}
                <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #cbd5e1", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                    <h4 style={{ margin: 0, fontSize: "15px", color: "#1e293b", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                      <UserCheck size={18} style={{ color: "#4f46e5" }} />
                      <span>{lang === "si" ? "විමර්ශන කමිටුව / මණ්ඩලය පත් කිරීම (1 සභාපති සහ සාමාජිකයින්)" : "Investigation Committee Assignment (1 Chairman & Members)"}</span>
                    </h4>
                    <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#e0e7ff", color: "#3730a3", padding: "3px 10px", borderRadius: "12px" }}>
                      {selectedChairman ? "1 Chairman" : "No Chairman"} • {selectedMembers.length} {selectedMembers.length === 1 ? "Member" : "Members"}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {getCaseInstitutes().length > 0 && (
                      <div style={{ fontSize: "11px", color: "#b45309", backgroundColor: "#fffbe6", border: "1px solid #fde047", padding: "8px 12px", borderRadius: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Shield size={14} style={{ color: "#d97706" }} />
                        <span>
                          {lang === "si"
                            ? `'${getCaseInstitutes().join(", ")}' පාසලට/ආයතනයට සම්බන්ධ (ඉගෙනගත්/දරුවන් සිටින) නිලධාරීන් ගැටුම් වැළැක්වීමට තේරීම් වලින් ඉවත් කර ඇත.`
                            : `Officers associated with '${getCaseInstitutes().join(", ")}' (studied/children school) are filtered out to prevent conflict of interest.`}
                        </span>
                      </div>
                    )}
                    
                    {/* 1. CHOOSE CHAIRMAN (1 Chairman) */}
                    <div style={{ backgroundColor: "#fffbe6", padding: "14px", borderRadius: "10px", border: "1px solid #fef08a" }}>
                      <label htmlFor="chairmanSelectPage" style={{ fontSize: "13px", fontWeight: 700, color: "#854d0e", display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                        <Award size={16} style={{ color: "#d97706" }} />
                        <span>{lang === "si" ? "1. සභාපති නිලධාරී තේරීම (තනි සභාපතිවරයෙක් පමණි)" : "1. Choose Inquiry Chairman (Single Chairman)"}</span>
                      </label>
                      
                      {selectedChairman ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#ffffff", padding: "10px 14px", borderRadius: "8px", border: "1px solid #fde047" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "#d97706", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "14px" }}>
                              {getInitials(selectedChairman.fullName || selectedChairman.name || "C")}
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "14px" }}>
                                  {selectedChairman.fullName || selectedChairman.name}
                                </span>
                                <span style={{ fontSize: "10px", backgroundColor: "#fef3c7", color: "#92400e", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                                  CHAIRMAN / සභාපති
                                </span>
                              </div>
                              <span style={{ fontSize: "11px", color: "#64748b" }}>
                                NIC: {selectedChairman.nicNo || selectedChairman.nic || "N/A"} {selectedChairman.email ? `• ${selectedChairman.email}` : ""}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleRemoveChairman}
                            style={{ color: "#dc2626", backgroundColor: "#fef2f2", border: "1px solid #fca5a5", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                          >
                            <X size={14} />
                            <span>{lang === "si" ? "ඉවත් කරන්න" : "Change"}</span>
                          </button>
                        </div>
                      ) : (
                        <select
                          id="chairmanSelectPage"
                          value=""
                          onChange={(e) => handleSelectChairman(e.target.value)}
                          className="field-select"
                          style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #fde047", backgroundColor: "#ffffff", fontSize: "13px" }}
                        >
                          <option value="">{lang === "si" ? "-- ලියාපදිංචි සභාපතිවරුන්ගෙන් තෝරන්න --" : "-- Select Chairman from Registered Chairmen --"}</option>
                          {officers
                            .filter((off) => {
                              const pos = (off.position || off.officerRole || "").toLowerCase();
                              return pos === "chairman";
                            })
                            .filter((off) => !isOfficerConnectedToCaseInstitute(off, getCaseInstitutes()))
                            .map((off) => (
                              <option key={off.id} value={off.id}>
                                {off.fullName} {off.employeeNo ? `[${off.employeeNo}]` : ""} {off.nicNo ? `- NIC: ${off.nicNo}` : ""}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>

                    {/* 2. CHOOSE MANY MEMBERS (Multiple Members) */}
                    <div style={{ backgroundColor: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                      <label style={{ fontSize: "13px", fontWeight: 700, color: "#334155", display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                        <UserCheck size={16} style={{ color: "#4f46e5" }} />
                        <span>{lang === "si" ? "2. කමිටු සාමාජයින් එක් කිරීම (සාමාජිකයින් කිහිපදෙනෙකු)" : "2. Choose Committee Members (Many Members)"}</span>
                      </label>

                      {/* Selector & Add Member Row */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px", marginBottom: "12px" }}>
                        <select
                          value={memberSelectId}
                          onChange={(e) => {
                            setMemberSelectId(e.target.value);
                            if (e.target.value) handleAddMemberSelect(e.target.value);
                          }}
                          className="field-select"
                          style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", backgroundColor: "#ffffff", fontSize: "13px" }}
                        >
                          <option value="">{lang === "si" ? "-- ලියාපදිංචි සාමාජිකයින්ගෙන් තෝරා එක් කරන්න --" : "-- Select Registered Member to Add --"}</option>
                          {officers
                            .filter((off) => {
                              const pos = (off.position || off.officerRole || "").toLowerCase();
                              return pos === "member";
                            })
                            .filter((off) => !isOfficerConnectedToCaseInstitute(off, getCaseInstitutes()))
                            .filter((o) => !selectedChairman || (selectedChairman.id !== o.id && selectedChairman.fullName !== o.fullName))
                            .filter((o) => !selectedMembers.some((m) => m.id === o.id || m.fullName === o.fullName))
                            .map((off) => (
                              <option key={off.id} value={off.id}>
                                + {off.fullName} {off.employeeNo ? `[${off.employeeNo}]` : ""} {off.nicNo ? `- NIC: ${off.nicNo}` : ""}
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Manual Name Input for non-registered members */}
                      <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                        <input
                          type="text"
                          placeholder={lang === "si" ? "නැතහොත් වෙනත් සාමාජිකයෙකුගේ නම ඇතුළත් කරන්න..." : "Or type custom member full name..."}
                          value={customMemberInput}
                          onChange={(e) => setCustomMemberInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomMember(); } }}
                          style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomMember}
                          style={{ padding: "8px 14px", backgroundColor: "#4f46e5", color: "#ffffff", border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                        >
                          <Plus size={14} />
                          <span>{lang === "si" ? "එක් කරන්න" : "Add Member"}</span>
                        </button>
                      </div>

                      {/* Members Cards List */}
                      {selectedMembers.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {selectedMembers.map((member, idx) => (
                            <div
                              key={member.id || idx}
                              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#ffffff", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#e0e7ff", color: "#3730a3", width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  #{idx + 1}
                                </span>
                                <div>
                                  <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px", display: "block" }}>
                                    {member.fullName || member.name}
                                  </span>
                                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                                    Member {member.nicNo || member.nic ? `• NIC: ${member.nicNo || member.nic}` : ""}
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(idx)}
                                style={{ color: "#ef4444", backgroundColor: "#fef2f2", border: "1px solid #fca5a5", padding: "4px 8px", borderRadius: "6px", cursor: "pointer" }}
                                title="Remove Member"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ padding: "12px", textAlign: "center", color: "#94a3b8", fontSize: "12px", backgroundColor: "#ffffff", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
                          {lang === "si" ? "තවමත් සාමාජිකයින් තෝරා නොමැත. ඉහත ලැයිස්තුවෙන් හෝ නම ඇතුළත් කර එක් කරන්න." : "No committee members added yet. Select from the dropdown or type a name above."}
                        </div>
                      )}
                    </div>



                    {/* Action Button: Send Investigation Committee Assignment details to Subject Officer */}
                      <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          onClick={handleSendCommitteeToSubjectOfficer}
                          disabled={isSaving}
                          style={{
                            padding: "10px 20px",
                            backgroundColor: "#2563eb",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "8px",
                            fontWeight: 600,
                            fontSize: "13px",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            boxShadow: "0 2px 4px rgba(37,99,235,0.25)",
                            transition: "all 0.15s ease"
                          }}
                        >
                          <Send size={16} />
                          <span>
                            {lang === "si"
                              ? "විමර්ශන කමිටු පත්වීම් තොරතුරු අදාළ විෂය නිලධාරියා වෙත යවන්න"
                              : "Send Committee Assignment Details to Subject Officer"}
                          </span>
                        </button>
                      </div>

                    </div>
                  </div>

                {/* Step 2: Appointment Letter Date & Report Due Date (From Subject Officer) Card */}
                <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #cbd5e1", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                    <h4 style={{ margin: 0, fontSize: "15px", color: "#1e293b", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                      <CalendarIcon size={18} style={{ color: "#0284c7" }} />
                      <span>{lang === "si" ? "පත්වීම් ලිපියේ දිනය සහ වාර්තා දිනය (විෂය නිලධාරී වෙතින්)" : "Step 2: Appointment Letter Date & Report Due Date (Assigned by Subject Officer)"}</span>
                    </h4>
                    <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: (existingAssignment?.datesSubmittedBySubject || (step2ApptDate && step2DueDate)) ? "#dcfce7" : "#fef3c7", color: (existingAssignment?.datesSubmittedBySubject || (step2ApptDate && step2DueDate)) ? "#15803d" : "#b45309", padding: "4px 10px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                      {(existingAssignment?.datesSubmittedBySubject || (step2ApptDate && step2DueDate)) ? (
                        <>
                          <CheckCircle size={13} />
                          {lang === "si" ? "විෂය නිලධාරී විසින් සපයන ලදී" : "Assigned by Subject Officer"}
                        </>
                      ) : (
                        <>
                          <Clock size={13} />
                          {lang === "si" ? "විෂය නිලධාරී වෙතින් බලපොරොත්තු වේ" : "Awaiting Subject Officer Assignment"}
                        </>
                      )}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", backgroundColor: "#f0f9ff", padding: "16px", borderRadius: "10px", border: "1px solid #bae6fd" }}>
                    <div style={{ backgroundColor: "#ffffff", padding: "12px 14px", borderRadius: "8px", border: "1px solid #bae6fd" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                        <CalendarIcon size={14} />
                        {lang === "si" ? "පත්වීම් ලිපියේ දිනය" : "Appointment Letter Date"}
                      </div>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: (step2ApptDate || existingAssignment?.appointmentDate) ? "#0284c7" : "#94a3b8" }}>
                        {step2ApptDate || existingAssignment?.appointmentDate || (lang === "si" ? "තවමත් විෂය නිලධාරී විසින් ඇතුළත් කර නැත" : "Not assigned yet by Subject Officer")}
                      </div>
                    </div>

                    <div style={{ backgroundColor: "#ffffff", padding: "12px 14px", borderRadius: "8px", border: "1px solid #fca5a5" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#b91c1c", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                        <Clock size={14} />
                        {lang === "si" ? "වාර්තාව ලබාදිය යුතු දිනය" : "Report Due Date"}
                      </div>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: (step2DueDate || existingAssignment?.reportDueDate) ? "#dc2626" : "#94a3b8" }}>
                        {step2DueDate || existingAssignment?.reportDueDate || (lang === "si" ? "තවමත් විෂය නිලධාරී විසින් ඇතුළත් කර නැත" : "Not assigned yet by Subject Officer")}
                      </div>
                    </div>
                  </div>

                  {/* ── Extension of Days Subsection (Directly inside Step 2 card under appointment/due dates) ── */}
                  <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px dashed #cbd5e1" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <label style={{ fontSize: "13px", fontWeight: 700, color: "#92400e", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Clock size={16} style={{ color: "#d97706" }} />
                        <span>{lang === "si" ? "දිනයන් දීර්ඝ කිරීමේ කොටස (අනුමැතිය සඳහා යවන ලදී - උපරිමය 3 වාරයකි):" : "Extension of Days Request (Sent for Approval - Max 3 Terms):"}</span>
                      </label>

                      {/* Status Badge */}
                      {existingAssignment?.extensionApprovalStatus === "Approved" ? (
                        <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#dcfce7", color: "#15803d", padding: "3px 10px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <CheckCircle size={13} />
                          {lang === "si" ? `අදාළ බලධාරියා අනුමත කළා (${existingAssignment?.extensionDecisionDate || ""})` : `Approved by Relevant Authority (${existingAssignment?.extensionDecisionDate || ""})`}
                        </span>
                      ) : existingAssignment?.extensionApprovalStatus === "Disapproved" ? (
                        <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#fee2e2", color: "#b91c1c", padding: "3px 10px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <X size={13} />
                          {lang === "si" ? `අදාළ බලධාරියා ප්‍රතික්ෂේප කළා (${existingAssignment?.extensionDecisionDate || ""})` : `Disapproved by Relevant Authority (${existingAssignment?.extensionDecisionDate || ""})`}
                        </span>
                      ) : (existingAssignment?.extensionStartDate || step3StartDate) ? (
                        <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#fef3c7", color: "#b45309", padding: "3px 10px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Clock size={13} />
                          {lang === "si" ? "අනුමැතිය අපේක්ෂාවෙන්" : "Awaiting Approval"}
                        </span>
                      ) : (
                        <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#f1f5f9", color: "#64748b", padding: "3px 10px", borderRadius: "12px" }}>
                          {lang === "si" ? "දිනයන් දීර්ඝ කිරීමක් නැත" : "No Extension Requested"}
                        </span>
                      )}
                    </div>

                    <div style={{ backgroundColor: "#fffbeb", padding: "16px", borderRadius: "10px", border: "1px solid #fde68a", display: "flex", flexDirection: "column", gap: "14px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
                        
                        {/* Extension Term Select */}
                        <div>
                          <label htmlFor="step3TermSelect" style={{ fontSize: "12px", fontWeight: 700, color: "#92400e", display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                            <Clock size={14} /> {lang === "si" ? "දීර්ඝ කිරීමේ වාරය (Extension Term):" : "Extension Term:"}
                          </label>
                          <select
                            id="step3TermSelect"
                            value={step3Term}
                            onChange={(e) => setStep3Term(e.target.value as any)}
                            style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #fde047", fontSize: "13px", fontWeight: 700, color: "#78350f", backgroundColor: "#ffffff" }}
                          >
                            <option value="First">{lang === "si" ? "පළමු දීර්ඝ කිරීම (First Extension)" : "First Extension (1st)"}</option>
                            <option value="Second">{lang === "si" ? "දෙවන දීර්ඝ කිරීම (Second Extension)" : "Second Extension (2nd)"}</option>
                            <option value="Third">{lang === "si" ? "තෙවන දීර්ඝ කිරීම (3rd — උපරිමය)" : "Third Extension (3rd) — Maximum"}</option>
                            
                          </select>
                        </div>

                        {/* Extension Start Date */}
                        <div>
                          <label htmlFor="step3StartDateInput" style={{ fontSize: "12px", fontWeight: 700, color: "#92400e", display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                            <CalendarIcon size={14} /> {lang === "si" ? "ආරම්භක දිනය (Extension Start Date):" : "Extension Start Date:"}
                          </label>
                          <input
                            id="step3StartDateInput"
                            type="date"
                            value={step3StartDate}
                            onChange={(e) => setStep3StartDate(e.target.value)}
                            style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #fde047", fontSize: "14px", fontWeight: 700, color: "#78350f", backgroundColor: "#ffffff" }}
                          />
                        </div>

                        {/* Extension End Date */}
                        <div>
                          <label htmlFor="step3EndDateInput" style={{ fontSize: "12px", fontWeight: 700, color: "#92400e", display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                            <CalendarIcon size={14} /> {lang === "si" ? "අවසාන දිනය (Extension End Date):" : "Extension End Date:"}
                          </label>
                          <input
                            id="step3EndDateInput"
                            type="date"
                            value={step3EndDate}
                            onChange={(e) => setStep3EndDate(e.target.value)}
                            style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #fde047", fontSize: "14px", fontWeight: 700, color: "#78350f", backgroundColor: "#ffffff" }}
                          />
                        </div>

                      </div>

                      {/* Send Extension Request to Subject Officer Button */}
                      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={handleStep3RequestExtension}
                          disabled={isSaving}
                          style={{
                            padding: "10px 18px",
                            backgroundColor: "#d97706",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "8px",
                            fontWeight: 600,
                            fontSize: "13px",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            boxShadow: "0 2px 4px rgba(217,119,6,0.25)"
                          }}
                        >
                          <Send size={15} />
                          <span>{lang === "si" ? "දිනයන් දීර්ඝ කිරීමේ ඉල්ලීම විෂය නිලධාරියා වෙත යවන්න" : "Send Extension Request to Subject Officer"}</span>
                        </button>
                      </div>

                      {/* ── Subject Officer Decision: Read-only status display for Investigation Admin ── */}
                      {(step3StartDate || step3EndDate || existingAssignment?.extensionStartDate || existingAssignment?.extensionRequestedByAdmin) && existingAssignment?.extensionApprovalStatus && (
                        <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #fde68a" }}>
                          {existingAssignment?.extensionApprovalStatus === "Approved" ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#f0fdf4", padding: "12px 16px", borderRadius: "10px", border: "1px solid #86efac" }}>
                              <CheckCircle size={20} style={{ color: "#16a34a", flexShrink: 0 }} />
                              <div>
                                <div style={{ fontWeight: 700, color: "#15803d", fontSize: "13px" }}>{lang === "si" ? "විෂය නිලධාරියා විසින් අනුමත කරන ලදී" : "Extension Approved by Subject Officer"}</div>
                                <div style={{ fontSize: "12px", color: "#166534" }}>{lang === "si" ? `නව වාර්තා දිනය: ${step3EndDate || existingAssignment?.extensionEndDate || ""}` : `Decision Date: ${existingAssignment?.extensionDecisionDate || ""} | New Due Date: ${step3EndDate || existingAssignment?.extensionEndDate || ""}`}</div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#fef2f2", padding: "12px 16px", borderRadius: "10px", border: "1px solid #fca5a5" }}>
                              <X size={20} style={{ color: "#dc2626", flexShrink: 0 }} />
                              <div>
                                <div style={{ fontWeight: 700, color: "#b91c1c", fontSize: "13px" }}>{lang === "si" ? "විෂය නිලධාරියා විසින් ප්‍රතික්ෂේප කරන ලදී" : "Extension Disapproved by Subject Officer"}</div>
                                <div style={{ fontSize: "12px", color: "#991b1b" }}>{lang === "si" ? `ප්‍රතිඵල දිනය: ${existingAssignment?.extensionDecisionDate || ""}` : `Decision Date: ${existingAssignment?.extensionDecisionDate || ""}`}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  </div>
                </div>

                </div>
              </div>

          </section>

          <SiteFooter />
        </main>
      </div>

      {/* Success Toast */}
      {toastMessage && (
        <div style={{ position: "fixed", bottom: "24px", right: "24px", backgroundColor: "#0f172a", color: "#ffffff", padding: "12px 20px", borderRadius: "10px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: 600, zIndex: 9999 }}>
          <div style={{ width: "22px", height: "22px", borderRadius: "50%", backgroundColor: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckCircle size={14} color="#fff" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}

export default function InvestigationCaseDetailsPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center" }}>Loading page...</div>}>
      <InvestigationCaseDetailsContent />
    </Suspense>
  );
}