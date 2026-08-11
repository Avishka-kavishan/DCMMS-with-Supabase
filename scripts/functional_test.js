const { saveAccusedOfficerServer, saveInstituteServer } = require('../lib/db-actions');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
  console.log("🚀 Running Submit Data test to PostgreSQL tables...");

  const testRefNumber = `TEST/SUBMIT/${Date.now()}`;
  const testPayload = {
    ref_number: testRefNumber,
    accused_officer_name: "Nathasha Test",
    address: "251/1, gkligamuwa, badu",
    position: "Teacher",
    date_of_birth: "2002-10-30",
    nic_no: `20028${Date.now().toString().slice(-7)}`,
    appointment_date: "2026-08-11",
    accused_school_name: "C.W.W. KANNANGARA M.M.V.",
    school_address: "MATUGAMA, Kalutara",
    classification_of_complaint_letter: "nominal",
    name_of_the_presenting_the_complain: "Samitha Test",
    address_of_the_person_presenting_the_complaint: "Colombo 07",
    future_action: "complain submitted test",
  };

  try {
    // 1. Test saveAccusedOfficerServer (saves accused_officer_table, accused_school_table, subject_officer_form_table)
    const result = await saveAccusedOfficerServer(testPayload);
    console.log("✅ saveAccusedOfficerServer result:", result);

    // 2. Test saveInstituteServer (saves institute_table)
    const instResult = await saveInstituteServer({
      name: testPayload.accused_school_name,
      address: testPayload.school_address,
    });
    console.log("✅ saveInstituteServer result:", instResult);

    // 3. Verify record in subject_officer_form_table
    const formRecord = await prisma.$queryRaw`SELECT * FROM subject_officer_form_table WHERE ref_number = ${testRefNumber}`;
    console.log("✅ Verified subject_officer_form_table record:", formRecord);

    // 4. Verify record in accused_officer_table
    if (result.officer_id) {
      const officerRecord = await prisma.$queryRaw`SELECT * FROM accused_officer_table WHERE id = ${result.officer_id}::uuid`;
      console.log("✅ Verified accused_officer_table record:", officerRecord);
    }

    // 5. Verify record in accused_school_table
    if (result.school_id) {
      const schoolRecord = await prisma.$queryRaw`SELECT * FROM accused_school_table WHERE id = ${BigInt(result.school_id)}`;
      console.log("✅ Verified accused_school_table record:", schoolRecord);
    }

    // 6. Cleanup test records
    await prisma.$queryRaw`DELETE FROM subject_officer_form_table WHERE ref_number = ${testRefNumber}`;
    if (result.officer_id) {
      await prisma.$queryRaw`DELETE FROM accused_officer_table WHERE id = ${result.officer_id}::uuid`;
    }
    console.log("✅ Cleaned up test records.");
  } catch (err) {
    console.error("❌ Test failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
