"use server";

import { prisma } from "@/lib/prisma";

export async function checkDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { connected: true };
  } catch (error: any) {
    return { connected: false, error: error?.message || "Database connection failed" };
  }
}

// -------------------------------------------------------------
// 1. Daily Mail & Letters Operations
// -------------------------------------------------------------
export async function getDailyMailRecordsServer() {
  try {
    const records = await prisma.dcmmsDailyMail.findMany({
      orderBy: { created_at: "desc" },
    });
    return { success: true, data: records };
  } catch (error: any) {
    console.error("Error fetching daily mail records:", error);
    return { success: false, error: error.message, data: [] };
  }
}

export async function saveDailyMailRecordServer(mailData: any) {
  try {
    let result;
    const actionOfficer = mailData.action_officer || mailData.officer_name || mailData.officerName || null;
    if (mailData.id) {
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
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Error saving daily mail record:", error);
    return { success: false, error: error.message };
  }
}

export async function saveDailyMailToNewTableServer(data: {
  letter_number: string;
  received_letter_number?: string;
  mode_of_receipt: string;
  sender_party?: string;
  nature_of_letter?: string;
  subject_category?: string;
  subject_of_letter: string;
  date_received_by_additional_secretary?: string;
  date_letter_handed_over_to_dicipline_branch?: string;
  subject_officer_id?: number | null;
  priority?: string;
}) {
  try {
    const pInput = (data.priority || 'Normal').trim();
    let validPriority = 'Normal';
    if (pInput.toLowerCase().includes('high') || pInput.toLowerCase().includes('urgent')) validPriority = 'High';
    else if (pInput.toLowerCase().includes('low')) validPriority = 'Low';
    else if (pInput.toLowerCase().includes('urgent')) validPriority = 'Urgent';
    else if (['Low', 'Normal', 'High', 'Urgent'].includes(pInput)) validPriority = pInput;

    const result = await prisma.$executeRawUnsafe(
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
      data.letter_number,
      data.received_letter_number || null,
      data.mode_of_receipt || 'Post',
      data.sender_party || null,
      data.nature_of_letter || null,
      data.subject_category || null,
      data.subject_of_letter,
      data.date_received_by_additional_secretary || null,
      data.date_letter_handed_over_to_dicipline_branch || null,
      data.subject_officer_id ? Number(data.subject_officer_id) : null,
      validPriority
    );
    return { success: true, count: result };
  } catch (error: any) {
    console.error("Error inserting into daily_mail table:", error);
    return { success: false, error: error.message };
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
    return { success: true, data: cases };
  } catch (error: any) {
    console.error("Error fetching cases:", error);
    return { success: false, error: error.message, data: [] };
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
    return { success: true, data: newCase };
  } catch (error: any) {
    console.error("Error creating case:", error);
    return { success: false, error: error.message };
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
    return { success: true, data: person };
  } catch (error: any) {
    console.error("Error upserting person:", error);
    return { success: false, error: error.message };
  }
}

// -------------------------------------------------------------
// 3. Investigation & Officer Operations
// -------------------------------------------------------------
export async function getSubjectOfficersServer() {
  try {
    const namesSet = new Set<string>();

    // 1. From dcmms_profiles table
    try {
      const profiles = await prisma.dcmmsProfile.findMany({
        where: {
          role: { contains: "subject", mode: "insensitive" },
        },
        select: { full_name: true },
      });
      profiles.forEach((p: any) => {
        if (p.full_name) namesSet.add(p.full_name);
      });
    } catch (e) {}

    // 2. From users table with role Subject Officer
    try {
      const users = await prisma.user.findMany({
        select: { full_name: true },
      });
      users.forEach((u: any) => {
        if (u.full_name) namesSet.add(u.full_name);
      });
    } catch (e) {}

    // 3. From persons table
    try {
      const persons = await prisma.person.findMany({
        select: { full_name: true },
      });
      persons.forEach((p: any) => {
        if (p.full_name) namesSet.add(p.full_name);
      });
    } catch (e) {}

    return { success: true, data: Array.from(namesSet) };
  } catch (error: any) {
    console.error("Error fetching subject officers from database:", error);
    return { success: false, error: error.message, data: [] };
  }
}

export async function getInvestigationOfficersServer() {
  try {
    const officers = await prisma.investigationOfficer.findMany({
      where: { is_active: true },
    });
    return { success: true, data: officers };
  } catch (error: any) {
    return { success: false, error: error.message, data: [] };
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

    return { success: true, data: officer };
  } catch (error: any) {
    console.error("Error upserting officer:", error);
    return { success: false, error: error.message };
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
    return { success: true, data: list };
  } catch (error: any) {
    return { success: false, error: error.message, data: [] };
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

    return { success: true, data: { invRecord, provInv } };
  } catch (error: any) {
    console.error("Error saving provincial investigation:", error);
    return { success: false, error: error.message };
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
    return { success: true, data: assignment };
  } catch (error: any) {
    console.error("Error assigning officer:", error);
    return { success: false, error: error.message };
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

    return { success: true };
  } catch (error: any) {
    console.error("Failed to log audit event to PostgreSQL:", error);
    return { success: false, error: error.message };
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
    return { success: true, data: session };
  } catch (error: any) {
    console.error("Failed to record session in PostgreSQL:", error);
    return { success: false, error: error.message };
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
    return { success: true, data: records };
  } catch (error: any) {
    console.error("Error fetching register officer records:", error);
    return { success: false, error: error.message, data: [] };
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
        return { success: true, data: updated[0] };
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

    // Dual-server sync to Port 5433 if pgAdmin is connected to Port 5433
    try {
      const altUrl5433 = (process.env.DATABASE_URL || "postgresql://postgres:YourPassword123@localhost:5432/DCMMS?schema=public").replace(":5432", ":5433");
      const altPrisma5433 = new (require("@prisma/client").PrismaClient)({ datasources: { db: { url: altUrl5433 } } });
      await altPrisma5433.$queryRaw`
        INSERT INTO register_officer_table (employee_no, full_name, email, password, role, is_active)
        VALUES (${employeeNo}, ${fullName}, ${email}, ${password}, ${officerData.role}, ${isActive})
        ON CONFLICT (email) DO UPDATE SET
          employee_no = EXCLUDED.employee_no,
          full_name = EXCLUDED.full_name,
          role = EXCLUDED.role,
          is_active = EXCLUDED.is_active,
          updated_at = NOW();
      `;
      await altPrisma5433.$disconnect();
    } catch (e) {
      // Secondary port sync warning (ignored if 5433 not running)
    }

    // Secondary sync to 'postgres' database if main is 'DCMMS' (to ensure pgAdmin shows it regardless of DB selected)
    try {
      if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes("/DCMMS")) {
        const altUrl = process.env.DATABASE_URL.replace("/DCMMS", "/postgres");
        const altPrisma = new (require("@prisma/client").PrismaClient)({ datasources: { db: { url: altUrl } } });
        await altPrisma.$queryRaw`
          INSERT INTO register_officer_table (employee_no, full_name, email, password, role, is_active)
          VALUES (${employeeNo}, ${fullName}, ${email}, ${password}, ${officerData.role}, ${isActive})
          ON CONFLICT (email) DO UPDATE SET
            employee_no = EXCLUDED.employee_no,
            full_name = EXCLUDED.full_name,
            role = EXCLUDED.role,
            is_active = EXCLUDED.is_active,
            updated_at = NOW();
        `;
        await altPrisma.$disconnect();
      }
    } catch (e) {
      // Secondary DB sync warning (ignored if second DB does not exist)
    }

    return { success: true, data: resultRecord };
  } catch (error: any) {
    console.error("Error saving register officer:", error);
    return { success: false, error: error.message || "Failed to save officer to database" };
  }
}

export async function deleteRegisterOfficerServer(id: string) {
  try {
    await prisma.$queryRaw`DELETE FROM register_officer_table WHERE id = ${id}::uuid`;
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting register officer:", error);
    return { success: false, error: error.message };
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
    return { success: true, data: updated[0] };
  } catch (error: any) {
    console.error("Error toggling officer status:", error);
    return { success: false, error: error.message };
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
      return { success: false, error: "Invalid email/employee number or password." };
    }

    const officer = records[0];

    if (officer.is_active === false) {
      return { success: false, error: "Your account is deactivated. Please contact an administrator." };
    }

    if (officer.password && officer.password !== passwordInput) {
      return { success: false, error: "Invalid email/employee number or password." };
    }

    return {
      success: true,
      data: {
        id: officer.id,
        employee_no: officer.employee_no,
        full_name: officer.full_name,
        email: officer.email,
        role: officer.role,
      },
    };
  } catch (error: any) {
    console.error("Login officer server error:", error);
    return { success: false, error: error.message || "Authentication failed" };
  }
}


