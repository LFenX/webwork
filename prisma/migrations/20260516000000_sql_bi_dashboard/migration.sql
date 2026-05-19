ALTER TABLE "SqlInsightCard"
    ADD COLUMN "snapshotJson" JSONB,
    ADD COLUMN "layout" JSONB,
    ADD COLUMN "refreshMeta" JSONB,
    ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'report';

CREATE TABLE "SqlBiDashboard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '默认 BI 工作台',
    "theme" TEXT NOT NULL DEFAULT 'report',
    "layout" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SqlBiDashboard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SqlBiDashboard_userId_name_key"
    ON "SqlBiDashboard"("userId", "name");

CREATE INDEX "SqlBiDashboard_userId_updatedAt_idx"
    ON "SqlBiDashboard"("userId", "updatedAt");

ALTER TABLE "SqlBiDashboard"
    ADD CONSTRAINT "SqlBiDashboard_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
