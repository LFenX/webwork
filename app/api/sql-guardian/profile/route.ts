import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import {
  GuardianServiceError,
  getOrCreateGuardianProfile,
  serializeGuardianProfileResponse,
  updateGuardianProfile,
} from "@/lib/sql-guardian/server/profile-service"
import { updateGuardianProfileSchema } from "@/lib/sql-guardian/server/validation"

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

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: NO_STORE })

  try {
    const profile = await getOrCreateGuardianProfile(session.userId)
    return NextResponse.json(serializeGuardianProfileResponse(profile), { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: NO_STORE })

  const body = await req.json().catch(() => null)
  const parsed = updateGuardianProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST", detail: parsed.error.flatten() }, { status: 400, headers: NO_STORE })
  }

  try {
    const profile = await updateGuardianProfile(session.userId, parsed.data)
    return NextResponse.json(serializeGuardianProfileResponse(profile), { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
