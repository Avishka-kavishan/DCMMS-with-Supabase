const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const accused = await prisma.$queryRaw`SELECT * FROM accused_officer_table`;
    console.log("Accused officers:", accused);

    const schools = await prisma.$queryRaw`SELECT * FROM accused_school_table`;
    console.log("Accused schools:", schools);

    const forms = await prisma.$queryRaw`SELECT * FROM subject_officer_form_table`;
    console.log("Subject officer forms:", forms);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
