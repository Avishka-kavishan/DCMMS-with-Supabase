const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const envPath = path.join(__dirname, '..', '.env.local');
    if (fs.existsSync(envPath)) {
      const raw = fs.readFileSync(envPath, 'utf8');
      raw.split(/\r?\n/).forEach(line => {
        const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
        if (m) {
          const k = m[1];
          let v = m[2];
          if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
          process.env[k] = v;
        }
      });
    }

    const { createClient } = require('@supabase/supabase-js');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!url || !key) {
      console.error('Supabase env vars missing.');
      process.exit(2);
    }

    const supabase = createClient(url, key);

    const tables = [
      'roles',
      'users',
      'schools',
      'persons',
      'letters',
      'cases',
      'case_status',
      'subject_categories',
      'investigations',
      'investigation_officers',
      'investigation_assignments',
      'provincial_investigations',
      'formal_investigations',
      'documents',
      'notifications',
      'audit_logs',
      'workflow_history',
      'case_letters'
    ];

    console.log('=== Checking 18 System Tables in Supabase ===');

    for (const tbl of tables) {
      const { data, error } = await supabase.from(tbl).select('*').limit(1);
      if (error) {
        console.log(`Table '${tbl}' status: ERROR/NOT FOUND (${error.message})`);
      } else {
        console.log(`Table '${tbl}' status: OK (Found ${data ? data.length : 0} rows check)`);
      }
    }

    console.log('\n=== Seeding Standard Reference Data ===');
    
    // Seed roles
    const rolesData = [
      { role_id: 1, role_name: 'Admin' },
      { role_id: 2, role_name: 'System Administrator' },
      { role_id: 3, role_name: 'Daily Mail Reporter' },
      { role_id: 4, role_name: 'Subject Officer' },
      { role_id: 5, role_name: 'Investigation Branch Administrator' }
    ];
    const { error: rolesErr } = await supabase.from('roles').upsert(rolesData, { onConflict: 'role_id' });
    if (rolesErr) console.log('Roles seed note:', rolesErr.message);
    else console.log('Roles seeded successfully.');

    // Seed case_status
    const statusData = [
      { status_id: 1, status_name: 'New' },
      { status_id: 2, status_name: 'Assigned' },
      { status_id: 3, status_name: 'Preliminary Investigation' },
      { status_id: 4, status_name: 'Investigation Ongoing' },
      { status_id: 5, status_name: 'Charge Sheet' },
      { status_id: 6, status_name: 'Formal Investigation' },
      { status_id: 7, status_name: 'Closed' },
      { status_id: 8, status_name: 'Court' }
    ];
    const { error: statusErr } = await supabase.from('case_status').upsert(statusData, { onConflict: 'status_id' });
    if (statusErr) console.log('Case status seed note:', statusErr.message);
    else console.log('Case status seeded successfully.');

    // Seed subject_categories
    const catData = [
      { subject_id: 1, subject_name: 'Financial Misconduct' },
      { subject_id: 2, subject_name: 'Administrative Negligence' },
      { subject_id: 3, subject_name: 'Behavioral Issue' },
      { subject_id: 4, subject_name: 'Exam Malpractice' },
      { subject_id: 5, subject_name: 'General Grievance' }
    ];
    const { error: catErr } = await supabase.from('subject_categories').upsert(catData, { onConflict: 'subject_id' });
    if (catErr) console.log('Subject categories seed note:', catErr.message);
    else console.log('Subject categories seeded successfully.');

  } catch (err) {
    console.error('Fatal execution error:', err);
  }
})();
