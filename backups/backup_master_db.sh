#!/bin/bash
#
# Main Master DB Backup Script
# Runs every 6 hours for POC
#

set -e

# Configuration
DB_NAME="appdb"
DB_USER="appuser"
BACKUP_DIR="backups/postgres/master"
LOG_DIR="backups/postgres/logs"
RETENTION_DAYS=7

# Timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/master_${TIMESTAMP}.backup"
LOG_FILE="${LOG_DIR}/master_backup_${TIMESTAMP}.log"

# Start logging
exec 1>>"${LOG_FILE}" 2>&1

echo "========================================="
echo "Master DB Backup Started: $(date)"
echo "========================================="

# Create backup using pg_dump (custom format - compressed)
pg_dump -U ${DB_USER} \
        -d ${DB_NAME} \
        -Fc \
        -f "${BACKUP_FILE}" \
        -v

# Verify backup
if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo "✓ Backup completed successfully"
    echo "  File: ${BACKUP_FILE}"
    echo "  Size: ${BACKUP_SIZE}"
else
    echo "✗ Backup failed!"
    exit 1
fi

# Cleanup old backups (retain last 7 days)
echo "Cleaning up old backups (keeping ${RETENTION_DAYS} days)..."
find ${BACKUP_DIR} -name "master_*.backup" -mtime +${RETENTION_DAYS} -delete
find ${LOG_DIR} -name "master_backup_*.log" -mtime +${RETENTION_DAYS} -delete

echo "Master DB Backup Completed: $(date)"
echo "========================================="