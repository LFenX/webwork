"use client"

import { Database, GitBranch, Table2 } from "lucide-react"
import type { RelationLayer } from "@/components/sql-lab/relations/relations-toolbar"
import type { SqlRelationGraphV2, SqlRelationGraphV2Table } from "@/lib/sql-lab/types"

type Props = {
  graph: SqlRelationGraphV2 | null
  layer: RelationLayer
  activeTable?: SqlRelationGraphV2Table | null
  selectedTables: SqlRelationGraphV2Table[]
}

export function RelationsSidePanel({ graph, layer, activeTable, selectedTables }: Props) {
  return (
    <aside className="sql-rel-side-panel">
      <section>
        <h2><Database size={15} /> 图谱状态</h2>
        <p>{graph?.modules.length ?? 0} 个模块</p>
        <p>{graph?.tables.length ?? 0} 张表</p>
        <p>{graph?.fkEdges.length ?? 0} 条真实 FK</p>
      </section>
      <section>
        <h2><GitBranch size={15} /> 当前层级</h2>
        <p>{layer === "modules" ? "L1 模块全景" : layer === "tables" ? "L2 模块内表" : "L3 单表字段"}</p>
        <small>双击节点进入下一层，ESC 返回上一层。</small>
      </section>
      {activeTable ? (
        <section>
          <h2><Table2 size={15} /> {activeTable.table}</h2>
          <p>{activeTable.description}</p>
          <small>{activeTable.schema} · {activeTable.access} · {activeTable.columns.length} 字段</small>
        </section>
      ) : null}
      {selectedTables.length ? (
        <section>
          <h2>已选表</h2>
          {selectedTables.map((table) => <p key={table.id}>{table.schema}.{table.table}</p>)}
        </section>
      ) : null}
    </aside>
  )
}
