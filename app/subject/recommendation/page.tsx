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
  const lang = i18n.language;

  // Client mount state to prevent SSR/CSR hydration mismatches
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Mobile sidebar visibility state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // View Mode: 'form' (Formulate Recommendation) vs 'list' (All Recommendations & Completed Cases)
  const [viewMode, setViewMode] = useState<"form" | "list">(caseNoParam ? "form" : "list");

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
  const [recommendationCategory, setRecommendationCategory] = useState("issuing_charge_sheet");
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

  // Secretary of Education Approval State
  const [secretaryApprovalDate, setSecretaryApprovalDate] = useState("");
  const [secretaryApprovedRecommendation, setSecretaryApprovedRecommendation] = useState("");

  // List View Filter & Search State
  const [recSearchQuery, setRecSearchQuery] = useState("");
  const [recCategoryFilter, setRecCategoryFilter] = useState("all");
  const [recUrgencyFilter, setRecUrgencyFilter] = useState("all");
  const [recStatusFilter, setRecStatusFilter] = useState("all");
  const [selectedRecModal, setSelectedRecModal] = useState<RecommendationRecord | null>(null);

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
    document.title = `${lang === "si" ? "විමර්ශන නිර්දේශ" : lang === "ta" ? "விசாரணை பரிந்துரை" : "Investigation Recommendation"} | DCMMS`;
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
    const payload: any = {
      ref_number: caseNo,
      case_no: caseNo,
      letter_no: letterNo || null,
      category_recommendation: recommendationCategory,
      category: recommendationCategory,
      case_status: "Draft",
      status: "Draft",
      target_implementation_date: targetDate || null,
      target_date: targetDate || null,
      investigation_recommendation: recommendationText,
      recommendation_text: recommendationText,
      circular_reference: disciplinaryAction || null,
      disciplinary_action: disciplinaryAction || null,
      minute_ref: referenceNotes || null,
      reference_notes: referenceNotes || null,
      date_approved_by_secretory: secretaryApprovalDate || null,
      secretary_approval_date: secretaryApprovalDate || null,
      secretory_recommendation: secretaryApprovedRecommendation || null,
      secretary_approved_recommendation: secretaryApprovedRecommendation || null,
      urgency: recommendationUrgency,
      title: recommendationTitle || "Preliminary Investigation Recommendation",
      forward_to: forwardTo,
      issued_charge_sheet: recommendationCategory === "issuing_charge_sheet" ? issuedChargeSheet : null,
      charge_sheet_issued_date: recommendationCategory === "issuing_charge_sheet" ? (chargeSheetIssuedDate || null) : null,
      date_the_charge_sheet_issued: recommendationCategory === "issuing_charge_sheet" ? (chargeSheetIssuedDate || null) : null,
      charge_sheet_response_date: recommendationCategory === "issuing_charge_sheet" ? (chargeSheetResponseDate || null) : null,
      date_the_response_to_the_charge_sheet_was_given: recommendationCategory === "issuing_charge_sheet" ? (chargeSheetResponseDate || null) : null,
      disciplinary_order: recommendationCategory === "issuing_charge_sheet" ? disciplinaryOrder : null,
    };

    try {
      // 1. Save to PostgreSQL (investigation_table & charge_sheet_table) via Server Action
      await saveRecommendationServer(payload);

      // 2. Audit logging
      const profile = await getCurrentProfile();
      await logAuditEvent("SAVE_RECOMMENDATION_DRAFT", "Recommendation", caseNo, { title: payload.title }, profile?.full_name || profile?.id || "Subject Officer");

      // 3. LocalStorage sync
      if (typeof window !== "undefined") {
        const storedRecs = localStorage.getItem("dcmms_recommendations") || "[]";
        let recList = [];
        try { recList = JSON.parse(storedRecs); } catch (e) {}
        recList = recList.filter((r: any) => String(r.caseNo || r.case_no || "").trim().toLowerCase() !== caseNo.trim().toLowerCase());
        recList.push({
          caseNo,
          letterNo,
          category: recommendationCategory,
          urgency: recommendationUrgency,
          title: recommendationTitle,
          recommendationText,
          disciplinaryAction,
          forwardTo,
          targetDate,
          referenceNotes,
          issuedChargeSheet: recommendationCategory === "issuing_charge_sheet" ? issuedChargeSheet : "",
          chargeSheetIssuedDate: recommendationCategory === "issuing_charge_sheet" ? chargeSheetIssuedDate : "",
          chargeSheetResponseDate: recommendationCategory === "issuing_charge_sheet" ? chargeSheetResponseDate : "",
          disciplinaryOrder: recommendationCategory === "issuing_charge_sheet" ? disciplinaryOrder : "",
          secretaryApprovalDate,
          secretaryApprovedRecommendation,
          status: "Draft",
          updatedAt: now
        });
        localStorage.setItem("dcmms_recommendations", JSON.stringify(recList));
        window.dispatchEvent(new Event("storage"));
      }

      showToast(lang === "si" ? "කෙටුම්පත සාර්ථකව සුරකින ලදී!" : "Draft saved successfully!");
      loadCasesAndRecommendationsList();
    } catch (err) {
      console.error("Save draft error:", err);
      showToast("Draft saved locally.");
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Recommendation Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!caseNo.trim()) {
      showToast(lang === "si" ? "කරුණාකර නඩුවක් තෝරන්න." : "Please select a valid case.");
      return;
    }

    if (!recommendationText.trim()) {
      showToast(lang === "si" ? "කරුණාකර නිර්දේශ විස්තර ඇතුළත් කරන්න." : "Please provide detailed recommendation text.");
      return;
    }

    setIsSaving(true);
    const now = new Date().toISOString().slice(0, 10);
    const statusToSave = recommendationStatus || "Submitted";
    const payload: any = {
      ref_number: caseNo,
      case_no: caseNo,
      letter_no: letterNo || null,
      category_recommendation: recommendationCategory,
      category: recommendationCategory,
      case_status: statusToSave,
      status: statusToSave,
      target_implementation_date: targetDate || null,
      target_date: targetDate || null,
      investigation_recommendation: recommendationText,
      recommendation_text: recommendationText,
      circular_reference: disciplinaryAction || null,
      disciplinary_action: disciplinaryAction || null,
      minute_ref: referenceNotes || null,
      reference_notes: referenceNotes || null,
      date_approved_by_secretory: secretaryApprovalDate || null,
      secretary_approval_date: secretaryApprovalDate || null,
      secretory_recommendation: secretaryApprovedRecommendation || null,
      secretary_approved_recommendation: secretaryApprovedRecommendation || null,
      urgency: recommendationUrgency,
      title: recommendationTitle || "Formal Preliminary Recommendation",
      forward_to: forwardTo,
      issued_charge_sheet: recommendationCategory === "issuing_charge_sheet" ? issuedChargeSheet : null,
      charge_sheet_issued_date: recommendationCategory === "issuing_charge_sheet" ? (chargeSheetIssuedDate || null) : null,
      date_the_charge_sheet_issued: recommendationCategory === "issuing_charge_sheet" ? (chargeSheetIssuedDate || null) : null,
      charge_sheet_response_date: recommendationCategory === "issuing_charge_sheet" ? (chargeSheetResponseDate || null) : null,
      date_the_response_to_the_charge_sheet_was_given: recommendationCategory === "issuing_charge_sheet" ? (chargeSheetResponseDate || null) : null,
      disciplinary_order: recommendationCategory === "issuing_charge_sheet" ? disciplinaryOrder : null,
    };

    try {
      // 1. Save to PostgreSQL (investigation_table & charge_sheet_table) via Server Action
      await saveRecommendationServer(payload);

      // 2. Audit logging
      const profile = await getCurrentProfile();
      await logAuditEvent("SUBMIT_RECOMMENDATION", "Recommendation", caseNo, { title: payload.title }, profile?.full_name || profile?.id || "Subject Officer");

      // 3. LocalStorage sync
      if (typeof window !== "undefined") {
        const storedRecs = localStorage.getItem("dcmms_recommendations") || "[]";
        let recList = [];
        try { recList = JSON.parse(storedRecs); } catch (e) {}
        recList = recList.filter((r: any) => String(r.caseNo || r.case_no || "").trim().toLowerCase() !== caseNo.trim().toLowerCase());
        recList.push({
          caseNo,
          letterNo,
          category: recommendationCategory,
          urgency: recommendationUrgency,
          title: recommendationTitle,
          recommendationText,
          disciplinaryAction,
          forwardTo,
          targetDate,
          referenceNotes,
          issuedChargeSheet: recommendationCategory === "issuing_charge_sheet" ? issuedChargeSheet : "",
          chargeSheetIssuedDate: recommendationCategory === "issuing_charge_sheet" ? chargeSheetIssuedDate : "",
          chargeSheetResponseDate: recommendationCategory === "issuing_charge_sheet" ? chargeSheetResponseDate : "",
          disciplinaryOrder: recommendationCategory === "issuing_charge_sheet" ? disciplinaryOrder : "",
          secretaryApprovalDate,
          secretaryApprovedRecommendation,
          status: "Submitted",
          submittedAt: now,
          updatedAt: now
        });
        localStorage.setItem("dcmms_recommendations", JSON.stringify(recList));

        const storedAsgns = localStorage.getItem("dcmms_subject_assignments") || "[]";
        let asgnList = [];
        try { asgnList = JSON.parse(storedAsgns); } catch (e) {}
        asgnList = asgnList.map((a: any) => {
          if (String(a.caseNo || a.case_no || "").trim().toLowerCase() === caseNo.trim().toLowerCase()) {
            return {
              ...a,
              status: "Implementation of Recommendations",
              recommendationSubmitted: true,
              recommendationSubmittedAt: now,
              recommendationText
            };
          }
          return a;
        });
        localStorage.setItem("dcmms_subject_assignments", JSON.stringify(asgnList));

        const storedCases = localStorage.getItem("dcmms_cases") || "[]";
        let caseList = [];
        try { caseList = JSON.parse(storedCases); } catch (e) {}
        caseList = caseList.map((c: any) => {
          if (String(c.caseNo || c.refNo || "").trim().toLowerCase() === caseNo.trim().toLowerCase()) {
            return {
              ...c,
              status: "Implementation of Recommendations"
            };
          }
          return c;
        });
        localStorage.setItem("dcmms_cases", JSON.stringify(caseList));

        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(new CustomEvent("dcmms_assignment_updated"));
      }

      showToast(lang === "si" ? "නිර්දේශය සාර්ථකව ඉදිරිපත් කරන ලදී!" : "Recommendation submitted successfully!");
      loadCasesAndRecommendationsList();

      setTimeout(() => {
        setViewMode("list");
      }, 1000);
    } catch (err) {
      console.error("Submit recommendation error:", err);
      showToast("Recommendation saved locally.");
    } finally {
      setIsSaving(false);
    }
  };

  const getCategoryLabel = (cat?: string) => {
    switch (cat) {
      case "issuing_charge_sheet":
        return lang === "si" ? "චෝදනා පත්‍රයක් නිකුත් කිරීම" : "Issuing Charge Sheet";
      case "action_based_on_court_verdict":
        return lang === "si" ? "අධිකරණ තීන්දුව මත ක්‍රියාමාර්ග" : "Court Verdict Action";
      case "giving_warnings_advice":
        return lang === "si" ? "අවවාද / උපදෙස් ලබා දීම" : "Giving Warnings/Advice";
      case "transfers":
        return lang === "si" ? "ස්ථාන මාරු කිරීම්" : "Transfers";
      case "charging_based_on_more_104":
        return lang === "si" ? "MoRE 104 චෝදනා" : "MoRE 104 Charging";
      case "terminating_service":
        return lang === "si" ? "සේවය අවසන් කිරීම" : "Terminating Service";
      case "sending_recommendation_other_departments":
        return lang === "si" ? "වෙනත් දෙපාර්තමේන්තු වෙත" : "Other Departments";
      case "closing_action_non_disclosure":
        return lang === "si" ? "ක්‍රියාමාර්ගය අවසන් කිරීම" : "Closing Action";
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

  const pendingCases = allRecommendations.filter((r) => r.status === "Awaiting Recommendation" || !r.recommendationText);

  if (!mounted) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" }}>
        <div style={{ color: "#64748b", fontWeight: 600, fontSize: "14px" }}>Loading Investigation Recommendation...</div>
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
                {lang === "si" ? "විමර්ශන නිර්දේශ" : lang === "ta" ? "விசாரணை பரிந்துரை" : "Investigation Recommendation"}
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
              <span>{viewMode === "form" ? (lang === "si" ? "සියලු නිර්දේශ ලැයිස්තුව" : "View All Recommendations") : (lang === "si" ? "නිර්දේශ පෝරමය" : "Open Form")}</span>
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
          <div className="recommendation-header" style={{ marginBottom: "20px" }}>
            <div className="recommendation-title-group">
              <h1>
                <ClipboardList size={28} style={{ color: "#059669" }} />
                {lang === "si"
                  ? "විමර්ශන නිර්දේශ සහ විනය ක්‍රියාමාර්ග පෝරමය"
                  : lang === "ta"
                  ? "விசாரணை பரிந்துரை மற்றும் ஒழுங்கு நடவடிக்கை படிவம்"
                  : "Investigation Recommendation & Action Page"}
              </h1>
              <p>
                {lang === "si"
                  ? "මූලික විමර්ශනය අවසන් වූ නඩු සඳහා නිල නිර්දේශ, සොයාගැනීම් සහ ඉදිරි විනය ක්‍රියාමාර්ග ඇතුළත් කිරීමේ වෙනම පිටුව."
                  : "Dedicated page to review completed investigation cases, submit formal disciplinary recommendations, and route findings."}
              </p>
            </div>

            <div className="recommendation-actions">
              <Link href="/subject" className="btn-back-gray">
                <ArrowLeft size={16} />
                <span>{lang === "si" ? "ආපසු මුල් පිටුවට" : "Back to Cases"}</span>
              </Link>

              {viewMode === "form" && (
                <>
                  <button type="button" onClick={handleSaveDraft} disabled={isSaving} className="btn-save-draft">
                    <Save size={16} />
                    <span>{lang === "si" ? "කෙටුම්පත සුරකින්න" : "Save Draft"}</span>
                  </button>

                  <button type="button" onClick={handleSubmit} disabled={isSaving} className="btn-submit-recommendation">
                    <Send size={16} />
                    <span>{lang === "si" ? "නිර්දේශය ඉදිරිපත් කරන්න" : "Submit Recommendation"}</span>
                  </button>
                </>
              )}
            </div>
          </div>



          {/* ============================================================
             VIEW MODE 1: FORMULATE RECOMMENDATION FORM
             ============================================================ */}
          {viewMode === "form" && (
            <>
              {/* Case Quick Selector Bar */}
              <div style={{ backgroundColor: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "14px 18px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <label htmlFor="caseSelectorSelect" style={{ fontSize: "13px", fontWeight: 700, color: "#1e1b4b" }}>
                    {lang === "si" ? "අදාළ නඩුව තෝරන්න (Select Case):" : "Select Target Case for Recommendation:"}
                  </label>
                  <select
                    id="caseSelectorSelect"
                    value={caseNo}
                    onChange={(e) => {
                      const selected = e.target.value;
                      setCaseNo(selected);
                      fetchCaseDetails(selected);
                    }}
                    style={{ padding: "8px 12px", borderRadius: "8px", border: "1.5px solid #6366f1", fontWeight: 700, color: "#1e1b4b", fontSize: "14px", backgroundColor: "#f8fafc", cursor: "pointer" }}
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
                      {lang === "si" ? "නඩු අංකය:" : "Case Ref:"} {caseNo || "N/A"}
                    </span>
                    {letterNo && (
                      <span className="badge-case-no" style={{ backgroundColor: "#f8fafc" }}>
                        {lang === "si" ? "ලිපි අංකය:" : "Letter Ref:"} {letterNo}
                      </span>
                    )}
                    <span className="badge-status-completed">
                      <CheckCircle2 size={14} />
                      {lang === "si" ? "මූලික විමර්ශනය අවසන්" : "Preliminary Investigation Complete"}
                    </span>
                  </div>

                  <div style={{ fontSize: "12.5px", color: "#047857", fontWeight: 600 }}>
                    {initialCompletedDate ? (
                      <span>
                        {lang === "si" ? "අවසන් කළ දිනය:" : "Informed Date:"} {initialCompletedDate}
                      </span>
                    ) : (
                      <span>
                        {lang === "si" ? "අද දිනය:" : "Today:"} {new Date().toISOString().slice(0, 10)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="case-summary-grid">
                  <div className="summary-item">
                    <span className="summary-label">{lang === "si" ? "පැමිණිලිකරුගේ නම" : "Complainant Name"}</span>
                    <span className="summary-value">{complainantName || "—"}</span>
                  </div>

                  <div className="summary-item">
                    <span className="summary-label">{lang === "si" ? "චෝදනා ලැබූ නිලධාරියා" : "Accused Officer"}</span>
                    <span className="summary-value">
                      {accusedName || "—"} {accusedDesignation ? `(${accusedDesignation})` : ""}
                    </span>
                  </div>

                  <div className="summary-item">
                    <span className="summary-label">{lang === "si" ? "පාසල / ආයතනය" : "School / Institute"}</span>
                    <span className="summary-value">{schoolName || "—"}</span>
                  </div>

                  <div className="summary-item">
                    <span className="summary-label">{lang === "si" ? "විෂය කරුණ / පැමිණිල්ල" : "Subject Matter"}</span>
                    <span className="summary-value" style={{ wordBreak: "break-word" }}>
                      {caseSubject || "Formal disciplinary & preliminary investigation inquiry"}
                    </span>
                  </div>
                </div>
              </section>

              {/* Main Form */}
              <form onSubmit={handleSubmit}>
                {/* Card 1: Recommendation Category & Summary */}
                <section className="recommendation-form-card">
                  <div className="section-header-pill">
                    <Sparkles size={16} />
                    <span>{lang === "si" ? "1. නිර්දේශ වර්ගීකරණය සහ ප්‍රමුඛතාව" : "1. Recommendation Classification & Priority"}</span>
                  </div>

                  <div className="form-grid-2">
                    <div className="form-field-group">
                      <label className="form-field-label">
                        {lang === "si"
                          ? "නිර්දේශ වර්ගය / කාණ්ඩය (Type / Category)"
                          : "Type / Category of Recommendation"}
                        <span className="required-asterisk">*</span>
                      </label>
                      <select
                        value={recommendationCategory}
                        onChange={(e) => setRecommendationCategory(e.target.value)}
                        className="form-field-select"
                        required
                      >
                        <option value="issuing_charge_sheet">
                          {lang === "si" ? "චෝදනා පත්‍රයක් නිකුත් කිරීම (Issuing a charge sheet)" : "Issuing a charge sheet"}
                        </option>
                        <option value="action_based_on_court_verdict">
                          {lang === "si" ? "අවසන් අධිකරණ තීන්දුව මත පදනම්ව ක්‍රියාමාර්ග ගැනීම" : "Action based on court verdict"}
                        </option>
                        <option value="giving_warnings_advice">
                          {lang === "si" ? "අවවාද / උපදෙස් ලබා දීම (Giving warnings/advice)" : "Giving warnings/advice"}
                        </option>
                        <option value="transfers">
                          {lang === "si" ? "ස්ථාන මාරු කිරීම් (Transfers)" : "Transfers"}
                        </option>
                        <option value="charging_based_on_more_104">
                          {lang === "si" ? "MoRE 104 පරීක්ෂණය මත පදනම්ව චෝදනා ගොනු කිරීම" : "Charging based on MoRE 104"}
                        </option>
                        <option value="terminating_service">
                          {lang === "si" ? "සේවය අවසන් කිරීම (Terminating service)" : "Terminating service"}
                        </option>
                        <option value="sending_recommendation_other_departments">
                          {lang === "si" ? "නිර්දේශය වෙනත් දෙපාර්තමේන්තු වෙත යොමු කිරීම" : "Sending to other departments"}
                        </option>
                        <option value="closing_action_non_disclosure">
                          {lang === "si" ? "කරුණු අනාවරණය නොවීම හේතුවෙන් අවසන් කිරීම" : "Closing (non-disclosure of facts)"}
                        </option>
                        <option value="other">
                          {lang === "si" ? "වෙනත් විශේෂ නිර්දේශ (Other)" : "Other"}
                        </option>
                      </select>
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">
                        {lang === "si" ? "ප්‍රමුඛතා මට්ටම" : "Urgency / Priority"}
                      </label>
                      <select
                        value={recommendationUrgency}
                        onChange={(e) => setRecommendationUrgency(e.target.value)}
                        className="form-field-select"
                      >
                        <option value="high">{lang === "si" ? "🔴 ඉහළ / කඩිනම් (High / Urgent)" : "🔴 High / Urgent"}</option>
                        <option value="normal">{lang === "si" ? "🟡 සාමාන්‍ය (Normal / Medium)" : "🟡 Normal / Medium"}</option>
                        <option value="low">{lang === "si" ? "🟢 අඩු (Low)" : "🟢 Low"}</option>
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
                        <option value="Submitted">{lang === "si" ? "නිර්දේශය ඉදිරිපත් කරන ලදී (Recommendation Submitted)" : "Recommendation Submitted"}</option>
                        <option value="Implementation of Recommendations">{lang === "si" ? "නිර්දේශ ක්‍රියාත්මක කිරීමේ අදියර (Implementation of Recommendations)" : "Implementation of Recommendations"}</option>
                        <option value="Draft">{lang === "si" ? "කෙටුම්පතක් ලෙස පමණක් සුරකින්න (Draft)" : "Draft"}</option>
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
                </section>

                {/* Conditional Section: Charge Sheet & Disciplinary Order Details (Displayed ONLY when 'issuing a charge sheet' is selected) */}
                {recommendationCategory === "issuing_charge_sheet" && (
                  <section className="recommendation-form-card charge-sheet-card">
                    <div className="section-header-pill charge-sheet-pill">
                      <FileCheck size={16} />
                      <span>
                        {lang === "si"
                          ? "චෝදනා පත්‍රය සහ විනය නියෝගය පිළිබඳ විස්තර"
                          : lang === "ta"
                          ? "குற்றப்பத்திரிகை மற்றும் ஒழுங்கு நடவடிக்கை உத்தரவு விவரங்கள்"
                          : "Charge Sheet & Disciplinary Order Details"}
                      </span>
                    </div>

                    <div className="form-grid-3">
                      {/* 1. Issued charge sheet */}
                      <div className="form-field-group">
                        <label className="form-field-label">
                          {lang === "si"
                            ? "නිකුත් කරන ලද චෝදනා පත්‍රය (Issued charge sheet)"
                            : lang === "ta"
                            ? "வழங்கப்பட்ட குற்றப்பத்திரிகை (Issued charge sheet)"
                            : "Issued charge sheet"}
                          <span className="required-asterisk">*</span>
                        </label>
                        <input
                          type="text"
                          value={issuedChargeSheet}
                          onChange={(e) => setIssuedChargeSheet(e.target.value)}
                          placeholder={
                            lang === "si"
                              ? "උදා: CS/2026/044 - මුදල් අක්‍රමිකතා චෝදනා පත්‍රය"
                              : "e.g., Charge Sheet No. / Specific charges / Reference"
                          }
                          className="form-field-input"
                          required={recommendationCategory === "issuing_charge_sheet"}
                        />
                      </div>

                      {/* 2. Date the charge sheet was issued */}
                      <div className="form-field-group">
                        <label className="form-field-label">
                          {lang === "si"
                            ? "චෝදනා පත්‍රය නිකුත් කළ දිනය"
                            : lang === "ta"
                            ? "குற்றப்பத்திரிகை வழங்கப்பட்ட திகதி"
                            : "Date the charge sheet was issued"}
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

                      {/* 3. Date the response to the charge sheet was given */}
                      <div className="form-field-group">
                        <label className="form-field-label">
                          {lang === "si"
                            ? "චෝදනා පත්‍රයට පිළිතුරු ලබා දුන් දිනය"
                            : lang === "ta"
                            ? "குற்றப்பத்திரிகைக்கு பதில் அளிக்கப்பட்ட திகதி"
                            : "Date the response to the charge sheet was given"}
                        </label>
                        <input
                          type="date"
                          value={chargeSheetResponseDate}
                          onChange={(e) => setChargeSheetResponseDate(e.target.value)}
                          className="form-field-input"
                        />
                      </div>
                    </div>

                    {/* 4. Disciplinary order */}
                    <div className="form-field-group" style={{ marginTop: "14px" }}>
                      <label className="form-field-label">
                        {lang === "si"
                          ? "විනය නියෝගය (Disciplinary order)"
                          : lang === "ta"
                          ? "ஒழுங்கு நடவடிக்கை உத்தரவு (Disciplinary order)"
                          : "Disciplinary order"}
                      </label>
                      <input
                        type="text"
                        value={disciplinaryOrder}
                        onChange={(e) => setDisciplinaryOrder(e.target.value)}
                        placeholder={
                          lang === "si"
                            ? "උදා: විධිමත් විනය පරීක්ෂණයක් පැවැත්වීමට නියෝග කිරීම / වැඩ තහනම් කිරීම"
                            : "e.g., Disciplinary inquiry ordered / Interdiction / Formal order details"
                        }
                        className="form-field-input"
                      />
                    </div>
                  </section>
                )}

                {/* Card 2: Detailed Findings & Recommendation */}
                <section className="recommendation-form-card">
                  <div className="section-header-pill">
                    <FileText size={16} />
                    <span>{lang === "si" ? "2. විස්තරාත්මක නිර්දේශ සහ නිරීක්ෂණ" : "2. Detailed Recommendation & Findings"}</span>
                  </div>

                  <div className="form-field-group">
                    <label className="form-field-label">
                      {lang === "si" ? "මූලික විමර්ශන වාර්තාව මත පදනම් වූ විස්තරාත්මක නිර්දේශය" : "Detailed Recommendation Text based on Preliminary Investigation Report"}
                      <span className="required-asterisk">*</span>
                    </label>
                    <textarea
                      value={recommendationText}
                      onChange={(e) => setRecommendationText(e.target.value)}
                      rows={6}
                      placeholder={
                        lang === "si"
                          ? "මූලික විමර්ශන කමිටු වාර්තාවේ කරුණු, සාක්ෂි හා නිරීක්ෂණ සැලකිල්ලට ගෙන විෂය භාර නිලධාරී ලෙස ඔබගේ සම්පූර්ණ නිර්දේශය මෙහි සටහන් කරන්න..."
                          : "State detailed findings, conclusions of the preliminary inquiry committee, and exact recommendations to be executed..."
                      }
                      className="form-field-textarea"
                      required
                    />

                    {/* Quick action presets */}
                    <div className="presets-container">
                      <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, alignSelf: "center" }}>
                        {lang === "si" ? "ඉක්මන් ආකෘති:" : "Quick Presets:"}
                      </span>
                      <button
                        type="button"
                        className="preset-chip"
                        onClick={() =>
                          handleApplyPreset(
                            lang === "si"
                              ? "මූලික විමර්ශන වාර්තාවේ සාක්ෂි අනුව අදාළ නිලධාරියාට විධිමත් චෝදනා පත්‍රයක් නිකුත් කිරීමට නිර්දේශ කරමි."
                              : "Evidence indicates prima facie misconduct; recommend issuing a formal charge sheet under the Establishment Code."
                          )
                        }
                      >
                        + {lang === "si" ? "චෝදනා පත්‍රයක් නිකුත් කිරීම" : "Issuing a Charge Sheet"}
                      </button>
                      <button
                        type="button"
                        className="preset-chip"
                        onClick={() =>
                          handleApplyPreset(
                            lang === "si"
                              ? "අදාළ අඩුපාඩු නිවැරදි කරගැනීමට නිලධාරියා වෙත ලිඛිත අවවාද සහ උපදෙස් ලබා දීමට නිර්දේශ කරමි."
                              : "Recommend issuing formal written warnings and administrative advice to the officer."
                          )
                        }
                      >
                        + {lang === "si" ? "අවවාද / උපදෙස් ලබා දීම" : "Warnings / Advice"}
                      </button>
                      <button
                        type="button"
                        className="preset-chip"
                        onClick={() =>
                          handleApplyPreset(
                            lang === "si"
                              ? "පරීක්ෂණයේ සාධාරණත්වය හා ආයතනික අවශ්‍යතාවය මත නිලධාරියා වහාම වෙනත් සේවා ස්ථානයකට මාරු කිරීමට නිර්දේශ කරමි."
                              : "Recommend administrative transfer of the officer with immediate effect."
                          )
                        }
                      >
                        + {lang === "si" ? "ස්ථාන මාරු කිරීම" : "Transfers"}
                      </button>
                      <button
                        type="button"
                        className="preset-chip"
                        onClick={() =>
                          handleApplyPreset(
                            lang === "si"
                              ? "MoRE 104 විමර්ශන වාර්තාවේ නිරීක්ෂණ මත පදනම්ව චෝදනා ගොනු කිරීමට නිර්දේශ කරමි."
                              : "Recommend filing charges based on the findings of MoRE 104 investigation."
                          )
                        }
                      >
                        + {lang === "si" ? "MoRE 104 පරීක්ෂණය මත චෝදනා" : "MoRE 104 Charging"}
                      </button>
                      <button
                        type="button"
                        className="preset-chip"
                        onClick={() =>
                          handleApplyPreset(
                            lang === "si"
                              ? "පරීක්ෂණයේදී කරුණු අනාවරණය නොවීම හේතුවෙන් මෙම නඩුවේ ක්‍රියාමාර්ගය අවසන් කිරීමට නිර්දේශ කරමි."
                              : "Allegations remain unsubstantiated due to non-disclosure of facts; recommend closing the action."
                          )
                        }
                      >
                        + {lang === "si" ? "කරුණු අනාවරණය නොවීම මත අවසන් කිරීම" : "Close (Non-disclosure)"}
                      </button>
                    </div>
                  </div>

                  <div className="form-grid-2" style={{ marginTop: "20px" }}>
                    <div className="form-field-group">
                      <label className="form-field-label">
                        {lang === "si" ? "ආයතන සංග්‍රහය / චක්‍රලේඛ අදාළ වගන්ති" : "Establishment Code / Circular Reference"}
                      </label>
                      <input
                        type="text"
                        value={disciplinaryAction}
                        onChange={(e) => setDisciplinaryAction(e.target.value)}
                        placeholder={lang === "si" ? "උදා: ආයතන සංග්‍රහයේ II කාණ්ඩයේ XLVIII පරිච්ඡේදය" : "e.g., Chapter XLVIII of Establishment Code / Ministry Circular No. 2024/08"}
                        className="form-field-input"
                      />
                    </div>

                    <div className="form-field-group">
                      <label className="form-field-label">
                        {lang === "si" ? "අදාළ ලේඛන / ලිපි ගොනු යොමු අංක" : "Supporting Documents / Minute Ref"}
                      </label>
                      <input
                        type="text"
                        value={referenceNotes}
                        onChange={(e) => setReferenceNotes(e.target.value)}
                        placeholder={lang === "si" ? "උදා: ED/DISC/2026/044 අංක දරන ලිපිගොනුව" : "e.g., Doc Ref: ED/DISC/2026/044"}
                        className="form-field-input"
                      />
                    </div>
                  </div>
                </section>

                {/* Card 3: Secretary of Education Approval Details */}
                <section className="recommendation-form-card secretary-approval-card">
                  <div className="section-header-pill secretary-approval-pill">
                    <UserCheck size={16} />
                    <span>
                      {lang === "si"
                        ? "3. අධ්‍යාපන ලේකම්ගේ අනුමැතිය සහ නියෝග"
                        : lang === "ta"
                        ? "3. கல்விச் செயலாளரின் ஒப்புதல் மற்றும் உத்தரவு"
                        : "3. Secretary of Education Approval & Directive"}
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

                  {/* Form Submission Action Buttons */}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #fde68a" }}>
                    <button type="button" onClick={() => setViewMode("list")} className="btn-back-gray">
                      {lang === "si" ? "ලැයිස්තුවට යන්න" : "View List"}
                    </button>

                    <button type="button" onClick={handleSaveDraft} disabled={isSaving} className="btn-save-draft">
                      <Save size={16} />
                      <span>{lang === "si" ? "කෙටුම්පත සුරකින්න" : "Save Draft"}</span>
                    </button>

                    <button type="submit" disabled={isSaving} className="btn-submit-recommendation">
                      <Send size={16} />
                      <span>{lang === "si" ? "නිර්දේශය ඉදිරිපත් කරන්න" : "Submit Recommendation"}</span>
                    </button>
                  </div>
                </section>
              </form>
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

                <div className="premium-stat-card inprogress-cases-card" style={{ height: "100px", padding: "16px", background: pendingCases.length > 0 ? "linear-gradient(135deg, #e11d48, #be123c)" : "linear-gradient(135deg, #f97316, #c2410c)" }}>
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

                <div className="premium-stat-card closed-cases-card" style={{ height: "100px", padding: "16px", background: "linear-gradient(135deg, #4f46e5, #3730a3)" }}>
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
                        const isAwaiting = item.status === "Awaiting Recommendation" || !item.recommendationText;
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
                                    <span className="badge-category-tag" title={getCategoryLabel(item.category)}>
                                      {getCategoryLabel(item.category)}
                                    </span>
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
                                ? (lang === "si" ? "සෙවීමට ගැළපෙන විමර්ශන නිර්දේශ හමු නොවිණි" : "No cases or recommendations found matching search criteria")
                                : (lang === "si" ? "තවම විමර්ශන නිර්දේශ ඉදිරිපත් කර නොමැත" : "No cases or investigation recommendations registered yet")}
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
                        {lang === "si" ? "විමර්ශන නිර්දේශ විස්තරය" : "Investigation Recommendation Details"}
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

                  {/* Charge Sheet & Disciplinary Order Details (If present) */}
                  {(selectedRecModal.issuedChargeSheet || selectedRecModal.chargeSheetIssuedDate || selectedRecModal.chargeSheetResponseDate || selectedRecModal.disciplinaryOrder) && (
                    <div style={{ backgroundColor: "#f0f4ff", padding: "14px 16px", borderRadius: "10px", border: "1.5px solid #c7d2fe", display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#3730a3", display: "flex", alignItems: "center", gap: "6px" }}>
                        <FileCheck size={16} />
                        <span>{lang === "si" ? "චෝදනා පත්‍රය සහ විනය නියෝග විස්තර" : "Charge Sheet & Disciplinary Order Details"}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        {selectedRecModal.issuedChargeSheet && (
                          <div style={{ gridColumn: "span 2" }}>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                              {lang === "si" ? "නිකුත් කරන ලද චෝදනා පත්‍රය (Issued Charge Sheet)" : "Issued Charge Sheet"}
                            </div>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e1b4b", marginTop: "2px" }}>
                              {selectedRecModal.issuedChargeSheet}
                            </div>
                          </div>
                        )}
                        {selectedRecModal.chargeSheetIssuedDate && (
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                              {lang === "si" ? "නිකුත් කළ දිනය" : "Date Issued"}
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

                <footer style={{ padding: "14px 24px", borderTop: "1px solid #e2e8f0", backgroundColor: "#f8fafc", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setSelectedRecModal(null)}
                    style={{ padding: "8px 18px", borderRadius: "8px", backgroundColor: "#ffffff", border: "1px solid #cbd5e1", color: "#475569", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
                  >
                    Close
                  </button>
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
