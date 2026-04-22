ALTER TABLE "UserSession" ADD COLUMN "lastActiveAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00';
ALTER TABLE "UserSession" ADD COLUMN "lastForegroundAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00';
UPDATE "UserSession" SET "lastActiveAt" = "lastSeenAt", "lastForegroundAt" = "lastSeenAt";

CREATE INDEX "UserSession_lastForegroundAt_idx" ON "UserSession"("lastForegroundAt");

ALTER TABLE "ArticleFolder" ADD COLUMN "coverFitMode" TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE "ArticleFolder" ADD COLUMN "coverScale" INTEGER NOT NULL DEFAULT 100;
