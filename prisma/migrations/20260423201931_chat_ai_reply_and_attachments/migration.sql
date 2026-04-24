-- AlterTable
ALTER TABLE "AIRun" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ChannelMessage" ADD COLUMN     "replyToId" TEXT;

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "replyToId" TEXT;

-- CreateTable
CREATE TABLE "AIMessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "uploadId" TEXT,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIMessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIMessageAttachment_messageId_idx" ON "AIMessageAttachment"("messageId");

-- CreateIndex
CREATE INDEX "AIMessageAttachment_userId_createdAt_idx" ON "AIMessageAttachment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AIMessageAttachment_uploadId_idx" ON "AIMessageAttachment"("uploadId");

-- CreateIndex
CREATE INDEX "ChannelMessage_replyToId_idx" ON "ChannelMessage"("replyToId");

-- CreateIndex
CREATE INDEX "ChatMessage_replyToId_idx" ON "ChatMessage"("replyToId");

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMessage" ADD CONSTRAINT "ChannelMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ChannelMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessageAttachment" ADD CONSTRAINT "AIMessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AIMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessageAttachment" ADD CONSTRAINT "AIMessageAttachment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessageAttachment" ADD CONSTRAINT "AIMessageAttachment_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;
