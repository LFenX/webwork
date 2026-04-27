import "server-only"
import {
  listMemoryFacts,
  softDeleteMemoryFact,
  getMemorySettings,
} from "@/lib/ai/memory/memory-service"
import { toolGranted, toolForbidden } from "@/lib/ai/tools/helpers"

export const deleteMyMemoryFactBatchTool = {
  name: "delete_my_memory_fact_batch",
  title: "批量遗忘记忆",
  description:
    "按标签批量软删除当前用户的 MemoryFact。触发语：'忘掉所有关于 React 的记忆''删掉所有 bugfix 类型的记忆''清除标签为 XX 的所有记忆'。",
  scope: "self" as const,
  inputSchemaSummary: "tag?: string, category?: string, confirmedByUser?: boolean",
  sensitivity: "high" as const,
  auditLabel: "batch_forget_memory",
  whenToUse:
    "当用户要求按标签或分类批量删除记忆时使用。必须用户明确确认后才执行。",
  whenNotToUse:
    "不要在不清楚范围时批量删除。不要删除对话摘要和工具操作记录。不要在没有 confirmedByUser=true 时执行。",
  argumentHints: [
    "tag：按标签过滤要删除的记忆",
    "category：按分类过滤",
    "两者可结合使用（AND 逻辑）",
    "confirmedByUser 必须为 true 才会执行删除",
    "此操作不可逆，请谨慎",
  ],
  returns: "deletedCount, deletedIds",
  parameterSchema: {
    type: "object",
    properties: {
      tag: { type: "string", description: "Tag to filter memories for batch deletion." },
      category: { type: "string", enum: ["preference", "project", "decision", "workflow", "bugfix", "content_operation", "other"], description: "Category to filter for batch deletion." },
      confirmedByUser: { type: "boolean", description: "Must be true to execute. If false or absent, returns a preview only." },
    },
    additionalProperties: false,
  },
  execute: async ({
    userId,
    tag,
    category,
    confirmedByUser,
  }: {
    userId: string
    tag?: string
    category?: string
    confirmedByUser?: boolean
  }) => {
    if (!tag?.trim() && !category?.trim()) {
      return toolForbidden(
        "必须提供 tag 或 category 至少一个过滤条件。批量删除所有记忆不被允许。",
        "filter_required",
      )
    }

    const settings = await getMemorySettings(userId)
    if (!settings.enableMemoryTools) {
      return toolForbidden("记忆工具已关闭。", "memory_tools_disabled")
    }

    // List all facts matching the filter (need to fetch enough to cover all)
    const result = await listMemoryFacts(userId, {
      category: category?.trim() || undefined,
      limit: 500,
    })

    const facts = result.items as Array<Record<string, unknown>>

    // Filter by tag if specified
    const tagFilter = tag?.trim().toLowerCase()
    const matched = tagFilter
      ? facts.filter((f) => {
          const tags = (f.tags as string[] | undefined) ?? []
          return tags.some((t) => t.toLowerCase() === tagFilter)
        })
      : facts

    if (matched.length === 0) {
      const filterDesc = [tag ? `标签="${tag}"` : "", category ? `分类="${category}"` : ""]
        .filter(Boolean)
        .join(" + ")
      return toolGranted(`没有找到匹配 ${filterDesc} 的记忆。`, {
        deletedCount: 0,
        deletedIds: [],
      })
    }

    // Require confirmation before executing
    if (!confirmedByUser) {
      const preview = matched.slice(0, 5).map((f) => `- ${f.title}`).join("\n")
      const more = matched.length > 5 ? `\n... 还有 ${matched.length - 5} 条` : ""
      return toolForbidden(
        `即将批量删除 ${matched.length} 条记忆：\n${preview}${more}\n\n请确认是否执行批量删除。此操作不可逆。确认后请再次调用本工具并设置 confirmedByUser 为 true。`,
        "batch_delete_needs_confirmation",
        {
          need_confirmation: true,
          count: matched.length,
          preview: matched.slice(0, 5).map((f) => ({ id: f.id, title: f.title })),
        },
      )
    }

    // Execute batch soft-delete
    const deletedIds: string[] = []
    for (const fact of matched) {
      const id = fact.id as string
      const success = await softDeleteMemoryFact(userId, id)
      if (success) deletedIds.push(id)
    }

    return toolGranted(
      `已批量遗忘 ${deletedIds.length} 条记忆。`,
      {
        deletedCount: deletedIds.length,
        deletedIds,
      },
    )
  },
}
