-- Fase 6: contador de visitas de la noticia para la seccion "Lo mas leido".
-- Se usa un archivo de migracion manual (no `prisma migrate dev`) porque el
-- schema declara searchVector como String y la columna real es tsvector
-- (Fase 5); un diff automatico intentaria "corregir" ese desajuste y romperia
-- la busqueda full-text.
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "views" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "Post_status_views_idx" ON "Post" ("status", "views");
