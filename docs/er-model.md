# Modelo Entidad-Relación — Base de datos UNJBG_News

Fuente: `prisma/schema.prisma` + migraciones SQL en `prisma/migrations/`
(Fase 5 y 6 agregan objetos que Prisma no expresa: `tsvector`, triggers, índices GIN).

Diagrama Mermaid listo para compilar en <https://mermaid.live> (también en `er-model.mmd`):

```mermaid
erDiagram
    Source ||--o{ RawItem : "polls / ingests (Cascade)"
    Source ||--o{ Post : "origin (optional, SetNull)"
    RawItem ||--o| Post : "produces (1:1 optional, SetNull)"
    Category ||--o{ Post : "classifies (SetNull)"
    User ||--o{ Post : "authors / moderates (SetNull)"

    Source {
        string id PK
        string name
        enum type "WEB | FACEBOOK | WHATSAPP | RSS"
        string url "nullable"
        json config "nullable (per-type settings)"
        bool autopublish "default false"
        enum status "ACTIVE | PAUSED | DISABLED, default ACTIVE"
        int pollIntervalMinutes "nullable"
        datetime lastRunAt "nullable"
        string lastError "nullable"
        datetime createdAt
        datetime updatedAt
    }

    RawItem {
        string id PK
        string sourceId FK
        string externalId "unique per source"
        enum status "NEW | PROCESSED | DISCARDED, default NEW"
        json payload "raw scraped content"
        string contentHash "dedup hash"
        string title "nullable"
        json images "nullable"
        datetime seenAt "default now"
        datetime processedAt "nullable"
    }

    Post {
        string id PK
        string rawItemId FK "unique, nullable"
        string categoryId FK "nullable"
        string sourceId FK "nullable"
        string authorId FK "nullable"
        string title
        string bodyHtml
        string imageUrl "nullable"
        string thumbnailUrl "nullable"
        json imageMeta "nullable"
        enum status "DRAFT | PUBLISHED | REJECTED, default DRAFT"
        datetime publishedAt "nullable"
        datetime moderatedAt "nullable"
        datetime createdAt
        datetime updatedAt
        tsvector searchVector "trigger-maintained, Fase 5/6"
        int views "default 0"
    }

    Category {
        string id PK
        string slug UK
        string name UK
        datetime createdAt
    }

    User {
        string id PK
        string email UK
        string name "nullable"
        string passwordHash
        enum role "ADMIN | EDITOR, default EDITOR"
        datetime createdAt
        datetime updatedAt
    }
```

## Relaciones y cardinalidad

| Relación | Cardinalidad | Ubicación del FK | On delete |
|---|---|---|---|
| Source → RawItem | 1 : 0..* | `RawItem.sourceId` (requerido) | **Cascade** — borrar un source borra sus raw items |
| Source → Post | 1 : 0..* | `Post.sourceId` (opcional) | SetNull |
| RawItem → Post | 1 : 0..1 (1:1 efectivo) | `Post.rawItemId` (`@unique`) | SetNull |
| Category → Post | 1 : 0..* | `Post.categoryId` (opcional) | SetNull |
| User → Post | 1 : 0..* | `Post.authorId` (opcional) | SetNull |

No hay relaciones muchos-a-muchos ni tablas intermedias: el modelo es una estrella
con `Post` en el centro y `Source` alimentando dos ramas (`RawItem` y `Post` directo).

## Restricciones e índices

- `Source`: unique `(name, type)`
- `RawItem`: unique `(sourceId, externalId)` (dedup por source); índice `(status, seenAt)` para la cola de ingesta
- `Post` índices: `(status, publishedAt)`, `(status, views)`, `(categoryId)`, `(title)`
- `Category`: únicos `slug` y `name` — `User`: único `email`

## Objetos de base de datos no visibles en Prisma

- `Post.searchVector` es un `tsvector` mantenido por un trigger `BEFORE INSERT OR UPDATE`
  (`post_search_vector_update`): `title` con peso **A** + `bodyHtml` con peso **B**,
  usando configuración `spanish`. Prisma lo expone como `Unsupported("tsvector")`.
- Índices GIN: `Post_searchVector_idx` (full-text) y `Post_title_trgm_idx` (trigram,
  para búsqueda difusa). Requieren la extensión `pg_trgm`.
- `Post.views` fue agregado en Fase 6 con SQL crudo (`Int @default(0)`).

## Flujo de ingesta (cómo se conectan las entidades)

`Source` (poll) → `RawItem` (`status: NEW`) → procesado → `Post` (`status: DRAFT`)
→ moderado por un `User` → `PUBLISHED` (con `publishedAt` y contador `views`).
Un source puede publicar directo a `Post` si `autopublish` está activado.
