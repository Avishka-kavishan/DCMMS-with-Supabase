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

async function testInsert() {
  const sampleOfficer = {
    id: `inv-test-${Date.now()}`,
    full_name: 'Sampath Perera',
    nic_no: '198212345678',
    officer_role: 'Chairman',
    studied_schools: ['Royal College Colombo'],
    children_schools: ['Visakha Vidyalaya'],
    email: 'sampath.perera@moe.gov.lk',
    role: 'investigation_officer',
    status: 'Active',
    created_at: new Date().toISOString().slice(0, 10)
  };

  console.log('Inserting into dcmms_investigation_officers...');
  const res1 = await supabase.from('dcmms_investigation_officers').upsert(sampleOfficer);
  console.log('dcmms_investigation_officers insert result:', res1);

  console.log('Inserting into dcmms_profiles...');
  const res2 = await supabase.from('dcmms_profiles').upsert(sampleOfficer);
  console.log('dcmms_profiles insert result:', res2);
}

testInsert();
