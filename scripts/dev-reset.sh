#!/usr/bin/env bash
# Borra los volumenes del entorno de desarrollo y arranca de cero (Fase 8.0).
#
#   ./scripts/dev-reset.sh              # pide confirmacion
#   ./scripts/dev-reset.sh --yes        # sin preguntar
#   ./scripts/dev-reset.sh --keep-modules   # conserva node_modules
#
# ADVERTENCIA: borra la base de datos de desarrollo y la cache de Next.
# Antes conviene un respaldo: ./scripts/export-handover.sh

set -euo pipefail

cd "$(dirname "$0")/.."
source scripts/dev-env.sh

ASSUME_YES=0
KEEP_MODULES=0
for arg in "$@"; do
  case "$arg" in
    --yes | -y) ASSUME_YES=1 ;;
    --keep-modules) KEEP_MODULES=1 ;;
    -h | --help)
      sed -n '2,10p' "$0"
      exit 0
      ;;
    *)
      die "opcion desconocida: $arg"
      ;;
  esac
done

if [ "$ASSUME_YES" != 1 ]; then
  warn "Esto borra el volumen $DEV_PGDATA_VOLUME (base $DEV_DB_NAME) y $DEV_NEXT_VOLUME."
  printf 'Escribe "si" para continuar: '
  read -r answer
  [ "$answer" = "si" ] || die "cancelado"
fi

for name in "$DEV_WA_CONTAINER" "$DEV_APP_CONTAINER" "$DEV_DB_CONTAINER"; do
  if container_exists "$name"; then
    engine rm -f "$name" >/dev/null 2>&1 || true
  fi
done

engine volume rm -f "$DEV_PGDATA_VOLUME" "$DEV_NEXT_VOLUME" >/dev/null 2>&1 || true
if [ "$KEEP_MODULES" != 1 ]; then
  engine volume rm -f "$DEV_NODE_MODULES_VOLUME" >/dev/null 2>&1 || true
fi

log "volumenes borrados; levantando de nuevo"
exec ./scripts/dev-up.sh
