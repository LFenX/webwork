import "server-only"
import {
  saveMemoryFact,
  searchMemory,
  listMemoryFacts,
  softDeleteMemoryFact,
  getMemoryFact,
  getMemorySettings,
} from "@/lib/ai/memory/memory-service"
import { toolGranted, toolForbidden, toolNotFound } from "@/lib/ai/tools/helpers"

const VALID_CATEGORIES = ["preference", "project", "decision", "workflow", "bugfix", "content_operation", "other"]

function normalizeLimit(n: number | undefined, fallback: number, max: number): number {
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(Math.trunc(n as number), 1), max)
}

// ---------------------------------------------------------------------------
// 1. save_user_memory
// ---------------------------------------------------------------------------

export const saveUserMemoryTool = {
  name: "save_user_memory",
  title: "保存用户记忆",
  description:
    "当用户明确说'记住……''以后都按照……'或表达长期偏好时，保存一条结构化长期记忆。不要把所有聊天都存成记忆。",
  execute: async ({
    userId,
    category,
    title,
    content,
    tags,
    importance,
    expiresAt,
  }: {
    userId: string
    category: string
    title: string
    content: string
    tags?: string[]
    importance?: string
    expiresAt?: string | null
  }) => {
    if (!title?.trim()) return toolForbidden("记忆标题不能为空。", "title_required")
    if (!content?.trim()) return toolForbidden("记忆内容不能为空。", "content_required")
    if (!VALID_CATEGORIES.includes(category)) {
      return toolForbidden(`记忆分类 "${category}" 无效，可选值：${VALID_CATEGORIES.join("、")}。`, "invalid_category")
    }

    const settings = await getMemorySettings(userId)
    if (!settings.enableLongTermMemory) {
      return toolForbidden("长期记忆功能已关闭，无法保存。", "long_term_memory_disabled")
    }
    if (!settings.enableMemoryTools) {
      return toolForbidden("记忆工具已关闭。", "memory_tools_disabled")
    }

    if (settings.requireConfirmBeforeSave) {
      return toolForbidden(
        "当前记忆设置要求保存前确认。请告知用户需要手动确认，或请用户进入记忆设置关闭此要求。",
        "confirmation_required",
        { need_confirmation: true },
      )
    }

    const result = await saveMemoryFact(userId, {
      category,
      title: title.trim(),
      content: content.trim(),
      tags,
      importance: importance ?? "medium",
      source: "manual",
      expiresAt,
    })

    if (!result.ok) {
      return toolForbidden(`保存失败：${result.reason ?? "未知原因"}。`, result.reason ?? "save_failed")
    }

    return toolGranted(`已保存记忆「${title.trim()}」。`, {
      memoryId: result.id,
      title: title.trim(),
      category,
      importance: importance ?? "medium",
      createdAt: new Date().toISOString(),
    })
  },
}

// ---------------------------------------------------------------------------
// 2. search_user_memory
// ---------------------------------------------------------------------------

export const searchUserMemoryTool = {
  name: "search_user_memory",
  title: "搜索用户记忆",
  description:
    "当用户问'上次怎么说的''之前怎么决定的''按照我的习惯'时，主动搜索当前用户的长期记忆。",
  execute: async ({
    userId,
    query,
    category,
    limit,
  }: {
    userId: string
    query: string
    category?: string
    limit?: number
  }) => {
    if (!query?.trim()) return toolForbidden("搜索关键词不能为空。", "query_required")

    const settings = await getMemorySettings(userId)
    if (!settings.enableMemoryRecall) {
      return toolForbidden("记忆召回功能已关闭。", "memory_recall_disabled")
    }
    if (!settings.enableMemoryTools) {
      return toolForbidden("记忆工具已关闭。", "memory_tools_disabled")
    }

    const result = await searchMemory(userId, {
      query: query.trim(),
      categories: category ? [category] : undefined,
      limit: normalizeLimit(limit, 5, 20),
      includeToolEvent: true,
      includeEvent: true,
    })

    if (result.skipped) {
      return toolForbidden("记忆搜索不可用。", result.reason ?? "search_skipped")
    }

    if (result.items.length === 0) {
      return toolGranted("未找到与当前查询相关的记忆。", { items: [] })
    }

    const items = result.items.map((raw) => {
      const item = raw as unknown as Record<string, unknown>
      return {
        id: item.id,
        type: item.type,
        title: item.title ?? item.topicSummary ?? "",
        content: item.content ?? item.keyTakeaways ?? "",
        category: item.category ?? item.action ?? "",
        createdAt: item.createdAt,
      }
    })

    return toolGranted(`找到 ${items.length} 条相关记忆。`, { items })
  },
}

// ---------------------------------------------------------------------------
// 3. list_user_memories
// ---------------------------------------------------------------------------

export const listUserMemoriesTool = {
  name: "list_user_memories",
  title: "列出用户记忆",
  description:
    "当用户问'你记住了我什么''列出我的记忆''查看我的偏好'时，列出当前用户的 MemoryFact 摘要。",
  execute: async ({
    userId,
    category,
    limit,
  }: {
    userId: string
    category?: string
    limit?: number
  }) => {
    const result = await listMemoryFacts(userId, {
      category,
      limit: normalizeLimit(limit, 20, 50),
    })

    const items = (result.items as Array<Record<string, unknown>>).map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      summary: typeof item.content === "string" ? item.content.slice(0, 120) : "",
      tags: item.tags,
      importance: item.importance,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }))

    return toolGranted(`共 ${result.total} 条记忆，已返回 ${items.length} 条摘要。`, {
      items,
      total: result.total,
    })
  },
}

// ---------------------------------------------------------------------------
// 4. forget_user_memory
// ---------------------------------------------------------------------------

export const forgetUserMemoryTool = {
  name: "forget_user_memory",
  title: "遗忘用户记忆",
  description:
    "当用户要求'忘掉这条记忆''删除这条记忆''不要再记住……'时，软删除一条 MemoryFact。仅能删除 MemoryFact，不能删除对话摘要和工具操作记录。",
  execute: async ({
    userId,
    memoryId,
    confirmedByUser,
  }: {
    userId: string
    memoryId: string
    confirmedByUser?: boolean
  }) => {
    if (!memoryId?.trim()) return toolForbidden("memoryId 不能为空。", "memory_id_required")

    // Fetch the fact to verify ownership
    const fact = await getMemoryFact(userId, memoryId.trim())
    if (!fact) {
      return toolNotFound("未找到该记忆，或记忆不属于当前用户。", "memory_not_found", { memoryId })
    }

    const factData = fact as Record<string, unknown>
    const factTitle = typeof factData.title === "string" ? factData.title : memoryId

    if (!confirmedByUser) {
      return toolForbidden(
        `即将软删除记忆「${factTitle}」。请确认是否执行此操作。确认后请再次调用本工具并设置 confirmedByUser 为 true。`,
        "forget_needs_confirmation",
        {
          need_confirmation: true,
          memoryId: memoryId.trim(),
          title: factTitle,
          message: `即将删除记忆「${factTitle}」，请确认。确认后再次调用本工具并设置 confirmedByUser 为 true。`,
        },
      )
    }

    const deleted = await softDeleteMemoryFact(userId, memoryId.trim())
    if (!deleted) {
      return toolForbidden("删除失败，记忆可能已被删除或不存在。", "delete_failed")
    }

    return toolGranted(`已遗忘记忆「${factTitle}」。`, {
      deleted: true,
      memoryId: memoryId.trim(),
    })
  },
}
