"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Bot, PauseCircle, RefreshCcw, ShieldCheck, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

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
    temperature: number
    streamEnabled: boolean
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
}

type GrantForm = {
  userId: string
  providerLabel: string
  baseUrl: string
  apiKey: string
  model: string
  temperature: string
  streamEnabled: boolean
}

const DEFAULT_GRANT_FORM: GrantForm = {
  userId: "",
  providerLabel: "System OpenAI-compatible",
  baseUrl: "",
  apiKey: "",
  model: "",
  temperature: "0.7",
  streamEnabled: true,
}

export function AdminAIPanel({ enabled }: { enabled: boolean }) {
  const [overview, setOverview] = useState<AdminAIOverview | null>(null)
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(false)
  const [grantOpen, setGrantOpen] = useState(false)
  const [reviewing, setReviewing] = useState<RequestItem | null>(null)
  const [reviewNote, setReviewNote] = useState("")
  const [grantForm, setGrantForm] = useState<GrantForm>(DEFAULT_GRANT_FORM)

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
      if (!overviewRes.ok) throw new Error(overviewData?.error ?? "加载 AI 管理概览失败")
      if (!requestsRes.ok) throw new Error(requestsData?.error ?? "加载 AI 申请列表失败")
      setOverview(overviewData)
      setRequests(Array.isArray(requestsData?.items) ? requestsData.items : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载 AI 管理面板失败")
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    Promise.resolve().then(() => {
      void load()
    })
  }, [enabled, load])

  const pendingCount = useMemo(() => requests.filter((item) => item.status === "pending").length, [requests])

  async function reviewRequest(action: "approve" | "reject") {
    if (!reviewing) return
    try {
      const res = await fetch(`/api/admin/ai/requests/${reviewing.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNote }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "处理申请失败")
      toast.success(action === "approve" ? "已批准 AI 申请" : "已拒绝 AI 申请")
      setReviewing(null)
      setReviewNote("")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "处理申请失败")
    }
  }

  async function saveGrant() {
    try {
      const res = await fetch(`/api/admin/ai/grants/${grantForm.userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerLabel: grantForm.providerLabel,
          baseUrl: grantForm.baseUrl,
          apiKey: grantForm.apiKey,
          model: grantForm.model,
          temperature: Number(grantForm.temperature || "0.7"),
          streamEnabled: grantForm.streamEnabled,
          status: "active",
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "保存授权失败")
      toast.success("系统 AI 授权已保存")
      setGrantOpen(false)
      setGrantForm(DEFAULT_GRANT_FORM)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存授权失败")
    }
  }

  async function changeGrantStatus(userId: string, action: "pause" | "revoke") {
    try {
      const res = await fetch(`/api/admin/ai/grants/${userId}/${action}`, { method: "POST" })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "更新授权失败")
      toast.success(action === "pause" ? "已暂停授权" : "已撤销授权")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新授权失败")
    }
  }

  if (!enabled) return null

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bot size={16} />
          <h2 className="text-sm font-semibold">AI 助手管理</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCcw size={14} /> {loading ? "刷新中..." : "刷新"}
          </Button>
          <Button size="sm" onClick={() => setGrantOpen(true)}>
            <ShieldCheck size={14} /> 新建授权
          </Button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
          <p className="text-xs text-[--color-text-muted]">待处理申请</p>
          <p className="mt-2 text-2xl font-semibold text-[--color-text-primary]">{pendingCount}</p>
        </div>
        <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
          <p className="text-xs text-[--color-text-muted]">激活授权</p>
          <p className="mt-2 text-2xl font-semibold text-[--color-text-primary]">
            {overview?.grants.filter((item) => item.status === "active").length ?? 0}
          </p>
        </div>
        <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
          <p className="text-xs text-[--color-text-muted]">已注册工具</p>
          <p className="mt-2 text-2xl font-semibold text-[--color-text-primary]">{overview?.tools.length ?? 0}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
          <h3 className="text-sm font-semibold text-[--color-text-primary]">AI 使用申请</h3>
          <div className="mt-4 space-y-3">
            {requests.length === 0 ? (
              <p className="text-sm text-[--color-text-muted]">暂无 AI 使用申请。</p>
            ) : (
              requests.map((item) => (
                <div key={item.id} className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-primary] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[--color-text-primary]">{item.user.displayName || item.user.email}</p>
                      <p className="text-xs text-[--color-text-muted]">{item.user.email}</p>
                    </div>
                    <span className="rounded-full border border-[--color-border] px-2 py-1 text-xs text-[--color-text-secondary]">{item.status}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-[--color-text-secondary]">{item.message}</p>
                  {item.reviewNote ? <p className="mt-2 text-xs text-[--color-text-muted]">审核备注：{item.reviewNote}</p> : null}
                  {item.status === "pending" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setReviewing(item); setReviewNote("") }}>
                        审核
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setGrantForm((current) => ({ ...current, userId: item.user.id }))
                          setGrantOpen(true)
                        }}
                      >
                        配置授权
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
            <h3 className="text-sm font-semibold text-[--color-text-primary]">系统授权</h3>
            <div className="mt-4 space-y-3">
              {overview?.grants.length ? (
                overview.grants.map((grant) => (
                  <div key={grant.id} className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-primary] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-[--color-text-primary]">{grant.user.displayName || grant.user.email}</p>
                        <p className="text-xs text-[--color-text-muted]">{grant.apiKeyMask} / {grant.model}</p>
                      </div>
                      <span className="rounded-full border border-[--color-border] px-2 py-1 text-xs text-[--color-text-secondary]">{grant.status}</span>
                    </div>
                    <p className="mt-2 text-xs text-[--color-text-muted]">{grant.providerLabel} / {grant.baseUrl}</p>
                    <p className="mt-1 text-xs text-[--color-text-muted]">最近更新：{new Date(grant.updatedAt).toLocaleString("zh-CN")}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => void changeGrantStatus(grant.userId, "pause")}>
                        <PauseCircle size={14} /> 暂停
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void changeGrantStatus(grant.userId, "revoke")}>
                        <Trash2 size={14} /> 撤销
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[--color-text-muted]">暂无系统授权。</p>
              )}
            </div>
          </div>

          <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
            <h3 className="text-sm font-semibold text-[--color-text-primary]">最近审计动作</h3>
            <div className="mt-3 space-y-2">
              {overview?.recentAudits.length ? (
                overview.recentAudits.map((audit) => (
                  <div key={audit.id} className="rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-primary] px-3 py-2">
                    <p className="text-sm font-medium text-[--color-text-primary]">{audit.action}</p>
                    <p className="mt-1 text-xs text-[--color-text-secondary]">{audit.detail}</p>
                    <p className="mt-1 text-xs text-[--color-text-muted]">
                      {new Date(audit.createdAt).toLocaleString("zh-CN")}
                      {audit.targetUserId ? ` / target: ${audit.targetUserId}` : ""}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[--color-text-muted]">暂无审计记录。</p>
              )}
            </div>
          </div>

          <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
            <h3 className="text-sm font-semibold text-[--color-text-primary]">已注册工具</h3>
            <div className="mt-3 space-y-2">
              {overview?.tools.map((tool) => (
                <div key={tool.name} className="rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-primary] px-3 py-2">
                  <p className="text-sm font-medium text-[--color-text-primary]">{tool.title}</p>
                  <p className="text-xs text-[--color-text-muted]">{tool.name}</p>
                  <p className="mt-1 text-xs text-[--color-text-secondary]">{tool.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={Boolean(reviewing)} onOpenChange={(open) => !open && setReviewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>审核 AI 使用申请</DialogTitle>
            <DialogDescription>批准后用户仍可继续使用自己的 API，系统授权可以单独配置。</DialogDescription>
          </DialogHeader>
          <Textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={4} placeholder="填写审核备注，可选" />
          <DialogFooter>
            <Button variant="outline" onClick={() => void reviewRequest("reject")}>拒绝</Button>
            <Button onClick={() => void reviewRequest("approve")}>批准</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>配置系统授权</DialogTitle>
            <DialogDescription>为指定用户配置可代用的 OpenAI-compatible provider。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1 block text-xs">目标用户 ID</Label>
              <Input value={grantForm.userId} onChange={(event) => setGrantForm((current) => ({ ...current, userId: event.target.value }))} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Provider 名称</Label>
              <Input value={grantForm.providerLabel} onChange={(event) => setGrantForm((current) => ({ ...current, providerLabel: event.target.value }))} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Base URL</Label>
              <Input value={grantForm.baseUrl} onChange={(event) => setGrantForm((current) => ({ ...current, baseUrl: event.target.value }))} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">API Key</Label>
              <Input type="password" value={grantForm.apiKey} onChange={(event) => setGrantForm((current) => ({ ...current, apiKey: event.target.value }))} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Model</Label>
              <Input value={grantForm.model} onChange={(event) => setGrantForm((current) => ({ ...current, model: event.target.value }))} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Temperature</Label>
              <Input value={grantForm.temperature} onChange={(event) => setGrantForm((current) => ({ ...current, temperature: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)}>取消</Button>
            <Button onClick={() => void saveGrant()}>保存授权</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
