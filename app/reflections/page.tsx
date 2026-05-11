import { getArticleFolders, getPosts } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { getModuleVisibility } from "@/lib/permissions"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { ArticleModulePage } from "@/components/module/article-module-page"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default async function ReflectionsPage({ searchParams }: { searchParams: Promise<{ folder?: string }> }) {
  const [{ userId }, { folder }] = await Promise.all([requireAuth(), searchParams])
  const folderFilter = folder === "uncategorized" ? null : folder || undefined
  const [posts, visibility, folders, settings] = await Promise.all([
    getPosts("reflections", userId, ["private", "friends", "public"], folderFilter),
    getModuleVisibility(userId, "reflections"),
    getArticleFolders("reflections", userId),
    getUserSiteSettings(userId),
  ])
  const dict = getDictionary(settings.language)

  return (
    <ArticleModulePage
      type="reflections"
      title={dict.nav.reflections}
      description="复盘、心得和阶段性观察会以更清晰的内容流保存下来。"
      posts={posts}
      folders={folders}
      selectedFolder={folder}
      visibility={visibility}
      newLabel={dict.article.new}
      emptyLabel={dict.article.empty(dict.nav.reflections)}
    />
  )
}
