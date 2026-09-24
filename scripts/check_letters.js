const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p1 = await prisma.$queryRawUnsafe(`
    SELECT id::text, letter_number, senders_party, action_officer, addressed_to, addressed_role, forwarded_to, forward_reason, created_by_name, created_by_role 
    FROM public.daily_mail_letter_table 
    ORDER BY created_at DESC LIMIT 10
  `);
  console.log('--- daily_mail_letter_table ---');
  console.log(JSON.stringify(p1, null, 2));

  const p2 = await prisma.$queryRawUnsafe(`
    SELECT id::text, letter_no, sender, action_officer, addressed_to, addressed_role, forwarded_to, forward_reason, created_by_name, created_by_role 
    FROM public.dcmms_daily_mail 
    ORDER BY created_at DESC LIMIT 10
  `);
  console.log('--- dcmms_daily_mail ---');
  console.log(JSON.stringify(p2, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
