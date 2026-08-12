const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("1. Creating auto-fill trigger in database...");
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION auto_fill_accused_school_details()
      RETURNS TRIGGER AS $$
      DECLARE
        inst_rec RECORD;
      BEGIN
        IF NEW.province IS NULL OR NEW.province = '' OR
           NEW.district IS NULL OR NEW.district = '' OR
           NEW.zone IS NULL OR NEW.zone = '' THEN
           
          SELECT province, district, zone, address
          INTO inst_rec
          FROM institute_table
          WHERE LOWER(TRIM(institute_name)) = LOWER(TRIM(NEW.accused_school_name))
            AND province IS NOT NULL AND province != ''
          ORDER BY id ASC
          LIMIT 1;

          IF FOUND THEN
            IF NEW.province IS NULL OR NEW.province = '' THEN
              NEW.province := inst_rec.province;
            END IF;
            IF NEW.district IS NULL OR NEW.district = '' THEN
              NEW.district := inst_rec.district;
            END IF;
            IF NEW.zone IS NULL OR NEW.zone = '' THEN
              NEW.zone := inst_rec.zone;
            END IF;
            IF (NEW.address IS NULL OR NEW.address = '') AND inst_rec.address IS NOT NULL THEN
              NEW.address := inst_rec.address;
            END IF;
          END IF;
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await prisma.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS trg_auto_fill_accused_school ON accused_school_table;
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER trg_auto_fill_accused_school
      BEFORE INSERT OR UPDATE ON accused_school_table
      FOR EACH ROW
      EXECUTE FUNCTION auto_fill_accused_school_details();
    `);
    console.log("✅ Trigger trg_auto_fill_accused_school created successfully.");

    console.log("2. Running initial backfill update on existing null rows in accused_school_table...");
    const updatedCount = await prisma.$executeRawUnsafe(`
      UPDATE accused_school_table s
      SET 
        province = COALESCE(NULLIF(s.province, ''), i.province),
        district = COALESCE(NULLIF(s.district, ''), i.district),
        zone = COALESCE(NULLIF(s.zone, ''), i.zone),
        address = COALESCE(NULLIF(s.address, ''), i.address),
        updated_at = NOW()
      FROM (
        SELECT DISTINCT ON (LOWER(TRIM(institute_name)))
          institute_name, province, district, zone, address
        FROM institute_table
        WHERE province IS NOT NULL AND province != ''
        ORDER BY LOWER(TRIM(institute_name)), id ASC
      ) i
      WHERE LOWER(TRIM(s.accused_school_name)) = LOWER(TRIM(i.institute_name))
        AND (s.province IS NULL OR s.province = '' OR s.district IS NULL OR s.district = '' OR s.zone IS NULL OR s.zone = '');
    `);
    console.log(`✅ Existing rows updated: ${updatedCount}`);

    console.log("3. Inspecting accused_school_table after backfill...");
    const schools = await prisma.$queryRaw`SELECT * FROM accused_school_table`;
    console.log("Accused schools now:", schools);

    console.log("4. Testing trigger with a new insert with null columns...");
    const inserted = await prisma.$queryRaw`
      INSERT INTO accused_school_table (accused_school_name, address)
      VALUES ('ROYAL COLLEGE', 'COLOMBO-07')
      RETURNING *;
    `;
    console.log("Newly inserted row (trigger auto-populated fields):", inserted);
    await prisma.$queryRaw`DELETE FROM accused_school_table WHERE id = ${inserted[0].id}`;
    console.log("Cleaned up test row.");

  } catch (err) {
    console.error("Error executing auto-fill script:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
