ALTER TABLE "AdminPermission"
ADD COLUMN IF NOT EXISTS "manageSqlLab" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "SqlAccessGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultLimit" INTEGER NOT NULL DEFAULT 1000,
    "maxLimit" INTEGER NOT NULL DEFAULT 50000,
    "defaultTimeoutMs" INTEGER NOT NULL DEFAULT 15000,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SqlAccessGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SqlAccessTableGrant" (
    "id" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "schemaName" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "access" TEXT NOT NULL DEFAULT 'read',
    "blockedColumns" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "rowFilter" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SqlAccessTableGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SqlSavedQuery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sql" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SqlSavedQuery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SqlAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "truncated" BOOLEAN NOT NULL DEFAULT false,
    "sqlPreview" TEXT NOT NULL,
    "fullSqlSha256" TEXT NOT NULL,
    "touchedTables" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "SqlAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SqlAccessGrant_userId_key" ON "SqlAccessGrant"("userId");
CREATE INDEX "SqlAccessGrant_updatedById_idx" ON "SqlAccessGrant"("updatedById");
CREATE UNIQUE INDEX "SqlAccessTableGrant_grantId_schemaName_tableName_key" ON "SqlAccessTableGrant"("grantId", "schemaName", "tableName");
CREATE INDEX "SqlAccessTableGrant_schemaName_tableName_idx" ON "SqlAccessTableGrant"("schemaName", "tableName");
CREATE INDEX "SqlSavedQuery_userId_pinned_idx" ON "SqlSavedQuery"("userId", "pinned");
CREATE INDEX "SqlSavedQuery_shared_updatedAt_idx" ON "SqlSavedQuery"("shared", "updatedAt");
CREATE INDEX "SqlAuditLog_userId_startedAt_idx" ON "SqlAuditLog"("userId", "startedAt");
CREATE INDEX "SqlAuditLog_startedAt_idx" ON "SqlAuditLog"("startedAt");

ALTER TABLE "SqlAccessGrant" ADD CONSTRAINT "SqlAccessGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SqlAccessGrant" ADD CONSTRAINT "SqlAccessGrant_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SqlAccessTableGrant" ADD CONSTRAINT "SqlAccessTableGrant_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "SqlAccessGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SqlSavedQuery" ADD CONSTRAINT "SqlSavedQuery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SqlAuditLog" ADD CONSTRAINT "SqlAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
