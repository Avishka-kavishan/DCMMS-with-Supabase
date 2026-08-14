"use server";

import { prisma } from "@/lib/prisma";

function serializeForServerAction<T>(obj: T): any {
  if (obj === null || obj === undefined) return obj;
  try {
    return JSON.parse(
      JSON.stringify(obj, (key, value) => {
        if (typeof value === "bigint") return value.toString();
        if (value instanceof Error) return value.message;
        return value;
      })
    );
  } catch (err) {
    console.error("Serialization error in server action:", err);
    return obj;
  }
}

export async function checkDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return serializeForServerAction({ connected: true });
  } catch (error: any) {
    return serializeForServerAction({ connected: false, error: error?.message || "Database connection failed" });
  }
}

// -------------------------------------------------------------
// 1. Daily Mail & Letters Operations
// -------------------------------------------------------------
export async function getDailyMailRecordsServer() {
  try {
    let combinedData: any[] = [];
    const idsSeen = new Set<string>();

    // 1. Fetch from daily_mail_letter_table (User's PostgreSQL table)
    try {
      const rawLetterTable: any[] = await prisma.$queryRaw`
        SELECT 
          id::text as id,
          letter_number as letter_no,
          ref_number as serial_no,
          mode_of_receipt as method,
          senders_party as sender,
          nature_of_letter as type,
          subject_category as classification,
          subject_of_letter as subject,
          date_received_by_add_secretary as received_date,
          date_letter_handover_discipline as submitted_date,
          created_at,
          updated_at
        FROM public.daily_mail_letter_table
        ORDER BY created_at DESC;
      `;
      if (rawLetterTable && rawLetterTable.length > 0) {
        rawLetterTable.forEach((row) => {
          const key = row.serial_no || row.letter_no || row.id;
          combinedData.push({
            id: row.id,
            serial_no: row.serial_no || row.letter_no,
            letter_no: row.letter_no,
            received_date: row.received_date ? new Date(row.received_date).toISOString().split("T")[0] : "",
            submitted_date: row.submitted_date ? new Date(row.submitted_date).toISOString().split("T")[0] : "",
            subject: row.subject,
            sender: row.sender || "N/A",
            method: row.method || "Post",
            type: row.type || "Complaint",
            classification: row.classification || "",
            action_officer: "",
            priority: "normal",
            status: "registered",
            created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
            updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
          });
          if (row.serial_no) idsSeen.add(row.serial_no);
          if (row.letter_no) idsSeen.add(row.letter_no);
        });
      }
    } catch (e) {
      console.warn("Could not query daily_mail_letter_table:", e);
    }

    // 2. Fetch from daily_mail table
    try {
      const rawDailyMail: any[] = await prisma.$queryRaw`
        SELECT 
          daily_mail_id::text as id,
          letter_number as letter_no,
          received_letter_number as serial_no,
          mode_of_receipt as method,
          sender_party as sender,
          nature_of_letter as type,
          subject_category as classification,
          subject_of_letter as subject,
          date_received_by_additional_secretary as received_date,
          date_letter_handed_over_to_dicipline_branch as submitted_date,
          priority,
          created_at,
          updated_at
        FROM daily_mail
        ORDER BY created_at DESC;
      `;
      if (rawDailyMail && rawDailyMail.length > 0) {
        rawDailyMail.forEach((row) => {
          const key = row.serial_no || row.letter_no || row.id;
          if (!idsSeen.has(key)) {
            combinedData.push({
              id: row.id,
              serial_no: row.serial_no || row.letter_no,
              letter_no: row.letter_no,
              received_date: row.received_date ? new Date(row.received_date).toISOString().split("T")[0] : "",
              submitted_date: row.submitted_date ? new Date(row.submitted_date).toISOString().split("T")[0] : "",
              subject: row.subject,
              sender: row.sender || "N/A",
              method: row.method || "Post",
              type: row.type || "Complaint",
              classification: row.classification || "",
              action_officer: "",
              priority: row.priority ? row.priority.toLowerCase() : "normal",
              status: "registered",
              created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
              updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
            });
            if (row.serial_no) idsSeen.add(row.serial_no);
            if (row.letter_no) idsSeen.add(row.letter_no);
          }
        });
      }
    } catch (e) {
      console.warn("Could not query daily_mail table:", e);
    }

    // 3. Fetch from dcmms_daily_mail as fallback/legacy merge
    try {
      const legacyRecords = await prisma.dcmmsDailyMail.findMany({
        orderBy: { created_at: "desc" },
      });
      legacyRecords.forEach((rec: any) => {
        if (!rec.serial_no?.startsWith("__SECURITY_")) {
          const key = rec.serial_no || rec.letter_no || rec.id;
          if (!idsSeen.has(key)) {
            combinedData.push(rec);
            idsSeen.add(key);
          }
        }
      });
    } catch (e) {
      console.warn("Could not query dcmms_daily_mail table:", e);
    }

    return serializeForServerAction({ success: true, data: combinedData });
  } catch (error: any) {
    console.error("Error fetching daily mail records:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to fetch daily mail records", data: [] });
  }
}

export async function saveDailyMailRecordServer(mailData: any) {
  try {
    let result;
    const actionOfficer = mailData.action_officer || mailData.officer_name || mailData.officerName || null;

    // Dual save to daily_mail & daily_mail_letter_table tables
    try {
      await saveDailyMailToNewTableServer({
        letter_number: mailData.letter_no || mailData.letterNo || mailData.serial_no || mailData.refNo || `LT-${Date.now()}`,
        received_letter_number: mailData.serial_no || mailData.refNo,
        ref_number: mailData.serial_no || mailData.refNo,
        mode_of_receipt: mailData.method || mailData.letterType || "Post",
        sender_party: mailData.sender || mailData.senderName,
        senders_party: mailData.sender || mailData.senderName,
        nature_of_letter: mailData.type || mailData.letterType || mailData.regionProvince || "Complaint",
        subject_category: mailData.classification || mailData.subjectCategory,
        subject_of_letter: mailData.subject || "N/A",
        date_received_by_additional_secretary: mailData.received_date || mailData.receivedDate,
        date_received_by_add_secretary: mailData.received_date || mailData.receivedDate,
        date_letter_handed_over_to_dicipline_branch: mailData.submitted_date || mailData.letterDate,
        date_letter_handover_discipline: mailData.submitted_date || mailData.letterDate,
        priority: mailData.priority || "Normal",
      });
    } catch (dmErr) {
      console.warn("Save to daily mail tables failed in saveDailyMailRecordServer:", dmErr);
    }

    let existingRecord = null;
    const isUuid = typeof mailData.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mailData.id);
    if (isUuid) {
      try {
        existingRecord = await prisma.dcmmsDailyMail.findUnique({
          where: { id: mailData.id },
        });
      } catch (e) {}
    }

    if (existingRecord) {
      result = await prisma.dcmmsDailyMail.update({
        where: { id: mailData.id },
        data: {
          serial_no: mailData.serial_no || mailData.refNo,
          received_date: mailData.received_date ? new Date(mailData.received_date) : mailData.receivedDate ? new Date(mailData.receivedDate) : undefined,
          letter_no: mailData.letter_no || mailData.letterNo,
          submitted_date: mailData.submitted_date ? new Date(mailData.submitted_date) : mailData.letterDate ? new Date(mailData.letterDate) : undefined,
          subject: mailData.subject,
          sender: mailData.sender || mailData.senderName,
          method: mailData.method || mailData.letterType,
          type: mailData.type || mailData.letterType,
          classification: mailData.classification || mailData.subjectCategory,
          action_officer: actionOfficer,
          status: mailData.status || "Pending",
          updated_at: new Date(),
        },
      });
    } else {
      result = await prisma.dcmmsDailyMail.create({
        data: {
          ...(isUuid ? { id: mailData.id } : {}),
          serial_no: mailData.serial_no || mailData.refNo,
          received_date: mailData.received_date ? new Date(mailData.received_date) : mailData.receivedDate ? new Date(mailData.receivedDate) : undefined,
          letter_no: mailData.letter_no || mailData.letterNo,
          submitted_date: mailData.submitted_date ? new Date(mailData.submitted_date) : mailData.letterDate ? new Date(mailData.letterDate) : undefined,
          subject: mailData.subject,
          sender: mailData.sender || mailData.senderName,
          method: mailData.method || mailData.letterType,
          type: mailData.type || mailData.letterType,
          classification: mailData.classification || mailData.subjectCategory,
          action_officer: actionOfficer,
          status: mailData.status || "Pending",
        },
      });

      // Also dual-sync to normalized Letter table
      try {
        await prisma.letter.create({
          data: {
            serial_number: mailData.serial_no || undefined,
            letter_number: mailData.letter_no || undefined,
            sender_name: mailData.sender || undefined,
            received_date: mailData.received_date ? new Date(mailData.received_date) : undefined,
            received_method: mailData.method || undefined,
            submission_date: mailData.submitted_date ? new Date(mailData.submitted_date) : undefined,
            priority: mailData.priority || "medium",
            description: mailData.subject || undefined,
          },
        });
      } catch (err) {
        console.warn("Dual-sync to Letter table skipped or failed:", err);
      }
    }
    return serializeForServerAction({ success: true, data: result });
  } catch (error: any) {
    console.error("Error saving daily mail record:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to save daily mail record" });
  }
}

export async function saveDailyMailToNewTableServer(data: {
  letter_number: string;
  received_letter_number?: string;
  ref_number?: string;
  mode_of_receipt: string;
  sender_party?: string;
  senders_party?: string;
  nature_of_letter?: string;
  subject_category?: string;
  subject_of_letter: string;
  date_received_by_additional_secretary?: string;
  date_received_by_add_secretary?: string;
  date_letter_handed_over_to_dicipline_branch?: string;
  date_letter_handover_discipline?: string;
  subject_officer_id?: number | null;
  officer_name?: string | null;
  priority?: string;
}) {
  try {
    const pInput = (data.priority || 'Normal').trim();
    let validPriority = 'Normal';
    if (pInput.toLowerCase().includes('high') || pInput.toLowerCase().includes('urgent')) validPriority = 'High';
    else if (pInput.toLowerCase().includes('low')) validPriority = 'Low';
    else if (['Low', 'Normal', 'High', 'Urgent'].includes(pInput)) validPriority = pInput;

    const letterNumber = data.letter_number?.trim() || `LT-${Date.now()}`;
    const refNumber = data.ref_number || data.received_letter_number || null;
    const modeOfReceipt = data.mode_of_receipt?.trim() || 'Post';
    const sendersParty = data.senders_party || data.sender_party || null;
    const natureOfLetter = data.nature_of_letter?.trim() || 'Complaint';
    const subjectCategory = data.subject_category?.trim() || null;
    const subjectOfLetter = data.subject_of_letter?.trim() || 'N/A';
    const rawDateReceived = data.date_received_by_add_secretary || data.date_received_by_additional_secretary || null;
    const rawDateHandover = data.date_letter_handover_discipline || data.date_letter_handed_over_to_dicipline_branch || null;

    const formatDateForSql = (val: any) => {
      if (!val || val === "" || val === "N/A") return null;
      try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return null;
        return d.toISOString().split("T")[0];
      } catch (e) {
        return null;
      }
    };

    const dateReceived = formatDateForSql(rawDateReceived);
    const dateHandover = formatDateForSql(rawDateHandover);

    // Ensure daily_mail_letter_table exists in PostgreSQL
    try {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS public.daily_mail_letter_table (
          id BIGSERIAL PRIMARY KEY,
          letter_number VARCHAR(100),
          ref_number VARCHAR(100),
          mode_of_receipt VARCHAR(100),
          senders_party VARCHAR(255),
          nature_of_letter VARCHAR(1000),
          subject_category VARCHAR(500),
          subject_of_letter TEXT,
          date_received_by_add_secretary DATE,
          date_letter_handover_discipline DATE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );`
      );
    } catch (tblErr) {
      console.warn("daily_mail_letter_table creation warning:", tblErr);
    }

    // 1. Insert/Update daily_mail_letter_table (PostgreSQL table requested by user)
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO public.daily_mail_letter_table (
          letter_number,
          ref_number,
          mode_of_receipt,
          senders_party,
          nature_of_letter,
          subject_category,
          subject_of_letter,
          date_received_by_add_secretary,
          date_letter_handover_discipline,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8::date, $9::date,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )`,
        letterNumber,
        refNumber,
        modeOfReceipt,
        sendersParty,
        natureOfLetter,
        subjectCategory,
        subjectOfLetter,
        dateReceived,
        dateHandover
      );
    } catch (lTableErr) {
      console.warn("Insert into daily_mail_letter_table warning:", lTableErr);
    }

    // 2. Insert/Update daily_mail table
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO daily_mail (
          letter_number,
          received_letter_number,
          mode_of_receipt,
          sender_party,
          nature_of_letter,
          subject_category,
          subject_of_letter,
          date_received_by_additional_secretary,
          date_letter_handed_over_to_dicipline_branch,
          subject_officer_id,
          priority
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8::date, $9::date,
          $10, $11
        )
        ON CONFLICT (letter_number) DO UPDATE SET
          received_letter_number = EXCLUDED.received_letter_number,
          mode_of_receipt = EXCLUDED.mode_of_receipt,
          sender_party = EXCLUDED.sender_party,
          nature_of_letter = EXCLUDED.nature_of_letter,
          subject_category = EXCLUDED.subject_category,
          subject_of_letter = EXCLUDED.subject_of_letter,
          date_received_by_additional_secretary = EXCLUDED.date_received_by_additional_secretary,
          date_letter_handed_over_to_dicipline_branch = EXCLUDED.date_letter_handed_over_to_dicipline_branch,
          subject_officer_id = EXCLUDED.subject_officer_id,
          priority = EXCLUDED.priority,
          updated_at = CURRENT_TIMESTAMP`,
        letterNumber,
        refNumber,
        modeOfReceipt,
        sendersParty,
        natureOfLetter,
        subjectCategory,
        subjectOfLetter,
        dateReceived,
        dateHandover,
        data.subject_officer_id ? Number(data.subject_officer_id) : null,
        validPriority
      );
    } catch (err1) {
      console.warn("Insert into daily_mail warning:", err1);
    }

    return serializeForServerAction({ success: true });
  } catch (error: any) {
    console.error("Error inserting into daily mail tables:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to insert into daily mail tables" });
  }
}


// -------------------------------------------------------------
// 2. Cases & Persons Operations
// -------------------------------------------------------------
export async function getCasesServer() {
  try {
    const cases = await prisma.case.findMany({
      orderBy: { created_date: "desc" },
      include: {
        person: true,
        school: true,
        currentStatus: true,
        caseLetters: {
          include: { letter: true },
        },
      },
    });
    return serializeForServerAction({ success: true, data: cases });
  } catch (error: any) {
    console.error("Error fetching cases:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to fetch cases", data: [] });
  }
}

export async function createCaseServer(caseData: any) {
  try {
    const newCase = await prisma.case.create({
      data: {
        case_number: caseData.case_number,
        subject_officer_id: caseData.subject_officer_id || undefined,
        school_id: caseData.school_id || undefined,
        person_id: caseData.person_id || undefined,
        current_status_id: caseData.current_status_id || 1,
        secretary_approval: caseData.secretary_approval ?? false,
        approval_date: caseData.approval_date ? new Date(caseData.approval_date) : undefined,
        complaint_summary: caseData.complaint_summary || caseData.complaint_description || undefined,
      },
    });
    return serializeForServerAction({ success: true, data: newCase });
  } catch (error: any) {
    console.error("Error creating case:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to create case" });
  }
}

export async function upsertPersonServer(personData: any) {
  try {
    let person;
    if (personData.person_id) {
      person = await prisma.person.update({
        where: { person_id: personData.person_id },
        data: {
          nic: personData.nic,
          full_name: personData.full_name,
          address: personData.address,
          designation: personData.designation,
          appointment_date: personData.appointment_date ? new Date(personData.appointment_date) : undefined,
        },
      });
    } else {
      person = await prisma.person.create({
        data: {
          nic: personData.nic,
          full_name: personData.full_name,
          address: personData.address,
          designation: personData.designation,
          appointment_date: personData.appointment_date ? new Date(personData.appointment_date) : undefined,
        },
      });
    }
    return serializeForServerAction({ success: true, data: person });
  } catch (error: any) {
    console.error("Error upserting person:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to upsert person" });
  }
}

// -------------------------------------------------------------
// 3. Investigation & Officer Operations
// -------------------------------------------------------------
export async function getSubjectOfficersServer() {
  try {
    const namesSet = new Set<string>();

    // 1. From register_officer_table in PostgreSQL (ONLY subject officer role)
    try {
      const regOfficers: any[] = await prisma.$queryRaw`
        SELECT full_name FROM register_officer_table 
        WHERE role ILIKE '%subject%' AND (is_active IS NULL OR is_active = true)
        ORDER BY full_name ASC;
      `;
      regOfficers.forEach((o: any) => {
        if (o.full_name && o.full_name.trim()) namesSet.add(o.full_name.trim());
      });
    } catch (e) {
      console.error("Error fetching subject officers from register_officer_table:", e);
    }

    // 2. From dcmms_profiles table (fallback for profiles with role containing subject)
    try {
      const profiles = await prisma.dcmmsProfile.findMany({
        where: {
          role: { contains: "subject", mode: "insensitive" },
        },
        select: { full_name: true },
      });
      profiles.forEach((p: any) => {
        if (p.full_name && p.full_name.trim()) namesSet.add(p.full_name.trim());
      });
    } catch (e) {}

    return serializeForServerAction({ success: true, data: Array.from(namesSet) });
  } catch (error: any) {
    console.error("Error fetching subject officers from database:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to fetch subject officers", data: [] });
  }
}

export async function getInvestigationOfficersServer() {
  try {
    const officers = await prisma.investigationOfficer.findMany({
      where: { is_active: true },
    });
    return serializeForServerAction({ success: true, data: officers });
  } catch (error: any) {
    return serializeForServerAction({ success: false, error: error?.message || "Failed to fetch investigation officers", data: [] });
  }
}

export async function upsertInvestigationOfficerServer(officerData: any) {
  try {
    const officer = await prisma.investigationOfficer.upsert({
      where: { officer_id: officerData.officer_id || "" },
      update: {
        officer_name: officerData.officer_name,
        nic: officerData.nic,
        designation: officerData.designation,
        school_attended: officerData.school_attended,
        children_school: officerData.children_school,
        appointment_date: officerData.appointment_date ? new Date(officerData.appointment_date) : undefined,
      },
      create: {
        officer_name: officerData.officer_name,
        nic: officerData.nic,
        designation: officerData.designation,
        school_attended: officerData.school_attended,
        children_school: officerData.children_school,
        appointment_date: officerData.appointment_date ? new Date(officerData.appointment_date) : undefined,
      },
    });

    // Sync to legacy table
    try {
      await prisma.dcmmsInvestigationOfficer.create({
        data: {
          officer_name: officerData.officer_name,
          nic: officerData.nic,
          designation: officerData.designation,
          school_attended: officerData.school_attended,
          children_school: officerData.children_school,
          appointment_date: officerData.appointment_date ? new Date(officerData.appointment_date) : undefined,
        },
      });
    } catch (e) {
      // Ignore legacy duplicate err
    }

    return serializeForServerAction({ success: true, data: officer });
  } catch (error: any) {
    console.error("Error upserting officer:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to upsert officer" });
  }
}

export async function getInvestigationsServer() {
  try {
    const list = await prisma.investigation.findMany({
      include: {
        case: true,
        assignments: {
          include: { officer: true },
        },
        provincialInvestigations: true,
        formalDisciplinaryInvestigations: true,
      },
    });
    return serializeForServerAction({ success: true, data: list });
  } catch (error: any) {
    return serializeForServerAction({ success: false, error: error?.message || "Failed to fetch investigations", data: [] });
  }
}

export async function saveProvincialInvestigationServer(invData: any) {
  try {
    let invRecord = invData.investigation_id
      ? await prisma.investigation.findUnique({ where: { investigation_id: invData.investigation_id } })
      : null;

    if (!invRecord) {
      invRecord = await prisma.investigation.create({
        data: {
          case_id: invData.case_id,
          investigation_type: invData.investigation_type || "Preliminary",
          investigation_no: invData.investigation_no,
          assigned_date: invData.assigned_date ? new Date(invData.assigned_date) : undefined,
          due_date: invData.due_date ? new Date(invData.due_date) : undefined,
          report_received_date: invData.report_received_date ? new Date(invData.report_received_date) : undefined,
          recommendation: invData.recommendation,
          next_action: invData.next_action,
          status: invData.status || "Ongoing",
        },
      });
    }

    const provInv = await prisma.provincialInvestigation.create({
      data: {
        investigation_id: invRecord.investigation_id,
        recommendation: invData.recommendation,
        appointment_date: invData.appointment_date ? new Date(invData.appointment_date) : undefined,
        due_date: invData.due_date ? new Date(invData.due_date) : undefined,
        report_received_date: invData.report_received_date ? new Date(invData.report_received_date) : undefined,
        approved_date: invData.approved_date ? new Date(invData.approved_date) : undefined,
        next_action: invData.next_action,
      },
    });

    return serializeForServerAction({ success: true, data: { invRecord, provInv } });
  } catch (error: any) {
    console.error("Error saving provincial investigation:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to save provincial investigation" });
  }
}

export async function assignOfficerToInvestigationServer(investigationId: string, officerId: string, assignedBy?: string) {
  try {
    const assignment = await prisma.investigationAssignment.create({
      data: {
        investigation_id: investigationId,
        officer_id: officerId,
        assigned_by: assignedBy || undefined,
      },
    });
    return serializeForServerAction({ success: true, data: assignment });
  } catch (error: any) {
    console.error("Error assigning officer:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to assign officer" });
  }
}

// -------------------------------------------------------------
// 4. Audit Logging & Session Recording
// -------------------------------------------------------------
export async function logAuditEventServer(
  action: string,
  entityType?: string,
  entityId?: string,
  details?: Record<string, any>,
  performedBy?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        user_id: performedBy || undefined,
        action,
        table_name: entityType || null,
        record_id: entityId || null,
      },
    });

    try {
      await prisma.dcmmsAuditLog.create({
        data: {
          user_id: performedBy || "system_user",
          action,
          entity_type: entityType || null,
          entity_id: entityId || null,
          details: details ? JSON.stringify(details) : null,
        },
      });
    } catch (e) {
      // Legacy table failure non-blocking
    }

    return serializeForServerAction({ success: true });
  } catch (error: any) {
    console.error("Failed to log audit event to PostgreSQL:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to log audit event" });
  }
}

export async function recordSessionServer(userId: string, role?: string) {
  try {
    const session = await prisma.dcmmsSession.create({
      data: {
        user_id: userId,
        role: role || "User",
        login_time: new Date(),
        is_active: true,
      },
    });
    return serializeForServerAction({ success: true, data: session });
  } catch (error: any) {
    console.error("Failed to record session in PostgreSQL:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to record session" });
  }
}

// -------------------------------------------------------------
// 5. Register Officer Operations (register_officer_table)
// -------------------------------------------------------------
export async function getRegisterOfficersServer(roleFilter?: string) {
  try {
    let query = `SELECT id, employee_no, full_name, email, role, is_active, created_at, updated_at FROM register_officer_table`;
    let params: any[] = [];
    if (roleFilter) {
      query += ` WHERE role ILIKE $1`;
      params.push(`%${roleFilter}%`);
    }
    query += ` ORDER BY created_at DESC`;
    
    const records: any[] = await prisma.$queryRawUnsafe(query, ...params);
    return serializeForServerAction({ success: true, data: records });
  } catch (error: any) {
    console.error("Error fetching register officer records:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to fetch register officers", data: [] });
  }
}

export async function saveRegisterOfficerServer(officerData: {
  id?: string;
  employee_no?: string;
  full_name: string;
  email: string;
  role: string;
  is_active?: boolean;
  password?: string;
}) {
  try {
    const isActive = officerData.is_active !== undefined ? officerData.is_active : true;
    const password = officerData.password || "123456";
    let employeeNo = officerData.employee_no?.trim();
    const email = officerData.email.trim().toLowerCase();
    const fullName = officerData.full_name.trim();

    if (!employeeNo) {
      employeeNo = `EMP-${Date.now().toString().slice(-6)}`;
    }

    // 1. Update existing record by ID if valid UUID provided
    if (officerData.id && !officerData.id.startsWith("temp-") && !officerData.id.startsWith("sub-") && !officerData.id.startsWith("dm-") && !officerData.id.startsWith("inv-")) {
      const updated: any[] = await prisma.$queryRaw`
        UPDATE register_officer_table
        SET employee_no = ${employeeNo},
            full_name = ${fullName},
            email = ${email},
            role = ${officerData.role},
            is_active = ${isActive},
            updated_at = NOW()
        WHERE id = ${officerData.id}::uuid
        RETURNING *;
      `;
      if (updated && updated.length > 0) {
        return serializeForServerAction({ success: true, data: updated[0] });
      }
    }

    // 2. Check if an officer with email or employee_no already exists
    const existing: any[] = await prisma.$queryRaw`
      SELECT id FROM register_officer_table 
      WHERE email = ${email} OR employee_no = ${employeeNo}
      LIMIT 1;
    `;

    let resultRecord: any = null;

    if (existing && existing.length > 0) {
      const existingId = existing[0].id;
      const updated: any[] = await prisma.$queryRaw`
        UPDATE register_officer_table
        SET employee_no = ${employeeNo},
            full_name = ${fullName},
            email = ${email},
            role = ${officerData.role},
            is_active = ${isActive},
            updated_at = NOW()
        WHERE id = ${existingId}::uuid
        RETURNING *;
      `;
      resultRecord = updated[0];
    } else {
      // 3. Insert new record into register_officer_table
      const inserted: any[] = await prisma.$queryRaw`
        INSERT INTO register_officer_table (employee_no, full_name, email, password, role, is_active)
        VALUES (${employeeNo}, ${fullName}, ${email}, ${password}, ${officerData.role}, ${isActive})
        RETURNING *;
      `;
      resultRecord = inserted[0];
    }

    return serializeForServerAction({ success: true, data: resultRecord });
  } catch (error: any) {
    console.error("Error saving register officer:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to save officer to database" });
  }
}

export async function deleteRegisterOfficerServer(id: string) {
  try {
    await prisma.$queryRaw`DELETE FROM register_officer_table WHERE id = ${id}::uuid`;
    return serializeForServerAction({ success: true });
  } catch (error: any) {
    console.error("Error deleting register officer:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to delete register officer" });
  }
}

export async function toggleRegisterOfficerStatusServer(id: string, is_active: boolean) {
  try {
    const updated: any[] = await prisma.$queryRaw`
      UPDATE register_officer_table
      SET is_active = ${is_active}, updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING *;
    `;
    return serializeForServerAction({ success: true, data: updated[0] });
  } catch (error: any) {
    console.error("Error toggling officer status:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to toggle officer status" });
  }
}

export async function loginOfficerServer(emailOrEmpNo: string, passwordInput: string) {
  try {
    const input = (emailOrEmpNo || "").trim();
    const inputLower = input.toLowerCase();

    // Query register_officer_table in PostgreSQL
    const records: any[] = await prisma.$queryRaw`
      SELECT id, employee_no, full_name, email, password, role, is_active 
      FROM register_officer_table 
      WHERE LOWER(email) = ${inputLower} OR employee_no = ${input}
      LIMIT 1;
    `;

    if (!records || records.length === 0) {
      return serializeForServerAction({ success: false, error: "Invalid email/employee number or password." });
    }

    const officer = records[0];

    if (officer.is_active === false) {
      return serializeForServerAction({ success: false, error: "Your account is deactivated. Please contact an administrator." });
    }

    if (officer.password && officer.password !== passwordInput) {
      return serializeForServerAction({ success: false, error: "Invalid email/employee number or password." });
    }

    return serializeForServerAction({
      success: true,
      data: {
        id: officer.id,
        employee_no: officer.employee_no,
        full_name: officer.full_name,
        email: officer.email,
        role: officer.role,
      },
    });
  } catch (error: any) {
    console.error("Login officer server error:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Authentication failed" });
  }
}

function parseSafeDate(val: any): Date | null {
  if (!val) return null;
  const str = String(val).trim();
  if (!str || str.toLowerCase() === "n/a" || str === "—" || str === "-") return null;

  const parts = str.split(/[\/\.-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const d = new Date(`${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`);
      if (!isNaN(d.getTime())) return d;
    }
    if (parts[2].length === 4) {
      const d1 = new Date(str);
      if (!isNaN(d1.getTime())) return d1;

      const d2 = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
      if (!isNaN(d2.getTime())) return d2;
    }
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export async function saveAccusedOfficerServer(officerData: any) {
  try {
    const {
      ref_number,
      accused_officers,
      accused_officer_name,
      address,
      position,
      date_of_birth,
      nic_no,
      appointment_date,
      accused_school_name,
      school_address,
      province,
      district,
      zone,
      classification_of_complaint_letter,
      name_of_the_presenting_the_complain,
      address_of_the_person_presenting_the_complaint,
      subject_file_no,
      future_action,
      date_prepared_and_submitted_for_signature,
    } = officerData;

    // 0. Ensure tables exist
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS accused_school_table (
        id BIGSERIAL PRIMARY KEY,
        accused_school_name VARCHAR(255) NOT NULL,
        address TEXT,
        province VARCHAR(100),
        district VARCHAR(100),
        zone VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS accused_officer_table (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        accused_officer_name VARCHAR(255) NOT NULL,
        address TEXT,
        position VARCHAR(150),
        date_of_birth DATE,
        nic_no VARCHAR(12),
        appointment_date DATE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        accused_school_id BIGINT REFERENCES accused_school_table(id) ON DELETE SET NULL
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS subject_officer_form_table (
        id BIGSERIAL PRIMARY KEY,
        daily_mail_letter_id BIGINT REFERENCES daily_mail_letter_table(id) ON DELETE SET NULL,
        accused_officer_id UUID REFERENCES accused_officer_table(id) ON DELETE SET NULL,
        ref_number VARCHAR(100) NOT NULL UNIQUE,
        subject_file_no VARCHAR(100),
        future_action TEXT,
        date_prepared_and_submitted_for_signature DATE,
        classification_of_complaint_letter VARCHAR(255),
        name_of_the_presenting_the_complain VARCHAR(255),
        address_of_the_person_presenting_the_complaint TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS accused_officer_subject_officer_form_table (
        accused_officer_id UUID NOT NULL REFERENCES accused_officer_table(id) ON DELETE CASCADE,
        subject_officer_form_id BIGINT NOT NULL REFERENCES subject_officer_form_table(id) ON DELETE CASCADE,
        PRIMARY KEY (accused_officer_id, subject_officer_form_id)
      );
    `);

    // Ensure auto-fill database trigger exists on accused_school_table
    try {
      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION auto_fill_accused_school_details()
        RETURNS TRIGGER AS $$
        DECLARE
          inst_rec RECORD;
        BEGIN
          IF NEW.province IS NULL OR NEW.province = '' OR
             NEW.district IS NULL OR NEW.district = '' OR
             NEW.zone IS NULL OR NEW.zone = '' THEN
             
            SELECT province, district, zone, address
            INTO inst_rec
            FROM institute_table
            WHERE LOWER(TRIM(institute_name)) = LOWER(TRIM(NEW.accused_school_name))
              AND province IS NOT NULL AND province != ''
            ORDER BY id ASC
            LIMIT 1;

            IF FOUND THEN
              IF NEW.province IS NULL OR NEW.province = '' THEN
                NEW.province := inst_rec.province;
              END IF;
              IF NEW.district IS NULL OR NEW.district = '' THEN
                NEW.district := inst_rec.district;
              END IF;
              IF NEW.zone IS NULL OR NEW.zone = '' THEN
                NEW.zone := inst_rec.zone;
              END IF;
              IF (NEW.address IS NULL OR NEW.address = '') AND inst_rec.address IS NOT NULL THEN
                NEW.address := inst_rec.address;
              END IF;
            END IF;
          END IF;
          
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);
      await prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS trg_auto_fill_accused_school ON accused_school_table;
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER trg_auto_fill_accused_school
        BEFORE INSERT OR UPDATE ON accused_school_table
        FOR EACH ROW
        EXECUTE FUNCTION auto_fill_accused_school_details();
      `);
    } catch (trgErr) {
      console.warn("Could not set up trg_auto_fill_accused_school trigger:", trgErr);
    }

    // 1. Create or update accused_school_table if school name is provided
    let schoolId: any = null;
    if (accused_school_name && String(accused_school_name).trim()) {
      const schoolNameTrimmed = String(accused_school_name).trim();

      // Resolve missing province/district/zone/address from institute_table
      let fillProvince = province && String(province).trim() ? String(province).trim() : null;
      let fillDistrict = district && String(district).trim() ? String(district).trim() : null;
      let fillZone = zone && String(zone).trim() ? String(zone).trim() : null;
      let fillAddress = school_address && String(school_address).trim() ? String(school_address).trim() : null;

      if (!fillProvince || !fillDistrict || !fillZone || !fillAddress) {
        try {
          const instMatches: any[] = await prisma.$queryRaw`
            SELECT province, district, zone, address 
            FROM institute_table 
            WHERE LOWER(TRIM(institute_name)) = ${schoolNameTrimmed.toLowerCase()} 
              AND (province IS NOT NULL AND province != '')
            LIMIT 1;
          `;
          if (instMatches && instMatches.length > 0) {
            const match = instMatches[0];
            if (!fillProvince) fillProvince = match.province || null;
            if (!fillDistrict) fillDistrict = match.district || null;
            if (!fillZone) fillZone = match.zone || null;
            if (!fillAddress) fillAddress = match.address || null;
          }
        } catch (e) {
          console.warn("Lookup in institute_table failed:", e);
        }
      }

      const existingSchools: any[] = await prisma.$queryRaw`
        SELECT id FROM accused_school_table WHERE LOWER(accused_school_name) = ${schoolNameTrimmed.toLowerCase()} LIMIT 1;
      `;

      if (existingSchools && existingSchools.length > 0) {
        schoolId = existingSchools[0].id;
        await prisma.$queryRaw`
          UPDATE accused_school_table
          SET address = COALESCE(${fillAddress}, address),
              province = COALESCE(${fillProvince}, province),
              district = COALESCE(${fillDistrict}, district),
              zone = COALESCE(${fillZone}, zone),
              updated_at = NOW()
          WHERE id = ${schoolId}::bigint;
        `;
      } else {
        const insertedSchool: any[] = await prisma.$queryRaw`
          INSERT INTO accused_school_table (accused_school_name, address, province, district, zone)
          VALUES (${schoolNameTrimmed}, ${fillAddress}, ${fillProvince}, ${fillDistrict}, ${fillZone})
          RETURNING id;
        `;
        if (insertedSchool && insertedSchool.length > 0) {
          schoolId = insertedSchool[0].id;
        }
      }
    }

    // 2. Prepare array of officer details to save
    let officersToSave: any[] = [];
    if (Array.isArray(accused_officers) && accused_officers.length > 0) {
      officersToSave = accused_officers.filter((o: any) => o && (o.accused_officer_name || o.name || o.nic_no || o.nic));
    } else if (accused_officer_name && String(accused_officer_name).trim()) {
      officersToSave = [{
        accused_officer_name,
        address,
        position,
        date_of_birth,
        nic_no,
        appointment_date,
      }];
    }

    // 3. Process and upsert each accused officer into accused_officer_table
    const savedOfficerIds: string[] = [];
    for (const off of officersToSave) {
      const nameTrimmed = (off.accused_officer_name || off.name || "").trim();
      const nicTrimmed = (off.nic_no || off.nic || "").trim();
      const offAddress = off.address || null;
      const offPos = off.position || null;
      const dobVal = parseSafeDate(off.date_of_birth || off.dob);
      const apptVal = parseSafeDate(off.appointment_date || off.appointmentDate);

      let officerId: string | null = null;
      let existingOfficer: any[] = [];
      if (nicTrimmed) {
        existingOfficer = await prisma.$queryRaw`
          SELECT id FROM accused_officer_table WHERE nic_no = ${nicTrimmed} LIMIT 1;
        `;
      }
      if ((!existingOfficer || existingOfficer.length === 0) && nameTrimmed) {
        existingOfficer = await prisma.$queryRaw`
          SELECT id FROM accused_officer_table WHERE LOWER(accused_officer_name) = ${nameTrimmed.toLowerCase()} LIMIT 1;
        `;
      }

      if (existingOfficer && existingOfficer.length > 0) {
        officerId = existingOfficer[0].id;
        await prisma.$queryRaw`
          UPDATE accused_officer_table
          SET accused_officer_name = ${nameTrimmed || "Accused Officer"},
              address = ${offAddress},
              position = ${offPos},
              date_of_birth = ${dobVal},
              nic_no = ${nicTrimmed || null},
              appointment_date = ${apptVal},
              accused_school_id = ${schoolId ? Number(schoolId) : null},
              updated_at = NOW()
          WHERE id = ${officerId}::uuid;
        `;
      } else {
        const insertedOfficer: any[] = await prisma.$queryRaw`
          INSERT INTO accused_officer_table (
            accused_officer_name, address, position, date_of_birth, nic_no, appointment_date, accused_school_id
          )
          VALUES (
            ${nameTrimmed || "Accused Officer"}, ${offAddress}, ${offPos}, ${dobVal}, ${nicTrimmed || null}, ${apptVal}, ${schoolId ? Number(schoolId) : null}
          )
          RETURNING id;
        `;
        if (insertedOfficer && insertedOfficer.length > 0) {
          officerId = insertedOfficer[0].id;
        }
      }

      if (officerId) {
        savedOfficerIds.push(String(officerId));
      }
    }

    const primaryOfficerId = savedOfficerIds.length > 0 ? savedOfficerIds[0] : null;

    // 4. Connect with subject_officer_form_table if ref_number is provided
    let formId: any = null;
    if (ref_number && String(ref_number).trim()) {
      const refTrimmed = String(ref_number).trim();

      // Find daily_mail_letter_id if exists
      let dailyMailId: any = null;
      try {
        const dailyMails: any[] = await prisma.$queryRaw`
          SELECT id FROM daily_mail_letter_table WHERE ref_number = ${refTrimmed} LIMIT 1;
        `;
        if (dailyMails && dailyMails.length > 0) {
          dailyMailId = dailyMails[0].id;
        }
      } catch (e) {}

      const prepDateVal = parseSafeDate(date_prepared_and_submitted_for_signature);

      const existingForms: any[] = await prisma.$queryRaw`
        SELECT id FROM subject_officer_form_table WHERE ref_number = ${refTrimmed} LIMIT 1;
      `;

      if (existingForms && existingForms.length > 0) {
        formId = existingForms[0].id;
        await prisma.$queryRaw`
          UPDATE subject_officer_form_table
          SET accused_officer_id = ${primaryOfficerId ? primaryOfficerId : null}::uuid,
              daily_mail_letter_id = ${dailyMailId ? Number(dailyMailId) : null},
              subject_file_no = ${subject_file_no || null},
              future_action = ${future_action || null},
              date_prepared_and_submitted_for_signature = ${prepDateVal},
              classification_of_complaint_letter = ${classification_of_complaint_letter || null},
              name_of_the_presenting_the_complain = ${name_of_the_presenting_the_complain || null},
              address_of_the_person_presenting_the_complaint = ${address_of_the_person_presenting_the_complaint || null},
              updated_at = NOW()
          WHERE ref_number = ${refTrimmed};
        `;
      } else {
        const insertedForm: any[] = await prisma.$queryRaw`
          INSERT INTO subject_officer_form_table (
            ref_number, daily_mail_letter_id, accused_officer_id, subject_file_no, future_action,
            date_prepared_and_submitted_for_signature, classification_of_complaint_letter,
            name_of_the_presenting_the_complain, address_of_the_person_presenting_the_complaint
          )
          VALUES (
            ${refTrimmed}, ${dailyMailId ? Number(dailyMailId) : null}, ${primaryOfficerId ? primaryOfficerId : null}::uuid,
            ${subject_file_no || null}, ${future_action || null}, ${prepDateVal},
            ${classification_of_complaint_letter || null}, ${name_of_the_presenting_the_complain || null},
            ${address_of_the_person_presenting_the_complaint || null}
          )
          RETURNING id;
        `;
        if (insertedForm && insertedForm.length > 0) {
          formId = insertedForm[0].id;
        }
      }

      // 5. Update Many-to-Many junction table accused_officer_subject_officer_form_table
      if (formId) {
        await prisma.$executeRaw`
          DELETE FROM accused_officer_subject_officer_form_table WHERE subject_officer_form_id = ${Number(formId)}::bigint;
        `;
        for (const offId of savedOfficerIds) {
          await prisma.$executeRaw`
            INSERT INTO accused_officer_subject_officer_form_table (accused_officer_id, subject_officer_form_id)
            VALUES (${offId}::uuid, ${Number(formId)}::bigint)
            ON CONFLICT DO NOTHING;
          `;
        }
      }
    }

    return serializeForServerAction({
      success: true,
      form_id: formId ? String(formId) : null,
      officer_id: primaryOfficerId ? String(primaryOfficerId) : null,
      officer_ids: savedOfficerIds,
      school_id: schoolId ? String(schoolId) : null
    });
  } catch (error: any) {
    console.error("Error in saveAccusedOfficerServer:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to save accused officer details" });
  }
}

export async function getAccusedOfficerByRefServer(refNumber: string) {
  try {
    if (!refNumber || !String(refNumber).trim()) {
      return serializeForServerAction({ success: false, error: "Ref number is required" });
    }
    const refTrimmed = String(refNumber).trim();

    // 1. Query subject_officer_form_table by ref_number or subject_file_no
    const forms: any[] = await prisma.$queryRaw`
      SELECT 
        sof.id as form_id,
        sof.ref_number,
        sof.subject_file_no,
        sof.future_action,
        sof.date_prepared_and_submitted_for_signature,
        sof.classification_of_complaint_letter,
        sof.name_of_the_presenting_the_complain,
        sof.address_of_the_person_presenting_the_complaint,
        sof.accused_officer_id
      FROM subject_officer_form_table sof
      WHERE LOWER(sof.ref_number) = LOWER(${refTrimmed})
         OR LOWER(sof.subject_file_no) = LOWER(${refTrimmed})
      LIMIT 1;
    `;

    if (!forms || forms.length === 0) {
      // Fallback: Query dcmms_concerned_officers table if present
      try {
        const concerned: any[] = await prisma.$queryRaw`
          SELECT 
            id,
            name as accused_officer_name,
            nic as nic_no,
            position,
            address,
            date_of_birth,
            date_of_appointment as appointment_date
          FROM dcmms_concerned_officers
          WHERE LOWER(subject_file_number) = LOWER(${refTrimmed});
        `;
        if (concerned && concerned.length > 0) {
          const officerList = concerned.map((c: any) => ({
            id: c.id,
            accused_officer_name: c.accused_officer_name,
            officer_name: c.accused_officer_name,
            address: c.address,
            officer_address: c.address,
            position: c.position,
            date_of_birth: c.date_of_birth,
            nic_no: c.nic_no,
            nic: c.nic_no,
            appointment_date: c.appointment_date,
            accused_school_name: null,
            institute_name: null,
            school_address: null,
          }));
          return serializeForServerAction({
            success: true,
            data: {
              form_id: null,
              ref_number: refTrimmed,
              subject_file_no: refTrimmed,
              accused_officer: officerList[0],
              accused_officers: officerList,
              accused_school: null,
            }
          });
        }
      } catch (e) {}

      return serializeForServerAction({ success: true, data: null });
    }

    const form = forms[0];
    const formId = form.form_id;

    // 2. Query all assigned accused officers via Many-to-Many junction table
    let assignedOfficers: any[] = await prisma.$queryRaw`
      SELECT 
        ao.id as accused_officer_id,
        ao.accused_officer_name,
        ao.address as officer_address,
        ao.position,
        ao.date_of_birth,
        ao.nic_no,
        ao.appointment_date,
        sch.id as school_id,
        sch.accused_school_name,
        sch.address as school_address,
        sch.province,
        sch.district,
        sch.zone
      FROM accused_officer_subject_officer_form_table j
      JOIN accused_officer_table ao ON j.accused_officer_id = ao.id
      LEFT JOIN accused_school_table sch ON ao.accused_school_id = sch.id
      WHERE j.subject_officer_form_id = ${Number(formId)}::bigint;
    `;

    // Fallback: If no junction records exist yet, try legacy foreign key on subject_officer_form_table
    if ((!assignedOfficers || assignedOfficers.length === 0) && form.accused_officer_id) {
      assignedOfficers = await prisma.$queryRaw`
        SELECT 
          ao.id as accused_officer_id,
          ao.accused_officer_name,
          ao.address as officer_address,
          ao.position,
          ao.date_of_birth,
          ao.nic_no,
          ao.appointment_date,
          sch.id as school_id,
          sch.accused_school_name,
          sch.address as school_address,
          sch.province,
          sch.district,
          sch.zone
        FROM accused_officer_table ao
        LEFT JOIN accused_school_table sch ON ao.accused_school_id = sch.id
        WHERE ao.id = ${form.accused_officer_id}::uuid;
      `;
    }

    const schoolInfo: any = assignedOfficers && assignedOfficers.length > 0 && assignedOfficers[0].school_id ? {
      id: String(assignedOfficers[0].school_id),
      accused_school_name: assignedOfficers[0].accused_school_name,
      address: assignedOfficers[0].school_address,
      province: assignedOfficers[0].province,
      district: assignedOfficers[0].district,
      zone: assignedOfficers[0].zone,
    } : null;

    if (schoolInfo && schoolInfo.accused_school_name && (!schoolInfo.province || !schoolInfo.district || !schoolInfo.zone)) {
      try {
        const instMatch: any[] = await prisma.$queryRaw`
          SELECT province, district, zone, address
          FROM institute_table
          WHERE LOWER(TRIM(institute_name)) = LOWER(TRIM(${schoolInfo.accused_school_name}))
            AND (province IS NOT NULL AND province != '')
          LIMIT 1;
        `;
        if (instMatch && instMatch.length > 0) {
          if (!schoolInfo.province) schoolInfo.province = instMatch[0].province;
          if (!schoolInfo.district) schoolInfo.district = instMatch[0].district;
          if (!schoolInfo.zone) schoolInfo.zone = instMatch[0].zone;
          if (!schoolInfo.address && instMatch[0].address) schoolInfo.address = instMatch[0].address;
        }
      } catch (e) {
        console.warn("Fallback lookup in institute_table failed:", e);
      }
    }

    const officerList = (assignedOfficers || []).map((ao: any) => ({
      id: ao.accused_officer_id,
      accused_officer_name: ao.accused_officer_name,
      officer_name: ao.accused_officer_name,
      address: ao.officer_address,
      officer_address: ao.officer_address,
      position: ao.position,
      date_of_birth: ao.date_of_birth,
      nic_no: ao.nic_no,
      nic: ao.nic_no,
      appointment_date: ao.appointment_date,
      accused_school_name: ao.accused_school_name || schoolInfo?.accused_school_name || null,
      institute_name: ao.accused_school_name || schoolInfo?.accused_school_name || null,
      school_address: ao.school_address || schoolInfo?.address || null,
      province: ao.province || schoolInfo?.province || null,
      district: ao.district || schoolInfo?.district || null,
      zone: ao.zone || schoolInfo?.zone || null,
    }));

    const primaryOfficer = officerList.length > 0 ? officerList[0] : null;

    return serializeForServerAction({
      success: true,
      data: {
        form_id: form.form_id ? String(form.form_id) : null,
        ref_number: form.ref_number,
        subject_file_no: form.subject_file_no,
        future_action: form.future_action,
        date_prepared_and_submitted_for_signature: form.date_prepared_and_submitted_for_signature,
        classification_of_complaint_letter: form.classification_of_complaint_letter,
        name_of_the_presenting_the_complain: form.name_of_the_presenting_the_complain,
        address_of_the_person_presenting_the_complaint: form.address_of_the_person_presenting_the_complaint,
        accused_officer: primaryOfficer,
        accused_officers: officerList,
        accused_school: schoolInfo,
      }
    });
  } catch (error: any) {
    console.error("Error in getAccusedOfficerByRefServer:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to fetch accused officer details" });
  }
}

// -------------------------------------------------------------
// Institute Table Operations (institute_table)
// -------------------------------------------------------------
export async function getInstitutesServer() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS institute_table (
        id BIGSERIAL PRIMARY KEY,
        institute_name VARCHAR(255) NOT NULL,
        address TEXT,
        province VARCHAR(100),
        district VARCHAR(100),
        zone VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const records: any[] = await prisma.$queryRaw`
      SELECT 
        id::text as id,
        institute_name as name,
        address,
        province,
        district,
        zone,
        created_at,
        updated_at
      FROM institute_table
      ORDER BY id DESC;
    `;

    return serializeForServerAction({ success: true, data: records });
  } catch (error: any) {
    console.error("Error fetching institute records:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to fetch institute records", data: [] });
  }
}

export async function saveInstituteServer(instData: any) {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS institute_table (
        id BIGSERIAL PRIMARY KEY,
        institute_name VARCHAR(255) NOT NULL,
        address TEXT,
        province VARCHAR(100),
        district VARCHAR(100),
        zone VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const name = (instData.name || instData.institute_name || "").trim();
    const address = (instData.address || "").trim();
    const province = (instData.province || "").trim();
    const district = (instData.district || "").trim();
    const zone = (instData.zone || "").trim();

    if (!name) {
      return serializeForServerAction({ success: false, error: "Institute Name is required" });
    }

    let savedRecord: any = null;
    const instId = instData.id;

    if (instId && !isNaN(Number(instId)) && !String(instId).startsWith("inst-") && !String(instId).startsWith("default-")) {
      const numId = BigInt(instId);
      const updated: any[] = await prisma.$queryRaw`
        UPDATE institute_table
        SET institute_name = ${name},
            address = ${address},
            province = ${province},
            district = ${district},
            zone = ${zone},
            updated_at = NOW()
        WHERE id = ${numId}
        RETURNING id::text as id, institute_name as name, address, province, district, zone, created_at, updated_at;
      `;
      if (updated && updated.length > 0) {
        savedRecord = updated[0];
      }
    }

    if (!savedRecord) {
      const inserted: any[] = await prisma.$queryRaw`
        INSERT INTO institute_table (institute_name, address, province, district, zone)
        VALUES (${name}, ${address}, ${province}, ${district}, ${zone})
        RETURNING id::text as id, institute_name as name, address, province, district, zone, created_at, updated_at;
      `;
      if (inserted && inserted.length > 0) {
        savedRecord = inserted[0];
      }
    }

    return serializeForServerAction({ success: true, data: savedRecord });
  } catch (error: any) {
    console.error("Error saving institute record:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to save institute to database" });
  }
}

export async function deleteInstituteServer(id: string) {
  try {
    if (id && !isNaN(Number(id)) && !String(id).startsWith("inst-") && !String(id).startsWith("default-")) {
      const numId = BigInt(id);
      await prisma.$queryRaw`DELETE FROM institute_table WHERE id = ${numId}`;
    }
    return serializeForServerAction({ success: true });
  } catch (error: any) {
    console.error("Error deleting institute record:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to delete institute record" });
  }
}

// -------------------------------------------------------------
// Committee & School Operations (commitee_table & school_table)
// -------------------------------------------------------------
export async function saveCommitteeOfficerAndSchoolsServer(data: {
  employee_no?: string;
  full_name: string;
  email?: string;
  position?: string;
  nic_no?: string;
  state?: string;
  studied_schools?: string[] | string;
  children_schools?: string[] | string;
}) {
  try {
    // 0. Ensure commitee_table and school_table exist
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS commitee_table (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_no VARCHAR(255) NOT NULL UNIQUE,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        position VARCHAR(255),
        nic_no VARCHAR(255) UNIQUE,
        state VARCHAR(255) DEFAULT 'Active',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS school_table (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_no VARCHAR(255) REFERENCES commitee_table(employee_no) ON DELETE CASCADE ON UPDATE CASCADE,
        member_school_name VARCHAR(255),
        member_children_schools_name TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const fullName = (data.full_name || "").trim();
    const nicNo = (data.nic_no || "").trim();
    const email = (data.email || "").trim().toLowerCase();
    const position = data.position || "Member";
    const state = data.state || "Active";

    let empNo = (data.employee_no || nicNo || "").trim();
    if (!empNo) {
      empNo = `EMP-${Date.now().toString().slice(-6)}`;
    }

    if (!fullName) {
      return serializeForServerAction({ success: false, error: "Full name is required" });
    }

    // 1. Check if record exists in commitee_table by employee_no, nic_no, or email
    let existing: any[] = [];
    if (empNo) {
      existing = await prisma.$queryRaw`SELECT id, employee_no FROM commitee_table WHERE employee_no = ${empNo} LIMIT 1;`;
    }
    if ((!existing || existing.length === 0) && nicNo) {
      existing = await prisma.$queryRaw`SELECT id, employee_no FROM commitee_table WHERE nic_no = ${nicNo} LIMIT 1;`;
    }
    if ((!existing || existing.length === 0) && email) {
      existing = await prisma.$queryRaw`SELECT id, employee_no FROM commitee_table WHERE LOWER(email) = ${email} LIMIT 1;`;
    }

    let savedCommitteeId: string = "";
    let finalEmpNo: string = empNo;

    if (existing && existing.length > 0) {
      savedCommitteeId = existing[0].id;
      finalEmpNo = existing[0].employee_no || empNo;
      await prisma.$queryRaw`
        UPDATE commitee_table
        SET full_name = ${fullName},
            email = ${email || null},
            position = ${position},
            nic_no = ${nicNo || null},
            state = ${state},
            updated_at = NOW()
        WHERE id = ${savedCommitteeId}::uuid;
      `;
    } else {
      const inserted: any[] = await prisma.$queryRaw`
        INSERT INTO commitee_table (employee_no, full_name, email, position, nic_no, state)
        VALUES (${empNo}, ${fullName}, ${email || null}, ${position}, ${nicNo || null}, ${state})
        RETURNING id::text as id, employee_no;
      `;
      if (inserted && inserted.length > 0) {
        savedCommitteeId = inserted[0].id;
        finalEmpNo = inserted[0].employee_no;
      }
    }

    // 2. Format studied and children schools
    const studiedStr = Array.isArray(data.studied_schools)
      ? data.studied_schools.filter(Boolean).join(", ")
      : (data.studied_schools || "").trim();

    const childrenStr = Array.isArray(data.children_schools)
      ? data.children_schools.filter(Boolean).join(", ")
      : (data.children_schools || "").trim();

    // 3. Upsert into school_table linking to employee_no
    if (finalEmpNo) {
      const existingSchool: any[] = await prisma.$queryRaw`
        SELECT id FROM school_table WHERE employee_no = ${finalEmpNo} LIMIT 1;
      `;

      if (existingSchool && existingSchool.length > 0) {
        await prisma.$queryRaw`
          UPDATE school_table
          SET member_school_name = ${studiedStr || null},
              member_children_schools_name = ${childrenStr || null},
              updated_at = NOW()
          WHERE id = ${existingSchool[0].id}::uuid;
        `;
      } else {
        await prisma.$queryRaw`
          INSERT INTO school_table (employee_no, member_school_name, member_children_schools_name)
          VALUES (${finalEmpNo}, ${studiedStr || null}, ${childrenStr || null});
        `;
      }
    }

    return serializeForServerAction({
      success: true,
      data: {
        id: savedCommitteeId,
        employee_no: finalEmpNo,
        full_name: fullName,
        email,
        position,
        nic_no: nicNo,
        state,
        studied_schools: studiedStr,
        children_schools: childrenStr,
      },
    });
  } catch (error: any) {
    console.error("Error saving committee officer & schools:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to save committee officer" });
  }
}

export async function getCommitteeOfficersWithSchoolsServer(positionFilter?: string) {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS commitee_table (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_no VARCHAR(255) NOT NULL UNIQUE,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        position VARCHAR(255),
        nic_no VARCHAR(255) UNIQUE,
        state VARCHAR(255) DEFAULT 'Active',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS school_table (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_no VARCHAR(255) REFERENCES commitee_table(employee_no) ON DELETE CASCADE ON UPDATE CASCADE,
        member_school_name VARCHAR(255),
        member_children_schools_name TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    let records: any[] = [];
    if (positionFilter && positionFilter.trim()) {
      const filterLower = positionFilter.trim().toLowerCase();
      if (filterLower === "chairman") {
        records = await prisma.$queryRaw`
          SELECT 
            c.id::text as id,
            c.employee_no,
            c.full_name,
            c.email,
            c.position,
            c.nic_no,
            c.state,
            c.created_at,
            c.updated_at,
            s.member_school_name as studied_schools,
            s.member_children_schools_name as children_schools
          FROM commitee_table c
          LEFT JOIN school_table s ON c.employee_no = s.employee_no
          WHERE LOWER(c.position) = 'chairman'
          ORDER BY c.created_at DESC;
        `;
      } else if (filterLower === "member") {
        records = await prisma.$queryRaw`
          SELECT 
            c.id::text as id,
            c.employee_no,
            c.full_name,
            c.email,
            c.position,
            c.nic_no,
            c.state,
            c.created_at,
            c.updated_at,
            s.member_school_name as studied_schools,
            s.member_children_schools_name as children_schools
          FROM commitee_table c
          LEFT JOIN school_table s ON c.employee_no = s.employee_no
          WHERE LOWER(c.position) = 'member' OR LOWER(c.position) != 'chairman' OR c.position IS NULL
          ORDER BY c.created_at DESC;
        `;
      } else {
        records = await prisma.$queryRaw`
          SELECT 
            c.id::text as id,
            c.employee_no,
            c.full_name,
            c.email,
            c.position,
            c.nic_no,
            c.state,
            c.created_at,
            c.updated_at,
            s.member_school_name as studied_schools,
            s.member_children_schools_name as children_schools
          FROM commitee_table c
          LEFT JOIN school_table s ON c.employee_no = s.employee_no
          WHERE LOWER(c.position) = LOWER(${positionFilter})
          ORDER BY c.created_at DESC;
        `;
      }
    } else {
      records = await prisma.$queryRaw`
        SELECT 
          c.id::text as id,
          c.employee_no,
          c.full_name,
          c.email,
          c.position,
          c.nic_no,
          c.state,
          c.created_at,
          c.updated_at,
          s.member_school_name as studied_schools,
          s.member_children_schools_name as children_schools
        FROM commitee_table c
        LEFT JOIN school_table s ON c.employee_no = s.employee_no
        ORDER BY c.created_at DESC;
      `;
    }

    return serializeForServerAction({ success: true, data: records });
  } catch (error: any) {
    console.error("Error fetching committee officers with schools:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to fetch committee officers", data: [] });
  }
}

export async function getSchoolSuggestionsServer() {
  try {
    const schoolSet = new Set<string>();

    // 1. From institute_table
    try {
      const institutes: any[] = await prisma.$queryRaw`
        SELECT institute_name FROM institute_table WHERE institute_name IS NOT NULL AND TRIM(institute_name) != '';
      `;
      institutes.forEach((i: any) => schoolSet.add(i.institute_name.trim()));
    } catch (e) {}

    // 2. From accused_school_table
    try {
      const accusedSchools: any[] = await prisma.$queryRaw`
        SELECT accused_school_name FROM accused_school_table WHERE accused_school_name IS NOT NULL AND TRIM(accused_school_name) != '';
      `;
      accusedSchools.forEach((s: any) => schoolSet.add(s.accused_school_name.trim()));
    } catch (e) {}

    // 3. From school_table
    try {
      const schoolRows: any[] = await prisma.$queryRaw`
        SELECT member_school_name, member_children_schools_name FROM school_table;
      `;
      schoolRows.forEach((r: any) => {
        if (r.member_school_name) {
          r.member_school_name.split(",").forEach((name: string) => {
            if (name.trim()) schoolSet.add(name.trim());
          });
        }
        if (r.member_children_schools_name) {
          r.member_children_schools_name.split(",").forEach((name: string) => {
            if (name.trim()) schoolSet.add(name.trim());
          });
        }
      });
    } catch (e) {}

    const sortedSchools = Array.from(schoolSet).sort((a, b) => a.localeCompare(b));
    return serializeForServerAction({ success: true, data: sortedSchools });
  } catch (error: any) {
    console.error("Error fetching school suggestions:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to fetch school suggestions", data: [] });
  }
}



