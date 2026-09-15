# UNJBG News

Compilador automático de noticias de Tacna y la región desde diferentes fuentes
(WhatsApp Channels, grupos de WhatsApp, Facebook y sitios web), con estilo
clásico ~2010 y panel de moderación.

El plan completo está en [`docs/plan.md`](docs/plan.md).

## Estado del proyecto

**Fase 1 (modelo de datos + panel admin) — en curso:**

- App Next.js 16 + TypeScript
- Docker Compose (Postgres 16 + app + nginx)
- Registry de fuentes (Prisma, tabla `sources`)
- Modelos de Fase 1: `users`, `categories`, `raw_items`, `posts`
  (dedup por `sourceId+externalId` y hash de contenido)
- Panel de moderacion en `/admin`: login con sesion firmada (`AUTH_SECRET`),
  cola de revision (aprobar/editar/descartar), noticias, categorias y fuentes
- API de ingesta `POST /api/ingest` (contrato para los adaptadores de Fase 2)
- Health-check de la BD en `/api/health`

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

| Comando                 | Qué hace                                   |
|-------------------------|--------------------------------------------|
| `npm run dev`           | App en desarrollo (hot reload)             |
| `npm run build`         | Build de produccion                         |
| `npm run lint`          | ESLint                                     |
| `npm run typecheck`     | Verifica tipos de TypeScript               |
| `npm run db:migrate`    | Crea/lleva al dia las migraciones          |
| `npm run db:seed`       | Carga ejemplos (fuentes, admin, categorias, items) |
| `npm run db:studio`     | UI de exploracion de la BD                 |

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
deploy/           nginx.conf, certificados
compose.yaml      Servicios Docker (db siempre; app+web perfil "full")
Dockerfile        Build standalone de la app
docs/plan.md      Plan de proyecto completo
```