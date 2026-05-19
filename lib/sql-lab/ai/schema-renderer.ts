import type { SqlFewShot } from "@/lib/sql-lab/ai/few-shot-bank"
import { clampMarkdownSections } from "@/lib/sql-lab/ai/token-budget"
import type { SqlRelationGraphV2FkEdge, SqlSchema, SqlTableInfo, SqlThreadCandidateTable } from "@/lib/sql-lab/types"

export type SchemaProfileRecord = {
  schemaName: string
  tableName: string
  columnName: string | null
  profileJson: unknown
}

function profileMap(profiles: SchemaProfileRecord[]) {
  return new Map(profiles.map((profile) => [`${profile.schemaName}.${profile.tableName}.${profile.columnName ?? ""}`, profile.profileJson]))
}

function formatProfile(value: unknown) {
  if (!value || typeof value !== "object") return ""
  const p = value as Record<string, unknown>
  const parts: string[] = []
  if (typeof p.rowEstimate === "number") parts.push(`rows≈${p.rowEstimate}`)
  if (typeof p.distinctCount === "number") parts.push(`distinct=${p.distinctCount}`)
  if (typeof p.nullRatio === "number") parts.push(`null=${Math.round(p.nullRatio * 100)}%`)
  if (Array.isArray(p.sampleValues) && p.sampleValues.length) parts.push(`samples=${p.sampleValues.slice(0, 8).map((item) => JSON.stringify(item)).join("/")}`)
  if (p.minValue || p.maxValue) parts.push(`range=${String(p.minValue ?? "?")}~${String(p.maxValue ?? "?")}`)
  return parts.length ? ` [${parts.join(", ")}]` : ""
}

function tableKey(table: Pick<SqlTableInfo, "schema" | "name">) {
  return `${table.schema}.${table.name}`
}

function renderTable(table: SqlTableInfo, selected: SqlThreadCandidateTable | undefined, profiles: Map<string, unknown>, fkEdges: SqlRelationGraphV2FkEdge[]) {
  const catalog = table.catalog
  const role = selected?.role ?? "reference"
  const tableProfile = formatProfile(profiles.get(`${table.schema}.${table.name}.`))
  const outbound = fkEdges.filter((edge) => edge.from.schema === table.schema && edge.from.table === table.name)
  const inbound = fkEdges.filter((edge) => edge.to.schema === table.schema && edge.to.table === table.name)
  const fkLines = [
    ...outbound.map((edge) => `- ${edge.from.column} -> ${edge.to.schema}.${edge.to.table}.${edge.to.column} (on delete ${edge.onDelete})`),
    ...inbound.map((edge) => `- ${edge.from.schema}.${edge.from.table}.${edge.from.column} -> ${edge.to.column}`),
  ].slice(0, 12)

  return [
    `### ${table.name} (${table.schema}.${catalog?.submoduleId ?? "table"}, ${role})`,
    `**用途**：${catalog?.description ?? table.comment ?? "未配置说明"}`,
    `**访问**：${table.access}；scope=${table.scope ?? "public"}${tableProfile}`,
    `**关键字段**：`,
    ...table.columns.slice(0, 24).map((column) => {
      const colProfile = formatProfile(profiles.get(`${table.schema}.${table.name}.${column.name}`))
      return `- ${column.name} (${column.dataType}${column.nullable ? ", nullable" : ""}${column.isPrimaryKey ? ", PK" : ""}${column.isForeignKey ? ", FK" : ""}${column.isMasked ? ", masked" : ""})${colProfile}`
    }),
    fkLines.length ? `**外键关系**：\n${fkLines.join("\n")}` : "",
    catalog?.useCases?.length ? `**常见用途**：${catalog.useCases.join("；")}` : "",
  ].filter(Boolean).join("\n")
}

export function renderSchemaPrompt(input: {
  schema: SqlSchema
  selected: SqlThreadCandidateTable[]
  tables: SqlTableInfo[]
  profiles: SchemaProfileRecord[]
  fkEdges: SqlRelationGraphV2FkEdge[]
  fewShots: SqlFewShot[]
  resultFacts: string[]
  pinnedMemories: string[]
}) {
  const profiles = profileMap(input.profiles)
  const selectedByKey = new Map(input.selected.map((item) => [`${item.schema}.${item.table}`, item]))
  const tableSections = input.tables.map((table) => renderTable(table, selectedByKey.get(tableKey(table)), profiles, input.fkEdges))
  const fewShotSections = input.fewShots.map((shot, index) => [
    `### 示例 ${index + 1}：${shot.title}`,
    `**用户**：${shot.user}`,
    `**SQL**：`,
    "```sql",
    shot.sql,
    "```",
  ].join("\n"))

  return clampMarkdownSections([
    `## 数据源
- PostgreSQL，当前用户：${input.schema.viewer.displayName}（role=${input.schema.viewer.role}）
- 严格遵循 SQL Lab 行级权限、列遮罩和 Private schema 边界。
- defaultLimit=${input.schema.defaultLimit}；maxLimit=${input.schema.maxLimit}`,
    input.resultFacts.length ? `## 当前线程已知事实\n${input.resultFacts.join("\n\n")}` : "",
    input.pinnedMemories.length ? `## 用户置顶的长期分析记忆\n${input.pinnedMemories.join("\n\n")}` : "",
    `## 选定的表（按相关性排序）\n${tableSections.join("\n\n")}`,
    fewShotSections.length ? `## Few-shot 示例\n${fewShotSections.join("\n\n")}` : "",
    `## 输出契约
返回严格 JSON：{ message, sql, title, reasoningMarkdown, confidence, needsClarification, suggestedCharts }`,
  ].filter(Boolean))
}
