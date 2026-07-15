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
    
    console.log('--- Testing Upsert on dcmms_daily_mail ---');
    const { data: upsertData, error: upsertError } = await supabase
      .from('dcmms_daily_mail')
      .upsert({
        id: 'sess-test-id-12345',
        ref_no: 'AUDIT_LOG_OR_SESSION_REF',
        sender_name: 'test_system',
        subject: 'test_upsert',
        priority: 'medium',
        status: 'registered',
        received_date: new Date().toISOString().split('T')[0]
      });
    
    if (upsertError) {
      console.error('Upsert on dcmms_daily_mail failed:', upsertError.message || upsertError);
    } else {
      console.log('Upsert on dcmms_daily_mail succeeded!');
    }

  } catch (err) {
    console.error('Script error:', err);
  }
})();
