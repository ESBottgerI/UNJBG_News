#!/usr/bin/env bash
# Sigue los logs de un servicio del entorno de desarrollo (Fase 8.0).
#
#   ./scripts/dev-logs.sh        # app
#   ./scripts/dev-logs.sh db
#   ./scripts/dev-logs.sh wa
#   TAIL=500 ./scripts/dev-logs.sh app

set -euo pipefail

cd "$(dirname "$0")/.."
source scripts/dev-env.sh

target="${1:-app}"
case "$target" in
  app) name="$DEV_APP_CONTAINER" ;;
  db) name="$DEV_DB_CONTAINER" ;;
  wa) name="$DEV_WA_CONTAINER" ;;
  *)
    die "uso: $0 [app|db|wa]"
    ;;
esac

container_exists "$name" || die "el contenedor $name no existe"

engine logs -f --tail="${TAIL:-200}" "$name"
