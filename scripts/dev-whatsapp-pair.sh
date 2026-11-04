#!/usr/bin/env bash
# Empareja el worker de WhatsApp desde el contenedor (Fase 8.0 / Fase 4).
#
#   ./scripts/dev-whatsapp-pair.sh
#
# Muestra el QR en la terminal del host (o un codigo de 8 digitos si WA_PHONE
# esta definido en .env). La sesion queda en ./.wa-auth, dentro del repo, asi
# que sobrevive a reinicios y reconstrucciones.

set -euo pipefail

cd "$(dirname "$0")/.."
source scripts/dev-env.sh

ensure_env_file
write_container_env
mkdir -p "$REPO_ROOT/.wa-auth" "$REPO_ROOT/public/media"

image_exists "$DEV_IMAGE" ||
  die "la imagen $DEV_IMAGE no existe; ejecuta ./scripts/dev-up.sh"

engine run --rm -it \
  --network "$DEV_NETWORK" \
  "${USERNS_ARGS[@]}" \
  "${SELINUX_ARGS[@]}" \
  --env-file "$REPO_ROOT/.env.container" \
  -e ENABLE_WHATSAPP_WORKER=false \
  -e SKIP_DB_SETUP=1 \
  -v "$REPO_ROOT:/app${BIND_SUFFIX}" \
  -v "${DEV_NODE_MODULES_VOLUME}:/app/node_modules" \
  "$DEV_IMAGE" npm run whatsapp:pair
