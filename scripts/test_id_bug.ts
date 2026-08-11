const { saveDailyMailRecordServer } = require('../lib/db-actions');

async function testIdBug() {
  const mailWithNumericId = {
    id: "1786421637297", // Client-side generated timestamp ID for NEW entry
    serial_no: "DCMMS/2026/999",
    letter_no: "LT-999",
    received_date: "2026-08-11",
    submitted_date: "2026-08-11",
    subject: "Test New Letter",
    sender: "Jane Doe",
    officerName: "Kamal Perera",
  };

  const res = await saveDailyMailRecordServer(mailWithNumericId);
  console.log("Result for mailWithNumericId:", res);
}

testIdBug();
