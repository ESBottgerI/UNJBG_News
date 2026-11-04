#!/usr/bin/env bash
# Arranca el worker de WhatsApp en un contenedor aparte (Fase 8.0 / Fase 4).
#
#   ./scripts/dev-whatsapp-start.sh           # en segundo plano
#   ./scripts/dev-whatsapp-start.sh --follow  # ademas sigue los logs
#
# Requiere una sesion ya emparejada (./scripts/dev-whatsapp-pair.sh).
# Comparte ./.wa-auth y ./public/media con la app porque el repo esta montado.

set -euo pipefail

cd "$(dirname "$0")/.."
source scripts/dev-env.sh

FOLLOW=0
for arg in "$@"; do
  case "$arg" in
    --follow | -f) FOLLOW=1 ;;
    -h | --help)
      sed -n '2,9p' "$0"
      exit 0
      ;;
    *)
      die "opcion desconocida: $arg"
      ;;
  esac
done

[ -d "$REPO_ROOT/.wa-auth" ] && [ -n "$(ls -A "$REPO_ROOT/.wa-auth" 2>/dev/null)" ] ||
  die "no hay sesion en .wa-auth; ejecuta ./scripts/dev-whatsapp-pair.sh"

ensure_env_file
write_container_env
mkdir -p "$REPO_ROOT/public/media"

image_exists "$DEV_IMAGE" ||
  die "la imagen $DEV_IMAGE no existe; ejecuta ./scripts/dev-up.sh"

engine rm -f "$DEV_WA_CONTAINER" >/dev/null 2>&1 || true

log "arrancando worker de WhatsApp"
engine run -d \
  --name "$DEV_WA_CONTAINER" \
  --network "$DEV_NETWORK" \
  "${USERNS_ARGS[@]}" \
  "${SELINUX_ARGS[@]}" \
  --env-file "$REPO_ROOT/.env.container" \
  -e ENABLE_WHATSAPP_WORKER=true \
  -e SKIP_DB_SETUP=1 \
  --restart unless-stopped \
  -v "$REPO_ROOT:/app${BIND_SUFFIX}" \
  -v "${DEV_NODE_MODULES_VOLUME}:/app/node_modules" \
  "$DEV_IMAGE" npm run whatsapp:start >/dev/null

log "worker arriba; logs con ./scripts/dev-logs.sh wa"

if [ "$FOLLOW" = 1 ]; then
  engine logs -f --tail=100 "$DEV_WA_CONTAINER"
fi
