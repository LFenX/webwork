import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { executeSql, jsonError } from "@/lib/sql-lab/service"
import { appendThreadStep } from "@/lib/sql-lab/threads"
import type { SqlRunRequest, SqlRunResult } from "@/lib/sql-lab/types"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" } as const

type RunBody = SqlRunRequest & {
  threadId?: string
  threadStepId?: string
  title?: string
}

function summarizeRun(result: SqlRunResult): { rowCount: number; truncated: boolean; columns: number } {
  const last = result.resultSets[result.resultSets.length - 1]
  return {
    rowCount: last?.rowCount ?? 0,
    truncated: Boolean(last?.truncated),
    columns: last?.columns?.length ?? 0,
  }
}

function sampleRows(result: SqlRunResult, max = 20) {
  const last = result.resultSets[result.resultSets.length - 1]
  if (!last) return []
  return last.rows.slice(0, max)
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth()
    const body = (await req.json().catch(() => ({}))) as RunBody
    const result = await executeSql(session.userId, body, {
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
      threadId: body.threadId,
      threadStepId: body.threadStepId,
    })

    if (body.threadId) {
      const summary = summarizeRun(result)
      const last = result.resultSets[result.resultSets.length - 1]
      try {
        await appendThreadStep(session.userId, {
          threadId: body.threadId,
          kind: "sql_run",
          status: result.ok ? "done" : "error",
          title: body.title || (result.ok ? `${summary.rowCount} rows` : "Execution failed"),
          bodyMarkdown: result.ok
            ? `Executed successfully, returned ${summary.rowCount} rows${summary.truncated ? " (truncated)" : ""}, duration ${result.durationMs} ms.`
            : `Execution failed: ${result.error?.message ?? "Unknown error"}`,
          sql: body.sql,
          durationMs: result.durationMs,
          payload: {
            runId: result.runId,
            ok: result.ok,
            rowCount: summary.rowCount,
            truncated: summary.truncated,
            columns: last?.columns ?? [],
            sampleRows: sampleRows(result),
            touchedTables: result.touchedTables ?? [],
            warnings: result.warnings,
            error: result.error,
          },
          errorMessage: result.ok ? null : result.error?.message ?? "Execution failed",
        })
      } catch {
        // Soft-fail: never block returning the run result on step persistence.
      }
    }

    return NextResponse.json(result, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
