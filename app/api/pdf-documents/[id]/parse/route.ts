import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { enqueuePdfParse } from "@/lib/pdf/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const document = await enqueuePdfParse(session.userId, id, { force: Boolean(body?.force) })
  if (!document) return NextResponse.json({ error: "not_found" }, { status: 404 })

  return NextResponse.json({ document })
}
