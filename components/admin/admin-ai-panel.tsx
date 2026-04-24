"use client"

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react"
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
      if (!overviewRes.ok) throw new Error(overviewData?.error ?? "Failed to load AI overview")
      if (!requestsRes.ok) throw new Error(requestsData?.error ?? "Failed to load AI requests")
      setOverview(overviewData)
      setRequests(Array.isArray(requestsData?.items) ? requestsData.items : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load AI admin panel")
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
  const selectableUsers = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>()
    requests.forEach((item) => {
      map.set(item.user.id, { id: item.user.id, label: item.user.displayName || item.user.email })
    })
    overview?.grants.forEach((grant) => {
      map.set(grant.user.id, { id: grant.user.id, label: grant.user.displayName || grant.user.email })
    })
    return [...map.values()]
  }, [overview?.grants, requests])

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
      toast.success(action === "approve" ? "AI request approved" : "AI request rejected")
      setReviewing(null)
      setReviewNote("")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to review the request")
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
      if (!res.ok) throw new Error(data?.error ?? "Failed to save the AI grant")
      toast.success("AI grant saved")
      setGrantOpen(false)
      setGrantForm(DEFAULT_GRANT_FORM)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save the AI grant")
    }
  }

  async function changeGrantStatus(userId: string, action: "pause" | "revoke") {
    try {
      const res = await fetch(`/api/admin/ai/grants/${userId}/${action}`, { method: "POST" })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "Failed to update grant status")
      toast.success(action === "pause" ? "Grant paused" : "Grant revoked")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update grant status")
    }
  }

  if (!enabled) return null

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bot size={16} />
          <h2 className="text-sm font-semibold">AI Assistant</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCcw size={14} /> {loading ? "Refreshing..." : "Refresh"}
          </Button>
          <Button size="sm" onClick={() => setGrantOpen(true)}>
            <ShieldCheck size={14} /> New Grant
          </Button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <MetricCard label="Pending Requests" value={pendingCount} />
        <MetricCard label="Active Grants" value={overview?.grants.filter((item) => item.status === "active").length ?? 0} />
        <MetricCard label="Registered Tools" value={overview?.tools.length ?? 0} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
          <h3 className="text-sm font-semibold text-[--color-text-primary]">Access Requests</h3>
          <div className="mt-4 space-y-3">
            {requests.length === 0 ? (
              <p className="text-sm text-[--color-text-muted]">No AI access requests.</p>
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
                  {item.reviewNote ? <p className="mt-2 text-xs text-[--color-text-muted]">Review note: {item.reviewNote}</p> : null}
                  {item.status === "pending" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setReviewing(item); setReviewNote("") }}>
                        Review
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setGrantForm((current) => ({ ...current, userId: item.user.id }))
                          setGrantOpen(true)
                        }}
                      >
                        Configure Grant
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
            <h3 className="text-sm font-semibold text-[--color-text-primary]">System Grants</h3>
            <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
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
                    <p className="mt-1 text-xs text-[--color-text-muted]">Updated: {new Date(grant.updatedAt).toLocaleString()}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => void changeGrantStatus(grant.userId, "pause")}>
                        <PauseCircle size={14} /> Pause
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void changeGrantStatus(grant.userId, "revoke")}>
                        <Trash2 size={14} /> Revoke
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[--color-text-muted]">No system grants.</p>
              )}
            </div>
          </div>

          <ScrollableCard title="Recent Audit Actions">
            {overview?.recentAudits.length ? (
              overview.recentAudits.map((audit) => (
                <div key={audit.id} className="rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-primary] px-3 py-2">
                  <p className="text-sm font-medium text-[--color-text-primary]">{audit.action}</p>
                  <p className="mt-1 text-xs text-[--color-text-secondary]">{audit.detail}</p>
                  <p className="mt-1 text-xs text-[--color-text-muted]">{new Date(audit.createdAt).toLocaleString()}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-[--color-text-muted]">No audit entries yet.</p>
            )}
          </ScrollableCard>

          <ScrollableCard title="Registered Tools">
            {overview?.tools.map((tool) => (
              <div key={tool.name} className="rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-primary] px-3 py-2">
                <p className="text-sm font-medium text-[--color-text-primary]">{tool.title}</p>
                <p className="text-xs text-[--color-text-muted]">{tool.name}</p>
                <p className="mt-1 text-xs text-[--color-text-secondary]">{tool.description}</p>
              </div>
            ))}
          </ScrollableCard>
        </div>
      </div>

      <Dialog open={Boolean(reviewing)} onOpenChange={(open) => !open && setReviewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review AI Access Request</DialogTitle>
            <DialogDescription>Approving a request does not remove the option to use a personal provider key.</DialogDescription>
          </DialogHeader>
          <Textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={4} placeholder="Optional review note" />
          <DialogFooter>
            <Button variant="outline" onClick={() => void reviewRequest("reject")}>Reject</Button>
            <Button onClick={() => void reviewRequest("approve")}>Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure AI Grant</DialogTitle>
            <DialogDescription>Choose the target admin first, then fill in the provider details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1 block text-xs">Target admin</Label>
              <select
                value={grantForm.userId}
                onChange={(event) => setGrantForm((current) => ({ ...current, userId: event.target.value }))}
                className="w-full rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-surface] px-3 py-2 text-sm"
              >
                <option value="">Select one</option>
                {selectableUsers.map((user) => (
                  <option key={user.id} value={user.id}>{user.label}</option>
                ))}
              </select>
            </div>
            <Field label="Provider label" value={grantForm.providerLabel} onChange={(value) => setGrantForm((current) => ({ ...current, providerLabel: value }))} />
            <Field label="Base URL" value={grantForm.baseUrl} onChange={(value) => setGrantForm((current) => ({ ...current, baseUrl: value }))} />
            <Field label="API key" type="password" value={grantForm.apiKey} onChange={(value) => setGrantForm((current) => ({ ...current, apiKey: value }))} />
            <Field label="Model" value={grantForm.model} onChange={(value) => setGrantForm((current) => ({ ...current, model: value }))} />
            <Field label="Temperature" value={grantForm.temperature} onChange={(value) => setGrantForm((current) => ({ ...current, temperature: value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveGrant()} disabled={!grantForm.userId || !grantForm.baseUrl || !grantForm.apiKey || !grantForm.model}>
              Save Grant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
      <p className="text-xs text-[--color-text-muted]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[--color-text-primary]">{value}</p>
    </div>
  )
}

function ScrollableCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
      <h3 className="text-sm font-semibold text-[--color-text-primary]">{title}</h3>
      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">{children}</div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <div>
      <Label className="mb-1 block text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}
