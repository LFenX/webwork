import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { listGuardianDialogues } from "@/lib/sql-guardian/server/dialogue-service"
import { GuardianServiceError } from "@/lib/sql-guardian/server/profile-service"
import { guardianDialoguesQuerySchema } from "@/lib/sql-guardian/server/validation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" } as const

function jsonError(error: unknown) {
  if (error instanceof GuardianServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: NO_STORE })
  }

  const message = error instanceof Error ? error.message : "Unexpected Guardian dialogue error"
  return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE })
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: NO_STORE })

  const parsed = guardianDialoguesQuerySchema.safeParse({
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST", detail: parsed.error.flatten() }, { status: 400, headers: NO_STORE })
  }

  try {
    const result = await listGuardianDialogues(session.userId, parsed.data)
    return NextResponse.json(result, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
