#!/usr/bin/env bash
# Sauvegarde logique de la base (pg_dump compressé) avec rotation.
# Usage : ./scripts/backup.sh            (à lancer depuis n'importe où)
# Cron  : 0 3 * * * /opt/calendrier-sport/scripts/backup.sh >> /var/log/calendrier-backup.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/calendrier-$(date +%Y%m%d-%H%M%S).sql.gz"

docker compose exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' \
  | gzip > "$file"

find "$BACKUP_DIR" -name 'calendrier-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date '+%F %T') Sauvegarde créée : $file ($(du -h "$file" | cut -f1))"
