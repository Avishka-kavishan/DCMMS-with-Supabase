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
  console.log("=== Testing PostgreSQL commitee_table position filtering ===");

  // Insert a test Member as well as Chairman
  const memberEmpNo = "EMP-MEMBER-102";
  const memberName = "Saman Kumara";
  const memberEmail = "saman.member@moe.gov.lk";
  const memberNic = "199098765432";

  await prisma.$queryRaw`
    INSERT INTO commitee_table (employee_no, full_name, email, position, nic_no, state)
    VALUES (${memberEmpNo}, ${memberName}, ${memberEmail}, 'Member', ${memberNic}, 'Active')
    ON CONFLICT (employee_no) DO UPDATE SET position = 'Member';
  `;

  // Fetch all
  const allRows = await prisma.$queryRaw`
    SELECT c.id, c.employee_no, c.full_name, c.position, c.nic_no, s.member_school_name as studied_schools
    FROM commitee_table c
    LEFT JOIN school_table s ON c.employee_no = s.employee_no;
  `;
  console.log("\n1. All commitee_table records:", allRows);

  // Fetch Chairmen
  const chairmenRows = await prisma.$queryRaw`
    SELECT c.id, c.employee_no, c.full_name, c.position, c.nic_no
    FROM commitee_table c
    WHERE LOWER(c.position) = 'chairman';
  `;
  console.log("\n2. Filtered Chairmen:", chairmenRows);

  // Fetch Members
  const memberRows = await prisma.$queryRaw`
    SELECT c.id, c.employee_no, c.full_name, c.position, c.nic_no
    FROM commitee_table c
    WHERE LOWER(c.position) = 'member' OR LOWER(c.position) != 'chairman' OR c.position IS NULL;
  `;
  console.log("\n3. Filtered Members:", memberRows);

  await prisma.$disconnect();
}

main().catch(console.error);
