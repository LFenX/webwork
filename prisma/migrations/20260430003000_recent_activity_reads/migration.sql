CREATE TABLE IF NOT EXISTS "RecentActivityRead" (
  "userId" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecentActivityRead_pkey" PRIMARY KEY ("userId", "activityId"),
  CONSTRAINT "RecentActivityRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RecentActivityRead_userId_readAt_idx" ON "RecentActivityRead"("userId", "readAt");
