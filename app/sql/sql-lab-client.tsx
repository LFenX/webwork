"use client"

import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { format as formatSqlText } from "sql-formatter"
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Database,
  KeyRound,
  Loader2,
  Pause,
  Play,
  Server,
  ShieldCheck,
  Sparkles,
  StopCircle,
  Terminal,
  Wand2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { apiDelete, apiFetch, apiPatch, apiPost } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { SchemaTree } from "@/components/sql-lab/schema-tree"
import { SqlAssistantPanel } from "@/components/sql-lab/sql-assistant-panel"
import { SqlEditor, type SqlEditorHandle, type SqlEditorTheme } from "@/components/sql-lab/sql-editor"
import { ResultsPanel } from "@/components/sql-lab/results-panel"
import { ResizeHandle } from "@/components/sql-lab/resize-handle"
import type {
  SqlExample,
  SqlHistoryItem,
  SqlRunResult,
  SqlSavedQuery,
  SqlSchema,
} from "@/lib/sql-lab/types"

type EditorTab = {
  id: string
  title: string
  sql: string
}

type Layout = {
  sidebarWidth: number
  editorHeight: number
  assistantWidth: number
  theme: SqlEditorTheme
}

type MobilePanel = "editor" | "schema" | "results" | "assistant"

const STORAGE_KEY = "sql-lab.tabs.v1"
const LAYOUT_KEY = "sql-lab.layout.v1"
const DEFAULT_LAYOUT: Layout = {
  sidebarWidth: 268,
  editorHeight: 244,
  assistantWidth: 460,
  theme: "dark",
}

function newTab(title = "query"): EditorTab {
  return { id: `tab_${Math.random().toString(36).slice(2, 9)}`, title, sql: "" }
}

function initialTab(): EditorTab {
  return { id: "tab_query_1", title: "query 1", sql: "" }
}

function readTabs(): EditorTab[] | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as EditorTab[]
    return Array.isArray(parsed) && parsed.length ? parsed : null
  } catch {
    return null
  }
}

function writeTabs(tabs: EditorTab[]) {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs))
}

function readLayout(): Layout {
  if (typeof window === "undefined") return DEFAULT_LAYOUT
  try {
    const raw = window.localStorage.getItem(LAYOUT_KEY)
    if (!raw) return DEFAULT_LAYOUT
    const parsed = JSON.parse(raw) as Partial<Layout>
    return {
      sidebarWidth: typeof parsed.sidebarWidth === "number" ? parsed.sidebarWidth : DEFAULT_LAYOUT.sidebarWidth,
      editorHeight: typeof parsed.editorHeight === "number" ? parsed.editorHeight : DEFAULT_LAYOUT.editorHeight,
      assistantWidth: typeof parsed.assistantWidth === "number" ? parsed.assistantWidth : DEFAULT_LAYOUT.assistantWidth,
      theme: parsed.theme === "light" ? "light" : "dark",
    }
  } catch {
    return DEFAULT_LAYOUT
  }
}

function writeLayout(layout: Layout) {
  if (typeof window !== "undefined") window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function SqlLabClient() {
  const [schema, setSchema] = useState<SqlSchema | null>(null)
  const [history, setHistory] = useState<SqlHistoryItem[]>([])
  const [saved, setSaved] = useState<SqlSavedQuery[]>([])
  const [examples, setExamples] = useState<SqlExample[]>([])
  const [{ tabs, activeTabId }, setTabsState] = useState<{ tabs: EditorTab[]; activeTabId: string }>(() => {
    const tab = initialTab()
    return { tabs: [tab], activeTabId: tab.id }
  })
  const [tabsHydrated, setTabsHydrated] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SqlRunResult | null>(null)
  const [bottomTab, setBottomTab] = useState<"results" | "messages" | "history" | "saved" | "examples">("results")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [limit, setLimit] = useState(1000)
  const [loading, setLoading] = useState(true)
  const [layout, setLayoutState] = useState<Layout>(DEFAULT_LAYOUT)
  const [layoutHydrated, setLayoutHydrated] = useState(false)
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("editor")

  const editorRef = useRef<SqlEditorHandle>(null)
  const mainRowRef = useRef<HTMLDivElement>(null)
  const rightColRef = useRef<HTMLDivElement>(null)

  const setTabs = useCallback((updater: EditorTab[] | ((prev: EditorTab[]) => EditorTab[])) => {
    setTabsState((prev) => ({
      ...prev,
      tabs: typeof updater === "function" ? updater(prev.tabs) : updater,
    }))
  }, [])

  const setActiveTabId = useCallback((id: string) => {
    setTabsState((prev) => ({ ...prev, activeTabId: id }))
  }, [])

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0] ?? null,
    [tabs, activeTabId]
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = readTabs()
      if (stored?.length) setTabsState({ tabs: stored, activeTabId: stored[0].id })
      setTabsHydrated(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!tabsHydrated) return
    writeTabs(tabs)
  }, [tabs, tabsHydrated])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLayoutState(readLayout())
      setLayoutHydrated(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!layoutHydrated) return
    writeLayout(layout)
  }, [layout, layoutHydrated])

  const refreshSchema = useCallback(async () => {
    const [sch, ex] = await Promise.all([
      apiFetch<SqlSchema>("/api/sql/schema"),
      apiFetch<{ items: SqlExample[] }>("/api/sql/examples"),
    ])
    setSchema(sch)
    setExamples(ex.items ?? [])
    return sch
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [sch, hist, sav, ex] = await Promise.all([
          apiFetch<SqlSchema>("/api/sql/schema"),
          apiFetch<{ items: SqlHistoryItem[] }>("/api/sql/history"),
          apiFetch<{ items: SqlSavedQuery[] }>("/api/sql/saved"),
          apiFetch<{ items: SqlExample[] }>("/api/sql/examples"),
        ])
        if (cancelled) return
        setSchema(sch)
        setHistory(hist.items ?? [])
        setSaved(sav.items ?? [])
        setExamples(ex.items ?? [])
        setLimit(sch.defaultLimit)
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Load failed")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const setSidebarWidth = useCallback((next: number) => {
    setLayoutState((prev) => {
      const containerW = mainRowRef.current?.clientWidth ?? 1200
      const max = Math.max(260, Math.floor(containerW * 0.55))
      const sidebarWidth = clamp(Math.round(next), 200, max)
      return sidebarWidth === prev.sidebarWidth ? prev : { ...prev, sidebarWidth }
    })
  }, [])

  const setEditorHeight = useCallback((next: number) => {
    setLayoutState((prev) => {
      const containerH = rightColRef.current?.clientHeight ?? 700
      const max = Math.max(180, containerH - 260)
      const editorHeight = clamp(Math.round(next), 140, max)
      return editorHeight === prev.editorHeight ? prev : { ...prev, editorHeight }
    })
  }, [])

  const setAssistantWidth = useCallback((next: number) => {
    setLayoutState((prev) => {
      const containerW = rightColRef.current?.clientWidth ?? 1100
      const max = Math.max(340, Math.floor(containerW * 0.46))
      const assistantWidth = clamp(Math.round(next), 300, max)
      return assistantWidth === prev.assistantWidth ? prev : { ...prev, assistantWidth }
    })
  }, [])

  const toggleTheme = useCallback(() => {
    setLayoutState((prev) => ({ ...prev, theme: prev.theme === "dark" ? "light" : "dark" }))
  }, [])

  const updateActiveSql = useCallback((sql: string) => {
    setTabs((prev) => prev.map((tab) => (tab.id === activeTabId ? { ...tab, sql } : tab)))
  }, [activeTabId, setTabs])

  const insertAtCursor = useCallback((text: string) => {
    editorRef.current?.insertAtCursor(text)
  }, [])

  const replaceSql = useCallback((sql: string) => {
    setTabs((prev) => prev.map((tab) => (tab.id === activeTabId ? { ...tab, sql } : tab)))
    editorRef.current?.replaceAll(sql)
    setMobilePanel("editor")
  }, [activeTabId, setTabs])

  const createTabWithSql = useCallback((sql: string, title?: string) => {
    const tab = newTab(title || `query ${tabs.length + 1}`)
    tab.sql = sql
    setTabs((prev) => [...prev, tab])
    setActiveTabId(tab.id)
    requestAnimationFrame(() => editorRef.current?.replaceAll(sql))
  }, [setActiveTabId, setTabs, tabs.length])

  const recordRunResult = useCallback((sql: string, res: SqlRunResult) => {
    setResult(res)
    setHistory((prev) => [
      {
        id: res.runId,
        sql,
        startedAt: res.startedAt,
        durationMs: res.durationMs,
        rowCount: res.resultSets.reduce((sum, set) => sum + set.rowCount, 0),
        ok: res.ok,
        truncated: res.resultSets.some((set) => set.truncated),
        errorMessage: res.error?.message,
      },
      ...prev,
    ])
    setBottomTab(res.ok ? "results" : "messages")
  }, [])

  const runSql = useCallback(async (sql: string) => {
    if (!sql.trim() || running) return null
    setRunning(true)
    setBottomTab("results")
    try {
      const res = await apiPost<SqlRunResult>("/api/sql/run", { sql, limit })
      recordRunResult(sql, res)
      setMobilePanel("results")
      return res
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Run failed")
      return null
    } finally {
      setRunning(false)
    }
  }, [limit, recordRunResult, running])

  const formatActiveSql = useCallback(() => {
    const current = editorRef.current?.getValue() ?? activeTab?.sql ?? ""
    replaceSql(formatSql(current))
  }, [activeTab?.sql, replaceSql])

  async function runActive() {
    if (!activeTab || !activeTab.sql.trim()) return
    await runSql(activeTab.sql)
  }

  async function saveCurrent() {
    if (!activeTab) return
    const name = window.prompt("Query name", activeTab.title) ?? activeTab.title
    try {
      const created = await apiPost<SqlSavedQuery>("/api/sql/saved", {
        name,
        sql: activeTab.sql,
        pinned: false,
      })
      setSaved((prev) => [created, ...prev])
      setTabs((prev) => prev.map((tab) => (tab.id === activeTab.id ? { ...tab, title: name } : tab)))
      toast.success("Saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed")
    }
  }

  async function togglePin(id: string) {
    const target = saved.find((item) => item.id === id)
    if (!target) return
    try {
      const updated = await apiPatch<SqlSavedQuery>(`/api/sql/saved/${id}`, { pinned: !target.pinned })
      setSaved((prev) => prev.map((item) => (item.id === id ? { ...item, ...updated } : item)))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed")
    }
  }

  async function deleteSaved(id: string) {
    if (!window.confirm("Delete this saved query?")) return
    try {
      await apiDelete(`/api/sql/saved/${id}`)
      setSaved((prev) => prev.filter((item) => item.id !== id))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed")
    }
  }

  function newTabAt(index?: number) {
    const tab = newTab(`query ${tabs.length + 1}`)
    setTabs((prev) => {
      if (typeof index !== "number") return [...prev, tab]
      const next = [...prev]
      next.splice(index, 0, tab)
      return next
    })
    setActiveTabId(tab.id)
  }

  function closeTab(id: string) {
    setTabsState((prev) => {
      const next = prev.tabs.filter((tab) => tab.id !== id)
      if (!next.length) {
        const fresh = initialTab()
        return { tabs: [fresh], activeTabId: fresh.id }
      }
      return {
        tabs: next,
        activeTabId: id === prev.activeTabId ? next[0].id : prev.activeTabId,
      }
    })
  }

  function copyResult() {
    const set = result?.resultSets[result.resultSets.length - 1]
    if (!set) return
    const header = set.columns.map((column) => column.name).join("\t")
    const body = set.rows.map((row) => set.columns.map((column) => formatCell(row[column.name])).join("\t")).join("\n")
    void navigator.clipboard.writeText(`${header}\n${body}`)
    toast.success("Copied")
  }

  function exportResult(format: "csv" | "json") {
    const set = result?.resultSets[result.resultSets.length - 1]
    if (!set) return
    let blob: Blob
    let filename: string
    if (format === "json") {
      blob = new Blob([JSON.stringify(set.rows, null, 2)], { type: "application/json" })
      filename = `sql-result-${Date.now()}.json`
    } else {
      const escape = (value: unknown) => {
        const text = formatCell(value)
        return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
      }
      const header = set.columns.map((column) => column.name).join(",")
      const body = set.rows.map((row) => set.columns.map((column) => escape(row[column.name])).join(",")).join("\n")
      blob = new Blob([`${header}\n${body}`], { type: "text/csv" })
      filename = `sql-result-${Date.now()}.csv`
    }
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const enabled = schema?.enabled !== false
  const role = schema?.viewer?.role
  const isOwner = schema?.viewer?.isOwner
  const lastSet = result?.resultSets?.[result.resultSets.length - 1] ?? null
  const sidebarStyle = sidebarOpen
    ? ({ "--sql-sidebar-width": `${layout.sidebarWidth}px` } as CSSProperties)
    : undefined
  const editorHeightStyle = { "--sql-editor-height": `${layout.editorHeight}px` } as CSSProperties
  const assistantStyle = { "--sql-assistant-width": `${layout.assistantWidth}px` } as CSSProperties

  return (
    <div className="sql-lab-viewport mx-auto flex h-[calc(var(--app-viewport-height)-3.5rem)] max-w-[1760px] flex-col overflow-hidden px-2 pb-2 pt-2 sm:px-3 sm:pt-3 md:px-5">
      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-[--color-border] bg-[--color-bg-surface] px-2 py-1.5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
        <div className="flex shrink-0 items-center gap-2 rounded bg-slate-900 px-2 py-1.5 text-white">
          <Terminal size={12} />
          <span className="font-mono text-[11px] tracking-wide">SQL LAB</span>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 font-mono text-[11px] sm:flex-none">
          <Server size={11} className="text-emerald-600" />
          <span className="truncate text-[--color-text-primary]">{schema?.dataSource?.name ?? "primary"}</span>
          <span className="text-[--color-text-muted]">/</span>
          <span className="text-[--color-text-secondary]">{schema?.dataSource?.engine ?? "postgres"}</span>
          <span className="hidden text-[--color-text-muted] md:inline">/</span>
          <span className="hidden font-semibold text-[--color-text-primary] md:inline">Public / Private</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="hidden items-center gap-1 rounded bg-emerald-50 px-1.5 py-1 font-mono text-[10px] text-emerald-700 sm:inline-flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            connected
          </span>
          {role ? (
            <span className={cn(
              "inline-flex items-center gap-1 rounded px-1.5 py-1 font-mono text-[10px]",
              isOwner ? "bg-amber-50 text-amber-800" : role === "admin" ? "bg-violet-50 text-violet-800" : "bg-slate-100 text-slate-700"
            )}>
              {isOwner ? <ShieldCheck size={10} /> : <KeyRound size={10} />}
              {isOwner ? "owner" : role}
            </span>
          ) : null}
        </div>
      </div>

      <div
        data-sql-mobile-nav
        className="mb-2 grid shrink-0 grid-cols-4 gap-1 rounded-md border border-[--color-border] bg-[--color-bg-surface] p-1 shadow-[0_2px_10px_rgba(15,23,42,0.04)] lg:hidden"
      >
        <MobilePanelButton
          active={mobilePanel === "editor"}
          icon={<Terminal size={13} />}
          label="查询"
          panel="editor"
          onClick={() => setMobilePanel("editor")}
        />
        <MobilePanelButton
          active={mobilePanel === "schema"}
          icon={<Database size={13} />}
          label="结构"
          panel="schema"
          onClick={() => {
            setSidebarOpen(true)
            setMobilePanel("schema")
          }}
        />
        <MobilePanelButton
          active={mobilePanel === "results"}
          icon={<Activity size={13} />}
          label="结果"
          panel="results"
          onClick={() => setMobilePanel("results")}
        />
        <MobilePanelButton
          active={mobilePanel === "assistant"}
          icon={<Sparkles size={13} />}
          label="助教"
          panel="assistant"
          onClick={() => setMobilePanel("assistant")}
        />
      </div>

      {!loading && !enabled ? (
        <div className="flex flex-1 items-center justify-center rounded-md border border-[--color-border] bg-[--color-bg-surface] p-10 text-center">
          <div className="max-w-md">
            <Sparkles size={28} className="mx-auto text-[--color-brand]" />
            <h2 className="mt-3 text-base font-semibold text-[--color-text-primary]">SQL Lab is not enabled</h2>
            <p className="mt-2 text-sm text-[--color-text-muted]">Ask an administrator to grant SQL Lab access.</p>
          </div>
        </div>
      ) : (
        <div ref={mainRowRef} data-sql-lab-main className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden lg:flex-row lg:gap-0">
          <aside
            style={sidebarStyle}
            className={cn(
              "min-h-0 overflow-hidden rounded-md border border-[--color-border] bg-[--color-bg-surface] shadow-[0_4px_18px_rgba(15,23,42,0.04)] lg:block lg:shrink-0",
              mobilePanel === "schema" ? "block" : "hidden",
              sidebarOpen
                ? "flex-1 w-full lg:h-auto lg:flex-none lg:w-[var(--sql-sidebar-width)]"
                : "h-10 w-full shrink-0 lg:h-auto lg:w-[40px]"
            )}
          >
            {sidebarOpen ? (
              <div className="flex h-full flex-col">
                <SchemaTree
                  schema={schema}
                  onInsertTable={insertAtCursor}
                  onInsertColumn={insertAtCursor}
                  onSchemaChanged={refreshSchema}
                />
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="flex shrink-0 items-center justify-center gap-1 border-t border-[--color-border] bg-[#FAFBFC] py-1.5 font-mono text-[10px] text-[--color-text-muted] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
                >
                  <ChevronLeft size={11} /> hide
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex h-full w-full flex-row items-center justify-center gap-2 text-[--color-text-muted] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary] lg:flex-col"
                title="Show schema"
              >
                <ChevronRight size={12} />
                <Database size={12} />
              </button>
            )}
          </aside>

          {sidebarOpen ? (
            <ResizeHandle
              axis="x"
              ariaLabel="Resize sidebar"
              getValue={() => layout.sidebarWidth}
              onChange={setSidebarWidth}
              className="hidden lg:block"
            />
          ) : null}

          <div
            ref={rightColRef}
            className={cn(
              "min-w-0 flex-1 flex-col overflow-hidden lg:flex",
              mobilePanel === "schema" ? "hidden" : "flex"
            )}
          >
            <div
              className={cn(
                "shrink-0 flex-col rounded-md border border-[--color-border] bg-[--color-bg-surface] shadow-[0_4px_18px_rgba(15,23,42,0.04)] lg:flex",
                mobilePanel === "editor" ? "flex" : "hidden"
              )}
            >
              <div className="flex items-center gap-0.5 overflow-x-auto border-b border-[--color-border] bg-[#FAFBFC] px-1 py-1">
                {tabs.map((tab) => {
                  const isActive = tab.id === activeTabId
                  return (
                    <div
                      key={tab.id}
                      onClick={() => setActiveTabId(tab.id)}
                      className={cn(
                        "group relative flex shrink-0 cursor-pointer items-center gap-1.5 rounded-t-md border-b-2 px-3 py-1.5 font-mono text-[11px]",
                        isActive ? "border-[--color-brand] bg-white text-[--color-text-primary]" : "border-transparent text-[--color-text-muted] hover:bg-white/60 hover:text-[--color-text-secondary]"
                      )}
                    >
                      <Database size={10} className={isActive ? "text-[--color-brand]" : "text-[--color-text-muted]"} />
                      <span className="truncate">{tab.title}</span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          closeTab(tab.id)
                        }}
                        className="ml-0.5 rounded p-0.5 text-[--color-text-muted] hover:bg-slate-200 hover:text-[--color-text-primary]"
                        aria-label="Close"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )
                })}
                <button
                  type="button"
                  onClick={() => newTabAt()}
                  className="ml-1 inline-flex h-6 items-center justify-center rounded-md border border-dashed border-[--color-border] px-2 font-mono text-[10px] text-[--color-text-muted] hover:border-[--color-brand-border] hover:bg-white hover:text-[--color-brand]"
                >
                  + new
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5">
                <Button size="sm" variant="default" onClick={runActive} disabled={running || !activeTab?.sql.trim()} className="h-7 gap-1 px-3 text-[11px]">
                  {running ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                  Run
                </Button>
                {running ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast("Waiting for server response.", { icon: <StopCircle size={14} /> })}
                    className="h-7 gap-1 px-2 text-[11px] text-[--color-danger]"
                  >
                    <Pause size={11} /> Stop
                  </Button>
                ) : null}
                <span className="mx-1 hidden h-5 w-px bg-[--color-border] sm:block" />
                <Button size="sm" variant="outline" onClick={formatActiveSql} className="h-7 gap-1 px-2 text-[11px]" disabled={!activeTab?.sql}>
                  <Wand2 size={11} /> Format
                </Button>
                <Button size="sm" variant="outline" onClick={saveCurrent} className="h-7 gap-1 px-2 text-[11px]" disabled={!activeTab?.sql.trim()}>
                  Save
                </Button>
                <span className="mx-1 hidden h-5 w-px bg-[--color-border] sm:block" />
                <label className="hidden items-center gap-1.5 rounded-md border border-[--color-border] bg-[--color-bg-soft] px-2 py-1 font-mono text-[10px] text-[--color-text-muted] sm:flex">
                  <span className="uppercase tracking-wider">limit</span>
                  <input
                    type="number"
                    min={1}
                    max={schema?.maxLimit ?? 50000}
                    value={limit}
                    onChange={(event) => setLimit(Math.max(1, Number(event.target.value) || 1))}
                    className="w-16 bg-transparent font-mono text-[11px] tabular-nums text-[--color-text-primary] outline-none"
                  />
                </label>
                <div className="ml-0 flex w-full items-center justify-between gap-2 font-mono text-[10px] text-[--color-text-muted] sm:ml-auto sm:w-auto sm:justify-start">
                  <span className="inline-flex items-center gap-1">
                    <Activity size={10} />
                    {result ? <><span className="tabular-nums text-[--color-text-primary]">{result.durationMs}</span>ms</> : "idle"}
                  </span>
                  {lastSet ? <span className="tabular-nums"><span className="text-[--color-text-primary]">{lastSet.rowCount}</span> rows</span> : null}
                </div>
              </div>
            </div>

            <div data-sql-lab-workbench className="mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden lg:flex-row lg:gap-0">
              <div
                className={cn(
                  "min-w-0 flex-col lg:flex lg:flex-1",
                  mobilePanel === "assistant" ? "hidden" : "flex"
                )}
              >
                <div
                  className={cn(
                    "min-h-0",
                    mobilePanel === "editor" ? "flex-1" : "hidden",
                    "lg:block lg:h-[var(--sql-editor-height)] lg:flex-none"
                  )}
                  style={editorHeightStyle}
                >
                  <SqlEditor
                    ref={editorRef}
                    value={activeTab?.sql ?? ""}
                    onChange={updateActiveSql}
                    onRun={runActive}
                    caption={`${activeTab?.title ?? "query"}.sql`}
                    readOnly={schema?.dataSource?.readOnly}
                    theme={layout.theme}
                    onToggleTheme={toggleTheme}
                  />
                </div>
                <ResizeHandle
                  axis="y"
                  ariaLabel="Resize editor"
                  getValue={() => layout.editorHeight}
                  onChange={setEditorHeight}
                  className="my-1 hidden lg:block"
                />
                <div
                  className={cn(
                    "min-h-0",
                    mobilePanel === "results" ? "flex-1" : "hidden",
                    "lg:block lg:flex-1"
                  )}
                >
                  <ResultsPanel
                    result={result}
                    running={running}
                    history={history}
                    saved={saved}
                    examples={examples}
                    activeTab={bottomTab}
                    onActiveTabChange={setBottomTab}
                    onLoadSql={replaceSql}
                    onSaveCurrent={saveCurrent}
                    onTogglePin={togglePin}
                    onDeleteSaved={deleteSaved}
                    onCopyResult={copyResult}
                    onExportResult={exportResult}
                    currentSql={activeTab?.sql ?? ""}
                    codeTheme={layout.theme}
                  />
                </div>
              </div>

              <ResizeHandle
                axis="x"
                ariaLabel="Resize SQL assistant"
                getValue={() => -layout.assistantWidth}
                onChange={(next) => setAssistantWidth(-next)}
                className="hidden lg:block"
              />
              <aside
                className={cn(
                  "min-h-0 w-full shrink-0 lg:block lg:h-auto lg:w-[clamp(320px,32vw,var(--sql-assistant-width))] 2xl:w-[var(--sql-assistant-width)]",
                  mobilePanel === "assistant" ? "flex flex-1" : "hidden"
                )}
                style={assistantStyle}
              >
                <SqlAssistantPanel
                  className="h-full min-h-0"
                  currentSql={activeTab?.sql ?? ""}
                  lastResult={result}
                  limit={limit}
                  onApplySql={replaceSql}
                  onApplyNewSql={createTabWithSql}
                  onTrySql={async (sql) => {
                    replaceSql(sql)
                    return runSql(sql)
                  }}
                  onSchemaChanged={refreshSchema}
                  onAssistantRunResult={(sql, title, runResult) => {
                    createTabWithSql(sql, title)
                    recordRunResult(sql, runResult)
                  }}
                />
              </aside>
            </div>
          </div>
        </div>
      )}

      <StatusBar schema={schema} result={result} running={running} role={role} isOwner={isOwner} />
    </div>
  )
}

function StatusBar({
  schema,
  result,
  running,
  role,
  isOwner,
}: {
  schema: SqlSchema | null
  result: SqlRunResult | null
  running: boolean
  role?: string
  isOwner?: boolean
}) {
  const lastSet = result?.resultSets?.[result.resultSets.length - 1] ?? null
  return (
    <div className="mt-2 flex shrink-0 items-center gap-3 overflow-hidden rounded-md bg-slate-900 px-3 py-1 font-mono text-[10.5px] text-slate-300">
      <span className={cn("inline-flex items-center gap-1", running ? "text-amber-300" : result?.error ? "text-rose-300" : "text-emerald-300")}>
        <span className={cn("h-1.5 w-1.5 rounded-full", running ? "animate-pulse bg-amber-400" : result?.error ? "bg-rose-400" : "bg-emerald-400")} />
        {running ? "executing" : result?.error ? "error" : "ready"}
      </span>
      <span className="text-slate-600">|</span>
      <span className="hidden items-center gap-1 sm:inline-flex">
        <Server size={10} />
        {schema?.dataSource?.name ?? "primary"} / {schema?.dataSource?.engine ?? "postgres"}
      </span>
      <span className="hidden text-slate-600 sm:inline">|</span>
      <span className="hidden sm:inline">{isOwner ? "owner" : role ?? "-"}</span>
      <span className="ml-auto inline-flex items-center gap-3">
        {lastSet ? (
          <>
            <span className="tabular-nums">{lastSet.rowCount} rows</span>
            <span className="text-slate-600">|</span>
            <span className="tabular-nums">{result?.durationMs} ms</span>
          </>
        ) : (
          <span>idle</span>
        )}
      </span>
    </div>
  )
}

function MobilePanelButton({
  active,
  icon,
  label,
  panel,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  label: string
  panel: MobilePanel
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-sql-mobile-panel={panel}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors",
        active
          ? "bg-[--color-brand] text-white shadow-[0_8px_20px_rgba(37,99,235,0.18)]"
          : "text-[--color-text-secondary] hover:bg-[--color-brand-soft] hover:text-[--color-brand]"
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  )
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function formatSql(sql: string): string {
  if (!sql.trim()) return sql
  try {
    return formatSqlText(sql, {
      language: "postgresql",
      keywordCase: "upper",
      dataTypeCase: "upper",
      functionCase: "upper",
      identifierCase: "preserve",
      tabWidth: 2,
      useTabs: false,
      linesBetweenQueries: 1,
      denseOperators: false,
      expressionWidth: 56,
    }).trim()
  } catch {
    return sql.trim()
  }
}
