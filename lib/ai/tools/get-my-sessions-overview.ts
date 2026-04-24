import "server-only"
import { prisma } from "@/lib/db"
import { maskIpAddress } from "@/lib/ai/tools/context"
import { summarizeGeoLocation } from "@/lib/ai/tools/helpers"

export const getMySessionsOverviewTool = {
  name: "get_my_sessions_overview",
  title: "我的登录会话概览",
  description: "获取当前用户最近登录会话、设备、地点和状态",
  execute: async ({ targetUserId }: { targetUserId: string }) => {
    const items = await prisma.userSession.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        sessionId: true,
        status: true,
        ipAddress: true,
        geoLocation: true,
        deviceInfo: true,
        lastSeenAt: true,
        lastActiveAt: true,
        createdAt: true,
        loggedOutAt: true,
        logoutReason: true,
      },
    })

    return {
      total: items.length,
      items: items.map((item) => ({
        sessionId: item.sessionId,
        status: item.status,
        ipAddress: maskIpAddress(item.ipAddress),
        geoLocation: summarizeGeoLocation(item.geoLocation),
        deviceInfo: item.deviceInfo,
        lastSeenAt: item.lastSeenAt.toISOString(),
        lastActiveAt: item.lastActiveAt.toISOString(),
        createdAt: item.createdAt.toISOString(),
        loggedOutAt: item.loggedOutAt?.toISOString() ?? null,
        logoutReason: item.logoutReason,
      })),
    }
  },
}
