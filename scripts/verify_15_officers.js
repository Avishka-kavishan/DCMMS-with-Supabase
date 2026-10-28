const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const officers = await prisma.$queryRawUnsafe(
    "SELECT employee_no, full_name, email, role, subject_type, is_active FROM register_officer_table WHERE role ILIKE '%subject%' ORDER BY employee_no ASC"
  );
  console.log(`Found ${officers.length} Subject Officers in database:`);
  console.table(officers.map(o => ({
    "Staff ID / Username": o.employee_no,
    "Email": o.email,
    "Subject Type": o.subject_type,
    "Status": o.is_active ? "Active" : "Inactive"
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
