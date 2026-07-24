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

async function checkMapping() {
  const { data: mails } = await supabase.from('dcmms_daily_mail').select('*');
  const { data: subjects } = await supabase.from('dcmms_subject').select('*');

  console.log('--- Daily Mails vs Subjects ---');
  subjects.forEach(s => {
    const m = mails.find(m => m.ref_no === s.case_no);
    console.log({
      case_no: s.case_no,
      subject_assigned_date: s.assigned_date,
      mail_received_date: m?.received_date,
      mail_letter_date: m?.letter_date,
      mail_created_at: m?.created_at
    });
  });
}

checkMapping();
