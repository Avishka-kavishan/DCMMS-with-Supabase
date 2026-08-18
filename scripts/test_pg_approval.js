const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testApproval() {
  console.log("Testing updateCaseByDateExtensionApprovalServer logic...");
  const cleanRef = "DMMS/T/02";
  const approvalStatus = "Approved";
  const decDate = new Date();
  const now = new Date();

  // Check if record exists
  const existing = await prisma.$queryRaw`
    SELECT id FROM public.case_by_date_extention
    WHERE LOWER(subject_file_no) = LOWER(${cleanRef})
       OR LOWER(sub_file_no) = LOWER(${cleanRef})
    LIMIT 1;
  `;

  if (existing && existing.length > 0) {
    await prisma.$executeRaw`
      UPDATE public.case_by_date_extention
      SET 
        approval_status = ${approvalStatus},
        decision_date = ${decDate},
        updated_at = ${now}
      WHERE LOWER(subject_file_no) = LOWER(${cleanRef})
         OR LOWER(sub_file_no) = LOWER(${cleanRef});
    `;
  } else {
    await prisma.$executeRaw`
      INSERT INTO public.case_by_date_extention (
        subject_file_no,
        sub_file_no,
        extention_term,
        start_date,
        end_date,
        approval_status,
        decision_date,
        created_at,
        updated_at
      ) VALUES (
        ${cleanRef},
        ${cleanRef},
        'First Extension (1st)',
        '2026-09-14'::date,
        '2026-09-21'::date,
        ${approvalStatus},
        ${decDate},
        ${now},
        ${now}
      );
    `;
  }

  const rows = await prisma.$queryRaw`SELECT * FROM public.case_by_date_extention;`;
  console.log("SUCCESS! Total rows now in case_by_date_extention:", rows.length);
  console.log("Rows:", rows);
}

testApproval().catch(console.error).finally(() => prisma.$disconnect());
