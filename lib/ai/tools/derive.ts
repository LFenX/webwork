import "server-only"
import type { ProviderToolSpec } from "@/lib/ai/provider"
import type { AIToolDescriptor } from "@/lib/ai/types"
import {
  TOOL_CATEGORIES,
  toToolDescriptor,
  toToolJsonSchema,
  type ToolCategory,
  type UnifiedToolDefinition,
} from "@/lib/ai/tools/define"

// ───────────────────────────────────────────────────────────────────────────
// Derivation layer. Everything downstream of a tool definition is produced HERE
// from the unified definition array — provider tool specs, admin descriptors,
// the capability map + system-prompt summary, and heuristic-router seeds. No
// consumer hand-maintains tool metadata anymore.
//
// Additive in Phase 0: these functions are not wired into the live path yet.
// ───────────────────────────────────────────────────────────────────────────

// The only hand-maintained per-category data: display label + description. Tool
// membership, ordering within a category, and trigger phrases are all derived
// from the tools themselves. Order of TOOL_CATEGORIES drives display order.
const CATEGORY_META: Record<ToolCategory, { label: string; description: string }> = {
  "self-profile": { label: "个人资料与设置", description: "读取当前用户的基础信息、权限、设置和主页概况" },
  resume: { label: "简历", description: "读取用户简历概况或全文" },
  posts: { label: "文章/博客/日常/心得/笔记", description: "列出、搜索、读取、创建、修改文章及管理文件夹" },
  jobs: { label: "求职记录", description: "读取求职投递记录和详情" },
  interviews: { label: "面试记录", description: "读取面试记录、复盘和详情" },
  "uploads-pdf": { label: "上传文件与 PDF 解析", description: "查看上传记录，以及读取/搜索本次会话中附带的 PDF 附件内容" },
  knowledge: { label: "知识库 / 错题本", description: "把错题、资料、资讯整理收录成结构化笔记，并快速召回引用" },
  "pdf-generation": { label: "生成 PDF 文档 (LaTeX)", description: "用 LaTeX 把内容编译成精美中文 PDF，支持模板/主题/配色与超长多章草稿" },
  "web-search": { label: "联网搜索", description: "搜索互联网信息、核验时效性内容（不用于站内私有数据）" },
  "soulwing-conversations": { label: "蝶灵对话历史与圆桌", description: "查询用户与蝶灵 SoulWing 的 AI 对话记录、统计、主题、摘要，以及蝶灵圆桌讨论记录" },
  chat: { label: "聊天记录", description: "查看好友聊天和群聊的概况、搜索消息、读取聊天线程（不是 AI 对话）" },
  friends: { label: "好友", description: "查看好友数量、列表、互动明细和好友资料" },
  memory: { label: "长期记忆", description: "保存、搜索、列出、删除用户的长期记忆" },
  persona: { label: "人格配置", description: "更新蝶灵的身份、性格、用户认知或行为规则" },
  "auto-reply": { label: "自动回复", description: "读取和修改自动回复设置" },
  "module-settings": { label: "模块可见性", description: "设置各模块的 private/friends/public 可见性" },
  "visible-user": { label: "好友可见内容", description: "读取其他用户（好友）的可见主页内容" },
  admin: { label: "管理员后台", description: "管理员视角读取用户数据、AI 授权和审计日志" },
  capabilities: { label: "查询工具能力", description: "查询蝶灵自身能做什么，列出或搜索可用工具" },
  diagnostics: { label: "运行诊断", description: "查看上一轮助手运行的真实元数据（技能注入、PDF 生成信息）" },
}

// A tool is hidden from the model (provider tools + capability map) when it is
// deprecated or a soft alias of another tool. It stays resolvable in the tool
// map so historical/stale calls don't error.
function isModelFacing(tool: UnifiedToolDefinition): boolean {
  return !tool.deprecated && !tool.aliasOf
}

// Provider-facing function specs. Mirrors the legacy buildProviderTools output
// exactly: same description concatenation order, parameters from the tool's zod
// schema (byte-compatible with the old hand-written JSON Schemas).
export function deriveProviderToolSpecs(tools: readonly UnifiedToolDefinition[]): ProviderToolSpec[] {
  return tools.filter(isModelFacing).map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: [
        tool.description,
        tool.whenToUse ? `Use when: ${tool.whenToUse}` : "",
        tool.whenNotToUse ? `Avoid when: ${tool.whenNotToUse}` : "",
        tool.argumentHints?.length ? `Arguments: ${tool.argumentHints.join("; ")}` : "",
        tool.returns ? `Returns: ${tool.returns}` : "",
      ]
        .filter(Boolean)
        .join(" "),
      parameters: toToolJsonSchema(tool.input),
    },
  }))
}

// Admin-facing descriptor list (AI_TOOL_DESCRIPTORS replacement). Includes
// deprecated/alias tools too, matching today's behavior (the admin panel shows
// the full registry; deprecated is flagged, not hidden).
export function deriveToolDescriptors(tools: readonly UnifiedToolDefinition[]): AIToolDescriptor[] {
  return tools.map((tool) => toToolDescriptor(tool, toToolJsonSchema(tool.input)))
}

export type CapabilityTool = {
  name: string
  title: string
  whenToUse: string
  triggers: string[]
}

export type CapabilityCategory = {
  id: string
  label: string
  description: string
  tools: CapabilityTool[]
}

// The capability map that feeds list_my_capabilities / search_my_capabilities
// and the system-prompt summary. Fully derived: grouped by each tool's category,
// model-facing tools only, in TOOL_CATEGORIES order. Empty categories are
// dropped so the list never shows a heading with no tools.
export function deriveCapabilityCategories(tools: readonly UnifiedToolDefinition[]): CapabilityCategory[] {
  return TOOL_CATEGORIES.map((id) => {
    const meta = CATEGORY_META[id]
    const catTools = tools
      .filter((tool) => tool.category === id && isModelFacing(tool))
      .map((tool) => ({
        name: tool.name,
        title: tool.title,
        whenToUse: tool.whenToUse,
        triggers: tool.triggers,
      }))
    return { id, label: meta.label, description: meta.description, tools: catTools }
  }).filter((category) => category.tools.length > 0)
}

// The terse capability roster injected into the system prompt. Same shape/header
// as the legacy buildCapabilitySummaryText.
export function deriveCapabilitySummaryText(categories: CapabilityCategory[]): string {
  return [
    "【蝶灵能力清单 — 遇到以下类型问题请优先调用对应工具，不要用'我无法获取'拒绝可以通过工具解决的问题】",
    ...categories.map((cat) => `- ${cat.label}：${cat.tools.map((t) => t.name).join("、")}`),
  ].join("\n")
}

export type TriggerSeed = {
  name: string
  category: ToolCategory
  scope: UnifiedToolDefinition["scope"]
  triggers: string[]
}

// Seeds for the heuristic router (used when a provider lacks native tool-calling).
// Replaces hard-coded tool names in runtime.ts with data derived from each tool's
// declared triggers/category, so the fallback can't drift from the real toolset.
export function deriveTriggerSeeds(tools: readonly UnifiedToolDefinition[]): TriggerSeed[] {
  return tools.filter(isModelFacing).map((tool) => ({
    name: tool.name,
    category: tool.category,
    scope: tool.scope,
    triggers: tool.triggers,
  }))
}
