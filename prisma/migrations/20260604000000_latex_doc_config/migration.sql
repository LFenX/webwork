-- CreateTable
CREATE TABLE "LatexDocConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "configJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LatexDocConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LatexDocConfig_conversationId_key" ON "LatexDocConfig"("conversationId");

-- CreateIndex
CREATE INDEX "LatexDocConfig_userId_idx" ON "LatexDocConfig"("userId");
