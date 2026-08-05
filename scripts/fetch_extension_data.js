const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://qhkrndgnfzifswnvpilb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoa3JuZGduZnppZnN3bnZwaWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzOTQ1MDcsImV4cCI6MjEwMDk3MDUwN30.8Q4LF2cVbQkQw6DcLNUYP0SYRSvTlFuWh9Gy5JGy6fE"
);

async function fetchExtension() {
  // Fetch all columns so we can see which extension ones exist
  const { data, error } = await supabase
    .from("dcmms_subject_assignments")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error:", error.message);
    return;
  }

  console.log("=== Extension-related columns found in live DB ===\n");

  data.forEach((row, i) => {
    const extKeys = Object.keys(row).filter(k => k.includes("extension") || k.includes("certification"));
    console.log(`Row ${i + 1} | case_no: ${row.case_no}`);
    extKeys.forEach(k => {
      console.log(`  ${k.padEnd(40)}: ${row[k] ?? "(null)"}`);
    });
    console.log("");
  });

  // Show ALL column names available
  console.log("=== ALL columns in table ===");
  Object.keys(data[0]).forEach(k => console.log(" -", k));
}

fetchExtension().catch(console.error);
