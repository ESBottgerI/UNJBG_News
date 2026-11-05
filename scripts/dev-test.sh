#!/usr/bin/env bash
# Corre la suite de tests dentro del contenedor (Fase 8.1).
#
#   ./scripts/dev-test.sh              # unitarios + integracion
#   ./scripts/dev-test.sh unit
#   ./scripts/dev-test.sh integration
#   ./scripts/dev-test.sh e2e
#
# Usa bases separadas para no tocar la base de desarrollo:
#   unit         -> no toca la base
#   integration  -> nca_unjbg_test
#   e2e          -> nca_unjbg_e2e

set -euo pipefail

cd "$(dirname "$0")/.."
source scripts/dev-env.sh

MODE="${1:-all}"
shift || true

container_running "$DEV_APP_CONTAINER" ||
  die "la app no esta corriendo; ejecuta ./scripts/dev-up.sh"

./scripts/dev-db-init.sh >/dev/null

case "$MODE" in
  all)
    URL="$(dev_database_url "$DEV_TEST_DB")"
    CMD=(npm run test)
    MIGRATE=1
    ;;
  unit)
    URL="$(dev_database_url "$DEV_TEST_DB")"
    CMD=(npm run test:unit)
    MIGRATE=0
    ;;
  integration)
    URL="$(dev_database_url "$DEV_TEST_DB")"
    CMD=(npm run test:integration)
    MIGRATE=1
    ;;
  e2e)
    URL="$(dev_database_url "$DEV_E2E_DB")"
    CMD=(npm run test:e2e)
    MIGRATE=1
    ;;
  *)
    die "uso: $0 [all|unit|integration|e2e] [args...]"
    ;;
esac

# Las bases de test se crean vacias: hay que aplicarles las migraciones antes
# de correr la suite (el entrypoint solo migra la base de desarrollo).
if [ "$MIGRATE" = 1 ]; then
  log "aplicando migraciones en ${URL##*@}"
  engine exec "${EXEC_TTY_ARGS[@]}" \
    -w /app \
    -e DATABASE_URL="$URL" \
    -e NODE_ENV=test \
    "$DEV_APP_CONTAINER" npx prisma migrate deploy >/dev/null
fi

EXTRA_ENV=()
if [ "$MODE" = "e2e" ]; then
  # Playwright levanta un segundo `next dev` en el puerto 3100, conectado a la
  # base e2e y con distDir propio (.next-e2e) para no chocar con el servidor de
  # desarrollo que ya esta corriendo en 3000.
  EXTRA_ENV+=(
    -e PLAYWRIGHT_BASE_URL="http://127.0.0.1:3100"
    -e PLAYWRIGHT_WEB_SERVER_CMD="npx next dev -p 3100"
    -e NEXT_DIST_DIR=".next-e2e"
  )
  log "cargando datos e2e"
  engine exec "${EXEC_TTY_ARGS[@]}" \
    -w /app \
    -e DATABASE_URL="$URL" \
    -e NODE_ENV=test \
    "$DEV_APP_CONTAINER" npm run db:seed:e2e >/dev/null
fi

log "corriendo tests ($MODE) contra ${URL##*@}"
engine exec "${EXEC_TTY_ARGS[@]}" \
  -w /app \
  -e DATABASE_URL="$URL" \
  -e NODE_ENV=test \
  -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
  "${EXTRA_ENV[@]}" \
  "$DEV_APP_CONTAINER" "${CMD[@]}" "$@"
