const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function testFlow() {
  console.log("--- Starting Accused Officer Database Connection Test ---");

  const testRef = "TEST-REF-ACCUSED-" + Date.now();
  const nameTrimmed = "Kavishan Perera";
  const nicTrimmed = "881350999V";
  const schoolNameTrimmed = "Kandy National School";

  try {
    // 1. Insert/Update accused_school_table
    console.log("1. Testing insertion into accused_school_table...");
    const schoolRes = await prisma.$queryRaw`
      INSERT INTO accused_school_table (accused_school_name, address, province, district, zone)
      VALUES (${schoolNameTrimmed}, 'Kandy Road', 'Central', 'Kandy', 'Kandy')
      RETURNING id;
    `;
    const schoolId = schoolRes[0].id;
    console.log("Inserted school ID:", schoolId);

    // 2. Insert into accused_officer_table
    console.log("2. Testing insertion into accused_officer_table...");
    const officerRes = await prisma.$queryRaw`
      INSERT INTO accused_officer_table (
        accused_officer_name, address, position, date_of_birth, nic_no, appointment_date, accused_school_id
      )
      VALUES (
        ${nameTrimmed}, '123 Kandy Road', 'Teacher', '1990-01-01'::date, ${nicTrimmed}, '2015-06-01'::date, ${schoolId}::bigint
      )
      RETURNING id;
    `;
    const officerId = officerRes[0].id;
    console.log("Inserted accused officer ID:", officerId);

    // 3. Insert into subject_officer_form_table
    console.log("3. Testing insertion into subject_officer_form_table...");
    await prisma.$queryRaw`
      INSERT INTO subject_officer_form_table (
        ref_number, accused_officer_id, classification_of_complaint_letter,
        name_of_the_presenting_the_complain, address_of_the_person_presenting_the_complaint
      )
      VALUES (
        ${testRef}, ${officerId}::uuid, 'nominal', 'Complainant Name', 'Complainant Address'
      );
    `;

    // 4. Query joined tables
    console.log("4. Querying subject_officer_form_table JOIN accused_officer_table JOIN accused_school_table...");
    const records = await prisma.$queryRaw`
      SELECT 
        sof.ref_number,
        sof.classification_of_complaint_letter,
        ao.accused_officer_name,
        ao.position,
        ao.nic_no,
        sch.accused_school_name
      FROM subject_officer_form_table sof
      JOIN accused_officer_table ao ON sof.accused_officer_id = ao.id
      JOIN accused_school_table sch ON ao.accused_school_id = sch.id
      WHERE sof.ref_number = ${testRef};
    `;

    console.log("Retrieved record:", records[0]);

    if (records && records.length > 0 && records[0].accused_officer_name === nameTrimmed) {
      console.log("✅ SUCCESS: Accused Officer Details form is fully connected with accused_officer_table, accused_school_table, and subject_officer_form_table!");
    } else {
      console.error("❌ FAILURE: Retried records did not match inserted values.");
    }

    // Cleanup
    await prisma.$executeRaw`DELETE FROM subject_officer_form_table WHERE ref_number = ${testRef}`;
    await prisma.$executeRaw`DELETE FROM accused_officer_table WHERE id = ${officerId}::uuid`;
    await prisma.$executeRaw`DELETE FROM accused_school_table WHERE id = ${schoolId}::bigint`;
    console.log("Cleaned up test data.");
  } catch (err) {
    console.error("Test failed with error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

testFlow();
