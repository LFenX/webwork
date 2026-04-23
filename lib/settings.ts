import "server-only"

import { prisma } from "@/lib/db"
import type { AppLocale } from "@/lib/i18n"

export type UserSiteSettings = {
  ownerName: string
  heroTagline: string
  language: AppLocale
}

export async function getUserSiteSettings(userId: string): Promise<UserSiteSettings> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, email: true },
  })
  const fallbackName = user?.displayName || user?.email || "My Space"
  const defaults = {
    ownerName: fallbackName,
    heroTagline: "这里是我的个人空间，记录博客、日常、心得，以及正在进行中的求职旅程。",
    language: "zh-CN" as AppLocale,
  }

  try {
    let settings = await prisma.siteSettings.findUnique({ where: { userId } })
    if (!settings) {
      settings = await prisma.siteSettings.create({ data: { userId, ...defaults } })
    } else if ((settings.ownerName === "LFen" || !settings.ownerName) && fallbackName !== "My Space") {
      settings = await prisma.siteSettings.update({
        where: { userId },
        data: { ownerName: fallbackName },
      })
    }
    return {
      ownerName: settings.ownerName,
      heroTagline: settings.heroTagline,
      language: settings.language === "en-US" ? "en-US" : "zh-CN",
    }
  } catch {
    return defaults
  }
}
