-- SQL Practice module: owner-only by default, with per-user grants.

CREATE TABLE "SqlPracticeAccessGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT NOT NULL DEFAULT '',
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SqlPracticeAccessGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SqlPracticeAccessGrant_userId_key" ON "SqlPracticeAccessGrant"("userId");
CREATE INDEX "SqlPracticeAccessGrant_enabled_updatedAt_idx" ON "SqlPracticeAccessGrant"("enabled", "updatedAt");
CREATE INDEX "SqlPracticeAccessGrant_updatedById_idx" ON "SqlPracticeAccessGrant"("updatedById");

ALTER TABLE "SqlPracticeAccessGrant" ADD CONSTRAINT "SqlPracticeAccessGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SqlPracticeAccessGrant" ADD CONSTRAINT "SqlPracticeAccessGrant_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


CREATE TABLE "SqlPracticeProblem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'LeetCode',
    "sourceUrl" TEXT NOT NULL DEFAULT '',
    "difficulty" TEXT NOT NULL DEFAULT 'Medium',
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "methods" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "durationMinutes" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "practicedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SqlPracticeProblem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SqlPracticeProblem_userId_practicedAt_idx" ON "SqlPracticeProblem"("userId", "practicedAt");
CREATE INDEX "SqlPracticeProblem_userId_difficulty_idx" ON "SqlPracticeProblem"("userId", "difficulty");
CREATE INDEX "SqlPracticeProblem_userId_source_idx" ON "SqlPracticeProblem"("userId", "source");

ALTER TABLE "SqlPracticeProblem" ADD CONSTRAINT "SqlPracticeProblem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
