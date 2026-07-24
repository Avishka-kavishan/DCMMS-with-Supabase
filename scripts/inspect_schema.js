const fs = require('fs'), path = require('path');
const envPath = path.join(__dirname, '..', '.env.local');
fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
  const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
  if (m) { let v = m[2]; if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1,-1); process.env[m[1]] = v; }
});
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function inspect() {
  const tables = [
    'dcmms_subject',
    'dcmms_daily_mail',
    'dcmms_subject_assignments',
    'dcmms_audit_logs',
    'dcmms_subject_details',
    'dcmms_subsequent_mails',
    'dcmms_investigation',
    'dcmms_profiles',
    'dcmms_institutes',
  ];

  for (const t of tables) {
    const { data, error } = await sb.from(t).select('*').limit(2);
    if (error) {
      console.log(`[${t}] ERROR: ${error.message}`);
    } else {
      const cols = data && data[0] ? Object.keys(data[0]).join(', ') : '(empty - no rows)';
      console.log(`[${t}] OK | columns: ${cols}`);
    }
  }

  // Also test insert permission on subject_details with anon key
  console.log('\n--- RLS Insert Tests ---');
  const testId = 'rls-probe-' + Date.now();

  const { error: sdErr } = await sb.from('dcmms_subject_details').insert({
    id: testId, case_no: 'RLS-TEST', received_date: new Date().toISOString().split('T')[0],
    report_state: 'Test', subject_officer_name: 'Tester', step_taken: 'Test'
  });
  console.log('dcmms_subject_details INSERT (anon):', sdErr ? 'BLOCKED: ' + sdErr.message : 'ALLOWED');
  if (!sdErr) await sb.from('dcmms_subject_details').delete().eq('id', testId);

  const { error: smErr } = await sb.from('dcmms_subsequent_mails').insert({
    id: testId, case_no: 'RLS-TEST', sender_name: 'Tester',
    letter_title: 'Test', mail_date: new Date().toISOString().split('T')[0],
    received_date: new Date().toISOString().split('T')[0]
  });
  console.log('dcmms_subsequent_mails INSERT (anon):', smErr ? 'BLOCKED: ' + smErr.message : 'ALLOWED');
  if (!smErr) await sb.from('dcmms_subsequent_mails').delete().eq('id', testId);
}
inspect().catch(console.error);
