#!/usr/bin/env bash
# Levanta el entorno de desarrollo completo en contenedores (Fase 8.0).
#
#   ./scripts/dev-up.sh             # db + app (carga el seed si la base es nueva)
#   ./scripts/dev-up.sh --seed      # fuerza la carga de datos de ejemplo
#   ./scripts/dev-up.sh --no-build  # falla si la imagen todavia no existe
#
# La app queda en http://127.0.0.1:3000 y el codigo se monta desde el host:
# editar un archivo dispara el hot reload de Next.

set -euo pipefail

cd "$(dirname "$0")/.."
source scripts/dev-env.sh

WANT_SEED=0
ALLOW_BUILD=1
for arg in "$@"; do
  case "$arg" in
    --seed) WANT_SEED=1 ;;
    --no-build) ALLOW_BUILD=0 ;;
    -h | --help)
      sed -n '2,10p' "$0"
      exit 0
      ;;
    *)
      die "opcion desconocida: $arg"
      ;;
  esac
done

engine info >/dev/null 2>&1 ||
  die "el motor de contenedores ($ENGINE) no responde"

# --- 1. Entorno y secretos ---------------------------------------------------

ensure_env_file
mkdir -p "$REPO_ROOT/public/media" "$REPO_ROOT/.wa-auth" "$REPO_ROOT/backups"
write_container_env

# --- 2. Red y volumenes ------------------------------------------------------

if ! network_exists "$DEV_NETWORK"; then
  log "creando red $DEV_NETWORK"
  engine network create "$DEV_NETWORK" >/dev/null
fi

PGDATA_WAS_NEW=0
if ! volume_exists "$DEV_PGDATA_VOLUME"; then
  PGDATA_WAS_NEW=1
  log "creando volumen $DEV_PGDATA_VOLUME"
  engine volume create "$DEV_PGDATA_VOLUME" >/dev/null
fi
for vol in "$DEV_NODE_MODULES_VOLUME" "$DEV_NEXT_VOLUME"; do
  if ! volume_exists "$vol"; then
    log "creando volumen $vol"
    engine volume create "$vol" >/dev/null
  fi
done

# --- 3. Postgres -------------------------------------------------------------

if container_running "$DEV_DB_CONTAINER"; then
  log "postgres ya esta corriendo"
elif container_exists "$DEV_DB_CONTAINER"; then
  log "iniciando postgres existente"
  engine start "$DEV_DB_CONTAINER" >/dev/null
else
  log "creando postgres ($DEV_DB_IMAGE)"
  # El script SQL del init crea las bases de test en el primer arranque; con un
  # volumen ya existente se aplica con ./scripts/dev-db-init.sh.
  INIT_OPTS="ro"
  [ "$BIND_SUFFIX" = ":Z" ] && INIT_OPTS="ro,Z"
  engine run -d \
    --name "$DEV_DB_CONTAINER" \
    --network "$DEV_NETWORK" \
    --network-alias "$DEV_DB_CONTAINER" \
    -e POSTGRES_USER="$DEV_DB_USER" \
    -e POSTGRES_PASSWORD="$DEV_DB_PASSWORD" \
    -e POSTGRES_DB="$DEV_DB_NAME" \
    -p "127.0.0.1:${DEV_DB_PORT}:5432" \
    -v "${DEV_PGDATA_VOLUME}:/var/lib/postgresql/data" \
    -v "$REPO_ROOT/deploy/postgres-init:/docker-entrypoint-initdb.d:${INIT_OPTS}" \
    --health-cmd "pg_isready -U $DEV_DB_USER -d $DEV_DB_NAME" \
    --health-interval 5s \
    --health-timeout 5s \
    --health-retries 12 \
    "$DEV_DB_IMAGE" >/dev/null
fi

log "esperando a postgres"
for _ in $(seq 1 60); do
  if engine exec "$DEV_DB_CONTAINER" \
    pg_isready -U "$DEV_DB_USER" -d "$DEV_DB_NAME" -q >/dev/null 2>&1; then
    break
  fi
  if ! container_running "$DEV_DB_CONTAINER"; then
    engine logs --tail=40 "$DEV_DB_CONTAINER" >&2 || true
    die "el contenedor de postgres se detuvo"
  fi
  sleep 1
done
engine exec "$DEV_DB_CONTAINER" \
  pg_isready -U "$DEV_DB_USER" -d "$DEV_DB_NAME" -q >/dev/null 2>&1 ||
  die "postgres no respondio en 60s"

# --- 4. Imagen ---------------------------------------------------------------

if ! image_exists "$DEV_IMAGE"; then
  [ "$ALLOW_BUILD" = 1 ] ||
    die "la imagen $DEV_IMAGE no existe; corre ./scripts/dev-rebuild.sh"
  log "construyendo $DEV_IMAGE (la primera vez tarda varios minutos)"
  engine build \
    -f Dockerfile.dev \
    --build-arg USER_UID="$DEV_UID" \
    --build-arg USER_GID="$DEV_GID" \
    -t "$DEV_IMAGE" .
fi

# --- 5. App --------------------------------------------------------------

# Se recrea siempre: asi toma cambios de .env.container, puertos y mounts.
engine rm -f "$DEV_APP_CONTAINER" >/dev/null 2>&1 || true

log "arrancando app en http://127.0.0.1:${DEV_APP_PORT}"
engine run -d \
  --name "$DEV_APP_CONTAINER" \
  --network "$DEV_NETWORK" \
  "${USERNS_ARGS[@]}" \
  "${SELINUX_ARGS[@]}" \
  --env-file "$REPO_ROOT/.env.container" \
  -p "127.0.0.1:${DEV_APP_PORT}:3000" \
  -v "$REPO_ROOT:/app${BIND_SUFFIX}" \
  -v "${DEV_NODE_MODULES_VOLUME}:/app/node_modules" \
  -v "${DEV_NEXT_VOLUME}:/app/.next" \
  "$DEV_IMAGE" >/dev/null ||
  die "no se pudo arrancar la app (¿puerto ${DEV_APP_PORT} ocupado?)"

HEALTHY=0
for _ in $(seq 1 150); do
  if engine exec "$DEV_APP_CONTAINER" node -e \
    'fetch("http://127.0.0.1:3000/api/health").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))' \
    >/dev/null 2>&1; then
    HEALTHY=1
    break
  fi
  if ! container_running "$DEV_APP_CONTAINER"; then
    engine logs --tail=60 "$DEV_APP_CONTAINER" >&2 || true
    die "el contenedor de la app se detuvo"
  fi
  sleep 1
done

if [ "$HEALTHY" != 1 ]; then
  engine logs --tail=80 "$DEV_APP_CONTAINER" >&2 || true
  die "la app no respondio en 150s; revisa ./scripts/dev-logs.sh"
fi

# --- 6. Datos de ejemplo -----------------------------------------------------

if [ "$WANT_SEED" = 1 ] || [ "$PGDATA_WAS_NEW" = 1 ]; then
  log "cargando datos de ejemplo (seed)"
  engine exec "$DEV_APP_CONTAINER" npm run db:seed
fi

log "listo"
cat <<EOF

  App:    http://127.0.0.1:${DEV_APP_PORT}
  Admin:  http://127.0.0.1:${DEV_APP_PORT}/admin
  Health: http://127.0.0.1:${DEV_APP_PORT}/api/health
  DB:     127.0.0.1:${DEV_DB_PORT} (base ${DEV_DB_NAME})

  Logs:   ./scripts/dev-logs.sh
  Shell:  ./scripts/dev-shell.sh
  Tests:  ./scripts/dev-test.sh
  Bajar:  ./scripts/dev-down.sh

EOF
