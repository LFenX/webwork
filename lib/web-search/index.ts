import "server-only"
import { prisma } from "@/lib/db"
import { aliyunWebSearch } from "@/lib/web-search/aliyun-web-search-provider"
import { resolveWebSearchCredential } from "@/lib/web-search/credential-service"
import type { WebSearchContentType, WebSearchOutput } from "@/lib/web-search/types"

const CACHE_TTL_MS = 30 * 60 * 1000
const USER_LIMIT_WINDOW_MS = 60 * 1000
const USER_LIMIT_COUNT = 5

type CacheEntry = {
  expiresAt: number
  value: WebSearchOutput
}

const cache = new Map<string, CacheEntry>()
const userLimit = new Map<string, number[]>()

function normalizeQuery(query: string) {
  return query.trim().replace(/\s+/g, " ").slice(0, 300)
}

function clampResults(value?: number) {
  if (!Number.isFinite(value)) return 5
  return Math.min(Math.max(Math.trunc(value ?? 5), 1), 10)
}

function cacheKey(parts: {
  query: string
  contentType: WebSearchContentType
  maxResults: number
  owner: string
}) {
  return [parts.owner, parts.contentType, parts.maxResults, parts.query.toLowerCase()].join("::")
}

function checkRateLimit(userId: string) {
  const now = Date.now()
  const recent = (userLimit.get(userId) ?? []).filter((time) => now - time < USER_LIMIT_WINDOW_MS)
  if (recent.length >= USER_LIMIT_COUNT) {
    userLimit.set(userId, recent)
    return false
  }
  recent.push(now)
  userLimit.set(userId, recent)
  return true
}

async function logWebSearch(params: {
  userId: string
  toolName: string
  query: string
  credentialSource: string
  credentialOwnerId: string
  resultCount: number
  status: string
  errorMessage?: string
}) {
  await prisma.aIWebSearchToolLog.create({
    data: {
      userId: params.userId,
      toolName: params.toolName,
      query: params.query,
      provider: "aliyun-opensearch",
      credentialSource: params.credentialSource,
      credentialOwnerId: params.credentialOwnerId,
      resultCount: params.resultCount,
      status: params.status,
      errorMessage: params.errorMessage ?? "",
    },
  }).catch(() => null)
}

export async function runWebSearchTool(params: {
  userId: string
  toolName: "web_search" | "web_verify_current_info"
  query: string
  maxResults?: number
  contentType?: WebSearchContentType
  queryRewrite?: boolean
}) {
  const query = normalizeQuery(params.query)
  const contentType = params.contentType === "summary" ? "summary" : "snippet"
  const maxResults = clampResults(params.maxResults)
  const credential = await resolveWebSearchCredential(params.userId)

  if (!credential.ok) {
    await logWebSearch({
      userId: params.userId,
      toolName: params.toolName,
      query,
      credentialSource: credential.source ?? "NONE",
      credentialOwnerId: credential.ownerId ?? "",
      resultCount: 0,
      status: "failed",
      errorMessage: credential.message,
    })
    return {
      ok: false,
      access: "self",
      summary: credential.message,
      reason: credential.message,
      data: { query, results: [], error: credential.message },
    }
  }

  if (!checkRateLimit(params.userId)) {
    const message = "联网搜索请求过于频繁，请稍后再试。"
    await logWebSearch({
      userId: params.userId,
      toolName: params.toolName,
      query,
      credentialSource: credential.source,
      credentialOwnerId: credential.ownerId,
      resultCount: 0,
      status: "failed",
      errorMessage: message,
    })
    return {
      ok: false,
      access: "self",
      summary: message,
      reason: message,
      data: { query, results: [], error: message },
    }
  }

  const key = cacheKey({
    query,
    contentType,
    maxResults,
    owner: `${credential.source}:${credential.ownerId}`,
  })
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    await logWebSearch({
      userId: params.userId,
      toolName: params.toolName,
      query,
      credentialSource: credential.source,
      credentialOwnerId: credential.ownerId,
      resultCount: cached.value.results.length,
      status: "completed",
    })
    return {
      ok: true,
      access: "self",
      summary: `联网搜索命中缓存，返回 ${cached.value.results.length} 条结果。`,
      data: { ...cached.value, cached: true, credentialSource: credential.source },
    }
  }

  const result = await aliyunWebSearch({
    query,
    maxResults,
    contentType,
    queryRewrite: params.queryRewrite,
    credential: credential.credential,
  })

  if (result.ok) {
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: result })
  }

  await logWebSearch({
    userId: params.userId,
    toolName: params.toolName,
    query,
    credentialSource: credential.source,
    credentialOwnerId: credential.ownerId,
    resultCount: result.results.length,
    status: result.ok ? "completed" : "failed",
    errorMessage: result.error,
  })

  return {
    ok: result.ok,
    access: "self",
    summary: result.ok
      ? `联网搜索完成，返回 ${result.results.length} 条结果。`
      : (result.error ?? "联网搜索失败。"),
    reason: result.ok ? undefined : result.error,
    data: { ...result, cached: false, credentialSource: credential.source },
  }
}

export function getWebSearchCacheStats() {
  return { size: cache.size, ttlMinutes: CACHE_TTL_MS / 60000 }
}
