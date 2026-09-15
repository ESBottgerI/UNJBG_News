# UNJBG News

Compilador automático de noticias de Tacna y la región desde diferentes fuentes
(WhatsApp Channels, grupos de WhatsApp, Facebook y sitios web), con estilo
clásico ~2010 y panel de moderación.

El plan completo está en [`docs/plan.md`](docs/plan.md).

## Estado del proyecto

**Fase 0 (fundación) — en curso:**

- App Next.js 16 + TypeScript
- Docker Compose (Postgres 16 + app + nginx)
- Registry de fuentes (Prisma, tabla `sources`)
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
- Health-check: http://localhost:3000/api/health
- Navegar la BD (fuentes): `npm run db:studio`

## Comandos útiles

| Comando                 | Qué hace                                   |
|-------------------------|--------------------------------------------|
| `npm run dev`           | App en desarrollo (hot reload)             |
| `npm run build`         | Build de produccion                         |
| `npm run lint`          | ESLint                                     |
| `npm run typecheck`     | Verifica tipos de TypeScript               |
| `npm run db:migrate`    | Crea/lleva al dia las migraciones          |
| `npm run db:seed`       | Carga fuentes de ejemplo                   |
| `npm run db:studio`     | UI de exploracion de la BD                 |

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
  lib/            Utilidades compartidas (prisma, etc.)
prisma/           Schema + migraciones + seed
deploy/           nginx.conf, certificados
compose.yaml      Servicios Docker (db siempre; app+web perfil "full")
Dockerfile        Build standalone de la app
docs/plan.md      Plan de proyecto completo
```