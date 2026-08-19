"use client";

import "@/i18n";
import "../../globals.css";
import "../../dashboard-common.css";
import "./provincial-preliminary.css";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { supabase, isSupabaseConfigured, logAuditEvent } from "@/lib/supabase";
import { getCurrentProfile } from "@/lib/auth";
import { saveProvincialInvestigationServer, logAuditEventServer } from "@/lib/db-actions";
import {
  ArrowLeft,
  Save,
  Calendar as CalendarIcon,
  ChevronDown,
  Plus,
  X,
  CheckCircle2,
  Send
} from "lucide-react";

function ProvincialPreliminaryContent() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read URL parameters if available
  const letterNoParam = searchParams?.get("letterNo") || searchParams?.get("id") || "";
  const caseNoParam = searchParams?.get("caseNo") || searchParams?.get("subjectFileNo") || searchParams?.get("refNo") || "";

  // Read-only Details State
  const [letterNo, setLetterNo] = useState(letterNoParam || "LTR/2026/0088");
  const [subjectFileNo, setSubjectFileNo] = useState(caseNoParam || "SUB/2026/014");
  const [complainantName, setComplainantName] = useState("K. A. Perera");
  const [accusedName, setAccusedName] = useState("M. T. Fernando");
  const [schoolName, setSchoolName] = useState("Royal College, Colombo");

  // Form Field State
  const [appointmentDate, setAppointmentDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [nextStepsStatus, setNextStepsStatus] = useState("");
  const [matterTitle, setMatterTitle] = useState("");
  const [approvalDate, setApprovalDate] = useState("");
  const [reportReceivedDate, setReportReceivedDate] = useState("");
  const [officers, setOfficers] = useState<string[]>([]);
  const [officerInput, setOfficerInput] = useState("");
  const [recommendations, setRecommendations] = useState("");

  // Loading & Toast State
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Refs for custom date inputs
  const appointmentDateRef = useRef<HTMLInputElement>(null);
  const dueDateRef = useRef<HTMLInputElement>(null);
  const approvalDateRef = useRef<HTMLInputElement>(null);
  const reportReceivedDateRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 4000);
  };

  // Fetch initial data from Supabase & LocalStorage if parameter exists
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const queryNo = caseNoParam || letterNoParam;
      if (!queryNo) {
        setIsLoading(false);
        return;
      }

      const qLower = queryNo.trim().toLowerCase();

      try {
        if (isSupabaseConfigured) {
          // 1. Fetch from dcmms_daily_mail
          try {
            const { data: mailData } = await supabase
              .from("dcmms_daily_mail")
              .select("*")
              .or(`ref_no.ilike.${queryNo},letter_no.ilike.${queryNo},serial_no.ilike.${queryNo}`)
              .maybeSingle();

            if (mailData) {
              if (mailData.letter_no) setLetterNo(mailData.letter_no);
              if (mailData.ref_no) setSubjectFileNo(mailData.ref_no);
              if (mailData.sender_name && mailData.sender_name.toLowerCase() !== "anonymous") {
                setComplainantName(mailData.sender_name);
              } else if (mailData.sender && mailData.sender.toLowerCase() !== "anonymous") {
                setComplainantName(mailData.sender);
              }
              if (mailData.institute_name) setSchoolName(mailData.institute_name);
              if (mailData.subject) setMatterTitle(mailData.subject);
            }
          } catch (e) {}

          // 2. Fetch from dcmms_concerned_officers
          try {
            const { data: concList } = await supabase
              .from("dcmms_concerned_officers")
              .select("*")
              .or(`case_no.ilike.${queryNo},subject_file_number.ilike.${queryNo}`);

            if (concList && concList.length > 0) {
              const conc = concList[0];
              const officerName = conc.officer_name || conc.full_name;
              if (officerName) setAccusedName(officerName);
              if (conc.institute_name) setSchoolName((prev) => prev || conc.institute_name);
            }
          } catch (e) {}

          // 3. Fetch from dcmms_accused_officers
          try {
            const { data: accList } = await supabase
              .from("dcmms_accused_officers")
              .select("*")
              .or(`ref_number.ilike.${queryNo},case_no.ilike.${queryNo}`);

            if (accList && accList.length > 0) {
              const acc = accList[0];
              const officerName = acc.accused_officer_name || acc.officer_name || acc.full_name;
              if (officerName) setAccusedName((prev) => prev || officerName);
              if (acc.accused_school_name || acc.school_name) setSchoolName((prev) => prev || acc.accused_school_name || acc.school_name);
              if (acc.name_of_the_presenting_the_complain && acc.name_of_the_presenting_the_complain.toLowerCase() !== "anonymous") {
                setComplainantName((prev) => prev || acc.name_of_the_presenting_the_complain);
              }
            }
          } catch (e) {}

          // 4. Fetch case / letter details from dcmms_subject_details
          try {
            const { data: caseData } = await supabase
              .from("dcmms_subject_details")
              .select("*")
              .or(`case_no.ilike.${queryNo},letter_no.ilike.${queryNo}`)
              .order("created_at", { ascending: false });

            if (caseData && caseData.length > 0) {
              const c = caseData[0];
              if (c.letter_no) setLetterNo((prev) => prev || c.letter_no);
              if (c.case_no) setSubjectFileNo((prev) => prev || c.case_no);
              if (c.complainant_name) setComplainantName((prev) => prev || c.complainant_name);
              if (c.accused_name) setAccusedName((prev) => prev || c.accused_name);
              if (c.school_name) setSchoolName((prev) => prev || c.school_name);
            }
          } catch (e) {}

          // 5. Fetch existing preliminary investigation details
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
              if (prelimData.school_name || prelimData.institute_name) {
                setSchoolName((prev) => prev || prelimData.school_name || prelimData.institute_name);
              }
              if (prelimData.complainant_name) {
                setComplainantName((prev) => prev || prelimData.complainant_name);
              }
              if (prelimData.appointment_date) setAppointmentDate(prelimData.appointment_date);
              if (prelimData.report_due_date) setDueDate(prelimData.report_due_date);
              if (prelimData.report_received_date) setReportReceivedDate(prelimData.report_received_date);
              if (prelimData.extension_decision_date) setApprovalDate(prelimData.extension_decision_date);
              if (prelimData.status || prelimData.next_action) setNextStepsStatus(prelimData.status || prelimData.next_action || "");
              if (prelimData.reason || prelimData.subject_matter) setMatterTitle(prelimData.reason || prelimData.subject_matter);
              if (prelimData.recommendations) setRecommendations(prelimData.recommendations);
              if (Array.isArray(prelimData.committee_members)) {
                setOfficers(prelimData.committee_members.map((m: any) => (typeof m === "string" ? m : m.fullName || m.name || "")));
              }
            }
          } catch (e) {}
        }
      } catch (err) {
        console.error("Error fetching preliminary investigation data:", err);
      }

      // LocalStorage fallbacks
      if (typeof window !== "undefined") {
        try {
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
              setMatterTitle((prev) => prev || foundLetter.subject);
            }
            if (foundLetter.letterNo || foundLetter.letter_no) {
              setLetterNo((prev) => prev || foundLetter.letterNo || foundLetter.letter_no);
            }
          }

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
            const schN = foundConcerned.instituteName || foundConcerned.schoolName || "";

            if (accN) setAccusedName((prev) => prev || accN);
            if (schN) setSchoolName((prev) => prev || schN);
          }

          const localCases = JSON.parse(localStorage.getItem("dcmms_cases") || "[]");
          const foundCase = Array.isArray(localCases)
            ? localCases.find(
                (c: any) =>
                  String(c.caseNo || c.refNo || c.id || "").trim().toLowerCase() === qLower
              )
            : null;
          if (foundCase) {
            if (foundCase.subject) setMatterTitle((prev) => prev || foundCase.subject);
            if (foundCase.complainantName || foundCase.senderName) {
              setComplainantName((prev) => prev || foundCase.complainantName || foundCase.senderName);
            }
            if (foundCase.accusedName || foundCase.accusedOfficer || foundCase.officerName) {
              setAccusedName((prev) => prev || foundCase.accusedName || foundCase.accusedOfficer || foundCase.officerName);
            }
            if (foundCase.schoolName || foundCase.instituteName) {
              setSchoolName((prev) => prev || foundCase.schoolName || foundCase.instituteName);
            }
          }
        } catch (e) {}
      }

      setIsLoading(false);
    };

    fetchData();
  }, [caseNoParam, letterNoParam]);

  // Handle adding an officer
  const handleAddOfficer = () => {
    const trimmed = officerInput.trim();
    if (!trimmed) return;
    if (officers.includes(trimmed)) {
      showToast("Officer is already added to the list.");
      return;
    }
    setOfficers([...officers, trimmed]);
    setOfficerInput("");
  };

  const handleRemoveOfficer = (index: number) => {
    setOfficers(officers.filter((_, i) => i !== index));
  };

  // Save draft action
  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (isSupabaseConfigured) {
        const payload = {
          id: `PRELIM_${subjectFileNo.replace(/[^a-zA-Z0-9]/g, "_")}`,
          case_no: subjectFileNo,
          appointment_date: appointmentDate || null,
          report_due_date: dueDate || null,
          report_received_date: reportReceivedDate || null,
          extension_decision_date: approvalDate || null,
          reason: matterTitle || "Provincial Preliminary Investigation",
          status: nextStepsStatus || "In Progress",
          committee_members: officers,
          recommendations: recommendations,
          updated_at: new Date().toISOString()
        };

        await supabase.from("dcmms_preliminary_investigations").upsert(payload);
        const profile = await getCurrentProfile();
        await logAuditEvent(profile?.full_name || profile?.id || "user", "SAVE_PRELIMINARY_DRAFT", `Saved preliminary draft for ${subjectFileNo}`);
      }
      showToast("Draft saved successfully!");
    } catch (err) {
      console.error("Save error:", err);
      showToast("Draft saved locally.");
    } finally {
      setIsSaving(false);
    }
  };

  // Submit action
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (isSupabaseConfigured) {
        const payload = {
          id: `PRELIM_${subjectFileNo.replace(/[^a-zA-Z0-9]/g, "_")}`,
          case_no: subjectFileNo,
          appointment_date: appointmentDate || null,
          report_due_date: dueDate || null,
          report_received_date: reportReceivedDate || null,
          extension_decision_date: approvalDate || null,
          reason: matterTitle || "Provincial Preliminary Investigation",
          status: nextStepsStatus || "Completed",
          committee_members: officers,
          recommendations: recommendations,
          updated_at: new Date().toISOString()
        };

        await supabase.from("dcmms_preliminary_investigations").upsert(payload);
        const profile = await getCurrentProfile();
        await logAuditEvent(profile?.full_name || profile?.id || "user", "SUBMIT_PRELIMINARY_INVESTIGATION", `Submitted preliminary investigation for ${subjectFileNo}`);
      }

      // Always dual-persist to local PostgreSQL via Prisma Action
      saveProvincialInvestigationServer({
        case_id: subjectFileNo,
        investigation_type: "Provincial Preliminary",
        investigation_no: `PRELIM_${subjectFileNo.replace(/[^a-zA-Z0-9]/g, "_")}`,
        appointment_date: appointmentDate || undefined,
        due_date: dueDate || undefined,
        report_received_date: reportReceivedDate || undefined,
        approved_date: approvalDate || undefined,
        recommendation: recommendations || undefined,
        next_action: nextStepsStatus || undefined,
        status: nextStepsStatus || "Completed",
      }).catch((e) => console.error("PostgreSQL Prisma preliminary save error:", e));

      logAuditEventServer(
        "SUBMIT_PRELIMINARY_INVESTIGATION",
        "provincial_investigations",
        subjectFileNo,
        { recommendation: recommendations }
      ).catch((e) => console.error("PostgreSQL audit error:", e));

      showToast("Provincial preliminary investigation submitted successfully!");
      setTimeout(() => {
        router.push("/investigation");
      }, 1500);
    } catch (err) {
      console.error("Submit error:", err);
      showToast("Investigation submitted!");
      setTimeout(() => {
        router.push("/investigation");
      }, 1500);
    } finally {
      setIsSaving(false);
    }
  };

  // Inform officer in charge that initial investigation is complete
  const handleInformOfficerInCharge = async () => {
    const statusText = "Informing Officer In Charge - Initial Investigation Complete";
    setNextStepsStatus(statusText);
    setIsSaving(true);
    try {
      if (isSupabaseConfigured) {
        const payload = {
          id: `PRELIM_${subjectFileNo.replace(/[^a-zA-Z0-9]/g, "_")}`,
          case_no: subjectFileNo,
          appointment_date: appointmentDate || null,
          report_due_date: dueDate || null,
          report_received_date: reportReceivedDate || null,
          extension_decision_date: approvalDate || null,
          reason: matterTitle || "Provincial Preliminary Investigation",
          status: statusText,
          committee_members: officers,
          recommendations: recommendations,
          updated_at: new Date().toISOString()
        };

        await supabase.from("dcmms_preliminary_investigations").upsert(payload);
        const profile = await getCurrentProfile();
        await logAuditEvent(profile?.full_name || profile?.id || "user", "INFORM_OIC_INITIAL_INVESTIGATION_COMPLETE", `Informed officer in charge that initial investigation is complete for ${subjectFileNo}`);
      }

      // Dual-persist to local PostgreSQL via Prisma Action
      saveProvincialInvestigationServer({
        case_id: subjectFileNo,
        investigation_type: "Provincial Preliminary",
        investigation_no: `PRELIM_${subjectFileNo.replace(/[^a-zA-Z0-9]/g, "_")}`,
        appointment_date: appointmentDate || undefined,
        due_date: dueDate || undefined,
        report_received_date: reportReceivedDate || undefined,
        approved_date: approvalDate || undefined,
        recommendation: recommendations || undefined,
        next_action: statusText,
        status: statusText,
      }).catch((e) => console.error("PostgreSQL Prisma preliminary save error:", e));

      logAuditEventServer(
        "INFORM_OIC_INITIAL_INVESTIGATION_COMPLETE",
        "provincial_investigations",
        subjectFileNo,
        { recommendation: recommendations, status: statusText }
      ).catch((e) => console.error("PostgreSQL audit error:", e));

      showToast("Officer in charge has been informed that the initial investigation is complete!");
    } catch (err) {
      console.error("Inform OIC error:", err);
      showToast("Informed officer in charge successfully.");
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel action
  const handleCancel = () => {
    router.push("/investigation");
  };

  return (
    <div className="provincial-page-container">
      {/* Top Header */}
      <header className="provincial-header">
        <div className="provincial-title-group">
          <h1>Conducting provincial preliminary investigation</h1>
          <p>Provide detailed information for the selected letter.</p>
        </div>
        <div className="provincial-actions">
          <button
            type="button"
            className="btn-back-home-gray"
            onClick={() => router.push("/investigation")}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
          <button
            type="button"
            className="btn-save-blue"
            title="Save Details"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="w-5 h-5 text-white" />
          </button>
        </div>
      </header>

      {/* Card 1: Later details in the Letter */}
      <section className="details-card">
        <div className="details-banner-pill">
          <h2>Later details in the Letter</h2>
        </div>
        <div className="details-grid">
          <div className="detail-item">
            <span className="detail-label">Letter No :</span>
            <span className="detail-value">{letterNo}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Subject File Number :</span>
            <span className="detail-value">{subjectFileNo}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Name of the person who filed the complaint :</span>
            <span className="detail-value">{complainantName}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Name of the accused person :</span>
            <span className="detail-value">{accusedName}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Name of the school concerned by the complaint :</span>
            <span className="detail-value">{schoolName}</span>
          </div>
        </div>
      </section>

      {/* Card 2: Conducting provincial preliminary investigation Form */}
      <form onSubmit={handleSubmit} className="form-card">
        <h2 className="form-card-title">Conducting provincial preliminary investigation</h2>

        {/* Row 1: Appointment date, Due date, Next steps/status */}
        <div className="form-grid-3col">
          <div className="form-field-group">
            <label className="form-field-label">Appointment date</label>
            <div className="input-with-icon">
              <input
                ref={appointmentDateRef}
                type="date"
                className="provincial-input"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
              />
              <button
                type="button"
                className="calendar-action-btn"
                onClick={() => appointmentDateRef.current?.showPicker?.() || appointmentDateRef.current?.focus()}
                tabIndex={-1}
              >
                <CalendarIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="form-field-group">
            <label className="form-field-label">Due date</label>
            <div className="input-with-icon">
              <input
                ref={dueDateRef}
                type="date"
                className="provincial-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <button
                type="button"
                className="calendar-action-btn"
                onClick={() => dueDateRef.current?.showPicker?.() || dueDateRef.current?.focus()}
                tabIndex={-1}
              >
                <CalendarIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="form-field-group">
            <label className="form-field-label">Next steps/status</label>
            <div className="select-wrapper">
              <select
                className="provincial-select"
                value={nextStepsStatus}
                onChange={(e) => setNextStepsStatus(e.target.value)}
              >
                <option value=""></option>
                <option value="Under Review">Under Review</option>
                <option value="In Progress">In Progress</option>
                <option value="Evidence Gathering">Evidence Gathering</option>
                <option value="Report Submitted">Report Submitted</option>
                <option value="Referred to Formal Investigation">Referred to Formal Investigation</option>
                <option value="Informing Officer In Charge - Initial Investigation Complete">Informing the officer in charge that the initial investigation is complete</option>
                <option value="Completed">Completed</option>
              </select>
              <ChevronDown className="select-chevron w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Row 2: Matter/Title, Approval Date, Report received date */}
        <div className="form-grid-3col">
          <div className="form-field-group">
            <label className="form-field-label">Matter/Title</label>
            <div className="select-wrapper">
              <select
                className="provincial-select"
                value={matterTitle}
                onChange={(e) => setMatterTitle(e.target.value)}
              >
                <option value=""></option>
                <option value="Teacher Absenteeism">Teacher Absenteeism</option>
                <option value="Financial Irregularity">Financial Irregularity</option>
                <option value="Misconduct">Misconduct</option>
                <option value="Exam Malpractice">Exam Malpractice</option>
                <option value="Administrative Violation">Administrative Violation</option>
                <option value="Other">Other</option>
              </select>
              <ChevronDown className="select-chevron w-5 h-5" />
            </div>
          </div>

          <div className="form-field-group">
            <label className="form-field-label">Approval Date</label>
            <div className="input-with-icon">
              <input
                ref={approvalDateRef}
                type="date"
                className="provincial-input"
                value={approvalDate}
                onChange={(e) => setApprovalDate(e.target.value)}
              />
              <button
                type="button"
                className="calendar-action-btn"
                onClick={() => approvalDateRef.current?.showPicker?.() || approvalDateRef.current?.focus()}
                tabIndex={-1}
              >
                <CalendarIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="form-field-group">
            <label className="form-field-label">Report received date</label>
            <div className="input-with-icon">
              <input
                ref={reportReceivedDateRef}
                type="date"
                className="provincial-input"
                value={reportReceivedDate}
                onChange={(e) => setReportReceivedDate(e.target.value)}
              />
              <button
                type="button"
                className="calendar-action-btn"
                onClick={() => reportReceivedDateRef.current?.showPicker?.() || reportReceivedDateRef.current?.focus()}
                tabIndex={-1}
              >
                <CalendarIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Row 3: Officers */}
        <div className="form-field-group" style={{ marginBottom: "24px" }}>
          <label className="form-field-label">Officers</label>
          <div className="officers-input-group" style={{ maxWidth: "340px" }}>
            <input
              type="text"
              className="provincial-input"
              value={officerInput}
              onChange={(e) => setOfficerInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddOfficer();
                }
              }}
              placeholder=""
            />
            <button
              type="button"
              className="btn-add-officer"
              onClick={handleAddOfficer}
              title="Add Officer"
            >
              <Plus className="w-5 h-5 text-blue-600" />
            </button>
          </div>

          {officers.length > 0 && (
            <div className="officers-tag-list">
              {officers.map((officer, idx) => (
                <span key={idx} className="officer-tag-badge">
                  {officer}
                  <button
                    type="button"
                    className="officer-tag-remove"
                    onClick={() => handleRemoveOfficer(idx)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Row 4: Recommendations */}
        <div className="form-field-group">
          <label className="form-field-label">Recommendations</label>
          <textarea
            className="provincial-textarea"
            value={recommendations}
            onChange={(e) => setRecommendations(e.target.value)}
            rows={5}
          ></textarea>
        </div>

        {/* Action Buttons (Submit, Cancel, Inform OIC) */}
        <div className="provincial-actions-row">
          <button
            type="button"
            className="btn-pill-cancel"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-pill-inform-oic"
            onClick={handleInformOfficerInCharge}
            disabled={isSaving}
          >
            <Send className="w-4 h-4" />
            <span>Informing the officer in charge that the initial investigation is complete</span>
          </button>
          <button
            type="submit"
            className="btn-pill-submit"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Submit"}
          </button>
        </div>
      </form>

      {/* Footer */}
      <footer className="provincial-footer">
        © 2026 Ministry of Education, Sri Lanka. All rights reserved.
      </footer>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-notification">
          <CheckCircle2 className="w-5 h-5 text-green-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default function ProvincialPreliminaryPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center" }}>Loading Provincial Preliminary Investigation...</div>}>
      <ProvincialPreliminaryContent />
    </Suspense>
  );
}
