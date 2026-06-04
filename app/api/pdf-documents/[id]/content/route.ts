import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { getPdfDocumentContentForUser } from "@/lib/pdf/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id } = await params
  const content = await getPdfDocumentContentForUser(session.userId, id, {
    query: req.nextUrl.searchParams.get("q") || undefined,
    limit: Number(req.nextUrl.searchParams.get("limit") || 0) || undefined,
  })
  if (!content) return NextResponse.json({ error: "not_found" }, { status: 404 })

  return NextResponse.json(content)
}
