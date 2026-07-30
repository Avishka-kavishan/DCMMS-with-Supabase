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

async function sync() {
  console.log("Updating DMMS/T/02 subject officer name in dcmms_subject_assignments and dcmms_subject...");
  
  const { error: err1 } = await supabase
    .from("dcmms_subject_assignments")
    .update({ subject_officer_name: "Kavishan" })
    .eq("case_no", "DMMS/T/02");
    
  if (err1) console.error("Err 1:", err1);
  else console.log("✓ Updated dcmms_subject_assignments for DMMS/T/02");

  const { error: err2 } = await supabase
    .from("dcmms_subject")
    .update({ subject_officer_name: "Kavishan" })
    .eq("case_no", "DMMS/T/02");

  if (err2) console.error("Err 2:", err2);
  else console.log("✓ Updated dcmms_subject for DMMS/T/02");
}

sync().catch(console.error);
