"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { BarChart3, CalendarClock, Eye, Pencil, Plus, Star, Trash2 } from "lucide-react"
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
import { ModuleHero, ModulePageShell, ModulePanel, ModuleStatGrid, ModuleToolbar } from "@/components/module/module-shell"

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
          className={`${(value ?? 0) >= n ? "text-amber-500" : "text-slate-300"} transition-colors hover:text-amber-500`}
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

  function triggerRefresh() { setRefreshKey((key) => key + 1) }

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
      if (editingInterview) await apiPatch(`/api/interviews/${editingInterview.id}`, body)
      else await apiPost("/api/interviews", body)
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
    const item = interviews.find((interview) => interview.id === id)
    if (!confirm(dict.interviews.deleteConfirm(item?.company ?? ""))) return
    await apiDelete(`/api/interviews/${id}`)
    toast.success(dict.interviews.deleted)
    triggerRefresh()
  }

  return (
    <ModulePageShell maxWidth="full">
      <div className="space-y-5">
        <ModuleHero
          icon={CalendarClock}
          title={dict.interviews.title}
          description={dict.interviews.description}
          actions={
            <>
              {initialVisibility !== undefined && <ModuleVisibilitySelect module="interviews" initialVisibility={initialVisibility} />}
              <Button onClick={openCreate} className="min-h-11 gap-2">
                <Plus size={16} /> {dict.interviews.newInterview}
              </Button>
            </>
          }
        />

        {stats && (
          <>
            <ModuleStatGrid>
              <StatsCard title={dict.interviews.total} value={stats.total} sub="累计面试" icon={CalendarClock} />
              <StatsCard title={dict.interviews.passRate} value={`${stats.passRate}%`} trend={stats.passRate > 60 ? "up" : "neutral"} icon={BarChart3} tone="green" />
              <StatsCard title={dict.interviews.passed} value={stats.passed} trend="up" icon={Star} tone="amber" />
              <StatsCard title={dict.interviews.failed} value={stats.failed} trend={stats.failed > 0 ? "down" : "neutral"} icon={Trash2} tone="coral" />
            </ModuleStatGrid>

            {stats.total > 0 && (
              <div className="grid gap-4 lg:grid-cols-3">
                <ModulePanel title={dict.interviews.formatChart} icon={BarChart3}>
                  <SimplePieChart data={stats.formatDist} height={190} />
                </ModulePanel>
                <ModulePanel title={dict.interviews.roundChart} icon={BarChart3}>
                  <SimpleBarChart data={stats.roundDist} height={190} />
                </ModulePanel>
                {stats.companyDist.length > 0 && (
                  <ModulePanel title={dict.interviews.companyChart} icon={BarChart3}>
                    <SimpleBarChart data={stats.companyDist} height={190} />
                  </ModulePanel>
                )}
              </div>
            )}
          </>
        )}

        <ModuleToolbar>
          <p className="text-sm font-medium text-slate-500">{interviews.length} {dict.interviews.total}</p>
          <Button onClick={openCreate} className="min-h-11 gap-2">
            <Plus size={16} /> {dict.interviews.newInterview}
          </Button>
        </ModuleToolbar>

        <ModulePanel title="面试记录" description="桌面端使用紧凑表格，手机端切换为可点击卡片。" icon={CalendarClock} contentClassName="p-0">
          {loading ? (
            <div className="py-16 text-center text-sm text-slate-500">{dict.common.loading}</div>
          ) : interviews.length === 0 ? (
            <div className="p-4 sm:p-5">
              <EmptyState title={dict.common.noData} description={dict.interviews.noData} action={{ label: dict.interviews.newInterview, onClick: openCreate }} />
            </div>
          ) : (
            <>
              <div className="grid gap-3 p-4 md:hidden">
                {interviews.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openDetail(item)}
                    className="rounded-[18px] border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-bold text-slate-950">{item.company}</p>
                        <p className="mt-1 truncate text-sm text-slate-500">{item.position}</p>
                      </div>
                      <StatusBadge status={item.result} type="interview" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2 py-1">{formatChinaDate(item.scheduledAt)}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1">{item.round}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1">{item.format}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-[1090px] w-full table-fixed border-separate border-spacing-0 text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      {[dict.interviews.company, dict.interviews.position, dict.interviews.round, dict.interviews.format, dict.interviews.scheduledAt, dict.interviews.selfRating, dict.interviews.result, dict.interviews.feedback, ""].map((header, index) => (
                        <th key={`${header}-${index}`} className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-500">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {interviews.map((item) => (
                      <tr key={item.id} className="group cursor-pointer transition-colors hover:bg-blue-50/40" onClick={() => openDetail(item)}>
                        <td className="truncate border-b border-slate-100 px-4 py-3 font-semibold text-slate-950">{item.company}</td>
                        <td className="truncate border-b border-slate-100 px-4 py-3 text-slate-600">{item.position}</td>
                        <td className="border-b border-slate-100 px-4 py-3 text-xs text-slate-500">{item.round}</td>
                        <td className="border-b border-slate-100 px-4 py-3 text-xs text-slate-500">{item.format}</td>
                        <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs text-slate-500">{formatChinaDate(item.scheduledAt)}</td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          {item.selfRating ? (
                            <div className="flex gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star key={i} size={12} className={(item.selfRating ?? 0) > i ? "text-amber-500" : "text-slate-300"} fill={(item.selfRating ?? 0) > i ? "currentColor" : "none"} />
                              ))}
                            </div>
                          ) : <span className="text-xs text-slate-400">-</span>}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3"><StatusBadge status={item.result} type="interview" /></td>
                        <td className="truncate border-b border-slate-100 px-4 py-3 text-xs text-slate-500">{item.feedback}</td>
                        <td className="border-b border-slate-100 px-4 py-3" onClick={(event) => event.stopPropagation()}>
                          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button onClick={() => openDetail(item)} className="rounded-full p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600" title={dict.interviews.title}><Eye size={14} /></button>
                            <button onClick={() => openEdit(item)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title={dict.common.edit}><Pencil size={14} /></button>
                            <button onClick={() => handleDelete(item.id)} className="rounded-full p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title={dict.common.delete}><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </ModulePanel>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingInterview ? dict.interviews.editInterview : dict.interviews.newInterview}</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <div>
              <Label className="mb-1 block text-xs">{dict.interviews.linkJob}</Label>
              <Select value={form.jobId || "none"} onValueChange={selectJob}>
                <SelectTrigger><SelectValue placeholder={dict.interviews.linkJob} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{dict.interviews.noJob}</SelectItem>
                  {jobOptions.map((job) => (
                    <SelectItem key={job.id} value={job.id}>{job.company} / {job.position} / {job.status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1 block text-xs">{dict.interviews.company} *</Label>
                <Input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder={dict.interviews.company} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">{dict.interviews.position} *</Label>
                <Input value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} placeholder={dict.interviews.position} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label className="mb-1 block text-xs">{dict.interviews.round}</Label>
                <Select value={form.round} onValueChange={(value) => setForm((f) => ({ ...f, round: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{INTERVIEW_ROUNDS.map((round) => <SelectItem key={round} value={round}>{round}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block text-xs">{dict.interviews.format}</Label>
                <Select value={form.format} onValueChange={(value) => setForm((f) => ({ ...f, format: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{INTERVIEW_FORMATS.map((format) => <SelectItem key={format} value={format}>{format}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block text-xs">{dict.interviews.result}</Label>
                <Select value={form.result} onValueChange={(value) => setForm((f) => ({ ...f, result: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{INTERVIEW_RESULTS.map((result) => <SelectItem key={result} value={result}>{result}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1 block text-xs">{dict.interviews.scheduledAt}</Label>
                <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))} className="font-mono" />
              </div>
              <div>
                <Label className="mb-1 block text-xs">{dict.interviews.interviewers}</Label>
                <Input value={form.interviewers} onChange={(e) => setForm((f) => ({ ...f, interviewers: e.target.value }))} placeholder={dict.interviews.interviewers} />
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-xs">{dict.interviews.selfRating}</Label>
              <StarRating value={form.selfRating ? Number(form.selfRating) : null} onChange={(value) => setForm((f) => ({ ...f, selfRating: value }))} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">{dict.interviews.questions}</Label>
              <Textarea value={form.questions} onChange={(e) => setForm((f) => ({ ...f, questions: e.target.value }))} placeholder="## Q1&#10;- Q2" rows={4} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">{dict.interviews.feedback}</Label>
              <Textarea value={form.feedback} onChange={(e) => setForm((f) => ({ ...f, feedback: e.target.value }))} placeholder={dict.interviews.feedback} rows={3} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>{dict.interviews.cancel}</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? dict.interviews.saving : dict.interviews.save}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailItem?.company} / {detailItem?.round}</DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="mt-2 space-y-4 text-sm">
              <div className="grid gap-3 rounded-[18px] border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-2">
                <div><span className="text-slate-400">{dict.interviews.linkJob}: </span>{detailItem.job ? `${detailItem.job.company} / ${detailItem.job.position}` : "-"}</div>
                <div><span className="text-slate-400">{dict.interviews.position}: </span>{detailItem.position}</div>
                <div><span className="text-slate-400">{dict.interviews.format}: </span>{detailItem.format}</div>
                <div><span className="text-slate-400">{dict.interviews.scheduledAt}: </span><span className="font-mono">{formatChinaDateTime(detailItem.scheduledAt)}</span></div>
                <div><span className="text-slate-400">{dict.interviews.interviewers}: </span>{detailItem.interviewers || "-"}</div>
                <div><span className="text-slate-400">{dict.interviews.result}: </span><StatusBadge status={detailItem.result} type="interview" /></div>
              </div>
              {detailItem.questions && (
                <div>
                  <p className="mb-2 text-xs text-slate-400">{dict.interviews.questions}</p>
                  <pre className="rounded-[16px] border border-slate-200 bg-slate-50 p-3 text-xs whitespace-pre-wrap font-mono">{detailItem.questions}</pre>
                </div>
              )}
              {detailItem.feedback && (
                <div>
                  <p className="mb-1 text-xs text-slate-400">{dict.interviews.feedback}</p>
                  <p className="leading-6 text-slate-600">{detailItem.feedback}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ModulePageShell>
  )
}
