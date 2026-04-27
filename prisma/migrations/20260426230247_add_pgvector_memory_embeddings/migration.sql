-- Add embedding metadata columns
ALTER TABLE "MemoryFact" ADD COLUMN "embeddingModel" TEXT;
ALTER TABLE "MemoryFact" ADD COLUMN "embeddingStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "MemoryFact" ADD COLUMN "embeddingUpdatedAt" TIMESTAMP(3);

ALTER TABLE "MemoryEvent" ADD COLUMN "embeddingModel" TEXT;
ALTER TABLE "MemoryEvent" ADD COLUMN "embeddingStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "MemoryEvent" ADD COLUMN "embeddingUpdatedAt" TIMESTAMP(3);

ALTER TABLE "MemoryToolEvent" ADD COLUMN "embeddingModel" TEXT;
ALTER TABLE "MemoryToolEvent" ADD COLUMN "embeddingStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "MemoryToolEvent" ADD COLUMN "embeddingUpdatedAt" TIMESTAMP(3);

-- Extensions: first attempt to enable vector extension
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgvector extension is not available — semantic search will use keyword fallback';
END;
$$;

-- Conditionally add vector columns if extension exists
DO $$
DECLARE
  ext_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='vector') INTO ext_exists;
  IF ext_exists THEN
    ALTER TABLE "MemoryFact" ADD COLUMN IF NOT EXISTS embedding vector(1536);
    ALTER TABLE "MemoryEvent" ADD COLUMN IF NOT EXISTS embedding vector(1536);
    ALTER TABLE "MemoryToolEvent" ADD COLUMN IF NOT EXISTS embedding vector(1536);
  END IF;
END;
$$;

-- Conditionally create HNSW indexes if extension exists (pgvector 0.5.0+)
DO $$
DECLARE
  ext_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='vector') INTO ext_exists;
  IF ext_exists THEN
    BEGIN
      CREATE INDEX IF NOT EXISTS "MemoryFact_embedding_idx" ON "MemoryFact" USING hnsw (embedding vector_cosine_ops);
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        CREATE INDEX IF NOT EXISTS "MemoryFact_embedding_idx" ON "MemoryFact" USING ivfflat (embedding vector_cosine_ops);
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not create vector index on MemoryFact — queries will use sequential scan';
      END;
    END;

    BEGIN
      CREATE INDEX IF NOT EXISTS "MemoryEvent_embedding_idx" ON "MemoryEvent" USING hnsw (embedding vector_cosine_ops);
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        CREATE INDEX IF NOT EXISTS "MemoryEvent_embedding_idx" ON "MemoryEvent" USING ivfflat (embedding vector_cosine_ops);
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not create vector index on MemoryEvent — queries will use sequential scan';
      END;
    END;

    BEGIN
      CREATE INDEX IF NOT EXISTS "MemoryToolEvent_embedding_idx" ON "MemoryToolEvent" USING hnsw (embedding vector_cosine_ops);
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        CREATE INDEX IF NOT EXISTS "MemoryToolEvent_embedding_idx" ON "MemoryToolEvent" USING ivfflat (embedding vector_cosine_ops);
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not create vector index on MemoryToolEvent — queries will use sequential scan';
      END;
    END;
  END IF;
END;
$$;
