#!/usr/bin/env bash
# Respaldo de la base de datos (produccion, Supabase).
#
# Uso:
#   npm run db:backup
#   BACKUP_DIR=/var/backups/nca-unjbg BACKUP_RETENTION_DAYS=30 npm run db:backup
#
# Usa DIRECT_URL (session pooler / conexion directa). Si hay Docker, corre
# pg_dump dentro de postgres:17-alpine para que la version del cliente coincida
# con Supabase (Postgres 17) y no haga falta instalar postgresql-client en el
# VPS. Si no hay Docker, usa el pg_dump del host (puede fallar si es mas viejo
# que el servidor).
#
# Genera un .sql.gz en BACKUP_DIR y borra los respaldos mas viejos que
# BACKUP_RETENTION_DAYS (default 14).

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
PG_DUMP_IMAGE="${PG_DUMP_IMAGE:-postgres:17-alpine}"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/nca_unjbg_${STAMP}.sql.gz"

DB_URL="${DIRECT_URL:-${DATABASE_URL:-}}"
if [ -z "$DB_URL" ]; then
  echo "error: define DIRECT_URL (o DATABASE_URL) en el entorno" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# Parseo minimo de postgresql://usuario:clave@host:puerto/base?params
rest="${DB_URL#postgresql://}"
rest="${rest#postgres://}"
creds="${rest%%@*}"
hostpart="${rest#*@}"
DB_USER="${creds%%:*}"
DB_PASS="${creds#*:}"
hostport="${hostpart%%/*}"
dbpart="${hostpart#*/}"
DB_NAME="${dbpart%%\?*}"
DB_HOST="${hostport%%:*}"
DB_PORT="${hostport#*:}"
if [ "$DB_PORT" = "$DB_HOST" ]; then
  DB_PORT=5432
fi

if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
  echo "error: no se pudo interpretar DIRECT_URL" >&2
  exit 1
fi

if command -v docker >/dev/null 2>&1; then
  docker run --rm -e PGPASSWORD="$DB_PASS" "$PG_DUMP_IMAGE" \
    pg_dump --clean --if-exists --no-owner --no-acl \
      -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    | gzip >"$OUT"
elif command -v pg_dump >/dev/null 2>&1; then
  echo "aviso: usando pg_dump del host; si es mas viejo que Postgres 17 puede fallar" >&2
  PGPASSWORD="$DB_PASS" pg_dump --clean --if-exists --no-owner --no-acl \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    | gzip >"$OUT"
else
  echo "error: no se encontro docker ni pg_dump" >&2
  exit 1
fi

# Verificar que el .gz no este truncado antes de dar el respaldo por bueno.
gzip -t "$OUT"

# Retencion: borrar respaldos viejos.
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'nca_unjbg_*.sql.gz' \
  -mtime +"$RETENTION_DAYS" -delete

echo "respaldo listo: $OUT ($(du -h "$OUT" | cut -f1))"
