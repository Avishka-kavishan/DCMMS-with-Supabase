const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    UPDATE public.daily_mail_letter_table 
    SET created_by_name = addressed_to, created_by_role = addressed_role 
    WHERE created_by_name IS NULL AND addressed_to IS NOT NULL
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE public.dcmms_daily_mail 
    SET created_by_name = addressed_to, created_by_role = addressed_role 
    WHERE created_by_name IS NULL AND addressed_to IS NOT NULL
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE public.daily_mail_letter_table 
    SET created_by_name = action_officer 
    WHERE created_by_name IS NULL AND action_officer IS NOT NULL AND action_officer NOT LIKE '%Daily Mail%'
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE public.dcmms_daily_mail 
    SET created_by_name = action_officer 
    WHERE created_by_name IS NULL AND action_officer IS NOT NULL AND action_officer NOT LIKE '%Daily Mail%'
  `);
  console.log('✓ Successfully synced created_by_name & created_by_role in existing rows.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
