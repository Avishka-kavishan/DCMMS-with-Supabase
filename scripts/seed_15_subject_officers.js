const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const subjectOfficers = [
  {
    code: "01",
    employee_no: "SO-01",
    email: "so01@dcmms.gov.lk",
    full_name: "Subject Officer 01 - ශාඛා ප්‍රධානී රාජකාරී (Branch Head)",
    subject_type: "01 - ශාඛා ප්‍රධානී රාජකාරී",
    password: "123456"
  },
  {
    code: "02",
    employee_no: "SO-02",
    email: "so02@dcmms.gov.lk",
    full_name: "Subject Officer 02 - අධ්‍යාපන අමාත්‍යාංශය (Ministry of Education)",
    subject_type: "02 - අධ්‍යාපන අමාත්‍යාංශය",
    password: "123456"
  },
  {
    code: "03",
    employee_no: "SO-03",
    email: "so03@dcmms.gov.lk",
    full_name: "Subject Officer 03 - ශ්‍රී ජයවර්ධනපුර හා හෝමාගම (Jayawardenepura & Homagama)",
    subject_type: "03 - ශ්‍රී ජයවර්ධනපුර හා හෝමාගම කලාපය",
    password: "123456"
  },
  {
    code: "04",
    employee_no: "SO-04",
    email: "so04@dcmms.gov.lk",
    full_name: "Subject Officer 04 - කොළඹ කලාපය (Colombo Zone)",
    subject_type: "04 - කොළඹ කලාපය",
    password: "123456"
  },
  {
    code: "05",
    employee_no: "SO-05",
    email: "so05@dcmms.gov.lk",
    full_name: "Subject Officer 05 - ගම්පහ දිස්ත්‍රික්කය (Gampaha District)",
    subject_type: "05 - ගම්පහ දිස්ත්‍රික්කය",
    password: "123456"
  },
  {
    code: "06",
    employee_no: "SO-06",
    email: "so06@dcmms.gov.lk",
    full_name: "Subject Officer 06 - කළුතර හා පිළියන්දල (Kalutara & Piliyandala)",
    subject_type: "06 - කළුතර දිස්ත්‍රික්කය හා පිළියන්දල කලාපය",
    password: "123456"
  },
  {
    code: "07",
    employee_no: "SO-07",
    email: "so07@dcmms.gov.lk",
    full_name: "Subject Officer 07 - මාතර හා හම්බන්තොට (Matara & Hambantota)",
    subject_type: "07 - මාතර දිස්ත්‍රික්කය හා හම්බන්තොට දිස්ත්‍රික්කය",
    password: "123456"
  },
  {
    code: "08",
    employee_no: "SO-08",
    email: "so08@dcmms.gov.lk",
    full_name: "Subject Officer 08 - මධ්‍යම පළාත (Central Province)",
    subject_type: "08 - මධ්‍යම පළාත",
    password: "123456"
  },
  {
    code: "09",
    employee_no: "SO-09",
    email: "so09@dcmms.gov.lk",
    full_name: "Subject Officer 09 - සබරගමුව පළාත (Sabaragamuwa Province)",
    subject_type: "09 - සබරගමුව පළාත",
    password: "123456"
  },
  {
    code: "10",
    employee_no: "SO-10",
    email: "so10@dcmms.gov.lk",
    full_name: "Subject Officer 10 - උතුරු හා නැගෙනහිර (Northern & Eastern)",
    subject_type: "10 - උතුරු පළාත හා නැගෙනහිර පළාත",
    password: "123456"
  },
  {
    code: "11",
    employee_no: "SO-11",
    email: "so11@dcmms.gov.lk",
    full_name: "Subject Officer 11 - ගාල්ල දිස්ත්‍රික්කය (Galle District)",
    subject_type: "11 - ගාල්ල දිස්ත්‍රික්කය",
    password: "123456"
  },
  {
    code: "12",
    employee_no: "SO-12",
    email: "so12@dcmms.gov.lk",
    full_name: "Subject Officer 12 - වයඹ පළාත (North Western Province)",
    subject_type: "12 - වයඹ පළාත",
    password: "123456"
  },
  {
    code: "13",
    employee_no: "SO-13",
    email: "so13@dcmms.gov.lk",
    full_name: "Subject Officer 13 - විද්‍යාපීඨ (National Colleges of Education)",
    subject_type: "13 - විද්‍යාපීඨ",
    password: "123456"
  },
  {
    code: "14",
    employee_no: "SO-14",
    email: "so14@dcmms.gov.lk",
    full_name: "Subject Officer 14 - ඌව පළාත (Uva Province)",
    subject_type: "14 - ඌව පළාත",
    password: "123456"
  },
  {
    code: "15",
    employee_no: "SO-15",
    email: "so15@dcmms.gov.lk",
    full_name: "Subject Officer 15 - උතුරු මැද පළාත (North Central Province)",
    subject_type: "15 - උතුරු මැද පළාත",
    password: "123456"
  }
];

async function seed() {
  console.log("Seeding 15 Subject Officers into register_officer_table...");

  for (const officer of subjectOfficers) {
    // Check if exists by email or employee_no
    const existing = await prisma.$queryRaw`
      SELECT id FROM register_officer_table 
      WHERE LOWER(email) = ${officer.email.toLowerCase()} OR employee_no = ${officer.employee_no}
      LIMIT 1;
    `;

    if (existing && existing.length > 0) {
      await prisma.$executeRaw`
        UPDATE register_officer_table
        SET full_name = ${officer.full_name},
            email = ${officer.email.toLowerCase()},
            password = ${officer.password},
            role = 'Subject officer',
            subject_type = ${officer.subject_type},
            is_active = true,
            updated_at = NOW()
        WHERE id = ${existing[0].id};
      `;
      console.log(`Updated [${officer.employee_no}] ${officer.full_name} (${officer.email})`);
    } else {
      await prisma.$executeRaw`
        INSERT INTO register_officer_table (
          id, employee_no, full_name, email, password, role, subject_type, is_active, created_at, updated_at
        ) VALUES (
          gen_random_uuid()::text,
          ${officer.employee_no},
          ${officer.full_name},
          ${officer.email.toLowerCase()},
          ${officer.password},
          'Subject officer',
          ${officer.subject_type},
          true,
          NOW(),
          NOW()
        );
      `;
      console.log(`Created [${officer.employee_no}] ${officer.full_name} (${officer.email})`);
    }
  }

  console.log("\nAll 15 Subject Officers successfully seeded!");
}

seed()
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
