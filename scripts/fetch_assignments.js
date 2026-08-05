const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://qhkrndgnfzifswnvpilb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoa3JuZGduZnppZnN3bnZwaWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzOTQ1MDcsImV4cCI6MjEwMDk3MDUwN30.8Q4LF2cVbQkQw6DcLNUYP0SYRSvTlFuWh9Gy5JGy6fE"
);

async function fetchAssignments() {
  const { data, error, count } = await supabase
    .from("dcmms_subject_assignments")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error:", error.message);
    return;
  }

  console.log(`Total rows: ${count}\n`);

  data.forEach((row, i) => {
    console.log(`\n--- Row ${i + 1} ---`);
    Object.entries(row).forEach(([key, val]) => {
      const display =
        val === null
          ? "(null)"
          : Array.isArray(val)
          ? JSON.stringify(val)
          : typeof val === "object"
          ? JSON.stringify(val, null, 2)
          : val;
      console.log(`  ${key.padEnd(35)}: ${display}`);
    });
  });
}

fetchAssignments().catch(console.error);
