-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "lastRunAt" TIMESTAMP(3);
