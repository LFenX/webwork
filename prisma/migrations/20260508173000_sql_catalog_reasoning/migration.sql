ALTER TABLE "SqlAssistantMessage"
  ADD COLUMN "reasoningMarkdown" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "selectedTables" JSONB,
  ADD COLUMN "catalogMatches" JSONB,
  ADD COLUMN "confidence" DOUBLE PRECISION;

CREATE TABLE "SqlTableCatalogOverride" (
  "id" TEXT NOT NULL,
  "schemaName" TEXT NOT NULL,
  "tableName" TEXT NOT NULL,
  "moduleId" TEXT,
  "moduleName" TEXT,
  "submoduleId" TEXT,
  "submoduleName" TEXT,
  "description" TEXT,
  "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "keyFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "relations" JSONB,
  "useCases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notes" TEXT NOT NULL DEFAULT '',
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SqlTableCatalogOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SqlTableCatalogOverride_schemaName_tableName_key"
  ON "SqlTableCatalogOverride"("schemaName", "tableName");

CREATE INDEX "SqlTableCatalogOverride_schemaName_tableName_idx"
  ON "SqlTableCatalogOverride"("schemaName", "tableName");

CREATE INDEX "SqlTableCatalogOverride_moduleId_submoduleId_idx"
  ON "SqlTableCatalogOverride"("moduleId", "submoduleId");

CREATE INDEX "SqlTableCatalogOverride_updatedById_idx"
  ON "SqlTableCatalogOverride"("updatedById");

ALTER TABLE "SqlTableCatalogOverride"
  ADD CONSTRAINT "SqlTableCatalogOverride_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
