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

export type SqlInsightTone = "sky" | "emerald" | "amber" | "violet" | "rose" | "cyan"

export type SqlThreadStepKind =
  | "user_prompt"
  | "ai_thinking"
  | "tool_call"
  | "candidate_tables"
  | "ai_probe_sql"
  | "sql_draft"
  | "sql_run"
  | "ai_insight"
  | "ai_error"
  | "user_note"

export type SqlThreadStepStatus = "pending" | "running" | "done" | "error" | "aborted"

export type SqlStageMode = "auto" | "analyst" | "manual"

export type SqlThreadCandidateTable = {
  schema: string
  table: string
  role: "primary" | "join" | "reference"
  reason: string
}

export type SqlThreadStep = {
  id: string
  threadId: string
  orderIndex: number
  kind: SqlThreadStepKind
  status: SqlThreadStepStatus
  title: string
  bodyMarkdown: string
  sql: string
  payload?: Record<string, unknown> | null
  tokensIn: number
  tokensOut: number
  durationMs: number
  errorMessage?: string
  createdAt: string
}

export type SqlThreadSummary = {
  id: string
  title: string
  summary: string
  modelName: string
  status: string
  pinned: boolean
  archived: boolean
  lastEventAt: string
  createdAt: string
  updatedAt: string
  stepCount: number
}

export type SqlThreadDetail = SqlThreadSummary & {
  steps: SqlThreadStep[]
}

export type SqlThreadStreamEvent =
  | { type: "step.created"; step: SqlThreadStep }
  | { type: "step.delta"; stepId: string; orderIndex: number; kind: SqlThreadStepKind; bodyDelta?: string; payloadPatch?: Record<string, unknown> }
  | { type: "step.completed"; step: SqlThreadStep }
  | { type: "thread.updated"; thread: SqlThreadSummary }
  | { type: "error"; message: string }
  | { type: "done"; threadId: string }

export type SqlRelationNode = {
  id: string
  kind: "module" | "table"
  label: string
  moduleId?: string
  moduleName?: string
  schema?: string
  table?: string
  scope?: "public" | "private"
  access?: SqlAccessLevel
  description?: string
  fields?: string[]
  rowCountEstimate?: number | null
  x: number
  y: number
  tone: SqlInsightTone
}

export type SqlRelationEdge = {
  id: string
  source: string
  target: string
  label: string
  kind: "contains" | "relation"
  tone: SqlInsightTone
}

export type SqlRelationGraph = {
  generatedAt: string
  nodes: SqlRelationNode[]
  edges: SqlRelationEdge[]
}

export type SqlRelationGraphV2Module = {
  id: string
  name: string
  description: string
  tableCount: number
  tone: SqlInsightTone
}

export type SqlRelationGraphV2Table = {
  id: string
  schema: string
  table: string
  moduleId: string
  moduleName: string
  submoduleId: string
  submoduleName: string
  scope: "public" | "private"
  access: SqlAccessLevel
  description: string
  rowCountEstimate?: number | null
  columns: SqlColumnInfo[]
}

export type SqlRelationGraphV2FkEdge = {
  id: string
  from: { schema: string; table: string; column: string }
  to: { schema: string; table: string; column: string }
  onDelete: string
}

export type SqlRelationGraphV2ModuleEdge = {
  id: string
  source: string
  target: string
  count: number
}

export type SqlRelationGraphV2 = SqlRelationGraph & {
  modules: SqlRelationGraphV2Module[]
  tables: SqlRelationGraphV2Table[]
  fkEdges: SqlRelationGraphV2FkEdge[]
  moduleEdges: SqlRelationGraphV2ModuleEdge[]
}

export type SqlInsightCard = {
  id: string
  title: string
  description: string
  sql: string
  chartConfig: unknown
  snapshotJson?: unknown
  layout?: unknown
  refreshMeta?: unknown
  theme?: string
  pinned: boolean
  shared: boolean
  threadId?: string | null
  createdAt: string
  updatedAt: string
}

export type SqlBiDashboard = {
  id: string
  name: string
  theme: string
  layout?: unknown
  createdAt: string
  updatedAt: string
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
