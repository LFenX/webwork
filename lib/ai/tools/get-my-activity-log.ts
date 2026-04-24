import "server-only"
import { prisma } from "@/lib/db"
import { maskIpAddress } from "@/lib/ai/tools/context"
import { summarizeGeoLocation } from "@/lib/ai/tools/helpers"

export const getMyActivityLogTool = {
  name: "get_my_activity_log",
  title: "我的活动日志",
  description: "获取当前用户最近登录、退出和关键操作记录",
  execute: async ({ targetUserId }: { targetUserId: string }) => {
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
