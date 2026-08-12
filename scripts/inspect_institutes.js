const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const total = await prisma.$queryRaw`SELECT count(*) FROM institute_table`;
    console.log("Total institute_table rows:", total);

    const matches = await prisma.$queryRaw`
      SELECT * FROM institute_table 
      WHERE institute_name ILIKE '%kannangara%' OR institute_name ILIKE '%matugama%'
      LIMIT 10
    `;
    console.log("Matching institutes in institute_table:", matches);

    const first5 = await prisma.$queryRaw`SELECT * FROM institute_table LIMIT 5`;
    console.log("First 5 institutes:", first5);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
