const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const records = await prisma.$queryRaw`SELECT id, employee_no, full_name, email, role, is_active, created_at FROM register_officer_table ORDER BY created_at ASC`;
    console.log("TOTAL ROWS IN register_officer_table:", records.length);
    console.log(JSON.stringify(records, null, 2));
  } catch (err) {
    console.error("Query Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
