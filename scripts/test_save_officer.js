const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const employeeNo = '200399100888';
    const fullName = 'Test Daily Mail Officer';
    const email = 'testdailymail@dcmms.gov.lk';
    const role = 'Daily mail officer';
    const isActive = true;
    const password = '123456';

    console.log("Inserting test officer...");
    const inserted = await prisma.$queryRaw`
      INSERT INTO register_officer_table (employee_no, full_name, email, password, role, is_active)
      VALUES (${employeeNo}, ${fullName}, ${email}, ${password}, ${role}, ${isActive})
      ON CONFLICT (email) DO UPDATE SET
        employee_no = EXCLUDED.employee_no,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
      RETURNING *;
    `;
    console.log("INSERT RESULT:", inserted);
  } catch (err) {
    console.error("Insert Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
