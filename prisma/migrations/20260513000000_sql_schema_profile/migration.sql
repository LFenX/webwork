CREATE TABLE "SqlSchemaProfile" (
    "id" TEXT NOT NULL,
    "schemaName" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "columnName" TEXT,
    "profileJson" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SqlSchemaProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SqlSchemaProfile_schemaName_tableName_columnName_key"
    ON "SqlSchemaProfile"("schemaName", "tableName", "columnName");

CREATE INDEX "SqlSchemaProfile_expiresAt_idx" ON "SqlSchemaProfile"("expiresAt");
