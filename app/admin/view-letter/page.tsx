"use client";

import "../../../i18n";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getCurrentProfile } from "@/lib/auth";
import {
  getDailyMailRecordsServer,
  forwardLetterFromAdditionalSecretaryServer,
  updateLetterRecordServer,
} from "@/lib/db-actions";
import {
  getLetterOriginGroup,
  getOriginBadge,
  KEY_ADMINISTRATIVE_OFFICERS,
  isLetterFromAdministrativeOfficers,
  getOfficerSenderTitle,
} from "@/lib/letter-hierarchy";
import {
  ArrowLeft,
  FileText,
  Mail,
  AlertCircle,
  CheckCircle2,
  Send,
  Shield,
  Eye,
  Printer,
  Calendar,
  Building2,
  Tag,
  Clock,
  ExternalLink,
  Share2,
  X,
  Check,
  Sparkles,
  Edit3,
  Save,
  RotateCcw,
  Lock,
  ShieldAlert,
} from "lucide-react";

const fmt = (d?: any): string => {
  if (!d) return "—";
  const str = String(d).trim();
  if (!str || str === "—" || str.toLowerCase() === "null") return "—";
  if (str.includes("T")) return str.split("T")[0];
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
  return str;
};

const priorityConfig: Record<string, { label: string; bg: string; color: string; border: string }> = {
  high:   { label: "High Priority",   bg: "#fef2f2", color: "#b91c1c", border: "#fca5a5" },
  medium: { label: "Medium Priority", bg: "#fffbeb", color: "#b45309", border: "#fcd34d" },
  low:    { label: "Low Priority",    bg: "#f0fdf4", color: "#15803d", border: "#86efac" },
};

function FieldRow({ label, value, mono = false, highlight = false }: {
  label: string; value?: string; mono?: boolean; highlight?: boolean;
}) {
  const display = value && value !== "—" && value.trim() ? value : "—";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <span style={{
        fontSize: "11px", fontWeight: 700, color: "#64748b",
        textTransform: "uppercase" as const, letterSpacing: "0.5px",
      }}>{label}</span>
      <span style={{
        fontSize: "14px", fontWeight: 600,
        color: highlight ? "#4338ca" : (display === "—" ? "#94a3b8" : "#0f172a"),
        fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" : undefined,
        wordBreak: "break-word" as const,
        lineHeight: 1.45,
      }}>{display}</span>
    </div>
  );
}

function SectionCard({ title, icon, children, accentColor = "#4f46e5" }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; accentColor?: string;
}) {
  return (
    <div style={{
      background: "#ffffff",
      border: "1px solid #e2e8f0",
      borderRadius: "14px",
      overflow: "hidden",
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      marginBottom: "20px",
      width: "100%",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "14px 22px",
        borderBottom: "1px solid #f1f5f9",
        background: "#f8fafc",
      }}>
        <div style={{
          width: "32px", height: "32px", borderRadius: "8px",
          background: `${accentColor}18`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: accentColor, flexShrink: 0,
        }}>{icon}</div>
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>{title}</h3>
      </div>
      <div style={{ padding: "22px 24px" }}>{children}</div>
    </div>
  );
}

function ViewLetterInner() {
  const { i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang = i18n.language;

  const id = searchParams?.get("id") || searchParams?.get("letterNo") || searchParams?.get("caseNo") || "";

  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [letter, setLetter] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Forwarding State for Additional Secretary
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [forwardRecipientRole, setForwardRecipientRole] = useState("senior_assistant_secretary");
  const [forwardRecipientName, setForwardRecipientName] = useState("Dharshana Senanayake");
  const [forwardReasonInput, setForwardReasonInput] = useState("");
  const [isSubmittingForward, setIsSubmittingForward] = useState(false);
  const [forwardNotification, setForwardNotification] = useState<string | null>(null);

  // Edit Letter State for Additional Secretary
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editLetterNo, setEditLetterNo] = useState("");
  const [editRefNo, setEditRefNo] = useState("");
  const [editSenderName, setEditSenderName] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editLetterType, setEditLetterType] = useState("Complaint");
  const [editSubjectCategory, setEditSubjectCategory] = useState("");
  const [editInstituteName, setEditInstituteName] = useState("");
  const [editRegionProvince, setEditRegionProvince] = useState("");
  const [editPriority, setEditPriority] = useState("medium");
  const [editLetterDate, setEditLetterDate] = useState("");
  const [editReceivedDate, setEditReceivedDate] = useState("");
  const [editActionOfficer, setEditActionOfficer] = useState("");
  const [editForwardedTo, setEditForwardedTo] = useState("");
  const [editForwardReason, setEditForwardReason] = useState("");
  const [editAddSecInstructions, setEditAddSecInstructions] = useState("");
  const [editAddSecNotes, setEditAddSecNotes] = useState("");
  const [editAddSecForwardMethod, setEditAddSecForwardMethod] = useState("");
  const [editDocumentUrl, setEditDocumentUrl] = useState("");
  const [editDocumentName, setEditDocumentName] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editSuccessNotification, setEditSuccessNotification] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    getCurrentProfile().then((prof) => {
      if (!prof) router.replace("/");
      else setCurrentUser(prof);
    });
  }, [router]);

  useEffect(() => {
    if (!id) { setIsLoading(false); setNotFound(true); return; }
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);

      // 1. PostgreSQL server action
      try {
        const res = await getDailyMailRecordsServer();
        if (res && res.success && Array.isArray(res.data)) {
          const idLow = String(id).toLowerCase();
          const match = res.data.find((item: any) =>
            String(item.id) === String(id) ||
            String(item.letter_no || "").toLowerCase() === idLow ||
            String(item.ref_no || "").toLowerCase() === idLow ||
            String(item.letterNo || "").toLowerCase() === idLow ||
            String(item.refNo || "").toLowerCase() === idLow ||
            String(item.serial_no || "").toLowerCase() === idLow
          );
          if (match && !cancelled) { setLetter(match); setIsLoading(false); return; }
        }
      } catch { /* continue */ }

      // 2. Supabase dcmms_daily_mail
      if (isSupabaseConfigured) {
        try {
          const { data } = await supabase.from("dcmms_daily_mail").select("*")
            .or(`id.eq.${id},ref_no.eq.${id},letter_no.eq.${id}`).limit(1);
          if (data && data.length > 0 && !cancelled) { setLetter(data[0]); setIsLoading(false); return; }
        } catch { /* continue */ }

        try {
          const { data: d2 } = await supabase.from("daily_mail_letter_table").select("*")
            .or(`id.eq.${id},ref_no.eq.${id},letter_no.eq.${id}`).limit(1);
          if (d2 && d2.length > 0 && !cancelled) { setLetter(d2[0]); setIsLoading(false); return; }
        } catch { /* continue */ }
      }

      // 3. localStorage
      if (typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem("dcmms_letters");
          if (stored) {
            const list = JSON.parse(stored);
            const idLow = String(id).toLowerCase();
            const found = list.find((item: any) =>
              String(item.id) === String(id) ||
              String(item.letterNo || "").toLowerCase() === idLow ||
              String(item.refNo || "").toLowerCase() === idLow
            );
            if (found && !cancelled) { setLetter(found); setIsLoading(false); return; }
          }
        } catch { /* continue */ }
      }

      if (!cancelled) { setNotFound(true); setIsLoading(false); }
    };

    load();
    return () => { cancelled = true; };
  }, [id]);

  // ── Derived display values ──────────────────────────────────────────────────
  const letterNo    = letter?.letter_no || letter?.letterNo || letter?.letter_number || "—";
  const refNo       = letter?.serial_no || letter?.ref_no || letter?.refNo || letter?.ref_number || "—";
  const senderName  = letter?.sender_name || letter?.sender || letter?.senderName || letter?.senders_party || "—";
  const subject     = letter?.subject || letter?.subject_of_letter || "—";
  const letterType  = letter?.letter_type || letter?.letterType || letter?.method || letter?.type || letter?.nature_of_letter || "—";
  const subjectCategory = letter?.subject_category || letter?.classification || letter?.subjectCategory || "—";
  const instituteName   = letter?.institute_name || letter?.instituteName || "—";
  const regionProvince  = letter?.region_province || letter?.regionProvince || "—";
  const priority    = (letter?.priority || "medium").toLowerCase();
  const priCfg      = priorityConfig[priority] || priorityConfig["medium"];
  const letterDate  = fmt(letter?.letter_date || letter?.letterDate || letter?.submitted_date);
  const receivedDate = fmt(letter?.received_date || letter?.receivedDate || letter?.date_received_by_add_secretary);
  const officerName  = letter?.officer_name || letter?.officerName || letter?.action_officer || letter?.addressed_to || "—";
  const createdByName = letter?.created_by_name || letter?.createdByName || "—";
  const createdByRole = (letter?.created_by_role || letter?.createdByRole || "—").replace(/_/g, " ");
  const forwardedTo  = letter?.forwarded_to || letter?.forwardedTo || "—";
  const forwardReason = letter?.forward_reason || letter?.forwardReason || "—";
  const status       = letter?.status || "assigned";
  const isAnswerLetter = letter?.is_answer_letter === true || String(letter?.is_answer_letter) === "true";
  const documentUrl  = letter?.document_url || letter?.documentUrl || "";
  const documentName = letter?.document_name || letter?.documentName || "";
  const addSecName   = letter?.add_sec_name || letter?.addSecName || "";
  const addSecProcessedDate = fmt(letter?.add_sec_processed_date || letter?.addSecProcessedDate);
  const addSecInstructions  = letter?.add_sec_instructions || letter?.addSecInstructions || "";
  const addSecForwardMethod = letter?.add_sec_forward_method || letter?.addSecForwardMethod || "";
  const addSecNotes  = letter?.add_sec_notes || letter?.addSecNotes || "";

  // Letter Provenance Origin Group
  const originGroup = getLetterOriginGroup(letter);
  const originBadge = getOriginBadge(originGroup, lang);
  const isDirectAddSec = originGroup === "direct_additional_sec";
  const isFromAdministrativeOfficer = isLetterFromAdministrativeOfficers(letter);
  const senderOfficerTitle = getOfficerSenderTitle(originGroup, lang);
  const isProtectedOriginSection = (sectionKey: "letterNo" | "letterType" | "letterDate" | "sendBy") => {
    return Boolean(isFromAdministrativeOfficer);
  };
  const isAddSecUser = 
    currentUser?.role === "additional_secretary" ||
    currentUser?.role === "admin" ||
    currentUser?.role === "system_admin" ||
    (currentUser?.full_name || "").toLowerCase().includes("nihal") ||
    (currentUser?.email || "").toLowerCase().includes("sec-test-004");

  const handleForwardLetterSubmit = async () => {
    if (!letter || isSubmittingForward) return;
    setIsSubmittingForward(true);
    try {
      const res = await forwardLetterFromAdditionalSecretaryServer({
        letterId: letter.id,
        letterNo: letterNo !== "—" ? letterNo : (letter.letterNo || letter.refNo || "Letter"),
        refNo: refNo !== "—" ? refNo : (letter.refNo || letter.serial_no || ""),
        forwardToRole: forwardRecipientRole,
        forwardToOfficerName: forwardRecipientName,
        forwardReason: forwardReasonInput.trim(),
        senderName: currentUser?.full_name ? `${currentUser.full_name} (Additional Secretary)` : "Additional Secretary",
      });

      if (res && res.success) {
        setLetter((prev: any) => ({
          ...prev,
          forwarded_to: `${forwardRecipientName} (${forwardRecipientRole.replace(/_/g, " ")})`,
          forwardedTo: `${forwardRecipientName} (${forwardRecipientRole.replace(/_/g, " ")})`,
          forward_reason: forwardReasonInput.trim() || `Forwarded to ${forwardRecipientName}`,
          forwardReason: forwardReasonInput.trim() || `Forwarded to ${forwardRecipientName}`,
          action_officer: forwardRecipientName,
          actionOfficer: forwardRecipientName,
          addressed_to: forwardRecipientName,
          addressedTo: forwardRecipientName,
          status: "forwarded",
        }));
        setForwardNotification(
          lang === "si"
            ? `ලිපිය සාර්ථකව ${forwardRecipientName} වෙත යොමු කරන ලදී!`
            : `Letter successfully forwarded to ${forwardRecipientName}!`
        );
        setIsForwardModalOpen(false);
        setForwardReasonInput("");
        setTimeout(() => setForwardNotification(null), 5000);
      } else {
        alert("Failed to forward letter: " + (res?.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Error forwarding letter: " + (err?.message || "Unknown error"));
    } finally {
      setIsSubmittingForward(false);
    }
  };

  const handleOpenEdit = () => {
    if (!letter) return;
    const lNo = letter.letter_no || letter.letterNo || letter.letter_number || "";
    const rNo = letter.serial_no || letter.ref_no || letter.refNo || letter.ref_number || "";
    setEditLetterNo(lNo === "—" ? "" : lNo);
    setEditRefNo(rNo === "—" ? "" : rNo);
    setEditSenderName(letter.sender_name || letter.sender || letter.senderName || letter.senders_party || "");
    setEditSubject(letter.subject || letter.subject_of_letter || "");
    setEditLetterType(letter.letter_type || letter.letterType || letter.type || letter.nature_of_letter || "Complaint");
    setEditSubjectCategory(letter.subject_category || letter.classification || letter.subjectCategory || "");
    setEditInstituteName(letter.institute_name || letter.instituteName || "");
    setEditRegionProvince(letter.region_province || letter.regionProvince || "");
    const prio = (letter.priority || "medium").toLowerCase();
    setEditPriority(prio === "urgent" ? "high" : prio);
    setEditLetterDate(fmt(letter.letter_date || letter.letterDate || letter.submitted_date || letter.date_letter_handover_discipline));
    setEditReceivedDate(fmt(letter.received_date || letter.receivedDate || letter.date_received_by_add_secretary));
    setEditActionOfficer(letter.action_officer || letter.actionOfficer || letter.officer_name || letter.officerName || letter.addressed_to || letter.addressedTo || "");
    setEditForwardedTo(letter.forwarded_to || letter.forwardedTo || "");
    setEditForwardReason(letter.forward_reason || letter.forwardReason || "");
    setEditAddSecInstructions(letter.add_sec_instructions || letter.addSecInstructions || "");
    setEditAddSecNotes(letter.add_sec_notes || letter.addSecNotes || "");
    setEditAddSecForwardMethod(letter.add_sec_forward_method || letter.addSecForwardMethod || "");
    setEditDocumentUrl(letter.document_url || letter.documentUrl || "");
    setEditDocumentName(letter.document_name || letter.documentName || "");
    setIsEditModalOpen(true);
  };

  useEffect(() => {
    if (letter) {
      const lNo = letter.letter_no || letter.letterNo || letter.letter_number || "";
      const rNo = letter.serial_no || letter.ref_no || letter.refNo || letter.ref_number || "";
      setEditLetterNo(lNo === "—" ? "" : lNo);
      setEditRefNo(rNo === "—" ? "" : rNo);
      setEditSenderName(letter.sender_name || letter.sender || letter.senderName || letter.senders_party || "");
      setEditSubject(letter.subject || letter.subject_of_letter || "");
      setEditLetterType(letter.letter_type || letter.letterType || letter.type || letter.nature_of_letter || "Complaint");
      setEditSubjectCategory(letter.subject_category || letter.classification || letter.subjectCategory || "");
      setEditInstituteName(letter.institute_name || letter.instituteName || "");
      setEditRegionProvince(letter.region_province || letter.regionProvince || "");
      const prio = (letter.priority || "medium").toLowerCase();
      setEditPriority(prio === "urgent" ? "high" : prio);
      setEditLetterDate(fmt(letter.letter_date || letter.letterDate || letter.submitted_date || letter.date_letter_handover_discipline));
      setEditReceivedDate(fmt(letter.received_date || letter.receivedDate || letter.date_received_by_add_secretary));
      setEditActionOfficer(letter.action_officer || letter.actionOfficer || letter.officer_name || letter.officerName || letter.addressed_to || letter.addressedTo || "");
      setEditForwardedTo(letter.forwarded_to || letter.forwardedTo || "");
      setEditForwardReason(letter.forward_reason || letter.forwardReason || "");
      setEditAddSecInstructions(letter.add_sec_instructions || letter.addSecInstructions || "");
      setEditAddSecNotes(letter.add_sec_notes || letter.addSecNotes || "");
      setEditAddSecForwardMethod(letter.add_sec_forward_method || letter.addSecForwardMethod || "");
      setEditDocumentUrl(letter.document_url || letter.documentUrl || "");
      setEditDocumentName(letter.document_name || letter.documentName || "");
    }
  }, [letter]);

  const handleSaveEditSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!letter || isSavingEdit) return;

    if (!editLetterNo.trim() && !editRefNo.trim()) {
      alert(lang === "si" ? "ලිපි අංකය හෝ යොමු අංකය අවශ්‍යයි" : "Letter Number or Reference Number is required");
      return;
    }

    setIsSavingEdit(true);
    try {
      const origLetterNo = letter.letter_no || letter.letterNo || letter.letter_number || "";
      const origRefNo = letter.serial_no || letter.ref_no || letter.refNo || letter.ref_number || "";

      const res = await updateLetterRecordServer({
        letterId: letter.id,
        originalLetterNo: origLetterNo,
        originalRefNo: origRefNo,
        letterNo: editLetterNo.trim(),
        refNo: editRefNo.trim(),
        senderName: editSenderName.trim(),
        subject: editSubject.trim(),
        letterType: editLetterType.trim(),
        subjectCategory: editSubjectCategory.trim(),
        instituteName: editInstituteName.trim(),
        regionProvince: editRegionProvince.trim(),
        priority: editPriority.charAt(0).toUpperCase() + editPriority.slice(1),
        letterDate: editLetterDate,
        receivedDate: editReceivedDate,
        actionOfficer: editActionOfficer.trim() || letter.action_officer || letter.actionOfficer || letter.officer_name || letter.officerName || letter.addressed_to || letter.addressedTo || "",
        addressedTo: editActionOfficer.trim() || letter.action_officer || letter.actionOfficer || letter.officer_name || letter.officerName || letter.addressed_to || letter.addressedTo || "",
        addressedRole: letter.addressed_role || letter.addressedRole || "",
        forwardedTo: editForwardedTo.trim() || letter.forwarded_to || letter.forwardedTo || "",
        forwardReason: editForwardReason.trim() || letter.forward_reason || letter.forwardReason || "",
        addSecInstructions: editAddSecInstructions.trim(),
        addSecNotes: editAddSecNotes.trim() || letter.add_sec_notes || letter.addSecNotes || "",
        addSecForwardMethod: editAddSecForwardMethod.trim() || letter.add_sec_forward_method || letter.addSecForwardMethod || "",
        documentUrl: editDocumentUrl.trim() || letter.document_url || letter.documentUrl || "",
        documentName: editDocumentName.trim() || letter.document_name || letter.documentName || "",
        isAnswerLetter: Boolean(letter.is_answer_letter),
        editedByName: currentUser?.full_name || "Additional Secretary",
        editedByRole: currentUser?.role || "additional_secretary",
      });

      if (res && res.success) {
        const updated = {
          ...letter,
          ...(isFromAdministrativeOfficer
            ? {
                serial_no: editRefNo.trim(),
                ref_no: editRefNo.trim(),
                refNo: editRefNo.trim(),
                ref_number: editRefNo.trim(),
                subject: editSubject.trim(),
                subject_of_letter: editSubject.trim(),
                subject_category: editSubjectCategory.trim(),
                classification: editSubjectCategory.trim(),
                institute_name: editInstituteName.trim(),
                instituteName: editInstituteName.trim(),
                region_province: editRegionProvince.trim(),
                regionProvince: editRegionProvince.trim(),
                received_date: editReceivedDate,
                receivedDate: editReceivedDate,
                date_received_by_add_secretary: editReceivedDate,
              }
            : {
                letter_no: editLetterNo.trim(),
                letterNo: editLetterNo.trim(),
                letter_number: editLetterNo.trim(),
                serial_no: editRefNo.trim(),
                ref_no: editRefNo.trim(),
                refNo: editRefNo.trim(),
                ref_number: editRefNo.trim(),
                sender_name: editSenderName.trim(),
                sender: editSenderName.trim(),
                senders_party: editSenderName.trim(),
                subject: editSubject.trim(),
                subject_of_letter: editSubject.trim(),
                letter_type: editLetterType.trim(),
                letterType: editLetterType.trim(),
                nature_of_letter: editLetterType.trim(),
                subject_category: editSubjectCategory.trim(),
                classification: editSubjectCategory.trim(),
                institute_name: editInstituteName.trim(),
                instituteName: editInstituteName.trim(),
                region_province: editRegionProvince.trim(),
                regionProvince: editRegionProvince.trim(),
                letter_date: editLetterDate,
                letterDate: editLetterDate,
                received_date: editReceivedDate,
                receivedDate: editReceivedDate,
                date_received_by_add_secretary: editReceivedDate,
              }),
          priority: editPriority.toLowerCase(),
          action_officer: editActionOfficer.trim(),
          actionOfficer: editActionOfficer.trim(),
          addressed_to: editActionOfficer.trim(),
          addressedTo: editActionOfficer.trim(),
          forwarded_to: editForwardedTo.trim(),
          forwardedTo: editForwardedTo.trim(),
          forward_reason: editForwardReason.trim(),
          forwardReason: editForwardReason.trim(),
          add_sec_instructions: editAddSecInstructions.trim(),
          addSecInstructions: editAddSecInstructions.trim(),
          add_sec_notes: editAddSecNotes.trim(),
          addSecNotes: editAddSecNotes.trim(),
          add_sec_forward_method: editAddSecForwardMethod.trim(),
          addSecForwardMethod: editAddSecForwardMethod.trim(),
          document_url: editDocumentUrl.trim(),
          documentUrl: editDocumentUrl.trim(),
          document_name: editDocumentName.trim(),
          documentName: editDocumentName.trim(),
          last_edited_by: `${currentUser?.full_name || "Additional Secretary"} (${currentUser?.role || "additional_secretary"})`,
          last_edited_at: new Date().toISOString(),
        };

        setLetter(updated);
        setIsEditModalOpen(false);
        setEditSuccessNotification(
          lang === "si"
            ? "ලිපිය අතිරේක ලේකම් විසින් සාර්ථකව සංස්කරණය කර යාවත්කාලීන කරන ලදී!"
            : "Letter details successfully updated by Additional Secretary!"
        );
        setTimeout(() => setEditSuccessNotification(null), 6000);

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("dcmms_data_updated"));
          window.dispatchEvent(new CustomEvent("dcmms_assignment_updated"));
        }
      } else {
        alert(res?.error || "Failed to update letter");
      }
    } catch (err: any) {
      console.error("Error saving letter edits:", err);
      alert(err?.message || "Failed to save letter edits");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Show loading until client is mounted and data is loaded
  if (!mounted || isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh", width: "100%" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "42px", height: "42px", border: "3px solid #e2e8f0",
            borderTopColor: "#4f46e5", borderRadius: "50%",
            animation: "vl-spin 0.8s linear infinite", margin: "0 auto 14px",
          }} />
          <p style={{ color: "#64748b", fontWeight: 600, fontSize: "14px", margin: 0 }}>
            {lang === "si" ? "ලිපි විස්තර ලබා ගනිමින්..." : "Loading letter details..."}
          </p>
        </div>
        <style>{`@keyframes vl-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-container" style={{ width: "100%", padding: "4px 0 32px" }}>

      {/* ── Top Navigation & Actions Bar ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "14px",
        marginBottom: "20px",
        paddingBottom: "16px",
        borderBottom: "1px solid #e2e8f0",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <Link href="/admin" style={{
            display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "13px", fontWeight: 600,
            color: "#334155", textDecoration: "none",
            padding: "8px 14px", background: "#f1f5f9", borderRadius: "8px", border: "1px solid #cbd5e1",
            transition: "all 0.15s ease",
          }}>
            <ArrowLeft size={15} />
            {lang === "si" ? "ආපසු" : "Back to Dashboard"}
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{
              fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.5px",
              padding: "4px 10px", borderRadius: "6px", background: "#ede9fe", color: "#6366f1",
            }}>
              {lang === "si" ? "ලිපි විස්තර" : "Letter Details"}
            </span>
            {!notFound && (
              <span style={{
                fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "6px",
                background: priCfg.bg, color: priCfg.color, border: `1px solid ${priCfg.border}`,
              }}>
                {priCfg.label}
              </span>
            )}
            {originBadge && (
              <span style={{
                fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "6px",
                background: originBadge.bg, color: originBadge.color, border: `1px solid ${originBadge.border}`,
                display: "inline-flex", alignItems: "center", gap: "5px"
              }}>
                <span>{originBadge.icon}</span>
                <span>{originBadge.label}</span>
              </span>
            )}
            {isAnswerLetter && (
              <span style={{ fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "6px", background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd" }}>
                {lang === "si" ? "පිළිතුරු ලිපිය" : "Answer Letter"}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {isAddSecUser && (
            <button
              type="button"
              onClick={() => setIsForwardModalOpen(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: "7px",
                padding: "8px 16px", borderRadius: "8px",
                background: "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)",
                border: "none", color: "#ffffff",
                fontWeight: 700, fontSize: "12.5px", cursor: "pointer",
                boxShadow: "0 2px 6px rgba(79, 70, 229, 0.3)",
                transition: "all 0.15s ease",
              }}
            >
              <Send size={14} />
              {lang === "si" ? "ලිපිය යොමු කරන්න" : lang === "ta" ? "கடிதத்தை அனுப்பு" : "Forward Letter"}
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "8px 14px", borderRadius: "8px",
              background: "#ffffff", border: "1px solid #cbd5e1", color: "#475569",
              fontWeight: 600, fontSize: "12.5px", cursor: "pointer",
            }}
          >
            <Printer size={15} />
            {lang === "si" ? "මුද්‍රණය කරන්න" : "Print"}
          </button>

          {isAddSecUser ? (
            <button
              type="button"
              onClick={handleSaveEditSubmit}
              disabled={isSavingEdit}
              style={{
                display: "inline-flex", alignItems: "center", gap: "7px",
                padding: "8px 18px", borderRadius: "8px",
                background: isSavingEdit ? "#94a3b8" : "linear-gradient(135deg, #059669 0%, #047857 100%)",
                border: "none", color: "#ffffff",
                fontWeight: 700, fontSize: "12.5px", cursor: isSavingEdit ? "not-allowed" : "pointer",
                boxShadow: "0 2px 6px rgba(5, 150, 105, 0.3)",
                transition: "all 0.15s ease",
              }}
              title={lang === "si" ? "වෙනස්කම් සුරකින්න" : "Save Changes"}
            >
              <Save size={14} />
              {isSavingEdit 
                ? (lang === "si" ? "සුරකිමින්..." : "Saving...") 
                : (lang === "si" ? "වෙනස්කම් සුරකින්න" : "Save Changes")}
            </button>
          ) : (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "7px",
              padding: "8px 16px", borderRadius: "8px",
              background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46",
              fontWeight: 700, fontSize: "13px",
            }}>
              <Eye size={16} />
              {lang === "si" ? "කියවීමට පමණි" : "Read Only"}
            </div>
          )}
        </div>
      </div>

      {/* ── Notification Banners if action succeeded ── */}
      {editSuccessNotification && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "12px 18px",
          borderRadius: "10px",
          background: "#ecfdf5",
          border: "1.5px solid #10b981",
          color: "#065f46",
          fontSize: "13.5px",
          fontWeight: 700,
          marginBottom: "18px",
          boxShadow: "0 2px 8px rgba(16, 185, 129, 0.15)",
        }}>
          <CheckCircle2 size={18} color="#059669" />
          <span>{editSuccessNotification}</span>
        </div>
      )}

      {forwardNotification && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "12px 18px",
          borderRadius: "10px",
          background: "#ecfdf5",
          border: "1.5px solid #6ee7b7",
          color: "#065f46",
          fontSize: "13.5px",
          fontWeight: 700,
          marginBottom: "18px",
          boxShadow: "0 2px 8px rgba(16, 185, 129, 0.15)",
        }}>
          <CheckCircle2 size={18} color="#059669" />
          <span>{forwardNotification}</span>
        </div>
      )}

      {/* ── Letter Headline Hero Card ── */}
      {!notFound && (
        <div style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          padding: "20px 24px",
          marginBottom: "20px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
          width: "100%",
        }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
              {lang === "si" ? "නිල ලිපි අංකය" : "Official Letter Number"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h1 style={{
                margin: 0,
                fontSize: "24px",
                fontWeight: 800,
                color: "#0f172a",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                letterSpacing: "-0.5px",
              }}>
                {letterNo}
              </h1>
              {isAddSecUser && (
                <button
                  type="button"
                  onClick={handleOpenEdit}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    color: "#15803d",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  title={lang === "si" ? "ලිපිය සංස්කරණය" : "Edit Letter"}
                >
                  <Edit3 size={13} />
                  <span>{lang === "si" ? "සංස්කරණය" : "Edit"}</span>
                </button>
              )}
            </div>
            <p style={{ margin: "5px 0 0 0", fontSize: "13px", color: "#64748b" }}>
              {isFromAdministrativeOfficer
                ? (lang === "si"
                    ? `${senderOfficerTitle} විසින් එවූ ලිපියකි — මූලික තොරතුරු 4 (ලිපි අංකය, ලිපි වර්ගය, ලිපි දිනය, එවූ පාර්ශවය) ආරක්ෂිත වන අතර අනෙකුත් සියලුම කොටස් ඇතුළත් කිරීමට හෝ සංස්කරණය කිරීමට හැක.`
                    : `Submitted by ${senderOfficerTitle} — Core 4 origin fields protected. All other parts can be included or modified.`)
                : isAddSecUser
                ? (lang === "si" ? "අතිරේක ලේකම් බලතල සහිතයි — ඕනෑම විස්තරයක් සංස්කරණය කළ හැක" : "Additional Secretary privileges active — any field can be edited")
                : (lang === "si" ? "මෙම ලිපිය කියවීමට පමණි" : "View-only letter details")}
            </p>
          </div>

          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "18px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            padding: "10px 18px",
            flexWrap: "wrap",
          }}>
            <div>
              <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {lang === "si" ? "තත්ත්වය" : "Status"}
              </div>
              <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0f172a", textTransform: "capitalize" }}>
                {status}
              </div>
            </div>
            <div style={{ width: "1px", height: "26px", background: "#cbd5e1" }} />
            <div>
              <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {lang === "si" ? "ලිපි වර්ගය" : "Type"}
              </div>
              <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0f172a" }}>
                {letterType}
              </div>
            </div>
            <div style={{ width: "1px", height: "26px", background: "#cbd5e1" }} />
            <div>
              <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {lang === "si" ? "ලැබුණු දිනය" : "Received"}
              </div>
              <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0f172a" }}>
                {receivedDate}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Direct Additional Secretary Forwarding Notice/Callout ── */}
      {!notFound && isDirectAddSec && (
        <div style={{
          background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
          border: "1.5px solid #fde68a",
          borderRadius: "14px",
          padding: "18px 24px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
          boxShadow: "0 2px 6px rgba(245, 158, 11, 0.08)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", maxWidth: "700px" }}>
            <div style={{
              width: "44px", height: "44px", borderRadius: "10px",
              background: "#fef3c7", border: "1.5px solid #f59e0b",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "22px", flexShrink: 0,
            }}>
              📬
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 800, color: "#92400e" }}>
                {lang === "si" ? "මෙම ලිපිය අතිරේක ලේකම් වෙත පමණක් සෘජුව ලැබී ඇත" : "This letter is directly meant for Additional Secretary"}
              </div>
              <div style={{ fontSize: "12.5px", color: "#b45309", marginTop: "3px", lineHeight: 1.4 }}>
                {lang === "si" 
                  ? "අවශ්‍ය නම්, නියෝජ්‍ය ලේකම්, විනය සහකාර ලේකම් හෝ විමර්ශන සහකාර ලේකම් වෙත උපදෙස් සමඟින් මෙය යොමු කළ හැක."
                  : "If needed, you can forward this letter to Deputy Secretary, Asst. Secretary of Discipline, or Asst. Secretary of Investigations."}
              </div>
            </div>
          </div>

          {isAddSecUser && (
            <button
              type="button"
              onClick={() => setIsForwardModalOpen(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: "7px",
                padding: "10px 18px", borderRadius: "8px",
                background: "#0f172a", color: "#ffffff",
                border: "none", fontWeight: 700, fontSize: "13px",
                cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                transition: "all 0.15s ease",
              }}
            >
              <Send size={15} />
              {lang === "si" ? "නිලධාරියෙකු වෙත යොමු කරන්න" : "Forward to Officer"}
            </button>
          )}
        </div>
      )}

      {/* ── Not Found State ── */}
      {notFound && (
        <div style={{
          background: "#fff7ed",
          border: "1px solid #fed7aa",
          borderRadius: "14px",
          padding: "48px 24px",
          textAlign: "center",
          width: "100%",
          margin: "16px 0 24px 0",
        }}>
          <AlertCircle size={44} color="#f97316" style={{ margin: "0 auto 14px auto" }} />
          <h2 style={{ margin: "0 0 8px", color: "#9a3412", fontSize: "19px", fontWeight: 700 }}>
            {lang === "si" ? "ලිපිය හමු නොවීය" : "Letter Not Found"}
          </h2>
          <p style={{ margin: "0 0 24px", color: "#c2410c", fontSize: "14px" }}>
            {lang === "si" ? `"${id}" සඳහා ලිපි වාර්තාවක් හමු නොවීය.` : `No letter record found for "${id}".`}
          </p>
          <Link href="/admin" style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            background: "#f97316", color: "#fff", padding: "10px 20px",
            borderRadius: "8px", textDecoration: "none", fontWeight: 600, fontSize: "13px",
          }}>
            <ArrowLeft size={15} />
            {lang === "si" ? "ආපසු" : "Back to Dashboard"}
          </Link>
        </div>
      )}

      {/* ── Letter Form (Matching Registration Form Layout: Image 2) ── */}
      {!notFound && letter && (
        <form onSubmit={handleSaveEditSubmit} style={{ display: "flex", flexDirection: "column", gap: "0px", width: "100%" }}>
          {/* Provenance Protection Banner if letter came from the 3 Administrative Officers */}
          {isFromAdministrativeOfficer && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              padding: "16px 20px",
              backgroundColor: "#eff6ff",
              border: "1.5px solid #93c5fd",
              borderRadius: "12px",
              color: "#1e40af",
              marginBottom: "20px",
              boxShadow: "0 2px 6px rgba(37, 99, 235, 0.08)",
            }}>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                backgroundColor: "#dbeafe",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: "#2563eb",
              }}>
                <Lock size={20} />
              </div>
              <div style={{ fontSize: "13px", lineHeight: 1.45 }}>
                <div style={{ fontWeight: 800, color: "#1d4ed8", fontSize: "14px" }}>
                  {lang === "si"
                    ? `${senderOfficerTitle} විසින් එවූ ලිපියකි — මූලික කොටස් 4 ක් ආරක්ෂිතයි`
                    : `Letter submitted by ${senderOfficerTitle} — Core 4 origin fields protected`}
                </div>
                <div style={{ color: "#3b82f6", marginTop: "2px", fontWeight: 500 }}>
                  {lang === "si"
                    ? "ලිපි අංකය, ලිපි වර්ගය, ලිපි දිනය, සහ එවූ පාර්ශවය යන කොටස් 4 මුල් නිලධාරියා විසින් තහවුරු කර ඇති බැවින් සංශෝධනය කළ නොහැක. අනු අංකය, විෂය, වර්ගීකරණය, ලද දිනය, ආයතනය, ප්‍රමුඛතාව, අතිරේක ලේකම් නියෝග සහ සටහන් ඇතුළු අනෙකුත් සියලුම කොටස් ඇතුළත් කිරීමට හෝ සංස්කරණය කිරීමට හැක."
                    : "The 4 core origin fields (Letter No, Letter Type, Letter Date, Sender) are locked. All other parts (Reference No, Subject, Classification, Received Date, Institute, Priority, Directives, Notes) can be included or modified."}
                </div>
              </div>
            </div>
          )}

          {/* ── Card 1: ලිපි යොමු තොරතුරු (Letter Reference Information) ── */}
          <div style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderLeft: "4px solid #2563eb",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "24px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)",
          }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 16px 0" }}>
              {lang === "si" ? "ලිපි යොමු තොරතුරු" : "Letter Reference Information"}
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px 24px" }}>
              {/* Serial / Ref No - Can be included or modified */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#0e162f" }}>
                    {lang === "si" ? "අනු අංකය" : "Serial / Reference No"}
                  </label>
                </div>
                <input
                  type="text"
                  value={editRefNo}
                  onChange={(e) => setEditRefNo(e.target.value)}
                  placeholder={lang === "si" ? "නිද. REF/2026/001" : "e.g. REF/2026/001"}
                  style={{
                    width: "100%", boxSizing: "border-box", backgroundColor: "#ffffff",
                    border: "1px solid #cbd5e1", borderRadius: "6px", padding: "10px 14px",
                    fontSize: "13px", fontWeight: 500, color: "#0f172a", cursor: "text",
                    height: "42px", fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Letter No - Protected Section 1 */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#0e162f" }}>
                    {lang === "si" ? "ලිපි අංකය *" : "Letter No *"}
                  </label>
                  {isProtectedOriginSection("letterNo") && (
                    <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                      <Lock size={11} /> {lang === "si" ? "ආරක්ෂිතයි" : "Locked"}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  disabled={isProtectedOriginSection("letterNo")}
                  readOnly={isProtectedOriginSection("letterNo")}
                  value={editLetterNo}
                  onChange={(e) => setEditLetterNo(e.target.value)}
                  placeholder={lang === "si" ? "නිද. DCMMS/2026/001" : "e.g. DCMMS/2026/001"}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    backgroundColor: isProtectedOriginSection("letterNo") ? "#f1f5f9" : "#ffffff",
                    border: "1px solid #cbd5e1", borderRadius: "6px", padding: "10px 14px",
                    fontSize: "13px",
                    fontWeight: isProtectedOriginSection("letterNo") ? 600 : 500,
                    color: isProtectedOriginSection("letterNo") ? "#334155" : "#0f172a",
                    cursor: isProtectedOriginSection("letterNo") ? "not-allowed" : "text",
                    height: "42px", fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Mode of Receipt / Letter Type - Protected Section 2 */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#0e162f" }}>
                    {lang === "si" ? "ලිපි වර්ගය *" : "Letter Type *"}
                  </label>
                  {isProtectedOriginSection("letterType") && (
                    <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                      <Lock size={11} /> {lang === "si" ? "ආරක්ෂිතයි" : "Locked"}
                    </span>
                  )}
                </div>
                <select
                  disabled={isProtectedOriginSection("letterType")}
                  value={editLetterType}
                  onChange={(e) => setEditLetterType(e.target.value)}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    backgroundColor: isProtectedOriginSection("letterType") ? "#f1f5f9" : "#ffffff",
                    border: "1px solid #cbd5e1", borderRadius: "6px", padding: "10px 14px",
                    fontSize: "13px",
                    fontWeight: isProtectedOriginSection("letterType") ? 600 : 500,
                    color: isProtectedOriginSection("letterType") ? "#334155" : "#0f172a",
                    cursor: isProtectedOriginSection("letterType") ? "not-allowed" : "pointer",
                    height: "42px", fontFamily: "inherit",
                  }}
                >
                  <option value="">{lang === "si" ? "ලිපි වර්ගය තෝරන්න" : "Select letter type"}</option>
                  <option value="Disciplinary">{lang === "si" ? "විනය පැමිණිල්ල (Disciplinary)" : "Disciplinary"}</option>
                  <option value="Complaint">{lang === "si" ? "පැමිණිල්ල (Complaint)" : "Complaint"}</option>
                  <option value="Inquiry">{lang === "si" ? "විමර්ශන ලිපිය (Inquiry)" : "Inquiry"}</option>
                  <option value="Appeal">{lang === "si" ? "අභියාචනා (Appeal)" : "Appeal"}</option>
                  <option value="Post">{lang === "si" ? "තැපැල් (Post)" : "Post"}</option>
                  <option value="Hand">{lang === "si" ? "අතින් ගෙනැවිත් භාරදීම (Hand)" : "Hand"}</option>
                  <option value="Email">{lang === "si" ? "විද්‍යුත් තැපෑල (Email)" : "Email"}</option>
                  <option value="Other">{lang === "si" ? "වෙනත් (Other)" : "Other"}</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Card 2: එවන පාර්ශ්වයේ තොරතුරු (Sender Details) ── */}
          <div style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderLeft: "4px solid #2563eb",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "24px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)",
          }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 16px 0" }}>
              {lang === "si" ? "එවන පාර්ශ්වයේ තොරතුරු" : "Sender Details"}
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px 24px" }}>
              {/* Sender's Party - Protected Section 4 */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#0e162f" }}>
                    {lang === "si" ? "එවූ පාර්ශවය *" : "Sender / Send By *"}
                  </label>
                  {isProtectedOriginSection("sendBy") && (
                    <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                      <Lock size={11} /> {lang === "si" ? "ආරක්ෂිතයි" : "Locked"}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  disabled={isProtectedOriginSection("sendBy")}
                  readOnly={isProtectedOriginSection("sendBy")}
                  value={editSenderName}
                  onChange={(e) => setEditSenderName(e.target.value)}
                  placeholder={lang === "si" ? "උදා: බස්නාහිර පළාත් අධ්‍යාපන දෙපාර්තමේන්තුව / විදුහල්පති / පුරවැසි නම" : "e.g. Western Province Education Dept / Principal / Citizen"}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    backgroundColor: isProtectedOriginSection("sendBy") ? "#f1f5f9" : "#ffffff",
                    border: "1px solid #cbd5e1", borderRadius: "6px", padding: "10px 14px",
                    fontSize: "13px",
                    fontWeight: isProtectedOriginSection("sendBy") ? 600 : 500,
                    color: isProtectedOriginSection("sendBy") ? "#334155" : "#0f172a",
                    cursor: isProtectedOriginSection("sendBy") ? "not-allowed" : "text",
                    height: "42px", fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Nature of the letter - Can be included or modified */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#0e162f" }}>
                    {lang === "si" ? "ලිපියේ ස්වභාවය" : "Nature of the Letter"}
                  </label>
                </div>
                <select
                  value={editRegionProvince}
                  onChange={(e) => setEditRegionProvince(e.target.value)}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    backgroundColor: "#ffffff",
                    border: "1px solid #cbd5e1", borderRadius: "6px", padding: "10px 14px",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#0f172a",
                    cursor: "pointer",
                    height: "42px", fontFamily: "inherit",
                  }}
                >
                  <option value="">{lang === "si" ? "ලිපියේ ස්වභාවය තෝරන්න" : "Select nature of letter"}</option>
                  <option value="Complaint">{lang === "si" ? "පැමිණිලි (Complaint)" : "Complaint"}</option>
                  <option value="Inquiry">{lang === "si" ? "විමර්ශන (Inquiry)" : "Inquiry"}</option>
                  <option value="Appeal">{lang === "si" ? "අභියාචනා (Appeal)" : "Appeal"}</option>
                  <option value="Request">{lang === "si" ? "ඉල්ලීම් (Request)" : "Request"}</option>
                  <option value="Notification">{lang === "si" ? "දැනුම්දීම් (Notification)" : "Notification"}</option>
                  <option value="Other">{lang === "si" ? "වෙනත් (Other)" : "Other"}</option>
                </select>
              </div>

              {/* Letter Classification - Can be included or modified */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#0e162f" }}>
                    {lang === "si" ? "ලිපි වර්ග කිරීම" : "Letter Classification"}
                  </label>
                </div>
                <select
                  value={editSubjectCategory}
                  onChange={(e) => setEditSubjectCategory(e.target.value)}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    backgroundColor: "#ffffff",
                    border: "1px solid #cbd5e1", borderRadius: "6px", padding: "10px 14px",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#0f172a",
                    cursor: "pointer",
                    height: "42px", fontFamily: "inherit",
                  }}
                >
                  <option value="">{lang === "si" ? "Select category..." : "Select category..."}</option>
                  <option value="Anonymous/Nominal">{lang === "si" ? "නිර්නාමික / නාමික (Anonymous/Nominal)" : "Anonymous/Nominal"}</option>
                  <option value="Public Service Commission">{lang === "si" ? "රාජ්‍ය සේවා කොමිෂන් සභාව" : "Public Service Commission"}</option>
                  <option value="Education Service Committee">{lang === "si" ? "අධ්‍යාපන සේවා කමිටුව" : "Education Service Committee"}</option>
                  <option value="Ministry of Public Administration">{lang === "si" ? "රාජ්‍ය පරිපාලන අමාත්‍යාංශය" : "Ministry of Public Administration"}</option>
                  <option value="Internal Branches">{lang === "si" ? "අභ්‍යන්තර අංශ (Internal Branches)" : "Internal Branches"}</option>
                  <option value="Presidential Secretariat">{lang === "si" ? "ජනාධිපති ලේකම් කාර්යාලය" : "Presidential Secretariat"}</option>
                  <option value="Ministry Minister/Secretary">{lang === "si" ? "අමාත්‍ය / ලේකම් කාර්යාලය" : "Ministry Minister/Secretary"}</option>
                  <option value="Police Stations">{lang === "si" ? "පොලිස් ස්ථාන (Police Stations)" : "Police Stations"}</option>
                  <option value="By Principals">{lang === "si" ? "විදුහල්පතිවරුන් මඟින්" : "By Principals"}</option>
                  <option value="By Zonal Offices">{lang === "si" ? "කලාප කාර්යාල මඟින්" : "By Zonal Offices"}</option>
                  <option value="Bribery Commission">{lang === "si" ? "අල්ලස් හෝ දූෂණ කොමිසම" : "Bribery Commission"}</option>
                  <option value="Human Rights">{lang === "si" ? "මානව හිමිකම් (Human Rights)" : "Human Rights"}</option>
                  <option value="Old Boys Association">{lang === "si" ? "ආදි ශිෂ්‍ය සංගම්" : "Old Boys Association"}</option>
                  <option value="Provincial Departments/Ministries">{lang === "si" ? "පළාත් දෙපාර්තමේන්තු / අමාත්‍යාංශ" : "Provincial Departments/Ministries"}</option>
                  <option value="Disciplinary">{lang === "si" ? "විනය කටයුතු (Disciplinary)" : "Disciplinary"}</option>
                  <option value="Investigation">{lang === "si" ? "විමර්ශන කටයුතු (Investigation)" : "Investigation"}</option>
                  <option value="Other">{lang === "si" ? "වෙනත් (Other)" : "Other"}</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Card 3: ලිපි විෂය සහ දින (Letter Subject & Dates) ── */}
          <div style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderLeft: "4px solid #2563eb",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "24px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)",
          }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 16px 0" }}>
              {lang === "si" ? "ලිපි විෂය සහ දින" : "Letter Subject & Dates"}
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px 24px" }}>
              {/* Subject - Can be included or modified */}
              <div style={{ gridColumn: "span 2" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#0e162f" }}>
                    {lang === "si" ? "ලිපිය අදාළ කාරණය/ මාතෘකාව *" : "Letter Subject / Matter *"}
                  </label>
                </div>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  placeholder={lang === "si" ? "නිද. විනය විරෝධී ක්‍රියා සම්බන්ධ පැමිණිල්ල" : "e.g. Complaint regarding misconduct"}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    backgroundColor: "#ffffff",
                    border: "1px solid #cbd5e1", borderRadius: "6px", padding: "10px 14px",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#0f172a",
                    cursor: "text",
                    height: "42px", fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Date Received by Additional Secretary - Can be included or modified */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#0e162f" }}>
                    {lang === "si" ? "අති.ලේ වෙත ලද දිනය *" : "Date Received by Addl. Sec *"}
                  </label>
                </div>
                <input
                  type="date"
                  value={editReceivedDate}
                  onChange={(e) => setEditReceivedDate(e.target.value)}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    backgroundColor: "#ffffff",
                    border: "1px solid #cbd5e1", borderRadius: "6px", padding: "10px 14px",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#0f172a",
                    cursor: "pointer",
                    height: "42px", fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Letter Date - Protected Section 3 */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#0e162f" }}>
                    {lang === "si" ? "ලිපි දිනය *" : "Letter Date *"}
                  </label>
                  {isProtectedOriginSection("letterDate") && (
                    <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                      <Lock size={11} /> {lang === "si" ? "ආරක්ෂිතයි" : "Locked"}
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  disabled={isProtectedOriginSection("letterDate")}
                  readOnly={isProtectedOriginSection("letterDate")}
                  value={editLetterDate}
                  onChange={(e) => setEditLetterDate(e.target.value)}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    backgroundColor: isProtectedOriginSection("letterDate") ? "#f1f5f9" : "#ffffff",
                    border: "1px solid #cbd5e1", borderRadius: "6px", padding: "10px 14px",
                    fontSize: "13px",
                    fontWeight: isProtectedOriginSection("letterDate") ? 600 : 500,
                    color: isProtectedOriginSection("letterDate") ? "#334155" : "#0f172a",
                    cursor: isProtectedOriginSection("letterDate") ? "not-allowed" : "pointer",
                    height: "42px", fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Institute Name - Can be included or modified */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#0e162f" }}>
                    {lang === "si" ? "ආයතනය / පාසල" : "Institute / School"}
                  </label>
                </div>
                <input
                  type="text"
                  value={editInstituteName}
                  onChange={(e) => setEditInstituteName(e.target.value)}
                  placeholder={lang === "si" ? "ආයතනය හෝ පාසල..." : "Institute or school name..."}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    backgroundColor: "#ffffff",
                    border: "1px solid #cbd5e1", borderRadius: "6px", padding: "10px 14px",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#0f172a",
                    cursor: "text",
                    height: "42px", fontFamily: "inherit",
                  }}
                />
              </div>
            </div>
          </div>

          {/* ── Card 4: ප්‍රමුඛතාවය (Priority) ── */}
          <div style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderLeft: "4px solid #2563eb",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "24px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)",
          }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 16px 0" }}>
              {lang === "si" ? "ප්‍රමුඛතාවය" : "Priority"}
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px 24px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "#0e162f", marginBottom: "6px" }}>
                  {lang === "si" ? "ප්‍රමුඛතාවය" : "Priority"}
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{
                    width: "12px", height: "12px", borderRadius: "50%",
                    backgroundColor: editPriority === "high" ? "#dc2626" : editPriority === "medium" ? "#f59e0b" : "#3b82f6",
                    flexShrink: 0,
                  }} />
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    style={{
                      flex: 1, boxSizing: "border-box", backgroundColor: "#ffffff",
                      border: "1px solid #cbd5e1", borderRadius: "6px", padding: "10px 14px",
                      fontSize: "13px", fontWeight: 600, color: "#0f172a", height: "42px",
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    <option value="high">{lang === "si" ? "දින 3ක් තුළ (හැකිලි වර්ණය - High Priority)" : "Within 3 days (High Priority)"}</option>
                    <option value="medium">{lang === "si" ? "දින 7ක් තුළ (සාමාන්‍ය - Medium Priority)" : "Within 7 days (Medium Priority)"}</option>
                    <option value="low">{lang === "si" ? "සාමාන්‍ය (Low Priority)" : "Normal (Low Priority)"}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* ── Card 5: අතිරේක ලේකම් උපදෙස්, අභ්‍යන්තර සටහන් සහ යොමු කිරීම් ── */}
          <div style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderLeft: "4px solid #7c3aed",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "24px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                  {lang === "si" ? "අතිරේක ලේකම් නියෝග / උපදෙස්" : "Additional Secretary Directives / Instructions"}
                </h3>
                <p style={{ margin: "3px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                  {lang === "si" ? "මෙම ලිපිය සම්බන්ධ නිල නියෝග සහ උපදෙස් මෙහි ඇතුළත් කරන්න" : "Enter official directives and instructions for this letter"}
                </p>
              </div>
              <span style={{ fontSize: "11.5px", background: "#f5f3ff", color: "#7c3aed", padding: "4px 10px", borderRadius: "6px", fontWeight: 700, border: "1px solid #ddd6fe" }}>
                {lang === "si" ? "දත්ත එක් කළ හැක" : "Can Add Data"}
              </span>
            </div>

            {/* Quick Directive Suggestions */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                {lang === "si" ? "කඩිනම් උපදෙස් තෝරන්න:" : "Quick Directives:"}
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {[
                  lang === "si" ? "විමර්ශනය කර වාර්තා කරන්න" : "For inquiry and report",
                  lang === "si" ? "විනය ක්‍රියාමාර්ග සඳහා" : "For disciplinary action",
                  lang === "si" ? "සමාලෝචනය කර නිර්දේශ ඉදිරිපත් කරන්න" : "For review and recommendations",
                  lang === "si" ? "අවශ්‍ය කඩිනම් පියවර ගන්න" : "For urgent attention and necessary action",
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setEditAddSecInstructions((prev) => (prev ? `${prev}; ${preset}` : preset));
                    }}
                    style={{
                      padding: "5px 11px",
                      fontSize: "12px",
                      fontWeight: 600,
                      backgroundColor: "#f1f5f9",
                      color: "#334155",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              {/* Instructions */}
              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "#0e162f", marginBottom: "6px" }}>
                  {lang === "si" ? "අතිරේක ලේකම් නියෝග / උපදෙස්:" : "Additional Secretary Directives / Instructions:"}
                </label>
                <textarea
                  rows={3}
                  value={editAddSecInstructions}
                  onChange={(e) => setEditAddSecInstructions(e.target.value)}
                  placeholder={lang === "si" ? "මෙම ලිපිය සම්බන්ධයෙන් ලබා දෙන නිල නියෝග හෝ උපදෙස් මෙහි සටහන් කරන්න..." : "Enter official directives or instructions..."}
                  style={{
                    width: "100%", boxSizing: "border-box", backgroundColor: "#ffffff",
                    border: "1px solid #cbd5e1", borderRadius: "6px", padding: "10px 14px",
                    fontSize: "13px", color: "#0f172a", fontFamily: "inherit", outline: "none",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Attached Document Preview (Read-only, if attached to the letter) */}
          {documentUrl && (
            <div style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderLeft: "4px solid #dc2626",
              borderRadius: "12px",
              padding: "16px 20px",
              marginBottom: "24px",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "14px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <FileText size={22} color="#dc2626" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: "13.5px", color: "#0f172a" }}>
                    {documentName || (lang === "si" ? "ලිපියේ PDF පිටපත" : "Letter Document")}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    {lang === "si" ? "අමුණා ඇති ලිපිගොනුව" : "Attached PDF document"}
                  </div>
                </div>
              </div>
              <a
                href={documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 14px",
                  borderRadius: "6px",
                  backgroundColor: "#fef2f2",
                  color: "#dc2626",
                  border: "1px solid #fecaca",
                  fontSize: "12px",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                <span>{lang === "si" ? "නව ටැබ් එකකින් බලන්න" : "Open in new tab"}</span>
                <ExternalLink size={12} />
              </a>
            </div>
          )}

          {/* ── Form Actions Bottom Bar ── */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px",
            padding: "20px 24px",
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            marginBottom: "30px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
          }}>
            <div style={{ fontSize: "13px", color: "#64748b" }}>
              {isFromAdministrativeOfficer ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#2563eb", fontWeight: 600 }}>
                  <Lock size={14} />
                  {lang === "si" ? "මුල් තොරතුරු ආරක්ෂිතයි • අමතර දත්ත එක් කර සුරැකිය හැක" : "Original data locked • Additional data can be added & saved"}
                </span>
              ) : (
                <span>{lang === "si" ? "අතිරේක ලේකම් බලතල සක්‍රීයයි" : "Additional Secretary privileges active"}</span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "10px 18px", borderRadius: "8px",
                  background: "#ffffff", border: "1px solid #cbd5e1", color: "#475569",
                  fontWeight: 600, fontSize: "13px", cursor: "pointer",
                }}
              >
                <Printer size={15} />
                {lang === "si" ? "මුද්‍රණය කරන්න" : "Print"}
              </button>

              <button
                type="button"
                onClick={() => setIsForwardModalOpen(true)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "10px 18px", borderRadius: "8px",
                  background: "#2563eb", border: "none", color: "#ffffff",
                  fontWeight: 700, fontSize: "13px", cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)",
                }}
              >
                <Send size={15} />
                {lang === "si" ? "ලිපිය යොමු කරන්න" : "Forward Letter"}
              </button>

              <button
                type="submit"
                disabled={isSavingEdit}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "7px",
                  padding: "10px 22px", borderRadius: "8px",
                  background: isSavingEdit ? "#94a3b8" : "linear-gradient(135deg, #059669 0%, #047857 100%)",
                  border: "none", color: "#ffffff",
                  fontWeight: 700, fontSize: "13px", cursor: isSavingEdit ? "not-allowed" : "pointer",
                  boxShadow: "0 2px 6px rgba(5, 150, 105, 0.3)",
                }}
              >
                <Save size={16} />
                {isSavingEdit
                  ? (lang === "si" ? "සුරකිමින්..." : "Saving...")
                  : (lang === "si" ? "වෙනස්කම් සුරකින්න" : "Save Changes")}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── Forward Letter Modal Dialog ── */}
      {isForwardModalOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "16px",
        }}>
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "540px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            border: "1px solid #e2e8f0",
          }}>
            {/* Modal Header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              borderBottom: "1px solid #e2e8f0",
              background: "linear-gradient(to right, #f8fafc, #ffffff)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  backgroundColor: "#eff6ff",
                  color: "#3b82f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Send size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                    {lang === "si" ? "ලිපිය නිලධාරියෙකු වෙත යොමු කරන්න" : "Forward Letter to Officer"}
                  </h3>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    {letterNo !== "—" ? letterNo : refNo}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsForwardModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#94a3b8",
                  padding: "4px",
                  borderRadius: "6px",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* Target Officer Selection */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1e293b", marginBottom: "8px" }}>
                  {lang === "si" ? "යොමු කරන නිලධාරියා තෝරන්න:" : "Select Recipient Officer:"}
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {KEY_ADMINISTRATIVE_OFFICERS.map((officer) => {
                    const isSelected = forwardRecipientRole === officer.role;
                    return (
                      <div
                        key={officer.role}
                        onClick={() => {
                          setForwardRecipientRole(officer.role);
                          setForwardRecipientName(officer.name);
                        }}
                        style={{
                          padding: "12px 14px",
                          borderRadius: "10px",
                          border: isSelected ? "2px solid #3b82f6" : "1.5px solid #e2e8f0",
                          backgroundColor: isSelected ? "#eff6ff" : "#ffffff",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "13.5px", color: isSelected ? "#1d4ed8" : "#1e293b" }}>
                            {lang === "si" ? officer.titleSi : lang === "ta" ? officer.titleTa : officer.titleEn}
                          </div>
                          <div style={{ fontSize: "12.5px", color: isSelected ? "#2563eb" : "#64748b", marginTop: "2px" }}>
                            {officer.name}
                          </div>
                        </div>
                        <div style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          border: isSelected ? "6px solid #3b82f6" : "2px solid #cbd5e1",
                          backgroundColor: "#ffffff",
                          flexShrink: 0,
                        }} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick Suggestion Directives */}
              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                  {lang === "si" ? "කඩිනම් උපදෙස්:" : "Quick Directives:"}
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {[
                    lang === "si" ? "විමර්ශනය කර වාර්තා කරන්න" : "For inquiry and report",
                    lang === "si" ? "විනය ක්‍රියාමාර්ග සඳහා" : "For disciplinary action",
                    lang === "si" ? "සමාලෝචනය කර නිර්දේශ ඉදිරිපත් කරන්න" : "For review and recommendations",
                    lang === "si" ? "අවශ්‍ය කඩිනම් පියවර ගන්න" : "For urgent attention and necessary action",
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setForwardReasonInput((prev) => (prev ? `${prev}; ${preset}` : preset));
                      }}
                      style={{
                        padding: "5px 10px",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        backgroundColor: "#f1f5f9",
                        color: "#334155",
                        border: "1px solid #cbd5e1",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Forwarding Reason / Directives */}
              <div>
                <label htmlFor="forwardReasonText" style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1e293b", marginBottom: "6px" }}>
                  {lang === "si" ? "උපදෙස් / යොමු කිරීමේ හේතුව:" : "Instructions / Forwarding Reason:"}
                </label>
                <textarea
                  id="forwardReasonText"
                  rows={3}
                  value={forwardReasonInput}
                  onChange={(e) => setForwardReasonInput(e.target.value)}
                  placeholder={
                    lang === "si"
                      ? "මෙම නිලධාරියා වෙත ලබා දෙන උපදෙස් හෝ යොමු කිරීමේ කරුණු මෙහි සටහන් කරන්න..."
                      : "Enter specific instructions or reason for forwarding..."
                  }
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1.5px solid #cbd5e1",
                    fontSize: "13px",
                    fontFamily: "inherit",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: "14px 20px",
              backgroundColor: "#f8fafc",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
            }}>
              <button
                type="button"
                onClick={() => setIsForwardModalOpen(false)}
                disabled={isSubmittingForward}
                style={{
                  padding: "9px 16px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#475569",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                {lang === "si" ? "අවලංගු කරන්න" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleForwardLetterSubmit}
                disabled={isSubmittingForward}
                style={{
                  padding: "9px 20px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: isSubmittingForward ? "#93c5fd" : "#2563eb",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: isSubmittingForward ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
                }}
              >
                <Send size={14} />
                {isSubmittingForward 
                  ? (lang === "si" ? "යොමු කරමින්..." : "Forwarding...") 
                  : (lang === "si" ? "තහවුරු කර යොමු කරන්න" : "Confirm & Forward")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Letter Modal for Additional Secretary ── */}
      {isEditModalOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 99999,
          padding: "16px",
        }}>
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            maxWidth: "880px",
            width: "100%",
            maxHeight: "92vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
            overflow: "hidden",
            animation: "fadeIn 0.2s ease-out",
          }}>
            {/* Modal Header */}
            <div style={{
              padding: "18px 24px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  backgroundColor: "#ecfdf5",
                  border: "1.5px solid #a7f3d0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#059669",
                  flexShrink: 0,
                }}>
                  <Edit3 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                    {lang === "si" ? "ලිපිය සංස්කරණය (අතිරේක ලේකම් බලතල)" : "Edit Letter (Additional Secretary)"}
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "#64748b" }}>
                    {lang === "si" ? `ලිපි අංකය: ${letterNo} හි ඕනෑම විස්තරයක් සංශෝධනය කර සුරකින්න.` : `Modify and save any details for Letter: ${letterNo}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  cursor: "pointer",
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form onSubmit={handleSaveEditSubmit} style={{ overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "22px" }}>
              {/* Provenance Protection Alert Banner */}
              {isFromAdministrativeOfficer && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "14px 18px",
                  backgroundColor: "#eff6ff",
                  border: "1.5px solid #93c5fd",
                  borderRadius: "12px",
                  color: "#1e40af",
                }}>
                  <div style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "8px",
                    backgroundColor: "#dbeafe",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: "#2563eb",
                  }}>
                    <Lock size={19} />
                  </div>
                  <div style={{ fontSize: "12.5px", lineHeight: 1.45 }}>
                    <div style={{ fontWeight: 800, color: "#1d4ed8", fontSize: "13px" }}>
                      {lang === "si"
                        ? `${senderOfficerTitle} විසින් එවූ ලිපියකි — මූලික කොටස් 4 ක් ආරක්ෂිතයි`
                        : `Letter submitted by ${senderOfficerTitle} — Core 4 origin fields protected`}
                    </div>
                    <div style={{ color: "#3b82f6", marginTop: "2px" }}>
                      {lang === "si"
                        ? "ලිපි අංකය, ලිපි වර්ගය, ලිපි දිනය, සහ එවූ පාර්ශවය යන කොටස් 4 සංශෝධනය කළ නොහැකි ලෙස ආරක්ෂා කර ඇත. අනු අංකය, විෂය, වර්ගීකරණය, ලද දිනය, ආයතනය, ප්‍රමුඛතාව, අතිරේක ලේකම් නියෝග සහ සටහන් ඇතුළු අනෙකුත් සියලුම කොටස් ඇතුළත් කිරීමට හෝ සංස්කරණය කිරීමට හැක."
                        : "The 4 core origin fields (Letter No, Letter Type, Letter Date, Sender) are locked. All other parts (Reference No, Subject, Classification, Received Date, Institute, Priority, Directives, Notes) can be included or modified."}
                    </div>
                  </div>
                </div>
              )}

              {/* Section 1: Identification & Priority */}
              <div style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "16px 18px",
              }}>
                <div style={{ fontSize: "12px", fontWeight: 800, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
                  {lang === "si" ? "1. ලිපි හඳුනාගැනීම සහ ප්‍රමුඛතාව" : "1. Letter Identification & Priority"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px" }}>
                      <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                        {lang === "si" ? "ලිපි අංකය (Letter No):" : "Letter No:"}
                      </label>
                      {isProtectedOriginSection("letterNo") && (
                        <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                          <Lock size={11} /> {lang === "si" ? "ආරක්ෂිතයි" : "Locked"}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={editLetterNo}
                      onChange={(e) => setEditLetterNo(e.target.value)}
                      disabled={isProtectedOriginSection("letterNo")}
                      readOnly={isProtectedOriginSection("letterNo")}
                      style={{
                        width: "100%", padding: "8px 11px", borderRadius: "8px",
                        border: isProtectedOriginSection("letterNo") ? "1.5px solid #e2e8f0" : "1.5px solid #cbd5e1",
                        fontSize: "13px", fontWeight: 600, fontFamily: "ui-monospace, monospace", boxSizing: "border-box",
                        backgroundColor: isProtectedOriginSection("letterNo") ? "#f1f5f9" : "#ffffff",
                        color: isProtectedOriginSection("letterNo") ? "#64748b" : "#0f172a",
                        cursor: isProtectedOriginSection("letterNo") ? "not-allowed" : "text",
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px" }}>
                      <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                        {lang === "si" ? "යොමු / අනුක්‍රමික අංකය (Ref / Serial No):" : "Reference / Serial No:"}
                      </label>
                    </div>
                    <input
                      type="text"
                      value={editRefNo}
                      onChange={(e) => setEditRefNo(e.target.value)}
                      style={{
                        width: "100%", padding: "8px 11px", borderRadius: "8px",
                        border: "1.5px solid #cbd5e1",
                        fontSize: "13px", fontWeight: 600, fontFamily: "ui-monospace, monospace", boxSizing: "border-box",
                        backgroundColor: "#ffffff",
                        color: "#0f172a",
                        cursor: "text",
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px" }}>
                      <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                        {lang === "si" ? "ලිපි වර්ගය (Letter Type):" : "Letter Type:"}
                      </label>
                      {isProtectedOriginSection("letterType") && (
                        <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                          <Lock size={11} /> {lang === "si" ? "ආරක්ෂිතයි" : "Locked"}
                        </span>
                      )}
                    </div>
                    <select
                      value={editLetterType}
                      onChange={(e) => setEditLetterType(e.target.value)}
                      disabled={isProtectedOriginSection("letterType")}
                      style={{
                        width: "100%", padding: "8px 11px", borderRadius: "8px",
                        border: isProtectedOriginSection("letterType") ? "1.5px solid #e2e8f0" : "1.5px solid #cbd5e1",
                        fontSize: "13px", fontWeight: 600,
                        backgroundColor: isProtectedOriginSection("letterType") ? "#f1f5f9" : "#ffffff",
                        color: isProtectedOriginSection("letterType") ? "#64748b" : "#0f172a",
                        cursor: isProtectedOriginSection("letterType") ? "not-allowed" : "pointer",
                        boxSizing: "border-box",
                      }}
                    >
                      <option value="Complaint">Disciplinary Complaint (විනය පැමිණිල්ල)</option>
                      <option value="Inquiry">Inquiry / Investigation (පරීක්ෂණ ලිපිය)</option>
                      <option value="Appeal">Appeal (අභියාචනය)</option>
                      <option value="Request">Request / Inquiry (ඉල්ලීම)</option>
                      <option value="Notification">Official Notification (දැනුම්දීම)</option>
                      <option value="Regular Letter">Regular Correspondence (සාමාන්‍ය ලිපිය)</option>
                      <option value="Answer Letter">Answer Letter (පිළිතුරු ලිපිය)</option>
                      <option value="Other">Other Document (වෙනත්)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "5px" }}>
                      {lang === "si" ? "ප්‍රමුඛතාව (Priority):" : "Priority:"}
                    </label>
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value)}
                      style={{
                        width: "100%", padding: "8px 11px", borderRadius: "8px", border: "1.5px solid #cbd5e1",
                        fontSize: "13px", fontWeight: 600, backgroundColor: "#ffffff", boxSizing: "border-box",
                      }}
                    >
                      <option value="high">High Priority (ඉහළ ප්‍රමුඛතාව)</option>
                      <option value="medium">Medium Priority (මධ්‍යම ප්‍රමුඛතාව)</option>
                      <option value="low">Low Priority (අඩු ප්‍රමුඛතාව)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Sender & Classification */}
              <div style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "16px 18px",
              }}>
                <div style={{ fontSize: "12px", fontWeight: 800, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
                  {lang === "si" ? "2. එවූ පාර්ශවය සහ වර්ගීකරණය" : "2. Sender Details & Classification"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px" }}>
                      <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                        {lang === "si" ? "ලිපිය එවූ අය / ආයතනය (Sender):" : "Sender / Party:"}
                      </label>
                      {isProtectedOriginSection("sendBy") && (
                        <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                          <Lock size={11} /> {lang === "si" ? "ආරක්ෂිතයි" : "Locked"}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={editSenderName}
                      onChange={(e) => setEditSenderName(e.target.value)}
                      disabled={isProtectedOriginSection("sendBy")}
                      readOnly={isProtectedOriginSection("sendBy")}
                      style={{
                        width: "100%", padding: "8px 11px", borderRadius: "8px",
                        border: isProtectedOriginSection("sendBy") ? "1.5px solid #e2e8f0" : "1.5px solid #cbd5e1",
                        fontSize: "13px", boxSizing: "border-box",
                        backgroundColor: isProtectedOriginSection("sendBy") ? "#f1f5f9" : "#ffffff",
                        color: isProtectedOriginSection("sendBy") ? "#64748b" : "#0f172a",
                        cursor: isProtectedOriginSection("sendBy") ? "not-allowed" : "text",
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px" }}>
                      <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                        {lang === "si" ? "ආයතනය / පාසල (Institute):" : "Institute / School:"}
                      </label>
                    </div>
                    <input
                      type="text"
                      value={editInstituteName}
                      onChange={(e) => setEditInstituteName(e.target.value)}
                      style={{
                        width: "100%", padding: "8px 11px", borderRadius: "8px",
                        border: "1.5px solid #cbd5e1",
                        fontSize: "13px", boxSizing: "border-box",
                        backgroundColor: "#ffffff",
                        color: "#0f172a",
                        cursor: "text",
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px" }}>
                      <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                        {lang === "si" ? "කලාපය / පළාත (Region/Province):" : "Region / Province:"}
                      </label>
                    </div>
                    <input
                      type="text"
                      value={editRegionProvince}
                      onChange={(e) => setEditRegionProvince(e.target.value)}
                      style={{
                        width: "100%", padding: "8px 11px", borderRadius: "8px",
                        border: "1.5px solid #cbd5e1",
                        fontSize: "13px", boxSizing: "border-box",
                        backgroundColor: "#ffffff",
                        color: "#0f172a",
                        cursor: "text",
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px" }}>
                      <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                        {lang === "si" ? "ලිපි ප්‍රවර්ගය (Classification):" : "Subject Category / Classification:"}
                      </label>
                    </div>
                    <select
                      value={editSubjectCategory}
                      onChange={(e) => setEditSubjectCategory(e.target.value)}
                      style={{
                        width: "100%", padding: "8px 11px", borderRadius: "8px",
                        border: "1.5px solid #cbd5e1",
                        fontSize: "13px",
                        backgroundColor: "#ffffff",
                        color: "#0f172a",
                        cursor: "pointer",
                        boxSizing: "border-box",
                      }}
                    >
                      <option value="">-- {lang === "si" ? "තෝරන්න" : "Select Classification"} --</option>
                      <option value="Public Service Commission">Public Service Commission (රාජ්‍ය සේවා කොමිෂන් සභාව)</option>
                      <option value="Education Service Committee">Education Service Committee (අධ්‍යාපන සේවා කමිටුව)</option>
                      <option value="Ministry of Public Administration">Ministry of Public Administration (රාජ්‍ය පරිපාලන අමාත්‍යාංශය)</option>
                      <option value="Internal Branches">Internal Branches (අභ්‍යන්තර ශාඛා)</option>
                      <option value="Presidential Secretariat">Presidential Secretariat (ජනාධිපති ලේකම් කාර්යාලය)</option>
                      <option value="Police Stations">Police Stations (පොලිස් ස්ථාන)</option>
                      <option value="By Principals">By Principals (විදුහල්පතිවරුන් විසින්)</option>
                      <option value="By Zonal Offices">By Zonal Offices (කලාප කාර්යාල මගින්)</option>
                      <option value="Bribery Commission">Bribery Commission (අල්ලස් හෝ දූෂණ කොමිසම)</option>
                      <option value="Human Rights">Human Rights (මානව හිමිකම් කොමිසම)</option>
                      <option value="Old Boys Association">Old Boys Association (ආදි ශිෂ්‍ය සංගම්)</option>
                      <option value="Provincial Departments/Ministries">Provincial Departments/Ministries (පළාත් දෙපාර්තමේන්තු)</option>
                      <option value="Anonymous/Nominal">Anonymous/Nominal (නිර්නාමික / නාමික)</option>
                      <option value="Other">Other (වෙනත්)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 3: Dates */}
              <div style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "16px 18px",
              }}>
                <div style={{ fontSize: "12px", fontWeight: 800, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
                  {lang === "si" ? "3. දිනයන්" : "3. Dates"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px" }}>
                      <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                        {lang === "si" ? "ලිපියේ දිනය (Letter Date):" : "Letter Date:"}
                      </label>
                      {isProtectedOriginSection("letterDate") && (
                        <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                          <Lock size={11} /> {lang === "si" ? "ආරක්ෂිතයි" : "Locked"}
                        </span>
                      )}
                    </div>
                    <input
                      type="date"
                      value={editLetterDate}
                      onChange={(e) => setEditLetterDate(e.target.value)}
                      disabled={isProtectedOriginSection("letterDate")}
                      readOnly={isProtectedOriginSection("letterDate")}
                      style={{
                        width: "100%", padding: "8px 11px", borderRadius: "8px",
                        border: isProtectedOriginSection("letterDate") ? "1.5px solid #e2e8f0" : "1.5px solid #cbd5e1",
                        fontSize: "13px", boxSizing: "border-box",
                        backgroundColor: isProtectedOriginSection("letterDate") ? "#f1f5f9" : "#ffffff",
                        color: isProtectedOriginSection("letterDate") ? "#64748b" : "#0f172a",
                        cursor: isProtectedOriginSection("letterDate") ? "not-allowed" : "pointer",
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px" }}>
                      <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                        {lang === "si" ? "අතිරේක ලේකම් වෙත ලැබුණු දිනය:" : "Received Date by Addl. Secretary:"}
                      </label>
                    </div>
                    <input
                      type="date"
                      value={editReceivedDate}
                      onChange={(e) => setEditReceivedDate(e.target.value)}
                      style={{
                        width: "100%", padding: "8px 11px", borderRadius: "8px",
                        border: "1.5px solid #cbd5e1",
                        fontSize: "13px", boxSizing: "border-box",
                        backgroundColor: "#ffffff",
                        color: "#0f172a",
                        cursor: "pointer",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Subject / Content */}
              <div style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "16px 18px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {lang === "si" ? "4. ලිපියේ විෂය / මාතෘකාව" : "4. Letter Subject / Title"}
                  </div>
                </div>
                <div>
                  <textarea
                    rows={3}
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    placeholder={lang === "si" ? "ලිපියේ මාතෘකාව හෝ සාරාංශය මෙහි ඇතුළත් කරන්න..." : "Enter subject or description of the letter..."}
                    style={{
                      width: "100%", padding: "10px 12px", borderRadius: "8px",
                      border: "1.5px solid #cbd5e1",
                      fontSize: "13px", fontFamily: "inherit", boxSizing: "border-box", outline: "none",
                      backgroundColor: "#ffffff",
                      color: "#0f172a",
                      cursor: "text",
                    }}
                  />
                </div>
              </div>

              {/* Section 5: Additional Secretary Directives */}
              <div style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "12px",
                padding: "16px 18px",
              }}>
                <div style={{ fontSize: "12px", fontWeight: 800, color: "#166534", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
                  {lang === "si" ? "5. අතිරේක ලේකම් නියෝග / උපදෙස්" : "5. Additional Secretary Directives / Instructions"}
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#166534", marginBottom: "5px" }}>
                    {lang === "si" ? "අතිරේක ලේකම් උපදෙස් (Directives):" : "Instructions / Directives:"}
                  </label>
                  <textarea
                    rows={3}
                    value={editAddSecInstructions}
                    onChange={(e) => setEditAddSecInstructions(e.target.value)}
                    placeholder={lang === "si" ? "අතිරේක ලේකම් ලබා දුන් නියෝග හෝ උපදෙස් මෙහි ඇතුළත් කරන්න..." : "Enter directives given by Additional Secretary..."}
                    style={{
                      width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1.5px solid #86efac",
                      fontSize: "13px", fontFamily: "inherit", backgroundColor: "#ffffff", boxSizing: "border-box", outline: "none",
                    }}
                  />
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div style={{
              padding: "16px 24px",
              backgroundColor: "#f8fafc",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
            }}>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                {letter?.last_edited_by && (
                  <span>
                    {lang === "si" ? `අවසන් සංස්කරණය: ${letter.last_edited_by}` : `Last edited: ${letter.last_edited_by}`}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isSavingEdit}
                  style={{
                    padding: "9px 18px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: "#475569",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  {lang === "si" ? "අවලංගු කරන්න" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditSubmit}
                  disabled={isSavingEdit}
                  style={{
                    padding: "9px 24px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: isSavingEdit ? "#6ee7b7" : "#059669",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: isSavingEdit ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 2px 6px rgba(5, 150, 105, 0.3)",
                  }}
                >
                  <Save size={15} />
                  {isSavingEdit 
                    ? (lang === "si" ? "සුරකිමින් පවතී..." : "Saving Changes...") 
                    : (lang === "si" ? "වෙනස්කම් සුරකින්න" : "Save Changes")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes vl-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function ViewLetterPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh", width: "100%" }}>
        <div style={{
          width: "42px", height: "42px", border: "3px solid #e2e8f0",
          borderTopColor: "#4f46e5", borderRadius: "50%", animation: "vl-spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes vl-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <ViewLetterInner />
    </Suspense>
  );
}
