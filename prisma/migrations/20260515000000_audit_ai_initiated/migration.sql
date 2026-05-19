ALTER TABLE "SqlAuditLog"
    ADD COLUMN "aiInitiated" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "probePurpose" TEXT;

CREATE INDEX "SqlAuditLog_aiInitiated_idx"
    ON "SqlAuditLog"("aiInitiated", "startedAt");
