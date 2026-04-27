-- CreateTable
CREATE TABLE "WebsiteFolder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteResource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "folderId" TEXT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "screenshotUrl" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteFolder_userId_name_key" ON "WebsiteFolder"("userId", "name");

-- CreateIndex
CREATE INDEX "WebsiteFolder_userId_sortOrder_idx" ON "WebsiteFolder"("userId", "sortOrder");

-- CreateIndex
CREATE INDEX "WebsiteFolder_userId_createdAt_idx" ON "WebsiteFolder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WebsiteResource_createdAt_idx" ON "WebsiteResource"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "WebsiteResource_userId_createdAt_idx" ON "WebsiteResource"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WebsiteResource_folderId_idx" ON "WebsiteResource"("folderId");

-- CreateIndex
CREATE INDEX "WebsiteResource_domain_idx" ON "WebsiteResource"("domain");

-- AddForeignKey
ALTER TABLE "WebsiteResource" ADD CONSTRAINT "WebsiteResource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteResource" ADD CONSTRAINT "WebsiteResource_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "WebsiteFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteFolder" ADD CONSTRAINT "WebsiteFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
