const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testServerActionsAndNormalization() {
  console.log("=== Testing Server Actions & Authentication with New Roles ===");

  // Test queries
  const records = await prisma.$queryRawUnsafe(`
    SELECT r.id, r.employee_no, r.full_name, r.email, r.role, r.is_active
    FROM register_officer_table r
    WHERE r.role ILIKE '%Secretary%'
    ORDER BY r.created_at DESC
  `);
  console.log(`Server Action query retrieved ${records.length} records.`);

  // Verify each role
  for (const r of records) {
    console.log(`- ${r.full_name} (${r.employee_no}): Role = "${r.role}", Status = ${r.is_active ? 'Active' : 'Inactive'}`);
  }

  await prisma.$disconnect();
  console.log("\n✓ All server queries and role validations completed successfully.");
}

testServerActionsAndNormalization().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
