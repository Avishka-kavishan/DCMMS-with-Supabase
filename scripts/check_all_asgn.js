const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://qhkrndgnfzifswnvpilb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoa3JuZGduZnppZnN3bnZwaWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzOTQ1MDcsImV4cCI6MjEwMDk3MDUwN30.8Q4LF2cVbQkQw6DcLNUYP0SYRSvTlFuWh9Gy5JGy6fE"
);

async function checkAll() {
  const { data, error } = await supabase
    .from("dcmms_subject_assignments")
    .select("id, case_no, status, extension_term, extension_start_date, extension_end_date, extension_requested_by_admin, extension_approval_status")
    .order("created_at", { ascending: true });

  if (error) { console.error("Error:", error.message); return; }
  console.log(`Total rows: ${data.length}\n`);
  data.forEach((row, i) => {
    console.log(`Row ${i+1}: id=${row.id} | case_no=${row.case_no} | status=${row.status}`);
    console.log(`         ext_term=${row.extension_term} | ext_start=${row.extension_start_date} | ext_end=${row.extension_end_date}`);
    console.log(`         ext_requested=${row.extension_requested_by_admin} | ext_approval=${row.extension_approval_status}\n`);
  });
}
checkAll().catch(console.error);
