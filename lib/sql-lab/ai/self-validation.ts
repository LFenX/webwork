import "server-only"

import type { ProviderMessage } from "@/lib/ai/provider"
import { SQL_STAGE_REPAIR_PROMPT } from "@/lib/sql-lab/ai/system-prompts"
import { validateSql } from "@/lib/sql-lab/service"

export async function validateDraftSql(viewerId: string, sql: string) {
  return validateSql(viewerId, { sql })
}

export function buildSqlRepairMessages(input: {
  prompt: string
  contextMarkdown: string
  sql: string
  errorMessage: string
  errorHint?: string
}): ProviderMessage[] {
  return [
    { role: "system", content: SQL_STAGE_REPAIR_PROMPT },
    {
      role: "user",
      content: [
        `## 用户问题\n${input.prompt}`,
        `## Schema 上下文\n${input.contextMarkdown}`,
        `## 未通过自检的 SQL\n\`\`\`sql\n${input.sql}\n\`\`\``,
        `## PREPARE 错误\n${input.errorMessage}${input.errorHint ? `\nHint: ${input.errorHint}` : ""}`,
      ].join("\n\n"),
    },
  ]
}
