import { prisma } from "@/lib/db"

export interface PostMeta {
  id: string
  title: string
  date: string
  tags: string[]
  summary: string
  slug: string
  type: "blog" | "daily" | "reflections" | "notes"
  visibility: string
  folderId: string | null
  folder: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

export interface Post extends PostMeta {
  content: string
  author: { id: string; email: string; displayName: string }
  wordCount: number
  readingMinutes: number
}

export type ArticleFolderItem = {
  id: string
  type: string
  name: string
  description: string
  coverImageUrl: string
  coverPositionX: number
  coverPositionY: number
  coverOpacity: number
  postCount: number
}

function postStats(content: string) {
  const text = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[#>*_`~\-[\]()]/g, " ")
    .trim()
  const cjk = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0
  const words = text.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length ?? 0
  const wordCount = cjk + words
  return {
    wordCount,
    readingMinutes: Math.max(1, Math.ceil(wordCount / 400)),
  }
}

export async function getArticleFolders(
  type: "blog" | "daily" | "reflections" | "notes",
  userId: string
): Promise<ArticleFolderItem[]> {
  const folders = await prisma.articleFolder.findMany({
    where: { type, userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { posts: true } } },
  })
  return folders.map((folder) => ({
    id: folder.id,
    type: folder.type,
    name: folder.name,
    description: folder.description,
    coverImageUrl: folder.coverImageUrl,
    coverPositionX: folder.coverPositionX,
    coverPositionY: folder.coverPositionY,
    coverOpacity: folder.coverOpacity,
    postCount: folder._count.posts,
  }))
}

export async function getPosts(
  type: "blog" | "daily" | "reflections" | "notes",
  userId: string,
  visibilities: string[] = ["private", "friends", "public"],
  folderId?: string | null
): Promise<PostMeta[]> {
  const folderFilter = folderId === undefined ? {} : { folderId }
  const posts = await prisma.post.findMany({
    where: { type, userId, visibility: { in: visibilities }, ...folderFilter },
    orderBy: { date: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      date: true,
      tags: true,
      summary: true,
      type: true,
      visibility: true,
      folderId: true,
      createdAt: true,
      updatedAt: true,
      folder: { select: { id: true, name: true } },
    },
  })
  return posts.map((p) => ({
    id: p.id,
    slug: p.slug,
    type: p.type as PostMeta["type"],
    title: p.title,
    date: p.date.toISOString().slice(0, 10),
    tags: JSON.parse(p.tags || "[]") as string[],
    summary: p.summary,
    visibility: p.visibility,
    folderId: p.folderId,
    folder: p.folder,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
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
    include: {
      user: { select: { id: true, email: true, displayName: true } },
      folder: { select: { id: true, name: true } },
    },
  })
  if (!p) return null
  const stats = postStats(p.content)
  return {
    id: p.id,
    slug: p.slug,
    type: p.type as PostMeta["type"],
    title: p.title,
    date: p.date.toISOString().slice(0, 10),
    tags: JSON.parse(p.tags || "[]") as string[],
    summary: p.summary,
    content: p.content,
    visibility: p.visibility,
    folderId: p.folderId,
    folder: p.folder,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    author: p.user,
    ...stats,
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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, email: true },
  })
  const fallbackName = user?.displayName || user?.email || "My Space"
  const DEFAULT = { ownerName: fallbackName, heroTagline: "这里是我的个人空间，记录博客、日常、心得，以及正在进行中的求职旅程。" }
  try {
    let s = await prisma.siteSettings.findUnique({ where: { userId } })
    if (!s) {
      s = await prisma.siteSettings.create({ data: { userId, ...DEFAULT } })
    } else if ((s.ownerName === "LFen" || !s.ownerName) && fallbackName !== "My Space") {
      s = await prisma.siteSettings.update({
        where: { userId },
        data: { ownerName: fallbackName },
      })
    }
    return { ownerName: s.ownerName, heroTagline: s.heroTagline }
  } catch {
    return DEFAULT
  }
}
