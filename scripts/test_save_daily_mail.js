const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSave() {
  try {
    const testMail = {
      serial_no: `TEST-REF-${Date.now()}`,
      letter_no: `LT-${Date.now()}`,
      received_date: new Date(),
      submitted_date: new Date(),
      subject: "Test complaint subject officer link",
      sender: "John Doe",
      method: "Post",
      type: "Complaint",
      classification: "Anonymous/Nominal",
      action_officer: "Kamal Perera",
      status: "registered",
    };

    const res = await prisma.dcmmsDailyMail.create({
      data: {
        serial_no: testMail.serial_no,
        received_date: testMail.received_date,
        letter_no: testMail.letter_no,
        submitted_date: testMail.submitted_date,
        subject: testMail.subject,
        sender: testMail.sender,
        method: testMail.method,
        type: testMail.type,
        classification: testMail.classification,
        action_officer: testMail.action_officer,
        status: testMail.status,
      },
    });

    console.log("Successfully inserted into dcmms_daily_mail in PostgreSQL:", res);

    const rawRes = await prisma.$executeRawUnsafe(
      `INSERT INTO daily_mail (
        letter_number,
        received_letter_number,
        mode_of_receipt,
        sender_party,
        nature_of_letter,
        subject_category,
        subject_of_letter,
        date_received_by_additional_secretary,
        date_letter_handed_over_to_dicipline_branch,
        priority
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8::date, $9::date, $10
      )
      ON CONFLICT (letter_number) DO UPDATE SET
        received_letter_number = EXCLUDED.received_letter_number,
        subject_of_letter = EXCLUDED.subject_of_letter,
        updated_at = CURRENT_TIMESTAMP`,
      testMail.letter_no,
      testMail.serial_no,
      testMail.method,
      testMail.sender,
      testMail.type,
      testMail.classification,
      testMail.subject,
      new Date().toISOString().split("T")[0],
      new Date().toISOString().split("T")[0],
      "Normal"
    );

    console.log("Successfully inserted into daily_mail in PostgreSQL:", rawRes);

  } catch (err) {
    console.error("Test save error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

testSave();
