import "server-only"
import { getUserSiteSettings } from "@/lib/settings"

export const getMySettingsTool = {
  name: "get_my_settings",
  title: "我的站点设置",
  description: "获取当前用户的站点偏好与语言配置",
  execute: async ({ userId }: { userId: string }) => {
    const settings = await getUserSiteSettings(userId)
    return { settings }
  },
}
