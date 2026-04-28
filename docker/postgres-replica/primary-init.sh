#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SET password_encryption = 'md5';
    ALTER USER appuser WITH PASSWORD 'apppass';
    CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'replicapass';
    SELECT pg_create_physical_replication_slot('replica_slot');
EOSQL

echo "host replication replicator all md5" >> "$PGDATA/pg_hba.conf"
echo "host all all all md5" >> "$PGDATA/pg_hba.conf"