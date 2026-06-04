-- Add private-file metadata to uploads.
ALTER TABLE "Upload" ADD COLUMN "storagePath" TEXT;
ALTER TABLE "Upload" ADD COLUMN "sha256" TEXT;
ALTER TABLE "Upload" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'image';

-- CreateTable
CREATE TABLE "PdfDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "engine" TEXT NOT NULL DEFAULT '',
    "parserVersion" TEXT NOT NULL DEFAULT '',
    "quality" TEXT NOT NULL DEFAULT 'highest',
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL DEFAULT '',
    "sha256" TEXT NOT NULL DEFAULT '',
    "markdownPath" TEXT NOT NULL DEFAULT '',
    "manifestPath" TEXT NOT NULL DEFAULT '',
    "jsonPath" TEXT NOT NULL DEFAULT '',
    "textChars" INTEGER NOT NULL DEFAULT 0,
    "tableCount" INTEGER NOT NULL DEFAULT 0,
    "formulaCount" INTEGER NOT NULL DEFAULT 0,
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "ocrPageCount" INTEGER NOT NULL DEFAULT 0,
    "warningsJson" JSONB,
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "heading" TEXT NOT NULL DEFAULT '',
    "pageStart" INTEGER NOT NULL DEFAULT 1,
    "pageEnd" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT NOT NULL,
    "tokenEstimate" INTEGER NOT NULL DEFAULT 0,
    "metadataJson" JSONB,
    "embeddingStatus" TEXT NOT NULL DEFAULT 'pending',
    "embeddingModel" TEXT,
    "embeddingUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdfChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Upload_kind_idx" ON "Upload"("kind");

-- CreateIndex
CREATE INDEX "Upload_sha256_idx" ON "Upload"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "PdfDocument_uploadId_key" ON "PdfDocument"("uploadId");

-- CreateIndex
CREATE INDEX "PdfDocument_userId_updatedAt_idx" ON "PdfDocument"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "PdfDocument_userId_status_idx" ON "PdfDocument"("userId", "status");

-- CreateIndex
CREATE INDEX "PdfDocument_sha256_idx" ON "PdfDocument"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "PdfChunk_documentId_chunkIndex_key" ON "PdfChunk"("documentId", "chunkIndex");

-- CreateIndex
CREATE INDEX "PdfChunk_userId_documentId_idx" ON "PdfChunk"("userId", "documentId");

-- CreateIndex
CREATE INDEX "PdfChunk_userId_kind_idx" ON "PdfChunk"("userId", "kind");

-- CreateIndex
CREATE INDEX "PdfChunk_documentId_pageStart_idx" ON "PdfChunk"("documentId", "pageStart");

-- AddForeignKey
ALTER TABLE "PdfDocument" ADD CONSTRAINT "PdfDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfDocument" ADD CONSTRAINT "PdfDocument_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfChunk" ADD CONSTRAINT "PdfChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PdfDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfChunk" ADD CONSTRAINT "PdfChunk_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
