-- Add screenshot display control columns
ALTER TABLE "WebsiteResource" ADD COLUMN IF NOT EXISTS "screenshotPositionX" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "WebsiteResource" ADD COLUMN IF NOT EXISTS "screenshotPositionY" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "WebsiteResource" ADD COLUMN IF NOT EXISTS "screenshotScale" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "WebsiteResource" ADD COLUMN IF NOT EXISTS "screenshotFitMode" TEXT NOT NULL DEFAULT 'cover';

-- Create visit log table
CREATE TABLE IF NOT EXISTS "WebsiteVisitLog" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteVisitLog_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "WebsiteVisitLog_websiteId_createdAt_idx" ON "WebsiteVisitLog"("websiteId", "createdAt");
CREATE INDEX IF NOT EXISTS "WebsiteVisitLog_userId_createdAt_idx" ON "WebsiteVisitLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "WebsiteVisitLog_createdAt_idx" ON "WebsiteVisitLog"("createdAt");

-- Add foreign keys
ALTER TABLE "WebsiteVisitLog" ADD CONSTRAINT "WebsiteVisitLog_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "WebsiteResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebsiteVisitLog" ADD CONSTRAINT "WebsiteVisitLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
