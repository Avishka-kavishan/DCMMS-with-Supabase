const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addColumns() {
  console.log("Adding columns to daily_mail_letter_table and dcmms_daily_mail...");
  const queries = [
    `ALTER TABLE public.daily_mail_letter_table ADD COLUMN IF NOT EXISTS addressed_to VARCHAR(255)`,
    `ALTER TABLE public.daily_mail_letter_table ADD COLUMN IF NOT EXISTS addressed_role VARCHAR(255)`,
    `ALTER TABLE public.daily_mail_letter_table ADD COLUMN IF NOT EXISTS forwarded_to VARCHAR(255)`,
    `ALTER TABLE public.daily_mail_letter_table ADD COLUMN IF NOT EXISTS forward_reason TEXT`,
    `ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS addressed_to VARCHAR(255)`,
    `ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS addressed_role VARCHAR(255)`,
    `ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS forwarded_to VARCHAR(255)`,
    `ALTER TABLE public.dcmms_daily_mail ADD COLUMN IF NOT EXISTS forward_reason TEXT`
  ];

  for (const q of queries) {
    try {
      await prisma.$executeRawUnsafe(q);
      console.log(`✓ Executed: ${q}`);
    } catch (e) {
      console.error(`Error executing "${q}":`, e.message);
    }
  }
}

addColumns()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
