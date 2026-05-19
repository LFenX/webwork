import type { ProviderToolSpec } from "@/lib/ai/provider"

export const TOOL_RUN_SAFE_SQL: ProviderToolSpec = {
  type: "function",
  function: {
    name: "run_safe_sql",
    description:
      "Execute a read-only SQL query and read the result. Use it to verify hypotheses, check distinct values, sample data, or compute aggregates needed for the final answer.",
    parameters: {
      type: "object",
      required: ["sql", "purpose"],
      additionalProperties: false,
      properties: {
        sql: {
          type: "string",
          description: "A single SELECT, WITH...SELECT, or EXPLAIN statement. Other commands are rejected.",
        },
        purpose: {
          type: "string",
          description: "Why this query is needed, in one Chinese sentence shown to the user.",
        },
      },
    },
  },
}
