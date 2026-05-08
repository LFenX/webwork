import type { Dictionary } from "@/lib/i18n"
import { prisma } from "@/lib/db"
import { getPosts, type PostMeta } from "@/lib/mdx"
import type { PostType } from "@/lib/enums"

export type ArticleWorkspacePost = Pick<PostMeta, "id" | "slug" | "title" | "date" | "summary" | "type"> & { folderId?: string | null }

export type ArticleWorkspaceFolder = {
  id: string
  name: string
  posts: ArticleWorkspacePost[]
}

export type ArticleWorkspaceModule = {
  type: PostType
  label: string
  href: string
  newHref?: string
  posts: ArticleWorkspacePost[]
  folders: ArticleWorkspaceFolder[]
  unfiled: ArticleWorkspacePost[]
  /** Slug of the most recent post; lets module-switch buttons jump to it instead of the listing page. */
  latestSlug?: string
  /** Pre-computed link target — `${href}/${latestSlug}` if any post exists, else `href` (listing page). */
  latestHref: string
}

export type ArticleWorkspaceNav = {
  title: string
  sectionLabel: string
  currentType: PostType
  currentSlug?: string
  modules: ArticleWorkspaceModule[]
}

const ARTICLE_TYPES: PostType[] = ["blog", "daily", "reflections", "notes"]

function joinPath(prefix: string, segment: string) {
  const cleanPrefix = prefix.replace(/\/$/, "")
  return cleanPrefix ? `${cleanPrefix}/${segment}` : `/${segment}`
}

function articleLabel(dict: Dictionary, type: PostType) {
  return dict.nav[type]
}

export async function buildArticleWorkspaceNav({
  userId,
  currentType,
  currentSlug,
  dict,
  basePathPrefix = "",
  visibilities,
  includeNewActions = true,
  allowedTypes = ARTICLE_TYPES,
  title,
}: {
  userId: string
  currentType: PostType
  currentSlug?: string
  dict: Dictionary
  basePathPrefix?: string
  visibilities?: string[]
  includeNewActions?: boolean
  allowedTypes?: PostType[]
  title?: string
}): Promise<ArticleWorkspaceNav> {
  const modules = await Promise.all(
    allowedTypes.map(async (type) => {
      const [posts, folders] = await Promise.all([
        getPosts(type, userId, visibilities),
        prisma.articleFolder.findMany({
          where: { userId, type },
          orderBy: { updatedAt: "desc" },
          select: { id: true, name: true },
        }),
      ])
      const href = joinPath(basePathPrefix, type)
      const mappedPosts: ArticleWorkspacePost[] = posts.map((post) => ({
        id: post.id,
        slug: post.slug,
        title: post.title,
        date: post.date,
        summary: post.summary,
        type: post.type,
        folderId: (post as { folderId?: string | null }).folderId ?? null,
      }))

      const folderBuckets: ArticleWorkspaceFolder[] = folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        posts: mappedPosts.filter((p) => p.folderId === folder.id),
      }))
      const unfiled = mappedPosts.filter((p) => !p.folderId)

      const latestSlug = mappedPosts[0]?.slug
      const latestHref = latestSlug ? `${href}/${encodeURIComponent(latestSlug)}` : href

      return {
        type,
        label: articleLabel(dict, type),
        href,
        newHref: includeNewActions ? `${href}/new` : undefined,
        posts: mappedPosts,
        folders: folderBuckets,
        unfiled,
        latestSlug,
        latestHref,
      }
    })
  )

  return {
    title: title ?? dict.nav.home,
    sectionLabel: dict.article.count(modules.reduce((sum, item) => sum + item.posts.length, 0)),
    currentType,
    currentSlug,
    modules,
  }
}

