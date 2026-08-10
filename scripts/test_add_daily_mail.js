const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAddDailyMailOfficer() {
  try {
    const employeeNo = '200399100999';
    const fullName = 'Saman Jayasinghe';
    const email = 'saman.dailymail@dcmms.gov.lk';
    const role = 'Daily mail officer';
    const isActive = true;
    const password = '123456';

    console.log("Upserting Daily Mail Officer...");
    const existing = await prisma.$queryRaw`
      SELECT id FROM register_officer_table WHERE email = ${email} OR employee_no = ${employeeNo} LIMIT 1
    `;

    let res;
    if (existing && existing.length > 0) {
      res = await prisma.$queryRaw`
        UPDATE register_officer_table
        SET employee_no = ${employeeNo}, full_name = ${fullName}, email = ${email}, role = ${role}, is_active = ${isActive}, updated_at = NOW()
        WHERE id = ${existing[0].id}::uuid RETURNING *
      `;
    } else {
      res = await prisma.$queryRaw`
        INSERT INTO register_officer_table (employee_no, full_name, email, password, role, is_active)
        VALUES (${employeeNo}, ${fullName}, ${email}, ${password}, ${role}, ${isActive}) RETURNING *
      `;
    }

    console.log("SAVED RECORD:", res[0]);

    const dailyMailList = await prisma.$queryRaw`
      SELECT * FROM register_officer_table WHERE role ILIKE '%daily%mail%' ORDER BY created_at DESC
    `;
    console.log("ALL DAILY MAIL OFFICERS IN DB:", dailyMailList);
  } catch (err) {
    console.error("Test Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

testAddDailyMailOfficer();
