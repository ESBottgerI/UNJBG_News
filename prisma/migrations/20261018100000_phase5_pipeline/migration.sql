-- Fase 5: pipeline, búsqueda full-text y metadatos de imágenes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Agregar índices para búsqueda mejorada
CREATE INDEX IF NOT EXISTS "Post_title_trgm_idx" ON "Post" USING gin ("title" gin_trgm_ops);

-- Columna para búsqueda full-text en español
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

-- Crear índice GIN para búsqueda
CREATE INDEX IF NOT EXISTS "Post_searchVector_idx" ON "Post" USING gin ("searchVector");

-- Función para actualizar searchVector
CREATE OR REPLACE FUNCTION post_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('spanish', coalesce(NEW.title,'')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(NEW."bodyHtml",'')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para mantener searchVector actualizado
CREATE TRIGGER post_search_vector_update
  BEFORE INSERT OR UPDATE ON "Post"
  FOR EACH ROW
  EXECUTE FUNCTION post_search_vector_trigger();

-- Poblar searchVector para posts existentes
UPDATE "Post"
SET "searchVector" =
  setweight(to_tsvector('spanish', coalesce(title,'')), 'A') ||
  setweight(to_tsvector('spanish', coalesce("bodyHtml",'')), 'B')
WHERE "searchVector" IS NULL;
