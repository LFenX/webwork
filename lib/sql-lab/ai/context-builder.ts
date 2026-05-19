import "server-only"

import { prisma } from "@/lib/db"
import { selectFewShots } from "@/lib/sql-lab/ai/few-shot-bank"
import { getPinnedInsightMemories, getThreadResultFacts } from "@/lib/sql-lab/ai/result-memory"
import { renderSchemaPrompt, type SchemaProfileRecord } from "@/lib/sql-lab/ai/schema-renderer"
import { readForeignKeyGraph } from "@/lib/sql-lab/fk-graph"
import { catalogKey, selectedTableDetails } from "@/lib/sql-lab/table-catalog"
import type { SqlSchema, SqlTableInfo, SqlThreadCandidateTable } from "@/lib/sql-lab/types"

function allTables(schema: SqlSchema) {
  return schema.schemas.flatMap((item) => item.tables)
}

async function readProfiles(tables: SqlTableInfo[]) {
  if (!tables.length) return []
  const conditions = tables.map((table) => ({ schemaName: table.schema, tableName: table.name }))
  const schemaNames = [...new Set(conditions.map((item) => item.schemaName))]
  const tableNames = [...new Set(conditions.map((item) => item.tableName))]
  return prisma.$queryRaw<SchemaProfileRecord[]>`
    SELECT "schemaName", "tableName", "columnName", "profileJson"
    FROM "SqlSchemaProfile"
    WHERE "schemaName" = ANY(${schemaNames})
      AND "tableName" = ANY(${tableNames})
      AND "expiresAt" > now()
  `.catch(() => [])
}

export function expandSelectedWithFk(schema: SqlSchema, selected: SqlThreadCandidateTable[], fkEdges: Awaited<ReturnType<typeof readForeignKeyGraph>>) {
  const visible = new Map(allTables(schema).map((table) => [catalogKey(table.schema, table.name), table]))
  const byKey = new Map(selected.map((item) => [catalogKey(item.schema, item.table), item]))
  const primary = selected.find((item) => item.role === "primary") ?? selected[0]
  if (!primary) return selected
  for (const edge of fkEdges) {
    const touchesPrimary =
      catalogKey(edge.from.schema, edge.from.table) === catalogKey(primary.schema, primary.table) ||
      catalogKey(edge.to.schema, edge.to.table) === catalogKey(primary.schema, primary.table)
    if (!touchesPrimary) continue
    const neighbor = catalogKey(edge.from.schema, edge.from.table) === catalogKey(primary.schema, primary.table)
      ? edge.to
      : edge.from
    const key = catalogKey(neighbor.schema, neighbor.table)
    if (!visible.has(key) || byKey.has(key)) continue
    byKey.set(key, {
      schema: neighbor.schema,
      table: neighbor.table,
      role: "join",
      reason: `真实 FK 1-hop 邻居：${edge.from.table}.${edge.from.column} → ${edge.to.table}.${edge.to.column}`,
    })
  }
  return [...byKey.values()].slice(0, 8)
}

export async function buildSqlAiContext(input: {
  userId: string
  threadId: string
  prompt: string
  schema: SqlSchema
  selected: SqlThreadCandidateTable[]
}) {
  const schemaNames = input.schema.schemas.map((item) => item.name)
  const fkEdges = await readForeignKeyGraph(schemaNames)
  const selected = expandSelectedWithFk(input.schema, input.selected, fkEdges)
  const tables = selectedTableDetails(input.schema, selected)
  const [profiles, fewShots, resultFacts, pinnedMemories] = await Promise.all([
    readProfiles(tables),
    selectFewShots({ userId: input.userId, prompt: input.prompt, limit: 3 }),
    getThreadResultFacts(input.userId, input.threadId, 3),
    getPinnedInsightMemories(input.userId, 5),
  ])
  return {
    selected,
    tables,
    fkEdges,
    promptMarkdown: renderSchemaPrompt({
      schema: input.schema,
      selected,
      tables,
      profiles,
      fkEdges,
      fewShots,
      resultFacts,
      pinnedMemories,
    }),
  }
}
