# Desarrollo en contenedor

Guia del entorno de desarrollo de **UNJBG News** en contenedores (Fase 8.0).
El objetivo es que el host solo necesite **Podman** (o Docker) y un editor:
Node, npm, Prisma, Chromium y todas las dependencias viven dentro de la imagen.

El plan y las fases estan en [`plan.md`](plan.md).

## Idea general

Una imagen OCI no es "un ejecutable de produccion": es un sistema de archivos
empaquetado mas un comando de arranque. La imagen de desarrollo aporta el
toolchain y **el codigo se monta desde el host** con un bind mount, asi que el
hot reload sigue funcionando igual que con `npm run dev` en el host.

| Modo | Imagen | Codigo | Comando |
|---|---|---|---|
| Produccion | `Dockerfile` (build standalone) | Copiado, inmutable | `node server.js` |
| Desarrollo | `Dockerfile.dev` (toolchain) | Bind mount del repo | `npm run dev` |
| Tests | La misma de desarrollo | Bind mount del repo | `vitest` / `playwright test` |

## Requisitos

- Podman 4+ (probado con 5.8) o Docker.
- Un editor en el host.
- Nada mas. Node no es necesario en el host.

## Inicio rapido

```bash
cp .env.example .env      # si todavia no existe
./scripts/dev-up.sh
```

La primera vez construye la imagen (varios minutos) y, si la base es nueva,
carga los datos de ejemplo. Al terminar:

- App: <http://127.0.0.1:3000>
- Admin: <http://127.0.0.1:3000/admin>
- Health: <http://127.0.0.1:3000/api/health>
- Postgres: `127.0.0.1:5433` (base `unjbg_news`)

## Comandos

| Comando | Que hace |
|---|---|
| `./scripts/dev-up.sh` | Crea red y volumenes, levanta Postgres y la app |
| `./scripts/dev-up.sh --seed` | Ademas carga/refresca los datos de ejemplo |
| `./scripts/dev-down.sh` | Detiene y borra los contenedores (conserva volumenes) |
| `./scripts/dev-down.sh --volumes` | Ademas borra los volumenes |
| `./scripts/dev-shell.sh` | Shell interactivo dentro de la app |
| `./scripts/dev-shell.sh npm run typecheck` | Comando puntual |
| `./scripts/dev-logs.sh [app\|db\|wa]` | Sigue logs |
| `./scripts/dev-rebuild.sh` | Reconstruye la imagen y levanta |
| `./scripts/dev-reset.sh` | Borra volumenes y arranca de cero |
| `./scripts/dev-db-init.sh` | Crea las bases de test |
| `./scripts/dev-test.sh [unit\|integration\|e2e]` | Corre la suite (Fase 8.1) |
| `./scripts/dev-whatsapp-pair.sh` | Muestra el QR de WhatsApp |
| `./scripts/dev-whatsapp-start.sh` | Arranca el worker de WhatsApp |
| `./scripts/export-handover.sh` | Exporta base + imagenes + docs |
| `./scripts/cleanup-host.sh --dry-run` | Muestra que se borraria del host |

## Como funciona

### Contenedores

| Nombre | Imagen | Puertos |
|---|---|---|
| `unjbg-dev-db` | `postgres:16-alpine` | `127.0.0.1:5433` |
| `unjbg-dev-app` | `unjbg-news-dev:latest` | `127.0.0.1:3000` |
| `unjbg-dev-wa` | `unjbg-news-dev:latest` | — |

Se publican en `127.0.0.1` a proposito: no quedan accesibles desde la red.
El puerto de Postgres es 5433 para no chocar con el contenedor `unjbg-db` que
pueda existir de antes.

### Volumenes

| Volumen | Montado en | Para que |
|---|---|---|
| `unjbg-dev-pgdata` | `/var/lib/postgresql/data` | Datos de Postgres |
| `unjbg-dev-node-modules` | `/app/node_modules` | Dependencias del contenedor |
| `unjbg-dev-next` | `/app/.next` | Cache de build de Next |
| *(bind)* repo | `/app` | Codigo fuente |

`node_modules` va en un volumen nombrado y no en el bind mount: asi los
binarios nativos (`sharp`, Playwright) son los del contenedor y no se mezclan
con los del host. En el primer arranque Podman copia el contenido de la imagen
al volumen nuevo.

### Variables de entorno

`dev-up.sh` lee `.env` y genera `.env.container` con los valores efectivos
dentro del contenedor. Las diferencias con el host son:

| Variable | Host | Contenedor |
|---|---|---|
| `DATABASE_URL` | `localhost:5432` | `unjbg-dev-db:5432` |
| `ENABLE_ADAPTER_SCHEDULER` | segun `.env` | `false` |
| `ENABLE_WHATSAPP_WORKER` | segun `.env` | `false` |
| `WA_AUTH_DIR` | `./.wa-auth` | `/app/.wa-auth` |

`.env.container` se regenera en cada `dev-up.sh`; no hay que editarlo.

El scheduler y el worker quedan apagados por defecto para que el entorno no
salga a internet sin querer. Para una corrida puntual de un adaptador:

```bash
./scripts/dev-shell.sh npm run adapters:run -- "UNJBG OCIM (Imagen)"
```

### Migraciones

El entrypoint espera a Postgres, ejecuta `prisma migrate deploy` y
`prisma generate` antes de arrancar. Para crear una migracion nueva durante el
desarrollo:

```bash
./scripts/dev-shell.sh npm run db:migrate
```

## SELinux y Podman rootless

- En Fedora/RHEL con SELinux en `Enforcing`, el repo se monta con `:Z`. La
  primera vez Podman reetiqueta el directorio, lo que puede tardar unos
  segundos.
- Si el reetiquetado molesta o el host no lo permite:

  ```bash
  DEV_SELINUX=disable ./scripts/dev-up.sh
  ```

  Eso desactiva la etiqueta del contenedor en vez de tocar el host.
- `--userns=keep-id` mantiene el UID/GID del host dentro del contenedor, asi
  los archivos que se creen (media, `.wa-auth`) siguen siendo tuyos.

## WhatsApp

```bash
./scripts/dev-whatsapp-pair.sh     # QR en la terminal
./scripts/dev-whatsapp-start.sh    # worker en segundo plano
./scripts/dev-logs.sh wa
```

La sesion queda en `./.wa-auth` y las imagenes en `./public/media`, ambos
dentro del repo, asi que sobreviven a reinicios y reconstrucciones. El worker
corre en un contenedor aparte porque Baileys necesita un socket persistente que
no sobrevive a los hot reloads de Next.

## Tests

Las bases `unjbg_news_test` y `unjbg_news_e2e` viven en el mismo Postgres y se
crean con `deploy/postgres-init/01-test-dbs.sql` (primer arranque) o con
`./scripts/dev-db-init.sh`.

```bash
./scripts/dev-test.sh unit
./scripts/dev-test.sh integration
./scripts/dev-test.sh e2e
```

Cada modo inyecta el `DATABASE_URL` de su base. La suite aborta si la URL no
contiene `_test` o `_e2e`, para que nunca escriba en la base de desarrollo.

Para E2E, `dev-test.sh` carga `prisma/seed.e2e.ts` y levanta un segundo
`next dev` en el puerto **3100** con `distDir=.next-e2e` y la base
`unjbg_news_e2e`, en paralelo al servidor de desarrollo de 3000. Así los tests
no compiten por el lock de `.next` ni ensucian la base de desarrollo.

El detalle de la suite (unitarios, integración, E2E y CI) está en
[fase-8-calidad.md](fase-8-calidad.md).

## Problemas comunes

| Sintoma | Causa / solucion |
|---|---|
| `address already in use` en 3000 | Otro `npm run dev` en el host. Cerrarlo o `DEV_APP_PORT=3001 ./scripts/dev-up.sh` |
| `permission denied` al escribir en el repo | `DEV_SELINUX=disable` o revisar que `--userns=keep-id` este activo (solo Podman) |
| La app arranca sin tablas | `./scripts/dev-shell.sh npm run db:migrate` |
| `node_modules` desactualizado | `./scripts/dev-rebuild.sh` |
| Chromium no arranca | `./scripts/dev` logs; la imagen ya trae las libs, revisar `PLAYWRIGHT_BROWSERS_PATH` |
| El hot reload no detecta cambios | Ver `fs.inotify.max_user_watches`; en Fedora suele alcanzar con 200k |
| Postgres no levanta | `./scripts/dev-logs.sh db`; si el volumen quedo corrupto, `./scripts/dev-reset.sh` |

## Entrega y limpieza

Antes de borrar nada:

```bash
./scripts/export-handover.sh
```

Genera `handover/<fecha>/` con el dump, la imagen en `.tar`, `public/media`
empaquetado, la documentacion y un `RESTORE.md`. Despues:

```bash
./scripts/cleanup-host.sh --dry-run          # ver que se borraria
./scripts/cleanup-host.sh --yes              # ejecutar
./scripts/cleanup-host.sh --yes --playwright --npm-cache
```

El script nunca ejecuta `sudo` ni borra paquetes del sistema: imprime el comando
sugerido (`sudo dnf remove nodejs22`). Tampoco toca `backups/`, `handover/` ni
el contenedor previo `unjbg-db` salvo que se pidan explicitamente.

Sin Podman o Docker la aplicacion no corre. Si se elimina el motor, conservar
el `.tar` y el dump: `podman load` restaura la imagen cuando haga falta.
