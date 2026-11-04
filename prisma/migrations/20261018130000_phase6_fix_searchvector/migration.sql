-- Fase 6: corrige el tipo de "searchVector" (text -> tsvector) y reconstruye
-- los indices y el trigger de busqueda full-text.
--
-- Motivo: la migracion de Fase 5 declaro "searchVector" como tsvector, pero en
-- esta base la columna quedo creada como text (la creo Prisma a partir del
-- schema; el ADD COLUMN IF NOT EXISTS de Fase 5 no la toco). El trigger si
-- corria y escribia la representacion textual de un tsvector, por eso el
-- contenido parece un tsvector pero la columna es text y ts_rank/@@ fallan.
--
-- Esta migracion es idempotente y segura: convierte la representacion textual
-- ya existente a tsvector y recalcula todas las filas.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

DROP TRIGGER IF EXISTS post_search_vector_update ON "Post";

ALTER TABLE "Post"
  ALTER COLUMN "searchVector" TYPE tsvector
  USING (coalesce("searchVector", '')::tsvector);

CREATE INDEX IF NOT EXISTS "Post_searchVector_idx"
  ON "Post" USING gin ("searchVector");

CREATE INDEX IF NOT EXISTS "Post_title_trgm_idx"
  ON "Post" USING gin ("title" gin_trgm_ops);

CREATE OR REPLACE FUNCTION post_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('spanish', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(NEW."bodyHtml", '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_search_vector_update
  BEFORE INSERT OR UPDATE ON "Post"
  FOR EACH ROW
  EXECUTE FUNCTION post_search_vector_trigger();

-- Recalcula el vector de todas las filas existentes (dispara el trigger).
UPDATE "Post" SET "title" = "title";
