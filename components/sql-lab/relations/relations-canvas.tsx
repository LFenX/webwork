"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import ELK from "elkjs/lib/elk.bundled.js"
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  SelectionMode,
  addEdge,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type OnSelectionChangeParams,
} from "@xyflow/react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import { ModuleNode } from "@/components/sql-lab/relations/module-node"
import { TableNode } from "@/components/sql-lab/relations/table-node"
import { ColumnTableNode } from "@/components/sql-lab/relations/column-table-node"
import { RelationEdge } from "@/components/sql-lab/relations/relation-edge"
import { RelationsFilters } from "@/components/sql-lab/relations/relations-filters"
import { RelationsSidePanel } from "@/components/sql-lab/relations/relations-side-panel"
import { RelationsToolbar, type RelationLayer } from "@/components/sql-lab/relations/relations-toolbar"
import type { SqlRelationGraphV2, SqlRelationGraphV2Table } from "@/lib/sql-lab/types"

type RelationNode = Node<Record<string, unknown>>
type RelationEdgeModel = Edge<Record<string, unknown>>

const elk = new ELK()
const nodeTypes = { module: ModuleNode, table: TableNode, columnTable: ColumnTableNode }
const edgeTypes = { relation: RelationEdge }

function tableNodeId(table: SqlRelationGraphV2Table) {
  return `table:${table.schema}.${table.table}`
}

function toneForModule(moduleId: string) {
  if (/career|private/.test(moduleId)) return "emerald"
  if (/social|announcement|roundtable/.test(moduleId)) return "amber"
  if (/ai|memory/.test(moduleId)) return "violet"
  if (/account|admin/.test(moduleId)) return "rose"
  if (/community|content|media/.test(moduleId)) return "sky"
  return "cyan"
}

async function layoutGraph(nodes: RelationNode[], edges: RelationEdgeModel[], direction = "RIGHT") {
  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": direction,
      "elk.spacing.nodeNode": "38",
      "elk.layered.spacing.nodeNodeBetweenLayers": "80",
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: node.width ?? (node.type === "module" ? 260 : node.type === "columnTable" ? 320 : 280),
      height: node.height ?? (node.type === "module" ? 92 : node.type === "columnTable" ? 360 : 210),
    })),
    edges: edges.map((edge) => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
  }
  const result = await elk.layout(graph)
  return nodes.map((node) => {
    const laid = result.children?.find((child) => child.id === node.id)
    return { ...node, position: { x: laid?.x ?? 0, y: laid?.y ?? 0 } }
  })
}

function filterText(table: SqlRelationGraphV2Table) {
  return [
    table.schema,
    table.table,
    table.moduleName,
    table.submoduleName,
    table.description,
    ...table.columns.map((column) => column.name),
  ].join(" ").toLowerCase()
}

export function RelationsCanvas() {
  const searchParams = useSearchParams()
  const focus = searchParams.get("focus")
  const [graph, setGraph] = useState<SqlRelationGraphV2 | null>(null)
  const [loading, setLoading] = useState(true)
  const [layer, setLayer] = useState<RelationLayer>("modules")
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null)
  const [activeTableId, setActiveTableId] = useState<string | null>(focus)
  const [query, setQuery] = useState("")
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([])
  const [nodes, setNodes, onNodesChange] = useNodesState<RelationNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<RelationEdgeModel>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await apiFetch<SqlRelationGraphV2>("/api/sql/relations")
        if (cancelled) return
        setGraph(data)
        if (focus) {
          const target = data.tables.find((table) => `${table.schema}.${table.table}` === focus)
          if (target) {
            setActiveModuleId(target.moduleId)
            setActiveTableId(target.id)
            setLayer("columns")
          }
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "关系图加载失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [focus])

  const activeTable = useMemo(
    () => graph?.tables.find((table) => table.id === activeTableId || `${table.schema}.${table.table}` === activeTableId) ?? null,
    [activeTableId, graph?.tables],
  )
  const selectedTables = useMemo(
    () => graph?.tables.filter((table) => selectedTableIds.includes(tableNodeId(table))) ?? [],
    [graph?.tables, selectedTableIds],
  )

  const buildFlow = useCallback(() => {
    if (!graph) return { nodes: [], edges: [] }
    const q = query.trim().toLowerCase()

    if (layer === "modules") {
      const moduleNodes: RelationNode[] = graph.modules
        .filter((module) => !q || `${module.name} ${module.description}`.toLowerCase().includes(q))
        .map((module) => ({
          id: `module:${module.id}`,
          type: "module",
          data: { label: module.name, description: module.description, tableCount: module.tableCount, tone: module.tone },
          position: { x: 0, y: 0 },
        }))
      const moduleNodeIds = new Set(moduleNodes.map((node) => node.id))
      const moduleEdges: RelationEdgeModel[] = graph.moduleEdges
        .map((edge) => ({
          id: edge.id,
          source: `module:${edge.source}`,
          target: `module:${edge.target}`,
          type: "relation",
          label: String(edge.count),
          animated: false,
        }))
        .filter((edge) => moduleNodeIds.has(edge.source) && moduleNodeIds.has(edge.target))
      return { nodes: moduleNodes, edges: moduleEdges }
    }

    const baseTables = graph.tables.filter((table) => {
      if (layer === "tables") {
        if (activeModuleId && table.moduleId !== activeModuleId) return false
        if (!activeModuleId && query.trim()) return filterText(table).includes(q)
        return activeModuleId ? true : filterText(table).includes(q)
      }
      if (!activeTable) return false
      const neighbors = new Set<string>([activeTable.id])
      for (const edge of graph.fkEdges) {
        const fromId = `${edge.from.schema}.${edge.from.table}`
        const toId = `${edge.to.schema}.${edge.to.table}`
        if (fromId === activeTable.id) neighbors.add(toId)
        if (toId === activeTable.id) neighbors.add(fromId)
      }
      return neighbors.has(table.id) && (!q || filterText(table).includes(q))
    })

    const tableNodes: RelationNode[] = baseTables.map((table) => ({
      id: tableNodeId(table),
      type: layer === "columns" ? "columnTable" : "table",
      data: layer === "columns"
        ? { label: table.table, schema: table.schema, columns: table.columns, active: table.id === activeTable?.id, tone: toneForModule(table.moduleId) }
        : { label: table.table, schema: table.schema, access: table.access, scope: table.scope, description: table.description, fields: table.columns.map((column) => column.name), rowCountEstimate: table.rowCountEstimate, tone: toneForModule(table.moduleId) },
      position: { x: 0, y: 0 },
    }))
    const nodeIds = new Set(tableNodes.map((node) => node.id))
    const tableEdges: RelationEdgeModel[] = graph.fkEdges
      .map((edge) => ({
        id: edge.id,
        source: `table:${edge.from.schema}.${edge.from.table}`,
        target: `table:${edge.to.schema}.${edge.to.table}`,
        type: "relation",
        label: `${edge.from.column} → ${edge.to.column}`,
        animated: false,
      }))
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    return { nodes: tableNodes, edges: tableEdges }
  }, [activeModuleId, activeTable, graph, layer, query])

  useEffect(() => {
    const flow = buildFlow()
    let cancelled = false
    layoutGraph(flow.nodes, flow.edges).then((laidNodes) => {
      if (cancelled) return
      setNodes(laidNodes)
      setEdges(flow.edges)
    })
    return () => {
      cancelled = true
    }
  }, [buildFlow, setEdges, setNodes])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (layer === "columns") setLayer("tables")
        else if (layer === "tables") setLayer("modules")
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault()
        document.querySelector<HTMLInputElement>(".sql-rel-search input")?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [layer])

  const onNodeDoubleClick = useCallback((_event: unknown, node: Node) => {
    if (node.id.startsWith("module:")) {
      setActiveModuleId(node.id.replace(/^module:/, ""))
      setLayer("tables")
      return
    }
    if (node.id.startsWith("table:")) {
      const id = node.id.replace(/^table:/, "")
      setActiveTableId(id)
      setLayer("columns")
    }
  }, [])

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedTableIds(params.nodes.map((node) => node.id).filter((id) => id.startsWith("table:")))
  }, [])

  const onUseSelected = useCallback(() => {
    const tables = selectedTables.map((table) => `${table.schema}.${table.table}`)
    if (!tables.length) return
    window.location.href = `/sql?tables=${encodeURIComponent(tables.join(","))}`
  }, [selectedTables])

  return (
    <main className="sql-rel-page">
      <RelationsToolbar
        layer={layer}
        query={query}
        onQueryChange={setQuery}
        onBack={() => setLayer(layer === "columns" ? "tables" : "modules")}
        onUseSelected={onUseSelected}
        selectedCount={selectedTables.length}
      />
      <div className="sql-rel-layout">
        <RelationsFilters modules={graph?.modules ?? []} activeModuleId={activeModuleId} onSelectModule={(id) => {
          setActiveModuleId(id)
          setLayer(id ? "tables" : "modules")
        }} />
        <section className="sql-rel-canvas-shell">
          {loading ? (
            <div className="grid h-full min-h-[420px] place-items-center p-6">
              <div className="grid w-full max-w-4xl animate-pulse gap-5 md:grid-cols-3" aria-busy="true">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="rounded-[18px] border border-slate-200 bg-white/90 p-4 shadow-sm">
                    <div className="h-4 w-24 rounded-full bg-slate-100" />
                    <div className="mt-4 space-y-2">
                      <div className="h-3 rounded-full bg-slate-100" />
                      <div className="h-3 w-4/5 rounded-full bg-slate-100" />
                      <div className="h-3 w-3/5 rounded-full bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={(connection) => setEdges((eds) => addEdge(connection, eds))}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodeDoubleClick={onNodeDoubleClick}
              onSelectionChange={onSelectionChange}
              fitView
              minZoom={0.2}
              maxZoom={2.5}
              onlyRenderVisibleElements
              selectionOnDrag
              selectionMode={SelectionMode.Partial}
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls />
              <MiniMap pannable zoomable />
            </ReactFlow>
          )}
        </section>
        <RelationsSidePanel graph={graph} layer={layer} activeTable={activeTable} selectedTables={selectedTables} />
      </div>
    </main>
  )
}
