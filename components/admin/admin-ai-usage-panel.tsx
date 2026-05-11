"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Activity, BarChart3, ChevronRight, Loader2, RefreshCcw, Users } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Overview = {
  totals: {
    totalRequests: number
    totalCalls: number
    totalTokens: number
    inputTokens: number
    outputTokens: number
    cachedInputTokens: number
    reasoningTokens: number
    toolCallCount: number
    activeUsers: number
    failedCalls: number
    callsWithRealUsage: number
    conversations: number
    avgLatencyMs: number
  }
  configSourceBreakdown: Array<{
    configSource: string
    callCount: number
    totalTokens: number
    userCount: number
  }>
}

type ByUserRow = {
  userId: string
  email: string
  displayName: string
  conversationCount: number
  runCount: number
  callCount: number
  totalTokens: number
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  toolCallCount: number
  failedCalls: number
  topModel: string | null
  topProvider: string | null
  topConfigSource: string | null
  lastUsedAt: string | null
}

type ByModelRow = {
  model: string
  providerLabel: string
  callCount: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  userCount: number
  toolCallCount: number
}

type UsageOptions = {
  providers: string[]
  models: string[]
}

type TimeseriesPoint = {
  bucket: string
  callCount: number
  totalTokens: number
  inputTokens: number
  outputTokens: number
}

type UserDetail = {
  user: { id: string; email: string; displayName: string }
  totals: Overview["totals"]
  modelBreakdown: ByModelRow[]
  configSourceBreakdown: Overview["configSourceBreakdown"]
  timeline: TimeseriesPoint[]
  conversations: Array<{
    id: string
    title: string
    callCount: number
    totalTokens: number
    inputTokens: number
    outputTokens: number
    lastUsedAt: string | null
  }>
  toolCalls: Array<{ toolName: string; callCount: number; failedCount: number; lastUsedAt: string | null }>
}

const CONFIG_SOURCE_LABELS: Record<string, string> = {
  user_config: "用户自配",
  admin_grant: "管理员授权",
  system_default: "系统默认",
  unknown: "未知来源",
}

function configSourceLabel(value: string) {
  return CONFIG_SOURCE_LABELS[value] ?? value
}

function formatNumber(value: number | undefined | null) {
  if (value === undefined || value === null) return "0"
  return new Intl.NumberFormat("zh-CN").format(value)
}

function formatDateTime(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

function buildQuery(filter: { from?: string; to?: string; userId?: string; provider?: string; model?: string; configSource?: string }) {
  const params = new URLSearchParams()
  if (filter.from) params.set("from", filter.from)
  if (filter.to) params.set("to", filter.to)
  if (filter.userId) params.set("userId", filter.userId)
  if (filter.provider) params.set("provider", filter.provider)
  if (filter.model) params.set("model", filter.model)
  if (filter.configSource) params.set("configSource", filter.configSource)
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

export function AdminAIUsagePanel({ enabled }: { enabled: boolean }) {
  const [from, setFrom] = useState<string>(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [provider, setProvider] = useState<string>("all")
  const [model, setModel] = useState<string>("all")
  const [configSource, setConfigSource] = useState<string>("all")

  const [options, setOptions] = useState<UsageOptions | null>(null)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [byUser, setByUser] = useState<ByUserRow[]>([])
  const [byModel, setByModel] = useState<ByModelRow[]>([])
  const [loading, setLoading] = useState(false)

  const [detailUserId, setDetailUserId] = useState<string | null>(null)
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const filterQuery = useMemo(() => {
    const fromIso = from ? new Date(`${from}T00:00:00`).toISOString() : ""
    const toIso = to ? new Date(`${to}T23:59:59`).toISOString() : ""
    return buildQuery({
      from: fromIso,
      to: toIso,
      provider: provider !== "all" ? provider : "",
      model: model !== "all" ? model : "",
      configSource: configSource !== "all" ? configSource : "",
    })
  }, [from, to, provider, model, configSource])

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const [overviewRes, byUserRes, byModelRes, optionsRes] = await Promise.all([
        fetch(`/api/admin/ai/usage/overview${filterQuery}`, { cache: "no-store" }),
        fetch(`/api/admin/ai/usage/by-user${filterQuery}`, { cache: "no-store" }),
        fetch(`/api/admin/ai/usage/by-model${filterQuery}`, { cache: "no-store" }),
        fetch(`/api/admin/ai/usage/options`, { cache: "no-store" }),
      ])

      if (!overviewRes.ok) throw new Error("加载总体统计失败")
      if (!byUserRes.ok) throw new Error("加载用户统计失败")
      if (!byModelRes.ok) throw new Error("加载模型统计失败")

      const overviewData = (await overviewRes.json()) as Overview
      const byUserData = (await byUserRes.json()) as { items: ByUserRow[] }
      const byModelData = (await byModelRes.json()) as { items: ByModelRow[] }
      const optionsData = optionsRes.ok ? ((await optionsRes.json()) as UsageOptions) : { providers: [], models: [] }

      setOverview(overviewData)
      setByUser(byUserData.items ?? [])
      setByModel(byModelData.items ?? [])
      setOptions(optionsData)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载 AI 使用统计失败")
    } finally {
      setLoading(false)
    }
  }, [enabled, filterQuery])

  useEffect(() => {
    if (!enabled) return
    const timeoutId = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [enabled, load])

  const loadDetail = useCallback(
    async (userId: string) => {
      setDetailLoading(true)
      try {
        const res = await fetch(`/api/admin/ai/usage/users/${encodeURIComponent(userId)}${filterQuery}`, {
          cache: "no-store",
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.error || "加载用户详情失败")
        }
        const data = (await res.json()) as UserDetail
        setDetail(data)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "加载用户详情失败")
        setDetail(null)
      } finally {
        setDetailLoading(false)
      }
    },
    [filterQuery],
  )

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (detailUserId) {
        void loadDetail(detailUserId)
      } else {
        setDetail(null)
      }
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [detailUserId, loadDetail])

  if (!enabled) return null

  const totals = overview?.totals ?? null
  const realUsageRate = totals && totals.totalCalls > 0 ? Math.round((totals.callsWithRealUsage / totals.totalCalls) * 100) : 0

  return (
    <section className="space-y-5 rounded-[22px] border border-white/80 bg-white p-4 shadow-[0_16px_45px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/70 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} />
          <h2 className="text-base font-semibold">AI 使用统计 · Token 控制台</h2>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCcw size={14} /> {loading ? "刷新中..." : "刷新"}
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-3 sm:p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label className="mb-1 block text-xs">起始日期</Label>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} max={to || undefined} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">结束日期</Label>
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} min={from || undefined} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="全部" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部 Provider</SelectItem>
                {(options?.providers ?? []).map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="全部" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部 Model</SelectItem>
                {(options?.models ?? []).map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">配置来源</Label>
            <Select value={configSource} onValueChange={setConfigSource}>
              <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="全部" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部来源</SelectItem>
                <SelectItem value="user_config">用户自配</SelectItem>
                <SelectItem value="admin_grant">管理员授权</SelectItem>
                <SelectItem value="system_default">系统默认</SelectItem>
                <SelectItem value="unknown">未知来源</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-[--color-text-muted]">
          注：token 数据来自 provider 返回的 usage 字段。当 provider 没有返回真实 usage 时，token 计为 0 并标记为非真实统计——本面板从不估算 token。
        </p>
      </div>

      {/* Overview Metrics */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="总请求数 (runs)" value={formatNumber(totals?.totalRequests)} hint={`对话轮次 ${formatNumber(totals?.totalCalls)} 次`} />
        <Metric label="总 Token" value={formatNumber(totals?.totalTokens)} hint={`真实 usage 占比 ${realUsageRate}%`} />
        <Metric label="输入 / 输出 Token" value={`${formatNumber(totals?.inputTokens)} / ${formatNumber(totals?.outputTokens)}`} hint={`缓存命中 ${formatNumber(totals?.cachedInputTokens)}`} />
        <Metric label="活跃用户数" value={formatNumber(totals?.activeUsers)} hint={`会话 ${formatNumber(totals?.conversations)} 个`} />
        <Metric label="工具调用次数" value={formatNumber(totals?.toolCallCount)} hint={`失败 ${formatNumber(totals?.failedCalls)} 次`} />
        <Metric label="推理 Token" value={formatNumber(totals?.reasoningTokens)} hint="仅推理模型返回" />
        <Metric label="平均延迟" value={`${formatNumber(totals?.avgLatencyMs)} ms`} hint="Provider 响应耗时" />
        <Metric
          label="配置来源 Top"
          value={overview?.configSourceBreakdown[0] ? configSourceLabel(overview.configSourceBreakdown[0].configSource) : "—"}
          hint={overview?.configSourceBreakdown[0] ? `${formatNumber(overview.configSourceBreakdown[0].totalTokens)} tok / ${overview.configSourceBreakdown[0].userCount} 用户` : undefined}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="w-full">
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex h-auto min-w-full flex-nowrap gap-1 bg-[--color-bg-surface] p-1">
            <TabsTrigger value="users" className="gap-1 px-3 py-2 text-xs sm:text-sm">
              <Users size={14} /> 按用户统计
            </TabsTrigger>
            <TabsTrigger value="models" className="gap-1 px-3 py-2 text-xs sm:text-sm">
              <Activity size={14} /> 按模型 / Provider
            </TabsTrigger>
            <TabsTrigger value="sources" className="gap-1 px-3 py-2 text-xs sm:text-sm">
              <BarChart3 size={14} /> 配置来源
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="users" className="mt-4">
          <div className="overflow-hidden rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="bg-[--color-bg-primary]">
                    <Th>用户</Th>
                    <Th align="right">会话</Th>
                    <Th align="right">轮次</Th>
                    <Th align="right">消息 (calls)</Th>
                    <Th align="right">总 Token</Th>
                    <Th align="right">输入 / 输出</Th>
                    <Th align="right">工具调用</Th>
                    <Th>主要 Provider / Model</Th>
                    <Th>主要来源</Th>
                    <Th>最近使用</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {byUser.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="border-b border-[--color-border] px-4 py-6 text-center text-sm text-[--color-text-muted]">
                        当前过滤条件下暂无 AI 使用记录。
                      </td>
                    </tr>
                  ) : (
                    byUser.map((row) => (
                      <tr key={row.userId} className="hover:bg-[--color-bg-hover]">
                        <Td>
                          <p className="text-sm font-medium text-[--color-text-primary]">{row.displayName || row.email}</p>
                          <p className="font-mono text-xs text-[--color-text-muted]">{row.email}</p>
                        </Td>
                        <Td align="right">{formatNumber(row.conversationCount)}</Td>
                        <Td align="right">{formatNumber(row.runCount)}</Td>
                        <Td align="right">{formatNumber(row.callCount)}</Td>
                        <Td align="right">
                          <span className="font-medium">{formatNumber(row.totalTokens)}</span>
                          {row.cachedInputTokens > 0 ? (
                            <p className="text-[11px] text-[--color-text-muted]">缓存 {formatNumber(row.cachedInputTokens)}</p>
                          ) : null}
                        </Td>
                        <Td align="right">{formatNumber(row.inputTokens)} / {formatNumber(row.outputTokens)}</Td>
                        <Td align="right">{formatNumber(row.toolCallCount)}</Td>
                        <Td>
                          <p className="truncate text-xs text-[--color-text-secondary]">{row.topProvider ?? "—"}</p>
                          <p className="truncate font-mono text-[11px] text-[--color-text-muted]">{row.topModel ?? "—"}</p>
                        </Td>
                        <Td>
                          <span className="rounded-full border border-[--color-border] bg-[--color-bg-primary] px-2 py-0.5 text-[11px]">
                            {configSourceLabel(row.topConfigSource ?? "unknown")}
                          </span>
                        </Td>
                        <Td>{formatDateTime(row.lastUsedAt)}</Td>
                        <Td align="right">
                          <Button size="sm" variant="ghost" onClick={() => setDetailUserId(row.userId)}>
                            详情 <ChevronRight size={14} />
                          </Button>
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="models" className="mt-4">
          <div className="overflow-hidden rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="bg-[--color-bg-primary]">
                    <Th>Provider</Th>
                    <Th>Model</Th>
                    <Th align="right">Calls</Th>
                    <Th align="right">用户数</Th>
                    <Th align="right">总 Token</Th>
                    <Th align="right">输入 / 输出</Th>
                    <Th align="right">工具调用</Th>
                  </tr>
                </thead>
                <tbody>
                  {byModel.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="border-b border-[--color-border] px-4 py-6 text-center text-sm text-[--color-text-muted]">
                        暂无 AI 使用记录。
                      </td>
                    </tr>
                  ) : (
                    byModel.map((row) => (
                      <tr key={`${row.providerLabel}::${row.model}`} className="hover:bg-[--color-bg-hover]">
                        <Td>{row.providerLabel || "—"}</Td>
                        <Td><span className="font-mono text-xs">{row.model || "—"}</span></Td>
                        <Td align="right">{formatNumber(row.callCount)}</Td>
                        <Td align="right">{formatNumber(row.userCount)}</Td>
                        <Td align="right">{formatNumber(row.totalTokens)}</Td>
                        <Td align="right">{formatNumber(row.inputTokens)} / {formatNumber(row.outputTokens)}</Td>
                        <Td align="right">{formatNumber(row.toolCallCount)}</Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sources" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(overview?.configSourceBreakdown ?? []).length === 0 ? (
              <p className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-6 text-center text-sm text-[--color-text-muted] sm:col-span-2 lg:col-span-4">
                暂无 AI 使用记录。
              </p>
            ) : (
              (overview?.configSourceBreakdown ?? []).map((item) => (
                <div key={item.configSource} className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
                  <p className="text-xs text-[--color-text-muted]">{configSourceLabel(item.configSource)}</p>
                  <p className="mt-2 text-2xl font-semibold text-[--color-text-primary]">{formatNumber(item.totalTokens)}</p>
                  <p className="mt-1 text-xs text-[--color-text-muted]">
                    Calls {formatNumber(item.callCount)} · 用户 {formatNumber(item.userCount)}
                  </p>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* User Detail Dialog */}
      <Dialog open={Boolean(detailUserId)} onOpenChange={(open) => { if (!open) { setDetailUserId(null); setDetail(null) } }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>用户 AI 使用详情</DialogTitle>
            <DialogDescription>
              本面板仅展示统计与元信息（模型、provider、token 计数、工具名）。不展示完整 prompt、回复内容或 API key。
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[--color-text-muted]">
              <Loader2 size={16} className="animate-spin" /> 加载中...
            </div>
          ) : detail ? (
            <UserDetailView detail={detail} />
          ) : (
            <p className="py-12 text-center text-sm text-[--color-text-muted]">没有详情数据。</p>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-[18px] border border-slate-200/80 bg-slate-50/70 p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold tabular-nums text-slate-950">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  )
}

function Th({ children, align }: { children?: React.ReactNode; align?: "left" | "right" | "center" }) {
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
  return (
    <th className={`sticky top-0 border-b border-[--color-border] bg-[--color-bg-primary] px-3 py-2 text-xs font-medium text-[--color-text-muted] ${alignClass}`}>
      {children}
    </th>
  )
}

function Td({ children, align }: { children?: React.ReactNode; align?: "left" | "right" | "center" }) {
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
  return (
    <td className={`border-b border-[--color-border] bg-[--color-bg-surface] px-3 py-2.5 align-top text-sm ${alignClass}`}>
      {children}
    </td>
  )
}

function UserDetailView({ detail }: { detail: UserDetail }) {
  const realUsageRate = detail.totals.totalCalls > 0 ? Math.round((detail.totals.callsWithRealUsage / detail.totals.totalCalls) * 100) : 0
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium">{detail.user.displayName || detail.user.email}</p>
        <p className="font-mono text-xs text-[--color-text-muted]">{detail.user.email}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="总 Token" value={formatNumber(detail.totals.totalTokens)} hint={`真实 ${realUsageRate}%`} />
        <Metric label="输入 / 输出" value={`${formatNumber(detail.totals.inputTokens)} / ${formatNumber(detail.totals.outputTokens)}`} />
        <Metric label="对话轮次" value={formatNumber(detail.totals.totalCalls)} hint={`requests ${formatNumber(detail.totals.totalRequests)}`} />
        <Metric label="工具调用" value={formatNumber(detail.totals.toolCallCount)} hint={`失败 ${formatNumber(detail.totals.failedCalls)}`} />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-[--color-text-secondary]">模型分布</p>
        <div className="overflow-hidden rounded-[--radius-md] border border-[--color-border]">
          <table className="w-full border-separate border-spacing-0 text-xs">
            <thead>
              <tr className="bg-[--color-bg-primary]">
                <Th>Provider</Th>
                <Th>Model</Th>
                <Th align="right">Calls</Th>
                <Th align="right">总 Token</Th>
              </tr>
            </thead>
            <tbody>
              {detail.modelBreakdown.length === 0 ? (
                <tr><td colSpan={4} className="border-b border-[--color-border] bg-[--color-bg-surface] px-3 py-3 text-center text-[--color-text-muted]">无</td></tr>
              ) : detail.modelBreakdown.map((row) => (
                <tr key={`${row.providerLabel}::${row.model}`}>
                  <Td>{row.providerLabel || "—"}</Td>
                  <Td><span className="font-mono">{row.model || "—"}</span></Td>
                  <Td align="right">{formatNumber(row.callCount)}</Td>
                  <Td align="right">{formatNumber(row.totalTokens)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-[--color-text-secondary]">配置来源分布</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {detail.configSourceBreakdown.length === 0 ? (
            <p className="text-xs text-[--color-text-muted]">无</p>
          ) : detail.configSourceBreakdown.map((row) => (
            <div key={row.configSource} className="rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-primary] px-3 py-2 text-xs">
              <span className="font-medium">{configSourceLabel(row.configSource)}</span>
              <span className="ml-2 text-[--color-text-muted]">{formatNumber(row.totalTokens)} tok · {formatNumber(row.callCount)} calls</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-[--color-text-secondary]">对话列表（按 token 排序）</p>
        <div className="overflow-hidden rounded-[--radius-md] border border-[--color-border]">
          <table className="w-full border-separate border-spacing-0 text-xs">
            <thead>
              <tr className="bg-[--color-bg-primary]">
                <Th>会话标题</Th>
                <Th align="right">Calls</Th>
                <Th align="right">总 Token</Th>
                <Th>最近使用</Th>
              </tr>
            </thead>
            <tbody>
              {detail.conversations.length === 0 ? (
                <tr><td colSpan={4} className="border-b border-[--color-border] bg-[--color-bg-surface] px-3 py-3 text-center text-[--color-text-muted]">无</td></tr>
              ) : detail.conversations.map((row) => (
                <tr key={row.id}>
                  <Td><p className="truncate">{row.title}</p></Td>
                  <Td align="right">{formatNumber(row.callCount)}</Td>
                  <Td align="right">{formatNumber(row.totalTokens)}</Td>
                  <Td>{formatDateTime(row.lastUsedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-[--color-text-secondary]">工具调用情况</p>
        <div className="overflow-hidden rounded-[--radius-md] border border-[--color-border]">
          <table className="w-full border-separate border-spacing-0 text-xs">
            <thead>
              <tr className="bg-[--color-bg-primary]">
                <Th>工具</Th>
                <Th align="right">调用</Th>
                <Th align="right">失败</Th>
                <Th>最近调用</Th>
              </tr>
            </thead>
            <tbody>
              {detail.toolCalls.length === 0 ? (
                <tr><td colSpan={4} className="border-b border-[--color-border] bg-[--color-bg-surface] px-3 py-3 text-center text-[--color-text-muted]">无</td></tr>
              ) : detail.toolCalls.map((row) => (
                <tr key={row.toolName}>
                  <Td><span className="font-mono">{row.toolName}</span></Td>
                  <Td align="right">{formatNumber(row.callCount)}</Td>
                  <Td align="right">{formatNumber(row.failedCount)}</Td>
                  <Td>{formatDateTime(row.lastUsedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detail.timeline.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium text-[--color-text-secondary]">使用趋势 (近 50 个数据点)</p>
          <div className="overflow-x-auto rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-primary] p-2">
            <SparklineRow points={detail.timeline.slice(-50)} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SparklineRow({ points }: { points: TimeseriesPoint[] }) {
  if (points.length === 0) return null
  const maxValue = Math.max(...points.map((p) => p.totalTokens), 1)
  return (
    <div className="flex items-end gap-1" style={{ minHeight: 56 }}>
      {points.map((p) => {
        const height = Math.max(4, Math.round((p.totalTokens / maxValue) * 48))
        return (
          <div key={p.bucket} className="flex flex-col items-center gap-1" title={`${p.bucket} · ${p.totalTokens} tok / ${p.callCount} calls`}>
            <div className="w-2 rounded-sm bg-[--color-text-primary]/70" style={{ height }} />
          </div>
        )
      })}
    </div>
  )
}
