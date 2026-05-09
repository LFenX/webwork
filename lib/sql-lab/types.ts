// SQL Lab shared contracts.
export type SqlAccessLevel = "none" | "read" | "write"

export type SqlColumnInfo = {
  name: string
  dataType: string
  nullable: boolean
  isPrimaryKey?: boolean
  isForeignKey?: boolean
  isMasked?: boolean
  comment?: string
}

export type SqlCatalogRelation = {
  table: string
  fields?: string[]
  type?: "belongs_to" | "has_many" | "many_to_many" | "lookup" | "audit" | "extension"
  description: string
}

export type SqlTableCatalogInfo = {
  moduleId: string
  moduleName: string
  submoduleId: string
  submoduleName: string
  description: string
  aliases: string[]
  keywords: string[]
  keyFields: string[]
  relations: SqlCatalogRelation[]
  useCases: string[]
  notes?: string
}

export type SqlCatalogMatch = {
  schema: string
  table: string
  score: number
  reasons: string[]
  matchedColumns?: string[]
  catalog: SqlTableCatalogInfo
}

export type SqlTableInfo = {
  schema: string
  name: string
  scope?: "public" | "private"
  folderId?: string | null
  folderName?: string | null
  rowCountEstimate?: number | null
  access: SqlAccessLevel
  columns: SqlColumnInfo[]
  comment?: string
  catalog?: SqlTableCatalogInfo
  rowFilterPreview?: string | null
}

export type SqlSchema = {
  viewer: {
    userId: string
    displayName: string
    role: string
    isOwner: boolean
    canManage: boolean
  }
  enabled: boolean
  defaultLimit: number
  maxLimit: number
  defaultTimeoutMs: number
  dataSource: { name: string; engine: "postgres" | "sqlite"; readOnly: boolean }
  schemas: Array<{ name: string; label?: string; scope?: "public" | "private"; tables: SqlTableInfo[] }>
}

export type SqlRunRequest = {
  sql: string
  limit?: number
  params?: Record<string, string | number | boolean | null>
  forceReadOnly?: boolean
}

export type SqlValidateRequest = {
  sql: string
}

export type SqlValidateResult = {
  ok: boolean
  durationMs: number
  warnings: string[]
  error?: { code: string; message: string; hint?: string; line?: number; column?: number }
  touchedTables?: string[]
}

export type SqlRunColumn = {
  name: string
  type: string
}

export type SqlRunResult = {
  runId: string
  ok: boolean
  resultSets: Array<{
    columns: SqlRunColumn[]
    rows: Array<Record<string, unknown>>
    rowCount: number
    truncated: boolean
    affectedRows?: number
    statement: string
  }>
  durationMs: number
  startedAt: string
  finishedAt: string
  warnings: string[]
  error?: { code: string; message: string; hint?: string; line?: number; column?: number }
  touchedTables?: string[]
}

export type SqlHistoryItem = {
  id: string
  sql: string
  startedAt: string
  durationMs: number
  rowCount: number
  ok: boolean
  truncated: boolean
  errorMessage?: string
}

export type SqlSavedQuery = {
  id: string
  name: string
  sql: string
  description?: string
  pinned: boolean
  shared: boolean
  updatedAt: string
}

export type SqlExample = {
  id: string
  title: string
  sql: string
  description: string
  category: "intro" | "join" | "aggregate" | "admin"
}

export type SqlGrantTable = {
  schema: string
  table: string
  access: SqlAccessLevel
  blockedColumns: string[]
  rowFilter?: string
  updatedAt: string
}

export type SqlGrant = {
  userId: string
  email: string
  displayName: string
  role: string
  enabled: boolean
  defaultLimit: number
  defaultTimeoutMs: number
  tables: SqlGrantTable[]
  updatedAt: string
}

export type SqlGrantSummary = {
  userId: string
  email: string
  displayName: string
  role: string
  enabled: boolean
  tableCount: number
  readOnlyCount: number
  writableCount: number
  updatedAt: string | null
}

export type SqlAuditEntry = {
  id: string
  userId: string
  email: string
  displayName: string
  startedAt: string
  durationMs: number
  ok: boolean
  rowCount: number
  truncated: boolean
  sqlPreview: string
  touchedTables: string[]
  errorMessage?: string
  ipAddress?: string
}
