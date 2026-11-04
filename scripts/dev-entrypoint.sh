#!/usr/bin/env bash
# Entrypoint del contenedor de desarrollo (Fase 8.0).
#
# 1. Espera a que Postgres acepte conexiones.
# 2. Aplica migraciones pendientes y regenera el cliente Prisma.
# 3. Ejecuta el comando del contenedor (por defecto `npm run dev`).
#
# Variables:
#   DATABASE_URL      obligatoria; la inyecta scripts/dev-up.sh.
#   SKIP_DB_SETUP=1   omite migraciones/generate (contenedor de WhatsApp).
#   DB_WAIT_SECONDS   tope de espera por Postgres (default 90).

set -euo pipefail

if [ "${SKIP_DB_SETUP:-0}" != "1" ]; then
  : "${DATABASE_URL:?DATABASE_URL no esta definida}"

  # Parseo minimo de postgresql://usuario:clave@host:puerto/base?schema=public
  rest="${DATABASE_URL#*://}"
  hostport="${rest#*@}"
  hostport="${hostport%%/*}"
  db_host="${hostport%%:*}"
  db_port="${hostport#*:}"
  if [ "$db_port" = "$hostport" ]; then
    db_port=5432
  fi

  echo "[dev] esperando postgres en ${db_host}:${db_port}"
  waited=0
  until pg_isready -h "$db_host" -p "$db_port" -q; do
    waited=$((waited + 1))
    if [ "$waited" -ge "${DB_WAIT_SECONDS:-90}" ]; then
      echo "[dev] postgres no respondio en ${DB_WAIT_SECONDS:-90}s" >&2
      exit 1
    fi
    sleep 1
  done

  echo "[dev] aplicando migraciones"
  npx prisma migrate deploy

  echo "[dev] generando cliente prisma"
  npx prisma generate
fi

exec "$@"
