-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('WEB', 'FACEBOOK', 'WHATSAPP', 'RSS');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "url" TEXT,
    "config" JSONB,
    "autopublish" BOOLEAN NOT NULL DEFAULT false,
    "status" "SourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "pollIntervalMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Source_name_type_key" ON "Source"("name", "type");
