"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Eye, Pencil, Plus, Trash2, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { StatusBadge } from "@/components/status-badge"
import { StatsCard } from "@/components/stats-card"
import { EmptyState } from "@/components/empty-state"
import { SimplePieChart } from "@/components/charts/pie-chart"
import { SimpleBarChart } from "@/components/charts/bar-chart"
import { INTERVIEW_ROUNDS, INTERVIEW_FORMATS, INTERVIEW_RESULTS } from "@/lib/enums"
import { apiFetch, apiPost, apiPatch, apiDelete } from "@/lib/api-client"
import { formatChinaDate, formatChinaDateTime } from "@/lib/time"
import { getDict } from "@/lib/i18n"
import { ModuleVisibilitySelect } from "@/components/module-visibility-select"

interface Interview {
  id: string
  company: string
  position: string
  round: string
  format: string
  scheduledAt: string
  interviewers?: string | null
  questions?: string | null
  selfRating?: number | null
  result: string
  feedback?: string | null
  jobId?: string | null
  job?: { company: string; position: string } | null
}

interface JobOption {
  id: string
  company: string
  position: string
  status: string
  channel: string
  appliedAt: string
}

interface JobsPage {
  items: JobOption[]
}

interface Stats {
  total: number
  passed: number
  failed: number
  pending: number
  passRate: number
  roundDist: { name: string; value: number }[]
  formatDist: { name: string; value: number }[]
  companyDist: { name: string; value: number }[]
}

const defaultForm = {
  company: "",
  position: "",
  round: INTERVIEW_ROUNDS[0] as string,
  format: INTERVIEW_FORMATS[0] as string,
  scheduledAt: new Date().toISOString().slice(0, 16),
  interviewers: "",
  questions: "",
  selfRating: "" as string | number,
  result: INTERVIEW_RESULTS[0] as string,
  feedback: "",
  jobId: "",
}

function StarRating({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`transition-colors ${(value ?? 0) >= n ? "text-[--color-warning]" : "text-[--color-border-strong]"} hover:text-[--color-warning]`}
        >
          <Star size={16} fill={(value ?? 0) >= n ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  )
}

export function InterviewsClient({ initialVisibility }: { initialVisibility?: "private" | "friends" }) {
  const dict = getDict()

  const [interviews, setInterviews] = useState<Interview[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [jobOptions, setJobOptions] = useState<JobOption[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editingInterview, setEditingInterview] = useState<Interview | null>(null)
  const [detailItem, setDetailItem] = useState<Interview | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [iData, sData] = await Promise.all([
          apiFetch<Interview[]>(`/api/interviews?_t=${Date.now()}`),
          apiFetch<Stats>(`/api/interviews/stats?_t=${Date.now()}`),
        ])
        if (!cancelled) {
          setInterviews(iData)
          setStats(sData)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [refreshKey])

  useEffect(() => {
    let cancelled = false
    async function loadJobs() {
      try {
        const page = await apiFetch<JobsPage>(`/api/jobs?limit=50&_t=${Date.now()}`)
        if (!cancelled) setJobOptions(page.items)
      } catch {
        if (!cancelled) setJobOptions([])
      }
    }
    loadJobs()
    return () => { cancelled = true }
  }, [refreshKey])

  function triggerRefresh() { setRefreshKey(k => k + 1) }

  function openCreate() {
    setEditingInterview(null)
    setForm({ ...defaultForm })
    setDialogOpen(true)
  }

  function selectJob(jobId: string) {
    if (jobId === "none") {
      setForm((current) => ({ ...current, jobId: "" }))
      return
    }
    const job = jobOptions.find((item) => item.id === jobId)
    setForm((current) => ({
      ...current,
      jobId,
      company: job?.company ?? current.company,
      position: job?.position ?? current.position,
    }))
  }

  function openEdit(item: Interview) {
    setEditingInterview(item)
    setForm({
      company: item.company,
      position: item.position,
      round: item.round,
      format: item.format,
      scheduledAt: new Date(item.scheduledAt).toISOString().slice(0, 16),
      interviewers: item.interviewers ?? "",
      questions: item.questions ?? "",
      selfRating: item.selfRating ?? "",
      result: item.result,
      feedback: item.feedback ?? "",
      jobId: item.jobId ?? "",
    })
    setDialogOpen(true)
  }

  function openDetail(item: Interview) {
    setDetailItem(item)
    setDetailOpen(true)
  }

  async function handleSave() {
    if (!form.company || !form.position) {
      toast.error(dict.common.error)
      return
    }
    setSaving(true)
    try {
      const body = {
        ...form,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        selfRating: form.selfRating ? Number(form.selfRating) : null,
        jobId: form.jobId || null,
      }
      if (editingInterview) {
        await apiPatch(`/api/interviews/${editingInterview.id}`, body)
      } else {
        await apiPost("/api/interviews", body)
      }
      setDialogOpen(false)
      toast.success(dict.interviews.saved)
      triggerRefresh()
    } catch {
      toast.error(dict.common.error)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const item = interviews.find(i => i.id === id)
    if (!confirm(dict.interviews.deleteConfirm(item?.company ?? ""))) return
    await apiDelete(`/api/interviews/${id}`)
    toast.success(dict.interviews.deleted)
    triggerRefresh()
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 pt-4 pb-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 text-xl font-semibold">{dict.interviews.title}</h1>
          <p className="text-sm text-[--color-text-muted]">{dict.interviews.description}</p>
        </div>
        {initialVisibility !== undefined && (
          <ModuleVisibilitySelect module="interviews" initialVisibility={initialVisibility} />
        )}
      </div>

      {/* Stats */}
      {stats && (
        <section className="mb-8">
          <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-3 rounded-[--radius-lg] bg-[--color-bg-surface]/60 p-3 sm:p-5 shadow-[--shadow-sm] ring-1 ring-[rgba(15,23,42,0.05)] backdrop-blur-sm">
            <StatsCard title={dict.interviews.total} value={stats.total} sub={dict.interviews.total} />
            <StatsCard
              title={dict.interviews.passRate}
              value={`${stats.passRate}%`}
              trend={stats.passRate > 60 ? "up" : "neutral"}
            />
            <StatsCard title={dict.interviews.passed} value={stats.passed} trend="up" />
            <StatsCard title={dict.interviews.failed} value={stats.failed} trend={stats.failed > 0 ? "down" : "neutral"} />
          </div>

          {stats.total > 0 && (
            <div className="grid md:grid-cols-3 gap-4">
              <div className="rounded-[--radius-lg] bg-[--color-bg-surface]/70 p-4 shadow-[--shadow-sm] ring-1 ring-[rgba(15,23,42,0.05)] backdrop-blur-sm">
                <p className="text-xs text-[--color-text-muted] mb-3">{dict.interviews.formatChart}</p>
                <SimplePieChart data={stats.formatDist} height={180} />
              </div>
              <div className="rounded-[--radius-lg] bg-[--color-bg-surface]/70 p-4 shadow-[--shadow-sm] ring-1 ring-[rgba(15,23,42,0.05)] backdrop-blur-sm">
                <p className="text-xs text-[--color-text-muted] mb-3">{dict.interviews.roundChart}</p>
                <SimpleBarChart data={stats.roundDist} height={180} />
              </div>
              {stats.companyDist.length > 0 && (
                <div className="rounded-[--radius-lg] bg-[--color-bg-surface]/70 p-4 shadow-[--shadow-sm] ring-1 ring-[rgba(15,23,42,0.05)] backdrop-blur-sm">
                  <p className="text-xs text-[--color-text-muted] mb-3">{dict.interviews.companyChart}</p>
                  <SimpleBarChart data={stats.companyDist} height={180} />
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-[--color-text-muted] font-mono">{interviews.length} {dict.interviews.total}</p>
        <Button size="sm" onClick={openCreate} className="h-8 gap-1.5">
          <Plus size={14} /> {dict.interviews.newInterview}
        </Button>
      </div>

      {/* Table */}
      <div className="bg-[--color-bg-surface] border border-[--color-border] rounded-[--radius-lg] overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-[--color-text-muted]">{dict.common.loading}</div>
        ) : interviews.length === 0 ? (
          <EmptyState
            title={dict.common.noData}
            description={dict.interviews.noData}
            action={{ label: dict.interviews.newInterview, onClick: openCreate }}
          />
        ) : (
          <div className="overflow-x-auto bg-[--color-bg-surface]">
            <div className="min-w-[1090px]">
              <table className="w-full table-fixed border-separate border-spacing-0 bg-[--color-bg-surface] text-sm">
                <thead>
                  <tr>
                    <th className="w-[130px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">{dict.interviews.company}</th>
                    <th className="w-[180px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">{dict.interviews.position}</th>
                    <th className="w-[100px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">{dict.interviews.round}</th>
                    <th className="w-[80px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">{dict.interviews.format}</th>
                    <th className="w-[130px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left font-mono text-xs font-medium text-[--color-text-muted]">{dict.interviews.scheduledAt}</th>
                    <th className="w-[80px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">{dict.interviews.selfRating}</th>
                    <th className="w-[100px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">{dict.interviews.result}</th>
                    <th className="w-[200px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">{dict.interviews.feedback}</th>
                    <th className="w-[90px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5" />
                  </tr>
                </thead>
              </table>
              <div>
                <table className="w-full table-fixed border-separate border-spacing-0 bg-[--color-bg-surface] text-sm">
                  <tbody>
                    {interviews.map((item) => (
                      <tr
                        key={item.id}
                        className="group cursor-pointer transition-colors hover:bg-[--color-bg-hover]"
                        onClick={() => openDetail(item)}
                      >
                        <td className="w-[130px] truncate border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 font-medium group-hover:bg-[--color-bg-hover]">{item.company}</td>
                        <td className="w-[180px] truncate border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-[--color-text-secondary] group-hover:bg-[--color-bg-hover]">{item.position}</td>
                        <td className="w-[100px] border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 font-mono text-xs text-[--color-text-muted] group-hover:bg-[--color-bg-hover]">{item.round}</td>
                        <td className="w-[80px] border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-xs text-[--color-text-muted] group-hover:bg-[--color-bg-hover]">{item.format}</td>
                        <td className="w-[130px] border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 font-mono text-xs text-[--color-text-muted] group-hover:bg-[--color-bg-hover]">
                          {formatChinaDate(item.scheduledAt)}
                        </td>
                        <td className="w-[80px] border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 group-hover:bg-[--color-bg-hover]">
                          {item.selfRating ? (
                            <div className="flex gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  size={12}
                                  className={(item.selfRating ?? 0) > i ? "text-[--color-warning]" : "text-[--color-border-strong]"}
                                  fill={(item.selfRating ?? 0) > i ? "currentColor" : "none"}
                                />
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-[--color-text-muted]">—</span>
                          )}
                        </td>
                        <td className="w-[100px] border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 group-hover:bg-[--color-bg-hover]">
                          <StatusBadge status={item.result} type="interview" />
                        </td>
                        <td className="w-[200px] truncate border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-xs text-[--color-text-muted] group-hover:bg-[--color-bg-hover]">
                          {item.feedback}
                        </td>
                        <td className="w-[90px] border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 group-hover:bg-[--color-bg-hover]" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={() => openDetail(item)}
                              className="p-1 text-[--color-text-muted] hover:text-[--color-link]"
                              title={dict.interviews.title}
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              onClick={() => openEdit(item)}
                              className="p-1 text-[--color-text-muted] hover:text-[--color-text-primary]"
                              title={dict.common.edit}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1 text-[--color-text-muted] hover:text-[--color-danger]"
                              title={dict.common.delete}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingInterview ? dict.interviews.editInterview : dict.interviews.newInterview}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs mb-1 block">{dict.interviews.linkJob}</Label>
              <Select value={form.jobId || "none"} onValueChange={selectJob}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder={dict.interviews.linkJob} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{dict.interviews.noJob}</SelectItem>
                  {jobOptions.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.company} / {job.position} / {job.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">{dict.interviews.company} *</Label>
                <Input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder={dict.interviews.company} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">{dict.interviews.position} *</Label>
                <Input value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} placeholder={dict.interviews.position} className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs mb-1 block">{dict.interviews.round}</Label>
                <Select value={form.round} onValueChange={(v) => setForm((f) => ({ ...f, round: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{INTERVIEW_ROUNDS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">{dict.interviews.format}</Label>
                <Select value={form.format} onValueChange={(v) => setForm((f) => ({ ...f, format: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{INTERVIEW_FORMATS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">{dict.interviews.result}</Label>
                <Select value={form.result} onValueChange={(v) => setForm((f) => ({ ...f, result: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{INTERVIEW_RESULTS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">{dict.interviews.scheduledAt}</Label>
                <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))} className="h-8 text-sm font-mono" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">{dict.interviews.interviewers}</Label>
                <Input value={form.interviewers} onChange={(e) => setForm((f) => ({ ...f, interviewers: e.target.value }))} placeholder={dict.interviews.interviewers} className="h-8 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">{dict.interviews.selfRating}</Label>
              <StarRating value={form.selfRating ? Number(form.selfRating) : null} onChange={(v) => setForm((f) => ({ ...f, selfRating: v }))} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">{dict.interviews.questions}</Label>
              <Textarea value={form.questions} onChange={(e) => setForm((f) => ({ ...f, questions: e.target.value }))} placeholder="## Q1&#10;- Q2" className="text-sm resize-none font-mono" rows={4} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">{dict.interviews.feedback}</Label>
              <Textarea value={form.feedback} onChange={(e) => setForm((f) => ({ ...f, feedback: e.target.value }))} placeholder={dict.interviews.feedback} className="text-sm resize-none" rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>{dict.interviews.cancel}</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? dict.interviews.saving : dict.interviews.save}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailItem?.company} · {detailItem?.round}
            </DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-4 mt-2 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-[--color-text-muted]">{dict.interviews.linkJob}：</span>{detailItem.job ? `${detailItem.job.company} / ${detailItem.job.position}` : "—"}</div>
                <div><span className="text-[--color-text-muted]">{dict.interviews.position}：</span>{detailItem.position}</div>
                <div><span className="text-[--color-text-muted]">{dict.interviews.format}：</span>{detailItem.format}</div>
                <div><span className="text-[--color-text-muted]">{dict.interviews.scheduledAt}：</span><span className="font-mono">{formatChinaDateTime(detailItem.scheduledAt)}</span></div>
                <div><span className="text-[--color-text-muted]">{dict.interviews.interviewers}：</span>{detailItem.interviewers || "—"}</div>
                <div><span className="text-[--color-text-muted]">{dict.interviews.result}：</span><StatusBadge status={detailItem.result} type="interview" /></div>
                <div className="flex items-center gap-1">
                  <span className="text-[--color-text-muted]">{dict.interviews.selfRating}：</span>
                  {detailItem.selfRating ? (
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={12} className={(detailItem.selfRating ?? 0) > i ? "text-[--color-warning]" : "text-[--color-border]"} fill={(detailItem.selfRating ?? 0) > i ? "currentColor" : "none"} />
                      ))}
                    </div>
                  ) : "—"}
                </div>
              </div>
              {detailItem.questions && (
                <div>
                  <p className="text-xs text-[--color-text-muted] mb-2">{dict.interviews.questions}</p>
                  <pre className="text-xs bg-[--color-bg-hover] rounded p-3 whitespace-pre-wrap font-mono border border-[--color-border]">{detailItem.questions}</pre>
                </div>
              )}
              {detailItem.feedback && (
                <div>
                  <p className="text-xs text-[--color-text-muted] mb-1">{dict.interviews.feedback}</p>
                  <p className="text-sm">{detailItem.feedback}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
