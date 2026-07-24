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

async function checkNewSort() {
  const { data: directCases } = await supabase.from('dcmms_subject').select('*');
  const { data: letters } = await supabase.from('dcmms_daily_mail').select('*');

  const refToLetterDate = new Map();
  const refToReceivedDate = new Map();
  const refToCreatedAt = new Map();

  if (letters) {
    letters.forEach(l => {
      if (l.ref_no) {
        refToReceivedDate.set(l.ref_no, l.received_date);
        if (l.letter_date) refToLetterDate.set(l.ref_no, l.letter_date);
        if (l.created_at) refToCreatedAt.set(l.ref_no, l.created_at);
      }
    });
  }

  const mapped = directCases.map(item => {
    const lDate = refToLetterDate.get(item.case_no) || item.letter_date || refToReceivedDate.get(item.case_no) || item.assigned_date;
    const rDate = refToReceivedDate.get(item.case_no) || item.assigned_date;
    const cTime = item.created_at || refToCreatedAt.get(item.case_no) || new Date().toISOString();
    return {
      id: item.id,
      caseNo: item.case_no,
      assignedDate: item.assigned_date,
      receivedDate: rDate,
      letterDate: lDate,
      createdAt: cTime,
      status: item.status
    };
  });

  console.log('=== New Sort: Newest Created/Registered Case First at Top ===');
  mapped.sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    if (timeA !== timeB) {
      return timeB - timeA;
    }
    const dateA = new Date(a.letterDate || a.receivedDate || 0).getTime();
    const dateB = new Date(b.letterDate || b.receivedDate || 0).getTime();
    return dateB - dateA;
  });

  mapped.forEach((c, idx) => console.log(`${idx+1}. ${c.caseNo.padEnd(25)} | letterDate: ${c.letterDate} | created: ${c.createdAt}`));
}

checkNewSort();
