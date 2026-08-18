import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { 
  getAccusedOfficerByRefServer, 
  getChairmanByCaseServer, 
  getMembersByCaseServer, 
  getCaseByDateExtensionServer, 
  getCaseByAppointmentAndReportDueDateServer 
} from "@/lib/db-actions";

export interface InvestigationExportRow {
  caseNo: string;
  subject: string;
  status: string;
  assignedDate: string;
  accusedOfficerName: string;
  accusedOfficerDesignation: string;
  accusedOfficerInstitute: string;
  accusedOfficerNic: string;
  chairmanName: string;
  chairmanPosition: string;
  chairmanEmail: string;
  committeeMembers: string;
  subjectOfficerName: string;
  appointmentDate: string;
  reportDueDate: string;
  extensionTerm: string;
  extensionStartDate: string;
  extensionEndDate: string;
  extensionApprovalStatus: string;
  reportSubmitDate: string;
  notes: string;
}

/**
 * Enriches raw inquiry case records with complete details (Accused Officer, Committee Chairman/Members, Dates, Extensions)
 */
export async function fetchFullInvestigationDetailsForCase(rawCase: any): Promise<InvestigationExportRow> {
  const caseNo = (rawCase.inquiryNo || rawCase.case_no || rawCase.caseNo || rawCase.refNo || rawCase.ref_no || "").trim();

  let accusedOfficerName = "";
  let accusedOfficerDesignation = "";
  let accusedOfficerInstitute = "";
  let accusedOfficerNic = "";
  let chairmanName = rawCase.chairman?.fullName || rawCase.chairman?.name || "";
  let chairmanPosition = rawCase.chairman?.position || "";
  let chairmanEmail = rawCase.chairman?.email || "";
  let committeeMembers: string[] = Array.isArray(rawCase.members)
    ? rawCase.members.map((m: any) => m.fullName || m.name || m.full_name || "").filter(Boolean)
    : [];
  let subjectOfficerName = rawCase.subjectOfficer || rawCase.subject_officer_name || rawCase.subjectOfficerName || rawCase.assignedOfficer || "";
  let appointmentDate = rawCase.appointmentDate || rawCase.appointment_date || "";
  let reportDueDate = rawCase.reportDueDate || rawCase.report_due_date || "";
  let extensionTerm = rawCase.extensionTerm || rawCase.extension_term || "None";
  let extensionStartDate = rawCase.extensionStartDate || rawCase.extension_start_date || "";
  let extensionEndDate = rawCase.extensionEndDate || rawCase.extension_end_date || "";
  let extensionApprovalStatus = rawCase.extensionApprovalStatus || rawCase.extension_approval_status || "None";
  let reportSubmitDate = rawCase.reportSubmitDate || rawCase.report_submit_date || "";
  let notes = rawCase.notes || rawCase.investigationNotes || rawCase.inquiryNotes || rawCase.progressDetails || "";

  // 1. Fetch Accused Officer details
  if (caseNo) {
    try {
      const accRes = await getAccusedOfficerByRefServer(caseNo);
      if (accRes && accRes.success && accRes.data) {
        const acc = accRes.data;
        accusedOfficerName = acc.officer_name || acc.name || acc.accused_name || "";
        accusedOfficerDesignation = acc.designation || acc.position || "";
        accusedOfficerInstitute = acc.institute_name || acc.school_name || acc.school || "";
        accusedOfficerNic = acc.nic_no || acc.nic || "";
      }
    } catch (e) {}

    // Fallback Supabase check for Accused Officer
    if (!accusedOfficerName && isSupabaseConfigured) {
      try {
        const { data: dbAcc } = await supabase
          .from("dcmms_accused_officers")
          .select("*")
          .ilike("ref_number", caseNo)
          .maybeSingle();
        if (dbAcc) {
          accusedOfficerName = dbAcc.officer_name || dbAcc.full_name || "";
          accusedOfficerDesignation = dbAcc.designation || "";
          accusedOfficerInstitute = dbAcc.institute_name || dbAcc.school_name || "";
          accusedOfficerNic = dbAcc.nic_no || "";
        }
      } catch (e) {}
    }
  }

  // 2. Fetch Committee Chairman details if missing
  if (caseNo && !chairmanName) {
    try {
      const chairRes = await getChairmanByCaseServer(caseNo);
      if (chairRes && chairRes.success && chairRes.data) {
        chairmanName = chairRes.data.full_name || "";
        chairmanPosition = chairRes.data.position || "Chairman";
        chairmanEmail = chairRes.data.email || "";
      }
    } catch (e) {}

    if (!chairmanName && isSupabaseConfigured) {
      try {
        const { data: dbChair } = await supabase
          .from("chairment_by_case")
          .select("*")
          .ilike("ref_number", caseNo)
          .maybeSingle();
        if (dbChair) {
          chairmanName = dbChair.full_name || "";
          chairmanPosition = dbChair.position || "Chairman";
          chairmanEmail = dbChair.email || "";
        }
      } catch (e) {}
    }
  }

  // 3. Fetch Committee Members details if missing
  if (caseNo && committeeMembers.length === 0) {
    try {
      const memRes = await getMembersByCaseServer(caseNo);
      if (memRes && memRes.success && Array.isArray(memRes.data)) {
        committeeMembers = memRes.data.map((m: any) => m.full_name || m.name || "").filter(Boolean);
      }
    } catch (e) {}

    if (committeeMembers.length === 0 && isSupabaseConfigured) {
      try {
        const { data: dbMems } = await supabase
          .from("members_by_case")
          .select("full_name")
          .ilike("ref_number", caseNo);
        if (dbMems) {
          committeeMembers = dbMems.map((m: any) => m.full_name).filter(Boolean);
        }
      } catch (e) {}
    }
  }

  // 4. Fetch Extension & Date details if missing
  if (caseNo && (!appointmentDate || !reportDueDate)) {
    try {
      const apptRes = await getCaseByAppointmentAndReportDueDateServer(caseNo);
      if (apptRes && apptRes.success && apptRes.data) {
        if (!appointmentDate) appointmentDate = apptRes.data.appointment_letter_date || "";
        if (!reportDueDate) reportDueDate = apptRes.data.report_due_date || "";
      }
    } catch (e) {}
  }

  if (caseNo && extensionTerm === "None") {
    try {
      const extRes = await getCaseByDateExtensionServer(caseNo);
      if (extRes && extRes.success && extRes.data) {
        extensionTerm = extRes.data.extention_term || "None";
        extensionStartDate = extRes.data.start_date || "";
        extensionEndDate = extRes.data.end_date || "";
        extensionApprovalStatus = extRes.data.approval_status || "Pending";
      }
    } catch (e) {}
  }

  // Sanitize Date Formats
  const formatDateStr = (d?: string) => {
    if (!d || typeof d !== "string") return "";
    if (d.includes("T")) return d.split("T")[0];
    return d;
  };

  return {
    caseNo: caseNo || "N/A",
    subject: rawCase.subject || "Formal Investigation",
    status: rawCase.status || "In Progress",
    assignedDate: formatDateStr(rawCase.targetDate || rawCase.target_date || rawCase.createdAt || rawCase.created_at),
    accusedOfficerName: accusedOfficerName || "Not Recorded",
    accusedOfficerDesignation: accusedOfficerDesignation || "N/A",
    accusedOfficerInstitute: accusedOfficerInstitute || "N/A",
    accusedOfficerNic: accusedOfficerNic || "N/A",
    chairmanName: chairmanName || "Unassigned",
    chairmanPosition: chairmanPosition || "Chairman",
    chairmanEmail: chairmanEmail || "N/A",
    committeeMembers: committeeMembers.length > 0 ? committeeMembers.join("; ") : "None",
    subjectOfficerName: subjectOfficerName || "Assigned Subject Officer",
    appointmentDate: formatDateStr(appointmentDate),
    reportDueDate: formatDateStr(reportDueDate),
    extensionTerm: extensionTerm || "None",
    extensionStartDate: formatDateStr(extensionStartDate),
    extensionEndDate: formatDateStr(extensionEndDate),
    extensionApprovalStatus: extensionApprovalStatus || "None",
    reportSubmitDate: formatDateStr(reportSubmitDate),
    notes: notes ? notes.replace(/[\r\n]+/g, " ") : "N/A",
  };
}

/**
 * Generates and downloads an Excel CSV file (with UTF-8 BOM for full MS Excel compatibility)
 */
export function exportToExcelFile(dataRows: InvestigationExportRow[], filenamePrefix: string = "Investigation_Details_By_Case") {
  const headers = [
    "Case Reference No",
    "Subject / Inquiry Title",
    "Investigation Status",
    "Assigned Date",
    "Accused Officer Name",
    "Accused Officer Designation",
    "School / Institute",
    "Accused Officer NIC",
    "Committee Chairman",
    "Chairman Designation",
    "Chairman Email",
    "Committee Members",
    "Subject Officer Name",
    "Appointment Letter Date",
    "Report Due Date",
    "Date Extension Term",
    "Extension Start Date",
    "Extension End Date",
    "Extension Approval Status",
    "Report Submit Date",
    "Investigation Notes & Remarks"
  ];

  const csvRows: string[] = [];
  csvRows.push(headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","));

  dataRows.forEach((row) => {
    const values = [
      row.caseNo,
      row.subject,
      row.status,
      row.assignedDate,
      row.accusedOfficerName,
      row.accusedOfficerDesignation,
      row.accusedOfficerInstitute,
      row.accusedOfficerNic,
      row.chairmanName,
      row.chairmanPosition,
      row.chairmanEmail,
      row.committeeMembers,
      row.subjectOfficerName,
      row.appointmentDate,
      row.reportDueDate,
      row.extensionTerm,
      row.extensionStartDate,
      row.extensionEndDate,
      row.extensionApprovalStatus,
      row.reportSubmitDate,
      row.notes
    ];
    csvRows.push(values.map((v) => `"${(v || "").toString().replace(/"/g, '""')}"`).join(","));
  });

  // Include UTF-8 Byte Order Mark (BOM) for Excel
  const bom = "\uFEFF";
  const csvContent = bom + csvRows.join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const todayStr = new Date().toISOString().split("T")[0];
  link.setAttribute("href", url);
  link.setAttribute("download", `${filenamePrefix}_${todayStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
