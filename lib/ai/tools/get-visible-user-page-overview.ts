import "server-only"
import { prisma } from "@/lib/db"
import { canViewModule, getAccessLevel, visibleTo, type ModuleKey } from "@/lib/permissions"

const PUBLIC_MODULES: ModuleKey[] = ["resume", "blog", "daily", "reflections", "notes", "jobs", "interviews"]

export const getVisibleUserPageOverviewTool = {
  name: "get_visible_user_page_overview",
  title: "可见主页概览",
  description: "基于现有主页权限规则获取指定用户页面的可见模块概览",
  execute: async ({ userId, targetUserId }: { userId: string; targetUserId?: string }) => {
    if (!targetUserId) {
      return {
        accessLevel: "none",
        visibleModules: {},
        note: "未提供目标用户 ID，无法读取他人主页概览。",
      }
    }

    const level = await getAccessLevel(userId, targetUserId)
    if (level === "none") {
      return { accessLevel: level, visibleModules: {} }
    }

    const entries = await Promise.all(
      PUBLIC_MODULES.map(async (module) => [module, await canViewModule(targetUserId, module, level)] as const)
    )
    const visibilities = visibleTo(level)
    const visiblePostCount = await prisma.post.count({
      where: { userId: targetUserId, visibility: { in: visibilities } },
    })

    return {
      accessLevel: level,
      visibleModules: Object.fromEntries(entries),
      visiblePostCount,
    }
  },
}
