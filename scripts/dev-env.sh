#!/usr/bin/env bash
# Configuracion compartida de los scripts de desarrollo en contenedor (Fase 8.0).
#
# Se carga con `source scripts/dev-env.sh`; no se ejecuta directamente.
# Todos los valores se pueden sobreescribir desde el entorno:
#
#   DEV_APP_PORT=3001 ./scripts/dev-up.sh
#   DEV_SELINUX=disable ./scripts/dev-up.sh

DEV_NETWORK="${DEV_NETWORK:-nca-unjbg-dev-net}"

DEV_DB_CONTAINER="${DEV_DB_CONTAINER:-nca-unjbg-dev-db}"
DEV_APP_CONTAINER="${DEV_APP_CONTAINER:-nca-unjbg-dev-app}"
DEV_WA_CONTAINER="${DEV_WA_CONTAINER:-nca-unjbg-dev-wa}"

DEV_IMAGE="${DEV_IMAGE:-nca-unjbg-dev:latest}"
DEV_DB_IMAGE="${DEV_DB_IMAGE:-docker.io/library/postgres:16-alpine}"

DEV_PGDATA_VOLUME="${DEV_PGDATA_VOLUME:-nca-unjbg-dev-pgdata}"
DEV_NODE_MODULES_VOLUME="${DEV_NODE_MODULES_VOLUME:-nca-unjbg-dev-node-modules}"
DEV_NEXT_VOLUME="${DEV_NEXT_VOLUME:-nca-unjbg-dev-next}"

DEV_APP_PORT="${DEV_APP_PORT:-3000}"
DEV_DB_PORT="${DEV_DB_PORT:-5433}"

DEV_DB_NAME="${DEV_DB_NAME:-nca_unjbg}"
DEV_DB_USER="${DEV_DB_USER:-unjbg}"
DEV_DB_PASSWORD="${DEV_DB_PASSWORD:-unjbg_dev_password}"

# Bases de datos de la Fase 8.1 (tests).
DEV_TEST_DB="${DEV_TEST_DB:-nca_unjbg_test}"
DEV_E2E_DB="${DEV_E2E_DB:-nca_unjbg_e2e}"

DEV_UID="${DEV_UID:-$(id -u)}"
DEV_GID="${DEV_GID:-$(id -g)}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Motor de contenedores: Podman tiene prioridad sobre Docker.
if command -v podman >/dev/null 2>&1; then
  ENGINE=podman
elif command -v docker >/dev/null 2>&1; then
  ENGINE=docker
else
  echo "error: se necesita podman o docker instalado" >&2
  exit 1
fi

log() { printf '\033[1;34m[dev]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[dev]\033[0m %s\n' "$*" >&2; }
die() {
  printf '\033[1;31m[dev]\033[0m %s\n' "$*" >&2
  exit 1
}

engine() { "$ENGINE" "$@"; }

container_exists() { engine inspect "$1" >/dev/null 2>&1; }

container_running() {
  [ "$(engine inspect -f '{{.State.Running}}' "$1" 2>/dev/null)" = "true" ]
}

volume_exists() { engine volume inspect "$1" >/dev/null 2>&1; }
network_exists() { engine network inspect "$1" >/dev/null 2>&1; }
image_exists() { engine image inspect "$1" >/dev/null 2>&1; }

# Podman rootless: mapea el UID del host al del contenedor para que los archivos
# del bind mount no cambien de dueno.
USERNS_ARGS=()
if [ "$ENGINE" = "podman" ]; then
  USERNS_ARGS=(--userns=keep-id)
fi

# `podman exec -it` falla cuando no hay TTY (scripts, CI). Solo se pide
# interactividad si la hay.
EXEC_TTY_ARGS=()
if [ -t 0 ] && [ -t 1 ]; then
  EXEC_TTY_ARGS=(-it)
fi

# SELinux: en Fedora/RHEL el bind mount necesita la etiqueta :Z, que relabela el
# repo la primera vez. Con DEV_SELINUX=disable se desactiva la etiqueta del
# contenedor en su lugar (menos aislamiento, sin tocar el host).
SELINUX_ARGS=()
BIND_SUFFIX=""
case "${DEV_SELINUX:-auto}" in
  disable)
    SELINUX_ARGS=(--security-opt label=disable)
    warn "SELinux desactivado para el contenedor (DEV_SELINUX=disable)"
    ;;
  enforce)
    BIND_SUFFIX=":Z"
    ;;
  auto)
    if [ "$(getenforce 2>/dev/null || echo Disabled)" = "Enforcing" ]; then
      BIND_SUFFIX=":Z"
    fi
    ;;
  *)
    die "DEV_SELINUX invalido: ${DEV_SELINUX} (auto|enforce|disable)"
    ;;
esac

# URL interna (nombre de contenedor) que usa la app dentro de la red.
dev_database_url() {
  printf 'postgresql://%s:%s@%s:5432/%s?schema=public' \
    "$DEV_DB_USER" "$DEV_DB_PASSWORD" "$DEV_DB_CONTAINER" "${1:-$DEV_DB_NAME}"
}

random_b64() { head -c 32 /dev/urandom | base64 -w0; }
random_hex() { head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }

# Lee .env y escribe .env.container con los valores efectivos del contenedor.
#
# No se hace `source .env` (seria ejecutar codigo arbitrario) ni se pasa
# `--env-file .env` directo (cada motor interpreta las comillas distinto).
write_container_env() {
  local src="$REPO_ROOT/.env"
  local dst="$REPO_ROOT/.env.container"
  local -A vars=()
  local line key val

  if [ -f "$src" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
      line="${line#"${line%%[![:space:]]*}"}"
      line="${line%"${line##*[![:space:]]}"}"
      case "$line" in
        '' | \#*) continue ;;
      esac
      line="${line#export }"
      key="${line%%=*}"
      val="${line#*=}"
      key="${key//[[:space:]]/}"
      [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
      if [ "${#val}" -ge 2 ]; then
        case "$val" in
          \"*\") val="${val:1:${#val}-2}" ;;
          \'*\') val="${val:1:${#val}-2}" ;;
        esac
      fi
      vars["$key"]="$val"
    done <"$src"
  fi

  # Overrides: dentro del contenedor la base es el contenedor de Postgres y el
  # scheduler/worker quedan apagados para no salir a internet sin querer.
  vars[NODE_ENV]="${CONTAINER_NODE_ENV:-development}"
  vars[PORT]="3000"
  vars[DATABASE_URL]="$(dev_database_url)"
  vars[ENABLE_ADAPTER_SCHEDULER]="${ENABLE_ADAPTER_SCHEDULER:-false}"
  vars[ENABLE_WHATSAPP_WORKER]="false"
  vars[WA_AUTH_DIR]="/app/.wa-auth"
  vars[WA_MEDIA_DIR]="/app/public/media/whatsapp"
  vars[NEXT_TELEMETRY_DISABLED]="1"

  {
    echo "# Generado por scripts/dev-up.sh a partir de .env. NO editar a mano."
    for key in "${!vars[@]}"; do
      printf '%s=%s\n' "$key" "${vars[$key]}"
    done
  } >"$dst"
  chmod 600 "$dst"
}

# Crea .env a partir de .env.example y completa los secretos vacios.
ensure_env_file() {
  local env_file="$REPO_ROOT/.env"

  if [ ! -f "$env_file" ]; then
    cp "$REPO_ROOT/.env.example" "$env_file"
    log "creado .env a partir de .env.example"
  fi

  if grep -qE '^AUTH_SECRET=(""|)$' "$env_file"; then
    sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=\"$(random_b64)\"|" "$env_file"
    log "AUTH_SECRET generado"
  fi
  if grep -qE '^INGEST_API_KEY=(""|)$' "$env_file"; then
    sed -i "s|^INGEST_API_KEY=.*|INGEST_API_KEY=\"$(random_hex)\"|" "$env_file"
    log "INGEST_API_KEY generada"
  fi
}
