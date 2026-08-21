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
  // Mark previous duplicate sessions as logged_out except the most recent one per user
  await prisma.$executeRaw`
    WITH ranked_sessions AS (
      SELECT id, user_id, status,
             ROW_NUMBER() OVER(PARTITION BY user_id ORDER BY login_time DESC) as rn
      FROM public.dcmms_sessions
      WHERE status = 'active'
    )
    UPDATE public.dcmms_sessions
    SET status = 'logged_out',
        logout_time = NOW(),
        duration = 60
    WHERE id IN (
      SELECT id FROM ranked_sessions WHERE rn > 1
    );
  `;

  const active = await prisma.$queryRaw`
    SELECT id, user_id, username, email, login_time, status FROM public.dcmms_sessions WHERE status = 'active';
  `;
  console.log('--- Active Sessions After Deduplication ---');
  console.log(active);
}

main().finally(() => prisma.$disconnect());
