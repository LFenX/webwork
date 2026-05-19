-- Per-user Live2D widget settings.

CREATE TABLE "Live2DSettings" (
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "position" TEXT NOT NULL DEFAULT 'left-bottom',
    "size" TEXT NOT NULL DEFAULT 'medium',
    "drag" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Live2DSettings_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "Live2DSettings" ADD CONSTRAINT "Live2DSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
