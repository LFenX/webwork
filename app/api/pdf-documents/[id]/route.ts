import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { getPdfDocumentForUser } from "@/lib/pdf/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id } = await params
  const document = await getPdfDocumentForUser(session.userId, id)
  if (!document) return NextResponse.json({ error: "not_found" }, { status: 404 })

  return NextResponse.json({ document })
}
