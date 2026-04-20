import fs from "fs"
import path from "path"
import matter from "gray-matter"

const contentRoot = path.join(process.cwd(), "content")

export interface PostMeta {
  title: string
  date: string
  tags?: string[]
  summary?: string
  slug: string
  type: string
}

export interface Post extends PostMeta {
  content: string
}

export function getPosts(type: "blog" | "daily" | "reflections"): PostMeta[] {
  const dir = path.join(contentRoot, type)
  if (!fs.existsSync(dir)) return []

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".mdx") || f.endsWith(".md"))
    .map((file) => {
      const slug = file.replace(/\.(mdx|md)$/, "")
      const raw = fs.readFileSync(path.join(dir, file), "utf8")
      const { data } = matter(raw)
      return {
        slug,
        type,
        title: data.title ?? slug,
        date: data.date ? String(data.date) : "",
        tags: data.tags ?? [],
        summary: data.summary ?? "",
      }
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function getPost(
  type: "blog" | "daily" | "reflections",
  slug: string
): Post | null {
  const dir = path.join(contentRoot, type)
  const mdxPath = path.join(dir, `${slug}.mdx`)
  const mdPath = path.join(dir, `${slug}.md`)
  const filePath = fs.existsSync(mdxPath) ? mdxPath : fs.existsSync(mdPath) ? mdPath : null
  if (!filePath) return null

  const raw = fs.readFileSync(filePath, "utf8")
  const { data, content } = matter(raw)
  return {
    slug,
    type,
    title: data.title ?? slug,
    date: data.date ? String(data.date) : "",
    tags: data.tags ?? [],
    summary: data.summary ?? "",
    content,
  }
}

export function getResumeContent(): string {
  const filePath = path.join(contentRoot, "resume.mdx")
  const mdPath = path.join(contentRoot, "resume.md")
  const p = fs.existsSync(filePath) ? filePath : fs.existsSync(mdPath) ? mdPath : null
  if (!p) return ""
  const raw = fs.readFileSync(p, "utf8")
  const { content } = matter(raw)
  return content
}
