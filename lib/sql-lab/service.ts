import "server-only"

import crypto from "node:crypto"
import { Pool } from "pg"
import { prisma } from "@/lib/db"
import { getCurrentAdmin } from "@/lib/admin"
import { applyCatalogToTables, type SqlTableCatalogOverrideInput } from "@/lib/sql-lab/table-catalog"
import type {
  SqlAccessLevel,
  SqlAuditEntry,
  SqlExample,
  SqlGrant,
  SqlGrantSummary,
  SqlGrantTable,
  SqlHistoryItem,
  SqlRunRequest,
  SqlRunResult,
  SqlSchema,
  SqlTableInfo,
  SqlValidateRequest,
  SqlValidateResult,
} from "@/lib/sql-lab/types"

type PgFieldInfo = {
  name: string
  dataTypeID?: number
}

type DbUser = {
  id: string
  email: string
  displayName: string
  role: string
}

type GrantRow = {
  id: string
  userId: string
  enabled: boolean
  defaultLimit: number
  maxLimit: number
  defaultTimeoutMs: number
  updatedAt: Date
}

type TableGrantRow = {
  schemaName: string
  tableName: string
  access: SqlAccessLevel
  blockedColumns: string[]
  rowFilter: string | null
  updatedAt: Date
}

type ColumnRow = {
  tableSchema: string
  tableName: string
  columnName: string
  dataType: string
  isNullable: string
  ordinalPosition: number
}

type PrivateTableMetaRow = {
  tableName: string
  folderId: string | null
  folderName: string | null
  description: string
}

type CatalogOverrideRow = Required<Pick<SqlTableCatalogOverrideInput, "schemaName" | "tableName">> &
  Omit<SqlTableCatalogOverrideInput, "schemaName" | "tableName">

type SqlAnalysis = {
  normalizedSql: string
  command: "select" | "with" | "explain" | "insert" | "update" | "delete" | "create" | "alter" | "drop" | "truncate"
  readOnly: boolean
  touchedTables: string[]
  isDdl: boolean
}

class SqlLabError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public hint?: string
  ) {
    super(message)
  }
}

const PUBLIC_SCHEMA = "public"
const PRIVATE_SCHEMA_PREFIX = "sqllab_private_"
const NO_STORE = { "Cache-Control": "no-store" } as const
const MAX_SQL_PREVIEW = 2000
const DEFAULT_GRANT = {
  enabled: false,
  defaultLimit: 1000,
  maxLimit: 50000,
  defaultTimeoutMs: 15000,
}
const SQL_KEYWORDS = new Set(
  [
    "all",
    "and",
    "as",
    "asc",
    "between",
    "by",
    "case",
    "delete",
    "desc",
    "distinct",
    "else",
    "end",
    "exists",
    "explain",
    "false",
    "from",
    "full",
    "group",
    "having",
    "ilike",
    "in",
    "inner",
    "insert",
    "into",
    "is",
    "join",
    "left",
    "like",
    "limit",
    "not",
    "null",
    "offset",
    "on",
    "or",
    "order",
    "outer",
    "returning",
    "right",
    "select",
    "set",
    "then",
    "true",
    "union",
    "update",
    "values",
    "when",
    "where",
    "with",
  ].map((x) => x.toLowerCase())
)

const g = globalThis as unknown as { sqlLabPool?: Pool; sqlLabConnectionString?: string }

function getPool() {
  const connectionString = process.env.SQL_LAB_DATABASE_URL || process.env.DATABASE_URL
  if (!connectionString) throw new SqlLabError("DATABASE_NOT_CONFIGURED", "DATABASE_URL is not configured", 500)
  if (!g.sqlLabPool || g.sqlLabConnectionString !== connectionString) {
    g.sqlLabPool = new Pool({
      connectionString,
      max: Number(process.env.SQL_LAB_POOL_SIZE || 4),
      idleTimeoutMillis: 30_000,
    })
    g.sqlLabConnectionString = connectionString
  }
  return g.sqlLabPool
}

function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return new Date(0).toISOString()
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function quoteIdent(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

function qualifiedName(schema: string, table: string) {
  return `${schema}.${table}`
}

function splitTableParam(value: string) {
  const decoded = decodeURIComponent(value)
  const parts = decoded.includes(".") ? decoded.split(".") : [PUBLIC_SCHEMA, decoded]
  return { schema: parts[0] || PUBLIC_SCHEMA, table: parts.slice(1).join(".") || decoded }
}

function privateSchemaName(userId: string) {
  return `${PRIVATE_SCHEMA_PREFIX}${userId.toLowerCase().replace(/[^a-z0-9_]/g, "_")}`
}

function assertIdentifier(value: string, label: string) {
  const trimmed = value.trim()
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(trimmed)) {
    throw new SqlLabError("INVALID_IDENTIFIER", `${label} must start with a letter or underscore and contain only letters, numbers, and underscores`)
  }
  return trimmed
}

async function ensurePrivateSchema(userId: string) {
  const schema = privateSchemaName(userId)
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schema)}`)
  return schema
}

async function getUser(userId: string): Promise<DbUser | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true, role: true },
  })
}

async function readGrant(userId: string) {
  const grants = await prisma.$queryRaw<GrantRow[]>`
    SELECT id, "userId", enabled, "defaultLimit", "maxLimit", "defaultTimeoutMs", "updatedAt"
    FROM "SqlAccessGrant"
    WHERE "userId" = ${userId}
    LIMIT 1
  `
  const grant = grants[0] ?? null
  const tables = grant
    ? await prisma.$queryRaw<TableGrantRow[]>`
        SELECT "schemaName", "tableName", access, "blockedColumns", "rowFilter", "updatedAt"
        FROM "SqlAccessTableGrant"
        WHERE "grantId" = ${grant.id}
        ORDER BY "schemaName", "tableName"
      `
    : []
  return { grant, tables }
}

async function readColumnsForSchemas(schemas: string[]) {
  return prisma.$queryRaw<ColumnRow[]>`
    SELECT
      table_schema AS "tableSchema",
      table_name AS "tableName",
      column_name AS "columnName",
      data_type AS "dataType",
      is_nullable AS "isNullable",
      ordinal_position AS "ordinalPosition"
    FROM information_schema.columns
    WHERE table_schema = ANY(${schemas})
      AND table_name NOT LIKE '_prisma_%'
    ORDER BY table_schema, table_name, ordinal_position
  `
}

async function readPrivateTableMeta(userId: string, privateSchema: string) {
  const rows = await prisma.$queryRaw<PrivateTableMetaRow[]>`
    SELECT t."tableName", t."folderId", f.name AS "folderName", t.description
    FROM "SqlPrivateTable" t
    LEFT JOIN "SqlPrivateFolder" f ON f.id = t."folderId"
    WHERE t."userId" = ${userId}
      AND t."schemaName" = ${privateSchema}
  `
  return new Map(rows.map((row) => [row.tableName, row]))
}

async function readCatalogOverrides() {
  return prisma.$queryRaw<CatalogOverrideRow[]>`
    SELECT
      "schemaName", "tableName", "moduleId", "moduleName", "submoduleId", "submoduleName",
      description, aliases, keywords, "keyFields", relations, "useCases", notes
    FROM "SqlTableCatalogOverride"
  `
}

async function readExactTableCounts(tables: Array<{ schema: string; name: string }>) {
  const counts = new Map<string, number>()
  const client = await getPool().connect()
  try {
    for (const table of tables) {
      const key = qualifiedName(table.schema, table.name)
      try {
        const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${quoteIdent(table.schema)}.${quoteIdent(table.name)}`)
        counts.set(key, Number(result.rows[0]?.count ?? 0))
      } catch {
        counts.set(key, 0)
      }
    }
  } finally {
    client.release()
  }
  return counts
}

async function readTables(userId?: string) {
  const privateSchema = userId ? await ensurePrivateSchema(userId) : null
  const schemas = privateSchema ? [PUBLIC_SCHEMA, privateSchema] : [PUBLIC_SCHEMA]
  const [columns, privateMeta] = await Promise.all([
    readColumnsForSchemas(schemas),
    privateSchema && userId ? readPrivateTableMeta(userId, privateSchema) : Promise.resolve(new Map<string, PrivateTableMetaRow>()),
  ])
  const grouped = new Map<string, SqlTableInfo>()
  for (const col of columns) {
    const key = qualifiedName(col.tableSchema, col.tableName)
    const privateRow = col.tableSchema === privateSchema ? privateMeta.get(col.tableName) : null
    const table =
      grouped.get(key) ??
      ({
        schema: col.tableSchema,
        name: col.tableName,
        scope: col.tableSchema === privateSchema ? "private" : "public",
        folderId: privateRow?.folderId ?? null,
        folderName: privateRow?.folderName ?? null,
        rowCountEstimate: null,
        access: "none",
        columns: [],
        comment: privateRow?.description || undefined,
      } satisfies SqlTableInfo)
    table.columns.push({
      name: col.columnName,
      dataType: col.dataType,
      nullable: col.isNullable === "YES",
    })
    grouped.set(key, table)
  }
  const tables = [...grouped.values()]
  const counts = await readExactTableCounts(tables.map((table) => ({ schema: table.schema, name: table.name })))
  return tables.map((table) => ({
    ...table,
    rowCountEstimate: counts.get(qualifiedName(table.schema, table.name)) ?? 0,
  }))
}

function grantMap(rows: TableGrantRow[]) {
  return new Map(rows.map((row) => [qualifiedName(row.schemaName, row.tableName), row]))
}

export async function getEffectiveSchema(viewerId: string): Promise<SqlSchema> {
  const [viewer, admin, grantData, allTables, catalogOverrides] = await Promise.all([
    getUser(viewerId),
    getCurrentAdmin(),
    readGrant(viewerId),
    readTables(viewerId),
    readCatalogOverrides(),
  ])
  if (!viewer) throw new SqlLabError("USER_NOT_FOUND", "User not found", 404)

  const isOwner = viewer.role === "owner"
  const canManage = Boolean(admin?.permissions.manageSqlLab)
  const grantsByTable = grantMap(grantData.tables)
  const enabled = isOwner || Boolean(grantData.grant?.enabled)
  const defaultLimit = isOwner ? DEFAULT_GRANT.defaultLimit : grantData.grant?.defaultLimit ?? DEFAULT_GRANT.defaultLimit
  const maxLimit = isOwner ? DEFAULT_GRANT.maxLimit : grantData.grant?.maxLimit ?? DEFAULT_GRANT.maxLimit
  const defaultTimeoutMs = isOwner
    ? DEFAULT_GRANT.defaultTimeoutMs
    : grantData.grant?.defaultTimeoutMs ?? DEFAULT_GRANT.defaultTimeoutMs

  const visibleTables = allTables
    .map((table) => {
      const grant = grantsByTable.get(qualifiedName(table.schema, table.name))
      const isPrivate = table.scope === "private"
      const access: SqlAccessLevel = isPrivate || isOwner ? "write" : enabled ? grant?.access ?? "none" : "none"
      const blocked = new Set(grant?.blockedColumns ?? [])
      return {
        ...table,
        access,
        rowFilterPreview: grant?.rowFilter ?? null,
        columns: table.columns.map((col) => ({
          ...col,
          isMasked: blocked.has(col.name),
        })),
      }
    })
    .filter((table) => table.scope === "private" || isOwner || table.access !== "none")
  const catalogedTables = applyCatalogToTables(visibleTables, catalogOverrides)

  return {
    viewer: {
      userId: viewer.id,
      displayName: viewer.displayName || viewer.email,
      role: viewer.role,
      isOwner,
      canManage,
    },
    enabled,
    defaultLimit,
    maxLimit,
    defaultTimeoutMs,
    dataSource: { name: "primary", engine: "postgres", readOnly: !isOwner },
    schemas: [
      { name: PUBLIC_SCHEMA, label: "Public", scope: "public", tables: catalogedTables.filter((table) => table.scope !== "private") },
      { name: privateSchemaName(viewerId), label: "Private", scope: "private", tables: catalogedTables.filter((table) => table.scope === "private") },
    ],
  }
}

function stripSql(sql: string) {
  let out = ""
  let quote: "'" | '"' | null = null
  let dollarTag: string | null = null
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i]
    const next = sql[i + 1]
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        out += " "
        i += dollarTag.length - 1
        dollarTag = null
      } else {
        out += " "
      }
      continue
    }
    if (quote) {
      if (ch === quote && next === quote) {
        out += "  "
        i += 1
      } else if (ch === quote) {
        out += " "
        quote = null
      } else {
        out += " "
      }
      continue
    }
    if (ch === "-" && next === "-") {
      while (i < sql.length && sql[i] !== "\n") {
        out += " "
        i += 1
      }
      out += "\n"
      continue
    }
    if (ch === "/" && next === "*") {
      out += "  "
      i += 2
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) {
        out += sql[i] === "\n" ? "\n" : " "
        i += 1
      }
      out += "  "
      i += 1
      continue
    }
    if (ch === "$") {
      const m = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*?\$|^\$\$/)
      if (m) {
        dollarTag = m[0]
        out += " ".repeat(m[0].length)
        i += m[0].length - 1
        continue
      }
    }
    if (ch === "'" || ch === '"') {
      quote = ch
      out += " "
      continue
    }
    out += ch
  }
  return out
}

function normalizeSql(sql: string) {
  const trimmed = sql.trim()
  return trimmed.endsWith(";") ? trimmed.slice(0, -1).trim() : trimmed
}

function extractCteNames(stripped: string) {
  const names = new Set<string>()
  const prefix = stripped.match(/^\s*with\s+([\s\S]+?)\bselect\b/i)?.[1] ?? ""
  for (const match of prefix.matchAll(/(?:^|,)\s*("?[\w]+"?)\s+as\s*\(/gi)) {
    names.add(match[1].replace(/"/g, ""))
  }
  return names
}

function extractTableRefs(stripped: string) {
  const refs = new Set<string>()
  const ctes = extractCteNames(stripped)
  const patterns = [
    /\bfrom\s+((?:"[^"]+"|[\w]+)(?:\s*\.\s*(?:"[^"]+"|[\w]+))?)/gi,
    /\bjoin\s+((?:"[^"]+"|[\w]+)(?:\s*\.\s*(?:"[^"]+"|[\w]+))?)/gi,
    /\bupdate\s+((?:"[^"]+"|[\w]+)(?:\s*\.\s*(?:"[^"]+"|[\w]+))?)/gi,
    /\binsert\s+into\s+((?:"[^"]+"|[\w]+)(?:\s*\.\s*(?:"[^"]+"|[\w]+))?)/gi,
    /\bdelete\s+from\s+((?:"[^"]+"|[\w]+)(?:\s*\.\s*(?:"[^"]+"|[\w]+))?)/gi,
    /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?((?:"[^"]+"|[\w]+)(?:\s*\.\s*(?:"[^"]+"|[\w]+))?)/gi,
    /\balter\s+table\s+(?:if\s+exists\s+)?((?:"[^"]+"|[\w]+)(?:\s*\.\s*(?:"[^"]+"|[\w]+))?)/gi,
    /\bdrop\s+table\s+(?:if\s+exists\s+)?((?:"[^"]+"|[\w]+)(?:\s*\.\s*(?:"[^"]+"|[\w]+))?)/gi,
    /\btruncate\s+(?:table\s+)?((?:"[^"]+"|[\w]+)(?:\s*\.\s*(?:"[^"]+"|[\w]+))?)/gi,
  ]
  for (const pattern of patterns) {
    for (const match of stripped.matchAll(pattern)) {
      const raw = match[1].replace(/\s+/g, "").replace(/"/g, "")
      const parts = raw.split(".")
      const schema = parts.length > 1 ? parts[0] : ""
      const table = parts.length > 1 ? parts[1] : parts[0]
      if (!ctes.has(table)) refs.add(schema ? qualifiedName(schema, table) : table)
    }
  }
  return [...refs]
}

function buildIdentifierMap(tables: SqlTableInfo[]) {
  const map = new Map<string, string>()
  map.set(PUBLIC_SCHEMA.toLowerCase(), PUBLIC_SCHEMA)
  for (const table of tables) {
    map.set(table.name.toLowerCase(), table.name)
    for (const column of table.columns) {
      map.set(column.name.toLowerCase(), column.name)
    }
  }
  return map
}

function rewriteIdentifierSegment(segment: string, identifiers: Map<string, string>) {
  return segment.replace(/\b[A-Za-z_][A-Za-z0-9_]*\b/g, (token, offset, src) => {
    const lower = token.toLowerCase()
    if (SQL_KEYWORDS.has(lower)) return token
    const actual = identifiers.get(lower)
    if (!actual) return token
    const prev = src[offset - 1]
    const next = src[offset + token.length]
    if (prev === '"' || next === '"') return token
    return quoteIdent(actual)
  })
}

function rewriteSqlIdentifiers(sql: string, tables: SqlTableInfo[]) {
  const identifiers = buildIdentifierMap(tables)
  let out = ""
  let codeStart = 0
  const flushCode = (end: number) => {
    if (end > codeStart) out += rewriteIdentifierSegment(sql.slice(codeStart, end), identifiers)
  }

  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i]
    const next = sql[i + 1]
    if (ch === "-" && next === "-") {
      flushCode(i)
      let j = i
      while (j < sql.length && sql[j] !== "\n") j += 1
      out += sql.slice(i, j)
      i = j - 1
      codeStart = j
      continue
    }
    if (ch === "/" && next === "*") {
      flushCode(i)
      let j = i + 2
      while (j < sql.length && !(sql[j] === "*" && sql[j + 1] === "/")) j += 1
      j = Math.min(sql.length, j + 2)
      out += sql.slice(i, j)
      i = j - 1
      codeStart = j
      continue
    }
    if (ch === "'" || ch === '"') {
      flushCode(i)
      const quote = ch
      let j = i + 1
      while (j < sql.length) {
        if (sql[j] === quote && sql[j + 1] === quote) {
          j += 2
          continue
        }
        if (sql[j] === quote) {
          j += 1
          break
        }
        j += 1
      }
      out += sql.slice(i, j)
      i = j - 1
      codeStart = j
      continue
    }
    if (ch === "$") {
      const m = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*?\$|^\$\$/)
      if (m) {
        flushCode(i)
        const tag = m[0]
        const end = sql.indexOf(tag, i + tag.length)
        const j = end >= 0 ? end + tag.length : sql.length
        out += sql.slice(i, j)
        i = j - 1
        codeStart = j
      }
    }
  }
  flushCode(sql.length)
  return out
}

function canonicalizeTouchedTables(touchedTables: string[], tables: SqlTableInfo[], userId: string, preferPrivate = false) {
  const privateSchema = privateSchemaName(userId)
  const byLower = new Map(tables.map((table) => [qualifiedName(table.schema, table.name).toLowerCase(), qualifiedName(table.schema, table.name)]))
  const byTableLower = new Map<string, string>()
  for (const table of tables) {
    const key = table.name.toLowerCase()
    const qualified = qualifiedName(table.schema, table.name)
    if (!byTableLower.has(key) || table.schema === privateSchema) byTableLower.set(key, qualified)
  }
  return touchedTables.map((name) => {
    if (name.includes(".")) return byLower.get(name.toLowerCase()) ?? name
    if (preferPrivate) return qualifiedName(privateSchema, name.replace(/"/g, ""))
    return byTableLower.get(name.toLowerCase()) ?? name
  })
}

function analyzeSql(sql: string): SqlAnalysis {
  const normalizedSql = normalizeSql(sql)
  if (!normalizedSql) throw new SqlLabError("EMPTY_SQL", "SQL cannot be empty")
  const stripped = stripSql(normalizedSql)
  if (stripped.includes(";")) throw new SqlLabError("MULTI_STATEMENT", "Only one SQL statement is allowed")

  const first = stripped.match(/^\s*([a-z]+)/i)?.[1]?.toLowerCase()
  if (!first || !["select", "with", "explain", "insert", "update", "delete", "create", "alter", "drop", "truncate"].includes(first)) {
    throw new SqlLabError("FORBIDDEN_STATEMENT", "Only SELECT, WITH, EXPLAIN, INSERT, UPDATE, DELETE, and private-schema DDL are allowed")
  }
  const forbidden =
    /\b(copy|set|prepare|listen|notify|vacuum|grant|revoke|analyze|do|call)\b/i
  if (forbidden.test(stripped)) throw new SqlLabError("FORBIDDEN_DDL", "This SQL command is not allowed")
  if (/\b(pg_catalog|information_schema)\s*\./i.test(stripped)) {
    throw new SqlLabError("FORBIDDEN_SYSTEM_SCHEMA", "System schemas cannot be queried from SQL Lab")
  }
  if (/\bpg_[a-z0-9_]+\s*\(/i.test(stripped)) {
    throw new SqlLabError("FORBIDDEN_FUNCTION", "PostgreSQL internal functions are blocked")
  }
  const command = first as SqlAnalysis["command"]
  return {
    normalizedSql,
    command,
    readOnly: command === "select" || command === "with" || command === "explain",
    isDdl: command === "create" || command === "alter" || command === "drop" || command === "truncate",
    touchedTables: extractTableRefs(stripped),
  }
}

async function assertAllowedSql(viewerId: string, sql: string) {
  const analysis = analyzeSql(sql)
  const allTables = await readTables(viewerId)
  analysis.touchedTables = canonicalizeTouchedTables(analysis.touchedTables, allTables, viewerId, analysis.isDdl)
  const viewer = await getUser(viewerId)
  if (!viewer) throw new SqlLabError("USER_NOT_FOUND", "User not found", 404)
  const privateSchema = await ensurePrivateSchema(viewerId)
  if (analysis.isDdl) {
    if (!analysis.touchedTables.length || analysis.touchedTables.some((key) => !key.startsWith(`${privateSchema}.`))) {
      throw new SqlLabError("PRIVATE_DDL_ONLY", "DDL is only allowed inside your private database", 403)
    }
    return { analysis, grant: DEFAULT_GRANT, tableGrants: new Map<string, TableGrantRow>() }
  }
  const touchesOnlyPrivate =
    analysis.touchedTables.length > 0 && analysis.touchedTables.every((key) => key.startsWith(`${privateSchema}.`))
  if (touchesOnlyPrivate) return { analysis, grant: DEFAULT_GRANT, tableGrants: new Map<string, TableGrantRow>() }
  if (viewer.role === "owner") return { analysis, grant: DEFAULT_GRANT, tableGrants: new Map<string, TableGrantRow>() }

  const { grant, tables } = await readGrant(viewerId)
  if (!grant?.enabled) throw new SqlLabError("SQL_LAB_DISABLED", "SQL Lab access has not been enabled", 403)
  const byTable = grantMap(tables)
  for (const key of analysis.touchedTables) {
    if (key.startsWith(`${privateSchema}.`)) continue
    const tableGrant = byTable.get(key)
    if (!tableGrant || tableGrant.access === "none") {
      throw new SqlLabError("FORBIDDEN_TABLE", `No SQL Lab access for ${key}`, 403)
    }
    if (!analysis.readOnly && tableGrant.access !== "write") {
      throw new SqlLabError("FORBIDDEN_WRITE", `Write access is not granted for ${key}`, 403)
    }
    if (tableGrant.rowFilter) {
      throw new SqlLabError(
        "ROW_FILTER_REQUIRES_VIEW",
        `The grant for ${key} has a row filter. Create a filtered view before executing ad-hoc SQL for this table.`,
        403
      )
    }
    if (tableGrant.blockedColumns.length) {
      const stripped = stripSql(analysis.normalizedSql)
      if (/\*/.test(stripped)) {
        throw new SqlLabError("FORBIDDEN_COLUMN", `SELECT * is blocked because ${key} has masked columns`, 403)
      }
      for (const col of tableGrant.blockedColumns) {
        const colRe = new RegExp(`(^|[^\\w"])("?${col.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"?)(?=$|[^\\w"])`, "i")
        if (colRe.test(stripped)) throw new SqlLabError("FORBIDDEN_COLUMN", `Column ${col} is blocked`, 403)
      }
    }
  }
  return {
    analysis,
    grant: {
      enabled: grant.enabled,
      defaultLimit: grant.defaultLimit,
      maxLimit: grant.maxLimit,
      defaultTimeoutMs: grant.defaultTimeoutMs,
    },
    tableGrants: byTable,
  }
}

function pgTypeName(dataTypeID?: number) {
  switch (dataTypeID) {
    case 16:
      return "boolean"
    case 20:
    case 21:
    case 23:
    case 700:
    case 701:
    case 1700:
      return "number"
    case 1082:
      return "date"
    case 1114:
    case 1184:
      return "timestamp"
    case 114:
    case 3802:
      return "json"
    case 2950:
      return "uuid"
    case 17:
      return "bytes"
    default:
      return "unknown"
  }
}

function resultColumns(rows: Record<string, unknown>[], fields?: PgFieldInfo[]) {
  if (fields?.length) {
    const sample = rows[0] ?? {}
    return fields.map((field) => {
      const value = sample[field.name]
      return {
        name: field.name,
        type: value === null || value === undefined ? pgTypeName(field.dataTypeID) : typeof value,
      }
    })
  }
  const sample = rows[0] ?? {}
  return Object.keys(sample).map((name) => ({ name, type: sample[name] === null ? "unknown" : typeof sample[name] }))
}

function pgError(error: unknown) {
  const e = error as { code?: string; message?: string; hint?: string; position?: string }
  return {
    code: e.code || "QUERY_FAILED",
    message: e.message || "SQL execution failed",
    hint: e.hint,
    column: e.position ? Number(e.position) : undefined,
  }
}

async function recordAudit(input: {
  userId: string
  startedAt: Date
  durationMs: number
  ok: boolean
  rowCount: number
  truncated: boolean
  sql: string
  touchedTables: string[]
  errorCode?: string
  errorMessage?: string
  ipAddress?: string
  userAgent?: string
}) {
  await prisma.$executeRaw`
    INSERT INTO "SqlAuditLog" (
      id, "userId", "startedAt", "durationMs", ok, "rowCount", truncated,
      "sqlPreview", "fullSqlSha256", "touchedTables", "errorCode", "errorMessage", "ipAddress", "userAgent"
    )
    VALUES (
      ${newId("audit")}, ${input.userId}, ${input.startedAt}, ${input.durationMs}, ${input.ok}, ${input.rowCount},
      ${input.truncated}, ${input.sql.slice(0, MAX_SQL_PREVIEW)},
      ${crypto.createHash("sha256").update(input.sql).digest("hex")}, ${input.touchedTables},
      ${input.errorCode ?? null}, ${input.errorMessage ?? null}, ${input.ipAddress ?? null}, ${input.userAgent ?? null}
    )
  `
}

async function syncPrivateTables(userId: string) {
  const schema = await ensurePrivateSchema(userId)
  const rows = await prisma.$queryRaw<Array<{ tableName: string }>>`
    SELECT table_name AS "tableName"
    FROM information_schema.tables
    WHERE table_schema = ${schema}
      AND table_type = 'BASE TABLE'
  `
  const names = rows.map((row) => row.tableName)
  for (const tableName of names) {
    await prisma.$executeRaw`
      INSERT INTO "SqlPrivateTable" (id, "userId", "schemaName", "tableName", "displayName", "createdAt", "updatedAt")
      VALUES (${newId("privtbl")}, ${userId}, ${schema}, ${tableName}, ${tableName}, now(), now())
      ON CONFLICT ("userId", "schemaName", "tableName") DO NOTHING
    `
  }
  await prisma.$executeRaw`
    DELETE FROM "SqlPrivateTable"
    WHERE "userId" = ${userId}
      AND "schemaName" = ${schema}
      AND NOT ("tableName" = ANY(${names}))
  `
}

export async function executeSql(
  viewerId: string,
  request: SqlRunRequest,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<SqlRunResult> {
  const startedAt = new Date()
  const runId = newId("run")
  let analysis: SqlAnalysis | null = null
  try {
    const allowed = await assertAllowedSql(viewerId, request.sql)
    analysis = allowed.analysis
    const privateSchema = await ensurePrivateSchema(viewerId)
    const runnableSql = rewriteSqlIdentifiers(allowed.analysis.normalizedSql, await readTables(viewerId))
    const limit = Math.max(1, Math.min(Number(request.limit || allowed.grant.defaultLimit), allowed.grant.maxLimit))
    const timeoutMs = Math.max(1000, Math.min(allowed.grant.defaultTimeoutMs, 300_000))
    const client = await getPool().connect()
    try {
      const readOnly = request.forceReadOnly || allowed.analysis.readOnly
      await client.query(readOnly ? "BEGIN READ ONLY" : "BEGIN")
      await client.query(`SET LOCAL statement_timeout = ${timeoutMs}`)
      await client.query(`SET LOCAL idle_in_transaction_session_timeout = ${timeoutMs + 1000}`)
      await client.query(`SET LOCAL search_path = ${quoteIdent(privateSchema)}, public`)
      const sql =
        allowed.analysis.readOnly && allowed.analysis.command !== "explain"
          ? `SELECT * FROM (${runnableSql}) AS sqllab_result LIMIT ${limit + 1}`
          : runnableSql
      const queryResult = await client.query(sql)
      await client.query("COMMIT")
      const rawRows = (queryResult.rows ?? []) as Record<string, unknown>[]
      if (allowed.analysis.isDdl) await syncPrivateTables(viewerId)
      const truncated = allowed.analysis.readOnly && rawRows.length > limit
      const rows = truncated ? rawRows.slice(0, limit) : rawRows
      const durationMs = Date.now() - startedAt.getTime()
      const result: SqlRunResult = {
        runId,
        ok: true,
        resultSets: [
          {
            columns: resultColumns(rows, queryResult.fields),
            rows,
            rowCount: rows.length,
            truncated,
            affectedRows: allowed.analysis.readOnly ? undefined : queryResult.rowCount ?? 0,
            statement: allowed.analysis.command.toUpperCase(),
          },
        ],
        durationMs,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        warnings: truncated ? [`Result truncated to ${limit} rows`] : [],
        touchedTables: allowed.analysis.touchedTables,
      }
      await recordAudit({
        userId: viewerId,
        startedAt,
        durationMs,
        ok: true,
        rowCount: rows.length,
        truncated,
        sql: allowed.analysis.normalizedSql,
        touchedTables: allowed.analysis.touchedTables,
        ...meta,
      })
      return result
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    const durationMs = Date.now() - startedAt.getTime()
    const err =
      error instanceof SqlLabError
        ? { code: error.code, message: error.message, hint: error.hint }
        : pgError(error)
    await recordAudit({
      userId: viewerId,
      startedAt,
      durationMs,
      ok: false,
      rowCount: 0,
      truncated: false,
      sql: request.sql ?? "",
      touchedTables: analysis?.touchedTables ?? [],
      errorCode: err.code,
      errorMessage: err.message,
      ...meta,
    }).catch(() => undefined)
    return {
      runId,
      ok: false,
      resultSets: [],
      durationMs,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      warnings: [],
      error: err,
      touchedTables: analysis?.touchedTables ?? [],
    }
  }
}

export async function validateSql(viewerId: string, request: SqlValidateRequest): Promise<SqlValidateResult> {
  const startedAt = new Date()
  let analysis: SqlAnalysis | null = null
  try {
    const allowed = await assertAllowedSql(viewerId, request.sql)
    analysis = allowed.analysis
    const privateSchema = await ensurePrivateSchema(viewerId)
    const runnableSql = rewriteSqlIdentifiers(allowed.analysis.normalizedSql, await readTables(viewerId))
    const timeoutMs = Math.max(1000, Math.min(allowed.grant.defaultTimeoutMs, 10_000))
    const client = await getPool().connect()
    const statementName = `sqllab_validate_${crypto.randomUUID().replace(/-/g, "")}`
    try {
      await client.query("BEGIN")
      await client.query(`SET LOCAL statement_timeout = ${timeoutMs}`)
      await client.query(`SET LOCAL idle_in_transaction_session_timeout = ${timeoutMs + 1000}`)
      await client.query(`SET LOCAL search_path = ${quoteIdent(privateSchema)}, public`)
      if (allowed.analysis.isDdl) {
        throw new SqlLabError("VALIDATE_DDL_UNSUPPORTED", "Private DDL syntax can only be checked by running it in a transaction.", 400)
      }
      await client.query(`PREPARE ${quoteIdent(statementName)} AS ${runnableSql}`)
      await client.query(`DEALLOCATE ${quoteIdent(statementName)}`)
      await client.query("ROLLBACK")
      return {
        ok: true,
        durationMs: Date.now() - startedAt.getTime(),
        warnings: [],
        touchedTables: allowed.analysis.touchedTables,
      }
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    const err =
      error instanceof SqlLabError
        ? { code: error.code, message: error.message, hint: error.hint }
        : pgError(error)
    return {
      ok: false,
      durationMs: Date.now() - startedAt.getTime(),
      warnings: [],
      error: err,
      touchedTables: analysis?.touchedTables ?? [],
    }
  }
}

export async function getHistory(userId: string): Promise<SqlHistoryItem[]> {
  const rows = await prisma.$queryRaw<Array<{
    id: string
    sqlPreview: string
    startedAt: Date
    durationMs: number
    rowCount: number
    ok: boolean
    truncated: boolean
    errorMessage: string | null
  }>>`
    SELECT id, "sqlPreview", "startedAt", "durationMs", "rowCount", ok, truncated, "errorMessage"
    FROM "SqlAuditLog"
    WHERE "userId" = ${userId}
    ORDER BY "startedAt" DESC
    LIMIT 100
  `
  return rows.map((row) => ({
    id: row.id,
    sql: row.sqlPreview,
    startedAt: toIso(row.startedAt),
    durationMs: row.durationMs,
    rowCount: row.rowCount,
    ok: row.ok,
    truncated: row.truncated,
    errorMessage: row.errorMessage ?? undefined,
  }))
}

export async function getSavedQueries(userId: string) {
  const rows = await prisma.$queryRaw<Array<{
    id: string
    name: string
    sql: string
    description: string
    pinned: boolean
    shared: boolean
    updatedAt: Date
  }>>`
    SELECT id, name, sql, description, pinned, shared, "updatedAt"
    FROM "SqlSavedQuery"
    WHERE "userId" = ${userId} OR shared = true
    ORDER BY pinned DESC, "updatedAt" DESC
    LIMIT 200
  `
  return rows.map((row) => ({ ...row, updatedAt: toIso(row.updatedAt) }))
}

export async function saveQuery(userId: string, body: Partial<{ id: string; name: string; sql: string; description: string; pinned: boolean; shared: boolean }>) {
  if (!body.sql?.trim()) throw new SqlLabError("EMPTY_SQL", "SQL cannot be empty")
  analyzeSql(body.sql)
  const id = body.id || newId("saved")
  const admin = await getCurrentAdmin()
  const shared = Boolean(body.shared && admin?.role === "owner")
  await prisma.$executeRaw`
    INSERT INTO "SqlSavedQuery" (id, "userId", name, sql, description, pinned, shared, "createdAt", "updatedAt")
    VALUES (
      ${id}, ${userId}, ${body.name?.trim() || "Untitled query"}, ${body.sql},
      ${body.description ?? ""}, ${Boolean(body.pinned)}, ${shared}, now(), now()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      sql = EXCLUDED.sql,
      description = EXCLUDED.description,
      pinned = EXCLUDED.pinned,
      shared = EXCLUDED.shared,
      "updatedAt" = now()
    WHERE "SqlSavedQuery"."userId" = ${userId}
  `
  const rows = await getSavedQueries(userId)
  return rows.find((row) => row.id === id) ?? rows[0]
}

export async function updateSavedQuery(userId: string, id: string, body: Record<string, unknown>) {
  const existing = await prisma.$queryRaw<Array<{
    userId: string
    name: string
    sql: string
    description: string
    pinned: boolean
    shared: boolean
  }>>`
    SELECT "userId", name, sql, description, pinned, shared FROM "SqlSavedQuery" WHERE id = ${id} LIMIT 1
  `
  if (!existing[0] || existing[0].userId !== userId) throw new SqlLabError("NOT_FOUND", "Saved query not found", 404)
  const current = existing[0]
  const nextSql = typeof body.sql === "string" ? body.sql : current.sql
  analyzeSql(nextSql)
  const admin = await getCurrentAdmin()
  const canShare = admin?.role === "owner"
  const name = typeof body.name === "string" ? body.name : current.name
  const description = typeof body.description === "string" ? body.description : current.description
  const pinned = typeof body.pinned === "boolean" ? body.pinned : current.pinned
  const shared = canShare && typeof body.shared === "boolean" ? body.shared : current.shared
  await prisma.$executeRaw`
    UPDATE "SqlSavedQuery"
    SET
      name = ${name},
      sql = ${nextSql},
      description = ${description},
      pinned = ${pinned},
      shared = ${shared},
      "updatedAt" = now()
    WHERE id = ${id} AND "userId" = ${userId}
  `
  const rows = await getSavedQueries(userId)
  return rows.find((row) => row.id === id)
}

export async function deleteSavedQuery(userId: string, id: string) {
  await prisma.$executeRaw`DELETE FROM "SqlSavedQuery" WHERE id = ${id} AND "userId" = ${userId}`
}

export async function getPrivateFolders(userId: string) {
  await ensurePrivateSchema(userId)
  const rows = await prisma.$queryRaw<Array<{ id: string; name: string; description: string; sortOrder: number }>>`
    SELECT id, name, description, "sortOrder"
    FROM "SqlPrivateFolder"
    WHERE "userId" = ${userId}
    ORDER BY "sortOrder", name
  `
  return rows
}

export async function createPrivateFolder(userId: string, body: Record<string, unknown>) {
  await ensurePrivateSchema(userId)
  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!name) throw new SqlLabError("INVALID_FOLDER_NAME", "Folder name is required")
  const description = typeof body.description === "string" ? body.description.trim() : ""
  const id = newId("privfolder")
  await prisma.$executeRaw`
    INSERT INTO "SqlPrivateFolder" (id, "userId", name, description, "createdAt", "updatedAt")
    VALUES (${id}, ${userId}, ${name}, ${description}, now(), now())
    ON CONFLICT ("userId", name) DO UPDATE SET description = EXCLUDED.description, "updatedAt" = now()
  `
  const rows = await getPrivateFolders(userId)
  return rows.find((row) => row.name === name)
}

function normalizeColumnDefinitions(value: unknown) {
  const raw = typeof value === "string" ? value : ""
  const lines = raw
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (!lines.length) {
    return [
      `${quoteIdent("id")} TEXT PRIMARY KEY`,
      `${quoteIdent("createdAt")} TIMESTAMP NOT NULL DEFAULT now()`,
    ]
  }
  return lines.map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]{0,62})\s+(.+)$/)
    if (!match) throw new SqlLabError("INVALID_COLUMN_DEFINITION", `Invalid column definition: ${line}`)
    const name = assertIdentifier(match[1], "Column name")
    const definition = match[2].trim()
    if (/[;]/.test(definition) || /\b(drop|alter|create|truncate|grant|revoke|copy)\b/i.test(definition)) {
      throw new SqlLabError("INVALID_COLUMN_DEFINITION", `Unsafe column definition: ${line}`)
    }
    return `${quoteIdent(name)} ${definition}`
  })
}

export async function createPrivateTable(userId: string, body: Record<string, unknown>) {
  const schema = await ensurePrivateSchema(userId)
  const tableName = assertIdentifier(typeof body.name === "string" ? body.name : "", "Table name")
  const folderId = typeof body.folderId === "string" && body.folderId ? body.folderId : null
  if (folderId) {
    const folder = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "SqlPrivateFolder" WHERE id = ${folderId} AND "userId" = ${userId} LIMIT 1
    `
    if (!folder[0]) throw new SqlLabError("FOLDER_NOT_FOUND", "Private folder not found", 404)
  }
  const description = typeof body.description === "string" ? body.description.trim() : ""
  const columns = normalizeColumnDefinitions(body.columns)
  await prisma.$executeRawUnsafe(`CREATE TABLE ${quoteIdent(schema)}.${quoteIdent(tableName)} (${columns.join(", ")})`)
  await prisma.$executeRaw`
    INSERT INTO "SqlPrivateTable" (id, "userId", "folderId", "schemaName", "tableName", "displayName", description, "createdAt", "updatedAt")
    VALUES (${newId("privtbl")}, ${userId}, ${folderId}, ${schema}, ${tableName}, ${tableName}, ${description}, now(), now())
    ON CONFLICT ("userId", "schemaName", "tableName") DO UPDATE SET
      "folderId" = EXCLUDED."folderId",
      description = EXCLUDED.description,
      "updatedAt" = now()
  `
  return { schema, table: tableName }
}

export async function movePrivateTable(userId: string, body: Record<string, unknown>) {
  const schema = await ensurePrivateSchema(userId)
  const tableName = assertIdentifier(typeof body.tableName === "string" ? body.tableName : "", "Table name")
  let folderId = typeof body.folderId === "string" && body.folderId ? body.folderId : null
  const folderName = typeof body.folderName === "string" ? body.folderName.trim() : ""

  const table = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "SqlPrivateTable"
    WHERE "userId" = ${userId}
      AND "schemaName" = ${schema}
      AND "tableName" = ${tableName}
    LIMIT 1
  `
  if (!table[0]) throw new SqlLabError("PRIVATE_TABLE_NOT_FOUND", "Private table not found", 404)

  if (!folderId && folderName) {
    const folder = await createPrivateFolder(userId, { name: folderName })
    folderId = folder?.id ?? null
  }

  if (folderId) {
    const folder = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "SqlPrivateFolder" WHERE id = ${folderId} AND "userId" = ${userId} LIMIT 1
    `
    if (!folder[0]) throw new SqlLabError("FOLDER_NOT_FOUND", "Private folder not found", 404)
  }

  await prisma.$executeRaw`
    UPDATE "SqlPrivateTable"
    SET "folderId" = ${folderId}, "updatedAt" = now()
    WHERE id = ${table[0].id}
  `

  return { schema, table: tableName, folderId }
}

export async function getExamples(userId: string): Promise<SqlExample[]> {
  const schema = await getEffectiveSchema(userId)
  const tables = schema.schemas.flatMap((s) => s.tables).slice(0, 5)
  return tables.map((table, idx) => ({
    id: `example_${table.schema}_${table.name}`,
    title: idx === 0 ? `Browse ${table.name}` : `Inspect ${table.name}`,
    sql: `SELECT ${table.columns.slice(0, 6).map((c) => quoteIdent(c.name)).join(", ")}\nFROM ${quoteIdent(table.schema)}.${quoteIdent(table.name)}\nLIMIT 50`,
    description: `Read sample rows from ${table.schema}.${table.name}`,
    category: idx === 0 ? "intro" : "admin",
  }))
}

export async function getAdminTables() {
  return readTables()
}

export async function getGrantSummaries(): Promise<SqlGrantSummary[]> {
  const rows = await prisma.$queryRaw<Array<{
    userId: string
    email: string
    displayName: string
    role: string
    enabled: boolean | null
    tableCount: bigint | number
    readOnlyCount: bigint | number
    writableCount: bigint | number
    updatedAt: Date | null
  }>>`
    SELECT
      u.id AS "userId",
      u.email,
      u."displayName",
      u.role,
      g.enabled,
      COUNT(t.id) FILTER (WHERE t.access <> 'none') AS "tableCount",
      COUNT(t.id) FILTER (WHERE t.access = 'read') AS "readOnlyCount",
      COUNT(t.id) FILTER (WHERE t.access = 'write') AS "writableCount",
      g."updatedAt"
    FROM "User" u
    LEFT JOIN "SqlAccessGrant" g ON g."userId" = u.id
    LEFT JOIN "SqlAccessTableGrant" t ON t."grantId" = g.id
    GROUP BY u.id, u.email, u."displayName", u.role, g.enabled, g."updatedAt"
    ORDER BY u.role DESC, u."updatedAt" DESC
  `
  return rows.map((row) => ({
    userId: row.userId,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    enabled: Boolean(row.enabled),
    tableCount: Number(row.tableCount),
    readOnlyCount: Number(row.readOnlyCount),
    writableCount: Number(row.writableCount),
    updatedAt: row.updatedAt ? toIso(row.updatedAt) : null,
  }))
}

export async function getGrantDetail(userId: string): Promise<SqlGrant> {
  const user = await getUser(userId)
  if (!user) throw new SqlLabError("USER_NOT_FOUND", "User not found", 404)
  const { grant, tables } = await readGrant(userId)
  return {
    userId,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    enabled: Boolean(grant?.enabled),
    defaultLimit: grant?.defaultLimit ?? DEFAULT_GRANT.defaultLimit,
    defaultTimeoutMs: grant?.defaultTimeoutMs ?? DEFAULT_GRANT.defaultTimeoutMs,
    tables: tables.map((row): SqlGrantTable => ({
      schema: row.schemaName,
      table: row.tableName,
      access: row.access,
      blockedColumns: row.blockedColumns,
      rowFilter: row.rowFilter ?? undefined,
      updatedAt: toIso(row.updatedAt),
    })),
    updatedAt: toIso(grant?.updatedAt),
  }
}

export async function upsertGrant(userId: string, updaterId: string, body: Record<string, unknown>) {
  await prisma.$executeRaw`
    INSERT INTO "SqlAccessGrant" (
      id, "userId", enabled, "defaultLimit", "maxLimit", "defaultTimeoutMs", "updatedById", "createdAt", "updatedAt"
    )
    VALUES (
      ${newId("grant")}, ${userId}, ${Boolean(body.enabled)}, ${Number(body.defaultLimit || DEFAULT_GRANT.defaultLimit)},
      ${Number(body.maxLimit || DEFAULT_GRANT.maxLimit)}, ${Number(body.defaultTimeoutMs || DEFAULT_GRANT.defaultTimeoutMs)},
      ${updaterId}, now(), now()
    )
    ON CONFLICT ("userId") DO UPDATE SET
      enabled = EXCLUDED.enabled,
      "defaultLimit" = EXCLUDED."defaultLimit",
      "maxLimit" = EXCLUDED."maxLimit",
      "defaultTimeoutMs" = EXCLUDED."defaultTimeoutMs",
      "updatedById" = EXCLUDED."updatedById",
      "updatedAt" = now()
  `
  return getGrantDetail(userId)
}

async function ensureGrant(userId: string, updaterId: string) {
  await prisma.$executeRaw`
    INSERT INTO "SqlAccessGrant" (id, "userId", enabled, "updatedById", "createdAt", "updatedAt")
    VALUES (${newId("grant")}, ${userId}, false, ${updaterId}, now(), now())
    ON CONFLICT ("userId") DO NOTHING
  `
  const { grant } = await readGrant(userId)
  if (!grant) throw new SqlLabError("GRANT_NOT_FOUND", "Grant could not be created", 500)
  return grant.id
}

export async function upsertTableGrant(userId: string, updaterId: string, tableParam: string, body: Record<string, unknown>) {
  const { schema, table } = splitTableParam(tableParam)
  const access: SqlAccessLevel = ["none", "read", "write"].includes(String(body.access))
    ? (String(body.access) as SqlAccessLevel)
    : "read"
  const blockedColumns = Array.isArray(body.blockedColumns) ? body.blockedColumns.map(String) : []
  const rowFilter = typeof body.rowFilter === "string" && body.rowFilter.trim() ? body.rowFilter.trim() : null
  const grantId = await ensureGrant(userId, updaterId)
  await prisma.$executeRaw`
    INSERT INTO "SqlAccessTableGrant" (
      id, "grantId", "schemaName", "tableName", access, "blockedColumns", "rowFilter", "updatedAt"
    )
    VALUES (${newId("tablegrant")}, ${grantId}, ${schema}, ${table}, ${access}, ${blockedColumns}, ${rowFilter}, now())
    ON CONFLICT ("grantId", "schemaName", "tableName") DO UPDATE SET
      access = EXCLUDED.access,
      "blockedColumns" = EXCLUDED."blockedColumns",
      "rowFilter" = EXCLUDED."rowFilter",
      "updatedAt" = now()
  `
  return {
    userId,
    schema,
    table,
    access,
    blockedColumns,
    rowFilter: rowFilter ?? undefined,
    updatedAt: new Date().toISOString(),
  } satisfies SqlGrantTable & { userId: string }
}

export async function deleteTableGrant(userId: string, tableParam: string) {
  const { schema, table } = splitTableParam(tableParam)
  await prisma.$executeRaw`
    DELETE FROM "SqlAccessTableGrant" t
    USING "SqlAccessGrant" g
    WHERE t."grantId" = g.id
      AND g."userId" = ${userId}
      AND t."schemaName" = ${schema}
      AND t."tableName" = ${table}
  `
}

export async function getAuditEntries(): Promise<SqlAuditEntry[]> {
  const rows = await prisma.$queryRaw<Array<{
    id: string
    userId: string
    email: string
    displayName: string
    startedAt: Date
    durationMs: number
    ok: boolean
    rowCount: number
    truncated: boolean
    sqlPreview: string
    touchedTables: string[]
    errorMessage: string | null
    ipAddress: string | null
  }>>`
    SELECT
      a.id, a."userId", u.email, u."displayName", a."startedAt", a."durationMs", a.ok,
      a."rowCount", a.truncated, a."sqlPreview", a."touchedTables", a."errorMessage", a."ipAddress"
    FROM "SqlAuditLog" a
    JOIN "User" u ON u.id = a."userId"
    ORDER BY a."startedAt" DESC
    LIMIT 200
  `
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    email: row.email,
    displayName: row.displayName,
    startedAt: toIso(row.startedAt),
    durationMs: row.durationMs,
    ok: row.ok,
    rowCount: row.rowCount,
    truncated: row.truncated,
    sqlPreview: row.sqlPreview,
    touchedTables: row.touchedTables,
    errorMessage: row.errorMessage ?? undefined,
    ipAddress: row.ipAddress ?? undefined,
  }))
}

export function jsonError(error: unknown) {
  if (error instanceof SqlLabError) {
    return Response.json({ error: error.message, code: error.code, hint: error.hint }, { status: error.status, headers: NO_STORE })
  }
  const message = error instanceof Error ? error.message : "Unexpected error"
  return Response.json({ error: message }, { status: 500, headers: NO_STORE })
}
