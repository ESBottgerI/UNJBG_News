# Fase 7. Robustez, observabilidad y despliegue

Documento de la Fase 7 del proyecto **UNJBG News**. El plan y las fases estan en
`plan.md`; la arquitectura, en `04-arquitectura.md`.

Rama: `feat/hardening` (basada en `feat/public-site`, que contiene las fases 0 a 6).

## 7.1 Alcance

El plan pide: limites de peticiones, alertas de error, respaldo automatico de la
base de datos y endurecimiento del despliegue en el VPS. Todo eso esta
implementado y se verifico en local con la base de datos real del proyecto.

## 7.2 Limites de peticiones

Archivo: `src/lib/rate-limit.ts`. Ventana fija por clave, en memoria del proceso.

| Donde | Clave | Limite por defecto | Variable |
|---|---|---|---|
| `POST /api/ingest` | IP | 120 por minuto | `INGEST_RATE_LIMIT_PER_MIN` |
| `GET /api/search` | IP | 60 por minuto | `SEARCH_RATE_LIMIT_PER_MIN` |
| Login del admin | IP + email | 5 en 15 minutos | `LOGIN_RATE_LIMIT_ATTEMPTS`, `LOGIN_RATE_LIMIT_WINDOW_MIN` |

- Al superar el limite se responde `429` con `Retry-After`.
- Un login exitoso limpia el contador de esa IP+email.
- El estado vive en memoria: alcanza para un solo proceso Node (nuestro VPS).
  Si algun dia la app corre en varias instancias, hay que moverlo a Postgres.

## 7.3 Reintentos y throttling de adaptadores

Archivo: `src/adapters/utils/http.ts`.

- Backoff exponencial con jitter (evita que varias fuentes reintenten a la vez).
- Respeta la cabecera `Retry-After` (segundos o fecha HTTP) cuando el sitio
  responde `429`/`5xx`, con un tope de 30 s.
- `config.requestDelayMs` por fuente agrega una pausa entre articulos del mismo
  sitio (util para medios chicos que bloquean rafagas).

## 7.4 Logs y salud

- `src/lib/logger.ts`: una linea JSON por evento (`ts`, `level`, `event` y
  campos como `sourceId`, `durationMs`, `newItems`). Nivel con `LOG_LEVEL`
  (`debug`, `info`, `warn`, `error`; por defecto `info`).
- `SourceRun` guarda el historial de corridas: estado, items, duplicados,
  duracion y error.
- `Source` agrega `lastSuccessAt`, `lastDurationMs` y `consecutiveFailures`.
- `/api/health` devuelve:

  ```json
  {
    "status": "ok | degraded",
    "db": "ok",
    "queue": { "pendingRaw": 0, "draftPosts": 0 },
    "sources": { "active": 4, "failing": 0 },
    "scheduler": { "enabled": true, "stale": false, "lastRunAt": "...", "lastError": null },
    "uptimeSeconds": 120
  }
  ```

  - `degraded` si el scheduler lleva mas de `HEALTH_SCHEDULER_STALE_MIN`
    minutos sin correr o si hay fuentes con `consecutiveFailures >= ALERT_AFTER_FAILURES`.
  - Con `?strict=1` responde `503` cuando esta degradado, para monitores externos.
  - Si la base no responde, siempre `503`.
- El panel `/admin/sources` muestra ultimo exito, duracion, fallos seguidos y el
  ultimo error de cada fuente.

## 7.5 Alertas

Archivo: `src/lib/alerts.ts`. Nunca lanza: si el envio falla, solo se registra.

Se configura con cualquiera de estas dos vias (o ambas):

- `ALERT_WEBHOOK_URL`: endpoint que reciba JSON (Slack, Discord, Mattermost...).
- `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`.

Se envia una alerta cuando una fuente falla `ALERT_AFTER_FAILURES` veces
seguidas (default 3) y otra cuando se recupera. La alerta de fallo se dispara
solo al cruzar el umbral, no en cada fallo posterior.

## 7.6 Respaldos

Scripts:

- `npm run db:backup`: genera `backups/unjbg_<fecha>.sql.gz`, valida el gzip y
  borra los respaldos mas viejos que `BACKUP_RETENTION_DAYS` (default 14).
  Detecta el contenedor `unjbg-db` con Podman o Docker; si no, usa `pg_dump` del
  host con `DATABASE_URL`.
- `FORCE=1 npm run db:restore -- backups/archivo.sql.gz`: restaura con
  `psql -v ON_ERROR_STOP=1`. El respaldo incluye `DROP ... IF EXISTS`, asi que
  reemplaza los objetos existentes.

Variables: `BACKUP_DIR` (default `backups`), `BACKUP_RETENTION_DAYS`,
`DB_CONTAINER` (default `unjbg-db`), `POSTGRES_USER`, `POSTGRES_DB`.

Ejemplo de cron diario a las 03:00 en el VPS:

```cron
0 3 * * * cd /srv/unjbg-news && BACKUP_DIR=/var/backups/unjbg /usr/bin/npm run db:backup >> /var/log/unjbg-backup.log 2>&1
```

Alternativa con systemd: un `.service` que ejecute el script y un `.timer` con
`OnCalendar=*-*-* 03:00:00`.

Para copia fuera del VPS, sincronizar `BACKUP_DIR` con `rclone` o `restic`.
No se implementa aca porque depende de credenciales del proveedor elegido.

## 7.7 Despliegue en el VPS

`docker compose --profile full up -d --build` levanta:

| Servicio | Funcion |
|---|---|
| `db` | PostgreSQL 16, volumen `pgdata`, `container_name: unjbg-db` |
| `app` | Next.js standalone, scheduler de adaptadores, volumen `media` |
| `worker` | Worker de WhatsApp (Baileys), volumenes `media` y `wauth` |
| `web` | Nginx: proxy a `app` y media estatica en `/media/` |

Cambios de esta fase:

- `app` recibe el `.env` completo (`env_file`), no solo `DATABASE_URL`.
- `worker` usa un target propio del `Dockerfile` (necesita `tsx` y el codigo,
  no el standalone). La sesion de WhatsApp persiste en el volumen `wauth`.
- Healthcheck HTTP del servicio `app` contra `/api/health`.
- Limites de log de Docker (`10m`, 3 archivos) para no llenar el disco.
- `deploy/nginx.conf`: `server_tokens off`, headers de seguridad, gzip y
  timeouts de proxy. Incluye un bloque HTTPS de ejemplo para certbot/caddy.

Checklist antes de exponer el sitio:

1. Copiar `.env.example` a `.env` y completar `AUTH_SECRET`, `INGEST_API_KEY`,
   `SITE_URL` y `POSTGRES_PASSWORD`.
2. Usar un numero SIM dedicado para el worker de WhatsApp (no el personal).
3. Configurar HTTPS y descomentar el bloque `443`.
4. Programar el respaldo diario y probar una restauracion.
5. Activar un monitor externo contra `/api/health?strict=1`.
6. Firewall: permitir solo 22, 80 y 443.

## 7.8 Limitaciones conocidas

- **Facebook en Docker**: el adaptador usa Playwright con Chromium. La imagen
  actual (Alpine) no instala el navegador. Para produccion con fuentes FACEBOOK
  hay que construir la imagen sobre una base Debian e instalar
  `npx playwright install --with-deps chromium`, o correr los adaptadores de
  Facebook en un worker aparte con el navegador instalado. En local funciona
  porque el navegador se instala en la maquina.
- **Rate limit en memoria**: no se comparte entre procesos ni sobrevive reinicios.
- **Grupos privados de Facebook**: siguen fuera de alcance (requieren sesion).
- **Historial de migraciones**: la base de desarrollo tenia una migracion de
  fase 5 que no estaba en el repositorio. Se reconcilio eliminando esa fila de
  `_prisma_migrations` y agregando `imageMeta`/`thumbnailUrl` con `IF NOT EXISTS`
  en la migracion de la fase 7. Una instalacion nueva queda completa.

## 7.9 Verificacion realizada

- `npm run typecheck`: sin errores.
- `npm run lint`: sin errores ni advertencias.
- `npm run build`: correcto.
- `/api/health` real devuelve `status: ok`, cola y fuentes.
- Limite de busqueda probado: con `SEARCH_RATE_LIMIT_PER_MIN=3`, la cuarta
  peticion responde `429`.
- `npm run db:backup` genera un `.sql.gz` valido.
- `FORCE=1 npm run db:restore` restaura ese respaldo; conteos y
  `prisma migrate status` quedan consistentes.
- `prisma migrate status`: las 7 migraciones estan aplicadas.
