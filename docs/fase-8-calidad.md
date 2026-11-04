# Fase 8.1 — Tests y CI

Suite automatizada de UNJBG News: tests unitarios, de integración contra
Postgres real, E2E con Playwright y verificación en GitHub Actions. Cierra la
Fase 8 junto con el entorno de desarrollo en contenedor
([desarrollo-en-contenedor.md](desarrollo-en-contenedor.md)).

## Resumen

| Nivel | Herramienta | Base de datos | Cantidad |
|-------|-------------|---------------|----------|
| Unitarios | Vitest 5 | No usa | 100 tests / 14 archivos |
| Integración | Vitest 5 + Prisma | `unjbg_news_test` | 80 tests / 7 archivos |
| E2E | Playwright + Chromium | `unjbg_news_e2e` | 17 tests / 3 archivos |
| CI | GitHub Actions | Postgres 16 (service) | 2 jobs |

La suite completa corre en local dentro del contenedor de desarrollo y en CI
sobre runners de GitHub. El CI **no** usa la imagen de desarrollo: instala las
dependencias con `npm ci` y usa los servicios nativos de Postgres.

## Cómo correrla

### En el contenedor (recomendado)

```bash
./scripts/dev-test.sh unit
./scripts/dev-test.sh integration
./scripts/dev-test.sh e2e
./scripts/dev-test.sh              # unitarios + integración
```

`dev-test.sh` crea/migra la base correspondiente, inyecta el `DATABASE_URL` y
ejecuta el comando dentro de `unjbg-dev-app`. Para E2E además:

- carga `prisma/seed.e2e.ts`;
- levanta un segundo `next dev` en el puerto **3100** con `distDir=.next-e2e`,
  para no pelear por el lock de `.next` con el servidor de desarrollo de 3000;
- apunta Playwright a `http://127.0.0.1:3100`.

El servidor de 3000 sigue usando `unjbg_news`; el de 3100 usa
`unjbg_news_e2e`. Los datos de la suite no se mezclan con los de desarrollo.

### Sin contenedor

Con Node 22 y un Postgres accesible:

```bash
npm ci --legacy-peer-deps
npx prisma generate

# Unitarios
npm run test:unit

# Integración (la URL debe terminar en _test)
DATABASE_URL="postgresql://unjbg:unjbg_dev_password@localhost:5432/unjbg_news_test?schema=public" \
  npx prisma migrate deploy
DATABASE_URL="postgresql://unjbg:unjbg_dev_password@localhost:5432/unjbg_news_test?schema=public" \
  npm run test:integration

# E2E (la URL debe terminar en _e2e)
export DATABASE_URL="postgresql://unjbg:unjbg_dev_password@localhost:5432/unjbg_news_e2e?schema=public"
npx prisma migrate deploy
npm run db:seed:e2e
npx playwright install chromium
npm run build
npm run test:e2e        # Playwright arranca `npm run start` en 3000
```

### Comandos de `package.json`

| Comando | Qué hace |
|---------|----------|
| `npm run test` | Unitarios + integración |
| `npm run test:unit` | Solo unitarios |
| `npm run test:integration` | Solo integración (Postgres real) |
| `npm run test:watch` | Vitest en modo watch (unitarios) |
| `npm run test:coverage` | Unitarios con cobertura V8 en `coverage/` |
| `npm run test:e2e` | Playwright (`playwright test`) |
| `npm run db:seed:e2e` | Carga el seed E2E (solo base `*_e2e`) |

## Organización de los tests

```
tests/
  unit/              Funciones puras y adaptadores con fetch mockeado
  integration/       Módulos reales contra Postgres
  e2e/               Flujos completos en Chromium
  helpers/db.ts      Factories + TRUNCATE entre tests
  helpers/sources.ts Helpers de adaptadores
  setup/integration.ts Guard de base de datos
vitest.unit.config.mts
vitest.integration.config.mts
playwright.config.ts
prisma/seed.e2e.ts
```

### Unitarios

Cubren sin red ni base de datos:

- saneamiento de HTML y categorización (`sanitize`, `categorize`);
- formato de fechas/textos y parámetros de búsqueda;
- `rate-limit`, `config`, hash/verificación de contraseñas;
- normalización de WhatsApp (texto, imágenes, timestamps);
- descarga/validación de nombres de archivo de media;
- adaptadores `unjbg`, `web` (sitemap), `rss`, `facebook` e `index`
  (selección de adaptador) con `fetch` mockeado.

Configuración: `vitest.unit.config.mts`, entorno `node`, cobertura V8 sobre
`src/lib/**`, `src/adapters/**` y `src/whatsapp/**`.

### Integración

Usan el cliente Prisma real contra `unjbg_news_test`:

| Archivo | Qué cubre |
|---------|-----------|
| `ingest.test.ts` | Dedup por `sourceId+externalId`, payload normalizado, fuentes por nombre/tipo |
| `pipeline.test.ts` | `processRawItem` / `processAllNew`: borrador vs autopublish, saneamiento, categorías, imágenes, `searchVector` |
| `posts.test.ts` | Listados públicos, paginación, filtros, búsqueda full-text, visitas |
| `runner.test.ts` | Runner de adaptadores: ingesta, fallos, alertas, historial `SourceRun`, fuentes vencidas |
| `api.test.ts` | Route handlers `/api/ingest`, `/api/search`, `/api/health` y sus límites |
| `session.test.ts` | Firma/expiración de sesión, `requireUser`, `requireAdmin` |
| `admin-actions.test.ts` | Server actions de moderación (incluye regresión XSS) |

Decisiones:

- **Serial**: `fileParallelism: false` y `sequence.concurrent: false`, porque
  cada test hace `TRUNCATE` y no deben pisarse entre archivos.
- **Aislamiento**: `resetDatabase()` vacía `Post`, `RawItem`, `SourceRun`,
  `Source`, `Category` y `User` antes de cada test.
- **Guard**: `tests/setup/integration.ts` aborta si `DATABASE_URL` no contiene
  `_test` o `_e2e`. Es la protección contra borrar la base de desarrollo.
- Las descargas de imágenes se mockean (`@/lib/media/image`) para no depender
  de la red.

### E2E

Playwright con Chromium, `workers: 1` y `fullyParallel: false`:

| Archivo | Qué cubre |
|---------|-----------|
| `api.spec.ts` | `/api/health`, `/api/search`, ingesta sin clave |
| `public.spec.ts` | Portada, ficha, sección, búsqueda, 404, sitemap; borradores y rechazados no se filtran |
| `admin.spec.ts` | Login, logout, credenciales inválidas, aprobación con HTML malicioso, descarte |

El seed (`prisma/seed.e2e.ts`) usa IDs fijos con prefijo `e2e-`:

- usuarios `admin@e2e.test` / `editor@e2e.test`, clave `e2e-clave`;
- posts publicados `e2e-post-unjbg`, `e2e-post-local`, `e2e-post-regional`;
- borrador y rechazado que nunca deben aparecer en el sitio público;
- items pendientes `e2e-raw-pending` y `e2e-raw-discard`.

El seed hace `TRUNCATE` completo porque el guard garantiza que la base es
`*_e2e`. Se puede correr varias veces sin acumular datos.

## Regresión de XSS

`approveRawItem` guardaba el cuerpo del formulario tal cual y el sitio público
lo renderiza con `dangerouslySetInnerHTML`: un editor podía almacenar
`<script>` u `onerror` (XSS almacenado). Ahora la server action pasa el HTML por
`sanitizeBody(...)`, igual que el pipeline automático.

La regresión está cubierta en dos niveles:

- `tests/integration/admin-actions.test.ts`: aprueba un item con `<script>`,
  `onerror` y `javascript:` y verifica que no lleguen a `Post.bodyHtml`.
- `tests/e2e/admin.spec.ts`: repite el flujo en Chromium, comprueba que no se
  abre ningún diálogo y que la noticia publicada no contiene `<script>`.

## CI (GitHub Actions)

Archivo: `.github/workflows/ci.yml`. Se ejecuta en cada PR y en pushes a
`main`.

### Job `checks`

1. `npm ci --legacy-peer-deps` y `npx prisma generate`.
2. `npm run lint`, `npm run typecheck`, `npm run test:unit`.
3. `npx prisma migrate deploy` sobre el service Postgres.
4. `npm run test:integration`.

### Job `e2e`

1. `npm ci --legacy-peer-deps` y `npx prisma generate`.
2. `npx prisma migrate deploy`, `npm run db:seed:e2e`.
3. `npx playwright install --with-deps chromium`.
4. `npm run build` y `npm run test:e2e` (Playwright arranca `npm run start`
   en el puerto 3000).
5. Sube `playwright-report/` y `test-results/` como artifact (7 días),
   incluso si el job falla.

Cada job usa su propio service de Postgres 16 con la base
`unjbg_news_test` / `unjbg_news_e2e`. Las variables de entorno del CI son
ficticias (`AUTH_SECRET`, `INGEST_API_KEY`) y el scheduler y el worker de
WhatsApp quedan apagados.

El workflow declara `permissions: contents: read` y cancela corridas viejas del
mismo ref (`concurrency`). La protección de la rama `main` (exigir `checks` y
`e2e` antes de mergear) se configura en la settings del repositorio en GitHub,
no en un archivo del repo.

## Problemas comunes

| Síntoma | Causa / solución |
|---------|------------------|
| `DATABASE_URL no parece una base de tests` | Usar una URL que contenga `_test` o `_e2e`; nunca apuntar a `unjbg_news` |
| El E2E local falla por `.next` bloqueado | Verificar que `dev-test.sh e2e` esté usando el puerto 3100 y `NEXT_DIST_DIR=.next-e2e` |
| Un test de integración deja datos | Correr con `npm run test:integration`; `resetDatabase()` limpia antes de cada test |
| Playwright no encuentra Chromium | En el contenedor ya viene instalado; fuera de él, `npx playwright install chromium` |
| El seed E2E falla por unique constraint | La base no se vació; el seed actual hace `TRUNCATE`, revisar que la URL sea `*_e2e` |
| `npm run lint` linta `.next-e2e` | `eslint.config.mjs` ya ignora `.next-e2e/**` y las salidas de tests |

## Pendientes / mejoras futuras

- Publicar cobertura como artifact o integrar un umbral mínimo.
- Agregar un smoke E2E del worker de WhatsApp (requiere sesión real, no apto
  para CI).
- Evaluar `shard` de Playwright si la suite E2E crece.
- Cachear los navegadores de Playwright en CI para acortar el job `e2e`.
