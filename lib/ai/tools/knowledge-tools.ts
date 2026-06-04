import "server-only"
import { prisma } from "@/lib/db"
import { toolGranted, toolForbidden, toolNotFound } from "@/lib/ai/tools/helpers"
import { revalidatePublicUserPaths } from "@/lib/public-revalidation"
import { isVisibility, normalizeVisibility } from "@/lib/visibility"
import { generateUniqueSlug, isValidPostType, normalizeLimit } from "@/lib/ai/tools/markdown-content-tools"

// Knowledge-base / 错题本 toolset. These build on the existing Post model: a
// "knowledge entry" is a normal article (default module = notes) marked with a
// reserved tag `kb:<category>` so it can be recalled precisely without colliding
// with the user's own tags. No schema migration is required.

const KB_CATEGORIES = ["错题", "资料", "资讯", "咨询", "其他"] as const
type KbCategory = (typeof KB_CATEGORIES)[number]
const KB_TAG_PREFIX = "kb:"

function isKbCategory(value: string): value is KbCategory {
  return (KB_CATEGORIES as readonly string[]).includes(value)
}

function kbTag(category: string) {
  return `${KB_TAG_PREFIX}${category}`
}

function parseTags(raw: string): string[] {
  try {
    const value = JSON.parse(raw)
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
  } catch {
    return []
  }
}

function splitTags(tags: string[]) {
  const category = tags.find((tag) => tag.startsWith(KB_TAG_PREFIX))?.slice(KB_TAG_PREFIX.length) ?? ""
  const userTags = tags.filter((tag) => !tag.startsWith(KB_TAG_PREFIX))
  return { category, userTags }
}

// Build a deduped tag list with the reserved category tag first.
function buildTagList(category: string, userTags: string[] | undefined) {
  const cleaned = (userTags ?? []).map((tag) => tag.trim()).filter((tag) => tag && !tag.startsWith(KB_TAG_PREFIX))
  return Array.from(new Set([kbTag(category), ...cleaned]))
}

// Pull a readable excerpt around the first place the query (or one of its terms)
// appears, so recall results can be quoted without returning whole articles.
function extractSnippet(content: string, query: string, radius = 140): string {
  const text = content.replace(/\s+/g, " ").trim()
  if (!text) return ""
  if (!query.trim()) return text.slice(0, 220)

  const haystack = text.toLowerCase()
  const candidates = [query.trim(), ...query.trim().split(/\s+/)].filter((term) => term.length >= 1)
  let idx = -1
  let matchLen = 0
  for (const term of candidates) {
    const found = haystack.indexOf(term.toLowerCase())
    if (found >= 0) {
      idx = found
      matchLen = term.length
      break
    }
  }
  if (idx < 0) return text.slice(0, 220)

  const start = Math.max(0, idx - radius)
  const end = Math.min(text.length, idx + matchLen + radius)
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`
}

// ---------------------------------------------------------------------------
// 1. compose_knowledge_note — capture / summarize into a structured note
// ---------------------------------------------------------------------------

export const composeKnowledgeNoteTool = {
  name: "compose_knowledge_note",
  title: "整理收录知识/错题笔记",
  description:
    "把当前会话中的 PDF（先用 read/search_my_pdf_documents 取到带页码的事实）、图片理解结果或用户提供的内容，整理成一篇忠于原始事实、结构清晰、排版优美的 Markdown 笔记，存入用户的知识库（默认 notes 模块），可新建或追加到已有笔记，作为错题本/资料库/资讯库使用。\n" +
    "写作要求（必须遵守）：1) 只整理原始事实，不得虚构或臆造数据；2) 必须在笔记中标注来源（如《xxx.pdf》第3页、本次上传的图片）；3) 按类别组织：错题用「题目/选项/我的答案/正确答案/详细解析/涉及知识点/易错点/举一反三」，资料·资讯用「概述/要点/结构化正文/原文出处/延伸」；4) 使用优美的 Markdown（标题层级、表格、引用块，必要时用 $$ 包裹公式）；5) 逻辑完整、适度优化但不歪曲原意。",
  inputSchemaSummary: "category, title, content, module?, tags?, folderId?, visibility?, sources?, appendToArticleId?",
  sensitivity: "high" as const,
  auditLabel: "compose_self_knowledge_note",
  whenToUse: "当用户要把咨询、错题、资料、资讯等（含图片/PDF 中的内容）汇总、整理、收录成笔记/文章，或追加到已有错题本/资料库时使用。",
  whenNotToUse: "纯闲聊、不涉及保存内容时不要用；要修改非知识库的普通文章时用 update_markdown_article。",
  argumentHints: [
    "category 必填：错题/资料/资讯/咨询/其他",
    "content 是你撰写好的完整 Markdown 正文",
    "appendToArticleId 用于把新条目追加进已有笔记",
    "sources 写明来源，例如《xxx.pdf》第3页",
  ],
  returns: "新建或更新后的笔记 articleId、slug、模块、类别与模式。",
  parameterSchema: {
    type: "object",
    properties: {
      category: { type: "string", enum: [...KB_CATEGORIES] },
      title: { type: "string" },
      content: { type: "string" },
      module: { type: "string", enum: ["notes", "blog", "daily", "reflections"] },
      tags: { type: "array", items: { type: "string" } },
      folderId: { type: "string" },
      visibility: { type: "string", enum: ["private", "friends", "public"] },
      sources: { type: "string" },
      appendToArticleId: { type: "string" },
    },
    required: ["category", "title", "content"],
    additionalProperties: false,
  },
  execute: async ({
    userId,
    category,
    title,
    content,
    module,
    tags,
    folderId,
    visibility,
    sources,
    appendToArticleId,
  }: {
    userId: string
    category: string
    title: string
    content: string
    module?: string
    tags?: string[]
    folderId?: string | null
    visibility?: string
    sources?: string
    appendToArticleId?: string
  }) => {
    if (!isKbCategory(category)) {
      return toolForbidden(`类别 ${category} 无效，必须是 错题/资料/资讯/咨询/其他。`, "invalid_category")
    }
    if (!title?.trim()) {
      return toolForbidden("标题不能为空。", "title_required")
    }
    if (!content?.trim()) {
      return toolForbidden("正文不能为空。", "content_required")
    }

    const targetModule = module ?? "notes"
    if (!isValidPostType(targetModule)) {
      return toolForbidden(`模块类型 ${targetModule} 无效，必须是 blog、daily、reflections 或 notes。`, "invalid_module")
    }
    if (visibility !== undefined && !isVisibility(visibility)) {
      return toolForbidden("可见性无效，必须是 private、friends 或 public。", "invalid_visibility")
    }

    const sourceLine = sources?.trim() ? `\n\n*来源：${sources.trim()}*` : ""

    // Append mode: add a new entry to an existing knowledge note.
    if (appendToArticleId) {
      const existing = await prisma.post.findFirst({
        where: { id: appendToArticleId, userId },
        select: { id: true, slug: true, type: true, title: true, content: true, tags: true, folderId: true, visibility: true },
      })
      if (!existing) {
        return toolNotFound("要追加的笔记不存在或不属于当前用户。", "article_not_found", { appendToArticleId })
      }

      const mergedTags = Array.from(new Set([...parseTags(existing.tags), kbTag(category)]))
      const appended = `${existing.content.trimEnd()}\n\n---\n\n${content.trim()}${sourceLine}`
      const updated = await prisma.post.update({
        where: { id: existing.id },
        data: { content: appended, tags: JSON.stringify(mergedTags) },
        select: { id: true, slug: true, type: true, title: true, folderId: true, visibility: true, updatedAt: true },
      })
      await revalidatePublicUserPaths(userId, ["", updated.type, `${updated.type}/${updated.slug}`])

      return toolGranted(`已向《${existing.title}》追加一条${category}内容。`, {
        articleId: updated.id,
        slug: updated.slug,
        module: updated.type,
        category,
        mode: "append",
        visibility: updated.visibility,
      })
    }

    // Validate folder ownership when creating a new note.
    if (folderId) {
      const folder = await prisma.articleFolder.findFirst({
        where: { id: folderId, userId, type: targetModule },
        select: { id: true },
      })
      if (!folder) {
        return toolNotFound("指定的文件夹不存在或不属于当前用户。", "folder_not_found", { folderId, module: targetModule })
      }
    }

    const slug = await generateUniqueSlug(userId, targetModule, title.trim())
    const post = await prisma.post.create({
      data: {
        userId,
        type: targetModule,
        slug,
        title: title.trim(),
        content: `${content.trim()}${sourceLine}`,
        summary: "",
        tags: JSON.stringify(buildTagList(category, tags)),
        folderId: folderId || null,
        visibility: normalizeVisibility(visibility),
        date: new Date(),
      },
      select: { id: true, slug: true, type: true, folderId: true, visibility: true },
    })
    await revalidatePublicUserPaths(userId, ["", post.type, `${post.type}/${post.slug}`])

    return toolGranted(`已在 ${targetModule} 模块创建${category}笔记《${title.trim()}》。`, {
      articleId: post.id,
      slug: post.slug,
      module: post.type,
      category,
      mode: "create",
      folderId: post.folderId,
      visibility: post.visibility,
    })
  },
}

// ---------------------------------------------------------------------------
// 2. search_knowledge_notes — fast recall over knowledge entries
// ---------------------------------------------------------------------------

export const searchKnowledgeNotesTool = {
  name: "search_knowledge_notes",
  title: "召回知识/错题笔记",
  description:
    "在用户的知识库中快速检索已收录的错题、资料、资讯等笔记。与 list_markdown_articles 不同，本工具会全文检索正文内容，并返回命中处的片段摘录，便于快速找到并引用具体错题/资料。",
  inputSchemaSummary: "query, module?, category?, folderId?, tags?, limit?",
  sensitivity: "medium" as const,
  auditLabel: "search_self_knowledge_notes",
  whenToUse: "当用户要找回之前记录的某道错题、某份资料或某条资讯，或问“我之前记过的关于X”时使用。",
  whenNotToUse: "要新建/整理内容时用 compose_knowledge_note；要读取某篇全文时用 get_markdown_article_detail。",
  argumentHints: ["query 为关键词", "category 可限定 错题/资料/资讯/咨询/其他", "limit 默认 10"],
  returns: "命中的知识笔记列表，含标题、类别、标签、片段摘录、articleId 与 slug。",
  parameterSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
      module: { type: "string", enum: ["notes", "blog", "daily", "reflections"] },
      category: { type: "string", enum: [...KB_CATEGORIES] },
      folderId: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      limit: { type: "integer", minimum: 1, maximum: 30 },
    },
    required: ["query"],
    additionalProperties: false,
  },
  execute: async ({
    userId,
    query,
    module,
    category,
    folderId,
    tags,
    limit,
  }: {
    userId: string
    query: string
    module?: string
    category?: string
    folderId?: string | null
    tags?: string[]
    limit?: number
  }) => {
    const targetModule = module ?? "notes"
    if (!isValidPostType(targetModule)) {
      return toolForbidden(`模块类型 ${targetModule} 无效。`, "invalid_module")
    }
    if (category !== undefined && !isKbCategory(category)) {
      return toolForbidden(`类别 ${category} 无效。`, "invalid_category")
    }

    const cleanedQuery = query.trim()
    const tagFilters = (tags ?? []).map((tag) => tag.trim()).filter(Boolean)

    const and: Record<string, unknown>[] = [{ tags: { contains: KB_TAG_PREFIX } }]
    if (category) and.push({ tags: { contains: kbTag(category) } })
    for (const tag of tagFilters) and.push({ tags: { contains: tag } })
    if (cleanedQuery) {
      and.push({
        OR: [
          { title: { contains: cleanedQuery, mode: "insensitive" } },
          { summary: { contains: cleanedQuery, mode: "insensitive" } },
          { content: { contains: cleanedQuery, mode: "insensitive" } },
          { tags: { contains: cleanedQuery, mode: "insensitive" } },
        ],
      })
    }

    const folderFilter = folderId === undefined ? {} : folderId === null ? { folderId: null } : { folderId }

    const where: Record<string, unknown> = { userId, type: targetModule, ...folderFilter, AND: and }

    const posts = await prisma.post.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: normalizeLimit(limit, 10, 30),
      select: {
        id: true,
        slug: true,
        type: true,
        title: true,
        summary: true,
        content: true,
        tags: true,
        visibility: true,
        folderId: true,
        date: true,
        updatedAt: true,
        folder: { select: { id: true, name: true } },
      },
    })

    const items = posts.map((post) => {
      const allTags = parseTags(post.tags)
      const { category: postCategory, userTags } = splitTags(allTags)
      return {
        articleId: post.id,
        slug: post.slug,
        module: post.type,
        title: post.title,
        category: postCategory,
        tags: userTags,
        folder: post.folder,
        visibility: post.visibility,
        date: post.date.toISOString().slice(0, 10),
        updatedAt: post.updatedAt.toISOString(),
        snippet: extractSnippet(post.content, cleanedQuery),
      }
    })

    return toolGranted(`找到 ${items.length} 篇知识笔记。`, { items })
  },
}
