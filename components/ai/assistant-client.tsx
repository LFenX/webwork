"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Bot, Copy, Loader2, MessageSquarePlus, PencilLine, Settings2, Sparkles, Trash2, Wand2 } from "lucide-react"
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
}

type AIStatusResponse = {
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
  "帮我梳理最近的 notes 主题",
  "概览一下我的简历状态和版本情况",
  "看看我最近的文章和 reflections 有哪些重点",
]

function reasonLabel(reason: string) {
  switch (reason) {
    case "ready":
      return "已可用"
    case "request-pending":
      return "申请审核中"
    case "request-rejected":
      return "申请已拒绝"
    case "grant-paused":
      return "管理员授权已暂停"
    case "grant-revoked":
      return "管理员授权已撤销"
    case "configure-personal-api":
      return "请先配置个人 API"
    default:
      return "可提交免费使用申请"
  }
}

function sourceLabel(source: "user" | "grant" | "none") {
  if (source === "user") return "自定义 API"
  if (source === "grant") return "管理员授权"
  return "暂无可用来源"
}

export function AIAssistantClient() {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [statusPayload, setStatusPayload] = useState<AIStatusResponse | null>(null)
  const [prompt, setPrompt] = useState("")
  const [requestMessage, setRequestMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const messageSeedRef = useRef(0)
  const endRef = useRef<HTMLDivElement | null>(null)

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/ai/status", { cache: "no-store" })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error ?? "加载 AI 状态失败")
    setStatusPayload(data)
  }, [])

  const loadConversations = useCallback(async (preferredId?: string | null) => {
    const res = await fetch("/api/ai/conversations", { cache: "no-store" })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error ?? "加载会话失败")
    const items = Array.isArray(data?.items) ? data.items : []
    setConversations(items)
    const nextActiveId = preferredId ?? activeConversationId ?? items[0]?.id ?? null
    setActiveConversationId(nextActiveId)
    return nextActiveId
  }, [activeConversationId])

  const loadMessages = useCallback(async (conversationId: string | null) => {
    if (!conversationId) {
      setMessages([])
      return
    }

    const res = await fetch(`/api/ai/conversations/${conversationId}/messages`, { cache: "no-store" })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error ?? "加载消息失败")
    setMessages(Array.isArray(data?.items) ? data.items : [])
  }, [])

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
        body: JSON.stringify({ title: "新会话" }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "创建会话失败")
      await loadConversations(data.id)
      setMessages([])
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
      toast.success("已提交免费使用 AI 申请")
      setRequestMessage("")
      await loadStatus()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "提交申请失败")
    }
  }

  async function sendPrompt(nextPrompt?: string) {
    const text = (nextPrompt ?? prompt).trim()
    if (!text || sending) return

    if (!statusPayload?.status.canUseAI) {
      toast.error("当前没有可用的 AI 访问来源，请先配置 API 或提交申请")
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
      },
      {
        id: optimisticAssistantId,
        role: "assistant",
        contentMarkdown: "",
        status: "streaming",
        reasoningSummary: "",
        toolTraceSummary: "",
        modelName: statusPayload.status.config?.model || "",
        providerSource: statusPayload.status.source,
        createdAt: nowIso,
      },
    ])
    setPrompt("")

    try {
      const res = await fetch("/api/ai/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversationId ?? undefined,
          prompt: text,
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
        const events = buffer.split("\n\n")
        buffer = events.pop() ?? ""

        for (const eventBlock of events) {
          const eventName = eventBlock.split("\n").find((line) => line.startsWith("event: "))?.slice(7) ?? "message"
          const dataLine = eventBlock.split("\n").find((line) => line.startsWith("data: "))?.slice(6)
          const payload = dataLine ? JSON.parse(dataLine) : null

          if (eventName === "conversation") {
            resolvedConversationId = payload?.conversationId ?? resolvedConversationId
            if (resolvedConversationId) {
              setActiveConversationId(resolvedConversationId)
            }
          }

          if (eventName === "reasoning") {
            setMessages((current) =>
              current.map((item) => (item.id === optimisticAssistantId ? { ...item, reasoningSummary: payload?.summary ?? "" } : item))
            )
          }

          if (eventName === "tool") {
            setMessages((current) =>
              current.map((item) => (item.id === optimisticAssistantId ? { ...item, toolTraceSummary: payload?.summary ?? "" } : item))
            )
          }

          if (eventName === "chunk") {
            setMessages((current) =>
              current.map((item) =>
                item.id === optimisticAssistantId ? { ...item, contentMarkdown: `${item.contentMarkdown}${payload?.content ?? ""}` } : item
              )
            )
          }

          if (eventName === "done") {
            await loadConversations(payload?.conversationId ?? resolvedConversationId)
            await loadMessages(payload?.conversationId ?? resolvedConversationId ?? null)
          }

          if (eventName === "error") {
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

  return (
    <>
      <div className="grid min-h-[calc(100vh-8.5rem)] gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col rounded-[--radius-xl] border border-[--color-border] bg-[--color-bg-surface]">
          <div className="flex items-center justify-between gap-2 border-b border-[--color-border] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[--color-text-primary]">会话</p>
              <p className="text-xs text-[--color-text-muted]">{conversations.length} 个已保存对话</p>
            </div>
            <Button size="sm" onClick={() => void createConversation()}>
              <MessageSquarePlus size={14} /> 新建
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {conversations.length === 0 ? (
              <div className="rounded-[--radius-lg] border border-dashed border-[--color-border] p-4 text-sm text-[--color-text-muted]">
                还没有会话。可以先新建一个空会话，或者直接在右侧输入问题开始聊天。
              </div>
            ) : (
              conversations.map((item) => (
                <div
                  key={item.id}
                  className={`mb-2 rounded-[--radius-lg] border px-3 py-3 transition-colors ${
                    item.id === activeConversationId
                      ? "border-[--color-text-primary] bg-[--color-bg-hover]"
                      : "border-[--color-border] bg-[--color-bg-primary]"
                  }`}
                >
                  {renamingId === item.id ? (
                    <div className="space-y-2">
                      <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => void renameConversation(item.id)}>保存</Button>
                        <Button size="sm" variant="outline" onClick={() => setRenamingId(null)}>取消</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => {
                          setActiveConversationId(item.id)
                          void loadMessages(item.id)
                        }}
                      >
                        <p className="truncate text-sm font-medium text-[--color-text-primary]">{item.title}</p>
                        <p className="mt-1 text-xs text-[--color-text-muted]">{new Date(item.lastMessageAt).toLocaleString("zh-CN")}</p>
                      </button>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          className="text-[--color-text-muted] hover:text-[--color-text-primary]"
                          onClick={() => {
                            setRenamingId(item.id)
                            setRenameValue(item.title)
                          }}
                        >
                          <PencilLine size={14} />
                        </button>
                        <button
                          type="button"
                          className="text-[--color-text-muted] hover:text-[--color-danger]"
                          onClick={() => void deleteConversation(item.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col rounded-[--radius-xl] border border-[--color-border] bg-[--color-bg-surface]">
          <div className="flex items-center justify-between gap-3 border-b border-[--color-border] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[--color-text-primary]">{activeConversation?.title || "AI 助手"}</p>
              <p className="text-xs text-[--color-text-muted]">
                {statusPayload
                  ? `当前状态：${reasonLabel(statusPayload.status.reason)} / 来源：${sourceLabel(statusPayload.status.source)}`
                  : "正在加载状态..."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {statusPayload?.status.config?.model ? (
                <span className="hidden rounded-full border border-[--color-border] px-2 py-1 text-xs text-[--color-text-secondary] sm:inline-flex">
                  {statusPayload.status.config.model}
                </span>
              ) : null}
              <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
                <Settings2 size={14} /> 设置
              </Button>
            </div>
          </div>

          <div className="grid gap-4 border-b border-[--color-border] px-4 py-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-primary] p-4">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[--color-link]" />
                <p className="text-sm font-semibold text-[--color-text-primary]">开始建议</p>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => void sendPrompt(item)}
                    className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] px-3 py-3 text-left text-sm text-[--color-text-secondary] transition-colors hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-primary] p-4">
              <div className="flex items-center gap-2">
                <Wand2 size={16} className="text-[--color-link]" />
                <p className="text-sm font-semibold text-[--color-text-primary]">使用资格</p>
              </div>
              <p className="mt-2 text-sm text-[--color-text-secondary]">
                当前来源：{sourceLabel(statusPayload?.status.source ?? "none")}
              </p>
              <p className="mt-1 text-xs text-[--color-text-muted]">
                {statusPayload ? reasonLabel(statusPayload.status.reason) : "正在加载..."}
              </p>

              {statusPayload?.accessRequest ? (
                <div className="mt-3 rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] p-3">
                  <p className="text-xs font-medium text-[--color-text-primary]">最近一次申请：{statusPayload.accessRequest.status}</p>
                  <p className="mt-1 text-xs leading-5 text-[--color-text-secondary]">{statusPayload.accessRequest.message}</p>
                  {statusPayload.accessRequest.reviewNote ? (
                    <p className="mt-2 text-xs text-[--color-text-muted]">审核备注：{statusPayload.accessRequest.reviewNote}</p>
                  ) : null}
                </div>
              ) : null}

              {!statusPayload?.status.canUseAI ? (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={requestMessage}
                    onChange={(event) => setRequestMessage(event.target.value)}
                    rows={3}
                    placeholder="向管理员说明你的使用场景，例如：想用 AI 总结求职进展并整理 notes。"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void submitAccessRequest()}>提交免费使用申请</Button>
                    <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>配置个人 API</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-[--radius-md] border border-dashed border-[--color-border] p-3 text-xs text-[--color-text-muted]">
                  当前已通过权限与来源校验，系统会在回答前先执行受控工具，再调用真实 provider 或回退到结构化摘要。
                </div>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-[--color-text-muted]">
                <Loader2 size={16} className="mr-2 animate-spin" /> 正在加载 AI 助手...
              </div>
            ) : messages.length === 0 ? (
              <div className="mx-auto flex max-w-3xl flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[--color-bg-hover] text-[--color-link]">
                  <Bot size={26} />
                </div>
                <h2 className="text-2xl font-semibold text-[--color-text-primary]">你好，我是你的 AI 助手</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[--color-text-secondary]">
                  现在已经支持会话持久化、流式回复、权限状态、受控工具执行和 OpenAI-compatible provider 接入。
                </p>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-5">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-[--radius-xl] border p-4 ${
                      message.role === "assistant"
                        ? "border-[--color-border] bg-[--color-bg-primary]"
                        : "ml-auto border-[--color-text-primary]/20 bg-[--color-bg-hover]"
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[--color-text-primary]">{message.role === "assistant" ? "AI 助手" : "你"}</p>
                        <p className="text-xs text-[--color-text-muted]">
                          {new Date(message.createdAt).toLocaleString("zh-CN")}
                          {message.modelName ? ` / ${message.modelName}` : ""}
                        </p>
                      </div>
                      {message.role === "assistant" && message.contentMarkdown ? (
                        <button
                          type="button"
                          className="text-[--color-text-muted] transition-colors hover:text-[--color-text-primary]"
                          onClick={async () => {
                            await navigator.clipboard.writeText(message.contentMarkdown)
                            toast.success("已复制回答")
                          }}
                        >
                          <Copy size={14} />
                        </button>
                      ) : null}
                    </div>

                    {message.reasoningSummary ? (
                      <details className="mb-3 rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] px-3 py-2">
                        <summary className="cursor-pointer text-sm font-medium text-[--color-text-primary]">分析摘要</summary>
                        <p className="mt-2 text-sm leading-6 text-[--color-text-secondary]">{message.reasoningSummary}</p>
                      </details>
                    ) : null}

                    {message.toolTraceSummary ? (
                      <details className="mb-3 rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] px-3 py-2">
                        <summary className="cursor-pointer text-sm font-medium text-[--color-text-primary]">工具轨迹</summary>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[--color-text-secondary]">{message.toolTraceSummary}</p>
                      </details>
                    ) : null}

                    {message.contentMarkdown ? (
                      <div className="prose prose-sm max-w-none text-[--color-text-primary]">
                        <MarkdownContent source={message.contentMarkdown} />
                      </div>
                    ) : message.status === "streaming" ? (
                      <div className="flex items-center gap-2 text-sm text-[--color-text-muted]">
                        <Loader2 size={14} className="animate-spin" /> 思考中...
                      </div>
                    ) : null}
                  </div>
                ))}
                <div ref={endRef} />
              </div>
            )}
          </div>

          <div className="border-t border-[--color-border] p-4">
            <div className="mx-auto max-w-3xl">
              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={4}
                placeholder="问我关于你的求职、面试、文章、设置、上传和简历数据概览。"
                className="resize-none"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[--color-text-muted]">
                  当前版本会先做权限校验，再执行受控工具，最后交给真实 provider 或 fallback 摘要生成回答。
                </p>
                <Button onClick={() => void sendPrompt()} disabled={sending || !prompt.trim()}>
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {sending ? "生成中..." : "发送"}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <AISettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} status={statusPayload} onSaved={loadStatus} />
    </>
  )
}
