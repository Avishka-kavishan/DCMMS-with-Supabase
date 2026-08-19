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
  const [recommendationCategory, setRecommendationCategory] = useState("issuing_charge_sheet");
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

      const qLower = queryNo.trim().toLowerCase();

      try {
        // 1. Try fetching from Supabase if configured
        if (isSupabaseConfigured) {
          // A. Daily Mail / Letters Table (for complainant, school, subject)
          try {
            const { data: mailData } = await supabase
              .from("dcmms_daily_mail")
              .select("*")
              .or(`ref_no.ilike.${queryNo},letter_no.ilike.${queryNo},serial_no.ilike.${queryNo}`)
              .maybeSingle();

            if (mailData) {
              if (mailData.letter_no) setLetterNo((prev) => prev || mailData.letter_no);
              if (mailData.sender_name && mailData.sender_name.toLowerCase() !== "anonymous") {
                setComplainantName((prev) => prev || mailData.sender_name);
              } else if (mailData.sender && mailData.sender.toLowerCase() !== "anonymous") {
                setComplainantName((prev) => prev || mailData.sender);
              }
              if (mailData.institute_name) setSchoolName((prev) => prev || mailData.institute_name);
              if (mailData.subject) setCaseSubject((prev) => prev || mailData.subject);
            }
          } catch (e) {}

          // B. Concerned Officers Table (for accused officer name, designation, school)
          try {
            const { data: concList } = await supabase
              .from("dcmms_concerned_officers")
              .select("*")
              .or(`case_no.ilike.${queryNo},subject_file_number.ilike.${queryNo}`);

            if (concList && concList.length > 0) {
              const conc = concList[0];
              const officerName = conc.officer_name || conc.full_name;
              if (officerName) setAccusedName((prev) => prev || officerName);
              if (conc.position) setAccusedDesignation((prev) => prev || conc.position);
              if (conc.institute_name) setSchoolName((prev) => prev || conc.institute_name);
            }
          } catch (e) {}

          // C. Accused Officers Table (for officer name, position, school, complainant)
          try {
            const { data: accList } = await supabase
              .from("dcmms_accused_officers")
              .select("*")
              .or(`ref_number.ilike.${queryNo},case_no.ilike.${queryNo}`);

            if (accList && accList.length > 0) {
              const acc = accList[0];
              const officerName = acc.accused_officer_name || acc.officer_name || acc.full_name;
              if (officerName) setAccusedName((prev) => prev || officerName);
              if (acc.position) setAccusedDesignation((prev) => prev || acc.position);
              if (acc.accused_school_name || acc.school_name) setSchoolName((prev) => prev || acc.accused_school_name || acc.school_name);
              if (acc.name_of_the_presenting_the_complain && acc.name_of_the_presenting_the_complain.toLowerCase() !== "anonymous") {
                setComplainantName((prev) => prev || acc.name_of_the_presenting_the_complain);
              }
            }
          } catch (e) {}

          // D. Subject Table
          try {
            const { data: subjData } = await supabase
              .from("dcmms_subject")
              .select("*")
              .or(`case_no.ilike.${queryNo},subject_id.ilike.${queryNo}`)
              .maybeSingle();

            if (subjData) {
              if (subjData.subject_name) setAccusedName((prev) => prev || subjData.subject_name);
              if (subjData.designation) setAccusedDesignation((prev) => prev || subjData.designation);
              if (subjData.workplace) setSchoolName((prev) => prev || subjData.workplace);
            }
          } catch (e) {}

          // E. Subject Details Table
          try {
            const { data: detailsData } = await supabase
              .from("dcmms_subject_details")
              .select("*")
              .or(`case_no.ilike.${queryNo},letter_no.ilike.${queryNo}`)
              .order("created_at", { ascending: false });

            if (detailsData && detailsData.length > 0) {
              const d = detailsData[0];
              if (d.case_no) setCaseNo(d.case_no);
              if (d.letter_no) setLetterNo((prev) => prev || d.letter_no);
              if (d.complainant_name) setComplainantName((prev) => prev || d.complainant_name);
              if (d.accused_name) setAccusedName((prev) => prev || d.accused_name);
              if (d.accused_designation) setAccusedDesignation((prev) => prev || d.accused_designation);
              if (d.school_name) setSchoolName((prev) => prev || d.school_name);
              if (d.matter_title || d.subject) setCaseSubject((prev) => prev || d.matter_title || d.subject);
            }
          } catch (e) {}

          // F. Subject Assignments Table (for Initial Completed Date)
          try {
            const { data: asgnData } = await supabase
              .from("dcmms_subject_assignments")
              .select("*")
              .or(`case_no.ilike.${queryNo},id.ilike.${queryNo}`)
              .maybeSingle();

            if (asgnData) {
              if (asgnData.initial_investigation_completed_at || asgnData.initialInvestigationCompletedAt) {
                setInitialCompletedDate((prev) => prev || asgnData.initial_investigation_completed_at || asgnData.initialInvestigationCompletedAt);
              }
            }
          } catch (e) {}

          // G. Preliminary Investigations Table
          try {
            const { data: prelimData } = await supabase
              .from("dcmms_preliminary_investigations")
              .select("*")
              .or(`case_no.ilike.${queryNo},id.ilike.${queryNo}`)
              .maybeSingle();

            if (prelimData) {
              if (prelimData.accused_name || prelimData.officer_name) {
                setAccusedName((prev) => prev || prelimData.accused_name || prelimData.officer_name);
              }
              if (prelimData.designation || prelimData.position) {
                setAccusedDesignation((prev) => prev || prelimData.designation || prelimData.position);
              }
              if (prelimData.school_name || prelimData.institute_name) {
                setSchoolName((prev) => prev || prelimData.school_name || prelimData.institute_name);
              }
              if (prelimData.complainant_name) {
                setComplainantName((prev) => prev || prelimData.complainant_name);
              }
              if (prelimData.reason || prelimData.subject_matter) {
                setCaseSubject((prev) => prev || prelimData.reason || prelimData.subject_matter);
              }
              if (prelimData.recommendations) {
                setRecommendationText((prev) => prev || prelimData.recommendations);
              }
              if (prelimData.report_received_date) {
                setInitialCompletedDate((prev) => prev || prelimData.report_received_date);
              }
            }
          } catch (e) {}

          // H. Recommendations Table
          try {
            const { data: recData } = await supabase
              .from("dcmms_recommendations")
              .select("*")
              .or(`case_no.ilike.${queryNo},letter_no.ilike.${queryNo}`)
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
      } catch (err) {
        console.error("Error fetching case data from Supabase:", err);
      }

      // 2. Fallback & supplementary check from LocalStorage
      if (typeof window !== "undefined") {
        try {
          // A. Letters (dcmms_letters)
          const localLetters = JSON.parse(localStorage.getItem("dcmms_letters") || "[]");
          const foundLetter = Array.isArray(localLetters)
            ? localLetters.find(
                (l: any) =>
                  String(l.refNo || l.ref_no || l.letterNo || l.letter_no || "").trim().toLowerCase() === qLower
              )
            : null;
          if (foundLetter) {
            if (foundLetter.senderName && foundLetter.senderName.toLowerCase() !== "anonymous") {
              setComplainantName((prev) => prev || foundLetter.senderName);
            }
            if (foundLetter.instituteName || foundLetter.schoolName) {
              setSchoolName((prev) => prev || foundLetter.instituteName || foundLetter.schoolName);
            }
            if (foundLetter.subject) {
              setCaseSubject((prev) => prev || foundLetter.subject);
            }
            if (foundLetter.letterNo || foundLetter.letter_no) {
              setLetterNo((prev) => prev || foundLetter.letterNo || foundLetter.letter_no);
            }
          }

          // B. Concerned Officers (dcmms_officer_concerned)
          const localConcerned = JSON.parse(localStorage.getItem("dcmms_officer_concerned") || "{}");
          let foundConcerned = localConcerned[queryNo];
          if (!foundConcerned && typeof localConcerned === "object") {
            const matchKey = Object.keys(localConcerned).find((k) => k.trim().toLowerCase() === qLower);
            if (matchKey) foundConcerned = localConcerned[matchKey];
          }
          if (foundConcerned) {
            const firstPerson =
              Array.isArray(foundConcerned.persons) && foundConcerned.persons.length > 0
                ? foundConcerned.persons[0]
                : null;
            const accN =
              firstPerson?.name ||
              firstPerson?.officer_name ||
              foundConcerned.officerName ||
              foundConcerned.officer_name ||
              "";
            const accDes = firstPerson?.position || foundConcerned.position || "";
            const schN = foundConcerned.instituteName || foundConcerned.schoolName || "";

            if (accN) setAccusedName((prev) => prev || accN);
            if (accDes) setAccusedDesignation((prev) => prev || accDes);
            if (schN) setSchoolName((prev) => prev || schN);
          }

          // C. Cases (dcmms_cases)
          const localCases = JSON.parse(localStorage.getItem("dcmms_cases") || "[]");
          const foundCase = Array.isArray(localCases)
            ? localCases.find(
                (c: any) =>
                  String(c.caseNo || c.refNo || c.id || "").trim().toLowerCase() === qLower
              )
            : null;
          if (foundCase) {
            if (foundCase.subject) setCaseSubject((prev) => prev || foundCase.subject);
            if (foundCase.complainantName || foundCase.senderName) {
              setComplainantName((prev) => prev || foundCase.complainantName || foundCase.senderName);
            }
            if (foundCase.accusedName || foundCase.accusedOfficer || foundCase.officerName) {
              setAccusedName((prev) => prev || foundCase.accusedName || foundCase.accusedOfficer || foundCase.officerName);
            }
            if (foundCase.schoolName || foundCase.instituteName) {
              setSchoolName((prev) => prev || foundCase.schoolName || foundCase.instituteName);
            }
            if (foundCase.initialCompletedDate || foundCase.initialInvestigationCompletedAt) {
              setInitialCompletedDate(
                (prev) => prev || foundCase.initialCompletedDate || foundCase.initialInvestigationCompletedAt
              );
            }
          }

          // D. Subject Details (dcmms_subject_details)
          const localDetails = JSON.parse(localStorage.getItem("dcmms_subject_details") || "[]");
          const foundDetail = Array.isArray(localDetails)
            ? localDetails.find(
                (d: any) =>
                  String(d.caseNo || d.case_no || "").trim().toLowerCase() === qLower
              )
            : null;
          if (foundDetail) {
            if (foundDetail.complainantName || foundDetail.complainant_name) {
              setComplainantName((prev) => prev || foundDetail.complainantName || foundDetail.complainant_name);
            }
            if (foundDetail.accusedName || foundDetail.accused_name) {
              setAccusedName((prev) => prev || foundDetail.accusedName || foundDetail.accused_name);
            }
            if (foundDetail.accusedDesignation || foundDetail.accused_designation) {
              setAccusedDesignation((prev) => prev || foundDetail.accusedDesignation || foundDetail.accused_designation);
            }
            if (foundDetail.schoolName || foundDetail.school_name) {
              setSchoolName((prev) => prev || foundDetail.schoolName || foundDetail.school_name);
            }
            if (foundDetail.letterNo || foundDetail.letter_no) {
              setLetterNo((prev) => prev || foundDetail.letterNo || foundDetail.letter_no);
            }
            if (foundDetail.matterTitle || foundDetail.matter_title || foundDetail.subject) {
              setCaseSubject((prev) => prev || foundDetail.matterTitle || foundDetail.matter_title || foundDetail.subject);
            }
          }

          // E. Subject Assignments (dcmms_subject_assignments)
          const localAsgns = JSON.parse(localStorage.getItem("dcmms_subject_assignments") || "[]");
          const foundAsgn = Array.isArray(localAsgns)
            ? localAsgns.find(
                (a: any) =>
                  String(a.caseNo || a.case_no || a.id || "").trim().toLowerCase() === qLower
              )
            : null;
          if (foundAsgn && (foundAsgn.initialInvestigationCompletedAt || foundAsgn.initial_investigation_completed_at)) {
            setInitialCompletedDate(
              (prev) => prev || foundAsgn.initialInvestigationCompletedAt || foundAsgn.initial_investigation_completed_at
            );
          }

          // F. Recommendations (dcmms_recommendations)
          const localRecs = JSON.parse(localStorage.getItem("dcmms_recommendations") || "[]");
          const foundRec = Array.isArray(localRecs)
            ? localRecs.find(
                (r: any) =>
                  String(r.caseNo || r.case_no || "").trim().toLowerCase() === qLower
              )
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
                {lang === "si"
                  ? "නිර්දේශ වර්ගය / කාණ්ඩය (Type / Category of Recommendation)"
                  : lang === "ta"
                  ? "பரிந்துரை வகை / பிரிவு (Type / Category of Recommendation)"
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
                  {lang === "si"
                    ? "චෝදනා පත්‍රයක් නිකුත් කිරීම (Issuing a charge sheet)"
                    : lang === "ta"
                    ? "குற்றப்பத்திரிகை வழங்குதல் (Issuing a charge sheet)"
                    : "Issuing a charge sheet"}
                </option>
                <option value="action_based_on_court_verdict">
                  {lang === "si"
                    ? "අවසන් අධිකරණ තීන්දුව මත පදනම්ව ඉදිරි ක්‍රියාමාර්ග ගැනීම (Taking further action based on the final court verdict)"
                    : lang === "ta"
                    ? "இறுதி நீதிமன்ற தீர்ப்பின் அடிப்படையில் மேலதிக நடவடிக்கை எடுத்தல் (Taking further action based on the final court verdict)"
                    : "Taking further action based on the final court verdict"}
                </option>
                <option value="giving_warnings_advice">
                  {lang === "si"
                    ? "අවවාද / උපදෙස් ලබා දීම (Giving warnings/advice)"
                    : lang === "ta"
                    ? "எச்சரிக்கைகள் / ஆலோசனைகள் வழங்குதல் (Giving warnings/advice)"
                    : "Giving warnings/advice"}
                </option>
                <option value="transfers">
                  {lang === "si"
                    ? "ස්ථාන මාරු කිරීම් (Transfers)"
                    : lang === "ta"
                    ? "இடமாற்றங்கள் (Transfers)"
                    : "Transfers"}
                </option>
                <option value="charging_based_on_more_104">
                  {lang === "si"
                    ? "MoRE 104 පරීක්ෂණය මත පදනම්ව චෝදනා ගොනු කිරීම (Charging based on MoRE 104 investigation)"
                    : lang === "ta"
                    ? "MoRE 104 விசாரணையின் அடிப்படையில் குற்றஞ்சாட்டுதல் (Charging based on MoRE 104 investigation)"
                    : "Charging based on MoRE 104 investigation"}
                </option>
                <option value="terminating_service">
                  {lang === "si"
                    ? "සේවය අවසන් කිරීම (Terminating service)"
                    : lang === "ta"
                    ? "சேவையை நிறுத்துதல் (Terminating service)"
                    : "Terminating service"}
                </option>
                <option value="sending_recommendation_other_departments">
                  {lang === "si"
                    ? "නිර්දේශය වෙනත් දෙපාර්තමේන්තු වෙත යොමු කිරීම / ක්‍රියාත්මක කිරීමේ උපදෙස් ලැබුණු පසු පියවර ගැනීම (Sending recommendation to other departments / taking action after getting instructions)"
                    : lang === "ta"
                    ? "பரிந்துரையை பிற திணைக்களங்களுக்கு அனுப்புதல் / அறிவுறுத்தல்கள் பெற்ற பின்னர் நடவடிக்கை எடுத்தல் (Sending recommendation to other departments / taking action after instructions)"
                    : "Sending the recommendation to other departments / taking action after getting instructions to implement it"}
                </option>
                <option value="closing_action_non_disclosure">
                  {lang === "si"
                    ? "කරුණු අනාවරණය නොවීම හේතුවෙන් ක්‍රියාමාර්ගය අවසන් කිරීම (Closing the action due to non-disclosure of facts)"
                    : lang === "ta"
                    ? "உண்மைகள் வெளிப்படுத்தப்படாததால் நடவடிக்கையை முடிவுக்குக் கொண்டுவருதல் (Closing the action due to non-disclosure of facts)"
                    : "Closing the action due to non-disclosure of facts"}
                </option>
                <option value="other">
                  {lang === "si"
                    ? "වෙනත් විශේෂ නිර්දේශ (Other)"
                    : lang === "ta"
                    ? "பிற சிறப்பு பரிந்துரைகள் (Other)"
                    : "Other"}
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
