const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf8');
  raw.split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
    if (m) {
      let v = m[2];
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  });
}

const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(url, key);

async function testAssignmentPipeline() {
  console.log("=== Testing DMMS Temporary Data Assignment Pipeline ===");
  const testRefNo = "TEST/2026/DEMO-99";
  const now = new Date().toISOString().split("T")[0];

  // 1. Seed into dcmms_daily_mail (Daily Mail Officer -> Subject Officers)
  console.log("\n1. Inserting into dcmms_daily_mail...");
  const officersToSeed = ["Rathnaweera", "Imasha", "Pasindu"];

  for (const officer of officersToSeed) {
    const { error: err1 } = await supabase.from("dcmms_daily_mail").upsert({
      id: `mail-demo-${testRefNo}-${officer}`,
      ref_no: testRefNo,
      letter_no: "LTR-999",
      sender_name: "Ministry of Education",
      sender_address: "Colombo 07",
      letter_date: now,
      received_date: now,
      subject: "Temporary Test Disciplinary Case for Subject Officers",
      priority: "high",
      status: "assigned",
      officer_name: officer,
      letter_type: "Strictly Confidential"
    });

    if (err1) console.error(`Error inserting dcmms_daily_mail for ${officer}:`, err1.message);
    else console.log(`✓ Successfully inserted into dcmms_daily_mail for '${officer}'`);
  }

  // 2. Seed into dcmms_subject (Subject Officer Case Record)
  console.log("\n2. Upserting into dcmms_subject...");
  const { error: err2 } = await supabase.from("dcmms_subject").upsert({
    id: `case-${testRefNo}`,
    case_no: testRefNo,
    subject: "Temporary Test Disciplinary Case for Subject Officers",
    status: "Officers Assigned",
    assigned_date: now,
    priority: "high"
  });

  if (err2) console.error("Error upserting dcmms_subject:", err2.message);
  else console.log("✓ Successfully upserted into dcmms_subject");

  // 3. VERIFY QUERY RETRIEVAL FOR ASSIGNED OFFICERS
  console.log("\n=== VERIFYING RETRIEVAL FOR ASSIGNED OFFICERS ===");
  const testOfficers = ["Rathnaweera", "Imasha", "Pasindu"];

  for (const officer of testOfficers) {
    const cleanName = officer.toLowerCase();

    // Fetch letters from dcmms_daily_mail
    const { data: letters } = await supabase
      .from("dcmms_daily_mail")
      .select("ref_no, received_date, officer_name, subject, priority");

    const matchedRefNos = new Set();
    if (letters) {
      letters.forEach(l => {
        const mailOfficer = (l.officer_name || "").trim().toLowerCase();
        if (l.ref_no && (mailOfficer === cleanName || mailOfficer.includes(cleanName) || cleanName.includes(mailOfficer))) {
          matchedRefNos.add(l.ref_no);
        }
      });
    }

    const assignedRefNos = Array.from(matchedRefNos);
    if (assignedRefNos.length > 0) {
      const { data: casesData } = await supabase
        .from("dcmms_subject")
        .select("*")
        .in("case_no", assignedRefNos);

      console.log(`Officer '${officer}': Successfully retrieved ${casesData ? casesData.length : 0} assigned case(s) from Supabase:`, (casesData || []).map(c => c.case_no));
    } else {
      console.log(`Officer '${officer}': Found 0 assigned cases.`);
    }
  }

  console.log("\n✓ Temporary Data Verification Complete!");
}

testAssignmentPipeline();
