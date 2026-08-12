const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const envFiles = ['.env.local', '.env'];
for (const envFile of envFiles) {
  const envPath = path.join(__dirname, '..', envFile);
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
      const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
      if (m) {
        let v = m[2];
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        if (!process.env[m[1]]) process.env[m[1]] = v;
      }
    });
  }
}

const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:YourPassword123@localhost:5433/DCMMS?schema=public";
const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } }
});

async function main() {
  console.log("=== Testing PostgreSQL commitee_table & school_table raw connection ===");

  const empNo = "EMP-TEST-101";
  const fullName = "Ranjith Bandara";
  const email = "ranjith.test@moe.gov.lk";
  const position = "Chairman";
  const nicNo = "198512345678";
  const state = "Active";
  const studiedStr = "Ananda College, Royal College";
  const childrenStr = "Visakha Vidyalaya";

  // 1. Upsert into commitee_table
  const existing = await prisma.$queryRaw`SELECT id FROM commitee_table WHERE employee_no = ${empNo} OR nic_no = ${nicNo} LIMIT 1;`;
  if (existing && existing.length > 0) {
    await prisma.$queryRaw`
      UPDATE commitee_table
      SET full_name = ${fullName}, email = ${email}, position = ${position}, nic_no = ${nicNo}, state = ${state}, updated_at = NOW()
      WHERE id = ${existing[0].id}::uuid;
    `;
    console.log("Updated commitee_table record");
  } else {
    await prisma.$queryRaw`
      INSERT INTO commitee_table (employee_no, full_name, email, position, nic_no, state)
      VALUES (${empNo}, ${fullName}, ${email}, ${position}, ${nicNo}, ${state});
    `;
    console.log("Inserted commitee_table record");
  }

  // 2. Upsert into school_table
  const existingSchool = await prisma.$queryRaw`SELECT id FROM school_table WHERE employee_no = ${empNo} LIMIT 1;`;
  if (existingSchool && existingSchool.length > 0) {
    await prisma.$queryRaw`
      UPDATE school_table
      SET member_school_name = ${studiedStr}, member_children_schools_name = ${childrenStr}, updated_at = NOW()
      WHERE id = ${existingSchool[0].id}::uuid;
    `;
    console.log("Updated school_table record");
  } else {
    await prisma.$queryRaw`
      INSERT INTO school_table (employee_no, member_school_name, member_children_schools_name)
      VALUES (${empNo}, ${studiedStr}, ${childrenStr});
    `;
    console.log("Inserted school_table record");
  }

  // 3. Query combined data
  const joined = await prisma.$queryRaw`
    SELECT 
      c.id, c.employee_no, c.full_name, c.email, c.position, c.nic_no, c.state,
      s.member_school_name as studied_schools, s.member_children_schools_name as children_schools
    FROM commitee_table c
    LEFT JOIN school_table s ON c.employee_no = s.employee_no
    WHERE c.employee_no = ${empNo};
  `;
  console.log("\n=== Joined commitee_table and school_table Output ===");
  console.log(joined);

  await prisma.$disconnect();
}

main().catch(console.error);
