#!/usr/bin/env bash
# Restaure une sauvegarde créée par backup.sh (⚠ remplace les données actuelles).
# Usage : ./scripts/restore.sh backups/calendrier-20250101-030000.sql.gz
set -euo pipefail

if [[ $# -ne 1 || ! -f "$1" ]]; then
  echo "Usage : $0 <fichier.sql.gz>" >&2
  exit 1
fi
dump="$(realpath "$1")"
cd "$(dirname "$0")/.."

read -r -p "Restaurer $dump ? Les données actuelles seront écrasées [o/N] " answer
[[ "$answer" =~ ^[oOyY]$ ]] || exit 0

docker compose stop api
gunzip -c "$dump" | docker compose exec -T db sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 --single-transaction -q'
docker compose start api
echo "Restauration terminée."
