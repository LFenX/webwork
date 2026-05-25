"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  Archive,
  ArchiveRestore,
  BarChart3,
  BriefcaseBusiness,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  ImagePlus,
  LayoutGrid,
  List,
  MapPin,
  Pencil,
  Settings2,
  Sparkles,
  Table as TableIcon,
  Phone,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { StatusBadge } from "@/components/status-badge"
import { StatsCard } from "@/components/stats-card"
import { EmptyState } from "@/components/empty-state"
import { ModuleContentLoading } from "@/components/loading/app-loading-states"
import { SimpleBarChart } from "@/components/charts/bar-chart"
import { SimpleLineChart } from "@/components/charts/line-chart"
import { JOB_STATUS, JOB_CHANNELS, JOB_PIPELINE_STAGES } from "@/lib/enums"
import { apiFetch, apiPost, apiPatch, apiDelete } from "@/lib/api-client"
import { formatChinaDate } from "@/lib/time"
import { getDict } from "@/lib/i18n"
import { confirmAction } from "@/lib/interaction-feedback"
import { ModuleVisibilitySelect } from "@/components/module-visibility-select"
import { ModuleHero, ModulePageShell, ModulePanel, ModuleStatGrid, ModuleToolbar, modulePillClass } from "@/components/module/module-shell"
import { cn } from "@/lib/utils"
import type { Visibility } from "@/lib/visibility"

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
  jobDescription?: string | null
  salaryRange?: string | null
  priority?: number
  nextActionAt?: string | null
  archivedAt?: string | null
  pipelineStage?: number
  _count?: { interviews: number }
}

type FunnelStep = {
  name: string
  reached: number
  totalRate: number
  stepRate: number
  dropOff: number
}

interface Stats {
  total: number
  replied: number
  replyRate: number
  hasInterview: number
  interviewRate: number
  offers: number
  offerRate: number
  priorityCount: number
  activeCount: number
  upcomingCount: number
  daysSinceLastApply: number | null
  statusDist: { name: string; value: number }[]
  channelDist: { name: string; value: number }[]
  locationDist: { name: string; value: number }[]
  monthlyTrend: { name: string; value: number }[]
  weeklyTrend: { name: string; value: number }[]
  pipelineDist: { name: string; value: number }[]
  funnelDist: FunnelStep[]
}

interface JobsPage {
  items: Job[]
  nextCursor: string | null
  hasMore: boolean
}

type SortKey = "created" | "applied" | "company"

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
  jobDescription: string
  salaryRange: string
  priority: number
  nextActionAt: string
  pipelineStage: number
}

const STATUS_COLORS: Record<string, string> = {
  已投递: "#94a3b8",
  已回复: "#f59e0b",
  未通过评估: "#ef4444",
  进入面试: "#2563eb",
  未通过面试: "#ef4444",
  已拒绝: "#ef4444",
  已Offer: "#10b981",
  已接受: "#10b981",
  无回复放弃: "#cbd5e1",
  已放弃: "#cbd5e1",
}

const STATUS_BAR_COLORS: Record<string, string> = {
  已投递: "bg-slate-300",
  已回复: "bg-amber-400",
  未通过评估: "bg-rose-400",
  进入面试: "bg-blue-500",
  未通过面试: "bg-rose-400",
  已拒绝: "bg-rose-400",
  已Offer: "bg-emerald-500",
  已接受: "bg-emerald-500",
  无回复放弃: "bg-slate-200",
  已放弃: "bg-slate-200",
}

type TableColumnKey =
  | "priority" | "company" | "position" | "channel" | "appliedAt" | "status" | "pipeline"
  | "location" | "salary" | "hr" | "interviews" | "link" | "jd"
  | "nextAction" | "notes" | "actions"

const TABLE_COLUMNS: { key: TableColumnKey; label: string; locked?: boolean }[] = [
  { key: "priority", label: "重点 ★" },
  { key: "company", label: "公司", locked: true },
  { key: "position", label: "职位", locked: true },
  { key: "channel", label: "渠道" },
  { key: "appliedAt", label: "投递日期" },
  { key: "status", label: "状态", locked: true },
  { key: "pipeline", label: "求职流程" },
  { key: "location", label: "工作地点" },
  { key: "salary", label: "薪资" },
  { key: "hr", label: "HR 联系" },
  { key: "interviews", label: "面试数" },
  { key: "link", label: "链接" },
  { key: "jd", label: "JD" },
  { key: "nextAction", label: "下一步" },
  { key: "notes", label: "备注" },
  { key: "actions", label: "操作", locked: true },
]

const DEFAULT_VISIBLE_COLS: Set<TableColumnKey> = new Set<TableColumnKey>([
  "priority", "company", "position", "channel", "appliedAt", "status", "pipeline",
  "location", "salary", "hr", "interviews", "link", "jd", "nextAction", "notes", "actions",
])

const TABLE_COLS_STORAGE_KEY = "jobs.tableCols.v1"

function loadStoredCols(): Set<TableColumnKey> {
  if (typeof window === "undefined") return new Set(DEFAULT_VISIBLE_COLS)
  try {
    const raw = window.localStorage.getItem(TABLE_COLS_STORAGE_KEY)
    if (!raw) return new Set(DEFAULT_VISIBLE_COLS)
    const parsed = JSON.parse(raw) as string[]
    if (!Array.isArray(parsed)) return new Set(DEFAULT_VISIBLE_COLS)
    const valid = new Set<TableColumnKey>()
    const allKeys = new Set(TABLE_COLUMNS.map((c) => c.key))
    parsed.forEach((k) => { if (allKeys.has(k as TableColumnKey)) valid.add(k as TableColumnKey) })
    TABLE_COLUMNS.forEach((c) => { if (c.locked) valid.add(c.key) })
    return valid
  } catch {
    return new Set(DEFAULT_VISIBLE_COLS)
  }
}

const SORT_LABEL: Record<SortKey, string> = {
  created: "添加时间",
  applied: "投递日期",
  company: "公司名",
}

const TIME_PRESETS = [
  { key: "all", label: "全部时间" },
  { key: "today", label: "今天投递" },
  { key: "7d", label: "近 7 天" },
  { key: "30d", label: "近 30 天" },
  { key: "90d", label: "近 90 天" },
] as const

type TimePresetKey = typeof TIME_PRESETS[number]["key"]

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
  jobDescription: "",
  salaryRange: "",
  priority: 0,
  nextActionAt: "",
  pipelineStage: 0,
}

function dateRangeFromPreset(key: TimePresetKey): { from: string | null; to: string | null } {
  if (key === "all") return { from: null, to: null }
  if (key === "today") {
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    const to = new Date(from)
    to.setHours(23, 59, 59, 999)
    return { from: from.toISOString(), to: to.toISOString() }
  }

  const days = key === "7d" ? 7 : key === "30d" ? 30 : 90
  const from = new Date()
  from.setDate(from.getDate() - days)
  from.setHours(0, 0, 0, 0)
  return { from: from.toISOString(), to: null }
}

function FunnelTable({ data, total }: { data: FunnelStep[]; total: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold text-slate-500">
            <th className="border-b border-slate-100 px-4 py-3">流程阶段</th>
            <th className="border-b border-slate-100 px-4 py-3 text-right">累计到达</th>
            <th className="border-b border-slate-100 px-4 py-3">总投递占比</th>
            <th className="border-b border-slate-100 px-4 py-3 text-right">上步转化</th>
            <th className="border-b border-slate-100 px-4 py-3 text-right">阶段流失</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => (
            <tr key={item.name} className="text-slate-700">
              <td className="border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 font-mono text-[11px] text-slate-500">
                    {idx + 1}
                  </span>
                  <span className="font-semibold text-slate-900">{item.name}</span>
                </div>
              </td>
              <td className="border-b border-slate-100 px-4 py-3 text-right font-mono text-slate-950">
                {item.reached}
              </td>
              <td className="border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-2 min-w-28 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${Math.min(Math.max(item.totalRate, 0), 100)}%` }}
                    />
                  </div>
                  <span className="w-12 text-right font-mono text-xs text-slate-600">{item.totalRate}%</span>
                </div>
              </td>
              <td className="border-b border-slate-100 px-4 py-3 text-right font-mono text-slate-700">
                {idx === 0 || total === 0 ? "—" : `${item.stepRate}%`}
              </td>
              <td className={cn(
                "border-b border-slate-100 px-4 py-3 text-right font-mono",
                item.dropOff > 0 ? "text-rose-600" : "text-slate-400",
              )}>
                {idx === 0 ? "—" : item.dropOff}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function JobsClient({ initialVisibility }: { initialVisibility?: Visibility }) {
  const dict = getDict()

  const [jobs, setJobs] = useState<Job[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const [search, setSearch] = useState("")
  const [statusSet, setStatusSet] = useState<Set<string>>(new Set())
  const [pipelineSet, setPipelineSet] = useState<Set<number>>(new Set())
  const [channelSet, setChannelSet] = useState<Set<string>>(new Set())
  const [locationSet, setLocationSet] = useState<Set<string>>(new Set())
  const [companySet, setCompanySet] = useState<Set<string>>(new Set())
  const [companyFilterQ, setCompanyFilterQ] = useState("")
  const [allCompanies, setAllCompanies] = useState<string[]>([])
  const [timePreset, setTimePreset] = useState<TimePresetKey>("all")
  const [priorityOnly, setPriorityOnly] = useState(false)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [sort, setSort] = useState<SortKey>("created")
  const [showStats, setShowStats] = useState(true)
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
  const [view, setView] = useState<"list" | "table" | "kanban">("list")
  const [visibleCols, setVisibleCols] = useState<Set<TableColumnKey>>(loadStoredCols)
  const [colSettingsOpen, setColSettingsOpen] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(TABLE_COLS_STORAGE_KEY, JSON.stringify(Array.from(visibleCols)))
    } catch {
      // 忽略持久化失败
    }
  }, [visibleCols])

  function toggleCol(key: TableColumnKey) {
    const def = TABLE_COLUMNS.find((c) => c.key === key)
    if (def?.locked) return
    setVisibleCols((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function resetCols() {
    setVisibleCols(new Set(DEFAULT_VISIBLE_COLS))
  }

  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<Job | null>(null)
  const [detailJob, setDetailJob] = useState<Job | null>(null)
  const [form, setForm] = useState<JobForm>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [aiExtracting, setAiExtracting] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const jdTextareaRef = useRef<HTMLTextAreaElement>(null)

  const loadJobs = useCallback(async (cursor: string | null, append: boolean) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "50" })
      if (search) params.set("q", search)
      statusSet.forEach((value) => params.append("status", value))
      channelSet.forEach((value) => params.append("channel", value))
      locationSet.forEach((value) => params.append("location", value))
      companySet.forEach((value) => params.append("company", value))
      pipelineSet.forEach((value) => params.append("stage", String(value)))
      const dateRange = dateRangeFromPreset(timePreset)
      if (dateRange.from) params.set("from", dateRange.from)
      if (dateRange.to) params.set("to", dateRange.to)
      if (priorityOnly) params.set("priority", "1")
      params.set("archived", includeArchived ? "all" : "0")
      params.set("sort", sort)
      if (cursor) params.set("cursor", cursor)
      params.set("_t", String(Date.now()))
      const page = await apiFetch<JobsPage>(`/api/jobs?${params.toString()}`)
      setJobs((current) => append ? [...current, ...page.items] : page.items)
      setNextCursor(page.nextCursor)
      setHasMore(page.hasMore)
      setAllCompanies((prev) => {
        const merged = new Set(prev)
        page.items.forEach((job) => { if (job.company) merged.add(job.company) })
        return Array.from(merged).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"))
      })
    } finally {
      if (append) setLoadingMore(false)
      else setLoading(false)
    }
  }, [search, statusSet, channelSet, locationSet, companySet, pipelineSet, timePreset, priorityOnly, includeArchived, sort])

  const refreshStats = useCallback(async () => {
    try {
      const statsData = await apiFetch<Stats>(`/api/jobs/stats?_t=${Date.now()}`)
      setStats(statsData)
    } catch {
      // 静默失败
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await loadJobs(null, false)
        if (cancelled) return
        await refreshStats()
      } catch {
        if (!cancelled) toast.error(dict.error.title)
      }
    }
    load()
    return () => { cancelled = true }
  }, [loadJobs, refreshStats, dict.error.title])

  // 用于动态地点筛选项
  const knownLocations = useMemo(() => {
    const seen = new Set<string>()
    jobs.forEach((job) => { if (job.baseLocation) seen.add(job.baseLocation) })
    return Array.from(seen).sort()
  }, [jobs])

  const activeFilterCount = statusSet.size + channelSet.size + locationSet.size + companySet.size + pipelineSet.size
    + (timePreset !== "all" ? 1 : 0)
    + (priorityOnly ? 1 : 0)
    + (includeArchived ? 1 : 0)

  function toggleInSet(setter: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) {
    setter((current) => {
      const next = new Set(current)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  function clearFilters() {
    setStatusSet(new Set())
    setChannelSet(new Set())
    setLocationSet(new Set())
    setCompanySet(new Set())
    setCompanyFilterQ("")
    setPipelineSet(new Set())
    setTimePreset("all")
    setPriorityOnly(false)
    setIncludeArchived(false)
  }

  function togglePipeline(value: number) {
    setPipelineSet((current) => {
      const next = new Set(current)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

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
      jobDescription: job.jobDescription ?? "",
      salaryRange: job.salaryRange ?? "",
      priority: job.priority ?? 0,
      nextActionAt: job.nextActionAt ? new Date(job.nextActionAt).toISOString().slice(0, 10) : "",
      pipelineStage: job.pipelineStage ?? 0,
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
        company: form.company,
        position: form.position,
        channel: form.channel,
        status: form.status,
        appliedAt: new Date(form.appliedAt).toISOString(),
        notes: form.notes || null,
        baseLocation: form.baseLocation || null,
        hrContact: form.hrContact || null,
        link: form.link || null,
        jobDescription: form.jobDescription || null,
        salaryRange: form.salaryRange || null,
        priority: form.priority ?? 0,
        nextActionAt: form.nextActionAt ? new Date(form.nextActionAt).toISOString() : null,
        pipelineStage: form.pipelineStage ?? 0,
      }
      if (editingJob) {
        const updated = await apiPatch<Job>(`/api/jobs/${editingJob.id}`, body)
        setJobs((current) => current.map((job) => (job.id === editingJob.id ? { ...job, ...updated, _count: updated._count ?? job._count } : job)))
        setDetailJob((current) => (current?.id === editingJob.id ? { ...current, ...updated, _count: updated._count ?? current._count } : current))
      } else {
        const created = await apiPost<Job>("/api/jobs", body)
        setJobs((current) => [{ ...created, _count: { interviews: 0 } }, ...current])
      }
      setDialogOpen(false)
      toast.success(dict.jobs.saved)
      void refreshStats()
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
      setJobs((current) => current.filter((item) => item.id !== id))
      if (closeSheet) setDetailOpen(false)
      toast.success(dict.jobs.deleted)
      void refreshStats()
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
      setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...updated, _count: updated._count ?? job._count } : job)))
      setDetailJob((current) => (current?.id === id ? { ...current, ...updated, _count: updated._count ?? current._count } : current))
      void refreshStats()
    } catch {
      setJobs(previousJobs)
      setDetailJob(previousDetail)
      toast.error(dict.common.error)
    }
  }

  async function handleArchiveToggle(id: string, archive: boolean) {
    setArchivingId(id)
    try {
      const job = archive
        ? await apiPost<Job>(`/api/jobs/${id}/archive`, {})
        : await apiFetch<Job>(`/api/jobs/${id}/archive`, { method: "DELETE" })
      setJobs((current) => {
        // 归档时若未勾选"包含已归档"则移除；取消归档时若没勾选已归档过滤则保留
        if (archive && !includeArchived) return current.filter((item) => item.id !== id)
        return current.map((item) => (item.id === id ? { ...item, ...job } : item))
      })
      setDetailJob((current) => (current?.id === id ? { ...current, ...job } : current))
      toast.success(archive ? "已归档" : "已取消归档")
      void refreshStats()
    } catch {
      toast.error(dict.common.error)
    } finally {
      setArchivingId(null)
    }
  }

  async function uploadJdImage(file: File): Promise<string | null> {
    if (!file.type.startsWith("image/")) return null
    const fd = new FormData()
    fd.append("file", file)
    const res = await fetch("/api/upload", { method: "POST", body: fd })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      const code = err?.error
      const msg = code === "too_large" ? "图片过大" : code === "quota_exceeded" ? "存储空间已满" : code === "invalid_mime" ? "不支持的图片类型" : "上传失败"
      toast.error(msg)
      return null
    }
    const data = await res.json() as { url: string; originalName?: string }
    return data.url
  }

  function insertJdMarkdown(snippet: string) {
    const el = jdTextareaRef.current
    if (!el) {
      setForm((f) => ({ ...f, jobDescription: (f.jobDescription || "") + snippet }))
      return
    }
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const before = el.value.slice(0, start)
    const after = el.value.slice(end)
    const next = before + snippet + after
    setForm((f) => ({ ...f, jobDescription: next }))
    requestAnimationFrame(() => {
      const pos = before.length + snippet.length
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }

  async function handleJdPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = event.clipboardData?.items
    if (!items || items.length === 0) return
    const imageFiles: File[] = []
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const f = item.getAsFile()
        if (f) imageFiles.push(f)
      }
    }
    if (imageFiles.length === 0) return
    event.preventDefault()
    setUploadingImage(true)
    try {
      for (const file of imageFiles) {
        const url = await uploadJdImage(file)
        if (url) {
          const alt = file.name?.replace(/\.[^.]+$/, "") || "image"
          insertJdMarkdown(`\n![${alt}](${url})\n`)
        }
      }
    } finally {
      setUploadingImage(false)
    }
  }

  async function handleAiExtract(file: File) {
    setAiExtracting(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/jobs/ai-extract", { method: "POST", body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        const code = err?.error
        const msg = code === "no_ai" ? "未配置可用的 AI 模型，请在设置中启用"
          : code === "too_large" ? "图片过大"
            : code === "invalid_mime" ? "不支持的图片类型"
              : code === "parse_failed" ? "AI 未能从图片解析出岗位信息"
                : err?.message || "AI 识别失败"
        toast.error(msg)
        return
      }
      const data = await res.json() as { extracted: Partial<JobForm> & { jobDescription?: string | null } }
      const ex = data.extracted ?? {}
      let appliedCount = 0
      setForm((current) => {
        const next = { ...current }
        const apply = <K extends keyof JobForm>(key: K, value: JobForm[K] | null | undefined) => {
          if (value === null || value === undefined || value === "") return
          if (current[key] && current[key] !== defaultForm[key]) return // 已有内容不覆盖
          next[key] = value as JobForm[K]
          appliedCount++
        }
        apply("company", ex.company as string | null)
        apply("position", ex.position as string | null)
        if (ex.channel && (JOB_CHANNELS as readonly string[]).includes(ex.channel as string)) {
          apply("channel", ex.channel as string)
        }
        apply("baseLocation", ex.baseLocation as string | null)
        apply("salaryRange", ex.salaryRange as string | null)
        if (ex.jobDescription) {
          if (!current.jobDescription) {
            next.jobDescription = ex.jobDescription as string
            appliedCount++
          } else {
            next.jobDescription = `${current.jobDescription}\n\n---\n\n${ex.jobDescription as string}`
            appliedCount++
          }
        }
        return next
      })
      toast.success(appliedCount > 0 ? `AI 已识别并填入 ${appliedCount} 项` : "AI 没有识别到可用字段")
    } catch {
      toast.error("AI 识别失败")
    } finally {
      setAiExtracting(false)
    }
  }

  async function handleJdFilePick(file: File) {
    setUploadingImage(true)
    try {
      const url = await uploadJdImage(file)
      if (url) {
        const alt = file.name?.replace(/\.[^.]+$/, "") || "image"
        insertJdMarkdown(`\n![${alt}](${url})\n`)
      }
    } finally {
      setUploadingImage(false)
    }
  }

  async function handlePipelineChange(id: string, stage: number) {
    const previous = jobs
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, pipelineStage: stage } : job)))
    setDetailJob((current) => (current?.id === id ? { ...current, pipelineStage: stage } : current))
    try {
      const updated = await apiPatch<Job>(`/api/jobs/${id}`, { pipelineStage: stage })
      setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...updated, _count: updated._count ?? job._count } : job)))
      setDetailJob((current) => (current?.id === id ? { ...current, ...updated, _count: updated._count ?? current._count } : current))
      void refreshStats()
    } catch {
      setJobs(previous)
      toast.error(dict.common.error)
    }
  }

  async function handlePriorityToggle(job: Job) {
    const nextPriority = job.priority && job.priority > 0 ? 0 : 1
    const previous = jobs
    setJobs((current) => current.map((item) => (item.id === job.id ? { ...item, priority: nextPriority } : item)))
    try {
      const updated = await apiPatch<Job>(`/api/jobs/${job.id}`, { priority: nextPriority })
      setJobs((current) => current.map((item) => (item.id === job.id ? { ...item, ...updated, _count: updated._count ?? item._count } : item)))
      setDetailJob((current) => (current?.id === job.id ? { ...current, ...updated, _count: updated._count ?? current._count } : current))
    } catch {
      setJobs(previous)
      toast.error(dict.common.error)
    }
  }

  const statusDist = useMemo(() => stats?.statusDist.map((item) => ({
    ...item,
    color: STATUS_COLORS[item.name] ?? "#94a3b8",
  })) ?? [], [stats])

  function renderFilterRail(inDrawer = false) {
    return (
      <div className={cn("space-y-5", inDrawer ? "p-4" : "rounded-[18px] border border-slate-200 bg-white p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">筛选</span>
            {activeFilterCount > 0 && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-100 px-1.5 text-[11px] font-medium text-blue-700">{activeFilterCount}</span>}
          </div>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-slate-800">清空</button>
          )}
        </div>

        <FilterSection title="状态">
          <div className="flex flex-wrap gap-1.5">
            {JOB_STATUS.map((status) => (
              <FilterChip key={status} active={statusSet.has(status)} onClick={() => toggleInSet(setStatusSet, status)}>
                <span className={cn("inline-block size-1.5 rounded-full", STATUS_BAR_COLORS[status] ?? "bg-slate-300")} />
                {status}
              </FilterChip>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="求职流程">
          <div className="flex flex-wrap gap-1.5">
            {JOB_PIPELINE_STAGES.map((name, idx) => (
              <FilterChip key={name} active={pipelineSet.has(idx)} onClick={() => togglePipeline(idx)}>
                <span className="inline-flex size-4 items-center justify-center rounded-full bg-rose-100 text-[10px] font-medium text-rose-600">{idx + 1}</span>
                {name}
              </FilterChip>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="渠道">
          <div className="flex flex-wrap gap-1.5">
            {JOB_CHANNELS.map((channel) => (
              <FilterChip key={channel} active={channelSet.has(channel)} onClick={() => toggleInSet(setChannelSet, channel)}>
                {channel}
              </FilterChip>
            ))}
          </div>
        </FilterSection>

        {(allCompanies.length > 0 || companySet.size > 0) && (
          <FilterSection title="公司">
            {(allCompanies.length > 8 || companyFilterQ) && (
              <div className="relative mb-2">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={companyFilterQ}
                  onChange={(e) => setCompanyFilterQ(e.target.value)}
                  placeholder="搜索公司..."
                  className="h-7 w-full rounded-md border border-slate-200 bg-white pl-7 pr-2 text-xs text-slate-700 outline-none focus:border-blue-300"
                />
              </div>
            )}
            <div className={cn("flex flex-wrap gap-1.5", allCompanies.length > 12 && "max-h-40 overflow-y-auto pr-1")}>
              {allCompanies
                .filter((name) => !companyFilterQ || name.toLowerCase().includes(companyFilterQ.toLowerCase()))
                .map((name) => (
                  <FilterChip key={name} active={companySet.has(name)} onClick={() => toggleInSet(setCompanySet, name)}>
                    {name}
                  </FilterChip>
                ))}
              {allCompanies.filter((name) => !companyFilterQ || name.toLowerCase().includes(companyFilterQ.toLowerCase())).length === 0 && (
                <span className="text-[11px] text-slate-400">无匹配公司</span>
              )}
            </div>
          </FilterSection>
        )}

        <FilterSection title="投递时间">
          <div className="flex flex-wrap gap-1.5">
            {TIME_PRESETS.map((preset) => (
              <FilterChip key={preset.key} active={timePreset === preset.key} onClick={() => setTimePreset(preset.key)}>
                {preset.label}
              </FilterChip>
            ))}
          </div>
        </FilterSection>

        {knownLocations.length > 0 && (
          <FilterSection title="工作地点">
            <div className="flex flex-wrap gap-1.5">
              {knownLocations.map((loc) => (
                <FilterChip key={loc} active={locationSet.has(loc)} onClick={() => toggleInSet(setLocationSet, loc)}>
                  {loc}
                </FilterChip>
              ))}
            </div>
          </FilterSection>
        )}

        <FilterSection title="其他">
          <div className="space-y-2">
            <ToggleRow active={priorityOnly} onToggle={() => setPriorityOnly((v) => !v)} icon={<Star size={13} className={priorityOnly ? "fill-amber-400 text-amber-400" : "text-slate-400"} />}>
              仅看重点
            </ToggleRow>
            <ToggleRow active={includeArchived} onToggle={() => setIncludeArchived((v) => !v)} icon={<Archive size={13} className={includeArchived ? "text-slate-700" : "text-slate-400"} />}>
              包含已归档
            </ToggleRow>
          </div>
        </FilterSection>
      </div>
    )
  }

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
              {activeFilterCount > 0 && <span className={modulePillClass(true)}>已筛选 {activeFilterCount}</span>}
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
          <ModulePanel
            title="数据概览"
            icon={BarChart3}
            contentClassName="pt-3"
            action={
              <button onClick={() => setShowStats((v) => !v)} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100">
                {showStats ? <><ChevronUp size={13} /> 收起</> : <><ChevronDown size={13} /> 展开</>}
              </button>
            }
          >
            {showStats && (
              <div className="space-y-4">
                <ModuleStatGrid>
                  <StatsCard title={dict.jobs.total} value={stats.total} sub="累计投递" icon={BriefcaseBusiness} />
                  <StatsCard title="进行中" value={stats.activeCount} sub={`占 ${stats.total > 0 ? Math.round((stats.activeCount / stats.total) * 100) : 0}%`} icon={BriefcaseBusiness} tone="blue" />
                  <StatsCard title={dict.jobs.replyRate} value={`${stats.replyRate}%`} sub={`${stats.replied} 已回复`} trend={stats.replyRate > 50 ? "up" : "neutral"} icon={BarChart3} tone="green" />
                  <StatsCard title={dict.jobs.interviewRate} value={`${stats.interviewRate}%`} sub={`${stats.hasInterview} 进面试`} icon={Eye} tone="amber" />
                </ModuleStatGrid>
                <ModuleStatGrid>
                  <StatsCard title={dict.jobs.offerRate} value={`${stats.offerRate}%`} sub={`${stats.offers} Offer`} trend={stats.offerRate > 0 ? "up" : "neutral"} icon={BriefcaseBusiness} tone="coral" />
                  <StatsCard title="重点公司" value={stats.priorityCount} sub="标记为重点" icon={Star} tone="amber" />
                  <StatsCard title="本周待跟进" value={stats.upcomingCount} sub="未来 7 天" icon={CalendarClock} tone="coral" />
                  <StatsCard
                    title="距最近投递"
                    value={stats.daysSinceLastApply === null ? "—" : `${stats.daysSinceLastApply} 天`}
                    sub={stats.daysSinceLastApply === null ? "暂无记录" : stats.daysSinceLastApply <= 1 ? "今天活跃" : stats.daysSinceLastApply <= 7 ? "近期有动作" : "已沉寂"}
                    trend={stats.daysSinceLastApply !== null && stats.daysSinceLastApply <= 7 ? "up" : "neutral"}
                    icon={CalendarClock}
                    tone="slate"
                  />
                </ModuleStatGrid>

                {stats.total > 0 && (
                  <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                    <ModulePanel title="历史漏斗分析" icon={BarChart3} className="lg:col-span-2 xl:col-span-2" contentClassName="p-0">
                      <FunnelTable data={stats.funnelDist} total={stats.total} />
                    </ModulePanel>
                    <ModulePanel title="流程阶段分布" icon={BarChart3} contentClassName="pt-3">
                      <SimpleBarChart data={stats.pipelineDist} height={Math.max(140, stats.pipelineDist.length * 34)} />
                    </ModulePanel>
                    <ModulePanel title={dict.jobs.statusChart} icon={BarChart3} contentClassName="pt-3">
                      <SimpleBarChart data={statusDist} height={Math.max(140, statusDist.length * 34)} />
                    </ModulePanel>
                    <ModulePanel title={dict.jobs.channelChart} icon={BarChart3} contentClassName="pt-3">
                      <SimpleBarChart data={stats.channelDist} height={Math.max(140, stats.channelDist.length * 34)} />
                    </ModulePanel>
                    {stats.locationDist.length > 0 && (
                      <ModulePanel title="工作地点 TOP" icon={MapPin} contentClassName="pt-3">
                        <SimpleBarChart data={stats.locationDist} height={Math.max(140, stats.locationDist.length * 34)} />
                      </ModulePanel>
                    )}
                    {stats.weeklyTrend.some((p) => p.value > 0) && (
                      <ModulePanel title="近 8 周投递趋势" icon={BarChart3} contentClassName="pt-3">
                        <SimpleLineChart data={stats.weeklyTrend} height={190} />
                      </ModulePanel>
                    )}
                    {stats.monthlyTrend.length > 1 && (
                      <ModulePanel title={dict.jobs.trendChart} icon={BarChart3} contentClassName="pt-3">
                        <SimpleLineChart data={stats.monthlyTrend} height={190} />
                      </ModulePanel>
                    )}
                  </div>
                )}
              </div>
            )}
          </ModulePanel>
        )}

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
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label="清空搜索">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilterDrawerOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm hover:border-blue-300 lg:hidden"
            >
              <Filter size={15} />
              筛选
              {activeFilterCount > 0 && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-100 px-1.5 text-[11px] font-medium text-blue-700">{activeFilterCount}</span>}
            </button>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-11 w-36 rounded-full border-slate-200 bg-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
                  <SelectItem key={key} value={key}>排序：{SORT_LABEL[key]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {view === "table" && (
              <Popover open={colSettingsOpen} onOpenChange={setColSettingsOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm hover:border-blue-300"
                    title="设置显示列"
                  >
                    <Settings2 size={14} /> 列
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-medium text-slate-600">
                      {visibleCols.size}/{TABLE_COLUMNS.length}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">显示列</span>
                    <button onClick={resetCols} className="text-xs text-blue-600 hover:underline">重置</button>
                  </div>
                  <div className="space-y-1">
                    {TABLE_COLUMNS.map((col) => {
                      const checked = visibleCols.has(col.key)
                      const disabled = !!col.locked
                      return (
                        <label
                          key={col.key}
                          className={cn(
                            "flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm transition",
                            disabled ? "cursor-not-allowed opacity-60" : "hover:bg-slate-50",
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="size-4 rounded accent-blue-600"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => toggleCol(col.key)}
                            />
                            <span className="text-slate-700">{col.label}</span>
                          </span>
                          {col.locked && <span className="text-[10px] text-slate-400">必选</span>}
                        </label>
                      )
                    })}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">设置已自动保存到本机。</p>
                </PopoverContent>
              </Popover>
            )}
            <div className="inline-flex h-11 items-center rounded-full border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition",
                  view === "list" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-800",
                )}
                title="列表视图"
              >
                <List size={14} /> 列表
              </button>
              <button
                type="button"
                onClick={() => setView("table")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition",
                  view === "table" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-800",
                )}
                title="表格视图"
              >
                <TableIcon size={14} /> 表格
              </button>
              <button
                type="button"
                onClick={() => setView("kanban")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition",
                  view === "kanban" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-800",
                )}
                title="看板视图"
              >
                <LayoutGrid size={14} /> 看板
              </button>
            </div>
          </div>
        </ModuleToolbar>

        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            {renderFilterRail(false)}
          </aside>

          <section className="min-w-0">
            <ModulePanel
              title={view === "kanban" ? "求职看板" : view === "table" ? "求职记录（表格）" : "求职记录"}
              description={
                view === "kanban"
                  ? "按状态分列，可拖拽卡片改变状态。"
                  : view === "table"
                    ? "经典表格视图，适合横向对比、批量浏览；可横向滚动查看更多字段。"
                    : "按重点 + 添加顺序排列；点击卡片查看详情，状态可在卡片内直接修改。"
              }
              icon={BriefcaseBusiness}
              contentClassName={view === "kanban" ? "p-4" : "p-0"}
            >
              {loading ? (
                <ModuleContentLoading rows={7} table={view !== "kanban"} />
              ) : jobs.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    title={dict.common.noData}
                    description={activeFilterCount > 0 ? "当前筛选没有匹配的求职记录。" : dict.jobs.noData}
                    action={{ label: dict.jobs.newApplication, onClick: openCreate }}
                  />
                </div>
              ) : view === "list" ? (
                <>
                  <ul className="divide-y divide-slate-100">
                    {jobs.map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        onOpen={() => openDetail(job)}
                        onEdit={() => openEdit(job)}
                        onDelete={() => handleDelete(job.id)}
                        onStatusChange={(value) => handleStatusChange(job.id, value)}
                        onPriorityToggle={() => handlePriorityToggle(job)}
                        deleting={deletingId === job.id}
                      />
                    ))}
                  </ul>

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
              ) : view === "table" ? (
                <>
                  <JobsTable
                    jobs={jobs}
                    visibleCols={visibleCols}
                    onOpen={openDetail}
                    onEdit={openEdit}
                    onDelete={(id) => handleDelete(id)}
                    onStatusChange={handleStatusChange}
                    onPriorityToggle={handlePriorityToggle}
                    deletingId={deletingId}
                    dict={dict}
                  />
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
              ) : (
                <KanbanBoard
                  jobs={jobs}
                  onOpen={openDetail}
                  onStatusChange={handleStatusChange}
                  onPriorityToggle={handlePriorityToggle}
                />
              )}
            </ModulePanel>
          </section>
        </div>
      </div>

      {/* 移动端筛选抽屉 */}
      <Sheet open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
        <SheetContent className="w-full overflow-y-auto bg-white sm:max-w-sm">
          <SheetHeader className="mb-2">
            <SheetTitle>筛选求职记录</SheetTitle>
          </SheetHeader>
          {renderFilterRail(true)}
        </SheetContent>
      </Sheet>

      {/* 详情 Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full overflow-y-auto bg-white sm:max-w-md">
          {detailJob && (
            <>
              <SheetHeader className="mb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <SheetTitle className="flex items-center gap-2">
                      {(detailJob.priority ?? 0) > 0 && <Star size={16} className="fill-amber-400 text-amber-400" />}
                      <span className="truncate">{detailJob.company}</span>
                    </SheetTitle>
                    <p className="mt-1 text-sm text-slate-500">{detailJob.position}</p>
                  </div>
                  {detailJob.archivedAt && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
                      <Archive size={11} /> 已归档
                    </span>
                  )}
                </div>
              </SheetHeader>
              <div className="space-y-4 text-sm">
                <Select value={detailJob.status} onValueChange={(value) => handleStatusChange(detailJob.id, value)}>
                  <SelectTrigger className="h-9 w-auto gap-1 border-slate-200">
                    <StatusBadge status={detailJob.status} type="job" />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_STATUS.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                  </SelectContent>
                </Select>

                <div className="rounded-[14px] border border-slate-200 bg-white p-3">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">求职流程</p>
                  <PipelineTracker
                    stage={detailJob.pipelineStage ?? 0}
                    onChange={(next) => handlePipelineChange(detailJob.id, next)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                  <div><span className="mb-0.5 block text-slate-400">{dict.jobs.channel}</span><span>{detailJob.channel}</span></div>
                  <div><span className="mb-0.5 block text-slate-400">{dict.jobs.appliedAt}</span><span className="font-mono">{formatChinaDate(detailJob.appliedAt)}</span></div>
                  <div><span className="mb-0.5 block text-slate-400">{dict.jobs.baseLocation}</span><span>{detailJob.baseLocation || "-"}</span></div>
                  <div><span className="mb-0.5 block text-slate-400">薪资范围</span><span>{detailJob.salaryRange || "-"}</span></div>
                  <div><span className="mb-0.5 block text-slate-400">{dict.jobs.hrContact}</span><span>{detailJob.hrContact || "-"}</span></div>
                  <div><span className="mb-0.5 block text-slate-400">{dict.nav.interviews}</span><span className="font-mono">{detailJob._count?.interviews ?? 0}</span></div>
                  {detailJob.nextActionAt && (
                    <div className="col-span-2">
                      <span className="mb-0.5 block text-slate-400">下一步</span>
                      <span className="inline-flex items-center gap-1 font-mono text-amber-700"><CalendarClock size={12} /> {formatChinaDate(detailJob.nextActionAt)}</span>
                    </div>
                  )}
                  {detailJob.link && (
                    <div className="col-span-2">
                      <span className="mb-0.5 block text-slate-400">{dict.jobs.link}</span>
                      <a href={detailJob.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-blue-600 hover:underline">
                        {detailJob.link} <ExternalLink size={11} />
                      </a>
                    </div>
                  )}
                </div>

                {detailJob.jobDescription && (
                  <div>
                    <span className="mb-1 flex items-center gap-1 text-xs text-slate-400"><FileText size={12} /> 职位描述</span>
                    <div className="max-h-96 overflow-y-auto rounded-[14px] border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                      <JdRenderer text={detailJob.jobDescription} onImageClick={(src) => setLightboxSrc(src)} />
                    </div>
                  </div>
                )}

                {detailJob.notes && (
                  <div>
                    <span className="mb-1 block text-xs text-slate-400">{dict.jobs.notes}</span>
                    <p className="whitespace-pre-wrap rounded-[14px] border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">{detailJob.notes}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(detailJob)}><Pencil size={13} /> {dict.common.edit}</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleArchiveToggle(detailJob.id, !detailJob.archivedAt)}
                    loading={archivingId === detailJob.id}
                  >
                    {detailJob.archivedAt ? <><ArchiveRestore size={13} /> 取消归档</> : <><Archive size={13} /> 归档</>}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDelete(detailJob.id, true)} loading={deletingId === detailJob.id} loadingText={dict.common.delete} className="text-rose-600 hover:text-rose-600"><Trash2 size={13} /> {dict.common.delete}</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* 编辑 / 新建 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-h-[90vh] max-w-2xl overflow-y-auto"
          onPaste={(e) => {
            // JD textarea 有自己的 onPaste，事件冒泡到这里时若 target 是 textarea 就跳过
            const target = e.target as HTMLElement | null
            if (target?.tagName === "TEXTAREA") return
            const items = e.clipboardData?.items
            if (!items || items.length === 0) return
            for (const item of items) {
              if (item.kind === "file" && item.type.startsWith("image/")) {
                const f = item.getAsFile()
                if (f) {
                  e.preventDefault()
                  void handleAiExtract(f)
                  return
                }
              }
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{editingJob ? dict.jobs.editApplication : dict.jobs.newApplication}</DialogTitle>
          </DialogHeader>
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-[14px] border border-blue-100 bg-blue-50/50 px-3 py-2 text-xs text-slate-600">
            <Sparkles size={14} className="text-blue-600" />
            <span className="flex-1">
              上传或直接 <kbd className="rounded border border-slate-300 bg-white px-1 font-mono text-[10px] text-slate-600">Ctrl/⌘ + V</kbd> 粘贴岗位截图，AI 自动识别公司、职位、地点、薪资、JD 等字段。
            </span>
            <label className={cn(
              "inline-flex cursor-pointer items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition",
              aiExtracting ? "cursor-not-allowed bg-slate-200 text-slate-500" : "bg-blue-600 text-white hover:bg-blue-700",
            )}>
              {aiExtracting ? "识别中..." : <><Sparkles size={12} /> AI 识别岗位</>}
              <input
                type="file"
                accept="image/*"
                disabled={aiExtracting}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleAiExtract(file)
                  e.target.value = ""
                }}
              />
            </label>
          </div>
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
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label className="mb-1 block text-xs">{dict.jobs.baseLocation}</Label>
                <Input value={form.baseLocation} onChange={(e) => setForm((f) => ({ ...f, baseLocation: e.target.value }))} placeholder="北京 / 上海 / 远程" />
              </div>
              <div>
                <Label className="mb-1 block text-xs">薪资范围</Label>
                <Input value={form.salaryRange} onChange={(e) => setForm((f) => ({ ...f, salaryRange: e.target.value }))} placeholder="25-35K · 14薪" />
              </div>
              <div>
                <Label className="mb-1 block text-xs">{dict.jobs.hrContact}</Label>
                <Input value={form.hrContact} onChange={(e) => setForm((f) => ({ ...f, hrContact: e.target.value }))} placeholder="HR 姓名 / 手机 / 微信" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1 block text-xs">{dict.jobs.link}</Label>
                <Input value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} placeholder="https://..." className="font-mono" />
              </div>
              <div>
                <Label className="mb-1 block text-xs">下一步时间</Label>
                <Input type="date" value={form.nextActionAt} onChange={(e) => setForm((f) => ({ ...f, nextActionAt: e.target.value }))} className="font-mono" />
              </div>
            </div>
            <div>
              <Label className="mb-1 flex items-center gap-1 text-xs"><Star size={11} /> 重点标记</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 0, label: "普通" },
                  { value: 1, label: "重点" },
                  { value: 2, label: "梦中情司" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, priority: opt.value }))}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs transition",
                      form.priority === opt.value
                        ? "border-amber-300 bg-amber-50 text-amber-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block text-xs">求职流程</Label>
              <div className="rounded-[12px] border border-slate-200 bg-slate-50/50 p-3">
                <PipelineTracker
                  stage={form.pipelineStage}
                  onChange={(next) => setForm((f) => ({ ...f, pipelineStage: next }))}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <Label className="flex items-center gap-1 text-xs"><FileText size={11} /> 职位描述（JD）</Label>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  {uploadingImage && <span className="text-blue-600">上传图片中...</span>}
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-slate-500 hover:border-blue-300 hover:text-blue-600">
                    <ImagePlus size={11} /> 插入图片
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void handleJdFilePick(file)
                        e.target.value = ""
                      }}
                    />
                  </label>
                </div>
              </div>
              <Textarea
                ref={jdTextareaRef}
                value={form.jobDescription}
                onChange={(e) => setForm((f) => ({ ...f, jobDescription: e.target.value }))}
                onPaste={handleJdPaste}
                placeholder="粘贴或编写岗位职责、任职要求；可直接粘贴图片，会自动上传并以 Markdown 形式插入"
                rows={6}
              />
              <p className="mt-1 text-[11px] text-slate-400">支持 Markdown，粘贴图片会自动上传。点击下方缩略图可大图查看。</p>
              <JdImageStrip text={form.jobDescription} onClick={(src) => setLightboxSrc(src)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">{dict.jobs.notes}</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="个人备忘：投递情况、跟进想法等" rows={3} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>{dict.jobs.cancel}</Button>
              <Button size="sm" onClick={handleSave} loading={saving} loadingText={dict.jobs.saving}>{dict.jobs.save}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />

      {/* 悬浮的新建申请按钮，避免每次都要回到顶部 */}
      {!dialogOpen && !detailOpen && !filterDrawerOpen && !lightboxSrc && (
        <button
          type="button"
          onClick={openCreate}
          className="fixed bottom-6 right-6 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-slate-900 px-5 text-sm font-medium text-white shadow-[0_12px_28px_rgba(15,23,42,0.25)] transition hover:-translate-y-0.5 hover:bg-slate-950 active:translate-y-0 sm:bottom-8 sm:right-8"
          title={dict.jobs.newApplication}
          aria-label={dict.jobs.newApplication}
        >
          <Plus size={18} />
          <span className="hidden sm:inline">{dict.jobs.newApplication}</span>
        </button>
      )}
    </ModulePageShell>
  )
}

// ===== 子组件 =====

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      {children}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition",
        active
          ? "border-blue-300 bg-blue-50 text-blue-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800",
      )}
    >
      {children}
    </button>
  )
}

function ToggleRow({
  active,
  onToggle,
  icon,
  children,
}: {
  active: boolean
  onToggle: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs transition",
        active ? "border-blue-200 bg-blue-50/60 text-slate-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
      )}
    >
      <span className="inline-flex items-center gap-2">{icon}{children}</span>
      <span className={cn("inline-block size-4 rounded-full border", active ? "border-blue-500 bg-blue-500" : "border-slate-300 bg-white")}>
        {active && <span className="block size-1.5 translate-x-[5px] translate-y-[5px] rounded-full bg-white" />}
      </span>
    </button>
  )
}

function JobCard({
  job,
  onOpen,
  onEdit,
  onDelete,
  onStatusChange,
  onPriorityToggle,
  deleting,
}: {
  job: Job
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
  onStatusChange: (status: string) => void
  onPriorityToggle: () => void
  deleting: boolean
}) {
  const archived = !!job.archivedAt
  const priority = job.priority ?? 0
  const statusColor = STATUS_BAR_COLORS[job.status] ?? "bg-slate-300"

  return (
    <li
      className={cn(
        "group relative flex cursor-pointer items-stretch transition-colors hover:bg-slate-50/80",
        archived && "opacity-60",
      )}
      onClick={onOpen}
    >
      <span className={cn("w-1 shrink-0", statusColor)} aria-hidden />
      <div className="min-w-0 flex-1 px-4 py-3.5 sm:px-5 sm:py-4">
        {/* 第一行：星标 + 公司 + 职位 + 操作 */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onPriorityToggle() }}
              className="shrink-0 rounded-full p-0.5 text-slate-300 hover:text-amber-400"
              title={priority > 0 ? "取消重点" : "标记重点"}
            >
              <Star size={16} className={cn(priority > 0 && "fill-amber-400 text-amber-400")} />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950 sm:text-[15px]">{job.company}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500 sm:text-sm">{job.position}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
            <button onClick={onEdit} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="编辑"><Pencil size={13} /></button>
            <button
              onClick={onDelete}
              disabled={deleting}
              aria-busy={deleting || undefined}
              className="rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
              title="删除"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* 第二行：状态 + 渠道 + 地点 + 薪资 + 日期 */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          <span onClick={(e) => e.stopPropagation()}>
            <Select value={job.status} onValueChange={onStatusChange}>
              <SelectTrigger className="h-7 w-auto gap-1 border-0 bg-transparent p-0 shadow-none focus:ring-0">
                <StatusBadge status={job.status} type="job" />
              </SelectTrigger>
              <SelectContent>
                {JOB_STATUS.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
              </SelectContent>
            </Select>
          </span>
          <span className="text-slate-500">{job.channel}</span>
          {job.baseLocation && (
            <span className="inline-flex items-center gap-1 text-slate-500"><MapPin size={11} /> {job.baseLocation}</span>
          )}
          {job.salaryRange && <span className="text-slate-500">{job.salaryRange}</span>}
          <span className="ml-auto font-mono text-[11px] text-slate-400">投递 {formatChinaDate(job.appliedAt, { month: "2-digit", day: "2-digit" })}</span>
        </div>

        {/* 第三行：标记小图标 */}
        {(job.jobDescription || job.link || job.hrContact || job.nextActionAt || (job._count?.interviews ?? 0) > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            {job.jobDescription && <span className="inline-flex items-center gap-1"><FileText size={11} /> JD</span>}
            {job.link && (
              <a href={job.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                <ExternalLink size={11} /> 链接
              </a>
            )}
            {job.hrContact && <span className="inline-flex items-center gap-1"><Phone size={11} /> {job.hrContact}</span>}
            {(job._count?.interviews ?? 0) > 0 && <span className="inline-flex items-center gap-1"><Eye size={11} /> {job._count?.interviews} 次面试</span>}
            {job.nextActionAt && (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <CalendarClock size={11} /> {formatChinaDate(job.nextActionAt, { month: "2-digit", day: "2-digit" })}
              </span>
            )}
          </div>
        )}

        {/* 第四行：流程进度条（紧凑） */}
        <div className="mt-2.5 flex items-center gap-2">
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-400">流程</span>
          <div className="min-w-0 flex-1">
            <PipelineTracker stage={job.pipelineStage ?? 0} compact />
          </div>
          <span className="shrink-0 text-[10px] font-mono text-slate-400">
            {JOB_PIPELINE_STAGES[Math.min(Math.max(job.pipelineStage ?? 0, 0), JOB_PIPELINE_STAGES.length - 1)]}
          </span>
        </div>
      </div>
    </li>
  )
}

// 看板视图：列 = 状态。放弃类状态是终态，不进看板。
const KANBAN_STATUSES = JOB_STATUS.filter((status) => status !== "已放弃" && status !== "无回复放弃") as readonly string[]

function KanbanBoard({
  jobs,
  onOpen,
  onStatusChange,
  onPriorityToggle,
}: {
  jobs: Job[]
  onOpen: (job: Job) => void
  onStatusChange: (id: string, status: string) => void | Promise<void>
  onPriorityToggle: (job: Job) => void | Promise<void>
}) {
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null)
  const grouped = useMemo(() => {
    const map = new Map<string, Job[]>()
    KANBAN_STATUSES.forEach((status) => map.set(status, []))
    jobs.forEach((job) => {
      if (job.status === "已放弃" || job.status === "无回复放弃") return
      const bucket = map.get(job.status)
      if (bucket) bucket.push(job)
      else map.set(job.status, [job])
    })
    return map
  }, [jobs])

  function handleDrop(targetStatus: string, jobId: string, fromStatus: string) {
    setDragOverStatus(null)
    if (targetStatus === fromStatus) return
    void onStatusChange(jobId, targetStatus)
  }

  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto pb-2 sm:gap-4">
      {KANBAN_STATUSES.map((status) => {
        const list = grouped.get(status) ?? []
        const dragOver = dragOverStatus === status
        return (
          <div
            key={status}
            className={cn(
              "flex w-[260px] shrink-0 flex-col rounded-[14px] border bg-slate-50/70 transition-colors",
              dragOver ? "border-blue-300 bg-blue-50/70" : "border-slate-200",
            )}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOverStatus(status)
            }}
            onDragLeave={() => setDragOverStatus((current) => (current === status ? null : current))}
            onDrop={(e) => {
              const jobId = e.dataTransfer.getData("text/job-id")
              const fromStatus = e.dataTransfer.getData("text/job-status")
              if (jobId) handleDrop(status, jobId, fromStatus)
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", STATUS_BAR_COLORS[status] ?? "bg-slate-300")} />
                <span className="text-xs font-semibold text-slate-700">{status}</span>
              </div>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">{list.length}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2 sm:max-h-[640px]">
              {list.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-[11px] text-slate-400">
                  拖拽卡片到这里
                </div>
              ) : (
                list.map((job) => (
                  <KanbanCard
                    key={job.id}
                    job={job}
                    onOpen={() => onOpen(job)}
                    onPriorityToggle={() => onPriorityToggle(job)}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function KanbanCard({
  job,
  onOpen,
  onPriorityToggle,
}: {
  job: Job
  onOpen: () => void
  onPriorityToggle: () => void
}) {
  const priority = job.priority ?? 0
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData("text/job-id", job.id)
        e.dataTransfer.setData("text/job-status", job.status)
      }}
      onClick={onOpen}
      className="group cursor-grab rounded-[12px] border border-slate-200 bg-white p-2.5 text-left shadow-sm transition hover:border-blue-300 hover:shadow active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950">{job.company}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{job.position}</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onPriorityToggle() }}
          className="shrink-0 text-slate-300 hover:text-amber-400"
          title={priority > 0 ? "取消重点" : "标记重点"}
        >
          <Star size={14} className={cn(priority > 0 && "fill-amber-400 text-amber-400")} />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
        <span>{job.channel}</span>
        {job.baseLocation && <span className="inline-flex items-center gap-0.5"><MapPin size={10} /> {job.baseLocation}</span>}
        {job.salaryRange && <span>{job.salaryRange}</span>}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
        <span className="font-mono">{formatChinaDate(job.appliedAt, { month: "2-digit", day: "2-digit" })}</span>
        <div className="flex items-center gap-2">
          {job.jobDescription && <FileText size={11} />}
          {job.link && <ExternalLink size={11} />}
          {(job._count?.interviews ?? 0) > 0 && <span className="font-mono">{job._count?.interviews}面</span>}
          {job.nextActionAt && <CalendarClock size={11} className="text-amber-600" />}
        </div>
      </div>
    </div>
  )
}

// 表格视图：横向滚动，列宽固定；状态可内联修改、星标可切换；点击行打开详情。
function JobsTable({
  jobs,
  visibleCols,
  onOpen,
  onEdit,
  onDelete,
  onStatusChange,
  onPriorityToggle,
  deletingId,
  dict,
}: {
  jobs: Job[]
  visibleCols: Set<TableColumnKey>
  onOpen: (job: Job) => void
  onEdit: (job: Job) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: string) => void | Promise<void>
  onPriorityToggle: (job: Job) => void | Promise<void>
  deletingId: string | null
  dict: ReturnType<typeof getDict>
}) {
  const headerMeta: Record<TableColumnKey, { label: React.ReactNode; className: string }> = {
    priority: { label: <Star size={13} className="text-slate-400" />, className: "w-10" },
    company: { label: dict.jobs.company, className: "w-[160px]" },
    position: { label: dict.jobs.position, className: "w-[180px]" },
    channel: { label: dict.jobs.channel, className: "w-[100px]" },
    appliedAt: { label: dict.jobs.appliedAt, className: "w-[96px]" },
    status: { label: dict.jobs.status, className: "w-[120px]" },
    pipeline: { label: "求职流程", className: "w-[220px]" },
    location: { label: dict.jobs.baseLocation, className: "w-[110px]" },
    salary: { label: "薪资", className: "w-[120px]" },
    hr: { label: dict.jobs.hrContact, className: "w-[140px]" },
    interviews: { label: dict.nav.interviews, className: "w-[72px] text-center" },
    link: { label: dict.jobs.link, className: "w-[72px]" },
    jd: { label: "JD", className: "w-[56px] text-center" },
    nextAction: { label: "下一步", className: "w-[100px]" },
    notes: { label: dict.jobs.notes, className: "w-[200px]" },
    actions: { label: "", className: "w-[110px]" },
  }

  const cols = TABLE_COLUMNS.filter((c) => visibleCols.has(c.key))
  // 估算最小宽度：累加所有可见列的 w-[..] 像素值
  const minWidth = cols.reduce((sum, col) => {
    const match = headerMeta[col.key].className.match(/w-\[(\d+)px\]/) ?? headerMeta[col.key].className.match(/w-(\d+)/)
    const px = match ? Number(match[1]) * (match[0].startsWith("w-[") ? 1 : 4) : 80
    return sum + px
  }, 0)

  function renderCell(job: Job, key: TableColumnKey) {
    const priority = job.priority ?? 0
    const archived = !!job.archivedAt
    switch (key) {
      case "priority":
        return (
          <td key={key} className="border-b border-slate-100 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onPriorityToggle(job)}
              className="rounded-full p-0.5 text-slate-300 hover:text-amber-400"
              title={priority > 0 ? "取消重点" : "标记重点"}
            >
              <Star size={14} className={cn(priority > 0 && "fill-amber-400 text-amber-400")} />
            </button>
          </td>
        )
      case "company":
        return (
          <td key={key} className="truncate border-b border-slate-100 px-3 py-2.5 font-semibold text-slate-950">
            <div className="flex items-center gap-1.5">
              <span className="truncate">{job.company}</span>
              {archived && (
                <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">已归档</span>
              )}
            </div>
          </td>
        )
      case "position":
        return <td key={key} className="truncate border-b border-slate-100 px-3 py-2.5 text-slate-700">{job.position}</td>
      case "channel":
        return <td key={key} className="truncate border-b border-slate-100 px-3 py-2.5 text-xs text-slate-500">{job.channel}</td>
      case "appliedAt":
        return (
          <td key={key} className="border-b border-slate-100 px-3 py-2.5 font-mono text-xs text-slate-500">
            {formatChinaDate(job.appliedAt, { month: "2-digit", day: "2-digit" })}
          </td>
        )
      case "status":
        return (
          <td key={key} className="border-b border-slate-100 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
            <Select value={job.status} onValueChange={(value) => onStatusChange(job.id, value)}>
              <SelectTrigger className="h-7 w-auto gap-1 border-0 bg-transparent p-0 shadow-none focus:ring-0">
                <StatusBadge status={job.status} type="job" />
              </SelectTrigger>
              <SelectContent>
                {JOB_STATUS.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
              </SelectContent>
            </Select>
          </td>
        )
      case "pipeline":
        return (
          <td key={key} className="border-b border-slate-100 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="shrink-0 font-mono">{(job.pipelineStage ?? 0) + 1}/{JOB_PIPELINE_STAGES.length}</span>
              <div className="min-w-0 flex-1"><PipelineTracker stage={job.pipelineStage ?? 0} compact /></div>
              <span className="shrink-0">{JOB_PIPELINE_STAGES[Math.min(Math.max(job.pipelineStage ?? 0, 0), JOB_PIPELINE_STAGES.length - 1)]}</span>
            </div>
          </td>
        )
      case "location":
        return <td key={key} className="truncate border-b border-slate-100 px-3 py-2.5 text-xs text-slate-500">{job.baseLocation || "-"}</td>
      case "salary":
        return <td key={key} className="truncate border-b border-slate-100 px-3 py-2.5 text-xs text-slate-600">{job.salaryRange || "-"}</td>
      case "hr":
        return <td key={key} className="truncate border-b border-slate-100 px-3 py-2.5 text-xs text-slate-500">{job.hrContact || "-"}</td>
      case "interviews":
        return (
          <td key={key} className="border-b border-slate-100 px-3 py-2.5 text-center font-mono text-xs text-slate-500">
            {job._count?.interviews ?? 0}
          </td>
        )
      case "link":
        return (
          <td key={key} className="border-b border-slate-100 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
            {job.link ? (
              <a
                href={job.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
              >
                打开 <ExternalLink size={11} />
              </a>
            ) : (
              <span className="text-xs text-slate-400">-</span>
            )}
          </td>
        )
      case "jd":
        return (
          <td key={key} className="border-b border-slate-100 px-3 py-2.5 text-center">
            {job.jobDescription ? (
              <FileText size={14} className="mx-auto text-slate-500" />
            ) : (
              <span className="text-xs text-slate-300">-</span>
            )}
          </td>
        )
      case "nextAction":
        return (
          <td key={key} className="border-b border-slate-100 px-3 py-2.5 font-mono text-xs">
            {job.nextActionAt ? (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <CalendarClock size={11} /> {formatChinaDate(job.nextActionAt, { month: "2-digit", day: "2-digit" })}
              </span>
            ) : (
              <span className="text-slate-400">-</span>
            )}
          </td>
        )
      case "notes":
        return <td key={key} className="truncate border-b border-slate-100 px-3 py-2.5 text-xs text-slate-500">{job.notes || "-"}</td>
      case "actions":
        return (
          <td key={key} className="border-b border-slate-100 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => onOpen(job)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                title={dict.jobs.detail}
              >
                <Eye size={13} />
              </button>
              <button
                onClick={() => onEdit(job)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title={dict.common.edit}
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => onDelete(job.id)}
                disabled={deletingId === job.id}
                aria-busy={deletingId === job.id || undefined}
                className="rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                title={dict.common.delete}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </td>
        )
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-separate border-spacing-0 text-sm" style={{ minWidth: `${minWidth}px` }}>
        <thead className="sticky top-0 z-10">
          <tr>
            {cols.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-xs font-semibold text-slate-500",
                  headerMeta[col.key].className,
                )}
              >
                {headerMeta[col.key].label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const archived = !!job.archivedAt
            return (
              <tr
                key={job.id}
                className={cn(
                  "group cursor-pointer transition-colors hover:bg-blue-50/40",
                  archived && "opacity-60",
                )}
                onClick={() => onOpen(job)}
              >
                {cols.map((col) => renderCell(job, col.key))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// 求职流程进度条：6 步（投递 / 测评 / 简历筛选 / 面试 / Offer / 入职），可点击切换
function PipelineTracker({
  stage,
  onChange,
  compact = false,
}: {
  stage: number
  onChange?: (next: number) => void
  compact?: boolean
}) {
  const clamped = Math.min(Math.max(stage, 0), JOB_PIPELINE_STAGES.length - 1)
  const interactive = !!onChange
  return (
    <div className="w-full">
      <div className={cn("flex items-stretch justify-between", compact ? "gap-1" : "gap-2 sm:gap-3")}>
        {JOB_PIPELINE_STAGES.map((name, idx) => {
          const isPast = idx < clamped
          const isCurrent = idx === clamped
          const isFuture = idx > clamped
          return (
            <div key={name} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="relative flex w-full items-center">
                {/* 左半连线 */}
                <div className={cn(
                  "h-px flex-1",
                  idx === 0 ? "invisible" : isPast || isCurrent ? "bg-rose-300" : "bg-slate-200",
                )} />
                <button
                  type="button"
                  onClick={interactive ? () => onChange?.(idx) : undefined}
                  disabled={!interactive}
                  className={cn(
                    "relative inline-flex shrink-0 items-center justify-center rounded-full border-2 transition",
                    compact ? "size-3.5 border" : "size-5",
                    isPast && "border-rose-400 bg-rose-400",
                    isCurrent && "border-rose-500 bg-rose-500 ring-4 ring-rose-100",
                    isFuture && "border-slate-300 bg-white",
                    interactive && !compact && "cursor-pointer hover:scale-110",
                    !interactive && "cursor-default",
                  )}
                  title={interactive ? `设置到「${name}」` : name}
                >
                  {isPast && !compact && (
                    <svg viewBox="0 0 12 12" className="size-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M2 6.5L4.8 9 10 3.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                {/* 右半连线 */}
                <div className={cn(
                  "h-px flex-1",
                  idx === JOB_PIPELINE_STAGES.length - 1 ? "invisible" : isPast ? "bg-rose-300" : "bg-slate-200",
                )} />
              </div>
              {!compact && (
                <div className="mt-1.5 flex flex-col items-center text-center">
                  <span className={cn(
                    "text-[11px] sm:text-xs",
                    isCurrent ? "font-semibold text-slate-900" : isPast ? "text-slate-600" : "text-slate-400",
                  )}>
                    {name}
                  </span>
                  {isCurrent && (
                    <span className="mt-0.5 text-[10px] text-rose-500">{idx === 0 ? "已投递" : `已${name}`}</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 轻量 JD 渲染：保留换行，把 ![alt](url) 渲染成内联图片；其余原样输出。
function JdRenderer({ text, onImageClick }: { text: string; onImageClick?: (src: string) => void }) {
  const pattern = /!\[([^\]]*)\]\(([^)\s]+)\)/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let key = 0
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0
    if (start > lastIndex) {
      parts.push(<span key={`t-${key++}`} className="whitespace-pre-wrap">{text.slice(lastIndex, start)}</span>)
    }
    const alt = match[1] || "image"
    const src = match[2]
    parts.push(
      <span key={`i-${key++}`} className="my-2 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onClick={() => onImageClick?.(src)}
          className={cn(
            "max-h-80 max-w-full rounded-lg border border-slate-200 bg-white object-contain transition",
            onImageClick && "cursor-zoom-in hover:border-blue-300",
          )}
        />
      </span>,
    )
    lastIndex = start + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push(<span key={`t-${key++}`} className="whitespace-pre-wrap">{text.slice(lastIndex)}</span>)
  }
  return <>{parts}</>
}

// JD 中所有图片的横向缩略图条；点击大图预览。
function JdImageStrip({ text, onClick }: { text: string; onClick: (src: string) => void }) {
  const urls = useMemo(() => {
    const pattern = /!\[[^\]]*\]\(([^)\s]+)\)/g
    const out: string[] = []
    for (const m of text.matchAll(pattern)) out.push(m[1])
    return out
  }, [text])
  if (urls.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {urls.map((src, idx) => (
        <button
          key={`${src}-${idx}`}
          type="button"
          onClick={() => onClick(src)}
          className="group relative size-16 overflow-hidden rounded-md border border-slate-200 bg-slate-50 transition hover:border-blue-300"
          title="点击大图预览"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="size-full object-cover transition group-hover:scale-105" loading="lazy" />
        </button>
      ))}
    </div>
  )
}

// 图片灯箱：全屏遮罩 + 居中图片 + 点击/Esc 关闭
function ImageLightbox({ src, onClose }: { src: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!src) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", handler)
      document.body.style.overflow = ""
    }
  }, [src, onClose])
  if (!src) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
    >
      <button
        onClick={onClose}
        className="absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/30"
        aria-label="关闭"
      >
        <X size={18} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="预览"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
      />
    </div>
  )
}
