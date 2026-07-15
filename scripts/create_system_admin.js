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

async function run() {
  const email = 'sysadmin@moe.gov.lk';
  const password = 'sysadmin123456';
  const fullName = 'System Administrator';

  console.log(`Creating System Administrator account (${email})...`);
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'system_admin'
        }
      }
    });

    if (error) {
      console.log('Auth signup returned status:', error.message);
      console.log('Attempting profile table insertion fallback...');
    } else {
      console.log('Auth user created successfully! UUID:', data.user?.id);
    }

    const userId = data.user?.id || 'sys-admin-manual-id';

    const { error: profileError } = await supabase.from('dcmms_profiles').upsert({
      id: userId,
      full_name: fullName,
      role: 'system_admin'
    });

    if (profileError) {
      console.error('Failed to create/update dcmms_profiles row:', profileError.message);
    } else {
      console.log('Profile database row created/updated successfully!');
    }

    console.log('\n--- Accounts Credentials ---');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log('----------------------------');

  } catch (err) {
    console.error('Error during System Admin creation:', err.message || err);
  }
}

run();
