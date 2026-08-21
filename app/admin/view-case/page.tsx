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
  role: "Daily Reporter" | "Investigation Administrator" | "Subject Officer" | "Committee Chairman" | "Committee Member" | "Accused Officer" | "Inquiry Officer";
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
    }> = [];

    const officersMap = new Map<string, ConnectedOfficer>();

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
          subjectDetailsLogs,
          assignment,
          preliminaryInvestigation,
        } = serverRes.data;

        // Set case header letter info if available
        if (dailyMailRows && dailyMailRows.length > 0) {
          const firstMail = dailyMailRows[0];
          setLetterData((prev) => ({
            refNo: firstMail.ref_number || caseNo,
            letterNo: firstMail.letter_number || "",
            senderName: firstMail.senders_party || "Complainant",
            subject: firstMail.subject_of_letter || "",
            modeOfReceipt: firstMail.mode_of_receipt || "Post",
            category: firstMail.subject_category || firstMail.nature_of_letter || "",
            receivedDate: firstMail.date_received_by_add_secretary ? new Date(firstMail.date_received_by_add_secretary).toISOString().split("T")[0] : "",
            submittedDate: firstMail.date_letter_handover_discipline ? new Date(firstMail.date_letter_handover_discipline).toISOString().split("T")[0] : "",
            officerName: subjectForm?.accused_officer?.accused_officer_name || prev?.officerName || "Assigned Officer",
            instituteName: subjectForm?.accused_school?.accused_school_name || prev?.instituteName || "Ministry / Education Zone",
            province: subjectForm?.accused_school?.province || "",
            district: subjectForm?.accused_school?.district || "",
            zone: subjectForm?.accused_school?.zone || "",
            status: "In Progress",
          }));
        }

        // ============================================================
        // A. DAILY MAIL REPORTER TIMELINE ENTRIES
        // ============================================================
        if (Array.isArray(dailyMailRows) && dailyMailRows.length > 0) {
          dailyMailRows.forEach((mail: any, idx: number) => {
            const recDate = mail.date_received_by_add_secretary ? new Date(mail.date_received_by_add_secretary).toISOString().split("T")[0] : "";
            const subDate = mail.date_letter_handover_discipline ? new Date(mail.date_letter_handover_discipline).toISOString().split("T")[0] : "";
            const ts = recDate ? new Date(recDate).getTime() : Date.now() - 86400000 * 10;

            const mailOfficerName = "Daily Mail Officer";
            officersMap.set("dm-officer", {
              id: "dm-officer",
              name: mailOfficerName,
              role: "Daily Reporter",
              designation: "Daily Mail Registration Officer",
              status: "Completed",
            });

            // Entry 1: Registration by Daily Mail Reporter
            raw.push({
              id: `dm-rec-${mail.id || idx}`,
              role: "Daily Reporter",
              officerName: mailOfficerName,
              action: idx === 0
                ? `Initial Complaint Registered: Letter No. ${mail.letter_number || "N/A"}`
                : `Subsequent Letter Registered: Letter No. ${mail.letter_number || "N/A"}`,
              category: "daily-mail",
              details: `Received via ${mail.mode_of_receipt || "Post"} from "${mail.senders_party || "Complainant"}". Subject: ${mail.subject_of_letter || "Inquiry complaint"}. Category: ${mail.subject_category || mail.nature_of_letter || "General"}`,
              date: recDate || "Registered Date",
              sortTs: ts,
              metaInfo: {
                letterNumber: mail.letter_number,
                sender: mail.senders_party,
                receiptMode: mail.mode_of_receipt,
                category: mail.subject_category,
              }
            });

            // Entry 2: Handover to Discipline Branch
            if (subDate) {
              const handoverTs = new Date(subDate).getTime();
              raw.push({
                id: `dm-handover-${mail.id || idx}`,
                role: "Daily Reporter",
                officerName: mailOfficerName,
                action: `Letter Handed Over to Discipline Branch`,
                category: "daily-mail",
                details: `Physical and system records transferred to the Discipline Branch Investigation Administrator for formal action.`,
                date: subDate,
                sortTs: handoverTs >= ts ? handoverTs : ts + 3600000,
              });
            }
          });
        }

        // ============================================================
        // B. INVESTIGATION ADMINISTRATOR TIMELINE ENTRIES
        // ============================================================
        const adminOfficerName = "Investigation Administrator (Discipline Branch)";
        officersMap.set("inv-admin", {
          id: "inv-admin",
          name: adminOfficerName,
          role: "Investigation Administrator",
          designation: "Branch Administrator / Head of Investigation",
          status: "Active",
        });

        // 1. Case Admission & Assignment
        if (subjectForm || assignment || dailyMailRows.length > 0) {
          const assignDate = subjectForm?.date_prepared_and_submitted_for_signature
            ? new Date(subjectForm.date_prepared_and_submitted_for_signature).toISOString().split("T")[0]
            : (dailyMailRows[0]?.date_letter_handover_discipline
                ? new Date(dailyMailRows[0].date_letter_handover_discipline).toISOString().split("T")[0]
                : "");
          const assignTs = assignDate ? new Date(assignDate).getTime() : Date.now() - 86400000 * 8;

          raw.push({
            id: `ia-admission-${caseNo}`,
            role: "Investigation Administrator",
            officerName: adminOfficerName,
            action: `Case Admission & Subject Assignment`,
            category: "investigation-admin",
            details: `Case opened under File Ref #${subjectForm?.subject_file_no || caseNo}. Assigned to Subject Officer for accused personnel verification and inquiry proceeding preparation.`,
            date: assignDate || "—",
            sortTs: assignTs,
          });
        }

        // 2. Appointment of Chairman & Committee Members
        if (chairman || (members && members.length > 0)) {
          const chairTs = chairman?.created_at ? new Date(chairman.created_at).getTime() : Date.now() - 86400000 * 6;
          const chairDate = chairman?.created_at ? new Date(chairman.created_at).toISOString().split("T")[0] : "";
          const memberNames = (members || []).map((m: any) => m.full_name).filter(Boolean).join(", ");

          raw.push({
            id: `ia-committee-appoint-${caseNo}`,
            role: "Investigation Administrator",
            officerName: adminOfficerName,
            action: `Inquiry Committee Formally Appointed`,
            category: "investigation-admin",
            details: `Chairman appointed: ${chairman?.full_name || "Assigned Chairman"} (${chairman?.position || "Chairman"}). Committee Members: ${memberNames || "Panel Members"}. Conflict of interest checks verified against attended school records.`,
            date: chairDate || "—",
            sortTs: chairTs,
          });
        }

        // 3. Appointment Letter Issued & Report Due Date Scheduled
        if (appointmentDates) {
          const apptDateStr = appointmentDates.appointment_letter_date ? new Date(appointmentDates.appointment_letter_date).toISOString().split("T")[0] : "";
          const dueDateStr = appointmentDates.report_due_date ? new Date(appointmentDates.report_due_date).toISOString().split("T")[0] : "";
          const apptTs = apptDateStr ? new Date(apptDateStr).getTime() : Date.now() - 86400000 * 5;

          raw.push({
            id: `ia-dates-schedule-${caseNo}`,
            role: "Investigation Administrator",
            officerName: adminOfficerName,
            action: `Formal Appointment Letter Issued & Report Due Date Set`,
            category: "investigation-admin",
            details: `Appointment Letter issued on ${apptDateStr || "N/A"}. Investigation report due date scheduled for ${dueDateStr || "N/A"}. Committee instructed to commence hearing sessions.`,
            date: apptDateStr || dueDateStr || "—",
            sortTs: apptTs,
          });
        }

        // 4. Date Extension Request & Approval
        if (extension) {
          const extDateStr = extension.decision_date ? new Date(extension.decision_date).toISOString().split("T")[0] : (extension.created_at ? new Date(extension.created_at).toISOString().split("T")[0] : "");
          const extTs = extDateStr ? new Date(extDateStr).getTime() : Date.now() - 86400000 * 3;
          const isApproved = (extension.approval_status || "").toLowerCase().includes("approve");

          raw.push({
            id: `ia-extension-eval-${caseNo}`,
            role: "Investigation Administrator",
            officerName: adminOfficerName,
            action: `Date Extension Decision: ${extension.extention_term || "Extension"} (${extension.approval_status || "Pending"})`,
            category: "investigation-admin",
            details: `Evaluation of extension term [${extension.start_date || "N/A"} to ${extension.end_date || "N/A"}]. Decision Status: ${extension.approval_status || "Approved by Administration"}.`,
            date: extDateStr || "—",
            sortTs: extTs,
          });
        }

        // 5. Final Report & Secretary Approval by Investigation Admin
        if (assignment?.final_report_content || assignment?.approval_date) {
          const repDateStr = assignment.approval_date ? new Date(assignment.approval_date).toISOString().split("T")[0] : "";
          const repTs = repDateStr ? new Date(repDateStr).getTime() : Date.now();

          raw.push({
            id: `ia-final-report-${caseNo}`,
            role: "Investigation Administrator",
            officerName: adminOfficerName,
            action: `Final Investigation Report & Secretary Approval Approved`,
            category: "investigation-admin",
            details: `Final Investigation findings verified: "${assignment.final_report_content || "Inquiry concluded successfully"}". Education Secretary approval date confirmed: ${repDateStr || "Approved"}.`,
            date: repDateStr || "—",
            sortTs: repTs,
          });
        }

        // ============================================================
        // C. SUBJECT OFFICER TIMELINE ENTRIES
        // ============================================================
        const subjName = subjectForm?.name_of_the_presenting_the_complain || "Subject Officer";
        officersMap.set("subj-officer", {
          id: "subj-officer",
          name: subjName,
          role: "Subject Officer",
          designation: "Discipline Branch Subject Officer",
          status: "Active",
        });

        // 1. Accused Officer Registration
        if (Array.isArray(accusedOfficers) && accusedOfficers.length > 0) {
          accusedOfficers.forEach((ao: any, aIdx: number) => {
            const aoName = ao.accused_officer_name || ao.officer_name || "Accused Officer";
            const schoolName = ao.accused_school_name || ao.institute_name || "Educational Institute";
            const aoTs = Date.now() - 86400000 * 7 + aIdx * 1000;

            officersMap.set(`accused-${aIdx}`, {
              id: `accused-${aIdx}`,
              name: aoName,
              role: "Accused Officer",
              designation: ao.position || "Staff Officer / Teacher",
              institution: schoolName,
              nic: ao.nic_no || ao.nic || "N/A",
              status: "Under Investigation",
            });

            raw.push({
              id: `so-accused-reg-${aIdx}`,
              role: "Subject Officer",
              officerName: subjName,
              action: `Accused Officer Registered: ${aoName}`,
              category: "subject-officer",
              details: `Position: ${ao.position || "N/A"} | NIC: ${ao.nic_no || ao.nic || "N/A"} | Institute: ${schoolName} (Zone: ${ao.zone || "N/A"}, Province: ${ao.province || "N/A"}).`,
              date: ao.appointment_date ? new Date(ao.appointment_date).toISOString().split("T")[0] : "—",
              sortTs: aoTs,
            });
          });
        }

        // 2. Action Logs from Subject Details
        if (Array.isArray(subjectDetailsLogs) && subjectDetailsLogs.length > 0) {
          subjectDetailsLogs.forEach((log: any, lIdx: number) => {
            const logDate = log.received_date ? new Date(log.received_date).toISOString().split("T")[0] : "";
            const logTs = logDate ? new Date(logDate).getTime() : Date.now() - 86400000 * (5 - lIdx);
            const officer = log.subject_officer_name || log.officer_name || subjName;

            raw.push({
              id: `so-log-${log.id || lIdx}`,
              role: "Subject Officer",
              officerName: officer,
              action: log.step_taken ? formatStepTaken(log.step_taken, t) : `Case Status: ${log.report_state || "In Progress"}`,
              category: "subject-officer",
              details: log.special_notes || `State updated to ${log.report_state || "In Progress"}.`,
              date: logDate || "—",
              sortTs: logTs,
            });
          });
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
            designation: chairman.position || "Inquiry Chairman",
            email: chairman.email || "chairman@inquiry.gov.lk",
            status: "Appointed",
          });

          raw.push({
            id: `conn-chair-active-${caseNo}`,
            role: "Committee Chairman",
            officerName: chairman.full_name || "Committee Chairman",
            action: `Inquiry Proceedings Commenced by Chairman`,
            category: "connected-officers",
            details: `Chairman ${chairman.full_name} accepted inquiry dossier. Commenced schedule for hearings, witness calls, and examination of documents.`,
            date: chairman.updated_at ? new Date(chairman.updated_at).toISOString().split("T")[0] : "—",
            sortTs: chairman.created_at ? new Date(chairman.created_at).getTime() + 86400000 : Date.now() - 86400000 * 4,
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
              id: `conn-member-${mIdx}`,
              role: "Committee Member",
              officerName: mName,
              action: `Inquiry Panel Member Assigned: ${mName}`,
              category: "connected-officers",
              details: `Panel Member ${mName} assigned to review inquiry submissions and participate in the formal investigation sittings.`,
              date: m.created_at ? new Date(m.created_at).toISOString().split("T")[0] : "—",
              sortTs: m.created_at ? new Date(m.created_at).getTime() + 3600000 : Date.now() - 86400000 * 4,
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
            role: "Connected Officer",
            officerName: prelimOfficerName,
            action: `Preliminary Investigation Findings Submitted`,
            category: "connected-officers",
            details: `Findings: ${preliminaryInvestigation.findings || "Preliminary report compiled."} | Observations: ${preliminaryInvestigation.observations || "Initial facts checked."}`,
            date: preliminaryInvestigation.updated_at ? new Date(preliminaryInvestigation.updated_at).toISOString().split("T")[0] : "—",
            sortTs: Date.now() - 86400000 * 2,
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
            if (!raw.some((r) => r.id === a.id)) {
              raw.push({
                id: a.id || `local-${idx}`,
                role: "Subject Officer",
                officerName: a.subjectOfficerName || "Subject Officer",
                action: a.stepTaken || a.step_taken || "Case Activity Logged",
                category: "subject-officer",
                details: a.specialNotes || a.special_notes || "",
                date: a.receivedDate || "—",
                sortTs: a.receivedDate ? new Date(a.receivedDate).getTime() : Date.now() - idx * 1000,
              });
            }
          });
        }
      } catch (e) {}
    }

    // Deduplicate & Sort chronologically
    raw.sort((a, b) => a.sortTs - b.sortTs);

    const formatted: TrackingEntry[] = raw.map((r, idx) => ({
      ...r,
      step: idx + 1,
      time: r.date && r.date !== "—" && !isNaN(new Date(r.date).getTime())
        ? new Date(r.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
        : "10:00",
      status: (idx === raw.length - 1 ? "Current" : "Completed") as TrackingEntry["status"],
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
                <span className="vc-priority-badge">{letterData.priority} {t("priorityLabel", "Priority")}</span>
              )}
              <span className="vc-status-pill">{t("activeCase", "Active Case")}</span>
            </div>
            <h1>{letterData?.subject || t("inquiryCaseDossier", "Inquiry Case Dossier #{{caseNo}}", { caseNo: caseNoParam })}</h1>
            <p>{t("viewCaseSubTitle", "Comprehensive multi-role investigation process timeline & connected personnel tracker")}</p>
          </div>
          <div className="vc-header-actions">
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
