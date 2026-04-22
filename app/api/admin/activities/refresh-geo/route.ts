import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canManageUsers, requireAdmin } from "@/lib/admin"
import { lookupPublicGeoLocation } from "@/lib/request-meta"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

function needsGeoRefresh(value: string) {
  const location = (value || "").trim()
  if (!location || location === "未知") return true
  if (location === "本地/内网") return false
  return !location.includes(" / ")
}

export async function POST() {
  try {
    const admin = await requireAdmin()
    if (!canManageUsers(admin.role)) {
      return NextResponse.json({ error: "无权限" }, { status: 403, headers: NO_STORE })
    }

    const activities = await prisma.userActivity.findMany({
      where: {
        NOT: { geoLocation: { contains: " / " } },
      },
      select: { id: true, ipAddress: true, geoLocation: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    })

    let updated = 0
    let failed = 0
    let skipped = 0
    const cache = new Map<string, string>()

    for (const activity of activities) {
      if (!activity.ipAddress || !needsGeoRefresh(activity.geoLocation)) {
        skipped++
        continue
      }

      const cached = cache.get(activity.ipAddress)
      const location = cached ?? await lookupPublicGeoLocation(activity.ipAddress)
      if (location) cache.set(activity.ipAddress, location)

      if (!location || location === activity.geoLocation) {
        failed++
        continue
      }

      await prisma.userActivity.update({
        where: { id: activity.id },
        data: { geoLocation: location },
      })
      updated++
    }

    return NextResponse.json({
      scanned: activities.length,
      updated,
      failed,
      skipped,
    }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 500, headers: NO_STORE })
  }
}
