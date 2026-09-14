const { Client } = require('pg');

async function removeAllTemporaryCases() {
  console.log("==================================================");
  console.log("   DCMMS DATABASE CLEANUP: REMOVE TEMPORARY CASES ");
  console.log("==================================================\n");

  const client = new Client({
    host: 'localhost',
    port: 5433,
    user: 'postgres',
    password: 'YourPassword123',
    database: 'DCMMS'
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL database 'DCMMS' on port 5433.\n");

    // 1. List of case-related tables to clear (ordered by dependencies)
    const caseTables = [
      'case_history',
      'dcmms_letter_edit_requests',
      'dcmms_recommendations',
      'charge_sheet_table',
      'reply_letter_details_table',
      'investigation_table',
      'case_by_date_extention',
      'case_by_appointment_and_report_due_date',
      'chairment_by_case',
      'members_by_case',
      'accused_officer_subject_officer_form_table',
      'accused_officer_table',
      'accused_school_table',
      'subject_officer_form_table',
      'daily_mail_letter_table',
      'dcmms_subject_assignments',
      'dcmms_subject',
      'dcmms_daily_mail',
      'dcmms_concerned_officers',
      'dcmms_subsequent_mails'
    ];

    // 2. Display BEFORE counts
    console.log("=== BEFORE CLEANUP COUNTS ===");
    for (const table of caseTables) {
      try {
        const res = await client.query(`SELECT count(*) FROM "${table}";`);
        console.log(`  - ${table.padEnd(45)}: ${res.rows[0].count} rows`);
      } catch (err) {
        console.log(`  - ${table.padEnd(45)}: (skipped - ${err.message})`);
      }
    }

    // 3. Perform Deletion in a Transaction
    console.log("\nStarting transaction to clean case tables...");
    await client.query('BEGIN;');

    for (const table of caseTables) {
      try {
        const delRes = await client.query(`DELETE FROM "${table}";`);
        console.log(`  ✓ Cleared table: ${table} (${delRes.rowCount || 0} rows deleted)`);
      } catch (err) {
        console.warn(`  ! Warning deleting from ${table}: ${err.message}`);
      }
    }

    // 4. Reset ID sequences
    const sequencesToReset = [
      'daily_mail_letter_table_id_seq',
      'subject_officer_form_table_id_seq',
      'chairment_by_case_id_seq',
      'members_by_case_id_seq',
      'case_by_date_extention_id_seq',
      'investigation_table_id_seq',
      'charge_sheet_table_id_seq',
      'reply_letter_details_table_id_seq',
      'accused_school_table_id_seq'
    ];

    console.log("\nResetting ID sequences to 1...");
    for (const seq of sequencesToReset) {
      try {
        await client.query(`ALTER SEQUENCE "${seq}" RESTART WITH 1;`);
        console.log(`  ✓ Sequence '${seq}' restarted at 1.`);
      } catch (err) {
        console.warn(`  ! Could not reset sequence '${seq}': ${err.message}`);
      }
    }

    await client.query('COMMIT;');
    console.log("\n✓ Transaction committed successfully.\n");

    // 5. Display AFTER counts for case tables
    console.log("=== AFTER CLEANUP COUNTS (Case Tables) ===");
    for (const table of caseTables) {
      try {
        const res = await client.query(`SELECT count(*) FROM "${table}";`);
        console.log(`  - ${table.padEnd(45)}: ${res.rows[0].count} rows`);
      } catch (err) {
        // table might not exist
      }
    }

    // 6. Verify Master Tables are Intact
    const masterTables = [
      'register_officer_table',
      'commitee_table',
      'school_table',
      'institute_table',
      'dcmms_sessions',
      'dcmms_audit_logs'
    ];

    console.log("\n=== MASTER & AUTHENTICATION TABLES (Preserved) ===");
    for (const table of masterTables) {
      try {
        const res = await client.query(`SELECT count(*) FROM "${table}";`);
        console.log(`  ✓ ${table.padEnd(45)}: ${res.rows[0].count} rows (INTACT)`);
      } catch (err) {
        console.warn(`  ! Error checking ${table}: ${err.message}`);
      }
    }

    console.log("\n==================================================");
    console.log("   ALL TEMPORARY CASE DATA SUCCESSFULLY REMOVED   ");
    console.log("==================================================");

  } catch (e) {
    await client.query('ROLLBACK;').catch(() => {});
    console.error("❌ Cleanup failed:", e);
  } finally {
    await client.end();
  }
}

removeAllTemporaryCases();
