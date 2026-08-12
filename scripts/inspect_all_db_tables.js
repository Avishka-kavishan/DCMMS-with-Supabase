const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: "postgresql://postgres:YourPassword123@localhost:5433/DCMMS?schema=public" } }
});

async function main() {
  const constraints = await prisma.$queryRaw`
    SELECT conname, contype, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public' AND conrelid::regclass::text IN ('commitee_table', 'school_table');
  `;
  console.log("Constraints:", constraints);
  await prisma.$disconnect();
}

main().catch(console.error);
