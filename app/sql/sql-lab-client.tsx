"use client"

import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { format as formatSqlText } from "sql-formatter"
import {
  Activity,
  Database,
  DatabaseZap,
  KeyRound,
  Network,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react"
import { toast } from "sonner"
import { apiDelete, apiFetch, apiPatch, apiPost } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { DataCatalogRail } from "@/components/sql-lab/data-catalog-rail"
import { ResultsPanel } from "@/components/sql-lab/results-panel"
import { ResizeHandle } from "@/components/sql-lab/resize-handle"
import { SqlConsoleDrawer, type SqlConsoleTab } from "@/components/sql-lab/sql-console-drawer"
import { SqlEditor, type SqlEditorHandle, type SqlEditorTheme } from "@/components/sql-lab/sql-editor"
import { AiCopilotSide } from "@/components/sql-lab/stage/ai-copilot-side"
import { StageCommandBar } from "@/components/sql-lab/stage/stage-command-bar"
import { StageStopButton } from "@/components/sql-lab/stage/stage-stop-button"
import { StageThread } from "@/components/sql-lab/stage/stage-thread"
import { StageThreadList } from "@/components/sql-lab/stage/stage-thread-list"
import { SqlLabLoading } from "@/components/loading/app-loading-states"
import { applyStreamEvent, streamThreadAi } from "@/lib/sql-lab/thread-stream-client"
import type {
  SqlExample,
  SqlHistoryItem,
  SqlRunResult,
  SqlSavedQuery,
  SqlSchema,
  SqlStageMode,
  SqlTableInfo,
  SqlThreadDetail,
  SqlThreadStreamEvent,
  SqlThreadSummary,
} from "@/lib/sql-lab/types"

type EditorTab = SqlConsoleTab
type BottomTab = "results" | "history" | "saved" | "examples"
type StagePromptOptions = {
  mode?: "draft" | "explain_selection" | "interpret_chart"
  currentSql?: string
  lastError?: string
}

type Layout = {
  theme: SqlEditorTheme
  consoleOpen: boolean
  catalogWidth: number
  asideWidth: number
  resultHeight: number
  consoleHeight: number
}

const STORAGE_KEY = "sql-lab.tabs.v2"
const LEGACY_STORAGE_KEY = "sql-lab.tabs.v1"
const LAYOUT_KEY = "sql-lab.cockpit-layout.v1"
const ACTIVE_THREAD_KEY = "sql-lab.active-thread.v1"
const STAGE_MODE_KEY = "sql-lab.stage-mode.v1"
const DEFAULT_LAYOUT: Layout = {
  theme: "dark",
  consoleOpen: false,
  catalogWidth: 276,
  asideWidth: 332,
  resultHeight: 430,
  consoleHeight: 380,
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)))
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
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY)
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
      theme: parsed.theme === "light" ? "light" : "dark",
      consoleOpen: Boolean(parsed.consoleOpen),
      catalogWidth: clamp(Number(parsed.catalogWidth ?? DEFAULT_LAYOUT.catalogWidth), 220, 420),
      asideWidth: clamp(Number(parsed.asideWidth ?? DEFAULT_LAYOUT.asideWidth), 260, 480),
      resultHeight: clamp(Number(parsed.resultHeight ?? DEFAULT_LAYOUT.resultHeight), 260, 680),
      consoleHeight: clamp(Number(parsed.consoleHeight ?? DEFAULT_LAYOUT.consoleHeight), 280, 760),
    }
  } catch {
    return DEFAULT_LAYOUT
  }
}

function writeLayout(layout: Layout) {
  if (typeof window !== "undefined") window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
}

function readStageMode(): SqlStageMode {
  if (typeof window === "undefined") return "auto"
  const raw = window.localStorage.getItem(STAGE_MODE_KEY)
  return raw === "analyst" || raw === "manual" ? raw : "auto"
}

function writeStageMode(mode: SqlStageMode) {
  if (typeof window !== "undefined") window.localStorage.setItem(STAGE_MODE_KEY, mode)
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

function quoteQualifiedName(qualifiedName: string) {
  const [schema, table] = qualifiedName.split(".")
  if (!schema || !table) return qualifiedName
  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`
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

export function SqlLabClient() {
  const [schema, setSchema] = useState<SqlSchema | null>(null)
  const [history, setHistory] = useState<SqlHistoryItem[]>([])
  const [saved, setSaved] = useState<SqlSavedQuery[]>([])
  const [examples, setExamples] = useState<SqlExample[]>([])
  const [threads, setThreads] = useState<SqlThreadSummary[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [threadDetail, setThreadDetail] = useState<SqlThreadDetail | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [rewindBeforeStepId, setRewindBeforeStepId] = useState<string | null>(null)
  const [stageMode, setStageModeState] = useState<SqlStageMode>("auto")
  const [stageModeHydrated, setStageModeHydrated] = useState(false)
  const [{ tabs, activeTabId }, setTabsState] = useState<{ tabs: EditorTab[]; activeTabId: string }>(() => {
    const tab = initialTab()
    return { tabs: [tab], activeTabId: tab.id }
  })
  const [tabsHydrated, setTabsHydrated] = useState(false)
  const [layout, setLayoutState] = useState<Layout>(DEFAULT_LAYOUT)
  const [layoutHydrated, setLayoutHydrated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SqlRunResult | null>(null)
  const [bottomTab, setBottomTab] = useState<BottomTab>("results")
  const [limit, setLimit] = useState(1000)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)

  const editorRef = useRef<SqlEditorHandle>(null)
  const threadDetailRef = useRef<SqlThreadDetail | null>(null)
  const activeStreamAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    threadDetailRef.current = threadDetail
  }, [threadDetail])

  const setTabs = useCallback((updater: EditorTab[] | ((prev: EditorTab[]) => EditorTab[])) => {
    setTabsState((prev) => ({
      ...prev,
      tabs: typeof updater === "function" ? updater(prev.tabs) : updater,
    }))
  }, [])

  const setActiveTabId = useCallback((id: string) => {
    setTabsState((prev) => ({ ...prev, activeTabId: id }))
  }, [])

  const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0] ?? null, [activeTabId, tabs])
  const enabled = schema?.enabled !== false
  const role = schema?.viewer?.role
  const isOwner = schema?.viewer?.isOwner
  const lastSet = result?.resultSets?.[result.resultSets.length - 1] ?? null

  const setLayout = useCallback((updater: Layout | ((prev: Layout) => Layout)) => {
    setLayoutState((prev) => typeof updater === "function" ? updater(prev) : updater)
  }, [])

  const setStageMode = useCallback((mode: SqlStageMode) => {
    setStageModeState(mode)
    writeStageMode(mode)
  }, [])

  const resizeCatalog = useCallback((next: number) => {
    setLayout((prev) => ({ ...prev, catalogWidth: clamp(next, 220, 420) }))
  }, [setLayout])

  const resizeAside = useCallback((next: number) => {
    setLayout((prev) => ({ ...prev, asideWidth: clamp(-next, 260, 480) }))
  }, [setLayout])

  const resizeResults = useCallback((next: number) => {
    setLayout((prev) => ({ ...prev, resultHeight: clamp(-next, 260, 680) }))
  }, [setLayout])

  const resizeConsole = useCallback((next: number) => {
    setLayout((prev) => ({ ...prev, consoleHeight: clamp(next, 280, 760) }))
  }, [setLayout])

  const refreshThreadList = useCallback(async () => {
    try {
      const data = await apiFetch<{ items: SqlThreadSummary[] }>("/api/sql/threads")
      setThreads(data.items ?? [])
      return data.items ?? []
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "读取 Stage 线程失败")
      return []
    }
  }, [])

  const loadThreadDetail = useCallback(async (threadId: string) => {
    setThreadLoading(true)
    try {
      const detail = await apiFetch<SqlThreadDetail>(`/api/sql/threads/${threadId}`)
      setThreadDetail(detail)
      setRewindBeforeStepId(null)
      setActiveThreadId(detail.id)
      if (typeof window !== "undefined") window.localStorage.setItem(ACTIVE_THREAD_KEY, detail.id)
      return detail
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "读取线程失败")
      return null
    } finally {
      setThreadLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = readTabs()
      if (stored?.length) setTabsState({ tabs: stored, activeTabId: stored[0].id })
      setTabsHydrated(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (tabsHydrated) writeTabs(tabs)
  }, [tabs, tabsHydrated])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLayoutState(readLayout())
      setLayoutHydrated(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (layoutHydrated) writeLayout(layout)
  }, [layout, layoutHydrated])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setStageModeState(readStageMode())
      setStageModeHydrated(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (stageModeHydrated) writeStageMode(stageMode)
  }, [stageMode, stageModeHydrated])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [sch, hist, sav, ex, threadList] = await Promise.all([
          apiFetch<SqlSchema>("/api/sql/schema"),
          apiFetch<{ items: SqlHistoryItem[] }>("/api/sql/history"),
          apiFetch<{ items: SqlSavedQuery[] }>("/api/sql/saved"),
          apiFetch<{ items: SqlExample[] }>("/api/sql/examples"),
          apiFetch<{ items: SqlThreadSummary[] }>("/api/sql/threads"),
        ])
        if (cancelled) return
        setSchema(sch)
        setHistory(hist.items ?? [])
        setSaved(sav.items ?? [])
        setExamples(ex.items ?? [])
        setLimit(sch.defaultLimit)
        const items = threadList.items ?? []
        setThreads(items)
        const remembered = typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_THREAD_KEY) : null
        const targetId = items.find((item) => item.id === remembered)?.id ?? items[0]?.id ?? null
        if (targetId) await loadThreadDetail(targetId)
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "SQL 实验室加载失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [loadThreadDetail])

  // Global R hotkey opens the dedicated relation graph route.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return
      if (event.key === "r" || event.key === "R") {
        event.preventDefault()
        window.location.href = "/sql/relations"
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const updateActiveSql = useCallback((sql: string) => {
    setTabs((prev) => prev.map((tab) => (tab.id === activeTabId ? { ...tab, sql } : tab)))
  }, [activeTabId, setTabs])

  const insertAtCursor = useCallback((text: string) => {
    setLayout((prev) => ({ ...prev, consoleOpen: true }))
    requestAnimationFrame(() => editorRef.current?.insertAtCursor(text))
  }, [setLayout])

  const replaceSql = useCallback((sql: string) => {
    setTabs((prev) => prev.map((tab) => (tab.id === activeTabId ? { ...tab, sql } : tab)))
    setLayout((prev) => ({ ...prev, consoleOpen: true }))
    requestAnimationFrame(() => editorRef.current?.replaceAll(sql))
  }, [activeTabId, setLayout, setTabs])

  const createTabWithSql = useCallback((sql: string, title?: string) => {
    const tab = newTab(title || `query ${tabs.length + 1}`)
    tab.sql = sql
    setTabs((prev) => [...prev, tab])
    setActiveTabId(tab.id)
    setLayout((prev) => ({ ...prev, consoleOpen: true }))
    requestAnimationFrame(() => editorRef.current?.replaceAll(sql))
  }, [setActiveTabId, setLayout, setTabs, tabs.length])

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
    setBottomTab("results")
  }, [])

  const runSql = useCallback(async (sql: string, options?: { title?: string; threadStepId?: string; threadId?: string | null }) => {
    if (!sql.trim() || running) return null
    setRunning(true)
    setBottomTab("results")
    try {
      const res = await apiPost<SqlRunResult>("/api/sql/run", {
        sql,
        limit,
        threadId: options?.threadId ?? activeThreadId ?? undefined,
        threadStepId: options?.threadStepId,
        title: options?.title,
      })
      recordRunResult(sql, res)
      // Refresh thread detail to pick up the new sql_run step
      if (activeThreadId) {
        void loadThreadDetail(activeThreadId)
        void refreshThreadList()
      }
      return res
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "SQL 执行失败")
      return null
    } finally {
      setRunning(false)
    }
  }, [activeThreadId, limit, loadThreadDetail, recordRunResult, refreshThreadList, running])

  async function runActive() {
    if (!activeTab?.sql.trim()) return
    await runSql(activeTab.sql)
  }

  function formatActiveSql() {
    const current = editorRef.current?.getValue() ?? activeTab?.sql ?? ""
    replaceSql(formatSql(current))
  }

  async function saveCurrent() {
    if (!activeTab?.sql.trim()) return
    const name = window.prompt("给这条分析配方起个名字", activeTab.title) ?? activeTab.title
    try {
      const created = await apiPost<SqlSavedQuery>("/api/sql/saved", {
        name,
        sql: activeTab.sql,
        pinned: false,
      })
      setSaved((prev) => [created, ...prev])
      setTabs((prev) => prev.map((tab) => (tab.id === activeTab.id ? { ...tab, title: name } : tab)))
      toast.success("已保存为分析配方")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败")
    }
  }

  async function togglePin(id: string) {
    const target = saved.find((item) => item.id === id)
    if (!target) return
    try {
      const updated = await apiPatch<SqlSavedQuery>(`/api/sql/saved/${id}`, { pinned: !target.pinned })
      setSaved((prev) => prev.map((item) => (item.id === id ? { ...item, ...updated } : item)))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新失败")
    }
  }

  async function deleteSaved(id: string) {
    if (!window.confirm("删除这条分析配方？")) return
    try {
      await apiDelete(`/api/sql/saved/${id}`)
      setSaved((prev) => prev.filter((item) => item.id !== id))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败")
    }
  }

  function newTabAt() {
    const tab = newTab(`query ${tabs.length + 1}`)
    setTabs((prev) => [...prev, tab])
    setActiveTabId(tab.id)
    setLayout((prev) => ({ ...prev, consoleOpen: true }))
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
    toast.success("结果已复制")
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

  function openConsolePane() {
    setLayout((prev) => ({ ...prev, consoleOpen: true }))
  }

  function selectTable(table: SqlTableInfo) {
    const qualified = `${table.schema}.${table.name}`
    setSelectedTable(qualified)
    window.location.href = `/sql/relations?focus=${encodeURIComponent(qualified)}`
  }

  const onApplySqlFromStep = useCallback((sql: string, title?: string) => {
    createTabWithSql(sql, title)
  }, [createTabWithSql])

  const onRunSqlFromStep = useCallback(async (sql: string, title?: string, stepId?: string) => {
    createTabWithSql(sql, title)
    await runSql(sql, { title, threadStepId: stepId, threadId: activeThreadId })
  }, [activeThreadId, createTabWithSql, runSql])

  const ensureThread = useCallback(async (prompt: string): Promise<string | null> => {
    if (activeThreadId) return activeThreadId
    try {
      const created = await apiPost<SqlThreadSummary>("/api/sql/threads", { prompt })
      setThreads((prev) => [created, ...prev.filter((item) => item.id !== created.id)])
      setActiveThreadId(created.id)
      setThreadDetail({ ...created, steps: [] })
      if (typeof window !== "undefined") window.localStorage.setItem(ACTIVE_THREAD_KEY, created.id)
      return created.id
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "无法创建分析线程")
      return null
    }
  }, [activeThreadId])

  const activeSqlForStage = activeTab?.sql || undefined
  const lastErrorForStage = result?.error?.message

  const submitStagePrompt = useCallback(async (prompt: string, options: StagePromptOptions = {}) => {
    if (!prompt.trim() || streaming) return
    const threadId = await ensureThread(prompt)
    if (!threadId) return
    const controller = new AbortController()
    activeStreamAbortRef.current = controller
    setStreaming(true)
    try {
      await streamThreadAi({
        threadId,
        prompt,
        stageMode,
        mode: options.mode,
        currentSql: options.currentSql ?? activeSqlForStage,
        lastError: options.lastError ?? lastErrorForStage,
        signal: controller.signal,
        onEvent: (event: SqlThreadStreamEvent) => {
          setThreadDetail((prev) => applyStreamEvent(prev ?? threadDetailRef.current, event))
          if (event.type === "step.completed" && event.step.kind === "sql_draft" && event.step.sql) {
            // Auto-import generated SQL into editor for inspection
            const title = ((event.step.payload as { title?: string } | null)?.title) ?? event.step.title
            createTabWithSql(event.step.sql, title || "AI 生成")
          }
        },
      })
      await refreshThreadList()
    } catch (error) {
      if (controller.signal.aborted) toast.message("已叫停本次 AI 分析")
      else toast.error(error instanceof Error ? error.message : "AI 思考流被中断")
    } finally {
      if (activeStreamAbortRef.current === controller) activeStreamAbortRef.current = null
      setStreaming(false)
    }
  }, [activeSqlForStage, createTabWithSql, ensureThread, lastErrorForStage, refreshThreadList, stageMode, streaming])

  const repairSqlFromError = useCallback(async (input: {
    sql: string
    title?: string
    stepId?: string
    bodyMarkdown?: string
    errorCode?: string
    errorMessage: string
    errorHint?: string
  }) => {
    const sql = input.sql.trim()
    if (!sql) {
      toast.error("没有可修复的 SQL")
      return
    }
    const errorText = [
      input.errorCode ? `Code: ${input.errorCode}` : "",
      `Message: ${input.errorMessage}`,
      input.errorHint ? `Hint: ${input.errorHint}` : "",
    ].filter(Boolean).join("\n")
    const prompt = [
      "请根据下面的执行错误修复 SQL。保持原分析目标不变，优先修正字段、表名、类型、分组、权限或 PostgreSQL 语法问题。",
      "请返回一个新的可执行 SQL 草稿，并简短说明你修复了什么。",
      input.title ? `## 失败步骤\n${input.title}` : "",
      input.bodyMarkdown ? `## 原步骤说明\n${input.bodyMarkdown}` : "",
      `## 失败 SQL\n\`\`\`sql\n${sql}\n\`\`\``,
      `## 执行错误\n${errorText}`,
    ].filter(Boolean).join("\n\n")
    setRewindBeforeStepId(null)
    await submitStagePrompt(prompt, {
      mode: "draft",
      currentSql: sql,
      lastError: errorText,
    })
  }, [submitStagePrompt])

  const stopStageAnalysis = useCallback(async () => {
    activeStreamAbortRef.current?.abort()
    if (activeThreadId) {
      await apiPost("/api/sql/ai/cancel", { threadId: activeThreadId }).catch(() => undefined)
      void loadThreadDetail(activeThreadId)
    }
    if (stageMode !== "manual") setStageMode("manual")
    setStreaming(false)
  }, [activeThreadId, loadThreadDetail, setStageMode, stageMode])

  const createThread = useCallback(async () => {
    try {
      const created = await apiPost<SqlThreadSummary>("/api/sql/threads", {})
      setThreads((prev) => [created, ...prev.filter((item) => item.id !== created.id)])
      setActiveThreadId(created.id)
      setThreadDetail({ ...created, steps: [] })
      if (typeof window !== "undefined") window.localStorage.setItem(ACTIVE_THREAD_KEY, created.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "新建线程失败")
    }
  }, [])

  const selectThread = useCallback(async (id: string) => {
    if (id === activeThreadId) return
    await loadThreadDetail(id)
  }, [activeThreadId, loadThreadDetail])

  const togglePinThread = useCallback(async (id: string, pinned: boolean) => {
    try {
      const updated = await apiPatch<SqlThreadSummary>(`/api/sql/threads/${id}`, { pinned })
      setThreads((prev) => prev.map((item) => (item.id === id ? updated : item)))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "置顶失败")
    }
  }, [])

  const archiveThread = useCallback(async (id: string) => {
    try {
      await apiPatch(`/api/sql/threads/${id}`, { archived: true })
      setThreads((prev) => prev.filter((item) => item.id !== id))
      if (id === activeThreadId) {
        const next = threads.find((item) => item.id !== id)?.id ?? null
        setActiveThreadId(next)
        if (next) await loadThreadDetail(next)
        else setThreadDetail(null)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "归档失败")
    }
  }, [activeThreadId, loadThreadDetail, threads])

  const deleteThread = useCallback(async (id: string) => {
    if (!window.confirm("删除这条分析线程？所有步骤会一并清理。")) return
    try {
      await apiDelete(`/api/sql/threads/${id}`)
      setThreads((prev) => prev.filter((item) => item.id !== id))
      if (id === activeThreadId) {
        const next = threads.find((item) => item.id !== id)?.id ?? null
        setActiveThreadId(next)
        if (next) await loadThreadDetail(next)
        else setThreadDetail(null)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败")
    }
  }, [activeThreadId, loadThreadDetail, threads])

  if (loading) return <SqlLabLoading />

  const totalTables = schema?.schemas.reduce((sum, item) => sum + item.tables.length, 0) ?? 0
  const privateTables = schema?.schemas.find((item) => item.scope === "private")?.tables.length ?? 0
  const stageGridStyle = {
    "--sql-stage-left": `${layout.catalogWidth}px`,
    "--sql-stage-right": `${layout.asideWidth}px`,
    "--sql-stage-results-height": `${layout.resultHeight}px`,
  } as CSSProperties
  const consoleStyle = { "--sql-console-open-height": layout.consoleOpen ? `${layout.consoleHeight}px` : "0px" } as CSSProperties

  const consoleDrawer = (
    <SqlConsoleDrawer
      open={layout.consoleOpen}
      tabs={tabs}
      activeTabId={activeTabId}
      currentSql={activeTab?.sql ?? ""}
      running={running}
      limit={limit}
      maxLimit={schema?.maxLimit ?? 50000}
      durationMs={result?.durationMs}
      rowCount={lastSet?.rowCount}
      consoleHeight={layout.consoleHeight}
      onOpenChange={(open) => setLayout((prev) => ({ ...prev, consoleOpen: open }))}
      onConsoleHeightChange={resizeConsole}
      onActiveTabChange={setActiveTabId}
      onNewTab={newTabAt}
      onCloseTab={closeTab}
      onRun={runActive}
      onFormat={formatActiveSql}
      onSave={saveCurrent}
      onLimitChange={setLimit}
      editor={
        <SqlEditor
          ref={editorRef}
          value={activeTab?.sql ?? ""}
          onChange={updateActiveSql}
          onRun={runActive}
          caption={`${activeTab?.title ?? "query"}.sql`}
          readOnly={schema?.dataSource?.readOnly}
          theme={layout.theme}
          onToggleTheme={() => setLayout((prev) => ({ ...prev, theme: prev.theme === "dark" ? "light" : "dark" }))}
          onExplainSelection={(selection) => submitStagePrompt(`解释这段 SQL：\n\`\`\`sql\n${selection}\n\`\`\``, { mode: "explain_selection" })}
          onRewriteSql={(sql) => submitStagePrompt(`请重写并优化这段 SQL，保留原意并给出更稳妥的写法：\n\`\`\`sql\n${sql}\n\`\`\``)}
        />
      }
    />
  )

  return (
    <div className="sql-lab-viewport sql-lab-cockpit mx-auto flex h-[calc(var(--app-viewport-height)-3.5rem)] max-w-[1780px] flex-col overflow-hidden px-2 pb-2 pt-2 sm:px-3 md:px-5">
      <header className="sql-lab-cockpit-topbar sql-stage-topbar">
        <div className="sql-stage-topbar-title">
          <Sparkles size={16} />
          <div>
            <p>SQL Lab Stage</p>
            <h1>{threadDetail?.title ?? "未命名分析"}</h1>
          </div>
        </div>
        <div className="sql-lab-topbar-status">
          <StatusPill icon={<Database size={14} />} label={schema?.dataSource?.name ?? "primary"} detail={schema?.dataSource?.engine ?? "postgres"} />
          <StatusPill icon={isOwner ? <ShieldCheck size={14} /> : <KeyRound size={14} />} label={isOwner ? "owner" : role ?? "-"} detail={schema?.dataSource?.readOnly ? "Public 只读" : "可写"} />
          <StatusPill icon={<DatabaseZap size={14} />} label={threadDetail?.modelName || "默认模型"} detail="AI Stage Copilot" />
          <StatusPill icon={<Activity size={14} />} label={streaming ? "AI 思考中" : running ? "SQL 执行中" : "ready"} detail={lastSet ? `${lastSet.rowCount} 行` : `${totalTables} 表`} live={streaming || running} />
          <StatusPill icon={<Sparkles size={14} />} label={`limit ${limit}`} detail={`${privateTables} Private`} />
        </div>
        <div className="sql-stage-topbar-actions">
          <StageStopButton visible={streaming} onStop={stopStageAnalysis} />
          <button type="button" onClick={() => { window.location.href = "/sql/relations" }}>
            <Network size={14} /> 关系图 <kbd>R</kbd>
          </button>
          <button type="button" onClick={() => openConsolePane()}>
            <Terminal size={14} /> SQL 控制台 <kbd>⌘J</kbd>
          </button>
        </div>
      </header>

      {!loading && !enabled ? (
        <div className="sql-lab-disabled-state">
          <Sparkles size={30} />
          <h2>SQL 实验室尚未启用</h2>
          <p>请联系管理员授予 SQL Lab 访问权限。权限开启后，这里会显示分析时间线、数据目录和 SQL 控制台。</p>
        </div>
      ) : (
        <main className="sql-stage-grid" style={stageGridStyle}>
          <DataCatalogRail
            schema={schema}
            selectedTable={selectedTable}
            onSelectTable={selectTable}
            onInsertTable={(qualifiedName) => insertAtCursor(quoteQualifiedName(qualifiedName))}
            onOpenRelations={() => { window.location.href = "/sql/relations" }}
          />

          <ResizeHandle
            axis="x"
            ariaLabel="调整数据目录宽度"
            className="sql-stage-resize-handle sql-stage-resize-handle-x"
            getValue={() => layout.catalogWidth}
            onChange={resizeCatalog}
            onReset={() => resizeCatalog(DEFAULT_LAYOUT.catalogWidth)}
          />

          <section className="sql-stage-main">
            <div className="sql-stage-main-scroll">
              <StageThread
                thread={threadDetail}
                loading={threadLoading}
                streaming={streaming}
                onApplySql={onApplySqlFromStep}
                onRunSql={onRunSqlFromStep}
                onRepairSql={repairSqlFromError}
                onInsertTable={(name) => insertAtCursor(quoteQualifiedName(name))}
                rewindBeforeStepId={rewindBeforeStepId}
                onRewindBefore={setRewindBeforeStepId}
                onClearRewind={() => setRewindBeforeStepId(null)}
              />
            </div>
            <ResizeHandle
              axis="y"
              ariaLabel="调整结果区高度"
              className="sql-stage-resize-handle sql-stage-resize-handle-y"
              getValue={() => -layout.resultHeight}
              onChange={resizeResults}
              onReset={() => resizeResults(-DEFAULT_LAYOUT.resultHeight)}
            />
            <div className="sql-stage-main-foot">
              <StageCommandBar
                running={streaming}
                mode={stageMode}
                onModeChange={setStageMode}
                onSubmit={submitStagePrompt}
              />
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
                onRepairError={({ sql, error }) => repairSqlFromError({
                  sql,
                  title: "当前 SQL 执行失败",
                  errorCode: error.code,
                  errorMessage: error.message,
                  errorHint: error.hint,
                })}
                currentSql={activeTab?.sql ?? ""}
                codeTheme={layout.theme}
              />
            </div>
          </section>

          <ResizeHandle
            axis="x"
            ariaLabel="调整右侧侧栏宽度"
            className="sql-stage-resize-handle sql-stage-resize-handle-x"
            getValue={() => -layout.asideWidth}
            onChange={resizeAside}
            onReset={() => resizeAside(-DEFAULT_LAYOUT.asideWidth)}
          />

          <aside className="sql-stage-aside">
            <AiCopilotSide
              thread={threadDetail}
              streaming={streaming}
              onOpenRelations={() => { window.location.href = "/sql/relations" }}
              onOpenConsole={() => openConsolePane()}
              onAskFollowUp={(prompt) => submitStagePrompt(prompt)}
            />
            <StageThreadList
              items={threads}
              activeId={activeThreadId}
              onSelect={selectThread}
              onCreate={createThread}
              onTogglePin={togglePinThread}
              onArchive={archiveThread}
              onDelete={deleteThread}
            />
          </aside>
        </main>
      )}

      {!loading && enabled ? consoleDrawer : null}

      <div className="sql-lab-bottom-glow" style={consoleStyle} />

    </div>
  )
}

function StatusPill({
  icon,
  label,
  detail,
  live,
}: {
  icon: ReactNode
  label: string
  detail: string
  live?: boolean
}) {
  return (
    <span className={cn("sql-lab-status-pill", live && "is-live")}>
      {icon}
      <strong>{label}</strong>
      <small>{detail}</small>
    </span>
  )
}
