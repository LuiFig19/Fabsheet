#!/usr/bin/env bash
# Daily Postgres backup for the Raven's timesheet app.
# Run from cron on the Proxmox host, e.g.:
#   0 2 * * *  /opt/ravens-timesheet/scripts/backup.sh >> /var/log/ravens-backup.log 2>&1
set -euo pipefail

# Directory mounted into the host (or a host path with plenty of space).
BACKUP_DIR="${BACKUP_DIR:-/opt/ravens-timesheet/backups}"
DB_CONTAINER="${DB_CONTAINER:-ravens-timesheet-db-1}"
DB_USER="${POSTGRES_USER:-ravens}"
DB_NAME="${POSTGRES_DB:-ravens}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/ravens-$STAMP.sql.gz"

echo "[backup] dumping $DB_NAME from $DB_CONTAINER to $OUT"
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$OUT"

# Prune old backups.
find "$BACKUP_DIR" -name 'ravens-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
echo "[backup] done. Kept backups from the last $RETENTION_DAYS days."
