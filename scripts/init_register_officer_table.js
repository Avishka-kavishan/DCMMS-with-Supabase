const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Creating register_officer_table table if not exists...");
    await prisma.$executeRawUnsafe(`
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

    console.log("Seeding default officer accounts into register_officer_table...");
    
    // Seed Admins
    await prisma.$executeRawUnsafe(`
      INSERT INTO register_officer_table (employee_no, full_name, email, password, role, is_active) 
      VALUES 
          ('200280401310', 'Nathasha Sathsarani', 'nathashasathsarani209@gmail.com', '123456', 'System admin', TRUE),
          ('200133702441', 'Avishka Kavishan', 'avishkakavishan13@gmail.com', '123456', 'Branch admin', TRUE)
      ON CONFLICT (email) DO UPDATE SET
          employee_no = EXCLUDED.employee_no,
          full_name = EXCLUDED.full_name,
          role = EXCLUDED.role,
          is_active = EXCLUDED.is_active;
    `);

    // Seed Officers
    await prisma.$executeRawUnsafe(`
      INSERT INTO register_officer_table (employee_no, full_name, email, password, role, is_active, created_by) 
      VALUES 
          ('200399100111', 'Kamal Perera', 'subject.officer@dcmms.gov.lk', '123456', 'Subject officer', TRUE, 
              (SELECT id FROM register_officer_table WHERE email = 'avishkakavishan13@gmail.com' LIMIT 1)),
          ('200399100112', 'Ranjith Bandara', 'ranjithbandara@gmail.com', '123456', 'Subject officer', TRUE, 
              (SELECT id FROM register_officer_table WHERE email = 'avishkakavishan13@gmail.com' LIMIT 1)),
          ('200399100222', 'Nimal Silva', 'dailymail.officer@dcmms.gov.lk', '123456', 'Daily mail officer', TRUE, 
              (SELECT id FROM register_officer_table WHERE email = 'avishkakavishan13@gmail.com' LIMIT 1)),
          ('200399100333', 'Sunil Fernando', 'investigation.officer@dcmms.gov.lk', '123456', 'Investigation officer', TRUE, 
              (SELECT id FROM register_officer_table WHERE email = 'avishkakavishan13@gmail.com' LIMIT 1))
      ON CONFLICT (email) DO UPDATE SET
          employee_no = EXCLUDED.employee_no,
          full_name = EXCLUDED.full_name,
          role = EXCLUDED.role,
          is_active = EXCLUDED.is_active;
    `);

    const count = await prisma.$queryRaw`SELECT count(*) FROM register_officer_table`;
    console.log("Success! Total records in register_officer_table:", count);
  } catch (err) {
    console.error("Initialization Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
