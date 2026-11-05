#!/usr/bin/env bash
# Respaldo de la base de datos (Fase 7).
#
# Uso:
#   npm run db:backup
#   BACKUP_DIR=/var/backups/nca-unjbg BACKUP_RETENTION_DAYS=30 npm run db:backup
#
# Busca pg_dump de dos formas:
#   1. Dentro del contenedor de Postgres (podman o docker), usando DB_CONTAINER.
#   2. Con pg_dump del host y la variable DATABASE_URL.
#
# Genera un .sql.gz en BACKUP_DIR y borra los respaldos mas viejos que
# BACKUP_RETENTION_DAYS (default 14).

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
DB_CONTAINER="${DB_CONTAINER:-nca-unjbg-db}"
DB_NAME="${POSTGRES_DB:-nca_unjbg}"
DB_USER="${POSTGRES_USER:-unjbg}"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/nca_unjbg_${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

pick_runtime() {
  if command -v podman >/dev/null 2>&1 &&
    podman ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
    echo podman
    return
  fi
  if command -v docker >/dev/null 2>&1 &&
    docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
    echo docker
    return
  fi
  echo ""
}

dump_with_container() {
  local runtime="$1"
  "$runtime" exec "$DB_CONTAINER" \
    pg_dump --clean --if-exists --no-owner --no-acl \
    -U "$DB_USER" -d "$DB_NAME" |
    gzip >"$OUT"
}

dump_with_host() {
  pg_dump --clean --if-exists --no-owner --no-acl "$DATABASE_URL" |
    gzip >"$OUT"
}

RUNTIME="$(pick_runtime)"

if [ -n "$RUNTIME" ]; then
  dump_with_container "$RUNTIME"
elif command -v pg_dump >/dev/null 2>&1 && [ -n "${DATABASE_URL:-}" ]; then
  dump_with_host
else
  echo "error: no se encontro el contenedor '$DB_CONTAINER' ni pg_dump con DATABASE_URL" >&2
  exit 1
fi

# Verificar que el .gz no este truncado antes de dar el respaldo por bueno.
gzip -t "$OUT"

# Retencion: borrar respaldos viejos.
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'nca_unjbg_*.sql.gz' \
  -mtime +"$RETENTION_DAYS" -delete

echo "respaldo listo: $OUT ($(du -h "$OUT" | cut -f1))"
