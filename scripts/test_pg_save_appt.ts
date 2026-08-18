import { saveCaseByAppointmentAndReportDueDateServer, getCaseByAppointmentAndReportDueDateServer } from "../lib/db-actions";

async function runTest() {
  console.log("Testing saveCaseByAppointmentAndReportDueDateServer via PostgreSQL...");
  const ref = "INQ/2026/001";
  const saveRes = await saveCaseByAppointmentAndReportDueDateServer({
    subject_file_no: ref,
    sub_file_no: ref,
    appointment_letter_date: "2026-08-14",
    report_due_date: "2026-09-21",
    dates_submitted_by_subject: true,
  });
  console.log("Save Result:", saveRes);

  console.log("Testing getCaseByAppointmentAndReportDueDateServer...");
  const getRes = await getCaseByAppointmentAndReportDueDateServer(ref);
  console.log("Get Result:", getRes);
}

runTest().catch(console.error);
