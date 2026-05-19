"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Columns3 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SqlColumnInfo } from "@/lib/sql-lab/types"

export type ColumnTableNodeData = {
  label: string
  schema: string
  columns: SqlColumnInfo[]
  active?: boolean
  tone?: string
}

export function ColumnTableNode({ data, selected }: NodeProps) {
  const d = data as unknown as ColumnTableNodeData
  return (
    <div className={cn("sql-rel-node sql-rel-column-node", `is-${d.tone ?? "sky"}`, d.active && "is-active-table", selected && "is-selected")}>
      <Handle type="target" position={Position.Left} />
      <div className="sql-rel-table-head">
        <span className="sql-rel-node-icon"><Columns3 size={15} /></span>
        <div>
          <strong>{d.label}</strong>
          <small>{d.schema} · 字段视图</small>
        </div>
      </div>
      <ul>
        {d.columns.slice(0, 18).map((column) => (
          <li key={column.name}>
            <span>{column.name}</span>
            <em>{column.isPrimaryKey ? "PK" : column.isForeignKey ? "FK" : column.dataType}</em>
          </li>
        ))}
      </ul>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
