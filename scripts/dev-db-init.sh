#!/usr/bin/env bash
# Crea las bases de datos de test dentro del Postgres de desarrollo (Fase 8.0).
#
#   ./scripts/dev-db-init.sh
#
# El script SQL tambien se ejecuta solo la primera vez que se inicializa el
# volumen de Postgres, asi que normalmente no hace falta llamarlo a mano.

set -euo pipefail

cd "$(dirname "$0")/.."
source scripts/dev-env.sh

container_running "$DEV_DB_CONTAINER" ||
  die "postgres no esta corriendo; ejecuta ./scripts/dev-up.sh"

engine exec -i "$DEV_DB_CONTAINER" \
  psql -v ON_ERROR_STOP=1 -U "$DEV_DB_USER" -d postgres \
  <"$REPO_ROOT/deploy/postgres-init/01-test-dbs.sql"

log "bases de test disponibles: $DEV_TEST_DB, $DEV_E2E_DB"
