"use client";

import "@/i18n";
import "../../globals.css";
import "../../daily-mail/daily-mail.css";
import "../subject.css";
import "../../dashboard-common.css";
import "./recommendation.css";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase, isSupabaseConfigured, logAuditEvent } from "@/lib/supabase";
import { signOut, getCurrentProfile } from "@/lib/auth";
import {
  getAvailableCasesForRecommendationsServer,
  getCaseDetailsForRecommendationServer,
  saveRecommendationServer,
  getRecommendationsListServer,
} from "@/lib/db-actions";
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  Send,
  AlertCircle,
  FileText,
  Clock,
  UserCheck,
  Building,
  User,
  Calendar,
  Sparkles,
  ShieldAlert,
  ChevronRight,
  ClipboardList,
  Filter,
  Plus,
  Search,
  Eye,
  ExternalLink,
  Layers,
  ArrowRight,
  Menu,
  CheckCircle,
  X,
  FileCheck
} from "lucide-react";

interface CaseOption {
  caseNo: string;
  letterNo?: string;
  accusedName?: string;
  accusedDesignation?: string;
  schoolName?: string;
  subject?: string;
  initialCompletedDate?: string;
  hasRecommendation?: boolean;
  recStatus?: string;
}

interface RecommendationRecord {
  id?: string;
  caseNo: string;
  letterNo?: string;
  category: string;
  urgency: string;
  title: string;
  recommendationText: string;
  disciplinaryAction?: string;
  forwardTo: string;
  targetDate?: string;
  referenceNotes?: string;
  issuedChargeSheet?: string;
  chargeSheetIssuedDate?: string;
  chargeSheetResponseDate?: string;
  disciplinaryOrder?: string;
  disciplinaryAuthority?: string;
  dateRequestDocuments?: string;
  dateSubmissionDocuments?: string;
  agreeWithAnswers?: string;
  dateDraftSubmittedPsc?: string;
  agreeWithPscDecision?: string;
  secretaryApprovalDate?: string;
  secretaryApprovedRecommendation?: string;
  status: string;
  submittedAt?: string;
  updatedAt?: string;
  accusedName?: string;
  accusedDesignation?: string;
  schoolName?: string;
  officerName?: string;
  subject?: string;
  initialCompletedDate?: string;
}

function RecommendationFormContent() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const caseNoParam = searchParams?.get("caseNo") || searchParams?.get("refNo") || searchParams?.get("id") || "";
  const categoryParam = searchParams?.get("category") || "";
  const lang = i18n.language;

  // Client mount state to prevent SSR/CSR hydration mismatches
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Mobile sidebar visibility state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // View Mode: 'form' (Formulate Recommendation) vs 'list' (All Recommendations & Completed Cases)
  const [viewMode, setViewMode] = useState<"form" | "list">(caseNoParam || categoryParam ? "form" : "list");

  // Form Mode: 'recommendation' (Institutional Basic Investigation Recommendation) vs 'charge_sheet' (Issuing Charge Sheet)
  const [activeFormType, setActiveFormType] = useState<"recommendation" | "charge_sheet">(
    categoryParam === "issuing_charge_sheet" ? "charge_sheet" : "recommendation"
  );

  useEffect(() => {
    if (categoryParam === "issuing_charge_sheet") {
      setActiveFormType("charge_sheet");
      setRecommendationCategory("issuing_charge_sheet");
    }
  }, [categoryParam]);

  // Available cases list for quick selector
  const [availableCases, setAvailableCases] = useState<CaseOption[]>([]);
  const [allRecommendations, setAllRecommendations] = useState<RecommendationRecord[]>([]);

  // Case Reference Details State
  const [caseNo, setCaseNo] = useState(caseNoParam || "");
  const [letterNo, setLetterNo] = useState("");
  const [complainantName, setComplainantName] = useState("");
  const [accusedName, setAccusedName] = useState("");
  const [accusedDesignation, setAccusedDesignation] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [caseSubject, setCaseSubject] = useState("");
  const [initialCompletedDate, setInitialCompletedDate] = useState("");

  // Recommendation Form State
  const [recommendationCategory, setRecommendationCategory] = useState(categoryParam || "formal_inquiry");
  const [recommendationUrgency, setRecommendationUrgency] = useState("normal");
  const [recommendationTitle, setRecommendationTitle] = useState("");
  const [recommendationText, setRecommendationText] = useState("");
  const [disciplinaryAction, setDisciplinaryAction] = useState("");
  const [forwardTo, setForwardTo] = useState("disciplinary_branch");
  const [targetDate, setTargetDate] = useState("");
  const [referenceNotes, setReferenceNotes] = useState("");
  const [recommendationStatus, setRecommendationStatus] = useState("Submitted");

  // Conditional Charge Sheet Details State (When category === 'issuing_charge_sheet')
  const [issuedChargeSheet, setIssuedChargeSheet] = useState("");
  const [chargeSheetIssuedDate, setChargeSheetIssuedDate] = useState("");
  const [chargeSheetResponseDate, setChargeSheetResponseDate] = useState("");
  const [disciplinaryOrder, setDisciplinaryOrder] = useState("");
  const [disciplinaryAuthority, setDisciplinaryAuthority] = useState("secretary_of_education");
  const [dateRequestDocuments, setDateRequestDocuments] = useState("");
  const [dateSubmissionDocuments, setDateSubmissionDocuments] = useState("");
  const [agreeWithAnswers, setAgreeWithAnswers] = useState<"yes" | "no" | "">("");
  const [dateDraftSubmittedPsc, setDateDraftSubmittedPsc] = useState("");
  const [agreeWithPscDecision, setAgreeWithPscDecision] = useState<"yes" | "no" | "">("");

  // Secretary of Education Approval State
  const [secretaryApprovalDate, setSecretaryApprovalDate] = useState("");
  const [secretaryApprovedRecommendation, setSecretaryApprovedRecommendation] = useState("");

  // List View Filter & Search State
  const [recSearchQuery, setRecSearchQuery] = useState("");
  const [recCategoryFilter, setRecCategoryFilter] = useState("all");
  const [recUrgencyFilter, setRecUrgencyFilter] = useState("all");
  const [recStatusFilter, setRecStatusFilter] = useState("all");
  const [selectedRecModal, setSelectedRecModal] = useState<RecommendationRecord | null>(null);

  // Derived state: Whether decision is agreed as 'yes' based on selected disciplinary authority
  const isDecisionApproved = recommendationCategory === "issuing_charge_sheet"
    ? (disciplinaryAuthority === "psc_esc" ? agreeWithPscDecision === "yes" : agreeWithAnswers === "yes")
    : (agreeWithAnswers === "yes" || agreeWithPscDecision === "yes");

  // Whether PSC / ESC decision is explicitly disagreed ('no')
  const isPscDisagreed = recommendationCategory === "issuing_charge_sheet" && disciplinaryAuthority === "psc_esc" && agreeWithPscDecision === "no";

  // Loading & Feedback State
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 4000);
  };

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut();
    router.push("/subject");
  };

  // Sync document title
  useEffect(() => {
    document.title = `${lang === "si" ? "ආයතනික මූලික විමර්ශනයේ නිර්දේශය" : lang === "ta" ? "நிறுவன அடிப்படை விசாரணை பரிந்துரை" : "Institutional Basic Investigation Recommendation"} | DCMMS`;
  }, [lang]);

  // Load all available cases and registered recommendations
  const loadCasesAndRecommendationsList = async () => {
    const casesMap = new Map<string, CaseOption>();
    let recsList: RecommendationRecord[] = [];

    // 1. Fetch from PostgreSQL server actions
    try {
      const casesRes = await getAvailableCasesForRecommendationsServer();
      if (casesRes?.success && Array.isArray(casesRes.data)) {
        casesRes.data.forEach((c: any) => {
          const cNo = c.caseNo;
          if (!cNo) return;
          casesMap.set(cNo.trim().toLowerCase(), {
            caseNo: cNo,
            letterNo: c.letterNo,
            accusedName: c.accusedName,
            accusedDesignation: c.accusedDesignation,
            schoolName: c.schoolName,
            subject: c.subject,
            initialCompletedDate: c.initialCompletedDate,
            hasRecommendation: c.hasRecommendation || false,
            recStatus: c.recStatus || "Awaiting Rec",
          });
        });
      }

      const recsRes = await getRecommendationsListServer();
      if (recsRes?.success && Array.isArray(recsRes.data)) {
        recsList = recsRes.data.map((r: any) => ({
          id: r.id,
          caseNo: r.caseNo || r.case_no,
          letterNo: r.letterNo || r.letter_no,
          category: r.category || "issuing_charge_sheet",
          urgency: r.urgency || "normal",
          title: r.title || "Preliminary Investigation Recommendation",
          recommendationText: r.recommendationText || r.recommendation_text || "",
          disciplinaryAction: r.disciplinaryAction || r.disciplinary_action,
          forwardTo: r.forwardTo || r.forward_to || "disciplinary_branch",
          targetDate: r.targetDate ? String(r.targetDate).slice(0, 10) : "",
          referenceNotes: r.referenceNotes || r.reference_notes,
          issuedChargeSheet: r.issuedChargeSheet || r.issued_charge_sheet,
          chargeSheetIssuedDate: r.chargeSheetIssuedDate ? String(r.chargeSheetIssuedDate).slice(0, 10) : "",
          chargeSheetResponseDate: r.chargeSheetResponseDate ? String(r.chargeSheetResponseDate).slice(0, 10) : "",
          disciplinaryOrder: r.disciplinaryOrder || r.disciplinary_order,
          disciplinaryAuthority: r.disciplinaryAuthority || r.disciplinary_authority || "",
          dateRequestDocuments: r.dateRequestDocuments ? String(r.dateRequestDocuments).slice(0, 10) : "",
          dateSubmissionDocuments: r.dateSubmissionDocuments ? String(r.dateSubmissionDocuments).slice(0, 10) : "",
          agreeWithAnswers: r.agreeWithAnswers || r.agree_with_answers || "",
          dateDraftSubmittedPsc: r.dateDraftSubmittedPsc ? String(r.dateDraftSubmittedPsc).slice(0, 10) : "",
          agreeWithPscDecision: r.agreeWithPscDecision || r.agree_with_psc_decision || "",
          secretaryApprovalDate: r.secretaryApprovalDate ? String(r.secretaryApprovalDate).slice(0, 10) : "",
          secretaryApprovedRecommendation: r.secretaryApprovedRecommendation || r.secretary_approved_recommendation,
          status: r.status || "Submitted",
          submittedAt: r.submittedAt || r.submitted_at,
          updatedAt: r.updatedAt || r.updated_at,
        }));
      }
    } catch (err) {
      console.warn("PostgreSQL load recommendations error:", err);
    }

    // 2. LocalStorage Fallback & Merge
    if (typeof window !== "undefined") {
      try {
        const storedRecs = localStorage.getItem("dcmms_recommendations");
        if (storedRecs) {
          const parsed = JSON.parse(storedRecs);
          if (Array.isArray(parsed)) {
            parsed.forEach((lr: any) => {
              const key = (lr.caseNo || lr.case_no || "").trim().toLowerCase();
              if (key && !recsList.some((r) => (r.caseNo || "").trim().toLowerCase() === key)) {
                recsList.push({
                  caseNo: lr.caseNo || lr.case_no,
                  letterNo: lr.letterNo || lr.letter_no,
                  category: lr.category || "issuing_charge_sheet",
                  urgency: lr.urgency || "normal",
                  title: lr.title || "Preliminary Investigation Recommendation",
                  recommendationText: lr.recommendationText || lr.recommendation_text || "",
                  disciplinaryAction: lr.disciplinaryAction || lr.disciplinary_action,
                  forwardTo: lr.forwardTo || lr.forward_to || "disciplinary_branch",
                  targetDate: lr.targetDate || lr.target_date,
                  referenceNotes: lr.referenceNotes || lr.reference_notes,
                  issuedChargeSheet: lr.issuedChargeSheet || lr.issued_charge_sheet || lr.chargeSheetIssued,
                  chargeSheetIssuedDate: lr.chargeSheetIssuedDate || lr.charge_sheet_issued_date || lr.issuedChargeSheetDate,
                  chargeSheetResponseDate: lr.chargeSheetResponseDate || lr.charge_sheet_response_date || lr.responseChargeSheetDate,
                  disciplinaryOrder: lr.disciplinaryOrder || lr.disciplinary_order,
                  disciplinaryAuthority: lr.disciplinaryAuthority || lr.disciplinary_authority || "",
                  dateRequestDocuments: lr.dateRequestDocuments || lr.date_request_documents || "",
                  dateSubmissionDocuments: lr.dateSubmissionDocuments || lr.date_submission_documents || "",
                  agreeWithAnswers: lr.agreeWithAnswers || lr.agree_with_answers || "",
                  dateDraftSubmittedPsc: lr.dateDraftSubmittedPsc || lr.date_draft_submitted_psc || "",
                  agreeWithPscDecision: lr.agreeWithPscDecision || lr.agree_with_psc_decision || "",
                  secretaryApprovalDate: lr.secretaryApprovalDate || lr.secretary_approval_date || lr.date_approved_by_secretary || "",
                  secretaryApprovedRecommendation: lr.secretaryApprovedRecommendation || lr.secretary_approved_recommendation || lr.recommendation_approved_by_secretary || "",
                  status: lr.status || "Submitted",
                  submittedAt: lr.submittedAt || lr.submitted_at,
                  updatedAt: lr.updatedAt || lr.updated_at,
                });
              }
            });
          }
        }

        const storedCases = localStorage.getItem("dcmms_cases");
        if (storedCases) {
          const parsed = JSON.parse(storedCases);
          if (Array.isArray(parsed)) {
            parsed.forEach((c: any) => {
              const cNo = c.caseNo || c.refNo || c.id;
              if (!cNo) return;
              const key = cNo.trim().toLowerCase();
              const isInitialComplete = !!(
                c.initialInvestigationComplete ||
                c.initial_investigation_complete ||
                c.status === "Informing Officer In Charge - Initial Investigation Complete" ||
                c.status === "Investigation Completed" ||
                c.status === "Implementation of Recommendations" ||
                c.initialCompletedDate
              );
              
              // Only add new case if investigation was completed/submitted by admin, or if already exists in casesMap (e.g. from DB)
              if (isInitialComplete || casesMap.has(key)) {
                const existing: CaseOption = casesMap.get(key) || { caseNo: cNo };
                casesMap.set(key, {
                  ...existing,
                  caseNo: cNo,
                  letterNo: c.letterNo || c.letter_no || existing.letterNo,
                  subject: c.subject || existing.subject,
                  accusedName: c.accusedName || c.accusedOfficer || c.officerName || existing.accusedName,
                  accusedDesignation: c.designation || existing.accusedDesignation,
                  schoolName: c.schoolName || c.instituteName || existing.schoolName,
                  initialCompletedDate: c.initialCompletedDate || c.initialInvestigationCompletedAt || existing.initialCompletedDate,
                });
              }
            });
          }
        }

        const storedAsgns = localStorage.getItem("dcmms_subject_assignments");
        if (storedAsgns) {
          const parsed = JSON.parse(storedAsgns);
          if (Array.isArray(parsed)) {
            parsed.forEach((a: any) => {
              const cNo = a.caseNo || a.case_no;
              if (!cNo) return;
              const key = cNo.trim().toLowerCase();
              const isInitialComplete = !!(
                a.initialInvestigationComplete ||
                a.initial_investigation_complete ||
                a.status === "Informing Officer In Charge - Initial Investigation Complete" ||
                a.status === "Investigation Completed" ||
                a.status === "Implementation of Recommendations" ||
                a.reportSubmitDate ||
                a.reportContent ||
                a.initialInvestigationCompletedAt
              );

              // Only add new case if investigation was completed/submitted by admin, or if already exists in casesMap
              if (isInitialComplete || casesMap.has(key)) {
                const existing: CaseOption = casesMap.get(key) || { caseNo: cNo };
                casesMap.set(key, {
                  ...existing,
                  caseNo: cNo,
                  initialCompletedDate: a.initialInvestigationCompletedAt || a.initial_investigation_completed_at || existing.initialCompletedDate,
                  hasRecommendation: a.recommendationSubmitted || a.recommendation_submitted || existing.hasRecommendation,
                });
              }
            });
          }
        }
      } catch (e) {}
    }

    const casesArr = Array.from(casesMap.values());
    setAvailableCases(casesArr);

    // Merge casesMap and recsList so ALL cases are present in the list view
    const mergedList: RecommendationRecord[] = [];
    const processedKeys = new Set<string>();

    // 1. Process all existing recommendations
    recsList.forEach((r) => {
      const key = (r.caseNo || "").trim().toLowerCase();
      if (!key) return;
      processedKeys.add(key);

      const caseMeta = casesMap.get(key);
      mergedList.push({
        ...r,
        letterNo: r.letterNo || caseMeta?.letterNo || "",
        accusedName: r.accusedName || caseMeta?.accusedName || "",
        accusedDesignation: r.accusedDesignation || caseMeta?.accusedDesignation || "",
        schoolName: r.schoolName || caseMeta?.schoolName || "",
        subject: r.title || caseMeta?.subject || "Preliminary Investigation Completed",
        initialCompletedDate: caseMeta?.initialCompletedDate || "",
      });
    });

    // 2. Include all available cases that do not have a formulated recommendation yet
    casesMap.forEach((c, key) => {
      if (!processedKeys.has(key)) {
        processedKeys.add(key);
        mergedList.push({
          caseNo: c.caseNo,
          letterNo: c.letterNo || c.caseNo,
          category: "issuing_charge_sheet",
          urgency: "normal",
          title: c.subject || "Preliminary Investigation Completed",
          recommendationText: "",
          disciplinaryAction: "",
          forwardTo: "disciplinary_branch",
          targetDate: "",
          referenceNotes: "",
          issuedChargeSheet: "",
          chargeSheetIssuedDate: "",
          chargeSheetResponseDate: "",
          disciplinaryOrder: "",
          disciplinaryAuthority: "",
          dateRequestDocuments: "",
          dateSubmissionDocuments: "",
          agreeWithAnswers: "",
          dateDraftSubmittedPsc: "",
          agreeWithPscDecision: "",
          secretaryApprovalDate: "",
          secretaryApprovedRecommendation: "",
          status: "Awaiting Recommendation",
          submittedAt: "",
          updatedAt: c.initialCompletedDate || "",
          accusedName: c.accusedName || "",
          accusedDesignation: c.accusedDesignation || "",
          schoolName: c.schoolName || "",
          subject: c.subject || "Preliminary Investigation Completed",
          initialCompletedDate: c.initialCompletedDate || "",
        });
      }
    });

    setAllRecommendations(mergedList);

    // If no caseNo currently set, select the first available case
    if (!caseNoParam && casesArr.length > 0) {
      const firstCase = casesArr[0].caseNo;
      setCaseNo(firstCase);
      fetchCaseDetails(firstCase);
    }
  };

  // Load single case details and existing recommendation
  const fetchCaseDetails = async (targetCaseNo: string) => {
    if (!targetCaseNo) return;
    setIsLoading(true);
    const qLower = targetCaseNo.trim().toLowerCase();

    // Reset fields before loading
    setLetterNo("");
    setComplainantName("");
    setAccusedName("");
    setAccusedDesignation("");
    setSchoolName("");
    setCaseSubject("");
    setInitialCompletedDate("");
    setRecommendationCategory("formal_inquiry");
    setRecommendationUrgency("normal");
    setForwardTo("disciplinary_branch");
    setRecommendationTitle("");
    setRecommendationText("");
    setDisciplinaryAction("");
    setTargetDate("");
    setReferenceNotes("");
    setRecommendationStatus("Submitted");
    setIssuedChargeSheet("");
    setChargeSheetIssuedDate("");
    setChargeSheetResponseDate("");
    setDisciplinaryOrder("");
    setDisciplinaryAuthority("secretary_of_education");
    setDateRequestDocuments("");
    setDateSubmissionDocuments("");
    setAgreeWithAnswers("");
    setDateDraftSubmittedPsc("");
    setAgreeWithPscDecision("");
    setSecretaryApprovalDate("");
    setSecretaryApprovedRecommendation("");

    try {
      // 1. Fetch from PostgreSQL server action
      const caseDetailsRes = await getCaseDetailsForRecommendationServer(targetCaseNo);
      if (caseDetailsRes?.success && caseDetailsRes.data) {
        const d = caseDetailsRes.data;
        if (d.letterNo) setLetterNo(d.letterNo);
        if (d.complainantName) setComplainantName(d.complainantName);
        if (d.accusedName) setAccusedName(d.accusedName);
        if (d.accusedDesignation) setAccusedDesignation(d.accusedDesignation);
        if (d.schoolName) setSchoolName(d.schoolName);
        if (d.caseSubject) setCaseSubject(d.caseSubject);
        if (d.initialCompletedDate) setInitialCompletedDate(d.initialCompletedDate);

        if (d.recommendation) {
          const rec = d.recommendation;
          if (rec.category) setRecommendationCategory(rec.category);
          if (rec.urgency) setRecommendationUrgency(rec.urgency);
          if (rec.title) setRecommendationTitle(rec.title);
          if (rec.recommendationText) setRecommendationText(rec.recommendationText);
          if (rec.disciplinaryAction) setDisciplinaryAction(rec.disciplinaryAction);
          if (rec.forwardTo) setForwardTo(rec.forwardTo);
          if (rec.targetDate) setTargetDate(rec.targetDate);
          if (rec.referenceNotes) setReferenceNotes(rec.referenceNotes);
          if (rec.status) setRecommendationStatus(rec.status);
          if (rec.issuedChargeSheet) setIssuedChargeSheet(rec.issuedChargeSheet);
          if (rec.chargeSheetIssuedDate) setChargeSheetIssuedDate(rec.chargeSheetIssuedDate);
          if (rec.chargeSheetResponseDate) setChargeSheetResponseDate(rec.chargeSheetResponseDate);
          if (rec.disciplinaryOrder) setDisciplinaryOrder(rec.disciplinaryOrder);
          if (rec.disciplinaryAuthority || rec.disciplinary_authority) setDisciplinaryAuthority(rec.disciplinaryAuthority || rec.disciplinary_authority);
          if (rec.dateRequestDocuments || rec.date_request_documents) setDateRequestDocuments(rec.dateRequestDocuments || rec.date_request_documents);
          if (rec.dateSubmissionDocuments || rec.date_submission_documents) setDateSubmissionDocuments(rec.dateSubmissionDocuments || rec.date_submission_documents);
          if (rec.agreeWithAnswers || rec.agree_with_answers) setAgreeWithAnswers(rec.agreeWithAnswers || rec.agree_with_answers);
          if (rec.dateDraftSubmittedPsc || rec.date_draft_submitted_psc) setDateDraftSubmittedPsc(rec.dateDraftSubmittedPsc || rec.date_draft_submitted_psc);
          if (rec.agreeWithPscDecision || rec.agree_with_psc_decision) setAgreeWithPscDecision(rec.agreeWithPscDecision || rec.agree_with_psc_decision);
          if (rec.secretaryApprovalDate) setSecretaryApprovalDate(rec.secretaryApprovalDate);
          if (rec.secretaryApprovedRecommendation) setSecretaryApprovedRecommendation(rec.secretaryApprovedRecommendation);
        }
      }

      // 2. LocalStorage Fallback for any supplemental fields
      if (typeof window !== "undefined") {
        const localCases = JSON.parse(localStorage.getItem("dcmms_cases") || "[]");
        const foundCase = Array.isArray(localCases)
          ? localCases.find((c: any) => String(c.caseNo || c.refNo || c.id || "").trim().toLowerCase() === qLower)
          : null;

        if (foundCase) {
          if (foundCase.subject) setCaseSubject((prev) => prev || foundCase.subject);
          if (foundCase.complainantName || foundCase.senderName) setComplainantName((prev) => prev || foundCase.complainantName || foundCase.senderName);
          if (foundCase.accusedName || foundCase.accusedOfficer || foundCase.officerName) setAccusedName((prev) => prev || foundCase.accusedName || foundCase.accusedOfficer || foundCase.officerName);
          if (foundCase.designation) setAccusedDesignation((prev) => prev || foundCase.designation);
          if (foundCase.schoolName || foundCase.instituteName) setSchoolName((prev) => prev || foundCase.schoolName || foundCase.instituteName);
          if (foundCase.initialCompletedDate) setInitialCompletedDate((prev) => prev || foundCase.initialCompletedDate);
        }

        const localRecs = JSON.parse(localStorage.getItem("dcmms_recommendations") || "[]");
        const foundRec = Array.isArray(localRecs)
          ? localRecs.find((r: any) => String(r.caseNo || r.case_no || "").trim().toLowerCase() === qLower)
          : null;

        if (foundRec) {
          if (foundRec.category) setRecommendationCategory((prev) => prev || foundRec.category);
          if (foundRec.urgency) setRecommendationUrgency((prev) => prev || foundRec.urgency);
          if (foundRec.title) setRecommendationTitle((prev) => prev || foundRec.title);
          if (foundRec.recommendationText) setRecommendationText((prev) => prev || foundRec.recommendationText);
          if (foundRec.disciplinaryAction) setDisciplinaryAction((prev) => prev || foundRec.disciplinaryAction);
          if (foundRec.forwardTo) setForwardTo((prev) => prev || foundRec.forwardTo);
          if (foundRec.targetDate) setTargetDate((prev) => prev || foundRec.targetDate);
          if (foundRec.referenceNotes) setReferenceNotes((prev) => prev || foundRec.referenceNotes);
          if (foundRec.status) setRecommendationStatus((prev) => prev || foundRec.status);
          if (foundRec.issuedChargeSheet) setIssuedChargeSheet((prev) => prev || foundRec.issuedChargeSheet);
          if (foundRec.chargeSheetIssuedDate) setChargeSheetIssuedDate((prev) => prev || foundRec.chargeSheetIssuedDate);
          if (foundRec.chargeSheetResponseDate) setChargeSheetResponseDate((prev) => prev || foundRec.chargeSheetResponseDate);
          if (foundRec.disciplinaryOrder) setDisciplinaryOrder((prev) => prev || foundRec.disciplinaryOrder);
          if (foundRec.disciplinaryAuthority || foundRec.disciplinary_authority) setDisciplinaryAuthority((prev) => prev || foundRec.disciplinaryAuthority || foundRec.disciplinary_authority);
          if (foundRec.dateRequestDocuments || foundRec.date_request_documents) setDateRequestDocuments((prev) => prev || foundRec.dateRequestDocuments || foundRec.date_request_documents);
          if (foundRec.dateSubmissionDocuments || foundRec.date_submission_documents) setDateSubmissionDocuments((prev) => prev || foundRec.dateSubmissionDocuments || foundRec.date_submission_documents);
          if (foundRec.agreeWithAnswers || foundRec.agree_with_answers) setAgreeWithAnswers((prev) => prev || foundRec.agreeWithAnswers || foundRec.agree_with_answers);
          if (foundRec.dateDraftSubmittedPsc || foundRec.date_draft_submitted_psc) setDateDraftSubmittedPsc((prev) => prev || foundRec.dateDraftSubmittedPsc || foundRec.date_draft_submitted_psc);
          if (foundRec.agreeWithPscDecision || foundRec.agree_with_psc_decision) setAgreeWithPscDecision((prev) => prev || foundRec.agreeWithPscDecision || foundRec.agree_with_psc_decision);
          if (foundRec.secretaryApprovalDate) setSecretaryApprovalDate((prev) => prev || foundRec.secretaryApprovalDate);
          if (foundRec.secretaryApprovedRecommendation) setSecretaryApprovedRecommendation((prev) => prev || foundRec.secretaryApprovedRecommendation);
        }
      }
    } catch (e) {
      console.error("Fetch case error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCasesAndRecommendationsList();
  }, []);

  useEffect(() => {
    const activeCase = caseNoParam || caseNo;
    if (activeCase) {
      fetchCaseDetails(activeCase);
    }
  }, [caseNoParam, caseNo]);

  // Quick Preset Handlers
  const handleApplyPreset = (text: string) => {
    setRecommendationText((prev) => (prev ? `${prev}\n• ${text}` : `• ${text}`));
  };

  // Save Draft Handler
  const handleSaveDraft = async () => {
    if (!caseNo.trim()) {
      showToast(lang === "si" ? "කරුණාකර නඩුවක් තෝරන්න." : "Please select or specify a case number.");
      return;
    }

    setIsSaving(true);
    const now = new Date().toISOString().slice(0, 10);
    const isChargeSheet = activeFormType === "charge_sheet";
    const categoryToSave = isChargeSheet ? "issuing_charge_sheet" : (recommendationCategory || "formal_inquiry");
    const isApprovedDecision = isChargeSheet && (
      (disciplinaryAuthority === "psc_esc" && agreeWithPscDecision === "yes") ||
      (disciplinaryAuthority !== "psc_esc" && agreeWithAnswers === "yes")
    );
    const statusToSave = isApprovedDecision ? "Closed" : "Draft";

    const payload: any = {
      ref_number: caseNo,
      case_no: caseNo,
      letter_no: letterNo || null,
      category_recommendation: categoryToSave,
      category: categoryToSave,
      case_status: statusToSave,
      status: statusToSave,
      target_implementation_date: targetDate || null,
      target_date: targetDate || null,
      investigation_recommendation: recommendationText || (isChargeSheet ? (disciplinaryOrder || "Charge Sheet In Progress") : ""),
      recommendation_text: recommendationText || (isChargeSheet ? (disciplinaryOrder || "Charge Sheet In Progress") : ""),
      circular_reference: disciplinaryAction || null,
      disciplinary_action: disciplinaryAction || null,
      minute_ref: referenceNotes || null,
      reference_notes: referenceNotes || null,
      urgency: recommendationUrgency,
      title: recommendationTitle || (isChargeSheet
        ? (lang === "si" ? "චෝදනා පත්‍ර කෙටුම්පත" : "Charge Sheet Draft")
        : (lang === "si" ? "මූලික විමර්ශන කෙටුම්පත් නිර්දේශය" : "Draft Preliminary Recommendation")),
      forward_to: forwardTo,
      date_approved_by_secretory: isChargeSheet ? (secretaryApprovalDate || null) : null,
      secretary_approval_date: isChargeSheet ? (secretaryApprovalDate || null) : null,
      secretory_recommendation: isChargeSheet ? (secretaryApprovedRecommendation || null) : null,
      secretary_approved_recommendation: isChargeSheet ? (secretaryApprovedRecommendation || null) : null,
      issued_charge_sheet: isChargeSheet ? issuedChargeSheet : null,
      charge_sheet_issued_date: isChargeSheet ? (chargeSheetIssuedDate || null) : null,
      date_the_charge_sheet_issued: isChargeSheet ? (chargeSheetIssuedDate || null) : null,
      charge_sheet_response_date: isChargeSheet ? (chargeSheetResponseDate || null) : null,
      date_the_response_to_the_charge_sheet_was_given: isChargeSheet ? (chargeSheetResponseDate || null) : null,
      disciplinary_order: isChargeSheet ? disciplinaryOrder : null,
      disciplinary_authority: isChargeSheet ? disciplinaryAuthority : null,
      date_request_documents: isChargeSheet ? (dateRequestDocuments || null) : null,
      date_submission_documents: isChargeSheet ? (dateSubmissionDocuments || null) : null,
      agree_with_answers: (isChargeSheet && disciplinaryAuthority !== "psc_esc") ? (agreeWithAnswers || null) : null,
      date_draft_submitted_psc: (isChargeSheet && disciplinaryAuthority === "psc_esc") ? (dateDraftSubmittedPsc || null) : null,
      agree_with_psc_decision: (isChargeSheet && disciplinaryAuthority === "psc_esc") ? (agreeWithPscDecision || null) : null,
    };

    try {
      await saveRecommendationServer(payload);

      const profile = await getCurrentProfile();
      await logAuditEvent(
        isChargeSheet ? "SAVE_CHARGE_SHEET_DRAFT" : "SAVE_RECOMMENDATION_DRAFT",
        "Recommendation",
        caseNo,
        { title: payload.title, category: categoryToSave },
        profile?.full_name || profile?.id || "Subject Officer"
      );

      if (typeof window !== "undefined") {
        const storedRecs = localStorage.getItem("dcmms_recommendations") || "[]";
        let recList = [];
        try { recList = JSON.parse(storedRecs); } catch (e) {}
        recList = recList.filter((r: any) => String(r.caseNo || r.case_no || "").trim().toLowerCase() !== caseNo.trim().toLowerCase());
        recList.push({
          caseNo,
          letterNo,
          category: categoryToSave,
          urgency: recommendationUrgency,
          title: payload.title,
          recommendationText: payload.recommendation_text,
          disciplinaryAction,
          forwardTo,
          targetDate,
          referenceNotes,
          issuedChargeSheet: isChargeSheet ? issuedChargeSheet : "",
          chargeSheetIssuedDate: isChargeSheet ? chargeSheetIssuedDate : "",
          chargeSheetResponseDate: isChargeSheet ? chargeSheetResponseDate : "",
          disciplinaryOrder: isChargeSheet ? disciplinaryOrder : "",
          disciplinaryAuthority: isChargeSheet ? disciplinaryAuthority : "",
          dateRequestDocuments: isChargeSheet ? dateRequestDocuments : "",
          dateSubmissionDocuments: isChargeSheet ? dateSubmissionDocuments : "",
          agreeWithAnswers: (isChargeSheet && disciplinaryAuthority !== "psc_esc") ? agreeWithAnswers : "",
          dateDraftSubmittedPsc: (isChargeSheet && disciplinaryAuthority === "psc_esc") ? dateDraftSubmittedPsc : "",
          agreeWithPscDecision: (isChargeSheet && disciplinaryAuthority === "psc_esc") ? agreeWithPscDecision : "",
          secretaryApprovalDate: isChargeSheet ? secretaryApprovalDate : "",
          secretaryApprovedRecommendation: isChargeSheet ? secretaryApprovedRecommendation : "",
          status: statusToSave,
          updatedAt: now
        });
        localStorage.setItem("dcmms_recommendations", JSON.stringify(recList));
        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(new CustomEvent("dcmms_recommendation_updated"));
      }

      showToast(lang === "si" ? "කෙටුම්පත සාර්ථකව සුරකින ලදී!" : "Draft saved successfully!");
      loadCasesAndRecommendationsList();
    } catch (err) {
      console.error("Save draft error:", err);
      showToast(lang === "si" ? "කෙටුම්පත සුරකින ලදී." : "Draft saved locally.");
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!caseNo.trim()) {
      showToast(lang === "si" ? "කරුණාකර නඩුවක් තෝරන්න." : "Please select or specify a case number.");
      return;
    }

    const isChargeSheet = activeFormType === "charge_sheet";

    if (isChargeSheet) {
      if (!issuedChargeSheet) {
        showToast(lang === "si" ? "කරුණාකර නිකුත් කරන ලද චෝදනා පත්‍රය තෝරන්න." : "Please select the issued charge sheet.");
        return;
      }
      if (!chargeSheetIssuedDate) {
        showToast(lang === "si" ? "කරුණාකර චෝදනා පත්‍රය නිකුත් කළ දිනය ඇතුලත් කරන්න." : "Please enter the date of charge sheet issued.");
        return;
      }
    } else {
      if (!recommendationText.trim()) {
        showToast(lang === "si" ? "කරුණාකර නිර්දේශ විස්තර ඇතුළත් කරන්න." : "Please provide detailed recommendation text.");
        return;
      }
    }

    setIsSaving(true);
    const now = new Date().toISOString().slice(0, 10);
    const categoryToSave = isChargeSheet ? "issuing_charge_sheet" : (recommendationCategory || "formal_inquiry");
    const isDecisionApproved = isChargeSheet && (
      (disciplinaryAuthority === "psc_esc" ? agreeWithPscDecision === "yes" : agreeWithAnswers === "yes")
    );
    const isFormalInspection = !isChargeSheet && (
      recommendationCategory === "formal_inquiry" ||
      recommendationStatus === "Formal Disciplinary Inspection"
    );

    const targetStatus = isChargeSheet
      ? (isDecisionApproved ? "Closed" : (recommendationStatus || "Submitted"))
      : (isFormalInspection ? "Formal Disciplinary Inspection" : (recommendationStatus || "Implementation of Recommendations"));

    const targetStage = isChargeSheet
      ? (isDecisionApproved ? "Closed" : "Formal Charge Sheet Issued")
      : (isFormalInspection ? "Formal Disciplinary Inspection" : "Implementation of Recommendations");

    const targetStageKey = isChargeSheet
      ? (isDecisionApproved ? "closed" : "charge_sheet")
      : (isFormalInspection ? "disciplinary_inspection" : "implementation");

    const payload: any = {
      ref_number: caseNo,
      case_no: caseNo,
      letter_no: letterNo || null,
      category_recommendation: categoryToSave,
      category: categoryToSave,
      case_status: targetStatus,
      status: targetStatus,
      target_implementation_date: targetDate || null,
      target_date: targetDate || null,
      investigation_recommendation: recommendationText || (isChargeSheet ? (disciplinaryOrder || "Charge Sheet Processed") : ""),
      recommendation_text: recommendationText || (isChargeSheet ? (disciplinaryOrder || "Charge Sheet Processed") : ""),
      circular_reference: disciplinaryAction || null,
      disciplinary_action: disciplinaryAction || null,
      minute_ref: referenceNotes || null,
      reference_notes: referenceNotes || null,
      urgency: recommendationUrgency,
      title: recommendationTitle || (isChargeSheet
        ? (lang === "si" ? "චෝදනා පත්‍ර නිකුත් කිරීම" : "Issuing Charge Sheet")
        : (lang === "si" ? "මූලික විමර්ශන නිර්දේශය" : "Formal Preliminary Recommendation")),
      forward_to: forwardTo,
      date_approved_by_secretory: isChargeSheet ? (secretaryApprovalDate || null) : null,
      secretary_approval_date: isChargeSheet ? (secretaryApprovalDate || null) : null,
      secretory_recommendation: isChargeSheet ? (secretaryApprovedRecommendation || null) : null,
      secretary_approved_recommendation: isChargeSheet ? (secretaryApprovedRecommendation || null) : null,
      issued_charge_sheet: isChargeSheet ? issuedChargeSheet : null,
      charge_sheet_issued_date: isChargeSheet ? (chargeSheetIssuedDate || null) : null,
      date_the_charge_sheet_issued: isChargeSheet ? (chargeSheetIssuedDate || null) : null,
      charge_sheet_response_date: isChargeSheet ? (chargeSheetResponseDate || null) : null,
      date_the_response_to_the_charge_sheet_was_given: isChargeSheet ? (chargeSheetResponseDate || null) : null,
      disciplinary_order: isChargeSheet ? disciplinaryOrder : null,
      disciplinary_authority: isChargeSheet ? disciplinaryAuthority : null,
      date_request_documents: isChargeSheet ? (dateRequestDocuments || null) : null,
      date_submission_documents: isChargeSheet ? (dateSubmissionDocuments || null) : null,
      agree_with_answers: (isChargeSheet && disciplinaryAuthority !== "psc_esc") ? (agreeWithAnswers || null) : null,
      date_draft_submitted_psc: (isChargeSheet && disciplinaryAuthority === "psc_esc") ? (dateDraftSubmittedPsc || null) : null,
      agree_with_psc_decision: (isChargeSheet && disciplinaryAuthority === "psc_esc") ? (agreeWithPscDecision || null) : null,
    };

    try {
      await saveRecommendationServer(payload);

      const profile = await getCurrentProfile();
      await logAuditEvent(
        isChargeSheet
          ? "SUBMIT_CHARGE_SHEET"
          : (isFormalInspection ? "ASSIGN_PROPER_DISCIPLINARY_INSPECTION" : "SUBMIT_RECOMMENDATION"),
        "Recommendation",
        caseNo,
        { title: payload.title, category: categoryToSave },
        profile?.full_name || profile?.id || "Subject Officer"
      );

      if (typeof window !== "undefined") {
        const storedRecs = localStorage.getItem("dcmms_recommendations") || "[]";
        let recList = [];
        try { recList = JSON.parse(storedRecs); } catch (e) {}
        recList = recList.filter((r: any) => String(r.caseNo || r.case_no || "").trim().toLowerCase() !== caseNo.trim().toLowerCase());
        recList.push({
          caseNo,
          letterNo,
          category: categoryToSave,
          urgency: recommendationUrgency,
          title: payload.title,
          recommendationText: payload.recommendation_text,
          disciplinaryAction,
          forwardTo,
          targetDate,
          referenceNotes,
          issuedChargeSheet: isChargeSheet ? issuedChargeSheet : "",
          chargeSheetIssuedDate: isChargeSheet ? chargeSheetIssuedDate : "",
          chargeSheetResponseDate: isChargeSheet ? chargeSheetResponseDate : "",
          disciplinaryOrder: isChargeSheet ? disciplinaryOrder : "",
          disciplinaryAuthority: isChargeSheet ? disciplinaryAuthority : "",
          dateRequestDocuments: isChargeSheet ? dateRequestDocuments : "",
          dateSubmissionDocuments: isChargeSheet ? dateSubmissionDocuments : "",
          agreeWithAnswers: (isChargeSheet && disciplinaryAuthority !== "psc_esc") ? agreeWithAnswers : "",
          dateDraftSubmittedPsc: (isChargeSheet && disciplinaryAuthority === "psc_esc") ? dateDraftSubmittedPsc : "",
          agreeWithPscDecision: (isChargeSheet && disciplinaryAuthority === "psc_esc") ? agreeWithPscDecision : "",
          secretaryApprovalDate: isChargeSheet ? secretaryApprovalDate : "",
          secretaryApprovedRecommendation: isChargeSheet ? secretaryApprovedRecommendation : "",
          status: targetStatus,
          stage: targetStage,
          stageKey: targetStageKey,
          isProperDisciplinary: isFormalInspection || isChargeSheet,
          submittedAt: now,
          updatedAt: now
        });
        localStorage.setItem("dcmms_recommendations", JSON.stringify(recList));

        // Sync dcmms_cases
        const storedCases = localStorage.getItem("dcmms_cases") || "[]";
        let caseList = [];
        try { caseList = JSON.parse(storedCases); } catch (e) {}
        caseList = caseList.map((c: any) => {
          if (String(c.caseNo || c.refNo || "").trim().toLowerCase() === caseNo.trim().toLowerCase()) {
            return {
              ...c,
              status: targetStatus,
              stage: targetStage,
              stageKey: targetStageKey,
              isProperDisciplinary: isFormalInspection || isChargeSheet,
            };
          }
          return c;
        });
        localStorage.setItem("dcmms_cases", JSON.stringify(caseList));

        // Sync dcmms_letters status if decision is approved (closed)
        if (isDecisionApproved) {
          try {
            const storedLetters = localStorage.getItem("dcmms_letters") || "[]";
            let letterList = JSON.parse(storedLetters);
            if (Array.isArray(letterList)) {
              const matchKey = caseNo.trim().toLowerCase();
              const letKey = (letterNo || "").trim().toLowerCase();
              letterList = letterList.map((l: any) => {
                const cMatch = String(l.caseNo || l.refNo || "").trim().toLowerCase() === matchKey;
                const lMatch = letKey && String(l.letterNo || l.letter_no || "").trim().toLowerCase() === letKey;
                if (cMatch || lMatch) {
                  return {
                    ...l,
                    status: "Closed",
                    letterStatus: "Closed",
                    stage: "Closed",
                  };
                }
                return l;
              });
              localStorage.setItem("dcmms_letters", JSON.stringify(letterList));
            }
          } catch (lErr) {}
        }

        // Sync subject assignments
        const storedAsgns = localStorage.getItem("dcmms_subject_assignments") || "[]";
        let asgnList = [];
        try { asgnList = JSON.parse(storedAsgns); } catch (e) {}
        asgnList = asgnList.map((a: any) => {
          if (String(a.caseNo || a.case_no || "").trim().toLowerCase() === caseNo.trim().toLowerCase()) {
            return {
              ...a,
              status: targetStatus,
              stage: targetStage,
              stageKey: targetStageKey,
              isProperDisciplinary: isFormalInspection || isChargeSheet,
              recommendationSubmitted: true,
              recommendationSubmittedAt: now,
              recommendationText: payload.recommendation_text,
              recommendationCategory: categoryToSave,
            };
          }
          return a;
        });
        localStorage.setItem("dcmms_subject_assignments", JSON.stringify(asgnList));

        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(new CustomEvent("dcmms_assignment_updated"));
        window.dispatchEvent(new CustomEvent("dcmms_recommendation_updated"));
      }

      showToast(
        isChargeSheet
          ? (lang === "si" ? "චෝදනා පත්‍ර විස්තර සාර්ථකව ඉදිරිපත් කරන ලදී!" : "Charge Sheet details submitted successfully!")
          : (lang === "si" ? "මූලික විමර්ශන නිර්දේශය සාර්ථකව ඉදිරිපත් කරන ලදී!" : "Preliminary Investigation Recommendation submitted successfully!")
      );
      loadCasesAndRecommendationsList();

      setTimeout(() => {
        if (isChargeSheet || recommendationCategory === "issuing_charge_sheet") {
          router.push(`/subject?tab=issuing_charge_sheet&caseNo=${encodeURIComponent(caseNo)}`);
        } else if (isFormalInspection) {
          router.push(`/subject?tab=disciplinary_inspection&caseNo=${encodeURIComponent(caseNo)}`);
        } else {
          setViewMode("list");
        }
      }, 1200);
    } catch (err) {
      console.error("Submit error:", err);
      showToast(lang === "si" ? "සුරැකීමේ දෝෂයක් සිදු විය." : "Error submitting record.");
    } finally {
      setIsSaving(false);
    }
  };

  const getCategoryLabel = (cat?: string) => {
    switch (cat) {
      case "formal_inquiry":
        return lang === "si" ? "විධිමත් විනය පරීක්ෂණයක් පැවැත්වීම" : "Formal Disciplinary Inquiry";
      case "issuing_charge_sheet":
        return lang === "si" ? "චෝදනා පත්‍රයක් නිකුත් කිරීම" : "Issuing Charge Sheet";
      case "issue_warning":
      case "giving_warnings_advice":
        return lang === "si" ? "දැඩි අවවාද නිකුත් කිරීම" : "Issue Severe Warning";
      case "financial_recovery":
        return lang === "si" ? "අලාභ අයකර ගැනීම / අධිභාරය" : "Surcharge / Recovery";
      case "interdiction":
        return lang === "si" ? "වැඩ තහනම් කිරීම" : "Interdiction / Suspension";
      case "transfer":
      case "transfers":
        return lang === "si" ? "ස්ථාන මාරු කිරීම" : "Administrative / Disciplinary Transfer";
      case "exoneration":
      case "closing_action_non_disclosure":
        return lang === "si" ? "චෝදනාවලින් නිදොස් කොට ගොනුව අවසන් කිරීම" : "Exonerate & File Closed";
      case "court_verdict":
      case "action_based_on_court_verdict":
        return lang === "si" ? "අධිකරණ තීන්දුව මත ක්‍රියාමාර්ග" : "Action Based on Court Verdict";
      case "refer_ciaboc_police":
        return lang === "si" ? "අල්ලස් / පොලිස් විමර්ශන වෙත යොමු කිරීම" : "Refer to CIABOC / Police";
      case "charging_based_on_more_104":
        return lang === "si" ? "MoRE 104 චෝදනා" : "MoRE 104 Charging";
      case "terminating_service":
        return lang === "si" ? "සේවය අවසන් කිරීම" : "Terminating Service";
      case "sending_recommendation_other_departments":
        return lang === "si" ? "වෙනත් දෙපාර්තමේන්තු වෙත" : "Other Departments";
      case "other":
        return lang === "si" ? "වෙනත් විශේෂ නිර්දේශ" : "Other Special Action";
      default:
        return cat || "General Recommendation";
    }
  };

  const getForwardToLabel = (fwd?: string) => {
    switch (fwd) {
      case "disciplinary_branch":
        return lang === "si" ? "විනය අංශය" : "Disciplinary Branch";
      case "secretary_education":
        return lang === "si" ? "අමාත්‍යාංශ ලේකම්" : "Secretary of Education";
      case "provincial_director":
        return lang === "si" ? "පළාත් අධ්‍යක්ෂ" : "Provincial Director";
      case "zonal_director":
        return lang === "si" ? "කලාප අධ්‍යක්ෂ" : "Zonal Director";
      case "public_service_commission":
        return lang === "si" ? "රාජ්‍ය සේවා කොමිෂන් සභාව" : "Public Service Commission";
      default:
        return fwd || "Administration";
    }
  };

  const filteredRecommendations = allRecommendations.filter((item) => {
    if (recCategoryFilter !== "all" && item.category !== recCategoryFilter) return false;
    if (recUrgencyFilter !== "all" && item.urgency !== recUrgencyFilter) return false;
    if (recStatusFilter !== "all") {
      if (recStatusFilter === "Awaiting Recommendation" && item.status !== "Awaiting Recommendation") return false;
      if (recStatusFilter === "Draft" && item.status !== "Draft") return false;
      if (recStatusFilter === "Submitted" && item.status !== "Submitted" && item.status !== "Implementation of Recommendations") return false;
      if (recStatusFilter === "Approved" && item.status !== "Approved") return false;
      if (recStatusFilter === "Closed" && item.status !== "Closed" && item.agreeWithAnswers !== "yes" && item.agreeWithPscDecision !== "yes") return false;
    }

    if (recSearchQuery.trim()) {
      const q = recSearchQuery.toLowerCase();
      const matchNo = (item.caseNo || "").toLowerCase().includes(q);
      const matchLetter = (item.letterNo || "").toLowerCase().includes(q);
      const matchTitle = (item.title || "").toLowerCase().includes(q);
      const matchText = (item.recommendationText || "").toLowerCase().includes(q);
      const matchAcc = (item.accusedName || item.officerName || "").toLowerCase().includes(q);
      const matchSchool = (item.schoolName || "").toLowerCase().includes(q);
      const matchSubject = (item.subject || "").toLowerCase().includes(q);
      return matchNo || matchLetter || matchTitle || matchText || matchAcc || matchSchool || matchSubject;
    }
    return true;
  });

  const pendingCases = allRecommendations.filter((r) => r.status === "Awaiting Recommendation" || (!r.category && !r.recommendationText));

  if (!mounted) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" }}>
        <div style={{ color: "#64748b", fontWeight: 600, fontSize: "14px" }}>
          {lang === "si" ? "ආයතනික මූලික විමර්ශනයේ නිර්දේශය පූරණය වෙමින්..." : "Loading Investigation Recommendation..."}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout" style={{ minHeight: "100vh", display: "flex", backgroundColor: "#f8fafc" }} suppressHydrationWarning>
      {/* Universal Responsive Sidebar */}
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
        role="subject"
      />

      <div className="main-content-wrapper" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top Header */}
        <header className="top-header" style={{ padding: "14px 28px", backgroundColor: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }} suppressHydrationWarning>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              className="btn-menu-toggle mobile-only"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open navigation menu"
              style={{ background: "none", border: "none", cursor: "pointer", color: "#1e293b" }}
            >
              <Menu size={22} />
            </button>
            <div className="breadcrumb-box" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 600, color: "#475569" }} suppressHydrationWarning>
              <Link href="/subject" style={{ color: "#4f46e5", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
                <ArrowLeft size={16} />
                <span suppressHydrationWarning>{lang === "si" ? "විෂය නිලධාරී පුවරුව" : "Subject Dashboard"}</span>
              </Link>
              <ChevronRight size={14} style={{ color: "#94a3b8" }} />
              <span style={{ color: "#0f172a", fontWeight: 700 }} suppressHydrationWarning>
                {lang === "si" ? "ආයතනික මූලික විමර්ශනයේ නිර්දේශය" : lang === "ta" ? "நிறுவன அடிப்படை விசாரணை பரிந்துரை" : "Institutional Basic Investigation Recommendation"}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }} suppressHydrationWarning>
            <button
              type="button"
              onClick={() => setViewMode(viewMode === "form" ? "list" : "form")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                backgroundColor: viewMode === "list" ? "#e0e7ff" : "#f1f5f9",
                color: viewMode === "list" ? "#4338ca" : "#334155",
                border: "1px solid #cbd5e1",
                cursor: "pointer"
              }}
            >
              <Layers size={15} />
              <span>{viewMode === "form" ? (lang === "si" ? "සියලු නිර්දේශ ලැයිස්තුව" : "View All Recommendations") : (lang === "si" ? "නිර්දේශ පෝරමය" : "Recommendation Form")}</span>
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="recommendation-page-container" style={{ flex: 1, padding: "24px 32px 48px 32px" }}>
          {/* Toast Alert */}
          {toastMessage && (
            <div className="recommendation-toast">
              <CheckCircle2 size={20} style={{ color: "#34d399" }} />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Page Banner Header */}
          <div className="recommendation-header" style={{ marginBottom: "16px" }}>
            <div className="recommendation-title-group">
              <h1>
                {activeFormType === "charge_sheet" ? (
                  <>
                    <FileCheck size={28} style={{ color: "#d97706" }} />
                    {lang === "si"
                      ? "චෝදනා පත්‍ර නිකුත් කිරීම (Issuing Charge Sheet)"
                      : lang === "ta"
                      ? "குற்றப்பத்திரிகை வழங்குதல் (Issuing Charge Sheet)"
                      : "Issuing Charge Sheet"}
                  </>
                ) : (
                  <>
                    <ClipboardList size={28} style={{ color: "#059669" }} />
                    {lang === "si"
                      ? "ආයතනික මූලික විමර්ශනයේ නිර්දේශය (Institutional Basic Investigation Recommendation)"
                      : lang === "ta"
                      ? "நிறுவன அடிப்படை விசாரணை பரிந்துரை (Institutional Basic Investigation Recommendation)"
                      : "Institutional Basic Investigation Recommendation"}
                  </>
                )}
              </h1>
              <p>
                {activeFormType === "charge_sheet"
                  ? (lang === "si"
                      ? "ආයතන සංග්‍රහය සහ රාජ්‍ය සේවා කොමිෂන් සභා රීති යටතේ චෝදනා පත්‍ර විස්තර, උපලේඛන සහ විනය බලධාරියාගේ තීරණ කළමනාකරණය."
                      : "Formal charge sheet proceedings under Establishment Code & PSC rules, tracking of 1st/2nd schedules, disciplinary authorities, and response submissions.")
                  : (lang === "si"
                      ? "මූලික විමර්ශනය අවසන් වූ නඩුව සඳහා නිල නිර්දේශ සහ ඉදිරි විනය ක්‍රියාමාර්ග ඇතුලත් කිරීමේ ආකෘතිය."
                      : "Enter formal recommendations and subsequent disciplinary actions for the case with completed preliminary investigation.")}
              </p>

              {/* Mode Switcher Buttons */}
              <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveFormType("recommendation");
                    if (recommendationCategory === "issuing_charge_sheet") {
                      setRecommendationCategory("formal_inquiry");
                    }
                  }}
                  style={{
                    padding: "7px 15px",
                    fontSize: "12.5px",
                    fontWeight: 700,
                    borderRadius: "10px",
                    border: activeFormType === "recommendation" ? "2px solid #059669" : "1px solid #cbd5e1",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "7px",
                    backgroundColor: activeFormType === "recommendation" ? "#059669" : "#ffffff",
                    color: activeFormType === "recommendation" ? "#ffffff" : "#475569",
                    boxShadow: activeFormType === "recommendation" ? "0 4px 8px rgba(5, 150, 105, 0.25)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <ClipboardList size={15} />
                  <span>{lang === "si" ? "ආයතනික මූලික විමර්ශනයේ නිර්දේශය" : "Basic Investigation Recommendation"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveFormType("charge_sheet");
                    setRecommendationCategory("issuing_charge_sheet");
                  }}
                  style={{
                    padding: "7px 15px",
                    fontSize: "12.5px",
                    fontWeight: 700,
                    borderRadius: "10px",
                    border: activeFormType === "charge_sheet" ? "2px solid #d97706" : "1px solid #cbd5e1",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "7px",
                    backgroundColor: activeFormType === "charge_sheet" ? "#d97706" : "#ffffff",
                    color: activeFormType === "charge_sheet" ? "#ffffff" : "#475569",
                    boxShadow: activeFormType === "charge_sheet" ? "0 4px 8px rgba(217, 119, 6, 0.25)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <FileCheck size={15} />
                  <span>{lang === "si" ? "චෝදනා පත්‍ර නිකුත් කිරීම" : "Issuing Charge Sheet"}</span>
                </button>
              </div>
            </div>

            <div className="recommendation-actions">
              <Link
                href={activeFormType === "charge_sheet" ? "/subject?tab=issuing_charge_sheet" : "/subject?tab=recommendations"}
                className="btn-back-gray"
              >
                <ArrowLeft size={16} />
                <span>{lang === "si" ? "ආපසු මුල් පිටුවට" : "Back to Cases"}</span>
              </Link>
            </div>
          </div>



          {/* ============================================================
             VIEW MODE 1: FORMULATE RECOMMENDATION FORM
             ============================================================ */}
          {viewMode === "form" && (
            <>
              {/* Case Quick Selector Bar */}
              <div style={{ backgroundColor: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "12px 18px", marginBottom: "18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <label htmlFor="caseSelectorSelect" style={{ fontSize: "13px", fontWeight: 700, color: "#1e1b4b" }}>
                    {lang === "si" ? "අදාළ නඩුව තෝරන්න (Select Case):" : "Select Case for Recommendation:"}
                  </label>
                  <select
                    id="caseSelectorSelect"
                    value={caseNo}
                    onChange={(e) => {
                      const selected = e.target.value;
                      setCaseNo(selected);
                      fetchCaseDetails(selected);
                    }}
                    style={{ padding: "7px 12px", borderRadius: "8px", border: "1.5px solid #059669", fontWeight: 700, color: "#1e1b4b", fontSize: "13.5px", backgroundColor: "#f8fafc", cursor: "pointer" }}
                  >
                    {availableCases.map((c) => (
                      <option key={c.caseNo} value={c.caseNo}>
                        {c.caseNo} {c.accusedName ? `— ${c.accusedName}` : ""} {c.hasRecommendation ? "(Rec Submitted)" : "(Awaiting Rec)"}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    {availableCases.length} {lang === "si" ? "නඩු පවතී" : "cases loaded"}
                  </span>
                </div>
              </div>

              {/* Case Summary Top Card */}
              <section className="case-summary-card">
                <div className="case-summary-top">
                  <div className="case-badge-group">
                    <span className="badge-case-no">
                      {lang === "si" ? "නඩු අංකය:" : "Case Ref:"} {caseNo || "DMMS/T/02"}
                    </span>
                    <span className="badge-case-no" style={{ backgroundColor: "#f8fafc" }}>
                      {lang === "si" ? "ලිපි අංකය:" : "Letter Ref:"} {letterNo || "2"}
                    </span>
                    <span className="badge-status-completed" style={{ backgroundColor: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0", padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <CheckCircle2 size={14} style={{ color: "#16a34a" }} />
                      {lang === "si" ? "මූලික විමර්ශනය අවසන්" : "Preliminary Investigation Complete"}
                    </span>
                  </div>

                  <div style={{ fontSize: "12.5px", color: "#047857", fontWeight: 600 }}>
                    {lang === "si" ? "අවසන් කළ දිනය:" : "Completion Date:"} {initialCompletedDate || "2026-08-19"}
                  </div>
                </div>

                <div className="case-summary-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                  <div className="summary-item">
                    <span className="summary-label">{lang === "si" ? "පැමිණිලිකරුගේ නම" : "Complainant Name"}</span>
                    <span className="summary-value">{complainantName || "Samitha"}</span>
                  </div>

                  <div className="summary-item">
                    <span className="summary-label">{lang === "si" ? "චෝදනා ලැබූ නිලධාරියා" : "Accused Officer"}</span>
                    <span className="summary-value">
                      {accusedName ? (accusedDesignation ? `${accusedName} (${accusedDesignation})` : accusedName) : "Nathasha (Teacher)"}
                    </span>
                  </div>

                  <div className="summary-item">
                    <span className="summary-label">{lang === "si" ? "පාසල / ආයතනය" : "School / Institute"}</span>
                    <span className="summary-value">{schoolName || "C.W.W. KANNANGARA M.M.V."}</span>
                  </div>

                  <div className="summary-item">
                    <span className="summary-label">{lang === "si" ? "විෂය කරුණ / පැමිණිල්ල" : "Subject Matter"}</span>
                    <span className="summary-value" style={{ wordBreak: "break-word" }}>
                      {caseSubject || "complain"}
                    </span>
                  </div>
                </div>
              </section>

              {/* Main Form: Switched by activeFormType */}
              {activeFormType === "recommendation" ? (
                /* ============================================================
                   FORM 1: INSTITUTIONAL BASIC INVESTIGATION RECOMMENDATION
                   (3 Sections matching screenshot layout)
                   ============================================================ */
                              <form onSubmit={handleSubmit}>
                {/* Card 1: Recommendation Category & Urgency */}
                <section className="recommendation-form-card">
                  <div className="section-header-pill">
                    <Sparkles size={16} />
                    <span>
                      {lang === "si"
                        ? "1. නිර්දේශ වර්ගීකරණය සහ ප්‍රමුඛතාව"
                        : lang === "ta"
                        ? "1. பரிந்துரை வகைப்பாடு மற்றும் முன்னுரிமை"
                        : "1. Recommendation Classification & Priority"}
                    </span>
                  </div>

                  <div className="form-grid-3">
                    <div className="form-field-group">
                      <label className="form-field-label">
                        {lang === "si" ? "නිර්දේශ වර්ගය / කාණ්ඩය" : "Recommendation Category"}
                        <span className="required-asterisk">*</span>
                      </label>
                      <select
                        value={recommendationCategory}
                        onChange={(e) => setRecommendationCategory(e.target.value)}
                        className="form-field-select"
                        required
                      >
                        <option value="formal_inquiry">
                          {lang === "si" ? "විධිමත් විනය පරීක්ෂණයක් පැවැත්වීම (Formal Disciplinary Inquiry)" : "Formal Disciplinary Inquiry"}
                        </option>
                        <option value="issuing_charge_sheet">
                          {lang === "si" ? "චෝදනා පත්‍රයක් නිකුත් කිරීම (Issuing Charge Sheet)" : "Issuing Charge Sheet"}
                        </option>
                        <option value="issue_warning">
                          {lang === "si" ? "දැඩි අවවාද නිකුත් කිරීම (Issue Severe Warning)" : "Issue Severe Warning"}
                        </option>
                        <option value="financial_recovery">
                          {lang === "si" ? "අලාභ අයකර ගැනීම / අධිභාරය (Surcharge / Recovery)" : "Surcharge / Recovery"}
                        </option>
                        <option value="interdiction">
                          {lang === "si" ? "වැඩ තහනම් කිරීම (Interdiction / Suspension)" : "Interdiction / Suspension"}
                        </option>
                        <option value="transfer">
                          {lang === "si" ? "ස්ථාන මාරු කිරීම (Administrative / Disciplinary Transfer)" : "Administrative / Disciplinary Transfer"}
                        </option>
                        <option value="exoneration">
                          {lang === "si" ? "චෝදනාවලින් නිදොස් කොට ගොනුව අවසන් කිරීම (Exonerate & File Closed)" : "Exonerate & File Closed"}
                        </option>
                        <option value="court_verdict">
                          {lang === "si" ? "අධිකරණ තීන්දුව මත ක්‍රියාමාර්ග (Action Based on Court Verdict)" : "Action Based on Court Verdict"}
                        </option>
                        <option value="refer_ciaboc_police">
                          {lang === "si" ? "අල්ලස් / පොලිස් විමර්ශන වෙත යොමු කිරීම (Refer to CIABOC / Police)" : "Refer to CIABOC / Police"}
                        </option>
                        <option value="other">
                          {lang === "si" ? "වෙනත් විශේෂ නිර්දේශ (Other Special Action)" : "Other Special Action"}
                        </option>
                      </select>
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">
                        {lang === "si" ? "ප්‍රමුඛතා මට්ටම" : "Priority Level"}
                      </label>
                      <select
                        value={recommendationUrgency}
                        onChange={(e) => setRecommendationUrgency(e.target.value)}
                        className="form-field-select"
                      >
                        <option value="normal">
                          {lang === "si" ? "🟡 සාමාන්‍ය (Normal / Medium)" : "🟡 Normal / Medium"}
                        </option>
                        <option value="high">
                          {lang === "si" ? "🔴 ඉහළ / කඩිනම් (High / Urgent)" : "🔴 High / Urgent"}
                        </option>
                        <option value="low">
                          {lang === "si" ? "🟢 අඩු (Low)" : "🟢 Low"}
                        </option>
                      </select>
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">
                        {lang === "si" ? "ක්‍රියාත්මක කළ යුතු ඉලක්කගත දිනය" : "Target Implementation Date"}
                      </label>
                      <input
                        type="date"
                        value={targetDate}
                        onChange={(e) => setTargetDate(e.target.value)}
                        className="form-field-input"
                      />
                    </div>
                  </div>

                  <div className="form-field-group" style={{ marginTop: "14px" }}>
                    <label className="form-field-label">
                      {lang === "si" ? "නිර්දේශයේ මාතෘකාව / කෙටි සාරාංශය" : "Recommendation Headline / Brief Summary"}
                      <span className="required-asterisk">*</span>
                    </label>
                    <input
                      type="text"
                      value={recommendationTitle}
                      onChange={(e) => setRecommendationTitle(e.target.value)}
                      placeholder={
                        lang === "si"
                          ? "උදා: චෝදනා පත්‍රයක් ගොනු කර විධිමත් පරීක්ෂණයක් සඳහා විනය අංශයට යොමු කිරීම"
                          : "e.g., Recommend issuance of formal charge sheet and appoint inquiry officer"
                      }
                      className="form-field-input"
                      required
                    />
                  </div>
                </section>

                {/* Card 2: Detailed Findings & Recommendation */}
                <section className="recommendation-form-card">
                  <div className="section-header-pill">
                    <FileText size={16} />
                    <span>
                      {lang === "si"
                        ? "2. විස්තරාත්මක නිර්දේශ සහ නිරීක්ෂණ"
                        : lang === "ta"
                        ? "2. விரிவான பரிந்துரைகள் மற்றும் அவதானிப்புகள்"
                        : "2. Detailed Recommendations & Observations"}
                    </span>
                  </div>

                  <div className="form-field-group">
                    <label className="form-field-label">
                      {lang === "si"
                        ? "විමර්ශන වාර්තාව මත පදනම් වූ විස්තරාත්මක නිර්දේශය"
                        : "Detailed Recommendation Text Based on Investigation Report"}
                      <span className="required-asterisk">*</span>
                    </label>
                    <textarea
                      value={recommendationText}
                      onChange={(e) => setRecommendationText(e.target.value)}
                      rows={5}
                      placeholder={
                        lang === "si"
                          ? "විමර්ශන කමිටු වාර්තාවේ කරුණු, සාක්ෂි හා නිරීක්ෂණ සැලකිල්ලට ගෙන විෂය භාර නිලධාරී ලෙස ඔබගේ සම්පූර්ණ නිර්දේශය මෙහි සටහන් කරන්න..."
                          : "State detailed findings, conclusions of the preliminary inquiry committee, and exact recommendations to be executed..."
                      }
                      className="form-field-textarea"
                      required
                    />

                    {/* Quick action presets */}
                    <div className="presets-container" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
                      <span style={{ fontSize: "12px", color: "#475569", fontWeight: 600 }}>
                        {lang === "si" ? "ඉක්මන් ආකෘති:" : "Quick Presets:"}
                      </span>
                      <button
                        type="button"
                        className="preset-chip"
                        onClick={() =>
                          handleApplyPreset(
                            lang === "si"
                              ? "මූලික විමර්ශන වාර්තාව අනුව චෝදනා තහවුරු වන බැවින් විධිමත් විනය පරීක්ෂණයක් පැවැත්වීමට නිර්දේශ කරමි."
                              : "Evidence indicates prima facie misconduct; recommend instituting a formal disciplinary inquiry."
                          )
                        }
                      >
                        + {lang === "si" ? "විධිමත් විනය පරීක්ෂණය" : "Formal Disciplinary Inquiry"}
                      </button>
                      <button
                        type="button"
                        className="preset-chip"
                        onClick={() =>
                          handleApplyPreset(
                            lang === "si"
                              ? "අදාළ අලාභය රජයට අයකර ගැනීමටත්, චෝදනා ලැබූ නිලධාරියාට දැඩි අවවාද නිකුත් කිරීමටත් නිර්දේශ කරමි."
                              : "Recommend recovery of financial loss from the accused officer and issuing a severe warning letter."
                          )
                        }
                      >
                        + {lang === "si" ? "අලාභ අයකර ගැනීම් සහ අවවාද කිරීම" : "Recovery of Loss & Warning"}
                      </button>
                      <button
                        type="button"
                        className="preset-chip"
                        onClick={() =>
                          handleApplyPreset(
                            lang === "si"
                              ? "පරීක්ෂණ වාර්තාව අනුව චෝදනා තහවුරු නොවන බැවින් මෙම නඩුව තවදුරටත් ඉදිරියට නොගෙන නිදොස් කොට ගොනුව අවසන් කිරීමට නිර්දේශ කරමි."
                              : "Allegations are unsubstantiated per investigation findings; recommend closing the case file with exoneration."
                          )
                        }
                      >
                        + {lang === "si" ? "නිදොස් කොට නිදහස් අවසන් කිරීම" : "Exonerate & Close"}
                      </button>
                    </div>
                  </div>

                  <div className="form-grid-2" style={{ marginTop: "20px" }}>
                    <div className="form-field-group">
                      <label className="form-field-label">
                        {lang === "si" ? "ආයතන සංග්‍රහය / චක්‍රලේඛ අදාළ වගන්ති (Establishment Code Reference)" : "Establishment Code / Circular Reference"}
                      </label>
                      <input
                        type="text"
                        value={disciplinaryAction}
                        onChange={(e) => setDisciplinaryAction(e.target.value)}
                        placeholder={
                          lang === "si"
                            ? "උදා: ආයතන සංග්‍රහයේ II කාණ්ඩයේ XLVIII පරිච්ඡේදය"
                            : "e.g., Chapter XLVIII of Establishment Code / Ministry Circular No. 2024/08"
                        }
                        className="form-field-input"
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">
                        {lang === "si" ? "අදාල ලේඛන / ලිපි ගොනු යොමු අංක" : "Supporting Documents / Minute Ref"}
                      </label>
                      <input
                        type="text"
                        value={referenceNotes}
                        onChange={(e) => setReferenceNotes(e.target.value)}
                        placeholder={
                          lang === "si"
                            ? "උදා: ED/DISC/2026/044 අංක දරන ලිපිගොනුව"
                            : "e.g., Doc Ref: ED/DISC/2026/044"
                        }
                        className="form-field-input"
                      />
                    </div>
                  </div>
                </section>

                {/* Card 3: Routing & Implementation Authority */}
                <section className="recommendation-form-card">
                  <div className="section-header-pill">
                    <Send size={16} />
                    <span>
                      {lang === "si"
                        ? "3. නිර්දේශය යොමු කිරීම සහ ක්‍රියාත්මක කිරීමේ අධිකාරිය"
                        : lang === "ta"
                        ? "3. பரிந்துரையை அனுப்புதல் மற்றும் செயல்படுத்தும் அதிகாரம்"
                        : "3. Routing & Implementation Authority"}
                    </span>
                  </div>

                  <div className="form-grid-2">
                    <div className="form-field-group">
                      <label className="form-field-label">
                        {lang === "si" ? "නිර්දේශය යොමු කරන ප්‍රධාන අංශය / නිලධාරියා" : "Forward Recommendation To"}
                        <span className="required-asterisk">*</span>
                      </label>
                      <select
                        value={forwardTo}
                        onChange={(e) => setForwardTo(e.target.value)}
                        className="form-field-select"
                        required
                      >
                        <option value="disciplinary_branch">
                          {lang === "si" ? "අධ්‍යාපන අමාත්‍යාංශ විනය අංශය (Disciplinary Branch)" : "Ministry Disciplinary Branch"}
                        </option>
                        <option value="secretary_education">
                          {lang === "si" ? "අධ්‍යාපන අමාත්‍යාංශ ලේකම් (Secretary, Ministry of Education)" : "Secretary, Ministry of Education"}
                        </option>
                        <option value="public_service_commission">
                          {lang === "si" ? "රාජ්‍ය සේවා කොමිෂන් සභාව (Public Service Commission - PSC)" : "Public Service Commission (PSC)"}
                        </option>
                        <option value="provincial_director">
                          {lang === "si" ? "පළාත් අධ්‍යාපන අධ්‍යක්ෂ (Provincial Director of Education)" : "Provincial Director of Education"}
                        </option>
                        <option value="zonal_director">
                          {lang === "si" ? "කලාප අධ්‍යාපන අධ්‍යක්ෂ (Zonal Director of Education)" : "Zonal Director of Education"}
                        </option>
                        <option value="investigation_unit">
                          {lang === "si" ? "විමර්ශන අධ්‍යක්ෂක / විමර්ශන ඒකකය (Investigation Branch)" : "Investigation Director / Unit"}
                        </option>
                      </select>
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">
                        {lang === "si" ? "නඩුවේ තත්ත්වය (Case Status Update)" : "Case Status Update"}
                      </label>
                      <select
                        value={recommendationStatus}
                        onChange={(e) => setRecommendationStatus(e.target.value)}
                        className="form-field-select"
                      >
                        <option value="Submitted">
                          {lang === "si" ? "නිර්දේශය ඉදිරිපත් කරන ලදී (Recommendation Submitted)" : "Recommendation Submitted"}
                        </option>
                        <option value="Formal Disciplinary Inspection">
                          {lang === "si" ? "විධිමත් විනය පරීක්ෂණයක් පැවැත්වීම (Formal Disciplinary Inspection)" : "Formal Disciplinary Inspection"}
                        </option>
                        <option value="Implementation of Recommendations">
                          {lang === "si" ? "නිර්දේශ ක්‍රියාත්මක කිරීමේ අදියර (Implementation of Recommendations)" : "Implementation of Recommendations"}
                        </option>
                        <option value="Draft">
                          {lang === "si" ? "කෙටුම්පතක් ලෙස පමණක් සුරකින්න (Draft)" : "Draft"}
                        </option>
                      </select>
                    </div>
                  </div>

                  {/* Form Submission Action Buttons */}
                  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "12px", marginTop: "24px" }}>
                    <Link
                      href="/subject"
                      className="btn-back-gray"
                      style={{ padding: "9px 18px", textDecoration: "none" }}
                    >
                      {lang === "si" ? "අවලංගු කරන්න" : "Cancel"}
                    </Link>

                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      disabled={isSaving}
                      className="btn-save-draft"
                    >
                      <Save size={16} />
                      <span>{lang === "si" ? "කෙටුම්පත සුරකින්න" : "Save Draft"}</span>
                    </button>

                    <button
                      type="submit"
                      disabled={isSaving}
                      className="btn-submit-recommendation"
                    >
                      <Send size={16} />
                      <span>{lang === "si" ? "නිර්දේශය ඉදිරිපත් කරන්න" : "Submit Recommendation"}</span>
                    </button>
                  </div>
                </section>
              </form>
              ) : (
                /* ============================================================
                   FORM 2: ISSUING CHARGE SHEET FORM (UNTOUCHED ORIGINAL)
                   ============================================================ */
                              <form onSubmit={handleSubmit}>
                <section className="recommendation-form-card charge-sheet-card">
                  <div className="section-header-pill charge-sheet-pill">
                    <FileCheck size={16} />
                    <span>
                      {lang === "si"
                        ? "1. චෝදනා පත්‍රය සහ විනය බලධාරියා පිළිබඳ විස්තර"
                        : lang === "ta"
                        ? "1. குற்றப்பத்திரிகை மற்றும் ஒழுங்கு நடவடிக்கை அதிகார விவரங்கள்"
                        : "1. Charge Sheet & Disciplinary Authority Details"}
                    </span>
                  </div>

                    {/* (1) Issues charge sheet & (2) Disciplinary authority */}
                    <div className="form-grid-2">
                      {/* (1) Issues charge sheet */}
                      <div className="form-field-group">
                        <label className="form-field-label">
                          {lang === "si"
                            ? "(1) නිකුත් කරන ලද චෝදනා පත්‍රය (Issues charge sheet)"
                            : lang === "ta"
                            ? "(1) வழங்கப்பட்ட குற்றப்பத்திரிகை (Issues charge sheet)"
                            : "(1) Issues charge sheet"}
                          <span className="required-asterisk">*</span>
                        </label>
                        <select
                          value={issuedChargeSheet}
                          onChange={(e) => setIssuedChargeSheet(e.target.value)}
                          className="form-field-select"
                          required={recommendationCategory === "issuing_charge_sheet"}
                        >
                          <option value="">
                            {lang === "si"
                              ? "-- උපලේඛනය තෝරන්න (Select Schedule) --"
                              : lang === "ta"
                              ? "-- அட்டவணையைத் தேர்ந்தெடுக்கவும் --"
                              : "-- Select Schedule --"}
                          </option>
                          <option value="first_schedule">
                            {lang === "si"
                              ? "පළමු උපලේඛනය (First schedule)"
                              : lang === "ta"
                              ? "முதல் அட்டவணை (First schedule)"
                              : "First schedule"}
                          </option>
                          <option value="second_schedule">
                            {lang === "si"
                              ? "දෙවන උපලේඛනය (Second schedule)"
                              : lang === "ta"
                              ? "இரண்டாம் அட்டவணை (Second schedule)"
                              : "Second schedule"}
                          </option>
                          {issuedChargeSheet &&
                            issuedChargeSheet !== "first_schedule" &&
                            issuedChargeSheet !== "second_schedule" && (
                              <option value={issuedChargeSheet}>{issuedChargeSheet}</option>
                            )}
                        </select>
                      </div>

                      {/* (2) Disciplinary authority */}
                      <div className="form-field-group">
                        <label className="form-field-label">
                          {lang === "si"
                            ? "(2) විනය බලධාරියා (Disciplinary authority)"
                            : lang === "ta"
                            ? "(2) ஒழுங்கு நடவடிக்கை அதிகாரம் (Disciplinary authority)"
                            : "(2) Disciplinary authority"}
                          <span className="required-asterisk">*</span>
                        </label>
                        <select
                          value={disciplinaryAuthority}
                          onChange={(e) => setDisciplinaryAuthority(e.target.value)}
                          className="form-field-select"
                          required={recommendationCategory === "issuing_charge_sheet"}
                        >
                          <option value="secretary_of_education">
                            {lang === "si"
                              ? "අධ්‍යාපන ලේකම් (Secretary of education)"
                              : lang === "ta"
                              ? "கல்விச் செயலாளர் (Secretary of education)"
                              : "Secretary of education"}
                          </option>
                          <option value="psc_esc">
                            {lang === "si"
                              ? "රාජ්‍ය සේවා කොමිෂන් සභාව / අධ්‍යාපන සේවා කමිටුව (PSC / ESC)"
                              : lang === "ta"
                              ? "பொதுச் சேவை ஆணைக்குழு / கல்விச் சேவைக் குழு (PSC / ESC)"
                              : "PSC / ESC"}
                          </option>
                        </select>
                      </div>
                    </div>

                    {/* (3) Details of the accused officer */}
                    <div className="accused-preview-card" style={{ marginTop: "12px", marginBottom: "18px" }}>
                      <div className="accused-preview-title" style={{ fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <User size={14} style={{ color: "#6366f1" }} />
                        <span>
                          {lang === "si"
                            ? "(3) චෝදනා ලැබූ නිලධාරියාගේ විස්තර (Details of the accused officer)"
                            : lang === "ta"
                            ? "(3) குற்றம் சாட்டப்பட்ட அதிகாரியின் விவரங்கள் (Details of the accused officer)"
                            : "(3) Details of the accused officer"}
                        </span>
                      </div>
                      <div className="accused-preview-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", padding: "12px 16px", backgroundColor: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                        <div>
                          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "block" }}>
                            {lang === "si" ? "නිලධාරියාගේ නම" : "Officer Name"}
                          </span>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
                            {accusedName || "—"}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "block" }}>
                            {lang === "si" ? "තනතුර" : "Designation / Position"}
                          </span>
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>
                            {accusedDesignation || "—"}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "block" }}>
                            {lang === "si" ? "පාසල / ආයතනය" : "School / Institution"}
                          </span>
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>
                            {schoolName || "—"}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "block" }}>
                            {lang === "si" ? "නඩු ලිපිගොනු අංකය" : "Case / File Ref No"}
                          </span>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#4f46e5" }}>
                            {caseNo || "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* (4) Date of the charge sheet issued & (5) Date of the request for document required to provide a response */}
                    <div className="form-grid-2">
                      {/* (4) Date of the charge sheet issued */}
                      <div className="form-field-group">
                        <label className="form-field-label">
                          {lang === "si"
                            ? "(4) චෝදනා පත්‍රය නිකුත් කළ දිනය (Date of the charge sheet issued)"
                            : lang === "ta"
                            ? "(4) குற்றப்பத்திரிகை வழங்கப்பட்ட திகதி (Date of the charge sheet issued)"
                            : "(4) Date of the charge sheet issued"}
                          <span className="required-asterisk">*</span>
                        </label>
                        <input
                          type="date"
                          value={chargeSheetIssuedDate}
                          onChange={(e) => setChargeSheetIssuedDate(e.target.value)}
                          className="form-field-input"
                          required={recommendationCategory === "issuing_charge_sheet"}
                        />
                      </div>

                      {/* (5) Date of the request for document required to provide a response */}
                      <div className="form-field-group">
                        <label className="form-field-label">
                          {lang === "si"
                            ? "(5) පිළිතුරක් ලබා දීමට අවශ්‍ය ලිපි ලේඛන ඉල්ලා සිටි දිනය (Date of the request for document required to provide a response)"
                            : lang === "ta"
                            ? "(5) பதில் அளிக்க தேவையான ஆவணங்களை கோரிய திகதி"
                            : "(5) Date of the request for document required to provide a response"}
                        </label>
                        <input
                          type="date"
                          value={dateRequestDocuments}
                          onChange={(e) => setDateRequestDocuments(e.target.value)}
                          className="form-field-input"
                        />
                      </div>
                    </div>

                    {/* (6) Date of the submition of document & (7) Date of the response to the charge sheet was given */}
                    <div className="form-grid-2">
                      {/* (6) Date of the submition of document */}
                      <div className="form-field-group">
                        <label className="form-field-label">
                          {lang === "si"
                            ? "(6) ලිපි ලේඛන ඉදිරිපත් කළ දිනය (Date of the submition of document)"
                            : lang === "ta"
                            ? "(6) ஆவணங்கள் சமர்ப்பிக்கப்பட்ட திகதி (Date of the submition of document)"
                            : "(6) Date of the submition of document"}
                        </label>
                        <input
                          type="date"
                          value={dateSubmissionDocuments}
                          onChange={(e) => setDateSubmissionDocuments(e.target.value)}
                          className="form-field-input"
                        />
                      </div>

                      {/* (7) Date of the response to the charge sheet was given */}
                      <div className="form-field-group">
                        <label className="form-field-label">
                          {lang === "si"
                            ? "(7) චෝදනා පත්‍රයට පිළිතුරු ලබා දුන් දිනය (Date of the response to the charge sheet was given)"
                            : lang === "ta"
                            ? "(7) குற்றப்பத்திரிகைக்கு பதில் அளிக்கப்பட்ட திகதி"
                            : "(7) Date of the response to the charge sheet was given"}
                        </label>
                        <input
                          type="date"
                          value={chargeSheetResponseDate}
                          onChange={(e) => setChargeSheetResponseDate(e.target.value)}
                          className="form-field-input"
                        />
                      </div>
                    </div>

                    {/* (8) Agree or disagree with the answers ? (Hidden when Disciplinary Authority is PSC / ESC) */}
                    {disciplinaryAuthority !== "psc_esc" && (
                      <div className="form-field-group" style={{ marginTop: "4px", marginBottom: "18px" }}>
                        <label className="form-field-label">
                          {lang === "si"
                            ? "(8) පිළිතුරු සමඟ එකඟ වන්නේද නැද්ද? (Agree or disagree with the answers ?)"
                            : lang === "ta"
                            ? "(8) பதில்களுடன் உடன்படுகிறீர்களா அல்லது உடன்படவில்லையா? (Agree or disagree with the answers ?)"
                            : "(8) Agree or disagree with the answers ?"}
                        </label>
                        <div style={{ display: "flex", gap: "20px", marginTop: "8px", alignItems: "center" }}>
                          <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: 600, fontSize: "14px", color: agreeWithAnswers === "yes" ? "#15803d" : "#475569" }}>
                            <input
                              type="radio"
                              name="agreeWithAnswers"
                              value="yes"
                              checked={agreeWithAnswers === "yes"}
                              onChange={() => setAgreeWithAnswers("yes")}
                              style={{ width: "16px", height: "16px", accentColor: "#16a34a" }}
                            />
                            <span>{lang === "si" ? "ඔව් (Yes)" : lang === "ta" ? "ஆம் (Yes)" : "Yes"}</span>
                          </label>
                          <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: 600, fontSize: "14px", color: agreeWithAnswers === "no" ? "#b91c1c" : "#475569" }}>
                            <input
                              type="radio"
                              name="agreeWithAnswers"
                              value="no"
                              checked={agreeWithAnswers === "no"}
                              onChange={() => setAgreeWithAnswers("no")}
                              style={{ width: "16px", height: "16px", accentColor: "#dc2626" }}
                            />
                            <span>{lang === "si" ? "නැත (No)" : lang === "ta" ? "இல்லை (No)" : "No"}</span>
                          </label>
                        </div>
                        {agreeWithAnswers === "yes" && (
                          <div style={{ marginTop: "10px", padding: "10px 14px", backgroundColor: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "8px", color: "#065f46", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
                            <CheckCircle2 size={16} style={{ color: "#059669" }} />
                            <span>{lang === "si" ? "පිළිතුරු සමඟ එකඟයි — ලිපි තත්ත්වය: අවසන් (Letter Status: Closed)" : "Agreed with answers — Letter Status: Closed"}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Conditional Section: If selected Disciplinary authority as PSC / ESC */}
                    {disciplinaryAuthority === "psc_esc" && (
                      <div style={{ marginTop: "8px", marginBottom: "18px", padding: "18px 20px", borderRadius: "14px", border: "2px dashed #818cf8", backgroundColor: "#f5f7ff" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                          <span style={{ backgroundColor: "#e0e7ff", color: "#3730a3", fontSize: "12px", fontWeight: 700, padding: "4px 12px", borderRadius: "9999px" }}>
                            {lang === "si"
                              ? "විනය බලධාරියා PSC / ESC ලෙස තෝරාගෙන ඇති විට (If selected Disciplinary authority as PSC / ESC)"
                              : "If selected Disciplinary authority as PSC / ESC"}
                          </span>
                        </div>

                        <div className="form-grid-2">
                          {/* Date draft was submitted to the PSC / ESC */}
                          <div className="form-field-group">
                            <label className="form-field-label">
                              {lang === "si"
                                ? "කෙටුම්පත PSC / ESC වෙත ඉදිරිපත් කළ දිනය (Date draft was submitted to the PSC / ESC)"
                                : lang === "ta"
                                ? "வரைவு PSC / ESC க்கு சமர்ப்பிக்கப்பட்ட திகதி"
                                : "Date draft was submitted to the PSC / ESC"}
                            </label>
                            <input
                              type="date"
                              value={dateDraftSubmittedPsc}
                              onChange={(e) => setDateDraftSubmittedPsc(e.target.value)}
                              className="form-field-input"
                            />
                          </div>

                          {/* Agree or disagree with the decision made by the PSC / ESC ? */}
                          <div className="form-field-group">
                            <label className="form-field-label">
                              {lang === "si"
                                ? "PSC / ESC විසින් ගන්නා ලද තීරණය සමඟ එකඟ වන්නේද නැද්ද? (Agree or disagree with the decision made by the PSC / ESC ?)"
                                : lang === "ta"
                                ? "PSC / ESC எடுத்த முடிவை ஏற்றுக்கொள்கிறீர்களா அல்லது உடன்படவில்ලையா?"
                                : "Agree or disagree with the decision made by the PSC / ESC ?"}
                            </label>
                            <div style={{ display: "flex", gap: "20px", marginTop: "8px", alignItems: "center" }}>
                              <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: 600, fontSize: "14px", color: agreeWithPscDecision === "yes" ? "#15803d" : "#475569" }}>
                                <input
                                  type="radio"
                                  name="agreeWithPscDecision"
                                  value="yes"
                                  checked={agreeWithPscDecision === "yes"}
                                  onChange={() => setAgreeWithPscDecision("yes")}
                                  style={{ width: "16px", height: "16px", accentColor: "#16a34a" }}
                                />
                                <span>{lang === "si" ? "ඔව් (Yes)" : lang === "ta" ? "ஆம் (Yes)" : "Yes"}</span>
                              </label>
                              <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: 600, fontSize: "14px", color: agreeWithPscDecision === "no" ? "#b91c1c" : "#475569" }}>
                                <input
                                  type="radio"
                                  name="agreeWithPscDecision"
                                  value="no"
                                  checked={agreeWithPscDecision === "no"}
                                  onChange={() => setAgreeWithPscDecision("no")}
                                  style={{ width: "16px", height: "16px", accentColor: "#dc2626" }}
                                />
                                <span>{lang === "si" ? "නැත (No)" : lang === "ta" ? "இல்லை (No)" : "No"}</span>
                              </label>
                            </div>
                            {agreeWithPscDecision === "yes" && (
                              <div style={{ marginTop: "10px", padding: "10px 14px", backgroundColor: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "8px", color: "#065f46", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
                                <CheckCircle2 size={16} style={{ color: "#059669" }} />
                                <span>{lang === "si" ? "PSC / ESC තීරණය සමඟ එකඟයි — ලිපි තත්ත්වය: අවසන් (Letter Status: Closed)" : "Agreed with PSC / ESC decision — Letter Status: Closed"}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                  </section>

                {/* Card 2: Secretary of Education Approval Details (Displayed only when answer is 'yes') */}
                {isDecisionApproved && (
                  <section className="recommendation-form-card secretary-approval-card">
                    <div className="section-header-pill secretary-approval-pill">
                      <UserCheck size={16} />
                      <span>
                        {lang === "si"
                          ? "2. අධ්‍යාපන ලේකම්ගේ අනුමැතිය සහ නියෝග"
                          : lang === "ta"
                          ? "2. கல்விச் செயலாளரின் ஒப்புதல் மற்றும் உத்தரவு"
                          : "2. Secretary of Education Approval & Directive"}
                      </span>
                    </div>

                    <div className="form-grid-2">
                      {/* Date approved by the Secretary of Education */}
                      <div className="form-field-group">
                        <label className="form-field-label">
                          {lang === "si"
                            ? "අධ්‍යාපන ලේකම් අනුමත කළ දිනය (Date approved by the Secretary of Education)"
                            : lang === "ta"
                            ? "கல்விச் செயலாளரால் அங்கீகரிக்கப்பட்ட திகதி (Date approved by the Secretary of Education)"
                            : "Date approved by the Secretary of Education"}
                        </label>
                        <input
                          type="date"
                          value={secretaryApprovalDate}
                          onChange={(e) => setSecretaryApprovalDate(e.target.value)}
                          className="form-field-input"
                        />
                      </div>

                      {/* Secretary Approval Quick Indicator */}
                      <div className="form-field-group">
                        <label className="form-field-label">
                          {lang === "si" ? "අනුමැතියේ තත්ත්වය" : "Secretary Approval Status"}
                        </label>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", minHeight: "42px" }}>
                          {secretaryApprovalDate ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px", fontWeight: 700, color: "#92400e", backgroundColor: "#fef3c7", padding: "6px 14px", borderRadius: "8px", border: "1px solid #fde68a" }}>
                              <CheckCircle2 size={15} style={{ color: "#d97706" }} />
                              {lang === "si" ? `අධ්‍යාපන ලේකම් විසින් ${secretaryApprovalDate} දින අනුමතයි` : `Approved by Secretary on ${secretaryApprovalDate}`}
                            </span>
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#64748b", backgroundColor: "#f1f5f9", padding: "6px 12px", borderRadius: "8px" }}>
                              <Clock size={14} />
                              {lang === "si" ? "අධ්‍යාපන ලේකම්ගේ අනුමැතිය අපේක්ෂිතයි" : "Awaiting Secretary of Education approval"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Recommendation approved by the Secretary of Education */}
                    <div className="form-field-group" style={{ marginTop: "12px" }}>
                      <label className="form-field-label">
                        {lang === "si"
                          ? "අධ්‍යාපන ලේකම් අනුමත කළ නිර්දේශය (Recommendation approved by the Secretary of Education)"
                          : lang === "ta"
                          ? "கல்விச் செயலாளரால் அங்கீகரிக்கப்பட்ட பரிந்துரை (Recommendation approved by the Secretary of Education)"
                          : "Recommendation approved by the Secretary of Education"}
                      </label>
                      <textarea
                        value={secretaryApprovedRecommendation}
                        onChange={(e) => setSecretaryApprovedRecommendation(e.target.value)}
                        rows={3}
                        placeholder={
                          lang === "si"
                            ? "අධ්‍යාපන අමාත්‍යාංශ ලේකම්වරයා විසින් අනුමත කරන ලද නිල නිර්දේශය, තීරණය හෝ විනය නියෝගය මෙහි සටහන් කරන්න..."
                            : lang === "ta"
                            ? "கல்விச் செயலாளரால் அங்கீகரிக்கப்பட்ட பரிந்துரை அல்லது உத்தரவை இங்கு உள்ளிடவும்..."
                            : "Enter the formal recommendation, directive, or disciplinary order approved and signed by the Secretary of Education..."
                        }
                        className="form-field-textarea"
                        style={{ minHeight: "85px" }}
                      />

                      {/* Quick presets for Secretary Approved Recommendation */}
                      <div className="presets-container" style={{ marginTop: "8px" }}>
                        <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, alignSelf: "center" }}>
                          {lang === "si" ? "ඉක්මන් ආකෘති:" : "Quick Presets:"}
                        </span>
                        <button
                          type="button"
                          className="preset-chip"
                          onClick={() =>
                            setSecretaryApprovedRecommendation(
                              lang === "si"
                                ? "මූලික විමර්ශන නිර්දේශය අධ්‍යාපන අමාත්‍යාංශ ලේකම් විසින් එලෙසම අනුමත කරන ලදී."
                                : "Approved as recommended by the preliminary investigation committee."
                            )
                          }
                        >
                          + {lang === "si" ? "නිර්දේශය එලෙසම අනුමතයි" : "Approved as Recommended"}
                        </button>
                        <button
                          type="button"
                          className="preset-chip"
                          onClick={() =>
                            setSecretaryApprovedRecommendation(
                              lang === "si"
                                ? "අදාළ නිලධාරියා වෙත චෝදනා පත්‍රයක් නිකුත් කර විධිමත් විනය පරීක්ෂණයක් පැවැත්වීමට අධ්‍යාපන ලේකම් විසින් අනුමත කරන ලදී."
                                : "Approved issuance of formal charge sheet and formal disciplinary inquiry."
                            )
                          }
                        >
                          + {lang === "si" ? "චෝදනා පත්‍ර නිකුත් කිරීමට අනුමැතිය" : "Approve Charge Sheet"}
                        </button>
                        <button
                          type="button"
                          className="preset-chip"
                          onClick={() =>
                            setSecretaryApprovedRecommendation(
                              lang === "si"
                                ? "නිලධාරියා වෙත දැඩි ලිඛිත අවවාදයක් නිකුත් කර විනය ගොනුව අවසන් කිරීමට අධ්‍යාපන ලේකම් අනුමැතිය ලබා දෙන ලදී."
                                : "Approved issuance of severe written warning and closure of disciplinary file."
                            )
                          }
                        >
                          + {lang === "si" ? "අවවාද කර ගොනුව අවසන් කිරීමට අනුමැතිය" : "Approve Warning & Close"}
                        </button>
                        <button
                          type="button"
                          className="preset-chip"
                          onClick={() =>
                            setSecretaryApprovedRecommendation(
                              lang === "si"
                                ? "පරිපාලන අවශ්‍යතාවය මත නිලධාරියා වහාම වෙනත් සේවා ස්ථානයකට මාරු කිරීමට අධ්‍යාපන ලේකම් අනුමැතිය ලබා දෙන ලදී."
                                : "Approved administrative transfer of the officer with immediate effect."
                            )
                          }
                        >
                          + {lang === "si" ? "ස්ථාන මාරුව අනුමතයි" : "Approve Transfer"}
                        </button>
                      </div>
                    </div>
                  </section>
                )}

                {/* Form Submission Action Buttons */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "20px", padding: "16px 20px", backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                  <button type="button" onClick={() => setViewMode("list")} className="btn-back-gray">
                    {lang === "si" ? "ලැයිස්තුවට යන්න" : "View List"}
                  </button>

                  <button type="button" onClick={handleSaveDraft} disabled={isSaving} className="btn-save-draft">
                    <Save size={16} />
                    <span>{lang === "si" ? "කෙටුම්පත සුරකින්න" : "Save Draft"}</span>
                  </button>

                  <button type="submit" disabled={isSaving} className="btn-submit-recommendation">
                    <Send size={16} />
                    <span>{lang === "si" ? "චෝදනා පත්‍රය ඉදිරිපත් කරන්න" : "Submit Charge Sheet"}</span>
                  </button>
                </div>
              </form>
              )}
            </>
          )}

          {/* ============================================================
             VIEW MODE 2: ALL RECOMMENDATIONS & COMPLETED CASES LIST
             ============================================================ */}
          {viewMode === "list" && (
            <section style={{ marginBottom: "30px" }}>
              {/* Alert Banner for Pending Completed Cases */}
              {pendingCases.length > 0 && (
                <div style={{
                  backgroundColor: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "14px",
                  padding: "16px 20px",
                  marginBottom: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                  boxShadow: "0 2px 4px rgba(37,99,235,0.06)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "38px", height: "38px", borderRadius: "10px", backgroundColor: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb", flexShrink: 0 }}>
                      <AlertCircle size={22} />
                    </div>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#1e3a8a" }}>
                        {lang === "si" 
                          ? `විමර්ශනය අවසන් නඩු ${pendingCases.length} ක් නිර්දේශ සඳහා පවරා ඇත` 
                          : `${pendingCases.length} Completed Investigation Case(s) Assigned for Recommendation`}
                      </div>
                      <div style={{ fontSize: "12px", color: "#3b82f6", marginTop: "2px" }}>
                        {lang === "si"
                          ? "මූලික විමර්ශන කටයුතු අවසන් කර ඇති අතර විනය ක්‍රියාමාර්ග නිර්දේශ ඉදිරිපත් කිරීම ඔබ වෙත පවරා ඇත."
                          : "Preliminary investigations have concluded and are assigned to you for disciplinary recommendation submission."}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, backgroundColor: "#dbeafe", color: "#1d4ed8", padding: "4px 12px", borderRadius: "12px" }}>
                      {pendingCases.length} {lang === "si" ? "අපේක්ෂිතයි" : "Pending Action"}
                    </span>
                  </div>
                </div>
              )}

              {/* Recommendation Quick Summary KPI Cards */}
              <div className="dashboard-stats-grid subject-stats-grid" style={{ marginBottom: "20px" }}>
                <div className="premium-stat-card total-cases-card" style={{ height: "100px", padding: "16px" }}>
                  <div className="premium-card-top">
                    <div className="premium-card-title-area">
                      <ClipboardList className="premium-card-icon" />
                      <span>{lang === "si" ? "මුළු නිර්දේශ" : "Total Recommendations"}</span>
                    </div>
                  </div>
                  <div className="premium-card-bottom">
                    <div className="premium-card-value-area">
                      <span className="premium-card-value">{String(allRecommendations.length).padStart(2, "0")}</span>
                      <span className="premium-card-label">{lang === "si" ? "වාර්තා" : "records"}</span>
                    </div>
                  </div>
                </div>

                <div className="premium-stat-card inprogress-cases-card" style={{ height: "100px", padding: "16px" }}>
                  <div className="premium-card-top">
                    <div className="premium-card-title-area">
                      <ShieldAlert className="premium-card-icon" />
                      <span>{lang === "si" ? "නිර්දේශ අපේක්ෂිත" : "Awaiting Recommendation"}</span>
                    </div>
                  </div>
                  <div className="premium-card-bottom">
                    <div className="premium-card-value-area">
                      <span className="premium-card-value">{String(pendingCases.length).padStart(2, "0")}</span>
                      <span className="premium-card-label">{lang === "si" ? "අපේක්ෂිත" : "pending"}</span>
                    </div>
                  </div>
                </div>

                <div className="premium-stat-card pending-cases-card" style={{ height: "100px", padding: "16px" }}>
                  <div className="premium-card-top">
                    <div className="premium-card-title-area">
                      <Clock className="premium-card-icon" />
                      <span>{lang === "si" ? "කෙටුම්පත්" : "Drafts"}</span>
                    </div>
                  </div>
                  <div className="premium-card-bottom">
                    <div className="premium-card-value-area">
                      <span className="premium-card-value">
                        {String(allRecommendations.filter((r) => r.status === "Draft").length).padStart(2, "0")}
                      </span>
                      <span className="premium-card-label">{lang === "si" ? "කෙටුම්පත්" : "drafts"}</span>
                    </div>
                  </div>
                </div>

                <div className="premium-stat-card closed-cases-card" style={{ height: "100px", padding: "16px" }}>
                  <div className="premium-card-top">
                    <div className="premium-card-title-area">
                      <CheckCircle className="premium-card-icon" />
                      <span>{lang === "si" ? "යොමු කළ නිර්දේශ" : "Submitted"}</span>
                    </div>
                  </div>
                  <div className="premium-card-bottom">
                    <div className="premium-card-value-area">
                      <span className="premium-card-value">
                        {String(allRecommendations.filter((r) => r.status === "Submitted" || r.status === "Approved").length).padStart(2, "0")}
                      </span>
                      <span className="premium-card-label">{lang === "si" ? "යොමු කළ" : "submitted"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filter and Search Bar */}
              <div className="letters-list-header" style={{ marginBottom: "16px", backgroundColor: "#ffffff", padding: "12px 18px", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "#1e1b4b", fontSize: "14px" }}>
                  <Filter size={16} style={{ color: "#4f46e5" }} />
                  <span>{lang === "si" ? "නඩු සහ නිර්දේශ පෙරහන" : "Filter Cases & Recommendations"}</span>
                </div>

                <div className="letters-filters-group" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", margin: 0 }}>
                  <div className="search-box" style={{ width: "220px" }}>
                    <Search className="search-icon" size={15} />
                    <input
                      type="text"
                      value={recSearchQuery}
                      onChange={(e) => setRecSearchQuery(e.target.value)}
                      placeholder={lang === "si" ? "නඩු හෝ නිර්දේශ සොයන්න..." : "Search cases or recommendations..."}
                      className="search-input"
                    />
                  </div>

                  <div className="filter-dropdown-wrapper">
                    <select
                      value={recCategoryFilter}
                      onChange={(e) => setRecCategoryFilter(e.target.value)}
                      className="filter-priority-select"
                      style={{ maxWidth: "160px" }}
                    >
                      <option value="all">{lang === "si" ? "සියලු කාණ්ඩ" : "All Categories"}</option>
                      <option value="issuing_charge_sheet">{lang === "si" ? "චෝදනා පත්‍රයක් නිකුත් කිරීම" : "Issuing Charge Sheet"}</option>
                      <option value="action_based_on_court_verdict">{lang === "si" ? "අධිකරණ තීන්දුව මත ක්‍රියාමාර්ග" : "Court Verdict Action"}</option>
                      <option value="giving_warnings_advice">{lang === "si" ? "අවවාද / උපදෙස්" : "Warnings/Advice"}</option>
                      <option value="transfers">{lang === "si" ? "ස්ථාන මාරු කිරීම්" : "Transfers"}</option>
                      <option value="charging_based_on_more_104">{lang === "si" ? "MoRE 104 චෝදනා" : "MoRE 104 Charging"}</option>
                      <option value="terminating_service">{lang === "si" ? "සේවය අවසන් කිරීම" : "Terminating Service"}</option>
                      <option value="closing_action_non_disclosure">{lang === "si" ? "ක්‍රියාමාර්ගය අවසන් කිරීම" : "Closing Action"}</option>
                      <option value="other">{lang === "si" ? "වෙනත්" : "Other"}</option>
                    </select>
                  </div>

                  <div className="filter-dropdown-wrapper">
                    <select
                      value={recUrgencyFilter}
                      onChange={(e) => setRecUrgencyFilter(e.target.value)}
                      className="filter-priority-select"
                    >
                      <option value="all">{lang === "si" ? "සියලු ප්‍රමුඛතා" : "All Urgencies"}</option>
                      <option value="high">🔴 High / Urgent</option>
                      <option value="normal">🟡 Normal</option>
                      <option value="low">🟢 Low</option>
                    </select>
                  </div>

                  <div className="filter-dropdown-wrapper">
                    <select
                      value={recStatusFilter}
                      onChange={(e) => setRecStatusFilter(e.target.value)}
                      className="filter-priority-select"
                    >
                      <option value="all">{lang === "si" ? "සියලු තත්ත්ව" : "All Statuses"}</option>
                      <option value="Awaiting Recommendation">{lang === "si" ? "⚡ නිර්දේශ අපේක්ෂිත (Action Required)" : "⚡ Awaiting Recommendation"}</option>
                      <option value="Draft">{lang === "si" ? "📝 කෙටුම්පත් (Draft)" : "📝 Draft"}</option>
                      <option value="Submitted">{lang === "si" ? "✈️ යොමු කළා (Submitted)" : "✈️ Submitted"}</option>
                      <option value="Approved">{lang === "si" ? "✓ අනුමතයි (Approved)" : "✓ Approved"}</option>
                      <option value="Closed">{lang === "si" ? "🔒 අවසන් කළ ලිපි (Closed)" : "🔒 Closed"}</option>
                    </select>
                  </div>

                  {(recSearchQuery || recCategoryFilter !== "all" || recUrgencyFilter !== "all" || recStatusFilter !== "all") && (
                    <a
                      href="#"
                      className="view-all-reset-link"
                      onClick={(e) => {
                        e.preventDefault();
                        setRecSearchQuery("");
                        setRecCategoryFilter("all");
                        setRecUrgencyFilter("all");
                        setRecStatusFilter("all");
                      }}
                    >
                      {lang === "si" ? "පෙරහන් ඉවත් කරන්න" : "Reset Filters"} →
                    </a>
                  )}
                </div>
              </div>

              {/* Data Table */}
              <div className="table-responsive-container">
                <table className="letters-data-table">
                  <thead>
                    <tr>
                      <th scope="col">{t("caseNo", "Case No")}</th>
                      <th scope="col">{lang === "si" ? "චෝදනා ලත් නිලධාරියා / ආයතනය" : "Accused Officer / Institution"}</th>
                      <th scope="col">{lang === "si" ? "නිර්දේශ වර්ගය සහ විස්තරය" : "Category & Recommendation"}</th>
                      <th scope="col">{lang === "si" ? "ප්‍රමුඛතාව" : "Urgency"}</th>
                      <th scope="col">{lang === "si" ? "තත්ත්වය" : "Status"}</th>
                      <th scope="col">{lang === "si" ? "යොමු කළ අංශය" : "Forwarded To"}</th>
                      <th scope="col">{lang === "si" ? "දිනය" : "Target / Date"}</th>
                      <th scope="col" className="text-center">{lang === "si" ? "ක්‍රියාමාර්ග" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecommendations.length > 0 ? (
                      filteredRecommendations.map((item, idx) => {
                        const isAwaiting = item.status === "Awaiting Recommendation" || (!item.category && !item.recommendationText);
                        const isDraft = item.status === "Draft";
                        const isApproved = item.status === "Approved";
                        const isSubmitted = item.status === "Submitted" || item.status === "Implementation of Recommendations";

                        return (
                          <tr key={item.id ? `${item.id}-${idx}` : `rec-${item.caseNo}-${idx}`} className="letter-table-row">
                            <td className="font-semibold" style={{ color: "#1e1b4b" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <span style={{ fontWeight: 700 }}>{item.caseNo}</span>
                                {item.letterNo && item.letterNo !== item.caseNo && (
                                  <span style={{ fontSize: "11px", color: "#64748b" }}>Letter: {item.letterNo}</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <span style={{ fontWeight: 600, color: "#1e293b", display: "flex", alignItems: "center", gap: "4px" }}>
                                  <User size={13} style={{ color: "#64748b" }} />
                                  {item.accusedName || item.officerName || "—"}
                                </span>
                                {(item.schoolName || item.accusedDesignation) && (
                                  <span style={{ fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                                    <Building size={11} style={{ color: "#94a3b8" }} />
                                    {[item.accusedDesignation, item.schoolName].filter(Boolean).join(" • ")}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxWidth: "260px" }}>
                                {isAwaiting ? (
                                  <>
                                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#b91c1c", backgroundColor: "#fee2e2", padding: "2px 8px", borderRadius: "10px", width: "fit-content" }}>
                                      {lang === "si" ? "නිර්දේශ අපේක්ෂිතයි" : "Awaiting Recommendation"}
                                    </span>
                                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.subject || item.title}>
                                      {item.subject || item.title || (lang === "si" ? "මූලික විමර්ශනය අවසන් - නිර්දේශය එක් කරන්න" : "Investigation Completed - Add Recommendation")}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                      <span className="badge-category-tag" title={getCategoryLabel(item.category)}>
                                        {getCategoryLabel(item.category)}
                                      </span>
                                      {item.category === "issuing_charge_sheet" && (
                                        <Link
                                          href={`/subject?tab=issuing_charge_sheet&caseNo=${encodeURIComponent(item.caseNo)}`}
                                          className="badge-proper-inspection"
                                          style={{ backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}
                                          title="View in Issuing Charge Sheet"
                                        >
                                          <FileCheck size={11} />
                                          <span>{lang === "si" ? "චෝදනා පත්‍ර නිකුත් කිරීම" : "Charge Sheet"}</span>
                                        </Link>
                                      )}
                                    </div>
                                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.title || item.recommendationText}>
                                      {item.title || item.recommendationText || "Formal Recommendation"}
                                    </span>
                                  </>
                                )}
                              </div>
                            </td>
                            <td>
                              {item.urgency === "high" ? (
                                <span className="badge-urgency-high">
                                  🔴 {lang === "si" ? "ඉහළ" : "High"}
                                </span>
                              ) : item.urgency === "low" ? (
                                <span className="badge-urgency-low">
                                  🟢 {lang === "si" ? "අඩු" : "Low"}
                                </span>
                              ) : (
                                <span className="badge-urgency-normal">
                                  🟡 {lang === "si" ? "සාමාන්‍ය" : "Normal"}
                                </span>
                              )}
                            </td>
                            <td>
                              {isAwaiting ? (
                                <span style={{ fontSize: "11px", fontWeight: 700, color: "#b91c1c", backgroundColor: "#fee2e2", padding: "3px 10px", borderRadius: "12px", border: "1px solid #fecaca", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                  ⚡ {lang === "si" ? "අපේක්ෂිතයි" : "Action Required"}
                                </span>
                              ) : (item.status === "Closed" || item.agreeWithAnswers === "yes" || item.agreeWithPscDecision === "yes") ? (
                                <span className="badge-status-submitted-rec" style={{ backgroundColor: "#ecfdf5", color: "#166534", borderColor: "#86efac", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                  <CheckCircle2 size={12} style={{ color: "#16a34a" }} /> {lang === "si" ? "ලිපිය අවසන් (Closed)" : "Closed"}
                                </span>
                              ) : isDraft ? (
                                <span className="badge-status-draft-rec">
                                  📝 {lang === "si" ? "කෙටුම්පත" : "Draft"}
                                </span>
                              ) : isApproved ? (
                                <span className="badge-status-submitted-rec" style={{ backgroundColor: "#dcfce7", color: "#166534", borderColor: "#bbf7d0" }}>
                                  <CheckCircle size={12} /> {lang === "si" ? "අනුමතයි" : "Approved"}
                                </span>
                              ) : (
                                <span className="badge-status-submitted-rec">
                                  <Send size={12} /> {lang === "si" ? "යොමු කළා" : "Submitted"}
                                </span>
                              )}
                            </td>
                            <td>
                              <span style={{ fontSize: "12px", color: "#475569", fontWeight: 500 }}>
                                {getForwardToLabel(item.forwardTo)}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "12px", color: "#64748b" }}>
                                {item.targetDate && (
                                  <span>Target: <strong>{item.targetDate}</strong></span>
                                )}
                                <span>{item.submittedAt ? item.submittedAt.slice(0, 10) : item.updatedAt ? item.updatedAt.slice(0, 10) : item.initialCompletedDate || "—"}</span>
                                {item.secretaryApprovalDate && (
                                  <span style={{ fontSize: "10.5px", color: "#92400e", backgroundColor: "#fef3c7", padding: "1px 6px", borderRadius: "4px", fontWeight: 600, border: "1px solid #fde68a", display: "inline-flex", alignItems: "center", gap: "3px", width: "fit-content", marginTop: "2px" }} title={`Secretary Approved: ${item.secretaryApprovedRecommendation || item.secretaryApprovalDate}`}>
                                    ✓ Sec: {item.secretaryApprovalDate}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="text-center actions-cell">
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                                {isAwaiting ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCaseNo(item.caseNo);
                                      fetchCaseDetails(item.caseNo);
                                      setViewMode("form");
                                    }}
                                    className="btn-submit-recommendation"
                                    style={{ padding: "5px 12px", fontSize: "11.5px", cursor: "pointer", border: "none", display: "inline-flex", alignItems: "center", gap: "4px", borderRadius: "6px" }}
                                    title="Add Recommendation"
                                  >
                                    <Plus size={12} />
                                    <span>{lang === "si" ? "නිර්දේශය එක් කරන්න" : "+ Add Rec"}</span>
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCaseNo(item.caseNo);
                                        fetchCaseDetails(item.caseNo);
                                        setViewMode("form");
                                      }}
                                      className="add-details-link"
                                      style={{ padding: "4px 12px", fontSize: "11px", cursor: "pointer", border: "none" }}
                                      title="Open full recommendation form"
                                    >
                                      {isDraft ? (lang === "si" ? "කෙටුම්පත සංස්කරණය" : "Edit Draft") : (lang === "si" ? "බලන්න / සංස්කරණය" : "View / Edit")}
                                    </button>
                                    {item.category === "issuing_charge_sheet" && (
                                      <Link
                                        href={`/subject?tab=issuing_charge_sheet&caseNo=${encodeURIComponent(item.caseNo)}`}
                                        className="btn-view-inspection"
                                        style={{ backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}
                                        title="Open Issuing Charge Sheet Dossier"
                                      >
                                        <FileCheck size={12} />
                                        <span>{lang === "si" ? "චෝදනා පත්‍ර" : "Charge Sheet"}</span>
                                      </Link>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setSelectedRecModal(item)}
                                      className="btn-quick-view"
                                      title="Quick Preview"
                                    >
                                      <Eye size={13} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="text-center py-5 text-muted" style={{ padding: "40px 20px" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                            <Sparkles size={44} style={{ color: "#cbd5e1" }} />
                            <span style={{ fontSize: "15px", fontWeight: 600, color: "#64748b" }}>
                              {recSearchQuery || recCategoryFilter !== "all" || recUrgencyFilter !== "all" || recStatusFilter !== "all"
                                ? (lang === "si" ? "සෙවීමට ගැළපෙන මූලික විමර්ශන නිර්දේශ හමු නොවිණි" : "No cases or recommendations found matching search criteria")
                                : (lang === "si" ? "තවම මූලික විමර්ශන නිර්දේශ ඉදිරිපත් කර නොමැත" : "No cases or investigation recommendations registered yet")}
                            </span>
                            <button
                              type="button"
                              onClick={() => setViewMode("form")}
                              className="btn-submit-recommendation"
                              style={{ marginTop: "4px" }}
                            >
                              <Plus size={16} />
                              <span>{lang === "si" ? "නව නිර්දේශයක් එක් කරන්න" : "Create First Recommendation"}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Quick Preview Modal */}
          {selectedRecModal && (
            <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="rec-modal-title">
              <div className="modal-content-wrapper premium-modal" style={{ maxWidth: "650px", width: "95%", borderRadius: "16px", overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15)" }}>
                <header className="modal-header" style={{ padding: "18px 24px", backgroundColor: "#1e1b4b", color: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Sparkles size={20} style={{ color: "#a5b4fc" }} />
                    </div>
                    <div>
                      <h3 id="rec-modal-title" style={{ color: "#ffffff", margin: 0, fontSize: "17px", fontWeight: 700 }}>
                        {lang === "si" ? "මූලික විමර්ශන නිර්දේශ විස්තරය" : "Investigation Recommendation Details"}
                      </h3>
                      <span style={{ fontSize: "12px", color: "#cbd5e1" }}>
                        Case: <strong>{selectedRecModal.caseNo}</strong> {selectedRecModal.letterNo && selectedRecModal.letterNo !== selectedRecModal.caseNo ? `• Letter: ${selectedRecModal.letterNo}` : ""}
                      </span>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setSelectedRecModal(null)}
                    style={{ color: "#ffffff", backgroundColor: "rgba(255,255,255,0.1)", border: "none", padding: "8px", borderRadius: "50%", cursor: "pointer" }}
                  >
                    <X size={18} />
                  </button>
                </header>

                <div style={{ padding: "20px 24px", backgroundColor: "#ffffff", display: "flex", flexDirection: "column", gap: "16px", maxHeight: "70vh", overflowY: "auto" }}>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    <span className="badge-category-tag" style={{ maxWidth: "none", fontSize: "12px", padding: "4px 12px" }}>
                      {getCategoryLabel(selectedRecModal.category)}
                    </span>
                    {selectedRecModal.urgency === "high" ? (
                      <span className="badge-urgency-high">🔴 High Urgency</span>
                    ) : (
                      <span className="badge-urgency-normal">🟡 Normal Urgency</span>
                    )}
                    <span className="badge-status-submitted-rec">
                      {selectedRecModal.status || "Submitted"}
                    </span>
                  </div>

                  <div style={{ backgroundColor: "#f8fafc", padding: "14px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Accused Officer</div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b", marginTop: "2px" }}>
                        {selectedRecModal.accusedName || "—"}
                      </div>
                      {selectedRecModal.schoolName && (
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>{selectedRecModal.schoolName}</div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Forwarded To</div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b", marginTop: "2px" }}>
                        {getForwardToLabel(selectedRecModal.forwardTo)}
                      </div>
                      {selectedRecModal.targetDate && (
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>Target: {selectedRecModal.targetDate}</div>
                      )}
                    </div>
                  </div>

                  {/* Charge Sheet & Disciplinary Authority Details (If present) */}
                  {(selectedRecModal.issuedChargeSheet || selectedRecModal.disciplinaryAuthority || selectedRecModal.dateRequestDocuments || selectedRecModal.dateSubmissionDocuments || selectedRecModal.agreeWithAnswers || selectedRecModal.dateDraftSubmittedPsc || selectedRecModal.agreeWithPscDecision || selectedRecModal.chargeSheetIssuedDate || selectedRecModal.chargeSheetResponseDate || selectedRecModal.disciplinaryOrder) && (
                    <div style={{ backgroundColor: "#f0f4ff", padding: "14px 16px", borderRadius: "10px", border: "1.5px solid #c7d2fe", display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#3730a3", display: "flex", alignItems: "center", gap: "6px" }}>
                        <FileCheck size={16} />
                        <span>{lang === "si" ? "චෝදනා පත්‍රය සහ විනය බලධාරියා පිළිබඳ විස්තර" : "Charge Sheet & Disciplinary Authority Details"}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        {selectedRecModal.issuedChargeSheet && (
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                              {lang === "si" ? "චෝදනා පත්‍රය (Issued Charge Sheet)" : "Issued Charge Sheet"}
                            </div>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e1b4b", marginTop: "2px" }}>
                              {selectedRecModal.issuedChargeSheet === "first_schedule"
                                ? "First Schedule (පළමු උපලේඛනය)"
                                : selectedRecModal.issuedChargeSheet === "second_schedule"
                                ? "Second Schedule (දෙවන උපලේඛනය)"
                                : selectedRecModal.issuedChargeSheet}
                            </div>
                          </div>
                        )}
                        {selectedRecModal.disciplinaryAuthority && (
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                              {lang === "si" ? "විනය බලධාරියා (Disciplinary Authority)" : "Disciplinary Authority"}
                            </div>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e1b4b", marginTop: "2px" }}>
                              {selectedRecModal.disciplinaryAuthority === "psc_esc"
                                ? "PSC / ESC (රාජ්‍ය සේවා කොමිෂන් සභාව)"
                                : "Secretary of Education (අධ්‍යාපන ලේකම්)"}
                            </div>
                          </div>
                        )}
                        {selectedRecModal.dateRequestDocuments && (
                          <div style={{ gridColumn: "span 2" }}>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                              {lang === "si" ? "ලිපි ලේඛන ඉල්ලා සිටි දිනය (Request for Documents)" : "Request for Documents Date"}
                            </div>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e1b4b", marginTop: "2px" }}>
                              {selectedRecModal.dateRequestDocuments}
                            </div>
                          </div>
                        )}
                        {selectedRecModal.dateSubmissionDocuments && (
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                              {lang === "si" ? "ලිපි ලේඛන ඉදිරිපත් කළ දිනය" : "Document Submission Date"}
                            </div>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e1b4b", marginTop: "2px" }}>
                              {selectedRecModal.dateSubmissionDocuments}
                            </div>
                          </div>
                        )}
                        {selectedRecModal.agreeWithAnswers && selectedRecModal.disciplinaryAuthority !== "psc_esc" && (
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                              {lang === "si" ? "පිළිතුරු සමඟ එකඟ වන්නේද?" : "Agree with Answers?"}
                            </div>
                            <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "2px", color: selectedRecModal.agreeWithAnswers === "yes" ? "#16a34a" : "#dc2626" }}>
                              {selectedRecModal.agreeWithAnswers === "yes" ? "Yes (ඔව්)" : "No (නැත)"}
                            </div>
                          </div>
                        )}
                        {selectedRecModal.dateDraftSubmittedPsc && (
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                              {lang === "si" ? "කෙටුම්පත PSC/ESC වෙත යැවූ දිනය" : "Date Draft Submitted to PSC/ESC"}
                            </div>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e1b4b", marginTop: "2px" }}>
                              {selectedRecModal.dateDraftSubmittedPsc}
                            </div>
                          </div>
                        )}
                        {selectedRecModal.agreeWithPscDecision && (
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                              {lang === "si" ? "PSC/ESC තීරණයට එකඟද?" : "Agree with PSC/ESC Decision?"}
                            </div>
                            <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "2px", color: selectedRecModal.agreeWithPscDecision === "yes" ? "#16a34a" : "#dc2626" }}>
                              {selectedRecModal.agreeWithPscDecision === "yes" ? "Yes (ඔව්)" : "No (නැත)"}
                            </div>
                          </div>
                        )}
                        {selectedRecModal.chargeSheetIssuedDate && (
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                              {lang === "si" ? "චෝදනා පත්‍රය නිකුත් කළ දිනය" : "Date Issued"}
                            </div>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e1b4b", marginTop: "2px" }}>
                              {selectedRecModal.chargeSheetIssuedDate}
                            </div>
                          </div>
                        )}
                        {selectedRecModal.chargeSheetResponseDate && (
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                              {lang === "si" ? "පිළිතුරු ලබා දුන් දිනය" : "Response Date"}
                            </div>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e1b4b", marginTop: "2px" }}>
                              {selectedRecModal.chargeSheetResponseDate}
                            </div>
                          </div>
                        )}
                        {selectedRecModal.disciplinaryOrder && (
                          <div style={{ gridColumn: "span 2" }}>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                              {lang === "si" ? "විනය නියෝගය (Disciplinary Order)" : "Disciplinary Order"}
                            </div>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e1b4b", marginTop: "2px" }}>
                              {selectedRecModal.disciplinaryOrder}
                            </div>
                          </div>
                        )}
                        {(selectedRecModal.agreeWithAnswers === "yes" || selectedRecModal.agreeWithPscDecision === "yes" || selectedRecModal.status === "Closed") && (
                          <div style={{ gridColumn: "span 2", marginTop: "6px", padding: "10px 14px", backgroundColor: "#ecfdf5", border: "1px solid #86efac", borderRadius: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                            <CheckCircle2 size={16} style={{ color: "#16a34a" }} />
                            <span style={{ fontSize: "13px", fontWeight: 700, color: "#166534" }}>
                              {lang === "si" ? "ලිපි තත්ත්වය: අවසන් (Letter Status: Closed)" : "Letter Status: Closed"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Secretary of Education Approval Details (If present) */}
                  {(selectedRecModal.secretaryApprovalDate || selectedRecModal.secretaryApprovedRecommendation) && (
                    <div style={{ backgroundColor: "#fffbeb", padding: "14px 16px", borderRadius: "10px", border: "1.5px solid #fde68a", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#92400e", display: "flex", alignItems: "center", gap: "6px" }}>
                        <UserCheck size={16} style={{ color: "#d97706" }} />
                        <span>{lang === "si" ? "අධ්‍යාපන ලේකම්ගේ අනුමැතිය සහ නියෝග" : "Secretary of Education Approval & Directive"}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        {selectedRecModal.secretaryApprovalDate && (
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#92400e", textTransform: "uppercase" }}>
                              {lang === "si" ? "අනුමත කළ දිනය" : "Date Approved by Secretary"}
                            </div>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e1b4b", marginTop: "2px" }}>
                              {selectedRecModal.secretaryApprovalDate}
                            </div>
                          </div>
                        )}
                        {selectedRecModal.secretaryApprovedRecommendation && (
                          <div style={{ gridColumn: selectedRecModal.secretaryApprovalDate ? "1 / span 2" : "span 2" }}>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#92400e", textTransform: "uppercase" }}>
                              {lang === "si" ? "අනුමත කළ නිර්දේශය" : "Recommendation Approved by Secretary"}
                            </div>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e1b4b", marginTop: "2px", whiteSpace: "pre-wrap" }}>
                              {selectedRecModal.secretaryApprovedRecommendation}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedRecModal.title && (
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Recommendation Title:</div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#1e1b4b", backgroundColor: "#f1f5f9", padding: "10px 14px", borderRadius: "8px" }}>
                        {selectedRecModal.title}
                      </div>
                    </div>
                  )}

                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Recommendation Content & Findings:</div>
                    <div style={{ fontSize: "13px", color: "#334155", backgroundColor: "#ffffff", padding: "12px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                      {selectedRecModal.recommendationText || "No detailed text provided."}
                    </div>
                  </div>

                  {selectedRecModal.disciplinaryAction && (
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Proposed Disciplinary Action:</div>
                      <div style={{ fontSize: "13px", color: "#334155", backgroundColor: "#fff7ed", padding: "10px 14px", borderRadius: "8px", border: "1px solid #ffedd5" }}>
                        {selectedRecModal.disciplinaryAction}
                      </div>
                    </div>
                  )}

                  {selectedRecModal.referenceNotes && (
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Reference Notes & Remarks:</div>
                      <div style={{ fontSize: "13px", color: "#64748b", backgroundColor: "#f8fafc", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        {selectedRecModal.referenceNotes}
                      </div>
                    </div>
                  )}
                </div>

                <footer style={{ padding: "14px 24px", borderTop: "1px solid #e2e8f0", backgroundColor: "#f8fafc", display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setSelectedRecModal(null)}
                    style={{ padding: "8px 18px", borderRadius: "8px", backgroundColor: "#ffffff", border: "1px solid #cbd5e1", color: "#475569", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
                  >
                    Close
                  </button>
                  {selectedRecModal?.category === "issuing_charge_sheet" && (
                    <Link
                      href={`/subject?tab=issuing_charge_sheet&caseNo=${encodeURIComponent(selectedRecModal.caseNo)}`}
                      className="btn-view-inspection"
                      style={{ padding: "8px 16px", fontSize: "13px", backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}
                    >
                      <FileCheck size={14} />
                      <span>{lang === "si" ? "චෝදනා පත්‍ර නිකුත් කිරීම වෙත යන්න" : "Go to Issuing Charge Sheet"}</span>
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const sel = selectedRecModal;
                      setSelectedRecModal(null);
                      setCaseNo(sel.caseNo);
                      fetchCaseDetails(sel.caseNo);
                      setViewMode("form");
                    }}
                    className="btn-submit-recommendation"
                    style={{ padding: "8px 20px", fontSize: "13px" }}
                  >
                    <ExternalLink size={14} />
                    <span>Open in Form</span>
                  </button>
                </footer>
              </div>
            </div>
          )}

          {/* Footer Branding Notice */}
          <SiteFooter />
        </main>
      </div>
    </div>
  );
}

export default function RecommendationPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Loading Investigation Recommendation...</div>}>
      <RecommendationFormContent />
    </Suspense>
  );
}
