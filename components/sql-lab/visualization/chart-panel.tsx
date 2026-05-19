"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ECharts } from "echarts/core"
import { CopyPlus, GripVertical, LayoutGrid, RefreshCw, Save, Settings2, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { apiDelete, apiFetch, apiPatch, apiPost } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { suggestChartConfigs } from "@/lib/sql-lab/visualization/auto-chart"
import {
  normalizeChartConfig,
  resolveWorkbenchTheme,
  type BiCardLayout,
  type ChartConfig,
  type ChartSnapshot,
  type ChartTheme,
  type ResolvedChartTheme,
  type SqlBiDashboard,
} from "@/lib/sql-lab/visualization/chart-config"
import type { SqlRunColumn, SqlInsightCard } from "@/lib/sql-lab/types"
import { ChartCanvas } from "@/components/sql-lab/visualization/chart-canvas"
import { ChartToolbar } from "@/components/sql-lab/visualization/chart-toolbar"
import { ChartExportMenu } from "@/components/sql-lab/visualization/chart-export-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

type Props = {
  columns: SqlRunColumn[]
  rows: Array<Record<string, unknown>>
  sql: string
  threadId?: string | null
  title?: string
  initialConfig?: ChartConfig
  variant?: "workbench" | "single"
}

type WorkbenchCard = {
  id: string
  persisted: boolean
  title: string
  description: string
  sql: string
  chartConfig: ChartConfig
  snapshot: ChartSnapshot
  layout: BiCardLayout
  refreshMeta?: unknown
  updatedAt?: string
}

const CHART_BACKGROUNDS: Record<ResolvedChartTheme, string> = {
  report: "#ffffff",
  light: "#f8fbff",
  dark: "#07111f",
}

const SNAPSHOT_ROW_LIMIT = 2000

function makeSnapshot(columns: SqlRunColumn[], rows: Array<Record<string, unknown>>): ChartSnapshot {
  return {
    columns,
    rows: rows.slice(0, SNAPSHOT_ROW_LIMIT),
    rowCount: rows.length,
    truncated: rows.length > SNAPSHOT_ROW_LIMIT,
    generatedAt: new Date().toISOString(),
  }
}

function normalizeSnapshot(value: unknown, fallbackColumns: SqlRunColumn[], fallbackRows: Array<Record<string, unknown>>): ChartSnapshot {
  if (value && typeof value === "object") {
    const raw = value as Partial<ChartSnapshot>
    if (Array.isArray(raw.columns) && Array.isArray(raw.rows)) {
      return {
        columns: raw.columns,
        rows: raw.rows,
        rowCount: Number(raw.rowCount ?? raw.rows.length) || raw.rows.length,
        truncated: Boolean(raw.truncated),
        generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : new Date().toISOString(),
      }
    }
  }
  return makeSnapshot(fallbackColumns, fallbackRows)
}

function normalizeLayout(value: unknown, id: string, index: number, config?: ChartConfig): BiCardLayout {
  const raw = value && typeof value === "object" ? value as Partial<BiCardLayout> : {}
  return {
    id,
    x: Number(raw.x ?? 0) || 0,
    y: Math.max(0, Number(raw.y ?? index) || index),
    w: Math.max(3, Math.min(12, Number(raw.w ?? config?.layout?.w ?? 6) || 6)),
    h: Math.max(2, Math.min(8, Number(raw.h ?? config?.layout?.h ?? 4) || 4)),
    hidden: Boolean(raw.hidden),
  }
}

function cardFromPersisted(card: SqlInsightCard, index: number, fallback: ChartSnapshot, dashboardLayout: BiCardLayout[]): WorkbenchCard {
  const snapshot = normalizeSnapshot(card.snapshotJson, fallback.columns, fallback.rows)
  const config = normalizeChartConfig(card.chartConfig, snapshot.columns)
  const layout = normalizeLayout(
    dashboardLayout.find((item) => item.id === card.id) ?? card.layout,
    card.id,
    index,
    config,
  )
  return {
    id: card.id,
    persisted: true,
    title: card.title,
    description: card.description,
    sql: card.sql,
    chartConfig: { ...config, theme: (card.theme as ChartTheme | undefined) ?? config.theme },
    snapshot,
    layout,
    refreshMeta: card.refreshMeta,
    updatedAt: card.updatedAt,
  }
}

function makeDraftCards(columns: SqlRunColumn[], rows: Array<Record<string, unknown>>, sql: string, count = 4): WorkbenchCard[] {
  const snapshot = makeSnapshot(columns, rows)
  return suggestChartConfigs(columns, rows, count).map((config, index) => {
    const normalized = normalizeChartConfig(config, columns)
    return {
      id: `draft-${index}-${columns.length}-${rows.length}`,
      persisted: false,
      title: normalized.title || `推荐图表 ${index + 1}`,
      description: normalized.description || "基于当前结果集生成",
      sql,
      chartConfig: normalized,
      snapshot,
      layout: normalizeLayout(normalized.layout, `draft-${index}`, index, normalized),
    }
  })
}

function spanClass(width: number) {
  const span = Math.max(3, Math.min(12, Math.round(width)))
  return `sql-bi-span-${span}`
}

export function ChartPanel({ columns, rows, sql, threadId, title, initialConfig, variant = "workbench" }: Props) {
  if (!columns.length) return null
  if (variant === "single") {
    return <SingleChartPanel columns={columns} rows={rows} sql={sql} threadId={threadId} title={title} initialConfig={initialConfig} />
  }
  return <BiWorkbench columns={columns} rows={rows} sql={sql} threadId={threadId} title={title} />
}

function SingleChartPanel({ columns, rows, sql, threadId, title, initialConfig }: Props) {
  const inferred = useMemo(() => normalizeChartConfig(initialConfig ?? suggestChartConfigs(columns, rows, 1)[0], columns), [columns, initialConfig, rows])
  const [config, setConfig] = useState<ChartConfig>(inferred)
  const chartRef = useRef<ECharts | null>(null)
  const visualTheme = resolveWorkbenchTheme(config.theme)

  async function saveCard() {
    try {
      const card = await apiPost<SqlInsightCard>("/api/sql/cards", {
        title: title || config.title || "SQL 图表",
        description: config.description || "",
        sql,
        threadId,
        chartConfig: config,
        snapshotJson: makeSnapshot(columns, rows),
        layout: config.layout,
        theme: visualTheme,
      })
      toast.success(`已保存分析卡片：${card.title}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存分析卡片失败")
    }
  }

  const downloadPng = useCallback(() => {
    const chart = chartRef.current
    if (!chart) return
    const url = chart.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: CHART_BACKGROUNDS[visualTheme] })
    const link = document.createElement("a")
    link.href = url
    link.download = `sql-chart-${Date.now()}.png`
    link.click()
  }, [visualTheme])

  return (
    <section className={cn("sql-chart-panel", `is-${visualTheme}`)}>
      <div className="sql-chart-panel-head">
        <ChartToolbar config={config} columns={columns} onChange={setConfig} dense />
        <div className="sql-chart-card-actions">
          <button type="button" onClick={saveCard}><Save size={13} /> 保存</button>
          <ChartExportMenu onDownloadPng={downloadPng} />
        </div>
      </div>
      <ChartCanvas rows={rows} columns={columns} config={config} onReady={(chart) => { chartRef.current = chart }} />
    </section>
  )
}

function BiWorkbench({ columns, rows, sql, threadId }: Props) {
  const currentSnapshot = useMemo(() => makeSnapshot(columns, rows), [columns, rows])
  const resultKey = useMemo(() => `${sql}|${columns.map((column) => `${column.name}:${column.type}`).join("|")}|${rows.length}`, [columns, rows.length, sql])
  const [dashboard, setDashboard] = useState<SqlBiDashboard | null>(null)
  const [savedCards, setSavedCards] = useState<SqlInsightCard[]>([])
  const [draftCards, setDraftCards] = useState<WorkbenchCard[]>(() => makeDraftCards(columns, rows, sql, 4))
  const [theme, setTheme] = useState<ResolvedChartTheme>("report")
  const [count, setCount] = useState(4)
  const [loading, setLoading] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [savingLayout, setSavingLayout] = useState(false)
  const [editingLayout, setEditingLayout] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDraftCards(makeDraftCards(columns, rows, sql, 4))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [columns, resultKey, rows, sql])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await apiFetch<{ dashboard: SqlBiDashboard; cards: SqlInsightCard[] }>("/api/sql/bi-dashboard")
        if (cancelled) return
        setDashboard(data.dashboard)
        setTheme(resolveWorkbenchTheme(data.dashboard.theme as ChartTheme))
        setSavedCards(data.cards ?? [])
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "读取 BI 工作台失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const dashboardLayout = useMemo(() => Array.isArray(dashboard?.layout) ? dashboard.layout as BiCardLayout[] : [], [dashboard])
  const persistedCards = useMemo(
    () => savedCards.map((card, index) => cardFromPersisted(card, index + draftCards.length, currentSnapshot, dashboardLayout)),
    [currentSnapshot, dashboardLayout, draftCards.length, savedCards],
  )
  const cards = useMemo(() => [...draftCards, ...persistedCards].sort((a, b) => a.layout.y - b.layout.y), [draftCards, persistedCards])
  const activeCard = cards.find((card) => card.id === activeId) ?? null

  function updateCard(id: string, updater: (card: WorkbenchCard) => WorkbenchCard) {
    setDraftCards((prev) => prev.map((card) => card.id === id ? updater(card) : card))
    setSavedCards((prev) => prev.map((card) => {
      if (card.id !== id) return card
      const workbench = updater(cardFromPersisted(card, 0, currentSnapshot, dashboardLayout))
      return {
        ...card,
        title: workbench.title,
        description: workbench.description,
        chartConfig: workbench.chartConfig,
        layout: workbench.layout,
        theme: workbench.chartConfig.theme,
      }
    }))
  }

  function moveBefore(target: string) {
    if (!dragging || dragging === target) return
    const ordered = cards.map((card) => card.id)
    const moving = ordered.filter((id) => id !== dragging)
    const index = moving.indexOf(target)
    moving.splice(index < 0 ? moving.length : index, 0, dragging)
    moving.forEach((id, y) => updateCard(id, (card) => ({ ...card, layout: { ...card.layout, y } })))
  }

  async function saveDashboardLayout(nextTheme = theme) {
    setSavingLayout(true)
    try {
      const layout = cards.filter((card) => card.persisted).map((card) => card.layout)
      const data = await apiPatch<{ dashboard: SqlBiDashboard; cards: SqlInsightCard[] }>("/api/sql/bi-dashboard", { theme: nextTheme, layout })
      setDashboard(data.dashboard)
      setSavedCards(data.cards ?? [])
      setTheme(resolveWorkbenchTheme(data.dashboard.theme as ChartTheme))
      toast.success("BI 工作台布局已保存")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存布局失败")
    } finally {
      setSavingLayout(false)
    }
  }

  async function generateWithAi() {
    setSuggesting(true)
    try {
      const data = await apiPost<{ cards: Array<{ title: string; description: string; chartConfig: ChartConfig; sourceSql?: string; snapshot?: ChartSnapshot; rationale?: string; confidence?: number }>; source?: string; message?: string }>("/api/sql/visualizations/suggest", {
        sql,
        threadId,
        columns,
        rows: rows.slice(0, SNAPSHOT_ROW_LIMIT),
        count,
      })
      const next = data.cards.map((item, index) => {
        const config = normalizeChartConfig({ ...item.chartConfig, title: item.title, description: item.description, aiRationale: item.rationale }, item.snapshot?.columns ?? columns)
        return {
          id: `draft-ai-${Date.now()}-${index}`,
          persisted: false,
          title: item.title || config.title || `AI 图表 ${index + 1}`,
          description: item.description || config.description || "",
          sql: item.sourceSql || sql,
          chartConfig: config,
          snapshot: item.snapshot ?? currentSnapshot,
          layout: normalizeLayout(config.layout, `draft-ai-${index}`, index, config),
          refreshMeta: { confidence: item.confidence, source: data.source },
        }
      })
      setDraftCards(next)
      toast.success(data.source === "ai" ? "AI 已生成可视化看板" : data.message ?? "已生成本地推荐看板")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI 生成看板失败")
    } finally {
      setSuggesting(false)
    }
  }

  async function saveCard(card: WorkbenchCard) {
    try {
      const created = await apiPost<SqlInsightCard>("/api/sql/cards", {
        title: card.title,
        description: card.description,
        sql: card.sql,
        threadId,
        chartConfig: card.chartConfig,
        snapshotJson: card.snapshot,
        layout: card.layout,
        theme: resolveWorkbenchTheme(card.chartConfig.theme ?? theme),
      })
      setSavedCards((prev) => [created, ...prev])
      setDraftCards((prev) => prev.filter((item) => item.id !== card.id))
      toast.success("已加入 BI 卡片库")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存卡片失败")
    }
  }

  async function persistCard(card: WorkbenchCard) {
    if (!card.persisted) return
    try {
      const updated = await apiPatch<SqlInsightCard>("/api/sql/cards", {
        id: card.id,
        title: card.title,
        description: card.description,
        chartConfig: card.chartConfig,
        layout: card.layout,
        theme: resolveWorkbenchTheme(card.chartConfig.theme ?? theme),
      })
      setSavedCards((prev) => prev.map((item) => item.id === updated.id ? updated : item))
      toast.success("图表配置已保存")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存配置失败")
    }
  }

  async function refreshCard(card: WorkbenchCard) {
    if (!card.persisted) return
    try {
      const updated = await apiPost<SqlInsightCard>(`/api/sql/cards/${card.id}/refresh`, {})
      setSavedCards((prev) => prev.map((item) => item.id === updated.id ? updated : item))
      toast.success("卡片快照已刷新")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "刷新失败")
    }
  }

  async function removeCard(card: WorkbenchCard) {
    if (!card.persisted) {
      setDraftCards((prev) => prev.filter((item) => item.id !== card.id))
      return
    }
    if (!window.confirm("删除这张 BI 图表卡片？")) return
    try {
      await apiDelete(`/api/sql/cards?id=${card.id}`)
      setSavedCards((prev) => prev.filter((item) => item.id !== card.id))
      toast.success("卡片已删除")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败")
    }
  }

  return (
    <section className={cn("sql-bi-workbench", `is-${theme}`)}>
      <header className="sql-bi-head">
        <div className="sql-bi-title">
          <span><LayoutGrid size={17} /></span>
          <div>
            <h3>BI 可视化工作台</h3>
            <p>{loading ? "正在读取个人卡片库..." : `${rows.length} 行结果 · ${savedCards.length} 张已保存卡片 · 快照优先，手动刷新`}</p>
          </div>
        </div>
        <div className="sql-bi-actions">
          <select value={theme} onChange={(event) => { const next = event.target.value as ResolvedChartTheme; setTheme(next); void saveDashboardLayout(next) }}>
            <option value="report">报告主题</option>
            <option value="light">浅色主题</option>
            <option value="dark">深色主题</option>
          </select>
          <select value={count} onChange={(event) => setCount(Number(event.target.value))}>
            <option value={2}>2 张</option>
            <option value={4}>4 张</option>
            <option value={6}>6 张</option>
            <option value={8}>8 张</option>
          </select>
          <button type="button" className="is-primary" onClick={generateWithAi} disabled={suggesting || !rows.length}>
            <Sparkles size={14} /> {suggesting ? "生成中..." : "AI 生成看板"}
          </button>
          <button type="button" onClick={() => setEditingLayout((value) => !value)}>
            <GripVertical size={14} /> {editingLayout ? "完成排布" : "编辑布局"}
          </button>
          <button type="button" onClick={() => saveDashboardLayout()} disabled={savingLayout}>
            <Save size={14} /> {savingLayout ? "保存中..." : "保存布局"}
          </button>
        </div>
      </header>

      {rows.length > SNAPSHOT_ROW_LIMIT ? (
        <div className="sql-chart-warning">当前快照保存前 {SNAPSHOT_ROW_LIMIT} 行；如需更严谨的图表，建议让 AI 生成聚合查询或手动聚合后保存。</div>
      ) : null}

      <div className="sql-bi-grid">
        {cards.filter((card) => !card.layout.hidden).map((card) => (
          <div
            key={card.id}
            draggable={editingLayout}
            onDragStart={() => setDragging(card.id)}
            onDragEnd={() => setDragging(null)}
            onDragOver={(event) => editingLayout && event.preventDefault()}
            onDrop={() => moveBefore(card.id)}
            onPointerEnter={() => editingLayout && dragging && moveBefore(card.id)}
            className={cn("sql-bi-grid-item", spanClass(card.layout.w), editingLayout && "is-editing", dragging === card.id && "is-dragging")}
            style={{ minHeight: `${Math.max(2, card.layout.h) * 92}px` }}
          >
            <WorkbenchChartCard
              card={{ ...card, chartConfig: { ...card.chartConfig, theme: card.chartConfig.theme ?? theme } }}
              theme={theme}
              editingLayout={editingLayout}
              onConfigure={() => setActiveId(card.id)}
              onSave={() => saveCard(card)}
              onPersist={() => persistCard(card)}
              onRefresh={() => refreshCard(card)}
              onRemove={() => removeCard(card)}
              onResize={(patch) => updateCard(card.id, (current) => ({ ...current, layout: { ...current.layout, ...patch } }))}
            />
          </div>
        ))}
      </div>

      <Sheet open={Boolean(activeCard)} onOpenChange={(open) => !open && setActiveId(null)}>
        <SheetContent side="right" overlay className="sql-bi-config-sheet">
          <SheetHeader>
            <SheetTitle>配置图表</SheetTitle>
            <SheetDescription>调整图表字段、聚合、格式与展示方式，预览会即时更新。</SheetDescription>
          </SheetHeader>
          {activeCard ? (
            <div className="sql-bi-config-body">
              <ChartToolbar
                config={activeCard.chartConfig}
                columns={activeCard.snapshot.columns}
                onChange={(next) => updateCard(activeCard.id, (card) => ({ ...card, title: next.title || card.title, description: next.description || card.description, chartConfig: next }))}
              />
              <label className="sql-chart-control is-full">
                <span>说明</span>
                <textarea value={activeCard.chartConfig.description ?? activeCard.description} onChange={(event) => updateCard(activeCard.id, (card) => ({ ...card, description: event.target.value, chartConfig: { ...card.chartConfig, description: event.target.value } }))} />
              </label>
              <div className="sql-bi-config-preview">
                <ChartCanvas rows={activeCard.snapshot.rows} columns={activeCard.snapshot.columns} config={activeCard.chartConfig} />
              </div>
              <div className="sql-bi-config-footer">
                {activeCard.persisted ? (
                  <button type="button" className="is-primary" onClick={() => persistCard(activeCard)}><Save size={14} /> 保存配置</button>
                ) : (
                  <button type="button" className="is-primary" onClick={() => saveCard(activeCard)}><CopyPlus size={14} /> 加入卡片库</button>
                )}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  )
}

function WorkbenchChartCard({
  card,
  theme,
  editingLayout,
  onConfigure,
  onSave,
  onPersist,
  onRefresh,
  onRemove,
  onResize,
}: {
  card: WorkbenchCard
  theme: ResolvedChartTheme
  editingLayout: boolean
  onConfigure: () => void
  onSave: () => void
  onPersist: () => void
  onRefresh: () => void
  onRemove: () => void
  onResize: (patch: Partial<BiCardLayout>) => void
}) {
  const chartRef = useRef<ECharts | null>(null)
  const visualTheme = resolveWorkbenchTheme(card.chartConfig.theme ?? theme)
  const downloadPng = useCallback(() => {
    const chart = chartRef.current
    if (!chart) return
    const url = chart.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: CHART_BACKGROUNDS[visualTheme] })
    const link = document.createElement("a")
    link.href = url
    link.download = `sql-bi-card-${Date.now()}.png`
    link.click()
  }, [visualTheme])

  return (
    <article className={cn("sql-bi-card", `is-${visualTheme}`, !card.persisted && "is-draft")}>
      {editingLayout ? (
        <div className="sql-bi-layout-tools">
          <GripVertical size={14} />
          <button type="button" onClick={() => onResize({ w: Math.max(3, card.layout.w - 3) })}>窄</button>
          <button type="button" onClick={() => onResize({ w: Math.min(12, card.layout.w + 3) })}>宽</button>
          <button type="button" onClick={() => onResize({ h: Math.max(2, card.layout.h - 1) })}>低</button>
          <button type="button" onClick={() => onResize({ h: Math.min(8, card.layout.h + 1) })}>高</button>
        </div>
      ) : null}
      <header className="sql-bi-card-head">
        <div>
          <strong>{card.chartConfig.title || card.title}</strong>
          <small>{card.chartConfig.description || card.description || (card.persisted ? "已保存卡片" : "当前结果草稿")}</small>
        </div>
        <div className="sql-chart-card-actions">
          {!card.persisted ? <button type="button" title="加入卡片库" onClick={onSave}><CopyPlus size={13} /></button> : null}
          {card.persisted ? <button type="button" title="刷新快照" onClick={onRefresh}><RefreshCw size={13} /></button> : null}
          {card.persisted ? <button type="button" title="保存配置" onClick={onPersist}><Save size={13} /></button> : null}
          <button type="button" title="配置" onClick={onConfigure}><Settings2 size={13} /></button>
          <ChartExportMenu onDownloadPng={downloadPng} iconOnly />
          <button type="button" title="删除" onClick={onRemove}><Trash2 size={13} /></button>
        </div>
      </header>
      <div className="sql-bi-card-canvas">
        <ChartCanvas rows={card.snapshot.rows} columns={card.snapshot.columns} config={card.chartConfig} onReady={(chart) => { chartRef.current = chart }} />
      </div>
      <footer className="sql-bi-card-foot">
        <span>{card.snapshot.rowCount} 行快照{card.snapshot.truncated ? " · 已截断" : ""}</span>
        {!card.persisted ? <em>未保存</em> : <em>{card.updatedAt ? new Date(card.updatedAt).toLocaleString("zh-CN") : "已保存"}</em>}
      </footer>
    </article>
  )
}
