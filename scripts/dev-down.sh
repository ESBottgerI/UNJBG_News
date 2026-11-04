#!/usr/bin/env bash
# Baja el entorno de desarrollo en contenedores (Fase 8.0).
#
#   ./scripts/dev-down.sh             # detiene y borra los contenedores
#   ./scripts/dev-down.sh --volumes   # ademas borra los volumenes (pierde datos)
#   ./scripts/dev-down.sh --image     # ademas borra la imagen dev

set -euo pipefail

cd "$(dirname "$0")/.."
source scripts/dev-env.sh

REMOVE_VOLUMES=0
REMOVE_IMAGE=0
for arg in "$@"; do
  case "$arg" in
    --volumes | -v) REMOVE_VOLUMES=1 ;;
    --image) REMOVE_IMAGE=1 ;;
    -h | --help)
      sed -n '2,8p' "$0"
      exit 0
      ;;
    *)
      die "opcion desconocida: $arg"
      ;;
  esac
done

for name in "$DEV_WA_CONTAINER" "$DEV_APP_CONTAINER" "$DEV_DB_CONTAINER"; do
  if container_exists "$name"; then
    log "deteniendo $name"
    engine stop "$name" >/dev/null 2>&1 || true
    engine rm -f "$name" >/dev/null 2>&1 || true
  fi
done

if [ "$REMOVE_VOLUMES" = 1 ]; then
  for vol in "$DEV_PGDATA_VOLUME" "$DEV_NEXT_VOLUME" "$DEV_NODE_MODULES_VOLUME"; do
    if volume_exists "$vol"; then
      log "borrando volumen $vol"
      engine volume rm -f "$vol" >/dev/null 2>&1 || true
    fi
  done
  if network_exists "$DEV_NETWORK"; then
    engine network rm "$DEV_NETWORK" >/dev/null 2>&1 || true
  fi
fi

if [ "$REMOVE_IMAGE" = 1 ]; then
  if image_exists "$DEV_IMAGE"; then
    log "borrando imagen $DEV_IMAGE"
    engine rmi -f "$DEV_IMAGE" >/dev/null 2>&1 || true
  fi
fi

log "entorno detenido"
