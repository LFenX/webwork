import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { revokeGuardianMemoryBridge } from "@/lib/sql-guardian/server/bridge-service"
import { GuardianServiceError } from "@/lib/sql-guardian/server/profile-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" } as const

function jsonError(error: unknown) {
  if (error instanceof GuardianServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: NO_STORE })
  }

  const message = error instanceof Error ? error.message : "Unexpected Guardian memory bridge error"
  return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  try {
    const result = await revokeGuardianMemoryBridge(session.userId, id)
    return NextResponse.json(result, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
