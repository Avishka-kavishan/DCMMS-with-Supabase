const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function testAccusedOfficerFields() {
  console.log("=== Testing Accused Officer Table Fields Link to Case ===");

  const testRefNumber = "TEST/REF/" + Date.now();
  console.log(`Using test reference number: ${testRefNumber}`);

  const testData = {
    accused_officer_name: "K.A. Sunil Perera",
    position: "Senior Principal (Grade 1)",
    accused_school_name: "Royal College Colombo",
    address: "No. 45, Galle Road, Colombo 03",
    nic_no: "197813509823",
  };

  try {
    // 1. Insert into accused_school_table
    console.log("1. Inserting accused school into accused_school_table...");
    const schoolRes = await prisma.$queryRaw`
      INSERT INTO accused_school_table (accused_school_name, address, province, district, zone)
      VALUES (${testData.accused_school_name}, 'Royal College Road, Colombo', 'Western Province', 'Colombo', 'Colombo 03')
      RETURNING id;
    `;
    const schoolId = schoolRes[0].id;
    console.log("   Accused School ID:", schoolId);

    // 2. Insert into accused_officer_table with accused_school_id reference
    console.log("2. Inserting accused officer into accused_officer_table...");
    const officerRes = await prisma.$queryRaw`
      INSERT INTO accused_officer_table (accused_officer_name, position, address, nic_no, accused_school_id)
      VALUES (${testData.accused_officer_name}, ${testData.position}, ${testData.address}, ${testData.nic_no}, ${schoolId}::bigint)
      RETURNING id;
    `;
    const officerId = officerRes[0].id;
    console.log("   Accused Officer ID:", officerId);

    // 3. Create case record in subject_officer_form_table
    console.log("3. Creating case in subject_officer_form_table...");
    const formRes = await prisma.$queryRaw`
      INSERT INTO subject_officer_form_table (ref_number, subject_file_no, classification_of_complaint_letter, accused_officer_id)
      VALUES (${testRefNumber}, ${testRefNumber}, 'Nominal', ${officerId}::uuid)
      RETURNING id;
    `;
    const formId = formRes[0].id;
    console.log("   Form ID:", formId);

    // 4. Link in junction table accused_officer_subject_officer_form_table
    console.log("4. Linking in junction table accused_officer_subject_officer_form_table...");
    await prisma.$queryRaw`
      INSERT INTO accused_officer_subject_officer_form_table (accused_officer_id, subject_officer_form_id)
      VALUES (${officerId}::uuid, ${formId}::bigint)
      ON CONFLICT DO NOTHING;
    `;

    // 5. Query joined case data to verify fields
    console.log("\n5. Querying case with joined accused officer & school details...");
    const joined = await prisma.$queryRaw`
      SELECT 
        sof.ref_number,
        ao.accused_officer_name,
        ao.position,
        ao.address as officer_address,
        sch.accused_school_name
      FROM subject_officer_form_table sof
      JOIN accused_officer_subject_officer_form_table j ON j.subject_officer_form_id = sof.id
      JOIN accused_officer_table ao ON j.accused_officer_id = ao.id
      LEFT JOIN accused_school_table sch ON ao.accused_school_id = sch.id
      WHERE sof.ref_number = ${testRefNumber};
    `;

    console.log("Query Output:", JSON.stringify(joined, null, 2));

    const rec = joined[0];
    console.log("\n6. Verifying required fields:");
    console.log("   - accused_officer_name: ", rec.accused_officer_name);
    console.log("   - position:             ", rec.position);
    console.log("   - accused_school_name:  ", rec.accused_school_name);
    console.log("   - address:              ", rec.officer_address);

    if (
      rec.accused_officer_name === testData.accused_officer_name &&
      rec.position === testData.position &&
      rec.accused_school_name === testData.accused_school_name &&
      rec.officer_address === testData.address
    ) {
      console.log("\n✅ VERIFICATION SUCCESSFUL: accused_officer_name, position, accused_school_name, and address are correctly linked to the case!");
    } else {
      console.error("\n❌ Field verification failed!");
      process.exit(1);
    }

    // Cleanup
    await prisma.$queryRaw`DELETE FROM accused_officer_subject_officer_form_table WHERE subject_officer_form_id = ${formId}::bigint`;
    await prisma.$queryRaw`DELETE FROM subject_officer_form_table WHERE id = ${formId}::bigint`;
    await prisma.$queryRaw`DELETE FROM accused_officer_table WHERE id = ${officerId}::uuid`;
    await prisma.$queryRaw`DELETE FROM accused_school_table WHERE id = ${schoolId}::bigint`;
    console.log("Cleanup completed.");

  } catch (err) {
    console.error("Error during test execution:", err);
    process.exit(1);
  }
}

testAccusedOfficerFields()
  .finally(() => {
    prisma.$disconnect();
  });
