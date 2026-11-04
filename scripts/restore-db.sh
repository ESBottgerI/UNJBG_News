#!/usr/bin/env bash
# Restauracion de un respaldo .sql.gz (Fase 7).
#
# Uso:
#   FORCE=1 npm run db:restore -- backups/unjbg_20261103_143000.sql.gz
#
# ADVERTENCIA: sobrescribe el contenido actual de la base. El script exige
# FORCE=1 para que no se dispare por accidente.

set -euo pipefail

FILE="${1:-}"
DB_CONTAINER="${DB_CONTAINER:-unjbg-db}"
DB_NAME="${POSTGRES_DB:-unjbg_news}"
DB_USER="${POSTGRES_USER:-unjbg}"

if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "uso: FORCE=1 $0 backups/unjbg_YYYYMMDD_HHMMSS.sql.gz" >&2
  exit 1
fi

if [ "${FORCE:-}" != "1" ]; then
  echo "Esto SOBREESCRIBE la base '$DB_NAME'." >&2
  echo "Si estas seguro, vuelve a ejecutar con FORCE=1." >&2
  exit 1
fi

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

RUNTIME="$(pick_runtime)"

# ON_ERROR_STOP=1: si una sentencia falla, se corta en vez de dejar la base a
# medias. El dump trae DROP ... IF EXISTS, asi que reemplaza los objetos.
if [ -n "$RUNTIME" ]; then
  gunzip -c "$FILE" | "$RUNTIME" exec -i "$DB_CONTAINER" \
    psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME"
elif command -v psql >/dev/null 2>&1 && [ -n "${DATABASE_URL:-}" ]; then
  gunzip -c "$FILE" | psql -v ON_ERROR_STOP=1 "$DATABASE_URL"
else
  echo "error: no se encontro el contenedor '$DB_CONTAINER' ni psql con DATABASE_URL" >&2
  exit 1
fi

echo "restauracion completada desde: $FILE"
