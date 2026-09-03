const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log("Registering/Updating officer profiles in local PostgreSQL...");

    const officers = [
      {
        employee_no: "200280401310",
        full_name: "Nathasha Sathsarani",
        email: "nathashasathsarani209@gmail.com",
        password: "123456",
        role: "System admin",
        is_active: true,
      },
      {
        employee_no: "200133702441",
        full_name: "Avishka Kavishan",
        email: "avishkakavishan13@gmail.com",
        password: "123456",
        role: "Branch admin",
        is_active: true,
      },
      {
        employee_no: "200399100111",
        full_name: "Rathnaweera",
        email: "rathnaweera@dcmms.gov.lk",
        password: "rath123456",
        role: "Subject officer",
        is_active: true,
      },
      {
        employee_no: "200399100222",
        full_name: "Avishka",
        email: "avishakavishan3@gmail.com",
        password: "kavi123456",
        role: "Daily mail officer",
        is_active: true,
      },
      {
        employee_no: "200399100000",
        full_name: "System Administrator",
        email: "admin@dcmms.gov.lk",
        password: "sysadmin123456",
        role: "System admin",
        is_active: true,
      },
    ];

    for (const officer of officers) {
      const existing = await prisma.registerOfficerTable.findFirst({
        where: {
          OR: [
            { employee_no: officer.employee_no },
            { email: officer.email }
          ]
        }
      });

      if (existing) {
        await prisma.registerOfficerTable.update({
          where: { id: existing.id },
          data: {
            employee_no: officer.employee_no,
            full_name: officer.full_name,
            email: officer.email,
            password: officer.password,
            role: officer.role,
            is_active: officer.is_active,
          }
        });
        console.log(`Updated: ${officer.full_name} (${officer.email}) [${officer.role}]`);
      } else {
        await prisma.registerOfficerTable.create({
          data: {
            employee_no: officer.employee_no,
            full_name: officer.full_name,
            email: officer.email,
            password: officer.password,
            role: officer.role,
            is_active: officer.is_active,
          }
        });
        console.log(`Created: ${officer.full_name} (${officer.email}) [${officer.role}]`);
      }
    }

    const allOfficers = await prisma.registerOfficerTable.findMany({
      select: { employee_no: true, full_name: true, email: true, role: true, is_active: true }
    });

    console.log("\n--- Active Officers in Database ---");
    console.table(allOfficers);
    console.log("All local PostgreSQL profiles synced successfully!");
  } catch (err) {
    console.error("Registration Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
