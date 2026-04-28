# PostgreSQL HA & Performance POC

A proof-of-concept demonstrating a production-grade PostgreSQL setup with streaming replication, connection pooling, and load testing. Built with Prisma ORM and Express on Node.js.

---

## Architecture

```
Client (k6 / Node)
        │
        ▼
  Express API :3000
        │
        ├──── writes ──▶  PgBouncer :6432 (transaction pooling)
        │                       │
        │                       ▼
        │              postgres-primary :5432
        │                       │
        │              streaming replication
        │                       │
        └──── reads ───▶  postgres-replica :5433
```

| Component | Image | Port | Role |
|---|---|---|---|
| `pg-primary` | `pg-primary-custom` (postgres:15 + pg_cron) | 5432 | Primary read/write |
| `pg-replica` | `postgres:15` | 5433 | Hot standby (read replica) |
| `pgbouncer` | `edoburu/pgbouncer` | 6432 | Connection pool (transaction mode) |
| Express API | Node.js | 3000 | REST API over Prisma |

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with WSL 2 backend)
- Node.js 18+
- [k6](https://k6.io/docs/get-started/installation/) (for load tests)

---

## Quick Start

### 1. Start the database stack

```bash
docker compose up -d
```

The first run builds a custom primary image that includes `pg_cron`. Subsequent starts reuse the cached image.

### 2. Install dependencies

```bash
npm install
```

### 3. Run migrations

```bash
npx prisma migrate dev --name init
```

### 4. Seed 10,000 users

```bash
node seed.js
```

### 5. Start the API

```bash
node server.js
```

API is now available at `http://localhost:3000`.

---

## Environment Variables

Defined in `.env`:

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://appuser:apppass@127.0.0.1:6432/appdb?pgbouncer=true` | PgBouncer (writes) |
| `DIRECT_URL` | `postgresql://appuser:apppass@127.0.0.1:5432/appdb` | Direct primary (migrations only) |
| `REPLICA_URL` | `postgresql://appuser:apppass@127.0.0.1:5433/appdb` | Read replica |

> **Windows note:** Use `127.0.0.1` not `localhost`. Node.js resolves `localhost` to `::1` (IPv6) on Windows, which is intercepted by `wslrelay.exe` instead of Docker.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/users` | List first 50 users |
| `GET` | `/users/:id` | Get single user by ID |
| `POST` | `/users` | Create a user (`{ email, name }`) |

---

## Load Testing

Run all load tests with k6. The API must be running on port 3000 first.

### Read stress test — connection pool saturation

Ramps to 1,500 VUs to push past PostgreSQL's `max_connections` and validate that PgBouncer prevents connection exhaustion.

```bash
k6 run benchmark-read.js
```

Stages: 100 → 500 → 1,500 → 0 VUs over ~2 minutes.

### Combined read/write benchmark

Simulates realistic traffic: 70% reads, 20% writes, 10% list queries.

```bash
k6 run benchmark-combined.js
```

Stages: 50 → 200 → 500 → 200 → 0 VUs over ~3.5 minutes.

Thresholds enforced:
- p95 read latency < 800 ms
- p95 write latency < 1,500 ms
- Error rate < 5%

### Failover test

Hammers the API with 30 concurrent workers while you manually stop/start the primary container. Logs each recovery event and prints a full outage summary on exit.

```bash
# Terminal 1 — start the test
node failover-test.js

# Terminal 2 — simulate a primary failure
docker stop pg-primary
# wait a few seconds, then restore
docker start pg-primary
```

Press `Ctrl+C` to stop and see the outage window summary.

---

## Real-time DB Monitor

Polls the primary every 3 seconds and prints connections, cache hit ratio, replication lag, and slowest queries. Run alongside a load test for live observability.

```bash
node monitor.js
```

Requires `pg_stat_statements` to be active (it is — loaded via `shared_preload_libraries` in `docker-compose.yml`).

---

## Backups

Backup scripts live in `scripts/backups/`. See [scripts/backups/README.md](scripts/backups/README.md) for full documentation.

| Script | Database | Schedule | Retention |
|---|---|---|---|
| `backup-main.sh` | `appdb` | Every 6 hours | 7 days |
| `backup-events.sh` | `eventsdb` | Daily 02:00 | 30 days |

Run manually:

```bash
bash scripts/backups/backup-main.sh
bash scripts/backups/backup-events.sh
```

Dumps land in `scripts/backups/main/` and `scripts/backups/events/` in PostgreSQL custom format (supports parallel restore via `pg_restore -j`).

---

## Replication

Streaming replication is configured automatically on first start:

- `primary-init.sh` creates the `replicator` user and a physical replication slot (`replica_slot`)
- `replica-init.sh` runs `pg_basebackup` against the primary and configures `standby.signal`

Check replication lag at any time:

```bash
docker exec pg-primary psql -U appuser -d appdb \
  -c "SELECT application_name, pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS lag_bytes FROM pg_stat_replication;"
```

---

## Tear Down

```bash
# Stop containers, keep volumes (data preserved)
docker compose down

# Stop containers AND delete all data
docker compose down -v
```

---

## Project Structure

```
prisma-ha-poc/
├── docker/
│   ├── postgres-primary/
│   │   └── Dockerfile          # postgres:15 + pg_cron
│   └── postgres-replica/
│       ├── primary-init.sh     # Replication user + slot setup
│       └── replica-init.sh     # pg_basebackup + standby config
├── prisma/
│   └── schema.prisma
├── scripts/
│   └── backups/
│       ├── backup-main.sh
│       ├── backup-events.sh
│       └── README.md
├── benchmark-combined.js       # k6 mixed read/write load test
├── benchmark-read.js           # k6 connection saturation test
├── failover-test.js            # Node failover + recovery timer
├── monitor.js                  # Live DB health dashboard
├── seed.js                     # Seed 10,000 users
├── server.js                   # Express REST API
├── docker-compose.yml
└── .env
```
