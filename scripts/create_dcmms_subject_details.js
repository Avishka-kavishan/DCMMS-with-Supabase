const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.dcmms_subject_details (
      id VARCHAR(255) PRIMARY KEY,
      case_no VARCHAR(255),
      ref_no VARCHAR(255),
      received_date DATE,
      report_state VARCHAR(255),
      special_notes TEXT,
      subject_officer_name VARCHAR(255),
      officer_name VARCHAR(255),
      step_taken TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("dcmms_subject_details table created successfully!");
}

run().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
