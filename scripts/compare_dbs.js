const { Client } = require('pg');

async function compareTables() {
  const client5432 = new Client({
    host: 'localhost', port: 5432, user: 'postgres', password: 'YourPassword123', database: 'DCMMS'
  });
  const client5433 = new Client({
    host: 'localhost', port: 5433, user: 'postgres', password: 'YourPassword123', database: 'DCMMS'
  });

  try {
    await client5432.connect();
    await client5433.connect();

    const res5432 = await client5432.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public';");
    const res5433 = await client5433.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public';");

    const tables5432 = res5432.rows.map(r => r.table_name).sort();
    const tables5433 = res5433.rows.map(r => r.table_name).sort();

    console.log('Tables on Port 5432 (pg18):', tables5432);
    console.log('Tables on Port 5433 (pg16):', tables5433);

    const missingOn5433 = tables5432.filter(t => !tables5433.includes(t));
    console.log('Tables missing on Port 5433:', missingOn5433);
  } catch (e) {
    console.error(e);
  } finally {
    await client5432.end().catch(() => {});
    await client5433.end().catch(() => {});
  }
}

compareTables();
