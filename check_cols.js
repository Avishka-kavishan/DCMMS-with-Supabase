const path = require('path');
const { PrismaClient } = require(path.join(__dirname, 'node_modules', '@prisma/client'));
const prisma = new PrismaClient();

async function main() {
  const p1 = await prisma.$queryRaw`SELECT DISTINCT priority FROM daily_mail_letter_table`;
  const p2 = await prisma.$queryRaw`SELECT DISTINCT priority FROM dcmms_daily_mail`;
  const p3 = await prisma.$queryRaw`SELECT DISTINCT priority FROM dcmms_subject`;
  console.log('daily_mail_letter_table:', p1);
  console.log('dcmms_daily_mail:', p2);
  console.log('dcmms_subject:', p3);
}

main().catch(console.error).finally(() => prisma.$disconnect());
