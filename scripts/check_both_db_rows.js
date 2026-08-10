const { PrismaClient } = require('@prisma/client');

async function compareDatabases() {
  const dcmmsUrl = "postgresql://postgres:YourPassword123@localhost:5432/DCMMS?schema=public";
  const postgresUrl = "postgresql://postgres:YourPassword123@localhost:5432/postgres?schema=public";

  const prismaDcmms = new PrismaClient({ datasources: { db: { url: dcmmsUrl } } });
  const prismaPostgres = new PrismaClient({ datasources: { db: { url: postgresUrl } } });

  console.log("=== ROWS IN 'DCMMS' DATABASE ===");
  try {
    const dcmmsRows = await prismaDcmms.$queryRaw`SELECT employee_no, full_name, email, role FROM register_officer_table ORDER BY created_at ASC`;
    console.log("Count:", dcmmsRows.length);
    console.log(dcmmsRows);
  } catch (e) {
    console.error("DCMMS Error:", e.message);
  }

  console.log("\n=== ROWS IN 'postgres' DATABASE ===");
  try {
    const postgresRows = await prismaPostgres.$queryRaw`SELECT employee_no, full_name, email, role FROM register_officer_table ORDER BY created_at ASC`;
    console.log("Count:", postgresRows.length);
    console.log(postgresRows);
  } catch (e) {
    console.error("postgres Error:", e.message);
  }

  await prismaDcmms.$disconnect();
  await prismaPostgres.$disconnect();
}

compareDatabases();
