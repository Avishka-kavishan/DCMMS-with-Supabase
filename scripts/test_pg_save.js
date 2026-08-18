const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testInsert() {
  console.log("Testing direct Prisma insert into case_by_date_extention...");

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

  const now = new Date();
  const cleanRef = "INQ/2026/001";

  await prisma.$executeRaw`
    INSERT INTO public.case_by_date_extention (
      subject_file_no,
      sub_file_no,
      extention_term,
      start_date,
      end_date,
      approval_status,
      created_at,
      updated_at
    ) VALUES (
      ${cleanRef},
      ${cleanRef},
      'First Extension (1st)',
      '2026-09-14'::date,
      '2026-09-21'::date,
      'Pending',
      ${now},
      ${now}
    );
  `;

  const rows = await prisma.$queryRaw`SELECT * FROM public.case_by_date_extention;`;
  console.log("SUCCESS! Rows count in case_by_date_extention:", rows.length);
  console.log("Rows:", rows);
}

testInsert().catch(console.error).finally(() => prisma.$disconnect());
