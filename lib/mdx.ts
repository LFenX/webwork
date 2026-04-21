import { prisma } from "@/lib/db"

export interface PostMeta {
  id: string
  title: string
  date: string
  tags: string[]
  summary: string
  slug: string
  type: string
}

export interface Post extends PostMeta {
  content: string
}

export async function getPosts(type: "blog" | "daily" | "reflections" | "notes"): Promise<PostMeta[]> {
  const posts = await prisma.post.findMany({
    where: { type },
    orderBy: { date: "desc" },
    select: { id: true, slug: true, title: true, date: true, tags: true, summary: true, type: true },
  })
  return posts.map((p) => ({
    id: p.id,
    slug: p.slug,
    type: p.type,
    title: p.title,
    date: p.date.toISOString().slice(0, 10),
    tags: JSON.parse(p.tags || "[]") as string[],
    summary: p.summary,
  }))
}

export async function getPost(
  type: "blog" | "daily" | "reflections" | "notes",
  slug: string
): Promise<Post | null> {
  const p = await prisma.post.findUnique({ where: { type_slug: { type, slug } } })
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
  }
}

export async function getResumeContent(): Promise<{ mode: string; content: string; pdfPath?: string | null }> {
  const r = await prisma.resume.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  })
  return { mode: r.mode, content: r.content, pdfPath: r.pdfPath }
}
