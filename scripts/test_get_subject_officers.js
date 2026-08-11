const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const regOfficers = await prisma.$queryRaw`
      SELECT full_name, role, is_active FROM register_officer_table 
      WHERE role ILIKE '%subject%' AND (is_active IS NULL OR is_active = true)
      ORDER BY full_name ASC;
    `;
    console.log("Subject Officers from register_officer_table:", regOfficers);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
