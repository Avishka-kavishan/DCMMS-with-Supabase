const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    console.log("Testing querying institute_table...");
    const rows = await prisma.$queryRaw`SELECT count(*) FROM institute_table`;
    console.log("Current total rows in institute_table:", rows);

    console.log("Testing inserting dummy institute...");
    const testInstName = `Test Institute ${Date.now()}`;
    const inserted = await prisma.$queryRaw`
      INSERT INTO institute_table (institute_name, address, province, district, zone)
      VALUES (${testInstName}, '123 Test St', 'Western', 'Colombo', 'Colombo')
      RETURNING *;
    `;
    console.log("Inserted row:", inserted);

    const testId = inserted[0].id;
    console.log("Testing updating institute...");
    const updated = await prisma.$queryRaw`
      UPDATE institute_table
      SET institute_name = ${testInstName + ' Updated'}
      WHERE id = ${testId}
      RETURNING *;
    `;
    console.log("Updated row:", updated);

    console.log("Testing cleanup/deletion...");
    await prisma.$queryRaw`DELETE FROM institute_table WHERE id = ${testId}`;
    console.log("Deleted test row successfully.");
  } catch (err) {
    console.error("Error during test:", err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
