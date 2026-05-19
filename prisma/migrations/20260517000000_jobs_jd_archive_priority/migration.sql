-- AlterTable: add JD/salary/priority/archive/next-action fields to JobApplication
ALTER TABLE "JobApplication"
  ADD COLUMN "jobDescription" TEXT,
  ADD COLUMN "salaryRange"    TEXT,
  ADD COLUMN "priority"       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextActionAt"   TIMESTAMP(3),
  ADD COLUMN "archivedAt"     TIMESTAMP(3);

-- CreateIndex for archived/non-archived split
CREATE INDEX "JobApplication_userId_archivedAt_idx" ON "JobApplication"("userId", "archivedAt");
