"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Table2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SqlAccessLevel } from "@/lib/sql-lab/types"

export type TableNodeData = {
  label: string
  schema: string
  access: SqlAccessLevel
  scope: "public" | "private"
  description: string
  fields: string[]
  rowCountEstimate?: number | null
  tone?: string
}

export function TableNode({ data, selected }: NodeProps) {
  const d = data as unknown as TableNodeData
  return (
    <div className={cn("sql-rel-node sql-rel-table-node", `is-${d.tone ?? "sky"}`, selected && "is-selected")}>
      <Handle type="target" position={Position.Left} />
      <div className="sql-rel-table-head">
        <span className="sql-rel-node-icon"><Table2 size={15} /></span>
        <div>
          <strong>{d.label}</strong>
          <small>{d.schema} · {d.access === "write" ? "可写" : d.access === "read" ? "只读" : "不可用"} · {d.rowCountEstimate ?? 0} 行</small>
        </div>
      </div>
      <ul>
        {d.fields.slice(0, 5).map((field) => <li key={field}>{field}</li>)}
      </ul>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
