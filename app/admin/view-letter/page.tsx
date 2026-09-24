"use client";

import "../../../i18n";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getCurrentProfile } from "@/lib/auth";
import { getDailyMailRecordsServer } from "@/lib/db-actions";
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

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    getCurrentProfile().then((prof) => { if (!prof) router.replace("/"); });
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
            {isAnswerLetter && (
              <span style={{ fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: "6px", background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd" }}>
                {lang === "si" ? "පිළිතුරු ලිපිය" : "Answer Letter"}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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

          <div style={{
            display: "inline-flex", alignItems: "center", gap: "7px",
            padding: "8px 16px", borderRadius: "8px",
            background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46",
            fontWeight: 700, fontSize: "13px",
          }}>
            <Eye size={16} />
            {lang === "si" ? "කියවීමට පමණි" : "Read Only"}
          </div>
        </div>
      </div>

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
            <h1 style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: 800,
              color: "#0f172a",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              letterSpacing: "-0.3px",
            }}>
              {letterNo !== "—" ? letterNo : (refNo !== "—" ? refNo : (lang === "si" ? "ලිපි විස්තර" : "Letter Details"))}
            </h1>
            <p style={{ margin: "5px 0 0 0", fontSize: "13px", color: "#64748b" }}>
              {lang === "si" ? "මෙම ලිපිය කියවීමට පමණි — සංස්කරණය කළ නොහැක" : "View-only — this letter cannot be edited"}
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

      {/* ── Letter Content Sections ── */}
      {!notFound && letter && (
        <>
          {/* 1. Core Letter Details */}
          <SectionCard title={lang === "si" ? "ලිපි විස්තර" : "Letter Information"} icon={<FileText size={16} />} accentColor="#4f46e5">
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
              gap: "22px 28px",
            }}>
              <FieldRow label={lang === "si" ? "ලිපි අංකය" : "Letter No."} value={letterNo} mono highlight />
              <FieldRow label={lang === "si" ? "යොමු අංකය" : "Reference No."} value={refNo} mono highlight />
              <FieldRow label={lang === "si" ? "ලිපි වර්ගය" : "Letter Type"} value={letterType} />
              <FieldRow label={lang === "si" ? "තත්ත්වය" : "Status"} value={status} />
              <FieldRow label={lang === "si" ? "ලිපි දිනය" : "Letter Date"} value={letterDate} />
              <FieldRow label={lang === "si" ? "ලැබුණු දිනය" : "Received Date"} value={receivedDate} />
              <div style={{ gridColumn: "span 2" }}>
                <FieldRow label={lang === "si" ? "ලිපියේ විෂය" : "Subject / Matter"} value={subject} />
              </div>
              <FieldRow label={lang === "si" ? "පිළිතුරු ලිපිය?" : "Answer Letter?"} value={isAnswerLetter ? (lang === "si" ? "ඔව්" : "Yes") : (lang === "si" ? "නැත" : "No")} />
            </div>
          </SectionCard>

          {/* 2. Sender Details */}
          <SectionCard title={lang === "si" ? "ලිපිය එවූ පාර්ශවය" : "Sender Details"} icon={<Mail size={16} />} accentColor="#0284c7">
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
              gap: "22px 28px",
            }}>
              <FieldRow label={lang === "si" ? "ලිපිය එවූ අය" : "Sender / Party"} value={senderName} />
              <FieldRow label={lang === "si" ? "ආයතනය / පාසල" : "Institute / School"} value={instituteName} />
              <FieldRow label={lang === "si" ? "කලාපය / පළාත" : "Region / Province"} value={regionProvince} />
              <FieldRow label={lang === "si" ? "ලිපි ප්‍රවර්ගය" : "Subject Category / Classification"} value={subjectCategory} />
            </div>
          </SectionCard>

          {/* 3. Routing & Assignment */}
          <SectionCard title={lang === "si" ? "යොමු කිරීම හා පැවරීම" : "Routing & Assignment"} icon={<Send size={16} />} accentColor="#059669">
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
              gap: "22px 28px",
            }}>
              <FieldRow label={lang === "si" ? "පවරන ලද නිලධාරී" : "Assigned Officer"} value={officerName} />
              <FieldRow label={lang === "si" ? "යොමු කළ නිලධාරී" : "Forwarded To"} value={forwardedTo} />
              <FieldRow label={lang === "si" ? "ලිපිය ඇතුළත් කළේ" : "Entered By"} value={createdByName} />
              <FieldRow label={lang === "si" ? "ඇතුළත් කළ නිලධාරී තනතුර" : "Entered By Role"} value={createdByRole} />
              {forwardReason && forwardReason !== "—" && (
                <div style={{
                  gridColumn: "1 / -1",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "14px 18px",
                  marginTop: "4px",
                }}>
                  <FieldRow label={lang === "si" ? "යොමු කළ හේතුව" : "Forwarding Reason"} value={forwardReason} />
                </div>
              )}
            </div>
          </SectionCard>

          {/* 4. Additional Secretary Actions */}
          {(addSecName || addSecInstructions || addSecForwardMethod || addSecNotes) && (
            <SectionCard title={lang === "si" ? "අතිරේක ලේකම් ක්‍රියාමාර්ග" : "Additional Secretary Actions"} icon={<Shield size={16} />} accentColor="#7c3aed">
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
                gap: "22px 28px",
              }}>
                {addSecName && <FieldRow label={lang === "si" ? "අතිරේක ලේකම්" : "Additional Secretary"} value={addSecName} />}
                {addSecProcessedDate !== "—" && <FieldRow label={lang === "si" ? "සකස් කළ දිනය" : "Processed Date"} value={addSecProcessedDate} />}
                {addSecForwardMethod && <FieldRow label={lang === "si" ? "යොමු ක්‍රමය" : "Forward Method"} value={addSecForwardMethod} />}
                {addSecInstructions && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <FieldRow label={lang === "si" ? "උපදෙස්" : "Instructions"} value={addSecInstructions} />
                  </div>
                )}
                {addSecNotes && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <FieldRow label={lang === "si" ? "සටහන්" : "Notes"} value={addSecNotes} />
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* 5. Document Attachment */}
          {documentUrl && (
            <SectionCard title={lang === "si" ? "ඇමිණූ ලේඛනය" : "Attached Document"} icon={<FileText size={16} />} accentColor="#dc2626">
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{
                  width: "44px", height: "44px", borderRadius: "10px",
                  background: "#fef2f2", border: "1px solid #fca5a5",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <FileText size={20} color="#dc2626" />
                </div>
                <div>
                  <p style={{ margin: "0 0 4px", fontWeight: 600, color: "#0f172a", fontSize: "14px" }}>
                    {documentName || (lang === "si" ? "ලේඛනය" : "Document")}
                  </p>
                  <a
                    href={documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "12.5px",
                      color: "#4f46e5",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    <span>{lang === "si" ? "ලේඛනය බලන්න" : "View Document"}</span>
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            </SectionCard>
          )}

          {/* ── Read-only Notice Banner ── */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "14px 18px",
            borderRadius: "10px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#15803d",
            fontSize: "13.5px",
            fontWeight: 500,
            width: "100%",
          }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span>
              {lang === "si"
                ? "මෙම ලිපියේ විස්තර කියවීමට පමණි. ලිපිය සංස්කරණය කිරීමට නිසි අධිකාරිය අවශ්‍ය වේ."
                : "This letter is displayed in read-only mode. Editing requires appropriate authorization."}
            </span>
          </div>
        </>
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
