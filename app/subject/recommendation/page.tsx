"use client";

import "@/i18n";
import "../../globals.css";
import "../../dashboard-common.css";
import "./recommendation.css";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { supabase, isSupabaseConfigured, logAuditEvent } from "@/lib/supabase";
import { getCurrentProfile } from "@/lib/auth";
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
  ClipboardList
} from "lucide-react";

function RecommendationFormContent() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const caseNoParam = searchParams?.get("caseNo") || searchParams?.get("refNo") || searchParams?.get("id") || "";
  const lang = i18n.language;

  // Case Reference Details State (Read-only)
  const [caseNo, setCaseNo] = useState(caseNoParam || "DMMS/T/02");
  const [letterNo, setLetterNo] = useState("");
  const [complainantName, setComplainantName] = useState("");
  const [accusedName, setAccusedName] = useState("");
  const [accusedDesignation, setAccusedDesignation] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [caseSubject, setCaseSubject] = useState("");
  const [initialCompletedDate, setInitialCompletedDate] = useState("");

  // Recommendation Form State
  const [recommendationCategory, setRecommendationCategory] = useState("formal_inquiry");
  const [recommendationUrgency, setRecommendationUrgency] = useState("normal");
  const [recommendationTitle, setRecommendationTitle] = useState("");
  const [recommendationText, setRecommendationText] = useState("");
  const [disciplinaryAction, setDisciplinaryAction] = useState("");
  const [forwardTo, setForwardTo] = useState("disciplinary_branch");
  const [targetDate, setTargetDate] = useState("");
  const [referenceNotes, setReferenceNotes] = useState("");
  const [recommendationStatus, setRecommendationStatus] = useState("Submitted");

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

  // Sync document title
  useEffect(() => {
    document.title = `${lang === "si" ? "විමර්ශන නිර්දේශ පෝරමය" : lang === "ta" ? "விசாரணை பரிந்துரை படிவம்" : "Investigation Recommendation Form"} | DCMMS`;
  }, [lang]);

  // Load Case and Preliminary Investigation Data
  useEffect(() => {
    const fetchCaseAndRecommendation = async () => {
      setIsLoading(true);
      const queryNo = caseNoParam || caseNo;

      if (!queryNo) {
        setIsLoading(false);
        return;
      }

      try {
        // 1. Try fetching from Supabase if configured
        if (isSupabaseConfigured) {
          // Subject details
          const { data: detailsData } = await supabase
            .from("dcmms_subject_details")
            .select("*")
            .or(`case_no.eq.${queryNo},letter_no.eq.${queryNo}`)
            .maybeSingle();

          if (detailsData) {
            if (detailsData.case_no) setCaseNo(detailsData.case_no);
            if (detailsData.letter_no) setLetterNo(detailsData.letter_no);
            if (detailsData.complainant_name) setComplainantName(detailsData.complainant_name);
            if (detailsData.accused_name) setAccusedName(detailsData.accused_name);
            if (detailsData.accused_designation) setAccusedDesignation(detailsData.accused_designation);
            if (detailsData.school_name) setSchoolName(detailsData.school_name);
            if (detailsData.matter_title || detailsData.subject) setCaseSubject(detailsData.matter_title || detailsData.subject);
          }

          // Assignment / Notification info
          const { data: asgnData } = await supabase
            .from("dcmms_subject_assignments")
            .select("*")
            .eq("case_no", queryNo)
            .maybeSingle();

          if (asgnData) {
            if (asgnData.initial_investigation_completed_at || asgnData.initialInvestigationCompletedAt) {
              setInitialCompletedDate(asgnData.initial_investigation_completed_at || asgnData.initialInvestigationCompletedAt);
            }
          }

          // Preliminary investigations table (might already contain recommendations)
          const { data: prelimData } = await supabase
            .from("dcmms_preliminary_investigations")
            .select("*")
            .or(`case_no.eq.${queryNo},id.eq.${queryNo}`)
            .maybeSingle();

          if (prelimData) {
            if (prelimData.recommendations) {
              setRecommendationText(prelimData.recommendations);
            }
            if (prelimData.report_received_date) {
              setInitialCompletedDate((prev) => prev || prelimData.report_received_date);
            }
          }

          // Recommendations table
          const { data: recData } = await supabase
            .from("dcmms_recommendations")
            .select("*")
            .eq("case_no", queryNo)
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
        }
      } catch (err) {
        console.error("Error fetching case data from Supabase:", err);
      }

      // 2. Fallback / supplementary check from LocalStorage
      if (typeof window !== "undefined") {
        try {
          const localCases = JSON.parse(localStorage.getItem("dcmms_cases") || "[]");
          const foundCase = localCases.find((c: any) => String(c.caseNo || c.refNo || "").trim().toLowerCase() === queryNo.trim().toLowerCase());
          if (foundCase) {
            setCaseSubject((prev) => prev || foundCase.subject || "");
          }

          const localDetails = JSON.parse(localStorage.getItem("dcmms_subject_details") || "[]");
          const foundDetail = Array.isArray(localDetails) ? localDetails.find((d: any) => String(d.caseNo || d.case_no || "").trim().toLowerCase() === queryNo.trim().toLowerCase()) : null;
          if (foundDetail) {
            setComplainantName((prev) => prev || foundDetail.complainantName || foundDetail.complainant_name || "");
            setAccusedName((prev) => prev || foundDetail.accusedName || foundDetail.accused_name || "");
            setAccusedDesignation((prev) => prev || foundDetail.accusedDesignation || foundDetail.accused_designation || "");
            setSchoolName((prev) => prev || foundDetail.schoolName || foundDetail.school_name || "");
            setLetterNo((prev) => prev || foundDetail.letterNo || foundDetail.letter_no || "");
          }

          const localAsgns = JSON.parse(localStorage.getItem("dcmms_subject_assignments") || "[]");
          const foundAsgn = Array.isArray(localAsgns) ? localAsgns.find((a: any) => String(a.caseNo || a.case_no || "").trim().toLowerCase() === queryNo.trim().toLowerCase()) : null;
          if (foundAsgn && (foundAsgn.initialInvestigationCompletedAt || foundAsgn.initial_investigation_completed_at)) {
            setInitialCompletedDate((prev) => prev || foundAsgn.initialInvestigationCompletedAt || foundAsgn.initial_investigation_completed_at);
          }

          const localRecs = JSON.parse(localStorage.getItem("dcmms_recommendations") || "[]");
          const foundRec = Array.isArray(localRecs) ? localRecs.find((r: any) => String(r.caseNo || r.case_no || "").trim().toLowerCase() === queryNo.trim().toLowerCase()) : null;
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
        } catch (e) {
          console.error("Local storage fallback reading error", e);
        }
      }

      setIsLoading(false);
    };

    fetchCaseAndRecommendation();
  }, [caseNoParam]);

  // Quick Preset Handlers
  const handleApplyPreset = (text: string) => {
    setRecommendationText((prev) => (prev ? `${prev}\n• ${text}` : `• ${text}`));
  };

  // Save Draft Handler
  const handleSaveDraft = async () => {
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

      // LocalStorage persistence
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
        // 1. Save recommendation record
        await supabase.from("dcmms_recommendations").upsert(payload, { onConflict: "case_no" }).catch(() => {});

        // 2. Also update preliminary investigations recommendation field
        await supabase.from("dcmms_preliminary_investigations").update({
          recommendations: recommendationText,
          status: "Implementation of Recommendations",
          updated_at: new Date().toISOString()
        }).eq("case_no", caseNo).catch(() => {});

        // 3. Update subject assignment status
        await supabase.from("dcmms_subject_assignments").update({
          status: "Implementation of Recommendations",
          recommendation_submitted: true,
          recommendation_submitted_at: now
        }).eq("case_no", caseNo).catch(() => {});

        const profile = await getCurrentProfile();
        await logAuditEvent(profile?.full_name || profile?.id || "Subject Officer", "SUBMIT_RECOMMENDATION", `Submitted formal recommendation for case ${caseNo}`);
      }

      // LocalStorage persistence
      if (typeof window !== "undefined") {
        // Recommendations list
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

        // Update assignments list
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

        // Update cases status
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

      setTimeout(() => {
        router.push("/subject");
      }, 1200);
    } catch (err) {
      console.error("Submit recommendation error:", err);
      showToast("Recommendation saved locally.");
      setTimeout(() => {
        router.push("/subject");
      }, 1200);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="recommendation-page-container">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="recommendation-toast">
          <CheckCircle2 size={20} style={{ color: "#34d399" }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="recommendation-header">
        <div className="recommendation-title-group">
          <h1>
            <ClipboardList size={28} style={{ color: "#059669" }} />
            {lang === "si"
              ? "මූලික විමර්ශන නිර්දේශ පෝරමය"
              : lang === "ta"
              ? "ஆரம்ப விசாரணை பரிந்துரை படிவம்"
              : "Investigation Recommendation Form"}
          </h1>
          <p>
            {lang === "si"
              ? "මූලික විමර්ශනය අවසන් වූ නඩුව සඳහා නිල නිර්දේශ සහ ඉදිරි විනය ක්‍රියාමාර්ග ඇතුළත් කරන්න."
              : lang === "ta"
              ? "ஆரம்ப விசாரணை முடிவடைந்த வழக்கிற்கான உத்தியோகபூர்வ பரிந்துரைகள் மற்றும் அடுத்த ஒழுங்கு நடவடிக்கைகளை பதிவு செய்யவும்."
              : "Record and submit formal recommendations, findings, and disciplinary actions following preliminary investigation completion."}
          </p>
        </div>

        <div className="recommendation-actions">
          <Link href="/subject" className="btn-back-gray">
            <ArrowLeft size={16} />
            <span>{lang === "si" ? "ආපසු මුල් පිටුවට" : lang === "ta" ? "பின்செல்ல" : "Back to Cases"}</span>
          </Link>

          <button type="button" onClick={handleSaveDraft} disabled={isSaving} className="btn-save-draft">
            <Save size={16} />
            <span>{lang === "si" ? "කෙටුම්පත සුරකින්න" : lang === "ta" ? "வரைவு சேமி" : "Save Draft"}</span>
          </button>

          <button type="button" onClick={handleSubmit} disabled={isSaving} className="btn-submit-recommendation">
            <Send size={16} />
            <span>{lang === "si" ? "නිර්දේශය ඉදිරිපත් කරන්න" : lang === "ta" ? "பரிந்துரையை சமர்ப்பிக்கவும்" : "Submit Recommendation"}</span>
          </button>
        </div>
      </header>

      {/* Top Case Summary Card */}
      <section className="case-summary-card">
        <div className="case-summary-top">
          <div className="case-badge-group">
            <span className="badge-case-no">
              {lang === "si" ? "නඩු අංකය:" : "Case Ref:"} {caseNo}
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
                {lang === "si" ? "නිර්දේශ වර්ගය / කාණ්ඩය" : "Recommendation Category"}
                <span className="required-asterisk">*</span>
              </label>
              <select
                value={recommendationCategory}
                onChange={(e) => setRecommendationCategory(e.target.value)}
                className="form-field-select"
                required
              >
                <option value="formal_inquiry">{lang === "si" ? "විධිමත් විනය පරීක්ෂණයක් පැවැත්වීම (Formal Disciplinary Inquiry)" : "Formal Disciplinary Inquiry"}</option>
                <option value="issue_warning">{lang === "si" ? "දැඩි අවවාද නිකුත් කිරීම (Issue Severe Warning)" : "Issue Severe Warning"}</option>
                <option value="financial_recovery">{lang === "si" ? "අලාභ අයකර ගැනීම / අධිභාරය (Surcharge / Recovery)" : "Surcharge / Recovery of Financial Loss"}</option>
                <option value="interdiction">{lang === "si" ? "වැඩ තහනම් කිරීම (Interdiction / Suspension)" : "Interdiction / Suspension"}</option>
                <option value="transfer">{lang === "si" ? "ස්ථාන මාරු කිරීම (Administrative / Disciplinary Transfer)" : "Administrative / Disciplinary Transfer"}</option>
                <option value="exoneration">{lang === "si" ? "චෝදනාවලින් නිදොස් කොට ගොනුව අවසන් කිරීම (Exonerate & File Closed)" : "Exonerate & Close File"}</option>
                <option value="refer_ciaboc_police">{lang === "si" ? "අල්ලස් / පොලිස් විමර්ශන වෙත යොමු කිරීම (Refer to CIABOC / Police)" : "Refer to CIABOC / Police"}</option>
                <option value="other">{lang === "si" ? "වෙනත් විශේෂ නිර්දේශ (Other Special Action)" : "Other Special Action"}</option>
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
                      ? "මූලික විමර්ශන වාර්තාව අනුව චෝදනා තහවුරු වන බැවින් විධිමත් විනය පරීක්ෂණයක් පැවැත්වීමට නිර්දේශ කරමි."
                      : "Evidence indicates prima facie misconduct; recommend instituting a formal disciplinary inquiry."
                  )
                }
              >
                + {lang === "si" ? "විධිමත් විනය පරීක්ෂණය" : "Formal Inquiry"}
              </button>
              <button
                type="button"
                className="preset-chip"
                onClick={() =>
                  handleApplyPreset(
                    lang === "si"
                      ? "අදාළ අලාභය රජයට අයකර ගැනීමටත්, චෝදනා ලැබූ නිලධාරියාට දැඩි අවවාද නිකුත් කිරීමටත් නිර්දේශ කරමි."
                      : "Recommend recovery of financial deficit from the accused officer and issuing a severe warning letter."
                  )
                }
              >
                + {lang === "si" ? "අලාභ අයකර ගැනීම සහ අවවාද කිරීම" : "Surcharge & Warning"}
              </button>
              <button
                type="button"
                className="preset-chip"
                onClick={() =>
                  handleApplyPreset(
                    lang === "si"
                      ? "පරීක්ෂණ වාර්තාව අනුව චෝදනා තහවුරු නොවන බැවින් මෙම නඩුව තවදුරටත් ඉදිරියට නොගෙන ගොනුව අවසන් කිරීමට නිර්දේශ කරමි."
                      : "Allegations are unsubstantiated per investigation findings; recommend closing the case file with exoneration."
                  )
                }
              >
                + {lang === "si" ? "නිදොස් කොට ගොනුව අවසන් කිරීම" : "Exonerate & Close"}
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
            <Link href="/subject" className="btn-back-gray">
              {lang === "si" ? "අවලංගු කරන්න" : "Cancel"}
            </Link>

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
    </div>
  );
}

export default function RecommendationPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Loading Recommendation Form...</div>}>
      <RecommendationFormContent />
    </Suspense>
  );
}
