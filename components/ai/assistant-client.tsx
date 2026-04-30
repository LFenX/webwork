"use client"

import { type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  CheckCircle2,
  ChevronDown,
  Copy,
  ImageIcon,
  Loader2,
  MessageSquarePlus,
  PencilLine,
  Plus,
  Settings2,
  SlidersHorizontal,
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
import { confirmAction, copyTextWithToast } from "@/lib/interaction-feedback"
import {
  AI_MODEL_PRESETS_UPDATED_EVENT,
  loadModelCatalog,
  saveModelCatalog,
} from "@/lib/ai/model-presets"
import { getDict, type Dictionary } from "@/lib/i18n"
import { handleEnterToSubmit } from "@/lib/keyboard"

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

const SUGGESTIONS = [
  "总结我最近一周的求职进展",
  "帮我看看最近和谁聊天最多",
  "帮我汇总最近三天的重要动态",
]

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
  if (status === "failed") return "bg-red-50 text-red-700"
  if (status === "running" || status === "streaming") return "bg-blue-50 text-blue-700"
  return "bg-emerald-50 text-emerald-700"
}

function capabilityTone(supported: boolean) {
  return supported
    ? "bg-emerald-50 text-emerald-700"
    : "bg-[--color-bg-hover] text-[--color-text-muted]"
}

function stepKindLabel(dict: Dictionary, type: string) {
  switch (type) {
    case "reasoning":
      return dict.ai.thinking
    case "tool_call":
      return dict.ai.toolCalling
    case "assistant_output":
      return dict.ai.stepKindFinalAnswer
    case "warning":
      return dict.ai.stepKindWarning
    default:
      return dict.ai.stepKindGeneric
  }
}

function stepLeadIcon(type: string, status: string) {
  if (type === "tool_call") return <Wrench size={15} />
  if (type === "warning") return <TriangleAlert size={15} />
  if (status === "running" || status === "streaming") return <Loader2 size={15} className="animate-spin" />
  if (status === "completed") return <CheckCircle2 size={15} />
  if (status === "failed") return <TriangleAlert size={15} />
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

function renderStepDetail(dict: Dictionary, step: StepPreview) {
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
    const sections = buildToolNarrative(dict, step)
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
    return <p className="py-1 text-sm leading-7 text-[--color-text-secondary]">{dict.ai.stepFallbackNote}</p>
  }

  const fallback = compactJson(step.outputPreview) || compactJson(step.inputPreview)
  if (!fallback) return null

  return (
    <pre className="overflow-x-auto whitespace-pre-wrap break-words py-1 text-xs leading-6 text-[--color-text-secondary]">
      {fallback}
    </pre>
  )
}

const statusLabel = (status: string) => status

function TraceBlock({ step, isLast, dict }: { step: StepPreview; isLast: boolean; dict: Dictionary }) {
  const detail = renderStepDetail(dict, step)
  const isRunning = step.status === "running"

  return (
    <div
      className={`${isRunning ? "animate-in fade-in slide-in-from-left-1 duration-300" : ""}`}
      style={{ animationDuration: "300ms" }}
    >
      <details className="group" open={isRunning || isLast}>
        <summary className="flex cursor-pointer list-none items-start gap-3 py-2.5 marker:hidden">
          <span className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full shrink-0 ${statusChip(step.status)} ${isRunning ? "animate-pulse" : ""}`}>
            {stepLeadIcon(step.type, step.status)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-[--color-text-primary] truncate">{step.title}</span>
              <span className={`inline-flex rounded-full border px-2 py-px text-[11px] shrink-0 ${statusChip(step.status)}`}>
                {statusLabel(step.status)}
              </span>
            </div>
            {step.summary ? <p className="mt-0.5 text-xs text-[--color-text-secondary] line-clamp-2">{step.summary}</p> : null}
          </div>
          <span className="text-[11px] text-[--color-text-muted] shrink-0 mt-1">{formatMessageTime(step.startedAt)}</span>
          <ChevronDown size={14} className="shrink-0 text-[--color-text-muted] transition-transform group-open:rotate-180 mt-1" />
        </summary>
        {detail ? <div className="ml-10 border-l-2 border-[--color-border] pl-4 pb-2">{detail}</div> : null}
      </details>
    </div>
  )
}

function TraceSection({ title, steps, icon, defaultOpen = false, dict }: { title: string; steps: StepPreview[]; icon: React.ReactNode; defaultOpen?: boolean; dict: Dictionary }) {
  if (steps.length === 0) return null

  return (
    <details open={defaultOpen} className="group mb-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-2.5 marker:hidden">
        <div className="flex items-center gap-2.5">
          <span className="text-[--color-text-muted]">{icon}</span>
          <span className="text-sm font-medium text-[--color-text-primary]">{title}</span>
          <span className="rounded-full bg-[--color-bg-hover] px-2 py-0.5 text-[11px] text-[--color-text-muted]">
            {dict.ai.phaseCount(steps.length)}
          </span>
        </div>
        <ChevronDown size={16} className="shrink-0 text-[--color-text-muted] transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-0.5">
        {steps.map((step, i) => (
          <TraceBlock key={step.id} step={step} isLast={i === steps.length - 1} dict={dict} />
        ))}
      </div>
      {/* Decorative connector line for running steps */}
      {defaultOpen && steps.some((s) => s.status === "running") ? (
        <div className="ml-[14px] mt-0.5 mb-1 h-3 w-px bg-[--color-border]" />
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
    <article className="mr-auto w-full max-w-[1180px] rounded-[--radius-lg] bg-[--color-bg-surface]/60 px-5 py-4">
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
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${statusChip(message.runStatus ?? message.status)}`}>
            {message.runStatus ?? message.status}
          </span>
          {reasoningSteps.length > 0 ? (
            <span className="inline-flex rounded-full bg-[--color-bg-hover] px-3 py-1 text-xs text-[--color-text-secondary]">
              {dict.ai.thinkingStages(reasoningSteps.length)}
            </span>
          ) : isStreaming ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[--color-bg-hover] px-3 py-1 text-xs text-[--color-text-secondary]">
              <Loader2 size={10} className="animate-spin" />
              {dict.ai.thinkingStages(0)}
            </span>
          ) : null}
          {toolSteps.length > 0 ? (
            <span className="inline-flex rounded-full bg-[--color-bg-hover] px-3 py-1 text-xs text-[--color-text-secondary]">
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
        {(reasoningSteps.length > 0 || toolSteps.length > 0) ? (
          <div className="rounded-[--radius-md] bg-[--color-bg-hover]/70 px-5 py-3">
            <TraceSection
              title={dict.ai.thinkingProcess}
              steps={reasoningSteps}
              icon={<Sparkles size={15} />}
              defaultOpen={isStreaming && reasoningSteps.some((s) => s.status === "running")}
              dict={dict}
            />
            <TraceSection
              title={dict.ai.toolCallProcess}
              steps={toolSteps}
              icon={<Wrench size={15} />}
              defaultOpen={isStreaming && toolSteps.some((s) => s.status === "running")}
              dict={dict}
            />
          </div>
        ) : null}

        {/* Content area — Markdown renders in both streaming and completed states */}
        {hasContent ? (
          <div className="ai-response">
            <MarkdownContent key={displayMarkdown.length} source={displayMarkdown} />
          </div>
        ) : isStreaming ? (
          <div className="flex items-center gap-2 py-2 text-sm text-[--color-text-muted]">
            <Loader2 size={14} className="animate-spin" />
            {dict.ai.generatingMessage}
          </div>
        ) : null}
      </div>
    </article>
  )
}

export function AIAssistantClient() {
  const dict = getDict()
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [runsByMessageId, setRunsByMessageId] = useState<Record<string, RunDetail>>({})
  const [statusPayload, setStatusPayload] = useState<AIStatusResponse | null>(null)
  const [prompt, setPrompt] = useState("")
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const [requestMessage, setRequestMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [actionMenuOpen, setActionMenuOpen] = useState(false)
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
  const hasUploadingAttachments = attachments.some((attachment) => attachment.status === "uploading")
  const hasFailedAttachments = attachments.some((attachment) => attachment.status === "failed")
  const canSubmitComposer = !sending && !hasUploadingAttachments && !hasFailedAttachments && (prompt.trim().length > 0 || attachments.length > 0)

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

  return (
    <>
      <div className="grid h-full min-h-0 grid-cols-1 gap-0 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-6">
        <aside className="hidden min-h-0 rounded-[--radius-xl] bg-[--color-bg-surface-glass] p-4 shadow-[--shadow-sm] ring-1 ring-[--color-border] backdrop-blur-[16px] [-webkit-backdrop-filter:blur(16px)] lg:flex lg:flex-col">
          <div className="flex items-center justify-between gap-3 px-1 pb-4">
            <p className="text-lg font-semibold text-[--color-text-primary]">{dict.ai.conversations}</p>
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => void createConversation()} loading={creatingConversation} loadingText={dict.ai.newChat}>
              <MessageSquarePlus size={14} />
              {dict.ai.newChat}
            </Button>
          </div>

          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`relative rounded-[--radius-md] px-4 py-3 transition-all duration-200 ${
                  activeConversationId === conversation.id
                    ? "bg-[--color-brand-soft]"
                    : "hover:bg-[--color-bg-hover]"
                }`}
                style={activeConversationId === conversation.id ? {
                  boxShadow: "inset 3px 0 0 rgba(37, 99, 235, 0.45)",
                } : undefined}
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
                        {dict.common.save}
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-full px-4 shadow-none" onClick={() => setRenamingId(null)}>
                        {dict.common.cancel}
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
                      {formatConversationTime(conversation.lastMessageAt)} · {dict.ai.messagesCount(conversation.messageCount)}
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
                      disabled={deletingConversationId === conversation.id}
                      aria-busy={deletingConversationId === conversation.id || undefined}
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

        <section className="relative flex min-h-0 flex-col overflow-hidden rounded-none bg-transparent md:rounded-[--radius-xl] md:bg-[--color-bg-surface-glass] md:shadow-[--shadow-sm] md:ring-1 md:ring-[--color-border] md:backdrop-blur-[16px] md:[-webkit-backdrop-filter:blur(16px)]">
          <div className="px-4 py-3 md:hidden">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[--color-bg-hover] px-4 text-sm font-medium text-[--color-text-secondary]"
                onClick={() => setMobilePanel("conversations")}
              >
                {dict.ai.conversations}
              </button>
              <p className="truncate text-base font-semibold text-[--color-text-primary]">{activeConversation?.title || dict.ai.conversations}</p>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[--color-bg-hover] px-4 text-sm font-medium text-[--color-text-secondary]"
                onClick={() => setMobilePanel("controls")}
              >
                {dict.ai.more}
              </button>
            </div>
          </div>
          <div className="mx-4 h-px bg-[--color-border] md:hidden" />

          <div className="hidden px-8 py-4 md:block">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {capabilities ? (
                  <>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs ${capabilityTone(capabilities.streamText)}`}>{dict.ai.streaming}</span>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs ${capabilityTone(capabilities.toolCalling)}`}>{dict.ai.toolCalling}</span>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs ${capabilityTone(capabilities.visionInput)}`}>{dict.ai.imageUnderstanding}</span>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs ${capabilityTone(capabilities.reasoningStream)}`}>{dict.ai.thinkingStream}</span>
                  </>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {providerLabel ? <span className="rounded-full bg-[--color-bg-hover] px-3 py-1.5 text-xs font-medium text-[--color-text-secondary]">{providerLabel}</span> : null}
                {activeModelName ? <span className="rounded-full bg-[--color-brand-soft] px-3 py-1.5 text-xs font-medium text-[--color-brand]">{activeModelName}</span> : null}
                <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setSettingsOpen(true)}>
                  <Settings2 size={14} />
                </Button>
              </div>
            </div>
          </div>
          {/* Soft divider between toolbar and messages */}
          <div className="hidden md:block mx-8 h-px bg-[--color-border]" />

          <div className="mobile-chat-scroll min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-[--color-text-muted]">
                <Loader2 size={16} className="mr-2 animate-spin" />
                {dict.ai.loadingAi}
              </div>
            ) : (
              <div className="mx-auto flex min-h-full w-full max-w-[1480px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8 md:gap-8 md:py-7">
                {!canUseAI ? (
                  <div className="rounded-[--radius-lg] bg-[--color-warning-bg]/60 p-6">
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

                {messages.length === 0 ? (
                  <div className="flex flex-col gap-6 py-4">
                    <div className="max-w-4xl">
                      <p className="text-sm font-medium uppercase tracking-[0.22em] text-[--color-text-muted]">New Conversation</p>
                      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[--color-text-primary] sm:text-4xl">{dict.ai.heroTitle}</h2>
                      <p className="mt-4 max-w-2xl text-base leading-8 text-[--color-text-secondary]">
                        {dict.ai.heroDescription}
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      {SUGGESTIONS.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => void sendPrompt(item)}
                          className="group rounded-[--radius-lg] bg-[--color-bg-surface] px-5 py-5 text-left shadow-[--shadow-sm] transition-all duration-200 hover:-translate-y-1 hover:shadow-[--shadow-md]"
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-[14px] bg-[--color-brand-soft] text-[--color-brand]">
                              <Sparkles size={18} />
                            </div>
                            <div>
                              <p className="text-sm font-medium leading-7 text-[--color-text-primary]">{item}</p>
                              <p className="mt-1 text-xs text-[--color-text-muted] group-hover:text-[--color-text-secondary]">{dict.ai.clickToSend}</p>
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
                        <AssistantMessageCard key={message.id} message={message} run={runsByMessageId[message.id]} dict={dict} />
                      ) : (
                        <article key={message.id} className="ml-auto max-w-[88%] lg:max-w-[76%]">
                          <div className="rounded-[20px] bg-[linear-gradient(180deg,#eff6ff_0%,#dbeafe_100%)] px-5 py-4 text-[15px] leading-8 text-[--color-text-primary] shadow-[0_4px_16px_rgba(37,99,235,0.08)]">
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

          <div className="mobile-ai-composer px-4 pb-[max(1rem,calc(env(safe-area-inset-bottom)+0.5rem))] pt-2 sm:px-7 sm:pb-6 sm:pt-4">
            <div className="mx-auto mb-3 h-px w-full max-w-[1480px] bg-[--color-border]" />
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

              <div className="hidden flex-wrap items-center gap-2 px-1 pb-3 md:flex">
                <span className="inline-flex rounded-full bg-[--color-bg-hover] px-3 py-1 text-xs font-medium text-[--color-text-secondary]">
                  {sourceLabel(dict, statusPayload?.status.source ?? "none")}
                </span>
                {providerLabel ? (
                  <span className="inline-flex rounded-full bg-[--color-bg-hover] px-3 py-1 text-xs font-medium text-[--color-text-secondary]">
                    {providerLabel}
                  </span>
                ) : null}
                {activeModelName ? (
                  <span className="inline-flex rounded-full bg-[--color-brand-soft] px-3 py-1 text-xs font-medium text-[--color-brand]">
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
                    className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-bg-surface)] text-[--color-text-primary] shadow-[0_14px_30px_rgba(34,27,20,0.09)] transition-all hover:-translate-y-0.5 ${actionMenuOpen ? "rotate-45" : ""}`}
                    aria-label="打开功能"
                    aria-expanded={actionMenuOpen}
                  >
                    <Plus size={28} strokeWidth={2.1} />
                  </button>

                  {actionMenuOpen ? (
                    <div className="absolute bottom-[calc(100%+12px)] left-0 w-[232px] overflow-hidden rounded-[26px] border border-[--color-border] bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
                      <button
                        type="button"
                        onClick={openAttachmentPicker}
                        className="flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-left text-sm font-medium text-[--color-text-primary] transition-colors hover:bg-[--color-bg-hover]"
                      >
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[--color-bg-hover]">
                          <ImageIcon size={19} />
                        </span>
                        图片上传
                      </button>
                      <button
                        type="button"
                        onClick={openQuickModelMenu}
                        className="flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-left text-sm font-medium text-[--color-text-primary] transition-colors hover:bg-[--color-bg-hover]"
                      >
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[--color-bg-hover]">
                          <SlidersHorizontal size={19} />
                        </span>
                        切换模型
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="flex min-h-14 flex-1 items-end gap-3 rounded-[28px] bg-[color:var(--color-bg-surface)] px-5 py-1 shadow-[0_14px_30px_rgba(34,27,20,0.09)]">
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
                      className="ai-send-btn inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#A8463A] shadow-[0_8px_22px_rgba(168,70,58,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(168,70,58,0.36)] active:scale-95"
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
                      className="ai-send-btn inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black shadow-[0_8px_22px_rgba(0,0,0,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(0,0,0,0.24)] active:scale-95"
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
                      className="ai-send-btn inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F3F1EA] shadow-none cursor-not-allowed"
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
                  className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-bg-surface)] text-[--color-text-primary] shadow-[0_14px_30px_rgba(34,27,20,0.08)] active:scale-95"
                  aria-label="打开功能"
                  aria-expanded={actionMenuOpen}
                >
                  <Plus size={28} strokeWidth={2.1} />
                </button>

                <div className="flex min-h-14 flex-1 items-end gap-3 rounded-[28px] bg-[color:var(--color-bg-surface)] px-4 py-1 shadow-[0_14px_30px_rgba(34,27,20,0.08)]">
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
                      className="ai-send-btn inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#A8463A] shadow-[0_8px_22px_rgba(168,70,58,0.28)] transition-all duration-200 active:scale-95"
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
                      className="ai-send-btn inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black shadow-[0_8px_22px_rgba(0,0,0,0.18)] transition-all duration-200 active:scale-95"
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
                      className="ai-send-btn inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F3F1EA] shadow-none cursor-not-allowed"
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

          {/* Mobile action menu */}
          {actionMenuOpen ? (
            <div className="fixed inset-0 z-[70] md:hidden" onClick={() => setActionMenuOpen(false)}>
              <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" />
              <div
                className="absolute inset-x-4 overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.18)]"
                style={{ bottom: "calc(5.75rem + env(safe-area-inset-bottom, 0px))" }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="px-3 py-3">
                  <button
                    type="button"
                    onClick={openAttachmentPicker}
                    className="flex w-full items-center gap-4 rounded-[20px] px-4 py-4 text-left text-[17px] font-semibold leading-none text-black active:bg-black/[0.04]"
                  >
                    <ImageIcon size={25} strokeWidth={2.1} />
                    图片上传
                  </button>
                  <button
                    type="button"
                    onClick={openQuickModelMenu}
                    className="flex w-full items-center gap-4 rounded-[20px] px-4 py-4 text-left text-[17px] font-semibold leading-none text-black active:bg-black/[0.04]"
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
              {/* Backdrop overlay */}
              <div
                className="absolute inset-0 z-20 bg-black/20 backdrop-blur-sm md:hidden"
                onClick={() => setMobilePanel(null)}
              />
              <div className="absolute inset-0 z-30 flex flex-col bg-[--color-bg-surface] shadow-[--shadow-md] md:hidden">
                <div className="flex items-center justify-between border-b border-[--color-border] px-4 py-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-[--color-text-muted]">
                    {mobilePanel === "conversations" ? "Conversations" : "Controls"}
                  </p>
                  <p className="text-base font-semibold text-[--color-text-primary]">
                    {mobilePanel === "conversations" ? dict.ai.switchConversation : dict.ai.chatSettings}
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
                    <p className="text-sm text-[--color-text-secondary]">{dict.ai.mobileConversationsHint}</p>
                    <Button size="sm" className="rounded-full px-4 shadow-none" onClick={() => void createConversation()} loading={creatingConversation} loadingText={dict.ai.newChat}>
                      <MessageSquarePlus size={14} />
                      {dict.ai.newChat}
                    </Button>
                  </div>
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                    {conversations.map((conversation) => (
                      <div key={conversation.id} className="flex items-center gap-1">
                        <button
                          type="button"
                          className={`flex-1 rounded-[18px] px-4 py-3 text-left transition-colors ${activeConversationId === conversation.id ? "bg-[--color-bg-hover]" : "bg-[color:var(--color-bg-surface)]"}`}
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
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
                  <div className="rounded-[18px] bg-[--color-bg-hover] p-4">
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
                            className={`rounded-full px-3 py-1.5 text-xs ${m === activeModelName ? "bg-[--color-accent] text-white" : "bg-[--color-bg-hover] text-[--color-text-secondary]"}`}
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
                      蝶灵设置
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
