"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import "../../../i18n";
import "../admin.css";
import "../../dashboard-common.css";
import { ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import {
  forwardLetterFromAdditionalSecretaryServer,
  getRegisterOfficersServer,
  getLetterAndCaseDetailsByAnyRefServer,
} from "@/lib/db-actions";

const DEFAULT_BRANCH_OPTIONS = [
  {
    value: "",
    label: "Select a branch...",
    labelSi: "ශාඛාවක් තෝරන්න...",
    labelTa: "ஒரு கிளையை தேர்ந்தெடுக்கவும்...",
    officerName: "",
  },
  {
    value: "assistant_secretary_discipline",
    label: "Assistant Secretary Discipline Branch",
    labelSi: "සහකාර ලේකම් - විනය ශාඛාව (Assistant Secretary Discipline Branch)",
    labelTa: "உதவிச் செயலாளர் - ஒழுக்க கிளை (Assistant Secretary Discipline Branch)",
    officerName: "Bandula Gunawardena",
  },
  {
    value: "assistant_secretary_investigation",
    label: "Assistant Secretary Investigation Branch",
    labelSi: "සහකාර ලේකම් - විමර්ශන ශාඛාව (Assistant Secretary Investigation Branch)",
    labelTa: "உதவிச் செயலாளர் - விசாரணை கிளை (Assistant Secretary Investigation Branch)",
    officerName: "Ranjith Siyambalapitiya",
  },
];

const PRIORITY_OPTIONS = [
  {
    value: "high",
    label: "High Priority (Today)",
    labelSi: "🔴 අදම (High Priority)",
    labelTa: "🔴 இன்றே (High Priority)",
    descSi: "කඩිනමින් ක්‍රියා කළ යුතු ලිපි (දින 1-3 තුළ)",
    descTa: "உடனடி நடவடிக்கை தேவைப்படும் கடிதங்கள் (1-3 நாட்கள்)",
    descEn: "Urgent letters requiring immediate review (Within 1-3 days)",
    color: "#dc2626",
    bg: "#fee2e2",
    border: "#fca5a5",
    dot: "#ef4444",
  },
  {
    value: "medium",
    label: "Medium Priority (Within 3 Days)",
    labelSi: "🟠 දින 3ක් තුළ (Medium Priority)",
    labelTa: "🟠 3 நாட்களுக்குள் (Medium Priority)",
    descSi: "සාමාන්‍ය විමර්ශන ලිපි (දින 3-7 තුළ)",
    descTa: "வழக்கமான விசாரணை கடிதங்கள் (3-7 நாட்கள்)",
    descEn: "Standard inquiry and assignment letters (Within 3-7 days)",
    color: "#d97706",
    bg: "#fef3c7",
    border: "#fcd34d",
    dot: "#f59e0b",
  },
  {
    value: "low",
    label: "Low Priority (Within 14/21 Days)",
    labelSi: "🟢 දින 14/21ක් තුළ (Low Priority)",
    labelTa: "🟢 14/21 நாட்களுக்குள் (Low Priority)",
    descSi: "දීර්ඝ කාලීන සමාලෝචන ලිපි (දින 14-21 තුළ)",
    descTa: "பொதுவான அல்லது நீண்ட கால கடிதங்கள் (14-21 நாட்கள்)",
    descEn: "Routine or long-term review letters (Within 14-21 days)",
    color: "#16a34a",
    bg: "#dcfce7",
    border: "#86efac",
    dot: "#22c55e",
  },
];

function normalizePriorityKey(val: string | null | undefined): "high" | "medium" | "low" {
  if (!val) return "medium";
  const s = String(val).toLowerCase().trim();
  if (s.includes("high") || s.includes("urgent") || s.includes("today") || s.includes("අද")) return "high";
  if (s.includes("low") || s.includes("14") || s.includes("21") || s.includes("අඩු")) return "low";
  return "medium";
}

function BranchSelectionInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { i18n } = useTranslation();
  const lang = i18n.language;

  const letterId      = searchParams.get("id") || "";
  const letterNo      = searchParams.get("letterNo") || searchParams.get("refNo") || "";
  const refNo         = searchParams.get("refNo") || searchParams.get("letterNo") || "";
  const subject       = searchParams.get("subject") || "";
  const sender        = searchParams.get("sender") || "";
  const type          = searchParams.get("type") || "";
  const receivedDate  = searchParams.get("receivedDate") || searchParams.get("letterDate") || "";
  const forwardReason = searchParams.get("forwardReason") || "";
  const priorityParam = searchParams.get("priority") || "";

  const [mounted, setMounted] = useState(false);
  const [branchOptions, setBranchOptions] = useState(DEFAULT_BRANCH_OPTIONS);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<"high" | "medium" | "low">(() =>
    normalizePriorityKey(priorityParam)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitError, setSubmitError]   = useState("");

  useEffect(() => {
    setMounted(true);

    // If initial param had priority, apply it
    if (priorityParam) {
      setSelectedPriority(normalizePriorityKey(priorityParam));
    } else if (letterNo || refNo || letterId) {
      // Otherwise, load current priority from DB
      getLetterAndCaseDetailsByAnyRefServer(letterNo || refNo || letterId).then((res) => {
        if (res && res.success && res.data) {
          const rawP = res.data.priority || res.data.rawLetter?.priority;
          if (rawP) {
            setSelectedPriority(normalizePriorityKey(rawP));
          }
        }
      }).catch(() => {});
    }

    // Dynamically load active officers to resolve current registered Assistant Secretaries
    getRegisterOfficersServer().then((res) => {
      if (res && res.success && Array.isArray(res.data)) {
        const officers = res.data;
        setBranchOptions((prev) =>
          prev.map((opt) => {
            if (opt.value === "assistant_secretary_discipline" || opt.value === "chief_clerk_discipline") {
              const matched = officers.find((o: any) => {
                const r = (o.role || "").toLowerCase();
                const n = (o.full_name || "").toLowerCase();
                return (
                  (r.includes("discipline") && (r.includes("assistant") || r.includes("secretary") || r.includes("admin") || r.includes("chief"))) ||
                  n.includes("bandula")
                );
              });
              if (matched?.full_name) {
                return { ...opt, officerName: matched.full_name };
              }
            } else if (opt.value === "assistant_secretary_investigation" || opt.value === "chief_clerk_investigation") {
              const matched = officers.find((o: any) => {
                const r = (o.role || "").toLowerCase();
                const n = (o.full_name || "").toLowerCase();
                return (
                  (r.includes("investigation") && (r.includes("assistant") || r.includes("secretary") || r.includes("admin") || r.includes("chief"))) ||
                  n.includes("ranjith")
                );
              });
              if (matched?.full_name) {
                return { ...opt, officerName: matched.full_name };
              }
            }
            return opt;
          })
        );
      }
    }).catch(() => {});
  }, [priorityParam, letterNo, refNo, letterId]);

  const handleSubmit = async () => {
    if (!selectedBranch) return;
    const option = branchOptions.find((o) => o.value === selectedBranch);
    if (!option || !option.officerName) return;
    setIsSubmitting(true);
    setSubmitError("");
    const forwardNote = forwardReason || `Forwarded by Senior Assistant Secretary to ${option.label} for review and action`;
    const finalPriority = selectedPriority === "high" ? "High" : selectedPriority === "low" ? "Low" : "Medium";

    try {
      const res = await forwardLetterFromAdditionalSecretaryServer({
        letterId:             letterId || undefined,
        letterNo:             letterNo || undefined,
        refNo:                refNo || undefined,
        forwardToOfficerName: option.officerName,
        forwardToRole:        option.value,
        forwardReason:        forwardNote,
        senderName:           sender,
        senderRole:           "Senior Assistant Secretary",
        priority:             finalPriority,
      });
      if (res && res.success) {
        setSubmitStatus("success");
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("dcmms_data_updated"));
          window.dispatchEvent(new CustomEvent("dcmms_assignment_updated"));
          window.dispatchEvent(new CustomEvent("dcmms_notifications_updated"));
        }
        let targetPage = "/admin";
        if (option.value.includes("investigation")) {
          targetPage = `/investigation?highlight=${encodeURIComponent(letterNo || refNo)}`;
        } else if (option.value.includes("chief_clerk")) {
          targetPage = `/admin?view=chief_clerk&highlight=${encodeURIComponent(letterNo || refNo)}`;
        } else {
          targetPage = `/admin?highlight=${encodeURIComponent(letterNo || refNo)}`;
        }
        setTimeout(() => {
          router.push(targetPage);
        }, 1500);
      } else {
        setSubmitStatus("error");
        setSubmitError(res?.error || "Failed to forward letter. Please try again.");
      }
    } catch (err: any) {
      setSubmitStatus("error");
      setSubmitError(err?.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const lNo     = lang === "si" ? "ලිපි අංකය"    : lang === "ta" ? "கடித எண்"     : "Letter No";
  const lSender = lang === "si" ? "යවන ලද්දා"    : lang === "ta" ? "அனுப்பியவர்"  : "Sender";
  const lDate   = lang === "si" ? "ලැබුණු දිනය"  : lang === "ta" ? "பெற்ற தேதி"   : "Received date";
  const lType   = lang === "si" ? "ලිපි වර්ගය"   : lang === "ta" ? "கடித வகை"     : "Type";
  const lSub    = lang === "si" ? "විෂය"          : lang === "ta" ? "விஷயம்"       : "Subject";
  const lPri    = lang === "si" ? "ප්‍රමුඛතාව"    : lang === "ta" ? "முன்னுரிமை"   : "Priority";

  const activePriorityOpt = PRIORITY_OPTIONS.find((o) => o.value === selectedPriority) || PRIORITY_OPTIONS[1];

  if (!mounted) return null;

  return (
    <div className="bs-page">

      {/* Back */}
      <button type="button" className="bs-back" onClick={() => router.back()}>
        <ArrowLeft size={15} />
        {lang === "si" ? "ආපසු" : lang === "ta" ? "திரும்பு" : "Back"}
      </button>

      {/* Card */}
      <div className="bs-card">

        {/* Alerts */}
        {submitStatus === "success" && (
          <div className="bs-alert bs-alert--success">
            <CheckCircle2 size={17} />
            <div>
              <strong>{lang === "si" ? "ලිපිය සාර්ථකව යොමු කරන ලදී!" : lang === "ta" ? "கடிதம் வெற்றிகரமாக அனுப்பப்பட்டது!" : "Letter forwarded successfully!"}</strong>
              <div className="bs-alert-sub">
                {selectedBranch === "assistant_secretary_investigation" || selectedBranch === "chief_clerk_investigation" || selectedBranch.includes("investigation")
                  ? (lang === "si" ? "සහකාර ලේකම් - විමර්ශන ශාඛාව පිටුවට ඔබව යොමු කරමින්..." : lang === "ta" ? "விசாரணைப் பிரிவு உதவிச் செயலாளர் பக்கத்திற்கு செல்கிறீர்கள்..." : "Redirecting to Assistant Secretary Investigation Branch page...")
                  : (lang === "si" ? "සහකාර ලේකම් - විනය ශාඛාව පිටුවට ඔබව යොමු කරමින්..." : lang === "ta" ? "ஒழுக்காற்றுப் பிரிவு உதவிச் செயலாளர் பக்கத்திற்கு செல்கிறீர்கள்..." : "Redirecting to Assistant Secretary Discipline Branch page...")}
              </div>
            </div>
          </div>
        )}
        {submitStatus === "error" && (
          <div className="bs-alert bs-alert--error">
            <AlertCircle size={17} />
            <span>{submitError || "An error occurred. Please try again."}</span>
          </div>
        )}

        {/* ── Preview details box ── */}
        <div className="bs-preview-box">
          <div className="bs-preview-box-title">
            {lang === "si" ? "ලිපි විස්තර" : lang === "ta" ? "கடித விவரங்கள்" : "Preview details."}
          </div>
          <div className="bs-preview-row-1">
            <div className="bs-pfield">
              <span className="bs-pfield-label">{lNo} :</span>
              <span className="bs-pfield-value">{letterNo || "—"}</span>
            </div>
            <div className="bs-pfield">
              <span className="bs-pfield-label">{lSender} :</span>
              <span className="bs-pfield-value">{sender || "—"}</span>
            </div>
            <div className="bs-pfield">
              <span className="bs-pfield-label">{lDate} :</span>
              <span className="bs-pfield-value">{receivedDate || "—"}</span>
            </div>
          </div>
          <div className="bs-preview-row-2">
            <div className="bs-pfield">
              <span className="bs-pfield-label">{lType} :</span>
              <span className="bs-pfield-value">{type || "—"}</span>
            </div>
            <div className="bs-pfield">
              <span className="bs-pfield-label">{lPri} :</span>
              <span className="bs-pfield-value" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: activePriorityOpt.color,
                  }}
                />
                <span style={{ color: activePriorityOpt.color, fontWeight: 700, fontSize: "0.85rem" }}>
                  {lang === "si" ? activePriorityOpt.labelSi : lang === "ta" ? activePriorityOpt.labelTa : activePriorityOpt.label}
                </span>
              </span>
            </div>
            <div className="bs-pfield bs-pfield-subject">
              <span className="bs-pfield-label">{lSub} :</span>
              <span className="bs-pfield-value">{subject || "—"}</span>
            </div>
          </div>
        </div>

        {/* ── Branch and Priority Row (Side by Side) ── */}
        <div className="bs-form-row">
          {/* Branch dropdown section (Left) */}
          <div className="bs-field">
            <label htmlFor="branchSelect" className="bs-label">
              {lang === "si" ? "ලිපිය සඳහා ශාඛාව තෝරන්න" : lang === "ta" ? "கடிதத்திற்கான கிளையை தேர்ந்தெடுக்கவும்" : "Select the branch for the letter"}
            </label>
            <div className="bs-select-wrap">
              <select
                id="branchSelect"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="bs-select"
              >
                {branchOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.value === ""}>
                    {lang === "si" ? opt.labelSi : lang === "ta" ? opt.labelTa : opt.label}
                  </option>
                ))}
              </select>
              <span className="bs-select-arrow">&#8964;</span>
            </div>
            {/* Hints */}
            <ul className="bs-hints">
              {branchOptions.filter((o) => o.value !== "").map((opt) => (
                <li key={opt.value}>
                  {lang === "si" ? opt.labelSi : lang === "ta" ? opt.labelTa : opt.label}
                </li>
              ))}
            </ul>
          </div>

          {/* Priority selection section (Right) */}
          <div className="bs-field">
            <label htmlFor="prioritySelect" className="bs-label">
              {lang === "si" ? "ප්‍රමුඛතාවය තෝරන්න" : lang === "ta" ? "முன்னுரிமையைத் தேர்ந்தெடுக்கவும்" : "Select letter priority"}
            </label>
            <div className="bs-select-wrap">
              <select
                id="prioritySelect"
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value as any)}
                className="bs-select"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {lang === "si" ? opt.labelSi : lang === "ta" ? opt.labelTa : opt.label}
                  </option>
                ))}
              </select>
              <span className="bs-select-arrow">&#8964;</span>
            </div>
            {/* Priority Hints */}
            <ul className="bs-hints">
              <li>
                {lang === "si"
                  ? "අධි ප්‍රමුඛතා (High Priority) ලිපි සඳහා අදාළ නිලධාරියා වෙත කඩිනම් දැනුම්දීම් නිකුත් කෙරේ."
                  : lang === "ta"
                  ? "உயர் முன்னுரிமை (High Priority) கடிதங்களுக்கு சம்பந்தப்பட்ட அதிகாரிக்கு உடனடி அறிவிப்பு அனுப்பப்படும்."
                  : "High Priority letters generate urgent alerts and top-of-list placement for the assigned branch officer."}
              </li>
            </ul>
          </div>
        </div>

        {/* ── Buttons ── */}
        <div className="bs-actions">
          <button
            id="branch-selection-cancel"
            type="button"
            className="bs-btn bs-btn--cancel"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            {lang === "si" ? "අවලංගු කිරීම" : lang === "ta" ? "ரத்து செய்" : "Cancel"}
          </button>
          <button
            id="branch-selection-submit"
            type="button"
            className={"bs-btn bs-btn--submit" + ((!selectedBranch || isSubmitting || submitStatus === "success") ? " bs-btn--off" : "")}
            onClick={handleSubmit}
            disabled={!selectedBranch || isSubmitting || submitStatus === "success"}
          >
            {isSubmitting
              ? (lang === "si" ? "යොමු කරමින්..." : lang === "ta" ? "அனுப்புகிறது..." : "Forwarding...")
              : submitStatus === "success"
              ? (lang === "si" ? "සාර්ථකයි!" : lang === "ta" ? "வெற்றி!" : "Done!")
              : (lang === "si" ? "ඉදිරිපත් කරන්න" : lang === "ta" ? "சமர்ப்பி" : "Submit")}
          </button>
        </div>
      </div>

      <style>{`
        /* ── Page ── */
        .bs-page {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        /* Back link */
        .bs-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: #6b7280;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          padding: 0;
        }
        .bs-back:hover { color: #111827; }

        /* ── Main card ── */
        .bs-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
          padding: 28px 32px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          width: 100%;
        }

        /* Alerts */
        .bs-alert {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 12px 14px; border-radius: 8px;
          font-size: 0.85rem; font-weight: 500;
        }
        .bs-alert--success { background:#f0fdf4; border:1px solid #86efac; color:#166534; }
        .bs-alert--error   { background:#fef2f2; border:1px solid #fca5a5; color:#991b1b; }
        .bs-alert-sub { font-size:0.78rem; opacity:0.8; margin-top:2px; font-weight:400; }

        /* ── Preview box ── */
        .bs-preview-box {
          border: 1.5px solid #d1d5db;
          border-radius: 10px;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .bs-preview-box-title {
          font-size: 0.82rem;
          font-weight: 700;
          color: #374151;
          margin-bottom: 2px;
        }

        /* Row 1: Letter No | Sender | Received Date — 3 cols */
        .bs-preview-row-1 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
        }
        /* Row 2: Type | Priority | Subject */
        .bs-preview-row-2 {
          display: grid;
          grid-template-columns: 140px 220px 1fr;
          gap: 16px;
          border-top: 1px dashed #e5e7eb;
          padding-top: 12px;
        }

        .bs-pfield { display: flex; flex-direction: column; gap: 2px; }
        .bs-pfield-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .bs-pfield-value {
          font-size: 0.9rem;
          font-weight: 600;
          color: #111827;
          word-break: break-word;
        }

        /* ── Form Row: Side-by-side Branch & Priority ── */
        .bs-form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          align-items: flex-start;
          width: 100%;
        }

        /* ── Field ── */
        .bs-field { display: flex; flex-direction: column; gap: 8px; width: 100%; }
        .bs-label {
          font-size: 0.875rem;
          font-weight: 600;
          color: #374151;
        }
        .bs-select-wrap { position: relative; width: 100%; }
        .bs-select {
          width: 100%;
          padding: 10px 40px 10px 14px;
          border: 1.5px solid #d1d5db;
          border-radius: 8px;
          font-size: 0.9rem;
          color: #111827;
          background: #fff;
          appearance: none;
          cursor: pointer;
          outline: none;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04);
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .bs-select:focus {
          border-color: #7c3aed;
          box-shadow: 0 0 0 3px rgba(124,58,237,0.12);
        }
        .bs-select-arrow {
          position: absolute;
          right: 12px; top: 50%;
          transform: translateY(-50%);
          font-size: 1.1rem;
          color: #6b7280;
          pointer-events: none;
          line-height: 1;
        }

        /* Hints */
        .bs-hints {
          list-style: none;
          padding: 0; margin: 0;
          display: flex; flex-direction: column; gap: 3px;
        }
        .bs-hints li {
          font-size: 0.8rem;
          color: #9ca3af;
          display: flex; align-items: center; gap: 6px;
        }
        .bs-hints li::before { content: "*"; color: #a78bfa; font-weight: 700; }

        /* ── Buttons ── */
        .bs-actions {
          display: flex;
          gap: 12px;
          padding-top: 4px;
        }
        .bs-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 28px;
          border-radius: 8px;
          font-size: 0.875rem; font-weight: 600;
          cursor: pointer; border: none;
          transition: all 0.15s;
        }
        .bs-btn--cancel {
          background: #fff;
          border: 1.5px solid #d1d5db;
          color: #374151;
        }
        .bs-btn--cancel:hover:not(:disabled) { background:#f9fafb; border-color:#9ca3af; }
        .bs-btn--submit {
          background: linear-gradient(90deg, #7c3aed 0%, #6d28d9 100%);
          color: #fff;
          box-shadow: 0 2px 6px rgba(109,40,217,0.22);
        }
        .bs-btn--submit:hover:not(.bs-btn--off) { opacity: 0.9; }
        .bs-btn--off {
          background: #e5e7eb !important;
          color: #9ca3af !important;
          box-shadow: none !important;
          cursor: not-allowed !important;
        }

        @media (max-width: 768px) {
          .bs-form-row { grid-template-columns: 1fr; gap: 18px; }
        }

        @media (max-width: 640px) {
          .bs-card { padding: 18px 16px; }
          .bs-preview-row-1 { grid-template-columns: 1fr 1fr; }
          .bs-preview-row-2 { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

export default function BranchSelectionPage() {
  return (
    <Suspense fallback={<div style={{ padding: "32px", color: "#6b7280" }}>Loading...</div>}>
      <BranchSelectionInner />
    </Suspense>
  );
}
