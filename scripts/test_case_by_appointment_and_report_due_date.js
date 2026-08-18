global.WebSocket = class {};
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://qhkrndgnfzifswnvpilb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoa3JuZGduZnppZnN3bnZwaWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzOTQ1MDcsImV4cCI6MjEwMDk3MDUwN30.8Q4LF2cVbQkQw6DcLNUYP0SYRSvTlFuWh9Gy5JGy6fE";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

async function testAppointmentTable() {
  console.log("Testing insert into case_by_appointment_and_report_due_date...");
  const testRef = "INQ/2026/TEST-APPT";
  
  const { data: insertData, error: insertError } = await supabase
    .from("case_by_appointment_and_report_due_date")
    .insert({
      subject_file_no: testRef,
      sub_file_no: testRef,
      appointment_letter_date: "2026-08-14",
      report_due_date: "2026-09-21",
      dates_submitted_by_subject: true
    })
    .select();

  if (insertError) {
    console.error("Supabase Insert Error (table might be PostgreSQL direct only or needing migration):", insertError.message);
  } else {
    console.log("Supabase Insert Success! Data:", insertData);
  }

  const { data: rows, error: selectErr } = await supabase.from("case_by_appointment_and_report_due_date").select("*").eq("subject_file_no", testRef);
  if (selectErr) {
    console.error("Select Error:", selectErr.message);
  } else {
    console.log("Fetched rows for", testRef, ":", rows);
  }
}

testAppointmentTable().catch(console.error);
