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

async function testSupabaseOfficerTables() {
  console.log('--- Testing dcmms_investigation_officers ---');
  const { data: invData, error: invError } = await supabase.from('dcmms_investigation_officers').select('*');
  console.log('dcmms_investigation_officers error:', invError);
  console.log('dcmms_investigation_officers row count:', invData ? invData.length : 0);

  console.log('--- Testing dcmms_profiles ---');
  const { data: profData, error: profError } = await supabase.from('dcmms_profiles').select('*').eq('role', 'investigation_officer');
  console.log('dcmms_profiles error:', profError);
  console.log('dcmms_profiles investigation officers count:', profData ? profData.length : 0);
}

testSupabaseOfficerTables();
