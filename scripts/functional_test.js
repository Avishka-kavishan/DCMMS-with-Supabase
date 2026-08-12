const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
  console.log("🚀 Running Submit Data test to PostgreSQL tables...");

  const testRefNumber = `TEST/SUBMIT/${Date.now()}`;
  const nic1 = `20028${Date.now().toString().slice(-7)}`;

  try {
    // 1. Insert accused school
    const schoolRes = await prisma.$queryRaw`
      INSERT INTO accused_school_table (accused_school_name, address)
      VALUES ('C.W.W. KANNANGARA M.M.V.', 'MATUGAMA, Kalutara')
      RETURNING id;
    `;
    const schoolId = schoolRes[0].id;

    // 2. Insert accused officer
    const officerRes = await prisma.$queryRaw`
      INSERT INTO accused_officer_table (accused_officer_name, address, position, date_of_birth, nic_no, accused_school_id)
      VALUES ('Nathasha Test', '251/1, gkligamuwa, badu', 'Teacher', '2002-10-30'::date, ${nic1}, ${schoolId}::bigint)
      RETURNING id;
    `;
    const officerId = officerRes[0].id;

    // 3. Insert subject officer form
    const formRes = await prisma.$queryRaw`
      INSERT INTO subject_officer_form_table (ref_number, accused_officer_id, classification_of_complaint_letter, future_action)
      VALUES (${testRefNumber}, ${officerId}::uuid, 'nominal', 'complain submitted test')
      RETURNING id;
    `;
    const formId = formRes[0].id;

    // 4. Link in junction table
    await prisma.$executeRaw`
      INSERT INTO accused_officer_subject_officer_form_table (accused_officer_id, subject_officer_form_id)
      VALUES (${officerId}::uuid, ${formId}::bigint);
    `;

    // 5. Verify records
    const formRecord = await prisma.$queryRaw`SELECT * FROM subject_officer_form_table WHERE ref_number = ${testRefNumber}`;
    console.log("✅ Verified subject_officer_form_table record:", formRecord);

    const jRecord = await prisma.$queryRaw`SELECT * FROM accused_officer_subject_officer_form_table WHERE subject_officer_form_id = ${formId}::bigint`;
    console.log("✅ Verified accused_officer_subject_officer_form_table junction record:", jRecord);

    // Cleanup
    await prisma.$queryRaw`DELETE FROM subject_officer_form_table WHERE ref_number = ${testRefNumber}`;
    await prisma.$queryRaw`DELETE FROM accused_officer_table WHERE id = ${officerId}::uuid`;
    await prisma.$queryRaw`DELETE FROM accused_school_table WHERE id = ${schoolId}::bigint`;
    console.log("✅ Cleaned up test records.");
  } catch (err) {
    console.error("❌ Test failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
