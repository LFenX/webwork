import "server-only"

import { requestProviderChat, type ProviderMessage } from "@/lib/ai/provider"
import { getEffectiveProviderConfig } from "@/lib/ai/service"
import {
  createPrivateFolder,
  createPrivateTable,
  executeSql,
  getEffectiveSchema,
  movePrivateTable,
} from "@/lib/sql-lab/service"
import {
  catalogKey,
  searchSqlCatalog,
  selectedTableDetails,
} from "@/lib/sql-lab/table-catalog"
import type { SqlCatalogMatch, SqlRunResult, SqlSchema, SqlTableInfo } from "@/lib/sql-lab/types"

type AssistantMessage = {
  role: "user" | "assistant"
  content: string
}

export type AssistantAction =
  | { type: "create_folder"; name: string; description?: string }
  | { type: "create_table"; name: string; folderId?: string; folderName?: string; description?: string; columns?: string }
  | { type: "move_table"; tableName: string; folderId?: string; folderName?: string }
  | { type: "execute_sql"; sql: string; title?: string }

export type SelectedSqlTable = {
  schema: string
  table: string
  reason: string
  role?: "primary" | "join" | "reference"
}

export type SqlAssistantRequest = {
  messages?: AssistantMessage[]
  prompt?: string
  currentSql?: string
  lastResult?: Pick<SqlRunResult, "ok" | "error" | "warnings" | "touchedTables" | "durationMs"> & {
    rowCount?: number
  }
  takeover?: boolean
  limit?: number
}

export type SqlAssistantResponse = {
  message: string
  sql: string
  title: string
  reasoningMarkdown: string
  selectedTables: SelectedSqlTable[]
  catalogMatches: SqlCatalogMatch[]
  confidence: number
  actions: AssistantAction[]
  executedActions: Array<{ type: AssistantAction["type"]; ok: boolean; message: string }>
  runResult?: SqlRunResult
  provider: {
    label: string
    model: string
    source: string
  }
}

type ModelPayload = {
  message?: string
  sql?: string
  title?: string
  reasoningMarkdown?: string
  confidence?: number
  actions?: unknown
}

type SelectorPayload = {
  selected?: Array<{ schema?: string; table?: string; reason?: string; role?: string }>
  confidence?: number
  reasoningMarkdown?: string
  clarifyingQuestion?: string
}

const SYSTEM_PROMPT = `You are SQL Tutor inside SQL Lab.
You are not a general chat assistant. For every user request, convert the request into one of these SQL Lab outcomes:
1. a runnable PostgreSQL query in "sql";
2. private database actions in "actions";
3. both.

Return valid JSON only. No markdown fences outside JSON.
The JSON must include: "message", "title", "sql", "reasoningMarkdown", "confidence", and "actions".

Rules:
- If the user asks a data question, "sql" must be a complete runnable SQL statement.
- If the user reports an error, fix the current SQL and put the corrected statement in "sql".
- Do not answer as a general chatbot when the user needs data. Generate SQL.
- Only use selected table details from the provided context. Do not invent tables or columns.
- Quote real PostgreSQL identifiers with double quotes, especially mixed-case names like "createdAt".
- Public tables are governed by access and row filters. Private tables are fully writable by the user.
- CREATE, ALTER, DROP, and TRUNCATE are only allowed in the user's private schema.
- In takeover mode, include an execute_sql action whenever a SQL statement should be run.
- "reasoningMarkdown" is a user-visible audit summary, not hidden private chain-of-thought. Write it in Chinese with concise sections:
  - 需求理解
  - 表选择理由
  - SQL 方案
  - 权限/风险边界
- When confidence is low or tables are semantically ambiguous, ask one clarifying question in "message" and leave "sql" empty.

Return shape:
{
  "message": "short user-facing answer",
  "title": "short query tab title",
  "sql": "complete SQL or empty string",
  "reasoningMarkdown": "user-visible reasoning summary in markdown",
  "confidence": 0.0,
  "actions": [
    { "type": "create_folder", "name": "folder_name", "description": "optional" },
    { "type": "create_table", "name": "table_name", "folderName": "optional", "description": "optional", "columns": "id TEXT PRIMARY KEY\\ncreatedAt TIMESTAMP NOT NULL DEFAULT now()" },
    { "type": "move_table", "tableName": "table_name", "folderName": "target folder" },
    { "type": "execute_sql", "sql": "complete SQL", "title": "optional" }
  ]
}`

const SELECTOR_PROMPT = `You select SQL Lab tables for a request.
Return JSON only with:
{
  "selected": [{ "schema": "public", "table": "Post", "role": "primary", "reason": "why this table is needed" }],
  "confidence": 0.0,
  "reasoningMarkdown": "Chinese user-visible table-selection explanation",
  "clarifyingQuestion": ""
}

Rules:
- Select at most 6 tables from the candidate list only.
- Prefer exact table-name matches over broad semantic matches.
- If the request mentions a field error, keep tables from current SQL and choose tables with similar fields.
- Include join/reference tables only when needed to answer the user.
- If several candidate tables are genuinely ambiguous, return a clarifyingQuestion and low confidence.`

const RETRY_PROMPT = `Your previous answer was not acceptable for SQL Lab. Return valid JSON only.
If the user request is about data retrieval, you must include a complete SQL statement in "sql".
Do not answer as a normal chatbot. Do not omit "reasoningMarkdown".`

function clampConfidence(value: unknown, fallback: number) {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback
  return Math.max(0, Math.min(1, number))
}

function tableIdentity(table: SqlTableInfo) {
  return { schema: table.schema, table: table.name }
}

function compactCatalogMatch(match: SqlCatalogMatch) {
  return {
    schema: match.schema,
    table: match.table,
    score: Math.round(match.score),
    reasons: match.reasons,
    matchedColumns: match.matchedColumns ?? [],
    module: match.catalog.moduleName,
    submodule: match.catalog.submoduleName,
    description: match.catalog.description,
    aliases: match.catalog.aliases,
    keywords: match.catalog.keywords,
    keyFields: match.catalog.keyFields,
    useCases: match.catalog.useCases,
    relations: match.catalog.relations.map((relation) => ({
      table: relation.table,
      fields: relation.fields ?? [],
      description: relation.description,
    })),
  }
}

function compactTableDetail(table: SqlTableInfo) {
  return {
    schema: table.schema,
    name: table.name,
    scope: table.scope ?? "public",
    access: table.access,
    folder: table.folderName ?? null,
    rows: table.rowCountEstimate ?? 0,
    rowFilter: table.rowFilterPreview ?? "",
    catalog: table.catalog
      ? {
          module: table.catalog.moduleName,
          submodule: table.catalog.submoduleName,
          description: table.catalog.description,
          aliases: table.catalog.aliases,
          keywords: table.catalog.keywords,
          keyFields: table.catalog.keyFields,
          relations: table.catalog.relations,
          useCases: table.catalog.useCases,
          notes: table.catalog.notes ?? "",
        }
      : null,
    columns: table.columns.map((column) => ({
      name: column.name,
      type: column.dataType,
      nullable: column.nullable,
      primaryKey: Boolean(column.isPrimaryKey),
      foreignKey: Boolean(column.isForeignKey),
      masked: Boolean(column.isMasked),
      comment: column.comment ?? "",
    })),
  }
}

function schemaSummary(schema: SqlSchema) {
  return {
    viewer: schema.viewer,
    datasource: schema.dataSource,
    limits: {
      defaultLimit: schema.defaultLimit,
      maxLimit: schema.maxLimit,
      timeoutMs: schema.defaultTimeoutMs,
    },
    tableCounts: schema.schemas.map((item) => ({
      schema: item.name,
      scope: item.scope ?? "public",
      tables: item.tables.length,
    })),
  }
}

function extractJson<T extends object>(text: string, fallback: T): T {
  const trimmed = text.trim()
  const candidates = [
    trimmed,
    trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? "",
    trimmed.match(/\{[\s\S]*\}/)?.[0] ?? "",
  ].filter(Boolean)

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as T
      if (parsed && typeof parsed === "object") return parsed
    } catch {
      // Try next candidate.
    }
  }

  return fallback
}

function extractSqlFromText(text: string) {
  const fenced = text.match(/```sql\s*([\s\S]*?)```/i)?.[1]?.trim()
  if (fenced) return fenced
  const sqlStart = text.search(/\b(select|with|explain|insert|update|delete|create|alter|drop|truncate)\b/i)
  if (sqlStart < 0) return ""
  return text.slice(sqlStart).trim().replace(/```$/g, "").trim()
}

function likelyNeedsSql(prompt: string, currentSql?: string, lastResult?: SqlAssistantRequest["lastResult"]) {
  const text = `${prompt}\n${currentSql ?? ""}\n${lastResult?.error?.message ?? ""}`.toLowerCase()
  return /sql|query|select|join|where|order|group|count|sum|list|show|find|fetch|table|column|error|报错|错误|修复|查询|取数|统计|排序|筛选|字段|表|最近|访问|输出|看看|信息/.test(text)
}

function likelyPrivateAction(prompt: string) {
  return /private|私有|私人|创建|新建|建表|文件夹|移动|插入|修改|删除/.test(prompt)
}

function safeActions(actions: unknown): AssistantAction[] {
  if (!Array.isArray(actions)) return []
  const out: AssistantAction[] = []
  for (const item of actions) {
    if (!item || typeof item !== "object") continue
    const action = item as Record<string, unknown>
    const type = action.type
    if (type === "create_folder" && typeof action.name === "string") {
      out.push({ type, name: action.name, description: typeof action.description === "string" ? action.description : undefined })
    } else if (type === "create_table" && typeof action.name === "string") {
      out.push({
        type,
        name: action.name,
        folderId: typeof action.folderId === "string" ? action.folderId : undefined,
        folderName: typeof action.folderName === "string" ? action.folderName : undefined,
        description: typeof action.description === "string" ? action.description : undefined,
        columns: typeof action.columns === "string" ? action.columns : undefined,
      })
    } else if (type === "move_table" && typeof action.tableName === "string") {
      out.push({
        type,
        tableName: action.tableName,
        folderId: typeof action.folderId === "string" ? action.folderId : undefined,
        folderName: typeof action.folderName === "string" ? action.folderName : undefined,
      })
    } else if (type === "execute_sql" && typeof action.sql === "string") {
      out.push({ type, sql: action.sql, title: typeof action.title === "string" ? action.title : undefined })
    }
  }
  return out.slice(0, 6)
}

function normalizePayload(text: string) {
  const payload = extractJson<ModelPayload>(text, { message: text.trim(), sql: "", title: "SQL Tutor", actions: [] })
  const actions = safeActions(payload.actions)
  const actionSql = actions.find((action): action is Extract<AssistantAction, { type: "execute_sql" }> => action.type === "execute_sql")?.sql?.trim() ?? ""
  const jsonSql = typeof payload.sql === "string" ? payload.sql.trim() : ""
  return {
    payload,
    actions,
    sql: jsonSql || actionSql || extractSqlFromText(text),
  }
}

function fallbackSelectedTables(matches: SqlCatalogMatch[], schema: SqlSchema): SelectedSqlTable[] {
  const picked = new Map<string, SelectedSqlTable>()
  for (const match of matches.slice(0, 4)) {
    picked.set(catalogKey(match.schema, match.table), {
      schema: match.schema,
      table: match.table,
      role: picked.size === 0 ? "primary" : "reference",
      reason: match.reasons[0] ?? match.catalog.description,
    })
  }

  const tableMap = new Map(schema.schemas.flatMap((item) => item.tables.map((table) => [catalogKey(table.schema, table.name), table] as const)))
  for (const selected of [...picked.values()]) {
    const detail = tableMap.get(catalogKey(selected.schema, selected.table))
    for (const relation of detail?.catalog?.relations ?? []) {
      if (picked.size >= 6) break
      const target = [...tableMap.values()].find((table) => table.name === relation.table)
      if (target) {
        picked.set(catalogKey(target.schema, target.name), {
          schema: target.schema,
          table: target.name,
          role: "join",
          reason: relation.description,
        })
      }
    }
  }
  return [...picked.values()].slice(0, 6)
}

async function selectTablesWithModel(input: {
  provider: NonNullable<Awaited<ReturnType<typeof getEffectiveProviderConfig>>>
  prompt: string
  currentSql?: string
  lastResult?: SqlAssistantRequest["lastResult"]
  matches: SqlCatalogMatch[]
  schema: SqlSchema
}) {
  const fallbackSelected = fallbackSelectedTables(input.matches, input.schema)
  const fallbackConfidence = input.matches[0] ? Math.min(0.92, input.matches[0].score / 140) : 0.15
  const top = input.matches[0]
  const second = input.matches[1]
  if (top && (top.score >= 110 || top.score >= (second?.score ?? 0) + 50)) {
    return {
      selectedTables: fallbackSelected,
      confidence: fallbackConfidence,
      reasoningMarkdown: `### 表选择\n目录检索已明确命中 \`${top.schema}.${top.table}\`，主要依据：${top.reasons.join("、") || top.catalog.description}。`,
      clarifyingQuestion: "",
    }
  }
  if (!input.matches.length) {
    return {
      selectedTables: fallbackSelected,
      confidence: 0.15,
      reasoningMarkdown: "### 表选择\n没有从目录中找到明确候选表，需要用户补充业务对象或表名。",
      clarifyingQuestion: "",
    }
  }

  try {
    const result = await requestProviderChat({
      provider: { ...input.provider, temperature: 0 },
      messages: [
        { role: "system", content: SELECTOR_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            prompt: input.prompt,
            currentSql: input.currentSql ?? "",
            lastError: input.lastResult?.error?.message ?? "",
            touchedTables: input.lastResult?.touchedTables ?? [],
            candidates: input.matches.slice(0, 14).map(compactCatalogMatch),
          }),
        },
      ],
      stream: false,
      toolChoice: "none",
      timeoutMs: 20_000,
    })
    const parsed = extractJson<SelectorPayload>(result.assistantText, {})
    const allowed = new Set(input.matches.map((match) => catalogKey(match.schema, match.table)))
    const selected = (parsed.selected ?? [])
      .map((item): SelectedSqlTable | null => {
        const schema = typeof item.schema === "string" ? item.schema : "public"
        const table = typeof item.table === "string" ? item.table : ""
        if (!table || !allowed.has(catalogKey(schema, table))) return null
        const role = item.role === "join" || item.role === "reference" ? item.role : "primary"
        return {
          schema,
          table,
          role,
          reason: typeof item.reason === "string" && item.reason.trim() ? item.reason.trim() : "目录候选匹配。",
        }
      })
      .filter((item): item is SelectedSqlTable => Boolean(item))
      .slice(0, 6)
    return {
      selectedTables: selected.length ? selected : fallbackSelected,
      confidence: clampConfidence(parsed.confidence, fallbackConfidence),
      reasoningMarkdown: typeof parsed.reasoningMarkdown === "string" ? parsed.reasoningMarkdown : "",
      clarifyingQuestion: typeof parsed.clarifyingQuestion === "string" ? parsed.clarifyingQuestion.trim() : "",
    }
  } catch {
    return {
      selectedTables: fallbackSelected,
      confidence: fallbackConfidence,
      reasoningMarkdown: "",
      clarifyingQuestion: "",
    }
  }
}

async function executeAssistantActions(userId: string, actions: AssistantAction[], limit?: number) {
  const executedActions: SqlAssistantResponse["executedActions"] = []
  let runResult: SqlRunResult | undefined

  for (const action of actions) {
    try {
      if (action.type === "create_folder") {
        const folder = await createPrivateFolder(userId, action)
        executedActions.push({ type: action.type, ok: true, message: `Created folder: ${folder?.name ?? action.name}` })
      } else if (action.type === "create_table") {
        const table = await createPrivateTable(userId, {
          name: action.name,
          folderId: action.folderId,
          description: action.description,
          columns: action.columns,
        })
        if (action.folderName && !action.folderId) {
          await movePrivateTable(userId, { tableName: action.name, folderName: action.folderName })
        }
        executedActions.push({ type: action.type, ok: true, message: `Created private table: ${table.schema}.${table.table}` })
      } else if (action.type === "move_table") {
        const moved = await movePrivateTable(userId, action)
        executedActions.push({ type: action.type, ok: true, message: `Moved private table: ${moved.table}` })
      } else if (action.type === "execute_sql") {
        runResult = await executeSql(userId, { sql: action.sql, limit })
        executedActions.push({
          type: action.type,
          ok: runResult.ok,
          message: runResult.ok ? `Executed SQL, returned ${runResult.resultSets.at(-1)?.rowCount ?? 0} rows` : runResult.error?.message ?? "Execution failed",
        })
      }
    } catch (error) {
      executedActions.push({
        type: action.type,
        ok: false,
        message: error instanceof Error ? error.message : "Action failed",
      })
    }
  }

  return { executedActions, runResult }
}

function buildFallbackReasoningMarkdown(input: {
  prompt: string
  sql: string
  selectedTables: SelectedSqlTable[]
  matches: SqlCatalogMatch[]
  selectorReasoning?: string
  confidence: number
  takeover?: boolean
}) {
  const selected = input.selectedTables.length
    ? input.selectedTables.map((item) => `- \`${item.schema}.${item.table}\`: ${item.reason}`).join("\n")
    : "- 暂未锁定明确表，需要补充业务对象。"
  const candidates = input.matches.slice(0, 5).map((item) => `\`${item.schema}.${item.table}\`(${Math.round(item.score)})`).join("、") || "无"
  const sqlPlan = input.sql
    ? (/join\s+/i.test(input.sql)
        ? "生成了带关联的查询，优先使用目录里的关系提示和真实字段名。"
        : /group\s+by|count\(|sum\(|avg\(/i.test(input.sql)
          ? "生成了统计型查询，控制聚合维度和返回行数。"
          : "生成了明细型查询，优先返回可直接检查的关键字段。")
    : "这次没有生成 SQL，可能需要用户补充更明确的表或业务对象。"
  return [
    "### 需求理解",
    `我将需求理解为：${input.prompt}`,
    "",
    "### 表选择理由",
    selected,
    "",
    `候选目录匹配：${candidates}`,
    input.selectorReasoning ? `\n${input.selectorReasoning}` : "",
    "",
    "### SQL 方案",
    sqlPlan,
    "",
    "### 权限/风险边界",
    input.takeover
      ? "当前为接管模式：只会在用户权限内新建查询并执行；Public 表仍遵循授权，Private 表允许完整操作。"
      : "当前为草稿模式：只生成可应用、可新建或可试验的 SQL，不直接改动数据。",
    `\n置信度：${Math.round(input.confidence * 100)}%。`,
  ].filter(Boolean).join("\n")
}

export async function runSqlAssistant(userId: string, input: SqlAssistantRequest): Promise<SqlAssistantResponse> {
  const provider = await getEffectiveProviderConfig(userId)
  if (!provider) throw new Error("AI access is not available")

  const schema = await getEffectiveSchema(userId)
  const prompt = input.prompt?.trim() || input.messages?.at(-1)?.content?.trim() || ""
  if (!prompt) throw new Error("Please enter a SQL Lab request")

  const catalogMatches = searchSqlCatalog(
    schema,
    {
      prompt,
      currentSql: input.currentSql,
      lastError: input.lastResult?.error?.message,
      touchedTables: input.lastResult?.touchedTables,
    },
    18
  )
  const selector = await selectTablesWithModel({
    provider,
    prompt,
    currentSql: input.currentSql,
    lastResult: input.lastResult,
    matches: catalogMatches,
    schema,
  })
  const selectedDetails = selectedTableDetails(schema, selector.selectedTables)
  const shouldClarify =
    Boolean(selector.clarifyingQuestion) &&
    selector.confidence < 0.35 &&
    likelyNeedsSql(prompt, input.currentSql, input.lastResult) &&
    !likelyPrivateAction(prompt)

  if (shouldClarify) {
    const reasoningMarkdown = buildFallbackReasoningMarkdown({
      prompt,
      sql: "",
      selectedTables: selector.selectedTables,
      matches: catalogMatches,
      selectorReasoning: selector.reasoningMarkdown,
      confidence: selector.confidence,
      takeover: input.takeover,
    })
    return {
      message: selector.clarifyingQuestion || "我需要再确认一下你要查的业务对象。",
      sql: "",
      title: "SQL Tutor",
      reasoningMarkdown,
      selectedTables: selector.selectedTables,
      catalogMatches,
      confidence: selector.confidence,
      actions: [],
      executedActions: [],
      provider: {
        label: provider.providerLabel,
        model: provider.model,
        source: provider.source,
      },
    }
  }

  const conversation = (input.messages ?? []).slice(-8)
  const baseMessages: ProviderMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        mode: input.takeover ? "takeover" : "draft",
        currentSql: input.currentSql ?? "",
        lastResult: input.lastResult ?? null,
        schema: schemaSummary(schema),
        catalogCandidates: catalogMatches.slice(0, 14).map(compactCatalogMatch),
        selectedTables: selectedDetails.map(compactTableDetail),
        selectedTableReasons: selector.selectedTables,
        catalogRetrieval: {
          confidence: selector.confidence,
          selectorReasoningMarkdown: selector.reasoningMarkdown,
        },
      }),
    },
    ...conversation.map((item): ProviderMessage => ({
      role: item.role,
      content: item.content,
    })),
    { role: "user", content: prompt },
  ]

  let providerResult = await requestProviderChat({
    provider: { ...provider, temperature: Math.min(provider.temperature, 0.2) },
    messages: baseMessages,
    stream: false,
    toolChoice: "none",
    timeoutMs: 75_000,
  })

  let normalized = normalizePayload(providerResult.assistantText)
  if (!normalized.sql && !normalized.actions.length && likelyNeedsSql(prompt, input.currentSql, input.lastResult)) {
    providerResult = await requestProviderChat({
      provider: { ...provider, temperature: 0 },
      messages: [
        ...baseMessages,
        { role: "assistant", content: providerResult.assistantText.slice(0, 4000) },
        { role: "user", content: RETRY_PROMPT },
      ],
      stream: false,
      toolChoice: "none",
      timeoutMs: 45_000,
    })
    normalized = normalizePayload(providerResult.assistantText)
  }

  const confidence = clampConfidence(normalized.payload.confidence, selector.confidence)
  const title = typeof normalized.payload.title === "string" && normalized.payload.title.trim()
    ? normalized.payload.title.trim().slice(0, 60)
    : "SQL Tutor"
  const message = typeof normalized.payload.message === "string" && normalized.payload.message.trim()
    ? normalized.payload.message.trim()
    : normalized.sql
      ? "我已经按你的需求生成了 SQL。"
      : providerResult.assistantText.trim() || "我整理好了建议。"

  const actionsForResponse = [...normalized.actions]
  if (input.takeover && normalized.sql && !actionsForResponse.some((action) => action.type === "execute_sql")) {
    actionsForResponse.push({ type: "execute_sql", sql: normalized.sql, title })
  }

  const executableActions = input.takeover ? actionsForResponse : []
  const executed = await executeAssistantActions(userId, executableActions, input.limit)
  const reasoningMarkdown =
    typeof normalized.payload.reasoningMarkdown === "string" && normalized.payload.reasoningMarkdown.trim()
      ? normalized.payload.reasoningMarkdown.trim()
      : buildFallbackReasoningMarkdown({
          prompt,
          sql: normalized.sql,
          selectedTables: selector.selectedTables,
          matches: catalogMatches,
          selectorReasoning: selector.reasoningMarkdown,
          confidence,
          takeover: input.takeover,
        })

  return {
    message,
    sql: normalized.sql,
    title,
    reasoningMarkdown,
    selectedTables: selector.selectedTables,
    catalogMatches,
    confidence,
    actions: actionsForResponse,
    executedActions: executed.executedActions,
    runResult: executed.runResult,
    provider: {
      label: provider.providerLabel,
      model: provider.model,
      source: provider.source,
    },
  }
}
