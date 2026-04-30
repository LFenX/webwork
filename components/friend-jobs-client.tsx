"use client"

import { useMemo, useState } from "react"
import { ExternalLink, Search, Upload, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SimpleBarChart } from "@/components/charts/bar-chart"
import { StatsCard } from "@/components/stats-card"
import { StatusBadge } from "@/components/status-badge"
import { JOB_STATUS } from "@/lib/enums"
import { formatChinaDate } from "@/lib/time"

type Job = {
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
  interviewCount: number
}

type Stats = {
  total: number
  replyRate: number
  interviewRate: number
  offerRate: number
  statusDist: { name: string; value: number; color?: string }[]
  channelDist: { name: string; value: number }[]
}

export function FriendJobsClient({
  ownerId,
  jobs,
  stats,
  canImport,
}: {
  ownerId: string
  jobs: Job[]
  stats: Stats
  canImport: boolean
}) {
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("全部")
  const [previewOpen, setPreviewOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)

  const filteredJobs = useMemo(() => {
    const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return jobs.filter((job) => {
      if (filterStatus !== "全部" && job.status !== filterStatus) return false
      if (terms.length === 0) return true
      const haystack = [
        job.company,
        job.position,
        job.channel,
        job.status,
        job.baseLocation,
        job.hrContact,
        job.link,
        job.notes,
        job.appliedAt,
        String(job.interviewCount),
      ].filter(Boolean).join(" ").toLowerCase()
      return terms.every((term) => haystack.includes(term))
    })
  }, [filterStatus, jobs, search])

  function openImportPreview() {
    if (filteredJobs.length === 0) {
      toast.error("当前筛选结果没有可导入记录")
      return
    }
    setSelectedIds(new Set(filteredJobs.map((job) => job.id)))
    setPreviewOpen(true)
  }

  function toggleJob(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function importSelected() {
    const jobIds = Array.from(selectedIds)
    if (jobIds.length === 0) {
      toast.error("请至少选择一条记录")
      return
    }
    setImporting(true)
    try {
      const res = await fetch("/api/jobs/import-from-friend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId, jobIds }),
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({})) as { imported?: number; error?: string }
      if (!res.ok) throw new Error(data.error || "导入失败")
      toast.success(`已导入 ${data.imported ?? jobIds.length} 条求职记录`)
      setPreviewOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导入失败")
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <section className="mb-8">
        <div className="mb-6 grid grid-cols-4 gap-1.5 sm:gap-3">
          <StatsCard title="累计投递" value={stats.total} sub="家公司" />
          <StatsCard title="回复率" value={`${stats.replyRate}%`} sub={stats.replyRate > 50 ? "不错" : "继续加油"} trend={stats.replyRate > 50 ? "up" : "neutral"} />
          <StatsCard title="面试转化率" value={`${stats.interviewRate}%`} sub="进入面试" />
          <StatsCard title="Offer 率" value={`${stats.offerRate}%`} trend={stats.offerRate > 0 ? "up" : "neutral"} />
        </div>

        {stats.total > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[--radius-lg] bg-[--color-bg-surface]/70 p-4 shadow-[--shadow-sm] ring-1 ring-[rgba(15,23,42,0.05)] backdrop-blur-sm">
              <p className="mb-3 text-xs text-[--color-text-muted]">按状态分布</p>
              <SimpleBarChart data={stats.statusDist} height={Math.max(120, stats.statusDist.length * 32)} />
            </div>
            <div className="rounded-[--radius-lg] bg-[--color-bg-surface]/70 p-4 shadow-[--shadow-sm] ring-1 ring-[rgba(15,23,42,0.05)] backdrop-blur-sm">
              <p className="mb-3 text-xs text-[--color-text-muted]">按渠道分布</p>
              <SimpleBarChart data={stats.channelDist} height={Math.max(120, stats.channelDist.length * 32)} />
            </div>
          </div>
        )}
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[--color-text-muted]" />
          <Input
            placeholder="搜索任意字段，可用空格组合条件..."
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
            <SelectItem value="全部">全部状态</SelectItem>
            {JOB_STATUS.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
          </SelectContent>
        </Select>

        {canImport && (
          <Button size="sm" onClick={openImportPreview} className="h-8 gap-1.5">
            <Upload size={14} /> 导入筛选结果
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]">
        {filteredJobs.length === 0 ? (
          <div className="py-16 text-center text-sm text-[--color-text-muted]">暂无符合条件的求职记录。</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b-2 border-[--color-border-strong] bg-[--color-bg-hover]">
                  <th className="w-[130px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">公司</th>
                  <th className="w-[180px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">职位</th>
                  <th className="w-[100px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">渠道</th>
                  <th className="w-[90px] px-4 py-2.5 text-left font-mono text-xs font-medium text-[--color-text-muted]">投递日期</th>
                  <th className="w-[120px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">状态</th>
                  <th className="w-[80px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">BASE</th>
                  <th className="w-[110px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">联系人</th>
                  <th className="w-[70px] px-4 py-2.5 text-left font-mono text-xs font-medium text-[--color-text-muted]">面试</th>
                  <th className="w-[70px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">链接</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">备注</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="border-b border-[--color-border] last:border-b-0">
                    <td className="px-4 py-3 font-medium">{job.company}</td>
                    <td className="px-4 py-3 text-[--color-text-secondary]">{job.position}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[--color-text-muted]">{job.channel}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[--color-text-muted]">{formatChinaDate(job.appliedAt, { month: "2-digit", day: "2-digit" })}</td>
                    <td className="px-4 py-3"><StatusBadge status={job.status} type="job" /></td>
                    <td className="px-4 py-3 text-xs text-[--color-text-muted]">{job.baseLocation || "-"}</td>
                    <td className="max-w-[110px] truncate px-4 py-3 text-xs text-[--color-text-muted]">{job.hrContact || "-"}</td>
                    <td className="px-4 py-3 text-center font-mono text-xs text-[--color-text-muted]">{job.interviewCount}</td>
                    <td className="px-4 py-3">
                      {job.link ? (
                        <a href={job.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-xs text-[--color-link] hover:underline">
                          投递 <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="text-xs text-[--color-text-muted]">-</span>
                      )}
                    </td>
                    <td className="max-w-[220px] px-4 py-3 text-xs text-[--color-text-muted]">{job.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filteredJobs.length > 0 && <p className="mt-2 font-mono text-xs text-[--color-text-muted]">{filteredJobs.length} 条记录</p>}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>导入求职记录</DialogTitle>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto rounded-[--radius-sm] border border-[--color-border]">
            {filteredJobs.map((job) => (
              <label key={job.id} className="flex cursor-pointer items-start gap-3 border-b border-[--color-border] px-3 py-2 last:border-b-0 hover:bg-[--color-bg-hover]">
                <input
                  type="checkbox"
                  checked={selectedIds.has(job.id)}
                  onChange={() => toggleJob(job.id)}
                  className="mt-1"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{job.company} · {job.position}</span>
                  <span className="block text-xs text-[--color-text-muted]">{job.channel} / {formatChinaDate(job.appliedAt)} / {job.baseLocation || "-"}</span>
                </span>
                <StatusBadge status={job.status} type="job" />
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)}>取消</Button>
            <Button type="button" onClick={importSelected} disabled={selectedIds.size === 0} loading={importing} loadingText="导入中...">
              {`导入 ${selectedIds.size} 条`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
