"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  Copy,
  Loader2,
  MessageSquarePlus,
  PencilLine,
  Plus,
  Settings2,
  Sparkles,
  TriangleAlert,
  Trash2,
  Wrench,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { AISettingsSheet } from "@/components/ai/ai-settings-sheet"
import { MarkdownContent } from "@/components/markdown-content"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  AI_MODEL_PRESETS_UPDATED_EVENT,
  loadModelCatalog,
  saveModelCatalog,
} from "@/lib/ai/model-presets"

type AIProviderCapabilities = {
  streamText: boolean
  toolCalling: boolean
  visionInput: boolean
  reasoningStream: boolean
}

type ConversationItem = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  lastMessageAt: string
  messageCount: number
}

type AttachmentItem = {
  id: string
  uploadId: string | null
  url: string
  originalName: string
  mimeType: string
  size: number
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
  userConfig: {
    providerLabel: string
    baseUrl: string
    model: string
    temperature: number
    streamEnabled: boolean
    capabilities?: AIProviderCapabilities | null
    isEnabled: boolean
    apiKeyMask: string
    lastTestStatus: string
    lastTestedAt: string | null
  } | null
}

const SUGGESTIONS = [
  "总结我最近一周的求职进展",
  "帮我看看最近和谁聊天最多",
  "帮我汇总最近三天的重要动态",
]

function reasonLabel(reason: string) {
  switch (reason) {
    case "ready":
      return "已可用"
    case "server-secret-missing":
      return "服务端缺少 AI 安全配置"
    case "request-pending":
      return "申请审核中"
    case "request-rejected":
      return "申请已被拒绝"
    case "grant-paused":
      return "管理员授权已暂停"
    case "grant-revoked":
      return "管理员授权已撤销"
    case "configure-personal-api":
      return "请先配置个人 API"
    case "request-access":
      return "请先申请访问权限"
    default:
      return "暂时不可用"
  }
}

function sourceLabel(source: "user" | "grant" | "none") {
  if (source === "user") return "自定义 API"
  if (source === "grant") return "管理员授权"
  return "暂无来源"
}

function modeLabel(mode: MessageItem["runMode"]) {
  if (mode === "admin-delegated") return "管理员代查"
  if (mode === "visible-user") return "可见页读取"
  return "本人数据"
}

function formatConversationTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
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
  if (status === "running" || status === "streaming") return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-emerald-200 bg-emerald-50 text-emerald-700"
}

function capabilityTone(supported: boolean) {
  return supported
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-100 text-slate-500"
}

function stepKindLabel(type: string) {
  switch (type) {
    case "reasoning":
      return "思考"
    case "tool_call":
      return "工具调用"
    case "assistant_output":
      return "最终回答"
    case "warning":
      return "能力提示"
    default:
      return "过程"
  }
}

function stepLeadIcon(type: string, status: string) {
  if (type === "tool_call") return <Wrench size={15} />
  if (type === "warning") return <TriangleAlert size={15} />
  if (status === "completed") return <CheckCircle2 size={15} />
  return <Sparkles size={15} />
}

function toReadableLines(value: string) {
  return value
    .replace(/\\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function extractReasoningNarrative(step: StepPreview) {
  if (step.type !== "reasoning") return []
  const output = step.outputPreview
  if (output && typeof output === "object" && "reasoning" in output) {
    return toReadableLines(String((output as { reasoning?: unknown }).reasoning ?? ""))
  }
  return toReadableLines(step.summary)
}

function formatValueInline(value: unknown): string {
  if (value == null) return "未提供"
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return value.map((item) => formatValueInline(item)).join("、")
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

function buildToolNarrative(step: StepPreview) {
  if (step.type !== "tool_call") return []

  const sections: Array<{ title: string; body: string }> = []
  const input = step.inputPreview && typeof step.inputPreview === "object" ? (step.inputPreview as Record<string, unknown>) : null
  const output = step.outputPreview && typeof step.outputPreview === "object" ? (step.outputPreview as Record<string, unknown>) : null
  const toolName = typeof input?.toolName === "string" ? input.toolName : step.title

  sections.push({
    title: "这一步在做什么",
    body: `系统调用了 ${toolName}，目的是 ${step.summary || "补充当前回答所需的数据"}`,
  })

  const args = input?.arguments
  if (args && typeof args === "object" && !Array.isArray(args) && Object.keys(args).length > 0) {
    sections.push({
      title: "本次传入的信息",
      body: Object.entries(args)
        .map(([key, value]) => `${key}：${formatValueInline(value)}`)
        .join("；"),
    })
  }

  if (output?.result !== undefined) {
    if (isStructuredToolResult(output.result)) {
      sections.push({
        title: "这一步得到了什么",
        body: output.result.summary,
      })

      if (output.result.reason) {
        sections.push({
          title: "为什么是这个结果",
          body: output.result.reason,
        })
      }

      if (output.result.data && typeof output.result.data === "object") {
        sections.push({
          title: "返回的数据摘要",
          body: compactJson(output.result.data),
        })
      }

      return sections
    }

    sections.push({
      title: "工具返回了什么",
      body: typeof output.result === "string" ? output.result : compactJson(output.result),
    })
  } else if (step.errorMessage) {
    sections.push({
      title: "为什么失败了",
      body: step.errorMessage,
    })
  }

  return sections
}

function renderStepDetail(step: StepPreview) {
  if (step.type === "reasoning") {
    const lines = extractReasoningNarrative(step)
    if (lines.length === 0) return null
    return (
      <div className="space-y-3 py-1">
        {lines.map((line, index) => (
          <p key={`${step.id}-reasoning-${index}`} className="text-sm leading-7 text-[--color-text-secondary]">
            {line}
          </p>
        ))}
      </div>
    )
  }

  if (step.type === "tool_call") {
    const sections = buildToolNarrative(step)
    if (sections.length === 0) return null
    return (
      <div className="space-y-3 py-1">
        {sections.map((section, index) => (
          <div key={`${step.id}-tool-${index}`}>
            <p className="text-xs font-medium text-[--color-text-primary]">{section.title}</p>
            <div className="mt-1 whitespace-pre-wrap break-words text-sm leading-7 text-[--color-text-secondary]">
              {section.body}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (step.type === "warning") {
    return <p className="py-1 text-sm leading-7 text-amber-800">{step.summary}</p>
  }

  if (step.type === "assistant_output") {
    return <p className="py-1 text-sm leading-7 text-[--color-text-secondary]">正文已经显示在下方，这里只保留阶段记录。</p>
  }

  const fallback = compactJson(step.outputPreview) || compactJson(step.inputPreview)
  if (!fallback) return null

  return (
    <pre className="overflow-x-auto whitespace-pre-wrap break-words py-1 text-xs leading-6 text-[--color-text-secondary]">
      {fallback}
    </pre>
  )
}

function TraceBlock({ step }: { step: StepPreview }) {
  const detail = renderStepDetail(step)
  return (
    <details className="group rounded-2xl">
      <summary className="flex cursor-pointer list-none items-start gap-3 py-3 marker:hidden">
        <span className={`mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full ${statusChip(step.status)}`}>
          {stepLeadIcon(step.type, step.status)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-[0.16em] text-[--color-text-muted]">{stepKindLabel(step.type)}</span>
            <span className="text-sm font-medium text-[--color-text-primary]">{step.title}</span>
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${statusChip(step.status)}`}>
              {step.status}
            </span>
          </div>
          {step.summary ? <p className="mt-1 line-clamp-2 text-sm text-[--color-text-secondary]">{step.summary}</p> : null}
        </div>
        <span className="text-xs text-[--color-text-muted]">{formatMessageTime(step.startedAt)}</span>
        <ChevronDown size={16} className="shrink-0 text-[--color-text-muted] transition-transform group-open:rotate-180" />
      </summary>

      {detail ? <div className="ml-11 border-l border-[--color-border] pl-5">{detail}</div> : null}
    </details>
  )
}

function TraceSection({ title, steps, defaultOpen = false }: { title: string; steps: StepPreview[]; defaultOpen?: boolean }) {
  if (steps.length === 0) return null

  return (
    <details open={defaultOpen} className="group rounded-2xl">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 marker:hidden">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[--color-text-primary]">{title}</span>
          <span className="rounded-full bg-[--color-bg-hover] px-2.5 py-1 text-[11px] text-[--color-text-muted]">
            {steps.length} 个阶段
          </span>
        </div>
        <ChevronDown size={16} className="shrink-0 text-[--color-text-muted] transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-1">
        {steps.map((step) => (
          <TraceBlock key={step.id} step={step} />
        ))}
      </div>
    </details>
  )
}

function AssistantMessageCard({ message, run }: { message: MessageItem; run?: RunDetail }) {
  const steps = run?.steps?.length ? run.steps : message.stepsPreview
  const warnings = steps.filter((step) => step.type === "warning")
  const reasoningSteps = steps.filter((step) => step.type === "reasoning")
  const toolSteps = steps.filter((step) => step.type === "tool_call")
  const modelName = run?.finalModel || message.modelName

  return (
    <article className="mr-auto w-full max-w-[1180px]">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-semibold text-[--color-text-primary]">AI 助手</span>
        <span className="text-xs text-[--color-text-muted]">{formatMessageTime(message.createdAt)}</span>
        {modelName ? (
          <span className="rounded-full bg-[--color-bg-hover] px-2.5 py-1 text-[11px] text-[--color-text-muted]">{modelName}</span>
        ) : null}
        {message.runMode ? (
          <span className="rounded-full bg-[--color-bg-hover] px-2.5 py-1 text-[11px] text-[--color-text-muted]">{modeLabel(message.runMode)}</span>
        ) : null}
        {message.contentMarkdown ? (
          <button
            type="button"
            className="ml-auto inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs text-[--color-text-muted] transition-colors hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
            onClick={async () => {
              await navigator.clipboard.writeText(message.contentMarkdown)
              toast.success("已复制回答")
            }}
          >
            <Copy size={13} />
            复制
          </button>
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${statusChip(message.runStatus ?? message.status)}`}>
            {message.runStatus ?? message.status}
          </span>
          <span className="inline-flex rounded-full bg-[--color-bg-hover] px-3 py-1 text-xs text-[--color-text-secondary]">
            {reasoningSteps.length > 0 ? `${reasoningSteps.length} 个思考阶段` : "无显式思考阶段"}
          </span>
          <span className="inline-flex rounded-full bg-[--color-bg-hover] px-3 py-1 text-xs text-[--color-text-secondary]">
            {toolSteps.length > 0 ? `${toolSteps.length} 次工具调用` : "未调用工具"}
          </span>
        </div>

        {warnings.length > 0 ? (
          <div className="space-y-2">
            {warnings.map((step) => (
              <div key={step.id} className="rounded-[14px] bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800">
                {step.summary}
              </div>
            ))}
          </div>
        ) : null}

        {(reasoningSteps.length > 0 || toolSteps.length > 0) ? (
          <details className="group rounded-2xl bg-[--color-bg-hover]/60 px-4 py-2">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-2 marker:hidden">
              <div>
                <p className="text-sm font-medium text-[--color-text-primary]">查看执行过程</p>
                <p className="text-xs text-[--color-text-muted]">回答完成后默认收起，需要时再展开思考或工具调用。</p>
              </div>
              <ChevronDown size={16} className="shrink-0 text-[--color-text-muted] transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-1 pt-1">
              <TraceSection title="思考过程" steps={reasoningSteps} defaultOpen={message.status === "streaming"} />
              <TraceSection title="工具调用过程" steps={toolSteps} />
            </div>
          </details>
        ) : null}

        {message.contentMarkdown ? (
          <div className="ai-response">
            <MarkdownContent source={message.contentMarkdown} />
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-full bg-[--color-bg-hover] px-4 py-2 text-sm text-[--color-text-muted]">
            <Loader2 size={14} className="animate-spin" />
            正在思考并生成回答...
          </div>
        )}
      </div>
    </article>
  )
}

export function AIAssistantClient() {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [runsByMessageId, setRunsByMessageId] = useState<Record<string, RunDetail>>({})
  const [statusPayload, setStatusPayload] = useState<AIStatusResponse | null>(null)
  const [prompt, setPrompt] = useState("")
  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
  const [requestMessage, setRequestMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState("")
  const [mobilePanel, setMobilePanel] = useState<"conversations" | "controls" | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const messageSeedRef = useRef(0)
  const endRef = useRef<HTMLDivElement | null>(null)
  const attachmentInputRef = useRef<HTMLInputElement | null>(null)
  const desktopPromptInputRef = useRef<HTMLTextAreaElement | null>(null)
  const mobilePromptInputRef = useRef<HTMLTextAreaElement | null>(null)

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
    if (!res.ok) throw new Error(data?.error ?? "加载 AI 状态失败")
    setStatusPayload(data)
  }

  async function loadConversations(preferredId?: string | null) {
    const res = await fetch("/api/ai/conversations", { cache: "no-store" })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error ?? "加载会话失败")
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
    if (!res.ok) throw new Error(data?.error ?? "加载消息失败")

    const items: MessageItem[] = Array.isArray(data?.items) ? data.items : []
    setMessages(items)

    const assistants = items.filter((item) => item.role === "assistant" && item.runId)
    await Promise.all(assistants.map((item) => loadRun(item.id)))
  }

  async function bootstrap() {
    setLoading(true)
    try {
      await loadStatus()
      const conversationId = await loadConversations()
      await loadMessages(conversationId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载 AI 助手失败")
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
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
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
    try {
      const res = await fetch("/api/ai/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "新对话" }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "创建会话失败")
      await loadConversations(data?.id ?? null)
      setMessages([])
      setRunsByMessageId({})
      setMobilePanel(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建会话失败")
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
      if (!res.ok) throw new Error(data?.error ?? "重命名失败")
      setRenamingId(null)
      setRenameValue("")
      await loadConversations(id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "重命名失败")
    }
  }

  async function deleteConversation(id: string) {
    try {
      const res = await fetch(`/api/ai/conversations/${id}`, { method: "DELETE" })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "删除会话失败")
      const nextId = conversations.find((item) => item.id !== id)?.id ?? null
      await loadConversations(nextId)
      await loadMessages(nextId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除会话失败")
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
      if (!res.ok) throw new Error(data?.error ?? "提交申请失败")
      toast.success("已提交 AI 使用申请")
      setRequestMessage("")
      await loadStatus()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "提交申请失败")
    }
  }

  async function uploadAttachment(file: File) {
    const form = new FormData()
    form.set("file", file)
    const response = await fetch("/api/upload", { method: "POST", body: form })
    const data = await response.json().catch(() => null)
    if (!response.ok) throw new Error(data?.error ?? "图片上传失败")
    return {
      id: data?.id ?? crypto.randomUUID(),
      uploadId: data?.id ?? null,
      url: data?.url ?? "",
      originalName: data?.originalName ?? file.name,
      mimeType: file.type,
      size: file.size,
    }
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

  useEffect(() => {
    const syncModelCatalog = () => {
      const catalog = loadModelCatalog(providerLabel, activeBaseUrl, configuredModelName)
      setAvailableModels(catalog.models)
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
  }, [activeBaseUrl, configuredModelName, providerLabel])

  async function sendPrompt(nextPrompt?: string) {
    const text = (nextPrompt ?? prompt).trim()
    if ((!text && attachments.length === 0) || sending) return

    if (!statusPayload?.status.canUseAI) {
      toast.error("当前没有可用的 AI 来源，请先配置个人 API 或提交申请。")
      return
    }

    setSending(true)
    messageSeedRef.current += 1
    const optimisticUserId = `local-user-${messageSeedRef.current}`
    messageSeedRef.current += 1
    let currentAssistantId = `local-assistant-${messageSeedRef.current}`
    const nowIso = new Date().toISOString()
    const outgoingAttachments = attachments

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
      })

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? "发送失败")
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let resolvedConversationId = activeConversationId

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
          const payload = JSON.parse(rawData)

          if (eventName === "conversation") {
            resolvedConversationId = payload?.conversationId ?? resolvedConversationId
            currentAssistantId = payload?.assistantMessageId ?? currentAssistantId
            patchAssistantMessage(currentAssistantId, (item) => ({
              ...item,
              id: payload?.assistantMessageId ?? item.id,
              runId: payload?.runId ?? item.runId,
            }))
            if (resolvedConversationId) setActiveConversationId(resolvedConversationId)
            continue
          }

          if (eventName === "reasoning_started" || eventName === "tool_call_started" || eventName === "assistant_started" || eventName === "capability_warning") {
            upsertStep(currentAssistantId, {
              id: payload?.stepId ?? crypto.randomUUID(),
              type:
                payload?.type ??
                (eventName.startsWith("reasoning") ? "reasoning" :
                eventName.startsWith("tool_call") ? "tool_call" :
                eventName === "capability_warning" ? "warning" : "assistant_output"),
              title: payload?.title ?? "执行阶段",
              status: payload?.status ?? "running",
              startedAt: payload?.startedAt ?? new Date().toISOString(),
              finishedAt: payload?.finishedAt ?? null,
              summary: payload?.summary ?? "",
              errorMessage: payload?.errorMessage ?? "",
              inputPreview: payload?.inputPreview,
              outputPreview: payload?.outputPreview,
              providerMetadata: payload?.providerMetadata ?? null,
            })
            continue
          }

          if (eventName === "reasoning_delta") {
            patchAssistantMessage(currentAssistantId, (item) => ({
              ...item,
              reasoningSummary: `${item.reasoningSummary}${payload?.delta ?? ""}`.trim(),
            }))
            continue
          }

          if (eventName === "assistant_delta") {
            patchAssistantMessage(currentAssistantId, (item) => ({
              ...item,
              contentMarkdown: `${item.contentMarkdown}${payload?.delta ?? ""}`,
            }))
            continue
          }

          if (eventName === "tool_call_completed" || eventName === "tool_call_failed" || eventName === "reasoning_completed" || eventName === "assistant_completed") {
            upsertStep(currentAssistantId, {
              id: payload?.stepId ?? crypto.randomUUID(),
              type: payload?.type ?? "tool_call",
              title: payload?.title ?? "执行阶段",
              status: payload?.status ?? (eventName.endsWith("failed") ? "failed" : "completed"),
              startedAt: payload?.startedAt ?? new Date().toISOString(),
              finishedAt: payload?.finishedAt ?? new Date().toISOString(),
              summary: payload?.summary ?? "",
              errorMessage: payload?.errorMessage ?? "",
              inputPreview: payload?.inputPreview,
              outputPreview: payload?.outputPreview,
              providerMetadata: payload?.providerMetadata ?? null,
            })
            continue
          }

          if (eventName === "run_completed") {
            patchAssistantMessage(currentAssistantId, (item) => ({
              ...item,
              id: payload?.assistantMessageId ?? item.id,
              status: "completed",
              runStatus: "completed",
              runId: payload?.runId ?? item.runId,
              modelName: payload?.model ?? item.modelName,
            }))
            continue
          }

          if (eventName === "run_failed") {
            patchAssistantMessage(currentAssistantId, (item) => ({
              ...item,
              status: "failed",
              runStatus: "failed",
              contentMarkdown: item.contentMarkdown || (payload?.message ?? "生成失败，请稍后重试。"),
            }))
          }
        }
      }

      await loadConversations(resolvedConversationId)
      if (resolvedConversationId) await loadMessages(resolvedConversationId)
    } catch (error) {
      patchAssistantMessage(currentAssistantId, (item) => ({
        ...item,
        status: "failed",
        runStatus: "failed",
        contentMarkdown: error instanceof Error ? error.message : "发送失败",
      }))
      toast.error(error instanceof Error ? error.message : "发送失败")
    } finally {
      setSending(false)
    }
  }

  const canUseAI = statusPayload?.status.canUseAI ?? false
  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) ?? null,
    [activeConversationId, conversations],
  )

  return (
    <>
      <div className="grid h-full min-h-0 grid-cols-1 gap-0 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-6">
        <aside className="hidden min-h-0 rounded-[28px] bg-[color:var(--color-bg-surface)] p-4 shadow-[0_16px_34px_rgba(34,27,20,0.05)] lg:flex lg:flex-col">
          <div className="flex items-center justify-between gap-3 px-1 pb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[--color-text-muted]">Conversations</p>
              <p className="mt-1 text-lg font-semibold text-[--color-text-primary]">AI 助手</p>
            </div>
            <Button size="sm" className="rounded-full px-4 shadow-none" onClick={() => void createConversation()}>
              <MessageSquarePlus size={14} />
              新建
            </Button>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`rounded-[20px] px-4 py-3 transition-colors ${activeConversationId === conversation.id ? "bg-[--color-bg-hover]" : "bg-transparent hover:bg-[--color-bg-hover]"}`}
              >
                {renamingId === conversation.id ? (
                  <div className="space-y-2">
                    <Textarea
                      rows={2}
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      className="min-h-[72px] resize-none rounded-[16px] border-[--color-border] bg-[color:var(--color-bg-surface)] px-3 py-2 shadow-none"
                    />
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="rounded-full px-4 shadow-none" onClick={() => void renameConversation(conversation.id)}>
                        保存
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-full px-4 shadow-none" onClick={() => setRenamingId(null)}>
                        取消
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      void loadMessages(conversation.id)
                      setActiveConversationId(conversation.id)
                    }}
                  >
                    <p className="line-clamp-2 text-sm font-medium leading-6 text-[--color-text-primary]">{conversation.title}</p>
                    <p className="mt-1 text-xs text-[--color-text-muted]">
                      {formatConversationTime(conversation.lastMessageAt)} · {conversation.messageCount} 条消息
                    </p>
                  </button>
                )}

                {renamingId !== conversation.id ? (
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[--color-text-muted] transition-colors hover:bg-[color:var(--color-bg-surface)] hover:text-[--color-text-primary]"
                      onClick={() => {
                        setRenamingId(conversation.id)
                        setRenameValue(conversation.title)
                      }}
                    >
                      <PencilLine size={14} />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[--color-text-muted] transition-colors hover:bg-[color:var(--color-bg-surface)] hover:text-red-600"
                      onClick={() => void deleteConversation(conversation.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </aside>

        <section className="relative flex min-h-0 flex-col overflow-hidden rounded-none bg-transparent md:rounded-[28px] md:bg-[color:var(--color-bg-surface)] md:shadow-[0_16px_34px_rgba(34,27,20,0.05)]">
          <div className="border-b border-[--color-border] px-4 py-4 md:hidden">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-[--color-border] bg-[color:var(--color-bg-surface)] px-4 text-sm text-[--color-text-primary]"
                onClick={() => setMobilePanel("conversations")}
              >
                会话
              </button>
              <p className="truncate text-base font-semibold text-[--color-text-primary]">{activeConversation?.title || "AI 助手"}</p>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-[--color-border] bg-[color:var(--color-bg-surface)] px-4 text-sm text-[--color-text-primary]"
                onClick={() => setMobilePanel("controls")}
              >
                更多
              </button>
            </div>
          </div>

          <div className="hidden border-b border-[--color-border] px-8 py-4 md:block">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 max-w-3xl [&>h2]:hidden [&>p:last-child]:hidden">
                <p className="truncate text-sm leading-7 text-[--color-text-secondary]">Agent Runtime: stream output, tool traces, and image understanding stay in one conversation view.</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[--color-text-primary]">更接近 Codex 的执行视图</h2>
                <p className="mt-3 max-w-3xl text-base leading-8 text-[--color-text-secondary]">
                  支持流式正文、工具调用轨迹、多图输入和 provider 能力降级提示。
                </p>
              </div>
              <div className="flex items-center gap-2">
                {providerLabel ? <span className="rounded-full border border-[--color-border] px-4 py-2 text-sm text-[--color-text-primary]">{providerLabel}</span> : null}
                {activeModelName ? <span className="rounded-full border border-[--color-border] px-4 py-2 text-sm text-[--color-text-primary]">{activeModelName}</span> : null}
                <Button variant="outline" className="rounded-full border-[--color-border] bg-[color:var(--color-bg-surface)] px-4 shadow-none hover:bg-[--color-bg-hover]" onClick={() => setSettingsOpen(true)}>
                  <Settings2 size={14} />
                  设置
                </Button>
              </div>
            </div>

            {capabilities ? (
              <div className="mt-4 hidden flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${capabilityTone(capabilities.streamText)}`}>流式</span>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${capabilityTone(capabilities.toolCalling)}`}>工具调用</span>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${capabilityTone(capabilities.visionInput)}`}>图片理解</span>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${capabilityTone(capabilities.reasoningStream)}`}>思考流</span>
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-[--color-text-muted]">
                <Loader2 size={16} className="mr-2 animate-spin" />
                正在加载 AI 助手...
              </div>
            ) : (
              <div className="mx-auto flex min-h-full w-full max-w-[1480px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8 md:gap-8 md:py-7">
                {!canUseAI ? (
                  <div className="rounded-[20px] border border-[color:color-mix(in_srgb,var(--color-warning)_24%,white)] bg-[linear-gradient(180deg,#fffdf7_0%,#fbf5ea_100%)] p-6 shadow-[0_16px_36px_rgba(184,144,45,0.08)]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[--color-warning-bg] text-[--color-warning]">
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[--color-text-primary]">当前还不能直接提问</p>
                        <p className="mt-1 text-sm text-[--color-text-secondary]">{statusPayload ? reasonLabel(statusPayload.status.reason) : "请稍后再试"}</p>
                      </div>
                    </div>

                    {statusPayload?.accessRequest ? (
                      <div className="mt-5 rounded-[16px] border border-[color:color-mix(in_srgb,var(--color-warning)_24%,white)] bg-[color:var(--color-bg-surface)] px-4 py-4 text-sm leading-7 text-[--color-text-secondary]">
                        <p className="font-medium text-[--color-text-primary]">最近一次申请：{statusPayload.accessRequest.status}</p>
                        <p className="mt-2">{statusPayload.accessRequest.message}</p>
                        {statusPayload.accessRequest.reviewNote ? (
                          <p className="mt-2 text-[--color-text-muted]">审核备注：{statusPayload.accessRequest.reviewNote}</p>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <Textarea
                        value={requestMessage}
                        onChange={(event) => setRequestMessage(event.target.value)}
                        rows={3}
                        placeholder="简单说明你的使用场景。"
                        className="rounded-[16px] border-[color:color-mix(in_srgb,var(--color-warning)_24%,white)] bg-[color:var(--color-bg-surface)] px-4 py-3 shadow-none"
                      />
                      <div className="flex gap-2 sm:flex-col">
                        <Button className="rounded-full px-5 shadow-none" onClick={() => void submitAccessRequest()}>
                          提交申请
                        </Button>
                        <Button variant="outline" className="rounded-full border-[--color-border] bg-[color:var(--color-bg-surface)] px-5 shadow-none hover:bg-[--color-bg-hover]" onClick={() => setSettingsOpen(true)}>
                          配置 API
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {messages.length === 0 ? (
                  <div className="flex flex-col gap-6 py-4">
                    <div className="max-w-4xl">
                      <p className="text-sm font-medium uppercase tracking-[0.22em] text-[--color-text-muted]">New Conversation</p>
                      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[--color-text-primary] sm:text-4xl">让 AI 助手更自然地接入你的站内工作流</h2>
                      <p className="mt-4 max-w-2xl text-base leading-8 text-[--color-text-secondary]">
                        这里会保留会话记录，并按你的权限读取可访问的数据。新的执行视图会把思考、工具调用和最终回答分开呈现。
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      {SUGGESTIONS.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => void sendPrompt(item)}
                          className="group rounded-[18px] bg-[color:var(--color-bg-surface)] px-4 py-4 text-left transition-all hover:-translate-y-0.5 hover:bg-[--color-bg-hover]"
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-[12px] bg-[color:color-mix(in_srgb,var(--color-accent)_12%,white)] text-[--color-accent]">
                              <Sparkles size={16} />
                            </div>
                            <div>
                              <p className="text-sm font-medium leading-7 text-[--color-text-primary]">{item}</p>
                              <p className="mt-1 text-xs text-[--color-text-muted] group-hover:text-[--color-text-secondary]">点击直接发送</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-8 pb-4">
                    {messages.map((message) =>
                      message.role === "assistant" ? (
                        <AssistantMessageCard key={message.id} message={message} run={runsByMessageId[message.id]} />
                      ) : (
                        <article key={message.id} className="ml-auto max-w-[88%] lg:max-w-[76%]">
                          <div className="rounded-[18px] bg-[linear-gradient(180deg,#fbf5ef_0%,#f7efe7_100%)] px-5 py-4 text-[15px] leading-8 text-[--color-text-primary] shadow-[0_10px_24px_rgba(201,100,66,0.08)]">
                            <div className="mb-1 text-xs text-[--color-text-muted]">{formatMessageTime(message.createdAt)}</div>
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

          <div className="bg-[linear-gradient(180deg,rgba(250,247,240,0)_0%,rgba(255,255,255,0.88)_28%)] px-4 pb-[max(1rem,calc(env(safe-area-inset-bottom)+0.5rem))] pt-3 backdrop-blur sm:px-7 sm:pb-6 sm:pt-4">
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
                  try {
                    const uploaded = await Promise.all(files.map((file) => uploadAttachment(file)))
                    setAttachments((current) => [...current, ...uploaded])
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "图片上传失败")
                  }
                }}
              />

              <div className="hidden flex-wrap items-center gap-2 px-1 pb-3 md:flex">
                <span className="inline-flex rounded-full bg-[--color-bg-hover] px-3 py-1 text-xs text-[--color-text-secondary]">
                  {sourceLabel(statusPayload?.status.source ?? "none")}
                </span>
                {providerLabel ? (
                  <span className="inline-flex rounded-full bg-[--color-bg-hover] px-3 py-1 text-xs text-[--color-text-secondary]">
                    {providerLabel}
                  </span>
                ) : null}
                {activeModelName ? (
                  <span className="inline-flex rounded-full bg-[--color-bg-hover] px-3 py-1 text-xs text-[--color-text-secondary]">
                    {activeModelName}
                  </span>
                ) : null}
              </div>

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
                        <button
                          type="button"
                          onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                          className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black text-white shadow-sm transition-transform hover:scale-105"
                          aria-label="移除图片"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {modelMenuOpen ? (
                <div className="mb-3 hidden md:flex md:justify-end">
                  <div className="w-[320px] rounded-[22px] border border-[--color-border] bg-[color:var(--color-bg-surface)] p-3 shadow-[0_18px_36px_rgba(34,27,20,0.1)]">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-[--color-text-primary]">Model switch</p>
                        <p className="mt-1 text-xs leading-6 text-[--color-text-muted]">
                          Switch the current model for this provider without reopening the whole settings form.
                        </p>
                      </div>
                      <div className="max-h-64 space-y-2 overflow-y-auto">
                        {availableModels.length > 0 ? (
                          availableModels.map((model) => (
                            <button
                              key={model}
                              type="button"
                              onClick={() => {
                                setSelectedModel(model)
                                saveModelCatalog(providerLabel, activeBaseUrl, availableModels, model)
                                setModelMenuOpen(false)
                              }}
                              className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm transition-colors ${
                                activeModelName === model
                                  ? "bg-[--color-bg-hover] text-[--color-text-primary]"
                                  : "text-[--color-text-secondary] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
                              }`}
                            >
                              <span className="truncate">{model}</span>
                              {activeModelName === model ? <CheckCircle2 size={14} className="shrink-0" /> : null}
                            </button>
                          ))
                        ) : (
                          <p className="rounded-2xl bg-[--color-bg-hover] px-3 py-3 text-sm text-[--color-text-muted]">
                            Add more models in settings first, then they will appear here for quick switching.
                          </p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        className="w-full rounded-full border-[--color-border] bg-[color:var(--color-bg-surface)] shadow-none hover:bg-[--color-bg-hover]"
                        onClick={() => {
                          setModelMenuOpen(false)
                          setSettingsOpen(true)
                        }}
                      >
                        <Settings2 size={14} />
                        Manage model list
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="hidden items-end gap-3 md:flex">
                <button
                  type="button"
                  onClick={() => attachmentInputRef.current?.click()}
                  className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-bg-surface)] text-[--color-text-primary] shadow-[0_16px_34px_rgba(34,27,20,0.08)] transition-transform hover:-translate-y-0.5"
                  aria-label="上传图片"
                >
                  <Plus size={28} strokeWidth={2.1} />
                </button>

                <div className="flex min-h-16 flex-1 items-end gap-3 rounded-full bg-[color:var(--color-bg-surface)] px-6 py-3 shadow-[0_18px_36px_rgba(34,27,20,0.08)]">
                  <Textarea
                    ref={desktopPromptInputRef}
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    rows={1}
                    placeholder="输入你的问题，例如总结近况、查看聊天、搜索消息，或结合多张图片进行分析。"
                    className="min-h-[42px] max-h-[36vh] flex-1 resize-none overflow-hidden !rounded-none !border-0 !bg-transparent px-0 py-[3px] text-[18px] leading-8 !shadow-none outline-none ring-0 focus-visible:!ring-0 focus-visible:!ring-offset-0"
                  />

                  <button
                    type="button"
                    onClick={() => setModelMenuOpen((current) => !current)}
                    className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-3 text-sm text-[--color-text-secondary] transition-colors hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
                  >
                    进阶
                    <ChevronDown size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => void sendPrompt()}
                    disabled={sending || (!prompt.trim() && attachments.length === 0)}
                    className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-black text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-black/40"
                    aria-label={sending ? "生成中" : "发送消息"}
                  >
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={22} strokeWidth={2.4} />}
                  </button>
                </div>
              </div>

              <div className="flex items-end gap-3 md:hidden">
                <button
                  type="button"
                  onClick={() => attachmentInputRef.current?.click()}
                  className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-bg-surface)] text-[--color-text-primary] shadow-[0_18px_36px_rgba(34,27,20,0.08)]"
                  aria-label="上传图片"
                >
                  <Plus size={30} strokeWidth={2.1} />
                </button>

                <div className="flex min-h-16 flex-1 items-end gap-3 rounded-[28px] bg-[color:var(--color-bg-surface)] px-5 py-3 shadow-[0_18px_36px_rgba(34,27,20,0.08)]">
                  <Textarea
                    ref={mobilePromptInputRef}
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    rows={1}
                    placeholder="输入问题"
                    className="min-h-[42px] max-h-[50vh] flex-1 resize-none overflow-hidden !rounded-none !border-0 !bg-transparent px-0 py-[3px] text-[16px] leading-8 !shadow-none outline-none ring-0 focus-visible:!ring-0 focus-visible:!ring-offset-0"
                  />

                  <button
                    type="button"
                    onClick={() => void sendPrompt()}
                    disabled={sending || (!prompt.trim() && attachments.length === 0)}
                    className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-black text-white disabled:cursor-not-allowed disabled:bg-black/40"
                    aria-label={sending ? "生成中" : "发送消息"}
                  >
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={22} strokeWidth={2.4} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {mobilePanel ? (
            <div className="absolute inset-0 z-20 flex flex-col bg-[color:var(--color-bg-surface)] md:hidden">
              <div className="flex items-center justify-between border-b border-[--color-border] px-4 py-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-[--color-text-muted]">
                    {mobilePanel === "conversations" ? "Conversations" : "Controls"}
                  </p>
                  <p className="text-base font-semibold text-[--color-text-primary]">
                    {mobilePanel === "conversations" ? "切换会话" : "聊天设置"}
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[--color-border] text-[--color-text-secondary]"
                  onClick={() => setMobilePanel(null)}
                >
                  <X size={18} />
                </button>
              </div>

              {mobilePanel === "conversations" ? (
                <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-sm text-[--color-text-secondary]">手机端把会话列表收进这里，聊天主界面保持更干净。</p>
                    <Button size="sm" className="rounded-full px-4 shadow-none" onClick={() => void createConversation()}>
                      <MessageSquarePlus size={14} />
                      新建
                    </Button>
                  </div>
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                    {conversations.map((conversation) => (
                      <button
                        key={conversation.id}
                        type="button"
                        className={`w-full rounded-[18px] px-4 py-3 text-left transition-colors ${activeConversationId === conversation.id ? "bg-[--color-bg-hover]" : "bg-[color:var(--color-bg-surface)]"}`}
                        onClick={() => {
                          void loadMessages(conversation.id).then(() => {
                            setActiveConversationId(conversation.id)
                            setMobilePanel(null)
                          })
                        }}
                      >
                        <p className="line-clamp-2 text-sm font-medium leading-6 text-[--color-text-primary]">{conversation.title}</p>
                        <p className="mt-1 text-xs text-[--color-text-muted]">
                          {formatConversationTime(conversation.lastMessageAt)} · {conversation.messageCount} 条消息
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
                  <div className="rounded-[18px] bg-[--color-bg-hover] p-4">
                    <p className="text-xs text-[--color-text-muted]">当前来源</p>
                    <p className="mt-2 text-sm font-medium text-[--color-text-primary]">
                      {statusPayload ? `${reasonLabel(statusPayload.status.reason)} / ${sourceLabel(statusPayload.status.source)}` : "正在加载..."}
                    </p>
                    {providerLabel ? (
                      <p className="mt-2 text-xs leading-6 text-[--color-text-secondary]">
                        {providerLabel} · {activeModelName || "未选择模型"}
                      </p>
                    ) : null}
                  </div>

                  {capabilities ? (
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${capabilityTone(capabilities.streamText)}`}>流式</span>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${capabilityTone(capabilities.toolCalling)}`}>工具调用</span>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${capabilityTone(capabilities.visionInput)}`}>图片理解</span>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${capabilityTone(capabilities.reasoningStream)}`}>思考流</span>
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
                    打开 AI 设置
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </section>
      </div>

      <AISettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        status={statusPayload ? { storageReady: statusPayload.storageReady, userConfig: statusPayload.userConfig } : null}
        onSaved={() => void loadStatus()}
      />
    </>
  )
}
