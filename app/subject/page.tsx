"use client";

import "../../i18n";
import "../daily-mail/daily-mail.css";
import "../dashboard-common.css";
import "./subject.css";
import { useMemo, useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sidebar } from "@/components/Sidebar";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getCurrentProfile, signOut, UserProfile } from "@/lib/auth";
import { updateCaseByDateExtensionApprovalServer, saveCaseByAppointmentAndReportDueDateServer, getRecommendationsListServer } from "@/lib/db-actions";
import { CheckCircle, XCircle, FileText, Send, Clock, X, AlertCircle, ShieldCheck, Calendar as CalendarIcon, ChevronDown, ChevronUp, Bell, Eye, MoreHorizontal, Filter, Check, MailCheck, ClipboardList, Plus, Sparkles, ExternalLink, User, Building, ArrowRight, ShieldAlert, FileCheck, Layers, UserCheck } from "lucide-react";

interface Case {
  id: string;
  caseNo: string;
  assignedDate: string;
  receivedDate: string;
  letterDate?: string;
  createdAt?: string;
  subject: string;
  priority: "high" | "medium" | "low";
  status: "In Progress" | "Closed" | "Pending" | "assigned answer letter" | "Assigned Answer Letter" | string;
  isOld?: boolean;
  accusedName?: string;
  accusedDesignation?: string;
  schoolName?: string;
  stage?: string;
  stageKey?: string;
  isProperDisciplinary?: boolean;
  disciplinaryCharge?: string;
}

export const formatToInputDate = (dateStr?: string | null): string => {
  if (!dateStr || typeof dateStr !== "string") return "";
  const trimmed = dateStr.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (trimmed.includes("T")) {
    const parts = trimmed.split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(parts)) return parts;
  }
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return "";
};

export function parseCommitteeDetails(asgn: any) {
  let chairmanName = "";
  let chairmanNic = "";
  let memberList: string[] = [];

  if (asgn?.chairman) {
    if (typeof asgn.chairman === "object" && asgn.chairman !== null) {
      chairmanName = asgn.chairman.fullName || asgn.chairman.name || asgn.chairman.officer_name || "";
      chairmanNic = asgn.chairman.nicNo || asgn.chairman.nic || asgn.chairman.nic_no || "";
    } else if (typeof asgn.chairman === "string") {
      if (asgn.chairman.startsWith("{")) {
        try {
          const parsed = JSON.parse(asgn.chairman);
          chairmanName = parsed.fullName || parsed.name || parsed.officer_name || "";
          chairmanNic = parsed.nicNo || parsed.nic || parsed.nic_no || "";
        } catch (e) {
          chairmanName = asgn.chairman;
        }
      } else {
        chairmanName = asgn.chairman;
      }
    }
  }

  if (asgn?.members) {
    if (Array.isArray(asgn.members)) {
      memberList = asgn.members.map((m: any) => {
        if (typeof m === "object" && m !== null) {
          return m.fullName || m.name || m.officer_name || "";
        }
        return String(m || "");
      }).filter(Boolean);
    } else if (typeof asgn.members === "string") {
      try {
        const parsed = JSON.parse(asgn.members);
        if (Array.isArray(parsed)) {
          memberList = parsed.map((m: any) => (typeof m === "object" ? m.fullName || m.name || m.officer_name : String(m))).filter(Boolean);
        } else {
          memberList = asgn.members.split(",").map((s: string) => s.trim()).filter(Boolean);
        }
      } catch (e) {
        memberList = asgn.members.split(",").map((s: string) => s.trim()).filter(Boolean);
      }
    }
  }

  const rawText = String(asgn?.assignedOfficers || asgn?.assigned_officers || asgn?.officerName || asgn?.committeeDetails || "").trim();

  if (!chairmanName && rawText) {
    if (rawText.includes("Chairman:")) {
      const match = rawText.match(/Chairman:\s*([^|]+)/i);
      if (match && match[1]) chairmanName = match[1].trim();
    } else if (rawText.includes("(Chairman)")) {
      const match = rawText.match(/([^(,]+)\s*\(Chairman\)/i);
      if (match && match[1]) chairmanName = match[1].trim();
    }
  }

  if (memberList.length === 0 && rawText) {
    if (rawText.includes("Members:")) {
      const match = rawText.match(/Members:\s*([^|]+)/i);
      if (match && match[1]) {
        memberList = match[1].split(",").map((s) => s.trim()).filter(Boolean);
      }
    } else if (rawText.includes("(Member)") || rawText.includes("(Members)")) {
      const matches = rawText.matchAll(/([^(,]+)\s*\(Members?\)/gi);
      for (const m of matches) {
        if (m[1] && m[1].trim()) memberList.push(m[1].trim());
      }
    }
  }

  const isPlaceholder = !rawText || rawText.includes("—") || rawText.includes("not yet assigned") || rawText.includes("යවා නොමැත");
  const hasDetails = !!(chairmanName || memberList.length > 0 || (!isPlaceholder && rawText));

  return {
    chairmanName,
    chairmanNic,
    memberList,
    rawText: isPlaceholder ? "" : rawText,
    hasDetails
  };
}

function formatExtensionTermDisplay(term?: string | null, currentLang: string = "en"): string {
  if (!term || term === "None") return "First Extension (1st)";
  const lower = String(term).trim().toLowerCase();
  if (lower === "first" || lower === "1st") {
    return currentLang === "si" ? "පළමු දීර්ඝ කිරීම (1st Extension)" : "First Extension (1st)";
  }
  if (lower === "second" || lower === "2nd") {
    return currentLang === "si" ? "දෙවන දීර්ඝ කිරීම (2nd Extension)" : "Second Extension (2nd)";
  }
  if (lower === "third" || lower === "3rd") {
    return currentLang === "si" ? "තෙවන දීර්ඝ කිරීම (3rd Extension — උපරිම)" : "Third Extension (3rd) — Maximum";
  }
  return term;
}

export function formatRelativeTime(dateString?: string | null, currentLang: string = "en"): string {
  if (!dateString) return currentLang === "si" ? "මෑතකදී" : currentLang === "ta" ? "சமீபத்தில்" : "Recently";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return String(dateString);
  }
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 45) {
    return currentLang === "si" ? "දැන් සුළු මොහොතකට පෙර" : currentLang === "ta" ? "சற்று முன்" : "Just now";
  }
  if (diffMin < 60) {
    return currentLang === "si" ? `විනාඩි ${diffMin}කට පෙර` : currentLang === "ta" ? `${diffMin} நிமிடங்களுக்கு முன்` : `${diffMin}m ago`;
  }
  if (diffHours < 24) {
    return currentLang === "si" ? `පැය ${diffHours}කට පෙර` : currentLang === "ta" ? `${diffHours} மணிநேරத்திற்கு முன்` : `${diffHours}h ago`;
  }
  if (diffDays === 1) {
    return currentLang === "si" ? "ඊයේ" : currentLang === "ta" ? "நேற்று" : "Yesterday";
  }
  if (diffDays < 7) {
    return currentLang === "si" ? `දින ${diffDays}කට පෙර` : currentLang === "ta" ? `${diffDays} நாட்களுக்கு முன்` : `${diffDays}d ago`;
  }
  return date.toLocaleDateString(currentLang === "si" ? "si-LK" : currentLang === "ta" ? "ta-LK" : "en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined
  });
}

export interface SeparateNotification {
  id: string;
  caseId: string;
  caseNo: string;
  stepNumber: 1 | 2 | 3 | 5;
  stepType: "step1_officers" | "step2_dates" | "step34_extension" | "step5_complete";
  asgn: any;
  adminName: string;
  headline: string;
  actionSnippet: string;
  badgeColor: "badge-blue" | "badge-amber" | "badge-green" | "badge-purple";
  statusPill: string;
  iconType: "calendar" | "clock" | "check" | "file";
  isUrgent: boolean;
  isActionRequired: boolean;
  isCompleted: boolean;
  timeAgo: string;
  rawDate: string;
}

export function buildSeparateNotifications(assignments: any[], currentLang: string = "en"): SeparateNotification[] {
  const notifs: SeparateNotification[] = [];
  const adminName = currentLang === "si" ? "විමර්ශන පරිපාලක (Admin)" : currentLang === "ta" ? "விசாரணை நிர்வாகி" : "Investigation Admin";

  assignments.forEach((asgn) => {
    const caseId = String(asgn.id || asgn.caseNo || "");
    const caseNo = String(asgn.caseNo || "");

    // 1. Step 5: Initial Investigation Complete Notification
    const isInitialComplete = !!(
      asgn.initialInvestigationComplete ||
      asgn.initial_investigation_complete ||
      asgn.status === "Informing Officer In Charge - Initial Investigation Complete"
    );
    if (isInitialComplete) {
      notifs.push({
        id: `notif-step5-${caseId}`,
        caseId,
        caseNo,
        stepNumber: 5,
        stepType: "step5_complete",
        asgn,
        adminName,
        headline: currentLang === "si"
          ? `${adminName} විසින් මෙම නඩුවේ මූලික විමර්ශන කටයුතු අවසන් බව දැනුම් දී ඇත`
          : currentLang === "ta"
          ? `${adminName} ஆரம்ப விசாரணை முடிவடைந்ததாக அறிவித்துள்ளார்`
          : `${adminName} informed that initial preliminary investigation is complete`,
        actionSnippet: currentLang === "si"
          ? "මූලික විමර්ශන කටයුතු අවසන් බවට නිල වශයෙන් දැනුම් දී ඇත. නිර්දේශ (Recommendation) ඉදිරිපත් කළ හැක."
          : currentLang === "ta"
          ? "ஆரம்ப விசாரணை முடிவடைந்துவிட்டது என உத்தியோகபூர்வமாக தெரிவிக்கப்பட்டுள்ளது."
          : "Official notification: Investigation Administrator has informed that the initial preliminary investigation is complete.",
        badgeColor: "badge-green",
        statusPill: currentLang === "si" ? "✓ Step 5 — මූලික විමර්ශනය අවසන්" : currentLang === "ta" ? "✓ Step 5 — ஆரம்ப விசாரணை முடிந்தது" : "✓ Step 5 — Initial Investigation Complete",
        iconType: "check",
        isUrgent: false,
        isActionRequired: false,
        isCompleted: true,
        timeAgo: formatRelativeTime(asgn.initialInvestigationCompletedAt || asgn.updatedAt || asgn.createdAt, currentLang),
        rawDate: asgn.initialInvestigationCompletedAt || asgn.updatedAt || asgn.createdAt || ""
      });
    }

    // 2. Steps 3 & 4: Extension of Days Notification
    const extTerm = asgn.extensionTerm || asgn.extension_term;
    const extStart = asgn.extensionStartDate || asgn.extension_start_date;
    const extEnd = asgn.extensionEndDate || asgn.extension_end_date;
    const extReq = asgn.extensionRequestedByAdmin || asgn.extension_requested_by_admin || asgn.extensionRequested;
    const extensionStatus = asgn.extensionApprovalStatus || asgn.extension_approval_status;
    const hasExtensionData = !!(
      extStart ||
      extEnd ||
      (extTerm && extTerm !== "None") ||
      extReq ||
      (asgn.status && String(asgn.status).toLowerCase().includes("extension"))
    );

    if (hasExtensionData) {
      const isApproved = extensionStatus === "Approved";
      const isDisapproved = extensionStatus === "Disapproved";
      const isPending = !isApproved && !isDisapproved;

      notifs.push({
        id: `notif-step34-${caseId}`,
        caseId,
        caseNo,
        stepNumber: 3,
        stepType: "step34_extension",
        asgn,
        adminName,
        headline: currentLang === "si"
          ? `${adminName} විසින් දිනයන් දීර්ඝ කිරීමේ වාරයක් යෝජනා කර ඇත`
          : currentLang === "ta"
          ? `${adminName} கால நீட்டிப்பு கோரியுள்ளார்`
          : `${adminName} proposed an extension of days`,
        actionSnippet: isApproved
          ? (currentLang === "si"
              ? `දීර්ඝ කිරීම අනුමත කරන ලදී (${extStart || "—"} සිට ${extEnd || "—"} දක්වා).`
              : `Extension approved (${extStart || "—"} to ${extEnd || "—"}).`)
          : isDisapproved
          ? (currentLang === "si" ? `දීර්ඝ කිරීමේ ඉල්ලීම ප්‍රතික්ෂේප කරන ලදී.` : `Extension request was disapproved.`)
          : (currentLang === "si"
              ? `${formatExtensionTermDisplay(extTerm, currentLang)} (${extStart || "—"} සිට ${extEnd || "—"} දක්වා). කරුණාකර අනුමත කරන්න හෝ ප්‍රතික්ෂේප කරන්න.`
              : `${extTerm || "First"} extension (${extStart || "—"} to ${extEnd || "—"}). Please review and approve/disapprove.`),
        badgeColor: isApproved ? "badge-green" : isDisapproved ? "badge-purple" : "badge-amber",
        statusPill: isApproved
          ? (currentLang === "si" ? "✓ Steps 3 & 4 — අනුමත විය" : "✓ Steps 3 & 4 — Extension Approved")
          : isDisapproved
          ? (currentLang === "si" ? "✕ Steps 3 & 4 — ප්‍රතික්ෂේප විය" : "✕ Steps 3 & 4 — Extension Disapproved")
          : (currentLang === "si" ? "⚠️ Steps 3 & 4 — අනුමැතිය අවශ්‍යයි" : "⚠️ Steps 3 & 4 — Extension Decision Required"),
        iconType: "clock",
        isUrgent: isPending,
        isActionRequired: isPending,
        isCompleted: isApproved || isDisapproved,
        timeAgo: formatRelativeTime(asgn.extensionRequestedAt || asgn.updatedAt || asgn.createdAt, currentLang),
        rawDate: asgn.extensionRequestedAt || asgn.updatedAt || asgn.createdAt || ""
      });
    }

    // 3. Step 2: Date Entry (Appointment Date & Report Due Date)
    const isDatesSubmitted = !!asgn.datesSubmittedBySubject;
    notifs.push({
      id: `notif-step2-${caseId}`,
      caseId,
      caseNo,
      stepNumber: 2,
      stepType: "step2_dates",
      asgn,
      adminName,
      headline: isDatesSubmitted
        ? (currentLang === "si"
            ? `${adminName}: පත්වීම් සහ වාර්තා දිනයන් තහවුරු කර ඇත`
            : `${adminName}: Appointment & report due dates confirmed`)
        : (currentLang === "si"
            ? `${adminName} විසින් පත්වීම් ලිපිය දිනය සහ වාර්තා දිනය ඉල්ලා ඇත`
            : `${adminName} requested appointment letter & report due dates`),
      actionSnippet: isDatesSubmitted
        ? (currentLang === "si"
            ? `පත්වීම් දිනය: ${asgn.appointmentDate || "—"} | වාර්තාව ලැබිය යුතු දිනය: ${asgn.reportDueDate || "—"}`
            : `Appt Date: ${asgn.appointmentDate || "—"} | Due Date: ${asgn.reportDueDate || "—"}`)
        : (currentLang === "si"
            ? "පත්වීම් ලිපිය දිනය සහ වාර්තාව ලැබිය යුතු දිනය ඇතුළත් කර Admin වෙත යවන්න."
            : "Please enter Appointment Letter Date & Report Due Date to send to Investigation Admin."),
      badgeColor: isDatesSubmitted ? "badge-blue" : "badge-amber",
      statusPill: isDatesSubmitted
        ? (currentLang === "si" ? "● Step 2 — දිනයන් යවන ලදී" : "● Step 2 — Dates Sent")
        : (currentLang === "si" ? "⚡ Step 2 — දිනයන් ඇතුළත් කරන්න" : "⚡ Step 2 — Date Entry Required"),
      iconType: "calendar",
      isUrgent: !isDatesSubmitted,
      isActionRequired: !isDatesSubmitted,
      isCompleted: isDatesSubmitted,
      timeAgo: formatRelativeTime(asgn.datesSubmittedAt || asgn.assignedDate || asgn.createdAt, currentLang),
      rawDate: asgn.datesSubmittedAt || asgn.assignedDate || asgn.createdAt || ""
    });

    // 4. Step 1: Assigned Investigation Officers / Committee
    const committee = parseCommitteeDetails(asgn);
    notifs.push({
      id: `notif-step1-${caseId}`,
      caseId,
      caseNo,
      stepNumber: 1,
      stepType: "step1_officers",
      asgn,
      adminName,
      headline: currentLang === "si"
        ? `${adminName} විසින් විමර්ශන නිලධාරීන් පත් කරන ලදී`
        : `${adminName} assigned investigation committee & officers`,
      actionSnippet: committee.chairmanName
        ? (currentLang === "si" ? `සභාපති: ${committee.chairmanName} | සාමාජිකයින්: ${committee.memberList.length} දෙනෙක්` : `Chairman: ${committee.chairmanName} | Members: ${committee.memberList.length}`)
        : (currentLang === "si" ? "විමර්ශන කමිටු විස්තර ලැබී ඇත." : "Investigation Committee assigned by Admin."),
      badgeColor: "badge-purple",
      statusPill: currentLang === "si" ? "✓ Step 1 — නිලධාරීන් පත් කළා" : "✓ Step 1 — Officers Assigned",
      iconType: "file",
      isUrgent: false,
      isActionRequired: false,
      isCompleted: true,
      timeAgo: formatRelativeTime(asgn.assignedDate || asgn.createdAt, currentLang),
      rawDate: asgn.assignedDate || asgn.createdAt || ""
    });
  });

  return notifs;
}

export function getNotifMeta(asgn: any, currentLang: string = "en") {
  const isDatesSubmitted = !!asgn.datesSubmittedBySubject;
  const isExtensionRequested = !!(
    (asgn.extensionStartDate && asgn.extensionEndDate) ||
    asgn.extensionRequestedByAdmin ||
    asgn.status === "Extension Requested" ||
    asgn.extensionTerm
  );
  const extensionStatus = asgn.extensionApprovalStatus;
  const isPendingExtension = isExtensionRequested && (!extensionStatus || extensionStatus === "Pending");
  const isInitialComplete = !!(asgn.initialInvestigationComplete || asgn.initial_investigation_complete || asgn.status === "Informing Officer In Charge - Initial Investigation Complete");

  const adminName = currentLang === "si" ? "විමර්ශන පරිපාලක (Admin)" : currentLang === "ta" ? "விசாரணை நிர்வாகி" : "Investigation Admin";

  let headline = "";
  let actionSnippet = "";
  let badgeColor: "badge-blue" | "badge-amber" | "badge-green" | "badge-purple" = "badge-blue";
  let statusPill = "";
  let iconType: "calendar" | "clock" | "check" | "file" = "calendar";
  let isUrgent = false;

  if (isInitialComplete) {
    badgeColor = "badge-green";
    iconType = "check";
    statusPill = currentLang === "si" ? "✓ මූලික විමර්ශනය අවසන් බව දැනුම් දෙන ලදී" : currentLang === "ta" ? "✓ ஆரம்ப விசாரணை முடிவடைந்தது" : "✓ Initial Investigation Complete";
    headline = currentLang === "si"
      ? `${adminName} විසින් මෙම නඩුවේ මූලික විමර්ශන කටයුතු අවසන් බව දැනුම් දී ඇත`
      : currentLang === "ta"
      ? `${adminName} ஆரம்ப விசாரணை முடிவடைந்ததாக அறிவித்துள்ளார்`
      : `${adminName} informed that initial investigation is complete`;
    actionSnippet = currentLang === "si"
      ? "විමර්ශන පරිපාලක විසින් මූලික විමර්ශන කටයුතු අවසන් බව භාරකාර නිලධාරියා වෙත දැනුම් දී ඇත. නිර්දේශ (Recommendation) ඉදිරිපත් කළ හැක."
      : currentLang === "ta"
      ? "ஆரம்ப விசாரணை முடிவடைந்தது என தெரிவிக்கப்பட்டுள்ளது. நீங்கள் பரிந்துரைகளை சமர்ப்பிக்கலாம்."
      : "Investigation Administrator has informed the officer in charge that the initial preliminary investigation is complete. Ready for recommendations.";
  } else if (isPendingExtension) {
    badgeColor = "badge-amber";
    iconType = "clock";
    isUrgent = true;
    statusPill = currentLang === "si" ? "⚠️ Steps 3 & 4 — දිනයන් දීර්ඝ කිරීම් ඉල්ලීමක් ඇත" : "⚠️ Steps 3 & 4 — Extension Decision Required";
    headline = currentLang === "si"
      ? `${adminName} විසින් දිනයන් දීර්ඝ කිරීමේ වාරයක් ලබා දී ඇත`
      : currentLang === "ta"
      ? `${adminName} கால நீட்டிப்பு கோரியுள்ளார்`
      : `${adminName} proposed an extension of days`;
    actionSnippet = currentLang === "si"
      ? `${formatExtensionTermDisplay(asgn.extensionTerm, currentLang)} (${asgn.extensionStartDate || "—"} සිට ${asgn.extensionEndDate || "—"} දක්වා). කරුණාකර අනුමත කරන්න හෝ ප්‍රතික්ෂේප කරන්න.`
      : `${asgn.extensionTerm || "First"} extension (${asgn.extensionStartDate || "—"} to ${asgn.extensionEndDate || "—"}). Please review & decision needed.`;
  } else if (!isDatesSubmitted) {
    badgeColor = "badge-blue";
    iconType = "calendar";
    isUrgent = true;
    statusPill = currentLang === "si" ? "⚡ Step 2 — දිනයන් ඇතුළත් කිරීම අවශ්‍යයි" : "⚡ Step 2 — Date Entry Required";
    headline = currentLang === "si"
      ? `${adminName} විසින් පත්වීම් ලිපිය දිනය සහ වාර්තා දිනය ඉල්ලා ඇත`
      : currentLang === "ta"
      ? `${adminName} நியமனம் மற்றும் அறிக்கை தேதிகளை கோரியுள்ளார்`
      : `${adminName} requested appointment letter & report due dates`;
    actionSnippet = currentLang === "si"
      ? "පත්වීම් ලිපිය දිනය සහ වාර්තාව ලැබිය යුතු දිනය ඇතුළත් කර Admin වෙත යවන්න."
      : currentLang === "ta"
      ? "நியமனக் கடிதத் தேதி மற்றும் அறிக்கை சமர்ப்பிக்க வேண்டிய தேதியை உள்ளிடவும்."
      : "Please enter Appointment Letter Date & Report Due Date to send to Investigation Admin.";
  } else {
    badgeColor = "badge-purple";
    iconType = "file";
    statusPill = currentLang === "si" ? "● Step 2 — දිනයන් තහවුරු කළා" : "● Step 2 — Dates Confirmed";
    headline = currentLang === "si"
      ? `නඩුව සඳහා දිනයන් සහ විමර්ශන කමිටු තොරතුරු තහවුරු කර ඇත`
      : currentLang === "ta"
      ? `வழக்கு தேதிகள் உறுதிப்படுத்தப்பட்டு நிர்வாகிக்கு அனுப்பப்பட்டது`
      : `Investigation committee assigned & dates confirmed with Admin`;
    actionSnippet = currentLang === "si"
      ? `පත්වීම් දිනය: ${asgn.appointmentDate || "—"} | වාර්තා දිනය: ${asgn.reportDueDate || "—"}`
      : `Appt Date: ${asgn.appointmentDate || "—"} | Due Date: ${asgn.reportDueDate || "—"}`;
  }

  const timeAgo = formatRelativeTime(asgn.updatedAt || asgn.assignedDate || asgn.createdAt, currentLang);

  return {
    isDatesSubmitted,
    isExtensionRequested,
    isPendingExtension,
    isInitialComplete,
    isUrgent,
    adminName,
    headline,
    actionSnippet,
    badgeColor,
    statusPill,
    iconType,
    timeAgo
  };
}


export function collectAnswerLetters(
  lettersData: any[],
  subsequentData: any[],
  assignedRefNos: string[],
  activeNameClean: string,
  isOfficerMatchedFn: (name: string) => boolean
) {
  const list: any[] = [];
  const assignedRefNosClean = (assignedRefNos || []).map((r) => String(r || "").trim().toLowerCase());

  if (Array.isArray(subsequentData)) {
    subsequentData.forEach((m: any) => {
      const isAnswer = m.is_answer_letter === true || m.is_answer_letter === "true" || String(m.is_answer_letter || "") === "true";
      const mailOfficer = m.mail_officer_name || m.officer_name || "";
      const targetCaseNo = m.case_no || m.ref_no || "";
      const isMatch = isOfficerMatchedFn(mailOfficer) || (targetCaseNo && assignedRefNosClean.includes(String(targetCaseNo).trim().toLowerCase()));
      if (isAnswer && isMatch) {
        list.push({
          id: m.id || `sub-${targetCaseNo}-${m.received_date || m.created_at}`,
          caseNo: targetCaseNo,
          senderName: m.sender_name || "N/A",
          subject: m.letter_title || m.subject || "Answer Letter",
          letterType: m.letter_type || "Subsequent Answer Letter",
          letterDate: m.mail_date || m.letter_date || m.received_date,
          receivedDate: m.received_date || m.created_at,
          officerName: mailOfficer || "Subject Officer",
          isAnswerLetter: true,
        });
      }
    });
  }

  if (Array.isArray(lettersData)) {
    lettersData.forEach((l: any) => {
      const isAnswer = l.is_answer_letter === true || l.is_answer_letter === "true" || String(l.is_answer_letter || "") === "true";
      const mailOfficer = l.officer_name || "";
      const targetCaseNo = l.ref_no || l.case_no || "";
      const isMatch = isOfficerMatchedFn(mailOfficer) || (targetCaseNo && assignedRefNosClean.includes(String(targetCaseNo).trim().toLowerCase()));
      if (isAnswer && isMatch) {
        list.push({
          id: l.id || `daily-${targetCaseNo}`,
          caseNo: targetCaseNo,
          senderName: l.sender_name || l.sender || "N/A",
          subject: l.subject || "Answer Letter",
          letterType: "Daily Mail Answer Letter",
          letterDate: l.letter_date || l.received_date,
          receivedDate: l.received_date || l.created_at,
          officerName: mailOfficer || "Subject Officer",
          isAnswerLetter: true,
        });
      }
    });
  }

  if (typeof window !== "undefined") {
    try {
      const localSub = JSON.parse(localStorage.getItem("dcmms_subsequent_mails") || "[]");
      if (Array.isArray(localSub)) {
        localSub.forEach((sm: any) => {
          const isAnswer = sm.isAnswerLetter === "true" || sm.isAnswerLetter === true || String(sm.isAnswerLetter || "") === "true";
          const mailOfficer = sm.mailOfficerName || sm.officerName || "";
          const targetCaseNo = sm.caseNo || sm.case_no || sm.refNo || "";
          const isMatch = isOfficerMatchedFn(mailOfficer) || (targetCaseNo && assignedRefNosClean.includes(String(targetCaseNo).trim().toLowerCase()));
          if (isAnswer && isMatch) {
            list.push({
              id: sm.id || `local-sub-${targetCaseNo}-${sm.receivedDate || sm.createdAt}`,
              caseNo: targetCaseNo,
              senderName: sm.senderName || "N/A",
              subject: sm.subject || sm.letterTitle || "Answer Letter",
              letterType: sm.letterType || "Subsequent Answer Letter",
              letterDate: sm.letterDate || sm.mailDate || sm.receivedDate,
              receivedDate: sm.receivedDate || sm.createdAt,
              officerName: mailOfficer || "Subject Officer",
              isAnswerLetter: true,
            });
          }
        });
      }

      const localNewMailCase = JSON.parse(localStorage.getItem("dcmms_new_mail_current_case") || "[]");
      if (Array.isArray(localNewMailCase)) {
        localNewMailCase.forEach((sm: any) => {
          const isAnswer = sm.isAnswerLetter === "true" || sm.isAnswerLetter === true || String(sm.isAnswerLetter || "") === "true";
          const mailOfficer = sm.mailOfficerName || sm.officerName || "";
          const targetCaseNo = sm.caseNo || sm.case_no || sm.refNo || "";
          const isMatch = isOfficerMatchedFn(mailOfficer) || (targetCaseNo && assignedRefNosClean.includes(String(targetCaseNo).trim().toLowerCase()));
          if (isAnswer && isMatch) {
            list.push({
              id: sm.id || `local-case-mail-${targetCaseNo}-${sm.receivedDate || sm.createdAt}`,
              caseNo: targetCaseNo,
              senderName: sm.senderName || "N/A",
              subject: sm.subject || sm.letterTitle || "Answer Letter",
              letterType: sm.letterType || "Subsequent Answer Letter",
              letterDate: sm.letterDate || sm.mailDate || sm.receivedDate,
              receivedDate: sm.receivedDate || sm.createdAt,
              officerName: mailOfficer || "Subject Officer",
              isAnswerLetter: true,
            });
          }
        });
      }

      const localLetters = JSON.parse(localStorage.getItem("dcmms_letters") || "[]");
      if (Array.isArray(localLetters)) {
        localLetters.forEach((l: any) => {
          const isAnswer = l.isAnswerLetter === "true" || l.isAnswerLetter === true || String(l.isAnswerLetter || "") === "true";
          const mailOfficer = l.officerName || "";
          const targetCaseNo = l.refNo || l.caseNo || "";
          const isMatch = isOfficerMatchedFn(mailOfficer) || (targetCaseNo && assignedRefNosClean.includes(String(targetCaseNo).trim().toLowerCase()));
          if (isAnswer && isMatch) {
            list.push({
              id: l.id || `local-daily-${targetCaseNo}`,
              caseNo: targetCaseNo,
              senderName: l.senderName || l.sender || "N/A",
              subject: l.subject || "Answer Letter",
              letterType: "Daily Mail Answer Letter",
              letterDate: l.letterDate || l.receivedDate,
              receivedDate: l.receivedDate || l.createdAt,
              officerName: mailOfficer || "Subject Officer",
              isAnswerLetter: true,
            });
          }
        });
      }
    } catch (e) {
      console.error("Local storage answer letters parsing error", e);
    }
  }

  const uniqueMap = new Map<string, any>();
  list.forEach((item) => {
    const key = item.id || `${item.caseNo}-${item.letterDate}-${item.subject}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, item);
    }
  });

  return Array.from(uniqueMap.values()).sort((a, b) => {
    const timeA = new Date(a.receivedDate || a.letterDate || 0).getTime();
    const timeB = new Date(b.receivedDate || b.letterDate || 0).getTime();
    return timeB - timeA;
  });
}

function SubjectOfficerDashboardContent() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams?.get("tab");
  const caseNoParam = searchParams?.get("caseNo") || searchParams?.get("refNo");

  // Client mount state to prevent SSR/CSR hydration mismatches
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Accessibility & language state
  const [fontScale, setFontScale] = useState<"small" | "medium" | "large">("medium");
  const lang = i18n.language;

  // Format date statically to match mockup
  const getFormattedDate = () => {
    const date = new Date();
    if (lang === "si") {
      return date.toLocaleDateString("si-LK", { day: "numeric", month: "long", year: "numeric" });
    }
    if (lang === "ta") {
      return date.toLocaleDateString("ta-LK", { day: "numeric", month: "long", year: "numeric" });
    }
    return date.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
  };

  // Mobile sidebar visibility state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Dynamic localized greeting based on time of day
  const [greeting, setGreeting] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    let greetingKey = "greetingMorning";
    if (hour >= 12 && hour < 17) {
      greetingKey = "greetingAfternoon";
    } else if (hour >= 17 || hour < 5) {
      greetingKey = "greetingEvening";
    }

    const loadProfileAndGreeting = async () => {
      let displayName = t("subjectName", "Subject Officer");
      const prof = await getCurrentProfile();
      if (prof && prof.full_name) {
        setProfile(prof);
        displayName = prof.full_name;
      }
      const defaultText = hour >= 12 && hour < 17 ? "Good Afternoon" : hour >= 17 || hour < 5 ? "Good Evening" : "Good Morning";
      const timeGreeting = t(greetingKey, defaultText);
      setGreeting(`${timeGreeting}, ${displayName}!`);
    };

    loadProfileAndGreeting();
  }, [t]);

  // Close sidebar on Escape key press (A11y compliance)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSidebarOpen]);

  // Sync document properties
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${t("subjectDashboardTitle")} | DCMMS`;
  }, [lang, t]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  // Case management data state
  const [cases, setCases] = useState<Case[]>([]);

  // Load cases dynamically from database on mount or when profile is updated
  useEffect(() => {
    const fetchCases = async () => {
      if (isSupabaseConfigured) {
        try {
          let activeProfile = profile;
          if (!activeProfile) {
            activeProfile = await getCurrentProfile();
          }

          if (activeProfile) {
            const activeNameClean = (activeProfile.full_name || "").trim().toLowerCase();

            // 1. Fetch letters from dcmms_daily_mail
            const { data: letters, error: lettersError } = await supabase
              .from("dcmms_daily_mail")
              .select("*");

            if (lettersError) throw lettersError;

            // 2. Fetch assignments from dcmms_subject_assignments
            const { data: assignmentsData } = await supabase
              .from("dcmms_subject_assignments")
              .select("*");

            // 3. Fetch subsequent mails from dcmms_subsequent_mails
            const { data: subsequentData } = await supabase
              .from("dcmms_subsequent_mails")
              .select("*");

            const refToReceivedDate = new Map<string, string>();
            const refToLetterDate = new Map<string, string>();
            const refToCreatedAt = new Map<string, string>();
            const refToMailMeta = new Map<string, { subject?: string; priority?: string }>();

            const isOfficerMatched = (targetName: string) => {
              if (!activeNameClean) return true;
              if (!targetName || typeof targetName !== "string" || !targetName.trim()) return false;
              const cleanTarget = targetName.trim().toLowerCase();
              const isGenericTarget =
                cleanTarget === "subject officer" ||
                cleanTarget === "විෂය නිලධාරී" ||
                cleanTarget === "පවරන ලද විෂය භාර නිලධාරී" ||
                cleanTarget === "assigned subject officer" ||
                cleanTarget === "unassigned";
              const isGenericActive =
                activeNameClean === "subject officer" ||
                activeNameClean === "විෂය නිලධාරී" ||
                activeNameClean === "පවරන ලද විෂය භාර නිලධාරී" ||
                activeNameClean === "assigned subject officer";

              if (isGenericTarget || isGenericActive) return true;

              return (
                cleanTarget === activeNameClean ||
                cleanTarget.includes(activeNameClean) ||
                activeNameClean.includes(cleanTarget)
              );
            };

            if (letters) {
              letters.forEach((l: any) => {
                if (l.ref_no && isOfficerMatched(l.officer_name)) {
                  refToReceivedDate.set(l.ref_no, l.received_date);
                  if (l.letter_date) refToLetterDate.set(l.ref_no, l.letter_date);
                  if (l.created_at) refToCreatedAt.set(l.ref_no, l.created_at);
                  refToMailMeta.set(l.ref_no, { subject: l.subject, priority: l.priority });
                }
              });
            }

            if (assignmentsData) {
              assignmentsData.forEach((a: any) => {
                const asgnOfficer = a.subject_officer_name || a.subjectOfficerName || "";
                const isMatch = isOfficerMatched(asgnOfficer);

                if (a.case_no && isMatch) {
                  if (!refToReceivedDate.has(a.case_no)) {
                    refToReceivedDate.set(a.case_no, new Date().toISOString().split("T")[0]);
                  }
                }
              });
            }

            if (subsequentData) {
              subsequentData.forEach((m: any) => {
                if (m.case_no && isOfficerMatched(m.mail_officer_name)) {
                  if (!refToReceivedDate.has(m.case_no)) {
                    refToReceivedDate.set(m.case_no, m.received_date || new Date().toISOString().split("T")[0]);
                  }
                }
              });
            }

            // 4. Fetch dcmms_subject directly for matching cases
            const { data: directCases } = await supabase
              .from("dcmms_subject")
              .select("*");

            if (directCases) {
              directCases.forEach((item: any) => {
                const sOfficer = item.officer_name || item.assigned_officer || item.subject_officer || item.subject_officer_name || "";
                if (item.case_no && isOfficerMatched(sOfficer)) {
                  if (!refToReceivedDate.has(item.case_no)) {
                    refToReceivedDate.set(item.case_no, item.assigned_date || new Date().toISOString().split("T")[0]);
                  }
                }
              });
            }

            const assignedRefNos = Array.from(refToReceivedDate.keys());

            if (assignedRefNos.length > 0) {
              const { data: casesData, error: casesError } = await supabase
                .from("dcmms_subject")
                .select("*")
                .in("case_no", assignedRefNos)
                .order("case_no", { ascending: true });

              if (casesError) throw casesError;

              // Fetch details to check if there are actions taken
              const { data: detailsData } = await supabase
                .from("dcmms_subject_details")
                .select("case_no")
                .in("case_no", assignedRefNos);

              const casesWithDetails = new Set(detailsData ? detailsData.map((d: any) => d.case_no) : []);
              const fetchedCaseNos = new Set(casesData ? casesData.map((c: any) => c.case_no) : []);

              const mapped: Case[] = [];

              if (casesData) {
                casesData.forEach((item: any) => {
                  mapped.push({
                    id: item.id,
                    caseNo: item.case_no,
                    assignedDate: item.assigned_date,
                    receivedDate: refToReceivedDate.get(item.case_no) || item.assigned_date,
                    letterDate: refToLetterDate.get(item.case_no) || item.letter_date || refToReceivedDate.get(item.case_no) || item.assigned_date,
                    createdAt: item.created_at || refToCreatedAt.get(item.case_no),
                    subject: item.subject,
                    priority: item.priority,
                    status: item.status,
                    isOld: (typeof window !== "undefined" && (() => {
                      try {
                        const localCases = JSON.parse(localStorage.getItem("dcmms_cases") || "[]");
                        const found = localCases.find((lc: any) => lc.caseNo === item.case_no);
                        if (found && found.isOld !== undefined) return found.isOld;
                      } catch (e) {}
                      return casesWithDetails.has(item.case_no) || item.status === "Closed" || item.status === "Pending";
                    })()),
                  });
                });
              }

              // Fallback for ref_nos that are assigned to this officer but don't have a row in dcmms_subject yet
              assignedRefNos.forEach((refNo) => {
                if (!fetchedCaseNos.has(refNo)) {
                  const meta = refToMailMeta.get(refNo) || {};
                  mapped.push({
                    id: `case-${refNo}`,
                    caseNo: refNo,
                    assignedDate: refToReceivedDate.get(refNo) || new Date().toISOString().split("T")[0],
                    receivedDate: refToReceivedDate.get(refNo) || new Date().toISOString().split("T")[0],
                    letterDate: refToLetterDate.get(refNo) || refToReceivedDate.get(refNo) || new Date().toISOString().split("T")[0],
                    createdAt: refToCreatedAt.get(refNo) || new Date().toISOString(),
                    subject: meta.subject || `Assigned Case (${refNo})`,
                    priority: (meta.priority as any) || "medium",
                    status: "In Progress",
                    isOld: casesWithDetails.has(refNo),
                  });
                }
              });

              mapped.sort((a: any, b: any) => {
                const timeA = new Date(a.createdAt || 0).getTime();
                const timeB = new Date(b.createdAt || 0).getTime();
                if (timeA !== timeB) {
                  return timeB - timeA;
                }
                const dateA = new Date(a.letterDate || a.receivedDate || a.assignedDate || 0).getTime();
                const dateB = new Date(b.letterDate || b.receivedDate || b.assignedDate || 0).getTime();
                return dateB - dateA;
              });

              const answerList = collectAnswerLetters(
                letters || [],
                subsequentData || [],
                assignedRefNos,
                activeNameClean,
                isOfficerMatched
              );
              setAssignedAnswerLetters(answerList);
              setCases(mapped);
              return;
            }
          }
        } catch (e) {
          console.error("Failed to fetch cases from Supabase, falling back to localStorage", e);
        }
      }

      // Local storage fallback
      if (typeof window !== "undefined") {
        const storedCases = localStorage.getItem("dcmms_cases");
        const storedLetters = localStorage.getItem("dcmms_letters");
        const storedAsgns = localStorage.getItem("dcmms_subject_assignments");
        let activeName = profile?.full_name || t("subjectName");
        const activeNameClean = activeName.trim().toLowerCase();

        if (storedCases || storedLetters || storedAsgns) {
          try {
            const casesList = storedCases ? JSON.parse(storedCases) : [];
            const lettersList = storedLetters ? JSON.parse(storedLetters) : [];
            const asgnsList = storedAsgns ? JSON.parse(storedAsgns) : [];

            // Filter letters/assignments assigned to the active name
            const refToReceivedDate = new Map<string, string>();

            const refToLetterDate = new Map<string, string>();

            lettersList
              .filter((l: any) => {
                const name = (l.officerName || "").trim().toLowerCase();
                return name === activeNameClean || (name && activeNameClean.includes(name)) || (name && name.includes(activeNameClean));
              })
              .forEach((l: any) => {
                if (l.refNo) {
                  refToReceivedDate.set(l.refNo, l.receivedDate);
                  if (l.letterDate || l.letter_date) {
                    refToLetterDate.set(l.refNo, l.letterDate || l.letter_date);
                  }
                }
              });

            asgnsList
              .filter((a: any) => {
                const name = (a.subjectOfficerName || a.subject_officer_name || "").trim().toLowerCase();
                const asgnText = (typeof a.assignedOfficers === "string" ? a.assignedOfficers : (typeof a.assigned_officers === "string" ? a.assigned_officers : JSON.stringify(a.assignedOfficers || a.assigned_officers || ""))).trim().toLowerCase();
                const chairmanName = (a.chairman?.fullName || a.chairman?.name || "").trim().toLowerCase();
                const memberNames = Array.isArray(a.members) ? a.members.map((m: any) => (m.fullName || m.name || "").trim().toLowerCase()).join(" ") : "";
                const fullText = `${name} ${asgnText} ${chairmanName} ${memberNames}`;

                return (
                  name === activeNameClean || 
                  (name && activeNameClean.includes(name)) || 
                  (name && name.includes(activeNameClean)) ||
                  (activeNameClean && fullText.includes(activeNameClean))
                );
              })
              .forEach((a: any) => {
                const targetCaseNo = a.caseNo || a.case_no;
                if (targetCaseNo && !refToReceivedDate.has(targetCaseNo)) {
                  refToReceivedDate.set(targetCaseNo, new Date().toISOString().split("T")[0]);
                }
              });

            casesList.forEach((c: any) => {
              const cOfficer = (c.assignedTo || c.officerName || c.subjectOfficerName || "").trim().toLowerCase();
              const targetCaseNo = c.caseNo || c.refNo;
              if (targetCaseNo && (cOfficer === activeNameClean || (cOfficer && activeNameClean.includes(cOfficer)) || (cOfficer && cOfficer.includes(activeNameClean)))) {
                if (!refToReceivedDate.has(targetCaseNo)) {
                  refToReceivedDate.set(targetCaseNo, c.targetDate || c.assignedDate || new Date().toISOString().split("T")[0]);
                }
              }
            });

            if (refToReceivedDate.size === 0) {
              casesList.forEach((c: any) => {
                const targetCaseNo = c.caseNo || c.refNo;
                if (targetCaseNo) refToReceivedDate.set(targetCaseNo, c.targetDate || c.assignedDate || new Date().toISOString().split("T")[0]);
              });
            }

            const finalRefNos = Array.from(refToReceivedDate.keys());

            // Check actions in localStorage
            const storedActions = localStorage.getItem("dcmms_new_letter_current_case") || "[]";
            let actionsList = [];
            try { actionsList = JSON.parse(storedActions); } catch (e) { }
            const casesWithActions = new Set(
              Array.isArray(actionsList)
                ? actionsList.map((a: any) => a.caseNo)
                : []
            );

            // Filter cases matching finalRefNos or load casesList
            const existingCaseNos = new Set(casesList.map((c: any) => c.caseNo));
            let filtered = casesList
              .filter((c: any) => finalRefNos.length === 0 || finalRefNos.includes(c.caseNo) || finalRefNos.includes(c.refNo))
              .map((c: any) => ({
                ...c,
                receivedDate: refToReceivedDate.get(c.caseNo) || c.assignedDate,
                letterDate: refToLetterDate.get(c.caseNo) || c.letterDate || c.letter_date || refToReceivedDate.get(c.caseNo) || c.assignedDate,
                isOld: c.isOld !== undefined ? c.isOld : (casesWithActions.has(c.caseNo) || c.status === "Closed" || c.status === "Pending"),
              }));

            if (filtered.length === 0 && casesList.length > 0) {
              filtered = casesList.map((c: any) => ({
                ...c,
                receivedDate: c.assignedDate || new Date().toISOString().split("T")[0],
                letterDate: c.letterDate || c.assignedDate || new Date().toISOString().split("T")[0],
              }));
            }

            // Fallback for missing cases in localStorage
            finalRefNos.forEach((refNo) => {
              if (!existingCaseNos.has(refNo)) {
                const matchingLetter = lettersList.find((l: any) => l.refNo === refNo);
                filtered.push({
                  id: `case-${refNo}`,
                  caseNo: refNo,
                  assignedDate: refToReceivedDate.get(refNo) || new Date().toISOString().split("T")[0],
                  receivedDate: refToReceivedDate.get(refNo) || new Date().toISOString().split("T")[0],
                  letterDate: refToLetterDate.get(refNo) || matchingLetter?.letterDate || matchingLetter?.letter_date || refToReceivedDate.get(refNo) || new Date().toISOString().split("T")[0],
                  subject: matchingLetter?.subject || `Assigned Case (${refNo})`,
                  priority: matchingLetter?.priority || "medium",
                  status: "In Progress",
                  isOld: casesWithActions.has(refNo),
                });
              }
            });

            if (filtered.length === 0) {
              filtered = [
                {
                  id: "case-INQ/2026/001",
                  caseNo: "INQ/2026/001",
                  assignedDate: "2026-07-28",
                  receivedDate: "2026-07-28",
                  letterDate: "2026-07-28",
                  subject: "Formal disciplinary inquiry - Student misconduct at Royal College",
                  priority: "high",
                  status: "In Progress",
                  isOld: true,
                },
                {
                  id: "case-INQ/2026/002",
                  caseNo: "INQ/2026/002",
                  assignedDate: "2026-08-05",
                  receivedDate: "2026-08-05",
                  letterDate: "2026-08-05",
                  subject: "Preliminary investigation on teacher absenteeism - Jaffna Office",
                  priority: "medium",
                  status: "In Progress",
                  isOld: false,
                },
                {
                  id: "case-INQ/2026/003",
                  caseNo: "INQ/2026/003",
                  assignedDate: "2026-08-12",
                  receivedDate: "2026-08-12",
                  letterDate: "2026-08-12",
                  subject: "Inquiry into safety guidelines violation - Annual Sports Meet",
                  priority: "low",
                  status: "In Progress",
                  isOld: false,
                },
              ];
            }

            filtered.sort((a: any, b: any) => {
              const timeA = new Date(a.createdAt || a.created_at || 0).getTime();
              const timeB = new Date(b.createdAt || b.created_at || 0).getTime();
              if (timeA !== timeB) {
                return timeB - timeA;
              }
              const dateA = new Date(a.letterDate || a.receivedDate || a.assignedDate || 0).getTime();
              const dateB = new Date(b.letterDate || b.receivedDate || b.assignedDate || 0).getTime();
              return dateB - dateA;
            });
            const fallbackAnswerList = collectAnswerLetters(
              lettersList || [],
              [],
              finalRefNos,
              activeNameClean,
              (targetName) => {
                if (!activeNameClean) return true;
                if (!targetName || typeof targetName !== "string" || !targetName.trim()) return false;
                const cleanTarget = targetName.trim().toLowerCase();
                return cleanTarget === activeNameClean || cleanTarget.includes(activeNameClean) || activeNameClean.includes(cleanTarget);
              }
            );
            setAssignedAnswerLetters(fallbackAnswerList);
            setCases(filtered);
          } catch (e) {
            console.error("Error parsing localStorage fallback data");
          }
        }
      }
    };

    const fetchRecommendations = async () => {
      let recList: any[] = [];
      try {
        const recsRes = await getRecommendationsListServer();
        if (recsRes?.success && Array.isArray(recsRes.data)) {
          recList = recsRes.data.map((r: any) => ({
            id: r.id,
            caseNo: r.caseNo || r.case_no,
            letterNo: r.letterNo || r.letter_no,
            category: r.category || "issuing_charge_sheet",
            urgency: r.urgency || "normal",
            title: r.title || "Preliminary Investigation Recommendation",
            recommendationText: r.recommendationText || r.recommendation_text || "",
            disciplinaryAction: r.disciplinaryAction || r.disciplinary_action || "",
            forwardTo: r.forwardTo || r.forward_to || "disciplinary_branch",
            targetDate: r.targetDate ? String(r.targetDate).slice(0, 10) : "",
            referenceNotes: r.referenceNotes || r.reference_notes || "",
            issuedChargeSheet: r.issuedChargeSheet || r.issued_charge_sheet || "",
            chargeSheetIssuedDate: r.chargeSheetIssuedDate ? String(r.chargeSheetIssuedDate).slice(0, 10) : "",
            chargeSheetResponseDate: r.chargeSheetResponseDate ? String(r.chargeSheetResponseDate).slice(0, 10) : "",
            disciplinaryOrder: r.disciplinaryOrder || r.disciplinary_order || "",
            secretaryApprovalDate: r.secretaryApprovalDate ? String(r.secretaryApprovalDate).slice(0, 10) : "",
            secretaryApprovedRecommendation: r.secretaryApprovedRecommendation || r.secretary_approved_recommendation || "",
            status: r.status || "Submitted",
            submittedAt: r.submittedAt || r.createdAt || "",
            updatedAt: r.updatedAt || r.createdAt || "",
            createdAt: r.createdAt || "",
          }));
        }
      } catch (err) {
        console.error("Error fetching recommendations from PostgreSQL:", err);
      }

      if (typeof window !== "undefined") {
        try {
          const storedRecs = localStorage.getItem("dcmms_recommendations");
          if (storedRecs) {
            const localList = JSON.parse(storedRecs);
            if (Array.isArray(localList)) {
              localList.forEach((lr: any) => {
                const cNo = (lr.caseNo || lr.case_no || "").trim().toLowerCase();
                const existingIdx = recList.findIndex((r: any) => (r.caseNo || r.case_no || "").trim().toLowerCase() === cNo);
                const item = {
                  id: lr.id || `rec-${lr.caseNo || lr.case_no}`,
                  caseNo: lr.caseNo || lr.case_no,
                  letterNo: lr.letterNo || lr.letter_no,
                  category: lr.category || "issuing_charge_sheet",
                  urgency: lr.urgency || "normal",
                  title: lr.title || "Preliminary Investigation Recommendation",
                  recommendationText: lr.recommendationText || lr.recommendation_text || "",
                  disciplinaryAction: lr.disciplinaryAction || lr.disciplinary_action || "",
                  forwardTo: lr.forwardTo || lr.forward_to || "disciplinary_branch",
                  targetDate: lr.targetDate || lr.target_date || "",
                  referenceNotes: lr.referenceNotes || lr.reference_notes || "",
                  issuedChargeSheet: lr.issuedChargeSheet || lr.issued_charge_sheet || "",
                  chargeSheetIssuedDate: lr.chargeSheetIssuedDate || lr.charge_sheet_issued_date || "",
                  chargeSheetResponseDate: lr.chargeSheetResponseDate || lr.charge_sheet_response_date || "",
                  disciplinaryOrder: lr.disciplinaryOrder || lr.disciplinary_order || "",
                  secretaryApprovalDate: lr.secretaryApprovalDate || lr.secretary_approval_date || lr.date_approved_by_secretary || "",
                  secretaryApprovedRecommendation: lr.secretaryApprovedRecommendation || lr.secretary_approved_recommendation || lr.recommendation_approved_by_secretary || "",
                  status: lr.status || "Submitted",
                  submittedAt: lr.submittedAt || lr.submitted_at || lr.updatedAt || "",
                  updatedAt: lr.updatedAt || lr.updated_at || "",
                  createdAt: lr.createdAt || lr.created_at || "",
                };
                if (existingIdx >= 0) {
                  recList[existingIdx] = { ...recList[existingIdx], ...item };
                } else {
                  recList.push(item);
                }
              });
            }
          }
        } catch (e) {
          console.error("Error parsing local recommendations:", e);
        }
      }

      // Enrich recommendations with accused / complainant / subject details
      if (typeof window !== "undefined") {
        try {
          const storedCases = JSON.parse(localStorage.getItem("dcmms_cases") || "[]");
          const storedLetters = JSON.parse(localStorage.getItem("dcmms_letters") || "[]");
          const storedDailyMail = JSON.parse(localStorage.getItem("dcmms_daily_mail") || "[]");
          const storedAccused = JSON.parse(localStorage.getItem("dcmms_accused_officers") || "[]");
          const storedConcerned = JSON.parse(localStorage.getItem("dcmms_concerned_officers") || "[]");

          recList = recList.map((r: any) => {
            const cNo = (r.caseNo || "").trim().toLowerCase();
            const foundCase = Array.isArray(storedCases) ? storedCases.find((c: any) => (c.caseNo || "").trim().toLowerCase() === cNo) : null;
            const foundLetter = Array.isArray(storedLetters) ? storedLetters.find((l: any) => (l.refNo || "").trim().toLowerCase() === cNo) : null;
            const foundMail = Array.isArray(storedDailyMail) ? storedDailyMail.find((m: any) => (m.ref_no || m.refNo || "").trim().toLowerCase() === cNo) : null;
            const foundAcc = Array.isArray(storedAccused) ? storedAccused.find((a: any) => (a.ref_number || a.refNumber || a.case_no || "").trim().toLowerCase() === cNo) : null;
            const foundConc = Array.isArray(storedConcerned) ? storedConcerned.find((c: any) => (c.case_no || c.subject_file_number || "").trim().toLowerCase() === cNo) : null;

            return {
              ...r,
              subject: r.subject || foundCase?.subject || foundLetter?.subject || foundMail?.subject || "",
              accusedName: r.accusedName || foundAcc?.accused_officer_name || foundAcc?.officer_name || foundConc?.officer_name || foundConc?.full_name || foundCase?.accusedName || "",
              accusedDesignation: r.accusedDesignation || foundAcc?.position || foundConc?.position || foundCase?.accusedDesignation || "",
              schoolName: r.schoolName || foundAcc?.accused_school_name || foundAcc?.school_name || foundConc?.institute_name || foundMail?.institute_name || "",
              complainantName: r.complainantName || foundMail?.sender_name || foundLetter?.senderName || foundAcc?.name_of_the_presenting_the_complain || "",
            };
          });
        } catch (e) {}
      }

      setRecommendations(recList);
    };

    fetchCases();
    fetchRecommendations();

    const handleSyncAll = () => {
      fetchCases();
      fetchRecommendations();
      if (typeof fetchAssignments === "function") {
        fetchAssignments();
      }
    };

    const channel = supabase
      .channel("subject-realtime-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_subject" }, handleSyncAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_daily_mail" }, handleSyncAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_subject_assignments" }, handleSyncAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_subsequent_mails" }, handleSyncAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_recommendations" }, handleSyncAll)
      .subscribe();

    const interval = setInterval(handleSyncAll, 15_000);


    const handleStorageEvent = (e: StorageEvent) => {
      if (
        e.key === "dcmms_subject_assignments" ||
        e.key === "dcmms_cases" ||
        e.key === "dcmms_letters" ||
        e.key === "dcmms_subsequent_mails" ||
        e.key === "dcmms_recommendations" ||
        e.key === "dcmms_new_mail_current_case"
      ) {
        handleSyncAll();
      }
    };

    window.addEventListener("storage", handleStorageEvent);
    window.addEventListener("dcmms_assignment_updated", handleSyncAll);
    window.addEventListener("dcmms_recommendation_updated", handleSyncAll);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageEvent);
      window.removeEventListener("dcmms_assignment_updated", handleSyncAll);
      window.removeEventListener("dcmms_recommendation_updated", handleSyncAll);
    };
  }, [profile, t]);

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<"cases" | "answer_letters" | "recommendations" | "conducting_inquiry" | "disciplinary_inspection">("cases");
  const [assignedAnswerLetters, setAssignedAnswerLetters] = useState<any[]>([]);
  const [answerSearchQuery, setAnswerSearchQuery] = useState("");

  // Sync tab and search from URL search parameters if provided
  useEffect(() => {
    if (tabParam) {
      if (["cases", "answer_letters", "recommendations", "conducting_inquiry", "disciplinary_inspection"].includes(tabParam)) {
        setActiveTab(tabParam as any);
      }
    }
    if (caseNoParam && tabParam === "disciplinary_inspection") {
      setInspectionSearchQuery(caseNoParam);
    }
  }, [tabParam, caseNoParam]);

  // Conducting an Inquiry state
  const [inquirySearchQuery, setInquirySearchQuery] = useState("");
  const [inquiryStageFilter, setInquiryStageFilter] = useState("all");
  const [inquiryPriorityFilter, setInquiryPriorityFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [selectedInquiryModal, setSelectedInquiryModal] = useState<any | null>(null);

  // Proper Disciplinary Inspection state
  const [inspectionSearchQuery, setInspectionSearchQuery] = useState("");
  const [inspectionStageFilter, setInspectionStageFilter] = useState("all");
  const [inspectionPriorityFilter, setInspectionPriorityFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [selectedInspectionModal, setSelectedInspectionModal] = useState<any | null>(null);

  // Investigation Recommendations state
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recSearchQuery, setRecSearchQuery] = useState("");
  const [recCategoryFilter, setRecCategoryFilter] = useState("all");
  const [recUrgencyFilter, setRecUrgencyFilter] = useState("all");
  const [recStatusFilter, setRecStatusFilter] = useState("all");
  const [selectedRecModal, setSelectedRecModal] = useState<any | null>(null);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "high" | "medium" | "low">("all");

  // Subject Officer Assignment Data Flow State & Handlers
  const [assignments, setAssignments] = useState<any[]>([]);
  const [draftDates, setDraftDates] = useState<Record<string, { appointmentDate?: string; reportDueDate?: string }>>({});
  const draftDatesRef = useRef<Record<string, { appointmentDate?: string; reportDueDate?: string }>>({});

  useEffect(() => {
    draftDatesRef.current = draftDates;
  }, [draftDates]);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [activeAssignment, setActiveAssignment] = useState<any>(null);
  const [reportDateForm, setReportDateForm] = useState(new Date().toISOString().slice(0, 10));
  const [reportContentForm, setReportContentForm] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [isDirectivesSectionMinimized, setIsDirectivesSectionMinimized] = useState(true);
  const [minimizedCaseIds, setMinimizedCaseIds] = useState<Record<string, boolean>>({});
  const [seenNotifIds, setSeenNotifIds] = useState<string[]>([]);
  const [notifFilter, setNotifFilter] = useState<"all" | "unread" | "action" | "completed">("all");
  const [dropdownNotifFilter, setDropdownNotifFilter] = useState<"all" | "unread">("all");
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("dcmms_subject_seen_notifs");
        if (stored) {
          setSeenNotifIds(JSON.parse(stored));
        }
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target as Node)) {
        setIsNotifDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const allSeparateNotifs = useMemo(() => {
    return buildSeparateNotifications(assignments, lang);
  }, [assignments, lang]);

  const [expandedNotifIds, setExpandedNotifIds] = useState<Record<string, boolean>>({});

  const toggleNotifExpand = (notifId: string) => {
    setExpandedNotifIds((prev) => ({
      ...prev,
      [notifId]: !prev[notifId]
    }));
  };

  const markAsSeen = (id: string) => {
    if (!id) return;
    setSeenNotifIds((prev) => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("dcmms_subject_seen_notifs", JSON.stringify(updated));
        } catch (e) {}
      }
      return updated;
    });
  };

  const markAllAsSeen = () => {
    const allNotifIds = allSeparateNotifs.map((n: SeparateNotification) => n.id);
    const allCaseNos = assignments.map((a) => a.caseNo).filter(Boolean);
    const combined = Array.from(new Set([...seenNotifIds, ...allNotifIds, ...allCaseNos]));
    setSeenNotifIds(combined);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("dcmms_subject_seen_notifs", JSON.stringify(combined));
      } catch (e) {}
    }
  };

  const unreadCount = allSeparateNotifs.filter((n: SeparateNotification) => {
    return !seenNotifIds.includes(n.id) && !seenNotifIds.includes(n.caseNo);
  }).length;

  const unseenCount = unreadCount;

  const actionRequiredCount = allSeparateNotifs.filter((n: SeparateNotification) => n.isActionRequired).length;

  const completedCount = allSeparateNotifs.filter((n: SeparateNotification) => n.isCompleted).length;

  const filteredNotifs = allSeparateNotifs.filter((n: SeparateNotification) => {
    if (notifFilter === "unread") {
      return !seenNotifIds.includes(n.id) && !seenNotifIds.includes(n.caseNo);
    }
    if (notifFilter === "action") {
      return n.isActionRequired;
    }
    if (notifFilter === "completed") {
      return n.isCompleted;
    }
    return true;
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  const fetchAssignments = async () => {
    let list: any[] = [];
    if (isSupabaseConfigured) {
      try {
        const { data: dbAsgns } = await supabase.from("dcmms_subject_assignments").select("*");
        const { data: dbDetails } = await supabase.from("dcmms_subject_details").select("*");

        const detailsByCase: Record<string, any> = {};
        if (dbDetails && dbDetails.length > 0) {
          dbDetails.forEach((d: any) => {
            const cNo = d.case_no || d.ref_no;
            if (cNo && (d.report_state === "Committee Details Sent" || d.special_notes?.includes("Chairman:") || d.step_taken?.includes("Chairman:"))) {
              detailsByCase[cNo] = d;
            }
          });
        }

        if (dbAsgns && dbAsgns.length > 0) {
          // Deduplicate by case_no: keep the row with the latest updated_at (fixes duplicate rows from mixed upsert strategies)
          const deduped = new Map<string, any>();
          dbAsgns.forEach((a: any) => {
            const key = String(a.case_no || a.caseNo || "").trim().toLowerCase();
            if (!key) return;
            const existing = deduped.get(key);
            if (!existing) {
              deduped.set(key, a);
            } else {
              const existingTime = new Date(existing.updated_at || existing.created_at || 0).getTime();
              const newTime = new Date(a.updated_at || a.created_at || 0).getTime();
              if (newTime >= existingTime) deduped.set(key, a);
            }
          });

          list = Array.from(deduped.values()).map((a: any) => {
            const caseNo = a.case_no || a.caseNo;
            const det = detailsByCase[caseNo];

            let rawOfficers = a.assigned_officers || a.assignedOfficers || "";
            let text = Array.isArray(rawOfficers) ? rawOfficers.filter(Boolean).join(" | ") : String(rawOfficers || "");
            let chairman = a.chairman;
            let members = a.members;

            if (!text && det) {
              text = det.special_notes || det.step_taken || "";
            }

            if (!text && (chairman || members)) {
              const chairmanPart = chairman ? `Chairman: ${chairman.fullName || chairman.name}` : "";
              const membersPart = Array.isArray(members) && members.length > 0 ? `Members: ${members.map((m: any) => m.fullName || m.name).join(", ")}` : "";
              text = [chairmanPart, membersPart].filter(Boolean).join(" | ");
            }

            return {
              id: a.id,
              caseNo,
              subjectOfficerName: a.subject_officer_name || a.subjectOfficerName || det?.subject_officer_name || det?.officer_name,
              assignedOfficers: text,
              chairman: chairman,
              members: members,
              appointmentDate: formatToInputDate(a.appointment_date || a.appointmentDate),
              reportDueDate: formatToInputDate(a.report_due_date || a.reportDueDate),
              extensionTerm: a.extension_term || a.extensionTerm,
              extensionStartDate: a.extension_start_date || a.extensionStartDate,
              extensionEndDate: a.extension_end_date || a.extensionEndDate,
              extensionApprovalStatus: a.extension_approval_status || a.extensionApprovalStatus,
              extensionDecisionDate: a.extension_decision_date || a.extensionDecisionDate,
              extensionRequestedByAdmin: !!(a.extension_requested_by_admin || a.extensionRequestedByAdmin),
              extensionSubmittedBySubject: !!(a.extension_submitted_by_subject || a.extensionSubmittedBySubject),
              certificationSubmitted: a.certification_submitted || a.certificationSubmitted,
              reportSubmitDate: a.report_submit_date || a.reportSubmitDate,
              reportContent: a.report_content || a.reportContent,
              afterInvestigationSent: a.after_investigation_sent || a.afterInvestigationSent,
              afterInvestigationDate: a.after_investigation_date || a.afterInvestigationDate,
              investigationFileNo: a.investigation_file_no || a.investigationFileNo,
              investigationStatus: a.investigation_status || a.investigationStatus,
              investigationNotes: a.investigation_notes || a.investigationNotes,
              progressDetails: a.progress_details || a.progressDetails,
              initialInvestigationComplete: !!(a.initial_investigation_complete || a.initialInvestigationComplete || a.status === "Informing Officer In Charge - Initial Investigation Complete"),
              initialInvestigationCompletedAt: a.initial_investigation_completed_at || a.initialInvestigationCompletedAt || null,
              status: a.status,
              datesSubmittedBySubject: !!((a.appointment_date || a.appointmentDate) && (a.report_due_date || a.reportDueDate)),
            };
          });
        }

        if (dbDetails && dbDetails.length > 0) {
          dbDetails.forEach((d: any) => {
            const cNo = d.case_no || d.ref_no;
            if (cNo && (d.report_state === "Committee Details Sent" || d.special_notes?.includes("Chairman:") || d.step_taken?.includes("Chairman:"))) {
              const idx = list.findIndex((a) => a.caseNo === cNo);
              if (idx < 0) {
                list.push({
                  id: `asgn-${cNo}`,
                  caseNo: cNo,
                  subjectOfficerName: d.subject_officer_name || d.officer_name || "Subject Officer",
                  assignedOfficers: d.special_notes || d.step_taken || "",
                  chairman: null,
                  members: [],
                  status: "Committee Details Sent to Subject Officer",
                  committeeSent: true,
                  datesSubmittedBySubject: false,
                });
              }
            }
          });
        }

        try {
          const { data: extRows } = await supabase.from("case_by_date_extention").select("*");
          if (extRows && extRows.length > 0) {
            extRows.forEach((ext: any) => {
              const fileNo = String(ext.subject_file_no || ext.sub_file_no || "").trim().toLowerCase();
              if (!fileNo) return;
              const idx = list.findIndex((a: any) => String(a.caseNo || a.case_no || "").trim().toLowerCase() === fileNo);
              if (idx >= 0) {
                if (ext.approval_status) list[idx].extensionApprovalStatus = ext.approval_status;
                if (ext.decision_date) list[idx].extensionDecisionDate = ext.decision_date;
                if (ext.extention_term) list[idx].extensionTerm = ext.extention_term;
                if (ext.start_date) list[idx].extensionStartDate = ext.start_date;
                if (ext.end_date) list[idx].extensionEndDate = ext.end_date;
              }
            });
          }
        } catch (e) {}
      } catch (e) {}
    }

    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("dcmms_subject_assignments");
        if (stored) {
          const localList = JSON.parse(stored);
          if (Array.isArray(localList)) {
            localList.forEach((la: any) => {
              let text = la.assignedOfficers || la.assigned_officers || "";
              if (!text && (la.chairman || la.members)) {
                const chairmanPart = la.chairman ? `Chairman: ${la.chairman.fullName || la.chairman.name}` : "";
                const membersPart = Array.isArray(la.members) && la.members.length > 0 ? `Members: ${la.members.map((m: any) => m.fullName || m.name).join(", ")}` : "";
                text = [chairmanPart, membersPart].filter(Boolean).join(" | ");
              }
              const targetCaseNo = String(la.caseNo || la.case_no || "").trim().toLowerCase();
              const idx = list.findIndex((a) => String(a.caseNo || a.case_no || "").trim().toLowerCase() === targetCaseNo);
              
              const normExtTerm = la.extensionTerm || la.extension_term;
              const normExtStart = la.extensionStartDate || la.extension_start_date;
              const normExtEnd = la.extensionEndDate || la.extension_end_date;
              const normExtApproval = la.extensionApprovalStatus || la.extension_approval_status;
              const normExtReq = la.extensionRequestedByAdmin !== undefined ? la.extensionRequestedByAdmin : la.extension_requested_by_admin;
              const normInitialComplete = la.initialInvestigationComplete !== undefined ? la.initialInvestigationComplete : la.initial_investigation_complete;

              if (idx >= 0) {
                list[idx] = { 
                  ...list[idx], 
                  ...la, 
                  assignedOfficers: text || list[idx].assignedOfficers,
                  appointmentDate: formatToInputDate(la.appointmentDate || la.appointment_date || list[idx].appointmentDate),
                  reportDueDate: formatToInputDate(la.reportDueDate || la.report_due_date || list[idx].reportDueDate),
                  extensionTerm: normExtTerm || list[idx].extensionTerm,
                  extensionStartDate: normExtStart || list[idx].extensionStartDate,
                  extensionEndDate: normExtEnd || list[idx].extensionEndDate,
                  extensionApprovalStatus: normExtApproval !== undefined ? normExtApproval : list[idx].extensionApprovalStatus,
                  extensionRequestedByAdmin: normExtReq !== undefined ? !!normExtReq : list[idx].extensionRequestedByAdmin,
                  initialInvestigationComplete: normInitialComplete !== undefined ? !!normInitialComplete : (list[idx].initialInvestigationComplete || list[idx].status === "Informing Officer In Charge - Initial Investigation Complete"),
                  initialInvestigationCompletedAt: la.initialInvestigationCompletedAt || la.initial_investigation_completed_at || list[idx].initialInvestigationCompletedAt,
                };
              } else {
                list.push({ 
                  ...la, 
                  caseNo: la.caseNo || la.case_no,
                  assignedOfficers: text,
                  appointmentDate: formatToInputDate(la.appointmentDate || la.appointment_date),
                  reportDueDate: formatToInputDate(la.reportDueDate || la.report_due_date),
                  extensionTerm: normExtTerm,
                  extensionStartDate: normExtStart,
                  extensionEndDate: normExtEnd,
                  extensionApprovalStatus: normExtApproval,
                  extensionRequestedByAdmin: !!normExtReq,
                  initialInvestigationComplete: !!(normInitialComplete || la.status === "Informing Officer In Charge - Initial Investigation Complete"),
                  initialInvestigationCompletedAt: la.initialInvestigationCompletedAt || la.initial_investigation_completed_at || null,
                });
              }
            });
          }
        }
      } catch (e) {}
    }

    let activeName = profile?.full_name || t("subjectName");
    const activeNameClean = (activeName || "").trim().toLowerCase();

    // Auto-synthesize assignment directives from dcmms_cases / cases state if not in list
    if (typeof window !== "undefined") {
      try {
        const storedCases = localStorage.getItem("dcmms_cases");
        if (storedCases) {
          const casesList = JSON.parse(storedCases);
          if (Array.isArray(casesList)) {
            casesList.forEach((c: any) => {
              const targetCaseNo = String(c.caseNo || c.refNo || "").trim().toLowerCase();
              const idx = list.findIndex((a: any) => String(a.caseNo || a.case_no || "").trim().toLowerCase() === targetCaseNo);
              const extTerm = c.extensionTerm || c.extension_term;
              const extStart = c.extensionStartDate || c.extension_start_date;
              const extEnd = c.extensionEndDate || c.extension_end_date;
              const extReq = c.extensionRequested || c.extensionRequestedByAdmin || c.extension_requested_by_admin;
              const extApprove = c.extensionApprovalStatus || c.extension_approval_status;
              const extDate = c.extensionDecisionDate || c.extension_decision_date;

              if (idx >= 0) {
                const isPendingInList = list[idx].extensionApprovalStatus === "Pending";
                // Always override if incoming is a new Pending extension request
                const incomingIsPending = extApprove === "Pending";
                const shouldUpdate = incomingIsPending || !isPendingInList;
                if (extTerm && (!list[idx].extensionTerm || shouldUpdate)) list[idx].extensionTerm = extTerm;
                if (extStart && (!list[idx].extensionStartDate || shouldUpdate)) list[idx].extensionStartDate = extStart;
                if (extEnd && (!list[idx].extensionEndDate || shouldUpdate)) {
                  list[idx].extensionEndDate = extEnd;
                  if (incomingIsPending) list[idx].reportDueDate = extEnd;
                }
                if (extReq && shouldUpdate) list[idx].extensionRequestedByAdmin = true;
                if (extApprove && shouldUpdate) list[idx].extensionApprovalStatus = extApprove;
                if (extDate && !incomingIsPending) list[idx].extensionDecisionDate = extDate;
              } else if (targetCaseNo && (c.assignedOfficers || c.chairman || c.members || c.committeeDetails || c.status === "Committee Details Sent" || extReq || extStart)) {
                const chairmanPart = c.chairman ? `Chairman: ${c.chairman.fullName || c.chairman.name}` : "";
                const membersPart = Array.isArray(c.members) && c.members.length > 0 ? `Members: ${c.members.map((m: any) => m.fullName || m.name).join(", ")}` : "";
                const formattedText = c.assignedOfficers || [chairmanPart, membersPart].filter(Boolean).join(" | ") || "Investigation Committee Assigned";
                list.push({
                  id: `asgn-${c.caseNo || c.refNo}`,
                  caseNo: c.caseNo || c.refNo,
                  subjectOfficerName: c.subjectOfficerName || c.assignedTo || c.subjectOfficer || activeName || "Subject Officer",
                  assignedOfficers: formattedText,
                  chairman: c.chairman || null,
                  members: c.members || [],
                  extensionTerm: extTerm,
                  extensionStartDate: extStart,
                  extensionEndDate: extEnd,
                  appointmentDate: formatToInputDate(c.appointmentDate || c.appointment_date),
                  reportDueDate: formatToInputDate(extEnd || c.reportDueDate || c.report_due_date),
                  extensionApprovalStatus: extApprove || "Approved",
                  extensionDecisionDate: extDate,
                  extensionRequestedByAdmin: !!extReq,
                  status: c.status || "Committee Details Sent to Subject Officer",
                  committeeSent: true,
                  datesSubmittedBySubject: false,
                });
              }
            });
          }
        }
      } catch (e) {}

      try {
        const storedLetters = localStorage.getItem("dcmms_letters");
        if (storedLetters) {
          const lettersList = JSON.parse(storedLetters);
          if (Array.isArray(lettersList)) {
            lettersList.forEach((l: any) => {
              const targetCaseNo = String(l.refNo || l.caseNo || "").trim().toLowerCase();
              const extTerm = l.extensionTerm || l.extension_term;
              const extStart = l.extensionStartDate || l.extension_start_date;
              const extEnd = l.extensionEndDate || l.extension_end_date;
              const extReq = l.extensionRequested || l.extensionRequestedByAdmin || l.extension_requested_by_admin;
              const extApprove = l.extensionApprovalStatus || l.extension_approval_status;
              const extDate = l.extensionDecisionDate || l.extension_decision_date;

              if (targetCaseNo && (extTerm || extStart || extReq || extEnd)) {
                const idx = list.findIndex((a: any) => String(a.caseNo || a.case_no || "").trim().toLowerCase() === targetCaseNo);
                if (idx >= 0) {
                  const isPendingInList = list[idx].extensionApprovalStatus === "Pending";
                  // Always override if incoming is a new Pending extension request
                  const incomingIsPending = extApprove === "Pending";
                  const shouldUpdate = incomingIsPending || !isPendingInList;
                  if (extTerm && (!list[idx].extensionTerm || shouldUpdate)) list[idx].extensionTerm = extTerm;
                  if (extStart && (!list[idx].extensionStartDate || shouldUpdate)) list[idx].extensionStartDate = extStart;
                  if (extEnd && (!list[idx].extensionEndDate || shouldUpdate)) {
                    list[idx].extensionEndDate = extEnd;
                    if (incomingIsPending) list[idx].reportDueDate = extEnd;
                  }
                  if (extReq && shouldUpdate) list[idx].extensionRequestedByAdmin = true;
                  if (extApprove && shouldUpdate) list[idx].extensionApprovalStatus = extApprove;
                  if (extDate && !incomingIsPending) list[idx].extensionDecisionDate = extDate;
                }
              }
            });
          }
        }
      } catch (e) {}
    }

    if (list.length > 0) {
      const relevant = list.filter((a: any) => {
        const asgnOfficers = a.assignedOfficers || a.assigned_officers;
        const hasArrayOfficers = Array.isArray(asgnOfficers) && asgnOfficers.length > 0;
        const hasStringOfficers = typeof asgnOfficers === "string" && asgnOfficers.trim().length > 0 && asgnOfficers.trim() !== "[]" && asgnOfficers.trim() !== "null";
        const hasChairman = !!(a.chairman?.fullName || a.chairman?.name || (typeof a.chairman === "string" && a.chairman.trim().length > 0));
        const hasMembers = Array.isArray(a.members) && a.members.length > 0;
        const hasDatesOrAdminFlag = !!(a.officersAssignedByAdmin || a.appointmentDate || a.reportDueDate || a.appointment_date || a.report_due_date || a.committeeSent || a.committee_sent || a.status || a.extensionStartDate || a.extension_start_date || a.extensionTerm || a.extension_term || a.extensionRequestedByAdmin);

        const hasOfficersAssigned = hasArrayOfficers || hasStringOfficers || hasChairman || hasMembers || hasDatesOrAdminFlag;

        if (!hasOfficersAssigned) return false;

        const officer = (a.subjectOfficerName || a.subject_officer_name || "").trim().toLowerCase();

        const isGenericOfficer =
          !officer ||
          officer === "subject officer" ||
          officer === "විෂය නිලධාරී" ||
          officer === "පවරන ලද විෂය භාර නිලධාරී" ||
          officer === "assigned subject officer" ||
          officer === "unassigned";

        const isGenericActive =
          !activeNameClean ||
          activeNameClean === "subject officer" ||
          activeNameClean === "විෂය නිලධාරී" ||
          activeNameClean === "පවරන ලද විෂය භාර නිලධාරී" ||
          activeNameClean === "assigned subject officer";

        const hasExtensionDetails = !!(
          a.extensionRequestedByAdmin ||
          a.extension_requested_by_admin ||
          a.extensionRequested ||
          a.extensionStartDate ||
          a.extension_start_date ||
          a.extensionEndDate ||
          a.extension_end_date ||
          (a.extensionTerm && a.extensionTerm !== "None") ||
          (a.extension_term && a.extension_term !== "None") ||
          a.extensionApprovalStatus ||
          a.extension_approval_status ||
          (a.status && String(a.status).toLowerCase().includes("extension"))
        );

        if (hasExtensionDetails || isGenericOfficer || isGenericActive) return true;

        return (
          officer === activeNameClean ||
          officer.includes(activeNameClean) ||
          activeNameClean.includes(officer)
        );
      });

      const mergedRelevant = relevant.map((a: any) => {
        const caseKey = a.caseNo || a.id;
        const currentDrafts = draftDatesRef.current;
        const draft = (caseKey && currentDrafts[caseKey]) || (a.id && currentDrafts[a.id]) || (a.caseNo && currentDrafts[a.caseNo]);
        const appt = draft?.appointmentDate !== undefined ? draft.appointmentDate : formatToInputDate(a.appointmentDate || a.appointment_date);
        const due = draft?.reportDueDate !== undefined ? draft.reportDueDate : formatToInputDate(a.reportDueDate || a.report_due_date);
        return {
          ...a,
          appointmentDate: appt,
          reportDueDate: due,
        };
      });

      const deduplicatedAssignments: any[] = [];
      const indexByCase = new Map<string, number>();

      mergedRelevant.forEach((item: any) => {
        const caseKey = String(item.caseNo || item.case_no || item.id || "").trim().toLowerCase();
        if (!caseKey) {
          deduplicatedAssignments.push(item);
          return;
        }
        if (indexByCase.has(caseKey)) {
          const existingIdx = indexByCase.get(caseKey)!;
          const existingItem = deduplicatedAssignments[existingIdx];

          // Prefer item with Pending extension (new request) over approved/non-pending
          const itemIsPendingExt = item.extensionApprovalStatus === "Pending";
          const existingIsPendingExt = existingItem.extensionApprovalStatus === "Pending";

          // Prefer newer item by updatedAt
          const itemTime = new Date(item.updatedAt || item.updatedAt || item.createdAt || 0).getTime();
          const existingTime = new Date(existingItem.updatedAt || existingItem.createdAt || 0).getTime();

          if (itemIsPendingExt && !existingIsPendingExt) {
            // New extension request wins over non-pending
            deduplicatedAssignments[existingIdx] = { ...existingItem, ...item };
          } else if (!itemIsPendingExt && existingIsPendingExt) {
            // Keep existing pending, only fill gaps from item
            deduplicatedAssignments[existingIdx] = { ...item, ...existingItem };
          } else {
            // Both same status: prefer newer one
            if (itemTime >= existingTime) {
              deduplicatedAssignments[existingIdx] = { ...existingItem, ...item };
            } else {
              deduplicatedAssignments[existingIdx] = { ...item, ...existingItem };
            }
          }
        } else {
          indexByCase.set(caseKey, deduplicatedAssignments.length);
          deduplicatedAssignments.push(item);
        }
      });

      setAssignments(deduplicatedAssignments);
    } else {
      setAssignments([]);
    }
  };

  useEffect(() => {
    fetchAssignments();

    const channel = supabase
      .channel("subject-assignments-realtime-channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_subject_assignments" }, fetchAssignments)
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_subject_details" }, fetchAssignments)
      .on("postgres_changes", { event: "*", schema: "public", table: "dcmms_subject" }, fetchAssignments)
      .subscribe();

    const interval = setInterval(fetchAssignments, 15000);


    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === "dcmms_subject_assignments" || e.key === "dcmms_cases" || e.key === "dcmms_letters") {
        fetchAssignments();
      }
    };

    window.addEventListener("storage", handleStorageEvent);
    window.addEventListener("dcmms_assignment_updated", fetchAssignments);
    window.addEventListener("dcmms_notifications_updated", fetchAssignments);
    window.addEventListener("dcmms_data_updated", fetchAssignments);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageEvent);
      window.removeEventListener("dcmms_assignment_updated", fetchAssignments);
      window.removeEventListener("dcmms_notifications_updated", fetchAssignments);
      window.removeEventListener("dcmms_data_updated", fetchAssignments);
    };
  }, [profile, t]);

  // Step 2 Handler: Subject Officer Submits Appointment Date & Report Due Date
  const handleStep2SubmitDates = (asgn: any, appointmentDate: string, reportDueDate: string) => {
    const finalAppt = formatToInputDate(appointmentDate);
    const finalDue = formatToInputDate(reportDueDate);

    if (!finalAppt || !finalDue) {
      showToast("Please select both Appointment Date and Report Due Date!");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const updated = {
      ...asgn,
      appointmentDate: finalAppt,
      reportDueDate: finalDue,
      datesSubmittedBySubject: true,
      datesSubmitTimestamp: today,
      currentStep: 3,
      status: "Dates Confirmed",
      updatedAt: today,
    };

    const caseKey = asgn.caseNo || asgn.id;
    const updatedDrafts = { ...draftDatesRef.current };
    delete updatedDrafts[caseKey];
    if (asgn.id) delete updatedDrafts[asgn.id];
    if (asgn.caseNo) delete updatedDrafts[asgn.caseNo];
    draftDatesRef.current = updatedDrafts;
    setDraftDates(updatedDrafts);

    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("dcmms_subject_assignments") || "[]";
        let list = JSON.parse(stored);
        list = list.filter((a: any) => a.id !== asgn.id && a.caseNo !== asgn.caseNo);
        list.push(updated);
        localStorage.setItem("dcmms_subject_assignments", JSON.stringify(list));
      } catch (e) {}

      try {
        const storedCases = localStorage.getItem("dcmms_cases") || "[]";
        let cases = JSON.parse(storedCases);
        const matchKey = String(asgn.caseNo || "").trim().toLowerCase();
        const idx = cases.findIndex((c: any) => String(c.caseNo || c.refNo || "").trim().toLowerCase() === matchKey);
        if (idx >= 0) {
          cases[idx].appointmentDate = finalAppt;
          cases[idx].reportDueDate = finalDue;
          cases[idx].targetDate = finalDue;
          cases[idx].datesSubmittedBySubject = true;
          cases[idx].status = "Dates Confirmed";
        }
        localStorage.setItem("dcmms_cases", JSON.stringify(cases));
      } catch (e) {}

      try {
        const storedLetters = localStorage.getItem("dcmms_letters") || "[]";
        let letters = JSON.parse(storedLetters);
        const matchKey = String(asgn.caseNo || "").trim().toLowerCase();
        const idx = letters.findIndex((l: any) => String(l.refNo || l.caseNo || "").trim().toLowerCase() === matchKey);
        if (idx >= 0) {
          letters[idx].appointmentDate = finalAppt;
          letters[idx].reportDueDate = finalDue;
          letters[idx].datesSubmittedBySubject = true;
          letters[idx].status = "Dates Confirmed";
        }
        localStorage.setItem("dcmms_letters", JSON.stringify(letters));
      } catch (e) {}

      window.dispatchEvent(new CustomEvent("dcmms_assignment_updated"));
      window.dispatchEvent(new Event("storage"));
    }

    // Save into dedicated PostgreSQL case_by_appointment_and_report_due_date table
    try {
      saveCaseByAppointmentAndReportDueDateServer({
        subject_file_no: updated.caseNo || caseKey,
        sub_file_no: updated.caseNo || caseKey,
        appointment_letter_date: finalAppt,
        report_due_date: finalDue,
        dates_submitted_by_subject: true,
      }).then();
    } catch (e) {}

    if (isSupabaseConfigured) {
      supabase.from("dcmms_subject_assignments").upsert({
        id: updated.id || `asgn-${updated.caseNo}`,
        case_no: updated.caseNo,
        subject_officer_name: updated.subjectOfficerName,
        assigned_officers: Array.isArray(updated.assignedOfficers) ? updated.assignedOfficers : (updated.assignedOfficers ? [updated.assignedOfficers] : null),
        chairman: updated.chairman || null,
        members: updated.members || null,
        appointment_date: finalAppt,
        report_due_date: finalDue,
        dates_submitted_by_subject: true,
        status: updated.status,
      }).then();

      supabase.from("case_by_appointment_and_report_due_date").upsert({
        subject_file_no: updated.caseNo,
        sub_file_no: updated.caseNo,
        appointment_letter_date: finalAppt,
        report_due_date: finalDue,
        dates_submitted_by_subject: true,
      }).then();
    }

    showToast("Step 2 Complete: Appointment Date & Report Due Date submitted to Investigation Administrator!");
    fetchAssignments();
  };

  // Step 3/4: Subject Officer Approves or Disapproves Extension Request
  const handleExtensionDecision = async (asgn: any, approved: boolean) => {
    const today = new Date().toISOString().slice(0, 10);
    const status = approved ? "Approved" : "Disapproved";
    const caseNo = asgn.caseNo || asgn.case_no;
    const extEnd = asgn.extensionEndDate || asgn.extension_end_date;

    const updated: any = {
      ...asgn,
      caseNo,
      extensionApprovalStatus: status,
      extensionDecisionDate: today,
      status: approved ? "Extension Approved" : "Extension Disapproved",
      updatedAt: today,
    };

    if (approved && extEnd) {
      updated.reportDueDate = extEnd;
      updated.report_due_date = extEnd;

      const dueId = `due-date-${asgn.id || caseNo}`;
      const dueEl = document.getElementById(dueId) as HTMLInputElement;
      if (dueEl) {
        dueEl.value = extEnd;
      }
    }

    setAssignments((prev) =>
      prev.map((item) =>
        (item.id === asgn.id || item.caseNo === caseNo || item.case_no === caseNo)
          ? { ...item, ...updated }
          : item
      )
    );

    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("dcmms_subject_assignments") || "[]";
        let list = JSON.parse(stored);
        list = list.filter((a: any) => (a.caseNo || a.case_no) !== caseNo);
        list.push(updated);
        localStorage.setItem("dcmms_subject_assignments", JSON.stringify(list));
      } catch (e) {}

      try {
        const storedLetters = localStorage.getItem("dcmms_letters") || "[]";
        let letters = JSON.parse(storedLetters);
        const idx = letters.findIndex((l: any) => l.refNo === caseNo || l.caseNo === caseNo);
        if (idx >= 0) {
          letters[idx].extensionApprovalStatus = status;
          letters[idx].extensionDecisionDate = today;
          letters[idx].status = approved ? "Extension Approved" : "Extension Disapproved";
          if (approved && extEnd) {
            letters[idx].reportDueDate = extEnd;
            letters[idx].report_due_date = extEnd;
          }
          localStorage.setItem("dcmms_letters", JSON.stringify(letters));
        }
      } catch (e) {}

      try {
        const storedCases = localStorage.getItem("dcmms_cases") || "[]";
        let cases = JSON.parse(storedCases);
        const idx = cases.findIndex((c: any) => c.caseNo === caseNo || c.refNo === caseNo);
        if (idx >= 0) {
          cases[idx].extensionApprovalStatus = status;
          cases[idx].extensionDecisionDate = today;
          cases[idx].status = approved ? "Extension Approved" : "Extension Disapproved";
          if (approved && extEnd) {
            cases[idx].reportDueDate = extEnd;
            cases[idx].report_due_date = extEnd;
          }
          localStorage.setItem("dcmms_cases", JSON.stringify(cases));
        }
      } catch (e) {}

      // Update calendar events in localStorage if approved — same pattern as syncCalendar for appointment date
      if (approved && extEnd) {
        try {
          const storedCal = localStorage.getItem("dcmms_calendar_events") || "[]";
          let calEvents = JSON.parse(storedCal);
          let updatedCal = false;
          calEvents = calEvents.map((ev: any) => {
            const evCase = ev.caseNo || ev.case_no || ev.refNo;
            if ((evCase === caseNo) && (ev.source === "Report Due Date" || ev.type === "report_due" || String(ev.summary || "").toLowerCase().includes("report due"))) {
              updatedCal = true;
              return { ...ev, date: extEnd, start: extEnd, end: extEnd, extensionApplied: true };
            }
            return ev;
          });
          if (!updatedCal) {
            calEvents.push({
              id: `ext-due-${caseNo}-${today}`,
              caseNo,
              case_no: caseNo,
              date: extEnd,
              start: extEnd,
              end: extEnd,
              summary: `Extension Due: ${caseNo}`,
              description: `Extended report due date for Case ${caseNo} after Officer in Charge approval.`,
              source: "Extension Due Date",
              type: "extension_due",
            });
          }
          localStorage.setItem("dcmms_calendar_events", JSON.stringify(calEvents));
        } catch (e) {}
      }

      window.dispatchEvent(new CustomEvent("dcmms_assignment_updated"));
      window.dispatchEvent(new Event("storage"));
    }

    // Update dedicated case_by_date_extention table in local PostgreSQL
    try {
      await updateCaseByDateExtensionApprovalServer(caseNo, status, today, {
        extention_term: asgn.extensionTerm || asgn.extension_term,
        start_date: asgn.extensionStartDate || asgn.extension_start_date,
        end_date: asgn.extensionEndDate || asgn.extension_end_date,
      });
    } catch (err) {
      console.error("Failed to update case_by_date_extention in PostgreSQL:", err);
    }

    if (isSupabaseConfigured) {
      try {
        await supabase.from("dcmms_subject_assignments").upsert({
          case_no: caseNo,
          subject_officer_name: updated.subjectOfficerName || updated.subject_officer_name || null,
          assigned_officers: Array.isArray(updated.assignedOfficers) ? updated.assignedOfficers : (updated.assignedOfficers ? [updated.assignedOfficers] : null),
          chairman: updated.chairman || null,
          members: updated.members || null,
          appointment_date: updated.appointmentDate || updated.appointment_date || null,
          report_due_date: (approved && extEnd) ? extEnd : (updated.reportDueDate || updated.report_due_date || null),
          extension_term: updated.extensionTerm || updated.extension_term,
          extension_start_date: updated.extensionStartDate || updated.extension_start_date,
          extension_end_date: updated.extensionEndDate || updated.extension_end_date,
          extension_requested_by_admin: true,
          extension_approval_status: status,
          extension_decision_date: today,
          certification_submitted: updated.certificationSubmitted || false,
          report_submit_date: updated.reportSubmitDate || null,
          report_content: updated.reportContent || null,
          status: updated.status,
        }, { onConflict: "case_no" });
      } catch (err) {
        console.warn("Supabase subject assignments update warning:", err);
      }

      try {
        const subUpdateObj: any = {
          status: updated.status,
        };
        if (approved && extEnd) {
          subUpdateObj.report_due_date = extEnd;
        }

        await supabase.from("dcmms_subject").update(subUpdateObj).eq("case_no", caseNo);
      } catch (err) {
        console.warn("Supabase subject update warning:", err);
      }

      try {
        const prelimUpdateObj: any = {
          extension_approval_status: status,
          extension_decision_date: today,
          status: approved ? "Extension Approved" : "Extension Disapproved",
        };
        if (approved && extEnd) {
          prelimUpdateObj.report_due_date = extEnd;
        }
        await supabase.from("dcmms_preliminary_investigations")
          .update(prelimUpdateObj)
          .eq("case_no", caseNo);
      } catch (err) {
        console.warn("Supabase prelim update warning:", err);
      }

      if (approved && extEnd) {
        try {
          await supabase.from("dcmms_calendar").upsert({
            id: `ext-due-${caseNo}`,
            case_no: caseNo,
            date: extEnd,
            summary: `Extension Due: ${caseNo}`,
            description: `Extended report due date for Case ${caseNo} approved by Subject Officer.`,
            source: "Extension Due Date",
          }, { onConflict: "id" });
        } catch (err) {
          console.warn("Supabase calendar update warning:", err);
        }
      }

      // Update dedicated case_by_date_extention table
      try {
        await updateCaseByDateExtensionApprovalServer(caseNo, status, today);
      } catch (err) {}

      try {
        await supabase
          .from("case_by_date_extention")
          .update({
            approval_status: status,
            decision_date: today,
            updated_at: new Date().toISOString(),
          })
          .or(`subject_file_no.eq.${caseNo},sub_file_no.eq.${caseNo}`);
      } catch (err) {
        console.warn("Supabase case_by_date_extention update warning:", err);
      }
    }

    showToast(
      approved
        ? (lang === "si" ? `දීර්ඝ කිරීම අනුමත කළා (වාර්තා දිනය ${extEnd || ""} දක්වා දීර්ඝ විය) — Admin වෙත යවා ඇත!` : `Extension Approved (Due date updated to ${extEnd || ""}) and sent to Investigation Admin!`)
        : (lang === "si" ? "දීර්ඝ කිරීම ප්‍රතික්ෂේප කළා — Admin වෙත යවා ඇත!" : "Extension Disapproved and sent to Investigation Admin!")
    );
    fetchAssignments();
  };

  // Handle Certification Submission (Data Flow: Subject Officer -> Investigation Admin)
  const handleCertifyAssignment = (asgn: any) => {
    const today = new Date().toISOString().slice(0, 10);
    const updated = {
      ...asgn,
      certificationSubmitted: true,
      certificationDate: today,
      status: "Certified",
      updatedAt: today,
    };

    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("dcmms_subject_assignments") || "[]";
        let list = JSON.parse(stored);
        list = list.filter((a: any) => a.id !== asgn.id);
        list.push(updated);
        localStorage.setItem("dcmms_subject_assignments", JSON.stringify(list));
      } catch (e) {}
    }

    if (isSupabaseConfigured) {
      supabase.from("dcmms_subject_assignments").upsert({
        id: updated.id,
        case_no: updated.caseNo,
        subject_officer_name: updated.subjectOfficerName,
        assigned_officers: Array.isArray(updated.assignedOfficers) ? updated.assignedOfficers : (updated.assignedOfficers ? [updated.assignedOfficers] : null),
        chairman: updated.chairman || null,
        members: updated.members || null,
        appointment_date: updated.appointmentDate,
        report_due_date: updated.reportDueDate,
        extension_term: updated.extensionTerm,
        extension_start_date: updated.extensionStartDate,
        extension_end_date: updated.extensionEndDate,
        certification_submitted: true,
        certification_date: today,
        report_submit_date: updated.reportSubmitDate || null,
        report_content: updated.reportContent || null,
        status: "Certified",
      }).then();
    }

    showToast("Certification submitted to Investigation Administrator!");
    fetchAssignments();
  };

  // Handle Opening Report Submission Modal
  const handleOpenReportModal = (asgn: any) => {
    setActiveAssignment(asgn);
    setReportDateForm(asgn.reportSubmitDate || new Date().toISOString().slice(0, 10));
    setReportContentForm(asgn.reportContent || "");
    setIsReportModalOpen(true);
  };

  // Handle Submitting Investigation Report (Data Flow: Subject Officer -> Investigation Admin)
  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssignment) return;
    if (!reportContentForm.trim()) {
      showToast("Please enter the investigation report content.");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const updated = {
      ...activeAssignment,
      reportSubmitDate: reportDateForm || today,
      reportContent: reportContentForm.trim(),
      status: "Report Submitted",
      updatedAt: today,
    };

    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("dcmms_subject_assignments") || "[]";
        let list = JSON.parse(stored);
        list = list.filter((a: any) => a.id !== activeAssignment.id);
        list.push(updated);
        localStorage.setItem("dcmms_subject_assignments", JSON.stringify(list));

        const storedActions = localStorage.getItem("dcmms_new_letter_current_case") || "[]";
        const actionsList = JSON.parse(storedActions);
        actionsList.push({
          id: `report-${activeAssignment.caseNo}-${Date.now()}`,
          caseNo: activeAssignment.caseNo,
          subjectOfficerName: activeAssignment.subjectOfficerName || profile?.full_name || "Subject Officer",
          reportState: "Report Submitted",
          receivedDate: reportDateForm || today,
          stepTaken: `Investigation Report Submitted on ${reportDateForm || today}`,
          specialNotes: reportContentForm.trim(),
        });
        localStorage.setItem("dcmms_new_letter_current_case", JSON.stringify(actionsList));
      } catch (e) {}
    }

    if (isSupabaseConfigured) {
      supabase.from("dcmms_subject_assignments").upsert({
        id: updated.id,
        case_no: updated.caseNo,
        subject_officer_name: updated.subjectOfficerName,
        assigned_officers: Array.isArray(updated.assignedOfficers) ? updated.assignedOfficers : (updated.assignedOfficers ? [updated.assignedOfficers] : null),
        chairman: updated.chairman || null,
        members: updated.members || null,
        appointment_date: updated.appointmentDate,
        report_due_date: updated.reportDueDate,
        extension_term: updated.extensionTerm,
        extension_start_date: updated.extensionStartDate,
        extension_end_date: updated.extensionEndDate,
        certification_submitted: updated.certificationSubmitted || true,
        certification_date: updated.certificationDate || today,
        report_submit_date: reportDateForm || today,
        report_content: reportContentForm.trim(),
        status: "Report Submitted",
      }).then();
    }

    showToast("Investigation Report successfully submitted to Investigation Administrator!");
    setIsReportModalOpen(false);
    fetchAssignments();
  };

  // Session guard — redirect to login if not authenticated
  useEffect(() => {
    getCurrentProfile().then((profile) => {
      if (!profile || profile.role !== "subject_officer") router.replace("/");
    });
  }, [router]);

  // Log out handler
  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await signOut();
    router.push("/");
  };

  // Dynamic counts for stats cards
  const totalCasesCount = cases.length;
  const inProgressCasesCount = cases.filter((c) => c.status === "In Progress").length;
  const pendingCasesCount = cases.filter((c) => c.status === "Pending").length;
  const closedCasesCount = cases.filter((c) => c.status === "Closed").length;

  // Helper to calculate case deadlines and reminders
  const calculateReminder = (assignedDateStr: string, priority: "high" | "medium" | "low", status: string) => {
    if (status === "Closed") return { text: "Completed", color: "gray", active: false };

    const assigned = new Date(assignedDateStr);
    const today = new Date();
    const assignedMidnight = new Date(assigned.getFullYear(), assigned.getMonth(), assigned.getDate());
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const diffTime = todayMidnight.getTime() - assignedMidnight.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const currentHour = today.getHours();

    if (priority === "high") {
      // High priority = today (red color)
      // reminder is given at 10 a.m. and 2 p.m.
      if (diffDays === 0) {
        if (currentHour >= 14) {
          return { text: "Reminder: High Priority (2:00 PM check)", color: "red", active: true };
        } else if (currentHour >= 10) {
          return { text: "Reminder: High Priority (10:00 AM check)", color: "red", active: true };
        } else {
          return { text: "Action Required Today", color: "red", active: false };
        }
      } else if (diffDays > 0) {
        return { text: "Overdue (High Priority)", color: "red", active: true };
      }
      return { text: "Action Required Today", color: "red", active: false };
    }

    if (priority === "medium") {
      // Medium priority = 3 days (orange color)
      // Reminder on the last day (diffDays === 3)
      const daysRemaining = 3 - diffDays;
      if (daysRemaining === 0) {
        return { text: "Reminder: Last Day to Submit!", color: "orange", active: true };
      } else if (daysRemaining < 0) {
        return { text: `Overdue by ${Math.abs(daysRemaining)} days`, color: "red", active: true };
      } else {
        return { text: `${daysRemaining} days remaining`, color: "orange", active: false };
      }
    }

    if (priority === "low") {
      // Low priority = 21 days (green color)
      // Reminder on last 2 days (diffDays === 20 or 21)
      const daysRemaining = 21 - diffDays;
      if (daysRemaining <= 2 && daysRemaining >= 0) {
        return { text: `Reminder: ${daysRemaining} days left!`, color: "green", active: true };
      } else if (daysRemaining < 0) {
        return { text: `Overdue by ${Math.abs(daysRemaining)} days`, color: "red", active: true };
      } else {
        return { text: `${daysRemaining} days remaining`, color: "green", active: false };
      }
    }

    return { text: "No reminder", color: "gray", active: false };
  };

  // Get active reminders
  const activeReminders = cases.map(c => {
    const reminderInfo = calculateReminder(c.receivedDate, c.priority, c.status);
    return { ...c, reminderInfo };
  }).filter(r => r.reminderInfo.active);

  const totalPct = "100%";
  const inProgressPct = totalCasesCount > 0 ? `+${Math.round((inProgressCasesCount / totalCasesCount) * 100)}%` : "0%";
  const pendingPct = totalCasesCount > 0 ? `+${Math.round((pendingCasesCount / totalCasesCount) * 100)}%` : "0%";
  const closedPct = totalCasesCount > 0 ? `+${Math.round((closedCasesCount / totalCasesCount) * 100)}%` : "0%";

  // Filter cases list in real-time
  const filteredCases = cases.filter((item) => {
    const matchesSearch =
      item.caseNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.subject || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPriority = priorityFilter === "all" || item.priority === priorityFilter;

    return matchesSearch && matchesPriority;
  });

  // Filter answer letters list in real-time
  const filteredAnswerLetters = assignedAnswerLetters.filter((item) => {
    if (!answerSearchQuery.trim()) return true;
    const q = answerSearchQuery.toLowerCase();
    return (
      (item.caseNo && item.caseNo.toLowerCase().includes(q)) ||
      (item.senderName && item.senderName.toLowerCase().includes(q)) ||
      (item.subject && item.subject.toLowerCase().includes(q)) ||
      (item.officerName && item.officerName.toLowerCase().includes(q))
    );
  });

  // Check if an investigation is completed for a case
  const isInvestigationCompleteForCase = (caseNo: string) => {
    const cNo = (caseNo || "").trim().toLowerCase();
    const matchingAsgn = assignments.find((a: any) => (a.caseNo || a.case_no || "").trim().toLowerCase() === cNo);
    const matchingCase = cases.find((c: any) => (c.caseNo || "").trim().toLowerCase() === cNo);
    
    if (matchingAsgn) {
      if (
        matchingAsgn.initialInvestigationComplete ||
        matchingAsgn.initial_investigation_complete ||
        matchingAsgn.status === "Informing Officer In Charge - Initial Investigation Complete" ||
        matchingAsgn.status === "Investigation Completed" ||
        matchingAsgn.status === "Implementation of Recommendations" ||
        matchingAsgn.reportContent ||
        matchingAsgn.reportSubmitDate
      ) {
        return true;
      }
    }
    
    if (matchingCase) {
      if (
        matchingCase.status === "Informing Officer In Charge - Initial Investigation Complete" ||
        matchingCase.status === "Completed" ||
        matchingCase.status === "Investigation Completed" ||
        matchingCase.status === "Implementation of Recommendations"
      ) {
        return true;
      }
    }
    
    return false;
  };

  // List of all completed investigation cases assigned to this subject officer
  const completedInvestigationCases = cases.filter((c) => isInvestigationCompleteForCase(c.caseNo));

  // Completed cases awaiting recommendation submission
  const completedAwaitingRecCases = completedInvestigationCases.filter((c) => {
    const rec = recommendations.find((r) => (r.caseNo || "").trim().toLowerCase() === (c.caseNo || "").trim().toLowerCase());
    return !rec || rec.status !== "Submitted";
  });

  // ── Conducting an Inquiry Case List ──
  const conductingInquiryCases = useMemo(() => {
    const inquiryMap = new Map<string, any>();

    const seedInquiries = [
      {
        id: "inq-seed-001",
        caseNo: "INQ/2026/001",
        subject: "Preliminary investigation on teacher absenteeism - Jaffna Office",
        accusedName: "Mrs. T. Shanmugam",
        accusedDesignation: "Senior Assistant Teacher",
        schoolName: "Hindu College, Jaffna",
        priority: "medium",
        stage: "Conducting an Inquiry",
        stageKey: "inquiry",
        appointmentDate: "2026-08-05",
        hearingDate: "2026-09-08",
        reportDueDate: "2026-09-28",
        extensionCount: "None",
        proceedingsStatus: "Witness depositions underway. Auditing attendance registers.",
        chairman: { name: "Mr. K. Sivakumar", nic: "721987654V" },
        members: ["Mrs. V. Nithyanandan"],
        notes: "Inquiry sitting on 08th Sept. Notice served to respondent."
      },
      {
        id: "inq-seed-002",
        caseNo: "INQ/2026/002",
        subject: "Inquiry into safety guidelines violation - Annual Sports Meet",
        accusedName: "Mr. P. B. Dissanayake",
        accusedDesignation: "Sectional Head (Sports & Activities)",
        schoolName: "Ananda College, Colombo 10",
        priority: "low",
        stage: "Inquiry Hearing Scheduled",
        stageKey: "scheduled",
        appointmentDate: "2026-08-12",
        hearingDate: "2026-09-18",
        reportDueDate: "2026-10-05",
        extensionCount: "None",
        proceedingsStatus: "Preliminary evidence recorded. Formal panel hearing date notified.",
        chairman: { name: "Mr. Nimal Senanayake", nic: "680123456V" },
        members: ["Mr. M. F. M. Farook", "Mrs. D. K. Perera"],
        notes: "Witness summon letters dispatched to physical education instructors."
      },
      {
        id: "inq-seed-003",
        caseNo: "INQ/2026/003",
        subject: "Preliminary inquiry into laboratory equipment procurement discrepancy",
        accusedName: "Mr. H. M. Bandara",
        accusedDesignation: "Senior Science Teacher / Lab Custodian",
        schoolName: "Dharmaraja College, Kandy",
        priority: "medium",
        stage: "Report Submission Pending",
        stageKey: "report_pending",
        appointmentDate: "2026-07-15",
        hearingDate: "2026-08-20",
        reportDueDate: "2026-09-15",
        extensionCount: "1st Extension",
        proceedingsStatus: "Panel inquiries complete. Draft investigation report under finalization.",
        chairman: { name: "Dr. Anura Gunawardena", nic: "601239874V" },
        members: ["Mrs. K. Jayakody"],
        notes: "Draft report review scheduled with Zonal Director."
      },
      {
        id: "inq-seed-004",
        caseNo: "INQ/2026/004",
        subject: "Fact-finding inquiry on administrative irregular leave records",
        accusedName: "Mr. S. Wickramasinghe",
        accusedDesignation: "Development Officer / Grade II",
        schoolName: "Zonal Education Office, Galle",
        priority: "high",
        stage: "Preliminary Inquiry",
        stageKey: "prelim",
        appointmentDate: "2026-08-25",
        hearingDate: "2026-09-22",
        reportDueDate: "2026-10-12",
        extensionCount: "None",
        proceedingsStatus: "Appointment letter issued. Initial statement recorded from Branch Head.",
        chairman: { name: "Mrs. M. K. Alwis", nic: "750982341V" },
        members: ["Mr. T. Samarajeewa"],
        notes: "Call for audit files and leave approval sheets."
      }
    ];

    seedInquiries.forEach((item) => {
      inquiryMap.set(item.caseNo.toLowerCase(), item);
    });

    // Merge live cases & assignments
    cases.forEach((c) => {
      const cNoKey = (c.caseNo || "").trim().toLowerCase();
      const asgn = assignments.find((a: any) => (a.caseNo || a.case_no || "").trim().toLowerCase() === cNoKey);
      const committee = asgn ? parseCommitteeDetails(asgn) : null;

      const isEligible =
        cNoKey.includes("inq") ||
        (c.subject || "").toLowerCase().includes("inquiry") ||
        (c.subject || "").toLowerCase().includes("investigation") ||
        (asgn && committee && committee.hasDetails);

      if (isEligible) {
        const existing = inquiryMap.get(cNoKey) || {};
        const stage = (asgn?.hearingDate || asgn?.hearing_date)
          ? "Inquiry Hearing Scheduled"
          : (asgn?.initialInvestigationComplete || asgn?.initial_investigation_complete)
          ? "Report Submission Pending"
          : "Conducting an Inquiry";

        const stageKey = stage === "Inquiry Hearing Scheduled"
          ? "scheduled"
          : stage === "Report Submission Pending"
          ? "report_pending"
          : "inquiry";

        inquiryMap.set(cNoKey, {
          id: existing.id || c.id || `inq-${c.caseNo}`,
          caseNo: c.caseNo,
          subject: c.subject || existing.subject || `Inquiry Case ${c.caseNo}`,
          accusedName: existing.accusedName || "Concerned Officer",
          accusedDesignation: existing.accusedDesignation || "Educational Officer",
          schoolName: existing.schoolName || "Government Educational Institute",
          priority: c.priority || existing.priority || "medium",
          stage: existing.stage || stage,
          stageKey: existing.stageKey || stageKey,
          appointmentDate: asgn?.appointmentDate || asgn?.appointment_date || existing.appointmentDate || c.assignedDate || c.receivedDate,
          hearingDate: asgn?.hearingDate || asgn?.hearing_date || existing.hearingDate || "Pending Date",
          reportDueDate: asgn?.reportDueDate || asgn?.report_due_date || existing.reportDueDate || "Pending Schedule",
          extensionCount: asgn?.extensionTerm || asgn?.extension_term || existing.extensionCount || "None",
          proceedingsStatus: existing.proceedingsStatus || "Inquiry proceedings active",
          chairman: committee?.chairmanName
            ? { name: committee.chairmanName, nic: committee.chairmanNic || "—" }
            : existing.chairman || { name: "Assigned Inquiry Officer", nic: "—" },
          members: committee?.memberList && committee.memberList.length > 0
            ? committee.memberList
            : existing.members || [],
          notes: asgn?.notes || existing.notes || c.subject
        });
      }
    });

    return Array.from(inquiryMap.values());
  }, [cases, assignments]);

  // Filtered conducting inquiry cases
  const filteredInquiryCases = useMemo(() => {
    return conductingInquiryCases.filter((item) => {
      const q = inquirySearchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (item.caseNo && item.caseNo.toLowerCase().includes(q)) ||
        (item.subject && item.subject.toLowerCase().includes(q)) ||
        (item.accusedName && item.accusedName.toLowerCase().includes(q)) ||
        (item.schoolName && item.schoolName.toLowerCase().includes(q)) ||
        (item.chairman?.name && item.chairman.name.toLowerCase().includes(q)) ||
        (item.stage && item.stage.toLowerCase().includes(q));

      const matchesStage =
        inquiryStageFilter === "all" ||
        item.stageKey === inquiryStageFilter ||
        item.stage.toLowerCase().includes(inquiryStageFilter.toLowerCase());

      const matchesPriority =
        inquiryPriorityFilter === "all" ||
        item.priority === inquiryPriorityFilter;

      return matchesSearch && matchesStage && matchesPriority;
    });
  }, [conductingInquiryCases, inquirySearchQuery, inquiryStageFilter, inquiryPriorityFilter]);

  // ── Proper Disciplinary Inspection Case List ──
  const disciplinaryInspectionCases = useMemo(() => {
    const inspectionMap = new Map<string, any>();

    // 1. Process all recommendations (crucial driver for 'issuing_charge_sheet')
    recommendations.forEach((rec) => {
      const cNo = (rec.caseNo || "").trim();
      const cNoKey = cNo.toLowerCase();
      if (!cNoKey) return;

      const matchingCase = cases.find((c) => (c.caseNo || "").trim().toLowerCase() === cNoKey);
      const isChargeSheetCategory =
        rec.category === "issuing_charge_sheet" ||
        rec.actionType === "charge_sheet" ||
        !!rec.issuedChargeSheet ||
        !!rec.chargeSheetIssuedDate;
      const hasDisciplinaryOrder =
        !!rec.disciplinaryOrder ||
        (rec.disciplinaryAction && rec.disciplinaryAction.toLowerCase().includes("order"));
      const isProperDisciplinaryRec =
        isChargeSheetCategory ||
        hasDisciplinaryOrder ||
        (rec.futureAction && (rec.futureAction.toLowerCase().includes("proper disciplinary") || rec.futureAction.toLowerCase().includes("charge sheet"))) ||
        (rec.disciplinaryAction && (rec.disciplinaryAction.toLowerCase().includes("charge sheet") || rec.disciplinaryAction.toLowerCase().includes("interdiction") || rec.disciplinaryAction.toLowerCase().includes("tribunal")));

      if (isProperDisciplinaryRec) {
        const existing = inspectionMap.get(cNoKey) || {};
        
        let determinedStage = "Disciplinary Inspection Active";
        let determinedStageKey = "active";
        if (hasDisciplinaryOrder) {
          determinedStage = "Disciplinary Order Concluded";
          determinedStageKey = "order_finalized";
        } else if (isChargeSheetCategory) {
          determinedStage = "Formal Charge Sheet Issued";
          determinedStageKey = "charge_sheet";
        }

        let determinedInterdiction = "In Progress";
        if (hasDisciplinaryOrder) {
          determinedInterdiction = "Order Enacted";
        } else if (rec.issuedChargeSheet) {
          determinedInterdiction = `Charge Sheet: ${rec.issuedChargeSheet}`;
        } else if (isChargeSheetCategory) {
          determinedInterdiction = "Charge Sheet Served";
        } else if (existing.interdictionStatus) {
          determinedInterdiction = existing.interdictionStatus;
        }

        let determinedCharge = "Establishment Code Disciplinary Charge";
        if (rec.issuedChargeSheet) {
          determinedCharge = `Formal Charge Sheet: ${rec.issuedChargeSheet}`;
        } else if (rec.disciplinaryAction) {
          determinedCharge = rec.disciplinaryAction;
        } else if (rec.recommendationText) {
          determinedCharge = rec.recommendationText;
        } else if (existing.disciplinaryCharge) {
          determinedCharge = existing.disciplinaryCharge;
        }

        inspectionMap.set(cNoKey, {
          id: existing.id || rec.id || matchingCase?.id || `disc-${cNo}`,
          caseNo: cNo,
          subject: rec.subject || matchingCase?.subject || existing.subject || `Disciplinary Case ${cNo}`,
          accusedName: rec.accusedName || matchingCase?.accusedName || existing.accusedName || "Concerned Officer",
          accusedDesignation: rec.accusedDesignation || matchingCase?.accusedDesignation || existing.accusedDesignation || "Educational Officer",
          schoolName: rec.schoolName || matchingCase?.schoolName || existing.schoolName || "Government Educational Institute",
          priority: rec.urgency || matchingCase?.priority || existing.priority || "medium",
          stage: determinedStage,
          stageKey: determinedStageKey,
          disciplinaryCharge: determinedCharge,
          inspectionAuthority: existing.inspectionAuthority || (rec.forwardTo === "disciplinary_branch" ? "Ministry Disciplinary Branch / PSC ESC" : "Disciplinary Inspection Board"),
          pscRef: existing.pscRef || rec.letterNo || `PSC/DISC/${cNo}`,
          chargeDate: rec.chargeSheetIssuedDate || rec.letterDate || rec.submittedAt?.slice(0, 10) || existing.chargeDate || matchingCase?.assignedDate || "—",
          effectiveDate: rec.chargeSheetResponseDate || existing.effectiveDate || (rec.chargeSheetIssuedDate ? "14 Days Response Period" : "Pending Review"),
          interdictionStatus: determinedInterdiction,
          disciplinaryAction: rec.disciplinaryOrder || rec.disciplinaryAction || existing.disciplinaryAction || "Disciplinary determination in progress",
          notes: rec.referenceNotes || rec.recommendationText || existing.notes || matchingCase?.subject || "Case moved to Proper Disciplinary Inspection following Subject Officer recommendation.",
          issuedChargeSheet: rec.issuedChargeSheet || "",
          chargeSheetIssuedDate: rec.chargeSheetIssuedDate || "",
          chargeSheetResponseDate: rec.chargeSheetResponseDate || "",
          disciplinaryOrder: rec.disciplinaryOrder || "",
        });
      }
    });

    // 2. Also ensure any cases in cases list with stageKey === 'charge_sheet' or 'order_finalized' or 'psc_review' or 'disciplinary_active' or isProperDisciplinary are captured
    cases.forEach((c) => {
      const cNoKey = (c.caseNo || "").trim().toLowerCase();
      if (!cNoKey || inspectionMap.has(cNoKey)) return;

      if (
        c.stageKey === "charge_sheet" ||
        c.stageKey === "order_finalized" ||
        c.stageKey === "psc_review" ||
        c.stageKey === "disciplinary_active" ||
        (c as any).isProperDisciplinary ||
        (c as any).hasChargeSheet
      ) {
        inspectionMap.set(cNoKey, {
          id: c.id || `disc-${c.caseNo}`,
          caseNo: c.caseNo,
          subject: c.subject || `Disciplinary Case ${c.caseNo}`,
          accusedName: (c as any).accusedName || "Concerned Officer",
          accusedDesignation: (c as any).accusedDesignation || "Educational Officer",
          schoolName: (c as any).schoolName || "Government Educational Institute",
          priority: c.priority || "medium",
          stage: c.stage || "Formal Charge Sheet Issued",
          stageKey: c.stageKey || "charge_sheet",
          disciplinaryCharge: (c as any).disciplinaryCharge || "Establishment Code Charge Sheet",
          inspectionAuthority: "Disciplinary Inspection Board",
          pscRef: `PSC/REF/${c.caseNo}`,
          chargeDate: c.assignedDate || "—",
          effectiveDate: "14 Days Response Period",
          interdictionStatus: "Charge Sheet Served",
          disciplinaryAction: "Formal charge sheet proceedings in progress",
          notes: c.subject || "Moved to Proper Disciplinary Inspection."
        });
      }
    });

    return Array.from(inspectionMap.values());
  }, [cases, recommendations]);

  // Filtered proper disciplinary inspection cases
  const filteredInspectionCases = useMemo(() => {
    return disciplinaryInspectionCases.filter((item) => {
      const q = inspectionSearchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (item.caseNo && item.caseNo.toLowerCase().includes(q)) ||
        (item.subject && item.subject.toLowerCase().includes(q)) ||
        (item.accusedName && item.accusedName.toLowerCase().includes(q)) ||
        (item.schoolName && item.schoolName.toLowerCase().includes(q)) ||
        (item.disciplinaryCharge && item.disciplinaryCharge.toLowerCase().includes(q)) ||
        (item.pscRef && item.pscRef.toLowerCase().includes(q)) ||
        (item.stage && item.stage.toLowerCase().includes(q));

      const matchesStage =
        inspectionStageFilter === "all" ||
        item.stageKey === inspectionStageFilter ||
        item.stage.toLowerCase().includes(inspectionStageFilter.toLowerCase());

      const matchesPriority =
        inspectionPriorityFilter === "all" ||
        item.priority === inspectionPriorityFilter;

      return matchesSearch && matchesStage && matchesPriority;
    });
  }, [disciplinaryInspectionCases, inspectionSearchQuery, inspectionStageFilter, inspectionPriorityFilter]);

  // Filter investigation recommendations list in real-time
  const filteredRecommendations = recommendations.filter((item) => {
    const q = recSearchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (item.caseNo && item.caseNo.toLowerCase().includes(q)) ||
      (item.letterNo && item.letterNo.toLowerCase().includes(q)) ||
      (item.title && item.title.toLowerCase().includes(q)) ||
      (item.accusedName && item.accusedName.toLowerCase().includes(q)) ||
      (item.schoolName && item.schoolName.toLowerCase().includes(q)) ||
      (item.recommendationText && item.recommendationText.toLowerCase().includes(q)) ||
      (item.disciplinaryAction && item.disciplinaryAction.toLowerCase().includes(q));

    const matchesCategory = recCategoryFilter === "all" || item.category === recCategoryFilter;
    const matchesUrgency = recUrgencyFilter === "all" || item.urgency === recUrgencyFilter;
    const matchesStatus =
      recStatusFilter === "all" ||
      item.status === recStatusFilter ||
      (recStatusFilter === "Awaiting" && !recommendations.some(r => r.caseNo === item.caseNo && r.status === "Submitted"));

    return matchesSearch && matchesCategory && matchesUrgency && matchesStatus;
  });

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "issuing_charge_sheet":
        return lang === "si" ? "චෝදනා පත්‍රයක් නිකුත් කිරීම" : lang === "ta" ? "குற்றப்பத்திரிகை வழங்குதல்" : "Issuing a charge sheet";
      case "action_based_on_court_verdict":
        return lang === "si" ? "අධිකරණ තීන්දුව මත පදනම්ව ඉදිරි ක්‍රියාමාර්ග" : lang === "ta" ? "நீதிமன்ற தீர்ப்பின் அடிப்படையில் நடவடிக்கை" : "Action based on court verdict";
      case "giving_warnings_advice":
        return lang === "si" ? "අවවාද / උපදෙස් ලබා දීම" : lang === "ta" ? "எச்சரிக்கைகள் / ஆலோசனைகள் வழங்குதல்" : "Giving warnings/advice";
      case "transfers":
        return lang === "si" ? "ස්ථාන මාරු කිරීම්" : lang === "ta" ? "இடமாற்றங்கள்" : "Transfers";
      case "charging_based_on_more_104":
        return lang === "si" ? "MoRE 104 පරීක්ෂණය මත චෝදනා ගොනු කිරීම" : lang === "ta" ? "MoRE 104 குற்றஞ்சாட்டுதல்" : "Charging based on MoRE 104";
      case "terminating_service":
        return lang === "si" ? "සේවය අවසන් කිරීම" : lang === "ta" ? "சேவையை நிறுத்துதல்" : "Terminating service";
      case "sending_recommendation_other_departments":
        return lang === "si" ? "වෙනත් දෙපාර්තමේන්තු වෙත යොමු කිරීම" : lang === "ta" ? "பிற திணைக்களங்களுக்கு அனுப்புதல்" : "Sending to other departments";
      case "closing_action_non_disclosure":
        return lang === "si" ? "කරුණු අනාවරණය නොවීම මත අවසන් කිරීම" : lang === "ta" ? "நடவடிக்கையை முடிவுக்குக் கொண்டுவருதல்" : "Closing action (non-disclosure)";
      default:
        return category || (lang === "si" ? "සාමාන්‍ය නිර්දේශය" : "General Recommendation");
    }
  };

  const getForwardToLabel = (target: string) => {
    switch (target) {
      case "disciplinary_branch":
        return lang === "si" ? "විනය ශාඛාව (Disciplinary Branch)" : lang === "ta" ? "ஒழுங்குப் பிரிவு (Disciplinary Branch)" : "Disciplinary Branch";
      case "legal_division":
        return lang === "si" ? "නීති අංශය (Legal Division)" : lang === "ta" ? "சட்டப் பிரிவு (Legal Division)" : "Legal Division";
      case "investigation_director":
        return lang === "si" ? "විමර්ශන අධ්‍යක්ෂ (Investigation Director)" : lang === "ta" ? "விசாரணை பணிப்பாளர் (Investigation Director)" : "Investigation Director";
      case "provincial_office":
        return lang === "si" ? "පළාත් කාර්යාලය (Provincial Office)" : lang === "ta" ? "மாகாண அலுவலகம் (Provincial Office)" : "Provincial Office";
      case "ministry_secretary":
        return lang === "si" ? "අධ්‍යාපන අමාත්‍යාංශ ලේකම් (Ministry Secretary)" : lang === "ta" ? "அமைச்சு செயலாளர் (Ministry Secretary)" : "Ministry Secretary";
      case "psc":
        return lang === "si" ? "රාජ්‍ය සේවා කොමිෂන් සභාව (PSC)" : lang === "ta" ? "அரசு சேவை ஆணைக்குழு (PSC)" : "Public Service Commission";
      default:
        return target || (lang === "si" ? "විනය ශාඛාව" : "Disciplinary Branch");
    }
  };

  if (!mounted) {
    return <div className="dashboard-container" style={{ minHeight: "100vh", opacity: 0 }} />;
  }

  return (
    <div className="dashboard-container" data-font-scale={fontScale}>
      {/* ── Skip Link (A11y) ── */}
      <a href="#dashboard-main-content" className="skip-link">
        {t("skipLink")}
      </a>

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
        role="subject"
      />

      {/* ── Layout Grid Wrapper ── */}
      <div className="dashboard-layout">
        {/* ============================================================
           MAIN WORKSPACE CONTENT AREA
           ============================================================ */}
        <main id="dashboard-main-content" className="dashboard-content">
          {/* ── Top App Bar Header ── */}
          <header className="dashboard-header">
            <div className="dashboard-header-left">
              <button
                className="menu-toggle-btn"
                aria-label="Toggle Sidebar Menu"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                {...(isSidebarOpen ? { "aria-expanded": "true" } : { "aria-expanded": "false" })}
              >
                <svg className="hamburger-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="dashboard-title-area">
                <h2 className="dashboard-main-title">Subject Officer</h2>
                <p className="dashboard-main-subtitle">{t("subjectOfficerDesc")}</p>
              </div>
            </div>

            <div className="dashboard-header-right">
              {/* Facebook-Style Header Notification Bell Button */}
              <div style={{ position: "relative" }} ref={notifDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsNotifDropdownOpen((prev) => !prev)}
                  style={{
                    position: "relative",
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    backgroundColor: isNotifDropdownOpen || unseenCount > 0 ? "#e7f3ff" : "#f0f2f5",
                    border: isNotifDropdownOpen ? "2px solid #1877f2" : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    boxShadow: isNotifDropdownOpen ? "0 0 0 3px rgba(24, 119, 242, 0.2)" : "none"
                  }}
                  title={lang === "si" ? "දැනුම්දීම්" : "Notifications"}
                >
                  <Bell size={20} style={{ color: unseenCount > 0 || isNotifDropdownOpen ? "#1877f2" : "#65676b" }} />
                  {unseenCount > 0 && (
                    <span style={{
                      position: "absolute",
                      top: "-3px",
                      right: "-3px",
                      backgroundColor: "#e41e3f",
                      color: "#ffffff",
                      fontSize: "11px",
                      fontWeight: 800,
                      padding: "1px 6px",
                      borderRadius: "10px",
                      border: "2px solid #ffffff",
                      lineHeight: "1.2",
                      boxShadow: "0 2px 4px rgba(228, 30, 63, 0.35)"
                    }}>
                      {unseenCount}
                    </span>
                  )}
                </button>

                {/* Facebook Notification Dropdown Popover */}
                {isNotifDropdownOpen && (
                  <div className="fb-dropdown-popover">
                    {/* FB Dropdown Header */}
                    <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #f0f2f5" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: "19px", fontWeight: 800, color: "#050505", letterSpacing: "-0.3px" }}>
                            {lang === "si" ? "දැනුම්දීම්" : "Notifications"}
                          </h4>
                          <div style={{ fontSize: "11px", color: "#65676b", marginTop: "1px" }}>
                            {allSeparateNotifs.length} {lang === "si" ? "දැනුම්දීම්" : "Notifications"}
                          </div>
                        </div>
                        {unseenCount > 0 && (
                          <button
                            type="button"
                            onClick={markAllAsSeen}
                            style={{
                              fontSize: "12px",
                              fontWeight: 700,
                              color: "#1877f2",
                              backgroundColor: "#e7f3ff",
                              border: "none",
                              borderRadius: "8px",
                              padding: "5px 10px",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                          >
                            <Check size={14} />
                            <span>{lang === "si" ? "සියල්ල කියවූ බවට" : "Mark all as read"}</span>
                          </button>
                        )}
                      </div>

                      {/* Dropdown Filter Pills (All / Unread) */}
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() => setDropdownNotifFilter("all")}
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            padding: "4px 12px",
                            borderRadius: "16px",
                            border: "none",
                            backgroundColor: dropdownNotifFilter === "all" ? "#e7f3ff" : "#f0f2f5",
                            color: dropdownNotifFilter === "all" ? "#1877f2" : "#050505",
                            cursor: "pointer"
                          }}
                        >
                          {lang === "si" ? "සියල්ල" : "All"} ({allSeparateNotifs.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDropdownNotifFilter("unread")}
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            padding: "4px 12px",
                            borderRadius: "16px",
                            border: "none",
                            backgroundColor: dropdownNotifFilter === "unread" ? "#e7f3ff" : "#f0f2f5",
                            color: dropdownNotifFilter === "unread" ? "#1877f2" : "#050505",
                            cursor: "pointer"
                          }}
                        >
                          {lang === "si" ? "නුදුටු" : "Unread"} ({unreadCount})
                        </button>
                      </div>
                    </div>

                    {/* FB Dropdown Items List */}
                    <div style={{ overflowY: "auto", flex: 1, padding: "8px" }}>
                      {(() => {
                        const items = allSeparateNotifs.filter((n: SeparateNotification) => {
                          if (dropdownNotifFilter === "unread") {
                            return !seenNotifIds.includes(n.id) && !seenNotifIds.includes(n.caseNo);
                          }
                          return true;
                        });

                        if (items.length === 0) {
                          return (
                            <div style={{ padding: "30px 20px", textAlign: "center", color: "#65676b", fontSize: "13px" }}>
                              <Bell size={28} style={{ margin: "0 auto 8px", opacity: 0.4, display: "block" }} />
                              {lang === "si" ? "දැනුම්දීම් කිසිවක් නැත." : "No notifications right now."}
                            </div>
                          );
                        }

                        return items.map((n: SeparateNotification, idx: number) => {
                          const isUnseen = !seenNotifIds.includes(n.id) && !seenNotifIds.includes(n.caseNo);

                          return (
                            <div
                              key={`dd-${n.id || idx}`}
                              className={`fb-dropdown-item${isUnseen ? " unread" : ""}`}
                              onClick={() => {
                                markAsSeen(n.id);
                                markAsSeen(n.caseNo);
                                setIsDirectivesSectionMinimized(false);
                                setExpandedNotifIds((prev) => ({ ...prev, [n.id]: true }));
                                setIsNotifDropdownOpen(false);
                                const el = document.getElementById(`directive-item-${n.id}`);
                                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                              }}
                            >
                              {/* FB Avatar + Overlaid Badge */}
                              <div className="fb-notif-avatar-wrapper" style={{ width: "42px", height: "42px" }}>
                                <div className="fb-notif-avatar" style={{ width: "42px", height: "42px", fontSize: "14px" }}>
                                  IA
                                </div>
                                <div className={`fb-notif-badge ${n.badgeColor}`} style={{ width: "18px", height: "18px" }}>
                                  {n.iconType === "check" ? <CheckCircle size={10} /> : n.iconType === "clock" ? <Clock size={10} /> : n.iconType === "file" ? <FileText size={10} /> : <CalendarIcon size={10} />}
                                </div>
                              </div>

                              {/* FB Content */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                  <span style={{ fontSize: "13px", fontWeight: 800, color: "#050505" }}>
                                    {n.caseNo}
                                  </span>
                                  <span style={{
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    padding: "1px 6px",
                                    borderRadius: "10px",
                                    backgroundColor: n.badgeColor === "badge-green" ? "#d1fae5" : n.badgeColor === "badge-amber" ? "#fef3c7" : n.badgeColor === "badge-blue" ? "#e0f2fe" : "#e0e7ff",
                                    color: n.badgeColor === "badge-green" ? "#065f46" : n.badgeColor === "badge-amber" ? "#b45309" : n.badgeColor === "badge-blue" ? "#0369a1" : "#3730a3"
                                  }}>
                                    {n.statusPill}
                                  </span>
                                </div>
                                <div style={{ fontSize: "12px", color: isUnseen ? "#1d4ed8" : "#334155", marginTop: "2px", fontWeight: isUnseen ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                                  {n.headline}
                                </div>
                                <div style={{ fontSize: "11px", color: "#65676b", marginTop: "3px", fontWeight: 600 }}>
                                  {n.timeAgo}
                                </div>
                              </div>

                              {isUnseen && (
                                <span className="fb-notif-unread-dot" style={{ width: "10px", height: "10px", marginTop: "6px" }} />
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* FB Popover Footer */}
                    <div style={{ padding: "8px 12px", borderTop: "1px solid #f0f2f5", backgroundColor: "#f8fafc", textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsDirectivesSectionMinimized(false);
                          setIsNotifDropdownOpen(false);
                          const el = document.getElementById("directives-section-feed");
                          if (el) el.scrollIntoView({ behavior: "smooth" });
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#1877f2",
                          fontSize: "13px",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px"
                        }}
                      >
                        <span>{lang === "si" ? "සියලුම විමර්ශන නියෝග බලන්න" : "View All Directives Feed"}</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="divider-line" aria-hidden="true" />

              {/* Date display badge */}
              <div className="date-badge">
                <span suppressHydrationWarning>
                  {getFormattedDate()}
                </span>
                <svg className="date-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>

              <div className="divider-line" aria-hidden="true" />

              {/* Accessibility Scale Radio Group */}
              <div className="accessibility-adjuster-bar" role="radiogroup" aria-label="Font Sizing Adjustment">
                <label className={`size-btn size-btn-small${fontScale === "small" ? " active" : ""}`}>
                  <input
                    type="radio"
                    name="dashboardFontScale"
                    value="small"
                    checked={fontScale === "small"}
                    onChange={() => setFontScale("small")}
                    aria-label={t("fontSmall")}
                    className="sr-only"
                  />
                  A
                </label>
                <label className={`size-btn size-btn-medium${fontScale === "medium" ? " active" : ""}`}>
                  <input
                    type="radio"
                    name="dashboardFontScale"
                    value="medium"
                    checked={fontScale === "medium"}
                    onChange={() => setFontScale("medium")}
                    aria-label={t("fontMedium")}
                    className="sr-only"
                  />
                  A
                </label>
                <label className={`size-btn size-btn-large${fontScale === "large" ? " active" : ""}`}>
                  <input
                    type="radio"
                    name="dashboardFontScale"
                    value="large"
                    checked={fontScale === "large"}
                    onChange={() => setFontScale("large")}
                    aria-label={t("fontLarge")}
                    className="sr-only"
                  />
                  A
                </label>
              </div>

              <div className="divider-line" aria-hidden="true" />

              {/* Translation controls */}
              <div className="trilingual-language-selector" role="radiogroup" aria-label="Translate Dashboard Language">
                <label className={`lang-btn${lang === "si" ? " active" : ""}`} lang="si">
                  <input
                    type="radio"
                    name="dashboardLang"
                    value="si"
                    checked={lang === "si"}
                    onChange={() => changeLanguage("si")}
                    aria-label="Switch dashboard language to Sinhala"
                    className="sr-only"
                  />
                  සිංහල
                </label>
                <label className={`lang-btn${lang === "ta" ? " active" : ""}`} lang="ta">
                  <input
                    type="radio"
                    name="dashboardLang"
                    value="ta"
                    checked={lang === "ta"}
                    onChange={() => changeLanguage("ta")}
                    aria-label="Switch dashboard language to Tamil"
                    className="sr-only"
                  />
                  தமிழ்
                </label>
                <label className={`lang-btn${lang === "en" ? " active" : ""}`} lang="en">
                  <input
                    type="radio"
                    name="dashboardLang"
                    value="en"
                    checked={lang === "en"}
                    onChange={() => changeLanguage("en")}
                    aria-label="Switch dashboard language to English"
                    className="sr-only"
                  />
                  English
                </label>
              </div>
            </div>
          </header>

          {/* ── Dynamic Welcome Banner Greeting ── */}
          <section className="welcome-greeting-section">
            <h3 className="greeting-text">{greeting}</h3>
          </section>

          {/* Reminders Alert Widget */}
          {activeReminders.length > 0 && (
            <div className="reminders-alert-widget">
              <div className="reminders-widget-header">
                <svg className="reminders-bell-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <h4 className="reminders-widget-title">Active Reminders / Attention Required</h4>
              </div>
              <ul className="reminders-widget-list">
                {activeReminders.map((r) => (
                  <li key={r.id} className="reminders-widget-item">
                    Case <strong>{r.caseNo}</strong> ({r.priority.toUpperCase()} priority) - {r.reminderInfo.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Stats section */}
          <section className="dashboard-stats-grid subject-stats-grid">
            <div className="premium-stat-card total-cases-card">
              <div className="premium-card-top">
                <div className="premium-card-title-area">
                  <svg className="premium-card-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>{t("totalCases")}</span>
                </div>
                <span className="premium-card-percentage">{totalPct}</span>
              </div>
              <div className="premium-card-bottom">
                <div className="premium-card-value-area">
                  <span className="premium-card-value">{String(totalCasesCount).padStart(2, "0")}</span>
                  <span className="premium-card-label">cases</span>
                </div>
                <div className="premium-card-sparkline">
                  <svg viewBox="0 0 100 30" width="80" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M 5,22 Q 25,10 45,20 T 75,8 T 95,15" strokeLinecap="round" />
                    <circle cx="75" cy="8" r="3" fill="#ffffff" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="premium-stat-card inprogress-cases-card">
              <div className="premium-card-top">
                <div className="premium-card-title-area">
                  <svg className="premium-card-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18" />
                  </svg>
                  <span>{t("inProgressCases")}</span>
                </div>
                <span className="premium-card-percentage">{inProgressPct}</span>
              </div>
              <div className="premium-card-bottom">
                <div className="premium-card-value-area">
                  <span className="premium-card-value">{String(inProgressCasesCount).padStart(2, "0")}</span>
                  <span className="premium-card-label">cases</span>
                </div>
                <div className="premium-card-sparkline">
                  <svg viewBox="0 0 100 30" width="80" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M 5,20 Q 25,25 45,12 T 75,5 T 95,15" strokeLinecap="round" />
                    <circle cx="75" cy="5" r="3" fill="#ffffff" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="premium-stat-card pending-cases-card">
              <div className="premium-card-top">
                <div className="premium-card-title-area">
                  <svg className="premium-card-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{t("pendingCases")}</span>
                </div>
                <span className="premium-card-percentage">{pendingPct}</span>
              </div>
              <div className="premium-card-bottom">
                <div className="premium-card-value-area">
                  <span className="premium-card-value">{String(pendingCasesCount).padStart(2, "0")}</span>
                  <span className="premium-card-label">cases</span>
                </div>
                <div className="premium-card-sparkline">
                  <svg viewBox="0 0 100 30" width="80" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M 5,15 Q 25,8 45,22 T 75,12 T 95,25" strokeLinecap="round" />
                    <circle cx="75" cy="12" r="3" fill="#ffffff" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="premium-stat-card closed-cases-card">
              <div className="premium-card-top">
                <div className="premium-card-title-area">
                  <svg className="premium-card-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{t("closeCases")}</span>
                </div>
                <span className="premium-card-percentage">{closedPct}</span>
              </div>
              <div className="premium-card-bottom">
                <div className="premium-card-value-area">
                  <span className="premium-card-value">{String(closedCasesCount).padStart(2, "0")}</span>
                  <span className="premium-card-label">cases</span>
                </div>
                <div className="premium-card-sparkline">
                  <svg viewBox="0 0 100 30" width="80" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M 5,25 Q 25,20 45,8 T 75,5 T 95,12" strokeLinecap="round" />
                    <circle cx="75" cy="5" r="3" fill="#ffffff" />
                  </svg>
                </div>
              </div>
            </div>
          </section>

          {/* ── Navigation Tab Bar ── */}
          <div className="navigation-tab-list" style={{ marginTop: "24px", marginBottom: "24px" }}>
            <button
              type="button"
              className={`nav-tab-btn${activeTab === "cases" ? " active" : ""}`}
              onClick={() => setActiveTab("cases")}
            >
              <ClipboardList className="tab-icon" />
              <span>{lang === "si" ? "පවරන ලද නඩු ලේඛනය" : "Assigned Cases"}</span>
            </button>
            <button
              type="button"
              className={`nav-tab-btn${activeTab === "answer_letters" ? " active" : ""}`}
              onClick={() => setActiveTab("answer_letters")}
            >
              <MailCheck className="tab-icon" />
              <span>{lang === "si" ? "පවරන ලද පිළිතුරු ලිපි" : "Assigned Answers letters"}</span>
              {assignedAnswerLetters.length > 0 && (
                <span style={{
                  backgroundColor: activeTab === "answer_letters" ? "#4f46e5" : "#94a3b8",
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "12px",
                  marginLeft: "4px",
                  transition: "all 0.2s ease"
                }}>
                  {assignedAnswerLetters.length}
                </span>
              )}
            </button>
            <button
              type="button"
              className={`nav-tab-btn${activeTab === "conducting_inquiry" ? " active" : ""}`}
              onClick={() => setActiveTab("conducting_inquiry")}
            >
              <ShieldCheck className="tab-icon" />
              <span>{t("conductingInquiryTab", "Conducting an inquiry")}</span>
              {conductingInquiryCases.length > 0 && (
                <span style={{
                  backgroundColor: activeTab === "conducting_inquiry" ? "#0284c7" : "#94a3b8",
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "12px",
                  marginLeft: "4px",
                  transition: "all 0.2s ease"
                }}>
                  {conductingInquiryCases.length}
                </span>
              )}
            </button>
            <button
              type="button"
              className={`nav-tab-btn${activeTab === "disciplinary_inspection" ? " active" : ""}`}
              onClick={() => setActiveTab("disciplinary_inspection")}
            >
              <ShieldAlert className="tab-icon" />
              <span>{t("properDisciplinaryInspectionTab", "Proper disciplinary inspection")}</span>
              {disciplinaryInspectionCases.length > 0 && (
                <span style={{
                  backgroundColor: activeTab === "disciplinary_inspection" ? "#6366f1" : "#94a3b8",
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "12px",
                  marginLeft: "4px",
                  transition: "all 0.2s ease"
                }}>
                  {disciplinaryInspectionCases.length}
                </span>
              )}
            </button>
            <button
              type="button"
              className="nav-tab-btn"
              onClick={() => router.push("/subject/recommendation")}
            >
              <Sparkles className="tab-icon" />
              <span>{lang === "si" ? "විමර්ශන නිර්දේශ" : lang === "ta" ? "விசாரணை பரிந்துரை" : "Investigation Recommendation"}</span>
              {completedAwaitingRecCases.length > 0 ? (
                <span style={{
                  backgroundColor: "#e11d48",
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "12px",
                  marginLeft: "4px",
                  boxShadow: "0 2px 4px rgba(225, 29, 72, 0.3)",
                  transition: "all 0.2s ease"
                }}>
                  {completedAwaitingRecCases.length}
                </span>
              ) : recommendations.length > 0 ? (
                <span style={{
                  backgroundColor: "#4f46e5",
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "12px",
                  marginLeft: "4px",
                  transition: "all 0.2s ease"
                }}>
                  {recommendations.length}
                </span>
              ) : null}
            </button>
          </div>

          {/* ==================== TAB 1: ASSIGNED CASES VIEW ==================== */}
          {activeTab === "cases" && (
            <>
              {/* ==================== NOTIFICATIONS & INVESTIGATION DIRECTIVES SECTION (Facebook UI Style) ==================== */}
              <section style={{ marginBottom: "24px" }} id="directives-section-feed">
                <div className="fb-notif-feed-container" style={{ padding: "20px 24px" }}>
                  {/* FB Style Notification Header Bar */}
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: isDirectivesSectionMinimized ? "none" : "1px solid #f0f2f5",
                    paddingBottom: isDirectivesSectionMinimized ? "0" : "16px",
                    marginBottom: isDirectivesSectionMinimized ? "0" : "16px",
                    flexWrap: "wrap",
                    gap: "12px"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      {/* Facebook Avatar Icon Badge */}
                      <div className="fb-notif-avatar-wrapper" style={{ width: "46px", height: "46px" }}>
                        <div className="fb-notif-avatar" style={{ width: "46px", height: "46px", fontSize: "16px" }}>
                          <Bell size={22} style={{ color: "#ffffff" }} />
                        </div>
                        {unseenCount > 0 && (
                          <div style={{
                            position: "absolute",
                            top: "-3px",
                            right: "-3px",
                            backgroundColor: "#e41e3f",
                            color: "#ffffff",
                            fontSize: "11px",
                            fontWeight: 800,
                            padding: "1px 6px",
                            borderRadius: "10px",
                            border: "2px solid #ffffff",
                            lineHeight: "1.2",
                            boxShadow: "0 2px 4px rgba(228, 30, 63, 0.35)"
                          }}>
                            {unseenCount}
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#050505", letterSpacing: "-0.3px" }}>
                          {lang === "si" ? "විමර්ශන නියෝග සහ දැනුම්දීම්" : "Investigation Directives & Notifications"}
                        </h3>
                        <div style={{ fontSize: "13px", color: "#65676b", fontWeight: 500, marginTop: "2px" }}>
                          {lang === "si" ? "විෂය නිලධාරී ↔ විමර්ශන පරිපාලක | ක්‍රියාකාරකම් සහ දැනුම්දීම්" : "Subject Officer ↔ Investigation Admin | Directives & Action Updates"}
                        </div>
                      </div>
                    </div>

                    {/* Header Right Action Buttons */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {unseenCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllAsSeen}
                          className="fb-pill-btn active"
                          title="Mark all as read"
                        >
                          <Check size={16} />
                          <span>{lang === "si" ? "සියල්ල කියවූ බවට" : "Mark all as read"}</span>
                        </button>
                      )}

                      <span style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        padding: "6px 14px",
                        borderRadius: "20px",
                        backgroundColor: "#f0f2f5",
                        color: "#050505"
                      }}>
                        {allSeparateNotifs.length} {lang === "si" ? "දැනුම්දීම්" : "Notifications"}
                      </span>

                      <button
                        type="button"
                        onClick={() => setIsDirectivesSectionMinimized(!isDirectivesSectionMinimized)}
                        className="fb-pill-btn inactive"
                        title={isDirectivesSectionMinimized ? (lang === "si" ? "විහිදුවන්න (Expand)" : "Expand Section") : (lang === "si" ? "හකුලන්න (Minimize)" : "Minimize Section")}
                      >
                        {isDirectivesSectionMinimized ? (
                          <>
                            <ChevronDown size={16} />
                            <span>{lang === "si" ? "විහිදුවන්න" : "Expand"}</span>
                          </>
                        ) : (
                          <>
                            <ChevronUp size={16} />
                            <span>{lang === "si" ? "හකුලන්න" : "Minimize"}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {!isDirectivesSectionMinimized && (
                    <div>
                      {/* Facebook Filter Pills: All / Unread / Action Required / Completed */}
                      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => setNotifFilter("all")}
                          className={`fb-pill-btn ${notifFilter === "all" ? "active" : "inactive"}`}
                        >
                          {lang === "si" ? "සියල්ල" : "All"} ({assignments.length})
                        </button>

                        <button
                          type="button"
                          onClick={() => setNotifFilter("unread")}
                          className={`fb-pill-btn ${notifFilter === "unread" ? "active" : "inactive"}`}
                        >
                          {lang === "si" ? "නුදුටු" : "Unread"} ({unreadCount})
                        </button>

                        <button
                          type="button"
                          onClick={() => setNotifFilter("action")}
                          className={`fb-pill-btn ${notifFilter === "action" ? "active" : "inactive"}`}
                        >
                          ⚡ {lang === "si" ? "ක්‍රියාකාරකම් අවශ්‍යයි" : "Action Required"} ({actionRequiredCount})
                        </button>

                        <button
                          type="button"
                          onClick={() => setNotifFilter("completed")}
                          className={`fb-pill-btn ${notifFilter === "completed" ? "active" : "inactive"}`}
                        >
                          ✓ {lang === "si" ? "අවසන් වූ" : "Completed"} ({completedCount})
                        </button>
                      </div>

                      {/* Facebook Notifications List (Separate Notification Cards) */}
                      {filteredNotifs.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          {filteredNotifs.map((notif: SeparateNotification, notifIdx: number) => {
                            const asgn = notif.asgn;
                            const isUnseen = !seenNotifIds.includes(notif.id) && !seenNotifIds.includes(notif.caseNo);
                            const isExpanded = !!expandedNotifIds[notif.id];

                            const apptId = `app-date-${notif.id}`;
                            const dueId = `due-date-${notif.id}`;

                            return (
                              <div
                                key={notif.id || `notif-${notifIdx}`}
                                id={`directive-item-${notif.id}`}
                                className={`fb-notif-card${isUnseen ? " unread" : ""}`}
                              >
                                {/* FB Notification Card Header */}
                                <div
                                  onClick={() => {
                                    markAsSeen(notif.id);
                                    markAsSeen(notif.caseNo);
                                    toggleNotifExpand(notif.id);
                                  }}
                                  style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "14px", cursor: "pointer" }}
                                >
                                  {/* FB Left Avatar Badge */}
                                  <div className="fb-notif-avatar-wrapper">
                                    <div className="fb-notif-avatar">
                                      IA
                                    </div>
                                    <div className={`fb-notif-badge ${notif.badgeColor}`}>
                                      {notif.iconType === "check" ? <CheckCircle size={12} /> : notif.iconType === "clock" ? <Clock size={12} /> : notif.iconType === "file" ? <FileText size={12} /> : <CalendarIcon size={12} />}
                                    </div>
                                  </div>

                                  {/* Middle Content */}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                      <span style={{ fontWeight: 800, fontSize: "15px", color: "#050505" }}>
                                        <strong style={{ color: "#1877f2" }}>{notif.adminName}</strong>{" "}
                                        <span>{lang === "si" ? "නඩු අංක " : "for case "}</span>
                                        <strong>{notif.caseNo}</strong>
                                      </span>

                                      {/* Status Pill Tag */}
                                      <span style={{
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        padding: "3px 10px",
                                        borderRadius: "14px",
                                        backgroundColor: notif.badgeColor === "badge-green" ? "#d1fae5" : notif.badgeColor === "badge-amber" ? "#fef3c7" : notif.badgeColor === "badge-blue" ? "#e0f2fe" : "#e0e7ff",
                                        color: notif.badgeColor === "badge-green" ? "#065f46" : notif.badgeColor === "badge-amber" ? "#b45309" : notif.badgeColor === "badge-blue" ? "#0369a1" : "#3730a3"
                                      }}>
                                        {notif.statusPill}
                                      </span>
                                    </div>

                                    {/* Headline & Snippet */}
                                    <div style={{ fontSize: "14px", color: "#1e293b", marginTop: "4px", lineHeight: "1.4", fontWeight: 600 }}>
                                      {notif.headline}
                                    </div>
                                    <div style={{ fontSize: "13px", color: "#475569", marginTop: "2px", lineHeight: "1.35" }}>
                                      {notif.actionSnippet}
                                    </div>

                                    {/* Officer & Time Meta Chips */}
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                                      <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
                                        👤 {asgn.subjectOfficerName || "Assigned Officer"}
                                      </span>
                                      {asgn.appointmentDate && (
                                        <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#eff6ff", color: "#1d4ed8", padding: "2px 8px", borderRadius: "6px" }}>
                                          📅 Appt: {asgn.appointmentDate}
                                        </span>
                                      )}
                                      {asgn.reportDueDate && (
                                        <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#fff7ed", color: "#c2410c", padding: "2px 8px", borderRadius: "6px" }}>
                                          ⏳ Due: {asgn.reportDueDate}
                                        </span>
                                      )}
                                      <span style={{ fontSize: "11px", color: "#65676b", fontWeight: 700, marginLeft: "4px" }}>
                                        • {notif.timeAgo}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Right side Unread Dot & Expand Button */}
                                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                                    {isUnseen && (
                                      <span className="fb-notif-unread-dot" title="Unread notification" />
                                    )}

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        markAsSeen(notif.id);
                                        markAsSeen(notif.caseNo);
                                        toggleNotifExpand(notif.id);
                                      }}
                                      className={notif.isUrgent && isUnseen ? "fb-primary-btn" : "fb-secondary-btn"}
                                      style={{ padding: "6px 12px", fontSize: "12px" }}
                                    >
                                      {!isExpanded ? (
                                        <>
                                          <ChevronDown size={14} />
                                          <span>{notif.isUrgent ? (lang === "si" ? "ක්‍රියාමාර්ග ගන්න" : "Take Action") : (lang === "si" ? "විස්තර" : "View Details")}</span>
                                        </>
                                      ) : (
                                        <>
                                          <ChevronUp size={14} />
                                          <span>{lang === "si" ? "හකුලන්න" : "Hide"}</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>

                                {/* ── EXPANDABLE SEPARATE NOTIFICATION STEP DRAWER ── */}
                                {isExpanded && (
                                  <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #f0f2f5" }}>
                                    
                                    {/* ── STEP 1 ONLY ── */}
                                    {notif.stepType === "step1_officers" && (
                                      <div>
                                        <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e1b4b", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                          <span>{lang === "si" ? "1. පත් කළ විමර්ශන නිලධාරීන් (Admin විසින් යවන ලදී)" : "Step 1: Assigned Investigation Officers (Received from Admin)"}</span>
                                          <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", backgroundColor: "#dbeafe", color: "#1d4ed8" }}>✓ Received</span>
                                        </div>
                                        <div style={{ backgroundColor: "#f0f4ff", borderRadius: "10px", border: "1px solid #c7d2fe", padding: "12px 16px" }}>
                                          <div style={{ fontSize: "12px", color: "#3730a3", fontWeight: 600, marginBottom: "4px" }}>
                                            {lang === "si" ? "📋 නිලධාරීන් / කමිටුව:" : "📋 Investigation Committee:"}
                                          </div>
                                          <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e1b4b" }}>
                                            {(() => {
                                              const committee = parseCommitteeDetails(asgn);
                                              if (!committee.hasDetails) {
                                                return (
                                                  <span style={{ color: "#64748b", fontWeight: 500, fontStyle: "italic" }}>
                                                    {lang === "si" ? "— (නිලධාරීන් යවා නොමැත)" : "— (Officers not yet assigned)"}
                                                  </span>
                                                );
                                              }

                                              return (
                                                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                                                  {committee.chairmanName && (
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                                      <span style={{ fontSize: "11px", backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "3px 10px", borderRadius: "12px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                                        👑 {lang === "si" ? "සභාපති" : "CHAIRMAN"}
                                                      </span>
                                                      <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "14px" }}>
                                                        {committee.chairmanName}
                                                      </span>
                                                      {committee.chairmanNic && (
                                                        <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>(NIC: {committee.chairmanNic})</span>
                                                      )}
                                                    </div>
                                                  )}

                                                  {committee.memberList.length > 0 && (
                                                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                                                      <span style={{ fontSize: "11px", backgroundColor: "#e0e7ff", color: "#3730a3", border: "1px solid #c7d2fe", padding: "3px 10px", borderRadius: "12px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                                        👥 {lang === "si" ? `සාමාජිකයින් (${committee.memberList.length})` : `MEMBERS (${committee.memberList.length})`}
                                                      </span>
                                                      {committee.memberList.map((mName, idx) => (
                                                        <span key={idx} style={{ fontSize: "12px", backgroundColor: "#ffffff", border: "1px solid #cbd5e1", padding: "3px 10px", borderRadius: "6px", color: "#334155", fontWeight: 600 }}>
                                                          {mName}
                                                        </span>
                                                      ))}
                                                    </div>
                                                  )}

                                                  {!committee.chairmanName && committee.memberList.length === 0 && committee.rawText && (
                                                    <span style={{ fontWeight: 700, color: "#0f172a" }}>
                                                      {committee.rawText}
                                                    </span>
                                                  )}
                                                </div>
                                              );
                                            })()}
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* ── STEP 2 ONLY ── */}
                                    {notif.stepType === "step2_dates" && (
                                      <div>
                                        <div style={{ fontSize: "13px", fontWeight: 700, color: asgn.datesSubmittedBySubject ? "#0369a1" : "#1e293b", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                          <span>{lang === "si" ? "2. පත්වීම් ලිපිය දිනය සහ වාර්තා දිනය ඇතුළත් කරන්න" : "Step 2: Enter Appointment Letter Date & Report Due Date → Send to Admin"}</span>
                                          {asgn.datesSubmittedBySubject ? (
                                            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", backgroundColor: "#dbeafe", color: "#1d4ed8" }}>✓ Sent</span>
                                          ) : (
                                            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", backgroundColor: "#fef3c7", color: "#b45309" }}>{lang === "si" ? "⚡ ඔබේ ක්‍රියාව අවශ්‍යයි" : "⚡ Action Required"}</span>
                                          )}
                                        </div>
                                        <div style={{ backgroundColor: asgn.datesSubmittedBySubject ? "#f0f9ff" : "#f8fafc", borderRadius: "10px", border: `1px solid ${asgn.datesSubmittedBySubject ? "#bae6fd" : "#e2e8f0"}`, padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                                          {asgn.datesSubmittedBySubject && (
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "4px" }}>
                                              <div style={{ backgroundColor: "#ffffff", padding: "10px", borderRadius: "8px", border: "1px solid #bae6fd" }}>
                                                <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>📅 {lang === "si" ? "පත්වීම් ලිපිය දිනය" : "Appointment Letter Date"}</div>
                                                <div style={{ fontSize: "15px", fontWeight: 700, color: "#0369a1", marginTop: "2px" }}>{asgn.appointmentDate}</div>
                                              </div>
                                              <div style={{ backgroundColor: "#ffffff", padding: "10px", borderRadius: "8px", border: "1px solid #fecaca" }}>
                                                <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>⏳ {lang === "si" ? "වාර්තාව ලැබිය යුතු දිනය" : "Report Due Date"}</div>
                                                <div style={{ fontSize: "15px", fontWeight: 700, color: "#dc2626", marginTop: "2px" }}>{asgn.reportDueDate}</div>
                                              </div>
                                            </div>
                                          )}
                                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                            <div>
                                              <label style={{ fontSize: "11px", fontWeight: 700, color: "#0369a1", display: "block", marginBottom: "4px" }}>
                                                📅 {lang === "si" ? "පත්වීම් ලිපිය දිනය:" : "Appointment Letter Date:"}
                                              </label>
                                              <input
                                                type="date"
                                                id={apptId}
                                                value={formatToInputDate(asgn.appointmentDate)}
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  const caseKey = asgn.caseNo || asgn.id;
                                                  const currentDrafts = (draftDatesRef.current || {}) as Record<string, any>;
                                                  const updated: Record<string, any> = {
                                                    ...currentDrafts,
                                                    [caseKey]: { ...(currentDrafts[caseKey] || {}), appointmentDate: val }
                                                  };
                                                  if (asgn.id) updated[asgn.id] = { ...(updated[asgn.id] || {}), appointmentDate: val };
                                                  if (asgn.caseNo) updated[asgn.caseNo] = { ...(updated[asgn.caseNo] || {}), appointmentDate: val };
                                                  draftDatesRef.current = updated;
                                                  setDraftDates(updated);
                                                  setAssignments((prev) =>
                                                    prev.map((item) =>
                                                      (item.id === asgn.id || item.caseNo === asgn.caseNo)
                                                        ? { ...item, appointmentDate: val, appointment_date: val }
                                                        : item
                                                    )
                                                  );
                                                }}
                                                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #bae6fd", fontSize: "13px", backgroundColor: "#ffffff" }}
                                              />
                                            </div>
                                            <div>
                                              <label style={{ fontSize: "11px", fontWeight: 700, color: "#dc2626", display: "block", marginBottom: "4px" }}>
                                                ⏳ {lang === "si" ? "වාර්තාව ලැබිය යුතු දිනය:" : "Report Must Be Received By:"}
                                              </label>
                                              <input
                                                type="date"
                                                id={dueId}
                                                value={formatToInputDate(asgn.reportDueDate)}
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  const caseKey = asgn.caseNo || asgn.id;
                                                  setDraftDates((prev) => ({
                                                    ...prev,
                                                    [caseKey]: { ...(prev[caseKey] || {}), reportDueDate: val }
                                                  }));
                                                  setAssignments((prev) =>
                                                    prev.map((item) =>
                                                      (item.id === asgn.id || item.caseNo === asgn.caseNo)
                                                        ? { ...item, reportDueDate: val, report_due_date: val }
                                                        : item
                                                    )
                                                  );
                                                }}
                                                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #fecaca", fontSize: "13px", backgroundColor: "#ffffff" }}
                                              />
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const appEl = document.getElementById(apptId) as HTMLInputElement;
                                              const dueEl = document.getElementById(dueId) as HTMLInputElement;
                                              handleStep2SubmitDates(asgn, appEl?.value || "", dueEl?.value || "");
                                            }}
                                            className="fb-primary-btn"
                                            style={{ width: "fit-content", marginTop: "4px" }}
                                          >
                                            <Send size={14} />
                                            {asgn.datesSubmittedBySubject ? (lang === "si" ? "දිනයන් යාවත්කාලීන කරන්න (Step 2)" : "Update & Re-send Dates (Step 2)") : (lang === "si" ? "දිනයන් Admin වෙත යවන්න (Step 2)" : "Send Dates to Investigation Admin (Step 2)")}
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* ── STEP 3 & 4 ONLY ── */}
                                    {notif.stepType === "step34_extension" && (() => {
                                      const extTerm = asgn.extensionTerm || asgn.extension_term;
                                      const extStart = asgn.extensionStartDate || asgn.extension_start_date;
                                      const extEnd = asgn.extensionEndDate || asgn.extension_end_date;
                                      const extensionStatus = asgn.extensionApprovalStatus || asgn.extension_approval_status;
                                      const isApproved = extensionStatus === "Approved";
                                      const isDisapproved = extensionStatus === "Disapproved";

                                      return (
                                        <div>
                                          <div style={{ fontSize: "13px", fontWeight: 700, color: isApproved ? "#15803d" : isDisapproved ? "#b91c1c" : "#b45309", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                            <span>{lang === "si" ? "3 & 4. දිනයන් දීර්ඝ කිරීමේ කොටස (Extension of Days Details)" : "Steps 3 & 4: Extension of Days Details"}</span>
                                            {isApproved ? (
                                              <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", backgroundColor: "#dcfce7", color: "#15803d" }}>
                                                ✓ {lang === "si" ? "අනුමත කරන ලදී (Extension Approved)" : "Extension Approved"}
                                              </span>
                                            ) : isDisapproved ? (
                                              <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", backgroundColor: "#fee2e2", color: "#b91c1c" }}>
                                                ✕ {lang === "si" ? "ප්‍රතික්ෂේප කරන ලදී (Extension Disapproved)" : "Extension Disapproved"}
                                              </span>
                                            ) : (
                                              <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", backgroundColor: "#fef3c7", color: "#b45309" }}>
                                                ⏳ {lang === "si" ? "අනුමැතිය අපේක්ෂාවෙන් (Pending Approval)" : "Pending Approval"}
                                              </span>
                                            )}
                                          </div>

                                          <div style={{ backgroundColor: isApproved ? "#f0fdf4" : isDisapproved ? "#fef2f2" : "#fffbeb", borderRadius: "10px", border: `1px solid ${isApproved ? "#bbf7d0" : isDisapproved ? "#fca5a5" : "#fde68a"}`, padding: "14px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", fontSize: "12px" }}>
                                              <div style={{ backgroundColor: "#ffffff", padding: "10px", borderRadius: "8px", border: `1px solid ${isApproved ? "#bbf7d0" : isDisapproved ? "#fca5a5" : "#fde68a"}` }}>
                                                <div style={{ fontSize: "10px", color: isApproved ? "#166534" : isDisapproved ? "#991b1b" : "#92400e", fontWeight: 700, textTransform: "uppercase" }}>{lang === "si" ? "වාරය" : "Extension Term"}</div>
                                                <div style={{ fontWeight: 700, color: isApproved ? "#15803d" : isDisapproved ? "#b91c1c" : "#b45309", marginTop: "2px", fontSize: "13px" }}>{formatExtensionTermDisplay(extTerm, lang)}</div>
                                              </div>
                                              <div style={{ backgroundColor: "#ffffff", padding: "10px", borderRadius: "8px", border: `1px solid ${isApproved ? "#bbf7d0" : isDisapproved ? "#fca5a5" : "#fde68a"}` }}>
                                                <div style={{ fontSize: "10px", color: isApproved ? "#166534" : isDisapproved ? "#991b1b" : "#92400e", fontWeight: 700, textTransform: "uppercase" }}>{lang === "si" ? "ආරම්භ දිනය" : "Start Date"}</div>
                                                <div style={{ fontWeight: 700, color: isApproved ? "#15803d" : isDisapproved ? "#b91c1c" : "#b45309", marginTop: "2px", fontSize: "13px" }}>{extStart || "—"}</div>
                                              </div>
                                              <div style={{ backgroundColor: "#ffffff", padding: "10px", borderRadius: "8px", border: `1px solid ${isApproved ? "#bbf7d0" : isDisapproved ? "#fca5a5" : "#fde68a"}` }}>
                                                <div style={{ fontSize: "10px", color: isApproved ? "#166534" : isDisapproved ? "#991b1b" : "#92400e", fontWeight: 700, textTransform: "uppercase" }}>{lang === "si" ? "අවසාන දිනය" : "End Date"}</div>
                                                <div style={{ fontWeight: 700, color: isApproved ? "#15803d" : isDisapproved ? "#b91c1c" : "#b45309", marginTop: "2px", fontSize: "13px" }}>{extEnd || "—"}</div>
                                              </div>
                                            </div>

                                            <div style={{ padding: "10px 14px", borderRadius: "8px", backgroundColor: isApproved ? "#dcfce7" : isDisapproved ? "#fee2e2" : "#fef3c7", color: isApproved ? "#15803d" : isDisapproved ? "#991b1b" : "#b45309", fontWeight: 700, fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
                                              {isApproved ? <CheckCircle size={16} /> : isDisapproved ? <XCircle size={16} /> : <Clock size={16} />}
                                              <span>
                                                {isApproved
                                                  ? (lang === "si"
                                                    ? `විමර්ශන පරිපාලක විසින් ලබාදුන් දිනයන් දීර්ඝ කිරීම අනුමත කරන ලදී. වාර්තා ලබාදීමේ දිනය ${extEnd || ""} දක්වා දීර්ඝ කර ඇත.`
                                                    : `Extension of dates approved. Report due date extended to ${extEnd || ""}.`)
                                                  : isDisapproved
                                                  ? (lang === "si"
                                                    ? `දිනයන් දීර්ඝ කිරීමේ ඉල්ලීම ප්‍රතික්ෂේප කර ඇත.`
                                                    : `Extension request has been disapproved.`)
                                                  : (lang === "si"
                                                    ? `විමර්ශන පරිපාලක (Investigation Admin) විසින් දිනයන් දීර්ඝ කිරීමේ තොරතුරු ලබා දී ඇත. කරුණාකර අනුමත කරන්න හෝ ප්‍රතික්ෂේප කරන්න.`
                                                    : `Extension dates proposed by Investigation Admin. Please review and approve or disapprove below.`)}
                                              </span>
                                            </div>

                                            {/* Action Buttons: Approve / Disapprove Buttons (Facebook Color Palette) */}
                                            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "4px", flexWrap: "wrap" }}>
                                              <button
                                                type="button"
                                                onClick={() => handleExtensionDecision(asgn, true)}
                                                style={{
                                                  padding: "8px 18px",
                                                  borderRadius: "8px",
                                                  backgroundColor: isApproved ? "#15803d" : "#42b72a",
                                                  color: "#ffffff",
                                                  border: "none",
                                                  fontWeight: 700,
                                                  fontSize: "13px",
                                                  cursor: "pointer",
                                                  display: "inline-flex",
                                                  alignItems: "center",
                                                  gap: "6px",
                                                  boxShadow: "0 2px 4px rgba(66, 183, 42, 0.25)",
                                                }}
                                              >
                                                <CheckCircle size={16} />
                                                <span>{lang === "si" ? "අනුමත කරන්න (Approve)" : "Approve Extension"}</span>
                                              </button>

                                              <button
                                                type="button"
                                                onClick={() => handleExtensionDecision(asgn, false)}
                                                style={{
                                                  padding: "8px 18px",
                                                  borderRadius: "8px",
                                                  backgroundColor: isDisapproved ? "#b91c1c" : "#e41e3f",
                                                  color: "#ffffff",
                                                  border: "none",
                                                  fontWeight: 700,
                                                  fontSize: "13px",
                                                  cursor: "pointer",
                                                  display: "inline-flex",
                                                  alignItems: "center",
                                                  gap: "6px",
                                                  boxShadow: "0 2px 4px rgba(228, 30, 63, 0.25)",
                                                }}
                                              >
                                                <XCircle size={16} />
                                                <span>{lang === "si" ? "ප්‍රතික්ෂේප කරන්න (Disapprove)" : "Disapprove Extension"}</span>
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })()}

                                    {/* ── STEP 5 ONLY ── */}
                                    {notif.stepType === "step5_complete" && (
                                      <div>
                                        <div style={{ fontSize: "13px", fontWeight: 700, color: "#047857", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                          <span>{lang === "si" ? "5. මූලික විමර්ශනය අවසන් බව දැනුම් දීම (Admin ගෙන් ලැබුණි)" : lang === "ta" ? "5. ஆரம்ப விசாரணை முடிவு அறிவிப்பு (நிர்வாகியிடமிருந்து பெறப்பட்டது)" : "Step 5: Initial Investigation Complete (Notification from Admin)"}</span>
                                          <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", backgroundColor: "#d1fae5", color: "#065f46" }}>✓ {lang === "si" ? "දැනුම් දෙන ලදී" : lang === "ta" ? "தெரிவிக்கப்பட்டது" : "Informed"} {asgn.initialInvestigationCompletedAt || ""}</span>
                                        </div>
                                        <div style={{ backgroundColor: "#ecfdf5", borderRadius: "10px", border: "1px solid #a7f3d0", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                                          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "260px", flex: 1 }}>
                                            <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#10b981", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                              <Send size={18} />
                                            </div>
                                            <div>
                                              <div style={{ fontWeight: 700, color: "#065f46", fontSize: "13px" }}>
                                                {lang === "si" ? "මූලික විමර්ශන කටයුතු අවසන් බවට විමර්ශන පරිපාලක විසින් නිල වශයෙන් දැනුම් දී ඇත." : lang === "ta" ? "ஆரம்ப விசாரணை முடிவடைந்துவிட்டது என விசாரணை நிர்வாகியால் உத்தியோகபூர்வமாக தெரிவிக்கப்பட்டுள்ளது." : "Official notification: Investigation Administrator has informed that the initial preliminary investigation for this case is complete."}
                                              </div>
                                              <div style={{ fontSize: "12px", color: "#047857", marginTop: "2px" }}>
                                                {lang === "si" ? `යොමු අංකය: ${asgn.caseNo} | දිනය: ${asgn.initialInvestigationCompletedAt || new Date().toISOString().slice(0, 10)}` : `Ref: ${asgn.caseNo} | Date: ${asgn.initialInvestigationCompletedAt || new Date().toISOString().slice(0, 10)}`}
                                              </div>
                                            </div>
                                          </div>

                                          {/* "Add a recommendation" Button */}
                                          <Link
                                            href={`/subject/recommendation?caseNo=${encodeURIComponent(asgn.caseNo)}`}
                                            style={{
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: "8px",
                                              background: "linear-gradient(135deg, #059669, #10b981)",
                                              color: "#ffffff",
                                              padding: "9px 18px",
                                              borderRadius: "8px",
                                              fontSize: "13px",
                                              fontWeight: 700,
                                              textDecoration: "none",
                                              boxShadow: "0 2px 6px rgba(5, 150, 105, 0.3)",
                                              transition: "all 0.2s ease-in-out",
                                              whiteSpace: "nowrap",
                                              flexShrink: 0
                                            }}
                                            className="btn-add-recommendation"
                                          >
                                            <ClipboardList size={16} />
                                            <span>{t("addRecommendation", "Add a recommendation")}</span>
                                          </Link>
                                        </div>
                                      </div>
                                    )}

                                  </div>
                                )}

                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ padding: "40px 24px", textAlign: "center", backgroundColor: "#f0f2f5", borderRadius: "12px" }}>
                          <div style={{ width: "52px", height: "52px", borderRadius: "50%", backgroundColor: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                            <Bell size={24} style={{ color: "#65676b" }} />
                          </div>
                          <div style={{ fontWeight: 700, fontSize: "15px", color: "#050505", marginBottom: "4px" }}>
                            {lang === "si" ? "දැනුම්දීම් කිසිවක් නැත" : "No Directives / Notifications Found"}
                          </div>
                          <div style={{ fontSize: "13px", color: "#65676b" }}>
                            {lang === "si" ? "Investigation Administrator විසින් තොරතුරු පත් කළ විට දැනුම්දීම් මෙතන දිස්වනු ඇත." : "Once the Investigation Administrator assigns investigation officers or updates dates, notifications will appear here."}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

          {/* ── Case Management Section ── */}
          <section className="letters-list-section">
            {/* Header Filter Panel */}
            <div className="letters-list-header">
              <h3 className="section-title">
                <svg className="section-title-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>{t("assignedCases")}</span>
              </h3>

              <div className="letters-filters-group">
                {/* Search Bar Input */}
                <div className="search-box">
                  <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("searchCasesPlaceholder")}
                    className="search-input"
                  />
                </div>

                {/* Priority Selection Filter */}
                <div className="filter-dropdown-wrapper">
                  <svg className="filter-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  <select
                    value={priorityFilter}
                    onChange={(e: any) => setPriorityFilter(e.target.value)}
                    className="filter-priority-select"
                    aria-label={t("priority")}
                  >
                    <option value="all">All Priorities</option>
                    <option value="high">{t("priorityHigh")}</option>
                    <option value="medium">{t("priorityMedium")}</option>
                    <option value="low">{t("priorityLow")}</option>
                  </select>
                </div>

                <a href="#" className="view-all-reset-link" onClick={(e) => { e.preventDefault(); setSearchQuery(""); setPriorityFilter("all"); }}>
                  {t("viewAll")} <span className="arrow-span">→</span>
                </a>
              </div>
            </div>

            {/* cases listing table */}
            <div className="table-responsive-container">
              <table className="letters-data-table">
                <thead>
                  <tr>
                    <th scope="col">{t("caseNo")}</th>
                    <th scope="col">{lang === "si" ? "විමර්ශන කමිටුව" : "Investigation Committee"}</th>
                    <th scope="col">{t("letterDate")}</th>
                    <th scope="col">{t("subjectText")}</th>
                    <th scope="col">{t("priority")}</th>
                    <th scope="col">{t("status")}</th>
                    <th scope="col">{t("caseAge", "Case Age")}</th>
                    <th scope="col">Reminder</th>
                    <th scope="col" className="text-center">{t("addDetails")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.length > 0 ? (
                    filteredCases.map((item, idx) => {
                      const matchingAsgn = assignments.find((a: any) =>
                        String(a.caseNo || a.case_no || "").trim().toLowerCase() === String(item.caseNo || "").trim().toLowerCase()
                      );

                      return (
                        <tr key={item.id ? (item.id + "-" + idx) : ("case-" + (item.caseNo || idx) + "-" + idx)} className="letter-table-row">
                          <td className="font-semibold">{item.caseNo}</td>
                          <td>
                            {(() => {
                              if (!matchingAsgn) return <span style={{ fontSize: "11px", color: "#94a3b8" }}>— (Pending)</span>;

                              const committee = parseCommitteeDetails(matchingAsgn);

                              if (committee.chairmanName || committee.memberList.length > 0) {
                                return (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxWidth: "240px" }}>
                                    {committee.chairmanName && (
                                      <span style={{ fontSize: "11px", backgroundColor: "#fef3c7", color: "#92400e", padding: "3px 8px", borderRadius: "6px", fontWeight: 700, display: "inline-block" }}>
                                        👑 {lang === "si" ? "සභාපති" : "Chairman"}: {committee.chairmanName}
                                      </span>
                                    )}
                                    {committee.memberList.length > 0 && (
                                      <span style={{ fontSize: "11px", backgroundColor: "#f1f5f9", color: "#334155", padding: "3px 8px", borderRadius: "6px", fontWeight: 600, display: "inline-block" }}>
                                        👥 {lang === "si" ? "සාමාජිකයින්" : "Members"}: {committee.memberList.join(", ")}
                                      </span>
                                    )}
                                  </div>
                                );
                              }

                              if (committee.rawText) {
                                return (
                                  <span style={{ fontSize: "11px", color: "#1e3a5f", fontWeight: 600, backgroundColor: "#eff6ff", padding: "3px 8px", borderRadius: "6px" }}>
                                    📋 {committee.rawText}
                                  </span>
                                );
                              }

                              return <span style={{ fontSize: "11px", color: "#94a3b8" }}>— (Pending)</span>;
                            })()}
                          </td>
                          <td>{item.letterDate || item.receivedDate || item.assignedDate}</td>
                          <td className="subject-cell">{item.subject}</td>
                          <td>
                            <span className={`priority-text-container priority-text-${item.priority}`}>
                              <span className={`priority-dot dot-${item.priority}`} aria-hidden="true"></span>
                              {item.priority === "high" ? t("priorityHigh") : item.priority === "medium" ? t("priorityMedium") : t("priorityLow")}
                            </span>
                          </td>
                          <td>
                            {item.status === "assigned answer letter" || item.status === "Assigned Answer Letter" ? (
                              <span className="badge-badge badge-status-closed" style={{ backgroundColor: "#e0e7ff", color: "#3730a3", border: "1px solid #c7d2fe", fontWeight: 700, padding: "4px 10px", borderRadius: "12px", fontSize: "11px" }}>
                                {lang === "si" ? "පවරන ලද පිළිතුරු ලිපිය" : "Assigned Answer Letter"}
                              </span>
                            ) : item.status === "In Progress" ? t("statusInProgress") :
                              item.status === "Closed" ? t("statusClosed") : t("statusPending")}
                          </td>
                          <td>
                            {item.isOld ? t("oldCase", "Old Case") : t("newCase", "New Case")}
                          </td>
                          <td>
                            {(() => {
                              const rem = calculateReminder(item.letterDate || item.receivedDate || item.assignedDate, item.priority, item.status);
                              let colorClass = "reminder-text-gray";
                              let dotClass = "dot-gray";
                              if (rem.color === "red") {
                                colorClass = "reminder-text-red";
                                dotClass = "dot-red";
                              } else if (rem.color === "orange") {
                                colorClass = "reminder-text-orange";
                                dotClass = "dot-orange";
                              } else if (rem.color === "green") {
                                colorClass = "reminder-text-green";
                                dotClass = "dot-green";
                              }

                              return (
                                <span className={`reminder-text-container ${colorClass}`}>
                                  <span className={`reminder-dot ${dotClass}`} aria-hidden="true"></span>
                                  {rem.text}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="text-center actions-cell">
                            <Link
                              href={`/subject/add-details?caseNo=${item.caseNo}`}
                              className="add-details-link"
                            >
                              {t("addDetails")}
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="text-center py-4 text-muted">
                        No cases found matching search
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
            </>
          )}

          {/* ==================== TAB 2: ASSIGNED ANSWER LETTERS VIEW ==================== */}
          {activeTab === "answer_letters" && (
            <section style={{ marginBottom: "30px" }}>
              <div className="section-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#1e1b4b", display: "flex", alignItems: "center", gap: "10px" }}>
                    <MailCheck style={{ color: "#4f46e5", width: "24px", height: "24px" }} />
                    <span>{lang === "si" ? "පවරන ලද පිළිතුරු ලිපි" : "Assigned Answers letters"}</span>
                  </h3>
                  <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                    {lang === "si" ? "ඔබට පවරන ලද පැමිණිලි සඳහා ලැබී ඇති සියලුම පිළිතුරු ලිපි ලැයිස්තුව" : "Overview of all answer letters registered for your assigned complaint cases."}
                  </p>
                </div>

                <div className="table-filter-bar" style={{ margin: 0 }}>
                  <div className="search-box">
                    <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={answerSearchQuery}
                      onChange={(e) => setAnswerSearchQuery(e.target.value)}
                      placeholder={lang === "si" ? "ලිපි සොයන්න (නඩු අංකය, යවන්නා, විෂය)..." : "Search answer letters (Case No, Sender, Subject)..."}
                      className="search-input"
                    />
                  </div>

                  {answerSearchQuery && (
                    <a href="#" className="view-all-reset-link" onClick={(e) => { e.preventDefault(); setAnswerSearchQuery(""); }}>
                      {t("viewAll")} <span className="arrow-span">→</span>
                    </a>
                  )}
                </div>
              </div>

              <div className="table-responsive-container">
                <table className="letters-data-table">
                  <thead>
                    <tr>
                      <th scope="col">{t("caseNo")}</th>
                      <th scope="col">{lang === "si" ? "යවන්නාගේ නම / ආයතනය" : "Sender / Institution"}</th>
                      <th scope="col">{t("subjectText")}</th>
                      <th scope="col">{t("letterDate")}</th>
                      <th scope="col">{lang === "si" ? "ලැබුණු දිනය" : "Received Date"}</th>
                      <th scope="col">{t("status", "Status")}</th>
                      <th scope="col" className="text-center">{t("actions", "Actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAnswerLetters.length > 0 ? (
                      filteredAnswerLetters.map((item, idx) => (
                        <tr key={item.id ? `${item.id}-${idx}` : `ans-${item.caseNo}-${idx}`} className="letter-table-row">
                          <td className="font-semibold" style={{ color: "#1e1b4b" }}>{item.caseNo}</td>
                          <td>
                            <span style={{ fontWeight: 600, color: "#334155" }}>
                              {item.senderName || "—"}
                            </span>
                          </td>
                          <td className="subject-cell">{item.subject}</td>
                          <td>{item.letterDate || "—"}</td>
                          <td>{item.receivedDate || "—"}</td>
                          <td>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                backgroundColor: "#dcfce7",
                                color: "#15803d",
                                padding: "4px 10px",
                                borderRadius: "12px",
                                fontSize: "12px",
                                fontWeight: 700,
                                border: "1px solid #bbf7d0"
                              }}
                            >
                              <CheckCircle size={13} />
                              {lang === "si" ? "පිළිතුරු ලිපිය" : "Answer Letter"}
                            </span>
                          </td>
                          <td className="text-center actions-cell">
                            <Link
                              href={`/subject/add-details?caseNo=${item.caseNo}`}
                              className="add-details-link"
                            >
                              {t("addDetails", "Add Details / View Case")}
                            </Link>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="text-center py-5 text-muted" style={{ padding: "40px 20px" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                            <MailCheck size={40} style={{ color: "#cbd5e1" }} />
                            <span style={{ fontSize: "15px", fontWeight: 600, color: "#64748b" }}>
                              {answerSearchQuery
                                ? (lang === "si" ? "සෙවීමට ගැළපෙන පිළිතුරු ලිපි හමු නොවිණි" : "No answer letters found matching search")
                                : (lang === "si" ? "පවරන ලද පිළිතුරු ලිපි නොමැත" : "No assigned answer letters found")}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ==================== TAB: CONDUCTING AN INQUIRY ==================== */}
          {activeTab === "conducting_inquiry" && (
            <section style={{ marginBottom: "30px" }}>
              {/* Header Row with Action */}
              <div className="section-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#1e1b4b", display: "flex", alignItems: "center", gap: "10px" }}>
                    <ShieldCheck style={{ color: "#0284c7", width: "26px", height: "26px" }} />
                    <span>{t("conductingInquiryTab", "Conducting an inquiry")}</span>
                  </h3>
                  <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                    {t("conductingInquiryDesc", "Preliminary and formal inquiry hearings, appointed committee members, witness statements, and investigative report timelines.")}
                  </p>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <Link
                    href="/subject/add-details"
                    className="btn-create-rec"
                    style={{ background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)" }}
                  >
                    <Plus size={16} />
                    <span>{lang === "si" ? "නව පරීක්ෂණ සටහන" : "New Inquiry Entry"}</span>
                  </Link>
                </div>
              </div>

              {/* Inquiry KPI Cards */}
              <div className="inquiry-kpi-grid">
                <div className="inquiry-kpi-card inquiry-card-blue">
                  <div className="premium-card-top">
                    <div className="premium-card-title-area">
                      <ShieldCheck className="premium-card-icon" />
                      <span>{t("totalInquiriesCount", "Total Inquiries")}</span>
                    </div>
                  </div>
                  <div className="premium-card-bottom">
                    <div className="premium-card-value-area">
                      <span className="premium-card-value">{String(conductingInquiryCases.length).padStart(2, "0")}</span>
                      <span className="premium-card-label">{lang === "si" ? "පරීක්ෂණ" : "inquiries"}</span>
                    </div>
                  </div>
                </div>

                <div className="inquiry-kpi-card inquiry-card-amber">
                  <div className="premium-card-top">
                    <div className="premium-card-title-area">
                      <UserCheck className="premium-card-icon" />
                      <span>{t("activeInquiryCommittees", "Inquiry Committees & Panels")}</span>
                    </div>
                  </div>
                  <div className="premium-card-bottom">
                    <div className="premium-card-value-area">
                      <span className="premium-card-value">
                        {String(conductingInquiryCases.filter((c: any) => (c.chairman?.name && c.chairman.name !== "—") || (c.members && c.members.length > 0)).length).padStart(2, "0")}
                      </span>
                      <span className="premium-card-label">{lang === "si" ? "කමිටු" : "panels"}</span>
                    </div>
                  </div>
                </div>

                <div className="inquiry-kpi-card inquiry-card-indigo">
                  <div className="premium-card-top">
                    <div className="premium-card-title-area">
                      <CalendarIcon className="premium-card-icon" />
                      <span>{t("scheduledHearingsCount", "Scheduled Hearings")}</span>
                    </div>
                  </div>
                  <div className="premium-card-bottom">
                    <div className="premium-card-value-area">
                      <span className="premium-card-value">
                        {String(conductingInquiryCases.filter((c: any) => c.stageKey === "scheduled" || c.stageKey === "inquiry").length).padStart(2, "0")}
                      </span>
                      <span className="premium-card-label">{lang === "si" ? "සැලසුම් කළ" : "scheduled"}</span>
                    </div>
                  </div>
                </div>

                <div className="inquiry-kpi-card inquiry-card-purple">
                  <div className="premium-card-top">
                    <div className="premium-card-title-area">
                      <FileCheck className="premium-card-icon" />
                      <span>{t("inquiryReportsPending", "Reports Due / Pending")}</span>
                    </div>
                  </div>
                  <div className="premium-card-bottom">
                    <div className="premium-card-value-area">
                      <span className="premium-card-value">
                        {String(conductingInquiryCases.filter((c: any) => c.stageKey === "report_pending" || c.extensionCount !== "None").length).padStart(2, "0")}
                      </span>
                      <span className="premium-card-label">{lang === "si" ? "වාර්තා" : "reports"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filter and Search Bar */}
              <div className="letters-list-header" style={{ marginBottom: "16px", backgroundColor: "#ffffff", padding: "12px 18px", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "#1e1b4b", fontSize: "14px" }}>
                  <Filter size={16} style={{ color: "#0284c7" }} />
                  <span>{lang === "si" ? "පරීක්ෂණ නඩු පෙරීම" : "Filter Inquiries"}</span>
                </div>

                <div className="letters-filters-group" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", margin: 0 }}>
                  {/* Search Bar */}
                  <div className="search-box" style={{ width: "240px" }}>
                    <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={inquirySearchQuery}
                      onChange={(e) => setInquirySearchQuery(e.target.value)}
                      placeholder={t("searchInquiryPlaceholder", "Search inquiry cases (Case No, Officer, Institute, Chairman)...")}
                      className="search-input"
                    />
                  </div>

                  {/* Stage Filter */}
                  <div className="filter-dropdown-wrapper">
                    <select
                      value={inquiryStageFilter}
                      onChange={(e) => setInquiryStageFilter(e.target.value)}
                      className="filter-priority-select"
                      style={{ maxWidth: "200px" }}
                    >
                      <option value="all">{t("stageFilterAll", "All Inquiry Stages")}</option>
                      <option value="prelim">{t("stageFilterPrelim", "Preliminary Inquiry")}</option>
                      <option value="inquiry">{t("stageFilterInquiry", "Conducting an Inquiry")}</option>
                      <option value="scheduled">{t("stageFilterHearingScheduled", "Inquiry Hearing Scheduled")}</option>
                      <option value="report_pending">{t("stageFilterReportPending", "Report Submission Pending")}</option>
                      <option value="concluded">{t("stageFilterConcluded", "Inquiry Concluded")}</option>
                    </select>
                  </div>

                  {/* Priority Filter */}
                  <div className="filter-dropdown-wrapper">
                    <select
                      value={inquiryPriorityFilter}
                      onChange={(e: any) => setInquiryPriorityFilter(e.target.value)}
                      className="filter-priority-select"
                    >
                      <option value="all">{t("priorityAll", "All Priorities")}</option>
                      <option value="high">🔴 {t("priorityHigh", "High Priority")}</option>
                      <option value="medium">🟡 {t("priorityMedium", "Medium Priority")}</option>
                      <option value="low">🟢 {t("priorityLow", "Low Priority")}</option>
                    </select>
                  </div>

                  {(inquirySearchQuery || inquiryStageFilter !== "all" || inquiryPriorityFilter !== "all") && (
                    <a
                      href="#"
                      className="view-all-reset-link"
                      onClick={(e) => {
                        e.preventDefault();
                        setInquirySearchQuery("");
                        setInquiryStageFilter("all");
                        setInquiryPriorityFilter("all");
                      }}
                    >
                      {t("viewAll")} <span className="arrow-span">→</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Inquiry Data Table */}
              <div className="table-responsive-container">
                <table className="letters-data-table">
                  <thead>
                    <tr>
                      <th scope="col">{t("caseNo", "Case No / Ref")}</th>
                      <th scope="col">{t("accusedOfficerAndInstitute", "Accused Officer & Institution")}</th>
                      <th scope="col">{t("inquiryCommittee", "Inquiry Committee / Officers")}</th>
                      <th scope="col">{t("subjectText", "Subject / Inquired Allegation")}</th>
                      <th scope="col">{t("stageStatus", "Inquiry Stage")}</th>
                      <th scope="col">{t("hearingDates", "Hearing & Due Dates")}</th>
                      <th scope="col">{t("priority", "Priority")}</th>
                      <th scope="col" className="text-center">{t("actions", "Actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInquiryCases.length > 0 ? (
                      filteredInquiryCases.map((item, idx) => {
                        const isChairmanValid = item.chairman && item.chairman.name && item.chairman.name !== "—";
                        const hasMembers = item.members && item.members.length > 0;

                        return (
                          <tr key={item.id ? `${item.id}-${idx}` : `inq-${item.caseNo}-${idx}`} className="letter-table-row">
                            {/* Case No */}
                            <td className="font-semibold" style={{ color: "#1e1b4b" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <span style={{ fontWeight: 800, color: "#0284c7", fontSize: "14px" }}>{item.caseNo}</span>
                                {item.extensionCount && item.extensionCount !== "None" && (
                                  <span style={{ fontSize: "11px", color: "#b45309", fontWeight: 700, backgroundColor: "#fef3c7", padding: "1px 6px", borderRadius: "8px", width: "fit-content" }}>
                                    ⏱ {item.extensionCount}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Accused Officer & Institution */}
                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                                <span style={{ fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: "5px", fontSize: "13px" }}>
                                  <User size={13} style={{ color: "#0284c7" }} />
                                  {item.accusedName || "—"}
                                </span>
                                {(item.accusedDesignation || item.schoolName) && (
                                  <span style={{ fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                                    <Building size={11} style={{ color: "#94a3b8" }} />
                                    {[item.accusedDesignation, item.schoolName].filter(Boolean).join(" • ")}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Inquiry Committee */}
                            <td>
                              {isChairmanValid || hasMembers ? (
                                <div className="inquiry-committee-pill">
                                  {isChairmanValid && (
                                    <span className="inquiry-chairman-tag">
                                      👑 {lang === "si" ? "සභාපති" : "Chair"}: {item.chairman.name}
                                    </span>
                                  )}
                                  {hasMembers && (
                                    <span className="inquiry-member-tag">
                                      👥 {lang === "si" ? "සාමාජිකයින්" : "Members"}: {item.members.join(", ")}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 500 }}>
                                  — {lang === "si" ? "(පත් කිරීම අපේක්ෂිතයි)" : "(Pending Assignment)"}
                                </span>
                              )}
                            </td>

                            {/* Subject & Status notes */}
                            <td className="subject-cell" style={{ maxWidth: "240px" }}>
                              <div style={{ fontSize: "13px", color: "#1e293b", lineHeight: "1.4" }}>
                                {item.subject}
                              </div>
                              {item.proceedingsStatus && (
                                <div style={{ fontSize: "11px", color: "#475569", marginTop: "3px", fontStyle: "italic", backgroundColor: "#f0f9ff", padding: "2px 6px", borderRadius: "4px", border: "1px solid #e0f2fe" }}>
                                  📝 {item.proceedingsStatus}
                                </div>
                              )}
                            </td>

                            {/* Inquiry Stage */}
                            <td>
                              {item.stageKey === "prelim" ? (
                                <span className="inquiry-stage-pill inquiry-stage-prelim">
                                  <FileText size={12} />
                                  {lang === "si" ? "මූලික පරීක්ෂණය" : "Preliminary Inquiry"}
                                </span>
                              ) : item.stageKey === "report_pending" ? (
                                <span className="inquiry-stage-pill inquiry-stage-report">
                                  <FileCheck size={12} />
                                  {lang === "si" ? "වාර්තාව බලාපොරොත්තුවෙන්" : "Report Due / Pending"}
                                </span>
                              ) : item.stageKey === "scheduled" ? (
                                <span className="inquiry-stage-pill inquiry-stage-scheduled">
                                  <CalendarIcon size={12} />
                                  {lang === "si" ? "විභාගය සැලසුම් කර ඇත" : "Hearing Scheduled"}
                                </span>
                              ) : (
                                <span className="inquiry-stage-pill inquiry-stage-inquiry">
                                  <ShieldCheck size={12} />
                                  {lang === "si" ? "පරීක්ෂණයක් සිදු කිරීම" : "Conducting Inquiry"}
                                </span>
                              )}
                            </td>

                            {/* Key Dates & Deadlines */}
                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "12px", color: "#475569" }}>
                                {item.hearingDate && item.hearingDate !== "Pending Date" && (
                                  <span style={{ fontWeight: 600, color: "#1e1b4b" }}>
                                    📅 {lang === "si" ? "විභාගය" : "Hearing"}: {item.hearingDate}
                                  </span>
                                )}
                                {item.reportDueDate && (
                                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                                    🎯 {lang === "si" ? "වාර්තාව" : "Due"}: {item.reportDueDate}
                                  </span>
                                )}
                                {item.appointmentDate && (
                                  <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                                    Appointed: {item.appointmentDate}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Priority */}
                            <td>
                              <span className={`priority-text-container priority-text-${item.priority}`}>
                                <span className={`priority-dot dot-${item.priority}`} aria-hidden="true"></span>
                                {item.priority === "high" ? t("priorityHigh", "High") : item.priority === "medium" ? t("priorityMedium", "Medium") : t("priorityLow", "Low")}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="text-center actions-cell">
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                                <Link
                                  href={`/subject/add-details?caseNo=${item.caseNo}`}
                                  className="add-details-link"
                                  style={{ padding: "4px 10px", fontSize: "11px" }}
                                  title="Add details or case notes"
                                >
                                  {t("addDetails", "Add Details")}
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => setSelectedInquiryModal(item)}
                                  className="btn-quick-view"
                                  title="Open Inquiry Dossier"
                                  style={{ backgroundColor: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd" }}
                                >
                                  <Eye size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="text-center py-5 text-muted" style={{ padding: "40px 20px" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                            <ShieldCheck size={44} style={{ color: "#cbd5e1" }} />
                            <span style={{ fontSize: "15px", fontWeight: 600, color: "#64748b" }}>
                              {t("noInquiriesFound", "No inquiry cases found matching search criteria.")}
                            </span>
                            {(inquirySearchQuery || inquiryStageFilter !== "all" || inquiryPriorityFilter !== "all") && (
                              <button
                                type="button"
                                onClick={() => {
                                  setInquirySearchQuery("");
                                  setInquiryStageFilter("all");
                                  setInquiryPriorityFilter("all");
                                }}
                                className="btn-create-rec"
                                style={{ marginTop: "4px", backgroundColor: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1" }}
                              >
                                {t("viewAll", "Reset Filters")}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ==================== TAB: PROPER DISCIPLINARY INSPECTION ==================== */}
          {activeTab === "disciplinary_inspection" && (
            <section style={{ marginBottom: "30px" }}>
              {/* Header Row with Action */}
              <div className="section-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#1e1b4b", display: "flex", alignItems: "center", gap: "10px" }}>
                    <ShieldAlert style={{ color: "#6366f1", width: "26px", height: "26px" }} />
                    <span>{t("properDisciplinaryInspectionTab", "Proper disciplinary inspection")}</span>
                  </h3>
                  <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                    {t("properDisciplinaryInspectionDesc", "Formal disciplinary proceedings under Establishment Code, PSC charge sheets, interdictions, and disciplinary penalty orders.")}
                  </p>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <Link
                    href="/subject/recommendation"
                    className="btn-create-rec"
                    style={{ background: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)" }}
                  >
                    <Plus size={16} />
                    <span>{lang === "si" ? "විනය නිර්දේශය / සටහන" : "New Disciplinary Minute"}</span>
                  </Link>
                </div>
              </div>

              {/* Proper Disciplinary Inspection KPI Cards */}
              <div className="inquiry-kpi-grid">
                <div className="inquiry-kpi-card inquiry-card-purple">
                  <div className="premium-card-top">
                    <div className="premium-card-title-area">
                      <ShieldAlert className="premium-card-icon" />
                      <span>{t("totalInspectionsCount", "Total Disciplinary Inspections")}</span>
                    </div>
                  </div>
                  <div className="premium-card-bottom">
                    <div className="premium-card-value-area">
                      <span className="premium-card-value">{String(disciplinaryInspectionCases.length).padStart(2, "0")}</span>
                      <span className="premium-card-label">{lang === "si" ? "නඩු" : "cases"}</span>
                    </div>
                  </div>
                </div>

                <div className="inquiry-kpi-card inquiry-card-amber">
                  <div className="premium-card-top">
                    <div className="premium-card-title-area">
                      <FileText className="premium-card-icon" />
                      <span>{t("chargeSheetsIssuedCount", "Formal Charges Issued")}</span>
                    </div>
                  </div>
                  <div className="premium-card-bottom">
                    <div className="premium-card-value-area">
                      <span className="premium-card-value">
                        {String(disciplinaryInspectionCases.filter((c: any) => c.stageKey === "charge_sheet" || c.disciplinaryCharge).length).padStart(2, "0")}
                      </span>
                      <span className="premium-card-label">{lang === "si" ? "චෝදනා" : "charges"}</span>
                    </div>
                  </div>
                </div>

                <div className="inquiry-kpi-card inquiry-card-rose">
                  <div className="premium-card-top">
                    <div className="premium-card-title-area">
                      <AlertCircle className="premium-card-icon" />
                      <span>{t("pscReviewCount", "PSC Review / Interdictions")}</span>
                    </div>
                  </div>
                  <div className="premium-card-bottom">
                    <div className="premium-card-value-area">
                      <span className="premium-card-value">
                        {String(disciplinaryInspectionCases.filter((c: any) => c.stageKey === "psc_review" || c.stageKey === "active" || (c.interdictionStatus && c.interdictionStatus.includes("Interdicted"))).length).padStart(2, "0")}
                      </span>
                      <span className="premium-card-label">{lang === "si" ? "සමාලෝචන" : "reviews"}</span>
                    </div>
                  </div>
                </div>

                <div className="inquiry-kpi-card inquiry-card-emerald">
                  <div className="premium-card-top">
                    <div className="premium-card-title-area">
                      <CheckCircle className="premium-card-icon" />
                      <span>{t("disciplinaryOrdersCount", "Disciplinary Orders Finalized")}</span>
                    </div>
                  </div>
                  <div className="premium-card-bottom">
                    <div className="premium-card-value-area">
                      <span className="premium-card-value">
                        {String(disciplinaryInspectionCases.filter((c: any) => c.stageKey === "order_finalized" || (c.disciplinaryAction && c.disciplinaryAction.toLowerCase().includes("order"))).length).padStart(2, "0")}
                      </span>
                      <span className="premium-card-label">{lang === "si" ? "නියෝග" : "orders"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filter and Search Bar */}
              <div className="letters-list-header" style={{ marginBottom: "16px", backgroundColor: "#ffffff", padding: "12px 18px", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "#1e1b4b", fontSize: "14px" }}>
                  <Filter size={16} style={{ color: "#6366f1" }} />
                  <span>{lang === "si" ? "විනය පරීක්ෂණ පෙරීම" : "Filter Disciplinary Inspections"}</span>
                </div>

                <div className="letters-filters-group" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", margin: 0 }}>
                  {/* Search Bar */}
                  <div className="search-box" style={{ width: "240px" }}>
                    <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={inspectionSearchQuery}
                      onChange={(e) => setInspectionSearchQuery(e.target.value)}
                      placeholder={t("searchInspectionPlaceholder", "Search disciplinary inspections (Case No, Officer, Charge, Order)...")}
                      className="search-input"
                    />
                  </div>

                  {/* Stage Filter */}
                  <div className="filter-dropdown-wrapper">
                    <select
                      value={inspectionStageFilter}
                      onChange={(e) => setInspectionStageFilter(e.target.value)}
                      className="filter-priority-select"
                      style={{ maxWidth: "200px" }}
                    >
                      <option value="all">{t("inspectionStageAll", "All Inspection Stages")}</option>
                      <option value="charge_sheet">{t("inspectionStageChargeSheet", "Formal Charge Sheet Issued")}</option>
                      <option value="active">{t("inspectionStageActive", "Disciplinary Inspection Active")}</option>
                      <option value="psc_review">{t("inspectionStagePscReview", "PSC Review / Interdiction")}</option>
                      <option value="order_finalized">{t("inspectionStageOrderFinalized", "Disciplinary Order Concluded")}</option>
                    </select>
                  </div>

                  {/* Priority Filter */}
                  <div className="filter-dropdown-wrapper">
                    <select
                      value={inspectionPriorityFilter}
                      onChange={(e: any) => setInspectionPriorityFilter(e.target.value)}
                      className="filter-priority-select"
                    >
                      <option value="all">{t("priorityAll", "All Priorities")}</option>
                      <option value="high">🔴 {t("priorityHigh", "High Priority")}</option>
                      <option value="medium">🟡 {t("priorityMedium", "Medium Priority")}</option>
                      <option value="low">🟢 {t("priorityLow", "Low Priority")}</option>
                    </select>
                  </div>

                  {(inspectionSearchQuery || inspectionStageFilter !== "all" || inspectionPriorityFilter !== "all") && (
                    <a
                      href="#"
                      className="view-all-reset-link"
                      onClick={(e) => {
                        e.preventDefault();
                        setInspectionSearchQuery("");
                        setInspectionStageFilter("all");
                        setInspectionPriorityFilter("all");
                      }}
                    >
                      {t("viewAll")} <span className="arrow-span">→</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Disciplinary Inspection Data Table */}
              <div className="table-responsive-container">
                <table className="letters-data-table">
                  <thead>
                    <tr>
                      <th scope="col">{t("caseNo", "Case No / PSC Ref")}</th>
                      <th scope="col">{t("accusedOfficerAndInstitute", "Accused Officer & Institution")}</th>
                      <th scope="col">{t("inspectionOfficers", "Inspection Authority & Tribunal")}</th>
                      <th scope="col">{t("disciplinaryCharge", "Disciplinary Charge & Rule Violation")}</th>
                      <th scope="col">{t("stageStatus", "Inspection Stage / Status")}</th>
                      <th scope="col">{t("inspectionDates", "Charge & Effective Dates")}</th>
                      <th scope="col">{t("priority", "Priority")}</th>
                      <th scope="col" className="text-center">{t("actions", "Actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInspectionCases.length > 0 ? (
                      filteredInspectionCases.map((item, idx) => {
                        return (
                          <tr key={item.id ? `${item.id}-${idx}` : `disc-${item.caseNo}-${idx}`} className="letter-table-row">
                            {/* Case No */}
                            <td className="font-semibold" style={{ color: "#1e1b4b" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <span style={{ fontWeight: 800, color: "#4338ca", fontSize: "14px" }}>{item.caseNo}</span>
                                {item.pscRef && (
                                  <span style={{ fontSize: "11px", color: "#6366f1", fontWeight: 700, backgroundColor: "#f3e8ff", padding: "1px 6px", borderRadius: "8px", width: "fit-content" }}>
                                    ⚖️ {item.pscRef}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Accused Officer & Institution */}
                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                                <span style={{ fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: "5px", fontSize: "13px" }}>
                                  <User size={13} style={{ color: "#6366f1" }} />
                                  {item.accusedName || "—"}
                                </span>
                                {(item.accusedDesignation || item.schoolName) && (
                                  <span style={{ fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                                    <Building size={11} style={{ color: "#94a3b8" }} />
                                    {[item.accusedDesignation, item.schoolName].filter(Boolean).join(" • ")}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Inspection Authority */}
                            <td>
                              <div style={{ fontSize: "12px", color: "#334155", fontWeight: 600, display: "flex", flexDirection: "column", gap: "3px" }}>
                                <span>🏛 {item.inspectionAuthority || "Disciplinary Inspection Board"}</span>
                                {item.interdictionStatus && (
                                  <span style={{ fontSize: "11px", color: "#be123c", fontWeight: 700, backgroundColor: "#ffe4e6", padding: "1px 6px", borderRadius: "6px", width: "fit-content" }}>
                                    {item.interdictionStatus}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Disciplinary Charge */}
                            <td className="subject-cell" style={{ maxWidth: "240px" }}>
                              <div style={{ fontSize: "13px", color: "#1e293b", lineHeight: "1.4", fontWeight: 600 }}>
                                {item.subject}
                              </div>
                              {item.disciplinaryCharge && (
                                <div style={{ fontSize: "11px", color: "#475569", marginTop: "3px", backgroundColor: "#f8fafc", padding: "3px 6px", borderRadius: "4px", border: "1px solid #f1f5f9" }}>
                                  ⚖️ {item.disciplinaryCharge}
                                </div>
                              )}
                            </td>

                            {/* Inspection Stage / Status */}
                            <td>
                              {item.stageKey === "order_finalized" ? (
                                <span className="inquiry-stage-pill inquiry-stage-order">
                                  <CheckCircle size={12} />
                                  {lang === "si" ? "විනය නියෝගය අවසන්" : "Disciplinary Order Concluded"}
                                </span>
                              ) : item.stageKey === "psc_review" ? (
                                <span className="inquiry-stage-pill inquiry-stage-psc">
                                  <AlertCircle size={12} />
                                  {lang === "si" ? "රා.සේ.කො. සමාලෝචනය" : "PSC Review / Notice"}
                                </span>
                              ) : item.stageKey === "charge_sheet" ? (
                                <span className="inquiry-stage-pill inquiry-stage-charge">
                                  <FileText size={12} />
                                  {lang === "si" ? "චෝදනා පත්‍ර නිකුත් කර ඇත" : "Charge Sheet Issued"}
                                </span>
                              ) : (
                                <span className="inquiry-stage-pill inquiry-stage-formal">
                                  <ShieldAlert size={12} />
                                  {lang === "si" ? "විධිමත් විනය පරීක්ෂණ" : "Inspection Active"}
                                </span>
                              )}
                            </td>

                            {/* Charge & Effective Dates */}
                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "12px", color: "#475569" }}>
                                {item.chargeDate && (
                                  <span style={{ fontWeight: 600, color: "#1e1b4b" }}>
                                    📋 {lang === "si" ? "චෝදනා දිනය" : "Charge Date"}: {item.chargeDate}
                                  </span>
                                )}
                                {item.effectiveDate && (
                                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                                    🎯 {lang === "si" ? "ක්‍රියාත්මක" : "Effective"}: {item.effectiveDate}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Priority */}
                            <td>
                              <span className={`priority-text-container priority-text-${item.priority}`}>
                                <span className={`priority-dot dot-${item.priority}`} aria-hidden="true"></span>
                                {item.priority === "high" ? t("priorityHigh", "High") : item.priority === "medium" ? t("priorityMedium", "Medium") : t("priorityLow", "Low")}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="text-center actions-cell">
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                                <Link
                                  href={`/subject/recommendation?caseNo=${item.caseNo}`}
                                  className="add-details-link"
                                  style={{ padding: "4px 10px", fontSize: "11px", backgroundColor: "#4f46e5" }}
                                  title="Review Disciplinary Recommendation"
                                >
                                  {lang === "si" ? "නිර්දේශය" : "Minute"}
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => setSelectedInspectionModal(item)}
                                  className="btn-quick-view"
                                  title="Open Disciplinary Inspection Dossier"
                                  style={{ backgroundColor: "#f3e8ff", color: "#6b21a8", border: "1px solid #e9d5ff" }}
                                >
                                  <Eye size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="text-center py-5 text-muted" style={{ padding: "40px 20px" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                            <ShieldAlert size={44} style={{ color: "#cbd5e1" }} />
                            <span style={{ fontSize: "15px", fontWeight: 600, color: "#64748b" }}>
                              {t("noInspectionsFound", "No disciplinary inspection cases found matching search criteria.")}
                            </span>
                            {(inspectionSearchQuery || inspectionStageFilter !== "all" || inspectionPriorityFilter !== "all") && (
                              <button
                                type="button"
                                onClick={() => {
                                  setInspectionSearchQuery("");
                                  setInspectionStageFilter("all");
                                  setInspectionPriorityFilter("all");
                                }}
                                className="btn-create-rec"
                                style={{ marginTop: "4px", backgroundColor: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1" }}
                              >
                                {t("viewAll", "Reset Filters")}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ==================== TAB 3: INVESTIGATION RECOMMENDATIONS VIEW ==================== */}
          {activeTab === "recommendations" && (
            <section style={{ marginBottom: "30px" }}>
              {/* Header Row with Action */}
              <div className="section-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#1e1b4b", display: "flex", alignItems: "center", gap: "10px" }}>
                    <Sparkles style={{ color: "#4f46e5", width: "24px", height: "24px" }} />
                    <span>{lang === "si" ? "විමර්ශන නිර්දේශ (Investigation Recommendation)" : lang === "ta" ? "விசாரணை பரிந்துரை (Investigation Recommendation)" : "Investigation Recommendation"}</span>
                  </h3>
                  <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                    {t("recommendationsOverview", "Overview of all investigation recommendations and disciplinary actions registered for your assigned cases.")}
                  </p>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <Link
                    href="/subject/recommendation"
                    className="btn-create-rec"
                  >
                    <Plus size={16} />
                    <span>{t("newRecommendationBtn", "New Recommendation")}</span>
                  </Link>
                </div>
              </div>

              {/* Alert Banner for Completed Investigation Cases Awaiting Recommendation */}
              {completedAwaitingRecCases.length > 0 && (
                <div style={{
                  backgroundColor: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "14px",
                  padding: "14px 20px",
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
                          ? `විමර්ශනය අවසන් නඩු ${completedAwaitingRecCases.length} ක් නිර්දේශ සඳහා පවරා ඇත` 
                          : `${completedAwaitingRecCases.length} Completed Investigation Case(s) Assigned for Recommendation`}
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
                      {completedAwaitingRecCases.length} {lang === "si" ? "අපේක්ෂිතයි" : "Pending Action"}
                    </span>
                  </div>
                </div>
              )}

              {/* Recommendation Quick Summary KPI Cards */}
              <div className="dashboard-stats-grid subject-stats-grid" style={{ marginBottom: "20px" }}>
                <div className="premium-stat-card total-cases-card" style={{ height: "100px", padding: "16px" }}>
                  <div className="premium-card-top">
                    <div className="premium-card-title-area">
                      <FileCheck className="premium-card-icon" />
                      <span>{t("completedInvestigationsCount", "Completed Investigations")}</span>
                    </div>
                  </div>
                  <div className="premium-card-bottom">
                    <div className="premium-card-value-area">
                      <span className="premium-card-value">{String(completedInvestigationCases.length).padStart(2, "0")}</span>
                      <span className="premium-card-label">{lang === "si" ? "නඩු" : "cases"}</span>
                    </div>
                  </div>
                </div>

                <div className="premium-stat-card inprogress-cases-card" style={{ height: "100px", padding: "16px", background: completedAwaitingRecCases.length > 0 ? "linear-gradient(135deg, #e11d48, #be123c)" : "linear-gradient(135deg, #f97316, #c2410c)" }}>
                  <div className="premium-card-top">
                    <div className="premium-card-title-area">
                      <ShieldAlert className="premium-card-icon" />
                      <span>{t("awaitingRecommendation", "Awaiting Recommendation")}</span>
                    </div>
                  </div>
                  <div className="premium-card-bottom">
                    <div className="premium-card-value-area">
                      <span className="premium-card-value">{String(completedAwaitingRecCases.length).padStart(2, "0")}</span>
                      <span className="premium-card-label">{lang === "si" ? "අපේක්ෂිත" : "pending"}</span>
                    </div>
                  </div>
                </div>

                <div className="premium-stat-card closed-cases-card" style={{ height: "100px", padding: "16px", background: "linear-gradient(135deg, #4f46e5, #3730a3)" }}>
                  <div className="premium-card-top">
                    <div className="premium-card-title-area">
                      <CheckCircle className="premium-card-icon" />
                      <span>{t("submittedRecommendations", "Submitted")}</span>
                    </div>
                  </div>
                  <div className="premium-card-bottom">
                    <div className="premium-card-value-area">
                      <span className="premium-card-value">
                        {String(recommendations.filter(r => r.status === "Submitted" || r.status === "Approved").length).padStart(2, "0")}
                      </span>
                      <span className="premium-card-label">{lang === "si" ? "යොමු කළ" : "submitted"}</span>
                    </div>
                  </div>
                </div>

                <div className="premium-stat-card pending-cases-card" style={{ height: "100px", padding: "16px" }}>
                  <div className="premium-card-top">
                    <div className="premium-card-title-area">
                      <Clock className="premium-card-icon" />
                      <span>{t("draftRecommendations", "Drafts")}</span>
                    </div>
                  </div>
                  <div className="premium-card-bottom">
                    <div className="premium-card-value-area">
                      <span className="premium-card-value">
                        {String(recommendations.filter(r => r.status === "Draft").length).padStart(2, "0")}
                      </span>
                      <span className="premium-card-label">{lang === "si" ? "කෙටුම්පත්" : "drafts"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dedicated Section: Completed Investigation Cases Assigned for Recommendation */}
              {completedInvestigationCases.length > 0 && (
                <div style={{ marginBottom: "24px", backgroundColor: "#ffffff", borderRadius: "16px", border: "1px solid #e2e8f0", padding: "20px 24px", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#1e1b4b", display: "flex", alignItems: "center", gap: "8px" }}>
                        <CheckCircle size={18} style={{ color: "#16a34a" }} />
                        <span>{t("completedInvestigationsTitle", "Completed Investigation Cases Assigned for Recommendation")}</span>
                        <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: "12px" }}>
                          {completedInvestigationCases.length} {lang === "si" ? "නඩු" : "Cases"}
                        </span>
                      </h4>
                      <p style={{ margin: "3px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                        {t("completedInvestigationsSubtitle", "Cases where initial investigation has been completed and assigned to you for recommendation formulation.")}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "14px" }}>
                    {completedInvestigationCases.map((c) => {
                      const rec = recommendations.find((r) => (r.caseNo || "").trim().toLowerCase() === (c.caseNo || "").trim().toLowerCase());
                      const isSubmitted = rec && (rec.status === "Submitted" || rec.status === "Approved");
                      const isDraft = rec && rec.status === "Draft";

                      return (
                        <div
                          key={`completed-inv-${c.caseNo}`}
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
                                <div style={{ fontSize: "11px", color: "#16a34a", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                                  <CheckCircle size={12} />
                                  <span>{lang === "si" ? "මූලික විමර්ශනය අවසන්" : "Initial Investigation Complete"}</span>
                                </div>
                              </div>

                              {isSubmitted ? (
                                <span style={{ fontSize: "11px", fontWeight: 700, color: "#15803d", backgroundColor: "#dcfce7", padding: "3px 10px", borderRadius: "12px", border: "1px solid #bbf7d0" }}>
                                  ✓ {lang === "si" ? "නිර්දේශය යොමු කළා" : "Submitted"}
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
                              {c.letterDate || c.assignedDate}
                            </span>
                            <Link
                              href={`/subject/recommendation?caseNo=${c.caseNo}`}
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
                                textDecoration: "none",
                                transition: "all 0.15s ease"
                              }}
                            >
                              {isSubmitted ? (
                                <>
                                  <span>View Recommendation</span>
                                  <ArrowRight size={12} />
                                </>
                              ) : isDraft ? (
                                <>
                                  <span>Edit Draft</span>
                                  <ArrowRight size={12} />
                                </>
                              ) : (
                                <>
                                  <Plus size={13} />
                                  <span>{t("addRecommendationForCase", "+ Add Recommendation")}</span>
                                </>
                              )}
                            </Link>
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
                  <span>Filter Recommendations</span>
                </div>

                <div className="letters-filters-group" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", margin: 0 }}>
                  {/* Search Bar */}
                  <div className="search-box" style={{ width: "220px" }}>
                    <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={recSearchQuery}
                      onChange={(e) => setRecSearchQuery(e.target.value)}
                      placeholder={t("searchRecommendationsPlaceholder", "Search recommendations...")}
                      className="search-input"
                    />
                  </div>

                  {/* Category Filter */}
                  <div className="filter-dropdown-wrapper">
                    <select
                      value={recCategoryFilter}
                      onChange={(e) => setRecCategoryFilter(e.target.value)}
                      className="filter-priority-select"
                      style={{ maxWidth: "160px" }}
                    >
                      <option value="all">{t("filterByCategory", "All Categories")}</option>
                      <option value="issuing_charge_sheet">{lang === "si" ? "චෝදනා පත්‍රයක් නිකුත් කිරීම" : "Issuing Charge Sheet"}</option>
                      <option value="action_based_on_court_verdict">{lang === "si" ? "අධිකරණ තීන්දුව මත ක්‍රියාමාර්ග" : "Court Verdict Action"}</option>
                      <option value="giving_warnings_advice">{lang === "si" ? "අවවාද / උපදෙස්" : "Warnings/Advice"}</option>
                      <option value="transfers">{lang === "si" ? "ස්ථාන මාරු කිරීම්" : "Transfers"}</option>
                      <option value="charging_based_on_more_104">{lang === "si" ? "MoRE 104 චෝදනා" : "MoRE 104 Charging"}</option>
                      <option value="terminating_service">{lang === "si" ? "සේවය අවසන් කිරීම" : "Terminating Service"}</option>
                      <option value="sending_recommendation_other_departments">{lang === "si" ? "වෙනත් දෙපාර්තමේන්තු වෙත" : "Other Departments"}</option>
                      <option value="closing_action_non_disclosure">{lang === "si" ? "ක්‍රියාමාර්ගය අවසන් කිරීම" : "Closing Action"}</option>
                      <option value="other">{lang === "si" ? "වෙනත්" : "Other"}</option>
                    </select>
                  </div>

                  {/* Urgency Filter */}
                  <div className="filter-dropdown-wrapper">
                    <select
                      value={recUrgencyFilter}
                      onChange={(e) => setRecUrgencyFilter(e.target.value)}
                      className="filter-priority-select"
                    >
                      <option value="all">{t("filterByUrgency", "All Urgencies")}</option>
                      <option value="high">🔴 High / Urgent</option>
                      <option value="normal">🟡 Normal</option>
                      <option value="low">🟢 Low</option>
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div className="filter-dropdown-wrapper">
                    <select
                      value={recStatusFilter}
                      onChange={(e) => setRecStatusFilter(e.target.value)}
                      className="filter-priority-select"
                    >
                      <option value="all">All Statuses</option>
                      <option value="Awaiting">{lang === "si" ? "නිර්දේශ අපේක්ෂිතයි (Awaiting Action)" : "Awaiting Recommendation"}</option>
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
                      {t("viewAll")} <span className="arrow-span">→</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Data Table */}
              <div className="table-responsive-container">
                <table className="letters-data-table">
                  <thead>
                    <tr>
                      <th scope="col">{t("caseNo")}</th>
                      <th scope="col">{lang === "si" ? "චෝදනා ලත් නිලධාරියා / ආයතනය" : "Accused Officer / Institution"}</th>
                      <th scope="col">{lang === "si" ? "නිර්දේශ වර්ගය සහ මාතෘකාව" : "Category & Recommendation"}</th>
                      <th scope="col">{lang === "si" ? "ප්‍රමුඛතාව" : "Urgency"}</th>
                      <th scope="col">{t("status", "Status")}</th>
                      <th scope="col">{lang === "si" ? "යොමු කළ අංශය" : "Forwarded To"}</th>
                      <th scope="col">{lang === "si" ? "දිනය" : "Target / Date"}</th>
                      <th scope="col" className="text-center">{t("actions", "Actions")}</th>
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
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                <span className="badge-category-tag" title={getCategoryLabel(item.category)}>
                                  {getCategoryLabel(item.category)}
                                </span>
                                {item.category === "issuing_charge_sheet" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveTab("disciplinary_inspection");
                                      setInspectionSearchQuery(item.caseNo);
                                    }}
                                    className="badge-proper-inspection"
                                    style={{ cursor: "pointer", border: "none" }}
                                    title="View in Proper Disciplinary Inspection"
                                  >
                                    <ShieldAlert size={11} />
                                    <span>{lang === "si" ? "විධිමත් විනය පරීක්ෂණ" : "Proper Inspection"}</span>
                                  </button>
                                )}
                              </div>
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
                              <Link
                                href={`/subject/recommendation?caseNo=${item.caseNo}`}
                                className="add-details-link"
                                style={{ padding: "4px 12px", fontSize: "11px" }}
                                title="Open full recommendation form"
                              >
                                {item.status === "Draft" ? "Edit Draft" : "View / Edit"}
                              </Link>
                              {item.category === "issuing_charge_sheet" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveTab("disciplinary_inspection");
                                    setInspectionSearchQuery(item.caseNo);
                                  }}
                                  className="btn-quick-view"
                                  style={{ backgroundColor: "#ede9fe", color: "#5b21b6", border: "1px solid #c4b5fd" }}
                                  title="Open in Proper Disciplinary Inspection"
                                >
                                  <ShieldAlert size={13} />
                                </button>
                              )}
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
                            <Link
                              href="/subject/recommendation"
                              className="btn-create-rec"
                              style={{ marginTop: "4px" }}
                            >
                              <Plus size={16} />
                              <span>{lang === "si" ? "නව නිර්දේශයක් එක් කරන්න" : "Create First Recommendation"}</span>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Footer Branding Notice */}
          <SiteFooter />
        </main>
      </div>

      {/* ==================== QUICK INQUIRY & DISCIPLINARY INSPECTION DOSSIER MODAL ==================== */}
      {selectedInquiryModal && (
        <div className="inquiry-dossier-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="inquiry-dossier-title">
          <div className="inquiry-dossier-modal-content">
            
            {/* Modal Header */}
            <div className="inquiry-dossier-header">
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "12px", backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ShieldCheck size={22} style={{ color: "#a5b4fc" }} />
                </div>
                <div>
                  <h3 id="inquiry-dossier-title" style={{ margin: 0, fontSize: "18px", fontWeight: 800, letterSpacing: "-0.2px" }}>
                    {t("inquiryDossierTitle", "Formal Inquiry & Disciplinary Inspection Dossier")}
                  </h3>
                  <div style={{ fontSize: "12px", opacity: 0.85, marginTop: "2px" }}>
                    Case Ref: <strong>{selectedInquiryModal.caseNo}</strong> • Stage: {selectedInquiryModal.stage}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedInquiryModal(null)}
                style={{ background: "transparent", border: "none", color: "#ffffff", opacity: 0.8, cursor: "pointer", padding: "4px" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="inquiry-dossier-body">
              {/* Accused Officer Profile Card */}
              <div className="inquiry-dossier-section">
                <div className="inquiry-dossier-section-title">
                  <User size={14} style={{ color: "#6366f1" }} />
                  <span>Accused Officer Information (චූදිත නිලධාරී තොරතුරු)</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", fontSize: "13px" }}>
                  <div>
                    <span style={{ color: "#64748b", fontSize: "11px", fontWeight: 600, display: "block" }}>Full Name:</span>
                    <strong style={{ color: "#1e293b" }}>{selectedInquiryModal.accusedName || "—"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", fontSize: "11px", fontWeight: 600, display: "block" }}>Designation / Position:</span>
                    <span style={{ color: "#334155", fontWeight: 600 }}>{selectedInquiryModal.accusedDesignation || "—"}</span>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", fontSize: "11px", fontWeight: 600, display: "block" }}>Educational Institute:</span>
                    <span style={{ color: "#334155", fontWeight: 600 }}>{selectedInquiryModal.schoolName || "—"}</span>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", fontSize: "11px", fontWeight: 600, display: "block" }}>Priority Rating:</span>
                    <span style={{ textTransform: "capitalize", fontWeight: 700, color: selectedInquiryModal.priority === "high" ? "#dc2626" : selectedInquiryModal.priority === "medium" ? "#d97706" : "#16a34a" }}>
                      {selectedInquiryModal.priority} Priority
                    </span>
                  </div>
                </div>
              </div>

              {/* Inquiry Committee Panel */}
              <div className="inquiry-dossier-section" style={{ backgroundColor: "#fefce8", borderColor: "#fef08a" }}>
                <div className="inquiry-dossier-section-title" style={{ color: "#854d0e" }}>
                  <UserCheck size={14} style={{ color: "#ca8a04" }} />
                  <span>Inquiry Committee Composition (විමර්ශන / පරීක්ෂණ කමිටුව)</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontWeight: 700, color: "#92400e" }}>👑 Chairman (සභාපති):</span>
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>
                      {selectedInquiryModal.chairman?.name || "Assigned Inquiry Officer"}
                    </span>
                    {selectedInquiryModal.chairman?.nic && selectedInquiryModal.chairman?.nic !== "—" && (
                      <span style={{ fontSize: "11px", color: "#64748b" }}>(NIC: {selectedInquiryModal.chairman.nic})</span>
                    )}
                  </div>
                  {selectedInquiryModal.members && selectedInquiryModal.members.length > 0 && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                      <span style={{ fontWeight: 700, color: "#78350f" }}>👥 Members (සාමාජිකයින්):</span>
                      <span style={{ color: "#334155" }}>{selectedInquiryModal.members.join(", ")}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Subject Matter & Proceedings Notes */}
              <div className="inquiry-dossier-section">
                <div className="inquiry-dossier-section-title">
                  <FileText size={14} style={{ color: "#6366f1" }} />
                  <span>Subject Matter & Disciplinary Scope (විෂය කරුණ සහ විනය විෂය පථය)</span>
                </div>
                <p style={{ margin: "0 0 10px 0", fontSize: "13px", color: "#1e293b", lineHeight: 1.5, fontWeight: 500 }}>
                  {selectedInquiryModal.subject}
                </p>
                {selectedInquiryModal.notes && (
                  <div style={{ fontSize: "12px", color: "#475569", backgroundColor: "#ffffff", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                    <strong>Proceedings Status:</strong> {selectedInquiryModal.notes}
                  </div>
                )}
              </div>

              {/* Schedule & Disciplinary Orders */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
                <div className="inquiry-dossier-section">
                  <div className="inquiry-dossier-section-title">
                    <CalendarIcon size={14} style={{ color: "#0284c7" }} />
                    <span>Inquiry Timelines</span>
                  </div>
                  <div style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "6px", color: "#334155" }}>
                    <div>Appointed: <strong>{selectedInquiryModal.appointmentDate || "—"}</strong></div>
                    <div>Hearing Date: <strong>{selectedInquiryModal.hearingDate || "—"}</strong></div>
                    <div>Target Due: <strong>{selectedInquiryModal.reportDueDate || "—"}</strong></div>
                    <div>Extension History: <strong>{selectedInquiryModal.extensionCount || "None"}</strong></div>
                  </div>
                </div>

                <div className="inquiry-dossier-section" style={{ backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" }}>
                  <div className="inquiry-dossier-section-title" style={{ color: "#065f46" }}>
                    <ShieldCheck size={14} style={{ color: "#10b981" }} />
                    <span>Disciplinary Action & Order</span>
                  </div>
                  <p style={{ margin: 0, fontSize: "12px", color: "#064e3b", fontWeight: 600, lineHeight: 1.4 }}>
                    {selectedInquiryModal.disciplinaryAction || "Pending final committee determination."}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <footer style={{ padding: "14px 24px", borderTop: "1px solid #e2e8f0", backgroundColor: "#f8fafc", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setSelectedInquiryModal(null)}
                style={{ padding: "8px 18px", borderRadius: "8px", backgroundColor: "#ffffff", border: "1px solid #cbd5e1", color: "#475569", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
              >
                Close
              </button>
              <Link
                href={`/subject/add-details?caseNo=${selectedInquiryModal.caseNo}`}
                className="btn-create-rec"
                style={{ padding: "8px 16px", fontSize: "13px", backgroundColor: "#4f46e5" }}
              >
                <Plus size={14} />
                <span>Add Details / Step</span>
              </Link>
              <Link
                href={`/subject/recommendation?caseNo=${selectedInquiryModal.caseNo}`}
                className="btn-create-rec"
                style={{ padding: "8px 16px", fontSize: "13px", background: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)" }}
              >
                <ExternalLink size={14} />
                <span>Recommendation</span>
              </Link>
            </footer>

          </div>
        </div>
      )}

      {/* ==================== QUICK PROPER DISCIPLINARY INSPECTION DOSSIER MODAL ==================== */}
      {selectedInspectionModal && (
        <div className="inquiry-dossier-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="inspection-dossier-title">
          <div className="inquiry-dossier-modal-content" style={{ maxWidth: "780px" }}>
            
            {/* Modal Header */}
            <div className="inquiry-dossier-header" style={{ background: "linear-gradient(135deg, #312e81 0%, #4338ca 100%)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "12px", backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ShieldAlert size={22} style={{ color: "#c7d2fe" }} />
                </div>
                <div>
                  <h3 id="inspection-dossier-title" style={{ margin: 0, fontSize: "18px", fontWeight: 800, letterSpacing: "-0.2px" }}>
                    {t("inspectionDossierTitle", "Proper Disciplinary Inspection Dossier")}
                  </h3>
                  <div style={{ fontSize: "12px", opacity: 0.85, marginTop: "2px" }}>
                    Case Ref: <strong>{selectedInspectionModal.caseNo}</strong> • PSC Ref: <strong>{selectedInspectionModal.pscRef || "—"}</strong> • Stage: {selectedInspectionModal.stage}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedInspectionModal(null)}
                style={{ background: "transparent", border: "none", color: "#ffffff", opacity: 0.8, cursor: "pointer", padding: "4px" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="inquiry-dossier-body">
              {/* Accused Officer Profile Card */}
              <div className="inquiry-dossier-section">
                <div className="inquiry-dossier-section-title">
                  <User size={14} style={{ color: "#6366f1" }} />
                  <span>Accused Officer Information (චූදිත නිලධාරී තොරතුරු)</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", fontSize: "13px" }}>
                  <div>
                    <span style={{ color: "#64748b", fontSize: "11px", fontWeight: 600, display: "block" }}>Full Name:</span>
                    <strong style={{ color: "#1e293b" }}>{selectedInspectionModal.accusedName || "—"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", fontSize: "11px", fontWeight: 600, display: "block" }}>Designation / Position:</span>
                    <span style={{ color: "#334155", fontWeight: 600 }}>{selectedInspectionModal.accusedDesignation || "—"}</span>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", fontSize: "11px", fontWeight: 600, display: "block" }}>Educational Institute:</span>
                    <span style={{ color: "#334155", fontWeight: 600 }}>{selectedInspectionModal.schoolName || "—"}</span>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", fontSize: "11px", fontWeight: 600, display: "block" }}>Priority Rating:</span>
                    <span style={{ textTransform: "capitalize", fontWeight: 700, color: selectedInspectionModal.priority === "high" ? "#dc2626" : selectedInspectionModal.priority === "medium" ? "#d97706" : "#16a34a" }}>
                      {selectedInspectionModal.priority} Priority
                    </span>
                  </div>
                </div>
              </div>

              {/* Inspection Authority & PSC Tribunal */}
              <div className="inquiry-dossier-section" style={{ backgroundColor: "#f5f3ff", borderColor: "#ddd6fe" }}>
                <div className="inquiry-dossier-section-title" style={{ color: "#5b21b6" }}>
                  <ShieldCheck size={14} style={{ color: "#7c3aed" }} />
                  <span>Inspection Authority & Tribunal (විනය පරීක්ෂණ මණ්ඩලය / අධිකාරිය)</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontWeight: 700, color: "#6b21a8" }}>🏛 Authority / Tribunal:</span>
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>
                      {selectedInspectionModal.inspectionAuthority || "Disciplinary Inspection Board"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    {selectedInspectionModal.pscRef && (
                      <span style={{ fontSize: "12px", color: "#4338ca", fontWeight: 700, backgroundColor: "#e0e7ff", padding: "2px 8px", borderRadius: "6px" }}>
                        ⚖️ PSC Ref: {selectedInspectionModal.pscRef}
                      </span>
                    )}
                    {selectedInspectionModal.interdictionStatus && (
                      <span style={{ fontSize: "12px", color: "#991b1b", fontWeight: 700, backgroundColor: "#fee2e2", padding: "2px 8px", borderRadius: "6px" }}>
                        ⚡ Interdiction Status: {selectedInspectionModal.interdictionStatus}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Disciplinary Charge & Scope */}
              <div className="inquiry-dossier-section">
                <div className="inquiry-dossier-section-title">
                  <FileText size={14} style={{ color: "#6366f1" }} />
                  <span>Disciplinary Charge & Rule Violation (විනය චෝදනා සහ ආයතන සංග්‍රහය)</span>
                </div>
                <p style={{ margin: "0 0 10px 0", fontSize: "13px", color: "#1e293b", lineHeight: 1.5, fontWeight: 600 }}>
                  {selectedInspectionModal.subject}
                </p>
                {selectedInspectionModal.disciplinaryCharge && (
                  <div style={{ fontSize: "12.5px", color: "#4338ca", backgroundColor: "#eef2ff", padding: "10px 14px", borderRadius: "8px", border: "1px solid #c7d2fe", fontWeight: 600, marginBottom: "8px" }}>
                    ⚖️ {selectedInspectionModal.disciplinaryCharge}
                  </div>
                )}
                {selectedInspectionModal.notes && (
                  <div style={{ fontSize: "12px", color: "#475569", backgroundColor: "#ffffff", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                    <strong>Proceedings Status:</strong> {selectedInspectionModal.notes}
                  </div>
                )}
              </div>

              {/* Charge Sheet & Disciplinary Order Details */}
              {(selectedInspectionModal.issuedChargeSheet || selectedInspectionModal.chargeSheetIssuedDate || selectedInspectionModal.chargeSheetResponseDate || selectedInspectionModal.disciplinaryOrder) && (
                <div className="inquiry-dossier-section" style={{ backgroundColor: "#f0fdf4", borderColor: "#86efac" }}>
                  <div className="inquiry-dossier-section-title" style={{ color: "#15803d" }}>
                    <FileCheck size={14} style={{ color: "#16a34a" }} />
                    <span>Formal Charge Sheet & Disciplinary Order Details (චෝදනා පත්‍ර සහ විනය නියෝග විස්තර)</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", fontSize: "12.5px" }}>
                    {selectedInspectionModal.issuedChargeSheet && (
                      <div>
                        <span style={{ color: "#166534", fontSize: "11px", fontWeight: 700, display: "block" }}>Issued Charge Sheet:</span>
                        <strong style={{ color: "#14532d" }}>{selectedInspectionModal.issuedChargeSheet}</strong>
                      </div>
                    )}
                    {selectedInspectionModal.chargeSheetIssuedDate && (
                      <div>
                        <span style={{ color: "#166534", fontSize: "11px", fontWeight: 700, display: "block" }}>Charge Sheet Issue Date:</span>
                        <span style={{ color: "#14532d", fontWeight: 600 }}>{selectedInspectionModal.chargeSheetIssuedDate}</span>
                      </div>
                    )}
                    {selectedInspectionModal.chargeSheetResponseDate && (
                      <div>
                        <span style={{ color: "#166534", fontSize: "11px", fontWeight: 700, display: "block" }}>Defense Response Date:</span>
                        <span style={{ color: "#14532d", fontWeight: 600 }}>{selectedInspectionModal.chargeSheetResponseDate}</span>
                      </div>
                    )}
                    {selectedInspectionModal.disciplinaryOrder && (
                      <div style={{ gridColumn: "1 / -1", marginTop: "4px" }}>
                        <span style={{ color: "#166534", fontSize: "11px", fontWeight: 700, display: "block" }}>Final Disciplinary Order:</span>
                        <div style={{ backgroundColor: "#ffffff", padding: "8px 12px", borderRadius: "6px", border: "1px solid #bbf7d0", color: "#14532d", fontWeight: 600 }}>
                          {selectedInspectionModal.disciplinaryOrder}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Enforcement Timelines & Disciplinary Orders */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
                <div className="inquiry-dossier-section">
                  <div className="inquiry-dossier-section-title">
                    <CalendarIcon size={14} style={{ color: "#0284c7" }} />
                    <span>Inspection Timelines</span>
                  </div>
                  <div style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "6px", color: "#334155" }}>
                    <div>Charge Date: <strong>{selectedInspectionModal.chargeDate || "—"}</strong></div>
                    <div>Effective Date: <strong>{selectedInspectionModal.effectiveDate || "—"}</strong></div>
                    <div>Inspection Stage: <strong>{selectedInspectionModal.stage}</strong></div>
                  </div>
                </div>

                <div className="inquiry-dossier-section" style={{ backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" }}>
                  <div className="inquiry-dossier-section-title" style={{ color: "#065f46" }}>
                    <ShieldCheck size={14} style={{ color: "#10b981" }} />
                    <span>Final Disciplinary Order & Directives</span>
                  </div>
                  <p style={{ margin: 0, fontSize: "12px", color: "#064e3b", fontWeight: 600, lineHeight: 1.4 }}>
                    {selectedInspectionModal.disciplinaryAction || "Disciplinary inspection proceedings active."}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <footer style={{ padding: "14px 24px", borderTop: "1px solid #e2e8f0", backgroundColor: "#f8fafc", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setSelectedInspectionModal(null)}
                style={{ padding: "8px 18px", borderRadius: "8px", backgroundColor: "#ffffff", border: "1px solid #cbd5e1", color: "#475569", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
              >
                Close
              </button>
              <Link
                href={`/subject/add-details?caseNo=${selectedInspectionModal.caseNo}`}
                className="btn-create-rec"
                style={{ padding: "8px 16px", fontSize: "13px", backgroundColor: "#4f46e5" }}
              >
                <Plus size={14} />
                <span>Add Details / Step</span>
              </Link>
              <Link
                href={`/subject/recommendation?caseNo=${selectedInspectionModal.caseNo}`}
                className="btn-create-rec"
                style={{ padding: "8px 16px", fontSize: "13px", background: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)" }}
              >
                <ExternalLink size={14} />
                <span>Disciplinary Minute</span>
              </Link>
            </footer>

          </div>
        </div>
      )}

      {/* ==================== SUBMIT INVESTIGATION REPORT MODAL ==================== */}
      {isReportModalOpen && activeAssignment && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
          <div className="modal-content-wrapper premium-modal" style={{ maxWidth: "600px", width: "95%", borderRadius: "16px", overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            
            <header className="modal-header" style={{ padding: "18px 24px", backgroundColor: "#1e1b4b", color: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Send size={20} style={{ color: "#818cf8" }} />
                </div>
                <div>
                  <h3 id="report-modal-title" style={{ color: "#ffffff", margin: 0, fontSize: "17px", fontWeight: 700 }}>
                    {lang === "si" ? "විමර්ශන වාර්තාව විමර්ශන පරිපාලක වෙත යොමු කිරීම" : "Submit Investigation Report"}
                  </h3>
                  <span style={{ fontSize: "12px", color: "#cbd5e1" }}>
                    Case: <strong>{activeAssignment.caseNo}</strong>
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsReportModalOpen(false)}
                style={{ color: "#ffffff", backgroundColor: "rgba(255,255,255,0.1)", border: "none", padding: "8px", borderRadius: "50%", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </header>

            <form onSubmit={handleSubmitReport} style={{ padding: "20px 24px", backgroundColor: "#ffffff" }}>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                
                {/* Directive Summary */}
                <div style={{ backgroundColor: "#f8fafc", padding: "12px 14px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px" }}>
                  <div style={{ fontWeight: 700, color: "#334155", marginBottom: "4px" }}>Directive Details:</div>
                  <div style={{ color: "#64748b" }}>
                    Appointment Date: <strong>{activeAssignment.appointmentDate || "N/A"}</strong> | Due Date: <strong>{activeAssignment.reportDueDate || "N/A"}</strong>
                  </div>
                </div>

                {/* Report Submit Date */}
                <div className="form-field-group">
                  <label htmlFor="formReportSubmitDate" className="field-label" style={{ fontWeight: 600, color: "#334155", fontSize: "13px" }}>
                    {lang === "si" ? "වාර්තාව භාරදෙන දිනය (Report Submit Date)" : "Report Submit Date"} <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    id="formReportSubmitDate"
                    type="date"
                    value={reportDateForm}
                    onChange={(e) => setReportDateForm(e.target.value)}
                    style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", width: "100%", fontSize: "14px" }}
                  />
                </div>

                {/* Investigation Report Details / Findings */}
                <div className="form-field-group">
                  <label htmlFor="formReportContent" className="field-label" style={{ fontWeight: 600, color: "#334155", fontSize: "13px" }}>
                    {lang === "si" ? "විමර්ශන වාර්තාව සහ සොයාගැනීම් (Investigation Report Content)" : "Investigation Report & Findings"} <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <textarea
                    id="formReportContent"
                    rows={5}
                    value={reportContentForm}
                    onChange={(e) => setReportContentForm(e.target.value)}
                    placeholder={lang === "si" ? "විමර්ශන සොයාගැනීම්, නිගමන සහ නිර්දේශ මෙහි සටහන් කරන්න..." : "Enter your investigation report findings, conclusions, and recommended actions here..."}
                    style={{ padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", width: "100%", fontSize: "14px", resize: "vertical" }}
                  />
                </div>

              </div>

              <footer style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  style={{ padding: "10px 20px", borderRadius: "8px", backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1", color: "#475569", fontWeight: 600, fontSize: "14px" }}
                >
                  {t("cancelBtn", "Cancel")}
                </button>
                <button
                  type="submit"
                  style={{ padding: "10px 26px", borderRadius: "8px", backgroundColor: "#4f46e5", color: "#ffffff", border: "none", fontWeight: 600, fontSize: "14px", display: "inline-flex", alignItems: "center", gap: "8px", boxShadow: "0 2px 4px rgba(79,70,229,0.2)", cursor: "pointer" }}
                >
                  <Send size={16} />
                  <span>{lang === "si" ? "පරිපාලක වෙත යොමු කරන්න" : "Submit Report to Admin"}</span>
                </button>
              </footer>

            </form>

          </div>
        </div>
      )}

      {/* ==================== QUICK VIEW RECOMMENDATION MODAL ==================== */}
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
              
              {/* Category & Urgency Badges */}
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

              {/* Accused & Complainant Details */}
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

              {/* Secretary of Education Approval Details (If present) */}
              {(selectedRecModal.secretaryApprovalDate || selectedRecModal.secretaryApprovedRecommendation) && (
                <div style={{ backgroundColor: "#fffbeb", padding: "14px 16px", borderRadius: "10px", border: "1.5px solid #fde68a", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#92400e", display: "flex", alignItems: "center", gap: "6px" }}>
                    <UserCheck size={16} style={{ color: "#d97706" }} />
                    <span>{lang === "si" ? "අධ්‍යාපන ලේකම්ගේ අනුමැතිය සහ නියෝග" : "Secretary of Education Approval & Directive"}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    {selectedRecModal.secretaryApprovalDate && (
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#92400e", textTransform: "uppercase" }}>
                          {lang === "si" ? "අනුමත කළ දිනය" : "Date Approved by Secretary"}
                        </div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e1b4b", marginTop: "2px" }}>
                          {selectedRecModal.secretaryApprovalDate}
                        </div>
                      </div>
                    )}
                    {selectedRecModal.secretaryApprovedRecommendation && (
                      <div style={{ gridColumn: selectedRecModal.secretaryApprovalDate ? "1 / span 2" : "span 2" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#92400e", textTransform: "uppercase" }}>
                          {lang === "si" ? "අනුමත කළ නිර්දේශය" : "Recommendation Approved by Secretary"}
                        </div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e1b4b", marginTop: "2px", whiteSpace: "pre-wrap" }}>
                          {selectedRecModal.secretaryApprovedRecommendation}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recommendation Title */}
              {selectedRecModal.title && (
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Recommendation Title:</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#1e1b4b", backgroundColor: "#f1f5f9", padding: "10px 14px", borderRadius: "8px" }}>
                    {selectedRecModal.title}
                  </div>
                </div>
              )}

              {/* Detailed Recommendation Text */}
              <div>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Recommendation Content & Findings:</div>
                <div style={{ fontSize: "13px", color: "#334155", backgroundColor: "#ffffff", padding: "12px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                  {selectedRecModal.recommendationText || "No detailed text provided."}
                </div>
              </div>

              {/* Disciplinary Action */}
              {selectedRecModal.disciplinaryAction && (
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Proposed Disciplinary Action:</div>
                  <div style={{ fontSize: "13px", color: "#334155", backgroundColor: "#fff7ed", padding: "10px 14px", borderRadius: "8px", border: "1px solid #ffedd5" }}>
                    {selectedRecModal.disciplinaryAction}
                  </div>
                </div>
              )}

              {/* Reference Notes */}
              {selectedRecModal.referenceNotes && (
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Reference Notes & Remarks:</div>
                  <div style={{ fontSize: "13px", color: "#64748b", backgroundColor: "#f8fafc", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    {selectedRecModal.referenceNotes}
                  </div>
                </div>
              )}

            </div>

            <footer style={{ padding: "14px 24px", borderTop: "1px solid #e2e8f0", backgroundColor: "#f8fafc", display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setSelectedRecModal(null)}
                style={{ padding: "8px 18px", borderRadius: "8px", backgroundColor: "#ffffff", border: "1px solid #cbd5e1", color: "#475569", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
              >
                Close
              </button>
              {selectedRecModal?.category === "issuing_charge_sheet" && (
                <button
                  type="button"
                  onClick={() => {
                    const targetCaseNo = selectedRecModal.caseNo;
                    setSelectedRecModal(null);
                    setActiveTab("disciplinary_inspection");
                    setInspectionSearchQuery(targetCaseNo);
                  }}
                  className="btn-create-rec"
                  style={{ padding: "8px 16px", fontSize: "13px", background: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)" }}
                >
                  <ShieldAlert size={14} />
                  <span>{lang === "si" ? "විධිමත් විනය පරීක්ෂණ වෙත යන්න" : "Go to Disciplinary Inspection"}</span>
                </button>
              )}
              <Link
                href={`/subject/recommendation?caseNo=${selectedRecModal.caseNo}`}
                className="btn-create-rec"
                style={{ padding: "8px 20px", fontSize: "13px" }}
              >
                <ExternalLink size={14} />
                <span>Open Full Form</span>
              </Link>
            </footer>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-notification" style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#065f46", color: "#ffffff", padding: "12px 20px", borderRadius: "10px", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)", position: "fixed", bottom: "24px", right: "24px", zIndex: 9999 }}>
          <CheckCircle size={20} style={{ color: "#34d399" }} />
          <span style={{ fontWeight: 600, fontSize: "14px" }}>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}

export default function SubjectOfficerDashboard() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Loading Dashboard...</div>}>
      <SubjectOfficerDashboardContent />
    </Suspense>
  );
}

