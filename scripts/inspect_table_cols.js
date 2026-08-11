const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw`SELECT institute_name, address, zone, district, province FROM institute_table LIMIT 15`;
  console.log(rows);
  await prisma.$disconnect();
}

main();
