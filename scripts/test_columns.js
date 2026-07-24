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

async function testFields() {
  const fields = ['id', 'full_name', 'nic_no', 'officer_role', 'studied_schools', 'children_schools', 'email', 'role', 'status', 'created_at'];
  
  console.log('--- Testing dcmms_investigation_officers fields ---');
  for (const field of fields) {
    const { error } = await supabase.from('dcmms_investigation_officers').select(field).limit(1);
    console.log(`Field ${field}:`, error ? error.message : 'OK');
  }

  console.log('\n--- Testing dcmms_profiles fields ---');
  for (const field of fields) {
    const { error } = await supabase.from('dcmms_profiles').select(field).limit(1);
    console.log(`Field ${field}:`, error ? error.message : 'OK');
  }
}

testFields();
