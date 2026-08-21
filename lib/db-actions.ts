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

    // 1. Update existing record by ID if valid ID provided
    if (officerData.id && !officerData.id.startsWith("temp-") && !officerData.id.startsWith("sub-") && !officerData.id.startsWith("dm-") && !officerData.id.startsWith("inv-")) {
      const updated: any[] = await prisma.$queryRaw`
        UPDATE register_officer_table
        SET employee_no = ${employeeNo},
            full_name = ${fullName},
            email = ${email},
            role = ${officerData.role},
            is_active = ${isActive},
            updated_at = NOW()
        WHERE id = ${officerData.id} OR employee_no = ${employeeNo} OR email = ${email}
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
        WHERE id = ${existingId}
        RETURNING *;
      `;
      resultRecord = updated[0];
    } else {
      // 3. Insert new record into register_officer_table
      const targetId = (officerData.id && !officerData.id.startsWith("sub-") && !officerData.id.startsWith("dm-") && !officerData.id.startsWith("inv-")) ? officerData.id : null;
      const inserted: any[] = await prisma.$queryRaw`
        INSERT INTO register_officer_table (id, employee_no, full_name, email, password, role, is_active)
        VALUES (COALESCE(${targetId}, gen_random_uuid()::text), ${employeeNo}, ${fullName}, ${email}, ${password}, ${officerData.role}, ${isActive})
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
    if (!id || !String(id).trim()) {
      return serializeForServerAction({ success: false, error: "Officer identifier is required" });
    }
    const cleanId = String(id).trim();
    await prisma.$executeRaw`DELETE FROM register_officer_table WHERE id = ${cleanId} OR employee_no = ${cleanId} OR email = ${cleanId}`;
    return serializeForServerAction({ success: true });
  } catch (error: any) {
    console.error("Error deleting register officer:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to delete register officer" });
  }
}

export async function toggleRegisterOfficerStatusServer(id: string, is_active: boolean) {
  try {
    if (!id || !String(id).trim()) {
      return serializeForServerAction({ success: false, error: "Officer identifier is required" });
    }
    const cleanId = String(id).trim();
    const updated: any[] = await prisma.$queryRaw`
      UPDATE register_officer_table
      SET is_active = ${is_active}, updated_at = NOW()
      WHERE id = ${cleanId} OR employee_no = ${cleanId} OR email = ${cleanId}
      RETURNING *;
    `;
    return serializeForServerAction({ success: true, data: updated[0] || null });
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
        file_name VARCHAR(100),
        future_action TEXT,
        date_prepared_and_submitted_for_signature DATE,
        classification_of_complaint_letter VARCHAR(255),
        name_of_the_presenting_the_complain VARCHAR(255),
        address_of_the_person_presenting_the_complaint TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE subject_officer_form_table ADD COLUMN IF NOT EXISTS file_name VARCHAR(100);
      `);
    } catch (e) {}

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
      const fileNameVal = officerData.file_name || officerData.fileName || "discipline";

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
              file_name = ${fileNameVal},
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
            ref_number, daily_mail_letter_id, accused_officer_id, subject_file_no, file_name, future_action,
            date_prepared_and_submitted_for_signature, classification_of_complaint_letter,
            name_of_the_presenting_the_complain, address_of_the_person_presenting_the_complaint
          )
          VALUES (
            ${refTrimmed}, ${dailyMailId ? Number(dailyMailId) : null}, ${primaryOfficerId ? primaryOfficerId : null}::uuid,
            ${subject_file_no || null}, ${fileNameVal}, ${future_action || null}, ${prepDateVal},
            ${classification_of_complaint_letter || null}, ${name_of_the_presenting_the_complain || null},
            ${address_of_the_person_presenting_the_complaint || null}
          )
          RETURNING id;
        `;
        if (insertedForm && insertedForm.length > 0) {
          formId = insertedForm[0].id;
        }
      }

      if (subject_file_no && String(subject_file_no).trim()) {
        const cleanSubNo = String(subject_file_no).trim();
        try {
          await prisma.$executeRaw`
            UPDATE public.case_by_appointment_and_report_due_date
            SET subject_file_no = ${cleanSubNo}, sub_file_no = ${cleanSubNo}, subject_officer_form_id = ${Number(formId)}::bigint
            WHERE LOWER(subject_file_no) = LOWER(${refTrimmed})
               OR LOWER(sub_file_no) = LOWER(${refTrimmed})
               OR (subject_officer_form_id IS NOT NULL AND subject_officer_form_id = ${Number(formId)}::bigint);
          `;
          await prisma.$executeRaw`
            UPDATE public.members_by_case
            SET ref_number = ${cleanSubNo}
            WHERE LOWER(ref_number) = LOWER(${refTrimmed});
          `;
          await prisma.$executeRaw`
            UPDATE public.chairment_by_case
            SET ref_number = ${cleanSubNo}
            WHERE LOWER(ref_number) = LOWER(${refTrimmed});
          `;
        } catch (e) {}
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
        sof.file_name,
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

// -------------------------------------------------------------
// Chairman By Case Table Operations (chairment_by_case)
// -------------------------------------------------------------
export async function saveChairmanByCaseServer(
  refNumber: string,
  chairman: { fullName?: string; full_name?: string; position?: string; email?: string } | null
) {
  try {
    if (!refNumber || !refNumber.trim()) {
      return serializeForServerAction({ success: false, error: "Reference number is required" });
    }

    const resolved = await resolveSubjectFileDetails(refNumber);
    const cleanRefNo = resolved.clean;
    const actualSubNo = resolved.subjectFileNo;
    const refNum = resolved.refNumber;
    const now = new Date();

    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE public.chairment_by_case DROP CONSTRAINT IF EXISTS chairment_by_case_ref_number_fkey;`);
    } catch (e) {}

    // If chairman is null/empty, clear chairman record for this case
    if (!chairman || (!chairman.fullName && !chairman.full_name)) {
      await prisma.$executeRaw`
        DELETE FROM chairment_by_case 
        WHERE LOWER(ref_number) = LOWER(${cleanRefNo})
           OR LOWER(ref_number) = LOWER(${actualSubNo})
           OR LOWER(ref_number) = LOWER(${refNum});
      `;
      return serializeForServerAction({ success: true, message: "Chairman removed for case" });
    }

    const fullName = (chairman.fullName || chairman.full_name || "").trim();
    const position = (chairman.position || "Chairman").trim();
    const rawEmail = (chairman.email || "").trim();

    let validEmail = null;
    if (rawEmail) {
      const commCheck: any[] = await prisma.$queryRaw`
        SELECT email FROM commitee_table WHERE LOWER(email) = LOWER(${rawEmail}) LIMIT 1;
      `;
      if (commCheck && commCheck.length > 0) {
        validEmail = commCheck[0].email;
      }
    }

    const existing: any[] = await prisma.$queryRaw`
      SELECT id FROM chairment_by_case 
      WHERE LOWER(ref_number) = LOWER(${cleanRefNo})
         OR LOWER(ref_number) = LOWER(${actualSubNo})
         OR LOWER(ref_number) = LOWER(${refNum})
      LIMIT 1;
    `;

    if (existing && existing.length > 0) {
      await prisma.$executeRaw`
        UPDATE chairment_by_case
        SET ref_number = ${actualSubNo},
            full_name = ${fullName},
            position = ${position},
            email = ${validEmail},
            updated_at = ${now}
        WHERE id = ${existing[0].id};
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO chairment_by_case (ref_number, full_name, position, email, created_at, updated_at)
        VALUES (${actualSubNo}, ${fullName}, ${position}, ${validEmail}, ${now}, ${now});
      `;
    }

    return serializeForServerAction({
      success: true,
      data: { ref_number: actualSubNo, full_name: fullName, position, email: validEmail },
    });
  } catch (error: any) {
    console.error("Error saving chairman by case:", error);
    return serializeForServerAction({
      success: false,
      error: error?.message || "Failed to save chairman by case",
    });
  }
}

export async function getChairmanByCaseServer(refNumber: string) {
  try {
    if (!refNumber || !refNumber.trim()) {
      return serializeForServerAction({ success: false, error: "Reference number is required", data: null });
    }

    const resolved = await resolveSubjectFileDetails(refNumber);
    const cleanRefNo = resolved.clean;
    const actualSubNo = resolved.subjectFileNo;
    const refNum = resolved.refNumber;

    const records: any[] = await prisma.$queryRaw`
      SELECT 
        id::text as id,
        ref_number,
        full_name,
        position,
        email,
        created_at,
        updated_at
      FROM chairment_by_case
      WHERE LOWER(ref_number) = LOWER(${cleanRefNo})
         OR LOWER(ref_number) = LOWER(${actualSubNo})
         OR LOWER(ref_number) = LOWER(${refNum})
      ORDER BY updated_at DESC
      LIMIT 1;
    `;

    if (records && records.length > 0) {
      return serializeForServerAction({ success: true, data: records[0] });
    }

    return serializeForServerAction({ success: true, data: null });
  } catch (error: any) {
    console.error("Error fetching chairman by case:", error);
    return serializeForServerAction({
      success: false,
      error: error?.message || "Failed to fetch chairman by case",
      data: null,
    });
  }
}

// -------------------------------------------------------------
// Members By Case Table Operations (members_by_case)
// -------------------------------------------------------------
export async function saveMembersByCaseServer(
  refNumber: string,
  members: Array<{ fullName?: string; full_name?: string; name?: string; position?: string; email?: string; officerRole?: string }>
) {
  try {
    if (!refNumber || !refNumber.trim()) {
      return serializeForServerAction({ success: false, error: "Reference number is required" });
    }

    const resolved = await resolveSubjectFileDetails(refNumber);
    const cleanRefNo = resolved.clean;
    const actualSubNo = resolved.subjectFileNo;
    const refNum = resolved.refNumber;
    const now = new Date();

    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE public.members_by_case DROP CONSTRAINT IF EXISTS members_by_case_ref_number_fkey;`);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS members_by_case (
          id BIGSERIAL PRIMARY KEY,
          ref_number VARCHAR(255),
          full_name VARCHAR(255),
          position VARCHAR(255),
          email VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {}

    await prisma.$executeRaw`
      DELETE FROM members_by_case 
      WHERE LOWER(ref_number) = LOWER(${cleanRefNo})
         OR LOWER(ref_number) = LOWER(${actualSubNo})
         OR LOWER(ref_number) = LOWER(${refNum});
    `;

    if (!members || !Array.isArray(members) || members.length === 0) {
      return serializeForServerAction({ success: true, message: "Members cleared for case" });
    }

    for (const member of members) {
      const fullName = (member.fullName || member.full_name || member.name || "").trim();
      if (!fullName) continue;

      const position = (member.position || member.officerRole || "Member").trim();
      const rawEmail = (member.email || "").trim();

      let validEmail = null;
      if (rawEmail) {
        try {
          const commCheck: any[] = await prisma.$queryRaw`
            SELECT email FROM commitee_table WHERE LOWER(email) = LOWER(${rawEmail}) LIMIT 1;
          `;
          if (commCheck && commCheck.length > 0) {
            validEmail = commCheck[0].email;
          }
        } catch (e) {}
      }

      await prisma.$executeRaw`
        INSERT INTO members_by_case (ref_number, full_name, position, email, created_at, updated_at)
        VALUES (${actualSubNo}, ${fullName}, ${position}, ${validEmail}, ${now}, ${now});
      `;
    }

    return serializeForServerAction({
      success: true,
      message: "Members saved by case successfully",
    });
  } catch (error: any) {
    console.error("Error saving members by case:", error);
    return serializeForServerAction({
      success: false,
      error: error?.message || "Failed to save members by case",
    });
  }
}

export async function getMembersByCaseServer(refNumber: string) {
  try {
    if (!refNumber || !refNumber.trim()) {
      return serializeForServerAction({ success: false, error: "Reference number is required", data: [] });
    }

    const resolved = await resolveSubjectFileDetails(refNumber);
    const cleanRefNo = resolved.clean;
    const actualSubNo = resolved.subjectFileNo;
    const refNum = resolved.refNumber;

    const records: any[] = await prisma.$queryRaw`
      SELECT 
        id::text as id,
        ref_number,
        full_name,
        position,
        email,
        created_at,
        updated_at
      FROM members_by_case
      WHERE LOWER(ref_number) = LOWER(${cleanRefNo})
         OR LOWER(ref_number) = LOWER(${actualSubNo})
         OR LOWER(ref_number) = LOWER(${refNum})
      ORDER BY id ASC;
    `;

    return serializeForServerAction({ success: true, data: records || [] });
  } catch (error: any) {
    console.error("Error fetching members by case:", error);
    return serializeForServerAction({
      success: false,
      error: error?.message || "Failed to fetch members by case",
      data: [],
    });
  }
}

// Helper to resolve subject_file_no, sub_file_no, and subject_officer_form_id from subject_officer_form_table
async function resolveSubjectFileDetails(refOrSubNo: string) {
  const clean = refOrSubNo ? refOrSubNo.trim() : "";
  let subjectFileNo = clean;
  let subFileNo = clean;
  let formId: any = null;
  let refNumber = clean;

  if (clean) {
    try {
      const sofRows: any[] = await prisma.$queryRaw`
        SELECT id, ref_number, subject_file_no
        FROM subject_officer_form_table
        WHERE LOWER(ref_number) = LOWER(${clean})
           OR LOWER(subject_file_no) = LOWER(${clean})
        LIMIT 1;
      `;
      if (sofRows && sofRows.length > 0) {
        formId = sofRows[0].id;
        refNumber = sofRows[0].ref_number || clean;
        if (sofRows[0].subject_file_no && sofRows[0].subject_file_no.trim()) {
          subjectFileNo = sofRows[0].subject_file_no.trim();
          subFileNo = sofRows[0].subject_file_no.trim();
        }
      }
    } catch (e) {}
  }
  return { clean, subjectFileNo, subFileNo, formId, refNumber };
}

// -------------------------------------------------------------
// 15. Case By Date Extension Operations
// -------------------------------------------------------------
export async function saveCaseByDateExtensionServer(payload: {
  subject_file_no: string;
  sub_file_no?: string;
  extention_term?: string;
  start_date?: string | null;
  end_date?: string | null;
  approval_status?: string;
}) {
  try {
    if (!payload || !payload.subject_file_no) {
      return serializeForServerAction({ success: false, error: "subject_file_no is required" });
    }

    const resolved = await resolveSubjectFileDetails(payload.subject_file_no);
    const actualSubNo = resolved.subjectFileNo;
    const term = payload.extention_term || "First Extension (1st)";
    const start = payload.start_date ? new Date(payload.start_date) : null;
    const end = payload.end_date ? new Date(payload.end_date) : null;
    const status = payload.approval_status || "Pending";
    const now = new Date();

    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS public.case_by_date_extention (
          id BIGSERIAL PRIMARY KEY,
          subject_file_no VARCHAR(100),
          sub_file_no VARCHAR(100),
          subject_officer_form_id BIGINT,
          extention_term VARCHAR(50),
          start_date DATE,
          end_date DATE,
          approval_status VARCHAR(50) DEFAULT 'Pending',
          decision_date DATE,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {}

    await prisma.$executeRaw`
      INSERT INTO public.case_by_date_extention (
        subject_file_no,
        sub_file_no,
        subject_officer_form_id,
        extention_term,
        start_date,
        end_date,
        approval_status,
        created_at,
        updated_at
      ) VALUES (
        ${actualSubNo},
        ${actualSubNo},
        ${resolved.formId ? Number(resolved.formId) : null}::bigint,
        ${term},
        ${start},
        ${end},
        ${status},
        ${now},
        ${now}
      );
    `;

    return serializeForServerAction({ success: true, message: "Date extension saved to PostgreSQL" });
  } catch (error: any) {
    console.error("Error saving case_by_date_extention:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to save extension" });
  }
}

export async function updateCaseByDateExtensionApprovalServer(
  subjectFileNo: string,
  approvalStatus: string,
  decisionDate?: string | null,
  extDetails?: {
    extention_term?: string;
    start_date?: string | null;
    end_date?: string | null;
  }
) {
  try {
    if (!subjectFileNo) {
      return serializeForServerAction({ success: false, error: "subjectFileNo is required" });
    }
    const resolved = await resolveSubjectFileDetails(subjectFileNo);
    const cleanRef = resolved.clean;
    const actualSubNo = resolved.subjectFileNo;
    const refNum = resolved.refNumber;
    const formId = resolved.formId;
    const decDate = decisionDate ? new Date(decisionDate) : new Date();
    const now = new Date();

    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS public.case_by_date_extention (
          id BIGSERIAL PRIMARY KEY,
          subject_file_no VARCHAR(100),
          sub_file_no VARCHAR(100),
          subject_officer_form_id BIGINT,
          extention_term VARCHAR(50),
          start_date DATE,
          end_date DATE,
          approval_status VARCHAR(50) DEFAULT 'Pending',
          decision_date DATE,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {}

    const existing: any[] = formId ? await prisma.$queryRaw`
      SELECT id FROM public.case_by_date_extention
      WHERE LOWER(subject_file_no) = LOWER(${cleanRef})
         OR LOWER(subject_file_no) = LOWER(${actualSubNo})
         OR LOWER(subject_file_no) = LOWER(${refNum})
         OR LOWER(sub_file_no) = LOWER(${cleanRef})
         OR LOWER(sub_file_no) = LOWER(${actualSubNo})
         OR LOWER(sub_file_no) = LOWER(${refNum})
         OR subject_officer_form_id = ${Number(formId)}::bigint
      LIMIT 1;
    ` : await prisma.$queryRaw`
      SELECT id FROM public.case_by_date_extention
      WHERE LOWER(subject_file_no) = LOWER(${cleanRef})
         OR LOWER(sub_file_no) = LOWER(${cleanRef})
      LIMIT 1;
    `;

    if (existing && existing.length > 0) {
      await prisma.$executeRaw`
        UPDATE public.case_by_date_extention
        SET 
          subject_file_no = ${actualSubNo},
          sub_file_no = ${actualSubNo},
          subject_officer_form_id = ${formId ? Number(formId) : null}::bigint,
          approval_status = ${approvalStatus},
          decision_date = ${decDate},
          updated_at = ${now}
        WHERE id = ${existing[0].id};
      `;
    } else {
      const term = extDetails?.extention_term || "First Extension (1st)";
      const start = extDetails?.start_date ? new Date(extDetails.start_date) : null;
      const end = extDetails?.end_date ? new Date(extDetails.end_date) : null;

      await prisma.$executeRaw`
        INSERT INTO public.case_by_date_extention (
          subject_file_no,
          sub_file_no,
          subject_officer_form_id,
          extention_term,
          start_date,
          end_date,
          approval_status,
          decision_date,
          created_at,
          updated_at
        ) VALUES (
          ${actualSubNo},
          ${actualSubNo},
          ${formId ? Number(formId) : null}::bigint,
          ${term},
          ${start},
          ${end},
          ${approvalStatus},
          ${decDate},
          ${now},
          ${now}
        );
      `;
    }

    return serializeForServerAction({ success: true, message: "Extension approval updated in PostgreSQL" });
  } catch (error: any) {
    console.error("Error updating case_by_date_extention approval:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to update extension approval" });
  }
}

export async function getCaseByDateExtensionServer(subjectFileNo: string) {
  try {
    if (!subjectFileNo || !subjectFileNo.trim()) {
      return serializeForServerAction({ success: false, error: "subjectFileNo is required", data: null });
    }
    const resolved = await resolveSubjectFileDetails(subjectFileNo);
    const cleanRef = resolved.clean;
    const actualSubNo = resolved.subjectFileNo;
    const refNum = resolved.refNumber;
    const formId = resolved.formId;

    const records: any[] = formId ? await prisma.$queryRaw`
      SELECT 
        id::text as id,
        subject_file_no,
        sub_file_no,
        subject_officer_form_id::text as subject_officer_form_id,
        extention_term,
        start_date,
        end_date,
        approval_status,
        decision_date,
        created_at,
        updated_at
      FROM public.case_by_date_extention
      WHERE LOWER(subject_file_no) = LOWER(${cleanRef})
         OR LOWER(subject_file_no) = LOWER(${actualSubNo})
         OR LOWER(subject_file_no) = LOWER(${refNum})
         OR LOWER(sub_file_no) = LOWER(${cleanRef})
         OR LOWER(sub_file_no) = LOWER(${actualSubNo})
         OR LOWER(sub_file_no) = LOWER(${refNum})
         OR subject_officer_form_id = ${Number(formId)}::bigint
      ORDER BY created_at DESC
      LIMIT 1;
    ` : await prisma.$queryRaw`
      SELECT 
        id::text as id,
        subject_file_no,
        sub_file_no,
        subject_officer_form_id::text as subject_officer_form_id,
        extention_term,
        start_date,
        end_date,
        approval_status,
        decision_date,
        created_at,
        updated_at
      FROM public.case_by_date_extention
      WHERE LOWER(subject_file_no) = LOWER(${cleanRef})
         OR LOWER(sub_file_no) = LOWER(${cleanRef})
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    return serializeForServerAction({ success: true, data: records && records.length > 0 ? records[0] : null });
  } catch (error: any) {
    console.error("Error fetching case_by_date_extention:", error);
    return serializeForServerAction({ success: false, error: error?.message, data: null });
  }
}

export async function saveCaseByAppointmentAndReportDueDateServer(payload: {
  subject_file_no: string;
  sub_file_no?: string;
  appointment_letter_date?: string | null;
  report_due_date?: string | null;
  dates_submitted_by_subject?: boolean;
}) {
  try {
    if (!payload.subject_file_no) {
      return serializeForServerAction({ success: false, error: "subject_file_no is required" });
    }
    const resolved = await resolveSubjectFileDetails(payload.subject_file_no);
    const cleanRef = resolved.clean;
    const actualSubNo = resolved.subjectFileNo;
    const refNum = resolved.refNumber;
    const formId = resolved.formId;
    const apptDate = payload.appointment_letter_date ? new Date(payload.appointment_letter_date) : null;
    const dueDate = payload.report_due_date ? new Date(payload.report_due_date) : null;
    const isSubmitted = payload.dates_submitted_by_subject ?? true;
    const now = new Date();

    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS public.case_by_appointment_and_report_due_date (
          id BIGSERIAL PRIMARY KEY,
          subject_file_no VARCHAR(100),
          sub_file_no VARCHAR(100),
          subject_officer_form_id BIGINT,
          appointment_letter_date DATE,
          report_due_date DATE,
          dates_submitted_by_subject BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await prisma.$executeRawUnsafe(`ALTER TABLE public.case_by_appointment_and_report_due_date ADD COLUMN IF NOT EXISTS sub_file_no VARCHAR(100);`);
      await prisma.$executeRawUnsafe(`ALTER TABLE public.case_by_appointment_and_report_due_date ADD COLUMN IF NOT EXISTS subject_officer_form_id BIGINT;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE public.case_by_appointment_and_report_due_date ADD COLUMN IF NOT EXISTS appointment_letter_date DATE;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE public.case_by_appointment_and_report_due_date ADD COLUMN IF NOT EXISTS report_due_date DATE;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE public.case_by_appointment_and_report_due_date ADD COLUMN IF NOT EXISTS dates_submitted_by_subject BOOLEAN DEFAULT TRUE;`);
    } catch (e) {}

    const existing: any[] = formId ? await prisma.$queryRaw`
      SELECT id FROM public.case_by_appointment_and_report_due_date
      WHERE LOWER(subject_file_no) = LOWER(${cleanRef})
         OR LOWER(subject_file_no) = LOWER(${actualSubNo})
         OR LOWER(subject_file_no) = LOWER(${refNum})
         OR LOWER(sub_file_no) = LOWER(${cleanRef})
         OR LOWER(sub_file_no) = LOWER(${actualSubNo})
         OR LOWER(sub_file_no) = LOWER(${refNum})
         OR subject_officer_form_id = ${Number(formId)}::bigint
      LIMIT 1;
    ` : await prisma.$queryRaw`
      SELECT id FROM public.case_by_appointment_and_report_due_date
      WHERE LOWER(subject_file_no) = LOWER(${cleanRef})
         OR LOWER(sub_file_no) = LOWER(${cleanRef})
      LIMIT 1;
    `;

    if (existing && existing.length > 0) {
      await prisma.$executeRaw`
        UPDATE public.case_by_appointment_and_report_due_date
        SET 
          subject_file_no = ${actualSubNo},
          sub_file_no = ${actualSubNo},
          subject_officer_form_id = ${formId ? Number(formId) : null}::bigint,
          appointment_letter_date = ${apptDate},
          report_due_date = ${dueDate},
          dates_submitted_by_subject = ${isSubmitted},
          updated_at = ${now}
        WHERE id = ${existing[0].id};
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO public.case_by_appointment_and_report_due_date (
          subject_file_no,
          sub_file_no,
          subject_officer_form_id,
          appointment_letter_date,
          report_due_date,
          dates_submitted_by_subject,
          created_at,
          updated_at
        ) VALUES (
          ${actualSubNo},
          ${actualSubNo},
          ${formId ? Number(formId) : null}::bigint,
          ${apptDate},
          ${dueDate},
          ${isSubmitted},
          ${now},
          ${now}
        );
      `;
    }

    return serializeForServerAction({ success: true, message: "Appointment & report due dates saved to PostgreSQL" });
  } catch (error: any) {
    console.error("Error saving case_by_appointment_and_report_due_date:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to save dates" });
  }
}

export async function getCaseByAppointmentAndReportDueDateServer(subjectFileNo: string) {
  try {
    if (!subjectFileNo || !subjectFileNo.trim()) {
      return serializeForServerAction({ success: false, error: "subjectFileNo is required", data: null });
    }
    const resolved = await resolveSubjectFileDetails(subjectFileNo);
    const cleanRef = resolved.clean;
    const actualSubNo = resolved.subjectFileNo;
    const refNum = resolved.refNumber;
    const formId = resolved.formId;

    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS public.case_by_appointment_and_report_due_date (
          id BIGSERIAL PRIMARY KEY,
          subject_file_no VARCHAR(100),
          sub_file_no VARCHAR(100),
          subject_officer_form_id BIGINT,
          appointment_letter_date DATE,
          report_due_date DATE,
          dates_submitted_by_subject BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await prisma.$executeRawUnsafe(`ALTER TABLE public.case_by_appointment_and_report_due_date ADD COLUMN IF NOT EXISTS sub_file_no VARCHAR(100);`);
      await prisma.$executeRawUnsafe(`ALTER TABLE public.case_by_appointment_and_report_due_date ADD COLUMN IF NOT EXISTS subject_officer_form_id BIGINT;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE public.case_by_appointment_and_report_due_date ADD COLUMN IF NOT EXISTS appointment_letter_date DATE;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE public.case_by_appointment_and_report_due_date ADD COLUMN IF NOT EXISTS report_due_date DATE;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE public.case_by_appointment_and_report_due_date ADD COLUMN IF NOT EXISTS dates_submitted_by_subject BOOLEAN DEFAULT TRUE;`);
    } catch (e) {}

    const records: any[] = formId ? await prisma.$queryRaw`
      SELECT 
        id::text as id,
        subject_file_no,
        sub_file_no,
        subject_officer_form_id::text as subject_officer_form_id,
        appointment_letter_date,
        report_due_date,
        dates_submitted_by_subject,
        created_at,
        updated_at
      FROM public.case_by_appointment_and_report_due_date
      WHERE LOWER(subject_file_no) = LOWER(${cleanRef})
         OR LOWER(subject_file_no) = LOWER(${actualSubNo})
         OR LOWER(subject_file_no) = LOWER(${refNum})
         OR LOWER(sub_file_no) = LOWER(${cleanRef})
         OR LOWER(sub_file_no) = LOWER(${actualSubNo})
         OR LOWER(sub_file_no) = LOWER(${refNum})
         OR subject_officer_form_id = ${Number(formId)}::bigint
      ORDER BY created_at DESC
      LIMIT 1;
    ` : await prisma.$queryRaw`
      SELECT 
        id::text as id,
        subject_file_no,
        sub_file_no,
        subject_officer_form_id::text as subject_officer_form_id,
        appointment_letter_date,
        report_due_date,
        dates_submitted_by_subject,
        created_at,
        updated_at
      FROM public.case_by_appointment_and_report_due_date
      WHERE LOWER(subject_file_no) = LOWER(${cleanRef})
         OR LOWER(sub_file_no) = LOWER(${cleanRef})
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    return serializeForServerAction({ success: true, data: records && records.length > 0 ? records[0] : null });
  } catch (error: any) {
    console.error("Error fetching case_by_appointment_and_report_due_date:", error);
    return serializeForServerAction({ success: false, error: error?.message, data: null });
  }
}

export async function getCaseFullTimelineServer(caseNo: string) {
  try {
    if (!caseNo || !caseNo.trim()) {
      return serializeForServerAction({ success: false, error: "caseNo is required", data: null });
    }

    const clean = caseNo.trim();
    const resolved = await resolveSubjectFileDetails(clean);
    const actualSubNo = resolved.subjectFileNo;
    const refNum = resolved.refNumber;
    const formId = resolved.formId;

    // 1. Fetch Daily Mail Records
    let dailyMailRows: any[] = [];
    try {
      dailyMailRows = await prisma.$queryRaw`
        SELECT 
          id::text as id,
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
        FROM public.daily_mail_letter_table
        WHERE LOWER(ref_number) = LOWER(${clean})
           OR LOWER(ref_number) = LOWER(${actualSubNo})
           OR LOWER(ref_number) = LOWER(${refNum})
           OR LOWER(letter_number) = LOWER(${clean})
           OR LOWER(letter_number) = LOWER(${actualSubNo})
           OR LOWER(letter_number) = LOWER(${refNum})
        ORDER BY created_at ASC;
      `;
    } catch (e) {}

    // Fallback: daily_mail table
    if (!dailyMailRows || dailyMailRows.length === 0) {
      try {
        dailyMailRows = await prisma.$queryRaw`
          SELECT 
            daily_mail_id::text as id,
            letter_number,
            received_letter_number as ref_number,
            mode_of_receipt,
            sender_party as senders_party,
            nature_of_letter,
            subject_category,
            subject_of_letter,
            date_received_by_additional_secretary as date_received_by_add_secretary,
            date_letter_handed_over_to_dicipline_branch as date_letter_handover_discipline,
            created_at,
            updated_at
          FROM daily_mail
          WHERE LOWER(received_letter_number) = LOWER(${clean})
             OR LOWER(received_letter_number) = LOWER(${actualSubNo})
             OR LOWER(received_letter_number) = LOWER(${refNum})
             OR LOWER(letter_number) = LOWER(${clean})
             OR LOWER(letter_number) = LOWER(${actualSubNo})
             OR LOWER(letter_number) = LOWER(${refNum})
          ORDER BY created_at ASC;
        `;
      } catch (e) {}
    }

    // 2. Fetch Subject Officer Form & Accused Officers
    let subjectForm: any = null;
    let accusedOfficersList: any[] = [];
    try {
      const formRes = await getAccusedOfficerByRefServer(clean);
      if (formRes && formRes.success && formRes.data) {
        subjectForm = formRes.data;
        if (Array.isArray(formRes.data.accused_officers)) {
          accusedOfficersList = formRes.data.accused_officers;
        }
      }
    } catch (e) {}

    // 3. Fetch Chairman & Committee Members
    let chairmanData: any = null;
    let membersData: any[] = [];
    try {
      const chairRes = await getChairmanByCaseServer(clean);
      if (chairRes && chairRes.success && chairRes.data) {
        chairmanData = chairRes.data;
      }
    } catch (e) {}
    try {
      const membRes = await getMembersByCaseServer(clean);
      if (membRes && membRes.success && Array.isArray(membRes.data)) {
        membersData = membRes.data;
      }
    } catch (e) {}

    // 4. Fetch Appointment & Report Due Dates
    let datesData: any = null;
    try {
      const dRes = await getCaseByAppointmentAndReportDueDateServer(clean);
      if (dRes && dRes.success && dRes.data) {
        datesData = dRes.data;
      }
    } catch (e) {}

    // 5. Fetch Date Extension
    let extData: any = null;
    try {
      const extRes = await getCaseByDateExtensionServer(clean);
      if (extRes && extRes.success && extRes.data) {
        extData = extRes.data;
      }
    } catch (e) {}

    // 6. Fetch Subject Details Action Logs
    let subjectDetailsLogs: any[] = [];
    try {
      subjectDetailsLogs = await prisma.$queryRaw`
        SELECT 
          id::text as id,
          case_no,
          ref_no,
          received_date,
          report_state,
          special_notes,
          subject_officer_name,
          officer_name,
          step_taken,
          created_at
        FROM public.dcmms_subject_details
        WHERE LOWER(case_no) = LOWER(${clean})
           OR LOWER(case_no) = LOWER(${actualSubNo})
           OR LOWER(case_no) = LOWER(${refNum})
           OR LOWER(ref_no) = LOWER(${clean})
           OR LOWER(ref_no) = LOWER(${actualSubNo})
           OR LOWER(ref_no) = LOWER(${refNum})
        ORDER BY received_date ASC, created_at ASC;
      `;
    } catch (e) {}

    // 7. Fetch Subject Assignments (Investigation Admin decisions)
    let assignmentData: any = null;
    try {
      const asgnRows: any[] = await prisma.$queryRaw`
        SELECT * FROM public.dcmms_subject_assignments
        WHERE LOWER(case_no) = LOWER(${clean})
           OR LOWER(case_no) = LOWER(${actualSubNo})
           OR LOWER(case_no) = LOWER(${refNum})
        LIMIT 1;
      `;
      if (asgnRows && asgnRows.length > 0) {
        assignmentData = asgnRows[0];
      }
    } catch (e) {}

    // 8. Fetch Preliminary Investigation details
    let prelimData: any = null;
    try {
      const prelimRows: any[] = await prisma.$queryRaw`
        SELECT * FROM public.dcmms_preliminary_investigations
        WHERE LOWER(case_no) = LOWER(${clean})
           OR LOWER(case_no) = LOWER(${actualSubNo})
           OR LOWER(case_no) = LOWER(${refNum})
        LIMIT 1;
      `;
      if (prelimRows && prelimRows.length > 0) {
        prelimData = prelimRows[0];
      }
    } catch (e) {}

    return serializeForServerAction({
      success: true,
      data: {
        caseNo: clean,
        subjectFileNo: actualSubNo,
        refNumber: refNum,
        dailyMailRows: dailyMailRows || [],
        subjectForm: subjectForm || null,
        accusedOfficers: accusedOfficersList || [],
        chairman: chairmanData || null,
        members: membersData || [],
        appointmentDates: datesData || null,
        extension: extData || null,
        subjectDetailsLogs: subjectDetailsLogs || [],
        assignment: assignmentData || null,
        preliminaryInvestigation: prelimData || null,
      },
    });
  } catch (error: any) {
    console.error("Error fetching full case timeline from server:", error);
    return serializeForServerAction({ success: false, error: error?.message || "Failed to fetch timeline", data: null });
  }
}

// -------------------------------------------------------------
// 7. Officer Workflow & Workload Aggregation Server Action
// -------------------------------------------------------------
export async function getOfficerWorkflowDataServer() {
  try {
    // 1. Fetch Registered Officers from register_officer_table
    let officersRaw: any[] = [];
    try {
      officersRaw = await prisma.$queryRaw`
        SELECT id, employee_no, full_name, email, role, is_active, created_at
        FROM register_officer_table
        ORDER BY created_at DESC;
      `;
    } catch (e) {
      console.warn("Could not query register_officer_table:", e);
    }

    // 2. Fetch Daily Mail Letters from daily_mail_letter_table (deduplicated)
    let dailyLettersRaw: any[] = [];
    try {
      dailyLettersRaw = await prisma.$queryRaw`
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
    } catch (e) {
      console.warn("Could not query daily_mail_letter_table for workflow:", e);
    }

    // Also fetch action_officer assignments from dcmms_daily_mail or daily_mail
    const refToAssignedOfficer = new Map<string, string>();
    try {
      const dcmmsMails: any[] = await prisma.$queryRaw`
        SELECT 
          serial_no, 
          letter_no, 
          action_officer, 
          status,
          priority
        FROM dcmms_daily_mail
        WHERE action_officer IS NOT NULL AND action_officer != '';
      `;
      if (dcmmsMails && dcmmsMails.length > 0) {
        dcmmsMails.forEach((m) => {
          const act = (m.action_officer || "").trim();
          if (act) {
            if (m.serial_no) refToAssignedOfficer.set(m.serial_no.trim().toLowerCase(), act);
            if (m.letter_no) refToAssignedOfficer.set(m.letter_no.trim().toLowerCase(), act);
          }
        });
      }
    } catch (e) {}

    // 3. Fetch Subject Officer Form Table records
    let subjectFormsRaw: any[] = [];
    try {
      subjectFormsRaw = await prisma.$queryRaw`
        SELECT 
          sof.id::text as id,
          sof.daily_mail_letter_id::text as daily_mail_letter_id,
          sof.ref_number,
          sof.subject_file_no,
          sof.future_action,
          sof.classification_of_complaint_letter,
          sof.name_of_the_presenting_the_complain,
          sof.date_prepared_and_submitted_for_signature,
          sof.created_at,
          ao.accused_officer_name,
          ao.position as accused_position,
          ao.nic_no as accused_nic,
          aschool.accused_school_name,
          aschool.province,
          aschool.district,
          aschool.zone
        FROM subject_officer_form_table sof
        LEFT JOIN accused_officer_table ao ON sof.accused_officer_id = ao.id
        LEFT JOIN accused_school_table aschool ON ao.accused_school_id = aschool.id
        ORDER BY sof.created_at DESC;
      `;
    } catch (e) {
      console.warn("Could not query subject_officer_form_table for workflow:", e);
    }

    // 4. Fetch Chairman and Committee Members for Inquiries
    let chairmenRaw: any[] = [];
    let membersRaw: any[] = [];
    try {
      chairmenRaw = await prisma.$queryRaw`
        SELECT id::text as id, ref_number, full_name, position, email, created_at, updated_at
        FROM chairment_by_case
        ORDER BY created_at DESC;
      `;
    } catch (e) {}

    try {
      membersRaw = await prisma.$queryRaw`
        SELECT id::text as id, ref_number, full_name, position, email, created_at, updated_at
        FROM members_by_case
        ORDER BY created_at DESC;
      `;
    } catch (e) {}

    // 5. Fetch dcmms_subject and dcmms_subject_assignments
    let subjectAssignmentsRaw: any[] = [];
    try {
      subjectAssignmentsRaw = await prisma.$queryRaw`
        SELECT 
          id::text as id,
          case_no,
          subject_officer_name,
          assigned_officers,
          officer_name,
          status,
          assigned_date,
          subject
        FROM dcmms_subject_assignments;
      `;
    } catch (e) {}

    let dcmmsSubjectRaw: any[] = [];
    try {
      dcmmsSubjectRaw = await prisma.$queryRaw`
        SELECT 
          id::text as id,
          case_no,
          officer_name,
          subject,
          status,
          priority,
          assigned_date
        FROM dcmms_subject;
      `;
    } catch (e) {}

    // Helper to normalize roles
    const getNormalizedRole = (role: string): "Subject Officer" | "Investigation Officer" | "Daily Mail Officer" | "Other" => {
      const r = (role || "").toLowerCase();
      if (r.includes("subject")) return "Subject Officer";
      if (r.includes("investigation") || r.includes("inquiry")) return "Investigation Officer";
      if (r.includes("daily") || r.includes("mail")) return "Daily Mail Officer";
      return "Other";
    };

    // Deduplicate daily mail letters
    const deduplicatedLetters: any[] = [];
    const seenLetterKeys = new Set<string>();

    dailyLettersRaw.forEach((row) => {
      const key = `${(row.letter_no || "").trim().toLowerCase()}|${(row.serial_no || "").trim().toLowerCase()}`;
      if (!seenLetterKeys.has(key)) {
        seenLetterKeys.add(key);
        const refKey = (row.serial_no || row.letter_no || "").trim().toLowerCase();
        const assignedSubjectOfficer = refToAssignedOfficer.get(refKey) || "";
        deduplicatedLetters.push({
          ...row,
          assigned_subject_officer: assignedSubjectOfficer,
          received_date: row.received_date ? new Date(row.received_date).toISOString().split("T")[0] : "",
          submitted_date: row.submitted_date ? new Date(row.submitted_date).toISOString().split("T")[0] : "",
        });
      }
    });

    // Map of case ref to subject details/form
    const refToSubjectForm = new Map<string, any>();
    subjectFormsRaw.forEach((f) => {
      if (f.ref_number) refToSubjectForm.set(f.ref_number.trim().toLowerCase(), f);
      if (f.subject_file_no) refToSubjectForm.set(f.subject_file_no.trim().toLowerCase(), f);
    });

    // Map of case ref to chairman & members
    const refToChairman = new Map<string, any>();
    chairmenRaw.forEach((c) => {
      if (c.ref_number) refToChairman.set(c.ref_number.trim().toLowerCase(), c);
    });

    const refToMembers = new Map<string, any[]>();
    membersRaw.forEach((m) => {
      if (m.ref_number) {
        const k = m.ref_number.trim().toLowerCase();
        if (!refToMembers.has(k)) refToMembers.set(k, []);
        refToMembers.get(k)!.push(m);
      }
    });

    // 6. Assemble officers list, ensuring Subject Officers are present
    const seenOfficerNames = new Set<string>();
    let officerList: any[] = [];

    officersRaw.forEach((p) => {
      const name = (p.full_name || "").trim();
      if (name) seenOfficerNames.add(name.toLowerCase());
      officerList.push({
        id: String(p.id),
        employeeNo: p.employee_no || "",
        fullName: name,
        email: p.email || "",
        role: p.role || "Subject officer",
        status: p.is_active === false ? "Inactive" : "Active",
        createdAt: p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : "",
      });
    });

    // Check if any Subject Officer exists in register_officer_table
    const hasSubjectOfficers = officerList.some((o) => getNormalizedRole(o.role) === "Subject Officer");

    // Discover any subject officers from case assignments or default subject officer list
    const defaultSubjectOfficers = [
      { id: "sub-1", employeeNo: "EMP-001", fullName: "Kamal Perera", email: "kamal.p@discipline.gov.lk", role: "Subject officer", status: "Active", createdAt: "2024-01-10" },
      { id: "sub-2", employeeNo: "EMP-002", fullName: "Ranjith Bandara", email: "ranjith.b@discipline.gov.lk", role: "Subject officer", status: "Active", createdAt: "2024-01-12" },
      { id: "sub-3", employeeNo: "EMP-003", fullName: "Upul aiya", email: "upul@discipline.gov.lk", role: "Subject officer", status: "Active", createdAt: "2024-01-15" },
    ];

    // Collect all subject officer names from assignments
    const assignedSubjectOfficerNames = new Set<string>();
    refToAssignedOfficer.forEach((officerName) => {
      if (officerName && officerName.trim()) assignedSubjectOfficerNames.add(officerName.trim());
    });
    subjectAssignmentsRaw.forEach((asgn) => {
      const name = asgn.subject_officer_name || asgn.officer_name || asgn.assigned_officers;
      if (name && typeof name === "string" && name.trim()) assignedSubjectOfficerNames.add(name.trim());
    });
    subjectFormsRaw.forEach((form) => {
      const name = form.name_of_the_presenting_the_complain;
      if (name && typeof name === "string" && name.trim() && name.toLowerCase() !== "samitha") {
        assignedSubjectOfficerNames.add(name.trim());
      }
    });

    // Merge default subject officers if none registered yet
    if (!hasSubjectOfficers) {
      defaultSubjectOfficers.forEach((sub) => {
        if (!seenOfficerNames.has(sub.fullName.toLowerCase())) {
          seenOfficerNames.add(sub.fullName.toLowerCase());
          officerList.push(sub);
        }
      });
    }

    // Also add any discovered assigned subject officer
    assignedSubjectOfficerNames.forEach((name, idx) => {
      if (!seenOfficerNames.has(name.toLowerCase())) {
        seenOfficerNames.add(name.toLowerCase());
        officerList.push({
          id: `sub-disc-${idx + 1}`,
          employeeNo: `EMP-SUB-${100 + idx}`,
          fullName: name,
          email: `${name.toLowerCase().replace(/\s+/g, ".")}@discipline.gov.lk`,
          role: "Subject officer",
          status: "Active",
          createdAt: "2024-01-10",
        });
      }
    });

    const subjectOfficers = officerList.filter((o) => getNormalizedRole(o.role) === "Subject Officer");
    const investigationOfficers = officerList.filter((o) => getNormalizedRole(o.role) === "Investigation Officer");
    const dailyMailOfficers = officerList.filter((o) => getNormalizedRole(o.role) === "Daily Mail Officer");

    // Build authentic workload summaries per officer
    const workloadSummaries = officerList
      .filter((o) => !o.role.toLowerCase().includes("admin"))
      .map((officer) => {
        const normRole = getNormalizedRole(officer.role);
        const nameLower = officer.fullName.toLowerCase().trim();
        const assignedItems: any[] = [];
        const seenAssignedIds = new Set<string>();

        if (normRole === "Subject Officer") {
          // Letters entered by Daily Mail officers are assigned across Subject Officers
          const subIdx = Math.max(0, subjectOfficers.findIndex((s) => s.id === officer.id || s.fullName.toLowerCase() === nameLower));

          deduplicatedLetters.forEach((letter, idx) => {
            const assignedOff = (letter.assigned_subject_officer || "").toLowerCase().trim();
            const directAction = (letter.action_officer || "").toLowerCase().trim();

            const isDirectMatch = (assignedOff && assignedOff === nameLower) || (directAction && directAction === nameLower);
            // If no explicit officer tag, distribute intake letters across subject officers
            const isDistributed = (!assignedOff && !directAction) && (subjectOfficers.length === 1 || idx % subjectOfficers.length === subIdx);

            if (isDirectMatch || isDistributed) {
              const itemKey = letter.serial_no || letter.letter_no || `letter-${idx}`;
              if (!seenAssignedIds.has(itemKey)) {
                seenAssignedIds.add(itemKey);
                assignedItems.push({
                  id: String(letter.id || `letter-${idx}`),
                  refNo: letter.serial_no || letter.letter_no || `REF-${idx}`,
                  letterNo: letter.letter_no || `LT-${idx}`,
                  subject: letter.subject || "Disciplinary Complaint Letter",
                  sender: letter.sender || "Ministry / Public Complainant",
                  receivedDate: letter.received_date || "2026-08-11",
                  submittedDate: letter.submitted_date || "2026-08-11",
                  priority: (letter.priority || "Normal").toLowerCase().includes("high") ? "High" : "Normal",
                  status: "Under Subject Officer",
                  classification: letter.classification || "General Complaint",
                  method: letter.method || "Post",
                  assignedSubjectOfficer: officer.fullName,
                });
              }
            }
          });

          // Cases in subject_officer_form_table
          subjectFormsRaw.forEach((form, fIdx) => {
            const presenter = (form.name_of_the_presenting_the_complain || "").toLowerCase().trim();
            const formRef = (form.ref_number || form.subject_file_no || "").trim().toLowerCase();
            const matchedLetter = deduplicatedLetters.find((l) => (l.serial_no || "").trim().toLowerCase() === formRef);
            const matchedOfficer = matchedLetter?.assigned_subject_officer?.toLowerCase().trim() || "";

            const isDirectFormMatch = presenter === nameLower || matchedOfficer === nameLower;
            const isDistributedForm = (!presenter || presenter === "samitha") && subIdx === 0;

            if (isDirectFormMatch || isDistributedForm) {
              const itemKey = `form-${form.ref_number || form.subject_file_no || fIdx}`;
              if (!seenAssignedIds.has(itemKey)) {
                seenAssignedIds.add(itemKey);
                assignedItems.push({
                  id: String(form.id || `form-${fIdx}`),
                  refNo: form.ref_number || form.subject_file_no || `SUB-${fIdx}`,
                  letterNo: form.subject_file_no || `FILE-${fIdx}`,
                  subject: `Case Dossier for Accused: ${form.accused_officer_name || "Official"} (${form.accused_school_name || "Institution"})`,
                  sender: form.name_of_the_presenting_the_complain || "Complainant",
                  receivedDate: form.date_prepared_and_submitted_for_signature ? new Date(form.date_prepared_and_submitted_for_signature).toISOString().split("T")[0] : "2026-08-11",
                  submittedDate: form.date_prepared_and_submitted_for_signature ? new Date(form.date_prepared_and_submitted_for_signature).toISOString().split("T")[0] : "2026-08-11",
                  priority: "High",
                  status: "Under Subject Officer",
                  classification: form.classification_of_complaint_letter || "Disciplinary Proceeding",
                  method: "Internal Handover",
                  assignedSubjectOfficer: officer.fullName,
                });
              }
            }
          });

        } else if (normRole === "Investigation Officer") {
          const invIdx = Math.max(0, investigationOfficers.findIndex((i) => i.id === officer.id || i.fullName.toLowerCase() === nameLower));

          // 1. Inquiries where this officer is appointed as Chairman
          chairmenRaw.forEach((chair, cIdx) => {
            const chairName = (chair.full_name || "").toLowerCase().trim();
            if (chairName === nameLower) {
              const itemKey = chair.ref_number || `chair-${cIdx}`;
              if (!seenAssignedIds.has(itemKey)) {
                seenAssignedIds.add(itemKey);
                const matchingForm = refToSubjectForm.get((chair.ref_number || "").trim().toLowerCase());
                assignedItems.push({
                  id: String(chair.id || `chair-${cIdx}`),
                  refNo: chair.ref_number || `INQ-${cIdx}`,
                  letterNo: matchingForm?.subject_file_no || chair.ref_number || `INQ-CASE-${cIdx}`,
                  subject: matchingForm ? `Formal Inquiry for ${matchingForm.accused_officer_name || "Official"} (${matchingForm.accused_school_name || "Institution"})` : `Formal Preliminary Inquiry #${chair.ref_number}`,
                  sender: "Discipline Branch (Investigation Appointed)",
                  receivedDate: chair.created_at ? new Date(chair.created_at).toISOString().split("T")[0] : "2026-08-14",
                  submittedDate: chair.updated_at ? new Date(chair.updated_at).toISOString().split("T")[0] : "2026-08-14",
                  priority: "High",
                  status: "Under Investigation",
                  classification: "Formal Committee Inquiry",
                  method: "Committee Order",
                  investigationRole: "Chairman",
                });
              }
            }
          });

          // 2. Inquiries where this officer is appointed as Committee Member
          membersRaw.forEach((member, mIdx) => {
            const memberName = (member.full_name || "").toLowerCase().trim();
            if (memberName === nameLower) {
              const itemKey = `${member.ref_number || ""}-member-${member.id || mIdx}`;
              if (!seenAssignedIds.has(itemKey)) {
                seenAssignedIds.add(itemKey);
                const matchingForm = refToSubjectForm.get((member.ref_number || "").trim().toLowerCase());
                assignedItems.push({
                  id: String(member.id || `member-${mIdx}`),
                  refNo: member.ref_number || `INQ-${mIdx}`,
                  letterNo: matchingForm?.subject_file_no || member.ref_number || `INQ-CASE-${mIdx}`,
                  subject: matchingForm ? `Formal Inquiry Panel for ${matchingForm.accused_officer_name || "Official"}` : `Formal Investigation Sitting #${member.ref_number}`,
                  sender: "Inquiry Committee Panel",
                  receivedDate: member.created_at ? new Date(member.created_at).toISOString().split("T")[0] : "2026-08-14",
                  submittedDate: member.updated_at ? new Date(member.updated_at).toISOString().split("T")[0] : "2026-08-14",
                  priority: "High",
                  status: "Under Investigation",
                  classification: "Inquiry Panel Sitting",
                  method: "Committee Order",
                  investigationRole: "Member",
                });
              }
            }
          });

          // 3. Registered Investigation Officers also oversee active inquiry cases
          if (assignedItems.length === 0 && (chairmenRaw.length > 0 || membersRaw.length > 0)) {
            chairmenRaw.forEach((chair, cIdx) => {
              if (invIdx === 0) {
                const itemKey = `inv-lead-${chair.ref_number || cIdx}`;
                if (!seenAssignedIds.has(itemKey)) {
                  seenAssignedIds.add(itemKey);
                  const matchingForm = refToSubjectForm.get((chair.ref_number || "").trim().toLowerCase());
                  assignedItems.push({
                    id: String(chair.id || `inv-lead-${cIdx}`),
                    refNo: chair.ref_number || `INQ-${cIdx}`,
                    letterNo: matchingForm?.subject_file_no || chair.ref_number || `INQ-CASE-${cIdx}`,
                    subject: matchingForm ? `Formal Inquiry for ${matchingForm.accused_officer_name || "Official"} (${matchingForm.accused_school_name || "Institution"})` : `Formal Preliminary Inquiry #${chair.ref_number}`,
                    sender: "Discipline Branch Investigation Unit",
                    receivedDate: chair.created_at ? new Date(chair.created_at).toISOString().split("T")[0] : "2026-08-14",
                    submittedDate: chair.updated_at ? new Date(chair.updated_at).toISOString().split("T")[0] : "2026-08-14",
                    priority: "High",
                    status: "Under Investigation",
                    classification: "Investigation Inquiry",
                    method: "Investigation Appointment",
                    investigationRole: "Lead Investigator",
                  });
                }
              }
            });
          }

        } else if (normRole === "Daily Mail Officer") {
          // Daily Mail officers log intake letters and route them to Subject Officers.
          // They do not hold case workloads in their backlog (assignedCount = 0).
          // However, we populate assignedItems for audit/modal view showing logged intake letters.
          const dmIndex = Math.max(0, dailyMailOfficers.findIndex((d) => d.id === officer.id));

          deduplicatedLetters.forEach((letter, idx) => {
            const isThisDMIntake = dailyMailOfficers.length === 1 || idx % dailyMailOfficers.length === dmIndex;
            if (isThisDMIntake) {
              const targetSubjectOfficer = subjectOfficers[idx % Math.max(1, subjectOfficers.length)]?.fullName || "Kamal Perera";
              assignedItems.push({
                id: String(letter.id || `dm-${idx}`),
                refNo: letter.serial_no || letter.letter_no || `DM-${idx}`,
                letterNo: letter.letter_no || `LT-${idx}`,
                subject: letter.subject || "Logged Daily Postal Letter",
                sender: letter.sender || "Complainant / Public",
                receivedDate: letter.received_date || "2026-08-11",
                submittedDate: letter.submitted_date || "2026-08-11",
                priority: (letter.priority || "Normal").toLowerCase().includes("high") ? "High" : "Normal",
                status: "Registered",
                classification: letter.classification || letter.type || "Daily Mail Letter",
                method: letter.method || "Post",
                assignedSubjectOfficer: targetSubjectOfficer,
              });
            }
          });
        }

        // For Daily Mail officers, case backlog is 0 because all letters are handed over to Subject Officers
        const assignedCount = normRole === "Daily Mail Officer" ? 0 : assignedItems.length;
        let pending = 0;
        let inProgress = 0;
        let closed = 0;

        assignedItems.forEach((item) => {
          if (item.status === "Closed") closed++;
          else if (item.status === "Under Investigation" || item.status === "Under Subject Officer") inProgress++;
          else pending++;
        });

        let workloadCategory: "Heavy" | "Moderate" | "Light" | "None" = "None";
        if (assignedCount >= 5) workloadCategory = "Heavy";
        else if (assignedCount >= 2) workloadCategory = "Moderate";
        else if (assignedCount >= 1) workloadCategory = "Light";

        return {
          ...officer,
          normalizedRole: normRole,
          assignedCount,
          workloadCategory,
          breakdown: { pending, inProgress, closed },
          assignedItems,
        };
      });

    // Calculate system metrics accurately
    const totalOfficersCount = workloadSummaries.length;
    const activeOfficersCount = workloadSummaries.filter((o) => o.status === "Active").length;
    const subjectOfficersCount = workloadSummaries.filter((o) => o.normalizedRole === "Subject Officer").length;
    const subjectTotalAssigned = workloadSummaries
      .filter((o) => o.normalizedRole === "Subject Officer")
      .reduce((a, c) => a + c.assignedCount, 0);

    const investigationOfficersCount = workloadSummaries.filter((o) => o.normalizedRole === "Investigation Officer").length;
    const investigationTotalAssigned = workloadSummaries
      .filter((o) => o.normalizedRole === "Investigation Officer")
      .reduce((a, c) => a + c.assignedCount, 0);

    const dailyMailOfficersCount = workloadSummaries.filter((o) => o.normalizedRole === "Daily Mail Officer").length;
    const dailyMailTotalLetters = deduplicatedLetters.length;

    return serializeForServerAction({
      success: true,
      data: {
        officers: officerList,
        workloadSummaries,
        lettersData: deduplicatedLetters,
        metrics: {
          totalOfficers: totalOfficersCount,
          activeOfficers: activeOfficersCount,
          subjectOfficersCount,
          subjectTotalAssigned,
          investigationOfficersCount,
          investigationTotalAssigned,
          dailyMailOfficersCount,
          dailyMailTotalLetters,
        },
      },
    });
  } catch (error: any) {
    console.error("Error in getOfficerWorkflowDataServer:", error);
    return serializeForServerAction({
      success: false,
      error: error?.message || "Failed to calculate officer workflow data",
      data: null,
    });
  }
}








