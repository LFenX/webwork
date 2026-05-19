"use client"

import type { SqlRelationGraphV2Module } from "@/lib/sql-lab/types"
import { cn } from "@/lib/utils"

type Props = {
  modules: SqlRelationGraphV2Module[]
  activeModuleId?: string | null
  onSelectModule: (moduleId: string | null) => void
}

export function RelationsFilters({ modules, activeModuleId, onSelectModule }: Props) {
  return (
    <div className="sql-rel-filters">
      <button type="button" className={cn(!activeModuleId && "is-active")} onClick={() => onSelectModule(null)}>全部模块</button>
      {modules.map((module) => (
        <button
          key={module.id}
          type="button"
          className={cn(activeModuleId === module.id && "is-active")}
          onClick={() => onSelectModule(module.id)}
        >
          {module.name}<em>{module.tableCount}</em>
        </button>
      ))}
    </div>
  )
}
