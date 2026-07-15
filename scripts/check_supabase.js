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
    
    console.log('--- Querying dcmms_user_sessions ---');
    const { data: sessData, error: sessError } = await supabase
      .from('dcmms_user_sessions')
      .select('*')
      .limit(5);
    
    if (sessError) {
      console.error('Supabase query error on dcmms_user_sessions:', sessError.message);
    } else {
      console.log('Found user sessions:', sessData.length);
    }

    console.log('--- Querying dcmms_audit_logs ---');
    const { data: auditData, error: auditError } = await supabase
      .from('dcmms_audit_logs')
      .select('*')
      .limit(5);
    
    if (auditError) {
      console.error('Supabase query error on dcmms_audit_logs:', auditError.message);
    } else {
      console.log('Found audit logs:', auditData.length);
    }

  } catch (err) {
    console.error('Script error:', err);
  }
})();
