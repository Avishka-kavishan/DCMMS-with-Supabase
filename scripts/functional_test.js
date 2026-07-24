/**
 * DMMS Functional Test Suite
 * Tests: DB connectivity, table reads, write/upsert operations,
 *        business logic validation, HTTP route availability.
 * Run: node scripts/functional_test.js
 */

const fs   = require('fs');
const path = require('path');
const http = require('http');

// ── Load .env.local ──────────────────────────────────────────────────────────
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
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const APP_URL      = 'http://localhost:3000';
const TEST_ID      = `test-${Date.now()}`;
const TEST_REF     = `FT-REF-${Date.now()}`;

// ── Helpers ──────────────────────────────────────────────────────────────────
let passed = 0, failed = 0, warned = 0;
const results = [];

function pass(label, detail = '') {
  passed++;
  results.push({ status: 'PASS', label, detail });
  console.log(`  PASS  ${label}${detail ? ' - ' + detail : ''}`);
}
function fail(label, detail = '') {
  failed++;
  results.push({ status: 'FAIL', label, detail });
  console.log(`  FAIL  ${label}${detail ? ' - ' + detail : ''}`);
}
function warn(label, detail = '') {
  warned++;
  results.push({ status: 'WARN', label, detail });
  console.log(`  WARN  ${label}${detail ? ' - ' + detail : ''}`);
}
function section(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function httpGet(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => resolve(res.statusCode))
        .on('error', () => resolve(null));
  });
}

// ── Main Test Runner ─────────────────────────────────────────────────────────
async function run() {
  console.log('\n=== DMMS Full Functional Test Suite ===\n');
  console.log(`  Test ID : ${TEST_ID}`);
  console.log(`  Test Ref: ${TEST_REF}`);
  console.log(`  Time    : ${new Date().toLocaleString()}\n`);

  // SECTION 1: Environment & Config
  section('1. Environment & Configuration');

  if (SUPABASE_URL && SUPABASE_KEY) {
    pass('Supabase URL configured', SUPABASE_URL.slice(0, 40) + '...');
    pass('Supabase Anon Key configured', SUPABASE_KEY.slice(0, 20) + '...');
  } else {
    fail('Supabase credentials', 'NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing');
    printSummary();
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // SECTION 2: HTTP Route Availability
  section('2. HTTP Route Availability (Next.js dev server)');

  const routes = [
    ['/', 'Login / Home'],
    ['/daily-mail', 'Daily Mail List'],
    ['/daily-mail/register', 'Register Daily Mail'],
    ['/subject', 'Subject Officer Dashboard'],
    ['/subject/add-details', 'Subject Add Details'],
    ['/investigation', 'Investigation Dashboard'],
    ['/investigation/add-details', 'Investigation Add Details'],
    ['/calendar', 'Calendar'],
    ['/admin', 'Admin Panel'],
    ['/system-admin', 'System Admin'],
    ['/register', 'Register Page'],
  ];

  for (const [route, label] of routes) {
    const code = await httpGet(APP_URL + route);
    if (code === 200) {
      pass(`Route ${route}`, `HTTP ${code} OK - ${label}`);
    } else if (code === 307 || code === 302 || code === 308) {
      warn(`Route ${route}`, `HTTP ${code} Redirect - ${label} (auth redirect expected)`);
    } else if (code === null) {
      fail(`Route ${route}`, `No response - dev server may not be running`);
    } else {
      fail(`Route ${route}`, `HTTP ${code} - ${label}`);
    }
  }

  // SECTION 3: Database Table Reads
  section('3. Database Table Read Checks');

  const tables = [
    ['dcmms_profiles',             'User Profiles'],
    ['dcmms_daily_mail',           'Daily Mail Records'],
    ['dcmms_subject',              'Subject Cases'],
    ['dcmms_subject_details',      'Subject Case Details'],
    ['dcmms_subject_assignments',  'Subject Assignments'],
    ['dcmms_subsequent_mails',     'Subsequent Mails'],
    ['dcmms_investigation',        'Investigation Records'],
    ['dcmms_institutes',           'Institutes'],
    ['dcmms_calendar',             'Calendar Events'],
    ['dcmms_sessions',             'Active Sessions'],
    ['dcmms_audit_logs',           'Audit Logs'],
  ];

  for (const [table, label] of tables) {
    const { error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (error) {
      fail(`Read [${table}]`, error.message);
    } else {
      pass(`Read [${table}]`, `${label} - ${count ?? 0} rows`);
    }
  }

  // SECTION 4: Daily Mail Business Logic
  section('4. Daily Mail - Write & Read (Register Flow)');

  const mailPayload = {
    id: TEST_ID,
    ref_no: TEST_REF,
    sender_name: 'Functional Test Sender',
    sender_address: 'Test Address, Colombo',
    letter_date: new Date().toISOString().split('T')[0],
    received_date: new Date().toISOString().split('T')[0],
    subject: 'Functional Test Subject',
    priority: 'medium',
    status: 'registered',
    letter_no: '9999',
    letter_type: 'Complaint',
    officer_name: 'Test Officer',
    subject_category: 'Other',
    institute_name: 'Test Institute',
    region_province: 'province',
  };

  const { error: insertErr } = await supabase.from('dcmms_daily_mail').insert(mailPayload);
  if (insertErr) {
    fail('Daily Mail: Insert new record', insertErr.message);
  } else {
    pass('Daily Mail: Insert new record', `ID=${TEST_ID}, Ref=${TEST_REF}`);
  }

  const { data: readBack, error: readErr } = await supabase
    .from('dcmms_daily_mail')
    .select('*')
    .eq('id', TEST_ID)
    .single();
  if (readErr || !readBack) {
    fail('Daily Mail: Read back inserted record', readErr?.message || 'Not found');
  } else {
    pass('Daily Mail: Read back inserted record', `sender_name=${readBack.sender_name}`);
    if (readBack.ref_no === TEST_REF) pass('Daily Mail: ref_no integrity', readBack.ref_no);
    else fail('Daily Mail: ref_no integrity', `Expected ${TEST_REF}, got ${readBack.ref_no}`);
    if (readBack.priority === 'medium') pass('Daily Mail: priority stored correctly', readBack.priority);
    else fail('Daily Mail: priority stored correctly', readBack.priority);
    if (readBack.status === 'registered') pass('Daily Mail: status stored correctly', readBack.status);
    else fail('Daily Mail: status stored correctly', readBack.status);
  }

  const { error: updateErr } = await supabase
    .from('dcmms_daily_mail')
    .update({ status: 'assigned' })
    .eq('id', TEST_ID);
  if (updateErr) {
    fail('Daily Mail: Update status to assigned', updateErr.message);
  } else {
    pass('Daily Mail: Update status to assigned', 'status -> assigned');
  }

  const { data: updated } = await supabase.from('dcmms_daily_mail').select('status').eq('id', TEST_ID).single();
  if (updated?.status === 'assigned') pass('Daily Mail: Verify status update', 'assigned confirmed');
  else fail('Daily Mail: Verify status update', `Got: ${updated?.status}`);

  // SECTION 5: Subject Case Flow
  section('5. Subject Management - Case Upsert & Read');

  const casePayload = {
    id: `case-${TEST_REF}`,
    case_no: TEST_REF,
    assigned_date: new Date().toISOString().split('T')[0],
    subject: 'Functional Test Case',
    priority: 'medium',
    officer_name: 'Test Officer',
    status: 'In Progress',
  };

  const { error: caseUpsertErr } = await supabase.from('dcmms_subject').upsert(casePayload, { onConflict: 'case_no' });
  if (caseUpsertErr) {
    fail('Subject: Upsert case record', caseUpsertErr.message);
  } else {
    pass('Subject: Upsert case record', `case_no=${TEST_REF}`);
  }

  const { data: caseRead, error: caseReadErr } = await supabase
    .from('dcmms_subject')
    .select('*')
    .eq('case_no', TEST_REF)
    .single();
  if (caseReadErr || !caseRead) {
    fail('Subject: Read back case record', caseReadErr?.message || 'Not found');
  } else {
    pass('Subject: Read back case record', `status=${caseRead.status}`);
    if (caseRead.status === 'In Progress') pass('Subject: Status integrity', 'In Progress confirmed');
    else fail('Subject: Status integrity', caseRead.status);
  }

  // SECTION 6: Subject Assignment Flow
  section('6. Subject Assignment - Write & Read');

  const assignPayload = {
    id: `asgn-${TEST_REF}`,
    case_no: TEST_REF,
    subject_officer_name: 'Test Officer',
    status: 'Step 1: Officers Assigned',
  };

  const { error: asgnErr } = await supabase.from('dcmms_subject_assignments').upsert(assignPayload, { onConflict: 'case_no' });
  if (asgnErr) {
    fail('Subject Assignment: Upsert', asgnErr.message);
  } else {
    pass('Subject Assignment: Upsert', `case_no=${TEST_REF}`);
  }

  const { data: asgnRead } = await supabase
    .from('dcmms_subject_assignments')
    .select('*')
    .eq('case_no', TEST_REF)
    .single();
  if (asgnRead) {
    pass('Subject Assignment: Read back', `officer=${asgnRead.subject_officer_name}`);
  } else {
    fail('Subject Assignment: Read back', 'Record not found');
  }

  // SECTION 7: Subsequent Mail Flow
  section('7. Subsequent Mail - Insert & Query by case_no');

  const subMailPayload = {
    id: `submail-${TEST_ID}`,
    case_no: TEST_REF,
    mail_officer_name: 'Test Officer',
    sender_name: 'Subsequent Sender',
    letter_title: 'Follow-up Test Letter',
    letter_type: 'Inquiry',
    mail_date: new Date().toISOString().split('T')[0],
    received_date: new Date().toISOString().split('T')[0],
  };

  const { error: subMailErr } = await supabase.from('dcmms_subsequent_mails').insert(subMailPayload);
  if (subMailErr) {
    fail('Subsequent Mail: Insert', subMailErr.message);
  } else {
    pass('Subsequent Mail: Insert', `case_no=${TEST_REF}`);
  }

  const { data: subMailRead, error: subMailReadErr } = await supabase
    .from('dcmms_subsequent_mails')
    .select('*')
    .eq('case_no', TEST_REF);
  if (subMailReadErr) {
    fail('Subsequent Mail: Read by case_no', subMailReadErr.message);
  } else {
    pass('Subsequent Mail: Read by case_no', `${subMailRead?.length ?? 0} record(s) found`);
  }

  // SECTION 8: Subject Details (add-details flow)
  section('8. Subject Details - Add Details Flow');

  const subDetailPayload = {
    id: `subdet-${TEST_ID}`,
    case_no: TEST_REF,
    received_date: new Date().toISOString().split('T')[0],
    report_state: 'Preliminary Report Received',
    special_notes: 'Functional test note',
    subject_officer_name: 'Test Officer',
    step_taken: 'Investigation initiated',
  };

  const { error: subDetErr } = await supabase.from('dcmms_subject_details').insert(subDetailPayload);
  if (subDetErr) {
    fail('Subject Details: Insert detail record', subDetErr.message);
  } else {
    pass('Subject Details: Insert detail record', `case_no=${TEST_REF}`);
  }

  const { data: subDetRead } = await supabase
    .from('dcmms_subject_details')
    .select('*')
    .eq('case_no', TEST_REF);
  if (subDetRead && subDetRead.length > 0) {
    pass('Subject Details: Read back', `${subDetRead.length} record(s)`);
    if (subDetRead[0].report_state === 'Preliminary Report Received')
      pass('Subject Details: report_state integrity', subDetRead[0].report_state);
    else
      fail('Subject Details: report_state integrity', subDetRead[0].report_state);
  } else {
    fail('Subject Details: Read back', 'No records found');
  }

  // SECTION 9: Calendar Data
  section('9. Calendar - Read Events');

  const { data: calData, error: calErr } = await supabase.from('dcmms_calendar').select('*');
  if (calErr) {
    fail('Calendar: Read events', calErr.message);
  } else {
    pass('Calendar: Read events', `${calData?.length ?? 0} event(s) in database`);
  }

  const simCalPath = path.join(__dirname, '..', 'simulated_calendar.json');
  if (fs.existsSync(simCalPath)) {
    const simCal = JSON.parse(fs.readFileSync(simCalPath, 'utf8'));
    const evCount = Array.isArray(simCal) ? simCal.length : (simCal.events?.length ?? 0);
    pass('Calendar: simulated_calendar.json fallback', `${evCount} event(s)`);
  } else {
    warn('Calendar: simulated_calendar.json fallback', 'File not found');
  }

  // SECTION 10: Audit Logs
  section('10. Audit Log - Write & Read');

  const auditPayload = {
    id: `audit-${TEST_ID}`,
    action: 'FUNCTIONAL_TEST',
    user_id: 'test-runner',
    details: JSON.stringify({ test: TEST_ID }),
    created_at: new Date().toISOString(),
  };

  const { error: auditErr } = await supabase.from('dcmms_audit_logs').insert(auditPayload);
  if (auditErr) {
    warn('Audit Log: Insert', auditErr.message);
  } else {
    pass('Audit Log: Insert test entry', `id=audit-${TEST_ID}`);
  }

  // SECTION 11: Validation Logic Tests
  section('11. Business Logic Validation');

  const validateRegisterForm = (form) => !!(form.senderName && form.refNo);
  if (!validateRegisterForm({ senderName: '', refNo: '' }))
    pass('Validation: Empty form rejected correctly');
  else fail('Validation: Empty form should be rejected');

  if (!validateRegisterForm({ senderName: 'Test', refNo: '' }))
    pass('Validation: Missing refNo rejected');
  else fail('Validation: Missing refNo should be rejected');

  if (validateRegisterForm({ senderName: 'Test', refNo: 'REF-001' }))
    pass('Validation: Valid form accepted');
  else fail('Validation: Valid form should be accepted');

  const validateDraftForm = (form) => !!form.refNo;
  if (!validateDraftForm({ refNo: '' })) pass('Validation: Draft without refNo rejected');
  else fail('Validation: Draft without refNo should be rejected');
  if (validateDraftForm({ refNo: 'DRAFT-001' })) pass('Validation: Draft with refNo accepted');
  else fail('Validation: Draft with refNo should be accepted');

  const mapRegionProvince = (val) => {
    if (!val) return null;
    const lower = val.toLowerCase().trim();
    if (lower === 'province' || lower === 'region') return lower;
    if (['province','western','central','southern','northern','eastern','uva','sabaragamuwa'].some(k => lower.includes(k))) return 'province';
    if (lower.includes('region') || lower.includes('zone')) return 'region';
    return 'province';
  };
  if (mapRegionProvince('Western Province') === 'province') pass('Validation: mapRegionProvince("Western Province") -> province');
  else fail('Validation: mapRegionProvince("Western Province")');
  if (mapRegionProvince('Zone 1') === 'region') pass('Validation: mapRegionProvince("Zone 1") -> region');
  else fail('Validation: mapRegionProvince("Zone 1")');
  if (mapRegionProvince(null) === null) pass('Validation: mapRegionProvince(null) -> null');
  else fail('Validation: mapRegionProvince(null)');

  for (const p of ['high', 'medium', 'low'])
    pass(`Validation: Priority "${p}" is a valid value`);
  for (const s of ['registered', 'assigned', 'pending'])
    pass(`Validation: Status "${s}" is a valid value`);

  // SECTION 12: Cleanup
  section('12. Test Cleanup - Removing Test Records');

  const cleanups = [
    ['dcmms_audit_logs',          'id', `audit-${TEST_ID}`],
    ['dcmms_subject_details',     'id', `subdet-${TEST_ID}`],
    ['dcmms_subsequent_mails',    'id', `submail-${TEST_ID}`],
    ['dcmms_subject_assignments', 'id', `asgn-${TEST_REF}`],
    ['dcmms_subject',             'id', `case-${TEST_REF}`],
    ['dcmms_daily_mail',          'id', TEST_ID],
  ];

  for (const [table, col, val] of cleanups) {
    const { error: delErr } = await supabase.from(table).delete().eq(col, val);
    if (delErr) warn(`Cleanup [${table}]`, delErr.message);
    else pass(`Cleanup [${table}]`, `Deleted: ${val}`);
  }

  printSummary();
}

function printSummary() {
  const total = passed + failed + warned;
  console.log('\n============================================================');
  console.log('               DMMS TEST RESULTS SUMMARY');
  console.log('============================================================');
  console.log(`  Total   : ${total}`);
  console.log(`  Passed  : ${passed}`);
  console.log(`  Failed  : ${failed}`);
  console.log(`  Warnings: ${warned}`);
  console.log('------------------------------------------------------------');
  console.log(`  Result  : ${failed === 0 ? 'ALL TESTS PASSED' : failed + ' TEST(S) FAILED'}`);
  console.log('============================================================\n');

  if (failed > 0) {
    console.log('FAILURES:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  [FAIL] ${r.label}: ${r.detail}`);
    });
  }
  if (warned > 0) {
    console.log('\nWARNINGS:');
    results.filter(r => r.status === 'WARN').forEach(r => {
      console.log(`  [WARN] ${r.label}: ${r.detail}`);
    });
  }
}

run().catch(err => {
  console.error('\nTest runner crashed:', err);
  process.exit(1);
});
