import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import {
  GuardianServiceError,
  listGuardianEvents,
  recordGuardianEvent,
} from "@/lib/sql-guardian/server/profile-service"
import {
  createGuardianEventSchema,
  guardianEventsQuerySchema,
  normalizeJsonInput,
} from "@/lib/sql-guardian/server/validation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" } as const

function jsonError(error: unknown) {
  if (error instanceof GuardianServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: NO_STORE })
  }

  const message = error instanceof Error ? error.message : "Unexpected Guardian error"
  return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE })
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: NO_STORE })

  const parsed = guardianEventsQuerySchema.safeParse({
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
    cursor: req.nextUrl.searchParams.get("cursor") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST", detail: parsed.error.flatten() }, { status: 400, headers: NO_STORE })
  }

  try {
    const result = await listGuardianEvents(session.userId, parsed.data)
    return NextResponse.json(result, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: NO_STORE })

  const body = await req.json().catch(() => null)
  const parsed = createGuardianEventSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST", detail: parsed.error.flatten() }, { status: 400, headers: NO_STORE })
  }

  try {
    const result = await recordGuardianEvent(session.userId, {
      ...parsed.data,
      eventPayloadJson: normalizeJsonInput(parsed.data.eventPayloadJson),
    })
    return NextResponse.json(result, { status: 201, headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
