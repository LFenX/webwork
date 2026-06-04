-- AlterTable
ALTER TABLE "AIRun" ADD COLUMN "cancelRequestedAt" TIMESTAMP(3);
ALTER TABLE "AIRun" ADD COLUMN "cancelledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AIRun_userId_status_idx" ON "AIRun"("userId", "status");
