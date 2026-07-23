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

async function inspectRows() {
  console.log("=== Inspecting region_province in existing rows of dcmms_daily_mail ===");
  const { data, error } = await supabase
    .from('dcmms_daily_mail')
    .select('id, ref_no, region_province')
    .limit(50);

  if (error) {
    console.error("Error querying rows:", error.message);
  } else {
    console.log(`Fetched ${data.length} rows.`);
    const valuesSet = new Set(data.map(r => r.region_province));
    console.log("Unique region_province values in existing rows:", Array.from(valuesSet));
  }
}

inspectRows();
