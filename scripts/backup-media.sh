#!/usr/bin/env bash
# Respaldo del volumen de imagenes (media) en produccion.
#
# Uso:
#   npm run db:backup:media
#   BACKUP_DIR=/var/backups/nca-unjbg MEDIA_VOLUME=nca-unjbg_media npm run db:backup:media
#
# El volumen por defecto es nca-unjbg_media (proyecto docker compose en
# /srv/nca-unjbg). Ajustalo con MEDIA_VOLUME si el proyecto se llama distinto.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
MEDIA_VOLUME="${MEDIA_VOLUME:-nca-unjbg_media}"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/media_${STAMP}.tar.gz"

if ! command -v docker >/dev/null 2>&1; then
  echo "error: docker no disponible" >&2
  exit 1
fi

if ! docker volume inspect "$MEDIA_VOLUME" >/dev/null 2>&1; then
  echo "error: el volumen $MEDIA_VOLUME no existe" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

docker run --rm \
  -v "$MEDIA_VOLUME":/data:ro \
  -v "$BACKUP_DIR":/backup \
  alpine:3 tar czf "/backup/$(basename "$OUT")" -C /data .

gzip -t "$OUT"

find "$BACKUP_DIR" -maxdepth 1 -type f -name 'media_*.tar.gz' \
  -mtime +"$RETENTION_DAYS" -delete

echo "respaldo de media listo: $OUT ($(du -h "$OUT" | cut -f1))"
