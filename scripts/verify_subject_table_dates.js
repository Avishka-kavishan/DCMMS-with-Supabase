const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
    if (m) {
      let v = m[2];
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  });
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testFetchCasesMapping() {
  const { data: letters } = await supabase.from('dcmms_daily_mail').select('ref_no, received_date, letter_date, officer_name, subject, priority');
  const { data: directCases } = await supabase.from('dcmms_subject').select('*');

  const refToReceivedDate = new Map();
  const refToLetterDate = new Map();

  if (letters) {
    letters.forEach(l => {
      if (l.ref_no) {
        refToReceivedDate.set(l.ref_no, l.received_date);
        if (l.letter_date) refToLetterDate.set(l.ref_no, l.letter_date);
      }
    });
  }

  console.log('=== Simulated Subject Officer Dashboard Date Rows ===');
  directCases.forEach(c => {
    const letterDate = refToLetterDate.get(c.case_no) || c.letter_date || refToReceivedDate.get(c.case_no) || c.assigned_date;
    const receivedDate = refToReceivedDate.get(c.case_no) || c.assigned_date;
    console.log(`Case: ${c.case_no.padEnd(22)} | Displayed (letterDate): ${letterDate} | (prev receivedDate was: ${receivedDate})`);
  });
}

testFetchCasesMapping();
