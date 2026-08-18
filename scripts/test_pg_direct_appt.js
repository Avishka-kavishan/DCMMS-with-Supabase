const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Creating case_by_appointment_and_report_due_date table and ensuring columns...");
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

  const cleanRef = "INQ/2026/001";
  const apptDate = new Date("2026-08-14");
  const dueDate = new Date("2026-09-21");
  const now = new Date();

  console.log("Upserting record for", cleanRef);
  const existing = await prisma.$queryRaw`
    SELECT id FROM public.case_by_appointment_and_report_due_date
    WHERE LOWER(subject_file_no) = LOWER(${cleanRef})
       OR LOWER(sub_file_no) = LOWER(${cleanRef})
    LIMIT 1;
  `;

  if (existing && existing.length > 0) {
    await prisma.$executeRaw`
      UPDATE public.case_by_appointment_and_report_due_date
      SET 
        appointment_letter_date = ${apptDate},
        report_due_date = ${dueDate},
        dates_submitted_by_subject = ${true},
        updated_at = ${now}
      WHERE LOWER(subject_file_no) = LOWER(${cleanRef})
         OR LOWER(sub_file_no) = LOWER(${cleanRef});
    `;
  } else {
    await prisma.$executeRaw`
      INSERT INTO public.case_by_appointment_and_report_due_date (
        subject_file_no,
        sub_file_no,
        appointment_letter_date,
        report_due_date,
        dates_submitted_by_subject,
        created_at,
        updated_at
      ) VALUES (
        ${cleanRef},
        ${cleanRef},
        ${apptDate},
        ${dueDate},
        ${true},
        ${now},
        ${now}
      );
    `;
  }

  const rows = await prisma.$queryRaw`
    SELECT id::text, subject_file_no, sub_file_no, appointment_letter_date, report_due_date, dates_submitted_by_subject FROM public.case_by_appointment_and_report_due_date
    WHERE LOWER(subject_file_no) = LOWER(${cleanRef});
  `;

  console.log("SUCCESS! Fetched records from PostgreSQL:", rows);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
