import "server-only"
import type { WebSearchInput, WebSearchOutput } from "@/lib/web-search/types"

const DEFAULT_WORKSPACE = "default"
const DEFAULT_SERVICE_ID = "ops-web-search-001"
const MAX_QUERY_LENGTH = 300
const MAX_RESULTS = 10
const DEFAULT_RESULTS = 5
const MAX_CONTENT_LENGTH = 1200

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(Math.trunc(value), min), max)
}

function trimText(value: unknown, maxLength = MAX_CONTENT_LENGTH) {
  if (typeof value !== "string") return undefined
  const normalized = value.replace(/\s+/g, " ").trim()
  if (!normalized) return undefined
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized
}

function buildUrl(host: string, workspace?: string, serviceId?: string) {
  const normalizedHost = host.trim().replace(/\/+$/, "")
  const encodedWorkspace = encodeURIComponent((workspace?.trim() || DEFAULT_WORKSPACE))
  const encodedServiceId = encodeURIComponent((serviceId?.trim() || DEFAULT_SERVICE_ID))
  return `${normalizedHost}/v3/openapi/workspaces/${encodedWorkspace}/web-search/${encodedServiceId}`
}

export async function aliyunWebSearch(input: WebSearchInput): Promise<WebSearchOutput> {
  const query = input.query.trim().slice(0, MAX_QUERY_LENGTH)
  if (!query) return { ok: false, query: "", results: [], error: "搜索关键词不能为空。" }

  const apiKey = input.credential.apiKey.trim()
  const host = input.credential.host.trim()
  if (!apiKey || !host) {
    return { ok: false, query, results: [], error: "联网搜索凭证不完整。" }
  }

  const topK = clamp(input.maxResults ?? DEFAULT_RESULTS, 1, MAX_RESULTS)
  const contentType = input.contentType === "summary" ? "summary" : "snippet"
  const queryRewrite = input.queryRewrite ?? true

  try {
    const response = await fetch(buildUrl(host, input.credential.workspace, input.credential.serviceId), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        query_rewrite: queryRewrite,
        top_k: topK,
        content_type: contentType,
      }),
    })

    const payload = await response.json().catch(() => null) as {
      result?: { search_result?: Array<Record<string, unknown>> }
      usage?: unknown
      message?: unknown
      error?: unknown
    } | null

    if (!response.ok) {
      const message = typeof payload?.message === "string"
        ? payload.message
        : typeof payload?.error === "string"
          ? payload.error
          : `阿里云联网搜索请求失败（HTTP ${response.status}）。`
      return { ok: false, query, results: [], error: message }
    }

    const rawResults = Array.isArray(payload?.result?.search_result) ? payload.result.search_result : []
    const results = rawResults.slice(0, topK).map((item) => ({
      title: trimText(item.title, 180) ?? "Untitled",
      url: trimText(item.link, 600) ?? "",
      snippet: trimText(item.snippet, 500),
      content: trimText(item.content),
      position: typeof item.position === "number" ? item.position : undefined,
    })).filter((item) => item.url)

    return {
      ok: true,
      query,
      results,
      usage: payload?.usage,
    }
  } catch (error) {
    return {
      ok: false,
      query,
      results: [],
      error: error instanceof Error ? error.message : "联网搜索请求异常。",
    }
  }
}
