"use client"

import { useMemo, useState } from "react"
import { ExternalLink, Search, Upload, X } from "lucide-react"
import { toast } from "sonner"

import { SimpleBarChart } from "@/components/charts/bar-chart"
import { EmptyState } from "@/components/empty-state"
import { ModulePanel, ModuleTableShell, modulePillClass } from "@/components/module/module-shell"
import { StatsCard } from "@/components/stats-card"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  const [filterStatus, setFilterStatus] = useState("all")
  const [previewOpen, setPreviewOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)

  const filteredJobs = useMemo(() => {
    const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return jobs.filter((job) => {
      if (filterStatus !== "all" && job.status !== filterStatus) return false
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
      toast.error("No filtered records can be imported.")
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
      toast.error("Select at least one record.")
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
      if (!res.ok) throw new Error(data.error || "Import failed.")
      toast.success(`Imported ${data.imported ?? jobIds.length} job records.`)
      setPreviewOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed.")
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Applications" value={stats.total} unit="items" />
        <StatsCard title="Reply rate" value={`${stats.replyRate}%`} sub={stats.replyRate > 50 ? "Good momentum" : "Still growing"} trend={stats.replyRate > 50 ? "up" : "neutral"} />
        <StatsCard title="Interview rate" value={`${stats.interviewRate}%`} sub="Reached interview stage" />
        <StatsCard title="Offer rate" value={`${stats.offerRate}%`} trend={stats.offerRate > 0 ? "up" : "neutral"} />
      </div>

      {stats.total > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <ModulePanel title="Status distribution" contentClassName="p-5">
            <SimpleBarChart data={stats.statusDist} height={Math.max(140, stats.statusDist.length * 34)} />
          </ModulePanel>
          <ModulePanel title="Channel distribution" contentClassName="p-5">
            <SimpleBarChart data={stats.channelDist} height={Math.max(140, stats.channelDist.length * 34)} />
          </ModulePanel>
        </div>
      ) : null}

      <ModulePanel
        title="Job records"
        description="Search, filter, and inspect visible job applications."
        action={canImport ? (
          <Button onClick={openImportPreview} className="h-10 rounded-full bg-blue-600 px-4 text-white hover:bg-blue-700">
            <Upload size={15} /> Import filtered
          </Button>
        ) : null}
        contentClassName="p-0"
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search company, role, channel, status..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 rounded-full border-slate-200 bg-slate-50 pl-9 pr-9"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-11 w-[160px] rounded-full border-slate-200 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {JOB_STATUS.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {filteredJobs.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No matching records" description="Adjust search or status filters to see more job applications." />
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <ModuleTableShell>
                <table className="w-full min-w-[1080px] text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50">
                    <tr className="border-b border-slate-200">
                      {["Company", "Position", "Channel", "Applied", "Status", "Base", "Contact", "Interviews", "Link", "Notes"].map((head) => (
                        <th key={head} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredJobs.map((job) => (
                      <tr key={job.id} className="bg-white transition hover:bg-blue-50/40">
                        <td className="px-4 py-3 font-semibold text-slate-900">{job.company}</td>
                        <td className="px-4 py-3 text-slate-600">{job.position}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{job.channel}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{formatChinaDate(job.appliedAt, { month: "2-digit", day: "2-digit" })}</td>
                        <td className="px-4 py-3"><StatusBadge status={job.status} type="job" /></td>
                        <td className="px-4 py-3 text-xs text-slate-500">{job.baseLocation || "-"}</td>
                        <td className="max-w-[130px] truncate px-4 py-3 text-xs text-slate-500">{job.hrContact || "-"}</td>
                        <td className="px-4 py-3 text-center font-mono text-xs text-slate-500">{job.interviewCount}</td>
                        <td className="px-4 py-3">
                          {job.link ? (
                            <a href={job.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                              Open <ExternalLink size={11} />
                            </a>
                          ) : <span className="text-xs text-slate-400">-</span>}
                        </td>
                        <td className="max-w-[240px] px-4 py-3 text-xs text-slate-500">{job.notes || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ModuleTableShell>
            </div>

            <div className="grid gap-3 p-4 md:hidden">
              {filteredJobs.map((job) => (
                <article key={job.id} className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-slate-950">{job.company}</h3>
                      <p className="mt-1 text-sm text-slate-500">{job.position}</p>
                    </div>
                    <StatusBadge status={job.status} type="job" />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <span>{job.channel}</span>
                    <span>{formatChinaDate(job.appliedAt, { month: "2-digit", day: "2-digit" })}</span>
                    <span>{job.baseLocation || "No base"}</span>
                    <span>{job.interviewCount} interviews</span>
                  </div>
                  {job.link ? (
                    <a href={job.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600">
                      Open link <ExternalLink size={13} />
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          </>
        )}
      </ModulePanel>

      {filteredJobs.length > 0 ? <p className="font-mono text-xs text-slate-500">{filteredJobs.length} records</p> : null}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl rounded-[24px] border-slate-200">
          <DialogHeader>
            <DialogTitle>Import job records</DialogTitle>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto rounded-[18px] border border-slate-200">
            {filteredJobs.map((job) => (
              <label key={job.id} className="flex cursor-pointer items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-blue-50/50">
                <input type="checkbox" checked={selectedIds.has(job.id)} onChange={() => toggleJob(job.id)} className="mt-1" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900">{job.company} / {job.position}</span>
                  <span className="block text-xs text-slate-500">{job.channel} / {formatChinaDate(job.appliedAt)} / {job.baseLocation || "-"}</span>
                </span>
                <StatusBadge status={job.status} type="job" />
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)} className={modulePillClass(false)}>Cancel</Button>
            <Button type="button" onClick={importSelected} disabled={selectedIds.size === 0} loading={importing} loadingText="Importing..." className="rounded-full bg-blue-600 text-white hover:bg-blue-700">
              Import {selectedIds.size}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
