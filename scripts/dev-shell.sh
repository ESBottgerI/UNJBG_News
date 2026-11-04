#!/usr/bin/env bash
# Abre una shell dentro del contenedor de la app (Fase 8.0).
#
#   ./scripts/dev-shell.sh                          # bash interactivo
#   ./scripts/dev-shell.sh npm run typecheck        # comando puntual
#   ./scripts/dev-shell.sh npm run db:migrate

set -euo pipefail

cd "$(dirname "$0")/.."
source scripts/dev-env.sh

container_running "$DEV_APP_CONTAINER" ||
  die "la app no esta corriendo; ejecuta ./scripts/dev-up.sh"

if [ "$#" -gt 0 ]; then
  engine exec "${EXEC_TTY_ARGS[@]}" -w /app "$DEV_APP_CONTAINER" "$@"
else
  engine exec -it -w /app "$DEV_APP_CONTAINER" bash
fi
