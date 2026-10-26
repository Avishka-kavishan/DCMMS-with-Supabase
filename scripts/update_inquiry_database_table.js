const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: "postgresql://postgres:YourPassword123@localhost:5433/DCMMS?schema=public" } }
});

async function main() {
  console.log("Updating database tables for Conduct an Inquiry...");

  // 1. Update case_by_appointment_and_report_due_date table
  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.case_by_appointment_and_report_due_date
    ADD COLUMN IF NOT EXISTS inquiry_type VARCHAR(100) DEFAULT 'Institutional basic inquiry',
    ADD COLUMN IF NOT EXISTS title VARCHAR(255),
    ADD COLUMN IF NOT EXISTS approval_date DATE,
    ADD COLUMN IF NOT EXISTS report_received_date DATE,
    ADD COLUMN IF NOT EXISTS officers TEXT,
    ADD COLUMN IF NOT EXISTS recommendation TEXT,
    ADD COLUMN IF NOT EXISTS upcoming_action VARCHAR(255);
  `);
  console.log("Updated case_by_appointment_and_report_due_date table successfully.");

  // 2. Create conduct_inquiry_table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.conduct_inquiry_table (
      id BIGSERIAL PRIMARY KEY,
      case_no VARCHAR(100) NOT NULL,
      inquiry_type VARCHAR(100) NOT NULL DEFAULT 'Institutional basic inquiry',
      
      -- Institutional basic inquiry fields
      chairman_name VARCHAR(255),
      chairman_email VARCHAR(255),
      committee_members JSONB,
      appointment_letter_date DATE,
      report_due_date DATE,
      extension_term VARCHAR(50),
      extension_start_date DATE,
      extension_end_date DATE,
      upcoming_action VARCHAR(255),
      
      -- Province basic inquiry fields
      appointment_date DATE,
      due_date DATE,
      title VARCHAR(255),
      approval_date DATE,
      report_received_date DATE,
      officers TEXT,
      
      -- Common
      recommendation TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("Created conduct_inquiry_table successfully.");

  // Add indexes one by one
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_conduct_inquiry_case_no ON public.conduct_inquiry_table(case_no);
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_conduct_inquiry_type ON public.conduct_inquiry_table(inquiry_type);
  `);
  console.log("Created indexes successfully.");

  // Verify columns of case_by_appointment_and_report_due_date
  const cols1 = await prisma.$queryRaw`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'case_by_appointment_and_report_due_date';
  `;
  console.log("case_by_appointment_and_report_due_date columns:", cols1.map(c => c.column_name));

  // Verify columns of conduct_inquiry_table
  const cols2 = await prisma.$queryRaw`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'conduct_inquiry_table';
  `;
  console.log("conduct_inquiry_table columns:", cols2.map(c => c.column_name));

  await prisma.$disconnect();
}

main().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
