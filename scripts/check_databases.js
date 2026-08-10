const { PrismaClient } = require('@prisma/client');

async function testDatabases() {
  console.log("--- Checking DCMMS database ---");
  const prismaDcmms = new PrismaClient({
    datasources: { db: { url: "postgresql://postgres:YourPassword123@localhost:5432/DCMMS?schema=public" } }
  });
  try {
    const rowsDcmms = await prismaDcmms.$queryRaw`SELECT count(*) FROM register_officer_table`;
    console.log("DCMMS DB count:", rowsDcmms);
    const rowsList = await prismaDcmms.$queryRaw`SELECT employee_no, full_name, role FROM register_officer_table ORDER BY created_at DESC`;
    console.log("DCMMS DB rows:", rowsList);
  } catch (e) {
    console.error("DCMMS DB Error:", e.message);
  } finally {
    await prismaDcmms.$disconnect();
  }

  console.log("\n--- Checking postgres database ---");
  const prismaPostgres = new PrismaClient({
    datasources: { db: { url: "postgresql://postgres:YourPassword123@localhost:5432/postgres?schema=public" } }
  });
  try {
    const rowsPostgres = await prismaPostgres.$queryRaw`SELECT count(*) FROM register_officer_table`;
    console.log("postgres DB count:", rowsPostgres);
    const rowsListPostgres = await prismaPostgres.$queryRaw`SELECT employee_no, full_name, role FROM register_officer_table ORDER BY created_at DESC`;
    console.log("postgres DB rows:", rowsListPostgres);
  } catch (e) {
    console.error("postgres DB Error:", e.message);
  } finally {
    await prismaPostgres.$disconnect();
  }
}

testDatabases();
