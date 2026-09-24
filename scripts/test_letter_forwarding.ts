import { saveDailyMailRecordServer, getDailyMailRecordsServer, getDirectlyAssignedLettersServer } from "../lib/db-actions";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runTests() {
  console.log("==================================================");
  console.log("TEST SUITE: Administrative Letter Forwarding Rule");
  console.log("==================================================");

  const testLetterNo1 = `TEST-FWD-${Date.now()}`;
  const testSerialNo1 = `TEST-SR-${Date.now()}`;

  try {
    // ----------------------------------------------------
    // Test 1: Register letter addressed to Assistant Secretary (Discipline)
    // ----------------------------------------------------
    console.log("\n[TEST 1] Register letter addressed to Assistant Secretary Discipline Branch (Bandula Gunawardena)...");
    
    const saveRes1 = await saveDailyMailRecordServer({
      letter_no: testLetterNo1,
      serial_no: testSerialNo1,
      received_date: new Date().toISOString(),
      submitted_date: new Date().toISOString(),
      subject: "Test Complaint Forwarding Rule Verification",
      sender: "Zonal Education Director",
      method: "Post",
      type: "Complaint",
      classification: "Disciplinary",
      action_officer: "Bandula Gunawardena", // Assistant Secretary
      addressed_to: "Bandula Gunawardena",
      addressed_role: "assistant_secretary",
      status: "registered"
    });

    console.log("saveDailyMailRecordServer result:", saveRes1);

    if (!saveRes1.success) {
      throw new Error(`Test 1 Failed: saveDailyMailRecordServer returned error: ${saveRes1.error}`);
    }

    // ----------------------------------------------------
    // Test 2: Verify database records contain forwarding data
    // ----------------------------------------------------
    console.log("\n[TEST 2] Verifying forwarding fields in PostgreSQL database...");
    
    const allRecordsRes = await getDailyMailRecordsServer();
    if (!allRecordsRes.success || !allRecordsRes.data) {
      throw new Error("Test 2 Failed: could not fetch daily mail records");
    }

    const savedLetter = allRecordsRes.data.find(
      (r: any) => r.letter_no === testLetterNo1 || r.serial_no === testSerialNo1
    );

    if (!savedLetter) {
      throw new Error("Test 2 Failed: Saved letter not found in daily mail records");
    }

    console.log("Saved letter verification data:");
    console.log("- letter_no:", savedLetter.letter_no);
    console.log("- action_officer:", savedLetter.action_officer);
    console.log("- addressed_to:", savedLetter.addressed_to);
    console.log("- addressed_role:", savedLetter.addressed_role);
    console.log("- forwarded_to:", savedLetter.forwarded_to);
    console.log("- forward_reason:", savedLetter.forward_reason);

    if (!savedLetter.forwarded_to) {
      throw new Error("Test 2 Failed: forwarded_to is empty!");
    }
    if (savedLetter.addressed_to !== "Bandula Gunawardena") {
      throw new Error(`Test 2 Failed: addressed_to expected 'Bandula Gunawardena', got '${savedLetter.addressed_to}'`);
    }
    console.log("✓ TEST 2 PASSED: Database correctly persisted forwarding fields.");

    // ----------------------------------------------------
    // Test 3: Additional Secretary Dashboard directly assigned letters
    // ----------------------------------------------------
    console.log("\n[TEST 3] Verifying Additional Secretary dashboard retrieves forwarded letters...");
    
    const addlSecProfile = {
      id: "SEC-TEST-004",
      full_name: "Nihal Ranasinghe",
      role: "additional_secretary",
      raw_role: "additional_secretary"
    };

    const addlSecLettersRes = await getDirectlyAssignedLettersServer(addlSecProfile);
    if (!addlSecLettersRes.success || !addlSecLettersRes.data) {
      throw new Error(`Test 3 Failed: getDirectlyAssignedLettersServer error: ${addlSecLettersRes.error}`);
    }

    const foundForAddlSec = addlSecLettersRes.data.find(
      (l: any) => l.letterNo === testLetterNo1 || l.caseNo === testSerialNo1
    );

    if (!foundForAddlSec) {
      throw new Error("Test 3 Failed: Letter was not routed to Additional Secretary's assigned list!");
    }

    console.log("Additional Secretary assigned letter entry:");
    console.log("- caseNo:", foundForAddlSec.caseNo);
    console.log("- isForwarded:", foundForAddlSec.isForwarded);
    console.log("- addressedTo:", foundForAddlSec.addressedTo);
    console.log("- forwardedTo:", foundForAddlSec.forwardedTo);

    if (!foundForAddlSec.isForwarded) {
      throw new Error("Test 3 Failed: isForwarded flag is not true!");
    }
    console.log("✓ TEST 3 PASSED: Additional Secretary successfully received forwarded letter with provenance.");

    // ----------------------------------------------------
    // Test 4: Assistant Secretary Dashboard visibility
    // ----------------------------------------------------
    console.log("\n[TEST 4] Verifying Assistant Secretary dashboard can also see letters addressed to them...");
    
    const asstSecProfile = {
      id: "SEC-TEST-001",
      full_name: "Bandula Gunawardena",
      role: "assistant_secretary",
      raw_role: "assistant_secretary"
    };

    const asstSecLettersRes = await getDirectlyAssignedLettersServer(asstSecProfile);
    if (!asstSecLettersRes.success || !asstSecLettersRes.data) {
      throw new Error(`Test 4 Failed: getDirectlyAssignedLettersServer error: ${asstSecLettersRes.error}`);
    }

    const foundForAsstSec = asstSecLettersRes.data.find(
      (l: any) => l.letterNo === testLetterNo1 || l.caseNo === testSerialNo1
    );

    if (!foundForAsstSec) {
      throw new Error("Test 4 Failed: Letter was not visible to Addressed Assistant Secretary!");
    }

    console.log("Assistant Secretary assigned letter entry:");
    console.log("- caseNo:", foundForAsstSec.caseNo);
    console.log("- addressedTo:", foundForAsstSec.addressedTo);
    console.log("- isForwarded:", foundForAsstSec.isForwarded);
    console.log("✓ TEST 4 PASSED: Addressed officer has visibility into forwarded correspondence.");

    // ----------------------------------------------------
    // Test 5: Control test - letter addressed directly to Additional Secretary
    // ----------------------------------------------------
    console.log("\n[TEST 5] Control test: Letter directly addressed to Additional Secretary (no forwarding needed)...");
    
    const testLetterNo2 = `TEST-DIRECT-${Date.now()}`;
    const testSerialNo2 = `TEST-SR-DIR-${Date.now()}`;

    await saveDailyMailRecordServer({
      letter_no: testLetterNo2,
      serial_no: testSerialNo2,
      received_date: new Date().toISOString(),
      submitted_date: new Date().toISOString(),
      subject: "Test Direct Letter to Additional Secretary",
      sender: "Ministry Audit Division",
      method: "Hand Delivery",
      type: "Letter",
      classification: "Financial",
      action_officer: "Nihal Ranasinghe",
      addressed_to: "Nihal Ranasinghe",
      addressed_role: "additional_secretary",
      status: "registered"
    });

    const allRecordsRes2 = await getDailyMailRecordsServer();
    const directLetter = allRecordsRes2.data.find((r: any) => r.letter_no === testLetterNo2);

    if (directLetter && directLetter.forwarded_to) {
      throw new Error(`Test 5 Failed: Expected forwarded_to to be empty for direct letter, got: ${directLetter.forwarded_to}`);
    }
    console.log("✓ TEST 5 PASSED: Direct letters do not trigger forwarding unnecessarily.");

    console.log("\n==================================================");
    console.log("ALL TESTS COMPLETED SUCCESSFULLY! (5/5 PASSED)");
    console.log("==================================================");

  } catch (err: any) {
    console.error("Test execution failed:", err);
    process.exit(1);
  } finally {
    // Cleanup test records
    console.log("\nCleaning up test records...");
    await prisma.$executeRawUnsafe(
      `DELETE FROM dcmms_daily_mail WHERE letter_no LIKE 'TEST-FWD-%' OR letter_no LIKE 'TEST-DIRECT-%'`
    ).catch(() => {});
    await prisma.$executeRawUnsafe(
      `DELETE FROM daily_mail_letter_table WHERE letter_no LIKE 'TEST-FWD-%' OR letter_no LIKE 'TEST-DIRECT-%'`
    ).catch(() => {});
    await prisma.$disconnect();
    console.log("Cleanup complete.");
  }
}

runTests();
