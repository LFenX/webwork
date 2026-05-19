import "server-only"
import { prisma } from "@/lib/db"
import { toolGranted, toolForbidden, toolNotFound, toolPartial } from "@/lib/ai/tools/helpers"
import { POST_TYPES, type PostType } from "@/lib/enums"
import { revalidatePublicUserPaths } from "@/lib/public-revalidation"
import { isVisibility, normalizeVisibility } from "@/lib/visibility"

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9一-龥-]/g, "")
    .slice(0, 80) || Date.now().toString()
}

async function slugExists(userId: string, type: string, slug: string): Promise<boolean> {
  const existing = await prisma.post.findFirst({
    where: { userId, type, slug },
    select: { id: true },
  })
  return existing !== null
}

async function generateUniqueSlug(userId: string, type: string, title: string): Promise<string> {
  const base = `${slugify(title)}-${Date.now().toString(36)}`
  if (!(await slugExists(userId, type, base))) return base
  // Collision: append short random suffix up to 3 attempts
  for (let i = 0; i < 3; i++) {
    const suffix = Math.random().toString(36).slice(2, 6)
    const candidate = `${base}-${suffix}`
    if (!(await slugExists(userId, type, candidate))) return candidate
  }
  // Final fallback
  return `${base}-${Date.now().toString(36)}`
}

function normalizeLimit(n: number | undefined, fallback: number, max: number): number {
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(Math.trunc(n as number), 1), max)
}

function isValidPostType(value: string): value is PostType {
  return (POST_TYPES as readonly string[]).includes(value)
}

// ---------------------------------------------------------------------------
// Memory candidate hook (lightweight — does NOT persist anything now)
// ---------------------------------------------------------------------------

interface MarkdownToolMemoryCandidate {
  action: string
  module: string
  title?: string
  articleId?: string
  folderId?: string | null
  folderName?: string
  sourceModule?: string
  targetModule?: string
  slugChanged?: boolean
  changedFields?: string[]
}

function buildMemoryCandidate(candidate: MarkdownToolMemoryCandidate): MarkdownToolMemoryCandidate {
  // Future: persist to MemPalace / memory system.
  // Currently only returned as structured metadata for potential audit enrichment.
  return candidate
}

// ---------------------------------------------------------------------------
// 1. create_markdown_article
// ---------------------------------------------------------------------------

export const createMarkdownArticleTool = {
  name: "create_markdown_article",
  title: "创建 Markdown 文章",
  description:
    "在用户的博客(blog)、日常(daily)、心得(reflections)或笔记(notes)模块中创建一篇新的 Markdown 文章。",
  execute: async ({
    userId,
    module,
    title,
    content,
    summary,
    tags,
    folderId,
    visibility,
    date,
  }: {
    userId: string
    module: string
    title: string
    content?: string
    summary?: string
    tags?: string[]
    folderId?: string | null
    visibility?: string
    date?: string
  }) => {
    if (!title?.trim()) {
      return toolForbidden("标题不能为空。", "title_required")
    }
    if (!isValidPostType(module)) {
      return toolForbidden(`模块类型 ${module} 无效，必须是 blog、daily、reflections 或 notes。`, "invalid_module")
    }

    // Validate folder ownership and type match
    if (folderId) {
      const folder = await prisma.articleFolder.findFirst({
        where: { id: folderId, userId, type: module },
        select: { id: true, name: true },
      })
      if (!folder) {
        return toolNotFound("指定的文件夹不存在或不属于当前用户。", "folder_not_found", { folderId, module })
      }
    }
    if (visibility !== undefined && !isVisibility(visibility)) {
      return toolForbidden("可见性无效，必须是 private、friends 或 public。", "invalid_visibility")
    }

    const slug = await generateUniqueSlug(userId, module, title.trim())
    const normalizedVisibility = normalizeVisibility(visibility)

    const post = await prisma.post.create({
      data: {
        userId,
        type: module,
        slug,
        title: title.trim(),
        content: content ?? "",
        summary: summary?.trim() || "",
        tags: JSON.stringify(tags?.filter(Boolean) ?? []),
        folderId: folderId || null,
        visibility: normalizedVisibility,
        date: date ? new Date(date) : new Date(),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        type: true,
        folderId: true,
        visibility: true,
        date: true,
      },
    })
    await revalidatePublicUserPaths(userId, ["", module, `${module}/${post.slug}`])

    const memoryCandidate = buildMemoryCandidate({
      action: "create_article",
      module,
      title: post.title,
      articleId: post.id,
      folderId: post.folderId,
    })

    return toolGranted(`已在 ${module} 模块创建文章《${post.title}》。`, {
      articleId: post.id,
      slug: post.slug,
      title: post.title,
      module: post.type,
      folderId: post.folderId,
      visibility: post.visibility,
      date: post.date.toISOString().slice(0, 10),
      memoryCandidate,
    })
  },
}

// ---------------------------------------------------------------------------
// 2. update_markdown_article
// ---------------------------------------------------------------------------

export const updateMarkdownArticleTool = {
  name: "update_markdown_article",
  title: "修改 Markdown 文章",
  description:
    "修改当前用户已有 Markdown 文章的标题、正文、摘要、标签、可见性或日期，也可将文章移动到同一模块的其他文件夹。",
  execute: async ({
    userId,
    module,
    articleId,
    title,
    content,
    summary,
    tags,
    folderId,
    visibility,
    date,
  }: {
    userId: string
    module: string
    articleId: string
    title?: string
    content?: string
    summary?: string
    tags?: string[]
    folderId?: string | null
    visibility?: string
    date?: string
  }) => {
    if (!articleId?.trim()) {
      return toolForbidden("articleId 不能为空。", "article_id_required")
    }
    if (!isValidPostType(module)) {
      return toolForbidden(`模块类型 ${module} 无效。`, "invalid_module")
    }

    const article = await prisma.post.findFirst({
      where: { id: articleId, userId },
      select: {
        id: true,
        userId: true,
        type: true,
        slug: true,
        title: true,
        content: true,
        summary: true,
        tags: true,
        folderId: true,
        visibility: true,
        date: true,
      },
    })

    if (!article) {
      return toolNotFound("未找到该文章，或文章不属于当前用户。", "article_not_found", { articleId })
    }

    if (article.type !== module) {
      return toolForbidden(
        `文章类型为 ${article.type}，与指定的模块 ${module} 不匹配。`,
        "type_mismatch",
        { articleId, expectedType: module, actualType: article.type },
      )
    }

    // Reject clearing content
    if (content === "") {
      return toolForbidden("不允许清空文章正文。", "content_cannot_be_empty")
    }

    // If folderId explicitly provided, validate it
    if (folderId !== undefined) {
      if (folderId) {
        const folder = await prisma.articleFolder.findFirst({
          where: { id: folderId, userId, type: module },
          select: { id: true, name: true },
        })
        if (!folder) {
          return toolNotFound("指定的文件夹不存在或不属于当前用户。", "folder_not_found", { folderId, module })
        }
      }
    }

    const changedFields: string[] = []
    const data: Record<string, unknown> = {}

    if (title !== undefined && title.trim() !== article.title) {
      data.title = title.trim()
      changedFields.push("title")
    }
    if (content !== undefined) {
      data.content = content
      changedFields.push("content")
    }
    if (summary !== undefined) {
      data.summary = summary?.trim() ?? ""
      changedFields.push("summary")
    }
    if (tags !== undefined) {
      data.tags = JSON.stringify(tags.filter(Boolean))
      changedFields.push("tags")
    }
    if (folderId !== undefined) {
      data.folderId = folderId || null
      changedFields.push("folderId")
    }
    if (visibility !== undefined) {
      if (!isVisibility(visibility)) {
        return toolForbidden("可见性无效，必须是 private、friends 或 public。", "invalid_visibility")
      }
      data.visibility = normalizeVisibility(visibility)
      changedFields.push("visibility")
    }
    if (date !== undefined) {
      data.date = new Date(date)
      changedFields.push("date")
    }

    if (changedFields.length === 0) {
      return toolGranted("未检测到任何字段变更，文章保持不变。", {
        articleId: article.id,
        slug: article.slug,
        title: article.title,
        module: article.type,
        folderId: article.folderId,
        visibility: article.visibility,
        updatedAt: article.date.toISOString(),
      })
    }

    const updated = await prisma.post.update({
      where: { id: articleId },
      data,
      select: {
        id: true,
        slug: true,
        title: true,
        type: true,
        folderId: true,
        visibility: true,
        updatedAt: true,
      },
    })
    await revalidatePublicUserPaths(userId, ["", module, `${module}/${article.slug}`, `${module}/${updated.slug}`])

    const memoryCandidate = buildMemoryCandidate({
      action: "update_article",
      module,
      title: updated.title,
      articleId: updated.id,
      folderId: updated.folderId,
      changedFields,
    })

    return toolGranted(
      `已更新 ${module} 模块文章《${updated.title}》，修改字段：${changedFields.join("、")}。`,
      {
        articleId: updated.id,
        slug: updated.slug,
        title: updated.title,
        module: updated.type,
        folderId: updated.folderId,
        visibility: updated.visibility,
        updatedAt: updated.updatedAt.toISOString(),
        memoryCandidate,
      },
    )
  },
}

// ---------------------------------------------------------------------------
// 3. get_markdown_article_detail
// ---------------------------------------------------------------------------

export const getMarkdownArticleDetailTool = {
  name: "get_markdown_article_detail",
  title: "读取 Markdown 文章详情",
  description:
    "读取当前用户某篇 Markdown 文章的完整详情，包括正文内容，方便 AI 继续编辑或参考。",
  execute: async ({
    userId,
    module,
    articleId,
    slug,
  }: {
    userId: string
    module: string
    articleId?: string
    slug?: string
  }) => {
    if (!articleId?.trim() && !slug?.trim()) {
      return toolForbidden("请至少提供 articleId 或 slug。", "locator_required")
    }
    if (!isValidPostType(module)) {
      return toolForbidden(`模块类型 ${module} 无效。`, "invalid_module")
    }

    const where = articleId?.trim()
      ? { id: articleId.trim(), userId, type: module }
      : { userId, type: module, slug: slug!.trim() }

    const article = await prisma.post.findFirst({
      where,
      select: {
        id: true,
        slug: true,
        type: true,
        title: true,
        summary: true,
        tags: true,
        content: true,
        visibility: true,
        folderId: true,
        date: true,
        createdAt: true,
        updatedAt: true,
        folder: { select: { id: true, name: true } },
      },
    })

    if (!article) {
      return toolNotFound("未找到该文章，或文章不属于当前用户。", "article_not_found", {
        articleId: articleId ?? null,
        slug: slug ?? null,
        module,
      })
    }

    return toolGranted(`已读取文章《${article.title}》的完整详情。`, {
      articleId: article.id,
      slug: article.slug,
      module: article.type,
      title: article.title,
      summary: article.summary,
      tags: JSON.parse(article.tags || "[]") as string[],
      content: article.content,
      visibility: article.visibility,
      folderId: article.folderId,
      folder: article.folder,
      date: article.date.toISOString().slice(0, 10),
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
    })
  },
}

// ---------------------------------------------------------------------------
// 4. list_markdown_articles
// ---------------------------------------------------------------------------

export const listMarkdownArticlesTool = {
  name: "list_markdown_articles",
  title: "列出 Markdown 文章",
  description:
    "列出当前用户某个模块下的文章摘要列表，可按文件夹或关键词筛选，方便 AI 找到要编辑的文章。",
  execute: async ({
    userId,
    module,
    folderId,
    keyword,
    limit,
  }: {
    userId: string
    module: string
    folderId?: string | null
    keyword?: string
    limit?: number
  }) => {
    if (!isValidPostType(module)) {
      return toolForbidden(`模块类型 ${module} 无效。`, "invalid_module")
    }

    // If folderId provided, validate it
    if (folderId) {
      const folder = await prisma.articleFolder.findFirst({
        where: { id: folderId, userId, type: module },
        select: { id: true },
      })
      if (!folder) {
        return toolNotFound("指定的文件夹不存在或不属于当前用户。", "folder_not_found", { folderId, module })
      }
    }

    const maxLimit = normalizeLimit(limit, 10, 30)
    const folderFilter = folderId === undefined ? {} : folderId === null ? { folderId: null } : { folderId }

    const where: Record<string, unknown> = {
      userId,
      type: module,
      ...folderFilter,
    }

    if (keyword?.trim()) {
      const kw = keyword.trim()
      where.OR = [
        { title: { contains: kw, mode: "insensitive" } },
        { summary: { contains: kw, mode: "insensitive" } },
        { tags: { contains: kw, mode: "insensitive" } },
      ]
    }

    const posts = await prisma.post.findMany({
      where,
      orderBy: { date: "desc" },
      take: maxLimit,
      select: {
        id: true,
        slug: true,
        type: true,
        title: true,
        summary: true,
        visibility: true,
        folderId: true,
        date: true,
        updatedAt: true,
        folder: { select: { id: true, name: true } },
      },
    })

    const items = posts.map((p) => ({
      id: p.id,
      slug: p.slug,
      module: p.type,
      title: p.title,
      summary: p.summary,
      visibility: p.visibility,
      folderId: p.folderId,
      folder: p.folder,
      date: p.date.toISOString().slice(0, 10),
      updatedAt: p.updatedAt.toISOString(),
    }))

    return toolGranted(`已列出 ${items.length} 篇 ${module} 文章。`, { items })
  },
}

// ---------------------------------------------------------------------------
// 5. create_content_folder
// ---------------------------------------------------------------------------

export const createContentFolderTool = {
  name: "create_content_folder",
  title: "创建内容文件夹",
  description:
    "在指定模块（blog/daily/reflections/notes）中创建一个文件夹/分类器，用于组织文章。",
  execute: async ({
    userId,
    module,
    name,
    description,
  }: {
    userId: string
    module: string
    name: string
    description?: string
  }) => {
    if (!name?.trim()) {
      return toolForbidden("文件夹名称不能为空。", "folder_name_required")
    }
    if (!isValidPostType(module)) {
      return toolForbidden(`模块类型 ${module} 无效。`, "invalid_module")
    }

    // Check for duplicate name in same user + module
    const existing = await prisma.articleFolder.findFirst({
      where: { userId, type: module, name: name.trim() },
      select: { id: true, name: true, type: true, description: true, createdAt: true, updatedAt: true },
    })

    if (existing) {
      const memoryCandidate = buildMemoryCandidate({
        action: "create_folder_duplicate",
        module,
        folderName: name.trim(),
        folderId: existing.id,
      })

      return toolGranted(
        `模块 ${module} 下已存在同名文件夹「${name.trim()}」，已返回现有文件夹。`,
        {
          folderId: existing.id,
          name: existing.name,
          module: existing.type,
          description: existing.description,
          alreadyExisted: true,
          memoryCandidate,
        },
      )
    }

    const folder = await prisma.articleFolder.create({
      data: {
        userId,
        type: module,
        name: name.trim(),
        description: description?.trim() || "",
      },
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
      },
    })

    const memoryCandidate = buildMemoryCandidate({
      action: "create_folder",
      module,
      folderName: folder.name,
      folderId: folder.id,
    })

    return toolGranted(`已在 ${module} 模块创建文件夹「${folder.name}」。`, {
      folderId: folder.id,
      name: folder.name,
      module: folder.type,
      description: folder.description,
      memoryCandidate,
    })
  },
}

// ---------------------------------------------------------------------------
// 6. list_content_folders
// ---------------------------------------------------------------------------

export const listContentFoldersTool = {
  name: "list_content_folders",
  title: "列出内容文件夹",
  description: "列出当前用户某个模块（blog/daily/reflections/notes）下的所有文件夹。",
  execute: async ({
    userId,
    module,
  }: {
    userId: string
    module: string
  }) => {
    if (!isValidPostType(module)) {
      return toolForbidden(`模块类型 ${module} 无效。`, "invalid_module")
    }

    const folders = await prisma.articleFolder.findMany({
      where: { userId, type: module },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { posts: true } },
      },
    })

    const items = folders.map((f) => ({
      folderId: f.id,
      name: f.name,
      module: f.type,
      description: f.description,
      articleCount: f._count.posts,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    }))

    return toolGranted(`已列出 ${items.length} 个 ${module} 文件夹。`, { items })
  },
}

// ---------------------------------------------------------------------------
// 7. move_article_to_folder
// ---------------------------------------------------------------------------

export const moveArticleToFolderTool = {
  name: "move_article_to_folder",
  title: "移动文章到文件夹",
  description:
    "将当前用户某篇文章移动到指定模块的指定文件夹（或根目录）。支持同模块和跨模块移动，跨模块移动需要用户明确确认。",
  execute: async ({
    userId,
    sourceModule,
    articleId,
    targetModule,
    targetFolderId,
    confirmedByUser,
  }: {
    userId: string
    sourceModule: string
    articleId: string
    targetModule?: string
    targetFolderId?: string | null
    confirmedByUser?: boolean
  }) => {
    if (!articleId?.trim()) {
      return toolForbidden("articleId 不能为空。", "article_id_required")
    }
    if (!isValidPostType(sourceModule)) {
      return toolForbidden(`源模块类型 ${sourceModule} 无效。`, "invalid_source_module")
    }

    const resolvedTargetModule = targetModule?.trim() || sourceModule
    if (!isValidPostType(resolvedTargetModule)) {
      return toolForbidden(`目标模块类型 ${resolvedTargetModule} 无效。`, "invalid_target_module")
    }

    const article = await prisma.post.findFirst({
      where: { id: articleId, userId },
      select: {
        id: true,
        userId: true,
        type: true,
        slug: true,
        title: true,
        folderId: true,
      },
    })

    if (!article) {
      return toolNotFound("未找到该文章，或文章不属于当前用户。", "article_not_found", { articleId })
    }

    if (article.type !== sourceModule) {
      return toolForbidden(
        `文章类型为 ${article.type}，与指定的源模块 ${sourceModule} 不匹配。`,
        "source_type_mismatch",
        { articleId, expectedType: sourceModule, actualType: article.type },
      )
    }

    // Validate target folder if provided
    if (targetFolderId) {
      const folder = await prisma.articleFolder.findFirst({
        where: { id: targetFolderId, userId, type: resolvedTargetModule },
        select: { id: true, name: true },
      })
      if (!folder) {
        return toolNotFound("目标文件夹不存在或不属于当前用户。", "target_folder_not_found", {
          targetFolderId,
          targetModule: resolvedTargetModule,
        })
      }
    }

    const isCrossModule = sourceModule !== resolvedTargetModule

    // Cross-module move requires user confirmation
    if (isCrossModule && !confirmedByUser) {
      return toolPartial(
        `需要用户确认：即将把 ${sourceModule} 模块文章《${article.title}》移动到 ${resolvedTargetModule} 模块。`,
        {
          need_confirmation: true,
          articleId: article.id,
          title: article.title,
          sourceModule,
          targetModule: resolvedTargetModule,
          targetFolderId: targetFolderId ?? null,
          message: `即将把 ${sourceModule} 模块文章《${article.title}》移动到 ${resolvedTargetModule} 模块。请确认是否执行此跨模块移动操作。确认后请再次调用本工具并设置 confirmedByUser 为 true。`,
        },
        "cross_module_move_needs_confirmation",
      )
    }

    // Execute the move
    const newType = isCrossModule ? resolvedTargetModule : article.type
    const newFolderId = targetFolderId !== undefined ? (targetFolderId || null) : article.folderId

    // Handle slug uniqueness for cross-module moves
    let newSlug = article.slug
    let slugChanged = false

    if (isCrossModule) {
      const slugConflict = await prisma.post.findFirst({
        where: {
          userId,
          type: newType,
          slug: article.slug,
          id: { not: article.id },
        },
        select: { id: true },
      })
      if (slugConflict) {
        newSlug = await generateUniqueSlug(userId, newType, article.title)
        slugChanged = true
      }
    }

    const updated = await prisma.post.update({
      where: { id: articleId },
      data: {
        type: newType,
        folderId: newFolderId,
        slug: newSlug,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        type: true,
        folderId: true,
        updatedAt: true,
      },
    })

    const memoryCandidate = buildMemoryCandidate({
      action: isCrossModule ? "cross_module_move" : "same_module_move",
      module: updated.type,
      title: updated.title,
      articleId: updated.id,
      folderId: updated.folderId,
      sourceModule,
      targetModule: resolvedTargetModule,
      slugChanged,
    })

    const moveDesc = isCrossModule
      ? `从 ${sourceModule} 跨模块移动到 ${resolvedTargetModule}`
      : `在 ${sourceModule} 模块内移动`

    return toolGranted(
      `已将文章《${updated.title}》${moveDesc}。${slugChanged ? `注意：slug 已更新为 ${newSlug}。` : ""}`,
      {
        articleId: updated.id,
        title: updated.title,
        sourceModule,
        targetModule: resolvedTargetModule,
        folderId: updated.folderId,
        slug: updated.slug,
        slugChanged,
        updatedAt: updated.updatedAt.toISOString(),
        memoryCandidate,
      },
    )
  },
}
