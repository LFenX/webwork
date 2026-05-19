import type { Metadata } from "next"
import { getPost } from "@/lib/mdx"
import { canViewModule, type ModuleKey } from "@/lib/permissions"
import { profileHref, resolveCreatorProfileRef } from "@/lib/profile"
import { absoluteSiteUrl } from "@/lib/seo"

type PublicArticleType = "blog" | "daily" | "reflections" | "notes"

const NOINDEX: Metadata = { robots: { index: false, follow: false } }

export async function getPublicModuleMetadata(ref: string, module: ModuleKey, label: string, description: string): Promise<Metadata> {
  const owner = await resolveCreatorProfileRef(ref)
  if (!owner || !(await canViewModule(owner.id, module, "public"))) return NOINDEX

  const ownerName = owner.displayName || "公开用户"
  const title = `${ownerName} 的${label}`
  const url = absoluteSiteUrl(profileHref(owner, module))
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
    },
    robots: { index: true, follow: true },
  }
}

export async function getPublicPostMetadata(ref: string, type: PublicArticleType, slug: string, label: string): Promise<Metadata> {
  const owner = await resolveCreatorProfileRef(ref)
  if (!owner || !(await canViewModule(owner.id, type, "public"))) return NOINDEX

  const post = await getPost(type, decodeURIComponent(slug), owner.id, ["public"])
  if (!post) return NOINDEX

  const url = absoluteSiteUrl(profileHref(owner, `${type}/${encodeURIComponent(post.slug)}`))
  const title = post.title
  const description = post.summary || `${owner.displayName || "公开用户"} 的${label}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.updatedAt,
      authors: [owner.displayName || "公开用户"],
    },
    robots: { index: true, follow: true },
  }
}
