const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testNewRoles() {
  console.log("=== Testing 4 New Roles in PostgreSQL / Prisma ===");

  const rolesToTest = [
    {
      employee_no: "SEC-TEST-001",
      full_name: "Bandula Gunawardena",
      email: "asst.sec.discipline.test@dcmms.gov.lk",
      role: "Assistant Secretary Discipline Branch",
      password: "password123",
      is_active: true
    },
    {
      employee_no: "SEC-TEST-002",
      full_name: "Ranjith Siyambalapitiya",
      email: "asst.sec.investigation.test@dcmms.gov.lk",
      role: "Assistant Secretary Investigation Branch",
      password: "password123",
      is_active: true
    },
    {
      employee_no: "SEC-TEST-003",
      full_name: "Dharshana Senanayake",
      email: "senior.asst.sec.test@dcmms.gov.lk",
      role: "Senior Assistant Secretary",
      password: "password123",
      is_active: true
    },
    {
      employee_no: "SEC-TEST-004",
      full_name: "Nihal Ranasinghe",
      email: "add.sec.test@dcmms.gov.lk",
      role: "Additional Secretary",
      password: "password123",
      is_active: true
    }
  ];

  for (const roleData of rolesToTest) {
    console.log(`\nInserting/Updating role: "${roleData.role}" for ${roleData.full_name}...`);
    await prisma.$executeRaw`
      INSERT INTO register_officer_table (employee_no, full_name, email, role, password, is_active, updated_at)
      VALUES (${roleData.employee_no}, ${roleData.full_name}, ${roleData.email}, ${roleData.role}, ${roleData.password}, ${roleData.is_active}, NOW())
      ON CONFLICT (employee_no) DO UPDATE
      SET full_name = EXCLUDED.full_name,
          email = EXCLUDED.email,
          role = EXCLUDED.role,
          password = EXCLUDED.password,
          is_active = EXCLUDED.is_active,
          updated_at = NOW();
    `;
    console.log(`✓ Successfully provisioned: ${roleData.role}`);
  }

  console.log("\n=== Verifying querying by role from register_officer_table ===");
  const allRows = await prisma.$queryRaw`
    SELECT employee_no, full_name, email, role, is_active, created_at 
    FROM register_officer_table 
    WHERE role ILIKE '%Secretary%'
    ORDER BY created_at DESC;
  `;
  console.log(`Found ${allRows.length} Secretary accounts:`);
  console.table(allRows);

  await prisma.$disconnect();
}

testNewRoles().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
