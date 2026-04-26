-- CreateTable
CREATE TABLE "AgentProfile" (
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "soulContent" TEXT NOT NULL DEFAULT '',
    "soulVersion" INTEGER NOT NULL DEFAULT 1,
    "identityContent" TEXT NOT NULL DEFAULT '',
    "identityVersion" INTEGER NOT NULL DEFAULT 1,
    "userContextContent" TEXT NOT NULL DEFAULT '',
    "userContextVersion" INTEGER NOT NULL DEFAULT 1,
    "rulesContent" TEXT NOT NULL DEFAULT '',
    "rulesVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
