# Backup Strategy — PostgreSQL HA POC

## Overview

This directory contains backup scripts for the PostgreSQL deployment supporting Fusion's enterprise solutions. Two databases are backed up on differentiated schedules based on data criticality and change rate.

## Databases & Schedules

| Database | Purpose | Backup Frequency | Retention |
|---|---|---|---|
| **appdb** (main) | User accounts, application state, transactions | Every 6 hours | 7 days |
| **eventsdb** | Event logs, sensor readings, audit trails | Daily at 02:00 | 30 days |

## Why Different Frequencies

**appdb is backed up frequently** because:
- User accounts and application data are business-critical
- Each transaction (account creation, configuration change) is valuable
- 6-hour RPO means worst-case 6 hours of data loss in a disaster

**eventsdb is backed up less frequently** because:
- Individual events have lower criticality (one missing log entry is not catastrophic)
- Volume is large — millions of events/day produces bulky dump files
- Daily backups balance disk cost vs acceptable data loss

## Files

| Script | What It Does |
|---|---|
| `backup-main.sh` | Dumps appdb to `backups/main/appdb_<timestamp>.dump` and prunes files older than 7 days |
| `backup-events.sh` | Dumps eventsdb to `backups/events/eventsdb_<timestamp>.dump` and prunes files older than 30 days |

## How To Run Manually

```bash
# Run from the project root
bash scripts/backup/backup-main.sh
bash scripts/backup/backup-events.sh
```

Output files land in:
- `backups/main/appdb_YYYYMMDD_HHMMSS.dump`
- `backups/events/eventsdb_YYYYMMDD_HHMMSS.dump`

## Backup Format

Backups use PostgreSQL's custom format (`pg_dump -F c`) with compression level 6. Benefits:
- Compact (compressed)
- Supports parallel restore (`pg_restore -j`)
- Selective restore (extract single tables if needed)
- Faster than plain SQL for large datasets

## Production Scheduling

For production deployment, schedule these scripts via:

### Linux (cron)

```cron
# /etc/cron.d/postgres-backups
0 */6 * * * appuser /path/to/scripts/backup/backup-main.sh   >> /var/log/backup-main.log 2>&1
0 2 * * *   appuser /path/to/scripts/backup/backup-events.sh >> /var/log/backup-events.log 2>&1
```

### Windows (Task Scheduler)

1. Open Task Scheduler → Create Task
2. Trigger: Daily at 02:00 (events) or every 6 hours (main)
3. Action: `bash.exe scripts/backup/backup-main.sh` (with project root as working directory)

### Kubernetes

Use a `CronJob` resource per database:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: backup-main
spec:
  schedule: "0 */6 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: postgres:15
              command: ["/scripts/backup-main.sh"]
```

### Cloud-Native (Recommended for Production)

Replace these scripts with **pgBackRest** or **barman** for production:
- Continuous WAL archiving (point-in-time recovery)
- Incremental backups (faster, smaller)
- S3/Azure Blob native support
- Built-in retention and validation

## Restore Procedure

### Validated Restore Test (this POC)

The backup-and-restore lifecycle was verified end-to-end:

| Database | Backup Size | Restored Row Count | Result |
|---|---|---|---|
| appdb | 80 KB | 10,000 | ✅ Pass |
| eventsdb | 89 KB | 5,000 | ✅ Pass |

### Manual Restore Steps

```bash
# 1. Create a target database (or use an existing one)
docker exec -it pg-primary psql -U appuser -d postgres \
  -c "CREATE DATABASE appdb_restored OWNER appuser;"

# 2. Copy the backup into the container
MSYS_NO_PATHCONV=1 docker cp backups/main/appdb_<timestamp>.dump \
  pg-primary:/tmp/restore.dump

# 3. Run pg_restore
MSYS_NO_PATHCONV=1 docker exec pg-primary pg_restore -v \
  -U appuser -d appdb_restored /tmp/restore.dump

# 4. Verify row counts
docker exec -it pg-primary psql -U appuser -d appdb_restored \
  -c 'SELECT COUNT(*) FROM "User";'
```

## Validation Discipline

**Run a quarterly restore test in a staging environment.** Backups that have never been restored are not backups. Set a calendar reminder.

## Recommendations for Production

1. **Move to pgBackRest** — supports incremental, parallel, and point-in-time recovery
2. **Off-site storage** — push dumps to S3/Azure Blob with lifecycle policies (hot → cold archive after 30 days)
3. **Encryption at rest** — encrypt backups before storage (`gpg --symmetric` or cloud-native KMS)
4. **Monitoring** — alert when no successful backup has been written in the expected window
5. **Restore drills** — automate a monthly restore-to-staging job that validates row counts match production

## Notes on Windows + Git Bash

These scripts use `MSYS_NO_PATHCONV=1` before Docker commands containing container paths (`/tmp/...`). Without this, Git Bash on Windows silently translates `/tmp/foo` to `C:/Users/.../Temp/foo`, causing pg_dump and pg_restore to fail or write to unexpected locations.