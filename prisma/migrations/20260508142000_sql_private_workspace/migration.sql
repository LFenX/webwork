CREATE TABLE "SqlPrivateFolder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SqlPrivateFolder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SqlPrivateTable" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "folderId" TEXT,
    "schemaName" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SqlPrivateTable_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SqlPrivateFolder_userId_name_key" ON "SqlPrivateFolder"("userId", "name");
CREATE INDEX "SqlPrivateFolder_userId_sortOrder_idx" ON "SqlPrivateFolder"("userId", "sortOrder");
CREATE UNIQUE INDEX "SqlPrivateTable_userId_schemaName_tableName_key" ON "SqlPrivateTable"("userId", "schemaName", "tableName");
CREATE INDEX "SqlPrivateTable_userId_folderId_idx" ON "SqlPrivateTable"("userId", "folderId");
CREATE INDEX "SqlPrivateTable_schemaName_tableName_idx" ON "SqlPrivateTable"("schemaName", "tableName");

ALTER TABLE "SqlPrivateFolder" ADD CONSTRAINT "SqlPrivateFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SqlPrivateTable" ADD CONSTRAINT "SqlPrivateTable_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SqlPrivateTable" ADD CONSTRAINT "SqlPrivateTable_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "SqlPrivateFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
