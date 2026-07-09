const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
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
  try {
    // 1. Sign in Subject Officer
    console.log('Signing in Subject Officer...');
    const { data: subData, error: subError } = await supabase.auth.signInWithPassword({
      email: 'avishkakavishan13@gmail.com',
      password: 'rath123456'
    });
    if (subError) throw subError;
    console.log('Subject Officer UUID:', subData.user.id);

    // Upsert profile
    const { error: subProfError } = await supabase.from('dcmms_profiles').upsert({
      id: subData.user.id,
      full_name: 'Rathnaweera',
      role: 'subject_officer',
      email: 'avishkakavishan13@gmail.com',
      status: 'Active'
    });
    if (subProfError) throw subProfError;
    console.log('Subject Officer profile created/updated!');

    // Sign out
    await supabase.auth.signOut();

    // 2. Sign in Daily Mail Officer
    console.log('Signing in Daily Mail Officer...');
    const { data: dmData, error: dmError } = await supabase.auth.signInWithPassword({
      email: 'avishakavishan3@gmail.com',
      password: 'kavi123456'
    });
    if (dmError) throw dmError;
    console.log('Daily Mail Officer UUID:', dmData.user.id);

    // Upsert profile
    const { error: dmProfError } = await supabase.from('dcmms_profiles').upsert({
      id: dmData.user.id,
      full_name: 'Avishka',
      role: 'daily_mail',
      email: 'avishakavishan3@gmail.com',
      status: 'Active'
    });
    if (dmProfError) throw dmProfError;
    console.log('Daily Mail Officer profile created/updated!');

    console.log('All profiles registered successfully!');
  } catch (err) {
    console.error('Error:', err.message || err);
  }
}

run();
