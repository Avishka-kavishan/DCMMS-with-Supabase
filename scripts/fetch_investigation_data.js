const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://qhkrndgnfzifswnvpilb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoa3JuZGduZnppZnN3bnZwaWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzOTQ1MDcsImV4cCI6MjEwMDk3MDUwN30.8Q4LF2cVbQkQw6DcLNUYP0SYRSvTlFuWh9Gy5JGy6fE";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const tables = [
  "dcmms_investigation",
  "dcmms_investigation_officers",
  "dcmms_preliminary_investigations",
  "dcmms_subject_assignments",
];

async function fetchAll() {
  for (const table of tables) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`TABLE: ${table}`);
    console.log("=".repeat(60));
    const { data, error } = await supabase.from(table).select("*");
    if (error) {
      console.error(`  ERROR: ${error.message}`);
    } else if (!data || data.length === 0) {
      console.log("  (no rows found)");
    } else {
      console.log(`  ${data.length} row(s) found:\n`);
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

fetchAll().catch(console.error);
