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

async function testAuthInsert() {
  console.log('Signing in simulated admin...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'sysadmin@moe.gov.lk',
    password: 'sysadmin123456'
  });

  if (authError) {
    console.log('Sign in error:', authError.message);
    return;
  }

  console.log('Signed in as:', authData.user.email);

  const invPayload = {
    id: `inv-${Date.now()}`,
    full_name: 'Nimali Jayasinghe',
    nic_no: '198754321012',
    officer_role: 'Member',
    studied_schools: ['Sirimavo Bandaranaike Vidyalaya'],
    children_schools: ['Royal College'],
    email: 'nimali@moe.gov.lk',
    status: 'Active'
  };

  const res = await supabase.from('dcmms_investigation_officers').upsert(invPayload);
  console.log('Authenticated dcmms_investigation_officers insert result:', res);
}

testAuthInsert();
