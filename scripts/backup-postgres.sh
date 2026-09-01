#!/usr/bin/env bash
# Backup automatique de la base Postgres de production AlloAppart.
# Usage : ./scripts/backup-postgres.sh
# À lancer depuis la racine du projet sur le VPS (là où se trouve
# docker-compose.prod.yml). Prévu pour tourner via cron (voir DEPLOY.md).

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# Charge les identifiants Postgres depuis .env.prod sans exporter tout le fichier
POSTGRES_USER=$(grep -E '^POSTGRES_USER=' .env.prod | cut -d '=' -f2- || echo allo)
POSTGRES_DB=$(grep -E '^POSTGRES_DB=' .env.prod | cut -d '=' -f2- || echo allo_appart)
POSTGRES_USER="${POSTGRES_USER:-allo}"
POSTGRES_DB="${POSTGRES_DB:-allo_appart}"

BACKUP_DIR="$PROJECT_DIR/backups"
RETENTION_DAYS=14
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
FILENAME="allo_appart_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[backup-postgres] Dump de la base '${POSTGRES_DB}' en cours..."
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists \
  | gzip > "$BACKUP_DIR/$FILENAME"

SIZE=$(du -h "$BACKUP_DIR/$FILENAME" | cut -f1)
echo "[backup-postgres] OK -> $BACKUP_DIR/$FILENAME ($SIZE)"

echo "[backup-postgres] Purge des backups de plus de ${RETENTION_DAYS} jours..."
find "$BACKUP_DIR" -name 'allo_appart_*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete

echo "[backup-postgres] Terminé. Backups actuels :"
ls -lh "$BACKUP_DIR" | grep allo_appart || true

# ─────────────────────────────────────────────────────────────────────────────
# IMPORTANT : ce script garde les backups uniquement en LOCAL sur le VPS.
# Si le VPS est perdu (panne disque, suppression accidentelle), ces backups
# sont perdus aussi. Pour une vraie résilience, copier régulièrement le
# contenu de backups/ vers un stockage externe (ex : rclone vers un bucket
# S3/Backblaze/Hetzner Storage Box). Voir DEPLOY.md pour un exemple.
