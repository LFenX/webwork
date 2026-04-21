import { prisma } from "@/lib/db"

export interface PostMeta {
  id: string
  title: string
  date: string
  tags: string[]
  summary: string
  slug: string
  type: string
  visibility: string
}

export interface Post extends PostMeta {
  content: string
}

export async function getPosts(
  type: "blog" | "daily" | "reflections" | "notes",
  userId: string,
  visibilities: string[] = ["private", "friends", "public"]
): Promise<PostMeta[]> {
  const posts = await prisma.post.findMany({
    where: { type, userId, visibility: { in: visibilities } },
    orderBy: { date: "desc" },
    select: { id: true, slug: true, title: true, date: true, tags: true, summary: true, type: true, visibility: true },
  })
  return posts.map((p) => ({
    id: p.id,
    slug: p.slug,
    type: p.type,
    title: p.title,
    date: p.date.toISOString().slice(0, 10),
    tags: JSON.parse(p.tags || "[]") as string[],
    summary: p.summary,
    visibility: p.visibility,
  }))
}

export async function getPost(
  type: "blog" | "daily" | "reflections" | "notes",
  slug: string,
  userId: string,
  visibilities: string[] = ["private", "friends", "public"]
): Promise<Post | null> {
  const normalizedSlug = slug.normalize("NFC")
  const p = await prisma.post.findFirst({
    where: {
      type,
      slug: normalizedSlug,
      userId,
      visibility: { in: visibilities },
    },
  })
  if (!p) return null
  return {
    id: p.id,
    slug: p.slug,
    type: p.type,
    title: p.title,
    date: p.date.toISOString().slice(0, 10),
    tags: JSON.parse(p.tags || "[]") as string[],
    summary: p.summary,
    content: p.content,
    visibility: p.visibility,
  }
}

export async function getResumeContent(userId: string): Promise<{ mode: string; content: string; pdfPath?: string | null }> {
  const r = await prisma.resume.upsert({
    where: { userId },
    update: {},
    create: { userId, mode: "markdown", content: "" },
  })
  return { mode: r.mode, content: r.content, pdfPath: r.pdfPath }
}

export async function getSiteSettings(userId: string): Promise<{ ownerName: string; heroTagline: string }> {
  const DEFAULT = { ownerName: "LFen", heroTagline: "这里是我的个人空间，记录博客、日常、心得，以及正在进行中的求职旅程。" }
  try {
    const s = await prisma.siteSettings.upsert({
      where: { userId },
      update: {},
      create: { userId, ...DEFAULT },
    })
    return { ownerName: s.ownerName, heroTagline: s.heroTagline }
  } catch {
    return DEFAULT
  }
}
