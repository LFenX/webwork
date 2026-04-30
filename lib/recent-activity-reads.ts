import "server-only"
import { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/db"

export function isPersistentRecentActivityId(activityId: string) {
  return /^(post|job|resume|website|sticker-bundle|roundtable)-/.test(activityId)
}

export async function getReadRecentActivityIds(userId: string, activityIds: string[]) {
  const ids = Array.from(new Set(activityIds.filter(isPersistentRecentActivityId)))
  if (ids.length === 0) return new Set<string>()
  const rows = await prisma.$queryRaw<Array<{ activityId: string }>>`
    SELECT "activityId"
    FROM "RecentActivityRead"
    WHERE "userId" = ${userId}
      AND "activityId" IN (${Prisma.join(ids)})
  `
  return new Set(rows.map((row) => row.activityId))
}

export async function markRecentActivitiesRead(userId: string, activityIds: string[]) {
  const ids = Array.from(new Set(activityIds.filter(isPersistentRecentActivityId)))
  if (ids.length === 0) return 0
  await prisma.$executeRaw`
    INSERT INTO "RecentActivityRead" ("userId", "activityId", "readAt")
    SELECT ${userId}, value, CURRENT_TIMESTAMP
    FROM unnest(ARRAY[${Prisma.join(ids)}]::text[]) AS value
    ON CONFLICT ("userId", "activityId")
    DO UPDATE SET "readAt" = EXCLUDED."readAt"
  `
  return ids.length
}
