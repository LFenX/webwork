import { prisma } from "@/lib/db"
import { countWords, readingMinutes } from "@/lib/text-stats"

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
  coverFitMode: string
  coverScale: number
  postCount: number
}

function postStats(content: string) {
  const wordCount = countWords(content)
  return {
    wordCount,
    readingMinutes: readingMinutes(wordCount),
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
    coverFitMode: folder.coverFitMode,
    coverScale: folder.coverScale,
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
    date: p.date.toISOString(),
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
    date: p.date.toISOString(),
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

export interface ResumeContent {
  mode: string
  content: string
  pdfPath?: string | null
  resumeJson?: unknown | null
  selectedTheme?: string | null
  lastExportedPdfPath?: string | null
  lastExportedAt?: Date | null
  renderedHtml?: string | null
  lastBuiltAt?: Date | null
  lastBuiltTheme?: string | null
  lastBuiltConfigHash?: string | null
  resumeLocale?: string | null
  resumeAppearance?: string | null
  resumeConfig?: unknown | null
}

export async function getResumeContent(userId: string): Promise<ResumeContent> {
  const r = await prisma.resume.upsert({
    where: { userId },
    update: {},
    create: { userId, mode: "markdown", content: "" },
  })
  return {
    mode: r.mode,
    content: r.content,
    pdfPath: r.pdfPath,
    resumeJson: r.resumeJson ?? null,
    selectedTheme: r.selectedTheme ?? null,
    lastExportedPdfPath: r.lastExportedPdfPath ?? null,
    lastExportedAt: r.lastExportedAt ?? null,
    renderedHtml: r.renderedHtml ?? null,
    lastBuiltAt: r.lastBuiltAt ?? null,
    lastBuiltTheme: r.lastBuiltTheme ?? null,
    lastBuiltConfigHash: r.lastBuiltConfigHash ?? null,
    resumeLocale: r.resumeLocale ?? null,
    resumeAppearance: r.resumeAppearance ?? null,
    resumeConfig: r.resumeConfig ?? null,
  }
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
