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

  const rows = await prisma.$queryRaw`
    SELECT id, letter_number, ref_number, senders_party, created_at FROM public.daily_mail_letter_table;
  `;
  console.log('--- daily_mail_letter_table rows ---');
  console.log(rows);
}

main().finally(() => prisma.$disconnect());
