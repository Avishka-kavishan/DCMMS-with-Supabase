const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createFormalDisciplinaryInspectionTable() {
  console.log("=== Creating formal_disciplinary_inspection_table in PostgreSQL ===");

  try {
    // 1. Create table if not exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.formal_disciplinary_inspection_table (
        id BIGSERIAL PRIMARY KEY,
        ref_number VARCHAR(100) NOT NULL UNIQUE,
        
        -- Section 2: Investigation Committee Details
        -- 1. Officer conducting the investigation
        inv_officer_name TEXT,
        inv_officer_designation TEXT,
        inv_officer_appointment_date DATE,
        inv_officer_tel VARCHAR(50),
        inv_officer_address TEXT,

        -- 2. Officer conducting the complaint
        complaint_officer_name TEXT,
        complaint_officer_designation TEXT,
        complaint_officer_appointment_date DATE,
        complaint_officer_tel VARCHAR(50),
        complaint_officer_address TEXT,

        -- 3. Officer conducting the maintenance
        maintenance_officer_name TEXT,
        maintenance_officer_designation TEXT,
        maintenance_officer_appointment_date DATE,
        maintenance_officer_tel VARCHAR(50),
        maintenance_officer_address TEXT,

        -- Section 3: Disciplinary Investigation Proceedings (Steps 1 to 8)
        -- Step 1: Date of submission of the disciplinary investigation report
        date_submission_report DATE,
        -- Step 2: Recommendation of the disciplinary investigation report
        recommendation_report TEXT,
        -- Step 3: Date of submission of the recommendation for approval
        date_submission_rec_approval DATE,
        -- Step 4: Date of approval & Recommendation approved (Guilty / Acquittal / Approved)
        date_of_approval DATE,
        recommendation_approved VARCHAR(50),
        -- Step 5: Disciplinary order
        disciplinary_order TEXT,
        -- Step 6: Approval of the secretary of education (Received / Not received) & Details
        approval_secretary_status VARCHAR(50),
        approval_secretary_details TEXT,
        -- Step 7: Implementation period of disciplinary order (Start & End dates)
        order_start_date DATE,
        order_end_date DATE,
        -- Step 8: Other decisions
        other_decisions TEXT,

        -- Legacy & Backward Compatibility Columns
        recommendation TEXT,
        discipline_command TEXT,
        granted_approval VARCHAR(100),
        other_decision TEXT,

        -- Audit Timestamps
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log(" Table public.formal_disciplinary_inspection_table created or confirmed.");

    // 2. Add Foreign Key if possible (linking to subject_officer_form_table)
    try {
      await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_formal_disc_inspection_subject'
          ) THEN
            ALTER TABLE public.formal_disciplinary_inspection_table 
            ADD CONSTRAINT fk_formal_disc_inspection_subject 
            FOREIGN KEY (ref_number) REFERENCES public.subject_officer_form_table(ref_number) 
            ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $$;
      `);
      console.log(" Foreign key constraint fk_formal_disc_inspection_subject verified.");
    } catch (fkErr) {
      console.log(" Note on foreign key (optional):", fkErr.message);
    }

    // 3. Create Indexes
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_formal_disc_inspection_ref_number ON public.formal_disciplinary_inspection_table(ref_number);`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_formal_disc_inspection_date_sub ON public.formal_disciplinary_inspection_table(date_submission_report);`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_formal_disc_inspection_rec_app ON public.formal_disciplinary_inspection_table(recommendation_approved);`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_formal_disc_inspection_sec_status ON public.formal_disciplinary_inspection_table(approval_secretary_status);`);
    console.log(" Indexes created successfully.");

    // 4. Verify columns in information_schema
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'formal_disciplinary_inspection_table'
      ORDER BY ordinal_position;
    `;
    console.log(` Verified ${columns.length} columns in formal_disciplinary_inspection_table:`);
    console.table(columns);

  } catch (error) {
    console.error(" Error creating table:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createFormalDisciplinaryInspectionTable();
