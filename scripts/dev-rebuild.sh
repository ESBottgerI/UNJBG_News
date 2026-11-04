#!/usr/bin/env bash
# Reconstruye la imagen de desarrollo y levanta el entorno (Fase 8.0).
#
#   ./scripts/dev-rebuild.sh           # build + up
#   ./scripts/dev-rebuild.sh --pull    # ademas refresca la imagen base
#   ./scripts/dev-rebuild.sh --no-cache
#
# Hay que reconstruir cuando cambian package.json, package-lock.json o
# Dockerfile.dev. Un cambio de codigo normal no lo requiere (bind mount).

set -euo pipefail

cd "$(dirname "$0")/.."
source scripts/dev-env.sh

BUILD_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --pull) BUILD_ARGS+=(--pull) ;;
    --no-cache) BUILD_ARGS+=(--no-cache) ;;
    -h | --help)
      sed -n '2,10p' "$0"
      exit 0
      ;;
    *)
      die "opcion desconocida: $arg"
      ;;
  esac
done

log "construyendo $DEV_IMAGE"
engine build \
  -f Dockerfile.dev \
  --build-arg USER_UID="$DEV_UID" \
  --build-arg USER_GID="$DEV_GID" \
  "${BUILD_ARGS[@]}" \
  -t "$DEV_IMAGE" .

exec ./scripts/dev-up.sh --no-build
