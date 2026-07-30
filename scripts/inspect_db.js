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

if (!url || !key) {
  console.error('Supabase credentials missing in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

async function inspect() {
  console.log("=== dcmms_daily_mail ===");
  const { data: mail } = await supabase.from('dcmms_daily_mail').select('*');
  console.log(JSON.stringify(mail, null, 2));

  console.log("=== dcmms_subject ===");
  const { data: subject } = await supabase.from('dcmms_subject').select('*');
  console.log(JSON.stringify(subject, null, 2));

  console.log("=== dcmms_subject_assignments ===");
  const { data: asgn } = await supabase.from('dcmms_subject_assignments').select('*');
  console.log(JSON.stringify(asgn, null, 2));

  console.log("=== dcmms_subject_details ===");
  const { data: det } = await supabase.from('dcmms_subject_details').select('*');
  console.log(JSON.stringify(det, null, 2));
}

inspect().catch(console.error);
