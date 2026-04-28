#!/bin/bash
# Main DB Backup — runs every 6 hours
# Database: appdb (user accounts, application data)
# Retention: 7 days

set -e

BACKUP_DIR="./backups/main"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/appdb_${TIMESTAMP}.dump"
RETENTION_DAYS=7

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting backup of appdb..."

MSYS_NO_PATHCONV=1 docker exec pg-primary pg_dump \
  -U appuser \
  -d appdb \
  -F c \
  -Z 6 \
  -f /tmp/appdb_backup.dump

MSYS_NO_PATHCONV=1 docker cp pg-primary:/tmp/appdb_backup.dump "${BACKUP_FILE}"
MSYS_NO_PATHCONV=1 docker exec pg-primary rm /tmp/appdb_backup.dump

SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date)] ✅ Backup complete: ${BACKUP_FILE} (${SIZE})"

echo "[$(date)] Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "appdb_*.dump" -mtime +${RETENTION_DAYS} -delete

echo "[$(date)] Done."