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

async function inspectTable() {
  console.log("=== Inspecting dcmms_subject schema ===");
  const { data, error } = await supabase.from("dcmms_subject").select("*").limit(1);
  if (error) {
    console.error("Error fetching dcmms_subject:", error.message);
  } else if (data && data.length > 0) {
    console.log("Columns in dcmms_subject:", Object.keys(data[0]));
    console.log("Sample row:", data[0]);
  } else {
    console.log("dcmms_subject table is empty.");
  }
}

inspectTable();
