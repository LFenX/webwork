"use client"

import { useMemo, useState } from "react"
import {
  Bot,
  BriefcaseBusiness,
  ChevronRight,
  Database,
  FileText,
  FolderOpen,
  Lock,
  MessageSquare,
  Search,
  Shield,
  Sparkles,
  Table2,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { SqlSchema, SqlTableInfo } from "@/lib/sql-lab/types"

type Props = {
  schema: SqlSchema | null
  selectedTable?: string | null
  onSelectTable: (table: SqlTableInfo) => void
  onInsertTable: (qualifiedName: string) => void
  onOpenRelations: () => void
}

type ModuleGroup = {
  id: string
  name: string
  description: string
  rowCount: number
  countedTables: number
  tables: SqlTableInfo[]
}

function moduleIcon(moduleId: string) {
  if (/content/.test(moduleId)) return <FileText size={15} />
  if (/social|roundtable/.test(moduleId)) return <MessageSquare size={15} />
  if (/career/.test(moduleId)) return <BriefcaseBusiness size={15} />
  if (/ai|memory/.test(moduleId)) return <Bot size={15} />
  if (/community|media/.test(moduleId)) return <Users size={15} />
  if (/account|admin/.test(moduleId)) return <Shield size={15} />
  if (/private/.test(moduleId)) return <FolderOpen size={15} />
  return <Database size={15} />
}

function moduleTone(moduleId: string) {
  if (/content|community|media/.test(moduleId)) return "is-sky"
  if (/career|private/.test(moduleId)) return "is-emerald"
  if (/social|announcement|roundtable/.test(moduleId)) return "is-amber"
  if (/ai|memory/.test(moduleId)) return "is-violet"
  if (/account|admin/.test(moduleId)) return "is-rose"
  return "is-cyan"
}

function qualifiedName(table: SqlTableInfo) {
  return `${table.schema}.${table.name}`
}

function compactRowCount(value: number) {
  if (value >= 1_000_000_000) {
    const compact = value / 1_000_000_000
    return `${compact >= 10 ? compact.toFixed(0) : compact.toFixed(1)}B`
  }
  if (value >= 1_000_000) {
    const compact = value / 1_000_000
    return `${compact >= 10 ? compact.toFixed(0) : compact.toFixed(1)}M`
  }
  if (value >= 10_000) {
    const compact = value / 10_000
    return `${compact >= 10 ? compact.toFixed(0) : compact.toFixed(1)}万`
  }
  return value.toLocaleString("zh-CN")
}

export function DataCatalogRail({ schema, selectedTable, onSelectTable, onInsertTable, onOpenRelations }: Props) {
  const [query, setQuery] = useState("")
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null)
  const groups = useMemo<ModuleGroup[]>(() => {
    const tables = schema?.schemas.flatMap((item) => item.tables) ?? []
    const q = query.trim().toLowerCase()
    const filtered = q
      ? tables.filter((table) => {
          const catalog = table.catalog
          return [
            table.name,
            table.schema,
            catalog?.moduleName,
            catalog?.submoduleName,
            catalog?.description,
            ...(catalog?.aliases ?? []),
            ...(catalog?.keywords ?? []),
            ...table.columns.map((column) => column.name),
          ].some((value) => value?.toLowerCase().includes(q))
        })
      : tables

    const byModule = new Map<string, ModuleGroup>()
    for (const table of filtered) {
      const id = table.catalog?.moduleId ?? (table.scope === "private" ? "private" : "sql_lab")
      const current = byModule.get(id)
      const rowCount = typeof table.rowCountEstimate === "number" ? table.rowCountEstimate : 0
      const counted = typeof table.rowCountEstimate === "number" ? 1 : 0
      if (current) {
        current.tables.push(table)
        current.rowCount += rowCount
        current.countedTables += counted
      } else {
        byModule.set(id, {
          id,
          name: table.catalog?.moduleName ?? (table.scope === "private" ? "Private" : "SQL Lab"),
          description: table.catalog?.submoduleName ?? "可分析数据表",
          rowCount,
          countedTables: counted,
          tables: [table],
        })
      }
    }
    return [...byModule.values()].sort((a, b) => b.tables.length - a.tables.length || a.name.localeCompare(b.name))
  }, [query, schema])

  const totalTables = schema?.schemas.reduce((sum, item) => sum + item.tables.length, 0) ?? 0
  const privateTables = schema?.schemas.find((item) => item.scope === "private")?.tables.length ?? 0
  const activeModuleId = expandedModuleId

  return (
    <aside className="sql-lab-data-rail">
      <div className="sql-lab-rail-head">
        <div>
          <p className="sql-lab-kicker">数据目录</p>
          <h2>业务模块</h2>
        </div>
        <span className="sql-lab-count-pill">{totalTables}</span>
      </div>

      <label className="sql-lab-rail-search">
        <Search size={15} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索表、字段、用途"
        />
      </label>

      <div className="sql-lab-module-list">
        {groups.length ? groups.map((group) => (
          <section key={group.id} className={cn("sql-lab-module-group", moduleTone(group.id), activeModuleId === group.id && "is-expanded")}>
            <button
              type="button"
              className="sql-lab-module-title"
              onClick={() => setExpandedModuleId(activeModuleId === group.id ? null : group.id)}
              onDoubleClick={onOpenRelations}
            >
              <span className="sql-lab-module-icon">{moduleIcon(group.id)}</span>
              <span className="min-w-0 flex-1">
                <strong>{group.name}</strong>
                <small>{group.description}</small>
                <span className="sql-lab-module-metrics">
                  <em>{group.tables.length} 张表</em>
                  <em>{compactRowCount(group.rowCount)} 行</em>
                  {group.countedTables < group.tables.length ? <em>部分估算</em> : null}
                </span>
              </span>
              <span className="sql-lab-module-access">可访问</span>
              <ChevronRight size={14} className="sql-lab-module-chevron" />
            </button>

            <div className="sql-lab-module-tags">
              {group.tables.slice(0, 3).map((table) => <span key={`${group.id}-${table.name}`}>{table.name}</span>)}
              {group.tables.length > 3 ? <span>+{group.tables.length - 3}</span> : null}
            </div>

            {activeModuleId === group.id ? (
              <div className="sql-lab-table-list">
              {group.tables.slice(0, 4).map((table) => {
                const id = qualifiedName(table)
                const active = selectedTable === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectTable(table)}
                    onDoubleClick={() => onInsertTable(id)}
                    className={cn("sql-lab-table-chip", active && "is-active")}
                  >
                    <Table2 size={13} />
                    <span className="min-w-0 flex-1 truncate">{table.name}</span>
                    <span className={cn("sql-lab-access-dot", table.access === "write" ? "is-write" : table.access === "read" ? "is-read" : "is-none")}>
                      {table.access === "write" ? "写" : table.access === "read" ? "读" : <Lock size={10} />}
                    </span>
                  </button>
                )
              })}
              {group.tables.length > 4 ? (
                <button type="button" className="sql-lab-module-more" onClick={onOpenRelations}>
                  查看 {group.tables.length - 4} 张更多表和关系
                </button>
              ) : null}
              </div>
            ) : null}
          </section>
        )) : (
          <div className="sql-lab-empty-mini">
            <Sparkles size={18} />
            <span>{schema ? "没有匹配的数据表" : "正在读取数据目录"}</span>
          </div>
        )}
      </div>

      <div className="sql-lab-rail-foot">
        <button type="button" onClick={onOpenRelations}>
          <Database size={14} />
          数据字典
        </button>
        <span>已同步 · {privateTables} 张 Private</span>
      </div>
    </aside>
  )
}
