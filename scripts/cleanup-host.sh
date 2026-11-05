#!/usr/bin/env bash
# Limpia del host todo lo que instalo el entorno de desarrollo (Fase 8.0).
#
#   ./scripts/cleanup-host.sh                 # solo muestra que haria (dry-run)
#   ./scripts/cleanup-host.sh --dry-run       # idem, explicito
#   ./scripts/cleanup-host.sh --yes           # ejecuta
#   ./scripts/cleanup-host.sh --yes --playwright --npm-cache
#
# Por defecto NO borra:
#   - backups/ ni handover/ (usar --include-backups)
#   - ~/.cache/ms-playwright (usar --playwright)
#   - ~/.npm/_cacache (usar --npm-cache)
#   - paquetes del sistema (nunca; imprime el comando sugerido)

set -euo pipefail

cd "$(dirname "$0")/.."
source scripts/dev-env.sh

EXECUTE=0
INCLUDE_PLAYWRIGHT=0
INCLUDE_NPM_CACHE=0
INCLUDE_BACKUPS=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) EXECUTE=0 ;;
    --yes | -y) EXECUTE=1 ;;
    --playwright) INCLUDE_PLAYWRIGHT=1 ;;
    --npm-cache) INCLUDE_NPM_CACHE=1 ;;
    --include-backups) INCLUDE_BACKUPS=1 ;;
    -h | --help)
      sed -n '2,18p' "$0"
      exit 0
      ;;
    *)
      die "opcion desconocida: $arg"
      ;;
  esac
done

if [ "$EXECUTE" != 1 ]; then
  log "modo dry-run: no se borra nada (agregar --yes para ejecutar)"
fi

# --- Contenedores, red, volumenes e imagenes --------------------------------

for name in "$DEV_WA_CONTAINER" "$DEV_APP_CONTAINER" "$DEV_DB_CONTAINER"; do
  if container_exists "$name"; then
    if [ "$EXECUTE" = 1 ]; then
      log "borrando contenedor $name"
      engine stop "$name" >/dev/null 2>&1 || true
      engine rm -f "$name" >/dev/null 2>&1 || true
    else
      echo "  contenedor: $name"
    fi
  fi
done

for vol in "$DEV_PGDATA_VOLUME" "$DEV_NEXT_VOLUME" "$DEV_NODE_MODULES_VOLUME"; do
  if volume_exists "$vol"; then
    if [ "$EXECUTE" = 1 ]; then
      log "borrando volumen $vol"
      engine volume rm -f "$vol" >/dev/null 2>&1 || true
    else
      echo "  volumen:    $vol"
    fi
  fi
done

if network_exists "$DEV_NETWORK"; then
  if [ "$EXECUTE" = 1 ]; then
    log "borrando red $DEV_NETWORK"
    engine network rm "$DEV_NETWORK" >/dev/null 2>&1 || true
  else
    echo "  red:        $DEV_NETWORK"
  fi
fi

if image_exists "$DEV_IMAGE"; then
  if [ "$EXECUTE" = 1 ]; then
    log "borrando imagen $DEV_IMAGE"
    engine rmi -f "$DEV_IMAGE" >/dev/null 2>&1 || true
  else
    echo "  imagen:     $DEV_IMAGE"
  fi
fi

# --- Artefactos del proyecto ------------------------------------------------

PATHS=(
  "$REPO_ROOT/node_modules"
  "$REPO_ROOT/.next"
  "$REPO_ROOT/public/media"
  "$REPO_ROOT/.wa-auth"
  "$REPO_ROOT/coverage"
  "$REPO_ROOT/playwright-report"
  "$REPO_ROOT/test-results"
  "$REPO_ROOT/tsconfig.tsbuildinfo"
  "$REPO_ROOT/.env.container"
)

if [ "$INCLUDE_BACKUPS" = 1 ]; then
  PATHS+=("$REPO_ROOT/backups" "$REPO_ROOT/handover")
fi

if [ "$INCLUDE_PLAYWRIGHT" = 1 ]; then
  PATHS+=("$HOME/.cache/ms-playwright")
fi

if [ "$INCLUDE_NPM_CACHE" = 1 ]; then
  PATHS+=("$HOME/.npm/_cacache")
fi

TOTAL_KB=0
for path in "${PATHS[@]}"; do
  [ -e "$path" ] || continue
  size_kb="$(du -sk "$path" 2>/dev/null | cut -f1)"
  TOTAL_KB=$((TOTAL_KB + size_kb))
  human="$(du -sh "$path" 2>/dev/null | cut -f1)"
  if [ "$EXECUTE" = 1 ]; then
    log "borrando $path ($human)"
    rm -rf -- "$path"
  else
    echo "  ruta:       $path ($human)"
  fi
done

# --- Resumen ----------------------------------------------------------------

if [ "$EXECUTE" = 1 ]; then
  log "limpieza completada"
  engine system df 2>/dev/null || true
else
  printf '\n  espacio recuperable en artefactos (aprox): %s MB\n' "$((TOTAL_KB / 1024))"
  printf '\n  para ejecutar:  ./scripts/cleanup-host.sh --yes\n'
  printf '  incluir navegadores y cache de npm:\n'
  printf '                  ./scripts/cleanup-host.sh --yes --playwright --npm-cache\n'
fi

cat <<'EOF'

  Nota: los paquetes del sistema no se tocan automaticamente.
  Si ya no se va a desarrollar en esta maquina y se exporto la entrega:

    sudo dnf remove nodejs22        # Fedora
    sudo apt remove nodejs npm      # Debian/Ubuntu

  Podman/Docker no se borran: sin un motor de contenedores la app no corre.
EOF
