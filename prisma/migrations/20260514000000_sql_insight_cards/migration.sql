CREATE TABLE "SqlInsightCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sql" TEXT NOT NULL,
    "chartConfig" JSONB NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SqlInsightCard_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SqlInsightCard_userId_pinned_updatedAt_idx"
    ON "SqlInsightCard"("userId", "pinned", "updatedAt");

ALTER TABLE "SqlInsightCard"
    ADD CONSTRAINT "SqlInsightCard_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SqlInsightCard"
    ADD CONSTRAINT "SqlInsightCard_threadId_fkey"
    FOREIGN KEY ("threadId") REFERENCES "SqlThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;
