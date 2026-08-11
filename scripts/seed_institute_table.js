const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

async function seedInstituteTable() {
  const dcmmsUrl = process.env.DATABASE_URL || "postgresql://postgres:YourPassword123@localhost:5432/DCMMS?schema=public";
  const prisma = new PrismaClient({ datasources: { db: { url: dcmmsUrl } } });

  try {
    const sqlPath = path.join(__dirname, '..', 'prisma', 'insert_institute_table.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log("Executing SQL migration for institute_table...");
    
    // Split create table and insert statements
    const createStmt = `CREATE TABLE IF NOT EXISTS institute_table (
        id BIGSERIAL PRIMARY KEY,
        institute_name VARCHAR(255) NOT NULL,
        address TEXT,
        province VARCHAR(100),
        district VARCHAR(100),
        zone VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );`;

    await prisma.$executeRawUnsafe(createStmt);
    console.log("✅ Table institute_table ensured!");

    const insertMatch = sqlContent.match(/INSERT INTO institute_table[\s\S]+/);
    if (insertMatch) {
      await prisma.$executeRawUnsafe(insertMatch[0]);
      console.log("✅ Successfully inserted records into institute_table!");
    }

    const countResult = await prisma.$queryRaw`SELECT COUNT(*) FROM institute_table`;
    console.log("Total rows in institute_table:", countResult);
  } catch (e) {
    console.error("❌ Error seeding institute_table:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

seedInstituteTable();
