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

async function checkData() {
  console.log('=== dcmms_daily_mail (top 10) ===');
  const { data: mails } = await supabase.from('dcmms_daily_mail').select('ref_no, received_date, letter_date, created_at').limit(10);
  console.log(mails);

  console.log('\n=== dcmms_subject (top 10) ===');
  const { data: subjects } = await supabase.from('dcmms_subject').select('case_no, assigned_date, created_at').limit(10);
  console.log(subjects);

  console.log('\n=== dcmms_subject_assignments (top 10) ===');
  const { data: asgns } = await supabase.from('dcmms_subject_assignments').select('*').limit(10);
  console.log(asgns);
}

checkData();
