#!/bin/bash
set -e

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "Initializing replica from primary..."
  until pg_basebackup -h postgres-primary -D "$PGDATA" -U replicator -vP -W -R -S replica_slot
  do
    echo "Waiting for primary to be ready..."
    sleep 2
  done
  echo "primary_conninfo = 'host=postgres-primary port=5432 user=replicator password=replicapass application_name=replica1'" >> "$PGDATA/postgresql.auto.conf"
  touch "$PGDATA/standby.signal"
  chown -R postgres:postgres "$PGDATA"
  chmod 0700 "$PGDATA"
fi

exec docker-entrypoint.sh postgres