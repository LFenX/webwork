import "server-only"

import { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/db"
import { runSqlAssistant, type SqlAssistantResponse } from "@/lib/sql-lab/assistant"
import type { SqlRunResult } from "@/lib/sql-lab/types"

type AssistantRole = "user" | "assistant"
type LegacyThinkingStep = { title: string; detail: string; status: "done" | "running" | "error" }

export type SqlAssistantHistoryMessage = {
  id: string
  role: AssistantRole
  content: string
  sql?: string
  title?: string
  reasoningMarkdown?: string
  selectedTables?: SqlAssistantResponse["selectedTables"]
  catalogMatches?: SqlAssistantResponse["catalogMatches"]
  confidence?: number
  thinkingSteps?: LegacyThinkingStep[]
  actions?: SqlAssistantResponse["actions"]
  executedActions?: SqlAssistantResponse["executedActions"]
  runResult?: SqlRunResult
  provider?: SqlAssistantResponse["provider"]
  createdAt: string
}

export type SqlAssistantConversationSummary = {
  id: string
  title: string
  titleLocked: boolean
  lastMessageAt: string
  createdAt: string
  updatedAt: string
  messageCount: number
  preview: string
}

type SendInput = {
  conversationId?: string
  prompt: string
  messages?: Array<{ role: AssistantRole; content: string }>
  currentSql?: string
  lastResult?: Pick<SqlRunResult, "ok" | "error" | "warnings" | "touchedTables" | "durationMs"> & {
    rowCount?: number
  }
  takeover?: boolean
  limit?: number
}

function toJson(value: unknown) {
  return (value ?? Prisma.JsonNull) as Prisma.InputJsonValue
}

function trimTitle(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 32)
}

function isDefaultTitle(value: string) {
  return value === "新会话" || value === "鏂颁細璇?" || value === "SQL 助教会话"
}

function fallbackTitle(prompt: string) {
  const compact = trimTitle(prompt.replace(/```[\s\S]*?```/g, "SQL").replace(/[?？。！!]+$/g, ""))
  return compact || "SQL 助教会话"
}

function asArray<T>(value: unknown): T[] | undefined {
  return Array.isArray(value) ? (value as T[]) : undefined
}

function asRunResult(value: unknown): SqlRunResult | undefined {
  return value && typeof value === "object" ? (value as SqlRunResult) : undefined
}

function mapMessage(row: {
  id: string
  role: string
  contentMarkdown: string
  sql: string
  title: string
  thinkingSteps: Prisma.JsonValue | null
  reasoningMarkdown: string
  selectedTables: Prisma.JsonValue | null
  catalogMatches: Prisma.JsonValue | null
  confidence: number | null
  actions: Prisma.JsonValue | null
  executedActions: Prisma.JsonValue | null
  runResult: Prisma.JsonValue | null
  provider: Prisma.JsonValue | null
  createdAt: Date
}): SqlAssistantHistoryMessage {
  return {
    id: row.id,
    role: row.role === "user" ? "user" : "assistant",
    content: row.contentMarkdown,
    sql: row.sql || undefined,
    title: row.title || undefined,
    reasoningMarkdown: row.reasoningMarkdown || undefined,
    selectedTables: asArray<SqlAssistantResponse["selectedTables"][number]>(row.selectedTables),
    catalogMatches: asArray<SqlAssistantResponse["catalogMatches"][number]>(row.catalogMatches),
    confidence: typeof row.confidence === "number" ? row.confidence : undefined,
    thinkingSteps: asArray<LegacyThinkingStep>(row.thinkingSteps),
    actions: asArray<SqlAssistantResponse["actions"][number]>(row.actions),
    executedActions: asArray<SqlAssistantResponse["executedActions"][number]>(row.executedActions),
    runResult: asRunResult(row.runResult),
    provider: row.provider && typeof row.provider === "object" ? (row.provider as SqlAssistantResponse["provider"]) : undefined,
    createdAt: row.createdAt.toISOString(),
  }
}

function mapConversation(row: {
  id: string
  title: string
  titleLocked: boolean
  lastMessageAt: Date
  createdAt: Date
  updatedAt: Date
  _count: { messages: number }
  messages: Array<{ contentMarkdown: string }>
}): SqlAssistantConversationSummary {
  return {
    id: row.id,
    title: row.title,
    titleLocked: row.titleLocked,
    lastMessageAt: row.lastMessageAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    messageCount: row._count.messages,
    preview: row.messages[0]?.contentMarkdown?.slice(0, 80) ?? "",
  }
}

export async function listSqlAssistantConversations(userId: string) {
  const rows = await prisma.sqlAssistantConversation.findMany({
    where: { userId, deletedAt: null },
    orderBy: { lastMessageAt: "desc" },
    take: 40,
    include: {
      _count: { select: { messages: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { contentMarkdown: true } },
    },
  })
  return rows.map(mapConversation)
}

export async function createSqlAssistantConversation(userId: string, title = "新会话") {
  const conversation = await prisma.sqlAssistantConversation.create({
    data: { userId, title: trimTitle(title) || "新会话" },
    include: {
      _count: { select: { messages: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { contentMarkdown: true } },
    },
  })
  return mapConversation(conversation)
}

export async function getSqlAssistantMessages(userId: string, conversationId: string) {
  const conversation = await prisma.sqlAssistantConversation.findFirst({
    where: { id: conversationId, userId, deletedAt: null },
    select: { id: true },
  })
  if (!conversation) throw new Error("SQL 助教会话不存在")
  const rows = await prisma.sqlAssistantMessage.findMany({
    where: { conversationId, userId },
    orderBy: { createdAt: "asc" },
  })
  return rows.map(mapMessage)
}

export async function renameSqlAssistantConversation(userId: string, conversationId: string, title: string) {
  const nextTitle = trimTitle(title)
  if (!nextTitle) throw new Error("会话名称不能为空")
  const conversation = await prisma.sqlAssistantConversation.update({
    where: { id: conversationId, userId },
    data: { title: nextTitle, titleLocked: true },
    include: {
      _count: { select: { messages: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { contentMarkdown: true } },
    },
  })
  return mapConversation(conversation)
}

export async function deleteSqlAssistantConversation(userId: string, conversationId: string) {
  await prisma.sqlAssistantConversation.update({
    where: { id: conversationId, userId },
    data: { deletedAt: new Date() },
  })
}

function failedAssistantResponse(error: unknown, title: string): SqlAssistantResponse {
  const message = error instanceof Error ? error.message : "Unknown error"
  return {
    message: `SQL 助教这次没有成功生成回复：${message}`,
    sql: "",
    title: title || "SQL 助教",
    reasoningMarkdown: [
      "### 生成失败",
      `助教在处理这条需求时失败：${message}`,
      "",
      "### 已保留的信息",
      "你的原始消息已经保存到当前会话，刷新页面后不会丢失。",
      "",
      "### 建议",
      "可以稍后重试，或者把需求拆小一点；如果是模型服务超时，通常重发一次即可。",
    ].join("\n"),
    selectedTables: [],
    catalogMatches: [],
    confidence: 0,
    actions: [],
    executedActions: [],
    provider: { label: "SQL Tutor", model: "-", source: "error" },
  }
}

export async function sendSqlAssistantMessage(userId: string, input: SendInput) {
  const prompt = input.prompt.trim()
  if (!prompt) throw new Error("请输入 SQL 助教需求")

  const conversation = input.conversationId
    ? await prisma.sqlAssistantConversation.findFirst({ where: { id: input.conversationId, userId, deletedAt: null } })
    : await prisma.sqlAssistantConversation.create({ data: { userId, title: "新会话" } })
  if (!conversation) throw new Error("SQL 助教会话不存在")

  const now = new Date()
  const earlyTitle = !conversation.titleLocked && isDefaultTitle(conversation.title)
    ? fallbackTitle(prompt)
    : conversation.title

  const [userMessage, conversationAfterUser] = await prisma.$transaction([
    prisma.sqlAssistantMessage.create({
      data: {
        conversationId: conversation.id,
        userId,
        role: "user",
        contentMarkdown: prompt,
      },
    }),
    prisma.sqlAssistantConversation.update({
      where: { id: conversation.id },
      data: { title: earlyTitle, lastMessageAt: now },
      include: {
        _count: { select: { messages: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { contentMarkdown: true } },
      },
    }),
  ])

  let response: SqlAssistantResponse
  try {
    response = await runSqlAssistant(userId, input)
  } catch (error) {
    response = failedAssistantResponse(error, earlyTitle)
  }

  const finalTitle = !conversationAfterUser.titleLocked && response.title && response.title !== "SQL Tutor"
    ? trimTitle(response.title) || conversationAfterUser.title
    : conversationAfterUser.title

  const [assistantMessage, updatedConversation] = await prisma.$transaction([
    prisma.sqlAssistantMessage.create({
      data: {
        conversationId: conversation.id,
        userId,
        role: "assistant",
        contentMarkdown: response.message,
        sql: response.sql,
        title: response.title,
        reasoningMarkdown: response.reasoningMarkdown,
        selectedTables: toJson(response.selectedTables),
        catalogMatches: toJson(response.catalogMatches),
        confidence: response.confidence,
        actions: toJson(response.actions),
        executedActions: toJson(response.executedActions),
        runResult: response.runResult === undefined ? Prisma.JsonNull : toJson(response.runResult),
        provider: toJson(response.provider),
      },
    }),
    prisma.sqlAssistantConversation.update({
      where: { id: conversation.id },
      data: { title: finalTitle, lastMessageAt: new Date() },
      include: {
        _count: { select: { messages: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { contentMarkdown: true } },
      },
    }),
  ])

  return {
    ...response,
    conversation: mapConversation(updatedConversation),
    userMessage: mapMessage(userMessage),
    assistantMessage: mapMessage(assistantMessage),
  }
}
