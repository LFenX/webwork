import "server-only"

import { prisma } from "@/lib/db"
import type { SqlRelationGraphV2FkEdge } from "@/lib/sql-lab/types"

type FkRow = {
  fromSchema: string
  fromTable: string
  fromColumn: string
  toSchema: string
  toTable: string
  toColumn: string
  onDelete: string
}

const CACHE_TTL_MS = 60 * 60 * 1000
const g = globalThis as unknown as {
  sqlLabFkGraphCache?: Map<string, { expiresAt: number; edges: SqlRelationGraphV2FkEdge[] }>
}

function cache() {
  if (!g.sqlLabFkGraphCache) g.sqlLabFkGraphCache = new Map()
  return g.sqlLabFkGraphCache
}

function cacheKey(schemas: string[]) {
  return schemas.slice().sort().join("|")
}

export async function readForeignKeyGraph(schemas: string[] = ["public"]): Promise<SqlRelationGraphV2FkEdge[]> {
  const key = cacheKey(schemas)
  const current = cache().get(key)
  if (current && current.expiresAt > Date.now()) return current.edges

  const rows = await prisma.$queryRaw<FkRow[]>`
    SELECT
      kcu.table_schema AS "fromSchema",
      kcu.table_name AS "fromTable",
      kcu.column_name AS "fromColumn",
      ccu.table_schema AS "toSchema",
      ccu.table_name AS "toTable",
      ccu.column_name AS "toColumn",
      rc.delete_rule AS "onDelete"
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
     AND kcu.constraint_schema = tc.constraint_schema
     AND kcu.table_schema = tc.table_schema
     AND kcu.table_name = tc.table_name
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
     AND rc.constraint_schema = tc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = rc.unique_constraint_name
     AND ccu.constraint_schema = rc.unique_constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND kcu.table_schema = ANY(${schemas})
    ORDER BY kcu.table_schema, kcu.table_name, kcu.ordinal_position
  `

  const edges = rows.map((row) => ({
    id: `fk:${row.fromSchema}.${row.fromTable}.${row.fromColumn}->${row.toSchema}.${row.toTable}.${row.toColumn}`,
    from: { schema: row.fromSchema, table: row.fromTable, column: row.fromColumn },
    to: { schema: row.toSchema, table: row.toTable, column: row.toColumn },
    onDelete: row.onDelete,
  }))
  cache().set(key, { expiresAt: Date.now() + CACHE_TTL_MS, edges })
  return edges
}
