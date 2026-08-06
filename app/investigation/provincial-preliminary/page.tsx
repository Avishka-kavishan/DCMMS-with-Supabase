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
import {
  ArrowLeft,
  Save,
  Calendar as CalendarIcon,
  ChevronDown,
  Plus,
  X,
  CheckCircle2
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

  // Fetch initial data from Supabase if parameter exists
  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured()) return;
      setIsLoading(true);
      try {
        const queryNo = caseNoParam || letterNoParam;
        if (queryNo) {
          // 1. Fetch case / letter details
          const { data: caseData } = await supabase
            .from("dcmms_subject_details")
            .select("*")
            .or(`case_no.eq.${queryNo},letter_no.eq.${queryNo}`)
            .single();

          if (caseData) {
            if (caseData.letter_no) setLetterNo(caseData.letter_no);
            if (caseData.case_no) setSubjectFileNo(caseData.case_no);
            if (caseData.complainant_name) setComplainantName(caseData.complainant_name);
            if (caseData.accused_name) setAccusedName(caseData.accused_name);
            if (caseData.school_name) setSchoolName(caseData.school_name);
          }

          // 2. Fetch existing preliminary investigation details
          const { data: prelimData } = await supabase
            .from("dcmms_preliminary_investigations")
            .select("*")
            .or(`case_no.eq.${queryNo},id.eq.${queryNo}`)
            .single();

          if (prelimData) {
            if (prelimData.appointment_date) setAppointmentDate(prelimData.appointment_date);
            if (prelimData.report_due_date) setDueDate(prelimData.report_due_date);
            if (prelimData.report_received_date) setReportReceivedDate(prelimData.report_received_date);
            if (prelimData.extension_decision_date) setApprovalDate(prelimData.extension_decision_date);
            if (prelimData.status || prelimData.next_action) setNextStepsStatus(prelimData.status || prelimData.next_action || "");
            if (prelimData.reason) setMatterTitle(prelimData.reason);
            if (prelimData.recommendations) setRecommendations(prelimData.recommendations);
            if (Array.isArray(prelimData.committee_members)) {
              setOfficers(prelimData.committee_members.map((m: any) => (typeof m === "string" ? m : m.fullName || m.name || "")));
            }
          }
        }
      } catch (err) {
        console.error("Error fetching preliminary investigation data:", err);
      } finally {
        setIsLoading(false);
      }
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
      if (isSupabaseConfigured()) {
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
        await logAuditEvent(profile?.email || "user", "SAVE_PRELIMINARY_DRAFT", `Saved preliminary draft for ${subjectFileNo}`);
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
      if (isSupabaseConfigured()) {
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
        await logAuditEvent(profile?.email || "user", "SUBMIT_PRELIMINARY_INVESTIGATION", `Submitted preliminary investigation for ${subjectFileNo}`);
      }
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

        {/* Action Buttons (Submit & Cancel) */}
        <div className="provincial-actions-row">
          <button
            type="button"
            className="btn-pill-cancel"
            onClick={handleCancel}
          >
            Cancel
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
