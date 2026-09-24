const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.$queryRawUnsafe(`
    SELECT employee_no, full_name, email, role FROM register_officer_table WHERE role ILIKE '%Secretary%'
  `);
  console.log('Secretaries in DB:');
  console.log(JSON.stringify(users, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
