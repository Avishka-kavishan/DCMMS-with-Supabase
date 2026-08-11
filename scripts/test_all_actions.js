const {
  checkDatabaseConnection,
  getDailyMailRecordsServer,
  saveDailyMailRecordServer,
  saveDailyMailToNewTableServer,
  getSubjectOfficersServer,
  getRegisterOfficersServer,
  getInvestigationOfficersServer,
  getCasesServer,
  getInvestigationsServer
} = require('../lib/db-actions');

async function testAll() {
  console.log("1. Testing checkDatabaseConnection...");
  try { console.log(await checkDatabaseConnection()); } catch (e) { console.error(e); }

  console.log("2. Testing getDailyMailRecordsServer...");
  try { console.log((await getDailyMailRecordsServer()).success); } catch (e) { console.error(e); }

  console.log("3. Testing getSubjectOfficersServer...");
  try { console.log(await getSubjectOfficersServer()); } catch (e) { console.error(e); }

  console.log("4. Testing getRegisterOfficersServer...");
  try { console.log(await getRegisterOfficersServer("Subject")); } catch (e) { console.error(e); }

  console.log("5. Testing getInvestigationOfficersServer...");
  try { console.log(await getInvestigationOfficersServer()); } catch (e) { console.error(e); }

  console.log("6. Testing getCasesServer...");
  try { console.log((await getCasesServer()).success); } catch (e) { console.error(e); }

  console.log("7. Testing getInvestigationsServer...");
  try { console.log((await getInvestigationsServer()).success); } catch (e) { console.error(e); }
}

// Note: db-actions.ts uses ES modules / TS. We will compile or test with tsx / node.
