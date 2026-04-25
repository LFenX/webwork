import "server-only"
import { prisma } from "@/lib/db"

export const getAdminUserProfileOverviewTool = {
  name: "get_admin_user_profile_overview",
  title: "管理员代查用户概览",
  description: "管理员按权限读取指定用户资料与 AI 可用状态摘要",
  execute: async ({ targetUserId }: { targetUserId: string }) => {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        displayName: true,
        bio: true,
        location: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
      },
    })
    if (!user) {
      return { user: null, aiStatus: null, note: "目标用户不存在。" }
    }

    const [userConfig, grant, accessRequest] = await Promise.all([
      prisma.aIUserProviderConfig.findFirst({ where: { userId: targetUserId, isActive: true } }),
      prisma.aIUsageGrant.findUnique({ where: { userId: targetUserId } }),
      prisma.aIAccessRequest.findFirst({
        where: { userId: targetUserId },
        orderBy: { createdAt: "desc" },
      }),
    ])

    return {
      user: {
        ...user,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
      },
      aiStatus: {
        hasUserConfig: Boolean(userConfig?.apiKeyEncrypted),
        userConfigEnabled: Boolean(userConfig?.isEnabled),
        grantStatus: grant?.status ?? null,
        accessRequestStatus: accessRequest?.status ?? null,
      },
    }
  },
}
