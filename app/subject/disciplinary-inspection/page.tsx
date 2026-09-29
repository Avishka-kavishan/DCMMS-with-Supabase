"use client";

import "@/i18n";
import "../../globals.css";
import "../../daily-mail/daily-mail.css";
import "../../dashboard-common.css";
import "../subject.css";
import "./disciplinary-inspection.css";
import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getCurrentProfile, signOut } from "@/lib/auth";
import {
  saveFormalDisciplinaryInspectionServer,
  getFormalDisciplinaryInspectionServer,
  getAvailableConductInquiryCasesServer,
  getCommitteeOfficersWithSchoolsServer,
  saveCaseByAppointmentAndReportDueDateServer,
  saveCaseByDateExtensionServer,
  saveChairmanByCaseServer,
  saveMembersByCaseServer,
  getRecommendationsListServer,
} from "@/lib/db-actions";
import {
  ArrowLeft,
  ShieldAlert,
  Calendar as CalendarIcon,
  Clock,
  Sparkles,
  FileText,
  User,
  Building,
  Plus,
  X,
  CheckCircle,
  AlertCircle,
  Menu,
  ChevronRight,
  Save,
  Scale,
  Award,
  Layers,
  HelpCircle,
  Phone,
  MapPin,
  Briefcase,
  Shield,
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

function DisciplinaryInspectionContent() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang = i18n.language || "si";

  const tr = (siText: string, taText: string, enText: string) => {
    if (lang === "ta") return taText;
    if (lang === "en") return enText;
    return siText;
  };

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

  // Form State strictly matching the Paper Sketch
  const [formState, setFormState] = useState<{
    caseNo: string;
    accusedName: string;
    accusedDesignation: string;
    schoolName: string;
    subject: string;
    stage: string;
    priority: string;

    // Section 2: Investigation committee details (matching user paper sketch)
    // 1. Officer conducting the investigation
    invOfficerName: string;
    invOfficerDesignation: string;
    invOfficerAppointmentDate: string;
    invOfficerTel: string;
    invOfficerAddress: string;

    // 2. Officer conducting the complaint
    complaintOfficerName: string;
    complaintOfficerDesignation: string;
    complaintOfficerAppointmentDate: string;
    complaintOfficerTel: string;
    complaintOfficerAddress: string;

    // 3. Officer conducting the maintenance
    maintenanceOfficerName: string;
    maintenanceOfficerDesignation: string;
    maintenanceOfficerAppointmentDate: string;
    maintenanceOfficerTel: string;
    maintenanceOfficerAddress: string;

    // Legacy fallback committee fields
    chairmanName: string;
    chairmanId: string;
    chairmanEmail: string;
    members: Array<{ name: string; idNo: string; email?: string }>;

    // Section 3: Appointment letter date & Report due date
    appointmentLetterDate: string;
    reportDueDate: string;
    // Section 4: Extension of days
    extensionTerm: string;
    extensionStartDate: string;
    extensionEndDate: string;
    // Section 5: Recommendation
    recommendation: string;
    // Section 6: Discipline command
    disciplineCommand: string;
    // Section 7: Approval of the secretary of education / Public service commission
    dateOfApproval: string;
    grantedApproval: string;
    otherDecision: string;

    // Handwritten sketch form fields:
    dateSubmissionReport: string;
    recommendationReport: string;
    dateSubmissionRecApproval: string;
    recommendationApproved: string;
    disciplinaryOrder: string;
    approvalSecretaryStatus: string;
    approvalSecretaryDetails: string;
    orderStartDate: string;
    orderEndDate: string;
    otherDecisions: string;
  }>({
    caseNo: "",
    accusedName: "—",
    accusedDesignation: "—",
    schoolName: "—",
    subject: "—",
    stage: "Formal Disciplinary Inspection",
    priority: "high",

    // Section 2: Investigation committee details
    invOfficerName: "",
    invOfficerDesignation: "",
    invOfficerAppointmentDate: "",
    invOfficerTel: "",
    invOfficerAddress: "",

    complaintOfficerName: "",
    complaintOfficerDesignation: "",
    complaintOfficerAppointmentDate: "",
    complaintOfficerTel: "",
    complaintOfficerAddress: "",

    maintenanceOfficerName: "",
    maintenanceOfficerDesignation: "",
    maintenanceOfficerAppointmentDate: "",
    maintenanceOfficerTel: "",
    maintenanceOfficerAddress: "",

    // Fallbacks
    chairmanName: "",
    chairmanId: "",
    chairmanEmail: "",
    members: [{ name: "", idNo: "", email: "" }],

    appointmentLetterDate: "",
    reportDueDate: "",
    extensionTerm: "None",
    extensionStartDate: "",
    extensionEndDate: "",
    recommendation: "",
    disciplineCommand: "",
    dateOfApproval: "",
    grantedApproval: "Getting approval",
    otherDecision: "",

    // Handwritten sketch form fields
    dateSubmissionReport: "",
    recommendationReport: "",
    dateSubmissionRecApproval: "",
    recommendationApproved: "",
    disciplinaryOrder: "",
    approvalSecretaryStatus: "",
    approvalSecretaryDetails: "",
    orderStartDate: "",
    orderEndDate: "",
    otherDecisions: "",
  });

  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4500);
  };

  // Registered Committee Officers for Autocomplete / Auto-fill
  const [committeeOfficers, setCommitteeOfficers] = useState<Array<{ id: string; fullName: string; email?: string; position?: string; nicNo?: string }>>([]);

  useEffect(() => {
    getCommitteeOfficersWithSchoolsServer().then(async (res) => {
      let list: any[] = [];
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        list = res.data.map((o: any) => ({
          id: o.id,
          fullName: o.full_name || o.fullName || "",
          email: o.email || "",
          nicNo: o.nic_no || o.nic || o.email || "",
          position: o.position || o.officer_role || "Officer",
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
              nicNo: o.nic_no || o.nic || o.email || "",
              position: o.position || o.officer_role || "Officer",
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
                nicNo: o.nic_no || o.nic || o.email || "",
                position: o.position || o.officer_role || "Officer",
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

  // Fetch Cases and Disciplinary Records
  useEffect(() => {
    const loadCasesData = async () => {
      const casesMap = new Map<string, any>();

      // 1. PostgreSQL Server Action: Fetch available inquiry cases
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
        console.warn("Error fetching available cases from DB:", e);
      }

      // 2. Fetch from recommendations for charge sheet and disciplinary info
      try {
        const recsRes = await getRecommendationsListServer();
        if (recsRes && recsRes.success && Array.isArray(recsRes.data)) {
          recsRes.data.forEach((r: any) => {
            const key = (r.caseNo || "").trim().toLowerCase();
            if (key) {
              const existing = casesMap.get(key) || {};
              casesMap.set(key, {
                ...existing,
                caseNo: r.caseNo,
                accusedName: r.accusedName || existing.accusedName || "",
                accusedDesignation: r.accusedDesignation || existing.accusedDesignation || "Educational Officer",
                schoolName: r.schoolName || existing.schoolName || "",
                subject: r.title || r.subject || existing.subject || `Disciplinary Case ${r.caseNo}`,
                stage: "Formal Disciplinary Inspection",
                priority: r.urgency || existing.priority || "high",
                recommendation: r.recommendationText || existing.recommendation || "",
                disciplineCommand: r.disciplinaryAction || r.disciplinaryOrder || existing.disciplineCommand || "",
                dateOfApproval: r.secretaryApprovalDate ? formatToInputDate(r.secretaryApprovalDate) : existing.dateOfApproval || "",
                otherDecision: r.secretaryApprovedRecommendation || existing.otherDecision || "",
              });
            }
          });
        }
      } catch (e) {}

      // 3. Supabase Realtime DB fallback
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
                  subject: c.subject || c.description || existing.subject || `Disciplinary Case ${key}`,
                  stage: "Formal Disciplinary Inspection",
                  priority: c.priority || "high",
                });
              }
            });
          }
        } catch (e) {}
      }

      // 4. LocalStorage Fallback & Merge
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
                    subject: c.subject || c.description || existing.subject || `Disciplinary Case ${key}`,
                    stage: "Formal Disciplinary Inspection",
                    priority: c.priority || "high",
                  });
                }
              });
            }
          }
        } catch (e) {}
      }

      // Ensure target case (paramCaseNo) is present in map
      if (paramCaseNo && !casesMap.has(paramCaseNo.trim().toLowerCase())) {
        casesMap.set(paramCaseNo.trim().toLowerCase(), {
          caseNo: paramCaseNo,
          letterNo: paramCaseNo,
          accusedName: "Concerned Officer",
          accusedDesignation: "Educational Officer",
          schoolName: "Government Educational Institute",
          subject: `Formal Disciplinary Proceeding ${paramCaseNo}`,
          stage: "Formal Disciplinary Inspection",
          priority: "high",
        });
      }

      const casesList = Array.from(casesMap.values());
      setAvailableCases(casesList);

      const targetCaseNo = paramCaseNo || (casesList.length > 0 ? casesList[0].caseNo : "");
      if (targetCaseNo) {
        setSelectedCaseNo(targetCaseNo);
        populateFormDataForCase(targetCaseNo, casesMap.get(targetCaseNo.trim().toLowerCase()) || {});
      }
    };

    loadCasesData();
  }, [paramCaseNo]);

  // Load Form Data for Specific Case
  const populateFormDataForCase = async (caseNo: string, baseCase: any) => {
    if (!caseNo) return;

    // 3 Investigation Committee Officers
    let invOfficerName = "";
    let invOfficerDesignation = "";
    let invOfficerAppointmentDate = "";
    let invOfficerTel = "";
    let invOfficerAddress = "";

    let complaintOfficerName = "";
    let complaintOfficerDesignation = "";
    let complaintOfficerAppointmentDate = "";
    let complaintOfficerTel = "";
    let complaintOfficerAddress = "";

    let maintenanceOfficerName = "";
    let maintenanceOfficerDesignation = "";
    let maintenanceOfficerAppointmentDate = "";
    let maintenanceOfficerTel = "";
    let maintenanceOfficerAddress = "";

    let chairmanName = "";
    let chairmanId = "";
    let chairmanEmail = "";
    let members: Array<{ name: string; idNo: string; email?: string }> = [{ name: "", idNo: "", email: "" }];
    let appointmentLetterDate = "";
    let reportDueDate = "";
    let extensionTerm = "None";
    let extensionStartDate = "";
    let extensionEndDate = "";
    let recommendation = "";
    let disciplineCommand = "";
    let dateOfApproval = "";
    let grantedApproval = "Getting approval";
    let otherDecision = "";

    // 10 fields from 2nd paper sketch:
    let dateSubmissionReport = "";
    let recommendationReport = "";
    let dateSubmissionRecApproval = "";
    let recommendationApproved = "";
    let disciplinaryOrder = "";
    let approvalSecretaryStatus = "";
    let approvalSecretaryDetails = "";
    let orderStartDate = "";
    let orderEndDate = "";
    let otherDecisions = "";

    // 1. Fetch from PostgreSQL Server Action
    try {
      const formalRes = await getFormalDisciplinaryInspectionServer(caseNo);
      if (formalRes && formalRes.success && formalRes.data) {
        const d = formalRes.data;
        // Officer conducting the investigation
        if (d.invOfficerName) invOfficerName = d.invOfficerName;
        if (d.invOfficerDesignation) invOfficerDesignation = d.invOfficerDesignation;
        if (d.invOfficerAppointmentDate) invOfficerAppointmentDate = formatToInputDate(d.invOfficerAppointmentDate);
        if (d.invOfficerTel) invOfficerTel = d.invOfficerTel;
        if (d.invOfficerAddress) invOfficerAddress = d.invOfficerAddress;

        // Officer conducting the complaint
        if (d.complaintOfficerName) complaintOfficerName = d.complaintOfficerName;
        if (d.complaintOfficerDesignation) complaintOfficerDesignation = d.complaintOfficerDesignation;
        if (d.complaintOfficerAppointmentDate) complaintOfficerAppointmentDate = formatToInputDate(d.complaintOfficerAppointmentDate);
        if (d.complaintOfficerTel) complaintOfficerTel = d.complaintOfficerTel;
        if (d.complaintOfficerAddress) complaintOfficerAddress = d.complaintOfficerAddress;

        // Officer conducting the maintenance
        if (d.maintenanceOfficerName) maintenanceOfficerName = d.maintenanceOfficerName;
        if (d.maintenanceOfficerDesignation) maintenanceOfficerDesignation = d.maintenanceOfficerDesignation;
        if (d.maintenanceOfficerAppointmentDate) maintenanceOfficerAppointmentDate = formatToInputDate(d.maintenanceOfficerAppointmentDate);
        if (d.maintenanceOfficerTel) maintenanceOfficerTel = d.maintenanceOfficerTel;
        if (d.maintenanceOfficerAddress) maintenanceOfficerAddress = d.maintenanceOfficerAddress;

        // Fallbacks from Chairman / Members if new fields empty
        if (d.chairman && (d.chairman.fullName || d.chairman.name)) {
          chairmanName = d.chairman.fullName || d.chairman.name;
          chairmanId = d.chairman.idNo || d.chairman.email || "";
          chairmanEmail = d.chairman.email || "";
          if (!invOfficerName) invOfficerName = chairmanName;
          if (!invOfficerDesignation && d.chairman.position) invOfficerDesignation = d.chairman.position;
          if (!invOfficerTel && chairmanEmail) invOfficerTel = chairmanEmail;
        }
        if (Array.isArray(d.members) && d.members.length > 0) {
          members = d.members.map((m: any) => ({
            name: m.name || m.fullName || "",
            idNo: m.idNo || m.email || "",
            email: m.email || "",
          }));
          if (!complaintOfficerName && members[0]?.name) {
            complaintOfficerName = members[0].name;
            complaintOfficerTel = members[0].email || members[0].idNo || "";
          }
          if (!maintenanceOfficerName && members.length > 1 && members[1]?.name) {
            maintenanceOfficerName = members[1].name;
            maintenanceOfficerTel = members[1].email || members[1].idNo || "";
          }
        }

        if (d.appointmentLetterDate) appointmentLetterDate = formatToInputDate(d.appointmentLetterDate);
        if (d.reportDueDate) reportDueDate = formatToInputDate(d.reportDueDate);
        if (d.extensionTerm) extensionTerm = d.extensionTerm;
        if (d.extensionStartDate) extensionStartDate = formatToInputDate(d.extensionStartDate);
        if (d.extensionEndDate) extensionEndDate = formatToInputDate(d.extensionEndDate);
        if (d.recommendation) recommendation = d.recommendation;
        if (d.disciplineCommand) disciplineCommand = d.disciplineCommand;
        if (d.dateOfApproval) dateOfApproval = formatToInputDate(d.dateOfApproval);
        if (d.grantedApproval) grantedApproval = d.grantedApproval;
        if (d.otherDecision) otherDecision = d.otherDecision;

        // New fields from sketch
        if (d.dateSubmissionReport) dateSubmissionReport = formatToInputDate(d.dateSubmissionReport);
        if (d.recommendationReport) recommendationReport = d.recommendationReport;
        if (d.dateSubmissionRecApproval) dateSubmissionRecApproval = formatToInputDate(d.dateSubmissionRecApproval);
        if (d.recommendationApproved) recommendationApproved = d.recommendationApproved;
        if (d.disciplinaryOrder) disciplinaryOrder = d.disciplinaryOrder;
        if (d.approvalSecretaryStatus) approvalSecretaryStatus = d.approvalSecretaryStatus;
        if (d.approvalSecretaryDetails) approvalSecretaryDetails = d.approvalSecretaryDetails;
        if (d.orderStartDate) orderStartDate = formatToInputDate(d.orderStartDate);
        if (d.orderEndDate) orderEndDate = formatToInputDate(d.orderEndDate);
        if (d.otherDecisions) otherDecisions = d.otherDecisions;
      }
    } catch (e) {
      console.warn("Error loading server disciplinary inspection details:", e);
    }

    // 2. Fallback to localStorage / baseCase values
    if (typeof window !== "undefined") {
      try {
        const localData = localStorage.getItem(`dcmms_formal_disciplinary_${caseNo}`);
        if (localData) {
          const parsed = JSON.parse(localData);
          if (parsed.invOfficerName && !invOfficerName) invOfficerName = parsed.invOfficerName;
          if (parsed.invOfficerDesignation && !invOfficerDesignation) invOfficerDesignation = parsed.invOfficerDesignation;
          if (parsed.invOfficerAppointmentDate && !invOfficerAppointmentDate) invOfficerAppointmentDate = parsed.invOfficerAppointmentDate;
          if (parsed.invOfficerTel && !invOfficerTel) invOfficerTel = parsed.invOfficerTel;
          if (parsed.invOfficerAddress && !invOfficerAddress) invOfficerAddress = parsed.invOfficerAddress;

          if (parsed.complaintOfficerName && !complaintOfficerName) complaintOfficerName = parsed.complaintOfficerName;
          if (parsed.complaintOfficerDesignation && !complaintOfficerDesignation) complaintOfficerDesignation = parsed.complaintOfficerDesignation;
          if (parsed.complaintOfficerAppointmentDate && !complaintOfficerAppointmentDate) complaintOfficerAppointmentDate = parsed.complaintOfficerAppointmentDate;
          if (parsed.complaintOfficerTel && !complaintOfficerTel) complaintOfficerTel = parsed.complaintOfficerTel;
          if (parsed.complaintOfficerAddress && !complaintOfficerAddress) complaintOfficerAddress = parsed.complaintOfficerAddress;

          if (parsed.maintenanceOfficerName && !maintenanceOfficerName) maintenanceOfficerName = parsed.maintenanceOfficerName;
          if (parsed.maintenanceOfficerDesignation && !maintenanceOfficerDesignation) maintenanceOfficerDesignation = parsed.maintenanceOfficerDesignation;
          if (parsed.maintenanceOfficerAppointmentDate && !maintenanceOfficerAppointmentDate) maintenanceOfficerAppointmentDate = parsed.maintenanceOfficerAppointmentDate;
          if (parsed.maintenanceOfficerTel && !maintenanceOfficerTel) maintenanceOfficerTel = parsed.maintenanceOfficerTel;
          if (parsed.maintenanceOfficerAddress && !maintenanceOfficerAddress) maintenanceOfficerAddress = parsed.maintenanceOfficerAddress;

          if (parsed.chairmanName && !chairmanName) chairmanName = parsed.chairmanName;
          if (parsed.chairmanId && !chairmanId) chairmanId = parsed.chairmanId;
          if (Array.isArray(parsed.members) && parsed.members.length > 0 && !members[0].name) {
            members = parsed.members;
          }
          if (parsed.appointmentLetterDate && !appointmentLetterDate) appointmentLetterDate = parsed.appointmentLetterDate;
          if (parsed.reportDueDate && !reportDueDate) reportDueDate = parsed.reportDueDate;
          if (parsed.extensionTerm && extensionTerm === "None") extensionTerm = parsed.extensionTerm;
          if (parsed.extensionStartDate && !extensionStartDate) extensionStartDate = parsed.extensionStartDate;
          if (parsed.extensionEndDate && !extensionEndDate) extensionEndDate = parsed.extensionEndDate;
          if (parsed.recommendation && !recommendation) recommendation = parsed.recommendation;
          if (parsed.disciplineCommand && !disciplineCommand) disciplineCommand = parsed.disciplineCommand;
          if (parsed.dateOfApproval && !dateOfApproval) dateOfApproval = parsed.dateOfApproval;
          if (parsed.grantedApproval && !grantedApproval) grantedApproval = parsed.grantedApproval;
          if (parsed.otherDecision && !otherDecision) otherDecision = parsed.otherDecision;

          // New fields fallback
          if (parsed.dateSubmissionReport && !dateSubmissionReport) dateSubmissionReport = parsed.dateSubmissionReport;
          if (parsed.recommendationReport && !recommendationReport) recommendationReport = parsed.recommendationReport;
          if (parsed.dateSubmissionRecApproval && !dateSubmissionRecApproval) dateSubmissionRecApproval = parsed.dateSubmissionRecApproval;
          if (parsed.recommendationApproved && !recommendationApproved) recommendationApproved = parsed.recommendationApproved;
          if (parsed.disciplinaryOrder && !disciplinaryOrder) disciplinaryOrder = parsed.disciplinaryOrder;
          if (parsed.approvalSecretaryStatus && !approvalSecretaryStatus) approvalSecretaryStatus = parsed.approvalSecretaryStatus;
          if (parsed.approvalSecretaryDetails && !approvalSecretaryDetails) approvalSecretaryDetails = parsed.approvalSecretaryDetails;
          if (parsed.orderStartDate && !orderStartDate) orderStartDate = parsed.orderStartDate;
          if (parsed.orderEndDate && !orderEndDate) orderEndDate = parsed.orderEndDate;
          if (parsed.otherDecisions && !otherDecisions) otherDecisions = parsed.otherDecisions;
        }
      } catch (e) {}
    }

    // Two-way synchronization between legacy & new sketch attributes
    if (!recommendationReport && recommendation) recommendationReport = recommendation;
    if (!recommendation && recommendationReport) recommendation = recommendationReport;
    if (!disciplinaryOrder && disciplineCommand) disciplinaryOrder = disciplineCommand;
    if (!disciplineCommand && disciplinaryOrder) disciplineCommand = disciplinaryOrder;
    if (!otherDecisions && otherDecision) otherDecisions = otherDecision;
    if (!otherDecision && otherDecisions) otherDecision = otherDecisions;

    setFormState({
      caseNo,
      accusedName: baseCase.accusedName || baseCase.accused_name || "Concerned Officer",
      accusedDesignation: baseCase.accusedDesignation || baseCase.accused_designation || baseCase.designation || "Educational Officer",
      schoolName: baseCase.schoolName || baseCase.institute_name || baseCase.school_name || "Government Educational Institute",
      subject: baseCase.subject || baseCase.title || baseCase.description || `Formal Disciplinary Proceeding ${caseNo}`,
      stage: baseCase.stage || "Formal Disciplinary Inspection",
      priority: baseCase.priority || "high",

      // 3 Officers matching user sketch
      invOfficerName,
      invOfficerDesignation,
      invOfficerAppointmentDate,
      invOfficerTel,
      invOfficerAddress,

      complaintOfficerName,
      complaintOfficerDesignation,
      complaintOfficerAppointmentDate,
      complaintOfficerTel,
      complaintOfficerAddress,

      maintenanceOfficerName,
      maintenanceOfficerDesignation,
      maintenanceOfficerAppointmentDate,
      maintenanceOfficerTel,
      maintenanceOfficerAddress,

      chairmanName: chairmanName || invOfficerName,
      chairmanId,
      chairmanEmail,
      members: members.length > 0 ? members : [{ name: "", idNo: "", email: "" }],
      appointmentLetterDate,
      reportDueDate,
      extensionTerm: extensionTerm || "None",
      extensionStartDate,
      extensionEndDate,
      recommendation: recommendation || baseCase.recommendation || "",
      disciplineCommand: disciplineCommand || baseCase.disciplineCommand || "",
      dateOfApproval: dateOfApproval || baseCase.dateOfApproval || "",
      grantedApproval: grantedApproval || "Getting approval",
      otherDecision: otherDecision || baseCase.otherDecision || "",

      // New sketch fields
      dateSubmissionReport,
      recommendationReport,
      dateSubmissionRecApproval,
      recommendationApproved,
      disciplinaryOrder,
      approvalSecretaryStatus,
      approvalSecretaryDetails,
      orderStartDate,
      orderEndDate,
      otherDecisions,
    });
  };

  // Case switch handler
  const handleCaseChange = (newCaseNo: string) => {
    setSelectedCaseNo(newCaseNo);
    const target = availableCases.find((c) => (c.caseNo || "").trim().toLowerCase() === newCaseNo.trim().toLowerCase()) || {};
    populateFormDataForCase(newCaseNo, target);
    router.replace(`/subject/disciplinary-inspection?caseNo=${encodeURIComponent(newCaseNo)}`);
  };

  // Autocomplete Select / Input Handlers for the 3 Committee Officers
  const handleInvOfficerNameChange = (nameVal: string) => {
    const matched = committeeOfficers.find((o) => o.fullName.toLowerCase() === nameVal.trim().toLowerCase());
    setFormState((prev) => ({
      ...prev,
      invOfficerName: nameVal,
      invOfficerDesignation: matched?.position || prev.invOfficerDesignation,
      invOfficerTel: matched ? (matched.nicNo || matched.email || prev.invOfficerTel) : prev.invOfficerTel,
      chairmanName: nameVal,
    }));
  };

  const handleComplaintOfficerNameChange = (nameVal: string) => {
    const matched = committeeOfficers.find((o) => o.fullName.toLowerCase() === nameVal.trim().toLowerCase());
    setFormState((prev) => ({
      ...prev,
      complaintOfficerName: nameVal,
      complaintOfficerDesignation: matched?.position || prev.complaintOfficerDesignation,
      complaintOfficerTel: matched ? (matched.nicNo || matched.email || prev.complaintOfficerTel) : prev.complaintOfficerTel,
    }));
  };

  const handleMaintenanceOfficerNameChange = (nameVal: string) => {
    const matched = committeeOfficers.find((o) => o.fullName.toLowerCase() === nameVal.trim().toLowerCase());
    setFormState((prev) => ({
      ...prev,
      maintenanceOfficerName: nameVal,
      maintenanceOfficerDesignation: matched?.position || prev.maintenanceOfficerDesignation,
      maintenanceOfficerTel: matched ? (matched.nicNo || matched.email || prev.maintenanceOfficerTel) : prev.maintenanceOfficerTel,
    }));
  };

  // Legacy Member Rows Add & Remove (if needed)
  const handleAddMember = () => {
    setFormState((prev) => ({
      ...prev,
      members: [...prev.members, { name: "", idNo: "", email: "" }],
    }));
  };

  const handleRemoveMember = (idx: number) => {
    setFormState((prev) => {
      const updated = prev.members.filter((_, i) => i !== idx);
      return {
        ...prev,
        members: updated.length > 0 ? updated : [{ name: "", idNo: "", email: "" }],
      };
    });
  };

  const handleMemberChange = (idx: number, field: "name" | "idNo", value: string) => {
    setFormState((prev) => {
      const updated = [...prev.members];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, members: updated };
    });
  };

  // Save Form Handler
  const handleSaveForm = async () => {
    if (!formState.caseNo) {
      alert("Please select or specify a valid Case Number.");
      return;
    }

    setSaving(true);
    try {
      // 1. PostgreSQL Server Action
      const saveRes = await saveFormalDisciplinaryInspectionServer({
        caseNo: formState.caseNo,
        // 3 Investigation Committee Officers
        invOfficerName: formState.invOfficerName,
        invOfficerDesignation: formState.invOfficerDesignation,
        invOfficerAppointmentDate: formState.invOfficerAppointmentDate || null,
        invOfficerTel: formState.invOfficerTel,
        invOfficerAddress: formState.invOfficerAddress,

        complaintOfficerName: formState.complaintOfficerName,
        complaintOfficerDesignation: formState.complaintOfficerDesignation,
        complaintOfficerAppointmentDate: formState.complaintOfficerAppointmentDate || null,
        complaintOfficerTel: formState.complaintOfficerTel,
        complaintOfficerAddress: formState.complaintOfficerAddress,

        maintenanceOfficerName: formState.maintenanceOfficerName,
        maintenanceOfficerDesignation: formState.maintenanceOfficerDesignation,
        maintenanceOfficerAppointmentDate: formState.maintenanceOfficerAppointmentDate || null,
        maintenanceOfficerTel: formState.maintenanceOfficerTel,
        maintenanceOfficerAddress: formState.maintenanceOfficerAddress,

        // Legacy fallbacks
        chairmanName: formState.invOfficerName || formState.chairmanName,
        chairmanId: formState.invOfficerTel || formState.chairmanId,
        chairmanEmail: formState.invOfficerTel || formState.chairmanEmail,
        members: [
          ...(formState.complaintOfficerName ? [{ name: formState.complaintOfficerName, email: formState.complaintOfficerTel, idNo: formState.complaintOfficerTel }] : []),
          ...(formState.maintenanceOfficerName ? [{ name: formState.maintenanceOfficerName, email: formState.maintenanceOfficerTel, idNo: formState.maintenanceOfficerTel }] : []),
        ],

        appointmentLetterDate: formState.appointmentLetterDate || null,
        reportDueDate: formState.reportDueDate || null,
        extensionTerm: formState.extensionTerm,
        extensionStartDate: formState.extensionStartDate || null,
        extensionEndDate: formState.extensionEndDate || null,
        recommendation: formState.recommendationReport || formState.recommendation,
        disciplineCommand: formState.disciplinaryOrder || formState.disciplineCommand,
        dateOfApproval: formState.dateOfApproval || null,
        grantedApproval: formState.approvalSecretaryStatus === "not received" ? "Rejection" : (formState.grantedApproval || "Getting approval"),
        otherDecision: formState.otherDecisions || formState.otherDecision,

        // 10 new fields from sketch
        dateSubmissionReport: formState.dateSubmissionReport || null,
        recommendationReport: formState.recommendationReport || formState.recommendation,
        dateSubmissionRecApproval: formState.dateSubmissionRecApproval || null,
        recommendationApproved: formState.recommendationApproved,
        disciplinaryOrder: formState.disciplinaryOrder || formState.disciplineCommand,
        approvalSecretaryStatus: formState.approvalSecretaryStatus,
        approvalSecretaryDetails: formState.approvalSecretaryDetails,
        orderStartDate: formState.orderStartDate || null,
        orderEndDate: formState.orderEndDate || null,
        otherDecisions: formState.otherDecisions || formState.otherDecision,
        updatedBy: currentUser?.fullName || currentUser?.email || "Subject Officer",
      });

      // 2. Supabase Realtime Storage
      if (isSupabaseConfigured) {
        try {
          await supabase.from("dcmms_cases").upsert({
            caseNo: formState.caseNo,
            stage: "Formal Disciplinary Inspection",
            updatedAt: new Date().toISOString(),
          }, { onConflict: "caseNo" });
        } catch (e) {}
      }

      // 3. LocalStorage persistence
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`dcmms_formal_disciplinary_${formState.caseNo}`, JSON.stringify(formState));
        } catch (e) {}
      }

      showToast("Formal Disciplinary Inspection details saved successfully!");
    } catch (error: any) {
      console.error("Save error:", error);
      showToast("Error saving inspection details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async (e?: React.MouseEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    try {
      await signOut();
    } catch (err) {}
    router.push("/login");
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

  if (!mounted) return null;

  return (
    <div className="dashboard-container" data-font-scale={fontScale} suppressHydrationWarning>
      {/* Skip Link (A11y) */}
      <a href="#dashboard-main-content" className="skip-link">
        {t("skipLink", "Skip to main content")}
      </a>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fdi-toast-overlay">
          <div className="fdi-toast-content">
            <CheckCircle size={20} style={{ color: "#4ade80" }} />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Datalist for autocomplete committee officers */}
      <datalist id="committee-officers-list">
        {committeeOfficers.map((o, idx) => (
          <option key={`comm-${o.id}-${idx}`} value={o.fullName}>
            {o.position ? `${o.position} • ` : ""}{o.nicNo || o.email}
          </option>
        ))}
      </datalist>

      {/* Sidebar Navigation */}
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
        role="subject"
      />

      <div className="dashboard-layout">
        <main id="dashboard-main-content" className="dashboard-content">
          {/* Top App Bar Header */}
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
                <p className="dashboard-main-subtitle">
                  {lang === "si" ? "විධිමත් විනය පරීක්ෂණ පෝරමය" : "Formal Disciplinary Inspection Form"}
                </p>
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

              {currentUser && (
                <>
                  <div className="divider-line" aria-hidden="true" />
                  <div className="date-badge" style={{ gap: "6px" }}>
                    <User size={14} style={{ color: "#4f46e5" }} />
                    <span style={{ fontWeight: 600 }}>{currentUser.fullName || currentUser.email || "Subject Officer"}</span>
                  </div>
                </>
              )}
            </div>
          </header>

          {/* Main Content Area */}
          <div className="fdi-page-wrapper">
            
            {/* Breadcrumb Navigation */}
            <nav className="fdi-breadcrumb" aria-label="Breadcrumb">
              <Link href="/subject">{tr("ප්‍රධාන පුවරුව", "முகப்புப் பலகை", "Dashboard")}</Link>
              <ChevronRight size={14} />
              <Link href="/subject">{tr("විධිමත් විනය පරීක්ෂණ", "முறையான ஒழுக்காற்று விசாரணை", "Formal Disciplinary Inspection")}</Link>
              <ChevronRight size={14} />
              <span style={{ color: "#1e1b4b", fontWeight: 700 }}>
                {formState.caseNo || tr("විනය පරීක්ෂණ පෝරමය", "ஒழுக்காற்று விசாரணை படிவம்", "Inspection Form")}
              </span>
            </nav>

          {/* Header & Main Actions */}
          <div className="fdi-page-header">
            <div className="fdi-title-group">
              <h1>
                <Scale style={{ color: "#4f46e5", width: "28px", height: "28px" }} />
                <span>
                  {tr(
                    "විධිමත් විනය පරීක්ෂණය (Formal Disciplinary Inspection)",
                    "முறையான ஒழுக்காற்று விசாரணை (Formal Disciplinary Inspection)",
                    "Formal Disciplinary Inspection"
                  )}
                </span>
              </h1>
              <p>
                {tr(
                  "ආයතන සංග්‍රහය සහ රාජ්‍ය සේවා කොමිෂන් සභා නියෝග යටතේ විධිමත් විනය පරීක්ෂණ තොරතුරු සම්පූර්ණ කරන්න.",
                  "தாபனக் கோவை மற்றும் பொதுச் சேவை ஆணைக்குழு உத்தரவுகளின் கீழ் முறையான ஒழுக்காற்று விசாரணை தகவல்களை பூர்த்தி செய்யவும்.",
                  "Complete formal disciplinary inspection proceedings, inquiry committee appointments, and PSC commands under the Establishment Code."
                )}
              </p>
            </div>

            <div className="fdi-header-actions">
              <Link href="/subject" className="btn-fdi-back">
                <ArrowLeft size={16} />
                <span>{tr("නැවත ලැයිස්තුවට", "மீண்டும் முகப்புக்கு", "Back to Dashboard")}</span>
              </Link>

              <button
                type="button"
                onClick={handleSaveForm}
                disabled={saving}
                className="btn-fdi-save-main"
              >
                <Save size={16} />
                <span>
                  {saving
                    ? tr("සුරකිමින්...", "சேமிக்கப்படுகிறது...", "Saving...")
                    : tr("විස්තර සුරකින්න", "விவரங்களைச் சேமிக்கவும்", "Save Details")}
                </span>
              </button>
            </div>
          </div>

          {/* Case Switcher Bar */}
          <div className="fdi-case-switcher-bar">
            <div className="fdi-case-switcher-left">
              <Layers size={18} style={{ color: "#4f46e5" }} />
              <span>
                {tr(
                  "අදාළ විනය ලිපිගොනුව තෝරන්න:",
                  "தொடர்புடைய ஒழுக்காற்று கோப்பைத் தேர்ந்தெடுக்கவும்:",
                  "Select Disciplinary Case Reference:"
                )}
              </span>
            </div>
            <div>
              <select
                value={selectedCaseNo}
                onChange={(e) => handleCaseChange(e.target.value)}
                className="fdi-case-select"
              >
                {availableCases.map((c, idx) => (
                  <option key={`opt-${c.caseNo}-${idx}`} value={c.caseNo}>
                    {c.caseNo} {c.accusedName ? `— ${c.accusedName}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ==================== FORM BODY (PAPER SKETCH SECTIONS) ==================== */}
          <div className="fdi-form-layout">

            {/* 1. Case Current Details (Section 1 in Sketch) */}
            <section className="fdi-section-card">
              <div className="fdi-section-header">
                <div className="fdi-section-title">
                  <FileText size={18} style={{ color: "#4f46e5" }} />
                  <span>
                    {tr("1. නඩුවේ වත්මන් විස්තර", "1. வழக்கின் தற்போதைய விவரங்கள்", "1. Case Current Details")}
                  </span>
                </div>
                <span className="fdi-section-badge">
                  {tr("වත්මන් තත්ත්වය", "தற்போதைய வழக்கு", "Current Case")}
                </span>
              </div>

              <div className="fdi-case-preview-banner">
                <div className="fdi-preview-item">
                  <span className="fdi-preview-label">
                    {tr("ලිපිගොනු අංකය", "கோப்பு எண்", "Case / Ref Number")}
                  </span>
                  <span className="fdi-preview-value highlight-case">{formState.caseNo || "—"}</span>
                </div>

                <div className="fdi-preview-item">
                  <span className="fdi-preview-label">
                    {tr("චෝදනා ලැබූ නිලධාරී", "குற்றஞ்சாட்டப்பட்ட அதிகாரி", "Accused Officer")}
                  </span>
                  <span className="fdi-preview-value" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <User size={14} style={{ color: "#4f46e5" }} />
                    {formState.accusedName || "Concerned Officer"}
                  </span>
                </div>

                <div className="fdi-preview-item">
                  <span className="fdi-preview-label">
                    {tr("තනතුර සහ ආයතනය", "பதவி மற்றும் நிறுவனம்", "Designation & School / Institute")}
                  </span>
                  <span className="fdi-preview-value" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Building size={14} style={{ color: "#64748b" }} />
                    {[formState.accusedDesignation, formState.schoolName].filter(Boolean).join(" • ") || "—"}
                  </span>
                </div>
              </div>
            </section>

            {/* 2. Investigation Committee Details (Matching Paper Sketch: investigation commitee detaise.) */}
            <section className="fdi-section-card">
              <div className="fdi-section-header">
                <div className="fdi-section-title">
                  <User size={18} style={{ color: "#4f46e5" }} />
                  <span>
                    {tr(
                      "2. පරීක්ෂණ කමිටු විස්තර (Investigation Committee Details)",
                      "2. விசாரණைக் குழு விவரங்கள் (Investigation Committee Details)",
                      "2. Investigation Committee Details"
                    )}
                  </span>
                </div>
                <span className="fdi-section-badge">
                  {tr("කමිටු නිලධාරීන් තිදෙනා", "3 குழு அதிகாரிகள்", "3 Committee Officers")}
                </span>
              </div>

              <div className="fdi-committee-box">
                {/* 1. Officer conducting the investigation */}
                <div className="fdi-officer-card card-investigation">
                  <div className="fdi-officer-header">
                    <div className="fdi-officer-title-wrap">
                      <div className="fdi-officer-number num-inv">1</div>
                      <div>
                        <span className="fdi-officer-title">
                          {tr(
                            "පරීක්ෂණය මෙහෙයවන නිලධාරී",
                            "விசாரணை நடத்தும் அதிகாரி",
                            "Officer conducting the investigation"
                          )}
                        </span>
                        {lang !== "en" && (
                          <span className="fdi-officer-subtitle">
                            (Officer conducting the investigation)
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="fdi-officer-badge badge-inv">
                      {tr("පරීක්ෂණ නිලධාරී", "விசாரணை அதிகாரி", "Inquiring Officer")}
                    </span>
                  </div>

                  <div className="fdi-officer-fields">
                    <div className="fdi-grid-2">
                      <div className="fdi-input-group">
                        <label className="fdi-label">
                          <User size={14} style={{ color: "#4f46e5" }} />
                          <span>{tr("නම (Name)", "பெயர் (Name)", "Name")} :</span>
                        </label>
                        <input
                          type="text"
                          list="committee-officers-list"
                          value={formState.invOfficerName}
                          onChange={(e) => handleInvOfficerNameChange(e.target.value)}
                          placeholder={tr(
                            "නිලධාරී නම ඇතුළත් කරන්න හෝ ලැයිස්තුවෙන් තෝරන්න...",
                            "அதிகாரியின் பெயரை உள்ளிடவும் அல்லது தேர்ந்தெடுக்கவும்...",
                            "Enter officer name or select registered officer..."
                          )}
                          className="fdi-input"
                        />
                      </div>

                      <div className="fdi-input-group">
                        <label className="fdi-label">
                          <Briefcase size={14} style={{ color: "#4f46e5" }} />
                          <span>{tr("තනතුර (Designation)", "பதவி (Designation)", "Designation")} :</span>
                        </label>
                        <input
                          type="text"
                          value={formState.invOfficerDesignation}
                          onChange={(e) => setFormState({ ...formState, invOfficerDesignation: e.target.value })}
                          placeholder={tr("තනතුර ඇතුළත් කරන්න...", "பதவியை உள்ளிடவும்...", "Enter designation...")}
                          className="fdi-input"
                        />
                      </div>
                    </div>

                    <div className="fdi-grid-2">
                      <div className="fdi-input-group">
                        <label className="fdi-label">
                          <CalendarIcon size={14} style={{ color: "#4f46e5" }} />
                          <span>{tr("පත්කළ දිනය (Date of appointment)", "நியமனத் திகதி (Date of appointment)", "Date of appointment")} :</span>
                        </label>
                        <input
                          type="date"
                          value={formState.invOfficerAppointmentDate}
                          onChange={(e) => setFormState({ ...formState, invOfficerAppointmentDate: e.target.value })}
                          className="fdi-input"
                        />
                      </div>

                      <div className="fdi-input-group">
                        <label className="fdi-label">
                          <Phone size={14} style={{ color: "#4f46e5" }} />
                          <span>{tr("දුරකථන අංකය (tel no)", "தொலைபேசி இலக்கம் (tel no)", "tel no")} :</span>
                        </label>
                        <input
                          type="text"
                          value={formState.invOfficerTel}
                          onChange={(e) => setFormState({ ...formState, invOfficerTel: e.target.value })}
                          placeholder={tr("දුරකථන අංකය ඇතුළත් කරන්න...", "தொலைபேசி இலக்கத்தை உள்ளிடவும்...", "Enter phone / contact no...")}
                          className="fdi-input"
                        />
                      </div>
                    </div>

                    <div className="fdi-input-group">
                      <label className="fdi-label">
                        <MapPin size={14} style={{ color: "#4f46e5" }} />
                        <span>{tr("ලිපිනය (Address)", "முகவரி (Address)", "Address")} :</span>
                      </label>
                      <input
                        type="text"
                        value={formState.invOfficerAddress}
                        onChange={(e) => setFormState({ ...formState, invOfficerAddress: e.target.value })}
                        placeholder={tr("නිල ලිපිනය හෝ ආයතනය ඇතුළත් කරන්න...", "அலுவலக முகவரியை உள்ளிடவும்...", "Enter official address or institution...")}
                        className="fdi-input"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Officer conducting the complaint */}
                <div className="fdi-officer-card card-complaint">
                  <div className="fdi-officer-header">
                    <div className="fdi-officer-title-wrap">
                      <div className="fdi-officer-number num-comp">2</div>
                      <div>
                        <span className="fdi-officer-title">
                          {tr(
                            "පැමිණිල්ල මෙහෙයවන නිලධාරී",
                            "முறைப்பாட்டை நடத்தும் அதிகாரி",
                            "Officer conducting the complaint"
                          )}
                        </span>
                        {lang !== "en" && (
                          <span className="fdi-officer-subtitle">
                            (Officer conducting the complaint)
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="fdi-officer-badge badge-comp">
                      {tr("පැමිණිලි මෙහෙයුම්", "முறைப்பாட்டு அதிகாரி", "Prosecuting Officer")}
                    </span>
                  </div>

                  <div className="fdi-officer-fields">
                    <div className="fdi-grid-2">
                      <div className="fdi-input-group">
                        <label className="fdi-label">
                          <User size={14} style={{ color: "#ea580c" }} />
                          <span>{tr("නම (Name)", "பெயர் (Name)", "Name")} :</span>
                        </label>
                        <input
                          type="text"
                          list="committee-officers-list"
                          value={formState.complaintOfficerName}
                          onChange={(e) => handleComplaintOfficerNameChange(e.target.value)}
                          placeholder={tr(
                            "නිලධාරී නම ඇතුළත් කරන්න හෝ ලැයිස්තුවෙන් තෝරන්න...",
                            "அதிகாரியின் பெயரை உள்ளிடவும் அல்லது தேர்ந்தெடுக்கவும்...",
                            "Enter officer name or select registered officer..."
                          )}
                          className="fdi-input"
                        />
                      </div>

                      <div className="fdi-input-group">
                        <label className="fdi-label">
                          <Briefcase size={14} style={{ color: "#ea580c" }} />
                          <span>{tr("තනතුර (Designation)", "පதவி (Designation)", "Designation")} :</span>
                        </label>
                        <input
                          type="text"
                          value={formState.complaintOfficerDesignation}
                          onChange={(e) => setFormState({ ...formState, complaintOfficerDesignation: e.target.value })}
                          placeholder={tr("තනතුර ඇතුළත් කරන්න...", "பதவியை உள்ளிடவும்...", "Enter designation...")}
                          className="fdi-input"
                        />
                      </div>
                    </div>

                    <div className="fdi-grid-2">
                      <div className="fdi-input-group">
                        <label className="fdi-label">
                          <CalendarIcon size={14} style={{ color: "#ea580c" }} />
                          <span>{tr("පත්කළ දිනය (Date of appointment)", "நியமனத் திகதி (Date of appointment)", "Date of appointment")} :</span>
                        </label>
                        <input
                          type="date"
                          value={formState.complaintOfficerAppointmentDate}
                          onChange={(e) => setFormState({ ...formState, complaintOfficerAppointmentDate: e.target.value })}
                          className="fdi-input"
                        />
                      </div>

                      <div className="fdi-input-group">
                        <label className="fdi-label">
                          <Phone size={14} style={{ color: "#ea580c" }} />
                          <span>{tr("දුරකථන අංකය (tel no)", "தொலைபேசி இலக்கம் (tel no)", "tel no")} :</span>
                        </label>
                        <input
                          type="text"
                          value={formState.complaintOfficerTel}
                          onChange={(e) => setFormState({ ...formState, complaintOfficerTel: e.target.value })}
                          placeholder={tr("දුරකථන අංකය ඇතුළත් කරන්න...", "தொலைபேசி இலக்கத்தை உள்ளிடவும்...", "Enter phone / contact no...")}
                          className="fdi-input"
                        />
                      </div>
                    </div>

                    <div className="fdi-input-group">
                      <label className="fdi-label">
                        <MapPin size={14} style={{ color: "#ea580c" }} />
                        <span>{tr("ලිපිනය (Address)", "முகவரி (Address)", "Address")} :</span>
                      </label>
                      <input
                        type="text"
                        value={formState.complaintOfficerAddress}
                        onChange={(e) => setFormState({ ...formState, complaintOfficerAddress: e.target.value })}
                        placeholder={tr("නිල ලිපිනය හෝ ආයතනය ඇතුළත් කරන්න...", "அலுவலக முகவரியை உள்ளிடவும்...", "Enter official address or institution...")}
                        className="fdi-input"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Officer conducting the maintenance */}
                <div className="fdi-officer-card card-maintenance">
                  <div className="fdi-officer-header">
                    <div className="fdi-officer-title-wrap">
                      <div className="fdi-officer-number num-maint">3</div>
                      <div>
                        <span className="fdi-officer-title">
                          {tr(
                            "නඩත්තු මෙහෙයවන නිලධාරී",
                            "பராமரிப்பை நடத்தும் அதிகாரி",
                            "Officer conducting the maintenance"
                          )}
                        </span>
                        {lang !== "en" && (
                          <span className="fdi-officer-subtitle">
                            (Officer conducting the maintenance)
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="fdi-officer-badge badge-maint">
                      {tr("නඩත්තු නිලධාරී", "பராமரிப்பு அதிகாரி", "Maintenance Officer")}
                    </span>
                  </div>

                  <div className="fdi-officer-fields">
                    <div className="fdi-grid-2">
                      <div className="fdi-input-group">
                        <label className="fdi-label">
                          <User size={14} style={{ color: "#059669" }} />
                          <span>{tr("නම (Name)", "பெயர் (Name)", "Name")} :</span>
                        </label>
                        <input
                          type="text"
                          list="committee-officers-list"
                          value={formState.maintenanceOfficerName}
                          onChange={(e) => handleMaintenanceOfficerNameChange(e.target.value)}
                          placeholder={tr(
                            "නිලධාරී නම ඇතුළත් කරන්න හෝ ලැයිස්තුවෙන් තෝරන්න...",
                            "அதிகாரியின் பெயரை உள்ளிடவும் அல்லது தேர்ந்தெடுக்கவும்...",
                            "Enter officer name or select registered officer..."
                          )}
                          className="fdi-input"
                        />
                      </div>

                      <div className="fdi-input-group">
                        <label className="fdi-label">
                          <Briefcase size={14} style={{ color: "#059669" }} />
                          <span>{tr("තනතුර (Designation)", "பதவி (Designation)", "Designation")} :</span>
                        </label>
                        <input
                          type="text"
                          value={formState.maintenanceOfficerDesignation}
                          onChange={(e) => setFormState({ ...formState, maintenanceOfficerDesignation: e.target.value })}
                          placeholder={tr("තනතුර ඇතුළත් කරන්න...", "பதவியை உள்ளிடவும்...", "Enter designation...")}
                          className="fdi-input"
                        />
                      </div>
                    </div>

                    <div className="fdi-grid-2">
                      <div className="fdi-input-group">
                        <label className="fdi-label">
                          <CalendarIcon size={14} style={{ color: "#059669" }} />
                          <span>{tr("පත්කළ දිනය (Date of appointment)", "நியமனத் திகதி (Date of appointment)", "Date of appointment")} :</span>
                        </label>
                        <input
                          type="date"
                          value={formState.maintenanceOfficerAppointmentDate}
                          onChange={(e) => setFormState({ ...formState, maintenanceOfficerAppointmentDate: e.target.value })}
                          className="fdi-input"
                        />
                      </div>

                      <div className="fdi-input-group">
                        <label className="fdi-label">
                          <Phone size={14} style={{ color: "#059669" }} />
                          <span>{tr("දුරකථන අංකය (tel no)", "தொலைபேசி இலக்கம் (tel no)", "tel no")} :</span>
                        </label>
                        <input
                          type="text"
                          value={formState.maintenanceOfficerTel}
                          onChange={(e) => setFormState({ ...formState, maintenanceOfficerTel: e.target.value })}
                          placeholder={tr("දුරකථන අංකය ඇතුළත් කරන්න...", "தொலைபேசி இலக்கத்தை உள்ளிடவும்...", "Enter phone / contact no...")}
                          className="fdi-input"
                        />
                      </div>
                    </div>

                    <div className="fdi-input-group">
                      <label className="fdi-label">
                        <MapPin size={14} style={{ color: "#059669" }} />
                        <span>{tr("ලිපිනය (Address)", "முகவரி (Address)", "Address")} :</span>
                      </label>
                      <input
                        type="text"
                        value={formState.maintenanceOfficerAddress}
                        onChange={(e) => setFormState({ ...formState, maintenanceOfficerAddress: e.target.value })}
                        placeholder={tr("නිල ලිපිනය හෝ ආයතනය ඇතුළත් කරන්න...", "அலுவலக முகவரியை உள்ளிடவும்...", "Enter official address or institution...")}
                        className="fdi-input"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ==================== FORMAL DISCIPLINARY INSPECTION PROCEEDINGS (SKETCH ORDER 1-8) ==================== */}
            <section className="fdi-section-card fdi-sketch-sheet">
              <div className="fdi-section-header">
                <div className="fdi-section-title">
                  <Scale size={20} style={{ color: "#4f46e5" }} />
                  <div>
                    <span style={{ fontSize: "16px", fontWeight: 800 }}>
                      {tr(
                        "විනය පරීක්ෂණ වාර්තාව සහ නියෝග ක්‍රියාමාර්ග",
                        "ஒழுங்கு நடவடிக்கை விசாரணை அறிக்கை மற்றும் நடவடிக்கைகள்",
                        "Disciplinary Investigation Report & Proceedings"
                      )}
                    </span>
                    <span style={{ display: "block", fontSize: "12.5px", color: "#64748b", fontWeight: 500, marginTop: "2px" }}>
                      {tr(
                        "වාර්තාව භාරදීම, නිර්දේශ, අනුමැතිය සහ විනය නියෝග ක්‍රියාත්මක කිරීමේ පියවර 1 සිට 8 දක්වා",
                        "அறிக்கை சமர்ப்பித்தல், பரிந்துரைகள், ஒப்புதல் மற்றும் ஒழுங்கு உத்தரவு அமலாக்கம் (படிகள் 1 முதல் 8 வரை)",
                        "Proceedings from report submission to final disciplinary order implementation (Steps 1 to 8)"
                      )}
                    </span>
                  </div>
                </div>
                <span className="fdi-section-badge">
                  {tr("පියවර 1 – 8", "படிகள் 1 – 8", "Steps 1 – 8")}
                </span>
              </div>

              <div className="fdi-sketch-flow-container">
                {/* 1. Date of submission of the disciplinary investigation report */}
                <div className="fdi-sketch-step">
                  <div className="fdi-sketch-step-header">
                    <span className="fdi-sketch-step-badge">1</span>
                    <span className="fdi-sketch-step-title">
                      {tr(
                        "විනය පරීක්ෂණ වාර්තාව භාරදුන් දිනය",
                        "ஒழுங்கு விசாரணை அறிக்கை சமர்ப்பிக்கப்பட்ட திகதி",
                        "Date of submission of the disciplinary investigation report"
                      )}
                    </span>
                    {lang !== "en" && (
                      <span className="fdi-sketch-step-sub">
                        (Date of submission of the disciplinary investigation report)
                      </span>
                    )}
                  </div>
                  <div className="fdi-input-group" style={{ maxWidth: "340px" }}>
                    <input
                      type="date"
                      value={formState.dateSubmissionReport}
                      onChange={(e) => setFormState({ ...formState, dateSubmissionReport: e.target.value })}
                      className="fdi-input"
                    />
                  </div>
                </div>

                {/* 2. Recommendation of the disciplinary investigation report */}
                <div className="fdi-sketch-step">
                  <div className="fdi-sketch-step-header">
                    <span className="fdi-sketch-step-badge">2</span>
                    <span className="fdi-sketch-step-title">
                      {tr(
                        "විනය පරීක්ෂණ වාර්තාවේ නිර්දේශය",
                        "ஒழுங்கு விசாரணை அறிக்கையின் பரிந்துரை",
                        "Recommendation of the disciplinary investigation report"
                      )}
                    </span>
                    {lang !== "en" && (
                      <span className="fdi-sketch-step-sub">
                        (Recommendation of the disciplinary investigation report)
                      </span>
                    )}
                  </div>
                  <div className="fdi-input-group">
                    <textarea
                      value={formState.recommendationReport}
                      onChange={(e) => setFormState({ ...formState, recommendationReport: e.target.value, recommendation: e.target.value })}
                      placeholder={tr(
                        "විනය පරීක්ෂණ වාර්තාවේ නිර්දේශය ඇතුළත් කරන්න...",
                        "ஒழுங்கு விசாரணை அறிக்கையின் பரிந்துரையை உள்ளிடவும்...",
                        "Enter recommendation of the disciplinary investigation report..."
                      )}
                      className="fdi-textarea"
                      rows={4}
                    />
                  </div>
                </div>

                {/* 3. Date of submission of the recommendation for approval */}
                <div className="fdi-sketch-step">
                  <div className="fdi-sketch-step-header">
                    <span className="fdi-sketch-step-badge">3</span>
                    <span className="fdi-sketch-step-title">
                      {tr(
                        "නිර්දේශය අනුමැතිය සඳහා ඉදිරිපත් කළ දිනය",
                        "ஒப்புதலுக்காக பரிந்துரை சமர்ப்பிக்கப்பட்ட திகதி",
                        "Date of submission of the recommendation for approval"
                      )}
                    </span>
                    {lang !== "en" && (
                      <span className="fdi-sketch-step-sub">
                        (Date of submission of the recommendation for approval)
                      </span>
                    )}
                  </div>
                  <div className="fdi-input-group" style={{ maxWidth: "340px" }}>
                    <input
                      type="date"
                      value={formState.dateSubmissionRecApproval}
                      onChange={(e) => setFormState({ ...formState, dateSubmissionRecApproval: e.target.value })}
                      className="fdi-input"
                    />
                  </div>
                </div>

                {/* 4. Date of approval & Recommendation approved */}
                <div className="fdi-sketch-step">
                  <div className="fdi-sketch-step-header">
                    <span className="fdi-sketch-step-badge">4</span>
                    <span className="fdi-sketch-step-title">
                      {tr(
                        "අනුමත කළ දිනය සහ අනුමත නිර්දේශය",
                        "ஒப்புதல் திகதி மற்றும் அங்கீகரிக்கப்பட்ட பரிந்துரை",
                        "Date of approval & Recommendation approved"
                      )}
                    </span>
                    {lang !== "en" && (
                      <span className="fdi-sketch-step-sub">
                        (Date of approval & Recommendation approved)
                      </span>
                    )}
                  </div>
                  <div className="fdi-grid-2">
                    <div className="fdi-input-group">
                      <label className="fdi-label">
                        <CalendarIcon size={14} style={{ color: "#4f46e5" }} />
                        <span>{tr("අනුමත කළ දිනය (Date of approval)", "ஒப்புதல் திகதி (Date of approval)", "Date of approval")} :</span>
                      </label>
                      <input
                        type="date"
                        value={formState.dateOfApproval}
                        onChange={(e) => setFormState({ ...formState, dateOfApproval: e.target.value })}
                        className="fdi-input"
                      />
                    </div>

                    <div className="fdi-input-group">
                      <label className="fdi-label">
                        <Scale size={14} style={{ color: "#4f46e5" }} />
                        <span>{tr("අනුමත නිර්දේශය (Recommendation approved)", "அங்கீகரிக்கப்பட்ட பரிந்துரை (Recommendation approved)", "Recommendation approved")} :</span>
                      </label>
                      <div className="fdi-radio-group">
                        <button
                          type="button"
                          className={`fdi-radio-pill ${formState.recommendationApproved === "Guilty" ? "pill-active-danger" : ""}`}
                          onClick={() => setFormState({ ...formState, recommendationApproved: "Guilty" })}
                        >
                          <span className="fdi-radio-circle">
                            {formState.recommendationApproved === "Guilty" && <span className="fdi-radio-circle-dot" />}
                          </span>
                          <span>{tr("වරදකරු (Guilty)", "குற்றவாளி (Guilty)", "Guilty")}</span>
                        </button>
                        <button
                          type="button"
                          className={`fdi-radio-pill ${formState.recommendationApproved === "Acquittal" ? "pill-active-success" : ""}`}
                          onClick={() => setFormState({ ...formState, recommendationApproved: "Acquittal" })}
                        >
                          <span className="fdi-radio-circle">
                            {formState.recommendationApproved === "Acquittal" && <span className="fdi-radio-circle-dot" />}
                          </span>
                          <span>{tr("නිදොස්කොට නිදහස් (Acquittal)", "விடுதலை (Acquittal)", "Acquittal")}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. Disciplinary order */}
                <div className="fdi-sketch-step">
                  <div className="fdi-sketch-step-header">
                    <span className="fdi-sketch-step-badge">5</span>
                    <span className="fdi-sketch-step-title">
                      {tr("විනය නියෝගය", "ஒழுங்கு நடவடிக்கை உத்தரவு", "Disciplinary order")}
                    </span>
                    {lang !== "en" && (
                      <span className="fdi-sketch-step-sub">
                        (Disciplinary order)
                      </span>
                    )}
                  </div>
                  <div className="fdi-input-group">
                    <textarea
                      value={formState.disciplinaryOrder}
                      onChange={(e) => setFormState({ ...formState, disciplinaryOrder: e.target.value, disciplineCommand: e.target.value })}
                      placeholder={tr(
                        "විනය නියෝගයේ විස්තර ඇතුළත් කරන්න...",
                        "ஒழுங்கு உத்தரவின் விபரங்களை உள்ளிடவும்...",
                        "Enter disciplinary order details..."
                      )}
                      className="fdi-textarea"
                      rows={4}
                    />
                  </div>
                </div>

                {/* 6. Approval of the secretary of education */}
                <div className="fdi-sketch-step">
                  <div className="fdi-sketch-step-header">
                    <span className="fdi-sketch-step-badge">6</span>
                    <span className="fdi-sketch-step-title">
                      {tr("අධ්‍යාපන ලේකම්ගේ අනුමැතිය", "கல்வி செயலாளரின் ஒப்புதல்", "Approval of the secretary of education")}
                    </span>
                    {lang !== "en" && (
                      <span className="fdi-sketch-step-sub">
                        (Approval of the secretary of education)
                      </span>
                    )}
                  </div>

                  <div className="fdi-radio-group" style={{ marginBottom: "14px" }}>
                    <button
                      type="button"
                      className={`fdi-radio-pill ${formState.approvalSecretaryStatus === "Received" ? "pill-active-success" : ""}`}
                      onClick={() => setFormState({ ...formState, approvalSecretaryStatus: "Received", grantedApproval: "Getting approval" })}
                    >
                      <span className="fdi-radio-circle">
                        {formState.approvalSecretaryStatus === "Received" && <span className="fdi-radio-circle-dot" />}
                      </span>
                      <span>{tr("ලැබී ඇත (Received)", "பெறப்பட்டது (Received)", "Received")}</span>
                    </button>
                    <button
                      type="button"
                      className={`fdi-radio-pill ${formState.approvalSecretaryStatus === "not received" ? "pill-active-danger" : ""}`}
                      onClick={() => setFormState({ ...formState, approvalSecretaryStatus: "not received", grantedApproval: "Rejection" })}
                    >
                      <span className="fdi-radio-circle">
                        {formState.approvalSecretaryStatus === "not received" && <span className="fdi-radio-circle-dot" />}
                      </span>
                      <span>{tr("ලැබී නොමැත (Not received)", "பெறப்படவில்லை (Not received)", "Not received")}</span>
                    </button>
                  </div>

                  <div className="fdi-input-group">
                    <textarea
                      value={formState.approvalSecretaryDetails}
                      onChange={(e) => setFormState({ ...formState, approvalSecretaryDetails: e.target.value })}
                      placeholder={tr(
                        "අධ්‍යාපන ලේකම්ගේ අනුමැතිය පිළිබඳ විස්තර සහ සටහන් ඇතුළත් කරන්න...",
                        "கல்வி செயலாளரின் ஒப்புதல் தொடர்பான விபரங்களை உள்ளிடவும்...",
                        "Enter directives, notes or details regarding approval of the secretary of education..."
                      )}
                      className="fdi-textarea"
                      rows={3}
                    />
                  </div>
                </div>

                {/* 7. Implementation of the disciplinary order */}
                <div className="fdi-sketch-step">
                  <div className="fdi-sketch-step-header">
                    <span className="fdi-sketch-step-badge">7</span>
                    <span className="fdi-sketch-step-title">
                      {tr("විනය නියෝගය ක්‍රියාත්මක කිරීම", "ஒழுங்கு நடவடிக்கை உத்தரவை நடைமுறைப்படுத்துதல்", "Implementation of the disciplinary order")}
                    </span>
                    {lang !== "en" && (
                      <span className="fdi-sketch-step-sub">
                        (Implementation of the disciplinary order)
                      </span>
                    )}
                  </div>

                  <div className="fdi-grid-2">
                    <div className="fdi-input-group">
                      <label className="fdi-label">
                        <CalendarIcon size={14} style={{ color: "#4f46e5" }} />
                        <span>{tr("ආරම්භක දිනය (starting date)", "ஆரம்ப திகதி (starting date)", "Starting date")} :</span>
                      </label>
                      <input
                        type="date"
                        value={formState.orderStartDate}
                        onChange={(e) => setFormState({ ...formState, orderStartDate: e.target.value })}
                        className="fdi-input"
                      />
                    </div>

                    <div className="fdi-input-group">
                      <label className="fdi-label">
                        <CalendarIcon size={14} style={{ color: "#ef4444" }} />
                        <span>{tr("අවසන් දිනය (ending date)", "முடிவு திகதி (ending date)", "Ending date")} :</span>
                      </label>
                      <input
                        type="date"
                        value={formState.orderEndDate}
                        onChange={(e) => setFormState({ ...formState, orderEndDate: e.target.value })}
                        className="fdi-input"
                      />
                    </div>
                  </div>
                </div>

                {/* 8. Other decisions */}
                <div className="fdi-sketch-step">
                  <div className="fdi-sketch-step-header">
                    <span className="fdi-sketch-step-badge">8</span>
                    <span className="fdi-sketch-step-title">
                      {tr("වෙනත් තීරණ", "பிற முடிவுகள்", "Other decisions")}
                    </span>
                    {lang !== "en" && (
                      <span className="fdi-sketch-step-sub">
                        (Other decisions)
                      </span>
                    )}
                  </div>
                  <div className="fdi-input-group">
                    <textarea
                      value={formState.otherDecisions}
                      onChange={(e) => setFormState({ ...formState, otherDecisions: e.target.value, otherDecision: e.target.value })}
                      placeholder={tr(
                        "වෙනත් තීරණ හෝ අමතර නියෝග ඇතුළත් කරන්න...",
                        "பிற முடிவுகள் அல்லது கூடுதல் வழிமுறைகளை உள்ளிடவும்...",
                        "Enter other decisions, tribunal findings or additional directives..."
                      )}
                      className="fdi-textarea"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Bottom Floating Actions */}
            <div className="fdi-bottom-bar">
              <Link href="/subject" className="btn-fdi-back">
                <ArrowLeft size={16} />
                <span>{tr("නැවත ලැයිස්තුවට", "டாஷ்போர்டுக்குத் திரும்பு", "Back to Dashboard")}</span>
              </Link>

              <button
                type="button"
                onClick={handleSaveForm}
                disabled={saving}
                className="btn-fdi-save-main"
              >
                <Save size={16} />
                <span>
                  {saving
                    ? tr("සුරකිමින්...", "சேமிக்கப்படுகிறது...", "Saving...")
                    : tr("විනය පරීක්ෂණ විස්තර සුරකින්න", "ஒழுங்கு ஆய்வு விபரங்களைச் சேமிக்கவும்", "Save Formal Disciplinary Details")}
                </span>
              </button>
            </div>

          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  </div>
  );
}

export default function DisciplinaryInspectionPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center" }}>Loading Formal Disciplinary Inspection Form...</div>}>
      <DisciplinaryInspectionContent />
    </Suspense>
  );
}
