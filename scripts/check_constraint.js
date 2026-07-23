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

const mapRegionProvince = (val) => {
  if (!val) return null;
  const lower = val.toLowerCase().trim();
  if (lower === "province" || lower === "region") return lower;
  if (lower.includes("province") || lower.includes("western") || lower.includes("central") || lower.includes("southern") || lower.includes("northern") || lower.includes("eastern") || lower.includes("uva") || lower.includes("sabaragamuwa")) return "province";
  if (lower.includes("region") || lower.includes("zone")) return "region";
  return "province";
};

async function testMappedValues() {
  console.log("=== Testing mapRegionProvince output values ===");
  const inputs = ["Western", "Central Province", "Zone Kandy", "", null];

  for (const input of inputs) {
    const val = mapRegionProvince(input);
    const testId = `test-reg-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const { error } = await supabase
      .from('dcmms_daily_mail')
      .insert({
        id: testId,
        ref_no: `TEST_MAPPED_${Date.now()}_${Math.floor(Math.random()*100)}`,
        sender_name: 'Test Sender',
        subject: 'Test Subject',
        priority: 'medium',
        status: 'registered',
        received_date: new Date().toISOString().split('T')[0],
        region_province: val
      });

    if (error) {
      console.log(`❌ Input [${JSON.stringify(input)}] -> Mapped [${JSON.stringify(val)}]: FAILED - ${error.message}`);
    } else {
      console.log(`✅ Input [${JSON.stringify(input)}] -> Mapped [${JSON.stringify(val)}]: PASSED!`);
      await supabase.from('dcmms_daily_mail').delete().eq('id', testId);
    }
  }
}

testMappedValues();
