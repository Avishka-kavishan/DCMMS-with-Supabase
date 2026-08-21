const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const envLocalPath = path.join(__dirname, '..', '.env.local');

[envPath, envLocalPath].forEach(p => {
  if (fs.existsSync(p)) {
    const raw = fs.readFileSync(p, 'utf8');
    raw.split(/\r?\n/).forEach(line => {
      const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
      if (m) {
        let v = m[2];
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    });
  }
});

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- ENV DATABASE_URL ---');
  console.log(process.env.DATABASE_URL);

  const info = await prisma.$queryRaw`
    SELECT current_database(), current_user, inet_server_addr(), inet_server_port(), version();
  `;
  console.log('--- Connected DB Info ---');
  console.log(info);

  const testSessId = `sess-${Date.now()}-test`;
  await prisma.$executeRaw`
    INSERT INTO public.dcmms_sessions (id, user_id, username, email, login_time, status, ip_address)
    VALUES (${testSessId}, 'officer-test', 'System Administrator', 'sysadmin@moe.gov.lk', ${new Date()}, 'active', '127.0.0.1')
    ON CONFLICT (id) DO NOTHING;
  `;

  const sessions = await prisma.$queryRaw`
    SELECT * FROM public.dcmms_sessions;
  `;
  console.log('--- dcmms_sessions rows after test insert ---');
  console.log(sessions);
}

main().finally(() => prisma.$disconnect());
