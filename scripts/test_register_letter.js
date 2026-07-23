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
  if (
    lower.includes("province") ||
    lower.includes("western") ||
    lower.includes("central") ||
    lower.includes("southern") ||
    lower.includes("northern") ||
    lower.includes("eastern") ||
    lower.includes("uva") ||
    lower.includes("sabaragamuwa")
  ) {
    return "province";
  }
  if (lower.includes("region") || lower.includes("zone")) return "region";
  return "province";
};

async function testFullSave() {
  console.log("=== Testing full letter save to dcmms_daily_mail ===");
  const testId = `letter-test-${Date.now()}`;
  const testLetter = {
    id: testId,
    ref_no: `DMMS/TEST/${Date.now()}`,
    sender_name: "Test Principal",
    sender_address: "Colombo 07",
    letter_date: "2026-07-23",
    received_date: "2026-07-23",
    subject: "Test Letter Registration",
    priority: "high",
    status: "registered",
    letter_no: "LT-999",
    letter_type: "Complaint",
    officer_name: "Rathnaweera",
    subject_category: "Internal Branches",
    institute_name: "Royal College",
    region_province: mapRegionProvince("Western Province"),
  };

  const { data, error } = await supabase
    .from("dcmms_daily_mail")
    .upsert(testLetter)
    .select();

  if (error) {
    console.error("❌ Save FAILED:", error.message, error.code);
  } else {
    console.log("✅ Save PASSED cleanly with zero constraint errors!");
    await supabase.from("dcmms_daily_mail").delete().eq("id", testId);
  }
}

testFullSave();
