"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { ExternalLink, Eye, Pencil, Plus, Search, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { StatusBadge } from "@/components/status-badge"
import { StatsCard } from "@/components/stats-card"
import { EmptyState } from "@/components/empty-state"
import { SimpleBarChart } from "@/components/charts/bar-chart"
import { SimpleLineChart } from "@/components/charts/line-chart"
import { JOB_STATUS, JOB_CHANNELS } from "@/lib/enums"
import { apiFetch, apiPost, apiPatch, apiDelete } from "@/lib/api-client"
import { formatChinaDate } from "@/lib/time"
import { getDict } from "@/lib/i18n"

interface Job {
  id: string
  company: string
  position: string
  channel: string
  appliedAt: string
  status: string
  notes?: string | null
  baseLocation?: string | null
  hrContact?: string | null
  link?: string | null
  _count?: { interviews: number }
}

interface Stats {
  total: number
  replyRate: number
  interviewRate: number
  offerRate: number
  statusDist: { name: string; value: number }[]
  channelDist: { name: string; value: number }[]
  monthlyTrend: { name: string; value: number }[]
}

interface JobsPage {
  items: Job[]
  nextCursor: string | null
  hasMore: boolean
}

type JobForm = {
  company: string
  position: string
  channel: string
  appliedAt: string
  status: string
  notes: string
  baseLocation: string
  hrContact: string
  link: string
}

const STATUS_COLORS: Record<string, string> = {
  [JOB_STATUS[0] ?? ""]: "#9A9A9A",
  [JOB_STATUS[1] ?? ""]: "#B8902D",
  [JOB_STATUS[2] ?? ""]: "#0969DA",
  [JOB_STATUS[3] ?? ""]: "#A8463A",
  [JOB_STATUS[4] ?? ""]: "#3A7D5C",
  [JOB_STATUS[5] ?? ""]: "#3A7D5C",
  [JOB_STATUS[6] ?? ""]: "#D4D1C7",
}

const defaultForm: JobForm = {
  company: "",
  position: "",
  channel: JOB_CHANNELS[0] ?? "",
  appliedAt: new Date().toISOString().slice(0, 10),
  status: JOB_STATUS[0] ?? "",
  notes: "",
  baseLocation: "",
  hrContact: "",
  link: "",
}

export function JobsClient() {
  const dict = getDict()

  const [jobs, setJobs] = useState<Job[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState(dict.jobs.allStatus)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<Job | null>(null)
  const [detailJob, setDetailJob] = useState<Job | null>(null)
  const [form, setForm] = useState<JobForm>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const loadJobs = useCallback(async (cursor: string | null, append: boolean) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "50" })
      if (search) params.set("q", search)
      if (filterStatus !== dict.jobs.allStatus) params.set("status", filterStatus)
      if (cursor) params.set("cursor", cursor)
      params.set("_t", String(Date.now()))
      const page = await apiFetch<JobsPage>(`/api/jobs?${params.toString()}`)
      setJobs((current) => append ? [...current, ...page.items] : page.items)
      setNextCursor(page.nextCursor)
      setHasMore(page.hasMore)
    } finally {
      if (append) setLoadingMore(false)
      else setLoading(false)
    }
  }, [filterStatus, search, dict.jobs.allStatus])

  const refreshStats = useCallback(async () => {
    const statsData = await apiFetch<Stats>(`/api/jobs/stats?_t=${Date.now()}`)
    setStats(statsData)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        await refreshStats()
        if (cancelled) return
        await loadJobs(null, false)
      } catch {
        if (!cancelled) toast.error(dict.error.title)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [loadJobs, refreshKey, refreshStats])

  function triggerRefresh() { setRefreshKey(k => k + 1) }

  function openCreate() {
    setEditingJob(null)
    setForm(defaultForm)
    setDialogOpen(true)
  }

  function openDetail(job: Job) {
    setDetailJob(job)
    setDetailOpen(true)
  }

  function openEdit(job: Job) {
    setDetailOpen(false)
    setEditingJob(job)
    setForm({
      company: job.company,
      position: job.position,
      channel: job.channel,
      appliedAt: new Date(job.appliedAt).toISOString().slice(0, 10),
      status: job.status,
      notes: job.notes ?? "",
      baseLocation: job.baseLocation ?? "",
      hrContact: job.hrContact ?? "",
      link: job.link ?? "",
    })
    setDialogOpen(true)
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
        appliedAt: new Date(form.appliedAt).toISOString(),
        baseLocation: form.baseLocation || null,
        hrContact: form.hrContact || null,
        link: form.link || null,
      }
      if (editingJob) await apiPatch(`/api/jobs/${editingJob.id}`, body)
      else await apiPost("/api/jobs", body)
      setDialogOpen(false)
      toast.success(dict.jobs.saved)
      triggerRefresh()
    } catch {
      toast.error(dict.common.error)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, closeSheet = false) {
    const job = jobs.find(j => j.id === id)
    if (!confirm(dict.jobs.deleteConfirm(job?.company ?? ""))) return
    await apiDelete(`/api/jobs/${id}`)
    if (closeSheet) setDetailOpen(false)
    toast.success(dict.jobs.deleted)
    triggerRefresh()
  }

  async function handleStatusChange(id: string, status: string) {
    const previousJobs = jobs
    const previousDetail = detailJob
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, status } : job)))
    setDetailJob((current) => (current?.id === id ? { ...current, status } : current))
    try {
      const updated = await apiPatch<Job>(`/api/jobs/${id}`, { status })
      setJobs((current) => {
        const next = current.map((job) => (job.id === id ? { ...job, ...updated, _count: job._count } : job))
        return filterStatus !== dict.jobs.allStatus && status !== filterStatus ? next.filter((job) => job.id !== id) : next
      })
      setDetailJob((current) => (current?.id === id ? { ...current, ...updated, _count: current._count } : current))
      void refreshStats()
    } catch {
      setJobs(previousJobs)
      setDetailJob(previousDetail)
      toast.error(dict.common.error)
    }
  }

  const statusDist = useMemo(() => stats?.statusDist.map((d) => ({
    ...d,
    color: STATUS_COLORS[d.name] ?? "#9A9A9A",
  })) ?? [], [stats])

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10">
      <div className="mb-8">
        <h1 className="mb-1 text-xl font-semibold">{dict.jobs.title}</h1>
        <p className="text-sm text-[--color-text-muted]">{dict.nav.jobs}</p>
      </div>

      {stats && (
        <section className="mb-8">
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatsCard title={dict.jobs.total} value={stats.total} sub={dict.jobs.total} />
            <StatsCard title={dict.jobs.replyRate} value={`${stats.replyRate}%`} sub={stats.replyRate > 50 ? dict.jobs.replied : dict.jobs.replyRate} trend={stats.replyRate > 50 ? "up" : "neutral"} />
            <StatsCard title={dict.jobs.interviewRate} value={`${stats.interviewRate}%`} sub={dict.jobs.interviewRate} />
            <StatsCard title={dict.jobs.offerRate} value={`${stats.offerRate}%`} trend={stats.offerRate > 0 ? "up" : "neutral"} />
          </div>

          {stats.total > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
                <p className="mb-3 text-xs text-[--color-text-muted]">{dict.jobs.statusChart}</p>
                <SimpleBarChart data={statusDist} height={Math.max(120, statusDist.length * 32)} />
              </div>
              <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
                <p className="mb-3 text-xs text-[--color-text-muted]">{dict.jobs.channelChart}</p>
                <SimpleBarChart data={stats.channelDist} height={Math.max(120, stats.channelDist.length * 32)} />
              </div>
              {stats.monthlyTrend.length > 1 && (
                <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
                  <p className="mb-3 text-xs text-[--color-text-muted]">{dict.jobs.trendChart}</p>
                  <SimpleLineChart data={stats.monthlyTrend} height={180} />
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[--color-text-muted]" />
          <Input
            placeholder={dict.jobs.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 border-[--color-border] pl-8 text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[--color-text-muted] hover:text-[--color-text-primary]">
              <X size={12} />
            </button>
          )}
        </div>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-32 border-[--color-border] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={dict.jobs.allStatus}>{dict.jobs.allStatus}</SelectItem>
            {JOB_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Button size="sm" onClick={openCreate} className="h-8 gap-1.5">
          <Plus size={14} /> {dict.jobs.newApplication}
        </Button>
      </div>

      <div className="overflow-hidden rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]">
        {loading ? (
          <div className="py-16 text-center text-sm text-[--color-text-muted]">{dict.common.loading}</div>
        ) : jobs.length === 0 ? (
          <EmptyState
            title={dict.common.noData}
            description={dict.jobs.noData}
            action={{ label: dict.jobs.newApplication, onClick: openCreate }}
          />
        ) : (
          <div className="overflow-x-auto bg-[--color-bg-surface]">
            <div className="min-w-[1180px]">
              <table className="w-full table-fixed border-separate border-spacing-0 bg-[--color-bg-surface] text-sm">
                <thead>
                  <tr>
                    <th className="w-[150px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">{dict.jobs.company}</th>
                    <th className="w-[180px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">{dict.jobs.position}</th>
                    <th className="w-[110px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">{dict.jobs.channel}</th>
                    <th className="w-[100px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left font-mono text-xs font-medium text-[--color-text-muted]">{dict.jobs.appliedAt}</th>
                    <th className="w-[120px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">{dict.jobs.status}</th>
                    <th className="w-[90px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">{dict.jobs.baseLocation}</th>
                    <th className="w-[120px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">{dict.jobs.hrContact}</th>
                    <th className="w-[70px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left font-mono text-xs font-medium text-[--color-text-muted]">{dict.nav.interviews}</th>
                    <th className="w-[86px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">{dict.jobs.link}</th>
                    <th className="w-[170px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">{dict.jobs.notes}</th>
                    <th className="w-[90px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5" />
                  </tr>
                </thead>
              </table>
              <div>
                <table className="w-full table-fixed border-separate border-spacing-0 bg-[--color-bg-surface] text-sm">
                  <tbody>
                    {jobs.map((job) => (
                      <tr
                        key={job.id}
                        className="group cursor-pointer transition-colors hover:bg-[--color-bg-hover]"
                        onClick={() => openDetail(job)}
                      >
                        <td className="w-[150px] truncate border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 font-medium group-hover:bg-[--color-bg-hover]">{job.company}</td>
                        <td className="w-[180px] truncate border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-[--color-text-secondary] group-hover:bg-[--color-bg-hover]">{job.position}</td>
                        <td className="w-[110px] truncate border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 font-mono text-xs text-[--color-text-muted] group-hover:bg-[--color-bg-hover]">{job.channel}</td>
                        <td className="w-[100px] border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 font-mono text-xs text-[--color-text-muted] group-hover:bg-[--color-bg-hover]">{formatChinaDate(job.appliedAt, { month: "2-digit", day: "2-digit" })}</td>
                        <td className="w-[120px] border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 group-hover:bg-[--color-bg-hover]" onClick={(e) => e.stopPropagation()}>
                          <Select value={job.status} onValueChange={(v) => handleStatusChange(job.id, v)}>
                            <SelectTrigger className="h-6 w-auto gap-1 border-0 bg-transparent p-0 shadow-none focus:ring-0">
                              <StatusBadge status={job.status} type="job" />
                            </SelectTrigger>
                            <SelectContent>
                              {JOB_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="w-[90px] truncate border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-xs text-[--color-text-muted] group-hover:bg-[--color-bg-hover]">{job.baseLocation || "-"}</td>
                        <td className="w-[120px] truncate border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-xs text-[--color-text-muted] group-hover:bg-[--color-bg-hover]">{job.hrContact || "-"}</td>
                        <td className="w-[70px] border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-center font-mono text-xs text-[--color-text-muted] group-hover:bg-[--color-bg-hover]">{job._count?.interviews ?? 0}</td>
                        <td className="w-[86px] whitespace-nowrap border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 group-hover:bg-[--color-bg-hover]" onClick={(e) => e.stopPropagation()}>
                          {job.link ? (
                            <a href={job.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-[--color-link] hover:underline">
                              {dict.jobs.link} <ExternalLink size={10} />
                            </a>
                          ) : <span className="text-xs text-[--color-text-muted]">-</span>}
                        </td>
                        <td className="w-[170px] truncate border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-xs text-[--color-text-muted] group-hover:bg-[--color-bg-hover]">{job.notes}</td>
                        <td className="w-[90px] border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 group-hover:bg-[--color-bg-hover]" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button onClick={() => openDetail(job)} className="p-1 text-[--color-text-muted] hover:text-[--color-link]" title={dict.jobs.detail}><Eye size={13} /></button>
                            <button onClick={() => openEdit(job)} className="p-1 text-[--color-text-muted] hover:text-[--color-text-primary]" title={dict.common.edit}><Pencil size={13} /></button>
                            <button onClick={() => handleDelete(job.id)} className="p-1 text-[--color-text-muted] hover:text-[--color-danger]" title={dict.common.delete}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {loadingMore && <p className="p-3 text-center text-xs text-[--color-text-muted]">{dict.common.loadMore}</p>}
                {hasMore && !loadingMore && (
                  <div className="border-t border-[--color-border] p-3 text-center">
                    <Button type="button" variant="outline" size="sm" onClick={() => void loadJobs(nextCursor, true)}>
                      {dict.common.loadMore}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {jobs.length > 0 && <p className="mt-2 font-mono text-xs text-[--color-text-muted]">{jobs.length}{hasMore ? "+" : ""} {dict.jobs.total}</p>}

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {detailJob && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle>{detailJob.company}</SheetTitle>
                <p className="text-sm text-[--color-text-secondary]">{detailJob.position}</p>
              </SheetHeader>
              <div className="space-y-4 text-sm">
                <StatusBadge status={detailJob.status} type="job" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                  <div><span className="mb-0.5 block text-[--color-text-muted]">{dict.jobs.channel}</span><span>{detailJob.channel}</span></div>
                  <div><span className="mb-0.5 block text-[--color-text-muted]">{dict.jobs.appliedAt}</span><span className="font-mono">{formatChinaDate(detailJob.appliedAt)}</span></div>
                  <div><span className="mb-0.5 block text-[--color-text-muted]">{dict.jobs.baseLocation}</span><span>{detailJob.baseLocation || "-"}</span></div>
                  <div><span className="mb-0.5 block text-[--color-text-muted]">{dict.jobs.hrContact}</span><span>{detailJob.hrContact || "-"}</span></div>
                  <div><span className="mb-0.5 block text-[--color-text-muted]">{dict.nav.interviews}</span><span className="font-mono">{detailJob._count?.interviews ?? 0}</span></div>
                  {detailJob.link && (
                    <div>
                      <span className="mb-0.5 block text-[--color-text-muted]">{dict.jobs.link}</span>
                      <a href={detailJob.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap text-[--color-link] hover:underline">
                        {dict.jobs.link} <ExternalLink size={10} />
                      </a>
                    </div>
                  )}
                </div>
                {detailJob.notes && (
                  <div>
                    <span className="mb-1 block text-xs text-[--color-text-muted]">{dict.jobs.notes}</span>
                    <p className="rounded border border-[--color-border] bg-[--color-bg-hover] p-2 text-sm">{detailJob.notes}</p>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(detailJob)} className="gap-1.5"><Pencil size={13} /> {dict.common.edit}</Button>
                  <Button size="sm" variant="outline" onClick={() => handleDelete(detailJob.id, true)} className="gap-1.5 text-[--color-danger] hover:text-[--color-danger]"><Trash2 size={13} /> {dict.common.delete}</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingJob ? dict.jobs.editApplication : dict.jobs.newApplication}</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-xs">{dict.jobs.company} *</Label>
                <Input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder={dict.jobs.company} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="mb-1 block text-xs">{dict.jobs.position} *</Label>
                <Input value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} placeholder={dict.jobs.position} className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="mb-1 block text-xs">{dict.jobs.channel}</Label>
                <Select value={form.channel} onValueChange={(v) => setForm((f) => ({ ...f, channel: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{JOB_CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block text-xs">{dict.jobs.appliedAt}</Label>
                <Input type="date" value={form.appliedAt} onChange={(e) => setForm((f) => ({ ...f, appliedAt: e.target.value }))} className="h-8 font-mono text-sm" />
              </div>
              <div>
                <Label className="mb-1 block text-xs">{dict.jobs.status}</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{JOB_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-xs">{dict.jobs.baseLocation}</Label>
                <Input value={form.baseLocation} onChange={(e) => setForm((f) => ({ ...f, baseLocation: e.target.value }))} placeholder={dict.jobs.baseLocation} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="mb-1 block text-xs">{dict.jobs.hrContact}</Label>
                <Input value={form.hrContact} onChange={(e) => setForm((f) => ({ ...f, hrContact: e.target.value }))} placeholder={dict.jobs.hrContact} className="h-8 text-sm" />
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-xs">{dict.jobs.link}</Label>
              <Input value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} placeholder="https://..." className="h-8 font-mono text-sm" />
            </div>
            <div>
              <Label className="mb-1 block text-xs">{dict.jobs.notes}</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder={dict.jobs.notes} className="resize-none text-sm" rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>{dict.jobs.cancel}</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? dict.jobs.saving : dict.jobs.save}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
