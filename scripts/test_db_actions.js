const { getRegisterOfficersServer, getDailyMailRecordsServer } = require('../lib/db-actions');

async function testActions() {
  console.log("=== Testing getRegisterOfficersServer ===");
  const regRes = await getRegisterOfficersServer();
  console.log("getRegisterOfficersServer result count:", regRes.data ? regRes.data.length : 0);
  console.log("getRegisterOfficersServer sample:", regRes.data ? regRes.data.slice(0, 3) : null);

  console.log("\n=== Testing getDailyMailRecordsServer ===");
  const mailRes = await getDailyMailRecordsServer();
  console.log("getDailyMailRecordsServer result count:", mailRes.data ? mailRes.data.length : 0);
  console.log("getDailyMailRecordsServer sample:", mailRes.data ? mailRes.data.slice(0, 3) : null);
}

testActions();
