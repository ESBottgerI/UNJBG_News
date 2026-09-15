# UNJBG News — Plan de Proyecto

## 1. Que es esto?

Un sitio de noticias que **compila automaticamente** contenido desde varias fuentes
(WhatsApp Channels, grupos de WhatsApp, Facebook y sitios web), mostrado con un
estilo clasico ~2010: header minimo con secciones, feed de noticias al centro y
publicidad (Google AdSense) a los lados.

- Curacion **hibrida**: fuentes de confianza publican solas; el resto pasa por una
  cola de moderacion (revisar / editar / publicar / rechazar) en un panel admin.
- Escala media: **20-100 fuentes**.
- Fase 1 en **local** con el numero personal de WhatsApp; fase 2 en **VPS** (Docker).

## 2. Pila tecnologica

| Capa          | Eleccion                   | Por que |
|---------------|----------------------------|---------|
| Idioma todo   | **Node.js + TypeScript**   | La unica forma estandar de conectar WhatsApp web (Baileys) es Node. TypeScript protege a principiantes de errores de *typos* al detectar tipos en caliente. |
| Web app       | **Next.js (App Router)**   | Una sola app sirve: el sitio publico (HTML servido, bueno para SEO/AdSense), el panel admin y la API de ingesta. |
| Web scraping  | **Playwright + Cheerio**   | Playwright abre el navegador con sesion iniciada (para grupos privados de FB); Cheerio es liviano para sitios de noticias normales. |
| WhatsApp      | **Baileys**                | Libreria Node que se conecta como dispositivo WhatsApp Web (escanea un QR). Escucha en vivo mensajes de grupos donde este el numero y canales que siga. |
| Base de datos | **PostgreSQL 16**          | Guarda payloads crudos en JSONB, busqueda full-text en espanol (`tsvector`), indices unicos para dedup. Sin Redis que administrar. |
| Imagenes      | **sharp**                  | Redimensiona/recomprime portadas a ~1 MB. |
| Scheduler     | **node-cron**              | Un solo proceso, intervalos por fuente (WhatsApp/FB casi en vivo; sitios cada 10-30 min). |
| Despliegue    | **Docker Compose**         | `app` + `postgres` + `nginx` en un VPS barato (~US$10/mes). |

> Glosario para novatos, en la seccion 11.

## 3. Arquitectura

```
[Fuentes: sitios web / RSS / Facebook / WhatsApp]
          |  un adaptador por fuente
          v
 [API de ingesta] -> PostgreSQL "raw_items"
          |          (dedup por fuente+id_externo + hash de contenido)
          v
 [Pipeline] -- descarga de fotos -> sharp -> limpieza HTML -> categoria -> espanol
          v
 [Cola de moderacion: borrador/publico/rechazado]
          |   fuente de confianza = publica sola; otras = esperan admin
          v
 [Sitio publico Next.js]  <-  [Panel admin (aprobar/editar/descartar)]
```

**Reglas hibridas:** cada fuente tiene un flag `autopublish=true/false`.
- `true` -> la noticia sale sola tras un retardo de unos minutos.
- `false` -> aparece en la bandeja "Revisar" del admin; ahi se edita titular/imagen o se rechaza.

**Dedup (evitar dobles):**
- Indice unico en `(source_id, external_id)`.
- Fuzzy match de titulos (pg_trgm) para no duplicar la misma nota de 4 fuentes.

## 4. Modelo de datos (resumen)

- `sources` — tipo (web/fb/whatsapp/rss), credenciales, `autopublish`, intervalo.
- `raw_items` — payload crudo por fuente (JSONB) + estado (nuevo/procesado/descartado).
- `posts` — noticia final: titulo, cuerpo HTML limpio, imagen, categoria, autor/fuente, fechas.
- `categories` — secciones del header (Local, UNJBG, Regional, Nacional, Deportes...).
- `users` — staff del panel admin (BetterAuth, login simple).

## 5. Fases de implementacion

| Fase | Que entrega | Tiempo aprox |
|------|-------------|--------------|
| 0 | Repo, Docker Compose, config de entorno, registro de fuentes | 2-3 dias |
| 1 | Modelo de datos + panel admin (colas de revision, editar/descartar, login) | 5-7 dias |
| 2 | Adaptadores web: framework + 2-3 sitios reales (sitemap->Cheerio, Playwright si hace falta) + RSS | 5-7 dias |
| 3 | Adaptador Facebook: Graph API publico, luego Playwright con sesion para grupos privados | 4-6 dias |
| 4 | Adaptador WhatsApp: sesion Baileys, listener de canales + grupos, imagenes | 4-6 dias |
| 5 | Pipeline final: sharp, sanitizacion, categorias por palabras, busqueda en espanol | 3-4 dias |
| 6 | Sitio publico estilo 2010: header minimo + secciones, feed central, ads en sidebar, ficha de noticia, sitemap, SEO | 4-6 dias |
| 7 | Robustez: limites de peticiones, alertas de error, backup automatico de BD | 2-3 dias |

**Total estimado: ~1.5-2 meses** trabajando medio tiempo.

## 6. WhatsApp — detalles y riesgos (importante)

- **Local (ahora):** se conecta con el numero personal usando Baileys — se escanea un QR
  y la app escucha los mensajes nuevos de los grupos donde este el numero y los canales que siga.
- **Produccion:** NO mantener el numero personal vinculado en un VPS 24/7 — alto riesgo de
  baneo y se rompe el uso de WhatsApp en el celular personal. Usar en su lugar una
  **SIM dedicada** (prepago, ~US$1-2/mes) solo en el VPS.
- El bot solo lee lo que el numero ya puede ver (sus propios grupos/canales), no implica "hacking".
- Las fotos/media se descargan apenas llegan -> aunque el bot sea baneado, lo recolectado
  queda guardado en Postgres.
- Plan B si WhatsApp bloquea: un **grupo "alimentador"** — los responsables reenvian
  contenido ahi y el bot lo toma. Riesgo cero.

## 7. Facebook — detalles y riesgos

- **Publico:** primero intentar **Graph API** (gratis, permitido) para paginas publicas.
- **Privado (grupos):** Playwright con un navegador con sesion iniciada (perfil de bot
  aprobado como miembro). Riesgo de cambios en los detectores de sesion / terminos de uso,
  por eso el plan contempla permisos y deteccion de fallos con alerta.
- Mantener IP estable o rotacion por proxy para evitar bloqueos.

## 8. Publicidad (Google AdSense)

- Slot **leaderboard** arriba, **cajas** en sidebar y **tarjeta in-feed**.
- AdSense exige web real y algo de trafico -> primera fase solo **placeholder** preparado;
  la monetizacion se activa despues.

## 9. Hosting / despliegue

- Fase local: `docker compose up` en la maquina de desarrollo.
- VPS: mismo Docker, volumen de disco para imagenes, `nginx` para servir media + HTTPS
  (certbot / caddy), backup diario de Postgres.
- Sin costos de nube por uso: todo en un solo VPS.

## 10. Supuestos / decisiones

1. Next.js para todo (publico + admin + API) -> menos piezas que mover.
2. WhatsApp local con el numero personal (valido para desarrollo/borrador).
3. Contenido en espanol; secciones: Local / UNJBG / Regional / Nacional / Otros.
4. En produccion se usara un numero SIM dedicado solo para el bot.

## 11. Glosario para el equipo (sin experiencia en JS)

- **Node.js** — un "runner" que ejecuta JavaScript en el servidor (no solo en el navegador).
- **TypeScript** — JavaScript + tipos; muchos errores se avisan antes de correr.
- **Next.js** — framework web: paginas + panel admin + API todo en uno.
- **Playwright** — navegador automatizado por codigo (hace clics, ve paginas).
- **Cheerio** — lector rapido de HTML (scraping "liviano").
- **Baileys** — libreria para hablar con WhatsApp Web por codigo.
- **PostgreSQL** — base de datos relacional (tablas).
- **Docker Compose** — define y levanta todos los servicios (app + BD + web) con un comando.
- **VPS** — servidor virtual dedicado donde "corre" el proyecto las 24 h.
- **AdSense** — plataforma de Google para poner publicidad y cobrar por visitas.
- **Dedup** — evitar que la misma noticia salga publicada mas de una vez.