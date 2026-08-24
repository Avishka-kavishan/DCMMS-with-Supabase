const { PrismaClient } = require('@prisma/client');

async function syncBoth() {
  const dcmmsUrl = "postgresql://postgres:YourPassword123@localhost:5432/DCMMS?schema=public";
  const postgresUrl = "postgresql://postgres:YourPassword123@localhost:5432/postgres?schema=public";

  try {
    const prismaDcmms = new PrismaClient({ datasources: { db: { url: dcmmsUrl } } });
    await prismaDcmms.$executeRawUnsafe(`
      ALTER TABLE register_officer_table 
      ADD COLUMN IF NOT EXISTS subject_type VARCHAR(255);
    `);
    console.log("Updated DCMMS DB successfully");
    await prismaDcmms.$disconnect();
  } catch (e) {
    console.log("DCMMS DB note:", e.message);
  }

  try {
    const prismaPostgres = new PrismaClient({ datasources: { db: { url: postgresUrl } } });
    await prismaPostgres.$executeRawUnsafe(`
      ALTER TABLE register_officer_table 
      ADD COLUMN IF NOT EXISTS subject_type VARCHAR(255);
    `);
    console.log("Updated postgres DB successfully");
    await prismaPostgres.$disconnect();
  } catch (e) {
    console.log("postgres DB note:", e.message);
  }
}

syncBoth();
