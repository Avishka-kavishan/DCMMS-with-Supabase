const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Checking and altering subject_officer_form_table...");
    
    // Add accused_officer_id to subject_officer_form_table if it does not exist
    await prisma.$executeRawUnsafe(`
      ALTER TABLE subject_officer_form_table 
      ADD COLUMN IF NOT EXISTS accused_officer_id UUID REFERENCES accused_officer_table(id) ON DELETE SET NULL;
    `);

    console.log("Column accused_officer_id added successfully or already exists.");

    const cols = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'subject_officer_form_table'
    `;
    console.log("Updated columns for subject_officer_form_table:", cols);
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
