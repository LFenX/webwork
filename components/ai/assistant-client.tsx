"use client"

import { type MutableRefObject, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { MotionPathPlugin } from "gsap/MotionPathPlugin"
import {
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Copy,
  ImageIcon,
  Loader2,
  MessageSquarePlus,
  MoreHorizontal,
  PencilLine,
  Plus,
  Settings2,
  Shield,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  Trash2,
  Workflow,
  Wrench,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { AISettingsSheet } from "@/components/ai/ai-settings-sheet"
import { MarkdownContent } from "@/components/markdown-content"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { UserAvatar } from "@/components/user-avatar"
import { confirmAction, copyTextWithToast } from "@/lib/interaction-feedback"
import {
  AI_MODEL_PRESETS_UPDATED_EVENT,
  loadModelCatalog,
  saveModelCatalog,
} from "@/lib/ai/model-presets"
import { DEFAULT_AI_SUGGESTIONS, normalizeAISuggestions, withDefaultAISuggestions } from "@/lib/ai/suggestions"
import { getDict, type Dictionary } from "@/lib/i18n"
import { handleEnterToSubmit } from "@/lib/keyboard"
import { cn } from "@/lib/utils"

gsap.registerPlugin(useGSAP, MotionPathPlugin)

type AIProviderCapabilities = {
  streamText: boolean
  toolCalling: boolean
  visionInput: boolean
  reasoningStream: boolean
}

function submitOnTouchBeforeKeyboardBlur(event: ReactPointerEvent<HTMLButtonElement>, submit: () => void) {
  if (event.pointerType === "mouse") return
  event.preventDefault()
  submit()
}

type ConversationItem = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  lastMessageAt: string
  messageCount: number
}

type AIViewerSummary = {
  name?: string | null
  email?: string | null
  avatarText?: string | null
  avatarUrl?: string | null
}

type AIAssistantClientProps = {
  viewer?: AIViewerSummary
  canManageAI?: boolean
  agentProfile?: {
    chineseName?: string | null
    englishName?: string | null
    avatarUrl?: string | null
  }
}

type AttachmentItem = {
  id: string
  uploadId: string | null
  url: string
  originalName: string
  mimeType: string
  size: number
}

type ComposerAttachment = AttachmentItem & {
  status: "uploading" | "ready" | "failed"
  errorMessage?: string
}

type StepPreview = {
  id: string
  type: string
  title: string
  status: "running" | "completed" | "failed"
  startedAt: string
  finishedAt: string | null
  summary: string
  errorMessage: string
  inputPreview?: unknown
  outputPreview?: unknown
  providerMetadata?: Record<string, unknown> | null
}

type RunDetail = {
  id: string
  messageId: string
  conversationId: string
  userId: string
  prompt: string
  mode: "self" | "admin-delegated" | "visible-user"
  delegatedTargetUserId: string | null
  plannerModel: string
  finalModel: string
  status: string
  summary: string
  createdAt: string
  updatedAt: string
  finishedAt: string | null
  steps: StepPreview[]
}

type MessageItem = {
  id: string
  role: "user" | "assistant"
  contentMarkdown: string
  status: string
  reasoningSummary: string
  toolTraceSummary: string
  modelName: string
  providerSource: "user" | "grant" | "none"
  createdAt: string
  runId: string | null
  runMode: "self" | "admin-delegated" | "visible-user" | null
  runStatus: string | null
  delegatedTargetUserId: string | null
  stepsPreview: StepPreview[]
  attachments: AttachmentItem[]
}

type UserConfigSummary = {
  id: string
  source?: string
  name: string
  isActive: boolean
  providerLabel: string
  baseUrl: string
  model: string
  modelList?: string[]
  temperature: number
  streamEnabled: boolean
  isEnabled: boolean
  apiKeyMask: string
  status?: string
  lastTestStatus: string
  lastTestedAt: string | null
  grantedByAdminId?: string
}

type AIStatusResponse = {
  storageReady: boolean
  status: {
    canUseAI: boolean
    source: "user" | "grant" | "none"
    reason: string
    config: {
      providerLabel: string
      baseUrl: string
      model: string
      temperature: number
      streamEnabled: boolean
      capabilities?: AIProviderCapabilities | null
    } | null
    configState: {
      storageReady: boolean
      hasUserConfig: boolean
      userConfigEnabled: boolean
      hasGrant: boolean
      grantStatus: string | null
      accessRequestStatus: string | null
    }
  }
  accessRequest: {
    id: string
    status: string
    message: string
    reviewNote: string
    createdAt: string
    reviewedAt: string | null
  } | null
  userConfig: (UserConfigSummary & { capabilities?: AIProviderCapabilities | null }) | null
  userConfigs?: UserConfigSummary[]
  grant?: {
    id: string
    status: string
    providerLabel: string
    model: string
    modelList: string[]
    apiKeyMask: string
  } | null
}

const SUGGESTION_REFRESH_LOADS = 10
const SUGGESTION_STORAGE_VERSION = "v1"

type StoredSuggestions = {
  items: string[]
  loadsSinceRefresh: number
  generatedAt: string
}

function suggestionStorageKey(configKey: string) {
  return `soulwing:suggestions:${SUGGESTION_STORAGE_VERSION}:${configKey}`
}

function readStoredSuggestions(key: string): StoredSuggestions | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredSuggestions>
    const items = normalizeAISuggestions(parsed.items ?? [], 20)
    if (items.length < 15) return null
    return {
      items,
      loadsSinceRefresh: Number.isFinite(parsed.loadsSinceRefresh) ? Math.max(0, Number(parsed.loadsSinceRefresh)) : 0,
      generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : "",
    }
  } catch {
    return null
  }
}

function writeStoredSuggestions(key: string, value: StoredSuggestions) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Local storage can be unavailable in private contexts; suggestions still render from state.
  }
}

function reasonLabel(dict: Dictionary, reason: string) {
  switch (reason) {
    case "ready":
      return dict.ai.reasonReady
    case "server-secret-missing":
      return dict.ai.reasonServerSecretMissing
    case "request-pending":
      return dict.ai.accessPending
    case "request-rejected":
      return dict.ai.accessDenied
    case "grant-paused":
      return dict.ai.grantPaused
    case "grant-revoked":
      return dict.ai.grantRevoked
    case "configure-personal-api":
      return dict.ai.reasonConfigurePersonalApi
    case "request-access":
      return dict.ai.reasonRequestAccess
    default:
      return dict.ai.reasonUnavailable
  }
}

function sourceLabel(dict: Dictionary, source: "user" | "grant" | "none") {
  if (source === "user") return dict.ai.sourceCustom
  if (source === "grant") return dict.ai.sourceGrant
  return dict.ai.sourceNone
}

function modeLabel(dict: Dictionary, mode: MessageItem["runMode"]) {
  if (mode === "admin-delegated") return dict.ai.modeAdminDelegated
  if (mode === "visible-user") return dict.ai.modeVisibleUser
  return dict.ai.modeSelf
}

function formatConversationTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatConversationSidebarTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const now = new Date()
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()

  return sameDay
    ? date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })
}

function groupConversationsByRecency(dict: Dictionary, conversations: ConversationItem[]) {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const recentWindowStart = startOfToday - 6 * 24 * 60 * 60 * 1000
  const groups = [
    { key: "today", label: dict.ai.conversationToday, items: [] as ConversationItem[] },
    { key: "recent", label: dict.ai.conversationRecent7Days, items: [] as ConversationItem[] },
    { key: "earlier", label: dict.ai.conversationEarlier, items: [] as ConversationItem[] },
  ]

  conversations.forEach((conversation) => {
    const timestamp = new Date(conversation.lastMessageAt).getTime()
    if (Number.isNaN(timestamp) || timestamp < recentWindowStart) {
      groups[2].items.push(conversation)
    } else if (timestamp >= startOfToday) {
      groups[0].items.push(conversation)
    } else {
      groups[1].items.push(conversation)
    }
  })

  return groups.filter((group) => group.items.length > 0)
}

function formatMessageTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function compactJson(value: unknown) {
  if (value == null) return ""
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function statusChip(status: string) {
  if (status === "failed") return "border-red-200 bg-red-50 text-red-700"
  if (status === "running" || status === "streaming") return "border-blue-200 bg-blue-50 text-blue-700"
  return "border-emerald-200 bg-emerald-50 text-emerald-700"
}

function traceStatusLabel(dict: Dictionary, status: string) {
  if (status === "failed") return dict.ai.traceStatusFailed
  if (status === "running" || status === "streaming") return dict.ai.traceStatusRunning
  return dict.ai.traceStatusCompleted
}

function traceCopy(dict: Dictionary) {
  return {
    executionTitle: dict.ai.traceExecutionTitle,
    executionHint: dict.ai.traceExecutionHint,
    keySignal: dict.ai.traceKeySignal,
    nextStep: dict.ai.traceNextStep,
    input: dict.ai.traceInput,
    result: dict.ai.traceResult,
    payload: dict.ai.tracePayload,
    running: dict.ai.traceRunning,
    toolRunning: dict.ai.traceToolRunning,
    noExplicitThinking: dict.ai.traceNoExplicitThinking,
  }
}

function capabilityTone(supported: boolean) {
  return supported
    ? "border-emerald-100 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-50 text-slate-400"
}

function toReadableLines(value: string) {
  return value
    .replace(/\\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function formatValueInline(dict: Dictionary, value: unknown): string {
  if (value == null) return dict.ai.notProvided
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return value.map((item) => formatValueInline(dict, item)).join("、")
  return compactJson(value)
}

function isStructuredToolResult(value: unknown): value is {
  ok: boolean
  access: string
  summary: string
  data: unknown
  reason?: string
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  return "ok" in value && "access" in value && "summary" in value && "data" in value
}

function buildToolNarrative(dict: Dictionary, step: StepPreview) {
  if (step.type !== "tool_call") return []

  const sections: Array<{ title: string; body: string }> = []
  const input = step.inputPreview && typeof step.inputPreview === "object" ? (step.inputPreview as Record<string, unknown>) : null
  const output = step.outputPreview && typeof step.outputPreview === "object" ? (step.outputPreview as Record<string, unknown>) : null
  const toolName = typeof input?.toolName === "string" ? input.toolName : step.title

  sections.push({
    title: dict.ai.stepWhatDoing,
    body: `${dict.ai.stepSystemCalled} ${toolName}，${dict.ai.stepPurposeIs} ${step.summary || dict.ai.stepSupplementalData}`,
  })

  const args = input?.arguments
  if (args && typeof args === "object" && !Array.isArray(args) && Object.keys(args).length > 0) {
    sections.push({
      title: dict.ai.stepInputInfo,
      body: Object.entries(args)
        .map(([key, value]) => `${key}：${formatValueInline(dict, value)}`)
        .join("；"),
    })
  }

  if (output?.result !== undefined) {
    if (isStructuredToolResult(output.result)) {
      sections.push({
        title: dict.ai.stepWhatGot,
        body: output.result.summary,
      })

      if (output.result.reason) {
        sections.push({
          title: dict.ai.stepWhyResult,
          body: output.result.reason,
        })
      }

      if (output.result.data && typeof output.result.data === "object") {
        sections.push({
          title: dict.ai.stepDataSummary,
          body: compactJson(output.result.data),
        })
      }

      return sections
    }

    sections.push({
      title: dict.ai.stepWhatReturned,
      body: typeof output.result === "string" ? output.result : compactJson(output.result),
    })
  } else if (step.errorMessage) {
    sections.push({
      title: dict.ai.stepWhyFailed,
      body: step.errorMessage,
    })
  }

  return sections
}

const TRACE_LABELS = [
  "用户想要",
  "我需要",
  "当前内容",
  "格式设计思路",
  "下一步",
  "返回摘要",
  "这一步在做什么",
  "本次传入的信息",
  "关键判断",
  "User wants",
  "I need",
  "Current content",
  "Next step",
  "Returned summary",
]

const TRACE_KEY_PHRASES = [
  "关键判断",
  "下一步",
  "用户想要",
  "我需要",
  "当前内容",
  "格式设计思路",
  "返回摘要",
  "Markdown",
  "ID",
  "slug",
  "module",
  "content",
  "tool",
]

function replaceAllLiteral(value: string, search: string, replacement: string) {
  return value.split(search).join(replacement)
}

function highlightTraceInline(value: string) {
  return TRACE_KEY_PHRASES.reduce((line, phrase) => {
    if (!line.includes(phrase) || line.includes(`**${phrase}**`)) return line
    return replaceAllLiteral(line, phrase, `**${phrase}**`)
  }, value)
}

function looksLikeMarkdown(value: string) {
  return /(^|\n)\s*(#{1,6}\s|[-*]\s+|\d+\.\s+|>\s+|```|\|.+\|)/.test(value) || /(\*\*.+\*\*|`[^`]+`)/.test(value)
}

function enhanceTraceMarkdown(source: string) {
  const normalized = source.replace(/\\n/g, "\n").trim()
  if (!normalized) return ""
  if (looksLikeMarkdown(normalized)) return normalized

  const lines = toReadableLines(normalized)
  return lines.map((line) => {
    const labelMatch = line.match(/^([^:：]{2,28})[:：]\s*(.+)$/)
    if (labelMatch && TRACE_LABELS.some((label) => labelMatch[1].includes(label))) {
      return `> **${labelMatch[1]}**\n>\n> ${highlightTraceInline(labelMatch[2])}`
    }
    if (/^(首先|然后|接着|其次|最后|因此|所以|我会|需要|当前|本次|用户|First|Then|Next|Finally)\b/.test(line)) {
      return `- ${highlightTraceInline(line)}`
    }
    return highlightTraceInline(line)
  }).join("\n\n")
}

function reasoningMarkdown(step: StepPreview) {
  const output = step.outputPreview
  if (output && typeof output === "object" && "reasoning" in output) {
    return enhanceTraceMarkdown(String((output as { reasoning?: unknown }).reasoning ?? ""))
  }
  return enhanceTraceMarkdown(step.summary)
}

function isJsonLike(value: string) {
  const trimmed = value.trim()
  return (trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))
}

function shouldRenderAsPayload(value: string) {
  return value.length > 520 || isJsonLike(value)
}

function compactOneLine(value: string, maxLength = 96) {
  const normalized = value
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#>*_`~\[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).trim()}…`
}

function compactMarkdownLine(value: string, maxLength = 150) {
  const normalized = value
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^\s{0,3}(#{1,6}|[-*]|\d+\.|>)\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()
  const highlighted = highlightTraceInline(normalized)
  if (highlighted.length <= maxLength) return highlighted
  return `${highlighted.slice(0, maxLength - 1).trim()}…`
}

function collapsedJudgementPreview(value: string) {
  const preview = compactMarkdownLine(value, 148)
    .replace(/(\*\*)?[\s:：,，;；、。.!！?？….-]+$/u, "$1")
    .trim()
  if (!preview) return "......"
  if (preview.endsWith("......")) return preview
  return `${preview}......`
}

function ThinkingGlyph({
  status,
  kind = "thinking",
  size = "md",
}: {
  status: string
  kind?: "thinking" | "tool" | "warning"
  size?: "xs" | "sm" | "md"
}) {
  const isRunning = status === "running" || status === "streaming"

  return (
    <span
      className={cn(
        "soulwing-butterfly-glyph",
        `soulwing-butterfly-glyph-${size}`,
        `soulwing-butterfly-glyph-${kind}`,
        isRunning && "is-thinking",
        status === "failed" && "is-failed",
        status === "completed" && "is-completed",
      )}
      aria-hidden="true"
    >
      <span className="soulwing-butterfly-aura" />
      <Image
        src="/soulwing-butterfly.png"
        alt=""
        width={96}
        height={96}
        sizes="48px"
        className="soulwing-butterfly-img"
        draggable={false}
      />
      {isRunning ? <span className="soulwing-butterfly-sparkle" /> : null}
    </span>
  )
}

function TraceMarkdown({ source }: { source: string }) {
  const markdown = enhanceTraceMarkdown(source)
  if (!markdown) return null
  return (
    <div className="trace-markdown">
      <MarkdownContent source={markdown} />
    </div>
  )
}

function TraceInlineMarkdown({ source }: { source: string }) {
  const markdown = compactMarkdownLine(source)
  if (!markdown) return null
  return (
    <span className="trace-inline-markdown">
      <MarkdownContent source={markdown} />
    </span>
  )
}

function TracePayloadBlock({ title, body }: { title: string; body: string }) {
  if (!body.trim()) return null
  if (!shouldRenderAsPayload(body)) return <TraceMarkdown source={body} />

  return (
    <details className="trace-payload group" open={body.length < 1200}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md px-3 py-2 text-xs font-semibold text-slate-700 marker:hidden">
        <span>{title}</span>
        <ChevronDown size={14} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <pre className="mt-2 max-h-[360px] overflow-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-slate-950 px-3 py-3 text-[11px] leading-5 text-slate-100">
        {body}
      </pre>
    </details>
  )
}

function stepsDurationSeconds(steps: StepPreview[]) {
  if (steps.length === 0) return 0
  const first = new Date(steps[0].startedAt).getTime()
  const lastStep = steps[steps.length - 1]
  const last = lastStep.finishedAt ? new Date(lastStep.finishedAt).getTime() : Date.now()
  if (!Number.isFinite(first) || !Number.isFinite(last) || last <= first) return Math.max(steps.length * 2, 1)
  return Math.max(1, Math.round((last - first) / 1000))
}

function reasoningLines(step: StepPreview) {
  return toReadableLines(reasoningMarkdown(step)).filter(Boolean)
}

function reasoningPrimaryMarkdown(step: StepPreview) {
  const lines = reasoningLines(step)
  return lines[0] || step.summary || step.title
}

function reasoningSecondaryMarkdown(step: StepPreview) {
  const lines = reasoningLines(step)
  return lines.find((line) => line !== lines[0] && line.length > 6) || step.summary || step.title
}

function reasoningPrimaryText(step: StepPreview) {
  const lines = reasoningLines(step)
  return compactOneLine(lines[0] || step.summary || step.title, 112)
}

function toolNameFromStep(step: StepPreview) {
  const input = step.inputPreview && typeof step.inputPreview === "object" ? (step.inputPreview as Record<string, unknown>) : null
  return typeof input?.toolName === "string" ? input.toolName : step.title
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  if (!isJsonLike(trimmed)) return value
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function toolResultValue(step: StepPreview) {
  const output = asRecord(step.outputPreview)
  return parseMaybeJson(output?.result)
}

function toolDataValue(step: StepPreview) {
  const result = toolResultValue(step)
  if (isStructuredToolResult(result)) return parseMaybeJson(result.data)
  return result
}

function numberFrom(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
  }
  return null
}

function arrayCount(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) return value.length
  }
  return null
}

function meaningfulToolAction(step: StepPreview) {
  const title = toolNameFromStep(step)
  const haystack = `${title} ${step.summary}`.toLowerCase()
  if (/求职|job/.test(haystack)) return "汇总求职记录、投递反馈和近期岗位动向，判断最近三天是否有新进展。"
  if (/面试|interview/.test(haystack)) return "查看面试轮次、通过情况和待处理状态，补齐求职进展判断。"
  if (/内容|文章|笔记|post|article|content/.test(haystack)) return "读取最近内容素材，确认哪些记录能支撑回答。"
  if (/活动|日志|activity|log/.test(haystack)) return "核对最近活动和使用轨迹，确认时间范围内的关键动态。"
  if (/聊天|消息|chat|message/.test(haystack)) return "归纳近期沟通、未读和互动情况，提炼可回答的社交动态。"
  if (/列出|list/.test(haystack)) return "拉取候选记录，确定后续可以引用和分析的范围。"
  if (/读取|read/.test(haystack)) return "读取目标内容，补齐上下文和事实依据。"
  if (/修改|更新|write|update/.test(haystack)) return "写入更新并确认结果，确保回答前数据已同步。"
  return step.summary && step.summary !== "工具执行完成。" ? step.summary : `读取「${title}」信息，补齐回答依据。`
}

function meaningfulToolOutcome(dict: Dictionary, step: StepPreview) {
  if (step.errorMessage) return step.errorMessage
  if (step.status === "running") return dict.ai.traceQueued

  const result = toolResultValue(step)
  if (isStructuredToolResult(result) && result.summary) return result.summary
  if (typeof result === "string" && !isJsonLike(result)) return compactOneLine(result, 138)

  const data = toolDataValue(step)
  if (Array.isArray(data)) return data.length > 0 ? `找到 ${data.length} 条可用信息。` : "没有找到新的可用信息。"

  const record = asRecord(data)
  if (!record) return compactOneLine(step.summary || dict.ai.traceCompletedSummary, 138)

  const title = toolNameFromStep(step)
  const total = numberFrom(record, ["total", "count", "directCount", "channelCount"])
  const replied = numberFrom(record, ["replied"])
  const offers = numberFrom(record, ["offers"])
  const replyRate = numberFrom(record, ["replyRate"])
  const offerRate = numberFrom(record, ["offerRate"])
  const passed = numberFrom(record, ["passed"])
  const failed = numberFrom(record, ["failed"])
  const pending = numberFrom(record, ["pending"])
  const passRate = numberFrom(record, ["passRate"])
  const unread = numberFrom(record, ["unreadCount"])
  const recentJobs = arrayCount(record, ["recentJobs", "jobs"])
  const recentPosts = arrayCount(record, ["recentPosts", "posts", "items"])
  const recentMessages = arrayCount(record, ["recentDirectMessages", "recentMessages", "messages"])
  const parts: string[] = []

  if (/求职|job/i.test(title)) {
    if (total != null) parts.push(`求职记录 ${total} 条`)
    if (recentJobs != null) parts.push(`近期岗位 ${recentJobs} 条`)
    if (replied != null) parts.push(`回复 ${replied} 条`)
    if (replyRate != null) parts.push(`回复率 ${replyRate}%`)
    if (offers != null) parts.push(`offer ${offers} 个`)
    if (offerRate != null) parts.push(`offer 率 ${offerRate}%`)
  } else if (/面试|interview/i.test(title)) {
    if (total != null) parts.push(`面试 ${total} 场`)
    if (passed != null) parts.push(`通过 ${passed} 场`)
    if (failed != null) parts.push(`未通过 ${failed} 场`)
    if (pending != null) parts.push(`待处理 ${pending} 场`)
    if (passRate != null) parts.push(`通过率 ${passRate}%`)
  } else if (/内容|文章|笔记|post|article|content/i.test(title)) {
    if (recentPosts != null) parts.push(`可引用内容 ${recentPosts} 条`)
    if (total != null) parts.push(`总计 ${total} 项`)
  } else if (/活动|日志|activity|log/i.test(title)) {
    if (total != null) parts.push(`活动记录 ${total} 条`)
    if (recentPosts != null) parts.push(`可检索条目 ${recentPosts} 条`)
  } else if (/聊天|消息|chat|message/i.test(title)) {
    if (total != null) parts.push(`沟通记录 ${total} 条`)
    if (unread != null) parts.push(`未读 ${unread} 条`)
    if (recentMessages != null) parts.push(`近期消息 ${recentMessages} 条`)
  } else {
    if (total != null) parts.push(`覆盖 ${total} 项数据`)
    if (recentPosts != null) parts.push(`返回 ${recentPosts} 条可用信息`)
  }

  if (parts.length > 0) return `${parts.join("，")}。`
  return compactOneLine(compactJson(record), 138)
}

const TRACE_ROUND_TONES = ["cyan", "emerald", "amber", "violet", "blue", "rose", "teal"] as const

function traceRoundTone(index: number, status: StepPreview["status"]) {
  if (status === "failed") return "danger"
  return TRACE_ROUND_TONES[index % TRACE_ROUND_TONES.length]
}

function TraceDetails({ dict, step }: { dict: Dictionary; step: StepPreview }) {
  if (step.type === "reasoning") {
    const markdown = reasoningMarkdown(step)
    return markdown ? <TraceMarkdown source={markdown} /> : null
  }

  const sections = buildToolNarrative(dict, step)
  if (sections.length === 0) return null

  return (
    <div className="soulwing-trace-detail-grid">
      {sections.map((section, index) => (
        <div key={`${step.id}-detail-${index}`} className="soulwing-trace-detail-cell">
          <p>{section.title}</p>
          <TracePayloadBlock title={section.title} body={section.body} />
        </div>
      ))}
    </div>
  )
}

function TraceSectionHeader({
  icon,
  title,
  status,
  metrics,
}: {
  icon: ReactNode
  title: string
  status: string
  metrics: string[]
}) {
  return (
    <summary className="soulwing-execution-section-header">
      <div className="flex min-w-0 items-center gap-3">
        <span className="soulwing-execution-section-icon">{icon}</span>
        <span className="truncate text-base font-semibold text-slate-950">{title}</span>
        <span className="soulwing-execution-live-badge">{status}</span>
      </div>
      <div className="soulwing-execution-metrics">
        {metrics.map((item) => (
          <span key={item}>{item}</span>
        ))}
        <ChevronDown size={16} className="soulwing-execution-chevron" />
      </div>
    </summary>
  )
}

function ThoughtTimeline({ steps, isStreaming, dict }: { steps: StepPreview[]; isStreaming: boolean; dict: Dictionary }) {
  if (steps.length === 0 && isStreaming) {
    return (
      <div className="soulwing-thinking-empty">
        <ThinkingGlyph status="running" size="md" />
        <div>
          <p>{dict.ai.traceRunning}</p>
          <span>{dict.ai.traceNoExplicitThinking}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="soulwing-thought-timeline">
      {steps.map((step, index) => {
        const isRunning = step.status === "running"
        const isFailed = step.status === "failed"
        const tone = traceRoundTone(index, step.status)
        const primaryMarkdown = reasoningPrimaryMarkdown(step)
        const secondaryMarkdown = reasoningSecondaryMarkdown(step)
        return (
          <details
            key={step.id}
            className={cn("soulwing-thought-row group", `soulwing-trace-tone-${tone}`, isRunning && "is-running", isFailed && "is-failed")}
          >
            <summary className="soulwing-thought-summary">
              <span className="soulwing-thought-rail">
                <span className="soulwing-thought-dot" />
              </span>
              <div className="soulwing-thought-main">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="soulwing-thought-tag">
                    {isRunning ? dict.ai.tracePendingConfirm(index + 1) : dict.ai.traceKeyJudgement(index + 1)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-950">
                    {step.title || reasoningPrimaryText(step)}
                  </span>
                </div>
                <div className="soulwing-thought-rich">
                  <TraceInlineMarkdown source={secondaryMarkdown} />
                </div>
              </div>
              <div className="soulwing-thought-evidence">
                <span>{dict.ai.traceEvidence}：</span>
                <TraceInlineMarkdown source={primaryMarkdown} />
              </div>
              <div className="soulwing-thought-state">
                {isRunning ? (
                  <span className="soulwing-thinking-state">
                    <ThinkingGlyph status="running" size="xs" />
                    {dict.ai.traceRunning}
                  </span>
                ) : (
                  <span className={cn("soulwing-done-state", isFailed && "soulwing-failed-state")}>
                    <CheckCircle2 size={14} />
                    {traceStatusLabel(dict, step.status)}
                  </span>
                )}
                <time>{formatMessageTime(step.finishedAt || step.startedAt)}</time>
              </div>
              <ChevronDown size={15} className="soulwing-row-chevron" />
            </summary>
            <div className="soulwing-thought-detail">
              <TraceDetails dict={dict} step={step} />
            </div>
          </details>
        )
      })}
    </div>
  )
}

function ToolActionRow({ step, index, dict }: { step: StepPreview; index: number; dict: Dictionary }) {
  const isRunning = step.status === "running"
  const isFailed = step.status === "failed"
  const progress = isFailed ? 100 : isRunning ? 68 : 100
  const action = meaningfulToolAction(step)
  const result = meaningfulToolOutcome(dict, step)
  const tone = traceRoundTone(index, step.status)

  return (
    <details className={cn("soulwing-tool-row group", `soulwing-trace-tone-${tone}`, isRunning && "is-running", isFailed && "is-failed")}>
      <summary className="soulwing-tool-summary">
        <div className="soulwing-tool-index">
          <span className="soulwing-tool-status-dot">
            {isRunning ? <span /> : isFailed ? <TriangleAlert size={13} /> : <CheckCircle2 size={13} />}
          </span>
          <strong>{index + 1}</strong>
        </div>
        <div className="soulwing-tool-name">
          <span className="soulwing-tool-icon">
            {step.title.includes("修改") || step.title.toLowerCase().includes("update") ? <PencilLine size={16} /> : <Wrench size={16} />}
          </span>
          <div>
            <p>
              {step.title || toolNameFromStep(step)}
              <span>{traceStatusLabel(dict, step.status)}</span>
            </p>
            <small>{compactOneLine(result, 84)}</small>
          </div>
        </div>
        <div className="soulwing-tool-data">
          <span>{dict.ai.stepWhatDoing}</span>
          <p>{compactOneLine(action, 118)}</p>
        </div>
        <div className="soulwing-tool-data">
          <span>{isRunning ? dict.ai.traceToolProgress : dict.ai.stepWhatGot}</span>
          {isRunning ? (
            <div className="soulwing-tool-progress">
              <i style={{ width: `${progress}%` }} />
              <em>{progress}%</em>
            </div>
          ) : (
            <p>{compactOneLine(result, 128)}</p>
          )}
        </div>
        <time>{formatMessageTime(step.finishedAt || step.startedAt)}</time>
        <ChevronDown size={16} className="soulwing-row-chevron" />
      </summary>
      <div className="soulwing-tool-detail">
        <TraceDetails dict={dict} step={step} />
      </div>
    </details>
  )
}

function ThoughtSection({
  steps,
  isStreaming,
  dict,
}: {
  steps: StepPreview[]
  isStreaming: boolean
  dict: Dictionary
}) {
  if (steps.length === 0 && !isStreaming) return null
  const running = isStreaming || steps.some((step) => step.status === "running")
  const pending = steps.filter((step) => step.status !== "completed").length
  const duration = stepsDurationSeconds(steps)

  return (
    <details open className="soulwing-execution-section soulwing-thought-section">
      <TraceSectionHeader
        icon={<BrainCircuit size={20} />}
        title={dict.ai.thinkingProcess}
        status={traceStatusLabel(dict, running ? "running" : "completed")}
        metrics={[
          dict.ai.traceKeyJudgement(Math.max(steps.length - pending, 0)),
          dict.ai.tracePendingConfirm(pending),
          dict.ai.traceApproxDuration(duration),
        ]}
      />
      <ThoughtTimeline steps={steps} isStreaming={isStreaming} dict={dict} />
    </details>
  )
}

function ToolSection({ steps, dict }: { steps: StepPreview[]; dict: Dictionary }) {
  if (steps.length === 0) return null
  const running = steps.some((step) => step.status === "running")
  const completed = steps.filter((step) => step.status === "completed").length

  return (
    <details open className="soulwing-execution-section soulwing-tool-section">
      <TraceSectionHeader
        icon={<Wrench size={20} />}
        title={dict.ai.toolCallProcess}
        status={running ? dict.ai.traceToolRunning : dict.ai.traceStatusCompleted}
        metrics={[
          dict.ai.toolCallsTimes(steps.length),
          `${completed}/${steps.length} ${dict.ai.traceStatusCompleted}`,
          dict.ai.traceApproxDuration(stepsDurationSeconds(steps)),
        ]}
      />
      <div className="soulwing-tool-table">
        {steps.map((step, index) => (
          <ToolActionRow key={step.id} step={step} index={index} dict={dict} />
        ))}
      </div>
    </details>
  )
}

function TraceJudgementChain({
  reasoningSteps,
  toolSteps,
  dict,
}: {
  reasoningSteps: StepPreview[]
  toolSteps: StepPreview[]
  dict: Dictionary
}) {
  const copy = traceCopy(dict)
  const judgementSteps = reasoningSteps.length > 0 ? reasoningSteps : toolSteps
  if (judgementSteps.length === 0) return null

  const latestStep = judgementSteps[judgementSteps.length - 1]
  const latestMarkdown = latestStep.type === "reasoning"
    ? reasoningPrimaryMarkdown(latestStep)
    : meaningfulToolOutcome(dict, latestStep)

  return (
    <details className="soulwing-judgement-chain">
      <summary className="soulwing-judgement-summary">
        <span className="soulwing-judgement-chip">{copy.keySignal}</span>
        <span className="soulwing-judgement-current">
          <TraceInlineMarkdown source={collapsedJudgementPreview(latestMarkdown || copy.nextStep)} />
        </span>
        <span className="soulwing-judgement-toggle">
          <ChevronDown size={15} />
        </span>
      </summary>
      <div className="soulwing-judgement-list">
        {judgementSteps.map((step, index) => {
          const tone = traceRoundTone(index, step.status)
          const markdown = step.type === "reasoning"
            ? reasoningMarkdown(step)
            : meaningfulToolOutcome(dict, step)
          return (
            <article key={step.id} className={cn("soulwing-judgement-item", `soulwing-trace-tone-${tone}`)}>
              <span className="soulwing-judgement-index">{index + 1}</span>
              <div className="soulwing-judgement-body">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="soulwing-thought-tag">{dict.ai.traceKeyJudgement(index + 1)}</span>
                  <strong>{step.title || reasoningPrimaryText(step)}</strong>
                </div>
                <TraceMarkdown source={markdown || step.summary || step.title} />
              </div>
            </article>
          )
        })}
      </div>
    </details>
  )
}

function TraceExecutionPanel({
  reasoningSteps,
  toolSteps,
  isStreaming,
  dict,
}: {
  reasoningSteps: StepPreview[]
  toolSteps: StepPreview[]
  isStreaming: boolean
  dict: Dictionary
}) {
  const copy = traceCopy(dict)
  const totalSteps = reasoningSteps.length + toolSteps.length
  const isRunning = isStreaming || [...reasoningSteps, ...toolSteps].some((step) => step.status === "running")

  return (
    <details className="soulwing-trace-panel group" open={isRunning}>
      <summary className="soulwing-trace-panel-header">
        <div className="flex min-w-0 items-center gap-3">
          <span className="soulwing-trace-brand-mark">
            <Workflow size={22} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-950">{copy.executionTitle}</p>
              <span className="soulwing-execution-live-badge">
                {traceStatusLabel(dict, isRunning ? "running" : "completed")}
              </span>
            </div>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">{copy.executionHint}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
            {dict.ai.thinkingStages(reasoningSteps.length)}
          </span>
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
            {dict.ai.toolCallsTimes(toolSteps.length)}
          </span>
          <ChevronDown size={16} className="soulwing-execution-chevron" />
        </div>
      </summary>

      <div className="soulwing-execution-stack">
        <ThoughtSection steps={reasoningSteps} isStreaming={isStreaming} dict={dict} />
        <ToolSection steps={toolSteps} dict={dict} />
      </div>

      {totalSteps > 0 ? (
        <div className="soulwing-trace-footer">
          <TraceJudgementChain reasoningSteps={reasoningSteps} toolSteps={toolSteps} dict={dict} />
        </div>
      ) : null}
    </details>
  )
}

/** Close unclosed fenced code blocks so react-markdown doesn't break during streaming. */
function normalizeStreamingMarkdown(source: string): string {
  const ticks = (source.match(/```/g) ?? []).length
  return ticks % 2 !== 0 ? source + "\n```" : source
}

function AssistantMessageCard({ message, run, dict }: { message: MessageItem; run?: RunDetail; dict: Dictionary }) {
  const steps = run?.steps?.length ? run.steps : message.stepsPreview
  const warnings = steps.filter((step) => step.type === "warning")
  const reasoningSteps = steps.filter((step) => step.type === "reasoning")
  const toolSteps = steps.filter((step) => step.type === "tool_call")
  const isStreaming = message.status === "streaming"
  const modelName = run?.finalModel || message.modelName
  const hasContent = Boolean(message.contentMarkdown?.trim())
  const displayMarkdown = isStreaming
    ? normalizeStreamingMarkdown(message.contentMarkdown ?? "")
    : (message.contentMarkdown ?? "")

  return (
    <article className="mr-auto w-full max-w-[1180px] rounded-[18px] border border-slate-100 bg-white px-5 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.045)]">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-xs text-[--color-text-muted]">{formatMessageTime(message.createdAt)}</span>
        {modelName ? (
          <span className="rounded-full bg-[--color-brand-soft] px-2.5 py-1 text-[11px] font-medium text-[--color-brand]">{modelName}</span>
        ) : null}
        {message.runMode ? (
          <span className="rounded-full bg-[--color-bg-hover] px-2.5 py-1 text-[11px] text-[--color-text-muted]">{modeLabel(dict, message.runMode)}</span>
        ) : null}
        {hasContent ? (
          <button
            type="button"
            className="ml-auto inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs text-[--color-text-muted] transition-colors hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
            onClick={async () => {
              await copyTextWithToast(message.contentMarkdown, dict.ai.answerCopied, "复制失败，请手动复制")
            }}
          >
            <Copy size={13} />
            {dict.common.copy}
          </button>
        ) : null}
      </div>

      <div className="space-y-4">
        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold", statusChip(message.runStatus ?? message.status))}>
            {(message.runStatus ?? message.status) === "running" || message.status === "streaming" ? (
              <Sparkles size={12} className="soulwing-status-spark" />
            ) : null}
            {traceStatusLabel(dict, message.runStatus ?? message.status)}
          </span>
          {reasoningSteps.length > 0 ? (
            <span className="inline-flex rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
              {dict.ai.thinkingStages(reasoningSteps.length)}
            </span>
          ) : isStreaming ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
              <BrainCircuit size={12} className="soulwing-status-spark" />
              {dict.ai.thinkingStages(0)}
            </span>
          ) : null}
          {toolSteps.length > 0 ? (
            <span className="inline-flex rounded-full bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-700 ring-1 ring-cyan-100">
              {dict.ai.toolCallsTimes(toolSteps.length)}
            </span>
          ) : null}
        </div>

        {/* Warnings */}
        {warnings.length > 0 ? (
          <div className="space-y-2">
            {warnings.map((step) => (
              <div key={step.id} className="rounded-[14px] bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800">
                {step.summary}
              </div>
            ))}
          </div>
        ) : null}

        {/* Thinking & tool call trace — two independent sections */}
        {(reasoningSteps.length > 0 || toolSteps.length > 0 || isStreaming) ? (
          <TraceExecutionPanel
            reasoningSteps={reasoningSteps}
            toolSteps={toolSteps}
            isStreaming={isStreaming}
            dict={dict}
          />
        ) : null}

        {/* Content area — Markdown renders in both streaming and completed states */}
        {hasContent ? (
          <div className="ai-response">
            <MarkdownContent key={displayMarkdown.length} source={displayMarkdown} />
          </div>
        ) : isStreaming ? (
          <div className="flex items-center gap-2 py-2 text-sm font-medium text-slate-500">
            <ThinkingGlyph status="running" size="sm" />
            {dict.ai.generatingMessage}
          </div>
        ) : null}
      </div>
    </article>
  )
}

type InspirationMotion = "idle" | "opening" | "open" | "closing" | "settling"

const INSPIRATION_MOTION_MS = 2400
const INSPIRATION_SETTLE_MS = 520
const INSPIRATION_AUTO_CLOSE_MS = 12000
const INSPIRATION_BUBBLE_VISIBLE_MS = 4800
const INSPIRATION_BUBBLE_FIRST_DELAY_MS = 5600
const INSPIRATION_BUBBLE_MIN_INTERVAL_MS = 14500
const INSPIRATION_BUBBLE_INTERVAL_JITTER_MS = 7200

const INSPIRATION_TETHER_TONES = [1, 2, 3, 4, 5, 6] as const

function getInspirationBubblePhrases(fallbackText: string) {
  const fallback = fallbackText.trim()
  const isEnglish = /\b(tap|idea|inspiration|more)\b/i.test(fallback)

  if (isEnglish) {
    return [
      fallback,
      "Want another angle?",
      "I have a few more sparks",
      "Need a softer prompt?",
      "More ideas are tucked here",
      "Tap the wings for more",
      "Try one more thread?",
    ]
  }

  return [
    fallback,
    "要不要再看几个灵感？",
    "我还藏着几条思路",
    "换个角度看看？",
    "轻点蝶翼，灵感展开",
    "还有一些小火花",
    "要我再抖落几条想法吗？",
  ]
}

type InspirationPoint = {
  x: number
  y: number
}

type InspirationPath = {
  d: string
  source: InspirationPoint
  target: InspirationPoint
  mid: InspirationPoint
}

type SoulwingInspirationMotionProps = {
  featuredSuggestions: string[]
  secondarySuggestions: string[]
  suggestionsLoading: boolean
  isExpanded: boolean
  motion: InspirationMotion
  dict: Dictionary
  composerSlot: ReactNode
  butterflySrc: string
  onToggle: () => void
  onSendSuggestion: (value: string) => void
}

function centerPoint(rect: DOMRect, rootRect: DOMRect): InspirationPoint {
  return {
    x: rect.left - rootRect.left + rect.width / 2,
    y: rect.top - rootRect.top + rect.height / 2,
  }
}

function buildInspirationPath(source: InspirationPoint, target: InspirationPoint, index: number): InspirationPath {
  const dx = target.x - source.x
  const dy = target.y - source.y
  const side = Math.abs(dx) < 24 ? (index % 2 === 0 ? -1 : 1) : Math.sign(dx)
  const wave = index % 2 === 0 ? 1 : -1
  const bend = Math.min(128, Math.max(48, Math.abs(dx) * 0.28 + Math.abs(dy) * 0.06))
  const c1 = {
    x: source.x + dx * 0.18 + side * bend * 0.52,
    y: source.y + dy * 0.2 - 36 - (index % 3) * 7,
  }
  const c2 = {
    x: source.x + dx * 0.72 - side * bend * 0.42,
    y: source.y + dy * 0.76 + wave * Math.min(34, Math.max(18, Math.abs(dx) * 0.08 + 16)),
  }
  const mid = {
    x: source.x + dx * 0.5 + side * bend * 0.22,
    y: source.y + dy * 0.52 + wave * 18,
  }

  return {
    source,
    target,
    mid,
    d: `M ${source.x.toFixed(1)} ${source.y.toFixed(1)} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${target.x.toFixed(1)} ${target.y.toFixed(1)}`,
  }
}

function useSoulwingInspirationTimeline({
  motion,
  isExpanded,
  itemCount,
  rootRef,
  butterflyRef,
  butterflyImageRef,
  featuredRef,
  composerDockRef,
  shellRef,
  gridRef,
  svgRef,
  cardRefs,
  seedRefs,
  pathRefs,
}: {
  motion: InspirationMotion
  isExpanded: boolean
  itemCount: number
  rootRef: RefObject<HTMLDivElement | null>
  butterflyRef: RefObject<HTMLButtonElement | null>
  butterflyImageRef: RefObject<HTMLImageElement | null>
  featuredRef: RefObject<HTMLDivElement | null>
  composerDockRef: RefObject<HTMLDivElement | null>
  shellRef: RefObject<HTMLDivElement | null>
  gridRef: RefObject<HTMLDivElement | null>
  svgRef: RefObject<SVGSVGElement | null>
  cardRefs: MutableRefObject<Array<HTMLButtonElement | null>>
  seedRefs: MutableRefObject<Array<HTMLSpanElement | null>>
  pathRefs: MutableRefObject<Array<SVGPathElement | null>>
}) {
  useGSAP(() => {
    const root = rootRef.current
    const butterfly = butterflyRef.current
    const butterflyImage = butterflyImageRef.current
    const featured = featuredRef.current
    const composerDock = composerDockRef.current
    const shell = shellRef.current
    const grid = gridRef.current
    const svg = svgRef.current
    if (!root || !butterfly || !shell || !grid || !svg || itemCount === 0) return

    const cards = cardRefs.current.slice(0, itemCount).filter(Boolean) as HTMLButtonElement[]
    const seeds = seedRefs.current.slice(0, itemCount).filter(Boolean) as HTMLSpanElement[]
    const paths = pathRefs.current.slice(0, itemCount).filter(Boolean) as SVGPathElement[]
    if (cards.length === 0 || paths.length === 0) return

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    gsap.killTweensOf([shell, grid, featured, composerDock, butterflyImage, butterfly, ...cards, ...seeds, ...paths])

    if (motion === "opening") {
      gsap.set(shell, { height: "auto", marginTop: "0.35rem", autoAlpha: 1, overflow: "visible" })
      gsap.set(grid, { autoAlpha: 1 })
      gsap.set(cards, { x: 0, y: 0, scale: 1, rotate: 0, autoAlpha: 1, filter: "none" })
    }

    const rootRect = root.getBoundingClientRect()
    const source = centerPoint(butterfly.getBoundingClientRect(), rootRect)
    const width = Math.max(1, rootRect.width)
    const height = Math.max(1, rootRect.height)
    svg.setAttribute("viewBox", `0 0 ${width.toFixed(1)} ${height.toFixed(1)}`)
    svg.setAttribute("width", width.toFixed(1))
    svg.setAttribute("height", height.toFixed(1))
    svg.style.width = `${width}px`
    svg.style.height = `${height}px`
    const shellHeight = Math.max(grid.scrollHeight, grid.getBoundingClientRect().height, 1)

    const motionPaths = cards.map((card, index) => {
      const path = buildInspirationPath(source, centerPoint(card.getBoundingClientRect(), rootRect), index)
      const pathNode = paths[index]
      if (pathNode) {
        pathNode.setAttribute("d", path.d)
        pathNode.setAttribute("pathLength", "1")
      }
      return path
    })

    if (reducedMotion) {
      const visible = isExpanded && motion !== "closing"
      gsap.set(shell, {
        height: visible ? "auto" : 0,
        marginTop: visible ? "0.35rem" : 0,
        autoAlpha: visible ? 1 : 0,
        overflow: "visible",
      })
      gsap.set(cards, { x: 0, y: 0, scale: 1, rotate: 0, autoAlpha: visible ? 1 : 0, filter: "none" })
      gsap.set([featured, composerDock], { y: 0, scale: 1, filter: "none", clearProps: "transform" })
      gsap.set([...paths, ...seeds], { autoAlpha: 0 })
      return
    }

    const tl = gsap.timeline({ defaults: { overwrite: "auto" } })

    if (motion === "opening") {
      gsap.set(shell, { height: 0, marginTop: "0.35rem", autoAlpha: 1, overflow: "visible" })
      gsap.set(grid, { autoAlpha: 1 })
      gsap.set(paths, {
        autoAlpha: 0,
        strokeDasharray: 1,
        strokeDashoffset: 1,
        filter: "blur(0.8px) drop-shadow(0 0 2px currentColor)",
      })
      gsap.set(seeds, {
        x: source.x,
        y: source.y,
        xPercent: -50,
        yPercent: -50,
        scale: 0.32,
        autoAlpha: 0,
      })

      cards.forEach((card, index) => {
        const path = motionPaths[index]
        gsap.set(card, {
          x: path.source.x - path.target.x,
          y: path.source.y - path.target.y,
          scale: 0.16,
          rotate: index % 2 === 0 ? -14 : 14,
          autoAlpha: 0,
          filter: "blur(10px) saturate(1.28)",
          transformOrigin: "50% 50%",
        })
      })
      gsap.set(featured, { y: 0, scale: 1, transformOrigin: "50% 100%" })
      gsap.set(composerDock, { y: -12, scale: 0.992, transformOrigin: "50% 0%" })

      tl.to(butterflyImage, { scale: 0.88, rotate: -5, duration: 0.16, ease: "power2.in" }, 0)
        .to(butterflyImage, { scale: 1.18, rotate: 5, duration: 0.34, ease: "back.out(2.2)" }, 0.16)
        .to(butterflyImage, { scale: 1, rotate: 0, duration: 0.42, ease: "elastic.out(1, 0.48)" }, 0.48)
        .to(featured, { y: -5, scale: 0.997, duration: 0.24, ease: "power2.out" }, 0.04)
        .to(featured, { y: 2, scale: 1.002, duration: 0.26, ease: "power2.inOut" }, 0.46)
        .to(featured, { y: 0, scale: 1, duration: 0.58, ease: "elastic.out(1, 0.58)" }, 0.74)
        .to(shell, { height: shellHeight * 0.88, duration: 0.74, ease: "power3.out" }, 0.14)
        .to(shell, { height: shellHeight * 1.018, duration: 0.24, ease: "power1.out" }, 0.88)
        .to(shell, { height: shellHeight, duration: 0.46, ease: "elastic.out(1, 0.66)" }, 1.08)
        .to(composerDock, { y: 12, scale: 0.998, duration: 0.72, ease: "power2.out" }, 0.18)
        .to(composerDock, { y: -4, scale: 1.003, duration: 0.24, ease: "power2.inOut" }, 0.88)
        .to(composerDock, { y: 0, scale: 1, duration: 0.72, ease: "elastic.out(1, 0.56)" }, 1.08)

      const clamp01 = gsap.utils.clamp(0, 1)
      const revealEase = gsap.parseEase("power3.out")
      cards.forEach((card, index) => {
        const pathNode = paths[index]
        const seed = seeds[index]
        const path = motionPaths[index]
        const at = 0.24 + index * 0.045
        if (!pathNode || !seed) return
        const pathLength = Math.max(pathNode.getTotalLength(), 1)
        const travel = { progress: 0 }
        const updateTravel = () => {
          const progress = clamp01(travel.progress)
          const point = pathNode.getPointAtLength(pathLength * progress)
          const reveal = clamp01((progress - 0.12) / 0.58)
          const seedFade = progress > 0.74 ? clamp01((0.98 - progress) / 0.24) : 1
          const easedReveal = revealEase(reveal)

          gsap.set(seed, {
            x: point.x,
            y: point.y,
            autoAlpha: 0.9 * seedFade,
            scale: 0.98 - progress * 0.34,
          })
          gsap.set(card, {
            x: point.x - path.target.x,
            y: point.y - path.target.y,
            scale: 0.16 + easedReveal * 0.86,
            rotate: (1 - progress) * (index % 2 === 0 ? -13 : 13),
            autoAlpha: reveal,
            filter: `blur(${(1 - reveal) * 9}px) saturate(${1 + (1 - reveal) * 0.26})`,
          })
        }

        tl.to(seed, { autoAlpha: 0.92, scale: 1, duration: 0.16, ease: "power2.out" }, at)
          .to(pathNode, { autoAlpha: index > 5 ? 0.08 : 0.13, strokeDashoffset: 0, duration: 1.12, ease: "power2.out" }, at + 0.02)
          .to(travel, {
            progress: 1,
            duration: 1.18,
            ease: "power2.inOut",
            onStart: updateTravel,
            onUpdate: updateTravel,
            onComplete: () => {
              gsap.set(seed, { autoAlpha: 0, scale: 0.18 })
              gsap.set(card, { x: 0, y: 0, scale: 1, rotate: 0, autoAlpha: 1, filter: "blur(0px) saturate(1)" })
            },
          }, at + 0.02)
          .to(card, { scale: 1.025, duration: 0.14, ease: "power2.out" }, at + 1.21)
          .to(card, { scale: 1, duration: 0.24, ease: "elastic.out(1, 0.56)" }, at + 1.35)
      })

      tl.set(shell, { height: "auto", clearProps: "overflow" }, 1.9)
        .set([featured, composerDock], { clearProps: "transform" }, 1.92)
      return () => tl.kill()
    }

    if (motion === "open") {
      gsap.set(shell, { height: "auto", marginTop: "0.35rem", autoAlpha: 1, overflow: "visible" })
      gsap.set(cards, { x: 0, y: 0, scale: 1, rotate: 0, autoAlpha: 1, filter: "none" })
      gsap.set([featured, composerDock], { y: 0, scale: 1, filter: "none", clearProps: "transform" })
      gsap.set(seeds, { autoAlpha: 0 })
      gsap.set(paths, {
        autoAlpha: 0.08,
        strokeDasharray: "0.035 0.11",
        strokeDashoffset: 0,
        filter: "blur(0.12px) drop-shadow(0 0 1.5px currentColor)",
      })
      const ambient = gsap.to(paths, {
        strokeDashoffset: -0.42,
        duration: 4.6,
        repeat: -1,
        ease: "none",
        stagger: 0.12,
      })
      return () => ambient.kill()
    }

    if (motion === "closing") {
      gsap.set(shell, { height: Math.max(shell.getBoundingClientRect().height, shellHeight), marginTop: "0.35rem", autoAlpha: 1, overflow: "visible" })
      gsap.set(paths, {
        autoAlpha: 0.1,
        strokeDasharray: 1,
        strokeDashoffset: 0,
        filter: "blur(0.18px) drop-shadow(0 0 1.5px currentColor)",
      })
      gsap.set(seeds, { xPercent: -50, yPercent: -50, autoAlpha: 0, scale: 0.42 })
      gsap.set(cards, { x: 0, y: 0, scale: 1, rotate: 0, autoAlpha: 1, filter: "none" })
      gsap.set([featured, composerDock], { y: 0, scale: 1 })

      tl.to([featured, composerDock], { y: 0, scale: 1, duration: 0.01, ease: "none" }, 0)
        .to(butterflyImage, { scale: 1.12, rotate: -6, duration: 0.24, ease: "power2.out" }, 1.18)
        .to(butterflyImage, { scale: 0.94, rotate: 4, duration: 0.22, ease: "power2.inOut" }, 1.42)
        .to(butterflyImage, { scale: 1, rotate: 0, duration: 0.46, ease: "elastic.out(1, 0.5)" }, 1.64)
        .to(shell, {
          height: 0,
          marginTop: 0,
          autoAlpha: 0,
          duration: 1.76,
          ease: "power2.inOut",
          onComplete: () => {
            gsap.set(shell, { height: 0, marginTop: 0, autoAlpha: 0 })
            gsap.set([featured, composerDock], { y: 0, scale: 1, clearProps: "transform" })
          },
        }, 0.18)

      cards.forEach((card, index) => {
        const pathNode = paths[index]
        const seed = seeds[index]
        const path = motionPaths[index]
        if (!pathNode || !seed) return
        const reverseIndex = itemCount - index - 1
        const at = reverseIndex * 0.045
        const returnX = path.source.x - path.target.x
        const returnY = path.source.y - path.target.y
        const midX = path.mid.x - path.target.x
        const midY = path.mid.y - path.target.y

        tl.to(card, { scale: 0.92, y: -2, duration: 0.16, ease: "power2.out" }, at)
          .to(card, {
            keyframes: [
              { x: midX, y: midY, scale: 0.58, rotate: index % 2 === 0 ? 9 : -9, autoAlpha: 0.68, filter: "blur(2px) saturate(1.16)" },
              { x: returnX, y: returnY, scale: 0.1, rotate: index % 2 === 0 ? 28 : -28, autoAlpha: 0, filter: "blur(10px) saturate(1.35)" },
            ],
            duration: 1.28,
            ease: "power2.inOut",
          }, at + 0.1)
          .fromTo(seed, {
            x: path.target.x,
            y: path.target.y,
            scale: 0.72,
            autoAlpha: 0,
          }, {
            autoAlpha: 0.86,
            scale: 0.96,
            duration: 0.12,
            ease: "power2.out",
          }, at + 0.1)
          .to(seed, {
            motionPath: { path: pathNode, align: pathNode, alignOrigin: [0.5, 0.5], start: 1, end: 0 },
            scale: 0.32,
            duration: 1.22,
            ease: "power2.inOut",
          }, at + 0.18)
          .to(pathNode, { strokeDashoffset: 1, autoAlpha: 0, duration: 1.22, ease: "power2.inOut" }, at + 0.16)
          .to(seed, { autoAlpha: 0, scale: 0.12, duration: 0.16, ease: "power2.in" }, at + 1.3)
      })
      return () => tl.kill()
    }

    if (motion === "settling" || !isExpanded) {
      gsap.set(shell, { height: 0, marginTop: 0, autoAlpha: 0, overflow: "visible" })
      gsap.set(cards, { autoAlpha: 0 })
      gsap.set([featured, composerDock], { y: 0, scale: 1, clearProps: "transform" })
      gsap.set([...paths, ...seeds], { autoAlpha: 0 })
    }
  }, {
    scope: rootRef,
    dependencies: [motion, isExpanded, itemCount],
  })
}

function SoulwingInspirationMotion({
  featuredSuggestions,
  secondarySuggestions,
  suggestionsLoading,
  isExpanded,
  motion,
  dict,
  composerSlot,
  butterflySrc,
  onToggle,
  onSendSuggestion,
}: SoulwingInspirationMotionProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const butterflyRef = useRef<HTMLButtonElement | null>(null)
  const butterflyImageRef = useRef<HTMLImageElement | null>(null)
  const featuredRef = useRef<HTMLDivElement | null>(null)
  const composerDockRef = useRef<HTMLDivElement | null>(null)
  const shellRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([])
  const seedRefs = useRef<Array<HTMLSpanElement | null>>([])
  const pathRefs = useRef<Array<SVGPathElement | null>>([])
  const bubbleShowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bubbleHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bubblePhrases = useMemo(() => getInspirationBubblePhrases(dict.ai.moreInspirationBubble), [dict.ai.moreInspirationBubble])
  const [bubblePhraseIndex, setBubblePhraseIndex] = useState(0)
  const [isBubbleVisible, setIsBubbleVisible] = useState(false)
  const hasSecondarySuggestions = secondarySuggestions.length > 0
  const shouldRenderSecondary = hasSecondarySuggestions && (isExpanded || motion === "opening" || motion === "open" || motion === "closing")
  const bubbleText = bubblePhrases[bubblePhraseIndex] ?? dict.ai.moreInspirationBubble

  useEffect(() => {
    function clearBubbleTimers() {
      if (bubbleShowTimerRef.current) {
        clearTimeout(bubbleShowTimerRef.current)
        bubbleShowTimerRef.current = null
      }
      if (bubbleHideTimerRef.current) {
        clearTimeout(bubbleHideTimerRef.current)
        bubbleHideTimerRef.current = null
      }
    }

    clearBubbleTimers()
    const resetBubbleTimer = setTimeout(() => {
      setIsBubbleVisible(false)
    }, 0)

    if (isExpanded || suggestionsLoading || !hasSecondarySuggestions) {
      return () => {
        clearTimeout(resetBubbleTimer)
        clearBubbleTimers()
      }
    }

    const scheduleBubble = (delay: number) => {
      bubbleShowTimerRef.current = setTimeout(() => {
        setBubblePhraseIndex((current) => {
          if (bubblePhrases.length <= 1) return 0
          const step = 1 + Math.floor(Math.random() * (bubblePhrases.length - 1))
          return (current + step) % bubblePhrases.length
        })
        setIsBubbleVisible(true)

        bubbleHideTimerRef.current = setTimeout(() => {
          setIsBubbleVisible(false)
          scheduleBubble(INSPIRATION_BUBBLE_MIN_INTERVAL_MS + Math.random() * INSPIRATION_BUBBLE_INTERVAL_JITTER_MS)
        }, INSPIRATION_BUBBLE_VISIBLE_MS)
      }, delay)
    }

    scheduleBubble(INSPIRATION_BUBBLE_FIRST_DELAY_MS + Math.random() * 2600)

    return () => {
      clearTimeout(resetBubbleTimer)
      clearBubbleTimers()
    }
  }, [bubblePhrases.length, hasSecondarySuggestions, isExpanded, suggestionsLoading])

  useSoulwingInspirationTimeline({
    motion,
    isExpanded,
    itemCount: shouldRenderSecondary ? secondarySuggestions.length : 0,
    rootRef,
    butterflyRef,
    butterflyImageRef,
    featuredRef,
    composerDockRef,
    shellRef,
    gridRef,
    svgRef,
    cardRefs,
    seedRefs,
    pathRefs,
  })

  return (
    <>
      <div
        ref={rootRef}
        className={cn(
          "soulwing-inspiration-cluster",
          motion === "opening" && "is-gsap-opening",
          motion === "closing" && "is-gsap-closing",
          motion === "settling" && "is-settling",
          isExpanded && "is-expanded",
        )}
      >
        <svg ref={svgRef} className="soulwing-inspiration-tethers" preserveAspectRatio="none" aria-hidden="true">
          {secondarySuggestions.map((_, index) => {
            const tone = INSPIRATION_TETHER_TONES[index % INSPIRATION_TETHER_TONES.length]
            return (
              <path
                key={`tether-${index}`}
                ref={(node) => {
                  pathRefs.current[index] = node
                }}
                pathLength={1}
                className={`soulwing-inspiration-tether-line soulwing-inspiration-tether-line-${tone}`}
              />
            )
          })}
        </svg>
        <div className="soulwing-inspiration-seeds" aria-hidden="true">
          {secondarySuggestions.map((_, index) => {
            const tone = INSPIRATION_TETHER_TONES[index % INSPIRATION_TETHER_TONES.length]
            return (
              <span
                key={`seed-${index}`}
                ref={(node) => {
                  seedRefs.current[index] = node
                }}
                className={`soulwing-inspiration-seed soulwing-inspiration-seed-${tone}`}
              />
            )
          })}
        </div>

        <div className="soulwing-butterfly-stage">
          <button
            ref={butterflyRef}
            type="button"
            className={cn(
              "soulwing-inspiration-butterfly-trigger",
              isExpanded && "is-expanded",
              suggestionsLoading && "is-loading",
            )}
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? dict.ai.hideMoreInspirations : dict.ai.moreInspirationBubble}
          >
            {!isExpanded ? (
              <span className={cn("soulwing-butterfly-bubble", isBubbleVisible && "is-visible")}>
                <Sparkles size={13} className="soulwing-butterfly-bubble-icon" aria-hidden="true" />
                <span>{bubbleText}</span>
              </span>
            ) : null}
            <Image
              ref={butterflyImageRef}
              src={butterflySrc}
              alt=""
              width={58}
              height={58}
              className="soulwing-inspiration-butterfly-image"
            />
            {suggestionsLoading ? (
              <span className="soulwing-butterfly-loading" aria-hidden="true">
                <Sparkles size={13} />
              </span>
            ) : null}
          </button>
        </div>

        <div ref={featuredRef} className="soulwing-featured-suggestions">
          {featuredSuggestions.map((item, index) => (
            <button
              key={`${item}-featured-${index}`}
              type="button"
              onClick={() => onSendSuggestion(item)}
              className="soulwing-featured-suggestion group"
            >
              <span className="soulwing-featured-suggestion-row">
                <span className="soulwing-featured-suggestion-meta">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="soulwing-featured-suggestion-text">{item}</span>
              </span>
            </button>
          ))}
        </div>

        {shouldRenderSecondary ? (
          <div ref={shellRef} className={cn("soulwing-compact-suggestions-shell is-gsap-managed", motion === "open" && "is-gsap-open")}>
            <div ref={gridRef} className="soulwing-compact-suggestions is-gsap-managed" aria-label={dict.ai.moreSuggestion}>
              {secondarySuggestions.map((item, index) => (
                <button
                  key={`${item}-compact-${index}`}
                  ref={(node) => {
                    cardRefs.current[index] = node
                  }}
                  type="button"
                  onClick={() => onSendSuggestion(item)}
                  className="soulwing-compact-suggestion group"
                >
                  <span className="soulwing-compact-suggestion-index">{index + 4}</span>
                  <span className="soulwing-compact-suggestion-text">{item}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div ref={composerDockRef} className="soulwing-inspiration-composer-dock">
        {composerSlot}
      </div>
    </>
  )
}

export function AIAssistantClient({ viewer, canManageAI = false, agentProfile }: AIAssistantClientProps = {}) {
  const dict = getDict()
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [runsByMessageId, setRunsByMessageId] = useState<Record<string, RunDetail>>({})
  const [statusPayload, setStatusPayload] = useState<AIStatusResponse | null>(null)
  const [prompt, setPrompt] = useState("")
  const [suggestions, setSuggestions] = useState<string[]>([...DEFAULT_AI_SUGGESTIONS])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [, setSuggestionsGenerated] = useState(false)
  const [showMoreInspirations, setShowMoreInspirations] = useState(false)
  const [inspirationMotion, setInspirationMotion] = useState<InspirationMotion>("idle")
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const [requestMessage, setRequestMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [actionMenuOpen, setActionMenuOpen] = useState(false)
  const [sidebarUserMenuOpen, setSidebarUserMenuOpen] = useState(false)
  const [mobileModelSheetOpen, setMobileModelSheetOpen] = useState(false)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState("")
  const [mobilePanel, setMobilePanel] = useState<"conversations" | "controls" | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [creatingConversation, setCreatingConversation] = useState(false)
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null)
  const messageSeedRef = useRef(0)
  const endRef = useRef<HTMLDivElement | null>(null)
  const attachmentInputRef = useRef<HTMLInputElement | null>(null)
  const desktopPromptInputRef = useRef<HTMLTextAreaElement | null>(null)
  const mobilePromptInputRef = useRef<HTMLTextAreaElement | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const inspirationMotionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inspirationAutoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const conversationGroups = useMemo(() => groupConversationsByRecency(dict, conversations), [dict, conversations])
  const viewerName = viewer?.name?.trim() || viewer?.email?.trim() || "SoulWing"
  const viewerEmail = viewer?.email?.trim() || null
  const agentChineseName = agentProfile?.chineseName?.trim() || dict.ai.title
  const agentEnglishName = agentProfile?.englishName?.trim() || "SoulWing"
  const agentAvatarUrl = agentProfile?.avatarUrl?.trim() || ""

  function openAttachmentPicker() {
    setActionMenuOpen(false)
    attachmentInputRef.current?.click()
  }

  function openQuickModelMenu() {
    setActionMenuOpen(false)
    if (window.matchMedia("(max-width: 767px)").matches) {
      setMobileModelSheetOpen(true)
    } else {
      setModelMenuOpen(true)
    }
  }

  async function loadRun(messageId: string) {
    const res = await fetch(`/api/ai/runs/${messageId}?includeSteps=true`, { cache: "no-store" })
    if (!res.ok) return
    const data = await res.json().catch(() => null)
    if (data?.run) {
      setRunsByMessageId((current) => ({ ...current, [messageId]: data.run }))
    }
  }

  async function loadStatus() {
    const res = await fetch("/api/ai/status", { cache: "no-store" })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error ?? dict.ai.loadAiStatusFailed)
    setStatusPayload(data)
  }

  async function loadConversations(preferredId?: string | null) {
    const res = await fetch("/api/ai/conversations", { cache: "no-store" })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error ?? dict.ai.loadConversationsFailed)
    const items: ConversationItem[] = Array.isArray(data?.items) ? data.items : []
    setConversations(items)

    const preferredExists = preferredId ? items.some((item) => item.id === preferredId) : false
    const currentExists = activeConversationId ? items.some((item) => item.id === activeConversationId) : false
    const nextActiveId =
      preferredExists ? (preferredId ?? null) :
      currentExists ? activeConversationId :
      items[0]?.id ?? null

    setActiveConversationId(nextActiveId)
    return nextActiveId
  }

  async function loadMessages(conversationId: string | null) {
    if (!conversationId) {
      setMessages([])
      setRunsByMessageId({})
      return
    }

    const res = await fetch(`/api/ai/conversations/${conversationId}/messages`, { cache: "no-store" })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error ?? dict.ai.loadMessagesFailed)

    const serverItems: MessageItem[] = Array.isArray(data?.items) ? data.items : []
    // Merge with local state: preserve streaming trace events, adopt server content for completed messages
    setMessages((prev) => {
      const prevMap = new Map(prev.map((m) => [m.id, m]))
      return serverItems.map((server) => {
        const local = prevMap.get(server.id)
        if (!local) return server
        // If local message was streaming and now server says completed, merge
        if (local.status === "streaming" && server.status === "completed") {
          return {
            ...server,
            // Preserve locally-built stepsPreview which have correct types from SSE events
            stepsPreview: local.stepsPreview.length > 0 ? local.stepsPreview : server.stepsPreview,
          }
        }
        return server
      })
    })

    const assistants = serverItems.filter((item) => item.role === "assistant" && item.runId)
    await Promise.all(assistants.map((item) => loadRun(item.id)))
  }

  async function bootstrap() {
    setLoading(true)
    try {
      await loadStatus()
      const conversationId = await loadConversations()
      await loadMessages(conversationId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.ai.loadAiFailed)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void bootstrap()
    // bootstrap is intentionally run once on mount for the AI workspace shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const container = endRef.current?.parentElement
    if (!container) return
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120
    if (isNearBottom || sending) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    }
  }, [messages, sending])

  useEffect(() => {
    const resizeTextarea = (node: HTMLTextAreaElement | null, maxHeight: number) => {
      if (!node) return
      node.style.height = "0px"
      const nextHeight = Math.min(Math.max(node.scrollHeight, 42), maxHeight)
      node.style.height = `${nextHeight}px`
      node.style.overflowY = node.scrollHeight > maxHeight ? "auto" : "hidden"
    }

    const mobileMaxHeight = typeof window !== "undefined" ? Math.floor(window.innerHeight * 0.5) : 320
    resizeTextarea(desktopPromptInputRef.current, 240)
    resizeTextarea(mobilePromptInputRef.current, mobileMaxHeight)
  }, [prompt])

  async function createConversation() {
    if (creatingConversation) return
    setCreatingConversation(true)
    try {
      const res = await fetch("/api/ai/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: dict.ai.newConversation }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? dict.ai.createConversationFailed)
      await loadConversations(data?.id ?? null)
      setMessages([])
      setRunsByMessageId({})
      setMobilePanel(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.ai.createConversationFailed)
    } finally {
      setCreatingConversation(false)
    }
  }

  async function renameConversation(id: string) {
    try {
      const res = await fetch(`/api/ai/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: renameValue }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? dict.ai.renameConversationFailed)
      setRenamingId(null)
      setRenameValue("")
      await loadConversations(id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.ai.renameConversationFailed)
    }
  }

  async function deleteConversation(id: string) {
    if (!confirmAction("确定删除这段 AI 对话？该对话中的历史消息会从列表中移除，无法直接恢复。")) return
    setDeletingConversationId(id)
    try {
      const res = await fetch(`/api/ai/conversations/${id}`, { method: "DELETE" })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? dict.ai.deleteConversationFailed)
      const nextId = conversations.find((item) => item.id !== id)?.id ?? null
      await loadConversations(nextId)
      await loadMessages(nextId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.ai.deleteConversationFailed)
    } finally {
      setDeletingConversationId(null)
    }
  }

  async function submitAccessRequest() {
    if (!requestMessage.trim()) return
    try {
      const res = await fetch("/api/ai/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: requestMessage }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? dict.ai.submitRequestFailed)
      toast.success(dict.ai.aiRequestSubmitted)
      setRequestMessage("")
      await loadStatus()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.ai.submitRequestFailed)
    }
  }

  async function uploadAttachment(file: File) {
    const form = new FormData()
    form.set("file", file)
    const response = await fetch("/api/upload", { method: "POST", body: form })
    const data = await response.json().catch(() => null)
    if (!response.ok) throw new Error(data?.error ?? dict.ai.imageUploadFailed)
    return {
      id: data?.id ?? crypto.randomUUID(),
      uploadId: data?.id ?? null,
      url: data?.url ?? "",
      originalName: data?.originalName ?? file.name,
      mimeType: file.type,
      size: file.size,
      status: "ready" as const,
    }
  }

  async function handleAttachmentFiles(files: File[]) {
    if (files.length === 0) return
    const imageFiles = files.filter((file) => file.type.startsWith("image/"))
    if (imageFiles.length === 0) {
      toast.error(dict.ai.imageUploadFailed)
      return
    }

    const localItems: ComposerAttachment[] = imageFiles.map((file) => ({
      id: `local-${crypto.randomUUID()}`,
      uploadId: null,
      url: URL.createObjectURL(file),
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      status: "uploading",
    }))

    setAttachments((current) => [...current, ...localItems])

    await Promise.all(localItems.map(async (localItem, index) => {
      const file = imageFiles[index]
      try {
        const uploaded = await uploadAttachment(file)
        URL.revokeObjectURL(localItem.url)
        setAttachments((current) => current.map((item) => item.id === localItem.id ? uploaded : item))
      } catch (error) {
        setAttachments((current) => current.map((item) => item.id === localItem.id ? {
          ...item,
          status: "failed",
          errorMessage: error instanceof Error ? error.message : dict.ai.imageUploadFailed,
        } : item))
      }
    }))
  }

  function patchAssistantMessage(messageId: string, updater: (item: MessageItem) => MessageItem) {
    setMessages((current) => current.map((item) => item.id === messageId ? updater(item) : item))
  }

  function upsertStep(messageId: string, step: StepPreview) {
    patchAssistantMessage(messageId, (item) => {
      const exists = item.stepsPreview.some((current) => current.id === step.id)
      return {
        ...item,
        stepsPreview: exists
          ? item.stepsPreview.map((current) => current.id === step.id ? { ...current, ...step } : current)
          : [...item.stepsPreview, step],
      }
    })
  }

  const providerLabel = statusPayload?.status.config?.providerLabel ?? statusPayload?.userConfig?.providerLabel ?? ""
  const configuredModelName = statusPayload?.status.config?.model ?? statusPayload?.userConfig?.model ?? ""
  const activeBaseUrl = statusPayload?.status.config?.baseUrl ?? statusPayload?.userConfig?.baseUrl ?? ""
  const activeModelName = selectedModel || configuredModelName
  const capabilities = statusPayload?.status.config?.capabilities ?? statusPayload?.userConfig?.capabilities ?? null
  const activeConfigSource = statusPayload?.userConfig?.source ?? "self"
  const activeSuggestionConfigKey = statusPayload?.userConfig?.id ?? statusPayload?.grant?.id ?? ""
  const canUseSuggestionGenerator = statusPayload?.status.canUseAI ?? false
  const visibleSuggestions = useMemo(() => withDefaultAISuggestions(suggestions, 15, 20), [suggestions])
  const featuredSuggestions = visibleSuggestions.slice(0, 3)
  const secondarySuggestions = visibleSuggestions.slice(3)
  const hasUploadingAttachments = attachments.some((attachment) => attachment.status === "uploading")
  const hasFailedAttachments = attachments.some((attachment) => attachment.status === "failed")
  const canSubmitComposer = !sending && !hasUploadingAttachments && !hasFailedAttachments && (prompt.trim().length > 0 || attachments.length > 0)

  function clearInspirationTimers() {
    if (inspirationMotionTimerRef.current) {
      clearTimeout(inspirationMotionTimerRef.current)
      inspirationMotionTimerRef.current = null
    }
    if (inspirationAutoCloseTimerRef.current) {
      clearTimeout(inspirationAutoCloseTimerRef.current)
      inspirationAutoCloseTimerRef.current = null
    }
  }

  function openInspirationDrawer() {
    clearInspirationTimers()
    setShowMoreInspirations(true)
    setInspirationMotion("opening")
    inspirationMotionTimerRef.current = setTimeout(() => {
      setInspirationMotion("open")
      inspirationMotionTimerRef.current = null
    }, INSPIRATION_MOTION_MS)
  }

  function finishInspirationClose() {
    setShowMoreInspirations(false)
    setInspirationMotion("settling")
    inspirationMotionTimerRef.current = setTimeout(() => {
      setInspirationMotion("idle")
      inspirationMotionTimerRef.current = null
    }, INSPIRATION_SETTLE_MS)
  }

  function closeInspirationDrawer() {
    if (!showMoreInspirations || inspirationMotion === "closing") return
    clearInspirationTimers()
    setInspirationMotion("closing")
    inspirationMotionTimerRef.current = setTimeout(() => {
      finishInspirationClose()
    }, INSPIRATION_MOTION_MS)
  }

  function toggleInspirationDrawer() {
    if (showMoreInspirations && inspirationMotion !== "closing") {
      closeInspirationDrawer()
      return
    }
    openInspirationDrawer()
  }

  useEffect(() => {
    return () => {
      clearInspirationTimers()
    }
  }, [])

  useEffect(() => {
    clearInspirationTimers()
    setShowMoreInspirations(false)
    setInspirationMotion("idle")
  }, [activeConversationId])

  useEffect(() => {
    if (!showMoreInspirations || inspirationMotion !== "open") return
    if (inspirationAutoCloseTimerRef.current) {
      clearTimeout(inspirationAutoCloseTimerRef.current)
    }
    inspirationAutoCloseTimerRef.current = setTimeout(() => {
      setInspirationMotion("closing")
      inspirationMotionTimerRef.current = setTimeout(() => {
        finishInspirationClose()
      }, INSPIRATION_MOTION_MS)
      inspirationAutoCloseTimerRef.current = null
    }, INSPIRATION_AUTO_CLOSE_MS)

    return () => {
      if (inspirationAutoCloseTimerRef.current) {
        clearTimeout(inspirationAutoCloseTimerRef.current)
        inspirationAutoCloseTimerRef.current = null
      }
    }
  }, [showMoreInspirations, inspirationMotion])

  useEffect(() => {
    const syncModelCatalog = () => {
      if (activeConfigSource === "admin_grant" && statusPayload?.userConfig?.modelList?.length) {
        // Admin grants: the model list is server-managed, while the user's
        // last selected model is a local preference within that allowed list.
        const grantModels = statusPayload.userConfig.modelList
        const catalog = loadModelCatalog(providerLabel, activeBaseUrl, configuredModelName)
        const nextSelectedModel = grantModels.includes(catalog.selectedModel)
          ? catalog.selectedModel
          : grantModels.includes(configuredModelName)
            ? configuredModelName
            : (grantModels[0] ?? "")

        setAvailableModels(grantModels)
        setSelectedModel(nextSelectedModel)
        return
      }

      // Self configs: server DB is the canonical model list; localStorage only tracks selected-model preference
      const serverModels: string[] = statusPayload?.userConfig?.modelList ?? []
      const catalog = loadModelCatalog(providerLabel, activeBaseUrl, configuredModelName)

      // Merge DB list (canonical) + any localStorage-only additions for backward compat
      const merged = Array.from(new Set([...serverModels, ...catalog.models])).filter(Boolean).slice(0, 30)
      const finalModels = merged.length > 0 ? merged : catalog.models

      setAvailableModels(finalModels)
      setSelectedModel(catalog.selectedModel || configuredModelName)
    }

    syncModelCatalog()

    const onStorage = (event: StorageEvent) => {
      if (!event.key || (providerLabel && activeBaseUrl && event.key.includes("ai-model-presets:"))) {
        syncModelCatalog()
      }
    }
    const onCatalogUpdated = () => {
      syncModelCatalog()
    }

    window.addEventListener("storage", onStorage)
    window.addEventListener(AI_MODEL_PRESETS_UPDATED_EVENT, onCatalogUpdated)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener(AI_MODEL_PRESETS_UPDATED_EVENT, onCatalogUpdated)
    }
  }, [activeBaseUrl, configuredModelName, providerLabel, activeConfigSource, statusPayload?.userConfig?.modelList])

  useEffect(() => {
    if (!canUseSuggestionGenerator || !activeSuggestionConfigKey) {
      setSuggestions([...DEFAULT_AI_SUGGESTIONS])
      setSuggestionsGenerated(false)
      setSuggestionsLoading(false)
      return
    }

    const key = suggestionStorageKey(activeSuggestionConfigKey)
    const stored = readStoredSuggestions(key)
    const nextLoadCount = (stored?.loadsSinceRefresh ?? 0) + 1
    const shouldRefresh = !stored || nextLoadCount >= SUGGESTION_REFRESH_LOADS
    const controller = new AbortController()

    if (stored) {
      setSuggestions(stored.items)
      setSuggestionsGenerated(true)
    } else {
      setSuggestions([...DEFAULT_AI_SUGGESTIONS])
      setSuggestionsGenerated(false)
    }

    if (!shouldRefresh) {
      writeStoredSuggestions(key, {
        items: stored.items,
        loadsSinceRefresh: nextLoadCount,
        generatedAt: stored.generatedAt,
      })
      return () => controller.abort()
    }

    setSuggestionsLoading(true)

    async function refreshSuggestions() {
      try {
        const res = await fetch("/api/ai/suggestions", {
          method: "POST",
          cache: "no-store",
          signal: controller.signal,
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error("Failed to refresh suggestions")
        const items = withDefaultAISuggestions(data?.items ?? [], 15, 20)
        const generated = data?.source === "ai" || data?.generated === true
        setSuggestions(items)
        setSuggestionsGenerated(generated)
        if (generated) {
          writeStoredSuggestions(key, {
            items,
            loadsSinceRefresh: 0,
            generatedAt: new Date().toISOString(),
          })
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
        if (stored) {
          writeStoredSuggestions(key, {
            items: stored.items,
            loadsSinceRefresh: nextLoadCount,
            generatedAt: stored.generatedAt,
          })
        }
      } finally {
        if (!controller.signal.aborted) setSuggestionsLoading(false)
      }
    }

    void refreshSuggestions()
    return () => controller.abort()
  }, [activeSuggestionConfigKey, canUseSuggestionGenerator])

  function selectActiveModel(model: string) {
    const nextModel = model.trim()
    if (!nextModel) return
    setSelectedModel(nextModel)
    saveModelCatalog(providerLabel, activeBaseUrl, availableModels, nextModel)
  }

  function stopGeneration() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }

  async function sendPrompt(nextPrompt?: string) {
    const text = (nextPrompt ?? prompt).trim()
    if ((!text && attachments.length === 0) || sending) return
    if (attachments.some((attachment) => attachment.status === "uploading")) {
      toast.info("图片还在上传，上传完成后再发送。")
      return
    }
    if (attachments.some((attachment) => attachment.status === "failed")) {
      toast.error("有图片上传失败，请删除后重新上传。")
      return
    }

    // Runtime grant status check
    if (statusPayload?.status.source === "grant") {
      const grantStatus = statusPayload?.userConfig?.status
      if (grantStatus === "paused") {
        toast.error(dict.ai.adminGrantPausedHint)
        return
      }
      if (grantStatus === "revoked" || grantStatus === "deprecated") {
        toast.error(dict.ai.adminGrantRevokedHint)
        // Refresh status to get updated state
        await loadStatus()
        return
      }
    }

    if (!statusPayload?.status.canUseAI) {
      toast.error(dict.ai.noAvailableAiHint)
      return
    }

    setSending(true)
    messageSeedRef.current += 1
    const optimisticUserId = `local-user-${messageSeedRef.current}`
    messageSeedRef.current += 1
    let currentAssistantId = `local-assistant-${messageSeedRef.current}`
    const nowIso = new Date().toISOString()
    const outgoingAttachments: AttachmentItem[] = attachments.map((attachment) => ({
      id: attachment.id,
      uploadId: attachment.uploadId,
      url: attachment.url,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
    }))

    setMessages((current) => [
      ...current,
      {
        id: optimisticUserId,
        role: "user",
        contentMarkdown: text,
        status: "completed",
        reasoningSummary: "",
        toolTraceSummary: "",
        modelName: "",
        providerSource: statusPayload.status.source,
        createdAt: nowIso,
        runId: null,
        runMode: null,
        runStatus: null,
        delegatedTargetUserId: null,
        stepsPreview: [],
        attachments: outgoingAttachments,
      },
      {
        id: currentAssistantId,
        role: "assistant",
        contentMarkdown: "",
        status: "streaming",
        reasoningSummary: "",
        toolTraceSummary: "",
        modelName: activeModelName,
        providerSource: statusPayload.status.source,
        createdAt: nowIso,
        runId: null,
        runMode: null,
        runStatus: "running",
        delegatedTargetUserId: null,
        stepsPreview: [],
        attachments: [],
      },
    ])

    setPrompt("")
    setAttachments([])

    // Create abort controller for stopping generation
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const res = await fetch("/api/ai/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversationId ?? undefined,
          prompt: text,
          attachments: outgoingAttachments,
          modelOverride: activeModelName || undefined,
        }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? dict.ai.sendFailed)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let resolvedConversationId = activeConversationId

      const appendAssistantDelta = (delta: string) => {
        if (!delta) return
        patchAssistantMessage(currentAssistantId, (item) => ({
          ...item,
          contentMarkdown: (item.contentMarkdown ?? "") + delta,
        }))
      }

      // Throttled trace delta buffer — flush every 80ms for smooth UI
      const traceThrottleMs = 80
      let traceFlushTimer: ReturnType<typeof setTimeout> | null = null
      let pendingTraceBuffer: Record<string, { accumulated: string }> = {}
      const flushTraceBuffer = () => {
        const snapshot = pendingTraceBuffer
        pendingTraceBuffer = {}
        traceFlushTimer = null
        for (const [stepId, entry] of Object.entries(snapshot)) {
          if (!entry.accumulated) continue
          // Append the accumulated reasoning delta to the step's summary via upsertStep
          setMessages((prev) =>
            prev.map((m) => {
              const step = m.stepsPreview.find((s) => s.id === stepId)
              if (!step) return m
              return {
                ...m,
                stepsPreview: m.stepsPreview.map((s) =>
                  s.id === stepId ? { ...s, summary: (s.summary ?? "") + entry.accumulated } : s
                ),
              }
            })
          )
        }
      }

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const blocks = buffer.split("\n\n")
        buffer = blocks.pop() ?? ""

        for (const block of blocks) {
          const eventName =
            block
              .split("\n")
              .find((line) => line.startsWith("event: "))
              ?.slice(7) ?? "message"
          const rawData =
            block
              .split("\n")
              .find((line) => line.startsWith("data: "))
              ?.slice(6) ?? "null"
          let payload: Record<string, unknown> | null = null
          try { payload = JSON.parse(rawData) } catch { continue }

          // ── conversation: rename temp message to server id ──
          if (eventName === "conversation") {
            const serverConvId = payload?.conversationId as string | undefined
            const serverMsgId = payload?.assistantMessageId as string | undefined
            if (serverMsgId) {
              patchAssistantMessage(currentAssistantId, (item) => ({
                ...item,
                id: serverMsgId,
                runId: (payload?.runId as string) ?? item.runId,
              }))
              currentAssistantId = serverMsgId
            }
            if (serverConvId) {
              resolvedConversationId = serverConvId
              setActiveConversationId(serverConvId)
            }
            continue
          }

          // ── assistant_delta: the ONLY content delta event ──
          if (eventName === "assistant_delta") {
            appendAssistantDelta((payload?.delta as string) ?? "")
            continue
          }

          // ── token event: ignored — content is already handled by assistant_delta ──
          if (eventName === "token") {
            continue
          }

          // ── reasoning_delta (throttled) ──
          if (eventName === "reasoning_delta") {
            const delta = (payload?.delta as string) ?? ""
            const stepId = (payload?.stepId as string) ?? ""
            if (delta && stepId) {
              pendingTraceBuffer[stepId] = { accumulated: (pendingTraceBuffer[stepId]?.accumulated ?? "") + delta }
              if (!traceFlushTimer) traceFlushTimer = setTimeout(flushTraceBuffer, traceThrottleMs)
            }
            // Also update the message-level reasoning summary (instant, lightweight)
            if (delta) {
              patchAssistantMessage(currentAssistantId, (item) => ({
                ...item,
                reasoningSummary: `${item.reasoningSummary}${delta}`.trim(),
              }))
            }
            continue
          }

          // ── step start events ──
          if (eventName === "reasoning_started" || eventName === "tool_call_started" || eventName === "assistant_started" || eventName === "capability_warning") {
            const derivedType = eventName.startsWith("reasoning") ? "reasoning"
              : eventName.startsWith("tool_call") ? "tool_call"
              : eventName.startsWith("assistant") ? "assistant_output"
              : eventName === "capability_warning" ? "warning"
              : "assistant_output"
            upsertStep(currentAssistantId, {
              id: (payload?.stepId as string) ?? crypto.randomUUID(),
              type: (payload?.type as string) || derivedType,
              title: (payload?.title as string) ?? dict.ai.stepKindPhase,
              status: ((payload?.status as string) === "completed" ? "completed" : (payload?.status as string) === "failed" ? "failed" : "running") as "running" | "completed" | "failed",
              startedAt: (payload?.startedAt as string) ?? new Date().toISOString(),
              finishedAt: (payload?.finishedAt as string) ?? null,
              summary: (payload?.summary as string) ?? "",
              errorMessage: (payload?.errorMessage as string) ?? "",
              inputPreview: payload?.inputPreview,
              outputPreview: payload?.outputPreview,
              providerMetadata: (payload?.providerMetadata as Record<string, unknown>) ?? null,
            })
            continue
          }

          // ── step complete/fail events ──
          if (eventName === "tool_call_completed" || eventName === "tool_call_failed" || eventName === "reasoning_completed" || eventName === "assistant_completed") {
            // Derive type from event name — NEVER default to "tool_call"
            const derivedType = eventName.startsWith("reasoning") ? "reasoning"
              : eventName.startsWith("tool_call") ? "tool_call"
              : eventName.startsWith("assistant") ? "assistant_output"
              : "warning"
            upsertStep(currentAssistantId, {
              id: (payload?.stepId as string) ?? crypto.randomUUID(),
              type: (payload?.type as string) || derivedType,
              title: (payload?.title as string) ?? dict.ai.stepKindPhase,
              status: ((payload?.status as string) === "completed" ? "completed" : (payload?.status as string) === "failed" ? "failed" : eventName.endsWith("failed") ? "failed" : "completed") as "running" | "completed" | "failed",
              startedAt: (payload?.startedAt as string) ?? new Date().toISOString(),
              finishedAt: (payload?.finishedAt as string) ?? new Date().toISOString(),
              summary: (payload?.summary as string) ?? "",
              errorMessage: (payload?.errorMessage as string) ?? "",
              inputPreview: payload?.inputPreview,
              outputPreview: payload?.outputPreview,
              providerMetadata: (payload?.providerMetadata as Record<string, unknown>) ?? null,
            })
            continue
          }

          // ── run_completed ──
          if (eventName === "run_completed") {
            patchAssistantMessage(currentAssistantId, (item) => ({
              ...item,
              status: "completed",
              runStatus: "completed",
              runId: (payload?.runId as string) ?? item.runId,
              modelName: (payload?.model as string) ?? item.modelName,
            }))
            continue
          }

          // ── run_failed ──
          if (eventName === "run_failed") {
            patchAssistantMessage(currentAssistantId, (item) => ({
              ...item,
              status: "failed",
              runStatus: "failed",
              contentMarkdown: item.contentMarkdown || ((payload?.message as string) ?? dict.ai.generateFailedRetry),
            }))
          }
        }
      }

      // Flush any remaining throttled trace deltas
      if (traceFlushTimer) { clearTimeout(traceFlushTimer); flushTraceBuffer() }

      if (resolvedConversationId && resolvedConversationId !== activeConversationId) {
        await loadConversations(resolvedConversationId)
        await loadMessages(resolvedConversationId)
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        // User stopped generation — mark message as completed with current content
        patchAssistantMessage(currentAssistantId, (item) => ({
          ...item,
          status: "completed",
          runStatus: "completed",
        }))
      } else {
        patchAssistantMessage(currentAssistantId, (item) => ({
          ...item,
          status: "failed",
          runStatus: "failed",
          contentMarkdown: error instanceof Error ? error.message : dict.ai.sendFailed,
        }))
        toast.error(error instanceof Error ? error.message : dict.ai.sendFailed)
      }
    } finally {
      abortControllerRef.current = null
      setSending(false)
    }
  }

  const canUseAI = statusPayload?.status.canUseAI ?? false
  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) ?? null,
    [activeConversationId, conversations],
  )
  const isEmptyConversation = messages.length === 0

  const renderComposer = (placement: "empty" | "dock") => {
    const isInlineComposer = placement === "empty"

    return (
      <div
        className={cn(
          "mobile-ai-composer",
          isInlineComposer
            ? "soulwing-empty-composer"
            : "soulwing-docked-composer px-4 pb-[max(1rem,calc(env(safe-area-inset-bottom)+0.5rem))] pt-3 sm:px-7 sm:pb-6",
        )}
      >
        <div className={cn("mx-auto w-full", isInlineComposer ? "max-w-[1160px]" : "max-w-[1480px]")}>
          <input
            ref={attachmentInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={async (event) => {
              const files = Array.from(event.target.files ?? [])
              event.currentTarget.value = ""
              if (files.length === 0) return
              void handleAttachmentFiles(files)
            }}
          />

          {attachments.length > 0 ? (
            <div className="pb-3">
              <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {attachments.map((attachment, index) => (
                  <div
                    key={attachment.id}
                    className="group relative flex h-[104px] w-[104px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#eef2ff] shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={attachment.url} alt="" className="h-full w-full object-cover" />
                    {attachment.status !== "ready" ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 text-xs font-medium text-white">
                        {attachment.status === "uploading" ? (
                          <>
                            <Loader2 size={18} className="mb-2 animate-spin" />
                            上传中
                          </>
                        ) : (
                          <>
                            <TriangleAlert size={18} className="mb-2" />
                            上传失败
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">
                        已就绪
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black text-white shadow-sm transition-transform hover:scale-105"
                      aria-label={dict.ai.removeImage}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {modelMenuOpen ? (
            <div className="fixed inset-0 z-[70] hidden md:block" onClick={() => setModelMenuOpen(false)}>
              <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" />
              <div
                className="absolute left-1/2 w-[min(420px,calc(100vw-48px))] -translate-x-1/2 overflow-hidden rounded-[22px] bg-white shadow-[0_22px_70px_rgba(15,23,42,0.2)]"
                style={{ bottom: isInlineComposer ? 96 : 28 }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="border-b border-gray-100 px-4 py-3 text-center">
                  <p className="text-xs text-gray-400">选择模型</p>
                </div>
                <div className="max-h-[52vh] overflow-y-auto divide-y divide-gray-100 overscroll-contain">
                  {availableModels.length > 0 ? (
                    availableModels.map((model) => (
                      <button
                        key={model}
                        type="button"
                        onClick={() => {
                          selectActiveModel(model)
                          setModelMenuOpen(false)
                        }}
                        className={`flex w-full items-center justify-between px-5 py-[14px] text-left transition-colors ${
                          activeModelName === model
                            ? "font-semibold text-blue-600"
                            : "text-gray-800 hover:bg-gray-50"
                        }`}
                      >
                        <span className="truncate text-[15px] leading-snug">{model}</span>
                        {activeModelName === model ? <CheckCircle2 size={17} className="shrink-0 text-blue-600" /> : null}
                      </button>
                    ))
                  ) : (
                    <p className="px-5 py-6 text-center text-sm text-gray-400">
                      请先在设置中添加模型
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setModelMenuOpen(false)
                      setSettingsOpen(true)
                    }}
                    className="flex w-full items-center justify-center gap-1.5 px-5 py-[14px] text-[15px] text-gray-400 hover:bg-gray-50"
                  >
                    <Settings2 size={14} />
                    管理模型列表
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {actionMenuOpen ? (
            <button
              type="button"
              className="fixed inset-0 z-40 hidden cursor-default bg-transparent md:block"
              onClick={() => setActionMenuOpen(false)}
              aria-label="Close actions"
            />
          ) : null}

          <div className={cn("hidden items-center gap-4 md:flex", isInlineComposer && "justify-center")}>
            <div className="relative z-50 shrink-0">
              <button
                type="button"
                onClick={() => setActionMenuOpen((current) => !current)}
                className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-blue-600 shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-0.5 hover:bg-blue-50 ${actionMenuOpen ? "rotate-45" : ""}`}
                aria-label="打开功能"
                aria-expanded={actionMenuOpen}
              >
                <Plus size={28} strokeWidth={2.1} />
              </button>
            </div>

            {actionMenuOpen ? (
              <div className="relative z-50 flex shrink-0 items-center gap-1.5 rounded-[22px] border border-slate-200 bg-white p-1.5 shadow-[0_12px_30px_rgba(15,23,42,0.12)]">
                <button
                  type="button"
                  onClick={openAttachmentPicker}
                  className="inline-flex h-11 items-center gap-2 rounded-[16px] px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-600"
                >
                  <ImageIcon size={18} />
                  图片上传
                </button>
                <button
                  type="button"
                  onClick={openQuickModelMenu}
                  className="inline-flex h-11 items-center gap-2 rounded-[16px] px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-600"
                >
                  <SlidersHorizontal size={18} />
                  切换模型
                </button>
              </div>
            ) : null}

            <div
              className={cn(
                "flex min-h-14 flex-1 items-end gap-3 rounded-[24px] border border-slate-200 bg-white px-5 py-1 shadow-[0_12px_28px_rgba(15,23,42,0.06)]",
                isInlineComposer && "max-w-[980px] shadow-[0_18px_42px_rgba(37,99,235,0.12)]",
              )}
            >
              <Textarea
                ref={desktopPromptInputRef}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => handleEnterToSubmit(event, () => void sendPrompt(), { disabled: !canSubmitComposer })}
                rows={1}
                placeholder={dict.ai.desktopPlaceholder}
                className="h-auto min-h-10 max-h-[36vh] flex-1 resize-none overflow-hidden !rounded-none !border-0 !bg-transparent px-0 py-1 text-[17px] leading-8 !shadow-none outline-none ring-0 focus-visible:!ring-0 focus-visible:!ring-offset-0"
              />

              {sending ? (
                <button
                  type="button"
                  onClick={stopGeneration}
                  className="ai-send-btn inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500 shadow-[0_10px_24px_rgba(239,68,68,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-600 active:scale-95"
                  aria-label="停止生成"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" className="block shrink-0">
                    <rect x="6" y="6" width="12" height="12" rx="2" fill="#ffffff" />
                  </svg>
                </button>
              ) : canSubmitComposer ? (
                <button
                  type="button"
                  onClick={() => void sendPrompt()}
                  onPointerDown={(event) => submitOnTouchBeforeKeyboardBlur(event, () => void sendPrompt())}
                  className="ai-send-btn inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 active:scale-95"
                  aria-label={dict.ai.sendMessage}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" className="block shrink-0">
                    <line x1="12" y1="19" x2="12" y2="5" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
                    <polyline points="5 12 12 5 19 12" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="ai-send-btn inline-flex h-12 w-12 shrink-0 cursor-not-allowed items-center justify-center rounded-full bg-slate-100 shadow-none"
                  aria-label={dict.ai.sendMessage}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" className="block shrink-0">
                    <line x1="12" y1="19" x2="12" y2="5" stroke="#9A9A9A" strokeWidth="2.4" strokeLinecap="round" />
                    <polyline points="5 12 12 5 19 12" fill="none" stroke="#9A9A9A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className={cn("flex items-end gap-3 md:hidden", isInlineComposer && "soulwing-empty-composer-mobile")}>
            <button
              type="button"
              onClick={() => setActionMenuOpen(true)}
              className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-blue-600 shadow-[0_12px_28px_rgba(15,23,42,0.08)] active:scale-95"
              aria-label="打开功能"
              aria-expanded={actionMenuOpen}
            >
              <Plus size={28} strokeWidth={2.1} />
            </button>

            <div className="flex min-h-14 flex-1 items-end gap-3 rounded-[24px] border border-slate-200 bg-white px-4 py-1 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
              <Textarea
                ref={mobilePromptInputRef}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => handleEnterToSubmit(event, () => void sendPrompt(), { disabled: !canSubmitComposer })}
                rows={1}
                placeholder={dict.ai.mobilePlaceholder}
                className="h-auto min-h-10 max-h-[50vh] flex-1 resize-none overflow-hidden !rounded-none !border-0 !bg-transparent px-0 py-1 text-[16px] leading-8 !shadow-none outline-none ring-0 focus-visible:!ring-0 focus-visible:!ring-offset-0"
              />

              {sending ? (
                <button
                  type="button"
                  onClick={stopGeneration}
                  className="ai-send-btn inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500 shadow-[0_10px_24px_rgba(239,68,68,0.22)] transition-all duration-200 active:scale-95"
                  aria-label="停止生成"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" className="block shrink-0">
                    <rect x="6" y="6" width="12" height="12" rx="2" fill="#ffffff" />
                  </svg>
                </button>
              ) : canSubmitComposer ? (
                <button
                  type="button"
                  onClick={() => void sendPrompt()}
                  onPointerDown={(event) => submitOnTouchBeforeKeyboardBlur(event, () => void sendPrompt())}
                  className="ai-send-btn inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition-all duration-200 active:scale-95"
                  aria-label={dict.ai.sendMessage}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" className="block shrink-0">
                    <line x1="12" y1="19" x2="12" y2="5" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
                    <polyline points="5 12 12 5 19 12" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="ai-send-btn inline-flex h-12 w-12 shrink-0 cursor-not-allowed items-center justify-center rounded-full bg-slate-100 shadow-none"
                  aria-label={dict.ai.sendMessage}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" className="block shrink-0">
                    <line x1="12" y1="19" x2="12" y2="5" stroke="#9A9A9A" strokeWidth="2.4" strokeLinecap="round" />
                    <polyline points="5 12 12 5 19 12" fill="none" stroke="#9A9A9A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="grid h-full min-h-0 grid-cols-1 gap-0 lg:grid-cols-[292px_minmax(0,1fr)] lg:gap-4">
        <aside className="soulwing-conversation-sidebar hidden min-h-0 overflow-hidden rounded-[20px] border border-slate-200/75 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.055)] lg:flex lg:flex-col">
          <div className="soulwing-sidebar-brand">
            <span className="soulwing-sidebar-brand-mark">
              {agentAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={agentAvatarUrl} alt={agentChineseName} className="size-10 rounded-[0.95rem] object-cover" />
              ) : (
                <Image
                  src="/soulwing-butterfly.png"
                  alt={agentChineseName}
                  width={48}
                  height={48}
                  sizes="48px"
                  className="size-10 object-contain"
                  priority
                />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold leading-5 text-slate-950">{agentChineseName}</p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">{agentEnglishName}</p>
            </div>
          </div>

          <button
            type="button"
            className="soulwing-sidebar-new"
            disabled={creatingConversation}
            aria-busy={creatingConversation || undefined}
            onClick={() => void createConversation()}
          >
            {creatingConversation ? <Loader2 size={16} className="animate-spin" /> : <Plus size={18} />}
            <span>{dict.ai.newConversation}</span>
          </button>

          <div className="soulwing-sidebar-list min-h-0 flex-1 overflow-y-auto">
            {conversationGroups.length > 0 ? (
              conversationGroups.map((group) => (
                <section key={group.key} className="soulwing-sidebar-group">
                  <p className={cn("soulwing-sidebar-group-title", `soulwing-sidebar-group-title-${group.key}`)}>{group.label}</p>
                  <div className="space-y-1.5">
                    {group.items.map((conversation) => {
                      const isActive = activeConversationId === conversation.id
                      return (
                        <div key={conversation.id} className={cn("soulwing-sidebar-chat", isActive && "is-active")}>
                          {renamingId === conversation.id ? (
                            <div className="space-y-2">
                              <Textarea
                                rows={2}
                                value={renameValue}
                                onChange={(event) => setRenameValue(event.target.value)}
                                className="min-h-[72px] resize-none rounded-[14px] border-slate-200 bg-white px-3 py-2 shadow-none"
                              />
                              <div className="flex items-center gap-2">
                                <Button size="sm" className="h-8 rounded-full px-4 shadow-none" onClick={() => void renameConversation(conversation.id)}>
                                  {dict.common.save}
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 rounded-full px-4 shadow-none" onClick={() => setRenamingId(null)}>
                                  {dict.common.cancel}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="soulwing-sidebar-chat-main"
                                onClick={() => {
                                  setSidebarUserMenuOpen(false)
                                  void loadMessages(conversation.id)
                                  setActiveConversationId(conversation.id)
                                }}
                              >
                                <span className="flex min-w-0 items-start justify-between gap-3">
                                  <span className="line-clamp-1 min-w-0 text-sm font-semibold leading-5 text-slate-900">{conversation.title}</span>
                                  <span className="shrink-0 text-[11px] font-medium text-slate-400">{formatConversationSidebarTime(conversation.lastMessageAt)}</span>
                                </span>
                                <span className="mt-1 block line-clamp-1 text-xs leading-5 text-slate-500">
                                  {dict.ai.messagesCount(conversation.messageCount)}
                                </span>
                              </button>
                              <div className="soulwing-sidebar-chat-actions">
                                <button
                                  type="button"
                                  className="soulwing-sidebar-icon-button"
                                  aria-label={dict.common.edit}
                                  onClick={() => {
                                    setRenamingId(conversation.id)
                                    setRenameValue(conversation.title)
                                  }}
                                >
                                  <PencilLine size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="soulwing-sidebar-icon-button hover:text-red-600"
                                  disabled={deletingConversationId === conversation.id}
                                  aria-busy={deletingConversationId === conversation.id || undefined}
                                  aria-label={dict.common.delete}
                                  onClick={() => void deleteConversation(conversation.id)}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))
            ) : (
              <div className="soulwing-sidebar-empty">{dict.ai.emptyState}</div>
            )}
          </div>

          <div className="soulwing-sidebar-footer">
            {sidebarUserMenuOpen ? (
              <div className="soulwing-sidebar-account-menu" role="menu">
                <Link href="/ai/soulwing" className="soulwing-sidebar-footer-link">
                  <Settings2 size={16} />
                  <span>{dict.ai.soulwingSettings}</span>
                </Link>
                {canManageAI ? (
                  <Link href="/admin" className="soulwing-sidebar-footer-link">
                    <Shield size={16} />
                    <span>{dict.ai.manageAuth}</span>
                  </Link>
                ) : null}
              </div>
            ) : null}
            <div className="soulwing-sidebar-user">
              <UserAvatar
                name={viewerName}
                email={viewerEmail}
                avatarText={viewer?.avatarText}
                avatarUrl={viewer?.avatarUrl}
                size="sm"
                className="soulwing-sidebar-user-avatar"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-5 text-slate-900">{viewerName}</p>
                <p className="truncate text-xs text-slate-500">{dict.ai.personalVersion}</p>
              </div>
              <button
                type="button"
                className={cn("soulwing-sidebar-user-toggle", sidebarUserMenuOpen && "is-open")}
                aria-label={dict.ai.more}
                aria-expanded={sidebarUserMenuOpen}
                onClick={() => setSidebarUserMenuOpen((current) => !current)}
              >
                <MoreHorizontal size={17} />
              </button>
            </div>
          </div>
        </aside>

        <section className="relative flex min-h-0 flex-col overflow-hidden rounded-none bg-[#f8fbff] md:rounded-[18px] md:border md:border-slate-200/80 md:shadow-[0_18px_44px_rgba(15,23,42,0.055)]">
          <div className="px-3 py-2.5 md:hidden">
            <div className="soulwing-mobile-topbar">
              <button
                type="button"
                className="soulwing-mobile-brand-button"
                onClick={() => setMobilePanel("conversations")}
                aria-label={dict.ai.conversations}
              >
                <span className="soulwing-mobile-brand-mark">
                  {agentAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={agentAvatarUrl} alt={agentChineseName} className="size-8 rounded-[0.8rem] object-cover" />
                  ) : (
                    <Image
                      src="/soulwing-butterfly.png"
                      alt={agentChineseName}
                      width={36}
                      height={36}
                      sizes="36px"
                      className="size-8 object-contain"
                    />
                  )}
                </span>
                <span className="min-w-0 text-left">
                  <span className="block truncate text-sm font-semibold leading-5 text-slate-950">{agentChineseName}</span>
                  <span className="block truncate text-[11px] font-medium leading-4 text-slate-500">{agentEnglishName}</span>
                </span>
              </button>
              <p className="min-w-0 flex-1 truncate px-2 text-center text-sm font-semibold text-slate-700">
                {activeConversation?.title || dict.ai.newConversation}
              </p>
              <button
                type="button"
                className="soulwing-mobile-icon-button"
                onClick={() => setMobilePanel("controls")}
                aria-label={dict.ai.more}
              >
                <MoreHorizontal size={19} />
              </button>
            </div>
          </div>
          <div className="mx-4 h-px bg-[--color-border] md:hidden" />

          <div className="hidden px-5 py-3 md:block">
            <div className="flex items-center justify-between gap-4 rounded-[14px] border border-slate-100 bg-gradient-to-r from-white via-slate-50/80 to-cyan-50/45 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {capabilities ? (
                  <>
                    <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", capabilityTone(capabilities.streamText))}>{dict.ai.streaming}</span>
                    <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", capabilityTone(capabilities.toolCalling))}>{dict.ai.toolCalling}</span>
                    <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", capabilityTone(capabilities.visionInput))}>{dict.ai.imageUnderstanding}</span>
                    <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", capabilityTone(capabilities.reasoningStream))}>{dict.ai.thinkingStream}</span>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    <ThinkingGlyph status="running" size="xs" />
                    {dict.ai.loadingAi}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  {sourceLabel(dict, statusPayload?.status.source ?? "none")}
                </span>
                {providerLabel ? <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">{providerLabel}</span> : null}
                {activeModelName ? <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">{activeModelName}</span> : null}
                <Button variant="ghost" size="sm" className="rounded-full border border-slate-200 bg-white shadow-none hover:bg-blue-50 hover:text-blue-700" onClick={() => setSettingsOpen(true)}>
                  <Settings2 size={14} />
                </Button>
              </div>
            </div>
          </div>
          {/* Soft divider between toolbar and messages */}
          <div className="hidden md:block mx-8 h-px bg-slate-100" />

          <div className={cn("mobile-chat-scroll min-h-0 flex-1 overflow-y-auto", isEmptyConversation ? "soulwing-empty-scroll bg-white" : "bg-[#f8fbff]")}>
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-[--color-text-muted]">
                <Loader2 size={16} className="mr-2 animate-spin" />
                {dict.ai.loadingAi}
              </div>
            ) : (
              <div className={cn(
                "mx-auto flex min-h-full w-full max-w-[1480px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8 md:gap-8 md:py-7",
                isEmptyConversation && canUseAI && "soulwing-empty-canvas max-w-none justify-center gap-0 px-0 py-0 sm:px-0 md:gap-0 md:py-0 lg:px-0",
              )}>
                {!canUseAI ? (
                  <div className="rounded-[18px] border border-amber-100 bg-amber-50/70 p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[--color-warning-bg] text-[--color-warning]">
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[--color-text-primary]">{dict.ai.currentlyUnavailable}</p>
                        <p className="mt-1 text-sm text-[--color-text-secondary]">{statusPayload ? reasonLabel(dict, statusPayload.status.reason) : dict.ai.pleaseTryLater}</p>
                      </div>
                    </div>

                    {statusPayload?.accessRequest ? (
                      <div className="mt-5 rounded-[16px] border border-[color:color-mix(in_srgb,var(--color-warning)_24%,white)] bg-[color:var(--color-bg-surface)] px-4 py-4 text-sm leading-7 text-[--color-text-secondary]">
                        <p className="font-medium text-[--color-text-primary]">{dict.ai.applicationStatus}{statusPayload.accessRequest.status}</p>
                        <p className="mt-2">{statusPayload.accessRequest.message}</p>
                        {statusPayload.accessRequest.reviewNote ? (
                          <p className="mt-2 text-[--color-text-muted]">{dict.ai.reviewNote}{statusPayload.accessRequest.reviewNote}</p>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <Textarea
                        value={requestMessage}
                        onChange={(event) => setRequestMessage(event.target.value)}
                        rows={3}
                        placeholder={dict.ai.requestPlaceholder}
                        className="rounded-[--radius-md] border-[--color-border] bg-[--color-bg-surface] px-4 py-3 shadow-none"
                      />
                      <div className="flex gap-2 sm:flex-col">
                        <Button className="rounded-full px-5 shadow-none" onClick={() => void submitAccessRequest()}>
                          {dict.ai.requestAccess}
                        </Button>
                        <Button variant="outline" className="rounded-full border-[--color-border] bg-[color:var(--color-bg-surface)] px-5 shadow-none hover:bg-[--color-bg-hover]" onClick={() => setSettingsOpen(true)}>
                          {dict.ai.configureApi}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {isEmptyConversation ? (
                  <section
                    className={cn("soulwing-empty-state", inspirationMotion === "settling" && "is-settling")}
                    aria-label={dict.ai.emptyGreeting(viewerName)}
                  >
                    <div className="soulwing-empty-hero">
                      <p className="soulwing-empty-kicker">{dict.ai.emptyGreeting(viewerName)}</p>
                    </div>

                    <SoulwingInspirationMotion
                      featuredSuggestions={featuredSuggestions}
                      secondarySuggestions={secondarySuggestions}
                      suggestionsLoading={suggestionsLoading}
                      isExpanded={showMoreInspirations}
                      motion={inspirationMotion}
                      dict={dict}
                      butterflySrc="/soulwing-butterfly.png"
                      onToggle={toggleInspirationDrawer}
                      onSendSuggestion={(item) => void sendPrompt(item)}
                      composerSlot={renderComposer("empty")}
                    />
                  </section>
                ) : (
                  <div className="flex flex-col gap-8 pb-4">
                    {messages.map((message) =>
                      message.role === "assistant" ? (
                        <AssistantMessageCard key={message.id} message={message} run={runsByMessageId[message.id]} dict={dict} />
                      ) : (
                        <article key={message.id} className="ml-auto max-w-[88%] lg:max-w-[76%]">
                          <div className="rounded-[20px] rounded-tr-md bg-blue-600 px-5 py-4 text-[15px] leading-8 text-white shadow-[0_12px_28px_rgba(37,99,235,0.18)]">
                            <div className="mb-1 text-xs text-blue-100">{formatMessageTime(message.createdAt)}</div>
                            {message.attachments.length > 0 ? (
                              <div className="mb-3 flex flex-wrap gap-3">
                                {message.attachments.map((attachment) => (
                                  <a
                                    key={attachment.id}
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block overflow-hidden rounded-[14px] bg-[color:var(--color-bg-surface)]"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={attachment.url} alt="" className="h-36 w-36 object-cover" />
                                  </a>
                                ))}
                              </div>
                            ) : null}
                            <div className="whitespace-pre-wrap break-words">{message.contentMarkdown}</div>
                          </div>
                        </article>
                      ),
                    )}
                    <div ref={endRef} />
                  </div>
                )}
              </div>
            )}
          </div>

          {!isEmptyConversation ? (
          <div className="mobile-ai-composer soulwing-docked-composer bg-transparent px-4 pb-[max(1rem,calc(env(safe-area-inset-bottom)+0.5rem))] pt-3 sm:px-7 sm:pb-6">
            <div className="mx-auto w-full max-w-[1480px]">
              <input
                ref={attachmentInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={async (event) => {
                  const files = Array.from(event.target.files ?? [])
                  event.currentTarget.value = ""
                  if (files.length === 0) return
                  void handleAttachmentFiles(files)
                }}
              />

              {attachments.length > 0 ? (
                <div className="pb-3">
                  <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {attachments.map((attachment, index) => (
                      <div
                        key={attachment.id}
                        className="group relative flex h-[104px] w-[104px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#eef2ff] shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={attachment.url} alt="" className="h-full w-full object-cover" />
                        {attachment.status !== "ready" ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 text-xs font-medium text-white">
                            {attachment.status === "uploading" ? (
                              <>
                                <Loader2 size={18} className="mb-2 animate-spin" />
                                上传中
                              </>
                            ) : (
                              <>
                                <TriangleAlert size={18} className="mb-2" />
                                上传失败
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">
                            已就绪
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                          className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black text-white shadow-sm transition-transform hover:scale-105"
                          aria-label={dict.ai.removeImage}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {modelMenuOpen ? (
                <div className="fixed inset-0 z-[70] hidden md:block" onClick={() => setModelMenuOpen(false)}>
                  <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" />
                  <div
                    className="absolute left-1/2 w-[min(420px,calc(100vw-48px))] -translate-x-1/2 overflow-hidden rounded-[22px] bg-white shadow-[0_22px_70px_rgba(15,23,42,0.2)]"
                    style={{ bottom: 28 }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="border-b border-gray-100 px-4 py-3 text-center">
                      <p className="text-xs text-gray-400">选择模型</p>
                    </div>
                    <div className="max-h-[52vh] overflow-y-auto divide-y divide-gray-100 overscroll-contain">
                        {availableModels.length > 0 ? (
                          availableModels.map((model) => (
                            <button
                              key={model}
                              type="button"
                              onClick={() => {
                                selectActiveModel(model)
                                setModelMenuOpen(false)
                              }}
                              className={`flex w-full items-center justify-between px-5 py-[14px] text-left transition-colors ${
                                activeModelName === model
                                  ? "font-semibold text-blue-600"
                                  : "text-gray-800 hover:bg-gray-50"
                              }`}
                            >
                              <span className="truncate text-[15px] leading-snug">{model}</span>
                              {activeModelName === model ? <CheckCircle2 size={17} className="shrink-0 text-blue-600" /> : null}
                            </button>
                          ))
                        ) : (
                          <p className="px-5 py-6 text-center text-sm text-gray-400">
                            请先在设置中添加模型
                          </p>
                        )}
                      <button
                        type="button"
                        onClick={() => {
                          setModelMenuOpen(false)
                          setSettingsOpen(true)
                        }}
                        className="flex w-full items-center justify-center gap-1.5 px-5 py-[14px] text-[15px] text-gray-400 hover:bg-gray-50"
                      >
                        <Settings2 size={14} />
                        管理模型列表
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {actionMenuOpen ? (
                <button
                  type="button"
                  className="fixed inset-0 z-40 hidden cursor-default bg-transparent md:block"
                  onClick={() => setActionMenuOpen(false)}
                  aria-label="Close actions"
                />
              ) : null}

              <div className="hidden items-center gap-4 md:flex">
                <div className="relative z-50 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActionMenuOpen((current) => !current)}
                    className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-blue-600 shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-0.5 hover:bg-blue-50 ${actionMenuOpen ? "rotate-45" : ""}`}
                    aria-label="打开功能"
                    aria-expanded={actionMenuOpen}
                  >
                    <Plus size={28} strokeWidth={2.1} />
                  </button>

                </div>

                {actionMenuOpen ? (
                  <div className="relative z-50 flex shrink-0 items-center gap-1.5 rounded-[22px] border border-slate-200 bg-white p-1.5 shadow-[0_12px_30px_rgba(15,23,42,0.12)]">
                    <button
                      type="button"
                      onClick={openAttachmentPicker}
                      className="inline-flex h-11 items-center gap-2 rounded-[16px] px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-600"
                    >
                      <ImageIcon size={18} />
                      图片上传
                    </button>
                    <button
                      type="button"
                      onClick={openQuickModelMenu}
                      className="inline-flex h-11 items-center gap-2 rounded-[16px] px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-600"
                    >
                      <SlidersHorizontal size={18} />
                      切换模型
                    </button>
                  </div>
                ) : null}

                <div className="flex min-h-14 flex-1 items-end gap-3 rounded-[24px] border border-slate-200 bg-white px-5 py-1 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
                  <Textarea
                    ref={desktopPromptInputRef}
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    onKeyDown={(event) => handleEnterToSubmit(event, () => void sendPrompt(), { disabled: !canSubmitComposer })}
                    rows={1}
                    placeholder={dict.ai.desktopPlaceholder}
                    className="h-auto min-h-10 max-h-[36vh] flex-1 resize-none overflow-hidden !rounded-none !border-0 !bg-transparent px-0 py-1 text-[17px] leading-8 !shadow-none outline-none ring-0 focus-visible:!ring-0 focus-visible:!ring-offset-0"
                  />

                  {sending ? (
                    <button
                      type="button"
                      onClick={stopGeneration}
                      className="ai-send-btn inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500 shadow-[0_10px_24px_rgba(239,68,68,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-600 active:scale-95"
                      aria-label="停止生成"
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" className="block shrink-0">
                        <rect x="6" y="6" width="12" height="12" rx="2" fill="#ffffff" />
                      </svg>
                    </button>
                  ) : canSubmitComposer ? (
                    <button
                      type="button"
                      onClick={() => void sendPrompt()}
                      onPointerDown={(event) => submitOnTouchBeforeKeyboardBlur(event, () => void sendPrompt())}
                      className="ai-send-btn inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 active:scale-95"
                      aria-label={dict.ai.sendMessage}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" className="block shrink-0">
                        <line x1="12" y1="19" x2="12" y2="5" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
                        <polyline points="5 12 12 5 19 12" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="ai-send-btn inline-flex h-12 w-12 shrink-0 cursor-not-allowed items-center justify-center rounded-full bg-slate-100 shadow-none"
                      aria-label={dict.ai.sendMessage}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" className="block shrink-0">
                        <line x1="12" y1="19" x2="12" y2="5" stroke="#9A9A9A" strokeWidth="2.4" strokeLinecap="round" />
                        <polyline points="5 12 12 5 19 12" fill="none" stroke="#9A9A9A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-end gap-3 md:hidden">
                <button
                  type="button"
                  onClick={() => setActionMenuOpen(true)}
                  className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-blue-600 shadow-[0_12px_28px_rgba(15,23,42,0.08)] active:scale-95"
                  aria-label="打开功能"
                  aria-expanded={actionMenuOpen}
                >
                  <Plus size={28} strokeWidth={2.1} />
                </button>

                <div className="flex min-h-14 flex-1 items-end gap-3 rounded-[24px] border border-slate-200 bg-white px-4 py-1 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
                  <Textarea
                    ref={mobilePromptInputRef}
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    onKeyDown={(event) => handleEnterToSubmit(event, () => void sendPrompt(), { disabled: !canSubmitComposer })}
                    rows={1}
                    placeholder={dict.ai.mobilePlaceholder}
                    className="h-auto min-h-10 max-h-[50vh] flex-1 resize-none overflow-hidden !rounded-none !border-0 !bg-transparent px-0 py-1 text-[16px] leading-8 !shadow-none outline-none ring-0 focus-visible:!ring-0 focus-visible:!ring-offset-0"
                  />

                  {sending ? (
                    <button
                      type="button"
                      onClick={stopGeneration}
                      className="ai-send-btn inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500 shadow-[0_10px_24px_rgba(239,68,68,0.22)] transition-all duration-200 active:scale-95"
                      aria-label="停止生成"
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" className="block shrink-0">
                        <rect x="6" y="6" width="12" height="12" rx="2" fill="#ffffff" />
                      </svg>
                    </button>
                  ) : canSubmitComposer ? (
                    <button
                      type="button"
                      onClick={() => void sendPrompt()}
                      onPointerDown={(event) => submitOnTouchBeforeKeyboardBlur(event, () => void sendPrompt())}
                      className="ai-send-btn inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition-all duration-200 active:scale-95"
                      aria-label={dict.ai.sendMessage}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" className="block shrink-0">
                        <line x1="12" y1="19" x2="12" y2="5" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
                        <polyline points="5 12 12 5 19 12" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="ai-send-btn inline-flex h-12 w-12 shrink-0 cursor-not-allowed items-center justify-center rounded-full bg-slate-100 shadow-none"
                      aria-label={dict.ai.sendMessage}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" className="block shrink-0">
                        <line x1="12" y1="19" x2="12" y2="5" stroke="#9A9A9A" strokeWidth="2.4" strokeLinecap="round" />
                        <polyline points="5 12 12 5 19 12" fill="none" stroke="#9A9A9A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          ) : null}

          {/* Mobile action menu */}
          {actionMenuOpen ? (
            <div className="fixed inset-0 z-[70] md:hidden" onClick={() => setActionMenuOpen(false)}>
              <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" />
              <div
                className="absolute inset-x-4 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.18)]"
                style={{ bottom: "calc(5.75rem + env(safe-area-inset-bottom, 0px))" }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="px-3 py-3">
                  <button
                    type="button"
                    onClick={openAttachmentPicker}
                    className="flex w-full items-center gap-4 rounded-[18px] px-4 py-4 text-left text-[17px] font-semibold leading-none text-slate-900 active:bg-blue-50"
                  >
                    <ImageIcon size={25} strokeWidth={2.1} />
                    图片上传
                  </button>
                  <button
                    type="button"
                    onClick={openQuickModelMenu}
                    className="flex w-full items-center gap-4 rounded-[18px] px-4 py-4 text-left text-[17px] font-semibold leading-none text-slate-900 active:bg-blue-50"
                  >
                    <SlidersHorizontal size={25} strokeWidth={2.1} />
                    切换模型
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {mobileModelSheetOpen && (
            <div className="fixed inset-0 z-[70] md:hidden" onClick={() => setMobileModelSheetOpen(false)}>
              <div className="absolute inset-0 bg-black/40" />
              {/* Sheet stack: list card + cancel card */}
              <div
                className="absolute inset-x-3 flex flex-col gap-2"
                style={{ bottom: "max(12px, env(safe-area-inset-bottom, 12px))" }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Model list card */}
                <div className="flex flex-col overflow-hidden rounded-[14px] bg-white" style={{ maxHeight: "60vh" }}>
                  <div className="border-b border-gray-100 px-4 py-3 text-center">
                    <p className="text-xs text-gray-400">选择模型</p>
                  </div>
                  <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-gray-100">
                    {availableModels.length > 0 ? (
                      availableModels.map((model) => (
                        <button
                          key={model}
                          type="button"
                          onClick={() => {
                            selectActiveModel(model)
                            setMobileModelSheetOpen(false)
                          }}
                          className="flex w-full items-center justify-between px-5 py-[14px] text-left active:bg-gray-50"
                        >
                          <span className={`text-[15px] leading-snug ${activeModelName === model ? "font-semibold text-blue-600" : "text-gray-800"}`}>
                            {model}
                          </span>
                          {activeModelName === model && <CheckCircle2 size={17} className="shrink-0 text-blue-600" />}
                        </button>
                      ))
                    ) : (
                      <p className="px-5 py-6 text-center text-sm text-gray-400">
                        请先在设置中添加模型
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => { setMobileModelSheetOpen(false); setSettingsOpen(true) }}
                      className="flex w-full items-center justify-center gap-1.5 px-5 py-[14px] text-[15px] text-gray-400 active:bg-gray-50"
                    >
                      <Settings2 size={14} />
                      管理模型列表
                    </button>
                  </div>
                </div>
                {/* Cancel — separate card */}
                <button
                  type="button"
                  onClick={() => setMobileModelSheetOpen(false)}
                  className="w-full rounded-[14px] bg-white py-[17px] text-center text-[17px] font-semibold text-blue-600 active:bg-gray-50"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {mobilePanel ? (
            <>
              <div
                className="soulwing-mobile-panel-backdrop absolute inset-0 z-20 md:hidden"
                onClick={() => setMobilePanel(null)}
              />
              <div
                className={cn(
                  "absolute z-30 flex flex-col md:hidden",
                  mobilePanel === "conversations"
                    ? "soulwing-mobile-sidebar-panel soulwing-conversation-sidebar"
                    : "soulwing-mobile-controls-panel",
                )}
              >
                <div className={cn("flex items-center justify-between", mobilePanel === "conversations" ? "soulwing-mobile-sidebar-header" : "soulwing-mobile-controls-header")}>
                  {mobilePanel === "conversations" ? (
                    <div className="soulwing-sidebar-brand p-0">
                      <span className="soulwing-sidebar-brand-mark">
                        {agentAvatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={agentAvatarUrl} alt={agentChineseName} className="size-10 rounded-[0.95rem] object-cover" />
                        ) : (
                          <Image
                            src="/soulwing-butterfly.png"
                            alt={agentChineseName}
                            width={48}
                            height={48}
                            sizes="48px"
                            className="size-10 object-contain"
                          />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold leading-5 text-slate-950">{agentChineseName}</p>
                        <p className="mt-0.5 text-xs font-medium text-slate-500">{agentEnglishName}</p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{dict.ai.settings}</p>
                      <p className="text-base font-semibold text-slate-950">{dict.ai.chatSettings}</p>
                    </div>
                  )}
                  <button
                    type="button"
                    className="soulwing-mobile-panel-close"
                    onClick={() => setMobilePanel(null)}
                    aria-label={dict.common.close}
                  >
                    <X size={18} />
                  </button>
                </div>

              {mobilePanel === "conversations" ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="hidden">
                    <p className="text-sm text-[--color-text-secondary]">{dict.ai.mobileConversationsHint}</p>
                    <Button size="sm" className="rounded-full px-4 shadow-none" onClick={() => void createConversation()} loading={creatingConversation} loadingText={dict.ai.newChat}>
                      <MessageSquarePlus size={14} />
                      {dict.ai.newChat}
                    </Button>
                  </div>
                  <button
                    type="button"
                    className="soulwing-sidebar-new"
                    disabled={creatingConversation}
                    aria-busy={creatingConversation || undefined}
                    onClick={() => void createConversation()}
                  >
                    {creatingConversation ? <Loader2 size={16} className="animate-spin" /> : <Plus size={18} />}
                    <span>{dict.ai.newConversation}</span>
                  </button>
                  <div className="soulwing-sidebar-list min-h-0 flex-1 overflow-y-auto">
                    {conversationGroups.length > 0 ? (
                      conversationGroups.map((group) => (
                        <section key={group.key} className="soulwing-sidebar-group">
                          <p className={cn("soulwing-sidebar-group-title", `soulwing-sidebar-group-title-${group.key}`)}>{group.label}</p>
                          <div className="space-y-1.5">
                            {group.items.map((conversation) => {
                              const isActive = activeConversationId === conversation.id
                              return (
                                <div key={conversation.id} className={cn("soulwing-sidebar-chat", isActive && "is-active")}>
                                  {renamingId === conversation.id ? (
                                    <div className="space-y-2 p-2">
                                      <Textarea
                                        rows={2}
                                        value={renameValue}
                                        onChange={(event) => setRenameValue(event.target.value)}
                                        className="min-h-[72px] resize-none rounded-[14px] border-slate-200 bg-white px-3 py-2 shadow-none"
                                      />
                                      <div className="flex items-center gap-2">
                                        <Button size="sm" className="h-8 rounded-full px-4 shadow-none" onClick={() => void renameConversation(conversation.id)}>
                                          {dict.common.save}
                                        </Button>
                                        <Button size="sm" variant="outline" className="h-8 rounded-full px-4 shadow-none" onClick={() => setRenamingId(null)}>
                                          {dict.common.cancel}
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        className="soulwing-sidebar-chat-main"
                                        onClick={() => {
                                          setSidebarUserMenuOpen(false)
                                          void loadMessages(conversation.id).then(() => {
                                            setActiveConversationId(conversation.id)
                                            setMobilePanel(null)
                                          })
                                        }}
                                      >
                                        <span className="flex min-w-0 items-start justify-between gap-3">
                                          <span className="line-clamp-1 min-w-0 text-sm font-semibold leading-5 text-slate-900">{conversation.title}</span>
                                          <span className="shrink-0 text-[11px] font-medium text-slate-400">{formatConversationSidebarTime(conversation.lastMessageAt)}</span>
                                        </span>
                                        <span className="mt-1 block line-clamp-1 text-xs leading-5 text-slate-500">
                                          {dict.ai.messagesCount(conversation.messageCount)}
                                        </span>
                                      </button>
                                      <div className="soulwing-sidebar-chat-actions">
                                        <button
                                          type="button"
                                          className="soulwing-sidebar-icon-button"
                                          aria-label={dict.common.edit}
                                          onClick={() => {
                                            setRenamingId(conversation.id)
                                            setRenameValue(conversation.title)
                                          }}
                                        >
                                          <PencilLine size={13} />
                                        </button>
                                        <button
                                          type="button"
                                          className="soulwing-sidebar-icon-button hover:text-red-600"
                                          disabled={deletingConversationId === conversation.id}
                                          aria-busy={deletingConversationId === conversation.id || undefined}
                                          aria-label={dict.common.delete}
                                          onClick={() => void deleteConversation(conversation.id)}
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </section>
                      ))
                    ) : (
                      <div className="soulwing-sidebar-empty">{dict.ai.emptyState}</div>
                    )}
                  </div>
                  <div className="hidden">
                    {conversations.map((conversation) => (
                      <div key={conversation.id} className="flex items-center gap-1">
                        <button
                          type="button"
                          className={`flex-1 rounded-[18px] border px-4 py-3 text-left transition-colors ${activeConversationId === conversation.id ? "border-blue-200 bg-blue-50" : "border-slate-100 bg-white"}`}
                          onClick={() => {
                            void loadMessages(conversation.id).then(() => {
                              setActiveConversationId(conversation.id)
                              setMobilePanel(null)
                            })
                          }}
                        >
                          <p className="line-clamp-2 text-sm font-medium leading-6 text-[--color-text-primary]">{conversation.title}</p>
                          <p className="mt-1 text-xs text-[--color-text-muted]">
                            {formatConversationTime(conversation.lastMessageAt)} · {dict.ai.messagesCount(conversation.messageCount)}
                          </p>
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[--color-text-muted] hover:bg-[--color-bg-hover] hover:text-red-600"
                          disabled={deletingConversationId === conversation.id}
                          aria-busy={deletingConversationId === conversation.id || undefined}
                          onClick={() => void deleteConversation(conversation.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="soulwing-sidebar-footer">
                    {sidebarUserMenuOpen ? (
                      <div className="soulwing-sidebar-account-menu" role="menu">
                        <Link href="/ai/soulwing" className="soulwing-sidebar-footer-link" onClick={() => setMobilePanel(null)}>
                          <Settings2 size={16} />
                          <span>{dict.ai.soulwingSettings}</span>
                        </Link>
                        {canManageAI ? (
                          <Link href="/admin" className="soulwing-sidebar-footer-link" onClick={() => setMobilePanel(null)}>
                            <Shield size={16} />
                            <span>{dict.ai.manageAuth}</span>
                          </Link>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="soulwing-sidebar-user">
                      <UserAvatar
                        name={viewerName}
                        email={viewerEmail}
                        avatarText={viewer?.avatarText}
                        avatarUrl={viewer?.avatarUrl}
                        size="sm"
                        className="soulwing-sidebar-user-avatar"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold leading-5 text-slate-900">{viewerName}</p>
                        <p className="truncate text-xs text-slate-500">{dict.ai.personalVersion}</p>
                      </div>
                      <button
                        type="button"
                        className={cn("soulwing-sidebar-user-toggle", sidebarUserMenuOpen && "is-open")}
                        aria-label={dict.ai.more}
                        aria-expanded={sidebarUserMenuOpen}
                        onClick={() => setSidebarUserMenuOpen((current) => !current)}
                      >
                        <MoreHorizontal size={17} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
                  <div className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.035)]">
                    <p className="text-xs text-[--color-text-muted]">{dict.ai.currentSource}</p>
                    <p className="mt-2 text-sm font-medium text-[--color-text-primary]">
                      {statusPayload ? `${reasonLabel(dict, statusPayload.status.reason)} / ${sourceLabel(dict, statusPayload.status.source)}` : dict.common.loading}
                    </p>
                    {providerLabel ? (
                      <p className="mt-2 text-xs leading-6 text-[--color-text-secondary]">
                        {providerLabel} · {activeModelName || dict.ai.noModelSelected}
                      </p>
                    ) : null}
                  </div>

                  {capabilities ? (
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${capabilityTone(capabilities.streamText)}`}>{dict.ai.streaming}</span>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${capabilityTone(capabilities.toolCalling)}`}>{dict.ai.toolCalling}</span>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${capabilityTone(capabilities.visionInput)}`}>{dict.ai.imageUnderstanding}</span>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${capabilityTone(capabilities.reasoningStream)}`}>{dict.ai.thinkingStream}</span>
                    </div>
                  ) : null}

                  {availableModels.length > 1 ? (
                    <div className="space-y-2">
                      <p className="text-xs text-[--color-text-muted]">{dict.ai.model}</p>
                      <div className="flex flex-wrap gap-2">
                        {availableModels.map((m) => (
                          <button
                            key={m}
                            type="button"
                            className={`rounded-full px-3 py-1.5 text-xs ${m === activeModelName ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
                            onClick={() => { selectActiveModel(m); setMobilePanel(null) }}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <Button
                    variant="outline"
                    className="h-11 justify-center rounded-full border-[--color-border] bg-[color:var(--color-bg-surface)] shadow-none"
                    onClick={() => {
                      setMobilePanel(null)
                      setSettingsOpen(true)
                    }}
                  >
                    <Settings2 size={15} />
                    {dict.ai.openAiSettings}
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="h-11 justify-center rounded-full border-[--color-border] bg-[color:var(--color-bg-surface)] shadow-none"
                  >
                    <Link href="/ai/soulwing">
                      <Sparkles size={15} />
                      {dict.ai.soulwingSettings}
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </>
          ) : null}
        </section>
      </div>

      <AISettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        storageReady={statusPayload?.storageReady ?? false}
        onSaved={() => void loadStatus()}
      />
    </>
  )
}
