const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testLogin(input, password) {
  const inputClean = input.toLowerCase().replace(/[^a-z0-9]/g, "");
  const records = await prisma.$queryRaw`
    SELECT id, employee_no, full_name, email, password, role, is_active 
    FROM register_officer_table 
    WHERE LOWER(email) = ${input.toLowerCase()} 
       OR LOWER(employee_no) = ${input.toLowerCase()}
       OR employee_no = ${input}
       OR regexp_replace(LOWER(employee_no), '[^a-z0-9]', '', 'g') = ${inputClean}
    LIMIT 1;
  `;
  if (records.length > 0 && records[0].password === password) {
    console.log(`[PASS] Input '${input}' logged in successfully as: ${records[0].full_name} (${records[0].role})`);
  } else {
    console.log(`[FAIL] Input '${input}' failed to log in.`);
  }
}

async function run() {
  await testLogin("so01", "123456");
  await testLogin("SO-01", "123456");
  await testLogin("so01@dcmms.gov.lk", "123456");
  await testLogin("so15", "123456");
  await testLogin("SO-15", "123456");
}

run().catch(console.error).finally(() => prisma.$disconnect());
