"use client"

import { ArrowLeft, Search, Sparkles } from "lucide-react"

export type RelationLayer = "modules" | "tables" | "columns"

type Props = {
  layer: RelationLayer
  query: string
  onQueryChange: (value: string) => void
  onBack: () => void
  onUseSelected: () => void
  selectedCount: number
}

export function RelationsToolbar({ layer, query, onQueryChange, onBack, onUseSelected, selectedCount }: Props) {
  return (
    <header className="sql-rel-toolbar">
      <div className="sql-rel-title">
        <strong>SQL 关系图</strong>
        <span>{layer === "modules" ? "模块全景" : layer === "tables" ? "模块内表" : "字段视图"}</span>
      </div>
      <label className="sql-rel-search">
        <Search size={14} />
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索表、字段或模块" />
      </label>
      {layer !== "modules" ? (
        <button type="button" onClick={onBack}>
          <ArrowLeft size={14} /> 返回
        </button>
      ) : null}
      <button type="button" onClick={onUseSelected} disabled={!selectedCount}>
        <Sparkles size={14} /> 用这些表分析 {selectedCount ? `(${selectedCount})` : ""}
      </button>
    </header>
  )
}
