#!/bin/bash
# Events DB Backup — runs daily
# Database: eventsdb (event logs, analytics)
# Retention: 30 days

set -e

BACKUP_DIR="./backups/events"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/eventsdb_${TIMESTAMP}.dump"
RETENTION_DAYS=30

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting backup of eventsdb..."

MSYS_NO_PATHCONV=1 docker exec pg-primary pg_dump \
  -U appuser \
  -d eventsdb \
  -F c \
  -Z 6 \
  -f /tmp/eventsdb_backup.dump

MSYS_NO_PATHCONV=1 docker cp pg-primary:/tmp/eventsdb_backup.dump "${BACKUP_FILE}"
MSYS_NO_PATHCONV=1 docker exec pg-primary rm /tmp/eventsdb_backup.dump

SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date)] ✅ Backup complete: ${BACKUP_FILE} (${SIZE})"

echo "[$(date)] Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "eventsdb_*.dump" -mtime +${RETENTION_DAYS} -delete

echo "[$(date)] Done."