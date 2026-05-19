"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Boxes } from "lucide-react"
import { cn } from "@/lib/utils"

export type ModuleNodeData = {
  label: string
  description: string
  tableCount: number
  tone?: string
}

export function ModuleNode({ data, selected }: NodeProps) {
  const d = data as unknown as ModuleNodeData
  return (
    <div className={cn("sql-rel-node sql-rel-module-node", `is-${d.tone ?? "sky"}`, selected && "is-selected")}>
      <Handle type="target" position={Position.Left} />
      <span className="sql-rel-node-icon"><Boxes size={16} /></span>
      <div>
        <strong>{d.label}</strong>
        <small>{d.description || `${d.tableCount} 张表`}</small>
      </div>
      <em>{d.tableCount}</em>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
