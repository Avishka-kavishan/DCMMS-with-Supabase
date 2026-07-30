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
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getCurrentProfile, signOut } from "@/lib/auth";
import { 
  Shield, User, Calendar as CalendarIcon, FileCheck, Send, Clock, 
  CheckCircle, ArrowLeft, RefreshCw, AlertCircle, Award, Building, 
  MapPin, CreditCard, UserPlus, CheckSquare, FileText, Info, X
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

  // Step 1: Assign Officers to Subject Officer (1 Chairman + Many Members)
  const [step1AssignedOfficers, setStep1AssignedOfficers] = useState("");
  const [selectedChairman, setSelectedChairman] = useState<any | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<any[]>([]);
  const [memberSelectId, setMemberSelectId] = useState("");
  
  // Step 2: Check / Set Appointment Date & Report Due Date
  const [step2ApptDate, setStep2ApptDate] = useState("");
  const [step2DueDate, setStep2DueDate] = useState("");

  // Step 3: Extension of Dates (Start & End Date, Term: First, Second, Third)
  const [step3Term, setStep3Term] = useState<"First" | "Second" | "Third">("First");
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

      // Load registered officers strictly from the Investigation Officer Registration Form storage
      let fetchedOfficers: any[] = [];
      if (typeof window !== "undefined") {
        const storedInv = localStorage.getItem("dcmms_investigation_officers");
        if (storedInv) {
          try {
            const list = JSON.parse(storedInv);
            if (Array.isArray(list)) fetchedOfficers.push(...list);
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
                    fullName: item.fullName,
                    nicNo: item.nicNo,
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
          const { data: dbInv } = await supabase.from("dcmms_investigation_officers").select("*");
          if (dbInv && dbInv.length > 0) {
            dbInv.forEach((p: any) => {
              const mapped = {
                id: p.id,
                fullName: p.full_name || p.fullName,
                nicNo: p.nic_no || p.nicNo,
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
      setExistingAssignment(assignment);
      if (assignment) {
        if (assignment.assignedOfficers) setStep1AssignedOfficers(assignment.assignedOfficers);
        if (assignment.appointmentDate) setStep2ApptDate(assignment.appointmentDate);
        if (assignment.reportDueDate) setStep2DueDate(assignment.reportDueDate);
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

      setIsLoading(false);
    };

    loadDetails();
  }, [caseNoParam]);

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
      
      const idx = list.findIndex((a) => a.caseNo === caseNoParam);
      const existing = idx >= 0 ? list[idx] : {};
      
      const updated = {
        id: assignmentExistingId(),
        caseNo: caseNoParam,
        subjectOfficerName: updatedFields.subjectOfficerName || existing.subjectOfficerName || assignee || "Subject Officer",
        status: status,
        updatedAt: new Date().toISOString(),
        ...existing,
        ...updatedFields,
      };

      if (idx >= 0) list[idx] = updated;
      else list.push(updated);

      localStorage.setItem("dcmms_subject_assignments", JSON.stringify(list));
      setExistingAssignment(updated);

      if (isSupabaseConfigured) {
        try {
          await supabase.from("dcmms_subject_assignments").upsert({
            id: updated.id,
            case_no: updated.caseNo,
            subject_officer_name: updated.subjectOfficerName,
            status: updated.status,
            assigned_officers: updated.assignedOfficers || null,
            appointment_date: updated.appointmentDate || null,
            report_due_date: updated.reportDueDate || null,
            extension_term: updated.extensionTerm || null,
            extension_start_date: updated.extensionStartDate || null,
            extension_end_date: updated.extensionEndDate || null,
            extension_approval_status: updated.extensionApprovalStatus || null,
            extension_decision_date: updated.extensionDecisionDate || null,
            certification_submitted: updated.certificationSubmitted || false,
            report_submit_date: updated.reportSubmitDate || null,
            report_content: updated.reportContent || null,
            after_investigation_sent: updated.afterInvestigationSent || false,
            after_investigation_date: updated.afterInvestigationDate || null,
            investigation_file_no: updated.investigationFileNo || null,
            investigation_status: updated.investigationStatus || null,
            investigation_notes: updated.investigationNotes || null,
            progress_details: updated.progressDetails || null,
          });
        } catch (e) {}
      }
    }
  };

  const assignmentExistingId = () => existingAssignment?.id || `asgn-${Date.now()}`;

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

  // Step 3: Admin Sends Extension Request
  const handleStep3RequestExtension = async () => {
    if (!step3StartDate || !step3EndDate) {
      alert("Please select both Extension Start Date and End Date.");
      return;
    }
    await saveSubjectAssignment({
      extensionTerm: step3Term,
      extensionStartDate: step3StartDate,
      extensionEndDate: step3EndDate,
      certificationSubmitted: false,
      status: "Extension Requested",
    });
    showToast(lang === "si" ? `Step 3: දීර්ඝ කිරීමේ ඉල්ලීම (${step3Term} වාරය) විෂය නිලධාරී වෙත යවන ලදී!` : `Step 3: Extension Request (${step3Term} Term) sent to Subject Officer!`);
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

              <form onSubmit={handleSaveForm} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>

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

                    {/* Target / Due Date */}
                    <div style={{ backgroundColor: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "block" }}>
                        {lang === "si" ? "වාර්තා භාරදිය යුතු දිනය" : "Report Due Date"}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#dc2626" }}>
                        {existingAssignment?.reportDueDate || selectedCase?.targetDate || "2026-06-05"}
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

                {/* Accused Officer Personal Record Details */}
                <div style={{ backgroundColor: "#ffffff", padding: "18px", borderRadius: "12px", border: "1px solid #cbd5e1" }}>
                  <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#1e1b4b", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                    <User size={16} style={{ color: "#4f46e5" }} />
                    <span>{lang === "si" ? "චෝදනා ලැබූ නිලධාරියාගේ තොරතුරු" : "Accused Officer Personal Record"}</span>
                  </h4>

                  {concernedOfficersList.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {concernedOfficersList.map((officer, idx) => (
                        <div key={idx} style={{ backgroundColor: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                            <div>
                              <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>{lang === "si" ? "නිලධාරියාගේ නම" : "Officer Name"}</span>
                              <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{officer.officer_name || officer.officerName || officer.name || "—"}</span>
                            </div>
                            <div>
                              <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>{lang === "si" ? "ජාතික හැඳුනුම්පත් අංකය" : "NIC Number"}</span>
                              <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{officer.nic || "—"}</span>
                            </div>
                            <div>
                              <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>{lang === "si" ? "තනතුර" : "Designation"}</span>
                              <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{officer.position || officer.designation || "—"}</span>
                            </div>
                            <div>
                              <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>{lang === "si" ? "පාසල / ආයතනය" : "School / Institute"}</span>
                              <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>{officer.institute_name || officer.instituteName || officer.schoolName || "—"}</span>
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
                          : "No specific accused officer personal record registered for this inquiry yet."}
                      </span>
                    </div>
                  )}
                </div>

                {/* ====================================================
                   INVESTIGATION DATA FLOW — STEP TIMELINE
                   Investigation Admin ↔ Subject Officer
                ==================================================== */}
                <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
                  
                  {/* Section Header */}
                  <div style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <Send size={20} style={{ color: "#a5b4fc" }} />
                      <div>
                        <div style={{ color: "#ffffff", fontWeight: 700, fontSize: "15px" }}>
                          {lang === "si" ? "විමර්ශන ආයතන ↔ විෂය නිලධාරී — දත්ත ප්‍රවාහය" : "Investigation Administrator ↔ Subject Officer — Data Flow"}
                        </div>
                        <div style={{ color: "#a5b4fc", fontSize: "12px", marginTop: "2px" }}>
                          {lang === "si" ? "විමර්ශන නිලධාරීන් පත් කිරීමේ සිට වාර්තාව ලැබෙන තෙක්" : "From assigning investigation officers to final report receipt"}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "4px 12px", borderRadius: "20px", backgroundColor: existingAssignment?.afterInvestigationSent ? "#22c55e" : existingAssignment?.datesSubmittedBySubject ? "#3b82f6" : existingAssignment?.assignedOfficers ? "#f59e0b" : "#6b7280", color: "#ffffff" }}>
                      {existingAssignment?.afterInvestigationSent ? "✓ Step 5 Complete" : existingAssignment?.datesSubmittedBySubject ? "● Step 3/4 Active" : existingAssignment?.assignedOfficers ? "● Step 2 Awaiting" : "● Step 1 Active"}
                    </span>
                  </div>

                  <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "0px" }}>

                    {/* ── STEP 1 ── Assign Officers → Send to Subject Officer */}
                    <div style={{ display: "flex", gap: "16px", position: "relative" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "40px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: existingAssignment?.assignedOfficers ? "#4f46e5" : "#4f46e5", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "14px", flexShrink: 0, boxShadow: "0 2px 8px rgba(79,70,229,0.4)" }}>1</div>
                        <div style={{ width: "2px", flex: 1, minHeight: "20px", backgroundColor: existingAssignment?.datesSubmittedBySubject ? "#4f46e5" : "#e2e8f0", marginTop: "4px", marginBottom: "4px" }} />
                      </div>
                      <div style={{ flex: 1, marginBottom: "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: "14px", color: "#1e1b4b" }}>
                              {lang === "si" ? "1. විමර්ශන නිලධාරීන් පත් කිරීම" : "Step 1: Assign Investigation Officers"}
                            </span>
                            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                              {lang === "si" ? "Admin → සභාපති + සාමාජිකයින් තෝරා, විෂය නිලධාරී වෙත යවයි" : "Admin selects 1 Chairman + Members → Submits to Subject Officer"}
                            </div>
                          </div>
                          {existingAssignment?.assignedOfficers ? (
                            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", backgroundColor: "#dbeafe", color: "#1d4ed8", whiteSpace: "nowrap" }}>✓ Sent</span>
                          ) : (
                            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", backgroundColor: "#fef3c7", color: "#b45309", whiteSpace: "nowrap" }}>Action Required</span>
                          )}
                        </div>

                        <div style={{ backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                          
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <Link
                              href="/investigation/officer-registration"
                              style={{ fontSize: "12px", color: "#4f46e5", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px", backgroundColor: "#ede9fe", padding: "4px 10px", borderRadius: "8px", textDecoration: "none" }}
                            >
                              <UserPlus size={12} />
                              <span>{lang === "si" ? "+ නිලධාරියා ලියාපදිංචි කිරීම" : "+ Register New Officer"}</span>
                            </Link>
                          </div>

                          {/* SELECT CHAIRMAN */}
                          <div style={{ backgroundColor: "#ffffff", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                            <label style={{ fontSize: "12px", fontWeight: 700, color: "#92400e", display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                              <Award size={14} style={{ color: "#d97706" }} />
                              <span>{lang === "si" ? "සභාපති (Chairman) — 1 දෙනෙක් පමණ:" : "Select Committee Chairman (exactly 1):"}</span>
                            </label>
                            <select
                              value={selectedChairman?.id || ""}
                              onChange={(e) => {
                                const found = officers.find((o) => o.id === e.target.value);
                                setSelectedChairman(found || null);
                              }}
                              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #d97706", fontSize: "13px", backgroundColor: "#fffbeb", fontWeight: 600 }}
                            >
                              <option value="">-- {lang === "si" ? "සභාපති තෝරන්න" : "Choose Chairman"} --</option>
                              {officers.map((o) => (
                                <option key={o.id} value={o.id}>
                                  [{o.officerRole || "Officer"}] {o.fullName} (NIC: {o.nicNo || "N/A"})
                                </option>
                              ))}
                            </select>
                            {selectedChairman && (
                              <div style={{ marginTop: "8px", padding: "10px 12px", borderRadius: "8px", backgroundColor: "#fef3c7", border: "1px solid #fde68a", fontSize: "12px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span style={{ fontWeight: 700, color: "#78350f" }}>👤 {selectedChairman.fullName}</span>
                                  <span style={{ fontSize: "11px", backgroundColor: "#fbbf24", color: "#1c1917", padding: "2px 8px", borderRadius: "10px", fontWeight: 700 }}>Chairman</span>
                                </div>
                                {selectedChairman.studiedSchools?.length > 0 && (
                                  <div style={{ marginTop: "4px", color: "#92400e" }}>
                                    🎓 {lang === "si" ? "ඉගෙනුම ලත් පාසල්:" : "Studied:"} {selectedChairman.studiedSchools.join(", ")}
                                  </div>
                                )}
                                {selectedChairman.childrenSchools?.length > 0 && (
                                  <div style={{ color: "#92400e" }}>
                                    🏫 {lang === "si" ? "දරුවන්ගේ පාසල්:" : "Children's schools:"} {selectedChairman.childrenSchools.join(", ")}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* SELECT MEMBERS */}
                          <div style={{ backgroundColor: "#ffffff", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                            <label style={{ fontSize: "12px", fontWeight: 700, color: "#3730a3", display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                              <User size={14} style={{ color: "#4f46e5" }} />
                              <span>{lang === "si" ? "සාමාජිකයින් (Members) — කිහිප දෙනෙකු:" : "Select Committee Members (add multiple):"}</span>
                            </label>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <select
                                value={memberSelectId}
                                onChange={(e) => setMemberSelectId(e.target.value)}
                                style={{ flex: 1, padding: "9px 12px", borderRadius: "8px", border: "1px solid #c7d2fe", fontSize: "13px", backgroundColor: "#eef2ff" }}
                              >
                                <option value="">-- {lang === "si" ? "සාමාජිකයෙකු තෝරන්න" : "Choose Member to Add"} --</option>
                                {officers
                                  .filter((o) => o.id !== selectedChairman?.id && !selectedMembers.some((m) => m.id === o.id))
                                  .map((o) => (
                                    <option key={o.id} value={o.id}>
                                      [{o.officerRole || "Member"}] {o.fullName} (NIC: {o.nicNo || "N/A"})
                                    </option>
                                  ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  if (memberSelectId) {
                                    const found = officers.find((o) => o.id === memberSelectId);
                                    if (found) { setSelectedMembers((prev) => [...prev, found]); setMemberSelectId(""); }
                                  }
                                }}
                                style={{ padding: "9px 16px", backgroundColor: "#4f46e5", color: "#ffffff", border: "none", borderRadius: "8px", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
                              >
                                + {lang === "si" ? "එකතු කරන්න" : "Add"}
                              </button>
                            </div>
                            {selectedMembers.length > 0 && (
                              <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                                {selectedMembers.map((mem, idx) => (
                                  <div key={mem.id || idx} style={{ padding: "8px 12px", borderRadius: "8px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
                                    <div>
                                      <span style={{ fontWeight: 700, color: "#166534" }}>👤 {mem.fullName}</span>
                                      <span style={{ marginLeft: "6px", fontSize: "10px", backgroundColor: "#dcfce7", color: "#15803d", padding: "1px 6px", borderRadius: "10px", fontWeight: 700 }}>Member #{idx + 1}</span>
                                      {mem.studiedSchools?.length > 0 && <div style={{ color: "#0369a1", marginTop: "2px" }}>🎓 {mem.studiedSchools.join(", ")}</div>}
                                    </div>
                                    <button type="button" onClick={() => setSelectedMembers((prev) => prev.filter((m) => m.id !== mem.id))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }} title="Remove">
                                      <X size={16} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Step 1 Submit Button + Status */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", paddingTop: "8px" }}>
                            <button
                              type="button"
                              onClick={handleStep1SubmitOfficers}
                              style={{ padding: "11px 22px", background: "linear-gradient(135deg, #4f46e5, #6366f1)", color: "#ffffff", border: "none", borderRadius: "10px", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 12px rgba(79,70,229,0.3)" }}
                            >
                              <Send size={15} />
                              {lang === "si" ? "විෂය නිලධාරී වෙත යවන්න" : "Submit to Subject Officer"}
                            </button>
                            {existingAssignment?.assignedOfficers && (
                              <div style={{ fontSize: "12px", color: "#1d4ed8", fontWeight: 600, backgroundColor: "#dbeafe", padding: "8px 14px", borderRadius: "8px", maxWidth: "450px" }}>
                                ✓ {lang === "si" 
                                    ? `පවරන ලද විෂය භාර නිලධාරී${getDisplaySubjectOfficerName() && !getDisplaySubjectOfficerName().toLowerCase().includes("kumara") && getDisplaySubjectOfficerName() !== "පවරන ලද විෂය භාර නිලධාරී" && getDisplaySubjectOfficerName() !== "Assigned Subject Officer" ? ` (${getDisplaySubjectOfficerName()})` : ""} වෙත යවා ඇත: ` 
                                    : `Sent to Subject Officer${getDisplaySubjectOfficerName() && !getDisplaySubjectOfficerName().toLowerCase().includes("kumara") && getDisplaySubjectOfficerName() !== "පවරන ලද විෂය භාර නිලධාරී" && getDisplaySubjectOfficerName() !== "Assigned Subject Officer" ? ` (${getDisplaySubjectOfficerName()})` : ""}: `
                                  } {existingAssignment.assignedOfficers}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "16px", position: "relative" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "40px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: (step2ApptDate && step2DueDate) ? "#0284c7" : "#cbd5e1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "14px", flexShrink: 0 }}>2</div>
                        <div style={{ width: "2px", flex: 1, minHeight: "20px", backgroundColor: (step2ApptDate && step2DueDate) ? "#0284c7" : "#e2e8f0", marginTop: "4px", marginBottom: "4px" }} />
                      </div>
                      <div style={{ flex: 1, marginBottom: "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: "14px", color: (step2ApptDate && step2DueDate) ? "#0369a1" : "#1e293b" }}>
                              {lang === "si" ? "2. පත්වීම් ලිපිය සහ වාර්තා දිනය පරීක්ෂා කිරීම / තහවුරු කිරීම" : "Step 2: Check & Confirm Appointment Date & Report Due Date"}
                            </span>
                            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                              {lang === "si" ? "Subject Officer ගෙන් ලැබූ දිනයන් පරීක්ෂා කර තහවුරු කරන්න හෝ ඇතුළත් කරන්න" : "Verify dates received from Subject Officer or enter dates to confirm"}
                            </div>
                          </div>
                          {(existingAssignment?.datesSubmittedBySubject || (step2ApptDate && step2DueDate)) ? (
                            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", backgroundColor: "#dbeafe", color: "#1d4ed8", whiteSpace: "nowrap" }}>✓ Dates Set</span>
                          ) : (
                            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", backgroundColor: "#fef3c7", color: "#b45309", whiteSpace: "nowrap" }}>⏳ Action Required</span>
                          )}
                        </div>
                        <div style={{ backgroundColor: "#f0f9ff", borderRadius: "12px", border: "1px solid #bae6fd", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                            <div>
                              <label style={{ fontSize: "11px", fontWeight: 700, color: "#0369a1", display: "block", marginBottom: "4px" }}>
                                📅 {lang === "si" ? "පත්වීම් ලිපිය දිනය (Appointment Date):" : "Appointment Letter Date:"}
                              </label>
                              <input
                                type="date"
                                value={step2ApptDate}
                                onChange={(e) => setStep2ApptDate(e.target.value)}
                                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #93c5fd", fontSize: "13px", backgroundColor: "#ffffff" }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: "11px", fontWeight: 700, color: "#dc2626", display: "block", marginBottom: "4px" }}>
                                ⏳ {lang === "si" ? "වාර්තාව ලැබිය යුතු දිනය (Report Due Date):" : "Report Must Be Received By:"}
                              </label>
                              <input
                                type="date"
                                value={step2DueDate}
                                onChange={(e) => setStep2DueDate(e.target.value)}
                                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #fca5a5", fontSize: "13px", backgroundColor: "#ffffff" }}
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleStep2SubmitDatesAdmin}
                            style={{ padding: "9px 18px", background: "linear-gradient(135deg, #0284c7, #2563eb)", color: "#ffffff", border: "none", borderRadius: "10px", fontWeight: 700, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", width: "fit-content", boxShadow: "0 2px 8px rgba(2,132,199,0.3)" }}
                          >
                            <Send size={13} />
                            {lang === "si" ? "Step 2: දිනයන් පරීක්ෂා කර තහවුරු කරන්න" : "Step 2: Confirm & Save Dates"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ── STEP 3 ── Extension Request */}
                    <div style={{ display: "flex", gap: "16px", position: "relative" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "40px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: existingAssignment?.extensionStartDate ? "#d97706" : "#cbd5e1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "14px", flexShrink: 0 }}>3</div>
                        <div style={{ width: "2px", flex: 1, minHeight: "20px", backgroundColor: existingAssignment?.extensionStartDate ? "#d97706" : "#e2e8f0", marginTop: "4px", marginBottom: "4px" }} />
                      </div>
                      <div style={{ flex: 1, marginBottom: "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: "14px", color: existingAssignment?.extensionStartDate ? "#b45309" : "#1e293b" }}>
                              {lang === "si" ? "3. දිනය දීර්ඝ කිරීමේ ඉල්ලීම (Extension Request)" : "Step 3: Extension Request"}
                            </span>
                            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                              {lang === "si" ? "Admin දීර්ඝ කිරීමේ වාරය, ආරම්භ/අවසාන දිනයන් ඇතුළත් කර යවයි" : "Admin selects extension term, start & end dates and updates request"}
                            </div>
                          </div>
                          {existingAssignment?.extensionApprovalStatus === "Approved" ? (
                            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", backgroundColor: "#dcfce7", color: "#15803d", whiteSpace: "nowrap" }}>✓ Approved</span>
                          ) : existingAssignment?.extensionApprovalStatus === "Disapproved" ? (
                            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", backgroundColor: "#fee2e2", color: "#b91c1c", whiteSpace: "nowrap" }}>✕ Disapproved</span>
                          ) : existingAssignment?.extensionStartDate ? (
                            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", backgroundColor: "#fef3c7", color: "#b45309", whiteSpace: "nowrap" }}>⏳ Extension Active</span>
                          ) : null}
                        </div>
                        <div style={{ backgroundColor: "#fffbeb", borderRadius: "12px", border: "1px solid #fde68a", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                            <div>
                              <label style={{ fontSize: "11px", fontWeight: 700, color: "#78350f", display: "block", marginBottom: "4px" }}>
                                {lang === "si" ? "දීර්ඝ කිරීමේ ගණන:" : "Extension Term:"}
                              </label>
                              <select
                                value={step3Term}
                                onChange={(e) => setStep3Term(e.target.value as any)}
                                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #fbbf24", fontSize: "12px", backgroundColor: "#ffffff", fontWeight: 600 }}
                              >
                                <option value="First">{lang === "si" ? "1 වන වතාවේ (1st Term)" : "1st Extension"}</option>
                                <option value="Second">{lang === "si" ? "2 වන වතාවේ (2nd Term)" : "2nd Extension"}</option>
                                <option value="Third">{lang === "si" ? "3 වන වතාවේ (3rd Term)" : "3rd Extension"}</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ fontSize: "11px", fontWeight: 700, color: "#78350f", display: "block", marginBottom: "4px" }}>
                                {lang === "si" ? "ආරම්භ දිනය:" : "Extension Start Date:"}
                              </label>
                              <input
                                type="date"
                                value={step3StartDate}
                                onChange={(e) => setStep3StartDate(e.target.value)}
                                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #fbbf24", fontSize: "12px", backgroundColor: "#ffffff" }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: "11px", fontWeight: 700, color: "#78350f", display: "block", marginBottom: "4px" }}>
                                {lang === "si" ? "අවසාන දිනය:" : "Extension End Date:"}
                              </label>
                              <input
                                type="date"
                                value={step3EndDate}
                                onChange={(e) => setStep3EndDate(e.target.value)}
                                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #fbbf24", fontSize: "12px", backgroundColor: "#ffffff" }}
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleStep3RequestExtension}
                            style={{ padding: "9px 18px", background: "linear-gradient(135deg, #d97706, #f59e0b)", color: "#ffffff", border: "none", borderRadius: "10px", fontWeight: 700, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", width: "fit-content", boxShadow: "0 2px 8px rgba(217,119,6,0.3)" }}
                          >
                            <Send size={13} />
                            {lang === "si" ? "Step 3: දීර්ඝ කිරීමේ ඉල්ලීම යවන්න" : "Step 3: Submit Extension Request"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ── STEP 4 ── Record Progress and Update Inquiry Details */}
                    <div style={{ display: "flex", gap: "16px", position: "relative" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "40px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: existingAssignment?.afterInvestigationSent ? "#16a34a" : "#cbd5e1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "14px", flexShrink: 0 }}>4</div>
                      </div>
                      <div style={{ flex: 1, marginBottom: "20px" }}>
                        <div style={{ fontWeight: 700, fontSize: "14px", color: existingAssignment?.afterInvestigationSent ? "#15803d" : "#1e293b", marginBottom: "10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span>{lang === "si" ? "4. ප්‍රගතිය සටහන් කිරීම සහ විස්තර යාවත්කාලීන කිරීම (Record Progress & Update Inquiry Details)" : "Step 4: Record Progress & Update Inquiry Details"}</span>
                          {existingAssignment?.afterInvestigationSent ? (
                            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", backgroundColor: "#dcfce7", color: "#15803d" }}>✓ Progress Recorded</span>
                          ) : (
                            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", backgroundColor: "#fef3c7", color: "#b45309" }}>⚡ Action Required</span>
                          )}
                        </div>
                        <div style={{ backgroundColor: "#f0fdf4", borderRadius: "12px", border: "1px solid #bbf7d0", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                          <div style={{ fontSize: "12px", color: "#166534", fontWeight: 600 }}>
                            📤 {lang === "si" ? "පහත ආකෘතියේ විමර්ශන ගොනු අංකය, තත්ත්වය සහ සටහන් ඇතුළත් කර යාවත්කාලීන කරන්න." : "Fill the Investigation File No., Status and Progress Notes below then click update."}
                          </div>
                          <button
                            type="button"
                            onClick={handleStep4RecordProgress}
                            style={{ padding: "10px 22px", background: "linear-gradient(135deg, #16a34a, #22c55e)", color: "#ffffff", border: "none", borderRadius: "10px", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", width: "fit-content", boxShadow: "0 4px 12px rgba(22,163,74,0.3)" }}
                          >
                            <Send size={15} />
                            {lang === "si" ? "Step 4: විමර්ශන ප්‍රගතිය සටහන් කර විස්තර යාවත්කාලීන කරන්න" : "Step 4: Record Progress & Update Inquiry Details"}
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Add/Update Investigation Progress Form Section */}
                <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #cbd5e1", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.03)" }}>
                  <h4 style={{ margin: "0 0 16px 0", fontSize: "16px", color: "#0f172a", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                    <FileCheck size={20} style={{ color: "#4f46e5" }} />
                    <span>{lang === "si" ? "විමර්ශන ප්‍රගතිය සහ පියවර ඇතුළත් කිරීම" : "Record Progress & Update Inquiry Details"}</span>
                  </h4>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "16px" }}>
                    {/* Investigation File Number (විමර්ශන ගොනු අංකය) */}
                    <div className="form-field-group">
                      <label htmlFor="invFileNo" className="field-label" style={{ fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: "6px" }}>
                        <FileText size={14} style={{ color: "#4f46e5" }} />
                        {lang === "si" ? "විමර්ශන ගොනු අංකය" : t("investigationFileNo", "Investigation File No.")}
                      </label>
                      <input
                        id="invFileNo"
                        type="text"
                        placeholder={lang === "si" ? "උදා: INV/FILE/2026/01" : "e.g. INV/FILE/2026/01"}
                        value={investigationFileNo}
                        onChange={(e) => setInvestigationFileNo(e.target.value)}
                        className="field-input"
                        style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", width: "100%" }}
                      />
                    </div>

                    {/* Investigation Status (විමර්ශන තත්ත්වය) */}
                    <div className="form-field-group">
                      <label htmlFor="invStatus" className="field-label" style={{ fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: "6px" }}>
                        <CheckSquare size={14} style={{ color: "#4f46e5" }} />
                        {lang === "si" ? "විමර්ශන තත්ත්වය" : "Investigation Status"}
                      </label>
                      <select
                        id="invStatus"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="field-select"
                        style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", width: "100%" }}
                      >
                        <option value="Scheduled">{lang === "si" ? "🗓️ නියමිතයි (Scheduled)" : "🗓️ Scheduled"}</option>
                        <option value="In Progress">{lang === "si" ? "⚡ සිදුවෙමින් පවතියි (In Progress)" : "⚡ In Progress"}</option>
                        <option value="Evidence Review">{lang === "si" ? "🔍 සාක්ෂි සමාලෝචනය (Evidence Review)" : "🔍 Evidence Review"}</option>
                        <option value="Preliminary Investigation">{lang === "si" ? "📋 මූලික විමර්ශනය (Preliminary Investigation)" : "📋 Preliminary Investigation"}</option>
                        <option value="Under Investigation">{lang === "si" ? "🕵️ විමර්ශනය යටතේ පවතියි (Under Investigation)" : "🕵️ Under Investigation"}</option>
                        <option value="Completed">{lang === "si" ? "✅ අවසන් කර ඇත (Completed)" : "✅ Completed"}</option>
                      </select>
                    </div>
                  </div>

                  {/* Quick Action Notes Tags */}
                  <div style={{ marginTop: "16px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#475569", display: "block", marginBottom: "6px" }}>
                      ⚡ {lang === "si" ? "ඉක්මන් ක්‍රියාමාර්ග සටහන්:" : "Quick Progress Notes:"}
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {[
                        lang === "si" ? "සාක්ෂිකරුවන්ගෙන් ප්‍රකාශ ලබා ගැනීම" : "Witness Statement Recorded",
                        lang === "si" ? "විභාග දිනය නියම කිරීම" : "Hearing Scheduled",
                        lang === "si" ? "සාක්ෂි සටහන් කිරීම" : "Evidence Recorded",
                        lang === "si" ? "අතරමැදි වාර්තාව" : "Interlocutory Report",
                        lang === "si" ? "අවසාන වාර්තාව" : "Final Report Complete",
                      ].map((tag, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setInquiryNotes((prev) => (prev ? `${prev}\n• ${tag}` : `• ${tag}`))}
                          style={{ padding: "4px 10px", borderRadius: "16px", backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1", fontSize: "12px", color: "#334155", cursor: "pointer", fontWeight: 500 }}
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes Textarea */}
                  <div style={{ marginTop: "16px" }}>
                    <label style={{ fontWeight: 600, color: "#334155", display: "block", fontSize: "13px", marginBottom: "4px" }}>
                      {lang === "si" ? "විමර්ශන සටහන් සහ ප්‍රගති විස්තර *" : "Investigation Notes & Progress Details *"}
                    </label>
                    <textarea
                      rows={5}
                      value={inquiryNotes}
                      onChange={(e) => setInquiryNotes(e.target.value)}
                      placeholder="Enter inquiry steps, hearing dates, witness notes, or report summaries..."
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", resize: "vertical", backgroundColor: "#ffffff" }}
                    />
                  </div>

                </div>

                {/* Bottom Action Footer */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "14px", paddingTop: "16px", borderTop: "1px solid #e2e8f0" }}>
                  <button
                    type="button"
                    onClick={() => router.push("/investigation")}
                    className="btn-cancel"
                    style={{ padding: "10px 24px", borderRadius: "8px", backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1", color: "#475569", fontWeight: 600, fontSize: "14px", cursor: "pointer" }}
                  >
                    {lang === "si" ? "අවලංගු කරන්න" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="btn-save"
                    style={{ padding: "10px 30px", borderRadius: "8px", backgroundColor: "#4f46e5", color: "#ffffff", border: "none", fontWeight: 600, fontSize: "14px", cursor: "pointer", boxShadow: "0 4px 6px -1px rgba(79,70,229,0.25)" }}
                  >
                    {isSaving ? (lang === "si" ? "සුරකිමින්..." : "Saving...") : (lang === "si" ? "තොරතුරු සුරකින්න" : "Save Progress Details")}
                  </button>
                </div>

              </form>

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