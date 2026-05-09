import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import {
  createGuardianMemory,
  listGuardianMemories,
} from "@/lib/sql-guardian/server/memory-service"
import { GuardianServiceError } from "@/lib/sql-guardian/server/profile-service"
import {
  createGuardianMemorySchema,
  guardianMemoriesQuerySchema,
} from "@/lib/sql-guardian/server/validation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" } as const

function jsonError(error: unknown) {
  if (error instanceof GuardianServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: NO_STORE })
  }

  const message = error instanceof Error ? error.message : "Unexpected Guardian memory error"
  return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE })
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: NO_STORE })

  const parsed = guardianMemoriesQuerySchema.safeParse({
    status: req.nextUrl.searchParams.get("status") ?? undefined,
    type: req.nextUrl.searchParams.get("type") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST", detail: parsed.error.flatten() }, { status: 400, headers: NO_STORE })
  }

  try {
    const result = await listGuardianMemories(session.userId, parsed.data)
    return NextResponse.json(result, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: NO_STORE })

  const body = await req.json().catch(() => null)
  const parsed = createGuardianMemorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST", detail: parsed.error.flatten() }, { status: 400, headers: NO_STORE })
  }

  try {
    const memory = await createGuardianMemory(session.userId, parsed.data)
    return NextResponse.json({ memory }, { status: 201, headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
