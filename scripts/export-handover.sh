#!/usr/bin/env bash
# Exporta todo lo necesario para retomar el proyecto en otra maquina (Fase 8.0).
#
#   ./scripts/export-handover.sh
#   OUT_DIR=/run/media/usb/entrega ./scripts/export-handover.sh
#   EXTRA_IMAGES="unjbg_news-app:latest unjbg_news-worker:latest" ./scripts/export-handover.sh
#
# Genera en handover/<fecha>/:
#   - nca_unjbg.sql.gz   dump comprimido de la base de desarrollo
#   - nca-unjbg-dev.tar  imagen de desarrollo (podman save)
#   - README.md, .env.example y docs/ del proyecto
#   - RESTORE.md con los pasos de restauracion
#   - SHA256SUMS
#
# Despues de esto se puede limpiar el host: ./scripts/cleanup-host.sh --dry-run

set -euo pipefail

cd "$(dirname "$0")/.."
source scripts/dev-env.sh

OUT_DIR="${OUT_DIR:-handover}"
STAMP="$(date +%Y%m%d_%H%M%S)"
DEST="$OUT_DIR/$STAMP"

mkdir -p "$DEST"
log "exportando a $DEST"

# --- 1. Base de datos --------------------------------------------------------

dump_db() {
  local container="$1"
  engine exec "$container" pg_dump \
    --clean --if-exists --no-owner --no-acl \
    -U "$DEV_DB_USER" -d "$DEV_DB_NAME" |
    gzip >"$DEST/nca_unjbg.sql.gz"
  gzip -t "$DEST/nca_unjbg.sql.gz"
}

if container_running "$DEV_DB_CONTAINER"; then
  log "respaldando base desde $DEV_DB_CONTAINER"
  dump_db "$DEV_DB_CONTAINER"
else
  warn "no hay contenedor de Postgres corriendo; se omite el dump"
fi

# --- 2. Imagenes -------------------------------------------------------------

save_image() {
  local image="$1"
  local name="$2"
  local target="$DEST/${name}.tar"

  if ! image_exists "$image"; then
    warn "imagen no encontrada, se omite: $image"
    return 0
  fi

  log "guardando imagen $image"
  if [ "$ENGINE" = "podman" ]; then
    engine save --format docker-archive -o "$target" "$image"
  else
    engine save -o "$target" "$image"
  fi
}

save_image "$DEV_IMAGE" "nca-unjbg-dev"
for image in ${EXTRA_IMAGES:-}; do
  safe_name="$(printf '%s' "$image" | tr '/:' '--')"
  save_image "$image" "$safe_name"
done

# --- 3. Media procesada ------------------------------------------------------

# Las noticias guardan rutas /media/...; sin estas imagenes el sitio restaurado
# queda con portadas rotas. No se exporta .wa-auth (credenciales del telefono).
if [ -d "$REPO_ROOT/public/media" ] && [ -n "$(ls -A "$REPO_ROOT/public/media" 2>/dev/null)" ]; then
  log "empaquetando public/media"
  tar czf "$DEST/media.tar.gz" -C "$REPO_ROOT" public/media
else
  warn "public/media esta vacio; no se incluye"
fi

# --- 4. Documentacion y plantillas ------------------------------------------

cp "$REPO_ROOT/README.md" "$DEST/README.md"
cp "$REPO_ROOT/.env.example" "$DEST/.env.example"
cp -r "$REPO_ROOT/docs" "$DEST/docs"
cp "$REPO_ROOT/Dockerfile.dev" "$DEST/Dockerfile.dev"
cp -r "$REPO_ROOT/deploy" "$DEST/deploy"

cat >"$DEST/RESTORE.md" <<'EOF'
# Restauracion de NCA UNJBG

Esta carpeta es una entrega autocontenida: codigo fuente, documentacion, dump de
la base e imagen de desarrollo.

## Requisitos

- Podman (o Docker) instalado. Es el unico software de sistema necesario.
- El codigo fuente del proyecto (repositorio git).

## Pasos

1. Cargar la imagen:

   ```bash
   podman load -i nca-unjbg-dev.tar
   ```

2. Copiar el proyecto y crear el entorno:

   ```bash
   cp .env.example .env    # completar AUTH_SECRET e INGEST_API_KEY
   ./scripts/dev-up.sh
   ```

3. Restaurar la base (con el entorno ya arriba):

   ```bash
   gunzip -c nca_unjbg.sql.gz | podman exec -i nca-unjbg-dev-db \
     psql -v ON_ERROR_STOP=1 -U unjbg -d nca_unjbg
   ```

4. Restaurar las imagenes procesadas (si viene `media.tar.gz`):

   ```bash
   tar xzf media.tar.gz -C .
   ```

5. Verificar:

   ```bash
   curl http://127.0.0.1:3000/api/health
   ```

## Si se elimino el motor de contenedores

La aplicacion necesita Podman o Docker para correr. Reinstalar Podman
(`sudo dnf install podman`) y volver al paso 1. La imagen y el dump permiten
restaurar sin conexion a internet.

## Alternativa sin contenedor

Con Node 22 instalado: `npm ci --legacy-peer-deps`, `npx prisma migrate deploy`,
`npx prisma db seed` y `npm run dev`, apuntando `DATABASE_URL` a un Postgres 16.
EOF

# --- 5. Checksums ------------------------------------------------------------

(
  cd "$DEST"
  if command -v sha256sum >/dev/null 2>&1; then
    find . -maxdepth 1 -type f ! -name SHA256SUMS -printf '%P\n' |
      sort | xargs sha256sum >SHA256SUMS
  fi
)

log "exportacion completa"
du -sh "$DEST" | sed 's/^/  tamano: /'
ls -1 "$DEST" | sed 's/^/  - /'
