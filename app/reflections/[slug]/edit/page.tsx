import { notFound } from "next/navigation"
import { getPost } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { getCreatorProfile } from "@/lib/profile"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { PostEditorClient } from "@/components/post-editor-client"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default async function EditReflectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, { userId }] = await Promise.all([params, requireAuth()])
  const [post, creator, settings] = await Promise.all([
    getPost("reflections", decodeURIComponent(slug), userId),
    getCreatorProfile(userId),
    getUserSiteSettings(userId),
  ])
  if (!post) notFound()
  const dict = getDictionary(settings.language)
  return <PostEditorClient mode="edit" type="reflections" typeLabel={dict.nav.reflections} userId={userId} initialData={post} creator={creator} />
}
