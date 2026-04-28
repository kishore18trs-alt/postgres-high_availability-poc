// monitor.js — run alongside k6 to watch DB health in real time
const { Client } = require('pg');

const primary = new Client({
  host: 'localhost', port: 5432,
  user: 'appuser', password: 'apppass', database: 'appdb'
});

async function checkHealth() {
  try {
    // 1. Active connections count
    const conns = await primary.query(`
      SELECT count(*) AS total,
             count(*) FILTER (WHERE state = 'active') AS active,
             count(*) FILTER (WHERE state = 'idle')   AS idle,
             count(*) FILTER (WHERE wait_event_type IS NOT NULL) AS waiting
      FROM pg_stat_activity
      WHERE datname = 'appdb'
    `);

    // 2. Cache hit ratio
    const cache = await primary.query(`
      SELECT ROUND(
        100.0 * blks_hit / GREATEST(blks_hit + blks_read, 1), 2
      ) AS cache_hit_pct
      FROM pg_stat_database
      WHERE datname = 'appdb'
    `);

    // 3. Replication lag
    const lag = await primary.query(`
      SELECT application_name,
             pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS lag_bytes
      FROM pg_stat_replication
    `);

    // 4. Top slow queries right now
    const slow = await primary.query(`
      SELECT ROUND(mean_exec_time::numeric, 2) AS avg_ms,
             calls,
             LEFT(query, 60) AS query
      FROM pg_stat_statements
      WHERE query NOT LIKE '%pg_stat%'
      ORDER BY mean_exec_time DESC
      LIMIT 3
    `);

    console.clear();
    console.log('=== DB HEALTH MONITOR ===', new Date().toISOString());
    console.log('\n📊 CONNECTIONS:');
    console.table(conns.rows);

    console.log('\n💾 CACHE HIT RATIO:');
    console.table(cache.rows);

    console.log('\n🔄 REPLICATION LAG:');
    console.table(lag.rows.length ? lag.rows : [{ status: 'no replica connected' }]);

    console.log('\n🐢 SLOWEST QUERIES:');
    console.table(slow.rows);

  } catch (err) {
    console.error('Monitor error:', err.message);
  }
}

async function main() {
  await primary.connect();
  console.log('Monitor started — refreshing every 3 seconds...\n');

  // Run immediately then every 3 seconds
  await checkHealth();
  setInterval(checkHealth, 3000);
}

main();