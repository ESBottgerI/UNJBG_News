# NCA UNJBG

**News Center Access UNJBG** — compilador automático de noticias de Tacna y la
región desde diferentes fuentes
(WhatsApp Channels, grupos de WhatsApp, Facebook y sitios web), con estilo
clásico ~2010 y panel de moderación.

## Estado del proyecto

**Fases 0 a 8.1 implementadas y verificadas en local** (rama `feat/hardening`):

- App Next.js 16 + TypeScript
- Docker Compose (Postgres 16 + app + nginx)
- Registry de fuentes (Prisma, tabla `sources`)
- Modelos de Fase 1: `users`, `categories`, `raw_items`, `posts`
  (dedup por `sourceId+externalId` y hash de contenido)
- Panel de moderacion en `/admin`: login con sesion firmada (`AUTH_SECRET`),
  cola de revision (aprobar/editar/descartar), noticias, categorias y fuentes
- API de ingesta `POST /api/ingest` (contrato para los adaptadores)
- Health-check de la BD en `/api/health`
- **Adaptadores (Fase 2)**: UNJBG (API JSON del portal), sitemap generico
  (Cheerio) y RSS. Scheduler con `node-cron` (cada 1 min revisa fuentes debidas)
  y boton "Probar ahora" en `/admin/sources`.
- **Adaptador FACEBOOK (Fase 3)**: Playwright sobre paginas publicas sin sesion
  (UNJBG OCIM y UNJBG CU). Dedup por id del post/permalink. Grupos privados
  quedan pausados (requieren sesion, Fase 4).
- **WhatsApp (Fase 4)**: worker con Baileys sobre grupos y canales. Corre como
  proceso aparte (`npm run whatsapp:start`), empareja con QR o codigo
  (`npm run whatsapp:pair`) y descubre los chats (`npm run whatsapp:chats`).
  Solo lee: nunca envia mensajes. Los mensajes caen al mismo pipeline de
  moderacion que los adaptadores web.
- **Robustez (Fase 7)**: limites de peticiones, logs estructurados, historial
  de salud por fuente, alertas por webhook/Telegram, `/api/health` ampliado,
  respaldos de base de datos y despliegue endurecido (worker + nginx).
- **Entorno de desarrollo (Fase 8.0)**: imagen Podman con el toolchain completo
  (Node 22, Prisma, Chromium) y scripts `dev-*` para levantar app + base sin
  instalar nada en el host.
- **Tests y CI (Fase 8.1)**: 100 tests unitarios, 80 de integración contra
  Postgres y 17 E2E con Playwright, más GitHub Actions en cada PR. Incluye la
  corrección del XSS almacenado en la aprobación de la cola.

## Requisitos

**Con contenedores (recomendado):** solo Podman 4+ (o Docker) y un editor.
Node, npm, Prisma, Chromium y las dependencias viven dentro de la imagen de
desarrollo.

**Sin contenedores:** Node.js 22+, npm y un Postgres 16 accesible.

## Puesta en marcha con contenedores

```bash
cp .env.example .env      # completar AUTH_SECRET e INGEST_API_KEY si hace falta
./scripts/dev-up.sh
```

La primera vez construye la imagen (`Dockerfile.dev`) y carga los datos de
ejemplo. Al terminar:

- App: http://localhost:3000
- Panel admin: http://localhost:3000/admin (credenciales demo en `prisma/seed.ts`)
- Health-check: http://localhost:3000/api/health
- Postgres: `127.0.0.1:5433` (base `nca_unjbg`)

El codigo se monta desde el host, asi que el hot reload funciona igual que con
`npm run dev`. Para entrar al contenedor:

```bash
./scripts/dev-shell.sh                          # bash
./scripts/dev-shell.sh npm run db:studio        # comando puntual
./scripts/dev-logs.sh                           # logs de la app
./scripts/dev-down.sh                           # bajar
```

La guia completa (SELinux, volumenes, WhatsApp, tests, problemas comunes) se
incluye en el paquete de entrega (`handover/`).

## Puesta en marcha sin contenedores

```bash
cp .env.example .env

# Postgres 16 (docker o podman; no hace falta compose)
docker run -d --name nca-unjbg-db -p 5432:5432 \
  -e POSTGRES_USER=unjbg -e POSTGRES_PASSWORD=unjbg_dev_password \
  -e POSTGRES_DB=nca_unjbg -v nca-unjbg-pgdata:/var/lib/postgresql/data \
  postgres:16-alpine

npm ci --legacy-peer-deps
npx playwright install chromium
npm run db:setup
npm run dev
```

> `podman compose` falla si no hay un proveedor instalado. Los scripts
> `scripts/dev-*.sh` no lo necesitan: usan Podman directamente.

- App: http://localhost:3000
- Panel admin: http://localhost:3000/admin (credenciales demo en `prisma/seed.ts`)
- Health-check: http://localhost:3000/api/health
- Navegar la BD (fuentes): `npm run db:studio`

> Variable `AUTH_SECRET` en `.env` firma las sesiones del admin; `INGEST_API_KEY`
> protege `POST /api/ingest` (se envian con header `x-ingest-key`). Generar con
> `openssl rand -base64 32`.

## Comandos útiles

| Comando | Qué hace |
|-------------------------|--------------------------------------------|
| `npm run dev` | App en desarrollo (hot reload) |
| `npm run build` | Build de produccion |
| `npm run lint` | ESLint |
| `npm run typecheck` | Verifica tipos de TypeScript |
| `npm run test:unit` | Tests unitarios (Vitest, sin base) |
| `npm run test:integration` | Tests de integración (base `*_test`) |
| `npm run test:e2e` | E2E con Playwright (base `*_e2e`) |
| `npm run db:migrate` | Crea/lleva al dia las migraciones |
| `npm run db:seed` | Carga ejemplos (fuentes, admin, categorias, items) |
| `npm run db:studio` | UI de exploracion de la BD |
| `npm run adapters:run -- <fuente>` | Corre el adaptador de una fuente al instante |
| `npm run whatsapp:pair` | Empareja el bot con WhatsApp (QR o codigo) |
| `npm run whatsapp:chats` | Lista chats y resuelve el JID de un canal por link |
| `npm run whatsapp:start` | Arranca el worker de WhatsApp (lee grupos/canales) |
| `npm run db:backup` | Genera un respaldo `.sql.gz` de la base |
| `FORCE=1 npm run db:restore -- <archivo>` | Restaura un respaldo (sobreescribe la base) |
| `npm run dev:up` | Levanta app + base en contenedores (Podman) |
| `npm run dev:down` | Baja el entorno en contenedores |
| `npm run dev:shell` | Shell dentro del contenedor de la app |
| `npm run dev:test` | Corre la suite de tests en el contenedor |
| `npm run dev:handover` | Exporta imagen + dump + docs para la entrega |

## Tests y CI

```bash
./scripts/dev-test.sh unit          # Vitest, sin base de datos
./scripts/dev-test.sh integration   # Postgres real (nca_unjbg_test)
./scripts/dev-test.sh e2e           # Playwright (nca_unjbg_e2e)
./scripts/dev-test.sh               # unitarios + integración
```

Las bases de test son separadas y los tests abortan si `DATABASE_URL` no
contiene `_test` o `_e2e`. El E2E local levanta un segundo `next dev` en el
puerto 3100 con `distDir=.next-e2e`, así no interfiere con el servidor de
desarrollo de 3000.

El CI (`.github/workflows/ci.yml`) corre lint, tipos, unitarios, integración y
E2E en cada PR usando servicios de Postgres 16.

## Adaptadores

Cada fuente se ingiere con un adaptador según su tipo y `source.config`:

- **WEB** con `config.adapter: "unjbg"` → lee la API JSON del portal UNJBG
  (listado + detalle) sin navegador.
- **WEB** genérico → leer `sitemap.xml` y extrae OpenGraph/JSON-LD con Cheerio.
- **RSS** → descarga el feed y lo parsea con `rss-parser`.
- **FACEBOOK** → Playwright abre la página pública sin sesión, recoge las
  publicaciones del muro y las manda al pipeline con dedup (id del post/permalink).
  Los grupos privados devuelven un error claro (requieren sesión, Fase 4).
- **WHATSAPP** → Worker aparte (Baileys): escucha mensajes de grupos y canales
  configurados con su `chatId`. Solo lee. Usa backfill de 24 h para grupos
  al conectar. Canal WhatsApp: sin historial confiable. Los nuevos mensajes van
  directo a `raw_items` para moderacion.

Probar una fuente al instante: `npm run adapters:run -- "UNJBG OCIM (Imagen)"`.

El scheduler (`src/instrumentation.ts`) corre cada minuto y procesa las fuentes
que hayan cumplido su `pollIntervalMinutes`. Puede desactivarse con
`ENABLE_ADAPTER_SCHEDULER=false`.

## WhatsApp (Fase 4)

El bot de WhatsApp corre en un **proceso aparte** porque usa una conexión WebSocket
persistente que no sobrevive a los hot-reloads de Next.js. Es solo lectura: nunca
envia mensajes.

### Configuracion

Las variables relacionadas a WhatsApp viven en `.env.example`:
- `WA_AUTH_DIR=./.wa-auth` — guarda la sesion (si lo borras, hay que emparejar de nuevo)
- `WA_PHONE` — codigo pais + numero, sin + ni guiones (opcional, para codigo de 8 digitos)
- `WA_BROWSER_NAME="Google Chrome"` — nombre que aparece en "Dispositivos vinculados" (debe ser un nombre real)
- `WA_BACKFILL_HOURS=24` — solo grupos
- `WA_MEDIA_DIR=public/media/whatsapp` — donde se guardan las imagenes
- `ENABLE_WHATSAPP_WORKER=true` — desactiva el worker si hace falta

### Emparejar y descubrir chats

```bash
# 1. Levantar la base de datos y tener .env configurado
cp .env.example .env
docker compose up -d db
npm run db:setup

# 2. Emparejar con WhatsApp
npm run whatsapp:pair
# Se mostrara un QR; escanealo desde el celular (Ajustes > Dispositivos vinculados > Vincular dispositivo)
# Si definiste WA_PHONE en .env, se ofrecera un codigo de 8 digitos en su lugar

# 3. Ver la lista de chats para obtener los JIDs
npm run whatsapp:chats
# Para un canal cuyo link conoces:
npm run whatsapp:chats -- https://whatsapp.com/channel/0029...
```

Anota el `chatId` (JID, ej. `123456789-987654321@g.us` o `120363...@newsletter`)
y pegalo en `config.chatId` de la fuente en `/admin/sources`. Deja la fuente en
`ACTIVE` para que el worker la escuche.

### Escuchar mensajes

```bash
# (requiere sesion ya guardada en .wa-auth)
npm run whatsapp:start
```

Notas:
- **Grupos** (`@g.us`): al conectar se recupera el historial de las ultimas
  `WA_BACKFILL_HOURS` horas. Solo pesan a la cola mensajes no vistos antes
  (dedup por `(sourceId, externalId)`).
- **Canales** (`@newsletter`): **no hay historial confiable** (no llega por
  `messaging-history.set`). Solo veras nuevos mensajes a partir del momento en
  que el worker este conectado.
- Solo mensajes no propios. No se descargan audios/animaciones por decision de
  simplicidad: entran si llevan texto o imagen.
- Las imagenes se guardan en `public/media/whatsapp/` con hash SHA256 y se
  referencian como `/media/whatsapp/<hash>.jpg` en el payload.

## Probar la ingesta (Fase 2+ llega por adaptadores; hoy se usa para QA)

```bash
INGEST_KEY=$(grep '^INGEST_API_KEY=' .env | cut -d'"' -f2)

curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-ingest-key: $INGEST_KEY" \
  -d '{"sourceName":"DigitalTacna","sourceType":"WEB","externalId":"demo-qa-1","title":"Prueba","body":"Cuerpo de prueba"}'

# Re-enviar el mismo externalId devuelve duplicate:true (dedup por fuente)
```

## Despliegue en VPS (producción)

```bash
docker compose --profile full up -d --build
```

Levanta `db` + `app` (Next standalone + scheduler) + `worker` (WhatsApp, volumen
`wauth` para la sesion) + `web` (nginx, puertos 80/443). El certificado HTTPS se
coloca en `deploy/certs/`. Las imágenes procesadas viven en el volumen `media`
(servido por nginx en `/media/`).

Antes de exponerlo: completar `.env`, usar un numero SIM dedicado para WhatsApp,
activar HTTPS y programar `npm run db:backup`. El checklist completo y las
limitaciones conocidas se incluyen en el paquete de entrega.

## Estructura

```
src/
  app/            Rutas (publico + panel admin + API)
  app/actions/    Server actions (auth + moderacion/CRUD)
  app/admin/      Panel de moderacion (login, cola, noticias, categorias, fuentes)
  lib/            Utilidades compartidas (prisma, auth, format)
  proxy.ts        Guard de /admin (redirige al login si no hay sesion)
prisma/           Schema + migraciones + seed
scripts/          CLI: run-adapter, whatsapp-*, backup-db, restore-db, dev-*
src/whatsapp/     Session, normalizacion y worker de Baileys
src/lib/          Logger, rate-limit, alertas, config y acceso a datos
deploy/           nginx.conf, certificados, postgres-init (bases de test)
compose.yaml      Servicios Docker (db siempre; app+worker+web perfil "full")
Dockerfile        Build standalone de la app + target worker (WhatsApp)
Dockerfile.dev    Imagen de desarrollo (toolchain + Chromium)
```