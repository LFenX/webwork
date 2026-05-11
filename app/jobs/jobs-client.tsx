"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { BarChart3, BriefcaseBusiness, ExternalLink, Eye, Pencil, Plus, Search, Trash2, X } from "lucide-react"
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
import { confirmAction } from "@/lib/interaction-feedback"
import { ModuleVisibilitySelect } from "@/components/module-visibility-select"
import { ModuleHero, ModulePageShell, ModulePanel, ModuleStatGrid, ModuleToolbar, modulePillClass } from "@/components/module/module-shell"

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
  [JOB_STATUS[0] ?? ""]: "#94a3b8",
  [JOB_STATUS[1] ?? ""]: "#f59e0b",
  [JOB_STATUS[2] ?? ""]: "#2563eb",
  [JOB_STATUS[3] ?? ""]: "#ef4444",
  [JOB_STATUS[4] ?? ""]: "#10b981",
  [JOB_STATUS[5] ?? ""]: "#10b981",
  [JOB_STATUS[6] ?? ""]: "#cbd5e1",
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

export function JobsClient({ initialVisibility }: { initialVisibility?: "private" | "friends" }) {
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
  const [deletingId, setDeletingId] = useState<string | null>(null)
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
  }, [loadJobs, refreshKey, refreshStats, dict.error.title])

  function triggerRefresh() { setRefreshKey((key) => key + 1) }

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
    const job = jobs.find((item) => item.id === id)
    if (!confirmAction(`${dict.jobs.deleteConfirm(job?.company ?? "")}\n删除后该求职记录及关联展示将从列表中移除。`)) return
    setDeletingId(id)
    try {
      await apiDelete(`/api/jobs/${id}`)
      if (closeSheet) setDetailOpen(false)
      toast.success(dict.jobs.deleted)
      triggerRefresh()
    } catch {
      toast.error(dict.common.error)
    } finally {
      setDeletingId(null)
    }
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

  const statusDist = useMemo(() => stats?.statusDist.map((item) => ({
    ...item,
    color: STATUS_COLORS[item.name] ?? "#94a3b8",
  })) ?? [], [stats])

  const toolbar = (
    <ModuleToolbar>
      <div className="relative min-w-0 flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder={dict.jobs.search}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-11 rounded-full border-slate-200 bg-slate-50 pl-10 pr-10 text-sm shadow-none focus-visible:border-blue-300 focus-visible:bg-white"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
            <X size={14} />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-11 w-36 rounded-full border-slate-200 bg-white text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={dict.jobs.allStatus}>{dict.jobs.allStatus}</SelectItem>
            {JOB_STATUS.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={openCreate} className="min-h-11 gap-2">
          <Plus size={16} /> {dict.jobs.newApplication}
        </Button>
      </div>
    </ModuleToolbar>
  )

  return (
    <ModulePageShell maxWidth="full">
      <div className="space-y-5">
        <ModuleHero
          icon={BriefcaseBusiness}
          title={dict.jobs.title}
          description={dict.jobs.description}
          meta={
            <>
              <span className={modulePillClass(false)}>{jobs.length}{hasMore ? "+" : ""} {dict.jobs.total}</span>
              {filterStatus !== dict.jobs.allStatus && <span className={modulePillClass(true)}>{filterStatus}</span>}
            </>
          }
          actions={
            <>
              {initialVisibility !== undefined && <ModuleVisibilitySelect module="jobs" initialVisibility={initialVisibility} />}
              <Button onClick={openCreate} className="min-h-11 gap-2">
                <Plus size={16} /> {dict.jobs.newApplication}
              </Button>
            </>
          }
        />

        {stats && (
          <>
            <ModuleStatGrid>
              <StatsCard title={dict.jobs.total} value={stats.total} sub="累计投递" icon={BriefcaseBusiness} />
              <StatsCard title={dict.jobs.replyRate} value={`${stats.replyRate}%`} sub={stats.replyRate > 50 ? dict.jobs.replied : dict.jobs.replyRate} trend={stats.replyRate > 50 ? "up" : "neutral"} icon={BarChart3} tone="green" />
              <StatsCard title={dict.jobs.interviewRate} value={`${stats.interviewRate}%`} sub={dict.jobs.interviewRate} icon={Eye} tone="amber" />
              <StatsCard title={dict.jobs.offerRate} value={`${stats.offerRate}%`} trend={stats.offerRate > 0 ? "up" : "neutral"} icon={BriefcaseBusiness} tone="coral" />
            </ModuleStatGrid>

            {stats.total > 0 && (
              <div className="grid gap-4 lg:grid-cols-3">
                <ModulePanel title={dict.jobs.statusChart} icon={BarChart3} contentClassName="pt-3">
                  <SimpleBarChart data={statusDist} height={Math.max(140, statusDist.length * 34)} />
                </ModulePanel>
                <ModulePanel title={dict.jobs.channelChart} icon={BarChart3} contentClassName="pt-3">
                  <SimpleBarChart data={stats.channelDist} height={Math.max(140, stats.channelDist.length * 34)} />
                </ModulePanel>
                {stats.monthlyTrend.length > 1 && (
                  <ModulePanel title={dict.jobs.trendChart} icon={BarChart3} contentClassName="pt-3">
                    <SimpleLineChart data={stats.monthlyTrend} height={190} />
                  </ModulePanel>
                )}
              </div>
            )}
          </>
        )}

        {toolbar}

        <ModulePanel title="求职记录" description="桌面端为紧凑表格，手机端自动切换为卡片列表。" icon={BriefcaseBusiness} contentClassName="p-0">
          {loading ? (
            <div className="py-16 text-center text-sm text-slate-500">{dict.common.loading}</div>
          ) : jobs.length === 0 ? (
            <div className="p-4 sm:p-5">
              <EmptyState
                title={dict.common.noData}
                description={dict.jobs.noData}
                action={{ label: dict.jobs.newApplication, onClick: openCreate }}
              />
            </div>
          ) : (
            <>
              <div className="grid gap-3 p-4 md:hidden">
                {jobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => openDetail(job)}
                    className="rounded-[18px] border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-bold text-slate-950">{job.company}</p>
                        <p className="mt-1 truncate text-sm text-slate-500">{job.position}</p>
                      </div>
                      <StatusBadge status={job.status} type="job" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2 py-1">{formatChinaDate(job.appliedAt, { month: "2-digit", day: "2-digit" })}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1">{job.channel}</span>
                      {job.baseLocation && <span className="rounded-full bg-slate-100 px-2 py-1">{job.baseLocation}</span>}
                    </div>
                  </button>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-[1180px] w-full table-fixed border-separate border-spacing-0 text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      {[dict.jobs.company, dict.jobs.position, dict.jobs.channel, dict.jobs.appliedAt, dict.jobs.status, dict.jobs.baseLocation, dict.jobs.hrContact, dict.nav.interviews, dict.jobs.link, dict.jobs.notes, ""].map((header, index) => (
                        <th key={`${header}-${index}`} className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-500">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => (
                      <tr key={job.id} className="group cursor-pointer transition-colors hover:bg-blue-50/40" onClick={() => openDetail(job)}>
                        <td className="truncate border-b border-slate-100 px-4 py-3 font-semibold text-slate-950">{job.company}</td>
                        <td className="truncate border-b border-slate-100 px-4 py-3 text-slate-600">{job.position}</td>
                        <td className="truncate border-b border-slate-100 px-4 py-3 text-xs text-slate-500">{job.channel}</td>
                        <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs text-slate-500">{formatChinaDate(job.appliedAt, { month: "2-digit", day: "2-digit" })}</td>
                        <td className="border-b border-slate-100 px-4 py-3" onClick={(event) => event.stopPropagation()}>
                          <Select value={job.status} onValueChange={(value) => handleStatusChange(job.id, value)}>
                            <SelectTrigger className="h-7 w-auto gap-1 border-0 bg-transparent p-0 shadow-none focus:ring-0">
                              <StatusBadge status={job.status} type="job" />
                            </SelectTrigger>
                            <SelectContent>
                              {JOB_STATUS.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="truncate border-b border-slate-100 px-4 py-3 text-xs text-slate-500">{job.baseLocation || "-"}</td>
                        <td className="truncate border-b border-slate-100 px-4 py-3 text-xs text-slate-500">{job.hrContact || "-"}</td>
                        <td className="border-b border-slate-100 px-4 py-3 text-center font-mono text-xs text-slate-500">{job._count?.interviews ?? 0}</td>
                        <td className="border-b border-slate-100 px-4 py-3" onClick={(event) => event.stopPropagation()}>
                          {job.link ? (
                            <a href={job.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                              {dict.jobs.link} <ExternalLink size={11} />
                            </a>
                          ) : <span className="text-xs text-slate-400">-</span>}
                        </td>
                        <td className="truncate border-b border-slate-100 px-4 py-3 text-xs text-slate-500">{job.notes}</td>
                        <td className="border-b border-slate-100 px-4 py-3" onClick={(event) => event.stopPropagation()}>
                          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button onClick={() => openDetail(job)} className="rounded-full p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600" title={dict.jobs.detail}><Eye size={14} /></button>
                            <button onClick={() => openEdit(job)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title={dict.common.edit}><Pencil size={14} /></button>
                            <button onClick={() => handleDelete(job.id)} disabled={deletingId === job.id} aria-busy={deletingId === job.id || undefined} className="rounded-full p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50" title={dict.common.delete}><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(loadingMore || hasMore) && (
                <div className="border-t border-slate-100 p-3 text-center">
                  {loadingMore ? (
                    <p className="text-xs text-slate-400">{dict.common.loadMore}</p>
                  ) : (
                    <Button type="button" variant="outline" size="sm" onClick={() => void loadJobs(nextCursor, true)}>
                      {dict.common.loadMore}
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </ModulePanel>
      </div>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full overflow-y-auto bg-white sm:max-w-md">
          {detailJob && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle>{detailJob.company}</SheetTitle>
                <p className="text-sm text-slate-500">{detailJob.position}</p>
              </SheetHeader>
              <div className="space-y-4 text-sm">
                <StatusBadge status={detailJob.status} type="job" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                  <div><span className="mb-0.5 block text-slate-400">{dict.jobs.channel}</span><span>{detailJob.channel}</span></div>
                  <div><span className="mb-0.5 block text-slate-400">{dict.jobs.appliedAt}</span><span className="font-mono">{formatChinaDate(detailJob.appliedAt)}</span></div>
                  <div><span className="mb-0.5 block text-slate-400">{dict.jobs.baseLocation}</span><span>{detailJob.baseLocation || "-"}</span></div>
                  <div><span className="mb-0.5 block text-slate-400">{dict.jobs.hrContact}</span><span>{detailJob.hrContact || "-"}</span></div>
                  <div><span className="mb-0.5 block text-slate-400">{dict.nav.interviews}</span><span className="font-mono">{detailJob._count?.interviews ?? 0}</span></div>
                  {detailJob.link && (
                    <div>
                      <span className="mb-0.5 block text-slate-400">{dict.jobs.link}</span>
                      <a href={detailJob.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                        {dict.jobs.link} <ExternalLink size={11} />
                      </a>
                    </div>
                  )}
                </div>
                {detailJob.notes && (
                  <div>
                    <span className="mb-1 block text-xs text-slate-400">{dict.jobs.notes}</span>
                    <p className="rounded-[14px] border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">{detailJob.notes}</p>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(detailJob)}><Pencil size={13} /> {dict.common.edit}</Button>
                  <Button size="sm" variant="outline" onClick={() => handleDelete(detailJob.id, true)} loading={deletingId === detailJob.id} loadingText={dict.common.delete} className="text-rose-600 hover:text-rose-600"><Trash2 size={13} /> {dict.common.delete}</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingJob ? dict.jobs.editApplication : dict.jobs.newApplication}</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1 block text-xs">{dict.jobs.company} *</Label>
                <Input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder={dict.jobs.company} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">{dict.jobs.position} *</Label>
                <Input value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} placeholder={dict.jobs.position} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label className="mb-1 block text-xs">{dict.jobs.channel}</Label>
                <Select value={form.channel} onValueChange={(value) => setForm((f) => ({ ...f, channel: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{JOB_CHANNELS.map((channel) => <SelectItem key={channel} value={channel}>{channel}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block text-xs">{dict.jobs.appliedAt}</Label>
                <Input type="date" value={form.appliedAt} onChange={(e) => setForm((f) => ({ ...f, appliedAt: e.target.value }))} className="font-mono" />
              </div>
              <div>
                <Label className="mb-1 block text-xs">{dict.jobs.status}</Label>
                <Select value={form.status} onValueChange={(value) => setForm((f) => ({ ...f, status: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{JOB_STATUS.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1 block text-xs">{dict.jobs.baseLocation}</Label>
                <Input value={form.baseLocation} onChange={(e) => setForm((f) => ({ ...f, baseLocation: e.target.value }))} placeholder={dict.jobs.baseLocation} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">{dict.jobs.hrContact}</Label>
                <Input value={form.hrContact} onChange={(e) => setForm((f) => ({ ...f, hrContact: e.target.value }))} placeholder={dict.jobs.hrContact} />
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-xs">{dict.jobs.link}</Label>
              <Input value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} placeholder="https://..." className="font-mono" />
            </div>
            <div>
              <Label className="mb-1 block text-xs">{dict.jobs.notes}</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder={dict.jobs.notes} rows={3} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>{dict.jobs.cancel}</Button>
              <Button size="sm" onClick={handleSave} loading={saving} loadingText={dict.jobs.saving}>{dict.jobs.save}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ModulePageShell>
  )
}
