ALTER TABLE "AIUsageGrant"
ADD COLUMN "webSearchEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "AIWebSearchConfig" (
    "id" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'aliyun',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "apiKeyEncrypted" TEXT NOT NULL DEFAULT '',
    "apiKeyMask" TEXT NOT NULL DEFAULT '',
    "host" TEXT NOT NULL DEFAULT '',
    "workspace" TEXT NOT NULL DEFAULT 'default',
    "serviceId" TEXT NOT NULL DEFAULT 'ops-web-search-001',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AIWebSearchConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AIWebSearchConfig_ownerType_ownerId_key" ON "AIWebSearchConfig"("ownerType", "ownerId");
CREATE INDEX "AIWebSearchConfig_ownerType_ownerId_idx" ON "AIWebSearchConfig"("ownerType", "ownerId");
CREATE INDEX "AIWebSearchConfig_enabled_updatedAt_idx" ON "AIWebSearchConfig"("enabled", "updatedAt");

CREATE TABLE "AIWebSearchToolLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'aliyun-opensearch',
    "credentialSource" TEXT NOT NULL,
    "credentialOwnerId" TEXT NOT NULL DEFAULT '',
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIWebSearchToolLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIWebSearchToolLog_userId_createdAt_idx" ON "AIWebSearchToolLog"("userId", "createdAt");
CREATE INDEX "AIWebSearchToolLog_credentialSource_credentialOwnerId_createdAt_idx" ON "AIWebSearchToolLog"("credentialSource", "credentialOwnerId", "createdAt");
CREATE INDEX "AIWebSearchToolLog_toolName_createdAt_idx" ON "AIWebSearchToolLog"("toolName", "createdAt");

ALTER TABLE "AIWebSearchToolLog"
ADD CONSTRAINT "AIWebSearchToolLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
