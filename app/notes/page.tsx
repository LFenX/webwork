import { getArticleFolders, getPosts } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { getModuleVisibility } from "@/lib/permissions"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { ArticleModulePage } from "@/components/module/article-module-page"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ folder?: string }> }) {
  const [{ userId }, { folder }] = await Promise.all([requireAuth(), searchParams])
  const folderFilter = folder === "uncategorized" ? null : folder || undefined
  const [posts, visibility, folders, settings] = await Promise.all([
    getPosts("notes", userId, ["private", "friends", "public"], folderFilter),
    getModuleVisibility(userId, "notes"),
    getArticleFolders("notes", userId),
    getUserSiteSettings(userId),
  ])
  const dict = getDictionary(settings.language)

  return (
    <ArticleModulePage
      type="notes"
      title={dict.nav.notes}
      description="工具笔记、资料线索和临时想法统一整理，方便检索和归档。"
      posts={posts}
      folders={folders}
      selectedFolder={folder}
      visibility={visibility}
      newLabel={dict.article.new}
      emptyLabel={dict.article.empty(dict.nav.notes)}
    />
  )
}
