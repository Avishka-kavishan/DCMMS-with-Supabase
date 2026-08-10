const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addKusalMendis() {
  try {
    const employeeNo = '200399100444';
    const fullName = 'Kusal Mendis';
    const email = 'kusal.mendis@dcmms.gov.lk';
    const role = 'Daily mail officer';
    const isActive = true;

    await prisma.$executeRawUnsafe(`
      INSERT INTO register_officer_table (employee_no, full_name, email, password, role, is_active)
      VALUES ($1, $2, $3, '123456', $4, $5)
      ON CONFLICT (email) DO UPDATE SET
        employee_no = EXCLUDED.employee_no,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        is_active = EXCLUDED.is_active,
        updated_at = NOW();
    `, employeeNo, fullName, email, role, isActive);

    console.log("Kusal Mendis added and committed successfully!");

    const rows = await prisma.$queryRaw`SELECT employee_no, full_name, email, role FROM register_officer_table ORDER BY created_at ASC`;
    console.log(`TOTAL COMMITTED OFFICERS IN DB (${rows.length}):`);
    console.table(rows);
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

addKusalMendis();
