"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Copy,
  Loader2,
  MessageSquarePlus,
  PencilLine,
  Settings2,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react"
import { toast } from "sonner"
import { AISettingsSheet } from "@/components/ai/ai-settings-sheet"
import { MarkdownContent } from "@/components/markdown-content"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type ConversationItem = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  lastMessageAt: string
  messageCount: number
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
  steps: Array<StepPreview & { inputPreview: unknown; outputPreview: unknown }>
}

type MessageItem = {
  id: string
  role: string
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
  attachments: Array<{
    id: string
    uploadId: string | null
    url: string
    originalName: string
    mimeType: string
    size: number
  }>
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
    isEnabled: boolean
    apiKeyMask: string
    lastTestStatus: string
    lastTestedAt: string | null
  } | null
}

const SUGGESTIONS = [
  "总结我最近一周的求职进展",
  "帮我看看最近和谁聊天最多",
  "整理一下我最近的好友和登录情况",
  "如果我是管理员，帮我代查某个用户最近登录记录",
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

function Timeline({
  steps,
  expanded,
}: {
  steps: Array<StepPreview | (StepPreview & { inputPreview?: unknown; outputPreview?: unknown })>
  expanded: boolean
}) {
  if (steps.length === 0) return null

  return (
    <div className="rounded-[26px] border border-black/8 bg-black/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[--color-text-primary]">执行时间线</p>
        <span className="text-xs text-[--color-text-muted]">{steps.length} 个阶段</span>
      </div>

      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={step.id} className="rounded-2xl border border-black/6 bg-white/80 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[--color-text-muted]">#{index + 1}</span>
              <span className="text-sm font-medium text-[--color-text-primary]">{step.title}</span>
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${statusChip(step.status)}`}>
                {step.status}
              </span>
              <span className="ml-auto text-xs text-[--color-text-muted]">{formatMessageTime(step.startedAt)}</span>
            </div>
            <p className="mt-2 text-sm leading-7 text-[--color-text-secondary]">{step.summary}</p>
            {step.errorMessage ? (
              <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{step.errorMessage}</p>
            ) : null}
            {expanded && ("inputPreview" in step || "outputPreview" in step) ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {"inputPreview" in step && compactJson(step.inputPreview) ? (
                  <div className="rounded-xl bg-black/[0.03] p-3">
                    <p className="mb-2 text-xs font-medium text-[--color-text-primary]">输入摘要</p>
                    <pre className="whitespace-pre-wrap break-words text-xs text-[--color-text-secondary]">{compactJson(step.inputPreview)}</pre>
                  </div>
                ) : null}
                {"outputPreview" in step && compactJson(step.outputPreview) ? (
                  <div className="rounded-xl bg-black/[0.03] p-3">
                    <p className="mb-2 text-xs font-medium text-[--color-text-primary]">结果摘要</p>
                    <pre className="whitespace-pre-wrap break-words text-xs text-[--color-text-secondary]">{compactJson(step.outputPreview)}</pre>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

export function AIAssistantClient() {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [runsByMessageId, setRunsByMessageId] = useState<Record<string, RunDetail>>({})
  const [statusPayload, setStatusPayload] = useState<AIStatusResponse | null>(null)
  const [prompt, setPrompt] = useState("")
  const [attachments, setAttachments] = useState<Array<{
    id: string
    uploadId: string | null
    url: string
    originalName: string
    mimeType: string
    size: number
  }>>([])
  const [requestMessage, setRequestMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [viewMode, setViewMode] = useState<"compact" | "developer">("compact")
  const messageSeedRef = useRef(0)
  const endRef = useRef<HTMLDivElement | null>(null)
  const attachmentInputRef = useRef<HTMLInputElement | null>(null)

  const loadRun = useCallback(async (messageId: string) => {
    const res = await fetch(`/api/ai/runs/${messageId}?includeSteps=true`, { cache: "no-store" })
    if (!res.ok) return
    const data = await res.json().catch(() => null)
    if (data?.run) {
      setRunsByMessageId((current) => ({ ...current, [messageId]: data.run }))
    }
  }, [])

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/ai/status", { cache: "no-store" })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error ?? "加载 AI 状态失败")
    setStatusPayload(data)
  }, [])

  const loadConversations = useCallback(
    async (preferredId?: string | null) => {
      const res = await fetch("/api/ai/conversations", { cache: "no-store" })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "加载会话失败")
      const items: ConversationItem[] = Array.isArray(data?.items) ? data.items : []
      setConversations(items)
      const preferredExists = preferredId ? items.some((item) => item.id === preferredId) : false
      const currentExists = activeConversationId ? items.some((item) => item.id === activeConversationId) : false
      const nextActiveId: string | null =
        preferredExists ? (preferredId ?? null) :
        currentExists ? (activeConversationId ?? null) :
        items[0]?.id ?? null
      setActiveConversationId(nextActiveId)
      return nextActiveId
    },
    [activeConversationId]
  )

  const loadMessages = useCallback(async (conversationId: string | null) => {
    if (!conversationId) {
      setMessages([])
      setRunsByMessageId({})
      return
    }

    const res = await fetch(`/api/ai/conversations/${conversationId}/messages`, {
      cache: "no-store",
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error ?? "加载消息失败")
    const items = Array.isArray(data?.items) ? data.items : []
    setMessages(items)
    const assistantWithRuns = items.filter((item: MessageItem) => item.role === "assistant" && item.runId)
    await Promise.all(assistantWithRuns.map((item: MessageItem) => loadRun(item.id)))
  }, [loadRun])

  const bootstrap = useCallback(async () => {
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
  }, [loadConversations, loadMessages, loadStatus])

  useEffect(() => {
    Promise.resolve().then(() => {
      void bootstrap()
    })
  }, [bootstrap])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, sending])

  async function createConversation() {
    try {
      const res = await fetch("/api/ai/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "新对话" }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "创建会话失败")
      await loadConversations(data.id)
      setMessages([])
      setRunsByMessageId({})
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
      const next = conversations.find((item) => item.id !== id)?.id ?? null
      await loadConversations(next)
      await loadMessages(next)
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
    const response = await fetch("/api/upload", {
      method: "POST",
      body: form,
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(data?.error ?? "Attachment upload failed")
    }
    return {
      id: data?.id ?? crypto.randomUUID(),
      uploadId: data?.id ?? null,
      url: data?.url ?? "",
      originalName: data?.originalName ?? file.name,
      mimeType: file.type,
      size: file.size,
    }
  }

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
    const optimisticAssistantId = `local-assistant-${messageSeedRef.current}`
    const nowIso = new Date().toISOString()

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
        attachments,
      },
      {
        id: optimisticAssistantId,
        role: "assistant",
        contentMarkdown: "",
        status: "streaming",
        reasoningSummary: "正在规划执行步骤。",
        toolTraceSummary: "",
        modelName: statusPayload.status.config?.model || "",
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
          attachments,
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

      const patchMessage = (updater: (item: MessageItem) => MessageItem) => {
        setMessages((current) => current.map((item) => item.id === optimisticAssistantId ? updater(item) : item))
      }

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split("\n\n")
        buffer = events.pop() ?? ""

        for (const eventBlock of events) {
          const eventName =
            eventBlock
              .split("\n")
              .find((line) => line.startsWith("event: "))
              ?.slice(7) ?? "message"
          const dataLine = eventBlock
            .split("\n")
            .find((line) => line.startsWith("data: "))
            ?.slice(6)
          const payload = dataLine ? JSON.parse(dataLine) : null

          if (eventName === "conversation") {
            resolvedConversationId = payload?.conversationId ?? resolvedConversationId
            patchMessage((item) => ({
              ...item,
              runId: payload?.runId ?? item.runId,
            }))
            if (resolvedConversationId) setActiveConversationId(resolvedConversationId)
          }

          if (["run_started", "plan_created", "tool_started", "tool_completed", "tool_failed", "verification_started", "verification_completed", "final_started"].includes(eventName)) {
            patchMessage((item) => {
              const stepId = payload?.stepId ?? `event-${eventName}-${item.stepsPreview.length}`
              const nextStep: StepPreview = {
                id: stepId,
                type: eventName,
                title: payload?.title ?? eventName,
                status: payload?.status ?? (eventName.endsWith("completed") ? "completed" : "running"),
                startedAt: new Date().toISOString(),
                finishedAt: payload?.status === "completed" ? new Date().toISOString() : null,
                summary: payload?.summary ?? "",
                errorMessage: payload?.errorMessage ?? "",
              }
              const exists = item.stepsPreview.find((step) => step.id === stepId)
              const stepsPreview = exists
                ? item.stepsPreview.map((step) => step.id === stepId ? { ...step, ...nextStep } : step)
                : [...item.stepsPreview, nextStep]

              return {
                ...item,
                reasoningSummary: payload?.summary ?? item.reasoningSummary,
                toolTraceSummary: ["tool_started", "tool_completed", "tool_failed"].includes(eventName)
                  ? stepsPreview
                      .filter((step) => step.type.startsWith("tool"))
                      .map((step) => `${step.title}：${step.status}`)
                      .join("\n")
                  : item.toolTraceSummary,
                runMode: payload?.mode ?? item.runMode,
                delegatedTargetUserId: payload?.delegatedTargetUserId ?? item.delegatedTargetUserId,
                stepsPreview,
              }
            })
          }

          if (eventName === "chunk") {
            patchMessage((item) => ({
              ...item,
              contentMarkdown: `${item.contentMarkdown}${payload?.content ?? ""}`,
            }))
          }

          if (eventName === "run_completed") {
            await loadConversations(payload?.conversationId ?? resolvedConversationId)
            await loadMessages(payload?.conversationId ?? resolvedConversationId ?? null)
          }

          if (eventName === "run_failed") {
            throw new Error(payload?.message ?? "流式响应失败")
          }
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发送失败")
      await bootstrap()
    } finally {
      setSending(false)
    }
  }

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) ?? null,
    [activeConversationId, conversations]
  )

  const canUseAI = statusPayload?.status.canUseAI ?? false
  const modelName = statusPayload?.status.config?.model
  const providerLabel = statusPayload?.status.config?.providerLabel

  return (
    <>
      <div className="grid min-h-[calc(100vh-10rem)] gap-5 xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-[30px] border border-black/6 bg-white/80 shadow-[0_24px_80px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="border-b border-black/6 px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[--color-text-primary]">会话</p>
                <p className="mt-1 text-xs text-[--color-text-muted]">{conversations.length} 个已保存对话</p>
              </div>
              <Button size="sm" className="rounded-full px-4 shadow-none" onClick={() => void createConversation()}>
                <MessageSquarePlus size={14} />
                新建
              </Button>
            </div>
          </div>

          <div className="flex gap-3 overflow-x-auto p-3 xl:block xl:h-[calc(100vh-18rem)] xl:overflow-y-auto xl:overflow-x-hidden">
            {conversations.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-black/10 bg-black/[0.025] p-5 text-sm leading-7 text-[--color-text-secondary]">
                还没有会话。先在右侧输入一个问题，系统会自动创建并保存对话。
              </div>
            ) : (
              conversations.map((item) => {
                const active = item.id === activeConversationId
                return (
                  <div
                    key={item.id}
                    className={`min-w-[240px] rounded-[24px] border p-4 transition-all xl:mb-3 xl:min-w-0 ${
                      active
                        ? "border-black/10 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_20px_45px_rgba(15,23,42,0.08)]"
                        : "border-black/6 bg-white/70"
                    }`}
                  >
                    {renamingId === item.id ? (
                      <div className="space-y-3">
                        <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} className="rounded-2xl border-black/10 shadow-none" />
                        <div className="flex gap-2">
                          <Button size="sm" className="rounded-full px-4 shadow-none" onClick={() => void renameConversation(item.id)}>保存</Button>
                          <Button size="sm" variant="outline" className="rounded-full border-black/10 px-4 shadow-none" onClick={() => setRenamingId(null)}>取消</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="block w-full text-left"
                          onClick={() => {
                            setActiveConversationId(item.id)
                            void loadMessages(item.id)
                          }}
                        >
                          <p className="line-clamp-2 text-sm font-semibold leading-6 text-[--color-text-primary]">{item.title}</p>
                          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[--color-text-muted]">
                            <span>{formatConversationTime(item.lastMessageAt)}</span>
                            <span>{item.messageCount} 条</span>
                          </div>
                        </button>
                        <div className="mt-4 flex items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[--color-text-muted] transition-colors hover:bg-black/[0.045] hover:text-[--color-text-primary]"
                            onClick={() => {
                              setRenamingId(item.id)
                              setRenameValue(item.title)
                            }}
                            aria-label="重命名会话"
                          >
                            <PencilLine size={14} />
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[--color-text-muted] transition-colors hover:bg-red-50 hover:text-[--color-danger]"
                            onClick={() => void deleteConversation(item.id)}
                            aria-label="删除会话"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </aside>

        <section className="relative flex min-h-0 flex-col overflow-hidden rounded-[34px] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,251,252,0.96)_100%)] shadow-[0_30px_120px_rgba(15,23,42,0.08)]">
          <div className="border-b border-black/6 px-5 py-5 sm:px-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="min-w-0">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-[--color-text-primary]">{activeConversation?.title || "AI 助手"}</p>
                    <p className="mt-1 text-sm text-[--color-text-secondary]">
                      {statusPayload ? `${reasonLabel(statusPayload.status.reason)} / ${sourceLabel(statusPayload.status.source)}` : "正在加载状态..."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-full border border-black/8 bg-black/[0.03] p-1 text-xs">
                  <button
                    type="button"
                    className={`rounded-full px-3 py-1 ${viewMode === "compact" ? "bg-white text-[--color-text-primary]" : "text-[--color-text-muted]"}`}
                    onClick={() => setViewMode("compact")}
                  >
                    简洁
                  </button>
                  <button
                    type="button"
                    className={`rounded-full px-3 py-1 ${viewMode === "developer" ? "bg-white text-[--color-text-primary]" : "text-[--color-text-muted]"}`}
                    onClick={() => setViewMode("developer")}
                  >
                    全过程
                  </button>
                </div>
                {providerLabel ? (
                  <span className="inline-flex rounded-full border border-black/8 bg-black/[0.03] px-3 py-1 text-xs text-[--color-text-secondary]">
                    {providerLabel}
                  </span>
                ) : null}
                {modelName ? (
                  <span className="inline-flex rounded-full border border-black/8 bg-black/[0.03] px-3 py-1 text-xs text-[--color-text-secondary]">
                    {modelName}
                  </span>
                ) : null}
                <Button size="sm" variant="outline" className="rounded-full border-black/10 bg-white px-4 shadow-none" onClick={() => attachmentInputRef.current?.click()}>
                  Attach image
                </Button>
                <Button size="sm" variant="outline" className="rounded-full border-black/10 bg-white px-4 shadow-none" onClick={() => setSettingsOpen(true)}>
                  <Settings2 size={14} />
                  设置
                </Button>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-[--color-text-muted]">
                <Loader2 size={16} className="mr-2 animate-spin" />
                正在加载 AI 助手...
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-8 px-4 py-7 sm:px-6 lg:px-8 sm:py-8">
                {!canUseAI ? (
                  <div className="rounded-[30px] border border-amber-200 bg-[linear-gradient(180deg,#fffdf6_0%,#fff8e8_100%)] p-6 shadow-[0_18px_40px_rgba(217,119,6,0.08)]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                        <Wand2 size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[--color-text-primary]">当前还不能直接提问</p>
                        <p className="mt-1 text-sm text-[--color-text-secondary]">{statusPayload ? reasonLabel(statusPayload.status.reason) : "请稍后再试"}</p>
                      </div>
                    </div>

                    {statusPayload?.accessRequest ? (
                      <div className="mt-5 rounded-[24px] border border-amber-200/80 bg-white/70 px-4 py-4 text-sm leading-7 text-[--color-text-secondary]">
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
                        placeholder="向管理员说明你的使用场景。"
                        className="rounded-[24px] border-amber-200 bg-white/80 px-4 py-3 shadow-none"
                      />
                      <div className="flex gap-2 sm:flex-col">
                        <Button className="rounded-full px-5 shadow-none" onClick={() => void submitAccessRequest()}>提交申请</Button>
                        <Button variant="outline" className="rounded-full border-black/10 bg-white px-5 shadow-none" onClick={() => setSettingsOpen(true)}>配置 API</Button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {messages.length === 0 ? (
                  <div className="flex flex-col gap-8 py-6">
                    <div className="max-w-4xl">
                      <p className="text-sm font-medium uppercase tracking-[0.22em] text-[--color-text-muted]">New Conversation</p>
                      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[--color-text-primary] sm:text-4xl">把 AI 回复从固定摘要升级成真正的执行过程</h2>
                      <p className="mt-4 max-w-2xl text-base leading-8 text-[--color-text-secondary]">
                        这里会保留会话记录、权限控制、工具轨迹和最终结论。默认更简洁，切到“全过程”后会看到完整时间线。
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      {SUGGESTIONS.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => void sendPrompt(item)}
                          className="group rounded-[26px] border border-black/8 bg-white/75 px-5 py-5 text-left shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-black/12 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-black/[0.04] text-[--color-text-primary]">
                              <Sparkles size={16} />
                            </div>
                            <div>
                              <p className="text-sm font-medium leading-7 text-[--color-text-primary]">{item}</p>
                              <p className="mt-2 text-xs text-[--color-text-muted] group-hover:text-[--color-text-secondary]">点击后直接发送</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-8 pb-4">
                    {messages.map((message) => {
                      const assistant = message.role === "assistant"
                      const run = runsByMessageId[message.id]
                      const displaySteps = viewMode === "developer" ? run?.steps ?? message.stepsPreview : message.stepsPreview

                      return (
                        <article key={message.id} className={`${assistant ? "mr-auto w-full max-w-[1180px]" : "ml-auto max-w-[88%] lg:max-w-[76%]"}`}>
                          {assistant ? (
                            <div className="w-full">
                              <div className="min-w-0">
                                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                                  <span className="text-sm font-semibold text-[--color-text-primary]">AI 助手</span>
                                  <span className="text-xs text-[--color-text-muted]">{formatMessageTime(message.createdAt)}</span>
                                  {message.modelName ? (
                                    <span className="rounded-full bg-black/[0.035] px-2.5 py-1 text-[11px] text-[--color-text-muted]">{message.modelName}</span>
                                  ) : null}
                                  {message.runMode ? (
                                    <span className="rounded-full bg-black/[0.035] px-2.5 py-1 text-[11px] text-[--color-text-muted]">{modeLabel(message.runMode)}</span>
                                  ) : null}
                                  {message.contentMarkdown ? (
                                    <button
                                      type="button"
                                      className="ml-auto inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs text-[--color-text-muted] transition-colors hover:bg-black/[0.045] hover:text-[--color-text-primary]"
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

                                <div className="mb-4 flex flex-wrap items-center gap-2">
                                  {message.stepsPreview.slice(0, 3).map((step) => (
                                    <span key={step.id} className={`inline-flex rounded-full border px-3 py-1 text-xs ${statusChip(step.status)}`}>
                                      {step.title}
                                    </span>
                                  ))}
                                  {message.delegatedTargetUserId ? (
                                    <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700">
                                      目标用户：{message.delegatedTargetUserId}
                                    </span>
                                  ) : null}
                                </div>

                                {displaySteps.length > 0 ? <Timeline steps={displaySteps} expanded={viewMode === "developer"} /> : null}

                                {message.contentMarkdown ? (
                                  <div className="ai-response mt-4 rounded-[30px] bg-white/88 px-1 py-1 shadow-[0_12px_50px_rgba(15,23,42,0.03)]">
                                    <div className="rounded-[28px] px-5 py-4 sm:px-6 sm:py-5">
                                      <MarkdownContent source={message.contentMarkdown} />
                                    </div>
                                  </div>
                                ) : message.status === "streaming" ? (
                                  <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-black/[0.04] px-4 py-2 text-sm text-[--color-text-muted]">
                                    <Loader2 size={14} className="animate-spin" />
                                    正在执行...
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-[30px] bg-[#f2f4f7] px-5 py-4 text-[15px] leading-8 text-[--color-text-primary] shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                              <div className="mb-1 text-xs text-[--color-text-muted]">{formatMessageTime(message.createdAt)}</div>
                              {message.attachments.length > 0 ? (
                                <div className="mb-3 flex flex-wrap gap-3">
                                  {message.attachments.map((attachment) => (
                                    attachment.mimeType.startsWith("image/") ? (
                                      <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-black/8 bg-white">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={attachment.url} alt={attachment.originalName} className="h-36 w-36 object-cover" />
                                      </a>
                                    ) : (
                                      <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="rounded-2xl border border-black/8 bg-white px-3 py-2 text-xs text-[--color-text-secondary] hover:no-underline">
                                        {attachment.originalName}
                                      </a>
                                    )
                                  ))}
                                </div>
                              ) : null}
                              <div className="whitespace-pre-wrap break-words">{message.contentMarkdown}</div>
                            </div>
                          )}
                        </article>
                      )
                    })}
                    <div ref={endRef} />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.74)_0%,rgba(255,255,255,0.96)_36%)] px-4 pb-4 pt-4 backdrop-blur sm:px-7 sm:pb-7">
            <div className="mx-auto w-full max-w-[1480px]">
              <div className="rounded-[32px] border border-black/8 bg-white/90 p-3 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
                <input
                  ref={attachmentInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0]
                    event.currentTarget.value = ""
                    if (!file) return
                    try {
                      const uploaded = await uploadAttachment(file)
                      setAttachments([uploaded])
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Attachment upload failed")
                    }
                  }}
                />
                <div className="flex flex-wrap items-center gap-2 px-2 pb-3 pt-1">
                  <span className="inline-flex rounded-full bg-black/[0.04] px-3 py-1 text-xs text-[--color-text-secondary]">{sourceLabel(statusPayload?.status.source ?? "none")}</span>
                  {modelName ? (
                    <span className="inline-flex rounded-full bg-black/[0.04] px-3 py-1 text-xs text-[--color-text-secondary]">{modelName}</span>
                  ) : null}
                  <span className="text-xs text-[--color-text-muted]">先校验权限，再规划步骤，然后调用受控工具和 provider</span>
                </div>

                {attachments.length > 0 ? (
                  <div className="px-2 pb-3">
                    <div className="inline-flex items-center gap-3 rounded-2xl border border-black/8 bg-black/[0.03] px-3 py-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={attachments[0].url} alt={attachments[0].originalName} className="h-12 w-12 rounded-xl object-cover" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[--color-text-primary]">{attachments[0].originalName}</p>
                        <p className="text-xs text-[--color-text-muted]">Image attached for this prompt</p>
                      </div>
                      <button type="button" onClick={() => setAttachments([])} className="text-xs text-[--color-text-muted] hover:text-[--color-danger]">
                        Remove
                      </button>
                    </div>
                  </div>
                ) : null}

                <Textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={4}
                  placeholder="输入你的问题，比如总结最近聊天、查看登录会话、搜索消息或管理员代查。"
                  className="min-h-[120px] resize-none rounded-[26px] border-0 bg-transparent px-4 py-3 text-[15px] leading-8 shadow-none focus-visible:ring-0"
                />

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-2 pb-1">
                  <p className="text-xs leading-6 text-[--color-text-muted]">默认以简洁模式展示，切到“全过程”可查看完整执行时间线。</p>
                  <Button onClick={() => void sendPrompt()} disabled={sending || (!prompt.trim() && attachments.length === 0)} className="h-11 rounded-full px-5 shadow-none">
                    {sending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    {sending ? "生成中..." : "发送"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
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
