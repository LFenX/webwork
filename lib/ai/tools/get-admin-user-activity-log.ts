import "server-only"
import { prisma } from "@/lib/db"
import { maskIpAddress } from "@/lib/ai/tools/context"
import { summarizeGeoLocation } from "@/lib/ai/tools/helpers"

export const getAdminUserActivityLogTool = {
  name: "get_admin_user_activity_log",
  title: "管理员代查用户活动日志",
  description: "管理员按权限读取指定用户最近活动日志",
  execute: async ({ targetUserId }: { targetUserId: string }) => {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, displayName: true },
    })
    if (!user) {
      return { user: null, items: [], note: "目标用户不存在。" }
    }

    const items = await prisma.userActivity.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        action: true,
        detail: true,
        ipAddress: true,
        geoLocation: true,
        deviceInfo: true,
        createdAt: true,
      },
    })

    return {
      user,
      count: items.length,
      items: items.map((item) => ({
        id: item.id,
        action: item.action,
        detail: item.detail,
        ipAddress: maskIpAddress(item.ipAddress),
        geoLocation: summarizeGeoLocation(item.geoLocation),
        deviceInfo: item.deviceInfo,
        createdAt: item.createdAt.toISOString(),
      })),
    }
  },
}
