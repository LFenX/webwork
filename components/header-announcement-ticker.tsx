"use client"

import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react"
import { History, Megaphone, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type AnnouncementItem = {
  type?: "announcement" | "broadcast"
  id: string
  content: string
  createdAt: string
  author: { id: string; email: string; displayName: string }
}

function formatTime(value: string) {
  const date = new Date(value)
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export function HeaderAnnouncementTicker({
  enabled,
  compact = false,
  className,
}: {
  enabled: boolean
  compact?: boolean
  className?: string
}) {
  const [items, setItems] = useState<AnnouncementItem[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<AnnouncementItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const latest = items[0]
  const latestType = latest?.type ?? "announcement"
  const announcementText = latest?.content?.trim() || "暂无公告"
  const hasAnnouncement = Boolean(latest)
  const shouldScroll = hasAnnouncement && announcementText.length > (compact ? 8 : 18)
  const marqueeDuration = useMemo(() => {
    if (!shouldScroll) return undefined
    return `${Math.min(46, Math.max(18, announcementText.length * 0.38))}s`
  }, [announcementText.length, shouldScroll])
  const marqueeStyle = marqueeDuration ? ({ "--announcement-marquee-duration": marqueeDuration } as CSSProperties) : undefined

  const refresh = useCallback(async () => {
    if (!enabled) return
    const response = await fetch("/api/announcement-feed", { cache: "no-store" }).catch(() => null)
    if (!response?.ok) return
    const data = await response.json().catch(() => ({}))
    setItems(Array.isArray(data.items) ? data.items : [])
  }, [enabled])

  const loadHistory = useCallback(async () => {
    if (!enabled) return
    setHistoryLoading(true)
    try {
      const [announcementRes, broadcastRes] = await Promise.all([
        fetch("/api/announcements?history=1&limit=50", { cache: "no-store" }),
        fetch("/api/world-broadcasts?limit=50", { cache: "no-store" }),
      ])
      const announcementData = announcementRes.ok ? await announcementRes.json().catch(() => ({})) : {}
      const broadcastData = broadcastRes.ok ? await broadcastRes.json().catch(() => ({})) : {}
      const announcementItems = Array.isArray(announcementData.items) ? announcementData.items as AnnouncementItem[] : []
      const broadcastItems = Array.isArray(broadcastData.items)
        ? (broadcastData.items as AnnouncementItem[]).map((item) => ({ ...item, type: "broadcast" as const }))
        : []
      setHistory([...announcementItems, ...broadcastItems].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)))
    } finally {
      setHistoryLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(timer)
  }, [refresh])

  useEffect(() => {
    if (!enabled) return
    const onRealtime = (event: Event) => {
      const payload = (event as CustomEvent).detail
      if (payload?.type === "announcement-feed:changed") void refresh()
    }
    window.addEventListener("app:realtime", onRealtime)
    return () => window.removeEventListener("app:realtime", onRealtime)
  }, [enabled, refresh])

  useEffect(() => {
    if (!latest?.id) return
    const timer = window.setTimeout(() => {
      fetch(`/api/announcement-feed/${latestType}/${latest.id}`, { method: "POST", cache: "no-store" })
        .then(() => {
          if (latestType === "broadcast") {
            setItems((current) => current.filter((item) => item.id !== latest.id || (item.type ?? "announcement") !== latestType))
          } else {
            void refresh()
          }
        })
        .catch(() => null)
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [latest?.id, latestType, refresh])

  async function hideLatest() {
    if (!latest) return
    setItems((current) => current.filter((item) => item.id !== latest.id))
    await fetch(`/api/announcement-feed/${latest.type ?? "announcement"}/${latest.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hidden: true }),
      cache: "no-store",
    }).catch(() => null)
  }

  if (!enabled) return null

  return (
    <>
      <div
        className={cn(
          "header-announcement-shell min-w-0",
          compact ? "max-w-[42vw]" : "w-full",
          className
        )}
      >
        <div
          className={cn(
            "header-announcement-ticker group flex min-w-0 items-center gap-1 rounded-full border transition",
            hasAnnouncement ? "has-announcement" : "is-empty",
            shouldScroll && "is-scrolling",
            compact ? "is-compact h-9 w-full px-2.5 text-xs" : "h-9 w-full px-3 text-sm"
          )}
        >
          <button
            type="button"
            onClick={() => {
              setHistoryOpen(true)
              void loadHistory()
            }}
            className="header-announcement-button flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
            aria-label={hasAnnouncement ? `查看公告：${announcementText}` : "查看公告历史"}
          >
            <span className="header-announcement-icon flex size-6 shrink-0 items-center justify-center rounded-full text-blue-600">
              <Megaphone size={compact ? 13 : 14} />
            </span>
            <span className="header-announcement-viewport min-w-0 flex-1">
              {hasAnnouncement ? (
                shouldScroll ? (
                  <span className="header-announcement-track" style={marqueeStyle}>
                    <span className="header-announcement-marquee">{announcementText}</span>
                    <span className="header-announcement-marquee" aria-hidden="true">{announcementText}</span>
                  </span>
                ) : (
                  <span className="header-announcement-static">{announcementText}</span>
                )
              ) : (
                <span className="header-announcement-empty">暂无公告</span>
              )}
            </span>
          </button>
          {latest ? (
            <button
              type="button"
              onClick={() => void hideLatest()}
              className="hidden size-6 shrink-0 items-center justify-center rounded-full text-slate-400 outline-none hover:bg-white hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-blue-200 sm:flex"
              aria-label="隐藏公告"
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent overlay className="sm:max-w-2xl sm:rounded-[18px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History size={18} />
              公告历史
            </DialogTitle>
            <DialogDescription>系统公告和世界频道广播会显示在这里。</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            {history.length === 0 ? (
              <p className="rounded-[14px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                {historyLoading ? "正在加载公告..." : "暂无公告记录"}
              </p>
            ) : (
              <div className="space-y-2">
                {history.map((item) => (
                  <div key={`${item.type ?? "announcement"}-${item.id}`} className="rounded-[14px] border border-slate-100 bg-white p-3 shadow-sm">
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{item.content}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {item.type === "broadcast" ? "世界频道" : "系统公告"} / {item.author.displayName || item.author.email} / {formatTime(item.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void loadHistory()} disabled={historyLoading}>
              {historyLoading ? "刷新中..." : "刷新"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
