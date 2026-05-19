"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  CalendarClock, ChevronDown, ChevronUp, Code2, Copy, Database, ExternalLink, Filter, Hash, Pencil, Plus, Tag, Timer, Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ModuleHero, ModulePageShell, ModulePanel, ModuleToolbar } from "@/components/module/module-shell"
import { SimpleBarChart } from "@/components/charts/bar-chart"
import { SimpleLineChart } from "@/components/charts/line-chart"
import { EmptyState } from "@/components/empty-state"
import { apiDelete, apiFetch, apiPatch, apiPost } from "@/lib/api-client"
import { formatChinaDate } from "@/lib/time"
import { confirmAction } from "@/lib/interaction-feedback"
import { cn } from "@/lib/utils"
import {
  SQL_PRACTICE_DIFFICULTIES,
  SQL_PRACTICE_DIFFICULTY_COLORS,
  SQL_PRACTICE_DIFFICULTY_LABELS,
  SQL_PRACTICE_METHOD_PRESETS,
  SQL_PRACTICE_SOURCES,
  SQL_PRACTICE_TAG_PRESETS,
  type SqlPracticeDifficulty,
} from "@/lib/sql-practice/constants"

type Problem = {
  id: string
  title: string
  source: string
  sourceUrl: string
  difficulty: string
  tags: string[]
  methods: string[]
  durationMinutes: number
  notes: string
  code: string
  practicedAt: string
  createdAt: string
}

type Stats = {
  total: number
  today: number
  last7Days: number
  last30Days: number
  totalMinutes: number
  byDifficulty: Array<{ key: string; count: number }>
  bySource: Array<{ key: string; count: number }>
  byTag: Array<{ key: string; count: number }>
  byMethod: Array<{ key: string; count: number }>
  daily: Array<{ date: string; count: number }>
}

const DIFFICULTY_COLOR_FOR_CHART: Record<string, string> = {
  Easy: "#10b981",
  Medium: "#f59e0b",
  Hard: "#ef4444",
}

function splitInput(value: string): string[] {
  return value
    .split(/[,，;；\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function uniqMerge(a: string[], b: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of [...a, ...b]) {
    if (!seen.has(v)) {
      seen.add(v)
      out.push(v)
    }
  }
  return out
}

export function SqlPracticeClient({ isOwner }: { isOwner: boolean }) {
  const [problems, setProblems] = useState<Problem[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState({ difficulty: "all", source: "all", q: "" })

  // Quick entry form state
  const [title, setTitle] = useState("")
  const [source, setSource] = useState<string>("LeetCode")
  const [sourceUrl, setSourceUrl] = useState("")
  const [difficulty, setDifficulty] = useState<SqlPracticeDifficulty>("Medium")
  const [tagsInput, setTagsInput] = useState("")
  const [methodsInput, setMethodsInput] = useState("")
  const [duration, setDuration] = useState<string>("")
  const [notes, setNotes] = useState("")
  const [code, setCode] = useState("")
  const [codeOpen, setCodeOpen] = useState(false)
  const [editing, setEditing] = useState<Problem | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const savingRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter.difficulty !== "all") params.set("difficulty", filter.difficulty)
      if (filter.source !== "all") params.set("source", filter.source)
      if (filter.q.trim()) params.set("q", filter.q.trim())
      const [list, statRes] = await Promise.all([
        apiFetch<{ items: Problem[] }>(`/api/sql-practice/problems?${params.toString()}`),
        apiFetch<Stats>(`/api/sql-practice/stats?days=30`),
      ])
      setProblems(list.items)
      setStats(statRes)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [filter.difficulty, filter.source, filter.q])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch + refilter on mount/filter change
    void load()
  }, [load])

  const recentTags = useMemo(() => {
    const set = new Set<string>()
    for (const p of problems) for (const t of p.tags) set.add(t)
    return Array.from(set).slice(0, 12)
  }, [problems])

  const recentMethods = useMemo(() => {
    const set = new Set<string>()
    for (const p of problems) for (const m of p.methods) set.add(m)
    return Array.from(set).slice(0, 12)
  }, [problems])

  const tagSuggestions = uniqMerge(recentTags, [...SQL_PRACTICE_TAG_PRESETS])
  const methodSuggestions = uniqMerge(recentMethods, [...SQL_PRACTICE_METHOD_PRESETS])

  const resetForm = () => {
    setTitle("")
    setSourceUrl("")
    setTagsInput("")
    setMethodsInput("")
    setDuration("")
    setNotes("")
    setCode("")
    setCodeOpen(false)
    // keep source / difficulty so连续做题更快
  }

  function matchesCurrentFilter(problem: Problem) {
    const q = filter.q.trim().toLowerCase()
    return (
      (filter.difficulty === "all" || problem.difficulty === filter.difficulty) &&
      (filter.source === "all" || problem.source === filter.source) &&
      (!q || problem.title.toLowerCase().includes(q) || problem.notes.toLowerCase().includes(q))
    )
  }

  async function handleSubmit() {
    if (savingRef.current) return
    if (!title.trim()) {
      toast.error("题目名必填")
      titleRef.current?.focus()
      return
    }
    savingRef.current = true
    setSaving(true)
    try {
      const created = await apiPost<Problem>("/api/sql-practice/problems", {
        title: title.trim(),
        source,
        sourceUrl: sourceUrl.trim(),
        difficulty,
        tags: splitInput(tagsInput),
        methods: splitInput(methodsInput),
        durationMinutes: duration.trim() ? Math.max(0, Number(duration) || 0) : 0,
        notes: notes.trim(),
        code: code,
      })
      toast.success("已记录")
      if (matchesCurrentFilter(created)) {
        setProblems((prev) => [created, ...prev.filter((p) => p.id !== created.id)])
      }
      resetForm()
      titleRef.current?.focus()
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败")
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  async function handleEditSave(id: string, patch: Partial<Problem>) {
    await apiPatch(`/api/sql-practice/problems/${id}`, patch)
    setEditing(null)
    await load()
  }

  async function handleDelete(p: Problem) {
    const ok = confirmAction(`删除这条记录? ${p.title}`)
    if (!ok) return
    try {
      await apiDelete(`/api/sql-practice/problems/${p.id}`)
      toast.success("已删除")
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败")
    }
  }

  function pushChip(setter: (v: string) => void, current: string, chip: string) {
    const items = splitInput(current)
    if (items.includes(chip)) return
    setter([...items, chip].join(", "))
  }

  const totalMinutesLabel = stats
    ? stats.totalMinutes >= 60
      ? `${Math.floor(stats.totalMinutes / 60)}h ${stats.totalMinutes % 60}m`
      : `${stats.totalMinutes}m`
    : "—"

  return (
    <ModulePageShell maxWidth="wide">
      <ModuleHero
        icon={Database}
        eyebrow="SQL Practice"
        title="SQL 练题"
        description="每天做完一道题就来记一笔，半分钟搞定。看到自己刷过哪些类型，用过哪些方法。"
        actions={
          isOwner ? (
            <Link
              href="/admin/sql-practice"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 hover:no-underline"
            >
              成员授权
            </Link>
          ) : null
        }
        stats={[
          { label: "今日", value: stats?.today ?? "—" },
          { label: "近 7 天", value: stats?.last7Days ?? "—" },
          { label: "近 30 天", value: stats?.last30Days ?? "—" },
          { label: "总计", value: stats?.total ?? "—", hint: totalMinutesLabel },
        ]}
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {/* Quick entry */}
          <ModulePanel
            icon={Plus}
            title="快速录入"
            description="题目名 + 难度 + 类型/方法，就够了。"
          >
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                void handleSubmit()
              }}
            >
              <div className="grid gap-3 sm:grid-cols-[1fr_140px_160px]">
                <div>
                  <Label className="text-xs text-slate-500">题目</Label>
                  <Input
                    ref={titleRef}
                    value={title}
                    placeholder="如：连续登录天数"
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault()
                        void handleSubmit()
                      }
                    }}
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">难度</Label>
                  <Select value={difficulty} onValueChange={(v) => setDifficulty(v as SqlPracticeDifficulty)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SQL_PRACTICE_DIFFICULTIES.map((d) => (
                        <SelectItem key={d} value={d}>{SQL_PRACTICE_DIFFICULTY_LABELS[d]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">来源</Label>
                  <Select value={source} onValueChange={setSource}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SQL_PRACTICE_SOURCES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs text-slate-500">题型标签（空格/逗号分隔）</Label>
                  <Input
                    value={tagsInput}
                    placeholder="窗口函数, JOIN"
                    onChange={(e) => setTagsInput(e.target.value)}
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {tagSuggestions.slice(0, 8).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => pushChip(setTagsInput, tagsInput, t)}
                        className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                      >
                        + {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">所用方法</Label>
                  <Input
                    value={methodsInput}
                    placeholder="ROW_NUMBER, LEFT JOIN"
                    onChange={(e) => setMethodsInput(e.target.value)}
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {methodSuggestions.slice(0, 8).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => pushChip(setMethodsInput, methodsInput, m)}
                        className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                      >
                        + {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[140px_1fr_auto]">
                <div>
                  <Label className="text-xs text-slate-500">用时(分)</Label>
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={duration}
                    placeholder="15"
                    onChange={(e) => setDuration(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">链接（可选）</Label>
                  <Input
                    value={sourceUrl}
                    placeholder="https://"
                    onChange={(e) => setSourceUrl(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" loading={saving} disabled={saving} className="min-w-[96px]">
                    {saving ? "保存中…" : "记一笔"}
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs text-slate-500">备注（可选）</Label>
                <Textarea
                  rows={2}
                  value={notes}
                  placeholder="一行思路、卡点、套路…"
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="rounded-[12px] border border-slate-200 bg-slate-50/60">
                <button
                  type="button"
                  onClick={() => setCodeOpen((v) => !v)}
                  className="flex w-full items-center justify-between gap-2 rounded-[12px] px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Code2 size={13} />
                    实际代码（可选）
                    {code.trim() && <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700">已填</span>}
                  </span>
                  {codeOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {codeOpen && (
                  <div className="border-t border-slate-200 p-2">
                    <Textarea
                      rows={6}
                      value={code}
                      placeholder={"-- 把你这次写的 SQL 粘在这里"}
                      onChange={(e) => setCode(e.target.value)}
                      className="font-mono text-[12px] leading-5"
                    />
                  </div>
                )}
              </div>
            </form>
          </ModulePanel>

          {/* Filters + List */}
          <ModuleToolbar>
            <div className="flex flex-wrap items-center gap-2">
              <Filter size={14} className="text-slate-400" />
              <Select value={filter.difficulty} onValueChange={(v) => setFilter((f) => ({ ...f, difficulty: v }))}>
                <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部难度</SelectItem>
                  {SQL_PRACTICE_DIFFICULTIES.map((d) => (
                    <SelectItem key={d} value={d}>{SQL_PRACTICE_DIFFICULTY_LABELS[d]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filter.source} onValueChange={(v) => setFilter((f) => ({ ...f, source: v }))}>
                <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部来源</SelectItem>
                  {SQL_PRACTICE_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={filter.q}
                placeholder="搜索题目 / 备注"
                onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
                className="h-9 w-[200px]"
              />
            </div>
            <div className="text-xs text-slate-400">
              {loading ? "加载中…" : `${problems.length} 条记录`}
            </div>
          </ModuleToolbar>

          <div className="space-y-2">
            {!loading && problems.length === 0 && (
              <EmptyState title="还没有记录" description="在上方录入第一题，然后慢慢积累" />
            )}
            {problems.map((p) => (
              <ProblemRow
                key={p.id}
                problem={p}
                onDelete={() => handleDelete(p)}
                onEdit={() => setEditing(p)}
              />
            ))}
          </div>
        </div>

        {/* Right side: stats */}
        <div className="space-y-5">
          <ModulePanel icon={CalendarClock} title="近 30 天" contentClassName="px-3 py-3">
            {stats ? (
              <SimpleLineChart
                data={stats.daily.map((d) => ({ name: d.date.slice(5), value: d.count }))}
                height={180}
              />
            ) : (
              <div className="h-[180px]" />
            )}
          </ModulePanel>

          <DistroPanel title="按难度" data={stats?.byDifficulty} colorFor={(k) => DIFFICULTY_COLOR_FOR_CHART[k] ?? "#6b7280"} />
          <DistroPanel title="按题型" data={stats?.byTag} icon={Tag} max={8} />
          <DistroPanel title="按方法" data={stats?.byMethod} icon={Hash} max={8} />
          <DistroPanel title="按来源" data={stats?.bySource} max={8} />
        </div>
      </div>

      <EditProblemDialog
        problem={editing}
        onClose={() => setEditing(null)}
        onSave={handleEditSave}
        tagSuggestions={tagSuggestions}
        methodSuggestions={methodSuggestions}
      />
    </ModulePageShell>
  )
}

function ProblemRow({
  problem,
  onDelete,
  onEdit,
}: {
  problem: Problem
  onDelete: () => void
  onEdit: () => void
}) {
  const [codeOpen, setCodeOpen] = useState(false)
  const diffClass = SQL_PRACTICE_DIFFICULTY_COLORS[problem.difficulty as SqlPracticeDifficulty]
    ?? "bg-slate-50 text-slate-600 border-slate-200"
  const hasCode = Boolean(problem.code && problem.code.trim())

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(problem.code)
      toast.success("代码已复制")
    } catch {
      toast.error("复制失败")
    }
  }

  return (
    <div className="group rounded-[16px] border border-slate-200/80 bg-white px-4 py-3 shadow-[0_8px_22px_rgba(15,23,42,0.04)] transition hover:border-blue-200 hover:shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-medium", diffClass)}>
              {SQL_PRACTICE_DIFFICULTY_LABELS[problem.difficulty as SqlPracticeDifficulty] ?? problem.difficulty}
            </span>
            <span className="text-sm font-semibold text-slate-900">
              {problem.sourceUrl ? (
                <a href={problem.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-blue-600 hover:no-underline">
                  {problem.title}
                  <ExternalLink size={12} className="text-slate-400" />
                </a>
              ) : (
                problem.title
              )}
            </span>
            <span className="text-xs text-slate-400">{problem.source}</span>
            {hasCode && (
              <button
                type="button"
                onClick={() => setCodeOpen((v) => !v)}
                className="inline-flex h-5 items-center gap-1 rounded-full bg-violet-50 px-2 text-[11px] text-violet-700 hover:bg-violet-100"
                title={codeOpen ? "收起代码" : "查看代码"}
              >
                <Code2 size={11} />
                代码
                {codeOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              </button>
            )}
          </div>
          {(problem.tags.length > 0 || problem.methods.length > 0) && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {problem.tags.map((t) => (
                <span key={`t-${t}`} className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">#{t}</span>
              ))}
              {problem.methods.map((m) => (
                <span key={`m-${m}`} className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700">{m}</span>
              ))}
            </div>
          )}
          {problem.notes && (
            <p className="mt-1.5 text-xs leading-5 text-slate-500 whitespace-pre-wrap">{problem.notes}</p>
          )}
          {hasCode && codeOpen && (
            <div className="mt-2 overflow-hidden rounded-[10px] border border-slate-200 bg-slate-950">
              <div className="flex items-center justify-between border-b border-slate-800 px-2 py-1">
                <span className="text-[11px] text-slate-400">SQL</span>
                <button
                  type="button"
                  onClick={copyCode}
                  className="inline-flex h-5 items-center gap-1 rounded px-1.5 text-[11px] text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <Copy size={10} /> 复制
                </button>
              </div>
              <pre className="max-h-[280px] overflow-auto px-3 py-2 font-mono text-[12px] leading-5 text-slate-100">
                {problem.code}
              </pre>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 text-xs text-slate-400">
          <span>{formatChinaDate(problem.practicedAt)}</span>
          {problem.durationMinutes > 0 && (
            <span className="inline-flex items-center gap-1"><Timer size={11} />{problem.durationMinutes}m</span>
          )}
          <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-blue-50 hover:text-blue-600"
              title="编辑"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              title="删除"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

type EditPatch = {
  title?: string
  source?: string
  sourceUrl?: string
  difficulty?: SqlPracticeDifficulty
  tags?: string[]
  methods?: string[]
  durationMinutes?: number
  notes?: string
  code?: string
}

function EditProblemDialog({
  problem,
  onClose,
  onSave,
  tagSuggestions,
  methodSuggestions,
}: {
  problem: Problem | null
  onClose: () => void
  onSave: (id: string, patch: EditPatch) => Promise<void>
  tagSuggestions: string[]
  methodSuggestions: string[]
}) {
  if (!problem) return null

  return (
    <EditProblemDialogContent
      key={problem.id}
      problem={problem}
      onClose={onClose}
      onSave={onSave}
      tagSuggestions={tagSuggestions}
      methodSuggestions={methodSuggestions}
    />
  )
}

function EditProblemDialogContent({
  problem,
  onClose,
  onSave,
  tagSuggestions,
  methodSuggestions,
}: {
  problem: Problem
  onClose: () => void
  onSave: (id: string, patch: EditPatch) => Promise<void>
  tagSuggestions: string[]
  methodSuggestions: string[]
}) {
  const [title, setTitle] = useState(problem.title)
  const [source, setSource] = useState<string>(problem.source)
  const [sourceUrl, setSourceUrl] = useState(problem.sourceUrl)
  const [difficulty, setDifficulty] = useState<SqlPracticeDifficulty>((problem.difficulty as SqlPracticeDifficulty) ?? "Medium")
  const [tagsInput, setTagsInput] = useState(problem.tags.join(", "))
  const [methodsInput, setMethodsInput] = useState(problem.methods.join(", "))
  const [duration, setDuration] = useState(problem.durationMinutes ? String(problem.durationMinutes) : "")
  const [notes, setNotes] = useState(problem.notes)
  const [code, setCode] = useState(problem.code ?? "")
  const [saving, setSaving] = useState(false)

  function pushChip(setter: (v: string) => void, current: string, chip: string) {
    const items = current.split(/[,，;；\s]+/).map((s) => s.trim()).filter(Boolean)
    if (items.includes(chip)) return
    setter([...items, chip].join(", "))
  }

  async function handleSave() {
    if (!problem) return
    if (!title.trim()) {
      toast.error("题目名必填")
      return
    }
    setSaving(true)
    try {
      await onSave(problem.id, {
        title: title.trim(),
        source,
        sourceUrl: sourceUrl.trim(),
        difficulty,
        tags: splitInput(tagsInput),
        methods: splitInput(methodsInput),
        durationMinutes: duration.trim() ? Math.max(0, Number(duration) || 0) : 0,
        notes: notes.trim(),
        code,
      })
      toast.success("已更新")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-[720px]">
        <DialogHeader>
          <DialogTitle>编辑记录</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_140px_160px]">
            <div>
              <Label className="text-xs text-slate-500">题目</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-slate-500">难度</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as SqlPracticeDifficulty)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SQL_PRACTICE_DIFFICULTIES.map((d) => (
                    <SelectItem key={d} value={d}>{SQL_PRACTICE_DIFFICULTY_LABELS[d]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-500">来源</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SQL_PRACTICE_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-slate-500">题型标签</Label>
              <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {tagSuggestions.slice(0, 8).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => pushChip(setTagsInput, tagsInput, t)}
                    className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                  >
                    + {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-500">所用方法</Label>
              <Input value={methodsInput} onChange={(e) => setMethodsInput(e.target.value)} />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {methodSuggestions.slice(0, 8).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => pushChip(setMethodsInput, methodsInput, m)}
                    className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                  >
                    + {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <div>
              <Label className="text-xs text-slate-500">用时(分)</Label>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-slate-500">链接</Label>
              <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs text-slate-500">备注</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div>
            <Label className="text-xs text-slate-500 inline-flex items-center gap-1">
              <Code2 size={12} /> 实际代码
            </Label>
            <Textarea
              rows={8}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="-- SQL"
              className="font-mono text-[12px] leading-5"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "保存中…" : "保存"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DistroPanel({
  title,
  data,
  max = 6,
  icon,
  colorFor,
}: {
  title: string
  data?: Array<{ key: string; count: number }>
  max?: number
  icon?: typeof Tag
  colorFor?: (key: string) => string
}) {
  const top = (data ?? []).slice(0, max).map((d) => ({
    name: d.key,
    value: d.count,
    color: colorFor?.(d.key),
  }))
  return (
    <ModulePanel icon={icon} title={title} contentClassName="px-3 py-3">
      {top.length === 0 ? (
        <p className="px-2 py-4 text-center text-xs text-slate-400">暂无数据</p>
      ) : (
        <SimpleBarChart data={top} height={Math.min(40 + top.length * 26, 240)} />
      )}
    </ModulePanel>
  )
}
