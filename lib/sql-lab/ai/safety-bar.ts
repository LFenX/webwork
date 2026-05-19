import "server-only"

type SafetyAction = "auto_execute" | "manual_approve" | "reject"

export type SqlSafetyDecision = {
  command: string
  readOnly: boolean
  action: SafetyAction
  reason: string
}

function stripSql(sql: string) {
  return sql
    .replace(/'([^']|'')*'/g, " ")
    .replace(/"([^"]|"")*"/g, " ")
    .replace(/--.*$/gm, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
}

export function decideSqlSafety(sql: string, options: { privateSchema?: string; forceReadOnly?: boolean } = {}): SqlSafetyDecision {
  const stripped = stripSql(sql).trim()
  const command = stripped.match(/^([a-z]+)/i)?.[1]?.toLowerCase() ?? ""
  const mutatingInsideWith = command === "with" && /\b(insert|update|delete|create|alter|drop|truncate)\b/i.test(stripped)
  const readOnly = (command === "select" || command === "explain" || (command === "with" && !mutatingInsideWith))

  if (readOnly) {
    return { command, readOnly: true, action: "auto_execute", reason: "只读 SQL，可按安全栏自动执行。" }
  }

  if (options.forceReadOnly) {
    return { command, readOnly: false, action: "reject", reason: "自主探查只允许 SELECT/WITH/EXPLAIN。" }
  }

  if (["insert", "update", "delete"].includes(command)) {
    return { command, readOnly: false, action: "manual_approve", reason: "DML 会修改数据，需要用户确认执行。" }
  }

  if (["create", "alter", "drop", "truncate"].includes(command)) {
    const privateSchema = options.privateSchema
    const touchesPrivate = privateSchema
      ? sql.includes(`"${privateSchema}".`) || new RegExp(`\\b${privateSchema.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\.`, "i").test(sql)
      : false
    if (!touchesPrivate) {
      return { command, readOnly: false, action: "reject", reason: "Private schema 之外的 DDL 被强制拒绝。" }
    }
    return { command, readOnly: false, action: "manual_approve", reason: "Private DDL 也需要用户确认执行。" }
  }

  return { command, readOnly: false, action: "reject", reason: "安全栏不允许该 SQL 命令。" }
}
