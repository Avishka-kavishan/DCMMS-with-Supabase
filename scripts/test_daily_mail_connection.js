const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const envLocalPath = path.join(__dirname, '..', '.env.local');

[envPath, envLocalPath].forEach(p => {
  if (fs.existsSync(p)) {
    const raw = fs.readFileSync(p, 'utf8');
    raw.split(/\r?\n/).forEach(line => {
      const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
      if (m) {
        let v = m[2];
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    });
  }
});

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testConnection() {
  console.log("=== Testing daily_mail database connection ===");
  const testLetterNo = `TEST-LT-${Date.now()}`;
  const testRefNo = `DCMMS/TEST/${Date.now()}`;

  // 1. Insert letter into daily_mail table
  const insertCount = await prisma.$executeRawUnsafe(
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
      $1, $2, $3, $4, $5, $6, $7,
      $8::date, $9::date,
      $10
    )
    ON CONFLICT (letter_number) DO UPDATE SET
      received_letter_number = EXCLUDED.received_letter_number,
      mode_of_receipt = EXCLUDED.mode_of_receipt,
      sender_party = EXCLUDED.sender_party,
      nature_of_letter = EXCLUDED.nature_of_letter,
      subject_category = EXCLUDED.subject_category,
      subject_of_letter = EXCLUDED.subject_of_letter,
      date_received_by_additional_secretary = EXCLUDED.date_received_by_additional_secretary,
      date_letter_handed_over_to_dicipline_branch = EXCLUDED.date_letter_handed_over_to_dicipline_branch,
      priority = EXCLUDED.priority,
      updated_at = CURRENT_TIMESTAMP`,
    testLetterNo,
    testRefNo,
    'Post',
    'Ministry of Education Tester',
    'Complaint',
    'Public Service Commission',
    'Automated Test for Daily Mail Connection',
    '2026-08-10',
    '2026-08-10',
    'High'
  );

  console.log("Insert affected count:", insertCount);

  // 2. Fetch records from daily_mail table
  const records = await prisma.$queryRaw`
    SELECT 
      daily_mail_id::text as id,
      letter_number,
      received_letter_number,
      mode_of_receipt,
      sender_party,
      nature_of_letter,
      subject_category,
      subject_of_letter,
      date_received_by_additional_secretary,
      date_letter_handed_over_to_dicipline_branch,
      priority,
      created_at
    FROM daily_mail
    WHERE letter_number = ${testLetterNo}
  `;

  console.log("Fetched record:", records);

  if (records && records.length > 0) {
    console.log("✅ Verified record in daily_mail table:", records[0]);
    // Cleanup test row
    await prisma.$executeRaw`DELETE FROM daily_mail WHERE letter_number = ${testLetterNo}`;
  } else {
    console.error("❌ Record not found in fetch output!");
    process.exit(1);
  }
}

testConnection()
  .then(() => {
    console.log("=== TEST PASSED CLEANLY ===");
    process.exit(0);
  })
  .catch(err => {
    console.error("❌ Test error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
