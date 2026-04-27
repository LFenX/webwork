import "server-only"
import { AI_CAPABILITY_CATEGORIES } from "@/lib/ai/capability-map"
import type { AIToolDefinition } from "@/lib/ai/tools/context"

export const listMyCapabilitiesTool: AIToolDefinition<{ categoryId?: string }> = {
  name: "list_my_capabilities",
  title: "列出全部工具能力",
  description: "列出蝶灵当前可用的所有工具分类和功能，帮助用户了解蝶灵能做什么。",
  scope: "self",
  inputSchemaSummary: "categoryId?: string",
  sensitivity: "low",
  auditLabel: "list_capabilities",
  whenToUse: "当用户问【你能做什么】【你有哪些功能】【你会什么】【你有什么工具】时调用。",
  whenNotToUse: "不要在明确知道工具名称时调用，直接使用对应工具即可。",
  argumentHints: ["categoryId 可选，传入后只返回该分类下的工具"],
  returns: "工具分类列表，含每个分类下的工具名、标题和触发短语。",
  parameterSchema: {
    type: "object",
    properties: {
      categoryId: { type: "string", description: "Optional category id to filter. Omit to list all categories." },
    },
    additionalProperties: false,
  },
  execute: async ({ categoryId }) => {
    const cats = categoryId
      ? AI_CAPABILITY_CATEGORIES.filter((c) => c.id === categoryId)
      : AI_CAPABILITY_CATEGORIES

    const totalTools = cats.reduce((sum, c) => sum + c.tools.length, 0)
    const summaryLines = cats.map(
      (c) => `${c.label}（${c.tools.length} 个）：${c.tools.map((t) => t.title).join("、")}`,
    )

    return {
      ok: true,
      access: "granted",
      summary: `共 ${cats.length} 个能力分类，${totalTools} 个工具。\n${summaryLines.join("\n")}`,
      data: cats.map((c) => ({
        id: c.id,
        label: c.label,
        description: c.description,
        tools: c.tools.map((t) => ({
          name: t.name,
          title: t.title,
          whenToUse: t.whenToUse,
          triggers: t.triggers,
        })),
      })),
    }
  },
}

export const searchMyCapabilitiesTool: AIToolDefinition<{ query: string }> = {
  name: "search_my_capabilities",
  title: "搜索工具能力",
  description: "按关键词搜索蝶灵可用的工具，帮助判断能不能完成某类任务。",
  scope: "self",
  inputSchemaSummary: "query: string",
  sensitivity: "low",
  auditLabel: "search_capabilities",
  whenToUse: "当用户问【你能不能……】【有没有工具可以……】【你支持……吗】时调用。",
  whenNotToUse: "不要替代 list_my_capabilities 的整体列举场景。",
  argumentHints: ["query 必填，支持中英文关键词"],
  returns: "匹配的工具列表，含分类、名称、标题、触发短语。",
  parameterSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Keyword to search for in tool names, titles, descriptions, and trigger phrases." },
    },
    required: ["query"],
    additionalProperties: false,
  },
  execute: async ({ query }) => {
    const q = (query ?? "").toLowerCase()

    const matches: Array<{
      category: string
      name: string
      title: string
      whenToUse: string
      triggers: string[]
    }> = []

    for (const cat of AI_CAPABILITY_CATEGORIES) {
      for (const tool of cat.tools) {
        const haystack = [
          tool.name,
          tool.title,
          tool.whenToUse,
          ...tool.triggers,
          cat.label,
          cat.description,
        ]
          .join(" ")
          .toLowerCase()

        if (haystack.includes(q)) {
          matches.push({
            category: cat.label,
            name: tool.name,
            title: tool.title,
            whenToUse: tool.whenToUse,
            triggers: tool.triggers,
          })
        }
      }
    }

    const summary =
      matches.length > 0
        ? `找到 ${matches.length} 个相关工具：${matches.map((m) => m.title).join("、")}`
        : `没有找到与 ${query} 相关的工具能力。`

    return {
      ok: true,
      access: "granted",
      summary,
      data: matches,
    }
  },
}
