import "server-only"
import { prisma } from "@/lib/db"
import { maskIpAddress } from "@/lib/ai/tools/context"
import { summarizeGeoLocation } from "@/lib/ai/tools/helpers"

export const getAdminUserSessionsTool = {
  name: "get_admin_user_sessions",
  title: "管理员代查用户会话",
  description: "管理员按权限读取指定用户最近登录会话",
  execute: async ({ targetUserId }: { targetUserId: string }) => {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, displayName: true },
    })
    if (!user) {
      return { user: null, items: [], note: "目标用户不存在。" }
    }

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
        createdAt: true,
      },
    })

    return {
      user,
      total: items.length,
      items: items.map((item) => ({
        sessionId: item.sessionId,
        status: item.status,
        ipAddress: maskIpAddress(item.ipAddress),
        geoLocation: summarizeGeoLocation(item.geoLocation),
        deviceInfo: item.deviceInfo,
        lastSeenAt: item.lastSeenAt.toISOString(),
        createdAt: item.createdAt.toISOString(),
      })),
    }
  },
}
