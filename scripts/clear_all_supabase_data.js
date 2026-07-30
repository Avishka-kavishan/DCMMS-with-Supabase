const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
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

// Order tables from child tables to parent tables to respect foreign keys
const tablesToClear = [
  { name: 'dcmms_subsequent_mails', pk: 'id' },
  { name: 'dcmms_subject_details', pk: 'id' },
  { name: 'dcmms_subject_assignments', pk: 'id' },
  { name: 'dcmms_subject', pk: 'id' },
  { name: 'dcmms_daily_mail', pk: 'id' },
  { name: 'dcmms_investigation', pk: 'id' },
  { name: 'dcmms_calendar', pk: 'id' },
  { name: 'dcmms_sessions', pk: 'id' },
  { name: 'dcmms_audit_logs', pk: 'id' },
  { name: 'dcmms_profiles', pk: 'id' },
  { name: 'dcmms_institutes', pk: 'id' }
];

async function clearAllTables() {
  console.log('=== Clearing All Data from DMMS Database Tables in Supabase ===\n');

  for (const table of tablesToClear) {
    try {
      // Delete rows matching created_at or pk
      let res = await supabase
        .from(table.name)
        .delete({ count: 'exact' })
        .not(table.pk, 'is', null);

      if (res.error) {
        // Try deleting without filtering on pk if pk was wrong
        res = await supabase
          .from(table.name)
          .delete({ count: 'exact' })
          .neq(table.pk, 'impossible_id_9999');
      }

      if (res.error) {
        console.error(`❌ Error clearing [${table.name}]:`, res.error.message);
      } else {
        console.log(`✅ Cleared table [${table.name}] — (${res.count || 'all'} rows removed)`);
      }
    } catch (err) {
      console.error(`❌ Unexpected error clearing [${table.name}]:`, err.message);
    }
  }

  console.log('\n=== Cleanup Completed ===');
}

clearAllTables();
