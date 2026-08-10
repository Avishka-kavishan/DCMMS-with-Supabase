const { PrismaClient } = require('@prisma/client');

async function syncBothDatabases() {
  console.log("Syncing register_officer_table into BOTH 'DCMMS' and 'postgres' databases...");

  const dcmmsUrl = "postgresql://postgres:YourPassword123@localhost:5432/DCMMS?schema=public";
  const postgresUrl = "postgresql://postgres:YourPassword123@localhost:5432/postgres?schema=public";

  const prismaDcmms = new PrismaClient({ datasources: { db: { url: dcmmsUrl } } });
  const prismaPostgres = new PrismaClient({ datasources: { db: { url: postgresUrl } } });

  try {
    // 1. Get all records from DCMMS
    const allRecords = await prismaDcmms.$queryRaw`SELECT * FROM register_officer_table`;
    console.log(`Found ${allRecords.length} records in 'DCMMS' database.`);

    // 2. Ensure table exists in 'postgres' database
    await prismaPostgres.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS register_officer_table (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          employee_no VARCHAR(50) UNIQUE NOT NULL,
          full_name VARCHAR(150) NOT NULL,
          email VARCHAR(150) UNIQUE NOT NULL,
          password TEXT NOT NULL DEFAULT '123456',
          role VARCHAR(50) DEFAULT 'Register Officer',
          is_active BOOLEAN DEFAULT TRUE,
          created_by UUID REFERENCES register_officer_table(id) ON DELETE SET NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Sync all records into 'postgres' database
    for (const rec of allRecords) {
      await prismaPostgres.$executeRawUnsafe(`
        INSERT INTO register_officer_table (id, employee_no, full_name, email, password, role, is_active, created_at, updated_at)
        VALUES (
          '${rec.id}'::uuid,
          $1, $2, $3, $4, $5, $6,
          '${rec.created_at.toISOString()}'::timestamp,
          '${rec.updated_at.toISOString()}'::timestamp
        )
        ON CONFLICT (email) DO UPDATE SET
          employee_no = EXCLUDED.employee_no,
          full_name = EXCLUDED.full_name,
          role = EXCLUDED.role,
          is_active = EXCLUDED.is_active,
          updated_at = NOW();
      `, rec.employee_no, rec.full_name, rec.email, rec.password || '123456', rec.role, rec.is_active !== false);
    }

    const countPostgres = await prismaPostgres.$queryRaw`SELECT count(*) FROM register_officer_table`;
    console.log("Success! Total records now in 'postgres' database:", countPostgres);

  } catch (err) {
    console.error("Sync Error:", err);
  } finally {
    await prismaDcmms.$disconnect();
    await prismaPostgres.$disconnect();
  }
}

syncBothDatabases();
