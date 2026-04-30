-- AlterTable
ALTER TABLE "Resume" ADD COLUMN "resumeJson" JSONB;

-- AlterTable
ALTER TABLE "Resume" ADD COLUMN "selectedTheme" TEXT;

-- AlterTable
ALTER TABLE "Resume" ADD COLUMN "lastExportedPdfPath" TEXT;

-- AlterTable
ALTER TABLE "Resume" ADD COLUMN "lastExportedAt" TIMESTAMP(3);
