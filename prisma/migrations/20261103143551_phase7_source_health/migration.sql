-- Fase 7: salud de fuentes, historial de corridas y columnas que faltaban
-- del pipeline (imageMeta/thumbnailUrl). Estas dos columnas existen en la base
-- de desarrollo por una migracion anterior, pero no estaban en el historial:
-- se agregan con IF NOT EXISTS para que una instalacion nueva quede completa.

-- Metadatos de imagen del pipeline (Fase 5).
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "imageMeta" JSONB;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;

-- Estado de salud por fuente.
CREATE TYPE "RunStatus" AS ENUM ('OK', 'ERROR');

ALTER TABLE "Source"
  ADD COLUMN "lastSuccessAt" TIMESTAMP(3),
  ADD COLUMN "lastDurationMs" INTEGER,
  ADD COLUMN "consecutiveFailures" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "SourceRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'OK',
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "newItems" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SourceRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SourceRun_sourceId_startedAt_idx" ON "SourceRun"("sourceId", "startedAt");

ALTER TABLE "SourceRun"
  ADD CONSTRAINT "SourceRun_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "Source"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
