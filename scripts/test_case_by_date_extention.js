global.WebSocket = class {};
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://qhkrndgnfzifswnvpilb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoa3JuZGduZnppZnN3bnZwaWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzOTQ1MDcsImV4cCI6MjEwMDk3MDUwN30.8Q4LF2cVbQkQw6DcLNUYP0SYRSvTlFuWh9Gy5JGy6fE";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

async function testInsert() {
  console.log("Testing insert into case_by_date_extention...");
  const { data: insertData, error: insertError } = await supabase
    .from("case_by_date_extention")
    .insert({
      subject_file_no: "TEST-FILE-001",
      sub_file_no: "TEST-FILE-001",
      extention_term: "First Extension (1st)",
      start_date: "2026-09-14",
      end_date: "2026-09-21",
      approval_status: "Pending"
    })
    .select();

  if (insertError) {
    console.error("Insert Error:", insertError);
  } else {
    console.log("Insert Success! Data:", insertData);
  }

  const { data: rows, error: selectErr } = await supabase.from("case_by_date_extention").select("*");
  if (selectErr) {
    console.error("Select Error:", selectErr);
  } else {
    console.log("Rows count in case_by_date_extention:", rows ? rows.length : 0);
    console.log("Rows:", rows);
  }
}

testInsert().catch(console.error);
