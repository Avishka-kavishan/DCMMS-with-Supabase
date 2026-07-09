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
    console.log('Querying dcmms_cases...');
    const { data, error } = await supabase
      .from('dcmms_cases')
      .select('*')
      .limit(5)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Supabase query error:', error);
      process.exit(3);
    }
    console.log('Found rows:', Array.isArray(data) ? data.length : 0);
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Script error:', err);
    process.exit(1);
  }
})();
