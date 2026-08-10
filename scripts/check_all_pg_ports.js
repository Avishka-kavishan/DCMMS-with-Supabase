const { Client } = require('pg');

async function checkPorts() {
  const ports = [5432, 5433, 5434, 5435];
  for (const port of ports) {
    console.log(`\n=== Checking PostgreSQL on port ${port} ===`);
    const masterClient = new Client({
      host: 'localhost',
      port: port,
      user: 'postgres',
      password: 'YourPassword123',
      database: 'postgres',
      connectionTimeoutMillis: 2000
    });

    try {
      await masterClient.connect();
      console.log(`Connected to PostgreSQL on port ${port}!`);
      const dbRes = await masterClient.query("SELECT datname FROM pg_database WHERE datistemplate = false;");
      console.log("Databases:", dbRes.rows.map(r => r.datname));

      for (const r of dbRes.rows) {
        const dbName = r.datname;
        const client = new Client({
          host: 'localhost',
          port: port,
          user: 'postgres',
          password: 'YourPassword123',
          database: dbName,
          connectionTimeoutMillis: 2000
        });
        try {
          await client.connect();
          const tRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public';");
          const tables = tRes.rows.map(t => t.table_name);
          if (tables.includes('register_officer_table')) {
            const countRes = await client.query("SELECT count(*) FROM register_officer_table;");
            const rowsRes = await client.query("SELECT id, employee_no, full_name, email, role FROM register_officer_table ORDER BY created_at DESC;");
            console.log(`\n -> Database '${dbName}' on port ${port} has register_officer_table (${countRes.rows[0].count} rows):`);
            console.table(rowsRes.rows);
          }
          await client.end();
        } catch (e) {
          console.error(`Error querying '${dbName}' on port ${port}:`, e.message);
        }
      }
      await masterClient.end();
    } catch (err) {
      console.log(`Port ${port} connection result: ${err.message}`);
    }
  }
}

checkPorts();
