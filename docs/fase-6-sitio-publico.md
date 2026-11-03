# Fase 6. Sitio publico

Documento de documentacion del proyecto **UNJBG News**. Describe el sitio publico
entregado en la Fase 6. El plan y las fases estan en `plan.md`; el contexto, en
`01-introduccion.md`; la arquitectura, en `04-arquitectura.md`.

Rama: `feat/public-site` (basada en `feat/pipeline-search`, Fase 5).

## 6.1 Alcance

El plan pide un "sitio publico estilo 2010: header minimo + secciones, feed
central, ads en sidebar, ficha de noticia, sitemap, SEO".

Todo eso esta implementado. Ademas se agrego busqueda full-text, paginacion y
"Lo mas leido" con contador de visitas, porque el feed y la ficha los necesitan
para no quedar vacios.

## 6.2 Rutas

Todas las paginas publicas viven en el route group `(public)`, comparten el
mismo shell (header + footer) y se renderizan en el servidor.

| Ruta | Archivo | Que muestra |
|---|---|---|
| `/` | `src/app/(public)/page.tsx` | Portada: nota principal, rejilla de noticias, paginacion |
| `/seccion/[slug]` | `src/app/(public)/seccion/[slug]/page.tsx` | Listado por categoria, con titulo y paginacion |
| `/noticias/[id]` | `src/app/(public)/noticias/[id]/page.tsx` | Ficha: breadcrumb, metadatos, imagen, cuerpo, relacionadas |
| `/buscar` | `src/app/(public)/buscar/page.tsx` | Busqueda full-text por `?q=` |
| `/sitemap.xml` | `src/app/sitemap.ts` | Home, secciones y noticias publicadas |
| `/robots.txt` | `src/app/robots.ts` | Permite el sitio, bloquea `/admin` y `/api` |

- `/noticias/[id]` solo devuelve noticias con `status = PUBLISHED`. Un borrador o
  rechazado da 404 aunque se conozca la URL.
- Las paginas son `dynamic = "force-dynamic"`: el build de Docker no necesita la
  base de datos y el contenido siempre es fresco (el pipeline publica solo).
- Hay un 404 con el shell publico (`(public)/not-found.tsx`) y otro global para
  las rutas fuera del sitio (`src/app/not-found.tsx`).

## 6.3 Layout

Esquema de tres columnas, sin leaderboard ni anuncio superior (decision del
proyecto: el header queda limpio).

| Zona | Contenido |
|---|---|
| Columna izquierda | Bloque "Secciones" arriba y una torre 160x600 debajo |
| Centro | Feed: nota principal + rejilla de tarjetas + paginacion |
| Columna derecha | "Lo mas leido" arriba y dos cajas 300x250 debajo |

- Menos de 1024px: una sola columna. Se oculta la columna izquierda y "Lo mas
  leido" baja debajo del feed.
- Desde 1280px el listado central pasa a **dos columnas** de tarjetas y la nota
  principal ocupa las dos.
- El contenedor es **fluido** (`.site-shell`): ocupa el ancho de la pantalla con
  margen proporcional (`padding-inline: clamp(16px, 2vw, 48px)`) y un tope de
  1800px que solo actua en monitores ultrawide. El encabezado, el contenido y el
  pie comparten la misma clase para quedar alineados.
- La ficha de noticia limita el texto a `48rem` de ancho (medida de lectura
  comoda) y reparte el espacio sobrante entre las columnas.
- Los anuncios son **placeholders**: un solo componente `AdSlot` con las
  variantes `tall` (160x600) y `box` (300x250). Es el unico punto donde se
  inyecta el script de AdSense cuando se active.

Los estilos de la grilla estan en `src/app/globals.css`
(`.site-shell`, `.pub-grid`, `.pub-grid--no-left`, `.pub-grid--article`,
`.feed-grid`).

## 6.4 Capa de datos publica

`src/lib/posts.ts` concentra las consultas del sitio. Todas filtran
`status = PUBLISHED`:

- `listPublished` (paginado, opcional por categoria)
- `getPublishedPost`, `getRelated`
- `getMostRead` (ordena por `views` y, en empate, por fecha)
- `listCategories`, `getCategoryBySlug`
- `searchPublished` (full-text en espanol)
- `incrementPostViews`

`listCategories` y `getPublishedPost` estan memoizadas con `cache()` de React
porque se llaman varias veces dentro del mismo request (layout, pagina y
metadata).

## 6.5 "Lo mas leido"

- La migracion `20261018120000_phase6_post_views` agrega `Post.views` e indice
  `(status, views)`.
- La ficha incrementa el contador dentro de `after()` de `next/server`, asi que
  no retrasa la respuesta.
- Mientras no haya visitas acumuladas, el orden por fecha hace que el bloque
  nunca quede vacio.

## 6.6 SEO

- `src/app/layout.tsx`: `metadataBase`, template de titulos, Open Graph y
  Twitter Card por defecto, `lang="es"`.
- Cada ruta define su `generateMetadata`/`metadata` con titulo, descripcion y
  canonical (`/`, `/seccion/<slug>`, `/noticias/<id>`).
- La ficha agrega Open Graph de tipo `article`. `SITE_URL` se configura por
  entorno (`.env.example`).
- `/buscar` queda fuera de los indices (`robots: { index: false }`), igual que
  `/admin` y `/api` en `robots.ts`.
- No hay `og:image` por noticia: se puede agregar mas adelante usando
  `imageMeta` del pipeline.

## 6.7 Busqueda

- `/buscar?q=` es server-rendered, sin JS de cliente; el buscador del header es
  un `<form>` GET. Con menos de 2 caracteres no consulta.
- `/api/search?q=` expone lo mismo para otros consumidores.
- Usa `websearch_to_tsquery` (tolera simbolos que `to_tsquery` rechaza) sobre el
  `tsvector` en espanol mantenido por trigger.

## 6.8 Verificacion

Ejecutado en la rama:

- `npm run typecheck`: sin errores.
- `npm run lint`: 0 errores y 0 advertencias.
- `npm run build`: OK; `/robots.txt` estatica, el resto dinamico; el build no
  necesita base de datos.
- Pruebas manuales contra `npm run dev`: `/`, `/seccion/local`,
  `/noticias/<id>`, `/buscar?q=tacna` responden 200; `/seccion/noexiste` y
  `/noticias/noexiste` responden 404; `sitemap.xml` y `robots.txt` correctos; el
  contador de visitas incrementa.
- Responsive medido con Playwright, sin desborde horizontal en `/`,
  `/seccion/local`, `/buscar` ni `/noticias/<id>`:

| Pantalla | Contenedor | Izq / Centro / Der | Feed |
| --- | --- | --- | --- |
| 1920x1080 | 1800 | 230 / 1055 / 380 | 2 columnas de 520 |
| 1600x900 | 1600 | 192 / 960 / 336 | 2 columnas de 472 |
| 1366x768 | 1366 | 170 / 794 / 306 | 2 columnas de 389 |
| 1280x800 | 1280 | 170 / 714 / 306 | 2 columnas de 349 |
| 1024x768 | 1024 | 170 / 475 / 306 | 1 columna |
| 390x844 | 390 | sin rail / 358 | 1 columna |

## 6.9 Decisiones

1. **Server rendering sin cliente**: el sitio publico no tiene estado de
   cliente; el buscador y la paginacion son formularios y enlaces.
2. **`<img>` plano** en tarjetas y ficha en vez de `next/image`: las imagenes ya
   vienen procesadas por el pipeline y no se guardan dimensiones exactas por
   noticia. La advertencia de lint queda desactivada con comentario en el punto
   de uso.
3. **Anuncios como placeholder**: AdSense exige dominio real y algo de trafico;
   se activa despues sin tocar el layout.
4. **Sin leaderboard**: decision del proyecto, el header queda limpio.
5. **Cache de navegacion**: al aprobar/publicar una noticia o editar categorias,
   las server actions revalidan `/` y `/buscar`.

## 6.10 Fuera de alcance

- AdSense real (requiere dominio y trafico).
- Miniaturas con relacion de aspecto exacta (se puede usar `imageMeta`).
- Feed RSS publico.
- Robustez (limites de peticiones, alertas y backups): es la Fase 7.
