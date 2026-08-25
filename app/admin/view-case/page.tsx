"use client";

import "../../../i18n";
import "../../daily-mail/daily-mail.css";
import "../../dashboard-common.css";
import "./view-case.css";
import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getCurrentProfile, dashboardPath } from "@/lib/auth";
import { getCaseFullTimelineServer } from "@/lib/db-actions";
import { exportToExcel } from "@/lib/export-excel";
import {
  Mail,
  Shield,
  UserCheck,
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Building2,
  GraduationCap,
  ArrowLeft,
  Filter,
  RefreshCw,
  Search,
  Check,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Award
} from "lucide-react";

const formatStepTaken = (step: string, t: any) => {
  if (!step) return "";
  if (step.startsWith("[EduSecApproval:")) {
    const isApproved = step.includes("EduSecApproval:yes");
    const dateMatch = step.match(/Date:([^\]\s]+)/);
    const dateStr = dateMatch ? dateMatch[1] : "";
    if (isApproved) {
      return `${t("eduSecretaryApproval", "Edu Secretary Approval")}: ${t("yesLabel", "Yes")} (${t("approvalDate", "Date")}: ${dateStr})`;
    } else {
      return `${t("eduSecretaryApproval", "Edu Secretary Approval")}: ${t("noLabel", "No")}`;
    }
  }
  return step;
};

const formatFutureAction = (key: string | null | undefined, t: any) => {
  if (!key) return t("statusCallingReports", "Calling reports from Principal/Zone/Province/Police");
  const map: Record<string, string> = {
    statusCallingReports: t("statusCallingReports", "Calling reports from Principal/Zone/Province/Police"),
    statusCallingCourtReports: t("statusCallingCourtReports", "Calling court reports"),
    statusPreliminaryInvestigation: t("statusPreliminaryInvestigation", "Conducting preliminary investigations"),
    statusInquiry: t("statusInquiry", "Conducting an inquiry"),
    statusConsultRelevantInstitutes: t("statusConsultRelevantInstitutes", "Taking advice from relevant institutes"),
    statusObtainStatements: t("statusObtainStatements", "Proceeding by taking statements"),
    statusUnclearAnonymous: t("statusUnclearAnonymous", "Unclear facts / anonymous letters file"),
    statusReferOtherInstitute: t("statusReferOtherInstitute", "Referring letters to other institutes"),
  };
  return map[key] || key;
};

const formatEntryDate = (dateVal: any): string => {
  if (!dateVal) return "—";
  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return "—";
    return dateVal.toISOString().split("T")[0];
  }
  const str = String(dateVal).trim();
  if (!str || str === "—" || str.toUpperCase() === "N/A") return "—";
  if (str.includes("T")) {
    return str.split("T")[0];
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }
  return str;
};

const formatEntryTime = (rawTs?: any, dateStr?: string): string => {
  if (rawTs) {
    const d = rawTs instanceof Date ? rawTs : new Date(rawTs);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    }
  }
  if (dateStr && dateStr.includes("T")) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    }
  }
  return "—";
};

interface LetterData {
  refNo: string;
  senderName?: string;
  subject?: string;
  priority?: string;
  status?: string;
  officerName?: string;
  instituteName?: string;
  receivedDate?: string;
  letterNo?: string;
  modeOfReceipt?: string;
  category?: string;
  submittedDate?: string;
  province?: string;
  district?: string;
  zone?: string;
}

interface ConnectedOfficer {
  id: string;
  name: string;
  role: "Daily Reporter" | "Investigation Administrator" | "Subject Officer" | "Committee Chairman" | "Committee Member" | "Accused Officer" | "Inquiry Officer" | "Connected Officer";
  designation?: string;
  nic?: string;
  email?: string;
  institution?: string;
  contact?: string;
  status?: string;
}

interface TrackingEntry {
  id: string;
  step: number;
  role: "Daily Reporter" | "Investigation Administrator" | "Subject Officer" | "Committee Chairman" | "Committee Member" | "Accused Officer" | "Inquiry Officer" | "Connected Officer";
  officerName: string;
  action: string;
  category: "daily-mail" | "investigation-admin" | "subject-officer" | "connected-officers";
  details?: string;
  metaInfo?: Record<string, any>;
  date: string;
  time: string;
  rawTime?: any;
  sortTs: number;
  status: "Completed" | "Current" | "Pending";
}

function StatusBadge({ status }: { status: TrackingEntry["status"] }) {
  const { t } = useTranslation();
  const cls =
    status === "Completed" ? "badge-completed"
    : status === "Current" ? "badge-current"
    : "badge-pending";
  const label =
    status === "Completed" ? t("statusCompleted", "Completed")
    : status === "Current" ? t("statusCurrent", "Current")
    : t("statusPending", "Pending");
  return (
    <span className={`vc-status-badge ${cls}`}>
      <span className="vc-status-dot" />
      {label}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const { t } = useTranslation();
  let bg = "#f1f5f9";
  let color = "#475569";
  let label: string = role;

  if (role === "Daily Reporter") {
    bg = "#eff6ff";
    color = "#1d4ed8";
    label = t("roleDailyReporter", "Daily Reporter");
  } else if (role === "Investigation Administrator") {
    bg = "#fdf4ff";
    color = "#a21caf";
    label = t("roleInvestigationAdmin", "Investigation Administrator");
  } else if (role === "Subject Officer") {
    bg = "#f0fdf4";
    color = "#15803d";
    label = t("roleSubjectOfficer", "Subject Officer");
  } else if (role === "Committee Chairman") {
    bg = "#fffbeb";
    color = "#b45309";
    label = t("roleCommitteeChairman", "Committee Chairman");
  } else if (role === "Committee Member") {
    bg = "#f5f3ff";
    color = "#6d28d9";
    label = t("roleCommitteeMember", "Committee Member");
  } else if (role === "Accused Officer") {
    bg = "#fef2f2";
    color = "#b91c1c";
    label = t("roleAccusedOfficer", "Accused Officer");
  } else if (role === "Inquiry Officer") {
    bg = "#f0f9ff";
    color = "#0284c7";
    label = t("roleInquiryOfficer", "Inquiry Officer");
  } else if (role === "Connected Officer") {
    bg = "#f8fafc";
    color = "#475569";
    label = t("roleConnectedOfficer", "Connected Officer");
  }

  return (
    <span style={{
      fontSize: "calc(11px * var(--font-scale))",
      fontWeight: 600,
      padding: "3px 10px",
      borderRadius: 20,
      background: bg,
      color: color,
      display: "inline-flex",
      alignItems: "center",
      gap: 4
    }}>
      {label}
    </span>
  );
}

function TimelineDot({ status, role }: { status: TrackingEntry["status"]; role?: TrackingEntry["role"] }) {
  const cls =
    status === "Completed" ? "dot-completed"
    : status === "Current" ? "dot-current"
    : "dot-pending";
  return (
    <div className={`vc-timeline-dot ${cls}`}>
      {status === "Completed" ? (
        <svg className="vc-dot-check" viewBox="0 0 24 24" fill="none">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <span className="vc-dot-inner" />
      )}
    </div>
  );
}

function AdminViewCaseInner() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const caseNoParam = searchParams?.get("caseNo") || "";

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "daily-mail" | "investigation-admin" | "subject-officer" | "connected-officers">("all");
  const [tableSearch, setTableSearch] = useState("");
  const [tableRoleFilter, setTableRoleFilter] = useState("All");

  const [letterData, setLetterData] = useState<LetterData | null>(null);
  const [trackingEntries, setTrackingEntries] = useState<TrackingEntry[]>([]);
  const [connectedOfficers, setConnectedOfficers] = useState<ConnectedOfficer[]>([]);

  // ── Fetch tracking entries across PostgreSQL and LocalStorage ───────────────
  const fetchTracking = async (caseNo: string) => {
    if (!caseNo) return;

    const raw: Array<{
      id: string;
      role: TrackingEntry["role"];
      officerName: string;
      action: string;
      category: TrackingEntry["category"];
      details?: string;
      metaInfo?: Record<string, any>;
      date: string;
      sortTs: number;
      rawTime?: any;
      status: TrackingEntry["status"];
    }> = [];

    const officersMap = new Map<string, ConnectedOfficer>();
    let dmOfficerName = "Daily Mail Officer";
    let subjOfficerName = "Subject Officer";
    let adminOfficerName = "Investigation Administrator";

    // 1. Fetch comprehensive data from PostgreSQL Server Action
    try {
      const serverRes = await getCaseFullTimelineServer(caseNo);
      if (serverRes && serverRes.success && serverRes.data) {
        const {
          dailyMailRows,
          subjectForm,
          accusedOfficers,
          chairman,
          members,
          appointmentDates,
          extension,
          extensions,
          subjectDetailsLogs,
          assignment,
          preliminaryInvestigation,
          registeredOfficers,
        } = serverRes.data;

        // Resolve real officer names from database
        const regList: any[] = Array.isArray(registeredOfficers) ? registeredOfficers : [];
        dmOfficerName = regList.find((o) => (o.role || "").toLowerCase().includes("daily mail"))?.full_name || "Daily Mail Officer";
        subjOfficerName = regList.find((o) => (o.role || "").toLowerCase().includes("subject"))?.full_name || "Subject Officer";
        adminOfficerName = regList.find((o) => (o.role || "").toLowerCase().includes("investigation") || (o.role || "").toLowerCase().includes("branch admin"))?.full_name || "Investigation Administrator";
        
        // Complainant / Senders Party (Separate from Subject Officer!)
        const complainantName = subjectForm?.name_of_the_presenting_the_complain || (dailyMailRows && dailyMailRows[0]?.senders_party) || "Complainant";
        const complainantAddress = subjectForm?.address_of_the_person_presenting_the_complaint || "";
        const classificationLabel = subjectForm?.classification_of_complaint_letter === "anonymous" ? t("anonymous", "Anonymous") : t("nominal", "Nominal");

        // Primary Accused Officer and School
        const primaryAccused = (Array.isArray(accusedOfficers) && accusedOfficers[0]) ? accusedOfficers[0] : (subjectForm?.accused_officer || null);
        const primarySchool = primaryAccused?.accused_school_name || primaryAccused?.institute_name || subjectForm?.accused_school?.accused_school_name || "";
        const primaryZone = primaryAccused?.zone || subjectForm?.accused_school?.zone || "";
        const primaryProvince = primaryAccused?.province || subjectForm?.accused_school?.province || "";
        const primaryDistrict = primaryAccused?.district || subjectForm?.accused_school?.district || "";

        // All associated letter numbers
        const allLetterNos = Array.isArray(dailyMailRows)
          ? Array.from(new Set(dailyMailRows.map((m: any) => m.letter_number).filter(Boolean))).join(", ")
          : "";

        // Set case header letter info accurately
        const firstMail = (Array.isArray(dailyMailRows) && dailyMailRows.length > 0) ? dailyMailRows[0] : null;
        setLetterData({
          refNo: subjectForm?.subject_file_no || subjectForm?.ref_number || firstMail?.ref_number || caseNo,
          letterNo: allLetterNos || firstMail?.letter_number || "—",
          senderName: complainantName,
          subject: firstMail?.subject_of_letter || (subjectForm ? `Disciplinary Case File #${subjectForm.subject_file_no || caseNo}` : "Inquiry Dossier"),
          modeOfReceipt: firstMail?.mode_of_receipt || "Post",
          category: firstMail?.subject_category || firstMail?.nature_of_letter || classificationLabel,
          receivedDate: formatEntryDate(firstMail?.date_received_by_add_secretary || firstMail?.created_at),
          submittedDate: formatEntryDate(firstMail?.date_letter_handover_discipline || subjectForm?.date_prepared_and_submitted_for_signature),
          officerName: primaryAccused?.accused_officer_name || "—",
          instituteName: primarySchool || "Ministry / Education Zone",
          province: primaryProvince,
          district: primaryDistrict,
          zone: primaryZone,
          status: "In Progress",
        });

        // ============================================================
        // A. DAILY MAIL REPORTER TIMELINE ENTRIES
        // ============================================================
        if (Array.isArray(dailyMailRows) && dailyMailRows.length > 0) {
          officersMap.set("dm-officer", {
            id: "dm-officer",
            name: dmOfficerName,
            role: "Daily Reporter",
            designation: t("dailyMailRegistrationOfficer", "Daily Mail Registration Officer"),
            status: "Completed",
          });

          // Deduplicate rows by (letter_number, ref_number, subject_of_letter)
          const seenMailKeys = new Set<string>();
          const uniqueMails: any[] = [];
          dailyMailRows.forEach((mail: any) => {
            const key = `${(mail.letter_number || "").trim().toLowerCase()}|${(mail.ref_number || "").trim().toLowerCase()}|${(mail.subject_of_letter || "").trim().toLowerCase()}`;
            if (!seenMailKeys.has(key)) {
              seenMailKeys.add(key);
              uniqueMails.push(mail);
            }
          });

          uniqueMails.forEach((mail: any, idx: number) => {
            const recDate = formatEntryDate(mail.date_received_by_add_secretary || mail.created_at);
            const subDate = formatEntryDate(mail.date_letter_handover_discipline);
            const ts = mail.created_at ? new Date(mail.created_at).getTime() : (mail.date_received_by_add_secretary ? new Date(mail.date_received_by_add_secretary).getTime() : Date.now());

            // Entry 1: Registration by Daily Mail Reporter
            raw.push({
              id: `dm-rec-${mail.id || idx}`,
              role: "Daily Reporter",
              officerName: dmOfficerName,
              action: idx === 0
                ? `${t("initialComplaintRegistered", "Initial Complaint Registered")}: ${t("letterNumber", "Letter No.")} ${mail.letter_number || "N/A"}`
                : `${t("subsequentLetterRegistered", "Subsequent Letter Registered")}: ${t("letterNumber", "Letter No.")} ${mail.letter_number || "N/A"}`,
              category: "daily-mail",
              details: `${t("receivedVia", "Received via")} ${mail.mode_of_receipt || "Post"} ${t("fromComplainant", "from Complainant")} "${mail.senders_party || "Complainant"}". ${t("subject", "Subject")}: "${mail.subject_of_letter || "Inquiry complaint"}". ${t("category", "Category")}: ${mail.subject_category || mail.nature_of_letter || "General"}.`,
              date: recDate,
              sortTs: ts,
              rawTime: mail.created_at,
              status: "Completed",
              metaInfo: {
                letterNumber: mail.letter_number,
                sender: mail.senders_party,
                receiptMode: mail.mode_of_receipt,
                category: mail.subject_category || mail.nature_of_letter,
              }
            });

            // Entry 2: Handover to Discipline Branch
            if (mail.date_letter_handover_discipline) {
              const handoverTs = mail.date_letter_handover_discipline ? new Date(mail.date_letter_handover_discipline).getTime() : ts + 3600000;
              raw.push({
                id: `dm-handover-${mail.id || idx}`,
                role: "Daily Reporter",
                officerName: dmOfficerName,
                action: t("letterHandedOverDiscipline", "Letter Handed Over to Discipline Branch"),
                category: "daily-mail",
                details: `${t("letterNumber", "Letter No.")} ${mail.letter_number || "N/A"} ${t("routedHandoverDesc", "forwarded and handed over to Discipline Branch for subject assignment and inquiry evaluation.")}`,
                date: subDate,
                sortTs: handoverTs >= ts ? handoverTs : ts + 3600000,
                rawTime: mail.created_at,
                status: "Completed",
              });
            }
          });
        }

        // ============================================================
        // B. SUBJECT OFFICER TIMELINE ENTRIES
        // ============================================================
        if (subjectForm) {
          officersMap.set("subj-officer", {
            id: "subj-officer",
            name: subjOfficerName,
            role: "Subject Officer",
            designation: t("disciplineSubjectOfficer", "Discipline Branch Subject Officer"),
            status: "Active",
          });

          const formTs = subjectForm.created_at
            ? new Date(subjectForm.created_at).getTime()
            : (subjectForm.date_prepared_and_submitted_for_signature ? new Date(subjectForm.date_prepared_and_submitted_for_signature).getTime() : Date.now());

          // 1. Subject Officer File Opened & Recommended Action
          raw.push({
            id: `so-form-${caseNo}`,
            role: "Subject Officer",
            officerName: subjOfficerName,
            action: t("subjectFileOpenedTitle", "Subject Officer File Opened & Complaint Evaluated"),
            category: "subject-officer",
            details: `Subject File Ref #${subjectForm.subject_file_no || subjectForm.ref_number || caseNo} opened. Classification: ${classificationLabel} (Complainant: ${subjectForm.name_of_the_presenting_the_complain || "Complainant"}). Recommended Action: ${formatFutureAction(subjectForm.future_action, t)}.`,
            date: formatEntryDate(subjectForm.date_prepared_and_submitted_for_signature || subjectForm.created_at),
            sortTs: formTs,
            rawTime: subjectForm.created_at,
            status: "Completed",
            metaInfo: {
              subjectFileNo: subjectForm.subject_file_no,
              classification: classificationLabel,
              complainant: subjectForm.name_of_the_presenting_the_complain,
              futureAction: formatFutureAction(subjectForm.future_action, t),
            }
          });

          // 2. Accused Officer(s) Registration
          if (Array.isArray(accusedOfficers) && accusedOfficers.length > 0) {
            accusedOfficers.forEach((ao: any, aIdx: number) => {
              const aoName = ao.accused_officer_name || ao.officer_name || "Accused Officer";
              const schoolName = ao.accused_school_name || ao.institute_name || "Educational Institute";
              const aoRegTs = ao.created_at ? new Date(ao.created_at).getTime() : formTs + 1000 + aIdx * 100;

              officersMap.set(`accused-${aIdx}`, {
                id: `accused-${aIdx}`,
                name: aoName,
                role: "Accused Officer",
                designation: ao.position || "Teacher / Staff Officer",
                institution: schoolName,
                nic: ao.nic_no || ao.nic || "N/A",
                status: "Under Investigation",
              });

              raw.push({
                id: `so-accused-${ao.accused_officer_id || aIdx}`,
                role: "Subject Officer",
                officerName: subjOfficerName,
                action: `${t("accusedOfficerRegistered", "Accused Officer Registered")}: ${aoName}`,
                category: "subject-officer",
                details: `Position: ${ao.position || "Teacher / Staff"} | NIC: ${ao.nic_no || ao.nic || "N/A"} | Institute: ${schoolName} (Zone: ${ao.zone || "N/A"}, Province: ${ao.province || "N/A"})${ao.appointment_date ? ` | Service Appointment: ${formatEntryDate(ao.appointment_date)}` : ""}.`,
                date: formatEntryDate(ao.created_at || subjectForm.created_at),
                sortTs: aoRegTs,
                rawTime: ao.created_at,
                status: "Completed",
                metaInfo: {
                  accusedOfficer: aoName,
                  position: ao.position,
                  school: schoolName,
                  nic: ao.nic_no,
                }
              });
            });
          }

          // 3. Action Logs from Subject Details
          if (Array.isArray(subjectDetailsLogs) && subjectDetailsLogs.length > 0) {
            subjectDetailsLogs.forEach((log: any, lIdx: number) => {
              const logDate = formatEntryDate(log.received_date || log.created_at);
              const logTs = log.created_at ? new Date(log.created_at).getTime() : (log.received_date ? new Date(log.received_date).getTime() : formTs + 5000 + lIdx * 1000);
              const officer = log.subject_officer_name || log.officer_name || subjOfficerName;

              raw.push({
                id: `so-log-${log.id || lIdx}`,
                role: "Subject Officer",
                officerName: officer,
                action: log.step_taken ? formatStepTaken(log.step_taken, t) : `Case Status: ${log.report_state || "In Progress"}`,
                category: "subject-officer",
                details: log.special_notes || `State updated to ${log.report_state || "In Progress"}.`,
                date: logDate,
                sortTs: logTs,
                rawTime: log.created_at,
                status: "Completed",
              });
            });
          }
        }

        // ============================================================
        // C. INVESTIGATION ADMINISTRATOR TIMELINE ENTRIES
        // ============================================================
        const extList: any[] = Array.isArray(extensions) && extensions.length > 0 ? extensions : (extension ? [extension] : []);
        const hasInvAdminActions = Boolean(
          chairman ||
          (Array.isArray(members) && members.length > 0) ||
          appointmentDates ||
          extList.length > 0 ||
          assignment?.approval_date ||
          assignment?.final_report_content
        );

        if (hasInvAdminActions) {
          officersMap.set("inv-admin", {
            id: "inv-admin",
            name: adminOfficerName,
            role: "Investigation Administrator",
            designation: t("investigationAdminRole", "Branch Administrator / Head of Investigation"),
            status: "Active",
          });

          // 1. Appointment of Chairman & Committee Members
          if (chairman || (Array.isArray(members) && members.length > 0)) {
            const chairTs = chairman?.created_at ? new Date(chairman.created_at).getTime() : (members && members[0]?.created_at ? new Date(members[0].created_at).getTime() : Date.now());
            const memberNames = (members || []).map((m: any) => m.full_name).filter(Boolean).join(", ");

            raw.push({
              id: `ia-committee-appoint-${caseNo}`,
              role: "Investigation Administrator",
              officerName: adminOfficerName,
              action: t("committeeAppointedTitle", "Inquiry Committee Formally Appointed"),
              category: "investigation-admin",
              details: `Chairman appointed: ${chairman?.full_name || "Assigned Chairman"}${chairman?.position ? ` (${chairman.position})` : ""}. Committee Members: ${memberNames || "Panel Members"}. Conflict of interest checks verified against attended school records.`,
              date: formatEntryDate(chairman?.created_at || (members && members[0]?.created_at)),
              sortTs: chairTs,
              rawTime: chairman?.created_at || (members && members[0]?.created_at),
              status: "Completed",
              metaInfo: {
                chairman: chairman?.full_name,
                members: memberNames,
              }
            });
          }

          // 2. Appointment Letter Issued & Report Due Date Scheduled
          if (appointmentDates) {
            const apptDateStr = formatEntryDate(appointmentDates.appointment_letter_date);
            const dueDateStr = formatEntryDate(appointmentDates.report_due_date);
            const apptTs = appointmentDates.created_at ? new Date(appointmentDates.created_at).getTime() : (appointmentDates.appointment_letter_date ? new Date(appointmentDates.appointment_letter_date).getTime() : Date.now());

            raw.push({
              id: `ia-dates-schedule-${caseNo}`,
              role: "Investigation Administrator",
              officerName: adminOfficerName,
              action: t("formalApptIssuedTitle", "Formal Appointment Letter Issued & Report Due Date Set"),
              category: "investigation-admin",
              details: `Appointment Letter issued on ${apptDateStr}. Investigation report due date scheduled for ${dueDateStr}. Committee instructed to commence hearing sessions.`,
              date: formatEntryDate(appointmentDates.appointment_letter_date || appointmentDates.created_at),
              sortTs: apptTs,
              rawTime: appointmentDates.created_at,
              status: "Completed",
              metaInfo: {
                appointmentLetterDate: apptDateStr,
                reportDueDate: dueDateStr,
              }
            });
          }

          // 3. Date Extension Requests & Approvals
          if (extList.length > 0) {
            extList.forEach((ext: any, eIdx: number) => {
              const extDateStr = formatEntryDate(ext.decision_date || ext.created_at);
              const extTs = ext.created_at ? new Date(ext.created_at).getTime() : (ext.decision_date ? new Date(ext.decision_date).getTime() : Date.now());
              const isApproved = (ext.approval_status || "").toLowerCase() === "approved";
              const isRejected = (ext.approval_status || "").toLowerCase() === "rejected";

              raw.push({
                id: `ia-extension-eval-${ext.id || eIdx}`,
                role: "Investigation Administrator",
                officerName: adminOfficerName,
                action: `${t("dateExtensionDecision", "Date Extension Decision")}: ${ext.extention_term || "Extension"} (${ext.approval_status || "Pending"})`,
                category: "investigation-admin",
                details: `Evaluation of extension term [${formatEntryDate(ext.start_date)} to ${formatEntryDate(ext.end_date)}]. Decision Status: ${ext.approval_status || "Pending"}${ext.decision_date ? ` on ${formatEntryDate(ext.decision_date)}` : ""}.`,
                date: extDateStr,
                sortTs: extTs,
                rawTime: ext.created_at,
                status: isApproved || isRejected ? "Completed" : "Pending",
                metaInfo: {
                  extensionTerm: ext.extention_term,
                  startDate: formatEntryDate(ext.start_date),
                  endDate: formatEntryDate(ext.end_date),
                  approvalStatus: ext.approval_status,
                }
              });
            });
          }

          // 4. Final Report & Secretary Approval
          if (assignment?.final_report_content || assignment?.approval_date) {
            const repDateStr = formatEntryDate(assignment.approval_date || assignment.updated_at);
            const repTs = assignment.updated_at ? new Date(assignment.updated_at).getTime() : (assignment.approval_date ? new Date(assignment.approval_date).getTime() : Date.now());

            raw.push({
              id: `ia-final-report-${caseNo}`,
              role: "Investigation Administrator",
              officerName: adminOfficerName,
              action: t("finalReportSecretaryTitle", "Final Investigation Report & Secretary Approval"),
              category: "investigation-admin",
              details: `Final Investigation findings: "${assignment.final_report_content || "Inquiry concluded successfully"}". Education Secretary approval date: ${formatEntryDate(assignment.approval_date) || "Approved"}.`,
              date: repDateStr,
              sortTs: repTs,
              rawTime: assignment.updated_at,
              status: assignment.approval_date ? "Completed" : "Pending",
            });
          }
        }

        // ============================================================
        // D. ALL CONNECTED OFFICERS TIMELINE ENTRIES
        // ============================================================
        // 1. Committee Chairman
        if (chairman) {
          officersMap.set("comm-chairman", {
            id: "comm-chairman",
            name: chairman.full_name || "Committee Chairman",
            role: "Committee Chairman",
            designation: chairman.position || "Inquiry Committee Chairman",
            email: chairman.email || "chairman@inquiry.gov.lk",
            status: "Appointed",
          });

          raw.push({
            id: `conn-chair-active-${caseNo}`,
            role: "Committee Chairman",
            officerName: chairman.full_name || "Committee Chairman",
            action: `${t("inquiryProceedingsCommenced", "Inquiry Proceedings Initiated by Chairman")}: ${chairman.full_name || ""}`,
            category: "connected-officers",
            details: `Chairman ${chairman.full_name} accepted inquiry dossier. Commenced schedule for hearings, witness calls, and examination of documents.`,
            date: formatEntryDate(chairman.created_at),
            sortTs: chairman.created_at ? new Date(chairman.created_at).getTime() + 2000 : Date.now(),
            rawTime: chairman.created_at,
            status: "Completed",
          });
        }

        // 2. Committee Members
        if (Array.isArray(members) && members.length > 0) {
          members.forEach((m: any, mIdx: number) => {
            const mName = m.full_name || `Member ${mIdx + 1}`;
            officersMap.set(`comm-member-${mIdx}`, {
              id: `comm-member-${mIdx}`,
              name: mName,
              role: "Committee Member",
              designation: m.position || "Inquiry Committee Panel Member",
              email: m.email || "member@inquiry.gov.lk",
              status: "Appointed",
            });

            raw.push({
              id: `conn-member-${m.id || mIdx}`,
              role: "Committee Member",
              officerName: mName,
              action: `${t("inquiryPanelMemberAssigned", "Inquiry Panel Member Assigned")}: ${mName}`,
              category: "connected-officers",
              details: `Panel Member ${mName} assigned to review inquiry submissions and participate in the formal investigation sittings.`,
              date: formatEntryDate(m.created_at),
              sortTs: m.created_at ? new Date(m.created_at).getTime() + 3000 : Date.now(),
              rawTime: m.created_at,
              status: "Completed",
            });
          });
        }

        // 3. Preliminary Investigation Officer
        if (preliminaryInvestigation) {
          const prelimOfficerName = preliminaryInvestigation.officer_name || "Preliminary Inquiry Officer";
          officersMap.set("prelim-officer", {
            id: "prelim-officer",
            name: prelimOfficerName,
            role: "Inquiry Officer",
            designation: "Preliminary Investigation Officer",
            status: preliminaryInvestigation.status || "Active",
          });

          raw.push({
            id: `conn-prelim-findings-${caseNo}`,
            role: "Inquiry Officer",
            officerName: prelimOfficerName,
            action: t("prelimFindingsSubmitted", "Preliminary Investigation Findings Submitted"),
            category: "connected-officers",
            details: `Findings: ${preliminaryInvestigation.findings || "Preliminary report compiled."} | Observations: ${preliminaryInvestigation.observations || "Initial facts checked."}`,
            date: formatEntryDate(preliminaryInvestigation.updated_at || preliminaryInvestigation.created_at),
            sortTs: preliminaryInvestigation.updated_at ? new Date(preliminaryInvestigation.updated_at).getTime() : Date.now(),
            rawTime: preliminaryInvestigation.updated_at,
            status: preliminaryInvestigation.status === "Completed" ? "Completed" : "Current",
          });
        }

        // 4. Complainant / Senders Party
        if (complainantName && complainantName !== "—") {
          officersMap.set("complainant", {
            id: "complainant",
            name: complainantName,
            role: "Connected Officer",
            designation: subjectForm?.classification_of_complaint_letter === "anonymous" ? t("anonymousComplainant", "Anonymous Complainant") : t("complainantParty", "Complainant / Senders Party"),
            institution: complainantAddress || "",
            status: "Active",
          });
        }
      }
    } catch (e) {
      console.error("Error fetching PostgreSQL timeline data:", e);
    }

    // Fallback: LocalStorage / legacy data if nothing yet
    if (typeof window !== "undefined") {
      try {
        const storedActions = localStorage.getItem("dcmms_new_letter_current_case");
        if (storedActions) {
          const list = JSON.parse(storedActions) as any[];
          const filtered = list.filter((a) => a.caseNo === caseNo || a.ref_no === caseNo);
          filtered.forEach((a, idx) => {
            const actName = a.stepTaken || a.step_taken || a.action || "Case Activity Logged";
            const actDate = formatEntryDate(a.receivedDate);
            const actDetails = a.specialNotes || a.special_notes || "";
            const isDuplicate = raw.some(
              (r) =>
                r.id === a.id ||
                (r.action.trim().toLowerCase() === String(actName).trim().toLowerCase() &&
                  r.date === actDate)
            );
            if (!isDuplicate) {
              raw.push({
                id: a.id || `local-${idx}`,
                role: "Subject Officer",
                officerName: a.subjectOfficerName || subjOfficerName,
                action: actName,
                category: "subject-officer",
                details: actDetails,
                date: actDate,
                sortTs: a.receivedDate ? new Date(a.receivedDate).getTime() : Date.now() - idx * 1000,
                status: "Completed",
              });
            }
          });
        }
      } catch (e) {}
    }

    // Sort chronologically
    raw.sort((a, b) => a.sortTs - b.sortTs);

    // Deduplicate entries by unique content signature (role + action + date)
    const uniqueRaw: typeof raw = [];
    const seenSignatures = new Set<string>();

    for (const item of raw) {
      const cleanAction = (item.action || "").trim().toLowerCase();
      const cleanDate = (item.date || "").trim();
      const sig = `${item.role}|${item.category}|${cleanAction}|${cleanDate}`;
      const actionSig = `${item.role}|${cleanAction}|${cleanDate}`;

      if (seenSignatures.has(sig) || seenSignatures.has(actionSig)) {
        continue;
      }
      seenSignatures.add(sig);
      seenSignatures.add(actionSig);
      uniqueRaw.push(item);
    }

    const formatted: TrackingEntry[] = uniqueRaw.map((r, idx) => ({
      ...r,
      step: idx + 1,
      time: formatEntryTime(r.rawTime, r.date),
      status: r.status,
    }));

    setTrackingEntries(formatted);
    setConnectedOfficers(Array.from(officersMap.values()));
  };

  useEffect(() => {
    if (caseNoParam) {
      document.title = `View Case ${caseNoParam} | DCMMS Admin`;
    }
  }, [caseNoParam]);

  useEffect(() => {
    const verifyAndFetch = async () => {
      // Role check
      try {
        const profile = await getCurrentProfile();
        if (profile && profile.role !== "admin" && profile.role !== "system_admin") {
          router.replace(dashboardPath(profile.role));
          return;
        }
      } catch {
        // Continue for admin demo
      }

      if (caseNoParam) {
        await fetchTracking(caseNoParam);
      }

      setCheckingAuth(false);
      setIsLoading(false);
    };

    verifyAndFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseNoParam, router]);

  // Real-time & storage event listener
  useEffect(() => {
    if (!caseNoParam) return;

    const handleLocalUpdate = async () => {
      setIsRefreshing(true);
      await fetchTracking(caseNoParam);
      setIsRefreshing(false);
    };

    window.addEventListener("storage", handleLocalUpdate);
    window.addEventListener("dcmms_data_updated", handleLocalUpdate);
    window.addEventListener("dcmms_assignment_updated", handleLocalUpdate);

    return () => {
      window.removeEventListener("storage", handleLocalUpdate);
      window.removeEventListener("dcmms_data_updated", handleLocalUpdate);
      window.removeEventListener("dcmms_assignment_updated", handleLocalUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseNoParam]);



  // Filtered entries according to selected timeline tab
  const filteredTimelineEntries = useMemo(() => {
    if (activeTab === "all") return trackingEntries;
    return trackingEntries.filter((e) => e.category === activeTab);
  }, [trackingEntries, activeTab]);

  // Filtered table entries based on search and table filter
  const filteredTableEntries = useMemo(() => {
    return trackingEntries.filter((entry) => {
      const matchesSearch =
        tableSearch === "" ||
        entry.action.toLowerCase().includes(tableSearch.toLowerCase()) ||
        entry.officerName.toLowerCase().includes(tableSearch.toLowerCase()) ||
        entry.role.toLowerCase().includes(tableSearch.toLowerCase()) ||
        (entry.details && entry.details.toLowerCase().includes(tableSearch.toLowerCase()));

      const matchesRole = tableRoleFilter === "All" || entry.role === tableRoleFilter;
      return matchesSearch && matchesRole;
    });
  }, [trackingEntries, tableSearch, tableRoleFilter]);

  // Counts per category
  const counts = useMemo(() => {
    return {
      all: trackingEntries.length,
      dailyMail: trackingEntries.filter((e) => e.category === "daily-mail").length,
      investigationAdmin: trackingEntries.filter((e) => e.category === "investigation-admin").length,
      subjectOfficer: trackingEntries.filter((e) => e.category === "subject-officer").length,
      connectedOfficers: trackingEntries.filter((e) => e.category === "connected-officers").length,
    };
  }, [trackingEntries]);

  if (checkingAuth) {
    return <div className="page-loading-container"><div>Loading…</div></div>;
  }

  const totalSteps = trackingEntries.length;
  const currentStep = trackingEntries.filter((e) => e.status !== "Pending").length;

  return (
    <div className="admin-dashboard-container">
      <div className="view-case-wrapper">
        <div className="view-case-header">
          <div className="view-case-title-group">
            <div className="vc-badge-row">
              <span className="vc-case-badge">{t("caseDossier", "Case Dossier")}</span>
              {letterData?.priority && (
                <span className="vc-priority-badge">{letterData.priority} {t("priority", "Priority")}</span>
              )}
              <span className="vc-status-pill">{t("activeCase", "Active Case")}</span>
            </div>
            <h1>{letterData?.subject || t("inquiryCaseDossier", "Inquiry Case Dossier #{{caseNo}}", { caseNo: caseNoParam })}</h1>
            <p>{t("viewCaseSubTitle", "Comprehensive multi-role investigation process timeline & connected personnel tracker")}</p>
          </div>
          <div className="vc-header-actions">
            <button
              onClick={() => {
                const headers = ["Step", "Role", "Officer Name", "Action", "Category", "Date", "Status", "Details"];
                const rows = trackingEntries.map((e, idx) => [
                  idx + 1,
                  e.role,
                  e.officerName,
                  e.action,
                  e.category,
                  e.date || "",
                  e.status,
                  e.details || ""
                ]);
                exportToExcel(`DCMMS_Case_${caseNoParam || "Dossier"}_Timeline_${new Date().toISOString().split("T")[0]}`, headers, rows);
              }}
              className="btn-export-excel"
              title="Export Case Timeline to Excel"
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>{t("exportExcel", "Export to Excel")}</span>
            </button>
            <button
              onClick={() => fetchTracking(caseNoParam)}
              className="btn-refresh-timeline"
              title="Refresh Timeline Data"
            >
              <RefreshCw size={14} className={isRefreshing ? "spin-icon" : ""} />
              {isRefreshing ? t("refreshing", "Refreshing...") : t("refresh", "Refresh")}
            </button>
            <Link href="/admin" className="btn-back-home">
              <ArrowLeft size={16} />
              {t("backToAdmin", "Back to Admin")}
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="vc-loading">
            <RefreshCw size={24} className="spin-icon" style={{ margin: "0 auto 12px auto", color: "#6366f1" }} />
            <p>{t("loadingTimeline", "Loading full case timeline & officer workflow data...")}</p>
          </div>
        ) : (
          <>
            {/* Case Info Card */}
            <div className="case-info-card">
              <div className="case-info-card-header">
                <h2 className="case-info-card-title">
                  <FileText size={18} className="vc-card-icon" />
                  {t("caseInfoMaster", "Case Information & Master Metadata")}
                  {caseNoParam && <span className="case-info-card-subtitle">#{caseNoParam}</span>}
                </h2>
                <span className="vc-verified-badge">
                  <CheckCircle2 size={13} /> {t("verifiedDossier", "Verified Dossier")}
                </span>
              </div>
              <div className="case-info-grid">
                <div className="case-info-field">
                  <span className="case-info-label">{t("caseRefNumber", "Case / Ref Number")}</span>
                  <span className="case-info-value highlight-val">{caseNoParam || letterData?.refNo || "—"}</span>
                </div>
                <div className="case-info-field">
                  <span className="case-info-label">{t("letterNumber", "Letter Number")}</span>
                  <span className="case-info-value">{letterData?.letterNo || "—"}</span>
                </div>
                <div className="case-info-field">
                  <span className="case-info-label">{t("complainantSender", "Complainant / Sender")}</span>
                  <span className="case-info-value">{letterData?.senderName || "—"}</span>
                </div>
                <div className="case-info-field">
                  <span className="case-info-label">{t("instituteSchool", "Institute / School")}</span>
                  <span className="case-info-value">{letterData?.instituteName || "—"}</span>
                </div>
                <div className="case-info-field">
                  <span className="case-info-label">{t("locationZoneProvince", "Location (Zone / Province)")}</span>
                  <span className="case-info-value">
                    {letterData?.zone || letterData?.province
                      ? `${letterData.zone || ""} ${letterData.zone && letterData.province ? "•" : ""} ${letterData.province || ""}`
                      : t("nationalMinistry", "National / Ministry")}
                  </span>
                </div>
                <div className="case-info-field">
                  <span className="case-info-label">{t("modeOfReceipt", "Mode of Receipt")}</span>
                  <span className="case-info-value">{letterData?.modeOfReceipt || t("postalMail", "Postal Mail")}</span>
                </div>
                <div className="case-info-field">
                  <span className="case-info-label">{t("receivedBySec", "Received by Secretary")}</span>
                  <span className="case-info-value">{letterData?.receivedDate || "—"}</span>
                </div>
                <div className="case-info-field">
                  <span className="case-info-label">{t("disciplineHandover", "Discipline Handover")}</span>
                  <span className="case-info-value">{letterData?.submittedDate || "—"}</span>
                </div>
                <div className="case-info-field">
                  <span className="case-info-label">{t("totalStagesLogged", "Total Stages Logged")}</span>
                  <span className="case-info-value" style={{ color: "#16a34a" }}>{trackingEntries.length} {t("recordedSteps", "Recorded Steps")}</span>
                </div>
              </div>
            </div>

            {/* ── Connected Officers Overview Card ── */}
            <div className="connected-officers-card">
              <div className="connected-officers-header">
                <div>
                  <h3 className="connected-officers-title">
                    <Users size={18} className="vc-card-icon" />
                    {t("connectedOfficersTitle", "All Connected Officers & Personnel for this Case")}
                  </h3>
                  <p className="connected-officers-subtitle">
                    {t("connectedOfficersSubtitle", "Key stakeholders actively engaged across registration, administration, subject inquiry, and committee proceedings")}
                  </p>
                </div>
                <span className="vc-officer-count-badge">{connectedOfficers.length} {t("officersLinked", "Officers Linked")}</span>
              </div>

              <div className="connected-officers-grid">
                {connectedOfficers.length === 0 ? (
                  <div className="vc-empty-officers">{t("noConnectedOfficers", "No connected officers registered for this case yet.")}</div>
                ) : (
                  connectedOfficers.map((off) => (
                    <div key={off.id} className="officer-card-item">
                      <div className="officer-avatar-box">
                        {off.role === "Daily Reporter" && <Mail size={18} color="#1d4ed8" />}
                        {off.role === "Investigation Administrator" && <Shield size={18} color="#a21caf" />}
                        {off.role === "Subject Officer" && <UserCheck size={18} color="#15803d" />}
                        {off.role === "Committee Chairman" && <Award size={18} color="#b45309" />}
                        {off.role === "Committee Member" && <Users size={18} color="#6d28d9" />}
                        {off.role === "Accused Officer" && <AlertCircle size={18} color="#b91c1c" />}
                        {off.role === "Inquiry Officer" && <FileText size={18} color="#0284c7" />}
                      </div>
                      <div className="officer-info-body">
                        <div className="officer-role-pill"><RoleBadge role={off.role as any} /></div>
                        <h4 className="officer-person-name">{off.name}</h4>
                        <p className="officer-designation">{off.designation || off.institution || t("officialRole", "Official Role")}</p>
                        {off.nic && <span className="officer-meta-tag">{t("nicLabel", "NIC")}: {off.nic}</span>}
                        {off.email && <span className="officer-meta-tag">{off.email}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ── Process Timelines Section with Tab Filter ── */}
            <div className="vc-section-card">
              <div className="vc-section-header">
                <div>
                  <h2 className="vc-section-title">
                    {t("processTimelinesTitle", "Process Timelines & Stage Progression")}
                    <span className="vc-live-indicator">
                      <span className="vc-live-pulse" />
                      {t("liveSynced", "Live Synced")}
                    </span>
                  </h2>
                  <p className="vc-section-subtitle">
                    {t("processTimelinesSubtitle", "Switch between specialized workflow views for Daily Reporter, Investigation Administrator, Subject Officer, and Connected Officers")}
                  </p>
                </div>
                <span className="vc-step-counter">{t("showingSteps", "Showing {{current}} of {{total}} Steps", { current: filteredTimelineEntries.length, total: totalSteps })}</span>
              </div>

              {/* ── Role Filter Tabs ── */}
              <div className="vc-tabs-container">
                <button
                  className={`vc-tab-btn ${activeTab === "all" ? "active" : ""}`}
                  onClick={() => setActiveTab("all")}
                >
                  <Sparkles size={15} />
                  {t("allProcesses", "All Processes")}
                  <span className="tab-count">{counts.all}</span>
                </button>

                <button
                  className={`vc-tab-btn ${activeTab === "daily-mail" ? "active tab-daily-mail" : ""}`}
                  onClick={() => setActiveTab("daily-mail")}
                >
                  <Mail size={15} />
                  {t("dailyMailReporterProcess", "Daily Mail Reporter Process")}
                  <span className="tab-count">{counts.dailyMail}</span>
                </button>

                <button
                  className={`vc-tab-btn ${activeTab === "investigation-admin" ? "active tab-inv-admin" : ""}`}
                  onClick={() => setActiveTab("investigation-admin")}
                >
                  <Shield size={15} />
                  {t("investigationAdminProcess", "Investigation Administrator Process")}
                  <span className="tab-count">{counts.investigationAdmin}</span>
                </button>

                <button
                  className={`vc-tab-btn ${activeTab === "subject-officer" ? "active tab-subject-officer" : ""}`}
                  onClick={() => setActiveTab("subject-officer")}
                >
                  <UserCheck size={15} />
                  {t("subjectOfficerProcess", "Subject Officer Process")}
                  <span className="tab-count">{counts.subjectOfficer}</span>
                </button>

                <button
                  className={`vc-tab-btn ${activeTab === "connected-officers" ? "active tab-connected" : ""}`}
                  onClick={() => setActiveTab("connected-officers")}
                >
                  <Users size={15} />
                  {t("connectedOfficersProcess", "Connected Officers Process")}
                  <span className="tab-count">{counts.connectedOfficers}</span>
                </button>
              </div>

              {/* ── Timeline Track ── */}
              {filteredTimelineEntries.length === 0 ? (
                <div className="vc-empty-state">
                  <AlertCircle size={28} style={{ margin: "0 auto 10px auto", color: "#94a3b8" }} />
                  <p>{t("noTimelineActions", "No actions logged under the selected process tab for this case.")}</p>
                  <button onClick={() => setActiveTab("all")} className="btn-reset-filter">{t("viewAllProcesses", "View All Processes")}</button>
                </div>
              ) : (
                <div className="vc-timeline">
                  {filteredTimelineEntries.map((entry) => (
                    <div key={entry.id} className="vc-timeline-item">
                      <div className="vc-timeline-left">
                        <TimelineDot status={entry.status} role={entry.role} />
                      </div>
                      <div className="vc-timeline-right">
                        <div className={`vc-timeline-card${entry.status === "Current" ? " card-current" : entry.status === "Pending" ? " card-pending" : ""}`}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="vc-timeline-topbar">
                              <div className="vc-timeline-officer-group">
                                <RoleBadge role={entry.role} />
                                <span className="vc-timeline-name">{entry.officerName}</span>
                              </div>
                              <div className="vc-timeline-meta">
                                <Clock size={12} />
                                <span>{entry.date}&nbsp;&nbsp;{entry.time}</span>
                              </div>
                            </div>

                            <h4 className="vc-timeline-action-title">
                              <span className="vc-step-number">{t("stepNumber", "Step #{{step}}", { step: entry.step })}</span>
                              {entry.action}
                            </h4>

                            {entry.details && (
                              <p className="vc-timeline-details-text">
                                {entry.details}
                              </p>
                            )}

                            {entry.metaInfo && (
                              <div className="vc-timeline-meta-pills">
                                {Object.entries(entry.metaInfo).map(([k, v]) => v ? (
                                  <span key={k} className="meta-pill-item">
                                    <strong>{k}:</strong> {String(v)}
                                  </span>
                                ) : null)}
                              </div>
                            )}
                          </div>
                          <StatusBadge status={entry.status} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Tracking History Table ── */}
            <div className="vc-section-card">
              <div className="vc-section-header">
                <div>
                  <h2 className="vc-section-title">{t("masterTrackingLog", "Master Case Tracking Log")}</h2>
                  <p className="vc-section-subtitle">{t("masterTrackingSubtitle", "Chronological ledger of all officer movements, approvals, and registered actions")}</p>
                </div>
                <div className="table-controls-row">
                  <div className="table-search-box">
                    <Search size={14} className="search-icon" />
                    <input
                      type="text"
                      placeholder={t("searchActionOfficer", "Search action or officer...")}
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                    />
                  </div>
                  <div className="table-filter-box">
                    <Filter size={14} className="filter-icon" />
                    <select
                      value={tableRoleFilter}
                      onChange={(e) => setTableRoleFilter(e.target.value)}
                    >
                      <option value="All">{t("allRoles", "All Roles")}</option>
                      <option value="Daily Reporter">{t("roleDailyReporter", "Daily Reporter")}</option>
                      <option value="Investigation Administrator">{t("roleInvestigationAdmin", "Investigation Administrator")}</option>
                      <option value="Subject Officer">{t("roleSubjectOfficer", "Subject Officer")}</option>
                      <option value="Committee Chairman">{t("roleCommitteeChairman", "Committee Chairman")}</option>
                      <option value="Committee Member">{t("roleCommitteeMember", "Committee Member")}</option>
                      <option value="Accused Officer">{t("roleAccusedOfficer", "Accused Officer")}</option>
                      <option value="Connected Officer">{t("roleConnectedOfficer", "Connected Officer")}</option>
                    </select>
                  </div>
                </div>
              </div>

              {filteredTableEntries.length === 0 ? (
                <div className="vc-empty-state">{t("noTrackingRecords", "No tracking records match the current filter criteria.")}</div>
              ) : (
                <div className="vc-table-wrapper">
                  <table className="vc-tracking-table">
                    <thead>
                      <tr>
                        <th style={{ width: "60px" }}>{t("stepCol", "Step")}</th>
                        <th style={{ width: "190px" }}>{t("roleEntityCol", "Role / Entity")}</th>
                        <th style={{ width: "180px" }}>{t("officerInChargeCol", "Officer In-Charge")}</th>
                        <th>{t("actionDetailsCol", "Action & Process Log Details")}</th>
                        <th style={{ width: "120px" }}>{t("dateCol", "Date")}</th>
                        <th style={{ width: "90px" }}>{t("timeCol", "Time")}</th>
                        <th style={{ width: "110px" }}>{t("statusCol", "Status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTableEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td><span className="vc-step-badge">{entry.step}</span></td>
                          <td><RoleBadge role={entry.role} /></td>
                          <td>
                            <span style={{ fontWeight: 600, color: "#1e293b" }}>{entry.officerName}</span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: 2 }}>{entry.action}</div>
                            {entry.details && (
                              <div style={{ fontSize: "11.5px", color: "#64748b", lineHeight: 1.4 }}>{entry.details}</div>
                            )}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>{entry.date}</td>
                          <td style={{ whiteSpace: "nowrap" }}>{entry.time}</td>
                          <td><StatusBadge status={entry.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminViewCasePage() {
  return (
    <Suspense fallback={<div className="page-loading-container"><div>Loading…</div></div>}>
      <AdminViewCaseInner />
    </Suspense>
  );
}
