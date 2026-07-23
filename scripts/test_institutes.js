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

async function testInstitutes() {
  console.log("=== Testing region_province on dcmms_institutes ===");
  const testId = `inst-test-${Date.now()}`;
  const { error } = await supabase
    .from('dcmms_institutes')
    .insert({
      id: testId,
      name: 'Test School',
      code: `TS-${Date.now()}`,
      region_province: 'Western',
      status: 'Active'
    });

  if (error) {
    console.log("❌ dcmms_institutes insert FAILED:", error.message);
  } else {
    console.log("✅ dcmms_institutes insert PASSED with 'Western'!");
    await supabase.from('dcmms_institutes').delete().eq('id', testId);
  }
}

testInstitutes();
