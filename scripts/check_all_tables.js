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

const tables = [
  'dcmms_profiles',
  'dcmms_daily_mail',
  'dcmms_subject',
  'dcmms_subject_details',
  'dcmms_subject_assignments',
  'dcmms_subsequent_mails',
  'dcmms_investigation',
  'dcmms_institutes',
  'dcmms_calendar',
  'dcmms_sessions',
  'dcmms_audit_logs'
];

async function checkTables() {
  console.log('=== Checking DMMS Database Tables in Supabase ===\n');
  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error(`❌ Table [${table}]: ERROR - ${error.message} (code: ${error.code})`);
      } else {
        console.log(`✅ Table [${table}]: EXISTS (${count ?? 0} rows)`);
      }
    } catch (err) {
      console.error(`❌ Table [${table}]: EXCEPTION - ${err.message}`);
    }
  }
}

checkTables();
