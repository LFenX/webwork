import { getArticleFolders, getPosts } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { getModuleVisibility } from "@/lib/permissions"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { ArticleModulePage } from "@/components/module/article-module-page"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default async function DailyPage({ searchParams }: { searchParams: Promise<{ folder?: string }> }) {
  const [{ userId }, { folder }] = await Promise.all([requireAuth(), searchParams])
  const folderFilter = folder === "uncategorized" ? null : folder || undefined
  const [posts, visibility, folders, settings] = await Promise.all([
    getPosts("daily", userId, ["private", "friends", "public"], folderFilter),
    getModuleVisibility(userId, "daily"),
    getArticleFolders("daily", userId),
    getUserSiteSettings(userId),
  ])
  const dict = getDictionary(settings.language)

  return (
    <ArticleModulePage
      type="daily"
      title={dict.nav.daily}
      description="把日常记录成时间线，让生活片段在同一套清爽卡片里自然流动。"
      posts={posts}
      folders={folders}
      selectedFolder={folder}
      visibility={visibility}
      newLabel={dict.article.new}
      emptyLabel={dict.article.empty(dict.nav.daily)}
    />
  )
}
