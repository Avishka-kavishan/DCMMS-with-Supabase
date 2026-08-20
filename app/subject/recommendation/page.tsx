"use client";

import "@/i18n";
import "../../globals.css";
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
  X
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
  status: string;
  submittedAt?: string;
  updatedAt?: string;
  accusedName?: string;
  accusedDesignation?: string;
  schoolName?: string;
  officerName?: string;
}

function RecommendationFormContent() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const caseNoParam = searchParams?.get("caseNo") || searchParams?.get("refNo") || searchParams?.get("id") || "";
  const lang = i18n.language;

  // Mobile sidebar visibility state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // View Mode: 'form' (Formulate Recommendation) vs 'list' (All Recommendations & Completed Cases)
  const [viewMode, setViewMode] = useState<"form" | "list">(caseNoParam ? "form" : "form");

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
    const recsList: RecommendationRecord[] = [];

    // 1. Supabase Fetch
    if (isSupabaseConfigured) {
      try {
        const { data: recData } = await supabase
          .from("dcmms_recommendations")
          .select("*")
          .order("updated_at", { ascending: false });

        if (recData) {
          recData.forEach((r: any) => {
            recsList.push({
              id: r.id,
              caseNo: r.case_no,
              letterNo: r.letter_no,
              category: r.category || "issuing_charge_sheet",
              urgency: r.urgency || "normal",
              title: r.title || "Preliminary Investigation Recommendation",
              recommendationText: r.recommendation_text || "",
              disciplinaryAction: r.disciplinary_action,
              forwardTo: r.forward_to || "disciplinary_branch",
              targetDate: r.target_date,
              referenceNotes: r.reference_notes,
              status: r.status || "Submitted",
              submittedAt: r.submitted_at,
              updatedAt: r.updated_at
            });
          });
        }

        const { data: asgnData } = await supabase
          .from("dcmms_subject_assignments")
          .select("*");

        if (asgnData) {
          asgnData.forEach((a: any) => {
            const cNo = a.case_no || a.caseNo;
            if (!cNo) return;
            casesMap.set(cNo.trim().toLowerCase(), {
              caseNo: cNo,
              initialCompletedDate: a.initial_investigation_completed_at || a.initialInvestigationCompletedAt,
              hasRecommendation: a.recommendation_submitted || false,
              recStatus: a.status
            });
          });
        }

        const { data: subjData } = await supabase
          .from("dcmms_subject")
          .select("*");

        if (subjData) {
          subjData.forEach((s: any) => {
            const cNo = s.case_no;
            if (!cNo) return;
            const key = cNo.trim().toLowerCase();
            const existing: CaseOption = casesMap.get(key) || { caseNo: cNo };
            casesMap.set(key, {
              ...existing,
              caseNo: cNo,
              subject: s.subject || existing.subject,
              accusedName: s.subject_name || existing.accusedName,
              accusedDesignation: s.designation || existing.accusedDesignation,
              schoolName: s.workplace || existing.schoolName
            });
          });
        }

        const { data: accData } = await supabase
          .from("dcmms_accused_officers")
          .select("*");

        if (accData) {
          accData.forEach((a: any) => {
            const cNo = a.ref_number || a.case_no;
            if (!cNo) return;
            const key = cNo.trim().toLowerCase();
            const existing: CaseOption = casesMap.get(key) || { caseNo: cNo };
            casesMap.set(key, {
              ...existing,
              caseNo: cNo,
              accusedName: a.accused_officer_name || a.officer_name || a.full_name || existing.accusedName,
              accusedDesignation: a.position || existing.accusedDesignation,
              schoolName: a.accused_school_name || a.school_name || existing.schoolName
            });
          });
        }
      } catch (err) {
        console.error("Supabase load cases error:", err);
      }
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
                  status: lr.status || "Submitted",
                  submittedAt: lr.submittedAt || lr.submitted_at,
                  updatedAt: lr.updatedAt || lr.updated_at
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
              const existing: CaseOption = casesMap.get(key) || { caseNo: cNo };
              casesMap.set(key, {
                ...existing,
                caseNo: cNo,
                letterNo: c.letterNo || c.letter_no || existing.letterNo,
                subject: c.subject || existing.subject,
                accusedName: c.accusedName || c.accusedOfficer || c.officerName || existing.accusedName,
                accusedDesignation: c.designation || existing.accusedDesignation,
                schoolName: c.schoolName || c.instituteName || existing.schoolName,
                initialCompletedDate: c.initialCompletedDate || c.initialInvestigationCompletedAt || existing.initialCompletedDate
              });
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
              const existing: CaseOption = casesMap.get(key) || { caseNo: cNo };
              casesMap.set(key, {
                ...existing,
                caseNo: cNo,
                initialCompletedDate: a.initialInvestigationCompletedAt || a.initial_investigation_completed_at || existing.initialCompletedDate,
                hasRecommendation: a.recommendationSubmitted || a.recommendation_submitted || existing.hasRecommendation
              });
            });
          }
        }
      } catch (e) {}
    }

    // Default fallback sample cases if list is empty
    if (casesMap.size === 0) {
      casesMap.set("dmms/t/02", {
        caseNo: "DMMS/T/02",
        subject: "Disciplinary inquiry regarding unauthorized absence & fund management",
        accusedName: "K. L. Gamage",
        accusedDesignation: "Principal",
        schoolName: "Royal College, Colombo",
        initialCompletedDate: new Date().toISOString().slice(0, 10)
      });
      casesMap.set("inq/2026/001", {
        caseNo: "INQ/2026/001",
        subject: "Preliminary investigation on examination paper irregularities",
        accusedName: "M. R. Perera",
        accusedDesignation: "Teacher",
        schoolName: "Ananda College, Colombo",
        initialCompletedDate: new Date().toISOString().slice(0, 10)
      });
    }

    const casesArr = Array.from(casesMap.values());
    setAvailableCases(casesArr);
    setAllRecommendations(recsList);

    // If no caseNo currently set, select the first available case
    if (!caseNoParam && casesArr.length > 0) {
      setCaseNo(casesArr[0].caseNo);
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

    try {
      if (isSupabaseConfigured) {
        // Daily mail
        try {
          const { data: mailData } = await supabase
            .from("dcmms_daily_mail")
            .select("*")
            .or(`ref_no.ilike.${targetCaseNo},letter_no.ilike.${targetCaseNo}`)
            .maybeSingle();

          if (mailData) {
            if (mailData.letter_no) setLetterNo(mailData.letter_no);
            if (mailData.sender_name && mailData.sender_name.toLowerCase() !== "anonymous") setComplainantName(mailData.sender_name);
            if (mailData.institute_name) setSchoolName(mailData.institute_name);
            if (mailData.subject) setCaseSubject(mailData.subject);
          }
        } catch (e) {}

        // Accused officers
        try {
          const { data: accList } = await supabase
            .from("dcmms_accused_officers")
            .select("*")
            .or(`ref_number.ilike.${targetCaseNo},case_no.ilike.${targetCaseNo}`);

          if (accList && accList.length > 0) {
            const acc = accList[0];
            if (acc.accused_officer_name || acc.officer_name || acc.full_name) setAccusedName(acc.accused_officer_name || acc.officer_name || acc.full_name);
            if (acc.position) setAccusedDesignation(acc.position);
            if (acc.accused_school_name || acc.school_name) setSchoolName(acc.accused_school_name || acc.school_name);
            if (acc.name_of_the_presenting_the_complain && acc.name_of_the_presenting_the_complain.toLowerCase() !== "anonymous") {
              setComplainantName(acc.name_of_the_presenting_the_complain);
            }
          }
        } catch (e) {}

        // Subject Table
        try {
          const { data: subjData } = await supabase
            .from("dcmms_subject")
            .select("*")
            .or(`case_no.ilike.${targetCaseNo},subject_id.ilike.${targetCaseNo}`)
            .maybeSingle();

          if (subjData) {
            if (subjData.subject_name) setAccusedName((prev) => prev || subjData.subject_name);
            if (subjData.designation) setAccusedDesignation((prev) => prev || subjData.designation);
            if (subjData.workplace) setSchoolName((prev) => prev || subjData.workplace);
            if (subjData.subject) setCaseSubject((prev) => prev || subjData.subject);
          }
        } catch (e) {}

        // Assignments
        try {
          const { data: asgnData } = await supabase
            .from("dcmms_subject_assignments")
            .select("*")
            .or(`case_no.ilike.${targetCaseNo},id.ilike.${targetCaseNo}`)
            .maybeSingle();

          if (asgnData) {
            if (asgnData.initial_investigation_completed_at || asgnData.initialInvestigationCompletedAt) {
              setInitialCompletedDate(asgnData.initial_investigation_completed_at || asgnData.initialInvestigationCompletedAt);
            }
          }
        } catch (e) {}

        // Recommendations Table
        try {
          const { data: recData } = await supabase
            .from("dcmms_recommendations")
            .select("*")
            .or(`case_no.ilike.${targetCaseNo},letter_no.ilike.${targetCaseNo}`)
            .maybeSingle();

          if (recData) {
            if (recData.category) setRecommendationCategory(recData.category);
            if (recData.urgency) setRecommendationUrgency(recData.urgency);
            if (recData.title) setRecommendationTitle(recData.title);
            if (recData.recommendation_text) setRecommendationText(recData.recommendation_text);
            if (recData.disciplinary_action) setDisciplinaryAction(recData.disciplinary_action);
            if (recData.forward_to) setForwardTo(recData.forward_to);
            if (recData.target_date) setTargetDate(recData.target_date);
            if (recData.reference_notes) setReferenceNotes(recData.reference_notes);
            if (recData.status) setRecommendationStatus(recData.status);
          }
        } catch (e) {}
      }

      // LocalStorage Fallback
      if (typeof window !== "undefined") {
        const localCases = JSON.parse(localStorage.getItem("dcmms_cases") || "[]");
        const foundCase = Array.isArray(localCases)
          ? localCases.find((c: any) => String(c.caseNo || c.refNo || c.id || "").trim().toLowerCase() === qLower)
          : null;

        if (foundCase) {
          if (foundCase.subject) setCaseSubject((prev) => prev || foundCase.subject);
          if (foundCase.complainantName || foundCase.senderName) setComplainantName((prev) => prev || foundCase.complainantName || foundCase.senderName);
          if (foundCase.accusedName || foundCase.accusedOfficer || foundCase.officerName) setAccusedName((prev) => prev || foundCase.accusedName || foundCase.accusedOfficer || foundCase.officerName);
          if (foundCase.schoolName || foundCase.instituteName) setSchoolName((prev) => prev || foundCase.schoolName || foundCase.instituteName);
          if (foundCase.initialCompletedDate) setInitialCompletedDate((prev) => prev || foundCase.initialCompletedDate);
        }

        const localRecs = JSON.parse(localStorage.getItem("dcmms_recommendations") || "[]");
        const foundRec = Array.isArray(localRecs)
          ? localRecs.find((r: any) => String(r.caseNo || r.case_no || "").trim().toLowerCase() === qLower)
          : null;

        if (foundRec) {
          if (foundRec.category) setRecommendationCategory(foundRec.category);
          if (foundRec.urgency) setRecommendationUrgency(foundRec.urgency);
          if (foundRec.title) setRecommendationTitle(foundRec.title);
          if (foundRec.recommendationText) setRecommendationText(foundRec.recommendationText);
          if (foundRec.disciplinaryAction) setDisciplinaryAction(foundRec.disciplinaryAction);
          if (foundRec.forwardTo) setForwardTo(foundRec.forwardTo);
          if (foundRec.targetDate) setTargetDate(foundRec.targetDate);
          if (foundRec.referenceNotes) setReferenceNotes(foundRec.referenceNotes);
          if (foundRec.status) setRecommendationStatus(foundRec.status);
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
    const payload = {
      case_no: caseNo,
      letter_no: letterNo || null,
      category: recommendationCategory,
      urgency: recommendationUrgency,
      title: recommendationTitle || "Preliminary Investigation Recommendation",
      recommendation_text: recommendationText,
      disciplinary_action: disciplinaryAction,
      forward_to: forwardTo,
      target_date: targetDate || null,
      reference_notes: referenceNotes,
      status: "Draft",
      updated_at: new Date().toISOString()
    };

    try {
      if (isSupabaseConfigured) {
        await supabase.from("dcmms_recommendations").upsert(payload, { onConflict: "case_no" }).catch(() => {});
        const profile = await getCurrentProfile();
        await logAuditEvent(profile?.full_name || profile?.id || "Subject Officer", "SAVE_RECOMMENDATION_DRAFT", `Saved recommendation draft for ${caseNo}`);
      }

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
    const payload = {
      case_no: caseNo,
      letter_no: letterNo || null,
      category: recommendationCategory,
      urgency: recommendationUrgency,
      title: recommendationTitle || "Formal Preliminary Recommendation",
      recommendation_text: recommendationText,
      disciplinary_action: disciplinaryAction,
      forward_to: forwardTo,
      target_date: targetDate || null,
      reference_notes: referenceNotes,
      status: "Submitted",
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      if (isSupabaseConfigured) {
        await supabase.from("dcmms_recommendations").upsert(payload, { onConflict: "case_no" }).catch(() => {});

        await supabase.from("dcmms_preliminary_investigations").update({
          recommendations: recommendationText,
          status: "Implementation of Recommendations",
          updated_at: new Date().toISOString()
        }).eq("case_no", caseNo).catch(() => {});

        await supabase.from("dcmms_subject_assignments").update({
          status: "Implementation of Recommendations",
          recommendation_submitted: true,
          recommendation_submitted_at: now
        }).eq("case_no", caseNo).catch(() => {});

        const profile = await getCurrentProfile();
        await logAuditEvent(profile?.full_name || profile?.id || "Subject Officer", "SUBMIT_RECOMMENDATION", `Submitted formal recommendation for case ${caseNo}`);
      }

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
    if (recStatusFilter !== "all" && item.status !== recStatusFilter) return false;

    if (recSearchQuery.trim()) {
      const q = recSearchQuery.toLowerCase();
      const matchNo = (item.caseNo || "").toLowerCase().includes(q);
      const matchTitle = (item.title || "").toLowerCase().includes(q);
      const matchText = (item.recommendationText || "").toLowerCase().includes(q);
      const matchAcc = (item.accusedName || item.officerName || "").toLowerCase().includes(q);
      return matchNo || matchTitle || matchText || matchAcc;
    }
    return true;
  });

  const pendingCases = availableCases.filter((c) => !c.hasRecommendation);

  return (
    <div className="dashboard-layout" style={{ minHeight: "100vh", display: "flex", backgroundColor: "#f8fafc" }}>
      {/* Universal Responsive Sidebar */}
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
        role="subject"
      />

      <div className="main-content-wrapper" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top Header */}
        <header className="top-header" style={{ padding: "14px 28px", backgroundColor: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              className="btn-menu-toggle mobile-only"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open navigation menu"
              style={{ background: "none", border: "none", cursor: "pointer", color: "#1e293b" }}
            >
              <Menu size={22} />
            </button>
            <div className="breadcrumb-box" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 600, color: "#475569" }}>
              <Link href="/subject" style={{ color: "#4f46e5", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
                <ArrowLeft size={16} />
                <span>{lang === "si" ? "විෂය නිලධාරී පුවරුව" : "Subject Dashboard"}</span>
              </Link>
              <ChevronRight size={14} style={{ color: "#94a3b8" }} />
              <span style={{ color: "#0f172a", fontWeight: 700 }}>
                {lang === "si" ? "විමර්ශන නිර්දේශ" : lang === "ta" ? "விசாரணை பரிந்துரை" : "Investigation Recommendation"}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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

          {/* Navigation View Mode Tabs */}
          <div className="navigation-tab-list" style={{ marginBottom: "22px" }}>
            <button
              type="button"
              className={`nav-tab-btn${viewMode === "form" ? " active" : ""}`}
              onClick={() => setViewMode("form")}
            >
              <Sparkles className="tab-icon" />
              <span>{lang === "si" ? "නිර්දේශය සටහන් කිරීමේ පෝරමය" : "Formulate / Edit Recommendation"}</span>
              {caseNo && (
                <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: "10px", marginLeft: "4px" }}>
                  {caseNo}
                </span>
              )}
            </button>

            <button
              type="button"
              className={`nav-tab-btn${viewMode === "list" ? " active" : ""}`}
              onClick={() => setViewMode("list")}
            >
              <Layers className="tab-icon" />
              <span>{lang === "si" ? "සියලු නිර්දේශ සහ නිමවූ විමර්ශන ලැයිස්තුව" : "All Recommendations & Pending Cases"}</span>
              {allRecommendations.length > 0 && (
                <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: viewMode === "list" ? "#4f46e5" : "#94a3b8", color: "#ffffff", padding: "2px 8px", borderRadius: "10px", marginLeft: "4px" }}>
                  {allRecommendations.length}
                </span>
              )}
            </button>
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

                  <div className="form-grid-3">
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
                      placeholder={lang === "si" ? "උදා: චෝදනා පත්‍රයක් ගොනු කර විධිමත් පරීක්ෂණයක් සඳහා විනය අංශයට යොමු කිරීම" : "e.g., Recommend issuance of formal charge sheet and appoint inquiry officer"}
                      className="form-field-input"
                      required
                    />
                  </div>
                </section>

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

                {/* Card 3: Forwarding & Routing */}
                <section className="recommendation-form-card">
                  <div className="section-header-pill">
                    <Send size={16} />
                    <span>{lang === "si" ? "3. නිර්දේශය යොමු කිරීම සහ ක්‍රියාත්මක කිරීමේ අධිකාරිය" : "3. Routing & Implementation Authority"}</span>
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
                        <option value="disciplinary_branch">{lang === "si" ? "අධ්‍යාපන අමාත්‍යාංශ විනය අංශය (Disciplinary Branch)" : "Ministry Disciplinary Branch"}</option>
                        <option value="secretary_education">{lang === "si" ? "අධ්‍යාපන අමාත්‍යාංශ ලේකම් (Secretary, Ministry of Education)" : "Secretary, Ministry of Education"}</option>
                        <option value="provincial_director">{lang === "si" ? "පළාත් අධ්‍යාපන අධ්‍යක්ෂ (Provincial Director of Education)" : "Provincial Director of Education"}</option>
                        <option value="zonal_director">{lang === "si" ? "කලාප අධ්‍යාපන අධ්‍යක්ෂ (Zonal Director of Education)" : "Zonal Director of Education"}</option>
                        <option value="public_service_commission">{lang === "si" ? "රාජ්‍ය සේවා කොමිෂන් සභාව (Public Service Commission - PSC)" : "Public Service Commission (PSC)"}</option>
                        <option value="investigation_unit">{lang === "si" ? "විමර්ශන අධ්‍යක්ෂක / විමර්ශන ඒකකය (Investigation Branch)" : "Investigation Director / Unit"}</option>
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
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #f1f5f9" }}>
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

              {/* Dedicated Section: Completed Investigation Cases Assigned for Recommendation */}
              {availableCases.length > 0 && (
                <div style={{ marginBottom: "24px", backgroundColor: "#ffffff", borderRadius: "16px", border: "1px solid #e2e8f0", padding: "20px 24px", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#1e1b4b", display: "flex", alignItems: "center", gap: "8px" }}>
                        <CheckCircle size={18} style={{ color: "#16a34a" }} />
                        <span>{lang === "si" ? "විමර්ශනය අවසන් නඩු සඳහා නිර්දේශ ඉදිරිපත් කිරීම" : "Investigation Cases Ready for Recommendation"}</span>
                        <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: "12px" }}>
                          {availableCases.length} {lang === "si" ? "නඩු" : "Cases"}
                        </span>
                      </h4>
                      <p style={{ margin: "3px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                        {lang === "si"
                          ? "මූලික විමර්ශන අවසන් කර ඇති නඩුවක් තෝරා නිර්දේශ පෝරමයට පිවිසෙන්න."
                          : "Select any case to open the recommendation form and submit formal disciplinary action."}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "14px" }}>
                    {availableCases.map((c) => {
                      const rec = allRecommendations.find((r) => (r.caseNo || "").trim().toLowerCase() === (c.caseNo || "").trim().toLowerCase());
                      const isSubmitted = rec && (rec.status === "Submitted" || rec.status === "Approved");
                      const isDraft = rec && rec.status === "Draft";

                      return (
                        <div
                          key={`case-card-${c.caseNo}`}
                          style={{
                            backgroundColor: isSubmitted ? "#f8fafc" : "#ffffff",
                            borderRadius: "14px",
                            border: isSubmitted ? "1px solid #cbd5e1" : "1px solid #818cf8",
                            padding: "16px",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            gap: "12px",
                            boxShadow: isSubmitted ? "none" : "0 4px 6px -1px rgba(79, 70, 229, 0.08)"
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                              <div>
                                <span style={{ fontWeight: 800, color: "#1e1b4b", fontSize: "15px" }}>{c.caseNo}</span>
                                {c.accusedName && (
                                  <div style={{ fontSize: "12px", color: "#475569", fontWeight: 600, marginTop: "2px" }}>
                                    {c.accusedName} {c.schoolName ? `• ${c.schoolName}` : ""}
                                  </div>
                                )}
                              </div>

                              {isSubmitted ? (
                                <span style={{ fontSize: "11px", fontWeight: 700, color: "#15803d", backgroundColor: "#dcfce7", padding: "3px 10px", borderRadius: "12px", border: "1px solid #bbf7d0" }}>
                                  ✓ {lang === "si" ? "යොමු කළා" : "Submitted"}
                                </span>
                              ) : isDraft ? (
                                <span style={{ fontSize: "11px", fontWeight: 700, color: "#854d0e", backgroundColor: "#fef9c3", padding: "3px 10px", borderRadius: "12px", border: "1px solid #fef08a" }}>
                                  📝 {lang === "si" ? "කෙටුම්පත" : "Draft Saved"}
                                </span>
                              ) : (
                                <span style={{ fontSize: "11px", fontWeight: 700, color: "#b91c1c", backgroundColor: "#fee2e2", padding: "3px 10px", borderRadius: "12px", border: "1px solid #fecaca" }}>
                                  ⚡ {lang === "si" ? "නිර්දේශය අපේක්ෂිතයි" : "Action Required"}
                                </span>
                              )}
                            </div>

                            <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#334155", lineHeight: 1.4, fontWeight: 500 }}>
                              {c.subject || "Formal Preliminary Investigation Completed"}
                            </p>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "10px", borderTop: "1px solid #f1f5f9" }}>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>
                              {c.initialCompletedDate || "Recently updated"}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setCaseNo(c.caseNo);
                                fetchCaseDetails(c.caseNo);
                                setViewMode("form");
                              }}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                fontSize: "12px",
                                fontWeight: 700,
                                color: isSubmitted ? "#4f46e5" : "#ffffff",
                                backgroundColor: isSubmitted ? "#e0e7ff" : "#4f46e5",
                                padding: "6px 14px",
                                borderRadius: "8px",
                                border: "none",
                                cursor: "pointer",
                                transition: "all 0.15s ease"
                              }}
                            >
                              {isSubmitted ? (
                                <>
                                  <span>{lang === "si" ? "නිර්දේශය බලන්න" : "View Recommendation"}</span>
                                  <ArrowRight size={12} />
                                </>
                              ) : isDraft ? (
                                <>
                                  <span>{lang === "si" ? "කෙටුම්පත සංස්කරණය" : "Edit Draft"}</span>
                                  <ArrowRight size={12} />
                                </>
                              ) : (
                                <>
                                  <Plus size={13} />
                                  <span>{lang === "si" ? "+ නිර්දේශය එක් කරන්න" : "+ Add Recommendation"}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Filter and Search Bar */}
              <div className="letters-list-header" style={{ marginBottom: "16px", backgroundColor: "#ffffff", padding: "12px 18px", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "#1e1b4b", fontSize: "14px" }}>
                  <Filter size={16} style={{ color: "#4f46e5" }} />
                  <span>{lang === "si" ? "නිර්දේශ පෙරහන" : "Filter Recommendations"}</span>
                </div>

                <div className="letters-filters-group" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", margin: 0 }}>
                  <div className="search-box" style={{ width: "220px" }}>
                    <Search className="search-icon" size={15} />
                    <input
                      type="text"
                      value={recSearchQuery}
                      onChange={(e) => setRecSearchQuery(e.target.value)}
                      placeholder={lang === "si" ? "නිර්දේශ සොයන්න..." : "Search recommendations..."}
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
                      <option value="Submitted">Submitted</option>
                      <option value="Draft">Draft</option>
                      <option value="Approved">Approved</option>
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
                      <th scope="col">{lang === "si" ? "නිර්දේශ වර්ගය සහ මාතෘකාව" : "Category & Recommendation"}</th>
                      <th scope="col">{lang === "si" ? "ප්‍රමුඛතාව" : "Urgency"}</th>
                      <th scope="col">{lang === "si" ? "තත්ත්වය" : "Status"}</th>
                      <th scope="col">{lang === "si" ? "යොමු කළ අංශය" : "Forwarded To"}</th>
                      <th scope="col">{lang === "si" ? "දිනය" : "Target / Date"}</th>
                      <th scope="col" className="text-center">{lang === "si" ? "ක්‍රියාමාර්ග" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecommendations.length > 0 ? (
                      filteredRecommendations.map((item, idx) => (
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
                              <span className="badge-category-tag" title={getCategoryLabel(item.category)}>
                                {getCategoryLabel(item.category)}
                              </span>
                              <span style={{ fontSize: "12px", fontWeight: 600, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.title || item.recommendationText}>
                                {item.title || item.recommendationText || "Formal Recommendation"}
                              </span>
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
                            {item.status === "Draft" ? (
                              <span className="badge-status-draft-rec">
                                📝 {lang === "si" ? "කෙටුම්පත" : "Draft"}
                              </span>
                            ) : item.status === "Approved" ? (
                              <span className="badge-status-submitted-rec" style={{ backgroundColor: "#dcfce7", color: "#166534", borderColor: "#bbf7d0" }}>
                                <CheckCircle size={12} /> {lang === "si" ? "අනුමතයි" : "Approved"}
                              </span>
                            ) : (
                              <span className="badge-status-submitted-rec">
                                <Send size={12} /> {lang === "si" ? "යොමු කරන ලදී" : "Submitted"}
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
                              <span>{item.submittedAt ? item.submittedAt.slice(0, 10) : item.updatedAt ? item.updatedAt.slice(0, 10) : "—"}</span>
                            </div>
                          </td>
                          <td className="text-center actions-cell">
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
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
                                {item.status === "Draft" ? (lang === "si" ? "කෙටුම්පත සංස්කරණය" : "Edit Draft") : (lang === "si" ? "බලන්න / සංස්කරණය" : "View / Edit")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedRecModal(item)}
                                className="btn-quick-view"
                                title="Quick Preview"
                              >
                                <Eye size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="text-center py-5 text-muted" style={{ padding: "40px 20px" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                            <Sparkles size={44} style={{ color: "#cbd5e1" }} />
                            <span style={{ fontSize: "15px", fontWeight: 600, color: "#64748b" }}>
                              {recSearchQuery || recCategoryFilter !== "all" || recUrgencyFilter !== "all" || recStatusFilter !== "all"
                                ? (lang === "si" ? "සෙවීමට ගැළපෙන විමර්ශන නිර්දේශ හමු නොවිණි" : "No recommendations found matching search criteria")
                                : (lang === "si" ? "තවම විමර්ශන නිර්දේශ ඉදිරිපත් කර නොමැත" : "No investigation recommendations registered yet")}
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
