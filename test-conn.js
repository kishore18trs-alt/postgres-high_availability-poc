const { Client } = require('pg');

async function test(label, config) {
  const client = new Client(config);
  try {
    await client.connect();
    const res = await client.query("SELECT current_user, current_database();");
    console.log(`✅ ${label}:`, res.rows[0]);
    await client.end();
  } catch (err) {
    console.error(`❌ ${label}:`, err.message);
  }
}

(async () => {
  await test('Direct (5432)', { host: '127.0.0.1', port: 5432, user: 'appuser', password: 'apppass', database: 'appdb' });
  await test('PgBouncer (6432)', { host: '127.0.0.1', port: 6432, user: 'appuser', password: 'apppass', database: 'appdb' });
  await test('Replica (5433)', { host: '127.0.0.1', port: 5433, user: 'appuser', password: 'apppass', database: 'appdb' });
})();