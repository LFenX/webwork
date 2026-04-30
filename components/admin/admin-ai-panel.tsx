"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Bot, Check, ClipboardList, Hammer, Inbox, Loader2, PauseCircle, Play, RefreshCcw, Search, ShieldCheck, TestTube2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { getDict } from "@/lib/i18n"
import { confirmAction } from "@/lib/interaction-feedback"

type AdminAIOverview = {
  requestCounts: Record<string, number>
  grants: Array<{
    id: string
    userId: string
    status: string
    providerLabel: string
    baseUrl: string
    apiKeyMask: string
    model: string
    modelList: string[]
    temperature: number
    streamEnabled: boolean
    webSearchEnabled: boolean
    webSearch?: {
      enabled: boolean
      configured: boolean
      apiKeyMask: string
      host: string
      workspace: string
      serviceId: string
    }
    updatedAt: string
    user: { id: string; email: string; displayName: string }
  }>
  recentAudits: Array<{
    id: string
    action: string
    detail: string
    targetUserId: string | null
    createdAt: string
  }>
  tools: Array<{ name: string; title: string; description: string }>
}

type RequestItem = {
  id: string
  status: string
  message: string
  reviewNote: string
  createdAt: string
  reviewedAt: string | null
  user: { id: string; email: string; displayName: string }
  reviewedBy: { id: string; email: string; displayName: string } | null
  grant?: { id: string; status: string } | null
}

type MyConfigItem = {
  id: string
  name: string
  providerLabel: string
  baseUrl: string
  apiKey: string
  apiKeyMask: string
  model: string
  modelList: string[]
  temperature: number
  streamEnabled: boolean
  lastTestStatus: string
  lastTestedAt: string | null
}

type GrantForm = {
  userId: string
  requestId: string
  note: string
  providerLabel: string
  baseUrl: string
  apiKey: string
  model: string
  modelListText: string
  temperature: string
  streamEnabled: boolean
  webSearchEnabled: boolean
  webSearchApiKey: string
  webSearchHost: string
  webSearchWorkspace: string
  webSearchServiceId: string
}

type SearchResult = {
  id: string
  email: string
  displayName: string
  role: string
  hasGrant: boolean
  grantStatus: string | null
  grantProvider: string | null
}

const DEFAULT_GRANT_FORM: GrantForm = {
  userId: "",
  requestId: "",
  note: "",
  providerLabel: "System OpenAI-compatible",
  baseUrl: "",
  apiKey: "",
  model: "",
  modelListText: "",
  temperature: "0.7",
  streamEnabled: true,
  webSearchEnabled: false,
  webSearchApiKey: "",
  webSearchHost: "http://default-486s.platform-cn-shanghai.opensearch.aliyuncs.com",
  webSearchWorkspace: "default",
  webSearchServiceId: "ops-web-search-001",
}

function requestStatusBadge(status: string) {
  switch (status) {
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700"
    case "approved":
      return "border-blue-200 bg-blue-50 text-blue-700"
    case "configured":
      return "border-emerald-200 bg-emerald-50 text-emerald-700"
    case "rejected":
      return "border-red-200 bg-red-50 text-red-700"
    case "cancelled":
      return "border-slate-200 bg-slate-100 text-slate-500"
    default:
      return "border-slate-200 bg-slate-100 text-slate-500"
  }
}

function grantStatusBadge(status: string) {
  switch (status) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-700"
    case "paused":
      return "border-amber-200 bg-amber-50 text-amber-700"
    case "revoked":
      return "border-red-200 bg-red-50 text-red-700"
    case "deprecated":
      return "border-slate-200 bg-slate-100 text-slate-500"
    default:
      return "border-slate-200 bg-slate-100 text-slate-500"
  }
}

function requestStatusLabel(dp: ReturnType<typeof getDict>["admin"]["aiPanel"], status: string) {
  switch (status) {
    case "pending": return status
    case "approved": return dp.statusApproved
    case "configured": return dp.statusConfigured
    case "rejected": return dp.statusRejected
    case "cancelled": return dp.statusCancelled
    default: return status
  }
}

function grantStatusLabel(dp: ReturnType<typeof getDict>["admin"]["aiPanel"], status: string) {
  switch (status) {
    case "active": return dp.statusActive
    case "paused": return dp.statusPaused
    case "revoked": return dp.statusRevoked
    case "deprecated": return dp.statusDeprecated
    default: return status
  }
}

export function AdminAIPanel({ enabled }: { enabled: boolean }) {
  const dict = getDict()
  const dp = dict.admin.aiPanel

  const [overview, setOverview] = useState<AdminAIOverview | null>(null)
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(false)
  const [grantOpen, setGrantOpen] = useState(false)
  const [webSearchTesting, setWebSearchTesting] = useState(false)
  const [grantActionId, setGrantActionId] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState<RequestItem | null>(null)
  const [reviewNote, setReviewNote] = useState("")
  const [grantForm, setGrantForm] = useState<GrantForm>(DEFAULT_GRANT_FORM)
  const [grantMode, setGrantMode] = useState<"create" | "edit">("create")

  // User search state
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedUser, setSelectedUser] = useState<SearchResult | null>(null)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Import from my configs state
  const [myConfigs, setMyConfigs] = useState<MyConfigItem[]>([])
  const [myConfigsLoading, setMyConfigsLoading] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const [overviewRes, requestsRes] = await Promise.all([
        fetch("/api/admin/ai/overview", { cache: "no-store" }),
        fetch("/api/admin/ai/requests", { cache: "no-store" }),
      ])
      const overviewData = await overviewRes.json().catch(() => null)
      const requestsData = await requestsRes.json().catch(() => null)
      if (!overviewRes.ok) throw new Error(overviewData?.error ?? dp.failed)
      if (!requestsRes.ok) throw new Error(requestsData?.error ?? dp.failed)
      setOverview(overviewData)
      setRequests(Array.isArray(requestsData?.items) ? requestsData.items : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dp.failed)
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [enabled, load])

  const pendingCount = useMemo(() => requests.filter((item) => item.status === "pending").length, [requests])

  async function searchUsers(query: string) {
    setSearching(true)
    try {
      const url = query.trim()
        ? `/api/admin/users/search?q=${encodeURIComponent(query.trim())}`
        : "/api/admin/users/search"
      const res = await fetch(url, { cache: "no-store" })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "Search failed")
      const users: SearchResult[] = Array.isArray(data?.users) ? data.users : []
      if (!query.trim()) {
        // Default list — show all
        setSearchResults(users)
      } else {
        // Server-side search results
        setSearchResults(users)
      }
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  // Local filter: when user types, filter the already-loaded default list client-side
  function filteredResults(): SearchResult[] {
    const kw = searchQuery.trim().toLowerCase()
    if (!kw) return searchResults
    return searchResults.filter(
      (u) =>
        (u.displayName || "").toLowerCase().includes(kw) ||
        (u.email || "").toLowerCase().includes(kw),
    )
  }

  function handleSearchInput(value: string) {
    setSearchQuery(value)
    setSelectedUser(null)
    setGrantForm((current) => ({ ...current, userId: "" }))
    setHighlightIndex(-1)
    setDropdownOpen(true)

    // For empty to non-empty or non-empty to empty, do a quick server fetch
    // For refinement (non-empty to non-empty), just local filter
    const wasEmpty = !searchQuery.trim()
    const isEmpty = !value.trim()
    if ((wasEmpty || isEmpty) && !(wasEmpty && isEmpty)) {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
      searchTimerRef.current = setTimeout(() => {
        void searchUsers(value)
      }, 300)
    }
  }

  function handleInputFocus() {
    setDropdownOpen(true)
    // Load default list if not yet loaded
    if (searchResults.length === 0 && !searching) {
      void searchUsers("")
    }
  }

  function selectUser(user: SearchResult) {
    setSelectedUser(user)
    setSearchQuery("")
    setSearchResults([])
    setDropdownOpen(false)
    setHighlightIndex(-1)
    setGrantForm((current) => ({ ...current, userId: user.id }))
  }

  function clearSelectedUser() {
    setSelectedUser(null)
    setGrantForm((current) => ({ ...current, userId: "" }))
    setDropdownOpen(true)
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const filtered = filteredResults()
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setHighlightIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1))
    } else if (event.key === "Enter") {
      event.preventDefault()
      if (highlightIndex >= 0 && highlightIndex < filtered.length) {
        selectUser(filtered[highlightIndex])
      }
    } else if (event.key === "Escape") {
      setDropdownOpen(false)
    }
  }

  async function loadMyConfigs() {
    setMyConfigsLoading(true)
    try {
      const res = await fetch("/api/admin/ai/my-configs", { cache: "no-store" })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "Failed to load configs")
      setMyConfigs(Array.isArray(data?.configs) ? data.configs : [])
    } catch {
      setMyConfigs([])
    } finally {
      setMyConfigsLoading(false)
    }
  }

  function importFromMyConfig(config: MyConfigItem) {
    setGrantForm((current) => ({
      ...current,
      providerLabel: config.providerLabel,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey || "",
      model: config.model,
      modelListText: (config.modelList ?? []).join("\n"),
      temperature: String(config.temperature ?? 0.7),
      streamEnabled: config.streamEnabled,
      webSearchEnabled: false,
      webSearchApiKey: "",
      webSearchHost: "http://default-486s.platform-cn-shanghai.opensearch.aliyuncs.com",
      webSearchWorkspace: "default",
      webSearchServiceId: "ops-web-search-001",
    }))
    setImportOpen(false)
    toast.success("已导入配置，可继续修改后保存授权")
  }

  async function reviewRequest(action: "approve" | "reject") {
    if (!reviewing) return
    try {
      const res = await fetch(`/api/admin/ai/requests/${reviewing.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNote }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "Failed to review the request")
      toast.success(action === "approve" ? dp.requestApproved : dp.requestRejected)
      setReviewing(null)
      setReviewNote("")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to review the request")
    }
  }

  async function saveGrant() {
    if (!grantForm.userId) return
    const isCreate = grantMode === "create"
    try {
      const modelList = grantForm.modelListText
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)

      const body: Record<string, unknown> = {
        providerLabel: grantForm.providerLabel,
        baseUrl: grantForm.baseUrl,
        model: grantForm.model,
        temperature: Number(grantForm.temperature || "0.7"),
        streamEnabled: grantForm.streamEnabled,
        webSearchEnabled: grantForm.webSearchEnabled,
        modelList,
        webSearch: {
          enabled: grantForm.webSearchEnabled,
          apiKey: grantForm.webSearchApiKey,
          host: grantForm.webSearchHost,
          workspace: grantForm.webSearchWorkspace,
          serviceId: grantForm.webSearchServiceId,
        },
      }

      if (isCreate) {
        // Create mode: apiKey required, status always active
        body.apiKey = grantForm.apiKey
        body.status = "active"
        if (grantForm.requestId) body.requestId = grantForm.requestId
      } else {
        // Edit mode: apiKey optional, keep existing if empty
        if (grantForm.apiKey.trim()) {
          body.apiKey = grantForm.apiKey.trim()
        }
        // Don't force status — keep existing
      }

      if (grantForm.note) body.note = grantForm.note

      const res = await fetch(`/api/admin/ai/grants/${grantForm.userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "Failed to save the AI grant")
      toast.success(isCreate ? dp.grantSaved : dp.savedEdit)
      setGrantOpen(false)
      setGrantForm(DEFAULT_GRANT_FORM)
      setGrantMode("create")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save the AI grant")
    }
  }

  async function testGrantWebSearch() {
    if (!grantForm.userId) return
    setWebSearchTesting(true)
    try {
      const res = await fetch("/api/ai/tools/web-search/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "最近 AI 行业有什么热点",
          maxResults: 5,
          contentType: "snippet",
          adminGrantUserId: grantForm.userId,
          webSearch: {
            enabled: grantForm.webSearchEnabled,
            apiKey: grantForm.webSearchApiKey,
            host: grantForm.webSearchHost,
            workspace: grantForm.webSearchWorkspace,
            serviceId: grantForm.webSearchServiceId,
          },
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "联网搜索测试失败")
      if (!data?.result?.ok) throw new Error(data?.result?.error ?? "联网搜索测试失败")
      toast.success(`联网搜索测试成功，返回 ${data.result.results.length} 条结果`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "联网搜索测试失败")
    } finally {
      setWebSearchTesting(false)
    }
  }

  async function changeGrantStatus(userId: string, action: string) {
    setGrantActionId(`${action}:${userId}`)
    try {
      const res = await fetch(`/api/admin/ai/grants/${userId}/${action}`, { method: "POST" })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "Failed to update grant status")
      if (action === "pause") toast.success(dp.grantPaused)
      else if (action === "revoke") toast.success(dp.grantRevoked)
      else if (action === "restore") toast.success(dp.grantRestored)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update grant status")
    } finally {
      setGrantActionId(null)
    }
  }

  async function deleteGrant(userId: string) {
    if (!confirmAction(`${dp.deleteGrantConfirm}\n删除授权后该用户将无法继续使用这份管理员 AI 配置。`)) return
    setGrantActionId(`delete:${userId}`)
    try {
      const res = await fetch(`/api/admin/ai/grants/${userId}`, { method: "DELETE" })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "Failed to delete grant")
      toast.success(dp.grantDeleted)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete grant")
    } finally {
      setGrantActionId(null)
    }
  }

  function openGrantDialogForUser(userId: string, requestId?: string) {
    setGrantMode("create")
    setSearchQuery("")
    setDropdownOpen(false)
    setSelectedUser(null)
    setHighlightIndex(-1)
    // Load default user list
    void searchUsers("")
    // Pre-fill from existing grant if available
    const existing = overview?.grants.find((g) => g.userId === userId)
    if (existing) {
      setGrantForm({
        userId: existing.userId,
        requestId: requestId ?? "",
        note: "",
        providerLabel: existing.providerLabel,
        baseUrl: existing.baseUrl,
        apiKey: "",
        model: existing.model,
        modelListText: (existing.modelList ?? []).join("\n"),
        temperature: String(existing.temperature),
        streamEnabled: existing.streamEnabled,
        webSearchEnabled: Boolean(existing.webSearchEnabled),
        webSearchApiKey: "",
        webSearchHost: existing.webSearch?.host || "http://default-486s.platform-cn-shanghai.opensearch.aliyuncs.com",
        webSearchWorkspace: existing.webSearch?.workspace || "default",
        webSearchServiceId: existing.webSearch?.serviceId || "ops-web-search-001",
      })
    } else {
      const requestUser = requests.find((r) => r.user.id === userId)?.user
      if (requestUser) {
        setSelectedUser({
          id: requestUser.id,
          email: requestUser.email,
          displayName: requestUser.displayName,
          role: "user",
          hasGrant: false,
          grantStatus: null,
          grantProvider: null,
        })
      }
      setGrantForm({ ...DEFAULT_GRANT_FORM, userId, requestId: requestId ?? "" })
    }
    setGrantOpen(true)
  }

  function openNewGrantDialog() {
    setGrantMode("create")
    setSearchQuery("")
    setSearchResults([])
    setSelectedUser(null)
    setHighlightIndex(-1)
    setDropdownOpen(false)
    setGrantForm(DEFAULT_GRANT_FORM)
    // Load default user list when dialog opens
    void searchUsers("")
    setGrantOpen(true)
  }

  function openEditGrantDialog(grant: AdminAIOverview["grants"][number]) {
    setGrantMode("edit")
    setSearchQuery("")
    setSearchResults([])
    setDropdownOpen(false)
    setHighlightIndex(-1)
    // Pre-fill all fields from existing grant
    setGrantForm({
      userId: grant.userId,
      requestId: "",
      note: "",
      providerLabel: grant.providerLabel,
      baseUrl: grant.baseUrl,
      apiKey: "",
      model: grant.model,
      modelListText: (grant.modelList ?? []).join("\n"),
      temperature: String(grant.temperature),
      streamEnabled: grant.streamEnabled,
      webSearchEnabled: Boolean(grant.webSearchEnabled),
      webSearchApiKey: "",
      webSearchHost: grant.webSearch?.host || "http://default-486s.platform-cn-shanghai.opensearch.aliyuncs.com",
      webSearchWorkspace: grant.webSearch?.workspace || "default",
      webSearchServiceId: grant.webSearch?.serviceId || "ops-web-search-001",
    })
    // Set selected user for read-only display
    setSelectedUser({
      id: grant.user.id,
      email: grant.user.email,
      displayName: grant.user.displayName,
      role: "user",
      hasGrant: true,
      grantStatus: grant.status,
      grantProvider: grant.providerLabel,
    })
    setGrantOpen(true)
  }

  if (!enabled) return null

  const grants = overview?.grants ?? []
  const tools = overview?.tools ?? []
  const audits = overview?.recentAudits ?? []
  const activeGrantsCount = grants.filter((item) => item.status === "active").length
  const requestsToHandle = requests.filter((item) => item.status === "pending" || (item.status === "approved" && !item.grant?.id))

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bot size={18} />
          <h2 className="text-base font-semibold">{dp.title}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCcw size={14} /> {loading ? dp.refreshing : dp.refresh}
          </Button>
          <Button size="sm" onClick={openNewGrantDialog}>
            <ShieldCheck size={14} /> {dp.newGrant}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label={dp.pendingRequests} value={pendingCount} hint={requestsToHandle.length > 0 ? `${requestsToHandle.length} 项需要处理` : undefined} />
        <MetricCard label={dp.activeGrants} value={activeGrantsCount} hint={`共 ${grants.length} 条`} />
        <MetricCard label={dp.registeredTools} value={tools.length} />
        <MetricCard label="近期审计" value={audits.length} hint={audits[0] ? new Date(audits[0].createdAt).toLocaleString() : undefined} />
      </div>

      <Tabs defaultValue="requests" className="w-full">
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex h-auto min-w-full flex-nowrap gap-1 bg-[--color-bg-surface] p-1">
            <TabsTrigger value="requests" className="gap-1 px-3 py-2 text-xs sm:text-sm">
              <Inbox size={14} /> 访问申请
              {pendingCount > 0 ? (
                <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-medium text-amber-800">
                  {pendingCount}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="grants" className="gap-1 px-3 py-2 text-xs sm:text-sm">
              <ShieldCheck size={14} /> 系统授权
              <span className="ml-1 text-[10px] text-[--color-text-muted]">({grants.length})</span>
            </TabsTrigger>
            <TabsTrigger value="tools" className="gap-1 px-3 py-2 text-xs sm:text-sm">
              <Hammer size={14} /> 已注册工具
              <span className="ml-1 text-[10px] text-[--color-text-muted]">({tools.length})</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1 px-3 py-2 text-xs sm:text-sm">
              <ClipboardList size={14} /> 审计记录
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Access Requests */}
        <TabsContent value="requests" className="mt-4">
          <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-3 sm:p-4">
            {requests.length === 0 ? (
              <p className="py-6 text-center text-sm text-[--color-text-muted]">{dp.noRequests}</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {requests.map((item) => (
                  <RequestCard
                    key={item.id}
                    item={item}
                    dp={dp}
                    onReview={(target) => { setReviewing(target); setReviewNote("") }}
                    onConfigure={(userId, requestId) => openGrantDialogForUser(userId, requestId)}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* System Grants */}
        <TabsContent value="grants" className="mt-4">
          <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-3 sm:p-4">
            {grants.length === 0 ? (
              <p className="py-6 text-center text-sm text-[--color-text-muted]">{dp.noGrants}</p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {grants.map((grant) => (
                  <div key={grant.id} className="flex h-full flex-col rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-primary] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[--color-text-primary]">
                          {grant.user.displayName || grant.user.email}
                        </p>
                        <p className="truncate text-xs text-[--color-text-muted]">{grant.user.email}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-1 text-xs ${grantStatusBadge(grant.status)}`}>
                        {grantStatusLabel(dp, grant.status)}
                      </span>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-[--color-text-muted]">
                      <p><span className="text-[--color-text-secondary]">{grant.providerLabel}</span> · {grant.model}</p>
                      <p className="break-all">{grant.baseUrl}</p>
                      <p>API Key: <span className="font-mono">{grant.apiKeyMask || "—"}</span></p>
                      {grant.modelList.length > 0 ? (
                        <p>可选模型: {grant.modelList.slice(0, 4).join(", ")}{grant.modelList.length > 4 ? "..." : ""}</p>
                      ) : null}
                      <p>{dp.updated}: {new Date(grant.updatedAt).toLocaleString()}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {grant.status === "active" ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => changeGrantStatus(grant.userId, "pause")} loading={grantActionId === `pause:${grant.userId}`} loadingText={dp.pause}>
                            <PauseCircle size={14} /> {dp.pause}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => changeGrantStatus(grant.userId, "revoke")} loading={grantActionId === `revoke:${grant.userId}`} loadingText={dp.revoke}>
                            <Trash2 size={14} /> {dp.revoke}
                          </Button>
                        </>
                      ) : grant.status === "paused" ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => changeGrantStatus(grant.userId, "restore")} loading={grantActionId === `restore:${grant.userId}`} loadingText={dp.restore}>
                            <Play size={14} /> {dp.restore}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => changeGrantStatus(grant.userId, "revoke")} loading={grantActionId === `revoke:${grant.userId}`} loadingText={dp.revoke}>
                            <Trash2 size={14} /> {dp.revoke}
                          </Button>
                        </>
                      ) : (grant.status === "revoked" || grant.status === "deprecated") ? (
                        <Button size="sm" variant="outline" onClick={() => deleteGrant(grant.userId)} loading={grantActionId === `delete:${grant.userId}`} loadingText={dp.deleteGrant}>
                          <Trash2 size={14} /> {dp.deleteGrant}
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" onClick={() => openEditGrantDialog(grant)}>
                        {dict.common.edit}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Registered Tools */}
        <TabsContent value="tools" className="mt-4">
          <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-3 sm:p-4">
            {tools.length === 0 ? (
              <p className="py-6 text-center text-sm text-[--color-text-muted]">暂无已注册工具。</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {tools.map((tool) => (
                  <div key={tool.name} className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-primary] p-3">
                    <p className="truncate text-sm font-medium text-[--color-text-primary]">{tool.title}</p>
                    <p className="truncate font-mono text-xs text-[--color-text-muted]">{tool.name}</p>
                    <p className="mt-2 text-xs leading-5 text-[--color-text-secondary]">{tool.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Audit Logs */}
        <TabsContent value="audit" className="mt-4">
          <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-3 sm:p-4">
            {audits.length === 0 ? (
              <p className="py-6 text-center text-sm text-[--color-text-muted]">{dp.noAudit}</p>
            ) : (
              <div className="space-y-2">
                {audits.map((audit) => (
                  <div key={audit.id} className="rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-primary] px-3 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-medium text-[--color-text-primary]">{audit.action}</p>
                      <p className="text-xs text-[--color-text-muted]">{new Date(audit.createdAt).toLocaleString()}</p>
                    </div>
                    <p className="mt-1 text-xs text-[--color-text-secondary]">{audit.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={Boolean(reviewing)} onOpenChange={(open) => !open && setReviewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dp.reviewRequest}</DialogTitle>
            <DialogDescription>{dp.reviewRequestDesc}</DialogDescription>
          </DialogHeader>
          <Textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={4} placeholder={dp.optionalNote} />
          <DialogFooter>
            <Button variant="outline" onClick={() => void reviewRequest("reject")}>{dp.reject}</Button>
            <Button onClick={() => void reviewRequest("approve")}>{dp.approve}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grant Dialog */}
      <Dialog open={grantOpen} onOpenChange={(open) => { if (!open) { setGrantOpen(false); setSearchQuery(""); setSearchResults([]); setSelectedUser(null); setDropdownOpen(false); } }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{grantMode === "edit" ? dp.editGrantTitle : dp.configGrant}</DialogTitle>
            <DialogDescription>{grantMode === "edit" ? dp.editGrantDesc : dp.configGrantDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* User selection — edit mode: read-only; create mode: combobox */}
            {grantMode === "edit" ? (
              <div>
                <Label className="mb-1 block text-xs">{dp.grantUserInfo}</Label>
                <div className="rounded-[--radius-md] border border-blue-200 bg-blue-50 p-3">
                  <p className="text-sm font-medium text-blue-800">
                    {selectedUser?.displayName || grantForm.userId}
                  </p>
                  <p className="text-xs text-blue-700">{selectedUser?.email || ""}</p>
                </div>
              </div>
            ) : !selectedUser ? (
              <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
                <div>
                  <Label className="mb-1 block text-xs">{dp.targetUser}</Label>
                  <div className="flex items-center gap-2">
                    <PopoverTrigger asChild>
                      <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--color-text-muted] pointer-events-none" />
                        <Input
                          value={searchQuery}
                          onChange={(event) => handleSearchInput(event.target.value)}
                          onFocus={handleInputFocus}
                          onKeyDown={handleInputKeyDown}
                          placeholder={dp.searchUserPlaceholder}
                          className="pl-9"
                        />
                      </div>
                    </PopoverTrigger>
                    {searching ? <Loader2 size={16} className="animate-spin shrink-0 text-[--color-text-muted]" /> : null}
                  </div>
                </div>
                <PopoverContent
                  align="start"
                  side="bottom"
                  sideOffset={4}
                  className="w-[var(--radix-popover-trigger-width)] p-0 max-h-72 overflow-y-auto overflow-x-hidden overscroll-contain"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  {searching && searchResults.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                      <Loader2 size={14} className="animate-spin" />
                      加载中...
                    </div>
                  ) : filteredResults().length > 0 ? (
                    filteredResults().map((user, index) => (
                      <button
                        key={user.id}
                        type="button"
                        className={`w-full px-4 py-3 text-left transition-colors flex items-center justify-between ${
                          index === highlightIndex
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent hover:text-accent-foreground"
                        }`}
                        onClick={() => selectUser(user)}
                        onMouseEnter={() => setHighlightIndex(index)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {user.displayName || user.email}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {user.email} &middot; {user.role === "owner" ? "所有者" : user.role === "admin" ? "管理员" : "成员"}
                          </p>
                        </div>
                        <div className="ml-3 shrink-0 flex items-center gap-2">
                          {index === highlightIndex ? (
                            <Check size={14} className="text-foreground" />
                          ) : null}
                          {user.hasGrant ? (
                            <span className={`rounded-full border px-2 py-0.5 text-xs ${grantStatusBadge(user.grantStatus ?? "")}`}>
                              {user.grantProvider || "已有授权"}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    ))
                  ) : searchQuery.trim() && !searching ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground text-center">
                      {dp.noMatchingUsers}
                    </div>
                  ) : (!searching && !searchQuery.trim()) ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground text-center">
                      {dp.noUsersAvailable}
                    </div>
                  ) : null}
                </PopoverContent>
              </Popover>
            ) : (
              <div>
                <Label className="mb-1 block text-xs">{dp.targetUser}</Label>
                <div className="flex items-center justify-between rounded-[--radius-md] border border-emerald-200 bg-emerald-50 p-3">
                  <div>
                    <p className="text-sm font-medium text-emerald-800">
                      {selectedUser.displayName || selectedUser.email}
                    </p>
                    <p className="text-xs text-emerald-700">
                      {selectedUser.email} &middot; {selectedUser.role === "owner" ? "所有者" : selectedUser.role === "admin" ? "管理员" : "成员"}
                    </p>
                    {selectedUser.hasGrant ? (
                      <p className="mt-1 text-xs text-amber-700">
                        该用户已有{selectedUser.grantStatus === "active" ? "活跃" : ""}授权 ({selectedUser.grantProvider || "未知"})，创建后将更新现有授权
                      </p>
                    ) : null}
                  </div>
                  <Button size="sm" variant="ghost" onClick={clearSelectedUser}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            )}
            {/* Import from my configs */}
            <div className="rounded-[--radius-md] border border-dashed border-[--color-border] bg-[--color-bg-hover]/50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-[--color-text-primary]">从我的配置导入</p>
                  <p className="text-xs text-[--color-text-muted]">选择我已保存的 AI 配置，一键填充表单</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { void loadMyConfigs(); setImportOpen(true); }}
                >
                  从我的配置导入
                </Button>
              </div>
              {importOpen ? (
                <div className="mt-3 max-h-[220px] overflow-y-auto overflow-x-hidden overscroll-contain rounded-lg border border-[--color-border]">
                  {myConfigsLoading ? (
                    <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                      <Loader2 size={14} className="animate-spin" />
                      加载中...
                    </div>
                  ) : myConfigs.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground text-center">
                      暂无已保存的 AI 配置，请先在 AI 助手中创建配置
                    </div>
                  ) : (
                    myConfigs.map((config) => (
                      <button
                        key={config.id}
                        type="button"
                        className="w-full px-4 py-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground border-b border-[--color-border] last:border-b-0"
                        onClick={() => importFromMyConfig(config)}
                      >
                        <p className="text-sm font-medium truncate">{config.name || config.providerLabel}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {config.providerLabel} / {config.model}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{config.baseUrl}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          模型: {(config.modelList ?? []).slice(0, 4).join(", ")}{(config.modelList ?? []).length > 4 ? "..." : ""}
                          {" · "}测试: {config.lastTestStatus}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            <Field label={dp.providerLabel} value={grantForm.providerLabel} onChange={(value) => setGrantForm((current) => ({ ...current, providerLabel: value }))} name="ai-provider-label" autoComplete="off" />
            <Field label={dp.baseUrl} value={grantForm.baseUrl} onChange={(value) => setGrantForm((current) => ({ ...current, baseUrl: value }))} name="ai-provider-base-url" autoComplete="off" />
            <div>
              <Label className="mb-1 block text-xs">{dp.apiKey}</Label>
              <Input
                type="password"
                name="ai-provider-api-key"
                autoComplete="new-password"
                data-lpignore="true"
                value={grantForm.apiKey}
                onChange={(event) => setGrantForm((current) => ({ ...current, apiKey: event.target.value }))}
                placeholder={grantMode === "edit" ? dp.apiKeyEditPlaceholder : "请输入 API Key，例如 sk-..."}
              />
            </div>
            <Field label={dp.model} value={grantForm.model} onChange={(value) => setGrantForm((current) => ({ ...current, model: value }))} name="ai-default-model" autoComplete="off" />
            <div>
              <Label className="mb-1 block text-xs">{dp.modelListLabel}</Label>
              <Textarea
                value={grantForm.modelListText}
                onChange={(event) => setGrantForm((current) => ({ ...current, modelListText: event.target.value }))}
                rows={4}
                placeholder={"每行输入一个模型名，例如：\nqwen3.6-plus\nqwen3.6-flash\ndeepseek-v4-flash"}
                className="min-h-[90px] resize-y"
              />
              <p className="mt-1 text-xs text-[--color-text-muted]">{dp.modelListHint}</p>
            </div>
            <Field label={dp.temperature} value={grantForm.temperature} onChange={(value) => setGrantForm((current) => ({ ...current, temperature: value }))} />
            <div className="rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-hover]/50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[--color-text-primary]">开放联网搜索能力</p>
                  <p className="mt-1 text-xs leading-6 text-[--color-text-muted]">
                    开启后，该用户的蝶灵在使用管理员授权模型时，可以调用管理员提供的阿里联网搜索 API。联网搜索会消耗管理员配置的搜索额度。
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={grantForm.webSearchEnabled}
                  onChange={(event) => setGrantForm((current) => ({ ...current, webSearchEnabled: event.target.checked }))}
                />
              </div>
              <div className="mt-3 grid gap-3">
                <Field label="阿里云联网搜索 API Key" type="password" value={grantForm.webSearchApiKey} onChange={(value) => setGrantForm((current) => ({ ...current, webSearchApiKey: value }))} name="ai-web-search-key" autoComplete="new-password" />
                <Field label="Host" value={grantForm.webSearchHost} onChange={(value) => setGrantForm((current) => ({ ...current, webSearchHost: value }))} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Workspace" value={grantForm.webSearchWorkspace} onChange={(value) => setGrantForm((current) => ({ ...current, webSearchWorkspace: value }))} />
                  <Field label="Service ID" value={grantForm.webSearchServiceId} onChange={(value) => setGrantForm((current) => ({ ...current, webSearchServiceId: value }))} />
                </div>
                <Button type="button" variant="outline" onClick={() => void testGrantWebSearch()} disabled={webSearchTesting || !grantForm.webSearchEnabled || !grantForm.webSearchHost.trim()}>
                  <TestTube2 size={14} /> {webSearchTesting ? "测试中..." : "测试联网搜索"}
                </Button>
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-xs">备注/授权说明</Label>
              <Textarea
                value={grantForm.note}
                onChange={(event) => setGrantForm((current) => ({ ...current, note: event.target.value }))}
                rows={2}
                placeholder="可选：记录创建原因或备注"
                className="min-h-[54px] resize-y"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setGrantOpen(false); setSearchQuery(""); setSearchResults([]); setSelectedUser(null); setDropdownOpen(false); }}>{dp.cancel}</Button>
            <Button
              onClick={() => void saveGrant()}
              disabled={
                !grantForm.userId ||
                !grantForm.baseUrl ||
                !grantForm.model ||
                grantForm.modelListText.trim().length === 0 ||
                (grantMode === "create" && !grantForm.apiKey.trim())
              }
            >
              {grantMode === "edit" ? dp.saveEdit : dp.saveGrant}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function MetricCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
      <p className="text-xs text-[--color-text-muted]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[--color-text-primary]">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-[--color-text-muted]">{hint}</p> : null}
    </div>
  )
}

function RequestCard({
  item,
  dp,
  onReview,
  onConfigure,
}: {
  item: RequestItem
  dp: ReturnType<typeof getDict>["admin"]["aiPanel"]
  onReview: (item: RequestItem) => void
  onConfigure: (userId: string, requestId: string) => void
}) {
  const effectiveStatus =
    item.status === "approved" && item.grant?.id ? "configured" : item.status
  return (
    <div className={`flex h-full flex-col rounded-[--radius-lg] border p-4 ${item.status === "pending" ? "border-amber-200 bg-amber-50/30" : "border-[--color-border] bg-[--color-bg-primary]"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[--color-text-primary]">{item.user.displayName || item.user.email}</p>
          <p className="truncate text-xs text-[--color-text-muted]">{item.user.email}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-1 text-xs ${requestStatusBadge(item.status)}`}>
          {requestStatusLabel(dp, item.status)}
        </span>
      </div>
      {item.message ? (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[--color-text-secondary]">{item.message}</p>
      ) : null}
      {item.reviewNote ? (
        <p className="mt-1 break-words text-xs text-[--color-text-muted]">{dp.reviewNote}: {item.reviewNote}</p>
      ) : null}
      <p className="mt-2 text-xs text-[--color-text-muted]">
        {new Date(item.createdAt).toLocaleString()}
        {item.reviewedAt ? ` · ${dp.reviewNote}: ${new Date(item.reviewedAt).toLocaleString()}` : ""}
      </p>
      <div className="mt-auto pt-3">
        {effectiveStatus === "pending" ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => onReview(item)}>{dp.review}</Button>
            <Button size="sm" variant="outline" onClick={() => onConfigure(item.user.id, item.id)}>{dp.configureGrant}</Button>
          </div>
        ) : effectiveStatus === "approved" ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700">已通过，待配置授权</span>
            <Button size="sm" variant="outline" onClick={() => onConfigure(item.user.id, item.id)}>{dp.configureGrant}</Button>
          </div>
        ) : effectiveStatus === "configured" ? (
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">已配置授权</span>
        ) : null}
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  name,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  name?: string
  autoComplete?: string
}) {
  return (
    <div>
      <Label className="mb-1 block text-xs">{label}</Label>
      <Input
        type={type}
        name={name}
        autoComplete={autoComplete ?? "off"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
