const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Checking and creating accused_officer_subject_officer_form_table junction table...");
    
    // 1. Add accused_officer_id to subject_officer_form_table if it does not exist
    await prisma.$executeRawUnsafe(`
      ALTER TABLE subject_officer_form_table 
      ADD COLUMN IF NOT EXISTS accused_officer_id UUID REFERENCES accused_officer_table(id) ON DELETE SET NULL;
    `);

    // 2. Create junction table for Many-to-Many relationship
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS accused_officer_subject_officer_form_table (
        accused_officer_id UUID NOT NULL REFERENCES accused_officer_table(id) ON DELETE CASCADE,
        subject_officer_form_id BIGINT NOT NULL REFERENCES subject_officer_form_table(id) ON DELETE CASCADE,
        PRIMARY KEY (accused_officer_id, subject_officer_form_id)
      );
    `);

    // 3. Backfill existing 1-to-many links into junction table
    await prisma.$executeRawUnsafe(`
      INSERT INTO accused_officer_subject_officer_form_table (accused_officer_id, subject_officer_form_id)
      SELECT accused_officer_id, id 
      FROM subject_officer_form_table 
      WHERE accused_officer_id IS NOT NULL
      ON CONFLICT DO NOTHING;
    `);

    console.log("✅ Junction table accused_officer_subject_officer_form_table created and backfilled successfully.");

    const cols = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'accused_officer_subject_officer_form_table'
    `;
    console.log("Columns for junction table:", cols);
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
