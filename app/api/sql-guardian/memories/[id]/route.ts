import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import {
  deleteGuardianMemory,
  updateGuardianMemory,
} from "@/lib/sql-guardian/server/memory-service"
import { GuardianServiceError } from "@/lib/sql-guardian/server/profile-service"
import { updateGuardianMemorySchema } from "@/lib/sql-guardian/server/validation"

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = updateGuardianMemorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST", detail: parsed.error.flatten() }, { status: 400, headers: NO_STORE })
  }

  try {
    const memory = await updateGuardianMemory(session.userId, id, parsed.data)
    return NextResponse.json({ memory }, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  try {
    const result = await deleteGuardianMemory(session.userId, id)
    return NextResponse.json(result, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
