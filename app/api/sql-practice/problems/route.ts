import { NextRequest, NextResponse } from "next/server"
import { requireSqlPracticeAccess } from "@/lib/sql-practice/access"
import { createPracticeProblemSchema } from "@/lib/sql-practice/validators"
import { createProblem, listProblems } from "@/lib/sql-practice/service"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" } as const

function forbidden() {
  return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: NO_STORE })
}

export async function GET(req: NextRequest) {
  let access
  try { access = await requireSqlPracticeAccess() } catch { return forbidden() }

  const sp = req.nextUrl.searchParams
  const from = sp.get("from")
  const to = sp.get("to")
  const difficulty = sp.get("difficulty") || undefined
  const source = sp.get("source") || undefined
  const tag = sp.get("tag") || undefined
  const method = sp.get("method") || undefined
  const q = sp.get("q") || undefined
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 200), 1), 500)

  const items = await listProblems(
    access.userId,
    {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      difficulty,
      source,
      tag,
      method,
      q,
    },
    limit
  )
  return NextResponse.json({ items }, { headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  let access
  try { access = await requireSqlPracticeAccess() } catch { return forbidden() }

  const body = await req.json().catch(() => null)
  const parsed = createPracticeProblemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误", detail: parsed.error.flatten() }, { status: 400 })
  }
  const problem = await createProblem(access.userId, parsed.data)
  return NextResponse.json(problem, { status: 201, headers: NO_STORE })
}
