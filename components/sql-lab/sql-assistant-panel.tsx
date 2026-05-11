"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Bot,
  Check,
  CheckCircle2,
  CopyPlus,
  DatabaseZap,
  Edit3,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  Play,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { MarkdownContent } from "@/components/markdown-content"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { apiDelete, apiFetch, apiPatch, apiPost } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import type { SqlCatalogMatch, SqlRunResult } from "@/lib/sql-lab/types"

type LegacyThinkingStep = {
  title: string
  detail: string
  status: "done" | "running" | "error"
}

type SelectedTable = {
  schema: string
  table: string
  reason: string
  role?: "primary" | "join" | "reference"
}

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  sql?: string
  title?: string
  reasoningMarkdown?: string
  selectedTables?: SelectedTable[]
  catalogMatches?: SqlCatalogMatch[]
  confidence?: number
  thinkingSteps?: LegacyThinkingStep[]
  actions?: Array<{ type: string; [key: string]: unknown }>
  executedActions?: Array<{ type: string; ok: boolean; message: string }>
  runResult?: SqlRunResult
  createdAt?: string
}

type AssistantConversation = {
  id: string
  title: string
  titleLocked: boolean
  lastMessageAt: string
  createdAt: string
  updatedAt: string
  messageCount: number
  preview: string
}

type AssistantResponse = {
  message: string
  sql: string
  title: string
  reasoningMarkdown: string
  selectedTables: SelectedTable[]
  catalogMatches: SqlCatalogMatch[]
  confidence: number
  actions: Array<{ type: string; [key: string]: unknown }>
  executedActions: Array<{ type: string; ok: boolean; message: string }>
  runResult?: SqlRunResult
  provider: { label: string; model: string; source: string }
  conversation: AssistantConversation
  userMessage: ChatMessage
  assistantMessage: ChatMessage
}

type Props = {
  currentSql: string
  lastResult: SqlRunResult | null
  limit: number
  className?: string
  onApplySql: (sql: string) => void
  onApplyNewSql: (sql: string, title?: string) => void
  onTrySql: (sql: string) => Promise<SqlRunResult | null>
  onSchemaChanged?: () => void
  onAssistantRunResult?: (sql: string, title: string, result: SqlRunResult) => void
}

const HELLO_MESSAGE: ChatMessage = {
  id: "hello",
  role: "assistant",
  content: "我是 SQL 助教。你可以描述取数需求、贴错误让我修 SQL，也可以让我在 Private 里建文件夹或私有表。",
}

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function summarizeResult(result: SqlRunResult | null) {
  if (!result) return null
  return {
    ok: result.ok,
    error: result.error,
    warnings: result.warnings,
    touchedTables: result.touchedTables,
    durationMs: result.durationMs,
    rowCount: result.resultSets.reduce((sum, set) => sum + set.rowCount, 0),
  }
}

function actionLabel(type: string) {
  if (type === "create_folder") return "新建文件夹"
  if (type === "create_table") return "新建私有表"
  if (type === "move_table") return "移动私有表"
  if (type === "execute_sql") return "执行 SQL"
  return type
}

function ensureMarkdown(content: string, sql?: string) {
  const text = content.trim() || "我整理好了建议。"
  if (!sql || /```/.test(text)) return text
  return `${text}\n\n\`\`\`sql\n${sql.trim()}\n\`\`\``
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
}

function legacyReasoningMarkdown(steps?: LegacyThinkingStep[]) {
  if (!steps?.length) return ""
  return [
    "### 历史思考记录",
    ...steps.map((step) => `- **${step.title}**：${step.detail}`),
  ].join("\n")
}

function ReasoningPanel({ markdown, legacySteps }: { markdown?: string; legacySteps?: LegacyThinkingStep[] }) {
  const source = markdown?.trim() || legacyReasoningMarkdown(legacySteps)
  if (!source) return null
  return (
    <details className="mb-2 rounded-md border border-cyan-100 bg-white/70 px-2 py-1.5">
      <summary className="cursor-pointer select-none font-mono text-[10px] font-semibold text-cyan-900">
        思考
        <span className="ml-1 text-[9px] font-normal text-[--color-text-muted]">展开查看表选择与方案判断</span>
      </summary>
      <div className="sql-assistant-markdown mt-2 text-[11px] leading-5 text-[--color-text-secondary]">
        <MarkdownContent source={source} />
      </div>
    </details>
  )
}

function LoadingAnalysisCard() {
  return (
    <div className="rounded-md border border-cyan-100 bg-white/70 px-2 py-2 text-xs leading-5 text-[--color-text-secondary]">
      <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] font-semibold text-cyan-900">
        <Loader2 size={11} className="animate-spin" />
        正在分析需求
      </div>
      <p>
        SQL 助教正在先定位可能相关的表目录，再读取少量精选表结构生成 SQL。完成后会默认收起“思考”，你可以展开查看表选择理由和权限边界。
      </p>
    </div>
  )
}

export function SqlAssistantPanel({
  currentSql,
  lastResult,
  limit,
  className,
  onApplySql,
  onApplyNewSql,
  onTrySql,
  onSchemaChanged,
  onAssistantRunResult,
}: Props) {
  const [input, setInput] = useState("")
  const [takeover, setTakeover] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [conversationsOpen, setConversationsOpen] = useState(false)
  const [conversations, setConversations] = useState<AssistantConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([HELLO_MESSAGE])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")

  const activeConversation = conversations.find((item) => item.id === activeConversationId) ?? null
  const compactMessages = useMemo(
    () => messages
      .filter((message) => message.id !== "hello" && (message.role === "user" || message.content.trim()))
      .slice(-8)
      .map((message) => ({ role: message.role, content: message.content })),
    [messages]
  )

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true)
    try {
      const data = await apiFetch<{ messages: ChatMessage[] }>(`/api/sql/assistant/conversations/${conversationId}/messages`)
      setMessages(data.messages.length ? data.messages : [HELLO_MESSAGE])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "读取 SQL 助教会话失败")
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  const refreshConversations = useCallback(async () => {
    setLoadingConversations(true)
    try {
      const data = await apiFetch<{ conversations: AssistantConversation[] }>("/api/sql/assistant/conversations")
      setConversations(data.conversations)
      const nextId = data.conversations[0]?.id ?? null
      setActiveConversationId(nextId)
      if (nextId) void loadMessages(nextId)
      else setMessages([HELLO_MESSAGE])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "读取 SQL 助教会话列表失败")
    } finally {
      setLoadingConversations(false)
    }
  }, [loadMessages])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshConversations()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [refreshConversations])

  function upsertConversation(conversation: AssistantConversation) {
    setConversations((current) => {
      const rest = current.filter((item) => item.id !== conversation.id)
      return [conversation, ...rest].sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
    })
  }

  async function selectConversation(conversationId: string) {
    setActiveConversationId(conversationId)
    setConversationsOpen(false)
    await loadMessages(conversationId)
  }

  async function createConversation() {
    try {
      const data = await apiPost<{ conversation: AssistantConversation }>("/api/sql/assistant/conversations", { title: "新会话" })
      upsertConversation(data.conversation)
      setActiveConversationId(data.conversation.id)
      setMessages([HELLO_MESSAGE])
      setConversationsOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "新建 SQL 助教会话失败")
    }
  }

  async function renameConversation(conversationId: string) {
    const title = editingTitle.trim()
    if (!title) return
    try {
      const data = await apiPatch<{ conversation: AssistantConversation }>(`/api/sql/assistant/conversations/${conversationId}`, { title })
      upsertConversation(data.conversation)
      setEditingId(null)
      setEditingTitle("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "修改会话名称失败")
    }
  }

  async function deleteConversation(conversationId: string) {
    try {
      await apiDelete(`/api/sql/assistant/conversations/${conversationId}`)
      const next = conversations.filter((item) => item.id !== conversationId)
      setConversations(next)
      if (activeConversationId === conversationId) {
        const nextId = next[0]?.id ?? null
        setActiveConversationId(nextId)
        if (nextId) void loadMessages(nextId)
        else setMessages([HELLO_MESSAGE])
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除会话失败")
    }
  }

  async function sendPrompt(promptOverride?: string) {
    const prompt = (promptOverride ?? input).trim()
    if (!prompt || loading) return
    const userMessage: ChatMessage = { id: newId("user"), role: "user", content: prompt }
    setMessages((current) => [...current.filter((message) => message.id !== "hello"), userMessage])
    setInput("")
    setLoading(true)
    try {
      const response = await apiPost<AssistantResponse>("/api/sql/assistant", {
        conversationId: activeConversationId,
        prompt,
        messages: [...compactMessages, userMessage].map(({ role, content }) => ({ role, content })),
        currentSql,
        lastResult: summarizeResult(lastResult),
        takeover,
        limit,
      })
      upsertConversation(response.conversation)
      setActiveConversationId(response.conversation.id)
      setMessages((current) => [
        ...current.filter((message) => message.id !== userMessage.id && message.id !== "hello"),
        response.userMessage,
        response.assistantMessage,
      ])
      if (response.executedActions.some((action) => action.ok && action.type !== "execute_sql")) onSchemaChanged?.()
      if (response.runResult && response.sql) onAssistantRunResult?.(response.sql, response.title, response.runResult)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "SQL 助教请求失败")
    } finally {
      setLoading(false)
    }
  }

  async function trySql(message: ChatMessage) {
    if (!message.sql) return
    const result = await onTrySql(message.sql)
    if (result && !result.ok) {
      setMessages((current) => [
        ...current,
        {
          id: newId("assistant_hint"),
          role: "assistant",
          content: `试验失败：${result.error?.message ?? "SQL 执行失败"}。你可以点“按错误修正”，我会基于这次错误继续改。`,
          reasoningMarkdown: `### 错误复盘\n试验阶段返回错误：${result.error?.message ?? "SQL 执行失败"}。\n\n### 下一步\n继续发送“按错误修正”时，SQL 助教会优先参考当前 SQL 涉及表和相似字段。`,
        },
      ])
    }
  }

  return (
    <section
      className={cn(
        "flex min-h-[190px] min-w-0 w-full max-w-full shrink-0 overflow-hidden rounded-md border border-[--color-border] bg-[--color-bg-surface] shadow-[0_4px_18px_rgba(15,23,42,0.04)]",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 shrink-0 items-center gap-2 border-b border-[--color-border] bg-[#FAFBFC] px-2.5 py-1.5">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-cyan-950 text-cyan-100">
            <Bot size={13} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[11px] font-semibold text-[--color-text-primary]">SQL 助教</div>
            <div className="truncate font-mono text-[9px] text-[--color-text-muted]">
              {activeConversation?.title ?? "会话已持久化，使用蝶灵当前 AI 配置"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConversationsOpen(true)}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-[--color-border] bg-white px-2 font-mono text-[10px] text-[--color-text-muted] hover:text-[--color-text-primary]"
            title="会话"
          >
            <MessageSquare size={11} />
            会话
          </button>
          <button
            type="button"
            onClick={() => setTakeover((value) => !value)}
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 font-mono text-[10px]",
              takeover
                ? "border-cyan-300 bg-cyan-50 text-cyan-800"
                : "border-[--color-border] bg-white text-[--color-text-muted] hover:text-[--color-text-primary]"
            )}
            title="接管模式下，助教会新建查询并执行安全动作"
          >
            <DatabaseZap size={11} />
            接管
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
          {loadingMessages ? (
            <div className="flex h-24 items-center justify-center text-cyan-700">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "min-w-0 max-w-full rounded-md border px-2.5 py-2",
                    message.role === "user" ? "ml-6 border-slate-200 bg-slate-50" : "mr-6 border-cyan-100 bg-cyan-50/40"
                  )}
                >
                  <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] text-[--color-text-muted]">
                    {message.role === "user" ? <Sparkles size={10} /> : <Bot size={10} />}
                    {message.role === "user" ? "你" : "SQL 助教"}
                  </div>
                  {message.role === "assistant" ? (
                    <ReasoningPanel markdown={message.reasoningMarkdown} legacySteps={message.thinkingSteps} />
                  ) : null}
                  <div className="sql-assistant-markdown text-xs leading-5 text-[--color-text-primary]">
                    <MarkdownContent source={message.role === "assistant" ? ensureMarkdown(message.content, message.sql) : message.content} />
                  </div>
                  {message.sql ? (
                    <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-cyan-100 pt-2">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => onApplySql(message.sql!)}>
                        <CheckCircle2 size={11} /> 应用
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => onApplyNewSql(message.sql!, message.title)}>
                        <CopyPlus size={11} /> 新查询
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => void trySql(message)}>
                        <Play size={11} /> 试验
                      </Button>
                      {lastResult?.error ? (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => void sendPrompt(`请根据这次错误修正 SQL：${lastResult.error?.message}`)}>
                          按错误修正
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                  {message.actions?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {message.actions.map((action, index) => (
                        <span key={`${action.type}-${index}`} className="rounded border border-cyan-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-cyan-800">
                          {actionLabel(action.type)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {message.executedActions?.length ? (
                    <div className="mt-2 space-y-1">
                      {message.executedActions.map((action, index) => (
                        <div key={`${action.type}-done-${index}`} className={cn("font-mono text-[10px]", action.ok ? "text-emerald-700" : "text-rose-700")}>
                          {action.ok ? "OK" : "!"} {action.message}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              {loading ? (
                <div className="mr-6 rounded-md border border-cyan-100 bg-cyan-50/40 px-2.5 py-2">
                  <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] text-cyan-800">
                    <Bot size={10} />
                    SQL 助教
                  </div>
                  <LoadingAnalysisCard />
                </div>
              ) : null}
            </div>
          )}
        </div>

        <form
          className="flex min-w-0 shrink-0 items-end gap-2 border-t border-[--color-border] bg-white px-2.5 py-2"
          onSubmit={(event) => {
            event.preventDefault()
            void sendPrompt()
          }}
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                void sendPrompt()
              }
            }}
            rows={2}
            className="min-h-10 min-w-0 flex-1 resize-none rounded-md border border-[--color-border] bg-[--color-bg-soft] px-2 py-1.5 text-xs leading-5 outline-none focus:border-[--color-brand-border] focus:bg-white"
            placeholder="描述取数需求、粘贴报错，或说：帮我在 Private 创建一个客户线索表..."
          />
          <Button type="submit" size="sm" className="h-9 shrink-0 px-3 text-xs" disabled={!input.trim() || loading}>
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            发送
          </Button>
        </form>
      </div>

      <Dialog open={conversationsOpen} onOpenChange={setConversationsOpen}>
        <DialogContent className="max-w-xl gap-0 p-0" overlay>
          <DialogHeader className="border-b border-[--color-border] px-4 py-3">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <MessageSquare size={15} />
              SQL 助教会话
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 border-b border-[--color-border] px-4 py-3">
            <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => void createConversation()}>
              <MessageSquarePlus size={13} />
              新会话
            </Button>
            <span className="font-mono text-[10px] text-[--color-text-muted]">第一次聊天后会自动按主题命名，也可以手动修改。</span>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-3">
            {loadingConversations ? (
              <div className="flex h-20 items-center justify-center text-cyan-700">
                <Loader2 size={16} className="animate-spin" />
              </div>
            ) : conversations.length ? (
              <div className="space-y-2">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={cn(
                      "rounded-md border p-2",
                      activeConversationId === conversation.id ? "border-cyan-200 bg-cyan-50/70" : "border-[--color-border] bg-white"
                    )}
                  >
                    {editingId === conversation.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={editingTitle}
                          onChange={(event) => setEditingTitle(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void renameConversation(conversation.id)
                            if (event.key === "Escape") setEditingId(null)
                          }}
                          className="min-w-0 flex-1 rounded-md border border-cyan-200 px-2 py-1 text-xs outline-none"
                          autoFocus
                        />
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => void renameConversation(conversation.id)}>
                          <Check size={12} />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingId(null)}>
                          <X size={12} />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void selectConversation(conversation.id)}>
                          <div className="truncate text-xs font-semibold text-[--color-text-primary]">{conversation.title}</div>
                          <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-[--color-text-muted]">
                            <span>{conversation.messageCount} 条消息</span>
                            <span>{formatTime(conversation.lastMessageAt)}</span>
                          </div>
                          {conversation.preview ? <div className="mt-1 truncate text-[11px] text-[--color-text-muted]">{conversation.preview}</div> : null}
                        </button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => {
                            setEditingId(conversation.id)
                            setEditingTitle(conversation.title)
                          }}
                        >
                          <Edit3 size={12} />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-rose-600" onClick={() => void deleteConversation(conversation.id)}>
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-[--color-border] px-3 py-8 text-center text-xs text-[--color-text-muted]">
                暂无会话，发送第一条消息后会自动保存。
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
