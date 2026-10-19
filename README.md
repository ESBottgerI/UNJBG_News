# UNJBG News

Compilador automático de noticias de Tacna y la región desde diferentes fuentes
(WhatsApp Channels, grupos de WhatsApp, Facebook y sitios web), con estilo
clásico ~2010 y panel de moderación.

El plan completo está en [`docs/plan.md`](docs/plan.md).

## Estado del proyecto

**Fase 4 (WhatsApp) — implementado y pendiente de prueba con el numero real:**

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

## Requisitos

- Node.js 22+ y npm
- Docker Engine + Compose (para la base de datos). Si solo tenés Podman,
  levantar `db` con: `podman compose up -d db`.

## Puesta en marcha (desarrollo local)

```bash
# 1. Copiar env y ajustar si hace falta
cp .env.example .env

# 2. Levantar la base de datos (Postgres 16 en Docker)
docker compose up -d db

# 3. Instalar dependencias
npm install

#    bajar el navegador que usa Playwright (necesario para el adaptador de Facebook)
npx playwright install chromium

# 4. Crear las tablas + cargar fuentes de ejemplo
npm run db:setup

# 5. Correr la app
npm run dev
```

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
| `npm run db:migrate` | Crea/lleva al dia las migraciones |
| `npm run db:seed` | Carga ejemplos (fuentes, admin, categorias, items) |
| `npm run db:studio` | UI de exploracion de la BD |
| `npm run adapters:run -- <fuente>` | Corre el adaptador de una fuente al instante |
| `npm run whatsapp:pair` | Empareja el bot con WhatsApp (QR o codigo) |
| `npm run whatsapp:chats` | Lista chats y resuelve el JID de un canal por link |
| `npm run whatsapp:start` | Arranca el worker de WhatsApp (lee grupos/canales) |

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

## Despliegue en VPS (producción, Fase 7+)

```bash
docker compose --profile full up -d --build
```

Levanta `db` + `app` (Next standalone) + `web` (nginx, puertos 80/443).
El certificado HTTPS se coloca en `deploy/certs/`. Las imágenes procesadas
viven en el volumen `media` (servido por nginx en `/media/`).

## Estructura

```
src/
  app/            Rutas (publico + panel admin + API)
  app/actions/    Server actions (auth + moderacion/CRUD)
  app/admin/      Panel de moderacion (login, cola, noticias, categorias, fuentes)
  lib/            Utilidades compartidas (prisma, auth, format)
  proxy.ts        Guard de /admin (redirige al login si no hay sesion)
prisma/           Schema + migraciones + seed
scripts/          CLI: run-adapter, whatsapp-pair, whatsapp-chats, whatsapp-worker
src/whatsapp/     Session, normalizacion y worker de Baileys
deploy/           nginx.conf, certificados
compose.yaml      Servicios Docker (db siempre; app+web perfil "full")
Dockerfile        Build standalone de la app
docs/plan.md      Plan de proyecto completo
```