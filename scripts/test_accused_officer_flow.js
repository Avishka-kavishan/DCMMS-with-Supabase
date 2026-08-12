const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function parseSafeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

async function testFlow() {
  console.log("--- Starting Accused Officer Many-to-Many M:N Relationship Test ---");

  const testRef1 = "TEST-REF-MN-1-" + Date.now();
  const testRef2 = "TEST-REF-MN-2-" + Date.now();

  try {
    // 1. Insert 2 Accused Officers into accused_officer_table
    console.log("1. Inserting 2 Accused Officers...");
    const off1 = await prisma.$queryRaw`
      INSERT INTO accused_officer_table (accused_officer_name, address, position, date_of_birth, nic_no)
      VALUES ('Kamal Perera', '123 Kandy Road', 'Teacher', '1985-05-12'::date, ${'851350001V'})
      RETURNING id;
    `;
    const officerId1 = off1[0].id;

    const off2 = await prisma.$queryRaw`
      INSERT INTO accused_officer_table (accused_officer_name, address, position, date_of_birth, nic_no)
      VALUES ('Nimal Silva', '456 Colombo Road', 'Principal', '1980-01-20'::date, ${'801350002V'})
      RETURNING id;
    `;
    const officerId2 = off2[0].id;

    console.log(`Inserted Officers: ${officerId1}, ${officerId2}`);

    // 2. Insert 2 Subject Officer Forms
    console.log("2. Inserting 2 Subject Officer Forms...");
    const form1 = await prisma.$queryRaw`
      INSERT INTO subject_officer_form_table (ref_number, accused_officer_id, classification_of_complaint_letter)
      VALUES (${testRef1}, ${officerId1}::uuid, 'nominal')
      RETURNING id;
    `;
    const formId1 = form1[0].id;

    const form2 = await prisma.$queryRaw`
      INSERT INTO subject_officer_form_table (ref_number, accused_officer_id, classification_of_complaint_letter)
      VALUES (${testRef2}, ${officerId1}::uuid, 'nominal')
      RETURNING id;
    `;
    const formId2 = form2[0].id;

    console.log(`Inserted Forms: ${formId1}, ${formId2}`);

    // 3. Assign Officer 1 & Officer 2 to Form 1 (Many officers assigned to Form 1)
    //    And Officer 1 assigned to Form 2 (Officer 1 assigned to Many forms)
    console.log("3. Assigning Officers to Forms in accused_officer_subject_officer_form_table...");
    await prisma.$executeRaw`
      INSERT INTO accused_officer_subject_officer_form_table (accused_officer_id, subject_officer_form_id)
      VALUES 
        (${officerId1}::uuid, ${formId1}::bigint),
        (${officerId2}::uuid, ${formId1}::bigint),
        (${officerId1}::uuid, ${formId2}::bigint);
    `;

    // 4. Query assigned officers for Form 1
    console.log("4. Querying assigned officers for Form 1...");
    const form1Officers = await prisma.$queryRaw`
      SELECT ao.accused_officer_name, ao.position, ao.nic_no 
      FROM accused_officer_subject_officer_form_table j
      JOIN accused_officer_table ao ON j.accused_officer_id = ao.id
      WHERE j.subject_officer_form_id = ${formId1}::bigint;
    `;
    console.log("Form 1 Officers:", form1Officers);

    // 5. Query assigned forms for Officer 1
    console.log("5. Querying assigned forms for Officer 1 (Kamal Perera)...");
    const officer1Forms = await prisma.$queryRaw`
      SELECT sof.ref_number, sof.classification_of_complaint_letter 
      FROM accused_officer_subject_officer_form_table j
      JOIN subject_officer_form_table sof ON j.subject_officer_form_id = sof.id
      WHERE j.accused_officer_id = ${officerId1}::uuid;
    `;
    console.log("Officer 1 Forms:", officer1Forms);

    if (form1Officers.length === 2 && officer1Forms.length === 2) {
      console.log("✅ SUCCESS: Many-to-Many M:N relationship verified! (1 form has many officers & 1 officer has many forms)");
    } else {
      console.error("❌ FAILURE: Many-to-Many queries did not return expected row counts.");
    }

    // Cleanup
    await prisma.$executeRaw`DELETE FROM subject_officer_form_table WHERE id IN (${formId1}::bigint, ${formId2}::bigint)`;
    await prisma.$executeRaw`DELETE FROM accused_officer_table WHERE id IN (${officerId1}::uuid, ${officerId2}::uuid)`;
    console.log("Cleaned up test records.");
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

testFlow();
