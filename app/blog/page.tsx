import { getArticleFolders, getPosts } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { getModuleVisibility } from "@/lib/permissions"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { ArticleModulePage } from "@/components/module/article-module-page"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ folder?: string }> }) {
  const [{ userId }, { folder }] = await Promise.all([requireAuth(), searchParams])
  const folderFilter = folder === "uncategorized" ? null : folder || undefined
  const [posts, visibility, folders, settings] = await Promise.all([
    getPosts("blog", userId, ["private", "friends", "public"], folderFilter),
    getModuleVisibility(userId, "blog"),
    getArticleFolders("blog", userId),
    getUserSiteSettings(userId),
  ])
  const dict = getDictionary(settings.language)

  return (
    <ArticleModulePage
      type="blog"
      title={dict.nav.blog}
      description="长文、专题和系统化思考集中在这里，方便持续沉淀和回看。"
      posts={posts}
      folders={folders}
      selectedFolder={folder}
      visibility={visibility}
      newLabel={dict.article.new}
      emptyLabel={dict.article.empty(dict.nav.blog)}
    />
  )
}
