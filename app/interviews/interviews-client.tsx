"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Plus, Trash2, Star, ChevronDown } from "lucide-react"
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
  round: "技术一面" as string,
  format: "视频" as string,
  scheduledAt: new Date().toISOString().slice(0, 16),
  interviewers: "",
  questions: "",
  selfRating: "" as string | number,
  result: "待定" as string,
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

export function InterviewsClient() {
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editingInterview, setEditingInterview] = useState<Interview | null>(null)
  const [detailItem, setDetailItem] = useState<Interview | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [iRes, sRes] = await Promise.all([
      fetch("/api/interviews"),
      fetch("/api/interviews/stats"),
    ])
    setInterviews(await iRes.json())
    setStats(await sRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function openCreate() {
    setEditingInterview(null)
    setForm(defaultForm)
    setDialogOpen(true)
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
      toast.error("公司名称和职位不能为空")
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
        await fetch(`/api/interviews/${editingInterview.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        toast.success("已更新")
      } else {
        await fetch("/api/interviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        toast.success("已添加")
      }
      setDialogOpen(false)
      fetchData()
    } catch {
      toast.error("操作失败")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确认删除这条面试记录？")) return
    await fetch(`/api/interviews/${id}`, { method: "DELETE" })
    toast.success("已删除")
    fetchData()
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-xl font-semibold mb-1">面试记录</h1>
        <p className="text-sm text-[--color-text-muted]">记录每一轮面试，复盘提升</p>
      </div>

      {/* Stats */}
      {stats && (
        <section className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatsCard title="面试总计" value={stats.total} sub="轮" />
            <StatsCard
              title="通过率"
              value={`${stats.passRate}%`}
              trend={stats.passRate > 60 ? "up" : "neutral"}
            />
            <StatsCard title="已通过" value={stats.passed} sub="轮" trend="up" />
            <StatsCard title="未通过" value={stats.failed} sub="轮" trend={stats.failed > 0 ? "down" : "neutral"} />
          </div>

          {stats.total > 0 && (
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-[--color-bg-surface] border border-[--color-border] rounded-[--radius-lg] p-4">
                <p className="text-xs text-[--color-text-muted] mb-3">按形式分布</p>
                <SimplePieChart data={stats.formatDist} height={180} />
              </div>
              <div className="bg-[--color-bg-surface] border border-[--color-border] rounded-[--radius-lg] p-4">
                <p className="text-xs text-[--color-text-muted] mb-3">按轮次分布</p>
                <SimpleBarChart data={stats.roundDist} height={180} />
              </div>
              {stats.companyDist.length > 0 && (
                <div className="bg-[--color-bg-surface] border border-[--color-border] rounded-[--radius-lg] p-4">
                  <p className="text-xs text-[--color-text-muted] mb-3">按公司面试次数</p>
                  <SimpleBarChart data={stats.companyDist} height={180} />
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-[--color-text-muted] font-mono">{interviews.length} 条记录</p>
        <Button size="sm" onClick={openCreate} className="h-8 gap-1.5">
          <Plus size={14} /> 新建记录
        </Button>
      </div>

      {/* Table */}
      <div className="bg-[--color-bg-surface] border border-[--color-border] rounded-[--radius-lg] overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-[--color-text-muted]">加载中...</div>
        ) : interviews.length === 0 ? (
          <EmptyState
            title="暂无面试记录"
            description="点击「新建记录」记录第一次面试"
            action={{ label: "新建记录", onClick: openCreate }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[--color-border-strong] bg-[--color-bg-hover]">
                  <th className="text-left px-4 py-2.5 font-medium text-xs text-[--color-text-muted] w-[110px]">公司</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs text-[--color-text-muted]">职位</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs text-[--color-text-muted] w-[80px]">轮次</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs text-[--color-text-muted] w-[60px]">形式</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs text-[--color-text-muted] w-[110px] font-mono">日期</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs text-[--color-text-muted] w-[60px]">自评</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs text-[--color-text-muted] w-[80px]">结果</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs text-[--color-text-muted]">反馈</th>
                  <th className="px-4 py-2.5 w-[80px]"></th>
                </tr>
              </thead>
              <tbody>
                {interviews.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-[--color-border] hover:bg-[--color-bg-hover] transition-colors group"
                  >
                    <td className="px-4 py-3 font-medium">{item.company}</td>
                    <td className="px-4 py-3 text-[--color-text-secondary]">{item.position}</td>
                    <td className="px-4 py-3 text-xs text-[--color-text-muted] font-mono">{item.round}</td>
                    <td className="px-4 py-3 text-xs text-[--color-text-muted]">{item.format}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[--color-text-muted]">
                      {new Date(item.scheduledAt).toLocaleDateString("zh-CN")}
                    </td>
                    <td className="px-4 py-3">
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
                        <span className="text-[--color-text-muted] text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.result} type="interview" />
                    </td>
                    <td className="px-4 py-3 text-xs text-[--color-text-muted] max-w-[160px] truncate">
                      {item.feedback}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openDetail(item)}
                          className="p-1 text-[--color-text-muted] hover:text-[--color-link]"
                          title="查看详情"
                        >
                          <ChevronDown size={14} />
                        </button>
                        <button
                          onClick={() => openEdit(item)}
                          className="p-1 text-[--color-text-muted] hover:text-[--color-text-primary] text-xs"
                          title="编辑"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1 text-[--color-text-muted] hover:text-[--color-danger]"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingInterview ? "编辑面试记录" : "新建面试记录"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">公司 *</Label>
                <Input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder="公司名称" className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">职位 *</Label>
                <Input value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} placeholder="职位名称" className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs mb-1 block">轮次</Label>
                <Select value={form.round} onValueChange={(v) => setForm((f) => ({ ...f, round: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{INTERVIEW_ROUNDS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">形式</Label>
                <Select value={form.format} onValueChange={(v) => setForm((f) => ({ ...f, format: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{INTERVIEW_FORMATS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">结果</Label>
                <Select value={form.result} onValueChange={(v) => setForm((f) => ({ ...f, result: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{INTERVIEW_RESULTS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">日期时间</Label>
                <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))} className="h-8 text-sm font-mono" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">面试官</Label>
                <Input value={form.interviewers} onChange={(e) => setForm((f) => ({ ...f, interviewers: e.target.value }))} placeholder="面试官姓名" className="h-8 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">自评</Label>
              <StarRating value={form.selfRating ? Number(form.selfRating) : null} onChange={(v) => setForm((f) => ({ ...f, selfRating: v }))} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">面试题目（支持 Markdown）</Label>
              <Textarea value={form.questions} onChange={(e) => setForm((f) => ({ ...f, questions: e.target.value }))} placeholder="## 问题&#10;- 问题1&#10;- 问题2" className="text-sm resize-none font-mono" rows={4} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">反馈 / 备注</Label>
              <Textarea value={form.feedback} onChange={(e) => setForm((f) => ({ ...f, feedback: e.target.value }))} placeholder="面试官的反馈，或自己的总结..." className="text-sm resize-none" rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
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
                <div><span className="text-[--color-text-muted]">职位：</span>{detailItem.position}</div>
                <div><span className="text-[--color-text-muted]">形式：</span>{detailItem.format}</div>
                <div><span className="text-[--color-text-muted]">日期：</span><span className="font-mono">{new Date(detailItem.scheduledAt).toLocaleString("zh-CN")}</span></div>
                <div><span className="text-[--color-text-muted]">面试官：</span>{detailItem.interviewers || "—"}</div>
                <div><span className="text-[--color-text-muted]">结果：</span><StatusBadge status={detailItem.result} type="interview" /></div>
                <div className="flex items-center gap-1">
                  <span className="text-[--color-text-muted]">自评：</span>
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
                  <p className="text-xs text-[--color-text-muted] mb-2">面试题目</p>
                  <pre className="text-xs bg-[--color-bg-hover] rounded p-3 whitespace-pre-wrap font-mono border border-[--color-border]">{detailItem.questions}</pre>
                </div>
              )}
              {detailItem.feedback && (
                <div>
                  <p className="text-xs text-[--color-text-muted] mb-1">反馈</p>
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
