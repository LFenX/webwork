import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { createPrivateFolder, getPrivateFolders, jsonError } from "@/lib/sql-lab/service"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" } as const

export async function GET() {
  try {
    const session = await requireAuth()
    return NextResponse.json({ items: await getPrivateFolders(session.userId) }, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await req.json().catch(() => ({}))
    return NextResponse.json(await createPrivateFolder(session.userId, body), { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
